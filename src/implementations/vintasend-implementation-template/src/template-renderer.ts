import type {
  AnyNotification,
  BaseLogger,
  BaseNotificationTemplateRenderer,
  BaseNotificationTypeConfig,
  DatabaseNotification,
  JsonObject,
} from 'vintasend';

export class TemplateRenderer<Config extends BaseNotificationTypeConfig>
  implements BaseNotificationTemplateRenderer<Config>
{
  logger: BaseLogger | null = null;

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

  injectLogger(logger: BaseLogger): void {
    this.logger = logger;
  }
}

export class TemplateRendererFactory<Config extends BaseNotificationTypeConfig> {
  create() {
    return new TemplateRenderer<Config>();
  }
}
