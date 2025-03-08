import type { NotificationType } from '../../types/notification-type';
import type { Notification } from '../../types/notification';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';
import type { ContextGenerator } from '../notification-context-registry';
import type { JsonValue } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';

export abstract class BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<AvailableContexts>,
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> {
  key: string | null = null;
  backend: BaseNotificationBackend<AvailableContexts, NotificationIdType, UserIdType> | null = null;

  constructor(
    private templateRenderer: TemplateRenderer,
    public readonly notificationType: NotificationType,
    public readonly enqueueNotifications: boolean,
  ) {};

  send(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
    context: JsonValue,
  ): Promise<void> {
    if (this.backend === null) {
      throw new Error('Backend not injected');
    }
    return Promise.resolve();
  };

  injectBackend(
    backend: BaseNotificationBackend<AvailableContexts, NotificationIdType, UserIdType>,
  ): void {
    this.backend = backend;
  };
}
