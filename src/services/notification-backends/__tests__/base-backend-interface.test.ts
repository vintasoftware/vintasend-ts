import type { InputJsonValue } from '../../../types/json-values';
import type {
  AnyDatabaseNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
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
        getAllPendingNotifications: jest.fn().mockResolvedValue([]),
        getPendingNotifications: jest.fn().mockResolvedValue([]),
        getAllFutureNotifications: jest.fn().mockResolvedValue([]),
        getFutureNotifications: jest.fn().mockResolvedValue([]),
        getAllFutureNotificationsFromUser: jest.fn().mockResolvedValue([]),
        getFutureNotificationsFromUser: jest.fn().mockResolvedValue([]),
        persistNotification: jest.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        getAllNotifications: jest.fn().mockResolvedValue([]),
        getNotifications: jest.fn().mockResolvedValue([]),
        bulkPersistNotifications: jest.fn().mockResolvedValue([]),
        persistNotificationUpdate: jest
          .fn()
          .mockResolvedValue({} as DatabaseNotification<TestConfig>),
        markAsSent: jest.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        markAsFailed: jest.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        markAsRead: jest.fn().mockResolvedValue({} as DatabaseNotification<TestConfig>),
        cancelNotification: jest.fn().mockResolvedValue(undefined),
        getNotification: jest.fn().mockResolvedValue(null),
        filterAllInAppUnreadNotifications: jest.fn().mockResolvedValue([]),
        filterInAppUnreadNotifications: jest.fn().mockResolvedValue([]),
        getUserEmailFromNotification: jest.fn().mockResolvedValue(undefined),
        storeContextUsed: jest.fn().mockResolvedValue(undefined),

        // One-off notification methods
        persistOneOffNotification: jest
          .fn()
          .mockResolvedValue({} as DatabaseOneOffNotification<TestConfig>),
        persistOneOffNotificationUpdate: jest
          .fn()
          .mockResolvedValue({} as DatabaseOneOffNotification<TestConfig>),
        getOneOffNotification: jest.fn().mockResolvedValue(null),
        getAllOneOffNotifications: jest.fn().mockResolvedValue([]),
        getOneOffNotifications: jest.fn().mockResolvedValue([]),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: jest
          .fn()
          .mockResolvedValue([regularNotification, oneOffNotification]),
        getPendingNotifications: jest.fn().mockResolvedValue([]),
        getAllFutureNotifications: jest.fn().mockResolvedValue([]),
        getFutureNotifications: jest.fn().mockResolvedValue([]),
        getAllFutureNotificationsFromUser: jest.fn().mockResolvedValue([]),
        getFutureNotificationsFromUser: jest.fn().mockResolvedValue([]),
        persistNotification: jest.fn(),
        getAllNotifications: jest.fn().mockResolvedValue([]),
        getNotifications: jest.fn().mockResolvedValue([]),
        bulkPersistNotifications: jest.fn(),
        persistNotificationUpdate: jest.fn(),
        markAsSent: jest.fn(),
        markAsFailed: jest.fn(),
        markAsRead: jest.fn(),
        cancelNotification: jest.fn(),
        getNotification: jest.fn(),
        filterAllInAppUnreadNotifications: jest.fn(),
        filterInAppUnreadNotifications: jest.fn(),
        getUserEmailFromNotification: jest.fn(),
        storeContextUsed: jest.fn(),
        persistOneOffNotification: jest.fn(),
        persistOneOffNotificationUpdate: jest.fn(),
        getOneOffNotification: jest.fn(),
        getAllOneOffNotifications: jest.fn(),
        getOneOffNotifications: jest.fn(),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: jest.fn(),
        getPendingNotifications: jest.fn(),
        getAllFutureNotifications: jest.fn(),
        getFutureNotifications: jest.fn(),
        getAllFutureNotificationsFromUser: jest.fn(),
        getFutureNotificationsFromUser: jest.fn(),
        persistNotification: jest.fn(),
        getAllNotifications: jest.fn(),
        getNotifications: jest.fn(),
        bulkPersistNotifications: jest.fn(),
        persistNotificationUpdate: jest.fn(),
        markAsSent: jest.fn(),
        markAsFailed: jest.fn(),
        markAsRead: jest.fn(),
        cancelNotification: jest.fn(),
        getNotification: jest.fn().mockResolvedValue(oneOffNotification),
        filterAllInAppUnreadNotifications: jest.fn(),
        filterInAppUnreadNotifications: jest.fn(),
        getUserEmailFromNotification: jest.fn(),
        storeContextUsed: jest.fn(),
        persistOneOffNotification: jest.fn(),
        persistOneOffNotificationUpdate: jest.fn(),
        getOneOffNotification: jest.fn(),
        getAllOneOffNotifications: jest.fn(),
        getOneOffNotifications: jest.fn(),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: jest.fn(),
        getPendingNotifications: jest.fn(),
        getAllFutureNotifications: jest.fn(),
        getFutureNotifications: jest.fn(),
        getAllFutureNotificationsFromUser: jest.fn(),
        getFutureNotificationsFromUser: jest.fn(),
        persistNotification: jest.fn(),
        getAllNotifications: jest.fn(),
        getNotifications: jest.fn(),
        bulkPersistNotifications: jest.fn(),
        persistNotificationUpdate: jest.fn(),
        markAsSent: jest.fn(),
        markAsFailed: jest.fn(),
        markAsRead: jest.fn(),
        cancelNotification: jest.fn(),
        getNotification: jest.fn(),
        filterAllInAppUnreadNotifications: jest.fn(),
        filterInAppUnreadNotifications: jest.fn(),
        getUserEmailFromNotification: jest.fn(),
        storeContextUsed: jest.fn(),
        persistOneOffNotification: jest.fn().mockResolvedValue(expectedResult),
        persistOneOffNotificationUpdate: jest.fn(),
        getOneOffNotification: jest.fn(),
        getAllOneOffNotifications: jest.fn(),
        getOneOffNotifications: jest.fn(),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
        getAllPendingNotifications: jest.fn(),
        getPendingNotifications: jest.fn(),
        getAllFutureNotifications: jest.fn(),
        getFutureNotifications: jest.fn(),
        getAllFutureNotificationsFromUser: jest.fn(),
        getFutureNotificationsFromUser: jest.fn(),
        persistNotification: jest.fn(),
        getAllNotifications: jest.fn(),
        getNotifications: jest.fn(),
        bulkPersistNotifications: jest.fn(),
        persistNotificationUpdate: jest.fn(),
        markAsSent: jest.fn(),
        markAsFailed: jest.fn(),
        markAsRead: jest.fn(),
        cancelNotification: jest.fn(),
        getNotification: jest.fn(),
        filterAllInAppUnreadNotifications: jest.fn(),
        filterInAppUnreadNotifications: jest.fn(),
        getUserEmailFromNotification: jest.fn(),
        storeContextUsed: jest.fn(),
        persistOneOffNotification: jest.fn(),
        persistOneOffNotificationUpdate: jest
          .fn()
          .mockResolvedValue({} as DatabaseOneOffNotification<TestConfig>),
        getOneOffNotification: jest.fn(),
        getAllOneOffNotifications: jest.fn(),
        getOneOffNotifications: jest.fn(),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: jest.fn(),
        getPendingNotifications: jest.fn(),
        getAllFutureNotifications: jest.fn(),
        getFutureNotifications: jest.fn(),
        getAllFutureNotificationsFromUser: jest.fn(),
        getFutureNotificationsFromUser: jest.fn(),
        persistNotification: jest.fn(),
        getAllNotifications: jest.fn(),
        getNotifications: jest.fn(),
        bulkPersistNotifications: jest.fn(),
        persistNotificationUpdate: jest.fn(),
        markAsSent: jest.fn().mockResolvedValue(oneOffNotification),
        markAsFailed: jest.fn().mockResolvedValue(oneOffNotification),
        markAsRead: jest.fn(),
        cancelNotification: jest.fn(),
        getNotification: jest.fn(),
        filterAllInAppUnreadNotifications: jest.fn(),
        filterInAppUnreadNotifications: jest.fn(),
        getUserEmailFromNotification: jest.fn(),
        storeContextUsed: jest.fn(),
        persistOneOffNotification: jest.fn(),
        persistOneOffNotificationUpdate: jest.fn(),
        getOneOffNotification: jest.fn(),
        getAllOneOffNotifications: jest.fn(),
        getOneOffNotifications: jest.fn(),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
        const pending: AnyDatabaseNotification<TestConfig>[] =
          await backend.getAllPendingNotifications();
        const notification: AnyDatabaseNotification<TestConfig> | null =
          await backend.getNotification('1', false);
        const sent: AnyDatabaseNotification<TestConfig> = await backend.markAsSent('1', true);
        const failed: AnyDatabaseNotification<TestConfig> = await backend.markAsFailed('1', true);

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
      };

      const mockBackend: BaseNotificationBackend<TestConfig> = {
        getAllPendingNotifications: jest.fn().mockResolvedValue([regularNotification]),
        getPendingNotifications: jest.fn(),
        getAllFutureNotifications: jest.fn(),
        getFutureNotifications: jest.fn(),
        getAllFutureNotificationsFromUser: jest.fn().mockResolvedValue([regularNotification]),
        getFutureNotificationsFromUser: jest.fn(),
        persistNotification: jest.fn().mockResolvedValue(regularNotification),
        getAllNotifications: jest.fn(),
        getNotifications: jest.fn(),
        bulkPersistNotifications: jest.fn(),
        persistNotificationUpdate: jest.fn().mockResolvedValue(regularNotification),
        markAsSent: jest.fn().mockResolvedValue(regularNotification),
        markAsFailed: jest.fn(),
        markAsRead: jest.fn().mockResolvedValue(regularNotification),
        cancelNotification: jest.fn(),
        getNotification: jest.fn().mockResolvedValue(regularNotification),
        filterAllInAppUnreadNotifications: jest.fn(),
        filterInAppUnreadNotifications: jest.fn(),
        getUserEmailFromNotification: jest.fn(),
        storeContextUsed: jest.fn(),
        persistOneOffNotification: jest.fn(),
        persistOneOffNotificationUpdate: jest.fn(),
        getOneOffNotification: jest.fn(),
        getAllOneOffNotifications: jest.fn(),
        getOneOffNotifications: jest.fn(),

        // Attachment methods
        getAttachmentFile: jest.fn().mockResolvedValue(null),
        findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
        deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
        getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
        getAttachments: jest.fn().mockResolvedValue([]),
        deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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
