import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import type { JsonObject } from '../../../types/json-values';
import type {
  AnyDatabaseNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
} from '../../../types/notification';
import type { BaseNotificationBackend } from '../../notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from '../../notification-template-renderers/base-notification-template-renderer';
import { BaseNotificationAdapter, isOneOffNotification } from '../base-notification-adapter';

// Test adapter implementation
class TestAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<Config>,
  Config extends { ContextMap: any; NotificationIdType: string; UserIdType: string },
> extends BaseNotificationAdapter<TemplateRenderer, Config> {
  async send(notification: AnyDatabaseNotification<Config>, context: JsonObject): Promise<void> {
    // Test implementation that uses helper methods
    const _email = await this.getRecipientEmail(notification);
    const _name = this.getRecipientName(notification, context);
    // In a real adapter, this would send the notification
    return Promise.resolve();
  }

  // Expose protected methods for testing
  public async testGetRecipientEmail(
    notification: AnyDatabaseNotification<Config>,
  ): Promise<string> {
    return this.getRecipientEmail(notification);
  }

  public testGetRecipientName(
    notification: AnyDatabaseNotification<Config>,
    context: JsonObject | null,
  ): { firstName: string; lastName: string } {
    return this.getRecipientName(notification, context as any);
  }
}

type Config = {
  ContextMap: any;
  NotificationIdType: string;
  UserIdType: string;
};

// Mock implementations
const mockBackend = {
  persistNotification: vi.fn(),
  persistNotificationUpdate: vi.fn(),
  getAllFutureNotifications: vi.fn(),
  getAllFutureNotificationsFromUser: vi.fn(),
  getFutureNotificationsFromUser: vi.fn(),
  getFutureNotifications: vi.fn(),
  getAllPendingNotifications: vi.fn(),
  getPendingNotifications: vi.fn(),
  getNotification: vi.fn(),
  markAsRead: vi.fn(),
  filterAllInAppUnreadNotifications: vi.fn(),
  cancelNotification: vi.fn(),
  markAsSent: vi.fn(),
  markAsFailed: vi.fn(),
  storeAdapterAndContextUsed: vi.fn(),
  getUserEmailFromNotification: vi.fn(),
  filterInAppUnreadNotifications: vi.fn(),
  bulkPersistNotifications: vi.fn(),
  getAllNotifications: vi.fn(),
  getNotifications: vi.fn(),
  persistOneOffNotification: vi.fn(),
  persistOneOffNotificationUpdate: vi.fn(),
  getOneOffNotification: vi.fn(),
  getAllOneOffNotifications: vi.fn(),
  getOneOffNotifications: vi.fn(),
  filterNotifications: vi.fn(),

  // Attachment methods
  storeAttachmentFileRecord: vi.fn().mockResolvedValue(undefined),
  getAttachmentFileRecord: vi.fn().mockResolvedValue(null),
  getAttachmentFile: vi.fn().mockResolvedValue(null),
  findAttachmentFileByChecksum: vi.fn().mockResolvedValue(null),
  deleteAttachmentFile: vi.fn().mockResolvedValue(undefined),
  getOrphanedAttachmentFiles: vi.fn().mockResolvedValue([]),
  getAttachments: vi.fn().mockResolvedValue([]),
  deleteNotificationAttachment: vi.fn().mockResolvedValue(undefined),
} as Mocked<BaseNotificationBackend<Config>>;

const mockTemplateRenderer: Mocked<BaseNotificationTemplateRenderer<Config>> = {
  logger: null,
  render: vi.fn(),
  renderFromTemplateContent: vi.fn(),
  injectLogger: vi.fn(),
};

