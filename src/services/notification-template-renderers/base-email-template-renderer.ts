import type { BaseNotificationTemplateRenderer } from './base-notification-template-renderer';
import type { Notification } from '../../types/notification';
import type { Buffer } from 'node:buffer';
import type { JsonObject } from '../../types/json-values';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export type Attachment = File | Buffer | string;

export type EmailTemplate = {
  subject: string;
  body: string;
};

export interface BaseEmailTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationTemplateRenderer<
    Config,
    EmailTemplate
  > {
  render(
    notification: Notification<Config>,
    context: JsonObject,
  ): Promise<EmailTemplate>;
}
