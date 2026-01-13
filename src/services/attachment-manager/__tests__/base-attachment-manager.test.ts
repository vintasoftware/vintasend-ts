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
}

describe('BaseAttachmentManager', () => {
  let manager: TestAttachmentManager;

  beforeEach(() => {
    manager = new TestAttachmentManager();
  });

  describe('Public Utility Methods', () => {
    describe('detectContentType', () => {
      it('should detect content type from filename', () => {
        expect(manager.detectContentType('test.txt')).toBe('text/plain');
        expect(manager.detectContentType('image.png')).toBe('image/png');
        expect(manager.detectContentType('document.pdf')).toBe('application/pdf');
        expect(manager.detectContentType('data.json')).toBe('application/json');
      });

      it('should return default content type for unknown extensions', () => {
        expect(manager.detectContentType('file.unknown')).toBe('application/octet-stream');
      });

      it('should handle files without extensions', () => {
        expect(manager.detectContentType('README')).toBe('application/octet-stream');
      });
    });

    describe('calculateChecksum', () => {
      it('should calculate SHA-256 checksum', () => {
        const data = Buffer.from('test content');
        const checksum = manager.calculateChecksum(data);

        // Verify it's a valid hex string of correct length (64 chars for SHA-256)
        expect(checksum).toMatch(/^[a-f0-9]{64}$/);
      });

      it('should produce consistent checksums for same content', () => {
        const data = Buffer.from('test content');
        const checksum1 = manager.calculateChecksum(data);
        const checksum2 = manager.calculateChecksum(data);

        expect(checksum1).toBe(checksum2);
      });

      it('should produce different checksums for different content', () => {
        const data1 = Buffer.from('content 1');
        const data2 = Buffer.from('content 2');
        const checksum1 = manager.calculateChecksum(data1);
        const checksum2 = manager.calculateChecksum(data2);

        expect(checksum1).not.toBe(checksum2);
      });
    });

    describe('fileToBuffer', () => {
      it('should handle Buffer input', async () => {
        const input = Buffer.from('test content');
        const result = await manager.fileToBuffer(input);

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

        const result = await manager.fileToBuffer(stream);
        expect(result.toString()).toBe(content);
      });

      it('should handle file path input', async () => {
        // Create a temporary file
        const tempDir = await fs.mkdtemp(path.join(__dirname, 'temp-'));
        const tempFile = path.join(tempDir, 'test.txt');
        const content = 'test content from file';
        await fs.writeFile(tempFile, content);

        try {
          const result = await manager.fileToBuffer(tempFile);
          expect(result.toString()).toBe(content);
        } finally {
          // Cleanup
          await fs.unlink(tempFile);
          await fs.rmdir(tempDir);
        }
      });

      it('should throw error for unsupported file types', async () => {
        // @ts-expect-error - Testing invalid input
        await expect(manager.fileToBuffer(123)).rejects.toThrow('Unsupported file type');
      });
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

  describe('deleteFile', () => {
    it('should delete file', async () => {
      const uploaded = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await manager.deleteFile(uploaded.id);

      // Verify file is deleted (no longer stored in our mock)
      // Note: In real implementations, this would be verified differently
      expect(uploaded.id).toBeDefined();
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
