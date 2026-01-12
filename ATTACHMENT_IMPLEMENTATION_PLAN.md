# Attachment Support Implementation Plan for VintaSend-TS

## Overview
This plan outlines the implementation of attachment support in vintasend-ts, allowing notifications to include file attachments that are uploaded, stored, and sent through various adapters.

**Storage Strategy:** This implementation uses AWS S3 as the primary storage backend, providing production-ready, scalable file storage with presigned URLs for secure access. The architecture is designed to be extensible, allowing for alternative storage backends (local filesystem for development, Azure Blob Storage, Google Cloud Storage, etc.) to be implemented following the same pattern.

## Architecture

### Core Components
1. **Attachment Types** - Type definitions for attachments
2. **AttachmentManager** - Abstract interface for uploading/retrieving attachments
3. **Implementation Template** - Template for creating custom AttachmentManager implementations
4. **S3AttachmentManager** - Production-ready S3 implementation
5. **Backend Integration** - Persistence layer for attachment metadata
6. **Adapter Integration** - Support for sending attachments via adapters

### Implementation Phases Overview
1. **Phase 1-3:** Core types, notification updates, and backend interface
2. **Phase 4:** Update vintasend-implementation-template with AttachmentManager template
3. **Phase 5:** Generate vintasend-s3-attachments project structure from template
4. **Phase 6:** Implement S3AttachmentManager with full AWS SDK integration
5. **Phase 7-8:** Service and adapter integration
6. **Phase 9-10:** Examples and documentation
7. **Phase 11:** Optional advanced features and alternative storage backends

### Key Features
- **Presigned URLs** - Secure, time-limited access to attachments
- **Streaming Support** - Efficient handling of large files
- **Flexible Storage** - Abstract interface allows multiple storage backends
- **S3-Compatible Services** - Works with MinIO, DigitalOcean Spaces, etc.
- **Type-Safe API** - Attachments are part of notification types, ensuring type safety

### Design Decisions

**Attachments as Part of Notification Types:**
- Attachments are included directly in `NotificationInput` and `DatabaseNotification` types
- This provides a cleaner API where everything related to a notification is in one object
- Type inference works better (TypeScript knows if a notification has attachments)
- Simplifies method signatures (no separate attachment parameters needed)
- More intuitive for developers (notification.attachments vs separate parameter)

**Reusable Attachments:**
- Files are stored once and referenced multiple times across notifications
- Separate `AttachmentFile` database table stores the actual file metadata
- `NotificationAttachment` join table links notifications to files
- Benefits:
  - **Reduced storage costs** - Same file stored only once
  - **Faster notification creation** - Skip upload for existing files
  - **Consistency** - Same file guaranteed to be identical across notifications
  - **Efficient bulk operations** - Send same attachment to many users
- Use cases:
  - Terms & conditions PDFs
  - Product catalogs or brochures
- Files can be uploaded separately and referenced by ID, or uploaded inline
- Automatic deduplication via checksum prevents duplicate file storage

---

## Phase 1: Type Definitions and Core Interfaces

### Objectives
- Define TypeScript types for attachments
- Create the base AttachmentManager interface
- Establish data structures for attachment handling

### Tasks

#### 1.1 Create Attachment Type Definitions
**File:** `src/types/attachment.ts`

Create types inspired by the Python implementation:

```typescript
// Input types for creating attachments
export type FileAttachment = 
  | Buffer                    // Raw bytes
  | ReadableStream           // Stream
  | string;                  // File path or URL

// For creating new attachments (inline upload)
export interface NotificationAttachmentUpload {
  file: FileAttachment;
  filename: string;
  contentType?: string;      // Auto-detected if not provided
  description?: string;
}

// For referencing existing attachments
export interface NotificationAttachmentReference {
  fileId: string;            // ID of existing AttachmentFile
  description?: string;      // Optional override
}

// Union type for notification attachment input
export type NotificationAttachment = 
  | NotificationAttachmentUpload 
  | NotificationAttachmentReference;

// Type guard to check if attachment is a reference
export function isAttachmentReference(
  attachment: NotificationAttachment
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
  id: string;                // NotificationAttachment ID
  fileId: string;            // Reference to AttachmentFileRecord
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  file: AttachmentFile;
  description?: string;
  storageMetadata: Record<string, unknown>;
}
```

**Test:** `src/types/__tests__/attachment.test.ts`
- Verify type definitions compile correctly
- Test type guards (if any)

#### 1.2 Create Base AttachmentManager Interface
**File:** `src/services/attachment-manager/base-attachment-manager.ts`

```typescript
import type { 
  NotificationAttachment,
  NotificationAttachmentUpload,
  NotificationAttachmentReference, 
  StoredAttachment,
  AttachmentFile,
  AttachmentFileRecord,
  FileAttachment,
  isAttachmentReference,
} from '../../types/attachment';
import * as crypto from 'crypto';
import * as mime from 'mime-types';

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
    fileRecords: AttachmentFileRecord[], 
    attachmentData: Array<{ fileId: string, description?: string }> 
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
        } else {
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
        }
      })
    );
    
    return {
      fileRecords: results.map(r => r.fileRecord),
      attachmentData: results.map(r => r.attachmentData),
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
      const fs = await import('fs/promises');
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
```

**Test:** `src/services/attachment-manager/__tests__/base-attachment-manager.test.ts`
- Test bulk upload functionality
- Test helper methods (detectContentType, calculateChecksum)

---

## Phase 2: Update Notification Types

### Objectives
- Add attachment fields to notification types
- Update input/output types across the system

### Tasks

#### 2.1 Update Notification Input Types
**File:** `src/types/notification.ts`

Add attachment fields to notification input types:

```typescript
export type NotificationInput<Config extends BaseNotificationTypeConfig> = {
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][NotificationInput<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
  attachments?: NotificationAttachment[]; // NEW
};

export type NotificationResendWithContextInput<Config extends BaseNotificationTypeConfig> = {
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][NotificationResendWithContextInput<Config>['contextName']]['generate']
  >[0];
  contextUsed: ReturnType<
    Config['ContextMap'][NotificationResendWithContextInput<Config>['contextName']]['generate']
  > extends Promise<infer T>
    ? T
    : ReturnType<
        Config['ContextMap'][NotificationResendWithContextInput<Config>['contextName']]['generate']
      >;
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
  attachments?: NotificationAttachment[]; // NEW
};
```

