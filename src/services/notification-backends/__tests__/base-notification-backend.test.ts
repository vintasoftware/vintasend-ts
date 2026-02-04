import type { BaseNotificationBackend } from '../base-notification-backend';
import { supportsAttachments } from '../base-notification-backend';
import type { AttachmentFileRecord, StoredAttachment } from '../../../types/attachment';
import type { AnyDatabaseNotification, DatabaseNotification } from '../../../types/notification';
import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';

interface TestConfig extends BaseNotificationTypeConfig {
  NotificationIdType: string;
  UserIdType: string;
}

/**
 * TypeScript compilation test - ensure new attachment methods compile correctly
 */
class TestBackendWithAttachments implements BaseNotificationBackend<TestConfig> {
  async getAllPendingNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getPendingNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getAllFutureNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getFutureNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getAllFutureNotificationsFromUser(): Promise<DatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getFutureNotificationsFromUser(): Promise<DatabaseNotification<TestConfig>[]> {
    return [];
  }

  async persistNotification(): Promise<DatabaseNotification<TestConfig>> {
    throw new Error('Not implemented');
  }

  async getAllNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  async bulkPersistNotifications(): Promise<string[]> {
    return [];
  }

  async persistNotificationUpdate(): Promise<DatabaseNotification<TestConfig>> {
    throw new Error('Not implemented');
  }

  async markAsSent(): Promise<AnyDatabaseNotification<TestConfig>> {
    throw new Error('Not implemented');
  }

  async markAsFailed(): Promise<AnyDatabaseNotification<TestConfig>> {
    throw new Error('Not implemented');
  }

  async markAsRead(): Promise<DatabaseNotification<TestConfig>> {
    throw new Error('Not implemented');
  }

  async cancelNotification(): Promise<void> {
    // Implementation
  }

  async getNotification(): Promise<AnyDatabaseNotification<TestConfig> | null> {
    return null;
  }

  async filterAllInAppUnreadNotifications(): Promise<DatabaseNotification<TestConfig>[]> {
    return [];
  }

  async filterInAppUnreadNotifications(): Promise<DatabaseNotification<TestConfig>[]> {
    return [];
  }

  async getUserEmailFromNotification(): Promise<string | undefined> {
    return undefined;
  }

  async storeContextUsed(): Promise<void> {
    // Implementation
  }

  async persistOneOffNotification(): Promise<any> {
    throw new Error('Not implemented');
  }

  async persistOneOffNotificationUpdate(): Promise<any> {
    throw new Error('Not implemented');
  }

  async getOneOffNotification(): Promise<any> {
    return null;
  }

  async getAllOneOffNotifications(): Promise<any[]> {
    return [];
  }

  async getOneOffNotifications(): Promise<any[]> {
    return [];
  }

  // New attachment management methods
  async storeAttachmentFileRecord(record: AttachmentFileRecord): Promise<void> {
    // Store record in database
  }

  async getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null> {
    return null;
  }

  async findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    return null;
  }

  async deleteAttachmentFile(fileId: string): Promise<void> {
    // Implementation
  }

  async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    return [];
  }

  async getAttachments(notificationId: string): Promise<StoredAttachment[]> {
    return [];
  }

  async deleteNotificationAttachment(
    notificationId: string,
    attachmentId: string,
  ): Promise<void> {
    // Implementation
  }
}

describe('BaseNotificationBackend Interface', () => {
  it('should compile with new attachment methods', () => {
    const backend = new TestBackendWithAttachments();
    expect(backend).toBeDefined();
  });

  it('should have storeAttachmentFileRecord method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.storeAttachmentFileRecord).toBe('function');
  });

  it('should have getAttachmentFileRecord method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.getAttachmentFileRecord).toBe('function');
  });

  it('should have findAttachmentFileByChecksum method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.findAttachmentFileByChecksum).toBe('function');
  });

  it('should have deleteAttachmentFile method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.deleteAttachmentFile).toBe('function');
  });

  it('should have getOrphanedAttachmentFiles method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.getOrphanedAttachmentFiles).toBe('function');
  });

  it('should have getAttachments method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.getAttachments).toBe('function');
  });

  it('should have deleteNotificationAttachment method', () => {
    const backend = new TestBackendWithAttachments();
    expect(typeof backend.deleteNotificationAttachment).toBe('function');
  });

  describe('supportsAttachments type guard', () => {
    it('should return true for backend with all attachment methods', () => {
      const backend = new TestBackendWithAttachments();
      expect(supportsAttachments(backend)).toBe(true);
    });

    it('should return false for backend with missing attachment methods', () => {
      const backend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: async () => [],
        getPendingNotifications: async () => [],
        getAllFutureNotifications: async () => [],
        getFutureNotifications: async () => [],
        getAllFutureNotificationsFromUser: async () => [],
        getFutureNotificationsFromUser: async () => [],
        persistNotification: async () => {
          throw new Error('Not implemented');
        },
        getAllNotifications: async () => [],
        getNotifications: async () => [],
        bulkPersistNotifications: async () => [],
        persistNotificationUpdate: async () => {
          throw new Error('Not implemented');
        },
        markAsSent: async () => {
          throw new Error('Not implemented');
        },
        markAsFailed: async () => {
          throw new Error('Not implemented');
        },
        markAsRead: async () => {
          throw new Error('Not implemented');
        },
        cancelNotification: async () => {
          // Implementation
        },
        getNotification: async () => null,
        filterAllInAppUnreadNotifications: async () => [],
        filterInAppUnreadNotifications: async () => [],
        getUserEmailFromNotification: async () => undefined,
        storeContextUsed: async () => {
          // Implementation
        },
        persistOneOffNotification: async () => {
          throw new Error('Not implemented');
        },
        persistOneOffNotificationUpdate: async () => {
          throw new Error('Not implemented');
        },
        getOneOffNotification: async () => null,
        getAllOneOffNotifications: async () => [],
        getOneOffNotifications: async () => [],
        // Missing attachment methods
      };

      expect(supportsAttachments(backend)).toBe(false);
    });

    it('should allow calling typed methods after type guard', () => {
      const backend: BaseNotificationBackend<TestConfig> =
        new TestBackendWithAttachments();

      if (supportsAttachments(backend)) {
        // These should compile without errors
        const result1 = backend.storeAttachmentFileRecord({
          id: 'file-1',
          filename: 'test.txt',
          contentType: 'text/plain',
          size: 100,
          checksum: 'abc123',
          createdAt: new Date(),
          updatedAt: new Date(),
          storageIdentifiers: { id: 'storage-1' },
        });

        const result2 = backend.getAttachmentFileRecord('file-1');
        const result3 = backend.findAttachmentFileByChecksum('abc123');
        const result4 = backend.deleteAttachmentFile('file-1');
        const result5 = backend.getOrphanedAttachmentFiles();
        const result6 = backend.getAttachments('notif-1');
        const result7 = backend.deleteNotificationAttachment('notif-1', 'att-1');

        expect(result1).toBeInstanceOf(Promise);
        expect(result2).toBeInstanceOf(Promise);
        expect(result3).toBeInstanceOf(Promise);
        expect(result4).toBeInstanceOf(Promise);
        expect(result5).toBeInstanceOf(Promise);
        expect(result6).toBeInstanceOf(Promise);
        expect(result7).toBeInstanceOf(Promise);
      }
    });
  });
});