describe('BaseNotificationAdapter - One-Off Notifications', () => {
  let adapter: TestAdapter<typeof mockTemplateRenderer, Config>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new TestAdapter(mockTemplateRenderer, 'EMAIL', false);
    adapter.injectBackend(mockBackend);
  });

  describe('isOneOffNotification type guard', () => {
    it('should return true for one-off notifications', () => {
      const oneOffNotification: DatabaseOneOffNotification<Config> = {
        id: '123',
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      expect(isOneOffNotification(oneOffNotification)).toBe(true);
    });

    it('should return false for regular notifications', () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      expect(isOneOffNotification(regularNotification)).toBe(false);
    });
  });

  describe('getRecipientEmail', () => {
    it('should return emailOrPhone for one-off notifications', async () => {
      const oneOffNotification: DatabaseOneOffNotification<Config> = {
        id: '123',
        emailOrPhone: 'oneoff@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      const email = await adapter.testGetRecipientEmail(oneOffNotification);
      expect(email).toBe('oneoff@example.com');
      expect(mockBackend.getUserEmailFromNotification).not.toHaveBeenCalled();
    });

    it('should fetch user email for regular notifications', async () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      mockBackend.getUserEmailFromNotification.mockResolvedValue('user@example.com');

      const email = await adapter.testGetRecipientEmail(regularNotification);
      expect(email).toBe('user@example.com');
      expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('123');
    });

    it('should throw error if user email not found for regular notification', async () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      mockBackend.getUserEmailFromNotification.mockResolvedValue(undefined);

      await expect(adapter.testGetRecipientEmail(regularNotification)).rejects.toThrow(
        'User email not found for notification 123',
      );
    });

    it('should throw error if backend not injected', async () => {
      const adapterWithoutBackend = new TestAdapter(mockTemplateRenderer, 'EMAIL', false);

      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      await expect(
        adapterWithoutBackend.testGetRecipientEmail(regularNotification),
      ).rejects.toThrow('Backend not injected');
    });
  });

  describe('getRecipientName', () => {
    it('should return firstName and lastName for one-off notifications', () => {
      const oneOffNotification: DatabaseOneOffNotification<Config> = {
        id: '123',
        emailOrPhone: 'test@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      const name = adapter.testGetRecipientName(oneOffNotification, {});
      expect(name).toEqual({ firstName: 'Alice', lastName: 'Johnson' });
    });

    it('should extract name from context for regular notifications', () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      const context: JsonObject = {
        firstName: 'Bob',
        lastName: 'Williams',
      };

      const name = adapter.testGetRecipientName(regularNotification, context);
      expect(name).toEqual({ firstName: 'Bob', lastName: 'Williams' });
    });

    it('should return empty strings for regular notifications without name in context', () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      const name = adapter.testGetRecipientName(regularNotification, {});
      expect(name).toEqual({ firstName: '', lastName: '' });
    });

    it('should handle non-object context gracefully', () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      const name = adapter.testGetRecipientName(regularNotification, null);
      expect(name).toEqual({ firstName: '', lastName: '' });
    });

    it('should handle non-string firstName/lastName in context', () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      const context: JsonObject = {
        firstName: 123, // Non-string value
        lastName: true, // Non-string value
      };

      const name = adapter.testGetRecipientName(regularNotification, context);
      expect(name).toEqual({ firstName: '', lastName: '' });
    });
  });

  describe('send method with both notification types', () => {
    it('should successfully send one-off notification', async () => {
      const oneOffNotification: DatabaseOneOffNotification<Config> = {
        id: '123',
        emailOrPhone: 'oneoff@example.com',
        firstName: 'Test',
        lastName: 'User',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      await expect(adapter.send(oneOffNotification, {})).resolves.not.toThrow();
    });

    it('should successfully send regular notification', async () => {
      const regularNotification: DatabaseNotification<Config> = {
        id: '123',
        userId: 'user-456',
        notificationType: 'EMAIL',
        contextName: 'testContext',
        contextParameters: {},
        title: 'Test',
        bodyTemplate: '/path/to/template',
        subjectTemplate: 'Test Subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND',
        sentAt: null,
        readAt: null,
        sendAfter: null,
        gitCommitSha: null,
      };

      mockBackend.getUserEmailFromNotification.mockResolvedValue('user@example.com');

      await expect(adapter.send(regularNotification, {})).resolves.not.toThrow();
    });
  });
});
