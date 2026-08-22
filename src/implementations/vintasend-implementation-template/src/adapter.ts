import type {
  BaseEmailTemplateRenderer,
  BaseNotificationTypeConfig,
  DatabaseNotification,
  JsonObject,
  EmailTemplate,
} from 'vintasend';
import { BaseNotificationAdapter } from 'vintasend';

export class NotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationAdapter<TemplateRenderer, Config> {
  public key: string | null = 'adapter-key'; // TODO: Change this value

  constructor(templateRenderer: TemplateRenderer, enqueueNotifications: boolean) {
    const notificationType = 'EMAIL'; // TODO: Change this value
    super(templateRenderer, notificationType, enqueueNotifications);
  }

  /**
   * Returns what the renderer produced so the service can record which template version rendered
   * this notification. Nothing else reads it — the message is already sent by then.
   */
  async send(notification: DatabaseNotification<Config>, context: JsonObject): Promise<EmailTemplate> {
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

    return template;
  }
}

export class NotificationAdapterFactory<Config extends BaseNotificationTypeConfig> {
  create<TemplateRenderer extends BaseEmailTemplateRenderer<Config>>(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
  ) {
    return new NotificationAdapter<TemplateRenderer, Config>(
      templateRenderer,
      enqueueNotifications,
    );
  }
}
