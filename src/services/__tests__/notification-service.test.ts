import { NotificationService } from '../../index';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationQueueService } from '../notification-queue-service/base-notification-queue-service';
import type { Notification, DatabaseNotification } from '../../types/notification';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';
import { NotificationContextRegistry } from '../notification-context-registry';

// Mock implementations
// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockBackend: jest.Mocked<BaseNotificationBackend<any, any, any>> = {
  persistNotification: jest.fn(),
  persistNotificationUpdate: jest.fn(),
  getAllFutureNotifications: jest.fn(),
  getAllFutureNotificationsFromUser: jest.fn(),
  getFutureNotificationsFromUser: jest.fn(),
  getFutureNotifications: jest.fn(),
  getAllPendingNotifications: jest.fn(),
  getPendingNotifications: jest.fn(),
  getNotification: jest.fn(),
  markSentAsRead: jest.fn(),
  filterAllInAppUnreadNotifications: jest.fn(),
  cancelNotification: jest.fn(),
  markPendingAsSent: jest.fn(),
  markPendingAsFailed: jest.fn(),
  storeContextUsed: jest.fn(),
  getUserEmailFromNotification: jest.fn(),
  filterInAppUnreadNotifications: jest.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockTemplateRenderer: jest.Mocked<BaseEmailTemplateRenderer<any, any, any>> = {
  render: jest.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockAdapter: jest.Mocked<BaseNotificationAdapter<any, any, any, any, any>> = {
  notificationType: 'EMAIL',
  key: 'test-adapter',
  enqueueNotifications: false,
  send: jest.fn(),
  backend: mockBackend,
  templateRenderer: mockTemplateRenderer,
};

const mockLogger: jest.Mocked<BaseLogger> = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
const mockQueueService: jest.Mocked<BaseNotificationQueueService<any>> = {
  enqueueNotification: jest.fn(),
};

const notificationContextgenerators = {
  "testContext": {
    generate: jest.fn(),
  }
};

describe('NotificationService', () => {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let service: NotificationService<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let mockNotification: Notification<any, any, any> = {
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
    NotificationContextRegistry.resetInstance();
    NotificationContextRegistry.initialize(notificationContextgenerators);
    service = new NotificationService([mockAdapter], mockBackend, mockLogger);
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
      expect(mockBackend.markPendingAsSent).toHaveBeenCalledWith('123');
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle missing adapter', async () => {
      const invalidNotification = { ...mockNotification, notificationType: 'invalid' };
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await service.send(invalidNotification as unknown as Notification<any, any, any>);

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should handle context generation failure', async () => {
      const error = new Error('Context generation failed');
      notificationContextgenerators.testContext.generate.mockRejectedValue(error);

      await service.send(mockNotification);

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error getting context for notification ${mockNotification.id}: ${error}`
      );
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should throw error when notification has no ID', async () => {
      const notificationWithoutId = { ...mockNotification, id: undefined };

      await expect(service.send(notificationWithoutId)).rejects.toThrow(
        "Notification wan't created in the database"
      );
    });

    it('should handle queue service integration with enqueue adapter', async () => {
      const serviceWithQueue = new NotificationService(
        [{ ...mockAdapter, enqueueNotifications: true }],
        mockBackend,
        mockLogger,
        mockQueueService
      );

      await serviceWithQueue.send(mockNotification);

      expect(mockQueueService.enqueueNotification).toHaveBeenCalledWith(mockNotification.id);
      expect(mockAdapter.send).not.toHaveBeenCalled();
    });
  });

  describe('createNotification', () => {
    const mockNewNotification = {
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
        sendAfter: pastDate
      };

      mockBackend.persistNotification.mockResolvedValue({ ...notification, id: '123' });
      jest.spyOn(service, 'send').mockResolvedValue();

      await service.createNotification(notification);

      expect(service.send).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Notification 123 sent immediately because sendAfter is in the past');
    });

    it('should not send immediately when sendAfter is in the future', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const notification = {
        ...mockNewNotification,
        sendAfter: futureDate
      };

      mockBackend.persistNotification.mockResolvedValue({ ...notification, id: '123' });
      jest.spyOn(service, 'send').mockResolvedValue();

      await service.createNotification(notification);

      expect(service.send).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(`Notification 123 scheduled for ${futureDate}`);
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
      const distributedAdapter = { ...mockAdapter, enqueueNotifications: true };
      const serviceWithQueue = new NotificationService(
        [distributedAdapter],
        mockBackend,
        mockLogger,
        mockQueueService
      );

      mockBackend.getNotification.mockResolvedValue(mockNotification);
      notificationContextgenerators.testContext.generate.mockResolvedValue({});

      await serviceWithQueue.delayedSend('123');

      expect(distributedAdapter.send).toHaveBeenCalled();
      expect(mockBackend.markPendingAsSent).toHaveBeenCalled();
    });

    it('should fail when there are no distributed adapters', async () => {
      mockBackend.getNotification.mockResolvedValue(mockNotification);

      await service.delayedSend('123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Delayed send is not supported if there are no distributed adapters'
      );
    });

    it('should handle notification without ID', async () => {
      const notificationWithoutId = { ...mockNotification, id: undefined };
      mockBackend.getNotification.mockResolvedValue(notificationWithoutId);

      const serviceWithDistributedAdapter = new NotificationService(
        [{ ...mockAdapter, enqueueNotifications: true }],
        mockBackend,
        mockLogger
      );

      await serviceWithDistributedAdapter.delayedSend('123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Notification wasn't created in the database. Please create it first"
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
        ...updates
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } as unknown as Notification<any, any, any>);

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
      await service.getFutureNotificationsFromUser('user123');
      expect(mockBackend.getFutureNotificationsFromUser).toHaveBeenCalledWith('user123');
    });

    it('should get all future notifications from user', async () => {
      mockBackend.getAllFutureNotificationsFromUser.mockResolvedValue([]);
      await service.getAllFutureNotificationsFromUser('user123');
      expect(mockBackend.getAllFutureNotificationsFromUser).toHaveBeenCalledWith('user123');
    });

    it('should get future notifications', async () => {
      mockBackend.getFutureNotifications.mockResolvedValue([]);
      await service.getFutureNotifications();
      expect(mockBackend.getFutureNotifications).toHaveBeenCalled();
    });
  });

  describe('notification context handling', () => {
    it('should get notification context', async () => {
      const mockContext = { data: 'test' };
      notificationContextgenerators.testContext.generate.mockReturnValue(mockContext);
      const result = await service.getNotificationContext('testContext', { param: 'value' });
      expect(result).toEqual(mockContext);
    });
  });

  describe('pending notifications', () => {
    it('should send all pending notifications', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockPendingNotifications: DatabaseNotification<any, any, any>[] = [
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '1', notificationType: 'EMAIL' } as unknown as DatabaseNotification<any, any, any>,
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        { ...mockNotification, id: '2', notificationType: 'EMAIL' } as unknown as DatabaseNotification<any, any, any>
      ];
      mockBackend.getAllPendingNotifications.mockResolvedValue(mockPendingNotifications);
      notificationContextgenerators.testContext.generate.mockReturnValue({});

      await service.sendPendingNotifications();

      expect(mockBackend.getAllPendingNotifications).toHaveBeenCalled();
      expect(mockAdapter.send).toHaveBeenCalledTimes(2);
    });

    it('should get pending notifications', async () => {
      mockBackend.getPendingNotifications.mockResolvedValue([]);
      await service.getPendingNotifications();
      expect(mockBackend.getPendingNotifications).toHaveBeenCalled();
    });
  });

  describe('notification status management', () => {
    it('should mark notification as read', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      mockBackend.markSentAsRead.mockResolvedValue({ ...mockNotification, id: '123', readAt: new Date() } as unknown as DatabaseNotification<any, any, any>);
      await service.markRead('123');
      expect(mockBackend.markSentAsRead).toHaveBeenCalledWith('123');
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
    const serviceWithError = new NotificationService(
      [mockAdapter],
      mockBackend,
      mockLogger,
      undefined,
      { raiseErrorOnFailedSend: true }
    );

    it('should throw error when no adapter found with raiseErrorOnFailedSend enabled', async () => {
      const invalidNotification = {
        id: '123',
        notificationType: 'INVALID',
        contextName: 'testContext',
        contextParameters: {}
      };

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      await expect(serviceWithError.send(invalidNotification as any)).rejects.toThrow(
        'No adapter found for notification type INVALID'
      );
    });

    it('should throw error when notification not found in delayed send', async () => {
      mockBackend.getNotification.mockResolvedValue(null);

      await expect(serviceWithError.delayedSend('nonexistent')).rejects.toThrow(
        'Notification nonexistent not found'
      );
    });
  });

  describe('notification retrieval', () => {
    it('should get a single notification', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const mockNotif = { ...mockAdapter, id: '123', title: 'Test' } as unknown as Notification<any, any, any>;
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
});
