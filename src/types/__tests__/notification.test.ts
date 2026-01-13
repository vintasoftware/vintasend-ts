import type {
  NotificationInput,
  NotificationResendWithContextInput,
  DatabaseNotification,
} from '../notification';
import type { BaseNotificationTypeConfig } from '../notification-type-config';
import type { NotificationAttachment, StoredAttachment } from '../attachment';

// Mock configuration for testing
type MockContextMap = {
  testContext: {
    generate: (params: { userId: number; message: string }) => Promise<{ result: string }>;
  };
};

type MockConfig = BaseNotificationTypeConfig & {
  NotificationIdType: number;
  UserIdType: number;
  ContextMap: MockContextMap;
};

describe('Notification Types with Attachments', () => {
  describe('NotificationInput', () => {
    it('should allow creating notification without attachments', () => {
      const notification: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        extraParams: null,
      };

      expect(notification).toBeDefined();
      expect(notification.attachments).toBeUndefined();
    });

    it('should allow creating notification with inline file attachments', () => {
      const notification: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        extraParams: null,
        attachments: [
          {
            file: Buffer.from('test content'),
            filename: 'test.txt',
            contentType: 'text/plain',
            description: 'Test file',
          },
        ],
      };

      expect(notification.attachments).toBeDefined();
      expect(notification.attachments).toHaveLength(1);
      expect(notification.attachments?.[0]).toHaveProperty('file');
      expect(notification.attachments?.[0]).toHaveProperty('filename', 'test.txt');
    });

    it('should allow creating notification with file references', () => {
      const notification: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        extraParams: null,
        attachments: [
          {
            fileId: 'file-123',
            description: 'Referenced file',
          },
        ],
      };

      expect(notification.attachments).toBeDefined();
      expect(notification.attachments).toHaveLength(1);
      expect(notification.attachments?.[0]).toHaveProperty('fileId', 'file-123');
    });

    it('should allow mixing inline uploads and references', () => {
      const notification: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        extraParams: null,
        attachments: [
          {
            file: Buffer.from('test content'),
            filename: 'test.txt',
          },
          {
            fileId: 'file-123',
          },
        ],
      };

      expect(notification.attachments).toHaveLength(2);
    });
  });

  describe('NotificationResendWithContextInput', () => {
    it('should allow creating notification without attachments', () => {
      const notification: NotificationResendWithContextInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        contextUsed: { result: 'processed' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        extraParams: null,
      };

      expect(notification).toBeDefined();
      expect(notification.attachments).toBeUndefined();
    });

    it('should allow creating notification with attachments', () => {
      const notification: NotificationResendWithContextInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        contextUsed: { result: 'processed' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        extraParams: null,
        attachments: [
          {
            fileId: 'file-123',
          },
        ],
      };

      expect(notification.attachments).toBeDefined();
      expect(notification.attachments).toHaveLength(1);
    });
  });

  describe('DatabaseNotification', () => {
    it('should allow database notification without attachments', () => {
      const notification: DatabaseNotification<MockConfig> = {
        id: 1,
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        status: 'PENDING_SEND',
        contextUsed: { result: 'processed' },
        extraParams: {},
        adapterUsed: 'nodemailer',
        sentAt: null,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(notification).toBeDefined();
      expect(notification.attachments).toBeUndefined();
    });

    it('should allow database notification with stored attachments', () => {
      const mockAttachmentFile = {
        read: async () => Buffer.from('test'),
        stream: async () => new ReadableStream(),
        url: async () => 'https://example.com/file',
        delete: async () => {},
      };

      const notification: DatabaseNotification<MockConfig> = {
        id: 1,
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        status: 'PENDING_SEND',
        contextUsed: { result: 'processed' },
        extraParams: {},
        adapterUsed: 'nodemailer',
        sentAt: null,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: [
          {
            id: 'att-1',
            fileId: 'file-123',
            filename: 'test.txt',
            contentType: 'text/plain',
            size: 100,
            checksum: 'abc123',
            createdAt: new Date(),
            file: mockAttachmentFile,
            description: 'Test file',
            storageMetadata: { key: 'attachments/file-123.txt' },
          },
        ],
      };

      expect(notification.attachments).toBeDefined();
      expect(notification.attachments).toHaveLength(1);
      expect(notification.attachments?.[0]).toHaveProperty('id', 'att-1');
      expect(notification.attachments?.[0]).toHaveProperty('fileId', 'file-123');
      expect(notification.attachments?.[0]).toHaveProperty('file');
      expect(notification.attachments?.[0].file).toHaveProperty('read');
      expect(notification.attachments?.[0].file).toHaveProperty('url');
    });

    it('should allow multiple stored attachments', () => {
      const mockAttachmentFile = {
        read: async () => Buffer.from('test'),
        stream: async () => new ReadableStream(),
        url: async () => 'https://example.com/file',
        delete: async () => {},
      };

      const notification: DatabaseNotification<MockConfig> = {
        id: 1,
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test Notification',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: 'Test Subject',
        status: 'PENDING_SEND',
        contextUsed: { result: 'processed' },
        extraParams: {},
        adapterUsed: 'nodemailer',
        sentAt: null,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: [
          {
            id: 'att-1',
            fileId: 'file-123',
            filename: 'test.txt',
            contentType: 'text/plain',
            size: 100,
            checksum: 'abc123',
            createdAt: new Date(),
            file: mockAttachmentFile,
            storageMetadata: {},
          },
          {
            id: 'att-2',
            fileId: 'file-456',
            filename: 'document.pdf',
            contentType: 'application/pdf',
            size: 5000,
            checksum: 'def456',
            createdAt: new Date(),
            file: mockAttachmentFile,
            storageMetadata: {},
          },
        ],
      };

      expect(notification.attachments).toHaveLength(2);
    });
  });

  describe('Type inference', () => {
    it('should infer attachment types correctly for NotificationInput', () => {
      const notification: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'Body',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
        attachments: [
          {
            file: Buffer.from('test'),
            filename: 'test.txt',
          },
        ],
      };

      // Type should be inferred as NotificationAttachment[]
      const attachments: NotificationAttachment[] | undefined = notification.attachments;
      expect(attachments).toBeDefined();
    });

    it('should infer stored attachment types correctly for DatabaseNotification', () => {
      const mockFile = {
        read: async () => Buffer.from('test'),
        stream: async () => new ReadableStream(),
        url: async () => 'https://example.com/file',
        delete: async () => {},
      };

      const notification: DatabaseNotification<MockConfig> = {
        id: 1,
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'Body',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'PENDING_SEND',
        contextUsed: null,
        extraParams: {},
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        attachments: [
          {
            id: 'att-1',
            fileId: 'file-123',
            filename: 'test.txt',
            contentType: 'text/plain',
            size: 100,
            checksum: 'abc',
            createdAt: new Date(),
            file: mockFile,
            storageMetadata: {},
          },
        ],
      };

      // Type should be inferred as StoredAttachment[]
      const attachments: StoredAttachment[] | undefined = notification.attachments;
      expect(attachments).toBeDefined();
    });
  });

  describe('TypeScript compilation', () => {
    it('should compile with attachments being optional', () => {
      // This test verifies that TypeScript allows omitting attachments
      const withAttachments: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'Body',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
        attachments: [],
      };

      const withoutAttachments: NotificationInput<MockConfig> = {
        userId: 1,
        notificationType: 'EMAIL',
        title: 'Test',
        bodyTemplate: 'Body',
        contextName: 'testContext',
        contextParameters: { userId: 1, message: 'test' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      expect(withAttachments).toBeDefined();
      expect(withoutAttachments).toBeDefined();
    });
  });
});
