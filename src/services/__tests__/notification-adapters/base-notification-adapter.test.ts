import { BaseNotificationAdapter } from '../../../services/notification-adapters/base-notification-adapter';
import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';
import type { BaseNotificationTemplateRenderer } from '../../../services/notification-template-renderers/base-notification-template-renderer';
import type { NotificationType } from '../../../types/notification-type';
import type { Notification } from '../../../types/notification';
import type { ContextGenerator } from '../../../services/notification-context-registry';
import type { BaseNotificationBackend } from '../../notification-backends/base-notification-backend';



// Mock implementations
interface MockConfig extends BaseNotificationTypeConfig {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  Backend: any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ContextMap: any;
  NotificationIdType: string;
  UserIdType: string;
}

class MockTemplateRenderer implements BaseNotificationTemplateRenderer<MockConfig> {
  render() {
    return Promise.resolve({ subject: 'Test', body: 'Test body' });
  }
}

class TestNotificationAdapter extends BaseNotificationAdapter<MockTemplateRenderer, MockConfig> {}

describe('BaseNotificationAdapter', () => {
  let adapter: TestNotificationAdapter;
  let templateRenderer: MockTemplateRenderer;
  let mockBackend: MockConfig['Backend'];
  let mockNotification: Notification<MockConfig['ContextMap'], string, string>;

  beforeEach(() => {
    templateRenderer = new MockTemplateRenderer();
    mockBackend = {
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
    adapter = new TestNotificationAdapter(templateRenderer, 'EMAIL', false);
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

  describe('constructor', () => {
    it('should initialize with correct properties', () => {
      expect(adapter.notificationType).toBe('EMAIL');
      expect(adapter.enqueueNotifications).toBe(false);
      expect(adapter.backend).toBeNull();
    });
  });

  describe('send', () => {
    it('should throw error if backend is not injected', async () => {
      await expect(adapter.send(mockNotification, {})).rejects.toThrow('Backend not injected');
    });

    it('should resolve when backend is properly injected', async () => {
      adapter.injectBackend(mockBackend);
      await expect(adapter.send(mockNotification, {})).resolves.toBeUndefined();
    });
  });

  describe('injectBackend', () => {
    it('should properly inject backend', () => {
      adapter.injectBackend(mockBackend);
      expect(adapter.backend).toBe(mockBackend);
    });
  });
});
