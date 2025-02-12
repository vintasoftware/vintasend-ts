import type { NotificationType } from '../../types/notification-type';
import type { Notification } from '../../types/notification';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';
import type { ContextGenerator } from '../notification-context-registry';
import type { JsonValue } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';

export interface BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<AvailableContexts>,
  Backend extends BaseNotificationBackend<AvailableContexts>,
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> {
  notificationType: NotificationType;
  key: string;
  templateRenderer: TemplateRenderer;
  backend: Backend;
  enqueueNotifications: boolean;

  send(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
    context: JsonValue,
  ): Promise<void>;
}
