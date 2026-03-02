import { BaseNotificationAdapter } from '../../../services/notification-adapters/base-notification-adapter';
import type { BaseNotificationTemplateRenderer } from '../../../services/notification-template-renderers/base-notification-template-renderer';
import type { DatabaseNotification } from '../../../types/notification';
import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';

// Mock implementations
interface MockConfig extends BaseNotificationTypeConfig {
  Backend: any;
  ContextMap: any;
  NotificationIdType: string;
  UserIdType: string;
}

class MockTemplateRenderer implements BaseNotificationTemplateRenderer<MockConfig> {
  render() {
    return Promise.resolve({ subject: 'Test', body: 'Test body' });
  }

  renderFromTemplateContent() {
    return Promise.resolve({ subject: 'Test', body: 'Test body' });
  }
}

class TestNotificationAdapter extends BaseNotificationAdapter<MockTemplateRenderer, MockConfig> {}

describe('BaseNotificationAdapter', () => {
  let adapter: TestNotificationAdapter;
  let templateRenderer: MockTemplateRenderer;
  let mockBackend: MockConfig['Backend'];
  let mockNotification: DatabaseNotification<MockConfig>;

  beforeEach(() => {
    templateRenderer = new MockTemplateRenderer();
    mockBackend = {
      persistNotification: vi.fn(),
      persistNotificationUpdate: vi.fn(),
      getAllFutureNotifications: vi.fn(),
      getAllFutureNotificationsFromUser: vi.fn(),
      getFutureNotificationsFromUser: vi.fn(),
      getFutureNotifications: vi.fn(),
      getAllPendingNotifications: vi.fn(),
      getPendingNotifications: vi.fn(),
      getNotification: vi.fn(),
      markSentAsRead: vi.fn(),
      filterAllInAppUnreadNotifications: vi.fn(),
      cancelNotification: vi.fn(),
      markPendingAsSent: vi.fn(),
      markPendingAsFailed: vi.fn(),
      storeAdapterAndContextUsed: vi.fn(),
      getUserEmailFromNotification: vi.fn(),
      filterInAppUnreadNotifications: vi.fn(),
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
      gitCommitSha: null,
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
