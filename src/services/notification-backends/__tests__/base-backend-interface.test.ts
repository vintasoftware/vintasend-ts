import type {
  AnyDatabaseNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  OneOffNotificationInput,
} from '../../../types/notification';
import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';
import type { BaseNotificationBackend } from '../base-notification-backend';

// Test configuration type
type TestContextMap = {
  testContext: {
    generate: (params: { userId: string }) => Promise<{ message: string }>;
  };
};

type TestConfig = BaseNotificationTypeConfig & {
  ContextMap: TestContextMap;
  NotificationIdType: string;
  UserIdType: string;
};

describe('BaseNotificationBackend Interface', () => {
  describe('Type Compatibility', () => {
    it('should accept a valid implementation with all required methods', () => {
      // This test validates that a mock implementation satisfies the interface
      const mockBackend: BaseNotificationBackend<TestConfig> = {
        // Regular notification methods
        getAllPendingNotifications: vi.fn().mockResolvedValue([]),
        getPendingNotifications: vi.fn().mockResolvedValue([]),
        getAllFutureNotifications: vi.fn().mockResolvedValue([]),
        getFutureNotifications: vi.fn().mockResolvedValue([]),
        getAllFutureNotificationsFromUser: vi.fn().mockResolvedValue([]),
        getFutureNotificationsFromUser: vi.fn().mockResolvedValue([]),
        persistNotification: vi.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        getAllNotifications: vi.fn().mockResolvedValue([]),
        getNotifications: vi.fn().mockResolvedValue([]),
        bulkPersistNotifications: vi.fn().mockResolvedValue([]),
        persistNotificationUpdate: vi
          .fn()
          .mockResolvedValue({} as DatabaseNotification<TestConfig>),
        markAsSent: vi.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        markAsFailed: vi.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        markAsRead: vi.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        cancelNotification: vi.fn().mockResolvedValue(undefined),
        getNotification: vi.fn().mockResolvedValue(null),
        filterAllInAppUnreadNotifications: vi.fn().mockResolvedValue([]),
        filterInAppUnreadNotifications: vi.fn().mockResolvedValue([]),
        getUserEmailFromNotification: vi.fn().mockResolvedValue(undefined),
        storeAdapterAndContextUsed: vi.fn().mockResolvedValue(undefined),
        filterNotifications: vi.fn().mockResolvedValue([]),

        // One-off notification methods
        persistOneOffNotification: vi
          .fn()
          .mockResolvedValue({} as DatabaseOneOffNotification<TestConfig>),
        persistOneOffNotificationUpdate: vi
          .fn()
          .mockResolvedValue({} as DatabaseOneOffNotification<TestConfig>),
        getOneOffNotification: vi.fn().mockResolvedValue(null),
        getAllOneOffNotifications: vi.fn().mockResolvedValue([]),
        getOneOffNotifications: vi.fn().mockResolvedValue([]),

        // Attachment methods
        storeAttachmentFileRecord: vi.fn().mockResolvedValue(undefined),
        getAttachmentFileRecord: vi.fn().mockResolvedValue(null),
        getAttachmentFile: vi.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: vi.fn().mockResolvedValue(null),
        deleteAttachmentFile: vi.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: vi.fn().mockResolvedValue([]),
        getAttachments: vi.fn().mockResolvedValue([]),
        deleteNotificationAttachment: vi.fn().mockResolvedValue(undefined),
      };

      expect(mockBackend).toBeDefined();
    });

    it('should allow getAllPendingNotifications to return mixed notification types', async () => {
      const regularNotification: DatabaseNotification<TestConfig> = {
        id: '1',
        userId: 'user-1',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        status: 'PENDING_SEND',
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        gitCommitSha: null,
      };

      const oneOffNotification: DatabaseOneOffNotification<TestConfig> = {
        id: '2',
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        status: 'PENDING_SEND',
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        gitCommitSha: null,
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: vi
          .fn()
          .mockResolvedValue([regularNotification, oneOffNotification]),
        getPendingNotifications: vi.fn().mockResolvedValue([]),
        getAllFutureNotifications: vi.fn().mockResolvedValue([]),
        getFutureNotifications: vi.fn().mockResolvedValue([]),
        getAllFutureNotificationsFromUser: vi.fn().mockResolvedValue([]),
        getFutureNotificationsFromUser: vi.fn().mockResolvedValue([]),
        persistNotification: vi.fn(),
        getAllNotifications: vi.fn().mockResolvedValue([]),
        getNotifications: vi.fn().mockResolvedValue([]),
        bulkPersistNotifications: vi.fn(),
        persistNotificationUpdate: vi.fn(),
        markAsSent: vi.fn(),
        markAsFailed: vi.fn(),
        markAsRead: vi.fn(),
        cancelNotification: vi.fn(),
        getNotification: vi.fn(),
        filterAllInAppUnreadNotifications: vi.fn(),
        filterInAppUnreadNotifications: vi.fn(),
        getUserEmailFromNotification: vi.fn(),
        storeAdapterAndContextUsed: vi.fn(),
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
      };

      const result = await mockBackend.getAllPendingNotifications();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(regularNotification);
      expect(result[1]).toEqual(oneOffNotification);
    });

    it('should allow getNotification to return either notification type', async () => {
      const oneOffNotification: DatabaseOneOffNotification<TestConfig> = {
        id: '2',
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        status: 'PENDING_SEND',
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        gitCommitSha: null,
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: vi.fn(),
        getPendingNotifications: vi.fn(),
        getAllFutureNotifications: vi.fn(),
        getFutureNotifications: vi.fn(),
        getAllFutureNotificationsFromUser: vi.fn(),
        getFutureNotificationsFromUser: vi.fn(),
        persistNotification: vi.fn(),
        getAllNotifications: vi.fn(),
        getNotifications: vi.fn(),
        bulkPersistNotifications: vi.fn(),
        persistNotificationUpdate: vi.fn(),
        markAsSent: vi.fn(),
        markAsFailed: vi.fn(),
        markAsRead: vi.fn(),
        cancelNotification: vi.fn(),
        getNotification: vi.fn().mockResolvedValue(oneOffNotification),
        filterAllInAppUnreadNotifications: vi.fn(),
        filterInAppUnreadNotifications: vi.fn(),
        getUserEmailFromNotification: vi.fn(),
        storeAdapterAndContextUsed: vi.fn(),
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
      };

      const result = await mockBackend.getNotification('2', false);
      expect(result).toEqual(oneOffNotification);
    });

    it('should accept OneOffNotificationInput for persistOneOffNotification', async () => {
      const input: Omit<OneOffNotificationInput<TestConfig>, 'id'> = {
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        extraParams: null,
      };

      const expectedResult: DatabaseOneOffNotification<TestConfig> = {
        id: '1',
        emailOrPhone: input.emailOrPhone,
        firstName: input.firstName,
        lastName: input.lastName,
        notificationType: input.notificationType,
        title: input.title,
        bodyTemplate: input.bodyTemplate,
        contextName: input.contextName,
        contextParameters: input.contextParameters,
        sendAfter: input.sendAfter,
        subjectTemplate: input.subjectTemplate,
        status: 'PENDING_SEND',
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        gitCommitSha: null,
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: vi.fn(),
        getPendingNotifications: vi.fn(),
        getAllFutureNotifications: vi.fn(),
        getFutureNotifications: vi.fn(),
        getAllFutureNotificationsFromUser: vi.fn(),
        getFutureNotificationsFromUser: vi.fn(),
        persistNotification: vi.fn(),
        getAllNotifications: vi.fn(),
        getNotifications: vi.fn(),
        bulkPersistNotifications: vi.fn(),
        persistNotificationUpdate: vi.fn(),
        markAsSent: vi.fn(),
        markAsFailed: vi.fn(),
        markAsRead: vi.fn(),
        cancelNotification: vi.fn(),
        getNotification: vi.fn(),
        filterAllInAppUnreadNotifications: vi.fn(),
        filterInAppUnreadNotifications: vi.fn(),
        getUserEmailFromNotification: vi.fn(),
        storeAdapterAndContextUsed: vi.fn(),
        persistOneOffNotification: vi.fn().mockResolvedValue(expectedResult),
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
      };

      const result = await mockBackend.persistOneOffNotification(input);
      expect(result).toEqual(expectedResult);
      expect(mockBackend.persistOneOffNotification).toHaveBeenCalledWith(input);
    });

    it('should accept partial updates for persistOneOffNotificationUpdate', async () => {
      const update: Partial<Omit<OneOffNotificationInput<TestConfig>, 'id'>> = {
        title: 'Updated Title',
        sendAfter: new Date('2025-12-31'),
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: vi.fn(),
        getPendingNotifications: vi.fn(),
        getAllFutureNotifications: vi.fn(),
        getFutureNotifications: vi.fn(),
        getAllFutureNotificationsFromUser: vi.fn(),
        getFutureNotificationsFromUser: vi.fn(),
        persistNotification: vi.fn(),
        getAllNotifications: vi.fn(),
        getNotifications: vi.fn(),
        bulkPersistNotifications: vi.fn(),
        persistNotificationUpdate: vi.fn(),
        markAsSent: vi.fn(),
        markAsFailed: vi.fn(),
        markAsRead: vi.fn(),
        cancelNotification: vi.fn(),
        getNotification: vi.fn(),
        filterAllInAppUnreadNotifications: vi.fn(),
        filterInAppUnreadNotifications: vi.fn(),
        getUserEmailFromNotification: vi.fn(),
        storeAdapterAndContextUsed: vi.fn(),
        persistOneOffNotification: vi.fn(),
        persistOneOffNotificationUpdate: vi
          .fn()
          .mockResolvedValue({} as DatabaseOneOffNotification<TestConfig>),
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
      };

      await mockBackend.persistOneOffNotificationUpdate('1', update);
      expect(mockBackend.persistOneOffNotificationUpdate).toHaveBeenCalledWith('1', update);
    });

    it('should allow markAsSent and markAsFailed to return either notification type', async () => {
      const oneOffNotification: DatabaseOneOffNotification<TestConfig> = {
        id: '1',
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        status: 'SENT',
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: new Date(),
        readAt: null,
        gitCommitSha: null,
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: vi.fn(),
        getPendingNotifications: vi.fn(),
        getAllFutureNotifications: vi.fn(),
        getFutureNotifications: vi.fn(),
        getAllFutureNotificationsFromUser: vi.fn(),
        getFutureNotificationsFromUser: vi.fn(),
        persistNotification: vi.fn(),
        getAllNotifications: vi.fn(),
        getNotifications: vi.fn(),
        bulkPersistNotifications: vi.fn(),
        persistNotificationUpdate: vi.fn(),
        markAsSent: vi.fn().mockResolvedValue(oneOffNotification),
        markAsFailed: vi.fn().mockResolvedValue(oneOffNotification),
        markAsRead: vi.fn(),
        cancelNotification: vi.fn(),
        getNotification: vi.fn(),
        filterAllInAppUnreadNotifications: vi.fn(),
        filterInAppUnreadNotifications: vi.fn(),
        getUserEmailFromNotification: vi.fn(),
        storeAdapterAndContextUsed: vi.fn(),
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
      };

      const sentResult = await mockBackend.markAsSent('1', true);
      expect(sentResult).toEqual(oneOffNotification);

      const failedResult = await mockBackend.markAsFailed('1', true);
      expect(failedResult).toEqual(oneOffNotification);
    });
  });

  describe('Method Signatures', () => {
    it('should have correct parameter types for new one-off notification methods', () => {
      // Type-only test - if this compiles, the types are correct
      const testImplementation = (backend: BaseNotificationBackend<TestConfig>) => {
        // These should all be valid calls
        backend.persistOneOffNotification({
          emailOrPhone: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: 'EMAIL',
          title: 'Test',
          bodyTemplate: 'template.pug',
          contextName: 'testContext',
          contextParameters: { userId: 'user-1' },
          sendAfter: null,
          subjectTemplate: 'Subject',
          extraParams: null,
        });

        backend.persistOneOffNotificationUpdate('1', { title: 'Updated' });
        backend.getOneOffNotification('1', false);
        backend.getAllOneOffNotifications();
        backend.getOneOffNotifications(1, 10);
      };

      expect(testImplementation).toBeDefined();
    });

    it('should have correct return types for methods that now return union types', () => {
      // Type-only test - if this compiles, the types are correct
      const testReturnTypes = async (backend: BaseNotificationBackend<TestConfig>) => {
        const _pending: AnyDatabaseNotification<TestConfig>[] =
          await backend.getAllPendingNotifications();
        const notification: AnyDatabaseNotification<TestConfig> | null =
          await backend.getNotification('1', false);
        const _sent: AnyDatabaseNotification<TestConfig> = await backend.markAsSent('1', true);
        const _failed: AnyDatabaseNotification<TestConfig> = await backend.markAsFailed('1', true);

        // Type guards should work
        if (notification && 'emailOrPhone' in notification) {
          const email: string = notification.emailOrPhone;
          const firstName: string = notification.firstName;
          expect(email).toBeDefined();
          expect(firstName).toBeDefined();
        } else if (notification && 'userId' in notification) {
          const userId: string = notification.userId;
          expect(userId).toBeDefined();
        }
      };

      expect(testReturnTypes).toBeDefined();
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing regular notification methods', async () => {
      const regularNotification: DatabaseNotification<TestConfig> = {
        id: '1',
        userId: 'user-1',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        status: 'PENDING_SEND',
        contextUsed: null,
        extraParams: null,
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        gitCommitSha: null,
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: vi.fn().mockResolvedValue([regularNotification]),
        getPendingNotifications: vi.fn(),
        getAllFutureNotifications: vi.fn(),
        getFutureNotifications: vi.fn(),
        getAllFutureNotificationsFromUser: vi.fn().mockResolvedValue([regularNotification]),
        getFutureNotificationsFromUser: vi.fn(),
        persistNotification: vi.fn().mockResolvedValue(regularNotification),
        getAllNotifications: vi.fn(),
        getNotifications: vi.fn(),
        bulkPersistNotifications: vi.fn(),
        persistNotificationUpdate: vi.fn().mockResolvedValue(regularNotification),
        markAsSent: vi.fn().mockResolvedValue(regularNotification),
        markAsFailed: vi.fn(),
        markAsRead: vi.fn().mockResolvedValue(regularNotification),
        cancelNotification: vi.fn(),
        getNotification: vi.fn().mockResolvedValue(regularNotification),
        filterAllInAppUnreadNotifications: vi.fn(),
        filterInAppUnreadNotifications: vi.fn(),
        getUserEmailFromNotification: vi.fn(),
        storeAdapterAndContextUsed: vi.fn(),
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
      };

      // All existing methods should work as before
      const pending = await mockBackend.getAllPendingNotifications();
      expect(pending[0]).toEqual(regularNotification);

      const futureFromUser = await mockBackend.getAllFutureNotificationsFromUser('user-1');
      expect(futureFromUser[0]).toEqual(regularNotification);

      const persisted = await mockBackend.persistNotification({
        userId: 'user-1',
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'template.pug',
        contextName: 'testContext',
        contextParameters: { userId: 'user-1' },
        sendAfter: null,
        subjectTemplate: 'Subject',
        extraParams: null,
      });
      expect(persisted).toEqual(regularNotification);

      const updated = await mockBackend.persistNotificationUpdate('1', { title: 'Updated' });
      expect(updated).toEqual(regularNotification);

      const sent = await mockBackend.markAsSent('1', true);
      expect(sent).toEqual(regularNotification);

      const read = await mockBackend.markAsRead('1', true);
      expect(read).toEqual(regularNotification);

      const fetched = await mockBackend.getNotification('1', false);
      expect(fetched).toEqual(regularNotification);
    });
  });
});