#### 2.2 Update Database Notification Types
**File:** `src/types/notification.ts`

Add attachment metadata to database types:

```typescript
export type DatabaseNotification<Config extends BaseNotificationTypeConfig> = {
  id: Config['NotificationIdType'];
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][DatabaseNotification<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed:
    | null
    | (ReturnType<
        Config['ContextMap'][DatabaseNotification<Config>['contextName']]['generate']
      > extends Promise<infer T>
        ? T
        : ReturnType<
            Config['ContextMap'][DatabaseNotification<Config>['contextName']]['generate']
          >);
  extraParams: JsonValue;
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  attachments?: StoredAttachment[]; // NEW
};
```

#### 2.3 Update One-Off Notification Types
**File:** `src/types/one-off-notification.ts`

Apply same changes to one-off notification types:

```typescript
export type OneOffNotificationInput<Config extends BaseNotificationTypeConfig> = {
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][OneOffNotificationInput<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
  attachments?: NotificationAttachment[]; // NEW
};

export type DatabaseOneOffNotification<Config extends BaseNotificationTypeConfig> = {
  id: Config['NotificationIdType'];
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][DatabaseOneOffNotification<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed:
    | null
    | (ReturnType<
        Config['ContextMap'][DatabaseOneOffNotification<Config>['contextName']]['generate']
      > extends Promise<infer T>
        ? T
        : ReturnType<
            Config['ContextMap'][DatabaseOneOffNotification<Config>['contextName']]['generate']
          >);
  extraParams: JsonValue;
  adapterUsed: string | null;
  sentAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  attachments?: StoredAttachment[]; // NEW
};
```

**Test:** `src/types/__tests__/notification.test.ts`
- Verify type definitions with and without attachments
- Test type inference with attachments
- Test that attachments are optional
- Test TypeScript compilation with attachment examples

---

## Phase 3: Backend Integration

### Objectives
- Update backend interface to handle attachments
- Implement Prisma backend support for attachments

### Tasks

#### 3.1 Update Base Backend Interface
**File:** `src/services/notification-backends/base-notification-backend.ts`

Since attachments are now part of the notification types, the backend methods remain largely the same but need to handle the attachments field:

```typescript
export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  // These methods now receive attachments as part of the notification object
  persistNotification(
    notification: Omit<Notification<Config>, 'id'>,
  ): Promise<DatabaseNotification<Config>>;

  persistNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>>;

  // Attachment file management (reusable files)
  getAttachmentFile(fileId: string): Promise<AttachmentFileRecord | null>;
  
  deleteAttachmentFile(fileId: string): Promise<void>;
  
  // Get all files not referenced by any notifications (for cleanup)
  getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]>;

  // Notification-specific attachment methods
  getAttachments(
    notificationId: Config['NotificationIdType'],
  ): Promise<StoredAttachment[]>;

  deleteNotificationAttachment(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void>;
  
  // One-off notification methods (also support attachments in notification object)
  persistOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'>,
  ): Promise<DatabaseOneOffNotification<Config>>;
  
  persistOneOffNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>>;
}
```

**Key Points:**
- Attachments are now accessed via `notification.attachments`
- Backend extracts attachments from the notification object
- Supports both inline file uploads and references to existing files
- Files are stored in `AttachmentFile` table and reused across notifications
- `NotificationAttachment` join table links notifications to files

#### 3.2 Update Prisma Schema Example
**File:** `src/implementations/vintasend-prisma/schema.prisma.example`

Add two models for reusable attachments:

```prisma
// Reusable attachment files (stored once, referenced many times)
model AttachmentFile {
  id                String                  @id @default(uuid())
  filename          String
  contentType       String
  size              Int
  checksum          String                  @unique // For deduplication
  storageMetadata   Json                    @default("{}")
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt
  
  // Relations
  notificationAttachments NotificationAttachment[]
  
  @@index([checksum])
}

// Join table linking notifications to attachment files
model NotificationAttachment {
  id              String          @id @default(uuid())
  notification    Notification    @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  notificationId  Int
  attachmentFile  AttachmentFile  @relation(fields: [fileId], references: [id], onDelete: Restrict)
  fileId          String
  description     String?         // Notification-specific description
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  @@unique([notificationId, fileId]) // Can't attach same file twice to same notification
  @@index([notificationId])
  @@index([fileId])
}

model Notification {
  // ... existing fields
  attachments     NotificationAttachment[]
}
```

