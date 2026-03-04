import { describe, expect, it, vi } from 'vitest';
import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';
import type { BaseNotificationQueueService } from '../base-notification-queue-service';
import type { BaseNotificationReplicationQueueService } from '../base-notification-replication-queue-service';

interface TestConfig extends BaseNotificationTypeConfig {
  NotificationIdType: string;
  UserIdType: string;
}

describe('BaseNotificationReplicationQueueService Interface', () => {
  describe('Type Compatibility', () => {
    it('should accept a valid replication queue implementation', async () => {
      const mockReplicationQueueService: BaseNotificationReplicationQueueService<TestConfig> = {
        enqueueReplication: vi.fn().mockResolvedValue(undefined),
      };

      await mockReplicationQueueService.enqueueReplication('notification-1', 'replica-backend');

      expect(mockReplicationQueueService.enqueueReplication).toHaveBeenCalledWith(
        'notification-1',
        'replica-backend',
      );
    });

    it('should keep existing notification queue contract independently valid', async () => {
      const mockNotificationQueueService: BaseNotificationQueueService<TestConfig> = {
        enqueueNotification: vi.fn().mockResolvedValue(undefined),
      };

      await mockNotificationQueueService.enqueueNotification('notification-1');

      expect(mockNotificationQueueService.enqueueNotification).toHaveBeenCalledWith(
        'notification-1',
      );
    });
  });
});
