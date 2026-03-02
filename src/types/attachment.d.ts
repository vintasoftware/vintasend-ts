import type { Readable } from 'node:stream';
export type FileAttachment = Buffer | ReadableStream | Readable | string;
export interface NotificationAttachmentUpload {
  file: FileAttachment;
  filename: string;
  contentType?: string;
  description?: string;
}
export interface NotificationAttachmentReference {
  fileId: string;
  description?: string;
}
export type NotificationAttachment = NotificationAttachmentUpload | NotificationAttachmentReference;
export declare function isAttachmentReference(
  attachment: NotificationAttachment,
): attachment is NotificationAttachmentReference;
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
  id: string;
  [key: string]: unknown;
}
/**
 * Complete file record returned after upload.
 * Contains both file metadata and storage identifiers.
 * Storage identifiers are opaque to backends - used only for reconstruction.
 */
export interface AttachmentFileRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
  storageIdentifiers: StorageIdentifiers;
}
export interface StoredAttachment {
  id: string;
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  file: AttachmentFile;
  description?: string;
  storageMetadata: StorageIdentifiers;
}
//# sourceMappingURL=attachment.d.ts.map
