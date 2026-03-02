import type { Buffer } from 'node:buffer';
import type { JsonObject } from '../../types/json-values';
import type { AnyNotification } from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationTemplateRenderer } from './base-notification-template-renderer';

export type Attachment = File | Buffer | string;

export type TextNotificationTemplate = {
  text: string;
};

export type TextNotificationTemplateContent = {
  text: string;
};

export interface BaseTextNotificationTemplateRenderer<Config extends BaseNotificationTypeConfig>
  extends BaseNotificationTemplateRenderer<Config, TextNotificationTemplate> {
  render(
    notification: AnyNotification<Config>,
    context: JsonObject,
  ): Promise<TextNotificationTemplate>;

  renderFromTemplateContent(
    notification: AnyNotification<Config>,
    templateContent: TextNotificationTemplateContent,
    context: JsonObject,
  ): Promise<TextNotificationTemplate>;

  /**
   * Inject logger into the template renderer (optional - called by VintaSend when logger exists)
   */
  injectLogger?(logger: BaseLogger): void;
}
