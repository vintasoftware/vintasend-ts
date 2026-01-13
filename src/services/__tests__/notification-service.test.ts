import { VintaSendFactory } from '../../index';
import type { DatabaseNotification } from '../../types/notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationQueueService } from '../notification-queue-service/base-notification-queue-service';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';

// Mock implementations
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockBackend: jest.Mocked<BaseNotificationBackend<any>> = {
  persistNotification: jest.fn(),
  persistNotificationUpdate: jest.fn(),
  getAllFutureNotifications: jest.fn(),
  getAllFutureNotificationsFromUser: jest.fn(),
  getFutureNotificationsFromUser: jest.fn(),
  getFutureNotifications: jest.fn(),
  getAllPendingNotifications: jest.fn(),
  getPendingNotifications: jest.fn(),
  getNotification: jest.fn(),
  markAsRead: jest.fn(),
  filterAllInAppUnreadNotifications: jest.fn(),
  cancelNotification: jest.fn(),
  markAsSent: jest.fn(),
  markAsFailed: jest.fn(),
  storeContextUsed: jest.fn(),
  getUserEmailFromNotification: jest.fn(),
  filterInAppUnreadNotifications: jest.fn(),
  bulkPersistNotifications: jest.fn(),
  getAllNotifications: jest.fn(),
  getNotifications: jest.fn(),
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

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockTemplateRenderer: jest.Mocked<BaseEmailTemplateRenderer<any>> = {
  render: jest.fn(),
};

const mockLogger: jest.Mocked<BaseLogger> = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockAdapter: jest.Mocked<BaseNotificationAdapter<any, any>> = {
  notificationType: 'EMAIL',
  key: 'test-adapter',
  enqueueNotifications: false,
  send: jest.fn(),
  injectBackend: jest.fn(),
  injectLogger: jest.fn(),
  backend: mockBackend,
  templateRenderer: mockTemplateRenderer,
  logger: mockLogger,
  supportsAttachments: false,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
} as any;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockQueueService: jest.Mocked<BaseNotificationQueueService<any>> = {
  enqueueNotification: jest.fn(),
};

const notificationContextgenerators = {
  testContext: {
    generate: jest.fn(),
  },
};

type Config = {
  ContextMap: typeof notificationContextgenerators;
  NotificationIdType: string;
  UserIdType: string;
};

describe('NotificationService', () => {
  let service: ReturnType<VintaSendFactory<Config>['create']>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let mockNotification: DatabaseNotification<any> = {
    id: '123',
    notificationType: 'EMAIL' as const,
    contextName: 'testContext',
    contextParameters: {},
    userId: '456',
    title: 'Test Notification',
    bodyTemplate: '/path/to/template',
    subjectTemplate: '/path/to/subject',
    extraParams: {},
    contextUsed: null,
    adapterUsed: null,
    status: 'PENDING_SEND' as const,
    sentAt: null,
    readAt: null,
    sendAfter: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VintaSendFactory<Config>().create(
      [mockAdapter],
      mockBackend,
      mockLogger,
      notificationContextgenerators,
    );
    mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: '/path/to/subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      sendAfter: new Date(),
    };
  });

  describe('send', () => {
    it('should successfully send a notification', async () => {
      notificationContextgenerators.testContext.generate.mockReturnValue({});

      await service.send(mockNotification);

      expect(mockAdapter.send).toHaveBeenCalledWith(mockNotification, {});
      expect(mockBackend.markAsSent).toHaveBeenCalledWith('123', true);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle missing adapter', async () => {
      const invalidNotification = { ...mockNotification, notificationType: 'invalid' };
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await service.send(invalidNotification as unknown as DatabaseNotification<any>);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should handle context generation failure', async () => {
      const error = new Error('Context generation failed');
      notificationContextgenerators.testContext.generate.mockRejectedValue(error);

      await service.send(mockNotification);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error getting context for notification ${mockNotification.id}: ${error}`,
      );
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should throw error when notification has no ID', async () => {
      const { id: _id, ...notificationWithoutId } = mockNotification;

      // @ts-ignore - testing invalid input
      await expect(service.send(notificationWithoutId)).rejects.toThrow(
        "Notification wasn't created in the database",
      );
    });

    it('should handle queue service integration with enqueue adapter', async () => {
      const serviceWithQueue = new VintaSendFactory<Config>().create(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        [{ ...mockAdapter, enqueueNotifications: true } as any],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        mockQueueService,
      );

      await serviceWithQueue.send(mockNotification);

      expect(mockQueueService.enqueueNotification).toHaveBeenCalledWith(mockNotification.id);
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should handle errors when marking as sent', async () => {
      notificationContextgenerators.testContext.generate.mockResolvedValue({});
      mockBackend.markAsSent.mockRejectedValue(new Error('Database error'));

      await service.send(mockNotification);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error marking notification 123 as sent'),
      );
    });

    it('should handle missing queue service for distributed adapter', async () => {
      const serviceWithDistributedAdapter = new VintaSendFactory<Config>().create(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        [{ ...mockAdapter, enqueueNotifications: true } as any],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
      );

      await serviceWithDistributedAdapter.send(mockNotification);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Distributed adapter found but no queue service provided',
      );
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should handle queue service enqueue error', async () => {
      const serviceWithQueue = new VintaSendFactory<Config>().create(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        [{ ...mockAdapter, enqueueNotifications: true } as any],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        mockQueueService,
      );

      mockQueueService.enqueueNotification.mockRejectedValue(new Error('Queue error'));

      await serviceWithQueue.send(mockNotification);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error enqueuing notification'),
      );
    });

    it('should handle error storing context', async () => {
      notificationContextgenerators.testContext.generate.mockResolvedValue({});
      mockBackend.storeContextUsed.mockRejectedValue(new Error('Storage error'));

      await service.send(mockNotification);

      expect(mockAdapter.send).toHaveBeenCalled();
      expect(mockBackend.storeContextUsed).toHaveBeenCalledWith(mockNotification.id, {});
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error storing context for notification'),
      );
    });

    it('should handle failed storage of context and continue execution', async () => {
      notificationContextgenerators.testContext.generate.mockResolvedValue({});
      mockBackend.storeContextUsed.mockRejectedValue(new Error('Failed to store context'));

      await service.send(mockNotification);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error storing context for notification'),
      );
      // Should still complete the send operation
      expect(mockAdapter.send).toHaveBeenCalled();
      expect(mockBackend.markAsSent).toHaveBeenCalled();
    });

    it('should store null context as empty object', async () => {
      notificationContextgenerators.testContext.generate.mockResolvedValue(null);

      await service.send(mockNotification);

      expect(mockBackend.storeContextUsed).toHaveBeenCalledWith(mockNotification.id, {});
    });
  });

  describe('createNotification', () => {
    const mockNewNotification = {
      notificationType: 'EMAIL' as const,
      contextName: 'testContext' as const,
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: '/path/to/subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      sendAfter: new Date(),
    };

    it('should create a notification', async () => {
      mockBackend.persistNotification.mockResolvedValue({ ...mockNewNotification, id: '123' });

      const result = await service.createNotification(mockNewNotification);

      expect(mockBackend.persistNotification).toHaveBeenCalledWith(mockNewNotification);
      expect(result.id).toBe('123');
    });

    it('should send immediately when sendAfter is in the past', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const notification = {
        ...mockNewNotification,
        sendAfter: pastDate,
      };

      mockBackend.persistNotification.mockResolvedValue({ ...notification, id: '123' });
      jest.spyOn(service, 'send').mockResolvedValue();

      await service.createNotification(notification);

      expect(service.send).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification 123 sent immediately because sendAfter is null or in the past',
      );
    });

    it('should not send immediately when sendAfter is in the future', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const notification = {
        ...mockNewNotification,
        sendAfter: futureDate,
      };

      mockBackend.persistNotification.mockResolvedValue({ ...notification, id: '123' });
      jest.spyOn(service, 'send').mockResolvedValue();

      await service.createNotification(notification);

      expect(service.send).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(`Notification 123 scheduled for ${futureDate}`);
    });

    it('should log error when notification is created', async () => {
      mockBackend.persistNotification.mockResolvedValue({ ...mockNewNotification, id: '123' });

      await service.createNotification(mockNewNotification);

      expect(mockLogger.error).toHaveBeenCalledWith('Notification 123 created');
    });

    it('should handle notification with null sendAfter date', async () => {
      const notificationWithNullSendAfter = {
        ...mockNewNotification,
        sendAfter: null,
      };

      mockBackend.persistNotification.mockResolvedValue({
        ...notificationWithNullSendAfter,
        id: '123',
      });
      jest.spyOn(service, 'send').mockResolvedValue();

      await service.createNotification(notificationWithNullSendAfter);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification 123 sent immediately because sendAfter is null or in the past',
      );
      expect(service.send).toHaveBeenCalled();
    });
  });

  describe('delayed send', () => {
    const mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: '/path/to/subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      sendAfter: new Date(),
    };

    it('should handle delayed send with distributed adapter', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const distributedAdapter = { ...mockAdapter, enqueueNotifications: true } as any;
      const serviceWithQueue = new VintaSendFactory<Config>().create(
        [distributedAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        mockQueueService,
      );

      mockBackend.getNotification.mockResolvedValue(mockNotification);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});

      await serviceWithQueue.delayedSend('123');

      expect(distributedAdapter.send).toHaveBeenCalled();
      expect(mockBackend.markAsSent).toHaveBeenCalled();
    });

    it('should fail when there are no distributed adapters', async () => {
      mockBackend.getNotification.mockResolvedValue(mockNotification);

      await service.delayedSend('123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Delayed send is not supported if there are no distributed adapters',
      );
    });

    it('should fail when there are no distributed adapters with raiseErrorOnFailedSend enabled', async () => {
      mockBackend.getNotification.mockResolvedValue(mockNotification);
      const serviceWithError = new VintaSendFactory<Config>().create(
        [mockAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        undefined,
        undefined,
        { raiseErrorOnFailedSend: true },
      );

      await expect(serviceWithError.delayedSend('123')).rejects.toThrow(
        new Error('Delayed send is not supported if there are no distributed adapters'),
      );
    });

    it('should handle error when marking notification as sent in delayedSend', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const distributedAdapter = { ...mockAdapter, enqueueNotifications: true } as any;
      const serviceWithQueue = new VintaSendFactory<Config>().create(
        [distributedAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        mockQueueService,
      );

      mockBackend.getNotification.mockResolvedValue(mockNotification);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});
      mockBackend.markAsSent.mockRejectedValue(new Error('Failed to mark as sent'));

      await serviceWithQueue.delayedSend('123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error marking notification 123 as sent'),
      );
      expect(distributedAdapter.send).toHaveBeenCalled();
    });

    it('should handle send error and mark as failed in delayedSend', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const distributedAdapter = { ...mockAdapter, enqueueNotifications: true } as any;
      const serviceWithQueue = new VintaSendFactory<Config>().create(
        [distributedAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        mockQueueService,
      );

      mockBackend.getNotification.mockResolvedValue(mockNotification);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});
      distributedAdapter.send.mockRejectedValue(new Error('Send failed'));

      await serviceWithQueue.delayedSend('123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending notification 123'),
      );
      expect(mockBackend.markAsFailed).toHaveBeenCalled();
    });

    it('should handle error when marking as failed in delayedSend', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const distributedAdapter = { ...mockAdapter, enqueueNotifications: true } as any;
      const serviceWithQueue = new VintaSendFactory<Config>().create(
        [distributedAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        mockQueueService,
      );

      mockBackend.getNotification.mockResolvedValue(mockNotification);
      distributedAdapter.send.mockRejectedValue(new Error('Send failed'));
      mockBackend.markAsFailed.mockRejectedValue(new Error('Failed to mark as failed'));

      await serviceWithQueue.delayedSend('123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error marking notification 123 as failed'),
      );
    });
  });

  describe('queue operations', () => {
    it('should register queue service', () => {
      service.registerQueueService(mockQueueService);
      // biome-ignore lint/complexity/useLiteralKeys: access to private property for testing
      expect(service['queueService']).toBe(mockQueueService);
    });
  });

  describe('updateNotification', () => {
    it('should update a notification', async () => {
      const updates = { title: 'Updated Title' };
      mockBackend.persistNotificationUpdate.mockResolvedValue({
        ...mockNotification,
        id: '123',
        ...updates,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } as unknown as DatabaseNotification<any>);

      const result = await service.updateNotification('123', updates);

      expect(mockBackend.persistNotificationUpdate).toHaveBeenCalledWith('123', updates);
      expect(result).toHaveProperty('title', 'Updated Title');
      expect(mockLogger.info).toHaveBeenCalledWith('Notification 123 updated');
    });
  });

  describe('notification retrieval methods', () => {
    it('should get all future notifications', async () => {
      mockBackend.getAllFutureNotifications.mockResolvedValue([]);
      await service.getAllFutureNotifications();
      expect(mockBackend.getAllFutureNotifications).toHaveBeenCalled();
    });

    it('should get future notifications from user', async () => {
      mockBackend.getFutureNotificationsFromUser.mockResolvedValue([]);
      await service.getFutureNotificationsFromUser('user123', 1, 10);
      expect(mockBackend.getFutureNotificationsFromUser).toHaveBeenCalledWith('user123', 1, 10);
    });

    it('should get all future notifications from user', async () => {
      mockBackend.getAllFutureNotificationsFromUser.mockResolvedValue([]);
      await service.getAllFutureNotificationsFromUser('user123');
      expect(mockBackend.getAllFutureNotificationsFromUser).toHaveBeenCalledWith('user123');
    });

    it('should get future notifications', async () => {
      mockBackend.getFutureNotifications.mockResolvedValue([]);
      await service.getFutureNotifications(1, 10);
      expect(mockBackend.getFutureNotifications).toHaveBeenCalledWith(1, 10);
    });
  });

  describe('notification context handling', () => {
    it('should get notification context', async () => {
      const mockContext = { data: 'test' };
      notificationContextgenerators.testContext.generate.mockReturnValue(mockContext);
      const result = await service.getNotificationContext('testContext', { param: 'value' });
      expect(result).toEqual(mockContext);
    });

    it('should handle null context generation', async () => {
      notificationContextgenerators.testContext.generate.mockResolvedValue(null);

      const result = await service.getNotificationContext('testContext', { param: 'value' });

      expect(result).toBeNull();
    });
  });

  describe('pending notifications', () => {
    it('should send all pending notifications', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockPendingNotifications: DatabaseNotification<any>[] = [
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        {
          ...mockNotification,
          id: '1',
          notificationType: 'EMAIL',
        } as unknown as DatabaseNotification<any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        {
          ...mockNotification,
          id: '2',
          notificationType: 'EMAIL',
        } as unknown as DatabaseNotification<any>,
      ];
      mockBackend.getAllPendingNotifications.mockResolvedValue(mockPendingNotifications);
      notificationContextgenerators.testContext.generate.mockReturnValue({});

      await service.sendPendingNotifications();

      expect(mockBackend.getAllPendingNotifications).toHaveBeenCalled();
      expect(mockAdapter.send).toHaveBeenCalledTimes(2);
    });

    it('should get pending notifications', async () => {
      mockBackend.getPendingNotifications.mockResolvedValue([]);
      await service.getPendingNotifications(1, 10);
      expect(mockBackend.getPendingNotifications).toHaveBeenCalledWith(1, 10);
    });

    it('should handle failed notifications in sendPendingNotifications', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockPendingNotifications: DatabaseNotification<any>[] = [
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '1' } as unknown as DatabaseNotification<any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '2' } as unknown as DatabaseNotification<any>,
      ];
      mockBackend.getAllPendingNotifications.mockResolvedValue(mockPendingNotifications);
      notificationContextgenerators.testContext.generate.mockRejectedValue(
        new Error('Context error'),
      );

      await service.sendPendingNotifications();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error getting context for notification'),
      );
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should log success for each pending notification sent', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockPendingNotifications: DatabaseNotification<any>[] = [
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '1' } as unknown as DatabaseNotification<any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '2' } as unknown as DatabaseNotification<any>,
      ];
      mockBackend.getAllPendingNotifications.mockResolvedValue(mockPendingNotifications);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});

      await service.sendPendingNotifications();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated context for notification 1'),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Generated context for notification 2'),
      );
    });

    it('should handle notification send failure in sendPendingNotifications', async () => {
      const mockError = new Error('Send failed');
      mockAdapter.send.mockRejectedValue(mockError);
      mockBackend.getAllPendingNotifications.mockResolvedValue([mockNotification]);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});

      await service.sendPendingNotifications();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Error sending notification ${mockNotification.id}`),
      );
    });

    it('should continue processing other notifications after failure', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const notifications: DatabaseNotification<any>[] = [
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '1' } as unknown as DatabaseNotification<any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '2' } as unknown as DatabaseNotification<any>,
      ];
      mockBackend.getAllPendingNotifications.mockResolvedValue(notifications);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});
      mockAdapter.send
        .mockRejectedValueOnce(new Error('First send failed'))
        .mockResolvedValueOnce();

      await service.sendPendingNotifications();

      expect(mockAdapter.send).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error sending notification 1'),
      );
    });

    it('should log info for each notification context generation', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockPendingNotifications: DatabaseNotification<any>[] = [
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '1' } as unknown as DatabaseNotification<any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '2' } as unknown as DatabaseNotification<any>,
      ];
      mockBackend.getAllPendingNotifications.mockResolvedValue(mockPendingNotifications);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});

      await service.sendPendingNotifications();

      expect(mockLogger.info).toHaveBeenCalledWith('Generated context for notification 1');
      expect(mockLogger.info).toHaveBeenCalledWith('Generated context for notification 2');
    });
  });

  describe('notification status management', () => {
    it('should mark notification as read', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      mockBackend.markAsRead.mockResolvedValue({
        ...mockNotification,
        id: '123',
        readAt: new Date(),
      } as unknown as DatabaseNotification<any>);
      await service.markRead('123');
      expect(mockBackend.markAsRead).toHaveBeenCalledWith('123', true);
      expect(mockLogger.info).toHaveBeenCalledWith('Notification 123 marked as read');
    });

    it('should get unread in-app notifications', async () => {
      mockBackend.filterAllInAppUnreadNotifications.mockResolvedValue([]);
      await service.getInAppUnread('user123');
      expect(mockBackend.filterAllInAppUnreadNotifications).toHaveBeenCalledWith('user123');
    });

    it('should cancel a notification', async () => {
      await service.cancelNotification('123');
      expect(mockBackend.cancelNotification).toHaveBeenCalledWith('123');
      expect(mockLogger.info).toHaveBeenCalledWith('Notification 123 cancelled');
    });
  });

  describe('error handling', () => {
    const serviceWithError = new VintaSendFactory<Config>().create(
      [mockAdapter],
      mockBackend,
      mockLogger,
      notificationContextgenerators,
      undefined,
      undefined,
      { raiseErrorOnFailedSend: true },
    );

    it('should throw error when no adapter found with raiseErrorOnFailedSend enabled', async () => {
      const invalidNotification = {
        id: '123',
        notificationType: 'INVALID',
        contextName: 'testContext',
        contextParameters: {},
      };

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await expect(serviceWithError.send(invalidNotification as any)).rejects.toThrow(
        'No adapter found for notification type INVALID',
      );
    });

    it('should throw error when notification not found in delayed send', async () => {
      mockBackend.getNotification.mockResolvedValue(null);

      await expect(serviceWithError.delayedSend('nonexistent')).rejects.toThrow(
        'Notification nonexistent not found',
      );
    });

    it('should log error when notification not found in delayed send with raiseErrorOnFailedSend disabled', async () => {
      mockBackend.getNotification.mockResolvedValue(null);
      // biome-ignore lint/complexity/useLiteralKeys: <explanation>
      serviceWithError['options']['raiseErrorOnFailedSend'] = false;

      await serviceWithError.delayedSend('nonexistent');

      expect(mockLogger.error).toHaveBeenCalledWith('Notification nonexistent not found');
    });
  });

  describe('notification context errors', () => {
    it('should handle context errors with raiseErrorOnFailedSend enabled', async () => {
      const serviceWithError = new VintaSendFactory<Config>().create(
        [mockAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        undefined,
        undefined,
        { raiseErrorOnFailedSend: true },
      );

      const error = new Error('Context generation failed');
      notificationContextgenerators.testContext.generate.mockRejectedValue(error);

      await expect(serviceWithError.send(mockNotification)).rejects.toThrow(error);
    });
  });

  describe('notification retrieval', () => {
    it('should get a single notification', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockNotif = {
        ...mockAdapter,
        id: '123',
        title: 'Test',
      } as unknown as DatabaseNotification<any>;
      mockBackend.getNotification.mockResolvedValue(mockNotif);

      const result = await service.getNotification('123');
      expect(result).toEqual(mockNotif);
      expect(mockBackend.getNotification).toHaveBeenCalledWith('123', false);
    });

    it('should get a notification for update', async () => {
      await service.getNotification('123', true);
      expect(mockBackend.getNotification).toHaveBeenCalledWith('123', true);
    });
  });

  describe('resendNotification', () => {
    it('should resend a notification with new context', async () => {
      mockBackend.getNotification.mockResolvedValue(mockNotification);
      const newContext = { test: 'new context' };
      notificationContextgenerators.testContext.generate.mockResolvedValue(newContext);
      mockBackend.persistNotification.mockResolvedValue({ ...mockNotification, id: '456' });

      const result = await service.resendNotification('123');

      expect(result?.id).toBe('456');
      expect(mockBackend.persistNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockNotification.userId,
          notificationType: mockNotification.notificationType,
          contextName: mockNotification.contextName,
          contextParameters: mockNotification.contextParameters,
          contextUsed: newContext,
        }),
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Notification 456 created for resending notification 123',
      );
    });

    it('should resend a notification using stored context when specified', async () => {
      const storedContext = { test: 'stored context' };
      const notificationWithContext = {
        ...mockNotification,
        contextUsed: storedContext,
      };
      mockBackend.getNotification.mockResolvedValue(notificationWithContext);
      mockBackend.persistNotification.mockResolvedValue({ ...notificationWithContext, id: '456' });

      const result = await service.resendNotification('123', true);

      expect(result?.id).toBe('456');
      expect(mockBackend.persistNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          contextUsed: storedContext,
        }),
      );
      expect(notificationContextgenerators.testContext.generate).not.toHaveBeenCalled();
    });

    it('should fail when notification is not found', async () => {
      mockBackend.getNotification.mockResolvedValue(null);

      const result = await service.resendNotification('123');

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Notification 123 not found');
    });

    it('should fail when notification is scheduled for the future', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const scheduledNotification = { ...mockNotification, sendAfter: futureDate };
      mockBackend.getNotification.mockResolvedValue(scheduledNotification);

      const result = await service.resendNotification('123');

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Notification 123 is scheduled for the future');
    });

    it('should fail when using stored context but none exists', async () => {
      const notificationWithoutContext = {
        ...mockNotification,
        contextUsed: null,
      };
      mockBackend.getNotification.mockResolvedValue(notificationWithoutContext);

      const result = await service.resendNotification('123', true);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Context not found for notification 123');
    });

    it('should throw errors when raiseErrorOnFailedSend is enabled', async () => {
      const serviceWithError = new VintaSendFactory<Config>().create(
        [mockAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        undefined,
        undefined,
        { raiseErrorOnFailedSend: true },
      );
      mockBackend.getNotification.mockResolvedValue(null);

      await expect(serviceWithError.resendNotification('123')).rejects.toThrow(
        'Notification 123 not found',
      );
    });

    it('should automatically send the resent notification', async () => {
      mockBackend.getNotification.mockResolvedValue(mockNotification);
      const newContext = { test: 'new context' };
      notificationContextgenerators.testContext.generate.mockResolvedValue(newContext);
      const newNotification = { ...mockNotification, id: '456' };
      mockBackend.persistNotification.mockResolvedValue(newNotification);

      jest.spyOn(service, 'send').mockResolvedValue();

      await service.resendNotification('123');

      expect(service.send).toHaveBeenCalledWith(newNotification);
    });

    it('should throw error when notification is scheduled for the future with raiseErrorOnFailedSend enabled', async () => {
      const serviceWithError = new VintaSendFactory<Config>().create(
        [mockAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        undefined,
        undefined,
        { raiseErrorOnFailedSend: true },
      );

      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const scheduledNotification = { ...mockNotification, sendAfter: futureDate };
      mockBackend.getNotification.mockResolvedValue(scheduledNotification);

      await expect(serviceWithError.resendNotification('123')).rejects.toThrow(
        'Notification 123 is scheduled for the future',
      );
    });

    it('should throw error when using stored context but none exists with raiseErrorOnFailedSend enabled', async () => {
      const serviceWithError = new VintaSendFactory<Config>().create(
        [mockAdapter],
        mockBackend,
        mockLogger,
        notificationContextgenerators,
        undefined,
        undefined,
        { raiseErrorOnFailedSend: true },
      );

      const notificationWithoutContext = {
        ...mockNotification,
        contextUsed: null,
      };
      mockBackend.getNotification.mockResolvedValue(notificationWithoutContext);

      await expect(serviceWithError.resendNotification('123', true)).rejects.toThrow(
        'Context not found for notification 123',
      );
    });
  });
});
