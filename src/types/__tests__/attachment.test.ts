import {
  type AttachmentFile,
  type AttachmentFileRecord,
  type StorageIdentifiers,
  isAttachmentReference,
  type NotificationAttachment,
  type NotificationAttachmentReference,
  type NotificationAttachmentUpload,
} from '../attachment';

describe('Attachment Type Definitions', () => {
  describe('Type Guards', () => {
    describe('isAttachmentReference', () => {
      it('should return true for NotificationAttachmentReference', () => {
        const attachment: NotificationAttachmentReference = {
          fileId: 'file-123',
          description: 'Test file',
        };

        expect(isAttachmentReference(attachment)).toBe(true);
      });

      it('should return false for NotificationAttachmentUpload', () => {
        const attachment: NotificationAttachmentUpload = {
          file: Buffer.from('test'),
          filename: 'test.txt',
          contentType: 'text/plain',
        };

        expect(isAttachmentReference(attachment)).toBe(false);
      });

      it('should work with union type', () => {
        const reference: NotificationAttachment = {
          fileId: 'file-123',
        };

        const upload: NotificationAttachment = {
          file: Buffer.from('test'),
          filename: 'test.txt',
        };

        expect(isAttachmentReference(reference)).toBe(true);
        expect(isAttachmentReference(upload)).toBe(false);
      });
    });
  });

  describe('Type Compilation', () => {
    it('should compile FileAttachment types correctly', () => {
      const buffer: Buffer = Buffer.from('test');
      const stream: ReadableStream = new ReadableStream();
      const path = '/path/to/file.txt';

      // These should all be valid FileAttachment types
      const attachments = [buffer, stream, path];
      expect(attachments.length).toBe(3);
    });

    it('should compile NotificationAttachmentUpload correctly', () => {
      const upload: NotificationAttachmentUpload = {
        file: Buffer.from('test'),
        filename: 'test.txt',
      };

      expect(upload.filename).toBe('test.txt');
    });

    it('should compile NotificationAttachmentUpload with optional fields', () => {
      const upload: NotificationAttachmentUpload = {
        file: Buffer.from('test'),
        filename: 'test.txt',
        contentType: 'text/plain',
        description: 'A test file',
      };

      expect(upload.contentType).toBe('text/plain');
      expect(upload.description).toBe('A test file');
    });

    it('should compile NotificationAttachmentReference correctly', () => {
      const reference: NotificationAttachmentReference = {
        fileId: 'file-123',
      };

      expect(reference.fileId).toBe('file-123');
    });

    it('should compile NotificationAttachmentReference with description', () => {
      const reference: NotificationAttachmentReference = {
        fileId: 'file-123',
        description: 'Reference description',
      };

      expect(reference.description).toBe('Reference description');
    });

    it('should compile AttachmentFile interface correctly', () => {
      const file: AttachmentFile = {
        read: async () => Buffer.from('test'),
        stream: async () => new ReadableStream(),
        url: async (_expiresIn?: number) => 'https://example.com/file.txt',
        delete: async () => {},
      };

      expect(file).toBeDefined();
      expect(file.read).toBeDefined();
      expect(file.stream).toBeDefined();
      expect(file.url).toBeDefined();
      expect(file.delete).toBeDefined();
    });
  });

  describe('Type Inference', () => {
    it('should properly narrow types with type guard for reference', () => {
      const attachment: NotificationAttachment = {
        fileId: 'file-123',
      };

      if (isAttachmentReference(attachment)) {
        // TypeScript should know this is NotificationAttachmentReference
        expect(attachment.fileId).toBe('file-123');
        // @ts-expect-error - file property should not exist on reference
        const _file = attachment.file;
      }
    });

    it('should properly narrow types with type guard for upload', () => {
      const attachment: NotificationAttachment = {
        file: Buffer.from('test'),
        filename: 'test.txt',
      };

      if (!isAttachmentReference(attachment)) {
        // TypeScript should know this is NotificationAttachmentUpload
        expect(attachment.filename).toBe('test.txt');
        // @ts-expect-error - fileId property should not exist on upload
        const _fileId = attachment.fileId;
      }
    });
  });

  describe('StorageIdentifiers', () => {
    it('should allow id field', () => {
      const ids: StorageIdentifiers = { id: 'test-123' };
      expect(ids.id).toBe('test-123');
    });

    it('should allow arbitrary fields', () => {
      const ids: StorageIdentifiers = {
        id: 'test-123',
        customField: 'value',
        anotherField: 42,
        nestedObject: { key: 'val' },
      };
      expect(ids.customField).toBe('value');
      expect(ids.anotherField).toBe(42);
      expect((ids.nestedObject as any).key).toBe('val');
    });

    it('should be extensible by implementation-specific types', () => {
      interface CustomIdentifiers extends StorageIdentifiers {
        id: string;
        customManagerField: string;
      }

      const ids: CustomIdentifiers = {
        id: 'test-123',
        customManagerField: 'custom-value',
      };

      expect(ids.id).toBe('test-123');
      expect(ids.customManagerField).toBe('custom-value');
    });
  });

  describe('AttachmentFileRecord', () => {
    it('should have all required fields', () => {
      const now = new Date();
      const record: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        checksum: 'abc123def456',
        createdAt: now,
        updatedAt: now,
        storageIdentifiers: { id: 'file-123' },
      };

      expect(record.id).toBe('file-123');
      expect(record.filename).toBe('test.pdf');
      expect(record.contentType).toBe('application/pdf');
      expect(record.size).toBe(1024);
      expect(record.checksum).toBe('abc123def456');
      expect(record.createdAt).toBe(now);
      expect(record.updatedAt).toBe(now);
    });

    it('should have storageIdentifiers property', () => {
      const record: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 100,
        checksum: 'abc123',
        createdAt: new Date(),
        updatedAt: new Date(),
        storageIdentifiers: { id: 'file-123' },
      };

      expect(record.storageIdentifiers).toHaveProperty('id');
      expect(record.storageIdentifiers.id).toBe('file-123');
    });

    it('should accept implementation-specific storageIdentifiers', () => {
      interface CustomIds extends StorageIdentifiers {
        id: string;
        bucket: string;
        key: string;
      }

      const customIds: CustomIds = {
        id: 'file-123',
        bucket: 'my-bucket',
        key: 'path/to/file.pdf',
      };

      const record: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'file.pdf',
        contentType: 'application/pdf',
        size: 2048,
        checksum: 'xyz789',
        createdAt: new Date(),
        updatedAt: new Date(),
        storageIdentifiers: customIds,
      };

      expect(record.storageIdentifiers).toEqual(customIds);
      expect((record.storageIdentifiers as CustomIds).bucket).toBe('my-bucket');
    });

    it('should accept dates as Date objects', () => {
      const createdAt = new Date('2026-02-04T10:00:00Z');
      const updatedAt = new Date('2026-02-04T11:00:00Z');

      const record: AttachmentFileRecord = {
        id: 'file-123',
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 100,
        checksum: 'abc123',
        createdAt,
        updatedAt,
        storageIdentifiers: { id: 'file-123' },
      };

      expect(record.createdAt instanceof Date).toBe(true);
      expect(record.updatedAt instanceof Date).toBe(true);
      expect(record.createdAt.getTime()).toBe(createdAt.getTime());
    });
  });
});

