import type {
  AttachmentFile,
  AttachmentFileRecord,
  FileAttachment,
  StorageIdentifiers,
} from '../../types/attachment';
export declare abstract class BaseAttachmentManager {
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
  detectContentType(filename: string): string;
  /**
   * Calculate checksum for file data
   * Public to allow backends to perform deduplication checks
   */
  calculateChecksum(data: Buffer): string;
  /**
   * Convert various file formats to Buffer
   * Public to allow backends and custom implementations to use it
   */
  fileToBuffer(file: FileAttachment): Promise<Buffer>;
  /**
   * Type guard to check if value is a Node.js Readable stream
   */
  private isNodeReadable;
  /**
   * Convert Web ReadableStream to Buffer
   */
  private webStreamToBuffer;
  /**
   * Convert Node.js Readable stream to Buffer
   */
  private nodeStreamToBuffer;
}
//# sourceMappingURL=base-attachment-manager.d.ts.map
