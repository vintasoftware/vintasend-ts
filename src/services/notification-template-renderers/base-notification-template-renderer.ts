import type { JsonObject } from '../../types/json-values.js';
import type { AnyNotification } from '../../types/notification.js';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';

export interface BaseNotificationTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
  T = unknown,
> {
  render(notification: AnyNotification<Config>, context: JsonObject): Promise<T>;

  renderFromTemplateContent(
    notification: AnyNotification<Config>,
    templateContent: unknown,
    context: JsonObject,
  ): Promise<T>;
}
