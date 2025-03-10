import type { NotificationType } from '../../types/notification-type';
import type { DatabaseNotification } from '../../types/notification';
import type { BaseNotificationTemplateRenderer } from '../notification-template-renderers/base-notification-template-renderer';
import type { JsonValue } from '../../types/json-values';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';

export abstract class BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> {
  key: string | null = null;
  backend: BaseNotificationBackend<Config> | null = null;

  constructor(
    protected templateRenderer: TemplateRenderer,
    public readonly notificationType: NotificationType,
    public readonly enqueueNotifications: boolean,
  ) {};

  send(
    notification: DatabaseNotification<Config>,
    context: JsonValue,
  ): Promise<void> {
    if (this.backend === null) {
      return Promise.reject(new Error('Backend not injected'));
    }
    return Promise.resolve();
  };

  injectBackend(
    backend: BaseNotificationBackend<Config>,
  ): void {
    this.backend = backend;
  };
}
