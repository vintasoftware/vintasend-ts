import type { Readable } from 'node:stream';

// Input types for creating attachments
export type FileAttachment =
  | Buffer // Raw bytes
  | ReadableStream // Web ReadableStream
  | Readable // Node.js Readable stream
  | string; // File path

// For creating new attachments (inline upload)
export interface NotificationAttachmentUpload {
  file: FileAttachment;
  filename: string;
  contentType?: string; // Auto-detected if not provided
  description?: string;
}

// For referencing existing attachments
export interface NotificationAttachmentReference {
  fileId: string; // ID of existing AttachmentFile
  description?: string; // Optional override
}

// Union type for notification attachment input
export type NotificationAttachment = NotificationAttachmentUpload | NotificationAttachmentReference;

// Type guard to check if attachment is a reference
export function isAttachmentReference(
  attachment: NotificationAttachment,
): attachment is NotificationAttachmentReference {
  return 'fileId' in attachment;
}

// Abstract interface for stored file access
export interface AttachmentFile {
  read(): Promise<Buffer>;
  stream(): Promise<ReadableStream>;
  url(expiresIn?: number): Promise<string>;
  delete(): Promise<void>;
}

/**
 * Generic storage identifiers returned by AttachmentManagers.
 * Backends persist these as opaque data and pass them back for file reconstruction.
 * Each AttachmentManager implementation defines its own specific structure.
 *
 * @example MedplumStorageIdentifiers
 * ```typescript
 * {
 *   id: "media-123",
 *   medplumBinaryId: "binary-456",
 *   medplumMediaId: "media-123",
 *   url: "Binary/binary-456"
 * }
 * ```
 *
 * @example S3StorageIdentifiers
 * ```typescript
 * {
 *   id: "file-123",
 *   awsS3Bucket: "my-bucket",
 *   awsS3Key: "uploads/file-123.pdf",
 *   awsS3Region: "us-east-1"
 * }
 * ```
 */
export interface StorageIdentifiers {
  // Universal identifier (required) - used as primary key by backends
  id: string;

  // Allow implementation-specific fields
  // Backends treat this as opaque data and don't inspect specific fields
  [key: string]: unknown;
}

/**
 * Complete file record returned after upload.
 * Contains both file metadata and storage identifiers.
 * Storage identifiers are opaque to backends - used only for reconstruction.
 */
export interface AttachmentFileRecord {
  // File metadata (stored by backend in database)
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;

  // Storage identifiers (opaque to backend, only used for reconstruction)
  // Each AttachmentManager populates these with its own specific fields
  storageIdentifiers: StorageIdentifiers;
}

// Stored attachment with metadata (notification-specific)
export interface StoredAttachment {
  id: string; // NotificationAttachment ID
  fileId: string; // Reference to AttachmentFileRecord
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  file: AttachmentFile;
  description?: string;
  storageMetadata: StorageIdentifiers;
}
