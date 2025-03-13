import nodemailer from 'nodemailer';

import { BaseNotificationAdapter } from 'vintasend/dist/services/notification-adapters/base-notification-adapter';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type{ BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';

export class NodemailerNotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> extends
    BaseNotificationAdapter<
      TemplateRenderer,
      Config
    >
{
  public key: string | null = 'nodemailer';
  private transporter: nodemailer.Transporter;

  constructor(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
    transportOptions: Parameters<typeof nodemailer.createTransport>[0],
  ) {
    super(templateRenderer, 'EMAIL', enqueueNotifications);
    this.transporter = nodemailer.createTransport(transportOptions);
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

    const mailOptions: nodemailer.SendMailOptions = {
      to: userEmail,
      subject: template.subject,
      html: template.body,
    };

    await this.transporter.sendMail(mailOptions);
  }
}

export class NodemailerNotificationAdapterFactory<Config extends BaseNotificationTypeConfig> {
  create<TemplateRenderer extends BaseEmailTemplateRenderer<Config>>(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
    transportOptions: Parameters<typeof nodemailer.createTransport>[0],
  ) {
    return new NodemailerNotificationAdapter<TemplateRenderer, Config>(templateRenderer, enqueueNotifications, transportOptions);
  }
}
