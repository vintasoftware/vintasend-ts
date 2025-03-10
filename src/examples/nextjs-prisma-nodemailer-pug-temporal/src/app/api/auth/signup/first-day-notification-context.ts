import { PrismaClient } from '@prisma/client';
import type { ContextGenerator } from 'vintasend/dist/services/notification-context-registry';

export class FirstDayotificationContextGenerator implements ContextGenerator {
  async generate(params: { userId: number }): Promise<{ firstName: string | null }> {
    const prisma = new PrismaClient();

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return {
      firstName: user.firstName,
    };
  }
}