**Schema Design Benefits:**
- Files stored once in `AttachmentFile` table
- `checksum` field enables automatic deduplication
- `onDelete: Restrict` prevents deleting files still in use
- `onDelete: Cascade` auto-removes links when notification deleted
- Unique constraint prevents duplicate attachments on same notification
```

#### 3.3 Implement Prisma Backend Attachment Support
**File:** `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`

Update implementation to:
- Extract attachments from the notification object
- Use AttachmentManager to upload files
- Store attachment metadata in database
- Retrieve attachments when fetching notifications
- Reconstruct StoredAttachment objects with AttachmentFile interface

**Key Implementation Details:**

```typescript
export class PrismaNotificationBackend<Config extends BaseNotificationTypeConfig> 
  implements BaseNotificationBackend<Config> {
  
  constructor(
    private prisma: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
    private attachmentManager?: BaseAttachmentManager,
  ) {}

  async persistNotification(
    notification: Omit<NotificationInput<Config>, 'id'>,
  ): Promise<DatabaseNotification<Config>> {
    // Extract attachments from notification
    const { attachments, ...notificationData } = notification;
    
    // Create notification in database first
    const createdNotification = await this.prisma.notification.create({
      data: {
        ...this.mapNotificationToCreateInput(notificationData),
      },
      include: { user: true },
    });
    
    // Upload and store attachments if present
    let storedAttachments: StoredAttachment[] = [];
    if (attachments && attachments.length > 0) {
      if (!this.attachmentManager) {
        throw new Error('AttachmentManager not configured but attachments were provided');
      }
      
      storedAttachments = await this.attachmentManager.bulkUpload(
        attachments,
        String(createdNotification.id),
      );
      
      // Store attachment metadata in database
      await this.prisma.attachment.createMany({
        data: storedAttachments.map(att => ({
          id: att.id,
          notificationId: createdNotification.id,
          filename: att.filename,
          contentType: att.contentType,
          size: att.size,
          checksum: att.checksum,
          description: att.description,
          storageMetadata: att.storageMetadata,
        })),
      });
    }
    
    // Return notification with attachments
    return {
      ...this.mapPrismaNotificationToDatabaseNotification(createdNotification),
      attachments: storedAttachments,
    };
  }

  async getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<AnyDatabaseNotification<Config> | null> {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: { 
        user: true,
        attachments: true, // Include attachment records
      },
    });
    
    if (!notification) return null;
    
    // Reconstruct StoredAttachment objects with AttachmentFile interface
    const storedAttachments = notification.attachments?.map(att => ({
      id: att.id,
      filename: att.filename,
      contentType: att.contentType,
      size: att.size,
      checksum: att.checksum,
      createdAt: att.createdAt,
      description: att.description,
      storageMetadata: att.storageMetadata as Record<string, unknown>,
      file: this.attachmentManager?.reconstructAttachmentFile(
        att.storageMetadata as Record<string, unknown>
      ),
    })) || [];
    
    return {
      ...this.mapPrismaNotificationToDatabaseNotification(notification),
      attachments: storedAttachments,
    };
  }
}
```

**Test:** `src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend-attachments.test.ts`
- Test creating notifications with attachments (extracted from notification object)
- Test updating notifications with new attachments
- Test retrieving notifications with attachments
- Test deleting attachments
- Test that attachments are optional
- Test error handling when AttachmentManager is missing but attachments are provided

---

## Phase 4: Update Implementation Template

### Objectives
- Update vintasend-implementation-template to include AttachmentManager template
- Provide base structure for creating AttachmentManager implementations
- Document the template usage

### Tasks

#### 4.1 Create AttachmentManager Template File
**File:** `src/implementations/vintasend-implementation-template/src/attachment-manager.ts`

```typescript
import { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';
import type { 
  NotificationAttachment, 
  StoredAttachment,
  AttachmentFile 
} from 'vintasend/dist/types/attachment';

/**
 * Template AttachmentManager implementation.
 * 
 * Replace this with your actual storage implementation:
 * - S3AttachmentManager for AWS S3
 * - AzureBlobAttachmentManager for Azure Blob Storage
 * - GCSAttachmentManager for Google Cloud Storage
 * - LocalFileAttachmentManager for local filesystem (development only)
 * 
 * Key methods to implement:
 * - upload(): Upload an attachment and return stored metadata
 * - get(): Retrieve an attachment by ID (optional - may use backend)
 * - delete(): Delete an attachment (optional - may use backend)
 * - reconstructAttachmentFile(): Recreate AttachmentFile from storage metadata
 */
export class TemplateAttachmentManager extends BaseAttachmentManager {
  constructor() {
    super();
    // Initialize your storage client here
    // e.g., S3Client, BlobServiceClient, Storage, etc.
  }

  async upload(
    attachment: NotificationAttachment,
    notificationId: string,
  ): Promise<StoredAttachment> {
    // TODO: Implement file upload to your storage backend
    // 1. Generate unique attachment ID
    // 2. Upload file to storage (S3, Azure Blob, etc.)
    // 3. Calculate metadata (size, checksum)
    // 4. Return StoredAttachment with AttachmentFile implementation
    
    throw new Error('upload() not implemented');
  }

  async get(attachmentId: string): Promise<StoredAttachment | null> {
    // TODO: Optional - implement if you need to retrieve by ID
    // Usually the backend handles this by storing metadata
    throw new Error('get() not implemented - use backend.getAttachments()');
  }

  async delete(attachmentId: string): Promise<void> {
    // TODO: Optional - implement if you need to delete by ID
    // Usually called with full metadata from backend
    throw new Error('delete() not implemented - use deleteByKey() or similar');
  }

  /**
   * Reconstruct AttachmentFile from storage metadata.
   * This is called by the backend when retrieving notifications.
   */
  reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile {
    // TODO: Implement - create AttachmentFile instance from metadata
    // Return an implementation of AttachmentFile interface
    throw new Error('reconstructAttachmentFile() not implemented');
  }
}

/**
 * Template AttachmentFile implementation.
 * Provides access to the stored file.
 */
class TemplateAttachmentFile implements AttachmentFile {
  constructor(
    // TODO: Add constructor parameters for accessing your storage
    // e.g., storage client, bucket/container name, file key/path, etc.
  ) {}

  async read(): Promise<Buffer> {
    // TODO: Implement - read entire file into Buffer
    throw new Error('read() not implemented');
  }

  async stream(): Promise<ReadableStream> {
    // TODO: Implement - return ReadableStream for the file
    throw new Error('stream() not implemented');
  }

  async url(expiresIn: number = 3600): Promise<string> {
    // TODO: Implement - generate presigned/temporary URL
    // expiresIn is in seconds
    throw new Error('url() not implemented');
  }

  async delete(): Promise<void> {
    // TODO: Implement - delete the file from storage
    throw new Error('delete() not implemented');
  }
}
```

#### 4.2 Update Template Index File
**File:** `src/implementations/vintasend-implementation-template/src/index.ts`

```typescript
export { TemplateAttachmentManager } from './attachment-manager';
// ... other exports
```

#### 4.3 Add AttachmentManager Test Template
**File:** `src/implementations/vintasend-implementation-template/src/__tests__/attachment-manager.test.ts`

```typescript
import { TemplateAttachmentManager } from '../attachment-manager';
import type { NotificationAttachment } from 'vintasend/dist/types/attachment';

describe('TemplateAttachmentManager', () => {
  let manager: TemplateAttachmentManager;

  beforeEach(() => {
    manager = new TemplateAttachmentManager();
  });

  describe('upload', () => {
    it('should upload an attachment and return stored metadata', async () => {
      // TODO: Implement test
      const attachment: NotificationAttachment = {
        file: Buffer.from('test content'),
        filename: 'test.txt',
        contentType: 'text/plain',
      };

      const stored = await manager.upload(attachment, 'notification-123');

      expect(stored.id).toBeDefined();
      expect(stored.filename).toBe('test.txt');
      expect(stored.contentType).toBe('text/plain');
      expect(stored.size).toBeGreaterThan(0);
      expect(stored.checksum).toBeDefined();
      expect(stored.file).toBeDefined();
    });

    it('should handle large files with streaming', async () => {
      // TODO: Test streaming for large files
    });

    it('should detect content type automatically', async () => {
      // TODO: Test content type detection
    });
  });

  describe('reconstructAttachmentFile', () => {
    it('should recreate AttachmentFile from storage metadata', () => {
      // TODO: Implement test
      const metadata = {
        bucket: 'test-bucket',
        key: 'test/file.txt',
      };

      const file = manager.reconstructAttachmentFile(metadata);

      expect(file).toBeDefined();
      expect(file.read).toBeDefined();
      expect(file.stream).toBeDefined();
      expect(file.url).toBeDefined();
      expect(file.delete).toBeDefined();
    });
  });

  describe('AttachmentFile', () => {
    it('should read file content', async () => {
      // TODO: Test file reading
    });

    it('should stream file content', async () => {
      // TODO: Test file streaming
    });

    it('should generate presigned URL', async () => {
      // TODO: Test URL generation
    });

    it('should delete file', async () => {
      // TODO: Test file deletion
    });
  });
});
```

#### 4.4 Update Template Documentation
**File:** `src/implementations/vintasend-implementation-template/README.md` (create if not exists)

```markdown
# VintaSend Implementation Template

This template provides a starting point for creating VintaSend implementations with custom storage backends, adapters, template renderers, and other components.

## Components

### AttachmentManager

The `TemplateAttachmentManager` provides a structure for implementing file attachment storage.

**Supported Storage Backends:**
- AWS S3 (see `vintasend-s3-attachments`)
- Azure Blob Storage
- Google Cloud Storage
- Local Filesystem (development only)
- Any S3-compatible storage (MinIO, DigitalOcean Spaces, etc.)

**Implementation Steps:**

1. Copy this template to a new package (e.g., `vintasend-s3-attachments`)
2. Rename `TemplateAttachmentManager` to your implementation name
3. Add storage-specific dependencies to `package.json`
4. Implement the required methods:
   - `upload()` - Upload file to your storage backend
   - `reconstructAttachmentFile()` - Recreate file accessor from metadata
5. Implement `AttachmentFile` interface for your storage
6. Write comprehensive tests
7. Document configuration options

**Example:**

See `src/implementations/vintasend-s3-attachments` for a complete AWS S3 implementation.

## Other Components

- **Adapter**: Email/SMS/Push notification sender
- **Backend**: Database persistence layer
- **Template Renderer**: Notification content rendering
- **Logger**: Logging implementation
```

**Test:** 
- Verify template compiles without errors
- Ensure all template files are properly structured
- Verify exports are correct

---

## Phase 5: Setup S3 AttachmentManager Project Structure

### Objectives
- Create project structure for vintasend-s3-attachments package
- Setup build configuration, tests, and dependencies
- Prepare for implementation based on template

### Tasks

#### 5.1 Create Package Directory Structure
```bash
mkdir -p src/implementations/vintasend-s3-attachments/src/__tests__
```

#### 5.2 Create package.json
**File:** `src/implementations/vintasend-s3-attachments/package.json`

```json
{
  "name": "vintasend-s3-attachments",
  "version": "0.1.0",
  "description": "AWS S3 attachment manager for VintaSend",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "prepublishOnly": "npm run build",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "files": [
    "dist"
  ],
  "keywords": [
    "vintasend",
    "s3",
    "attachments",
    "aws",
    "notifications"
  ],
  "author": "VintaSoft",
  "license": "MIT",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.670.0",
    "@aws-sdk/s3-request-presigner": "^3.670.0",
    "mime-types": "^2.1.35",
    "vintasend": "workspace:*"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/mime-types": "^2.1.4",
    "aws-sdk-client-mock": "^4.0.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.6",
    "typescript": "^5.8.2"
  },
  "peerDependencies": {
    "vintasend": "*"
  }
}
```

#### 5.3 Create TypeScript Configuration
**File:** `src/implementations/vintasend-s3-attachments/tsconfig.json`

```json
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

