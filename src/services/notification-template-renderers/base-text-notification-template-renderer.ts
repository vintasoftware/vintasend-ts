import type { Buffer } from 'node:buffer';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';
import {
  BaseNotificationTemplateRenderer,
  type NotificationSendInput,
} from './base-notification-template-renderer.js';

export type Attachment = File | Buffer | string;

/**
 * What a text renderer produces: the payload an adapter sends, plus the optional
 * `templateVersion` every send input carries.
 */
export type TextNotificationTemplate = NotificationSendInput & {
  text: string;
};

export type TextNotificationTemplateContent = {
  text: string;
};

export abstract class BaseTextNotificationTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationTemplateRenderer<Config, TextNotificationTemplate> {}
