import * as crypto from 'node:crypto';
import * as mime from 'mime-types';
import {
  type AttachmentFile,
  type AttachmentFileRecord,
  type FileAttachment,
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
   * Delete a file (only if not referenced by any notifications)
   */
  abstract deleteFile(fileId: string): Promise<void>;

  /**
   * Reconstruct AttachmentFile from storage metadata
   */
  abstract reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile;

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
    if (file instanceof ReadableStream) {
      return this.streamToBuffer(file);
    }
    if (typeof file === 'string') {
      const fs = await import('node:fs/promises');
      return fs.readFile(file);
    }
    throw new Error('Unsupported file type');
  }

  private async streamToBuffer(stream: ReadableStream): Promise<Buffer> {
    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    return Buffer.concat(chunks);
  }
}
