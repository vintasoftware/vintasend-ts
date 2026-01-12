import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationQueueService<Config extends BaseNotificationTypeConfig> {
  enqueueNotification(notificationId: Config['NotificationIdType']): Promise<void>;
}
