import type { AnyDatabaseNotification } from '../notification';
import type { NotificationStatus } from '../notification-status';
import type { NotificationType } from '../notification-type';
import type {
  DatabaseOneOffNotification,
  OneOffNotification,
  OneOffNotificationInput,
  OneOffNotificationResendWithContextInput,
} from '../one-off-notification';

// Test configuration
type TestContextMap = {
  welcomeContext: {
    generate: (params: { companyName: string }) => Promise<{ greeting: string }>;
  };
  reminderContext: {
    generate: (params: { taskName: string; dueDate: string }) => { task: string; due: string };
  };
};

type TestConfig = {
  ContextMap: TestContextMap;
  NotificationIdType: string;
  UserIdType: string;
};

describe('OneOffNotification Types', () => {
  describe('OneOffNotificationInput', () => {
    it('should accept valid one-off notification input', () => {
      const input: OneOffNotificationInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Welcome',
        bodyTemplate: '/templates/welcome.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Acme Corp' },
        sendAfter: null,
        subjectTemplate: 'Welcome to {{companyName}}',
        extraParams: null,
      };

      expect(input.emailOrPhone).toBe('test@example.com');
      expect(input.firstName).toBe('John');
      expect(input.lastName).toBe('Doe');
    });

    it('should correctly infer context parameters based on contextName', () => {
      // This should compile - correct parameters for welcomeContext
      const validInput: OneOffNotificationInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Welcome',
        bodyTemplate: '/templates/welcome.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Tech Inc' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      // Type assertion for accessing contextParameters after narrowing contextName
      expect((validInput.contextParameters as { companyName: string }).companyName).toBe(
        'Tech Inc',
      );
    });

    it('should accept phone numbers as emailOrPhone', () => {
      const input: OneOffNotificationInput<TestConfig> = {
        emailOrPhone: '+1234567890',
        firstName: 'Bob',
        lastName: 'Johnson',
        notificationType: 'SMS' as NotificationType,
        title: 'Reminder',
        bodyTemplate: '/templates/sms-reminder.txt',
        contextName: 'reminderContext',
        contextParameters: { taskName: 'Meeting', dueDate: '2024-01-01' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      expect(input.emailOrPhone).toBe('+1234567890');
    });

    it('should accept sendAfter as Date', () => {
      const futureDate = new Date('2025-12-31');
      const input: OneOffNotificationInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Alice',
        lastName: 'Williams',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Scheduled',
        bodyTemplate: '/templates/scheduled.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Future Co' },
        sendAfter: futureDate,
        subjectTemplate: null,
        extraParams: null,
      };

      expect(input.sendAfter).toBe(futureDate);
    });

    it('should accept extraParams as JSON-like objects', () => {
      const input: OneOffNotificationInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Charlie',
        lastName: 'Brown',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Custom',
        bodyTemplate: '/templates/custom.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Custom Corp' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: { priority: 'high', tags: ['urgent', 'important'] },
      };

      expect(input.extraParams).toEqual({ priority: 'high', tags: ['urgent', 'important'] });
    });
  });

  describe('OneOffNotificationResendWithContextInput', () => {
    it('should include contextUsed field', () => {
      const input: OneOffNotificationResendWithContextInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'David',
        lastName: 'Miller',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Resend',
        bodyTemplate: '/templates/resend.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Resend Inc' },
        // @ts-expect-error - contextUsed should match welcomeContext return type
        contextUsed: { greeting: 'Hello from Resend Inc!' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      expect(input.contextUsed).toEqual({ greeting: 'Hello from Resend Inc!' });
    });

    it('should correctly infer contextUsed type based on context generator return type', () => {
      // welcomeContext returns Promise<{ greeting: string }>
      const asyncContextInput: OneOffNotificationResendWithContextInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Eve',
        lastName: 'Davis',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Async',
        bodyTemplate: '/templates/async.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Async Corp' },
        // @ts-expect-error - contextUsed should match welcomeContext return type
        contextUsed: { greeting: 'Async greeting' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      // The actual type is a union, so we need to check it exists
      expect(asyncContextInput.contextUsed).toBeDefined();

      // reminderContext returns { task: string; due: string } (synchronous)
      const syncContextInput: OneOffNotificationResendWithContextInput<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Frank',
        lastName: 'Wilson',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Sync',
        bodyTemplate: '/templates/sync.pug',
        contextName: 'reminderContext',
        contextParameters: { taskName: 'Task', dueDate: '2024-01-01' },
        contextUsed: { task: 'Task', due: '2024-01-01' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      expect(syncContextInput.contextUsed).toEqual({ task: 'Task', due: '2024-01-01' });
    });
  });

  describe('DatabaseOneOffNotification', () => {
    it('should include all database fields', () => {
      const dbNotification: DatabaseOneOffNotification<TestConfig> = {
        id: 'notif-123',
        emailOrPhone: 'test@example.com',
        firstName: 'Grace',
        lastName: 'Taylor',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Database',
        bodyTemplate: '/templates/db.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'DB Corp' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'PENDING_SEND' as NotificationStatus,
        contextUsed: null,
        extraParams: {},
        adapterUsed: null,
        sentAt: null,
        readAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(dbNotification.id).toBe('notif-123');
      expect(dbNotification.status).toBe('PENDING_SEND');
    });

    it('should accept different notification statuses', () => {
      const statuses: NotificationStatus[] = [
        'PENDING_SEND',
        'SENT',
        'FAILED',
        'READ',
        'CANCELLED',
      ];

      for (const status of statuses) {
        const notification: DatabaseOneOffNotification<TestConfig> = {
          id: `notif-${status}`,
          emailOrPhone: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Status Test',
          bodyTemplate: '/templates/test.pug',
          contextName: 'welcomeContext',
          contextParameters: { companyName: 'Test Corp' },
          sendAfter: null,
          subjectTemplate: null,
          status,
          contextUsed: null,
          extraParams: {},
          adapterUsed: null,
          sentAt: status === 'SENT' ? new Date() : null,
          readAt: status === 'READ' ? new Date() : null,
        };

        expect(notification.status).toBe(status);
      }
    });

    it('should accept contextUsed when notification has been processed', () => {
      const notification: DatabaseOneOffNotification<TestConfig> = {
        id: 'notif-456',
        emailOrPhone: 'test@example.com',
        firstName: 'Henry',
        lastName: 'Anderson',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Processed',
        bodyTemplate: '/templates/processed.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Processed Inc' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'SENT' as NotificationStatus,
        // @ts-expect-error - contextUsed should match welcomeContext return type
        contextUsed: { greeting: 'Hello from Processed Inc!' },
        extraParams: {},
        adapterUsed: 'nodemailer-adapter',
        sentAt: new Date(),
        readAt: null,
      };

      expect(notification.contextUsed).toEqual({ greeting: 'Hello from Processed Inc!' });
      expect(notification.adapterUsed).toBe('nodemailer-adapter');
    });
  });

  describe('OneOffNotification Union Type', () => {
    it('should accept any one-off notification variant', () => {
      const input: OneOffNotification<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Input',
        lastName: 'User',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Input',
        bodyTemplate: '/templates/input.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Input Corp' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      const resend: OneOffNotification<TestConfig> = {
        emailOrPhone: 'test@example.com',
        firstName: 'Resend',
        lastName: 'User',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Resend',
        bodyTemplate: '/templates/resend.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Resend Corp' },
        // @ts-expect-error - contextUsed should match welcomeContext return type
        contextUsed: { greeting: 'Resend greeting' },
        sendAfter: null,
        subjectTemplate: null,
        extraParams: null,
      };

      const database: OneOffNotification<TestConfig> = {
        id: 'notif-789',
        emailOrPhone: 'test@example.com',
        firstName: 'Database',
        lastName: 'User',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Database',
        bodyTemplate: '/templates/db.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'DB Corp' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'SENT' as NotificationStatus,
        // @ts-expect-error - contextUsed should match welcomeContext return type
        contextUsed: { greeting: 'DB greeting' },
        extraParams: {},
        adapterUsed: 'test-adapter',
        sentAt: new Date(),
        readAt: null,
      };

      expect(input.emailOrPhone).toBe('test@example.com');
      expect(resend.emailOrPhone).toBe('test@example.com');
      expect(database.emailOrPhone).toBe('test@example.com');
    });
  });

  describe('Union Types with Regular Notifications', () => {
    it('should allow AnyDatabaseNotification to accept both regular and one-off database notifications', () => {
      const oneOffDb: AnyDatabaseNotification<TestConfig> = {
        id: 'one-off-123',
        emailOrPhone: 'test@example.com',
        firstName: 'OneOff',
        lastName: 'User',
        notificationType: 'EMAIL' as NotificationType,
        title: 'OneOff',
        bodyTemplate: '/templates/oneoff.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'OneOff Corp' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'SENT' as NotificationStatus,
        contextUsed: null,
        extraParams: {},
        adapterUsed: null,
        sentAt: null,
        readAt: null,
      };

      const regularDb: AnyDatabaseNotification<TestConfig> = {
        id: 'regular-123',
        userId: 'user-456',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Regular',
        bodyTemplate: '/templates/regular.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Regular Corp' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'SENT' as NotificationStatus,
        contextUsed: null,
        extraParams: {},
        adapterUsed: null,
        sentAt: null,
        readAt: null,
      };

      expect(oneOffDb.id).toBe('one-off-123');
      expect(regularDb.id).toBe('regular-123');
    });

    it('should provide type guards for distinguishing notification types', () => {
      const isOneOffNotification = (
        notif: AnyDatabaseNotification<TestConfig>,
      ): notif is DatabaseOneOffNotification<TestConfig> => {
        return 'emailOrPhone' in notif;
      };

      const oneOffDb: AnyDatabaseNotification<TestConfig> = {
        id: 'one-off-123',
        emailOrPhone: 'test@example.com',
        firstName: 'OneOff',
        lastName: 'User',
        notificationType: 'EMAIL' as NotificationType,
        title: 'OneOff',
        bodyTemplate: '/templates/oneoff.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'OneOff Corp' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'SENT' as NotificationStatus,
        contextUsed: null,
        extraParams: {},
        adapterUsed: null,
        sentAt: null,
        readAt: null,
      };

      const regularDb: AnyDatabaseNotification<TestConfig> = {
        id: 'regular-123',
        userId: 'user-456',
        notificationType: 'EMAIL' as NotificationType,
        title: 'Regular',
        bodyTemplate: '/templates/regular.pug',
        contextName: 'welcomeContext',
        contextParameters: { companyName: 'Regular Corp' },
        sendAfter: null,
        subjectTemplate: null,
        status: 'SENT' as NotificationStatus,
        contextUsed: null,
        extraParams: {},
        adapterUsed: null,
        sentAt: null,
        readAt: null,
      };

      expect(isOneOffNotification(oneOffDb)).toBe(true);
      expect(isOneOffNotification(regularDb)).toBe(false);

      if (isOneOffNotification(oneOffDb)) {
        expect(oneOffDb.emailOrPhone).toBe('test@example.com');
        expect(oneOffDb.firstName).toBe('OneOff');
      }
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer contextParameters type based on contextName', () => {
      // This test verifies that TypeScript correctly narrows types
      const createNotification = <CN extends keyof TestContextMap>(
        contextName: CN,
        params: Parameters<TestContextMap[CN]['generate']>[0],
      ): OneOffNotificationInput<TestConfig> => {
        return {
          emailOrPhone: 'test@example.com',
          firstName: 'Inference',
          lastName: 'Test',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Type Inference',
          bodyTemplate: '/templates/inference.pug',
          contextName: contextName as string & keyof TestContextMap,
          contextParameters: params,
          sendAfter: null,
          subjectTemplate: null,
          extraParams: null,
        };
      };

      const welcomeNotif = createNotification('welcomeContext', { companyName: 'TypeScript Inc' });
      const reminderNotif = createNotification('reminderContext', {
        taskName: 'Test',
        dueDate: '2024-01-01',
      });

      expect(welcomeNotif.contextName).toBe('welcomeContext');
      expect(reminderNotif.contextName).toBe('reminderContext');
    });
  });

  describe('OneOffNotification with Attachments', () => {
    describe('OneOffNotificationInput with attachments', () => {
      it('should allow creating one-off notification without attachments', () => {
        const input: OneOffNotificationInput<TestConfig> = {
          emailOrPhone: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Welcome',
          bodyTemplate: '/templates/welcome.pug',
          contextName: 'welcomeContext',
          contextParameters: { companyName: 'Acme Corp' },
          sendAfter: null,
          subjectTemplate: 'Welcome',
          extraParams: null,
        };

        expect(input.attachments).toBeUndefined();
      });

      it('should allow creating one-off notification with inline file attachments', () => {
        const input: OneOffNotificationInput<TestConfig> = {
          emailOrPhone: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Welcome',
          bodyTemplate: '/templates/welcome.pug',
          contextName: 'welcomeContext',
          contextParameters: { companyName: 'Acme Corp' },
          sendAfter: null,
          subjectTemplate: 'Welcome',
          extraParams: null,
          attachments: [
            {
              file: Buffer.from('test content'),
              filename: 'welcome.pdf',
              contentType: 'application/pdf',
            },
          ],
        };

        expect(input.attachments).toBeDefined();
        expect(input.attachments).toHaveLength(1);
        expect(input.attachments?.[0]).toHaveProperty('file');
        expect(input.attachments?.[0]).toHaveProperty('filename', 'welcome.pdf');
      });

      it('should allow creating one-off notification with file references', () => {
        const input: OneOffNotificationInput<TestConfig> = {
          emailOrPhone: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Welcome',
          bodyTemplate: '/templates/welcome.pug',
          contextName: 'welcomeContext',
          contextParameters: { companyName: 'Acme Corp' },
          sendAfter: null,
          subjectTemplate: 'Welcome',
          extraParams: null,
          attachments: [
            {
              fileId: 'file-123',
              description: 'Company brochure',
            },
          ],
        };

        expect(input.attachments).toBeDefined();
        expect(input.attachments).toHaveLength(1);
        expect(input.attachments?.[0]).toHaveProperty('fileId', 'file-123');
      });
    });

    describe('DatabaseOneOffNotification with attachments', () => {
      it('should allow database one-off notification without attachments', () => {
        const notification: DatabaseOneOffNotification<TestConfig> = {
          id: '123',
          emailOrPhone: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Welcome',
          bodyTemplate: '/templates/welcome.pug',
          contextName: 'welcomeContext',
          contextParameters: { companyName: 'Acme Corp' },
          sendAfter: null,
          subjectTemplate: 'Welcome',
          status: 'PENDING' as NotificationStatus,
          // @ts-expect-error - contextUsed should match welcomeContext return type
          contextUsed: { greeting: 'Hello' },
          extraParams: {},
          adapterUsed: 'nodemailer',
          sentAt: null,
          readAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        expect(notification.attachments).toBeUndefined();
      });

      it('should allow database one-off notification with stored attachments', () => {
        const mockAttachmentFile = {
          read: async () => Buffer.from('test'),
          stream: async () => new ReadableStream(),
          url: async () => 'https://example.com/file',
          delete: async () => {},
        };

        const notification: DatabaseOneOffNotification<TestConfig> = {
          id: '123',
          emailOrPhone: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          notificationType: 'EMAIL' as NotificationType,
          title: 'Welcome',
          bodyTemplate: '/templates/welcome.pug',
          contextName: 'welcomeContext',
          contextParameters: { companyName: 'Acme Corp' },
          sendAfter: null,
          subjectTemplate: 'Welcome',
          status: 'PENDING' as NotificationStatus,
          // @ts-expect-error - contextUsed should match welcomeContext return type
          contextUsed: { greeting: 'Hello' },
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
              filename: 'brochure.pdf',
              contentType: 'application/pdf',
              size: 5000,
              checksum: 'abc123',
              createdAt: new Date(),
              file: mockAttachmentFile,
              description: 'Company brochure',
              storageMetadata: { key: 'attachments/file-123.pdf' },
            },
          ],
        };

        expect(notification.attachments).toBeDefined();
        expect(notification.attachments).toHaveLength(1);
        expect(notification.attachments?.[0]).toHaveProperty('id', 'att-1');
        expect(notification.attachments?.[0]).toHaveProperty('fileId', 'file-123');
        expect(notification.attachments?.[0].file).toHaveProperty('read');
      });
    });
  });
});
