import {
  type AttachmentFile,
  type NotificationAttachment,
  type NotificationAttachmentReference,
  type NotificationAttachmentUpload,
  isAttachmentReference,
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
        url: async (expiresIn?: number) => 'https://example.com/file.txt',
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
});
