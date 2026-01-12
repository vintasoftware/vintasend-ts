import * as crypto from 'node:crypto';
import * as mime from 'mime-types';
import {
  type AttachmentFile,
  type AttachmentFileRecord,
  type FileAttachment,
  type NotificationAttachment,
  type NotificationAttachmentReference,
  type NotificationAttachmentUpload,
  isAttachmentReference,
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
   * Get file record by ID
   */
  abstract getFile(fileId: string): Promise<AttachmentFileRecord | null>;

  /**
   * Delete a file (only if not referenced by any notifications)
   */
  abstract deleteFile(fileId: string): Promise<void>;

  /**
   * Reconstruct AttachmentFile from storage metadata
   */
  abstract reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile;

  /**
   * Check if a file with the same checksum already exists
   * Returns existing file record to avoid duplicate uploads
   */
  async findFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    return null; // Override in implementation if backend supports checksum lookup
  }

  /**
   * Process attachments (upload new files or reference existing ones)
   */
  async processAttachments(
    attachments: NotificationAttachment[],
    notificationId: string,
  ): Promise<{
    fileRecords: AttachmentFileRecord[];
    attachmentData: Array<{ fileId: string; description?: string }>;
  }> {
    const results = await Promise.all(
      attachments.map(async (att) => {
        if (isAttachmentReference(att)) {
          // Reference existing file
          const fileRecord = await this.getFile(att.fileId);
          if (!fileRecord) {
            throw new Error(`Referenced file ${att.fileId} not found`);
          }
          return {
            fileRecord,
            attachmentData: {
              fileId: att.fileId,
              description: att.description,
            },
          };
        }
        // Upload new file
        const buffer = await this.fileToBuffer(att.file);
        const checksum = this.calculateChecksum(buffer);

        // Check if file already exists
        let fileRecord = await this.findFileByChecksum(checksum);

        if (!fileRecord) {
          // Upload new file
          fileRecord = await this.uploadFile(att.file, att.filename, att.contentType);
        }

        return {
          fileRecord,
          attachmentData: {
            fileId: fileRecord.id,
            description: att.description,
          },
        };
      }),
    );

    return {
      fileRecords: results.map((r) => r.fileRecord),
      attachmentData: results.map((r) => r.attachmentData),
    };
  }

  /**
   * Detect content type from filename
   */
  protected detectContentType(filename: string): string {
    return mime.lookup(filename) || 'application/octet-stream';
  }

  /**
   * Calculate checksum for file data
   */
  protected calculateChecksum(data: Buffer): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  protected async fileToBuffer(file: FileAttachment): Promise<Buffer> {
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
