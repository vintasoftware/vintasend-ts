import type { BaseLogger } from 'vintasend';
import { NotificationBackend } from '../backend';

describe('NotificationBackend', () => {
  let backend: NotificationBackend<any>;

  beforeEach(() => {
    backend = new NotificationBackend();
  });

  describe('getBackendIdentifier', () => {
    it('should return the backend identifier', () => {
      expect(backend.getBackendIdentifier?.()).toBe('vintasend-implementation-template');
    });
  });

  describe('getAllPendingNotifications', () => {
    it('should fetch all pending notifications', async () => {
      // TODO: Replace with mocked data source assertions once implemented.
      await expect(backend.getAllPendingNotifications()).rejects.toThrow('Method not implemented.');
    });
  });

  describe('persistNotification', () => {
    it('should create a new notification', async () => {
      const input = {
        userId: 'user-1',
        notificationType: 'EMAIL',
        bodyTemplate: 'Hello {{name}}',
        contextName: 'welcomeContext',
        contextParameters: { name: 'Vinta' },
        title: 'Welcome',
        subjectTemplate: 'Welcome subject',
        extraParams: { source: 'test' },
        sendAfter: null,
      };

      // TODO: When implemented, assert persistence payload and mapped result.
      await expect(backend.persistNotification(input as any)).rejects.toThrow(
        'Method not implemented.',
      );
    });
  });

  describe('markAsSent', () => {
    it('should mark a notification as sent', async () => {
      // TODO: When implemented, assert updated status and sentAt timestamp.
      await expect(backend.markAsSent('notification-1', true)).rejects.toThrow(
        'Method not implemented.',
      );
    });
  });

  describe('getNotification', () => {
    it('should fetch a notification by id', async () => {
      // TODO: When implemented, assert lookup by ID and return type.
      await expect(backend.getNotification('notification-1', false)).rejects.toThrow(
        'Method not implemented.',
      );
    });
  });

  describe('filterNotifications', () => {
    it('should filter notifications with pagination and optional order', async () => {
      const filter = {
        status: { in: ['PENDING_SEND'] },
      };

      // TODO: Check filter translation assertions for your data source.
      await expect(backend.filterNotifications(filter as any, 1, 20)).rejects.toThrow(
        'Method not implemented.',
      );
    });
  });

  describe('attachments', () => {
    it('should find attachment file by checksum', async () => {
      await expect(backend.findAttachmentFileByChecksum('checksum-1')).rejects.toThrow(
        'Method not implemented.',
      );
    });

    it('should retrieve attachments from a notification', async () => {
      await expect(backend.getAttachments('notification-1')).rejects.toThrow(
        'Method not implemented.',
      );
    });

    it('should delete a notification attachment', async () => {
      await expect(
        backend.deleteNotificationAttachment!('notification-1', 'attachment-1'),
      ).rejects.toThrow('Method not implemented.');
    });
  });

  describe('injectLogger', () => {
    it('should accept a logger instance', () => {
      const logger = {} as BaseLogger;

      expect(() => backend.injectLogger(logger)).not.toThrow();
    });
  });
});
