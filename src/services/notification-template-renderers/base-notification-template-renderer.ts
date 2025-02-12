import type { JsonObject } from '../../types/json-values';
import type { Notification } from '../../types/notification';
import type { ContextGenerator } from '../notification-context-registry';

export interface BaseNotificationTemplateRenderer<AvailableContexts extends Record<string, ContextGenerator>, T = unknown> {
  render(notification: Notification<AvailableContexts>, context: JsonObject): Promise<T>;
}
