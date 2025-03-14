import type {
  BaseNotificationTemplateRenderer,
  BaseNotificationTypeConfig,
  DatabaseNotification,
} from 'vintasend';
import type { JsonObject } from 'vintasend/dist/types/json-values';

export class PugEmailTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
> implements BaseNotificationTemplateRenderer<Config>
{
  async render(
    notification: DatabaseNotification<Config>,
    context: JsonObject,
  ): Promise<unknown> {
    throw new Error('Not implemented');
  }
}

export class PugEmailTemplateRendererFactory <Config extends BaseNotificationTypeConfig> {
  create() {
    return new PugEmailTemplateRenderer<Config>();
  }
}
