# Attachment Support in VintaSend-TS

VintaSend-TS provides comprehensive support for file attachments in notifications with an extensible architecture that supports multiple storage backends.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Usage Examples](#usage-examples)
- [Storage Backend Implementations](#storage-backend-implementations)
- [Creating Custom Storage Backends](#creating-custom-storage-backends)
- [Security Best Practices](#security-best-practices)
- [Performance Optimization](#performance-optimization)
- [Adapter Support](#adapter-support)

---

## Quick Start

### 1. Install Dependencies

```bash
# Install core packages
npm install vintasend vintasend-prisma

# Install an attachment manager implementation (example: S3)
npm install vintasend-aws-s3-attachments

# Install adapter with attachment support (example: Nodemailer)
npm install vintasend-nodemailer
```

### 2. Configure Storage Backend

Choose and configure a storage backend implementation. See [Storage Backend Implementations](#storage-backend-implementations) for available options and their specific setup instructions.

```typescript
// Example: Using S3 AttachmentManager
import { S3AttachmentManager } from 'vintasend-aws-s3-attachments';

const attachmentManager = new S3AttachmentManager({
  // Configuration specific to your chosen backend
  // See backend-specific documentation for details
});
```

### 3. Configure VintaSend with Attachments

```typescript
import { VintaSendFactory } from 'vintasend';

// Create notification system with attachment support
const factory = new VintaSendFactory(notificationTypesConfig);
const vintaSend = factory.create(
  adapters,
  backend,
  templateRenderer,
  contextGeneratorsMap,
  logger,
  attachmentManager, // Pass your attachment manager here
  options,
);
```

### 4. Send Notifications with Attachments

### 4. Send Notifications with Attachments

```typescript
// Send notification with inline file upload
await vintaSend.sendNotification({
  notificationTypeId: 'order-confirmation',
  userId: '123',
  context: { orderNumber: 'ORD-12345' },
  attachments: [
    {
      file: Buffer.from('Invoice content'),
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    },
  ],
});

// Send notification with pre-uploaded file reference
await vintaSend.sendNotification({
  notificationTypeId: 'welcome-email',
  userId: '456',
  context: { userName: 'John' },
  attachments: [
    {
      fileId: 'file-abc-123', // Reference to pre-uploaded file
      description: 'Company brochure',
    },
  ],
});
```

---

## Architecture Overview

### Components

1. **AttachmentManager** - Handles file storage operations (upload, download, delete)
2. **Backend** - Manages attachment metadata in the database
3. **Adapter** - Sends attachments via notification channels (email, etc.)

### Data Flow

```
User → VintaSend → Backend → AttachmentManager → Storage Backend
                ↓
             Adapter → Email/SMS/Push
```

### Reusable Attachments

Files are stored once and referenced multiple times:

- **AttachmentFile** table stores file metadata and storage location
- **NotificationAttachment** join table links notifications to files
- Same file can be attached to thousands of notifications
- Automatic deduplication via SHA-256 checksums

### Benefits

- **Cost Savings** - Store common files (PDFs, images) only once
- **Performance** - Pre-upload frequently used files
- **Consistency** - Same file version across all notifications
- **Efficiency** - Bulk operations with shared attachments

### Database Schema

When using Prisma backend, you need two models:

```prisma
// Reusable attachment files (stored once, referenced many times)
model AttachmentFile {
  id                String                  @id @default(uuid())
  filename          String
  contentType       String
  size              Int
  checksum          String
  storageMetadata   Json
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt
  attachments       NotificationAttachment[]
  
  @@index([checksum])
}

// Join table linking notifications to attachment files
model NotificationAttachment {
  id              String          @id @default(uuid())
  notificationId  String
  fileId          String
  description     String?
  notification    Notification    @relation(fields: [notificationId], references: [id], onDelete: Cascade)
  file            AttachmentFile  @relation(fields: [fileId], references: [id], onDelete: Restrict)
  createdAt       DateTime        @default(now())
  
  @@unique([notificationId, fileId])
  @@index([notificationId])
  @@index([fileId])
}

model Notification {
  // ... existing fields
  attachments     NotificationAttachment[]
}
```

### Backend Implementation Requirements

**Important:** The attachment-related methods in `BaseNotificationBackend` are **optional**. This means existing backend implementations don't need to implement them unless they want to support attachments.

#### Optional Methods

The following methods are optional and only needed if your backend supports attachments:

- `getAttachmentFile(fileId: string): Promise<AttachmentFileRecord | null>`
- `findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null>`
- `deleteAttachmentFile(fileId: string): Promise<void>`
- `getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]>`
- `getAttachments(notificationId): Promise<StoredAttachment[]>`
- `deleteNotificationAttachment(notificationId, attachmentId): Promise<void>`

#### Checking for Attachment Support

Use the `supportsAttachments` type guard to check if a backend implements attachment methods:

```typescript
import { supportsAttachments } from 'vintasend';

if (supportsAttachments(backend)) {
  // Backend supports attachments - safe to call attachment methods
  const orphanedFiles = await backend.getOrphanedAttachmentFiles();
  for (const file of orphanedFiles) {
    await backend.deleteAttachmentFile(file.id);
  }
} else {
  // Backend doesn't support attachments
  console.warn('Attachment operations not supported by this backend');
}
```

#### Implementing Attachment Support

If you want to add attachment support to your backend, implement all six methods. See the [PrismaNotificationBackend](src/implementations/vintasend-prisma/src/prisma-notification-backend.ts) for a complete reference implementation.

---

## Usage Examples

### Inline File Upload

Upload a file directly when sending a notification:

```typescript
import * as fs from 'fs';

await vintaSend.sendNotification({
  notificationTypeId: 'invoice-ready',
  userId: '123',
  context: { invoiceNumber: 'INV-001' },
  attachments: [
    {
      file: fs.readFileSync('/path/to/invoice.pdf'),
      filename: 'invoice-INV-001.pdf',
      contentType: 'application/pdf',
      description: 'Your invoice for January',
    },
  ],
});
```

### Pre-Upload Reusable Files

Upload files once, reference multiple times:

```typescript
// Upload a common file (e.g., company brochure) via AttachmentManager
const buffer = fs.readFileSync('/path/to/brochure.pdf');
const checksum = await attachmentManager.calculateChecksum(buffer);
const uploadResult = await attachmentManager.uploadFile(buffer, 'company-brochure.pdf');

// Store metadata in database via backend
const fileRecord = await backend.createAttachmentFile({
  filename: 'company-brochure.pdf',
  contentType: 'application/pdf',
  size: buffer.length,
  checksum: checksum,
  storageMetadata: uploadResult.storageMetadata,
});

// Reference it in multiple notifications
await vintaSend.sendNotification({
  notificationTypeId: 'welcome-email',
  userId: '123',
  attachments: [
    {
      fileId: fileRecord.id,
      description: 'Learn more about our company',
    },
  ],
});

await vintaSend.sendNotification({
  notificationTypeId: 'welcome-email',
  userId: '456',
  attachments: [
    {
      fileId: fileRecord.id, // Same file, different notification
    },
  ],
});
```

### Multiple Attachments

Attach multiple files to a single notification:

```typescript
await vintaSend.sendNotification({
  notificationTypeId: 'order-confirmation',
  userId: '123',
  context: { orderNumber: 'ORD-12345' },
  attachments: [
    {
      file: invoiceBuffer,
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    },
    {
      file: receiptBuffer,
      filename: 'receipt.pdf',
      contentType: 'application/pdf',
    },
    {
      fileId: 'terms-conditions-file-id', // Pre-uploaded file
      description: 'Terms and Conditions',
    },
  ],
});
```

### Streaming Large Files

Use streams for efficient memory usage:

```typescript
import { createReadStream } from 'fs';

await vintaSend.sendNotification({
  notificationTypeId: 'report-ready',
  userId: '123',
  context: { reportName: 'Annual Report 2024' },
  attachments: [
    {
      file: createReadStream('/path/to/large-report.pdf'),
      filename: 'annual-report-2024.pdf',
      contentType: 'application/pdf',
    },
  ],
});
```

### Accessing Attachment URLs

Get presigned URLs for secure file access:

```typescript
const notification = await backend.getNotification('notification-id');

if (notification.attachments) {
  for (const attachment of notification.attachments) {
    const url = await attachment.file.url();
    console.log(`Download URL (expires in 1 hour): ${url}`);
  }
}
```

### Automatic Deduplication

Files with identical content are automatically deduplicated:

```typescript
// Upload file 1
await vintaSend.sendNotification({
  notificationTypeId: 'test',
  userId: '123',
  attachments: [
    {
      file: Buffer.from('Same content'),
      filename: 'file1.txt',
    },
  ],
});

// Upload file 2 (same content, different filename)
await vintaSend.sendNotification({
  notificationTypeId: 'test',
  userId: '456',
  attachments: [
    {
      file: Buffer.from('Same content'),
      filename: 'file2.txt', // Different name, same content
    },
  ],
});

// Only one file stored in storage backend!
// Both notifications reference the same AttachmentFile record
```

### Cleaning Up Orphaned Files

Remove files not attached to any notification:

```typescript
// Find orphaned files
const orphanedFiles = await backend.getOrphanedAttachmentFiles();

console.log(`Found ${orphanedFiles.length} orphaned files`);

// Delete them
for (const file of orphanedFiles) {
  await attachmentManager.deleteFile(file.storageMetadata);
  await backend.deleteAttachmentFile(file.id);
}
```

---

## Storage Backend Implementations

VintaSend supports multiple storage backend implementations. Choose the one that best fits your infrastructure:

### Available Implementations

#### AWS S3 - `vintasend-aws-s3-attachments`
Production-ready storage using AWS S3 with presigned URLs and streaming support.

- **Use Case**: Production applications, scalable cloud storage
- **Features**: Presigned URLs, streaming, S3-compatible services
- **Documentation**: See [vintasend-aws-s3-attachments README](src/implementations/vintasend-aws-s3-attachments/README.md)

**Installation:**
```bash
npm install vintasend-aws-s3-attachments
```

**Quick Setup:**
```typescript
import { S3AttachmentManager } from 'vintasend-aws-s3-attachments';

const attachmentManager = new S3AttachmentManager({
  bucket: 'my-bucket',
  region: 'us-east-1',
});
```

#### Custom Implementations

You can create custom storage backends for:
- **Azure Blob Storage** - Microsoft Azure cloud storage
- **Google Cloud Storage** - Google Cloud Platform storage
- **Local Filesystem** - Development and testing
- **MinIO** - Self-hosted S3-compatible storage
- **Any other storage service**

See [Creating Custom Storage Backends](#creating-custom-storage-backends) for implementation guide.

---

## Creating Custom Storage Backends

### Implementation Template

See [src/implementations/vintasend-implementation-template/src/attachment-manager.ts](src/implementations/vintasend-implementation-template/src/attachment-manager.ts) for a complete template with detailed TODO comments.

### Required Methods

Your custom `AttachmentManager` must implement:

```typescript
import { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';
import type { AttachmentFile } from 'vintasend/dist/types/attachment';

export class MyAttachmentManager extends BaseAttachmentManager {
  /**
   * Upload a file to storage
   * @returns fileId and storageMetadata for database record
   */
  async uploadFile(
    file: Buffer | ReadableStream,
    filename: string,
    contentType?: string
  ): Promise<{
    fileId: string;
    storageMetadata: Record<string, unknown>;
  }> {
    // Implementation: Upload to your storage backend
    // Return unique fileId and metadata needed to retrieve file later
  }

  /**
   * Delete a file from storage
   */
  async deleteFile(storageMetadata: Record<string, unknown>): Promise<void> {
    // Implementation: Delete from your storage backend using metadata
  }

  /**
   * Reconstruct an AttachmentFile accessor from storage metadata
   */
  async reconstructAttachmentFile(
    storageMetadata: Record<string, unknown>
  ): Promise<AttachmentFile> {
    // Implementation: Return an AttachmentFile instance that can
    // read(), stream(), url(), and delete() the file
    return new MyAttachmentFile(storageMetadata);
  }
}

/**
 * AttachmentFile implementation for your storage backend
 */
class MyAttachmentFile implements AttachmentFile {
  constructor(private metadata: Record<string, unknown>) {}

  async read(): Promise<Buffer> {
    // Return file contents as Buffer
  }

  async stream(): Promise<ReadableStream> {
    // Return file contents as stream
  }

  async url(): Promise<string> {
    // Return URL for accessing file (e.g., presigned URL)
  }

  async delete(): Promise<void> {
    // Delete file from storage
  }
}
```

### Optional Utility Methods

You can override these utility methods from `BaseAttachmentManager`:

- `detectContentType(filename: string): string` - MIME type detection
- `calculateChecksum(file: Buffer | ReadableStream): Promise<string>` - SHA-256 checksum
- `fileToBuffer(file: FileAttachment): Promise<Buffer>` - Convert various file formats to Buffer

### Example: Azure Blob Storage

```typescript
import { BaseAttachmentManager } from 'vintasend/dist/services/attachment-manager/base-attachment-manager';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';

export class AzureBlobAttachmentManager extends BaseAttachmentManager {
  private containerClient: ContainerClient;

  constructor(config: { connectionString: string; containerName: string }) {
    super();
    this.containerClient = new BlobServiceClient(
      config.connectionString
    ).getContainerClient(config.containerName);
  }

  async uploadFile(
    file: Buffer | ReadableStream,
    filename: string,
    contentType?: string
  ): Promise<{ fileId: string; storageMetadata: Record<string, unknown> }> {
    const blobName = `${Date.now()}-${filename}`;
    const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
    
    const buffer = file instanceof Buffer ? file : await this.fileToBuffer(file);
    
    await blockBlobClient.upload(buffer, buffer.length, {
      blobHTTPHeaders: {
        blobContentType: contentType || this.detectContentType(filename),
      },
    });

    return {
      fileId: blobName,
      storageMetadata: {
        containerName: this.containerClient.containerName,
        blobName,
      },
    };
  }

  // ... implement other required methods
}
```

---

## Security Best Practices

### 1. Use Secure Authentication

### 1. Use Secure Authentication

Use managed identities, service accounts, or IAM roles when possible instead of hardcoded credentials.

**❌ Avoid:**
```typescript
const attachmentManager = new MyAttachmentManager({
  apiKey: 'hardcoded-secret-key',
});
```

**✅ Prefer:**
```typescript
// Use environment variables or managed identities
const attachmentManager = new MyAttachmentManager({
  apiKey: process.env.STORAGE_API_KEY,
  // Or let the SDK use managed identities automatically
});
```

### 2. Enable Encryption at Rest

Ensure your storage backend encrypts files at rest. Most cloud providers offer server-side encryption options.

### 3. Use Time-Limited Access URLs

When generating URLs for file access, use short expiration times:

```typescript
// Configure short expiration in your AttachmentManager
const attachmentManager = new MyAttachmentManager({
  urlExpirationSeconds: 900, // 15 minutes
});
```

### 4. Validate File Types

```typescript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'text/plain',
];

function validateAttachment(attachment: NotificationAttachmentUpload) {
  if (!ALLOWED_MIME_TYPES.includes(attachment.contentType)) {
    throw new Error(`Invalid file type: ${attachment.contentType}`);
  }
}
```

### 5. Enforce File Size Limits

```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

async function validateFileSize(file: FileAttachment) {
  const buffer = await attachmentManager.fileToBuffer(file);
  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${buffer.length} bytes`);
  }
}
```

### 6. Enable Versioning and Audit Logs

Configure your storage backend to:
- Maintain file version history
- Log all access operations
- Enable audit trails

### 7. Block Public Access

Ensure files are not publicly accessible without authorization:
- Configure bucket/container policies to deny public access
- Use presigned/time-limited URLs for access
- Implement access control checks

### 8. Scan for Malware

Integrate virus scanning before storing files:

```typescript
import { scanFile } from 'some-virus-scanner';

async function uploadWithScan(file: FileAttachment, filename: string) {
  const buffer = await attachmentManager.fileToBuffer(file);
  
  const scanResult = await scanFile(buffer);
  if (!scanResult.clean) {
    throw new Error('File failed virus scan');
  }
  
  // Proceed with upload
  return attachmentManager.uploadFile(buffer, filename);
}
```

### 9. Implement Rate Limiting

Prevent abuse:

```typescript
import rateLimit from 'express-rate-limit';

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 uploads per 15 minutes
  message: 'Too many uploads, please try again later',
});

app.post('/api/upload', uploadLimiter, async (req, res) => {
  // Handle upload
});
```

### 10. Sanitize Filenames

Ensure filenames don't contain path traversal or malicious characters:

```typescript
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 255);
}
```

---

## Performance Optimization

### 1. Pre-Upload Common Assets

Upload frequently used files once:

```typescript
// At application startup
const logoBuffer = fs.readFileSync('/path/to/logo.png');
const checksum = await attachmentManager.calculateChecksum(logoBuffer);
const uploadResult = await attachmentManager.uploadFile(logoBuffer, 'company-logo.png');

const logoFile = await backend.createAttachmentFile({
  filename: 'company-logo.png',
  contentType: 'image/png',
  size: logoBuffer.length,
  checksum,
  storageMetadata: uploadResult.storageMetadata,
});

// Store file ID in config/database
config.commonAssets.logoFileId = logoFile.id;

// Reference in notifications
await vintaSend.sendNotification({
  notificationTypeId: 'welcome',
  userId: '123',
  attachments: [
    { fileId: config.commonAssets.logoFileId },
  ],
});
```

### 2. Use Streaming for Large Files

Avoid loading entire files into memory:

```typescript
import { createReadStream } from 'fs';

// Stream large file instead of reading into buffer
const fileStream = createReadStream('/path/to/large-file.pdf');

await vintaSend.sendNotification({
  notificationTypeId: 'report',
  userId: '123',
  attachments: [
    {
      file: fileStream,
      filename: 'report.pdf',
      contentType: 'application/pdf',
    },
  ],
});
```

### 3. Use CDN for Public Attachments

If attachments are public, serve them via CDN for better performance and lower storage costs.

### 4. Implement Caching

Cache frequently accessed attachment metadata:

```typescript
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 600 }); // 10 minutes

