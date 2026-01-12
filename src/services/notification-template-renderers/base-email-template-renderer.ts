import type { Buffer } from 'node:buffer';
import type { JsonObject } from '../../types/json-values';
import type { AnyNotification, Notification } from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';
import type { BaseNotificationTemplateRenderer } from './base-notification-template-renderer';

export type Attachment = File | Buffer | string;

export type EmailTemplate = {
  subject: string;
  body: string;
};

export interface BaseEmailTemplateRenderer<Config extends BaseNotificationTypeConfig>
  extends BaseNotificationTemplateRenderer<Config, EmailTemplate> {
  render(notification: AnyNotification<Config>, context: JsonObject): Promise<EmailTemplate>;
}
