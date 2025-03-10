import { NotificationServiceSingleton } from '../notification-service';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationQueueService } from '../notification-queue-service/base-notification-queue-service';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';


describe('NotificationServiceSingleton', () => {
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
  const mockTemplateRenderer: jest.Mocked<BaseEmailTemplateRenderer<any>> = {
    render: jest.fn(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const mockAdapter: jest.Mocked<BaseNotificationAdapter<any, any>> = {
    notificationType: 'EMAIL',
    key: 'test-adapter',
    enqueueNotifications: false,
    send: jest.fn(),
    injectBackend: jest.fn(),
    backend: mockBackend,
    templateRenderer: mockTemplateRenderer,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } as any;

  const mockLogger: jest.Mocked<BaseLogger> = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const mockQueueService: jest.Mocked<BaseNotificationQueueService<any>> = {
    enqueueNotification: jest.fn(),
  };


  beforeEach(() => {
    // Reset the singleton instance before each test
    // @ts-ignore - accessing private property for testing
    NotificationServiceSingleton.instance = undefined;
  });

  it('should create a singleton instance', () => {
    const instance1 = NotificationServiceSingleton.getInstance([mockAdapter], mockBackend, mockLogger);
    const instance2 = NotificationServiceSingleton.getInstance([mockAdapter], mockBackend, mockLogger);

    expect(instance1).toBe(instance2);
  });

  it('should throw error when getting instance without initialization', () => {
    expect(() => {
      NotificationServiceSingleton.getInstance();
    }).toThrow('NotificationServiceSingleton is not initialized');
  });

  it('should maintain same instance across multiple calls with different parameters', () => {
    const instance1 = NotificationServiceSingleton.getInstance([mockAdapter], mockBackend, mockLogger);
    const instance2 = NotificationServiceSingleton.getInstance([mockAdapter], mockBackend, mockLogger);

    expect(instance1).toBe(instance2);
  });
});
