import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationReplicationQueueService<
  Config extends BaseNotificationTypeConfig,
> {
  enqueueReplication(
    notificationId: Config['NotificationIdType'],
    backendIdentifier: string,
  ): Promise<void>;
}
