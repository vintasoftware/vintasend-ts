import type { ForgotPasswordValues } from '../../../../lib/schemas/auth';
import type { WriteApiResponse } from '../../../../lib/api-clients/core';
import { forgotPasswordSchema } from '../../../../lib/schemas/auth';
import { PrismaClient } from '@prisma/client';
import { generateToken } from '../../../../lib/services/auth';
import { NextResponse } from 'next/server';
import * as z from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { getNotificationServiceWithQueue } from '../../../../lib/services/notifications-with-queue';

type ForgotPasswordSuccess = null;
type ForgotPasswordValidationError = z.typeToFlattenedError<ForgotPasswordValues>;
export type ForgotPasswordApiResponse = WriteApiResponse<ForgotPasswordSuccess, ForgotPasswordValidationError>;
type ForgotPasswordNextResponse = NextResponse<ForgotPasswordApiResponse>;

export async function POST(req: Request): Promise<ForgotPasswordNextResponse> {
  try {
    const body = await req.json();
    const { email } = forgotPasswordSchema.parse(body);
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const resetToken = generateToken({ userId: user.id }, '1h');
      await prisma.token.create({
        data: {
          token: resetToken,
          type: 'PASSWORD_RESET',
          userId: user.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      const notificationService = await getNotificationServiceWithQueue();
      await notificationService.createNotification({
        userId: user.id,
        notificationType: 'EMAIL',
        title: 'Password Reset',
        contextName: 'forgotPassword',
        contextParameters: { token: resetToken },
        sendAfter: new Date(),
        bodyTemplate: './src/email-templates/auth/forgot-password/forgot-password-body.html.pug',
        subjectTemplate: './src/email-templates/auth/forgot-password/forgot-password-subject.txt.pug',
        extraParams: {},
      });
    }

    return NextResponse.json({ success: true, message: 'If an account exists, a password reset email has been sent' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError: z.ZodError<ForgotPasswordValues> = error;
      return NextResponse.json(
        { success: false, error: 'Validation error', details: validationError.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { success: false, error: 'Database error occurred' },
        { status: 500 }
      );
    }

    console.error('Password reset error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
}
}