#### 5.4 Create Jest Configuration
**File:** `src/implementations/vintasend-s3-attachments/jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

#### 5.5 Create Biome Configuration
**File:** `src/implementations/vintasend-s3-attachments/biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": false,
    "ignore": ["node_modules", "dist", "coverage"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "always"
    }
  }
}
```

#### 5.6 Create README
**File:** `src/implementations/vintasend-s3-attachments/README.md`

```markdown
# VintaSend S3 Attachments

AWS S3 attachment manager for VintaSend. Provides production-ready file storage with presigned URLs and streaming support.

## Installation

```bash
npm install vintasend-s3-attachments
```

## Features

- ✅ Upload attachments to AWS S3
- ✅ Generate presigned URLs for secure access
- ✅ Stream large files efficiently
- ✅ Automatic content type detection
- ✅ Checksum verification
- ✅ Works with S3-compatible services (MinIO, DigitalOcean Spaces, etc.)

## Quick Start

```typescript
import { S3AttachmentManager } from 'vintasend-s3-attachments';
import { VintaSendFactory } from 'vintasend';

const attachmentManager = new S3AttachmentManager({
  bucket: 'my-app-notifications',
  region: 'us-east-1',
  keyPrefix: 'attachments/',
});

const vintaSend = factory.create(
  adapters,
  backend,
  logger,
  contextGenerators,
  queueService,
  attachmentManager,
);
```

## Configuration

### Options

