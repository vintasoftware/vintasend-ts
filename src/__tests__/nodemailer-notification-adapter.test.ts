import nodemailer from 'nodemailer';
import { NodemailerNotificationAdapter } from '../index';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

jest.mock('nodemailer');

describe('NodemailerNotificationAdapter', () => {
  const mockTransporter = {
    sendMail: jest.fn(),
  };

  const mockTemplateRenderer = {
    render: jest.fn(),
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  } as jest.Mocked<BaseEmailTemplateRenderer<any>>;

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
  let mockNotification: DatabaseNotification<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);
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

  it('should initialize with correct properties', () => {
    const adapter = new NodemailerNotificationAdapter(
      mockTemplateRenderer,
      false,
      {
        host: 'smtp.example.com',
        port: 587,
        secure: false, // true for port 465, false for other ports
        auth: {
          user: 'username',
          pass: 'password',
        },
      } as SMTPTransport.Options
    );

    expect(adapter.notificationType).toBe('EMAIL');
    expect(adapter.key).toBe('nodemailer');
    expect(adapter.enqueueNotifications).toBe(false);
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false, // true for port 465, false for other ports
      auth: {
        user: 'username',
        pass: 'password',
      },
    } as SMTPTransport.Options);
  });

  it('should send email successfully', async () => {
    const adapter = new NodemailerNotificationAdapter(
      mockTemplateRenderer,
      false,
      {
        host: 'smtp.example.com',
        port: 587,
        secure: false, // true for port 465, false for other ports
        auth: {
          user: 'username',
          pass: 'password',
        },
      } as SMTPTransport.Options
    );
    adapter.injectBackend(mockBackend);

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockNotification, context);
    expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('123');
    expect(mockTransporter.sendMail).toHaveBeenCalledWith({
      to: userEmail,
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });

  it('should throw error if notification ID is missing', async () => {
    const adapter = new NodemailerNotificationAdapter(
      mockTemplateRenderer,
      false,
      {
        host: 'smtp.example.com',
        port: 587,
        secure: false, // true for port 465, false for other ports
        auth: {
          user: 'username',
          pass: 'password',
        },
      } as SMTPTransport.Options
    );
    adapter.injectBackend(mockBackend);

    mockNotification.id = undefined;

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('Notification ID is required');
  });

  it('should throw error if user email is not found', async () => {
    const adapter = new NodemailerNotificationAdapter(
      mockTemplateRenderer,
      false,
      {
        host: 'smtp.example.com',
        port: 587,
        secure: false, // true for port 465, false for other ports
        auth: {
          user: 'username',
          pass: 'password',
        },
      } as SMTPTransport.Options
    );
    adapter.injectBackend(mockBackend);


    mockTemplateRenderer.render.mockResolvedValue({
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    });
    mockBackend.getUserEmailFromNotification.mockResolvedValue(undefined);

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('User email not found');
  });
});
