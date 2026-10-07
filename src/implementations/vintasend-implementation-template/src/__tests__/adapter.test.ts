import {
  type BaseEmailTemplateRenderer,
  type BaseNotificationBackend,
  type DatabaseNotification,
  type DatabaseOneOffNotification,
  logMessageMatching,
  renderLogMessage,
} from 'vintasend';
import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';
import { NotificationAdapter, NotificationAdapterFactory } from '../adapter';

describe('NotificationAdapter', () => {
  const mockTemplateRenderer = {
    render: vi.fn(),
    renderFromTemplateContent: vi.fn(),
  } as Mocked<BaseEmailTemplateRenderer<any>>;

  const mockBackend: Mocked<BaseNotificationBackend<any>> = {
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
    getAttachmentFile: vi.fn(),
    deleteAttachmentFile: vi.fn(),
    getOrphanedAttachmentFiles: vi.fn(),
    getAttachments: vi.fn(),
    deleteNotificationAttachment: vi.fn(),
    findAttachmentFileByChecksum: vi.fn(),
    filterNotifications: vi.fn(),
  };

  let mockNotification: DatabaseNotification<any>;

  beforeEach(() => {
    vi.clearAllMocks();

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
      tenant: null,
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
      sendAfter: new Date(),
    };
  });

  describe('initialization', () => {
    it('should initialize with expected defaults', () => {
      const adapter = new NotificationAdapterFactory().create(mockTemplateRenderer, false);

      expect(adapter.notificationType).toBe('EMAIL');
      expect(adapter.key).toBe('adapter-key');
      expect(adapter.enqueueNotifications).toBe(false);
    });
  });

  describe('send', () => {
    it('should render and resolve when backend and user email are available', async () => {
      const adapter = new NotificationAdapterFactory().create(mockTemplateRenderer, false);
      adapter.injectBackend(mockBackend);

      const context = { foo: 'bar' };
      const renderedTemplate = {
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      };

      mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
      mockBackend.getUserEmailFromNotification.mockResolvedValue('user@example.com');

      // `send` hands the render back so the service can record which template version went out.
      // Returning nothing is still valid for an adapter that has nothing to report; this one
      // reports, so the assertion is on the payload rather than on `undefined`.
      await expect(adapter.send(mockNotification, context)).resolves.toEqual(renderedTemplate);
      expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockNotification, context);
      expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('123');
    });

    it('should throw error if backend not injected', async () => {
      const adapter = new NotificationAdapterFactory().create(mockTemplateRenderer, false);

      await expect(adapter.send(mockNotification, {})).rejects.toThrow('Backend not injected');
    });

    it('should throw error if notification ID is missing', async () => {
      const adapter = new NotificationAdapterFactory().create(mockTemplateRenderer, false);
      adapter.injectBackend(mockBackend);

      mockNotification.id = undefined;

      await expect(adapter.send(mockNotification, {})).rejects.toThrow(
        'Notification ID is required',
      );
    });

    it('should throw error if user email is not found', async () => {
      const adapter = new NotificationAdapterFactory().create(mockTemplateRenderer, false);
      adapter.injectBackend(mockBackend);

      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      });
      mockBackend.getUserEmailFromNotification.mockResolvedValue(undefined);

      await expect(adapter.send(mockNotification, {})).rejects.toThrow('User email not found');
    });

    it('should log a provider failure by id and error name only', async () => {
      class FailingAdapter extends NotificationAdapter<BaseEmailTemplateRenderer<any>, any> {
        protected override async deliver(): Promise<void> {
          throw Object.assign(
            new Error('Rejected Jane Synthetic <jane.synthetic@example.com>: Lab results ready'),
            { status: 400 },
          );
        }
      }
      const adapter = new FailingAdapter(mockTemplateRenderer, false);
      const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      adapter.injectBackend(mockBackend);
      adapter.injectLogger(logger);
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Lab results for Jane Synthetic',
        body: '<p>Hello Jane Synthetic</p>',
      });
      mockBackend.getUserEmailFromNotification.mockResolvedValue('jane.synthetic@example.com');

      await expect(adapter.send(mockNotification, { name: 'Jane Synthetic' })).rejects.toThrow(
        'Rejected Jane Synthetic',
      );

      expect(logger.error).toHaveBeenCalledWith(
        logMessageMatching(
          'Provider rejected notification 123 via adapter-key: Error (status 400)',
        ),
      );
      const lines = [
        ...logger.info.mock.calls,
        ...logger.warn.mock.calls,
        ...logger.error.mock.calls,
      ]
        .map(([message]) => renderLogMessage(message))
        .join('\n');
      expect(lines).not.toContain('Jane Synthetic');
      expect(lines).not.toContain('jane.synthetic@example.com');
    });
  });

  describe('one-off notifications', () => {
    let mockOneOffNotification: DatabaseOneOffNotification<any>;

    beforeEach(() => {
      mockOneOffNotification = {
        id: 'one-off-1',
        emailOrPhone: 'oneoff@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL' as const,
        contextName: 'testContext',
        contextParameters: {},
        title: 'One-off notification',
        bodyTemplate: '/path/to/template',
        subjectTemplate: '/path/to/subject',
        extraParams: {},
        tenant: null,
        contextUsed: null,
        adapterUsed: null,
        status: 'PENDING_SEND' as const,
        sentAt: null,
        readAt: null,
        gitCommitSha: null,
        sendAfter: null,
      };
    });

    it('should have a scaffold for direct one-off recipient delivery', async () => {
      // TODO: If your adapter supports one-off notifications, assert it uses emailOrPhone.
      expect(mockOneOffNotification.emailOrPhone).toBe('oneoff@example.com');
    });
  });

  describe('attachments', () => {
    it('should have a scaffold for attachment handling assertions', async () => {
      // TODO: Mirror SendGrid adapter attachment tests in your implementation:
      // - maps stored attachments to provider payload
      // - handles single/multiple/empty attachments
      expect(true).toBe(true);
    });
  });
});
