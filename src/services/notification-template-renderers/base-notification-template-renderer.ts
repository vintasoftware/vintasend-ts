import type { JsonObject } from '../../types/json-values';
import type { Notification } from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationTemplateRenderer<
  Config extends BaseNotificationTypeConfig,
  T = unknown,
> {
  render(
    notification: Notification<Config['ContextMap'], Config['NotificationIdType'], Config['UserIdType']>,
    context: JsonObject,
  ): Promise<T>;
}
