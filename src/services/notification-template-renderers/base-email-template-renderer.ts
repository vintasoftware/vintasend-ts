import type { Buffer } from 'node:buffer';
import type { JsonObject } from '../../types/json-values.js';
import type { AnyNotification } from '../../types/notification.js';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';
import {
  BaseNotificationTemplateRenderer,
  type NotificationSendInput,
} from './base-notification-template-renderer.js';

export type Attachment = File | Buffer | string;

/**
 * What an email renderer produces: the payload an adapter sends, plus the optional
 * `templateVersion` every send input carries.
 */
export type EmailTemplate = NotificationSendInput & {
  subject: string;
  body: string;
};

export type EmailTemplateContent = {
  subject: string | null;
  body: string;
};

export abstract class BaseEmailTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationTemplateRenderer<Config, EmailTemplate> {
  render(_notification: AnyNotification<Config>, _context: JsonObject): Promise<EmailTemplate> {
    throw 'Not implemented';
  }

  renderFromTemplateContent(
    _notification: AnyNotification<Config>,
    _templateContent: EmailTemplateContent,
    _context: JsonObject,
  ): Promise<EmailTemplate> {
    throw 'Not implemented';
  }
}
