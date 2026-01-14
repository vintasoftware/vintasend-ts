import * as fs from 'node:fs';
import * as path from 'node:path';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import type { AttachmentFile, AttachmentFileRecord, FileAttachment } from '../../types/attachment';
import { BaseAttachmentManager } from './base-attachment-manager';

const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

/**
 * Configuration options for LocalFileAttachmentManager
 */
export interface LocalFileAttachmentManagerConfig {
  /**
   * Base directory where attachment files will be stored
   * Defaults to './attachments' relative to process.cwd()
   */
  baseDirectory?: string;

  /**
   * Whether to create the base directory if it doesn't exist
   * Defaults to true
   */
  createDirectoryIfNotExists?: boolean;
}

/**
 * Local filesystem-based attachment manager for development and testing.
 *
 * WARNING: This implementation is NOT recommended for production use.
 * Use cloud storage solutions (S3, Azure Blob, GCS) for production.
 *
 * Features:
 * - Simple filesystem-based storage
 * - No external dependencies beyond Node.js
 * - Useful for development and testing
 * - Quick setup for prototyping
 *
 * Limitations:
 * - Not scalable across multiple servers
 * - No built-in redundancy or backup
 * - File URLs are local file paths, not HTTP URLs
 * - Performance degrades with large numbers of files
 *
 * @example
 * ```typescript
 * const attachmentManager = new LocalFileAttachmentManager({
 *   baseDirectory: './uploads/attachments'
 * });
 * ```
 */
export class LocalFileAttachmentManager extends BaseAttachmentManager {
  private baseDirectory: string;

  constructor(config: LocalFileAttachmentManagerConfig = {}) {
    super();
    this.baseDirectory = config.baseDirectory || './attachments';

    if (config.createDirectoryIfNotExists !== false) {
      // Create directory synchronously during construction
      if (!fs.existsSync(this.baseDirectory)) {
        fs.mkdirSync(this.baseDirectory, { recursive: true });
      }
    }
  }

  /**
   * Upload a file to the local filesystem
   */
  async uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord> {
    // Convert file to buffer
    const buffer = await this.fileToBuffer(file);

    // Detect content type if not provided
    const finalContentType = contentType || this.detectContentType(filename);

    // Calculate checksum
    const checksum = this.calculateChecksum(buffer);

    // Generate unique file ID
    const fileId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Sanitize filename to prevent directory traversal
    const sanitizedFilename = path.basename(filename);

    // Create file path
    const filePath = path.join(this.baseDirectory, fileId);

    // Write file to disk
    await writeFile(filePath, buffer);

    // Get file size
    const size = buffer.length;

    // Return file record
    return {
      id: fileId,
      filename: sanitizedFilename,
      contentType: finalContentType,
      size,
      checksum,
      storageMetadata: {
        path: filePath,
        backend: 'local-filesystem',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Delete a file from the local filesystem
   */
  async deleteFile(fileId: string): Promise<void> {
    const filePath = path.join(this.baseDirectory, fileId);

    try {
      await access(filePath, fs.constants.F_OK);
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, consider it already deleted
        return;
      }
      throw error;
    }
  }

  /**
   * Reconstruct an AttachmentFile interface from stored metadata
   */
  reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile {
    if (!storageMetadata.path || typeof storageMetadata.path !== 'string') {
      throw new Error('Invalid storage metadata: missing path');
    }

    const filePath = storageMetadata.path as string;

    return new LocalAttachmentFile(filePath, this);
  }
}

/**
 * Local filesystem implementation of AttachmentFile interface
 */
class LocalAttachmentFile implements AttachmentFile {
  constructor(
    private filePath: string,
    private manager: LocalFileAttachmentManager,
  ) {}

  /**
   * Read the entire file into memory as a Buffer
   */
  async read(): Promise<Buffer> {
    try {
      return await readFile(this.filePath);
    } catch (error) {
      throw new Error(
        `Failed to read file ${this.filePath}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a readable stream for the file
   */
  async stream(): Promise<ReadableStream> {
    const nodeStream = fs.createReadStream(this.filePath);

    // Convert Node.js Readable to Web ReadableStream
    return Readable.toWeb(nodeStream) as ReadableStream;
  }

  /**
   * Get a local file path (not an HTTP URL)
   *
   * WARNING: This returns a local file path, not an HTTP URL.
   * This is only useful for development/testing scenarios.
   */
  async url(_expiresIn?: number): Promise<string> {
    // For local files, just return the absolute file path
    // Note: This is not an HTTP URL and won't work in browsers
    return `file://${path.resolve(this.filePath)}`;
  }

  /**
   * Delete the file from local filesystem
   */
  async delete(): Promise<void> {
    // Extract file ID from path (last component)
    const fileId = path.basename(this.filePath);
    await this.manager.deleteFile(fileId);
  }
}
