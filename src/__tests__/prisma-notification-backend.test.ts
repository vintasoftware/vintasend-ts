import { PrismaNotificationBackend } from '../index';
import { NotificationStatusEnum, NotificationTypeEnum } from '../prisma-notification-backend';
import type { NotificationPrismaClientInterface } from '../prisma-notification-backend';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';

type TestContexts = {
  testContext: {
    generate: (params: { param1: string }) => Promise<{ value1: string }>;
  };
};

describe('PrismaNotificationBackend', () => {
  let mockPrismaClient: jest.Mocked<NotificationPrismaClientInterface<string, string>>;
  let backend: PrismaNotificationBackend<
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    typeof mockPrismaClient, any
  >;

  beforeEach(() => {
    mockPrismaClient = {
      notification: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    backend = new PrismaNotificationBackend(mockPrismaClient);
  });

  const mockNotification = {
    id: '1',
    userId: 'user1',
    notificationType: NotificationTypeEnum.EMAIL,
    title: 'Test Title',
    bodyTemplate: 'Test Body',
    contextName: 'testContext',
    contextParameters: { param1: 'value1' },
    sendAfter: null,
    subjectTemplate: 'Test Subject',
    status: NotificationStatusEnum.PENDING_SEND,
    contextUsed: null,
    extraParams: null,
    adapterUsed: null,
    sentAt: null,
    readAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('getAllPendingNotifications', () => {
    it('should fetch all pending notifications', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getAllPendingNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: NotificationStatusEnum.PENDING_SEND,
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
      });
    });
  });

  describe('persistNotification', () => {
    it('should create a new notification', async () => {
      const input = {
        id: undefined,
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
        bodyTemplate: 'Test Body',
        contextName: 'testContext' as keyof TestContexts,
        contextParameters: { param1: 'value1' },
        title: 'Test Title',
        subjectTemplate: 'Test Subject',
        extraParams: { key: 'value' },
        sendAfter: null,
      };

      const createMock = mockPrismaClient.notification.create as jest.Mock;
      createMock.mockResolvedValue(mockNotification);

      const result = await backend.persistNotification(input);

      expect(mockPrismaClient.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          user: { connect: { id: 'user1' } },
          notificationType: NotificationTypeEnum.EMAIL,
          bodyTemplate: 'Test Body',
        }),
      });
      expect(result).toMatchObject({
        id: '1',
        userId: 'user1',
        notificationType: NotificationTypeEnum.EMAIL,
      });
    });
  });

  describe('markPendingAsSent', () => {
    it('should mark a notification as sent', async () => {
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const sentNotification: DatabaseNotification<any> = {
        ...mockNotification,
        status: NotificationStatusEnum.SENT,
        sentAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;

      updateMock.mockResolvedValue(sentNotification);

      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      const result: DatabaseNotification<any> = await backend.markPendingAsSent('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: NotificationStatusEnum.SENT,
          sentAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(NotificationStatusEnum.SENT);
      expect(result.sentAt).toBeDefined();
    });
  });

  describe('markSentAsRead', () => {
    it('should mark a notification as read', async () => {
      const readNotification = {
        ...mockNotification,
        status: NotificationStatusEnum.READ,
        readAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(readNotification);

      const result = await backend.markSentAsRead('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: NotificationStatusEnum.READ,
          readAt: expect.any(Date),
        },
      });
      expect(result?.status).toBe(NotificationStatusEnum.READ);
      expect(result?.readAt).toBeDefined();
    });
  });

  describe('filterInAppUnreadNotifications', () => {
    it('should return unread notifications with pagination', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.filterInAppUnreadNotifications('user1', 0, 10);

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: NotificationStatusEnum.SENT,
          readAt: null,
        },
        skip: 0,
        take: 10,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserEmailFromNotification', () => {
    it('should return user email for notification', async () => {
      const notificationWithUser = {
        ...mockNotification,
        user: {
          email: 'test@example.com',
        },
      };

      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(notificationWithUser);

      const result = await backend.getUserEmailFromNotification('1');

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: { user: true },
      });
      expect(result).toBe('test@example.com');
    });
  });

  describe('getPendingNotifications', () => {
    it('should fetch pending notifications with no sendAfter date', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getPendingNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: NotificationStatusEnum.PENDING_SEND,
          sendAfter: null,
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        status: NotificationStatusEnum.PENDING_SEND,
      });
    });
  });

  describe('getAllFutureNotifications', () => {
    it('should fetch future notifications', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getAllFutureNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('markPendingAsFailed', () => {
    it('should mark a notification as failed', async () => {
      const failedNotification = {
        ...mockNotification,
        status: NotificationStatusEnum.FAILED,
        sentAt: new Date(),
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(failedNotification);

      const result = await backend.markPendingAsFailed('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: NotificationStatusEnum.FAILED,
          sentAt: expect.any(Date),
        },
      });
      expect(result.status).toBe(NotificationStatusEnum.FAILED);
      expect(result.sentAt).toBeDefined();
    });
  });

  describe('cancelNotification', () => {
    it('should cancel a notification', async () => {
      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue({ ...mockNotification, status: NotificationStatusEnum.CANCELLED });

      await backend.cancelNotification('1');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          status: NotificationStatusEnum.CANCELLED,
        },
      });
    });
  });

  describe('getNotification', () => {
    it('should get a notification by id', async () => {
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(mockNotification);

      const result = await backend.getNotification('1', false);

      expect(mockPrismaClient.notification.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
      expect(result).toMatchObject({
        id: '1',
        userId: 'user1',
      });
    });

    it('should return null when notification not found', async () => {
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(null);

      const result = await backend.getNotification('1', false);

      expect(result).toBeNull();
    });
  });

  describe('storeContextUsed', () => {
    it('should store the context used for a notification', async () => {
      const context = { value1: 'test' };
      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue({ ...mockNotification, contextUsed: context });

      await backend.storeContextUsed('1', context);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          contextUsed: context,
        },
      });
    });

    it('should handle rejected update', async () => {
      const context = { value1: 'test' };
      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockRejectedValue(new Error('Update failed'));

      await expect(backend.storeContextUsed('1', context)).rejects.toThrow('Update failed');

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          contextUsed: context,
        },
      });
    });
  });

  describe('getAllFutureNotificationsFromUser', () => {
    it('should fetch future notifications for a specific user', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getAllFutureNotificationsFromUser('user1');

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user1');
    });

    it('should return empty array when no notifications found', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);

      const result = await backend.getAllFutureNotificationsFromUser('user1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getFutureNotificationsFromUser', () => {
    it('should fetch future notifications for a specific user', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.getFutureNotificationsFromUser('user1');

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('persistNotificationUpdate', () => {
    it('should update an existing notification', async () => {
      const updateData = {
        title: 'Updated Title',
        bodyTemplate: 'Updated Body',
        contextParameters: { param1: 'updated' },
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateData,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          title: 'Updated Title',
          bodyTemplate: 'Updated Body',
        }),
      });
      expect(result).toMatchObject(updateData);
    });

    it('should handle partial updates', async () => {
      const updateData = {
        title: 'Updated Title',
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateData,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          title: 'Updated Title',
        }),
      });
      expect(result.title).toBe('Updated Title');
    });
  });

  describe('filterAllInAppUnreadNotifications', () => {
    it('should return all unread notifications for a user', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([mockNotification]);

      const result = await backend.filterAllInAppUnreadNotifications('user1');

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          status: NotificationStatusEnum.SENT,
          readAt: null,
        },
      });
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no unread notifications exist', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);

      const result = await backend.filterAllInAppUnreadNotifications('user1');

      expect(result).toHaveLength(0);
    });
  });

  describe('convertJsonValueToRecord', () => {
    it('should throw error for non-object JSON values', async () => {
      const invalidInput = {
        ...mockNotification,
        extraParams: ['invalid array'] as unknown as Record<string, string>,
      };

      const createMock = mockPrismaClient.notification.create as jest.Mock;
      createMock.mockResolvedValue(invalidInput);

      // @ts-ignore - testing invalid input
      await expect(backend.persistNotification(invalidInput)).rejects.toThrow('Invalid JSON value');
    });
  });

  describe('serializeNotification', () => {
    it('should correctly serialize notification with all fields', () => {
      const fullNotification = {
        ...mockNotification,
        contextUsed: { generatedValue: 'test' },
        extraParams: { param1: 'value1', param2: true, param3: 42 },
      };

      const result = backend.serializeNotification(fullNotification);

      expect(result).toEqual({
        ...fullNotification,
        contextName: fullNotification.contextName as keyof TestContexts,
        contextParameters: fullNotification.contextParameters,
        contextUsed: fullNotification.contextUsed,
        extraParams: fullNotification.extraParams,
      });
    });

    it('should handle null values in optional fields', () => {
      const nullFieldsNotification = {
        ...mockNotification,
        contextUsed: null,
        extraParams: null,
      };

      const result = backend.serializeNotification(nullFieldsNotification);

      expect(result.contextUsed).toBeNull();
      expect(result.extraParams).toBeNull();
    });

    it('should handle empty contextParameters', () => {
      const notificationWithEmptyContext = {
        ...mockNotification,
        contextParameters: {},
      };

      const result = backend.serializeNotification(notificationWithEmptyContext);

      expect(result.contextParameters).toEqual({});
    });

    it('should properly cast contextParameters to the correct type', () => {
      const notificationWithComplexContext = {
        ...mockNotification,
        contextParameters: {
          param1: 'test value',
          param2: 123,
          param3: true,
        },
      };

      const result = backend.serializeNotification(notificationWithComplexContext);

      expect(result.contextParameters).toEqual({
        param1: 'test value',
        param2: 123,
        param3: true,
      });
      // Verify the type casting worked by checking if it matches TestContexts type
      expect(result.contextName).toBe('testContext');
      // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      expect(typeof (result.contextParameters as any).param1).toBe('string');
    });
  });

  describe('error handling', () => {
    it('should handle database errors in getAllPendingNotifications', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockRejectedValue(new Error('Database error'));

      await expect(backend.getAllPendingNotifications()).rejects.toThrow('Database error');
    });

    it('should handle invalid JSON values in persistNotification', async () => {
      const invalidInput = {
        ...mockNotification,
        extraParams: [] as unknown as Record<string, string>, // Invalid extra params
      };

      const createMock = mockPrismaClient.notification.create as jest.Mock;
      createMock.mockResolvedValue(invalidInput);

      // @ts-ignore - testing invalid input
      await expect(backend.persistNotification(invalidInput)).rejects.toThrow('Invalid JSON value');
    });

    it('should handle missing user email in getUserEmailFromNotification', async () => {
      const notificationWithoutUser = { ...mockNotification, user: undefined };
      const findUniqueMock = mockPrismaClient.notification.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(notificationWithoutUser);

      const result = await backend.getUserEmailFromNotification('1');

      expect(result).toBeUndefined();
    });
  });

  describe('getFutureNotifications', () => {
    it('should fetch future notifications with sendAfter date before now', async () => {
      const futureNotification = {
        ...mockNotification,
        sendAfter: new Date(Date.now() - 1000), // 1 second ago
        status: NotificationStatusEnum.PENDING_SEND,
      };

      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([futureNotification]);

      const result = await backend.getFutureNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(1);
      expect(result[0].sendAfter).toBeDefined();
      expect(result[0].sendAfter instanceof Date).toBeTruthy();
    });

    it('should return empty array when no future notifications exist', async () => {
      const findManyMock = mockPrismaClient.notification.findMany as jest.Mock;
      findManyMock.mockResolvedValue([]);

      const result = await backend.getFutureNotifications();

      expect(mockPrismaClient.notification.findMany).toHaveBeenCalledWith({
        where: {
          status: {
            not: NotificationStatusEnum.PENDING_SEND,
          },
          sendAfter: {
            lte: expect.any(Date),
          },
        },
      });
      expect(result).toHaveLength(0);
    });
  });

  describe('deserializeNotificationForUpdate', () => {
    it('should not include contextParameters when undefined', async () => {
      const updateData = {
        title: 'Updated Title',
        contextParameters: undefined,
      };

      const updatedNotification = {
        ...mockNotification,
        title: 'Updated Title',
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.not.objectContaining({
          contextParameters: expect.anything(),
        }),
      });
      expect(result.title).toBe('Updated Title');
    });

    it('should handle empty contextParameters', async () => {
      const updateData = {
        title: 'Updated Title',
        contextParameters: {
          param1: 'valuetest',
        },
      };

      const updatedNotification = {
        ...mockNotification,
        ...updateData,
      };

      const updateMock = mockPrismaClient.notification.update as jest.Mock;
      updateMock.mockResolvedValue(updatedNotification);

      const result = await backend.persistNotificationUpdate('1', updateData);

      expect(mockPrismaClient.notification.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: expect.objectContaining({
          contextParameters: {
      param1: 'valuetest'},
        }),
      });
      expect(result.contextParameters).toEqual({
      param1: 'valuetest'});
    });
  });
});
