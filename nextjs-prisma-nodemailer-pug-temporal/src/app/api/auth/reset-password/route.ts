import { PrismaClient } from '@prisma/client';
import { verifyToken, hashPassword } from '../../../../lib/services/auth';
import { NextResponse } from 'next/server';
import { passwordResetSchema, type PasswordResetValues } from '../../../../lib/schemas/auth';
import type { WriteApiResponse } from '../../../../lib/api-clients/core';
import * as z from 'zod';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type PasswordResetSuccess = null;
type PasswordResetValidationError = z.typeToFlattenedError<PasswordResetValues>;
export type PasswordResetApiResponse = WriteApiResponse<PasswordResetSuccess, PasswordResetValidationError>;
type PasswordResetNextResponse = NextResponse<PasswordResetApiResponse>;

export async function POST(req: Request): Promise<PasswordResetNextResponse> {
  try {
    const body = await req.json();
    const { token, password } = passwordResetSchema.parse(body);
    const decoded = verifyToken<{ userId: string }>(token);

    const prisma = new PrismaClient();

    const tokenRecord = await prisma.token.findFirst({
      where: {
        token,
        type: 'PASSWORD_RESET',
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { id: Number.parseInt(decoded.userId) },
      data: { password: hashedPassword },
    });

    await prisma.token.delete({ where: { id: tokenRecord.id } });

    return NextResponse.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError: z.ZodError<PasswordResetValues> = error;
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
