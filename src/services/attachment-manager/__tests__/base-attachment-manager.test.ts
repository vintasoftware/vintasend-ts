import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AttachmentFile,
  AttachmentFileRecord,
  FileAttachment,
  NotificationAttachment,
} from '../../../types/attachment';
import { BaseAttachmentManager } from '../base-attachment-manager';

// Mock implementation for testing
class TestAttachmentManager extends BaseAttachmentManager {
  private files = new Map<string, AttachmentFileRecord>();
  private fileContents = new Map<string, Buffer>();

  async uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord> {
    const buffer = await this.fileToBuffer(file);
    const checksum = this.calculateChecksum(buffer);
    const detectedContentType = contentType || this.detectContentType(filename);

    const fileRecord: AttachmentFileRecord = {
      id: `file-${Date.now()}-${Math.random()}`,
      filename,
      contentType: detectedContentType,
      size: buffer.length,
      checksum,
      storageMetadata: { key: `test/${filename}` },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.files.set(fileRecord.id, fileRecord);
    this.fileContents.set(fileRecord.id, buffer);

    return fileRecord;
  }

  async getFile(fileId: string): Promise<AttachmentFileRecord | null> {
    return this.files.get(fileId) || null;
  }

  async deleteFile(fileId: string): Promise<void> {
    this.files.delete(fileId);
    this.fileContents.delete(fileId);
  }

  reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile {
    return {
      read: async () => Buffer.from('test content'),
      stream: async () => new ReadableStream(),
      url: async () => 'https://example.com/file.txt',
      delete: async () => {},
    };
  }

  async findFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    for (const file of this.files.values()) {
      if (file.checksum === checksum) {
        return file;
      }
    }
    return null;
  }

  // Expose protected methods for testing
  public testDetectContentType(filename: string): string {
    return this.detectContentType(filename);
  }

  public testCalculateChecksum(data: Buffer): string {
    return this.calculateChecksum(data);
  }

  public testFileToBuffer(file: FileAttachment): Promise<Buffer> {
    return this.fileToBuffer(file);
  }
}

