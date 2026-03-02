import type {
  AnyNotification,
  BaseNotificationTemplateRenderer,
  BaseNotificationTypeConfig,
  DatabaseNotification,
  JsonObject,
} from 'vintasend';

export class TemplateRenderer<Config extends BaseNotificationTypeConfig>
  implements BaseNotificationTemplateRenderer<Config>
{
  async render(notification: DatabaseNotification<Config>, context: JsonObject): Promise<unknown> {
    throw new Error('Not implemented');
  }

  async renderFromTemplateContent(
    notification: AnyNotification<Config>,
    templateContent: unknown,
    context: JsonObject,
  ): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export class TemplateRendererFactory<Config extends BaseNotificationTypeConfig> {
  create() {
    return new TemplateRenderer<Config>();
  }
}
