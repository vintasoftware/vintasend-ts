import { BaseNotificationAdapter } from 'vintasend/dist/services/notification-adapters/base-notification-adapter';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type{ BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';

export class NotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> extends
    BaseNotificationAdapter<
      TemplateRenderer,
      Config
    >
{
  public key: string | null = 'adapter-key'; // TODO: Change this value

  constructor(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
  ) {
    const notificationType = 'EMAIL'; // TODO: Change this value
    super(templateRenderer, notificationType, enqueueNotifications);
  }

  async send(
    notification: DatabaseNotification<Config>,
    context: JsonObject,
  ): Promise<void> {
    if (!this.backend) {
      throw new Error('Backend not injected');
    }

    const template = await this.templateRenderer.render(notification, context);

    if (!notification.id) {
      throw new Error('Notification ID is required');
    }

    const userEmail = await this.backend.getUserEmailFromNotification(notification.id);

    if (!userEmail) {
      throw new Error('User email not found');
    }

    // TODO: Implement the logic to send the notification
  }
}

export class NotificationAdapterFactory<Config extends BaseNotificationTypeConfig> {
  create<TemplateRenderer extends BaseEmailTemplateRenderer<Config>>(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
  ) {
    return new NotificationAdapter<TemplateRenderer, Config>(templateRenderer, enqueueNotifications);
  }
}
