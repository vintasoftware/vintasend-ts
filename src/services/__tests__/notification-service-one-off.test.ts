import { VintaSendFactory } from '../../index';
import type { DatabaseOneOffNotification } from '../../types/one-off-notification';
import type { OneOffNotificationInput } from '../../types/one-off-notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
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
  deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
  getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
  getAttachments: jest.fn().mockResolvedValue([]),
  deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
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

describe('NotificationService - One-Off Notifications', () => {
  let service: ReturnType<VintaSendFactory<Config>['create']>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let mockOneOffNotification: DatabaseOneOffNotification<any>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  let mockOneOffNotificationInput: Omit<OneOffNotificationInput<any>, 'id'>;

  beforeEach(() => {
    jest.clearAllMocks();

    const factory = new VintaSendFactory<Config>();
    service = factory.create([mockAdapter], mockBackend, mockLogger, notificationContextgenerators);

    mockOneOffNotificationInput = {
      emailOrPhone: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      notificationType: 'EMAIL' as const,
      title: 'Test One-Off',
      bodyTemplate: '/path/to/template',
      contextName: 'testContext' as const,
      contextParameters: {},
      sendAfter: null,
      subjectTemplate: 'Test Subject',
      extraParams: null,
    };

    mockOneOffNotification = {
      id: '123',
      ...mockOneOffNotificationInput,
      status: 'PENDING_SEND' as const,
      contextUsed: null,
      extraParams: {},
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      attachments: undefined, // Override to match DatabaseOneOffNotification type
    };

    notificationContextgenerators.testContext.generate.mockReturnValue({ test: 'context' });
  });

  describe('createOneOffNotification', () => {
    it('should persist one-off notification correctly', async () => {
      mockBackend.persistOneOffNotification.mockResolvedValue(mockOneOffNotification);

      const result = await service.createOneOffNotification(mockOneOffNotificationInput);

      expect(mockBackend.persistOneOffNotification).toHaveBeenCalledWith(
        mockOneOffNotificationInput,
      );
      expect(result).toEqual(mockOneOffNotification);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('One-off notification 123 created'),
      );
    });

    it('should send immediately when sendAfter is null', async () => {
      mockBackend.persistOneOffNotification.mockResolvedValue(mockOneOffNotification);

      await service.createOneOffNotification(mockOneOffNotificationInput);

      expect(mockAdapter.send).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('sent immediately'));
    });

    it('should send immediately when sendAfter is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const inputWithPastDate: typeof mockOneOffNotificationInput = {
        ...mockOneOffNotificationInput,
        sendAfter: pastDate,
      };
      const notificationWithPastDate = { ...mockOneOffNotification, sendAfter: pastDate };

      mockBackend.persistOneOffNotification.mockResolvedValue(notificationWithPastDate);

      await service.createOneOffNotification(inputWithPastDate);

      expect(mockAdapter.send).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('sent immediately'));
    });

    it('should schedule when sendAfter is in the future', async () => {
      const futureDate = new Date(Date.now() + 10000);
      const inputWithFutureDate: typeof mockOneOffNotificationInput = {
        ...mockOneOffNotificationInput,
        sendAfter: futureDate,
      };
      const notificationWithFutureDate = { ...mockOneOffNotification, sendAfter: futureDate };

      mockBackend.persistOneOffNotification.mockResolvedValue(notificationWithFutureDate);

      await service.createOneOffNotification(inputWithFutureDate);

      expect(mockAdapter.send).not.toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('scheduled for'));
    });

    it('should throw error for invalid email format', async () => {
      const invalidInput: typeof mockOneOffNotificationInput = {
        ...mockOneOffNotificationInput,
        emailOrPhone: 'invalid-email',
      };

      await expect(service.createOneOffNotification(invalidInput)).rejects.toThrow(
        'Invalid email or phone format',
      );

      expect(mockBackend.persistOneOffNotification).not.toHaveBeenCalled();
    });

    it('should accept valid phone number format', async () => {
      const phoneInput: typeof mockOneOffNotificationInput = {
        ...mockOneOffNotificationInput,
        emailOrPhone: '+1234567890',
      };
      const phoneNotification = { ...mockOneOffNotification, emailOrPhone: '+1234567890' };

      mockBackend.persistOneOffNotification.mockResolvedValue(phoneNotification);

      await service.createOneOffNotification(phoneInput);

      expect(mockBackend.persistOneOffNotification).toHaveBeenCalledWith(phoneInput);
    });

    it('should throw error for invalid phone format', async () => {
      const invalidPhoneInput: typeof mockOneOffNotificationInput = {
        ...mockOneOffNotificationInput,
        emailOrPhone: '123',
      };

      await expect(service.createOneOffNotification(invalidPhoneInput)).rejects.toThrow(
        'Invalid email or phone format',
      );

      expect(mockBackend.persistOneOffNotification).not.toHaveBeenCalled();
    });

    it('should handle backend errors', async () => {
      const error = new Error('Backend error');
      mockBackend.persistOneOffNotification.mockRejectedValue(error);

      await expect(service.createOneOffNotification(mockOneOffNotificationInput)).rejects.toThrow(
        'Backend error',
      );
    });
  });

  describe('updateOneOffNotification', () => {
    it('should update one-off notification correctly', async () => {
      const updateData = { title: 'Updated Title' };
      const updatedNotification = { ...mockOneOffNotification, ...updateData };

      mockBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedNotification);

      const result = await service.updateOneOffNotification('123', updateData);

      expect(mockBackend.persistOneOffNotificationUpdate).toHaveBeenCalledWith('123', updateData);
      expect(result).toEqual(updatedNotification);
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('One-off notification 123 updated'),
      );
    });

    it('should re-send if updated sendAfter is null', async () => {
      const updateData = { sendAfter: null };
      const updatedNotification = { ...mockOneOffNotification, ...updateData };

      mockBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedNotification);

      await service.updateOneOffNotification('123', updateData);

      expect(mockAdapter.send).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('sent after update'));
    });

    it('should re-send if updated sendAfter is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000);
      const updateData = { sendAfter: pastDate };
      const updatedNotification = { ...mockOneOffNotification, ...updateData };

      mockBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedNotification);

      await service.updateOneOffNotification('123', updateData);

      expect(mockAdapter.send).toHaveBeenCalled();
    });

    it('should not re-send if updated sendAfter is in the future', async () => {
      const futureDate = new Date(Date.now() + 10000);
      const updateData = { sendAfter: futureDate };
      const updatedNotification = { ...mockOneOffNotification, sendAfter: futureDate };

      mockBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedNotification);

      await service.updateOneOffNotification('123', updateData);

      expect(mockAdapter.send).not.toHaveBeenCalled();
    });

    it('should validate email format if emailOrPhone is updated', async () => {
      const updateData = { emailOrPhone: 'invalid-email' };

      await expect(service.updateOneOffNotification('123', updateData)).rejects.toThrow(
        'Invalid email or phone format',
      );

      expect(mockBackend.persistOneOffNotificationUpdate).not.toHaveBeenCalled();
    });

    it('should accept valid phone number format in update', async () => {
      const updateData = { emailOrPhone: '+1234567890' };
      const updatedNotification = { ...mockOneOffNotification, ...updateData };

      mockBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedNotification);

      await service.updateOneOffNotification('123', updateData);

      expect(mockBackend.persistOneOffNotificationUpdate).toHaveBeenCalledWith('123', updateData);
    });

    it('should not validate if emailOrPhone is not in update data', async () => {
      const updateData = { title: 'New Title' };
      const updatedNotification = { ...mockOneOffNotification, ...updateData };

      mockBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedNotification);

      await service.updateOneOffNotification('123', updateData);

      expect(mockBackend.persistOneOffNotificationUpdate).toHaveBeenCalledWith('123', updateData);
    });

    it('should handle backend errors', async () => {
      const error = new Error('Backend error');
      mockBackend.persistOneOffNotificationUpdate.mockRejectedValue(error);

      await expect(service.updateOneOffNotification('123', { title: 'New' })).rejects.toThrow(
        'Backend error',
      );
    });
  });

  describe('getOneOffNotification', () => {
    it('should retrieve one-off notification by ID', async () => {
      mockBackend.getOneOffNotification.mockResolvedValue(mockOneOffNotification);

      const result = await service.getOneOffNotification('123');

      expect(mockBackend.getOneOffNotification).toHaveBeenCalledWith('123', false);
      expect(result).toEqual(mockOneOffNotification);
    });

    it('should retrieve one-off notification with forUpdate flag', async () => {
      mockBackend.getOneOffNotification.mockResolvedValue(mockOneOffNotification);

      const result = await service.getOneOffNotification('123', true);

      expect(mockBackend.getOneOffNotification).toHaveBeenCalledWith('123', true);
      expect(result).toEqual(mockOneOffNotification);
    });

    it('should return null if notification not found', async () => {
      mockBackend.getOneOffNotification.mockResolvedValue(null);

      const result = await service.getOneOffNotification('123');

      expect(result).toBeNull();
    });

    it('should handle backend errors', async () => {
      const error = new Error('Backend error');
      mockBackend.getOneOffNotification.mockRejectedValue(error);

      await expect(service.getOneOffNotification('123')).rejects.toThrow('Backend error');
    });
  });

  describe('email validation', () => {
    it('should accept valid email addresses', async () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.co.uk',
        'user+tag@example.com',
        'test123@subdomain.example.com',
      ];

      for (const email of validEmails) {
        mockBackend.persistOneOffNotification.mockClear();

        const input: typeof mockOneOffNotificationInput = {
          ...mockOneOffNotificationInput,
          emailOrPhone: email,
        };
        const notification = { ...mockOneOffNotification, emailOrPhone: email };
        mockBackend.persistOneOffNotification.mockResolvedValue(notification);

        await expect(service.createOneOffNotification(input)).resolves.toBeDefined();
      }
    });

    it('should accept valid phone numbers', async () => {
      const validPhones = ['+12345678901', '+1234567890', '1234567890', '+123456789012345'];

      for (const phone of validPhones) {
        mockBackend.persistOneOffNotification.mockClear();

        const input: typeof mockOneOffNotificationInput = {
          ...mockOneOffNotificationInput,
          emailOrPhone: phone,
        };
        const notification = { ...mockOneOffNotification, emailOrPhone: phone };
        mockBackend.persistOneOffNotification.mockResolvedValue(notification);

        await expect(service.createOneOffNotification(input)).resolves.toBeDefined();
      }
    });

    it('should reject invalid formats', async () => {
      const invalidFormats = [
        'not-an-email-or-phone',
        '123',
        'test',
        '@example.com',
        '+12345', // too short
      ];

      for (const invalid of invalidFormats) {
        // Reset mock completely to remove previous mockResolvedValue
        mockBackend.persistOneOffNotification.mockReset();

        const input: typeof mockOneOffNotificationInput = {
          ...mockOneOffNotificationInput,
          emailOrPhone: invalid,
        };

        await expect(service.createOneOffNotification(input)).rejects.toThrow(
          'Invalid email or phone format',
        );

        // Verify backend was never called due to validation failure
        expect(mockBackend.persistOneOffNotification).not.toHaveBeenCalled();
      }
    });
  });

  describe('integration with send pipeline', () => {
    it('should generate context when sending one-off notification', async () => {
      mockBackend.persistOneOffNotification.mockResolvedValue(mockOneOffNotification);

      await service.createOneOffNotification(mockOneOffNotificationInput);

      expect(notificationContextgenerators.testContext.generate).toHaveBeenCalledWith({});
      expect(mockAdapter.send).toHaveBeenCalledWith(mockOneOffNotification, { test: 'context' });
    });

    it('should mark as sent after successful send', async () => {
      mockBackend.persistOneOffNotification.mockResolvedValue(mockOneOffNotification);

      await service.createOneOffNotification(mockOneOffNotificationInput);

      expect(mockBackend.markAsSent).toHaveBeenCalledWith('123', true);
    });

    it('should store context after successful send', async () => {
      mockBackend.persistOneOffNotification.mockResolvedValue(mockOneOffNotification);

      await service.createOneOffNotification(mockOneOffNotificationInput);

      expect(mockBackend.storeContextUsed).toHaveBeenCalledWith('123', { test: 'context' });
    });

    it('should mark as failed if send fails', async () => {
      const sendError = new Error('Send failed');
      mockAdapter.send.mockRejectedValue(sendError);
      mockBackend.persistOneOffNotification.mockResolvedValue(mockOneOffNotification);

      await service.createOneOffNotification(mockOneOffNotificationInput);

      expect(mockBackend.markAsFailed).toHaveBeenCalledWith('123', true);
    });
  });
});
