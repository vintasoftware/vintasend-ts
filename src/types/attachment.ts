// Input types for creating attachments
export type FileAttachment =
  | Buffer // Raw bytes
  | ReadableStream // Stream
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

// Database record for reusable attachment files
export interface AttachmentFileRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  storageMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
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
  storageMetadata: Record<string, unknown>;
}
