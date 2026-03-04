import { describe, expect, it } from 'vitest';
import type { AttachmentFileRecord, StoredAttachment } from '../../../types/attachment';
import type { AnyDatabaseNotification, DatabaseNotification } from '../../../types/notification';
import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';
import type {
  BaseNotificationBackend,
  DateRange,
  NotificationFilter,
  StringFieldFilter,
} from '../base-notification-backend';
import {
  isFieldFilter,
  isStringFilterLookup,
  supportsAttachments,
} from '../base-notification-backend';

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

  async storeAdapterAndContextUsed(): Promise<void> {
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

  // filterNotifications method
  async filterNotifications(
    _filter: NotificationFilter<TestConfig>,
    _page: number,
    _pageSize: number,
  ): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return [];
  }

  // New attachment management methods
  async storeAttachmentFileRecord(_record: AttachmentFileRecord): Promise<void> {
    // Store record in database
  }

  async getAttachmentFileRecord(_fileId: string): Promise<AttachmentFileRecord | null> {
    return null;
  }

  async findAttachmentFileByChecksum(_checksum: string): Promise<AttachmentFileRecord | null> {
    return null;
  }

  async deleteAttachmentFile(_fileId: string): Promise<void> {
    // Implementation
  }

  async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    return [];
  }

  async getAttachments(_notificationId: string): Promise<StoredAttachment[]> {
    return [];
  }

  async deleteNotificationAttachment(
    _notificationId: string,
    _attachmentId: string,
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
        storeAdapterAndContextUsed: async () => {
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
        filterNotifications: async () => [],
        // Missing attachment methods
      };

      expect(supportsAttachments(backend)).toBe(false);
    });

    it('should allow calling typed methods after type guard', () => {
      const backend: BaseNotificationBackend<TestConfig> = new TestBackendWithAttachments();

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

  describe('filterNotifications', () => {
    it('should have filterNotifications method', () => {
      const backend = new TestBackendWithAttachments();
      expect(typeof backend.filterNotifications).toBe('function');
    });

    it('should accept a simple status filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        status: 'PENDING_SEND',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept multiple statuses as array', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        status: ['PENDING_SEND', 'SENT'],
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a notification type filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        notificationType: 'EMAIL',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept multiple notification types as array', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        notificationType: ['EMAIL', 'PUSH'],
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept an adapter filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        adapterUsed: 'sendgrid',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept multiple adapters as array', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        adapterUsed: ['sendgrid', 'nodemailer'],
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a userId (recipient) filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        userId: 'user-123',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a bodyTemplate filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        bodyTemplate: 'welcome-email',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a subjectTemplate filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        subjectTemplate: 'welcome-subject',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a contextName filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        contextName: 'user-context',
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept string lookup objects for string fields', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        bodyTemplate: { lookup: 'startsWith', value: 'welcome-', caseSensitive: false },
        subjectTemplate: { lookup: 'includes', value: 'alert' },
        contextName: { lookup: 'exact', value: 'critical-context' },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a createdAtRange filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        createdAtRange: {
          from: new Date('2025-01-01'),
          to: new Date('2025-12-31'),
        },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a sentAtRange filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        sentAtRange: {
          from: new Date('2025-06-01'),
        },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a sendAfterRange filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        sendAfterRange: {
          to: new Date('2025-07-01'),
        },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept combined field filters (implicit AND)', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        status: 'SENT',
        notificationType: 'EMAIL',
        userId: 'user-456',
        adapterUsed: 'sendgrid',
        createdAtRange: { from: new Date('2025-01-01') },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept an explicit AND filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        and: [{ status: 'SENT' }, { notificationType: 'EMAIL' }, { userId: 'user-789' }],
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept an OR filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        or: [{ status: 'SENT' }, { status: 'FAILED' }],
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept a NOT filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        not: { status: 'CANCELLED' },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept deeply nested logical filters', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        and: [
          { notificationType: 'EMAIL' },
          {
            or: [
              { status: 'SENT', sentAtRange: { from: new Date('2025-01-01') } },
              {
                and: [{ status: 'PENDING_SEND' }, { not: { adapterUsed: 'deprecated-adapter' } }],
              },
            ],
          },
          { not: { userId: 'blocked-user' } },
        ],
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept NOT wrapping an OR filter', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {
        not: {
          or: [{ status: 'CANCELLED' }, { status: 'FAILED' }],
        },
      };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept date range with only from bound', async () => {
      const backend = new TestBackendWithAttachments();
      const range: DateRange = { from: new Date('2025-01-01') };
      const filter: NotificationFilter<TestConfig> = { createdAtRange: range };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept date range with only to bound', async () => {
      const backend = new TestBackendWithAttachments();
      const range: DateRange = { to: new Date('2025-12-31') };
      const filter: NotificationFilter<TestConfig> = { sentAtRange: range };
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });

    it('should accept empty field filter (match all)', async () => {
      const backend = new TestBackendWithAttachments();
      const filter: NotificationFilter<TestConfig> = {};
      const result = await backend.filterNotifications(filter, 1, 10);
      expect(result).toEqual([]);
    });
  });

  describe('isFieldFilter type guard', () => {
    it('should return true for a plain field filter', () => {
      const filter: NotificationFilter<TestConfig> = { status: 'SENT' };
      expect(isFieldFilter(filter)).toBe(true);
    });

    it('should return true for an empty field filter', () => {
      const filter: NotificationFilter<TestConfig> = {};
      expect(isFieldFilter(filter)).toBe(true);
    });

    it('should return false for an AND filter', () => {
      const filter: NotificationFilter<TestConfig> = {
        and: [{ status: 'SENT' }],
      };
      expect(isFieldFilter(filter)).toBe(false);
    });

    it('should return false for an OR filter', () => {
      const filter: NotificationFilter<TestConfig> = {
        or: [{ status: 'SENT' }],
      };
      expect(isFieldFilter(filter)).toBe(false);
    });

    it('should return false for a NOT filter', () => {
      const filter: NotificationFilter<TestConfig> = {
        not: { status: 'CANCELLED' },
      };
      expect(isFieldFilter(filter)).toBe(false);
    });

    it('should narrow type to NotificationFilterFields after guard', () => {
      const filter: NotificationFilter<TestConfig> = {
        status: 'SENT',
        userId: 'user-1',
        createdAtRange: { from: new Date('2025-01-01') },
      };

      if (isFieldFilter(filter)) {
        // These should compile without errors after narrowing
        expect(filter.status).toBe('SENT');
        expect(filter.userId).toBe('user-1');
        expect(filter.createdAtRange?.from).toEqual(new Date('2025-01-01'));
      }
    });
  });

  describe('isStringFilterLookup type guard', () => {
    it('should return true for lookup object values', () => {
      const value: StringFieldFilter = {
        lookup: 'startsWith',
        value: 'prefix',
        caseSensitive: false,
      };

      expect(isStringFilterLookup(value)).toBe(true);
    });

    it('should return false for plain string values', () => {
      const value: StringFieldFilter = 'plain-value';
      expect(isStringFilterLookup(value)).toBe(false);
    });
  });

  describe('getFilterCapabilities', () => {
    it('should return default capabilities when method exists', async () => {
      const backend = new (class extends TestBackendWithAttachments {
        getFilterCapabilities() {
          return {
            'logical.and': true,
            'fields.status': true,
          };
        }
      })();
      const capabilities = backend.getFilterCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities['logical.and']).toBe(true);
      expect(capabilities['fields.status']).toBe(true);
    });

    it('should support flat dotted keys for capability names', () => {
      const backend = new (class extends TestBackendWithAttachments {
        getFilterCapabilities() {
          return {
            'logical.and': true,
            'logical.or': false,
            'fields.status': true,
            'negation.createdAtRange': false,
          };
        }
      })();
      const capabilities = backend.getFilterCapabilities();
      expect(capabilities['logical.and']).toBe(true);
      expect(capabilities['logical.or']).toBe(false);
      expect(capabilities['fields.status']).toBe(true);
      expect(capabilities['negation.createdAtRange']).toBe(false);
    });

    it('should allow backends that do not implement getFilterCapabilities', () => {
      const backend = new TestBackendWithAttachments();
      // Backend should be usable - getFilterCapabilities is optional
      expect(backend).toBeDefined();
      // TypeScript should allow optional chaining on the optional method
      const capabilities = (backend as any).getFilterCapabilities?.();
      // Method may not exist, so capabilities may be undefined
      expect(capabilities === undefined || typeof capabilities === 'object').toBe(true);
    });
  });
});
