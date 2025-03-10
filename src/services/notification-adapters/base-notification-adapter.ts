import type { NotificationType } from '../../types/notification-type';
import type { Notification } from '../../types/notification';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';
import type { JsonValue } from '../../types/json-values';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export abstract class BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> {
  key: string | null = null;
  backend: Config['Backend'] | null = null;

  constructor(
    protected templateRenderer: TemplateRenderer,
    public readonly notificationType: NotificationType,
    public readonly enqueueNotifications: boolean,
  ) {};

  send(
    notification: Notification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>,
    context: JsonValue,
  ): Promise<void> {
    if (this.backend === null) {
      return Promise.reject(new Error('Backend not injected'));
    }
    return Promise.resolve();
  };

  injectBackend(
    backend: Config["Backend"],
  ): void {
    this.backend = backend;
  };
}