- `bucket` (required): S3 bucket name
- `region` (required): AWS region
- `keyPrefix` (optional): Prefix for all S3 keys (e.g., 'attachments/')
- `credentials` (optional): AWS credentials (uses default chain if not provided)
- `endpoint` (optional): Custom endpoint for S3-compatible services

### AWS Credentials

The manager uses the standard AWS SDK credential chain:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. IAM roles (recommended for EC2/ECS/Lambda)
3. Credentials passed to constructor
4. AWS credentials file

## Usage

See main documentation for full examples.

## License

MIT
```

#### 5.7 Create Placeholder Implementation File
**File:** `src/implementations/vintasend-s3-attachments/src/s3-attachment-manager.ts`

```typescript
// Implementation will be added in Phase 6
export class S3AttachmentManager {
  // TODO: Implement in Phase 6
}
```

#### 5.8 Create Index File
**File:** `src/implementations/vintasend-s3-attachments/src/index.ts`

```typescript
export { S3AttachmentManager } from './s3-attachment-manager';
export type { S3AttachmentManagerConfig } from './s3-attachment-manager';
```

#### 5.9 Install Dependencies
```bash
cd src/implementations/vintasend-s3-attachments
npm install
```

**Test:**
- Verify project structure is correct
- Ensure TypeScript compiles (even with empty implementation)
- Verify jest configuration works
- Ensure all config files are valid

---

## Phase 6: Implement S3 AttachmentManager

### Objectives
- Create a production-ready S3 implementation for file storage
- Support presigned URLs for secure file access
- Handle streaming for large files efficiently

### Tasks

#### 6.1 Install Required Dependencies
Add AWS SDK to the project:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install --save-dev @types/node
```

#### 6.2 Create S3 AttachmentManager
**File:** `src/implementations/vintasend-s3-attachments/src/s3-attachment-manager.ts`

Implement S3-based storage:

```typescript
import { 
  S3Client, 
  PutObjectCommand, 
  GetObjectCommand, 
  DeleteObjectCommand,
  HeadObjectCommand 
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import * as crypto from 'crypto';

export interface S3AttachmentManagerConfig {
  bucket: string;
  region: string;
  keyPrefix?: string;  // Optional prefix for all keys (e.g., 'attachments/')
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  endpoint?: string;  // For S3-compatible services
}

export class S3AttachmentManager extends BaseAttachmentManager {
  private s3Client: S3Client;
  private bucket: string;
  private keyPrefix: string;

  constructor(config: S3AttachmentManagerConfig) {
    super();
    this.bucket = config.bucket;
    this.keyPrefix = config.keyPrefix || 'notifications/attachments/';
    
    this.s3Client = new S3Client({
      region: config.region,
      credentials: config.credentials,
      endpoint: config.endpoint,
    });
  }

  async upload(
    attachment: NotificationAttachment,
    notificationId: string,
  ): Promise<StoredAttachment> {
    // Generate unique key
    const attachmentId = crypto.randomUUID();
    const key = `${this.keyPrefix}${notificationId}/${attachmentId}/${attachment.filename}`;
    
    // Convert file to buffer if needed
    const buffer = await this.fileToBuffer(attachment.file);
    
    // Calculate metadata
    const checksum = this.calculateChecksum(buffer);
    const size = buffer.length;
    const contentType = attachment.contentType || this.detectContentType(attachment.filename);

    // Upload to S3
    const putCommand = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        'notification-id': notificationId,
        'attachment-id': attachmentId,
        'original-filename': attachment.filename,
        'checksum': checksum,
        'description': attachment.description || '',
      },
    });

    await this.s3Client.send(putCommand);

    return {
      id: attachmentId,
      filename: attachment.filename,
      contentType,
      size,
      checksum,
      createdAt: new Date(),
      file: new S3AttachmentFile(
        this.s3Client,
        this.bucket,
        key,
        attachmentId,
      ),
      description: attachment.description,
      storageMetadata: {
        bucket: this.bucket,
        key,
        region: this.s3Client.config.region,
      },
    };
  }

  async get(attachmentId: string): Promise<StoredAttachment | null> {
    // This requires storing attachment metadata in the database
    // The backend will reconstruct the StoredAttachment from database records
    throw new Error('Use backend.getAttachments() to retrieve stored attachments');
  }

  async delete(attachmentId: string): Promise<void> {
    // This requires knowing the S3 key from database
    // The backend should provide the key through storageMetadata
    throw new Error('Delete should be called through backend with full attachment metadata');
  }

  /**
   * Delete using full storage metadata (called by backend)
   */
  async deleteByKey(key: string): Promise<void> {
    const deleteCommand = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    await this.s3Client.send(deleteCommand);
  }

  /**
   * Reconstruct AttachmentFile from storage metadata
   */
  reconstructAttachmentFile(storageMetadata: Record<string, unknown>): AttachmentFile {
    return new S3AttachmentFile(
      this.s3Client,
      storageMetadata.bucket as string,
      storageMetadata.key as string,
      storageMetadata.attachmentId as string,
    );
  }

  private async fileToBuffer(file: FileAttachment): Promise<Buffer> {
    if (Buffer.isBuffer(file)) {
      return file;
    }
    if (file instanceof ReadableStream) {
      return this.streamToBuffer(file);
    }
    if (typeof file === 'string') {
      // Could be file path or URL - for now treat as file path
      const fs = await import('fs/promises');
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

class S3AttachmentFile implements AttachmentFile {
  constructor(
    private s3Client: S3Client,
    private bucket: string,
    private key: string,
    private attachmentId: string,
  ) {}

  async read(): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    // Convert stream to buffer
    const stream = response.Body as Readable;
    const chunks: Buffer[] = [];
    
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
  }

  async stream(): Promise<ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    });

    const response = await this.s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('Empty response body from S3');
    }

    // Convert Node.js Readable to Web ReadableStream
    const nodeStream = response.Body as Readable;
    
    return new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        nodeStream.on('end', () => {
          controller.close();
        });
        nodeStream.on('error', (err) => {
          controller.error(err);
        });
      },
    });
  }

  async url(expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async delete(): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    });

    await this.s3Client.send(command);
  }
}
```

**Package Files:**

