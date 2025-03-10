import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../../../lib/services/auth';
import { NextResponse } from 'next/server';
import * as z from 'zod';
import type { WriteApiResponse } from '../../../../lib/api-clients/core';
import { verifyEmailSchema, type VerifyEmailValues } from '../../../../lib/schemas/auth';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';


type VerifyEmailSuccess = null;
type VerifyEmailValidationError = z.typeToFlattenedError<VerifyEmailValues>;
export type VerifyEmailApiResponse = WriteApiResponse<VerifyEmailSuccess, VerifyEmailValidationError>;
type VerifyEmailNextResponse = NextResponse<VerifyEmailApiResponse>;


export async function POST(req: Request): Promise<VerifyEmailNextResponse> {
  try {
    const body = await req.json();
    const { token } = verifyEmailSchema.parse(body);
    const prisma = new PrismaClient();
    const decoded = verifyToken<{ userId: string }>(token);

    const tokenRecord = await prisma.token.findFirst({
      where: {
        token,
        type: 'EMAIL_VERIFICATION',
        expiresAt: { gt: new Date() },
      },
    });

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id: Number.parseInt(decoded.userId) },
      data: { isEmailVerified: true },
    });

    await prisma.token.delete({ where: { id: tokenRecord.id } });

    return NextResponse.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError: z.ZodError<VerifyEmailValues> = error;
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

    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
