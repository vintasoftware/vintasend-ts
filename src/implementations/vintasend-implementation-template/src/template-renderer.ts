import type {
  BaseNotificationTemplateRenderer,
} from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';

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