`src/implementations/vintasend-s3-attachments/package.json`:
```json
{
  "name": "vintasend-s3-attachments",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "dependencies": {
    "@aws-sdk/client-s3": "^3.x.x",
    "@aws-sdk/s3-request-presigner": "^3.x.x",
    "vintasend": "workspace:*"
  },
  "peerDependencies": {
    "vintasend": "*"
  }
}
```

`src/implementations/vintasend-s3-attachments/src/index.ts`:
```typescript
export { S3AttachmentManager } from './s3-attachment-manager';
export type { S3AttachmentManagerConfig } from './s3-attachment-manager';
```

**Test:** `src/implementations/vintasend-s3-attachments/src/__tests__/s3-attachment-manager.test.ts`
- Test uploading various file types to S3
- Test file retrieval from S3
- Test file deletion from S3
- Test presigned URL generation
- Test checksum verification
- Test content type detection
- Test streaming large files
- Mock S3 client for unit tests
- Use LocalStack or S3 Mock for integration tests

---

## Phase 7: Update NotificationService

### Objectives
- Integrate AttachmentManager into VintaSend
- Pass attachments through the notification pipeline

### Tasks

#### 7.1 Inject AttachmentManager into VintaSend
**File:** `src/services/notification-service.ts`

Update constructor to accept AttachmentManager and pass it to backend:

```typescript
export class VintaSend<
  Config extends BaseNotificationTypeConfig,
  AdaptersList extends BaseNotificationAdapter<BaseNotificationTemplateRenderer<Config>, Config>[],
  Backend extends BaseNotificationBackend<Config>,
  Logger extends BaseLogger,
  QueueService extends BaseNotificationQueueService<Config>,
  AttachmentMgr extends BaseAttachmentManager,
> {
  constructor(
    private adapters: AdaptersList,
    private backend: Backend,
    private logger: Logger,
    contextGeneratorsMap: Config['ContextMap'],
    private queueService?: QueueService,
    private attachmentManager?: AttachmentMgr,
    private options: VintaSendOptions = {
      raiseErrorOnFailedSend: false,
    },
  ) {
    this.contextGeneratorsMap = new NotificationContextGeneratorsMap(contextGeneratorsMap);
    for (const adapter of adapters) {
      adapter.injectBackend(backend);
    }
    // Inject attachment manager into backend if both exist
    if (this.attachmentManager && 'injectAttachmentManager' in backend) {
      (backend as any).injectAttachmentManager(this.attachmentManager);
    }
  }

  async createNotification(
    notificationData: Omit<NotificationInput<Config>, 'id'>,
  ): Promise<DatabaseNotification<Config>> {
    // Attachments are now part of notificationData
    return this.backend.persistNotification(notificationData);
  }

  async createOneOffNotification(
    notificationData: Omit<OneOffNotificationInput<Config>, 'id'>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    // Attachments are now part of notificationData
    return this.backend.persistOneOffNotification(notificationData);
  }

  async updateNotification(
    notificationId: Config['NotificationIdType'],
    notificationData: Partial<Omit<NotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>> {
    // Attachments can be part of the update data
    return this.backend.persistNotificationUpdate(notificationId, notificationData);
  }
}
```

**Backend AttachmentManager Injection:**

```typescript
// Add to PrismaNotificationBackend class
export class PrismaNotificationBackend<Config extends BaseNotificationTypeConfig> {
  private attachmentManager?: BaseAttachmentManager;

  injectAttachmentManager(manager: BaseAttachmentManager): void {
    this.attachmentManager = manager;
  }
}
```

**Test:** `src/services/__tests__/notification-service-attachments.test.ts`
- Test creating notifications with attachments (as part of notification object)
- Test that attachments are passed to backend correctly
- Test error handling when AttachmentManager is missing but attachments are provided
- Test that notifications without attachments work normally

---

## Phase 8: Adapter Support for Attachments

### Objectives
- Update adapters to send attachments
- Implement attachment support in Nodemailer adapter

### Tasks

#### 8.1 Update Base Adapter Interface
**File:** `src/services/notification-adapters/base-notification-adapter.ts`

```typescript
export abstract class BaseNotificationAdapter<
  TemplateRenderer extends BaseNotificationTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> {
  // ... existing code

  /**
   * Check if this adapter supports attachments
   */
  get supportsAttachments(): boolean {
    return false;
  }

  /**
   * Prepare attachments for sending
   * Override in adapters that support attachments
   */
  protected async prepareAttachments(
    attachments: StoredAttachment[],
  ): Promise<unknown> {
    if (this.supportsAttachments && attachments.length > 0) {
      this.logger?.warn(`Adapter ${this.key} claims to support attachments but prepareAttachments is not implemented`);
    }
    return null;
  }
}
```

#### 8.2 Implement Nodemailer Attachment Support
**File:** `src/implementations/vintasend-nodemailer/src/nodemailer-notification-adapter.ts`

```typescript
export class NodemailerNotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationAdapter<TemplateRenderer, Config> {
  
  get supportsAttachments(): boolean {
    return true;
  }

  async send(
    notification: AnyDatabaseNotification<Config>,
    context: JsonObject,
  ): Promise<void> {
    // ... existing code

    const mailOptions: nodemailer.SendMailOptions = {
      to: recipientEmail,
      subject: template.subject,
      html: template.body,
    };

    // Add attachments if present
    if (notification.attachments && notification.attachments.length > 0) {
      mailOptions.attachments = await this.prepareAttachments(
        notification.attachments
      );
    }

    await this.transporter.sendMail(mailOptions);
  }

  protected async prepareAttachments(
    attachments: StoredAttachment[],
  ): Promise<nodemailer.Attachment[]> {
    return Promise.all(
      attachments.map(async (att) => ({
        filename: att.filename,
        content: await att.file.read(),
        contentType: att.contentType,
      }))
    );
  }
}
```

**Test:** `src/implementations/vintasend-nodemailer/src/__tests__/nodemailer-adapter-attachments.test.ts`
- Test sending emails with attachments
- Test multiple attachments
- Test attachment content is correctly formatted

---

## Phase 9: Integration Example

