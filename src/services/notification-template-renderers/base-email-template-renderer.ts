import type { BaseNotificationTemplateRenderer } from './base-notification-template-renderer';
import type { Notification } from '../../types/notification';
import type { Buffer } from 'node:buffer';
import type { ContextGenerator } from '../notification-context-registry';
import type { JsonObject } from '../../types/json-values';

export type Attachment = File | Buffer | string;

export type EmailTemplate = {
  subject: string;
  body: string;
};

export interface BaseEmailTemplateRenderer<AvailableContexts extends Record<string, ContextGenerator>>
  extends BaseNotificationTemplateRenderer<AvailableContexts, EmailTemplate> {
  render(
    notification: Notification<AvailableContexts>,
    context: JsonObject
  ): Promise<EmailTemplate>;
}
