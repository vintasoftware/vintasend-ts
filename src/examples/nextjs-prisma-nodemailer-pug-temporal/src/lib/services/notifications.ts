import { PrismaClient } from '@prisma/client';
import { VintaSendFactory } from 'vintasend/dist/index.js';
import { PrismaNotificationBackendFactory } from 'vintasend-prisma/dist/index.js';
import { PugEmailTemplateRendererFactory } from 'vintasend-pug/dist/index.js';
import { NodemailerNotificationAdapterFactory } from 'vintasend-nodemailer/dist/index.js';
import { WinstonLogger } from 'vintasend-winston/dist/index.js';
import { ForgotPasswordContextGenerator } from '../../app/api/auth/forgot-password/forgot-password-notification-context';
import { EmailVerificationNotificationContextGenerator } from '../../app/api/auth/signup/email-verification-notification-context';
import { FirstDayotificationContextGenerator } from '../../app/api/auth/signup/first-day-notification-context';
import { loggerOptions } from '../logger';
import type { Notification, User } from '@prisma/client';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';

export const contextGeneratorsMap = {
  forgotPassword: new ForgotPasswordContextGenerator(),
  emailVerification: new EmailVerificationNotificationContextGenerator(),
  firstDay: new FirstDayotificationContextGenerator(),
} as const;

export type NotificationTypeConfig = {
  ContextMap: typeof contextGeneratorsMap;
  NotificationIdType: Notification['id'];
  UserIdType: User['id'];
};

export function getNotificationService() {
  const notificationBackend = new PrismaNotificationBackendFactory<NotificationTypeConfig>().create(
    new PrismaClient(),
  );
  const pugEmailTemplateRenderer =
    new PugEmailTemplateRendererFactory<NotificationTypeConfig>().create({});
  const nodemailerNotificationAdapter =
    new NodemailerNotificationAdapterFactory<NotificationTypeConfig>().create(
      pugEmailTemplateRenderer,
      true,
      {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false, // true for port 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      } as SMTPTransport.Options,
    );
  return new VintaSendFactory<NotificationTypeConfig>().create(
    [nodemailerNotificationAdapter],
    notificationBackend,
    new WinstonLogger(loggerOptions),
    contextGeneratorsMap,
  );
}