### Objectives
- Create a complete working example
- Document usage patterns

### Tasks

#### 9.1 Create Attachment Example
**File:** `src/examples/notification-with-attachments-example.ts`

```typescript
import { VintaSendFactory } from '../services/notification-service';
import { S3AttachmentManager } from '../implementations/vintasend-s3-attachments';
import { NotificationAttachment } from '../types/attachment';
import * as fs from 'fs';

async function example() {
  // Setup VintaSend with S3 AttachmentManager
  const attachmentManager = new S3AttachmentManager({
    bucket: 'my-app-notifications',
    region: 'us-east-1',
    keyPrefix: 'attachments/',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const vintaSend = factory.create(
    adapters,
    backend,
    logger,
    contextGenerators,
    queueService,
    attachmentManager,
  );

  // Create notification with attachments as part of the notification object
  const notification = await vintaSend.createNotification({
    userId: 1,
    notificationType: 'EMAIL',
    title: 'Invoice Ready',
    bodyTemplate: 'Your invoice is attached.',
    contextName: 'invoice',
    contextParameters: { invoiceId: 123 },
    sendAfter: null,
    subjectTemplate: 'Monthly Invoice',
    extraParams: null,
    attachments: [  // Attachments are now part of the notification object
      {
        file: fs.readFileSync('./invoice.pdf'),
        filename: 'invoice.pdf',
        contentType: 'application/pdf',
        description: 'Monthly invoice',
      },
    ],
  });

  await vintaSend.send(notification);

  // Get presigned URL for direct download
  const url = await notification.attachments![0].file.url(3600); // 1 hour expiry
  console.log('Download URL:', url);
}
```

#### 9.2 Update Next.js Example
**File:** `src/examples/nextjs-prisma-nodemailer-pug-temporal/src/lib/notification-attachments.ts`

Add attachment support to the Next.js example application with examples of:
- Uploading and attaching files inline
- Reusing uploaded files across notifications
- Managing common assets (logos, templates)

#### 9.3 Create Attachment Management Example
**File:** `src/examples/attachment-management-example.ts`

```typescript
import { VintaSendFactory } from '../services/notification-service';
import { S3AttachmentManager } from '../implementations/vintasend-s3-attachments';

async function attachmentManagementExample() {
  // ... setup vintaSend
  
  // Upload a file once for reuse
  const termsBuffer = fs.readFileSync('./terms-and-conditions.pdf');
  
  // First notification - uploads the terms PDF
  const notif1 = await vintaSend.createNotification({
    userId: 1,
    notificationType: 'EMAIL',
    title: 'Welcome',
    bodyTemplate: 'Please review the attached terms and conditions.',
    contextName: 'welcome',
    contextParameters: {},
    sendAfter: null,
    subjectTemplate: 'Welcome!',
    extraParams: null,
    attachments: [{
      file: termsBuffer,
      filename: 'terms-and-conditions.pdf',
      contentType: 'application/pdf',
    }],
  });
  
  const termsFileId = notif1.attachments![0].fileId;
  
  // Second notification - reuses the same terms PDF (no upload!)
  const notif2 = await vintaSend.createNotification({
    userId: 2,
    notificationType: 'EMAIL',
    title: 'Welcome',
    bodyTemplate: 'Please review the attached terms and conditions.',
    contextName: 'welcome',
    contextParameters: {},
    sendAfter: null,
    subjectTemplate: 'Welcome!',
    extraParams: null,
    attachments: [{
      fileId: termsFileId, // Reference existing file
    }],
  });
  
  // Clean up orphaned files
  const orphanedFiles = await backend.getOrphanedAttachmentFiles();
  console.log(`Found ${orphanedFiles.length} orphaned files`);
  
  for (const file of orphanedFiles) {
    await backend.deleteAttachmentFile(file.id);
  }
}
```

---

## Phase 10: Documentation and Polish

### Objectives
- Comprehensive documentation
- Migration guide
- Best practices

### Tasks

#### 10.1 Create Attachment Documentation
**File:** `ATTACHMENTS.md`

Document:
- How to use attachments with S3
- S3 configuration and setup
- IAM roles and permissions
- Creating custom AttachmentManagers for other storage backends
- Using S3-compatible storage (MinIO, DigitalOcean Spaces, etc.)
- Security considerations and best practices
- File size limits and optimization
- Supported formats
- Presigned URL usage
- Cost optimization tips

**Example sections:**
- **Quick Start with S3**
- **S3 Configuration Options**
- **Security Best Practices**
- **Using IAM Roles vs. Access Keys**
- **S3-Compatible Storage Providers**
- **Custom Storage Backends**
- **Troubleshooting**

#### 10.2 Update README
**File:** `README.md`

Add attachment section to main README with quick start example.

#### 10.3 Update CHANGELOG
**File:** `CHANGELOG.md`

Document the new attachment feature.

---

## Phase 11: Additional Features and Optimizations

### Objectives
- Enhance S3 implementation with advanced features
- Provide alternative storage implementations

### Tasks

#### 11.1 S3 Multipart Upload Support
**File:** `src/implementations/vintasend-s3-attachments/src/multipart-upload.ts`

Add support for large file uploads:
- Implement multipart upload for files > 5MB
- Add progress tracking callbacks
- Enable parallel chunk uploads
- Handle upload retries

#### 11.2 Local File AttachmentManager (Development/Testing)
**Package:** `src/services/attachment-manager/local-file-attachment-manager.ts`

Implement local filesystem storage for development:
- Simple file system-based storage
- Useful for development and testing
- No external dependencies
- Quick setup for prototyping

#### 11.3 Configure the example project to use local-stack

Configure the example project to use local-stack for emulating S3 so we can upload files without accessing the internet in development.

---

## Testing Strategy

### Unit Tests
- Each phase includes unit tests for new components
- Mock external dependencies (filesystem, network, database)
- Test error conditions and edge cases

### Integration Tests
- Test full flow from attachment upload to email sending
- Test with real Prisma database (test container)
- Test with real file system

### Performance Tests
- Test large file handling
- Test multiple attachments
- Test concurrent uploads

---

## Migration Guide

### For Existing Projects

