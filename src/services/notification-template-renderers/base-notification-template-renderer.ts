import type { Identifier } from '../../types/identifier';
import type { JsonObject } from '../../types/json-values';
import type { Notification } from '../../types/notification';
import type { ContextGenerator } from '../notification-context-registry';

export interface BaseNotificationTemplateRenderer<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
  T = unknown,
> {
  render(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
    context: JsonObject,
  ): Promise<T>;
}
