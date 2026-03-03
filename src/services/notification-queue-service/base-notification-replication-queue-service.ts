import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';

export interface BaseNotificationReplicationQueueService<
  Config extends BaseNotificationTypeConfig,
> {
  enqueueReplication(
    notificationId: Config['NotificationIdType'],
    backendIdentifier: string,
  ): Promise<void>;
}