1. **Update dependencies:**
   ```bash
   npm install vintasend@latest
   ```

2. **Update Prisma schema:**
   - Add Attachment model
   - Run migrations: `npx prisma migrate dev --name add-attachments`

3. **Setup S3 AttachmentManager:**
   ```typescript
   import { S3AttachmentManager } from 'vintasend-s3-attachments';

   const attachmentManager = new S3AttachmentManager({
     bucket: process.env.S3_BUCKET!,
     region: process.env.AWS_REGION || 'us-east-1',
     keyPrefix: 'notifications/attachments/',
   });

   const vintaSend = factory.create(
     adapters,
     backend,
     logger,
     contextGenerators,
     queueService,
     attachmentManager, // New parameter
   );
   ```

4. **Update notification creation:**
   ```typescript
   // Attachments are now part of the notification object
   await vintaSend.createNotification({
     userId: 1,
     notificationType: 'EMAIL',
     title: 'Invoice Ready',
     bodyTemplate: 'Your invoice is attached',
     contextName: 'invoice',
     contextParameters: { invoiceId: 123 },
     sendAfter: null,
     subjectTemplate: 'Monthly Invoice',
     extraParams: null,
     attachments: [  // Include attachments in the notification object
       {
         file: fileBuffer,
         filename: 'invoice.pdf',
         contentType: 'application/pdf',
       },
     ],
   });
   ```

5. **Configure AWS credentials:**
   - Set environment variables: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
   - Or use IAM roles (recommended for EC2/ECS/Lambda)
   - Or configure through AWS SDK default credential chain

6. **Setup S3 bucket:**
   ```bash
   # Create bucket
   aws s3 mb s3://my-app-notifications
   
   # Configure CORS if needed for direct browser access
   aws s3api put-bucket-cors --bucket my-app-notifications --cors-configuration file://cors.json
   
   # Setup lifecycle rules for cleanup
   aws s3api put-bucket-lifecycle-configuration --bucket my-app-notifications --lifecycle-configuration file://lifecycle.json
   ```

### Backward Compatibility
- All attachment parameters are optional
- Existing code continues to work without changes
- Attachments are only processed if AttachmentManager is provided

---

## Security Considerations

### File Validation
- Validate file types (whitelist approach)
- Check file sizes before upload
- Scan for malware (integration point)

### Access Control
- Attachments should only be accessible by authorized users
- Implement expiring URLs for sensitive files
- Log attachment access

### Storage Security
- Encrypt files at rest (S3 server-side encryption)
- Use secure connection for uploads/downloads (HTTPS)
- Implement proper IAM policies for S3 bucket access
- Use presigned URLs with short expiration times
- Enable S3 bucket versioning for audit trails
- Configure S3 bucket policies to restrict access

**Example S3 Bucket Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowApplicationAccess",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT-ID:role/application-role"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::my-app-notifications/notifications/attachments/*"
    }
  ]
}
```

**Example IAM Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-notifications/notifications/attachments/*",
        "arn:aws:s3:::my-app-notifications"
      ]
    }
  ]
}
```

---

## Performance Considerations

### File Size Limits
- Define maximum file size per attachment
- Define maximum total size per notification
- Use streaming for large files

### Caching
- Cache frequently accessed files
- Use CDN for public attachments
- Implement proper cache headers

### Cleanup
- Implement periodic cleanup of orphaned files
- Delete attachments when notifications are deleted (Prisma CASCADE)
- Use S3 lifecycle policies to archive/delete old attachments automatically

**Example S3 Lifecycle Policy:**
```json
{
  "Rules": [
    {
      "Id": "ArchiveOldAttachments",
      "Status": "Enabled",
      "Prefix": "notifications/attachments/",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 180,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

---

## Success Criteria

### Phase Completion Criteria
Each phase is complete when:
- ✅ All code is implemented
- ✅ All tests pass with >80% coverage
- ✅ Code review is approved
- ✅ Documentation is updated
- ✅ Example code works correctly

### Overall Success Criteria
- ✅ Attachments can be uploaded and stored
- ✅ Attachments are sent correctly via email adapter
- ✅ All existing functionality continues to work
- ✅ Performance is acceptable (< 2s for 5MB file)
- ✅ Documentation is clear and complete

---

## Timeline Estimate

- **Phase 1:** 1-2 days (Types and interfaces)
- **Phase 2:** 1 day (Update notification types)
- **Phase 3:** 2-3 days (Backend integration)
- **Phase 4:** 1-2 days (Update implementation template)
- **Phase 5:** 0.5-1 day (Setup S3 project structure)
- **Phase 6:** 2-3 days (S3 AttachmentManager implementation with presigned URLs and streaming)
- **Phase 7:** 1-2 days (Service integration)
- **Phase 8:** 2-3 days (Adapter support)
- **Phase 9:** 1-2 days (Examples)
- **Phase 10:** 2-3 days (Documentation including S3 setup guides)
- **Phase 11:** 2-3 days for multipart uploads, 2-3 days per additional storage backend (Optional)

**Total Core Implementation (with S3):** 14-22 days
**With Optional Features:** 18-31 days

**Note:** Phases 4 and 5 can be done in parallel or before starting Phase 3, as they focus on project scaffolding and don't depend on core implementation.

---

## Dependencies

### Required Packages
```json
{
  "dependencies": {
    "mime-types": "^2.1.35",
    "@aws-sdk/client-s3": "^3.x.x",
    "@aws-sdk/s3-request-presigner": "^3.x.x"
  },
  "devDependencies": {
    "@types/mime-types": "^2.1.1"
  }
}
```

### Optional Packages (for alternative implementations)
- `@azure/storage-blob` - For Azure implementation
- `@google-cloud/storage` - For GCS implementation

### Testing Dependencies
```json
{
  "devDependencies": {
    "aws-sdk-client-mock": "^3.x.x",
    "testcontainers": "^10.x.x"  // For LocalStack integration tests
  }
}
```

---

## Notes

- This plan is inspired by the Python implementation but adapted for TypeScript patterns
- Each phase builds on previous phases - order matters
- Tests should be written alongside implementation, not after
