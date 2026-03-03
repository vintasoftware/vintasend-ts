import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';

export interface BaseNotificationQueueService<Config extends BaseNotificationTypeConfig> {
  enqueueNotification(notificationId: Config['NotificationIdType']): Promise<void>;
}
