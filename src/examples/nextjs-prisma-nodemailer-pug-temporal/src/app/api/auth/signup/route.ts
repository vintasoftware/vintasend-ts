import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../../../lib/services/auth';
import { signupSchema, type SignupValues } from '../../../../lib/schemas/auth';
import { NextResponse } from 'next/server';
import { generateToken } from '../../../../lib/services/auth';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import type { WriteApiResponse } from '../../../../lib/api-clients/core';
import * as z from 'zod';
import { getNotificationServiceWithQueue } from '../../../../lib/services/notifications-with-queue';
import { logger } from '../../../../lib/logger';


type SignupSuccess = { message: string };
type SignupValidationError = z.typeToFlattenedError<SignupValues>;
export type SignupApiResponse = WriteApiResponse<SignupSuccess, SignupValidationError>;
type SignupNextResponse = NextResponse<SignupApiResponse>;


export async function POST(req: Request): Promise<SignupNextResponse> {
  try {
    const body = await req.json();
    const { email, password, firstName, lastName } = signupSchema.parse(body);
    const prisma = new PrismaClient();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
    });

    const verificationToken = generateToken({ userId: user.id }, '24h');
    await prisma.token.create({
      data: {
        token: verificationToken,
        type: 'EMAIL_VERIFICATION',
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    const notificationService = await getNotificationServiceWithQueue();
    logger.info('Sending email verification notification', { userId: user.id });
    await notificationService.createNotification({
      userId: user.id,
      notificationType: 'EMAIL',
      title: 'Email Verification',
      contextName: 'emailVerification',
      contextParameters: { token: verificationToken },
      sendAfter: new Date(),
      bodyTemplate: './src/email-templates/auth/verify-email/verify-email-body.html.pug',
      subjectTemplate: './src/email-templates/auth/verify-email/verify-email-subject.txt.pug',
      extraParams: {},
    });

    const tomorrowAtNine = new Date();
    tomorrowAtNine.setDate(tomorrowAtNine.getDate() + 1);
    tomorrowAtNine.setHours(9, 0, 0, 0);
    logger.info('Sending first day notification', { userId: user.id });
    await notificationService.createNotification({
      userId: user.id,
      notificationType: 'EMAIL',
      title: 'First day using the App',
      contextName: 'firstDay',
      contextParameters: { userId: user.id },
      sendAfter: tomorrowAtNine,
      bodyTemplate: './src/email-templates/auth/verify-email/verify-email-body.html.pug',
      subjectTemplate: './src/email-templates/auth/verify-email/verify-email-subject.txt.pug',
      extraParams: {},
    });

    return NextResponse.json({ success: true, message: 'User created successfully' }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError: z.ZodError<SignupValues> = error;
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: validationError.flatten(),
        },
        { status: 400 }
      );
    }

    if (error instanceof PrismaClientKnownRequestError) {
      return NextResponse.json(
        { success: false, error: 'Database error occurred' },
        { status: 500 }
      );
    }

    console.error('Signup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
