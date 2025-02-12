import type { Identifier } from '../../types/identifier';

export interface BaseNotificationQueueService<NotificationIdType extends Identifier = Identifier> {
  enqueueNotification(notificationId: NotificationIdType): Promise<void>;
}
