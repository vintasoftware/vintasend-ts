import * as fs from 'node:fs';
import * as path from 'node:path';
import { LocalFileAttachmentManager } from '../local-file-attachment-manager';

describe('LocalFileAttachmentManager', () => {
  let tempDir: string;
  let manager: LocalFileAttachmentManager;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = path.join(
      __dirname,
      `test-attachments-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    );
    manager = new LocalFileAttachmentManager({
      baseDirectory: tempDir,
      createDirectoryIfNotExists: true,
    });
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempDir, file));
      }
      fs.rmdirSync(tempDir);
    }
  });

  describe('constructor', () => {
    it('should create base directory if it does not exist', () => {
      const testDir = path.join(__dirname, 'test-auto-create');

      // Ensure directory doesn't exist
      if (fs.existsSync(testDir)) {
        fs.rmdirSync(testDir);
      }

      const _testManager = new LocalFileAttachmentManager({
        baseDirectory: testDir,
      });

      expect(fs.existsSync(testDir)).toBe(true);

      // Cleanup
      fs.rmdirSync(testDir);
    });

    it('should not create directory if createDirectoryIfNotExists is false', () => {
      const testDir = path.join(__dirname, 'test-no-auto-create');

      // Ensure directory doesn't exist
      if (fs.existsSync(testDir)) {
        fs.rmdirSync(testDir);
      }

      const _testManager = new LocalFileAttachmentManager({
        baseDirectory: testDir,
        createDirectoryIfNotExists: false,
      });

      expect(fs.existsSync(testDir)).toBe(false);
    });

    it('should use default directory if baseDirectory not provided', () => {
      const _testManager = new LocalFileAttachmentManager();
      expect(fs.existsSync('./attachments')).toBe(true);

      // Cleanup
      if (fs.existsSync('./attachments')) {
        const files = fs.readdirSync('./attachments');
        for (const file of files) {
          fs.unlinkSync(path.join('./attachments', file));
        }
        fs.rmdirSync('./attachments');
      }
    });
  });

  describe('uploadFile', () => {
    it('should upload a Buffer file', async () => {
      const buffer = Buffer.from('test file content');
      const filename = 'test.txt';

      const record = await manager.uploadFile(buffer, filename);

      expect(record.id).toBeDefined();
      expect(record.filename).toBe('test.txt');
      expect(record.contentType).toBe('text/plain');
      expect(record.size).toBe(buffer.length);
      expect(record.checksum).toBeDefined();
      expect(record.storageIdentifiers.backend).toBe('local-filesystem');
      expect(record.storageIdentifiers.path).toContain(tempDir);

      // Verify file exists on disk
      const filePath = path.join(tempDir, record.id);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath).toString()).toBe('test file content');
    });

    it('should upload a string file path', async () => {
      // Create a temporary source file
      const sourceFile = path.join(tempDir, 'source.txt');
      fs.writeFileSync(sourceFile, 'source content');

      const record = await manager.uploadFile(sourceFile, 'uploaded.txt');

      expect(record.id).toBeDefined();
      expect(record.filename).toBe('uploaded.txt');
      expect(record.size).toBeGreaterThan(0);

      // Verify uploaded file has same content
      const uploadedPath = path.join(tempDir, record.id);
      expect(fs.readFileSync(uploadedPath).toString()).toBe('source content');

      // Cleanup source file
      fs.unlinkSync(sourceFile);
    });

    it('should detect content type automatically', async () => {
      const buffer = Buffer.from('{"test": true}');
      const record = await manager.uploadFile(buffer, 'data.json');

      expect(record.contentType).toBe('application/json');
    });

    it('should use provided content type', async () => {
      const buffer = Buffer.from('custom content');
      const record = await manager.uploadFile(buffer, 'file.bin', 'application/octet-stream');

      expect(record.contentType).toBe('application/octet-stream');
    });

    it('should sanitize filename to prevent directory traversal', async () => {
      const buffer = Buffer.from('malicious content');
      const maliciousFilename = '../../../etc/passwd';

      const record = await manager.uploadFile(buffer, maliciousFilename);

      expect(record.filename).toBe('passwd');
      expect(record.storageIdentifiers.path).not.toContain('..');
    });

    it('should calculate checksum correctly', async () => {
      const buffer = Buffer.from('checksum test');
      const record = await manager.uploadFile(buffer, 'test.txt');

      // Verify checksum is a hex string
      expect(record.checksum).toMatch(/^[a-f0-9]{64}$/);

      // Same content should produce same checksum
      const record2 = await manager.uploadFile(Buffer.from('checksum test'), 'test2.txt');
      expect(record2.checksum).toBe(record.checksum);
    });
  });

  describe('deleteFile', () => {
    it('should delete an existing file', async () => {
      const buffer = Buffer.from('to be deleted');
      const record = await manager.uploadFile(buffer, 'delete-me.txt');

      const filePath = path.join(tempDir, record.id);
      expect(fs.existsSync(filePath)).toBe(true);

      await manager.deleteFile(record.id);

      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should not throw error when deleting non-existent file', async () => {
      await expect(manager.deleteFile('non-existent-file-id')).resolves.toBeUndefined();
    });
  });

  describe('reconstructAttachmentFile', () => {
    it('should reconstruct attachment file from storage metadata', async () => {
      const buffer = Buffer.from('reconstruct test');
      const record = await manager.uploadFile(buffer, 'reconstruct.txt');

      const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);

      expect(attachmentFile).toBeDefined();

      // Test read()
      const content = await attachmentFile.read();
      expect(content.toString()).toBe('reconstruct test');
    });

    it('should throw error if storage metadata is invalid', () => {
      expect(() => manager.reconstructAttachmentFile({ id: 'test' })).toThrow('Invalid storage identifiers');
    });
  });

  describe('LocalAttachmentFile', () => {
    let record: Awaited<ReturnType<typeof manager.uploadFile>>;

    beforeEach(async () => {
      const buffer = Buffer.from('attachment file test');
      record = await manager.uploadFile(buffer, 'attachment.txt');
    });

    describe('read', () => {
      it('should read file content as Buffer', async () => {
        const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
        const content = await attachmentFile.read();

        expect(Buffer.isBuffer(content)).toBe(true);
        expect(content.toString()).toBe('attachment file test');
      });
    });

    describe('stream', () => {
      it('should return a readable stream', async () => {
        const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
        const stream = await attachmentFile.stream();

        expect(stream).toBeInstanceOf(ReadableStream);

        // Read from stream
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        let done = false;
        while (!done) {
          const result = await reader.read();
          done = result.done;
          if (result.value) {
            chunks.push(result.value);
          }
        }

        const content = Buffer.concat(chunks).toString();
        expect(content).toBe('attachment file test');
      });
    });

    describe('url', () => {
      it('should return a file:// URL', async () => {
        const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
        const url = await attachmentFile.url();

        expect(url).toMatch(/^file:\/\//);
        expect(url).toContain(tempDir);
        expect(url).toContain(record.id);
      });

      it('should ignore expiresIn parameter', async () => {
        const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
        const url1 = await attachmentFile.url();
        const url2 = await attachmentFile.url(3600);

        expect(url1).toBe(url2);
      });
    });

    describe('delete', () => {
      it('should delete the file', async () => {
        const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);

        const filePath = path.join(tempDir, record.id);
        expect(fs.existsSync(filePath)).toBe(true);

        await attachmentFile.delete();

        expect(fs.existsSync(filePath)).toBe(false);
      });
    });
  });

  describe('integration', () => {
    it('should handle multiple files', async () => {
      const file1 = await manager.uploadFile(Buffer.from('file 1'), 'file1.txt');
      const file2 = await manager.uploadFile(Buffer.from('file 2'), 'file2.txt');
      const file3 = await manager.uploadFile(Buffer.from('file 3'), 'file3.txt');

      // All files should exist
      expect(fs.existsSync(path.join(tempDir, file1.id))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, file2.id))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, file3.id))).toBe(true);

      // Each file should have unique ID
      expect(file1.id).not.toBe(file2.id);
      expect(file2.id).not.toBe(file3.id);
      expect(file1.id).not.toBe(file3.id);
    });

    it('should handle large files', async () => {
      // Create a 1MB buffer
      const largeBuffer = Buffer.alloc(1024 * 1024, 'x');
      const record = await manager.uploadFile(largeBuffer, 'large.bin');

      expect(record.size).toBe(1024 * 1024);

      const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
      const content = await attachmentFile.read();

      expect(content.length).toBe(1024 * 1024);
    });

    it('should handle binary files', async () => {
      const binaryBuffer = Buffer.from([0x00, 0xff, 0x01, 0xfe, 0x02, 0xfd]);
      const record = await manager.uploadFile(binaryBuffer, 'binary.bin');

      const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
      const content = await attachmentFile.read();

      expect(content).toEqual(binaryBuffer);
    });
  });
});
