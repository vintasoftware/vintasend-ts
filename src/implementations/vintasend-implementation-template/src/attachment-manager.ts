import { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';
import type { 
  AttachmentFileRecord, 
  AttachmentFile,
  FileAttachment,
} from 'vintasend/dist/types/attachment';

/**
 * Template AttachmentManager implementation.
 * 
 * This serves as a starting point for creating custom AttachmentManager implementations
 * with different storage backends (AWS S3, Azure Blob Storage, Google Cloud Storage, 
 * local filesystem, etc.).
 * 
 * To use this template:
 * 1. Copy this file to your new implementation package
 * 2. Rename the class to match your storage backend (e.g., S3AttachmentManager)
 * 3. Implement the abstract methods with your storage logic
 * 4. Create a corresponding AttachmentFile implementation
 * 5. Add appropriate configuration options
 */
export class TemplateAttachmentManager extends BaseAttachmentManager {
  constructor() {
    super();
    // TODO: Add configuration parameters for your storage backend
    // Example: constructor(config: { bucket: string, region: string }) { ... }
  }

  /**
   * Upload a file to your storage backend.
   * 
   * @param file - The file data (Buffer, ReadableStream, or file path)
   * @param filename - The filename to use for storage
   * @param contentType - Optional MIME type (auto-detected if not provided)
   * @returns AttachmentFileRecord with metadata about the uploaded file
   */
  async uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord> {
    // TODO: Implement file upload logic
    // 1. Convert file to Buffer if needed: const buffer = await this.fileToBuffer(file);
    // 2. Calculate checksum: const checksum = this.calculateChecksum(buffer);
    // 3. Detect content type if not provided: contentType = contentType || this.detectContentType(filename);
    // 4. Upload to your storage backend (S3, Azure, etc.)
    // 5. Return file record with storage metadata
    
    throw new Error('uploadFile not implemented');
  }

  /**
   * Retrieve a file record by its ID.
   * 
   * @param fileId - The unique identifier of the file
   * @returns The file record or null if not found
   */
  async getFile(fileId: string): Promise<AttachmentFileRecord | null> {
    // TODO: Implement file retrieval from database/storage
    // This should fetch the file metadata from your backend's database
    
    throw new Error('getFile not implemented');
  }

  /**
   * Delete a file from storage.
   * 
   * Note: Only call this if the file is not referenced by any notifications.
   * The backend should check for orphaned files before calling this method.
   * 
   * @param fileId - The unique identifier of the file to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    // TODO: Implement file deletion logic
    // 1. Get file record to access storage metadata
    // 2. Delete from storage backend (S3, Azure, etc.)
    // 3. Delete file record from database
    
    throw new Error('deleteFile not implemented');
  }

  /**
   * Reconstruct an AttachmentFile accessor from storage metadata.
   * 
   * This allows the system to recreate file access objects when loading
   * notifications from the database.
   * 
   * @param storageMetadata - Storage-specific metadata (e.g., S3 key, bucket)
   * @returns An AttachmentFile instance for accessing the file
   */
  reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile {
    // TODO: Implement file reconstruction
    // Create a TemplateAttachmentFile instance with the storage metadata
    
    throw new Error('reconstructAttachmentFile not implemented');
  }

  /**
   * Optional: Find a file by its checksum to avoid duplicate uploads.
   * 
   * If your backend supports checksum indexing, implement this method
   * to enable automatic file deduplication.
   * 
   * @param checksum - SHA-256 checksum of the file
   * @returns Existing file record or null if not found
   */
  async findFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    // TODO: Implement checksum lookup if your backend supports it
    // This enables automatic deduplication of identical files
    
    return null; // Default: no deduplication
  }
}

/**
 * Template AttachmentFile implementation.
 * 
 * This class provides access to a stored file. Create an implementation
 * specific to your storage backend.
 */
class TemplateAttachmentFile implements AttachmentFile {
  constructor(
    private fileId: string,
    private storageMetadata: Record<string, unknown>,
  ) {
    // TODO: Store any additional context needed for file operations
    // Example: private s3Client: S3Client, private bucket: string, private key: string
  }

  /**
   * Read the entire file into memory as a Buffer.
   * 
   * Use this for small files. For large files, prefer streaming.
   */
  async read(): Promise<Buffer> {
    // TODO: Implement file reading from storage
    // Example (S3): Download object and convert to Buffer
    
    throw new Error('read not implemented');
  }

  /**
   * Get a readable stream for the file.
   * 
   * Use this for large files to avoid loading everything into memory.
   */
  async stream(): Promise<ReadableStream> {
    // TODO: Implement streaming from storage
    // Example (S3): Return S3 object stream
    
    throw new Error('stream not implemented');
  }

  /**
   * Generate a temporary URL for accessing the file.
   * 
   * @param expiresIn - Seconds until the URL expires (default: 3600 = 1 hour)
   * @returns A presigned/temporary URL for file access
   */
  async url(expiresIn = 3600): Promise<string> {
    // TODO: Implement presigned URL generation
    // Example (S3): Use getSignedUrl from @aws-sdk/s3-request-presigner
    
    throw new Error('url not implemented');
  }

  /**
   * Delete this file from storage.
   * 
   * Note: This is typically called by the AttachmentManager, not directly.
   */
  async delete(): Promise<void> {
    // TODO: Implement file deletion from storage
    // Example (S3): Delete object from bucket
    
    throw new Error('delete not implemented');
  }
}
