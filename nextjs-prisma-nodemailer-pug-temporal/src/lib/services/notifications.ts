import { PrismaClient } from '@prisma/client';
import { NotificationService, NotificationContextRegistry } from 'vintasend/dist/index.js';
import { PrismaNotificationBackend } from 'vintasend-prisma/dist/index.js';
import { PugEmailTemplateRenderer } from 'vintasend-pug/dist/index.js';
import { NodemailerNotificationAdapter } from 'vintasend-nodemailer/dist/index.js';
import { WinstonLogger } from 'vintasend-winston/dist/index.js';
import { ForgotPasswordContextGenerator } from '../../app/api/auth/forgot-password/forgot-password-notification-context';
import { EmailVerificationNotificationContextGenerator } from '../../app/api/auth/signup/email-verification-notification-context';
import { FirstDayotificationContextGenerator } from '../../app/api/auth/signup/first-day-notification-context';
import { loggerOptions } from '../logger';
import type { Notification, User } from '@prisma/client';
import type SMTPTransport from 'nodemailer/lib/smtp-transport/index.js';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';

export const contextGeneratorsMap = {
  forgotPassword: new ForgotPasswordContextGenerator(),
  emailVerification: new EmailVerificationNotificationContextGenerator(),
  firstDay: new FirstDayotificationContextGenerator(),
} as const;

export type ContextMap = typeof contextGeneratorsMap;

export type NotificationTypeConfig = BaseNotificationTypeConfig & {
  ContextMap: ContextMap;
  NotificationIdType: Notification['id'];
  UserIdType: User['id'];
};

export function getNotificationService() {
  const prisma = new PrismaClient();
  const notificationBackend = new PrismaNotificationBackend<
    PrismaClient,
    NotificationTypeConfig
  >(prisma);
  const pugEmailTemplateRenderer = new PugEmailTemplateRenderer<NotificationTypeConfig>();
  const nodemailerNotificationAdapter = new NodemailerNotificationAdapter<
    PugEmailTemplateRenderer<NotificationTypeConfig>,
    NotificationTypeConfig
  >(pugEmailTemplateRenderer, true, {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for port 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  } as SMTPTransport.Options)
  return new NotificationService<NotificationTypeConfig>(
    [nodemailerNotificationAdapter],
    notificationBackend,
    new WinstonLogger(loggerOptions),
  );
}

NotificationContextRegistry.initialize<ContextMap>(contextGeneratorsMap);
