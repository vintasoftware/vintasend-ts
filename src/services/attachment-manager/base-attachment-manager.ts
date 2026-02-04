import * as crypto from 'node:crypto';
import type { Readable } from 'node:stream';
import * as mime from 'mime-types';
import type {
  AttachmentFile,
  AttachmentFileRecord,
  FileAttachment,
  StorageIdentifiers,
} from '../../types/attachment';

export abstract class BaseAttachmentManager {
  /**
   * Upload a file and return file record (reusable across notifications)
   */
  abstract uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord>;

  /**
   * Reconstruct AttachmentFile from storage identifiers
   */
  abstract reconstructAttachmentFile(storageIdentifiers: StorageIdentifiers): AttachmentFile;

  /**
   * Delete a file from storage using its identifiers
   */
  abstract deleteFileByIdentifiers(storageIdentifiers: StorageIdentifiers): Promise<void>;

  /**
   * Detect content type from filename
   * Public to allow backends and custom implementations to use it
   */
  public detectContentType(filename: string): string {
    return mime.lookup(filename) || 'application/octet-stream';
  }

  /**
   * Calculate checksum for file data
   * Public to allow backends to perform deduplication checks
   */
  public calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Convert various file formats to Buffer
   * Public to allow backends and custom implementations to use it
   */
  public async fileToBuffer(file: FileAttachment): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }
    // Support both Web ReadableStream and Node.js Readable streams
    if (typeof ReadableStream !== 'undefined' && file instanceof ReadableStream) {
      return this.webStreamToBuffer(file);
    }
    // Check for Node.js Readable stream
    if (this.isNodeReadable(file)) {
      return this.nodeStreamToBuffer(file);
    }
    if (typeof file === 'string') {
      const fs = await import('node:fs/promises');
      return fs.readFile(file);
    }
    throw new Error('Unsupported file type');
  }

  /**
   * Type guard to check if value is a Node.js Readable stream
   */
  private isNodeReadable(value: unknown): value is Readable {
    return (
      typeof value === 'object' &&
      value !== null &&
      // biome-ignore lint/suspicious/noExplicitAny: checking for stream methods
      typeof (value as any).read === 'function' &&
      // biome-ignore lint/suspicious/noExplicitAny: checking for stream methods
      typeof (value as any).on === 'function' &&
      // biome-ignore lint/suspicious/noExplicitAny: checking for stream methods
      typeof (value as any).pipe === 'function'
    );
  }

  /**
   * Convert Web ReadableStream to Buffer
   */
  private async webStreamToBuffer(stream: ReadableStream): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Convert Node.js Readable stream to Buffer
   */
  private async nodeStreamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }
}