async function getCachedAttachment(fileId: string) {
  const cached = cache.get(fileId);
  if (cached) return cached;
  
  const file = await backend.getAttachmentFile(fileId);
  cache.set(fileId, file);
  return file;
}
```

### 5. Batch Operations

Upload multiple files in parallel:

```typescript
const files = [
  { buffer: file1Buffer, filename: 'file1.pdf' },
  { buffer: file2Buffer, filename: 'file2.pdf' },
  { buffer: file3Buffer, filename: 'file3.pdf' },
];

const uploadResults = await Promise.all(
  files.map(f => attachmentManager.uploadFile(f.buffer, f.filename))
);
```

### 6. Implement Lifecycle Policies

Configure your storage backend to automatically:
- Archive old files to cheaper storage tiers
- Delete files after a retention period
- Transition files based on access patterns

### 7. Compress Files Before Upload

Reduce storage and bandwidth costs:

```typescript
import sharp from 'sharp';

// Compress images
const compressedImage = await sharp(imageBuffer)
  .resize(1920, 1080, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toBuffer();

await attachmentManager.uploadFile(compressedImage, 'image.jpg');
```

### 8. Monitor Storage Usage

Track storage metrics:
- Total files stored
- Total storage size
- Upload/download patterns
- Orphaned files count

```typescript
async function getStorageStats() {
  const allFiles = await backend.getAllAttachmentFiles();
  
  return {
    totalFiles: allFiles.length,
    totalSize: allFiles.reduce((sum, f) => sum + f.size, 0),
    orphanedFiles: (await backend.getOrphanedAttachmentFiles()).length,
  };
}
```

---

## Adapter Support

### Email Adapters

Adapters that support attachments implement the `prepareAttachments()` method to convert StoredAttachment objects to their specific format.

#### Nodemailer Adapter

The Nodemailer adapter (`vintasend-nodemailer`) supports attachments out of the box:

```typescript
import { NodemailerNotificationAdapter } from 'vintasend-nodemailer';

// Adapter automatically handles attachments when sending emails
const adapter = new NodemailerNotificationAdapter(
  templateRenderer,
  transporter,
  defaultFrom
);

// Attachments are automatically included when you send notifications
await vintaSend.sendNotification({
  notificationTypeId: 'invoice',
  userId: '123',
  context: { invoiceNumber: 'INV-001' },
  attachments: [
    {
      file: invoicePdfBuffer,
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    },
  ],
});
// Email will be sent with PDF attached
```

### Creating Adapters with Attachment Support

To add attachment support to a custom adapter:

```typescript
import { BaseNotificationAdapter } from 'vintasend';
import type { StoredAttachment } from 'vintasend/dist/types/attachment';

export class MyAdapter extends BaseNotificationAdapter {
  // Declare that this adapter supports attachments
  get supportsAttachments(): boolean {
    return true;
  }

  // Convert StoredAttachment to adapter-specific format
  async prepareAttachments(attachments: StoredAttachment[]): Promise<MyAdapterAttachment[]> {
    return Promise.all(
      attachments.map(async (attachment) => ({
        filename: attachment.filename,
        content: await attachment.file.read(), // Read file as Buffer
        contentType: attachment.contentType,
        // ... other adapter-specific fields
      }))
    );
  }

  async send(notification: DatabaseNotification, renderedContent: RenderedContent): Promise<void> {
    const message = {
      // ... message fields
    };

    // Add attachments if present
    if (notification.attachments && notification.attachments.length > 0) {
      message.attachments = await this.prepareAttachments(notification.attachments);
    }

    // Send via your service
    await this.service.send(message);
  }
}
```

---

## Additional Resources

- [VintaSend Core Documentation](README.md)
- [VintaSend Examples](src/examples/)
- [Implementation Template](src/implementations/vintasend-implementation-template/)
- [S3 AttachmentManager Documentation](src/implementations/vintasend-aws-s3-attachments/README.md)

---

## Support

For issues and questions:

- GitHub Issues: [https://github.com/vintasoftware/vintasend-ts/issues](https://github.com/vintasoftware/vintasend-ts/issues)
- Documentation: [https://github.com/vintasoftware/vintasend-ts](https://github.com/vintasoftware/vintasend-ts)

---

## License

MIT License - see [LICENSE](LICENSE) file for details.