describe('BaseAttachmentManager', () => {
  let manager: TestAttachmentManager;

  beforeEach(() => {
    manager = new TestAttachmentManager();
  });

  describe('Helper Methods', () => {
    describe('detectContentType', () => {
      it('should detect content type from filename', () => {
        expect(manager.testDetectContentType('test.txt')).toBe('text/plain');
        expect(manager.testDetectContentType('image.png')).toBe('image/png');
        expect(manager.testDetectContentType('document.pdf')).toBe('application/pdf');
        expect(manager.testDetectContentType('data.json')).toBe('application/json');
      });

      it('should return default content type for unknown extensions', () => {
        expect(manager.testDetectContentType('file.unknown')).toBe('application/octet-stream');
      });

      it('should handle files without extensions', () => {
        expect(manager.testDetectContentType('README')).toBe('application/octet-stream');
      });
    });

    describe('calculateChecksum', () => {
      it('should calculate SHA-256 checksum', () => {
        const data = Buffer.from('test content');
        const checksum = manager.testCalculateChecksum(data);

        // Verify it's a valid hex string of correct length (64 chars for SHA-256)
        expect(checksum).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should produce consistent checksums for same content', () => {
        const data = Buffer.from('test content');
        const checksum1 = manager.testCalculateChecksum(data);
        const checksum2 = manager.testCalculateChecksum(data);

        expect(checksum1).toBe(checksum2);
      });

      it('should produce different checksums for different content', () => {
        const data1 = Buffer.from('content 1');
        const data2 = Buffer.from('content 2');
        const checksum1 = manager.testCalculateChecksum(data1);
        const checksum2 = manager.testCalculateChecksum(data2);

        expect(checksum1).not.toBe(checksum2);
      });
    });

    describe('fileToBuffer', () => {
      it('should handle Buffer input', async () => {
        const input = Buffer.from('test content');
        const result = await manager.testFileToBuffer(input);

        expect(result).toEqual(input);
      });

      it('should handle ReadableStream input', async () => {
        const content = 'test content';
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(content));
            controller.close();
          },
        });

        const result = await manager.testFileToBuffer(stream);
        expect(result.toString()).toBe(content);
      });

      it('should handle file path input', async () => {
        // Create a temporary file
        const tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
        const tempFile = path.join(tempDir, 'test.txt');
        const content = 'test content from file';
        await fs.writeFile(tempFile, content);

        try {
          const result = await manager.testFileToBuffer(tempFile);
          expect(result.toString()).toBe(content);
        } finally {
          // Cleanup
          await fs.unlink(tempFile);
          await fs.rmdir(tempDir);
        }
      });

      it('should throw error for unsupported file types', async () => {
        // @ts-expect-error - Testing invalid input
        await expect(manager.testFileToBuffer(123)).rejects.toThrow('Unsupported file type');
      });
    });
  });

  describe('processAttachments', () => {
    it('should process upload attachments', async () => {
      const attachments: NotificationAttachment[] = [
        {
          file: Buffer.from('content 1'),
          filename: 'file1.txt',
          contentType: 'text/plain',
        },
        {
          file: Buffer.from('content 2'),
          filename: 'file2.txt',
        },
      ];

      const result = await manager.processAttachments(attachments, 'notification-123');

      expect(result.fileRecords).toHaveLength(2);
      expect(result.attachmentData).toHaveLength(2);
      expect(result.fileRecords[0].filename).toBe('file1.txt');
      expect(result.fileRecords[1].filename).toBe('file2.txt');
    });

    it('should process reference attachments', async () => {
      // First upload a file
      const uploadedFile = await manager.uploadFile(Buffer.from('test content'), 'test.txt');

      // Now reference it
      const attachments: NotificationAttachment[] = [
        {
          fileId: uploadedFile.id,
          description: 'Referenced file',
        },
      ];

      const result = await manager.processAttachments(attachments, 'notification-123');

      expect(result.fileRecords).toHaveLength(1);
      expect(result.fileRecords[0].id).toBe(uploadedFile.id);
      expect(result.attachmentData[0].description).toBe('Referenced file');
    });

    it('should handle mixed upload and reference attachments', async () => {
      // First upload a file
      const uploadedFile = await manager.uploadFile(
        Buffer.from('existing content'),
        'existing.txt',
      );

      // Mix of upload and reference
      const attachments: NotificationAttachment[] = [
        {
          file: Buffer.from('new content'),
          filename: 'new.txt',
        },
        {
          fileId: uploadedFile.id,
        },
      ];

      const result = await manager.processAttachments(attachments, 'notification-123');

      expect(result.fileRecords).toHaveLength(2);
      expect(result.fileRecords[0].filename).toBe('new.txt');
      expect(result.fileRecords[1].id).toBe(uploadedFile.id);
    });

    it('should throw error for non-existent file reference', async () => {
      const attachments: NotificationAttachment[] = [
        {
          fileId: 'non-existent-id',
        },
      ];

      await expect(manager.processAttachments(attachments, 'notification-123')).rejects.toThrow(
        'Referenced file non-existent-id not found',
      );
    });

    it('should reuse files with same checksum', async () => {
      const content = Buffer.from('duplicate content');

      // First upload one file
      const firstUpload = await manager.uploadFile(content, 'file1.txt');

      // Now try to upload same content with different filename
      const attachments: NotificationAttachment[] = [
        {
          file: content,
          filename: 'file2.txt', // Different filename, same content
        },
      ];

      const result = await manager.processAttachments(attachments, 'notification-123');

      // Should reuse the first uploaded file (same checksum)
      expect(result.fileRecords[0].checksum).toBe(firstUpload.checksum);
      expect(result.fileRecords[0].id).toBe(firstUpload.id);
    });

    it('should include descriptions in attachment data', async () => {
      const attachments: NotificationAttachment[] = [
        {
          file: Buffer.from('content'),
          filename: 'file.txt',
          description: 'Upload with description',
        },
      ];

      const result = await manager.processAttachments(attachments, 'notification-123');

      expect(result.attachmentData[0].description).toBe('Upload with description');
    });
  });

  describe('uploadFile', () => {
    it('should upload file and return record', async () => {
      const content = Buffer.from('test content');
      const record = await manager.uploadFile(content, 'test.txt', 'text/plain');

      expect(record.id).toBeDefined();
      expect(record.filename).toBe('test.txt');
      expect(record.contentType).toBe('text/plain');
      expect(record.size).toBe(content.length);
      expect(record.checksum).toBeDefined();
      expect(record.storageMetadata).toBeDefined();
      expect(record.createdAt).toBeInstanceOf(Date);
      expect(record.updatedAt).toBeInstanceOf(Date);
    });

    it('should auto-detect content type if not provided', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.pdf');

      expect(record.contentType).toBe('application/pdf');
    });
  });

  describe('getFile', () => {
    it('should retrieve uploaded file', async () => {
      const uploaded = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      const retrieved = await manager.getFile(uploaded.id);

      expect(retrieved).toEqual(uploaded);
    });

    it('should return null for non-existent file', async () => {
      const result = await manager.getFile('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      const uploaded = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await manager.deleteFile(uploaded.id);

      const retrieved = await manager.getFile(uploaded.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('findFileByChecksum', () => {
    it('should find file by checksum', async () => {
      const content = Buffer.from('test content');
      const uploaded = await manager.uploadFile(content, 'test.txt');

      const found = await manager.findFileByChecksum(uploaded.checksum);
      expect(found).toEqual(uploaded);
    });

    it('should return null if checksum not found', async () => {
      const result = await manager.findFileByChecksum('non-existent-checksum');
      expect(result).toBeNull();
    });
  });

  describe('reconstructAttachmentFile', () => {
    it('should reconstruct AttachmentFile from metadata', () => {
      const metadata = { key: 'test/file.txt' };
      const file = manager.reconstructAttachmentFile(metadata);

      expect(file).toBeDefined();
      expect(file.read).toBeDefined();
      expect(file.stream).toBeDefined();
      expect(file.url).toBeDefined();
      expect(file.delete).toBeDefined();
    });
  });
});
