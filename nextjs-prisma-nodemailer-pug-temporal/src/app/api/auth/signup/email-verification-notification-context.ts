import { PrismaClient } from '@prisma/client';
import type { ContextGenerator } from 'vintasend/dist/services/notification-context-registry';

export class EmailVerificationNotificationContextGenerator implements ContextGenerator {
  async generate(params: { token: string }): Promise<{ firstName: string | null, verificationLink: string }> {
    const prisma = new PrismaClient();

    const APP_DOMAIN = process.env.APP_DOMAIN;

    const token = await prisma.token.findUnique({
      where: { token: params.token },
      select: { user: true },
    });

    if (!token || !token.user) {
      throw new Error('Token not found');
    }

    return {
      firstName: token.user.firstName,
      verificationLink: `${APP_DOMAIN}/auth/verify-email/${params.token}/`,
    };
  }
}
