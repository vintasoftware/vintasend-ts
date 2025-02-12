import type { NotificationType } from '../../types/notification-type';
import type { Notification } from '../../types/notification';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';
import type { ContextGenerator } from '../notification-context-registry';
import type { JsonValue } from '../../types/json-values';

export interface BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<AvailableContexts>,
  Backend extends BaseNotificationBackend<AvailableContexts>,
  AvailableContexts extends Record<string, ContextGenerator>
> {
  notificationType: NotificationType;
  key: string;
  templateRenderer: TemplateRenderer;
  backend: Backend;
  enqueueNotifications: boolean;

  send(notification: Notification<AvailableContexts>, context: JsonValue): Promise<void>;
}
