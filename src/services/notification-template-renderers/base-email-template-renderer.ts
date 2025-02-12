import type { BaseNotificationTemplateRenderer } from './base-notification-template-renderer';
import type { Notification } from '../../types/notification';
import type { Buffer } from 'node:buffer';
import type { ContextGenerator } from '../notification-context-registry';
import type { JsonObject } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';

export type Attachment = File | Buffer | string;

export type EmailTemplate = {
  subject: string;
  body: string;
};

export interface BaseEmailTemplateRenderer<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> extends BaseNotificationTemplateRenderer<
    AvailableContexts,
    NotificationIdType,
    UserIdType,
    EmailTemplate
  > {
  render(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
    context: JsonObject,
  ): Promise<EmailTemplate>;
}
