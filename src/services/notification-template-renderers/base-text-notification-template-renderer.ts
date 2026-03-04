import type { Buffer } from 'node:buffer';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';
import { BaseNotificationTemplateRenderer } from './base-notification-template-renderer.js';

export type Attachment = File | Buffer | string;

export type TextNotificationTemplate = {
  text: string;
};

export type TextNotificationTemplateContent = {
  text: string;
};

export abstract class BaseTextNotificationTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationTemplateRenderer<Config, TextNotificationTemplate> {}
