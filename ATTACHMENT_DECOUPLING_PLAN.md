# Attachment Decoupling Plan: MedplumBackend

## Problem Statement

The `MedplumNotificationBackend` has significant Medplum-specific attachment logic that creates **tight coupling** with `MedplumAttachmentManager`. This prevents using other attachment managers like `S3AttachmentManager`.

## Goal

Decouple attachment storage logic so that:
- Any backend (Prisma, Medplum, etc.) can work with any attachment manager (S3, Medplum, local filesystem)
- **Backends** are responsible for **database storage** (notification data + file metadata/identifiers)
- **AttachmentManagers** are responsible for **file storage** only (upload, download, delete files)
- AttachmentManagers provide **storage identifiers** that backends can persist and use later for reconstruction

---

## Key Architecture Principle

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              VintaSend                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────────────┐          ┌──────────────────────┐            │
│   │       Backend        │          │  AttachmentManager   │            │
│   │  (Database Storage)  │          │   (File Storage)     │            │
│   ├──────────────────────┤          ├──────────────────────┤            │
│   │ • Notifications      │          │ • Upload files       │            │
│   │ • File metadata      │◄────────►│ • Download files     │            │
│   │ • Storage identifiers│          │ • Delete files       │            │
│   │ • Checksums          │          │ • Generate URLs      │            │
│   │ • Deduplication      │          │                      │            │
│   └──────────────────────┘          └──────────────────────┘            │
│            │                                   │                        │
│            ▼                                   ▼                        │
│   ┌──────────────────────┐          ┌──────────────────────┐            │
│   │  Prisma / Medplum /  │          │   S3 / Medplum /     │            │
│   │  Any Database        │          │   Local Filesystem   │            │
│   └──────────────────────┘          └──────────────────────┘            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Flow:**
1. **Upload:** AttachmentManager uploads file → returns `storageIdentifiers`
2. **Store:** Backend persists `storageIdentifiers` + file metadata in its database
3. **Retrieve:** Backend reads `storageIdentifiers` from database
4. **Reconstruct:** Backend passes `storageIdentifiers` to AttachmentManager → gets file access

---

## Identified Coupling Points

### 1. Hard-coded Medplum FHIR storage format (Lines 759-865)

The backend stores attachments as **FHIR Media resources** that reference **FHIR Binary resources**:

```typescript
// In processAttachments() - creates FHIR-specific payload
payload.push({
  contentAttachment: {
    ...fhirAttachment,
    url: `Media/${record.id}`,  // Medplum-specific URL format
    title: description || record.filename,
  },
});
```

The `storageMetadata` structure expected is Medplum-specific:
- `url: "Binary/{id}"`
- `binaryId: string`
- `creation: string`

### 2. mediaToAttachmentFileRecord() (Lines 621-665)

Assumes FHIR Media resource structure with specific identifier systems:
- `http://vintasend.com/fhir/binary-id`
- `http://vintasend.com/fhir/attachment-checksum`

S3AttachmentManager uses completely different structure:
- `bucket: string`
- `key: string`
- `region: string`

### 3. getAttachmentFile() (Lines 690-696)

Directly reads from Medplum's Media resources instead of delegating to attachment manager:

```typescript
const media = await this.medplum.readResource('Media', fileId);
```

### 4. findAttachmentFileByChecksum() (Lines 699-714)

Searches Medplum-specific FHIR resources:

```typescript
const results = await this.medplum.searchResources(
  'Media',
  `identifier=${checksum}&_tag=attachment-file`
);
```

### 5. deleteAttachmentFile() (Lines 868-905)

Deletes Medplum-specific resources (Media and Binary):

```typescript
await this.medplum.deleteResource('Binary', binaryId);
await this.medplum.deleteResource('Media', fileId);
```

### 6. getOrphanedAttachmentFiles() (Lines 908-937)

Queries Medplum-specific resources:

```typescript
const allMedia = await this.medplum.searchResources('Media', {
  _tag: 'attachment-file',
});
```

### 7. getAttachments() (Lines 940-1015)

Extracts from FHIR Communication payload with Medplum-specific URL patterns:

```typescript
const match = attachment.url.match(/Media\/([^/]+)/);
```

### 8. Duplicated fileToBuffer() (Lines 582-616)

This method duplicates `BaseAttachmentManager.fileToBuffer()`.

---

## Why S3AttachmentManager Won't Work Currently

| Feature | MedplumBackend Expects | S3AttachmentManager Provides |
|---------|------------------------|------------------------------|
| File ID storage | `Media/{id}` references | UUID-based keys |
| Storage metadata | `{ url, binaryId, creation }` | `{ bucket, key, region }` |
| File lookup | `medplum.readResource('Media', id)` | S3 HeadObject + ListObjects |
| Checksum search | FHIR identifier search | Not supported (no database) |
| URL format | `Binary/{id}` | S3 presigned URLs |

---

## Refactoring Plan

### Phase 1: Define Storage Identifiers Type

**File:** `src/types/attachment.ts`

Create a **generic** base interface. Each AttachmentManager implementation defines its own specific type:

```typescript
/**
 * Generic storage identifiers returned by AttachmentManagers.
 * Backends persist these as opaque data and pass them back for file reconstruction.
 * Each AttachmentManager implementation defines its own specific structure.
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
  storageIdentifiers: StorageIdentifiers;
}
```

**Implementation-specific types** (defined in each package):

**File:** `src/implementations/vintasend-medplum/src/types.ts`

```typescript
import type { StorageIdentifiers } from 'vintasend/dist/types/attachment';

/**
 * Medplum-specific storage identifiers.
 * Contains references to FHIR Binary and Media resources.
 */
export interface MedplumStorageIdentifiers extends StorageIdentifiers {
  id: string;
  medplumBinaryId: string;
  medplumMediaId: string;
  url: string; // Binary/{id}
}
```

**File:** `src/implementations/vintasend-aws-s3-attachments/src/types.ts`

```typescript
import type { StorageIdentifiers } from 'vintasend/dist/types/attachment';

/**
 * AWS S3-specific storage identifiers.
 * Contains S3 bucket, key, and region information.
 */
export interface S3StorageIdentifiers extends StorageIdentifiers {
  id: string;
  awsS3Bucket: string;
  awsS3Key: string;
  awsS3Region: string;
}
```

#### Phase 1 Testing

**Create type tests to verify the new interfaces:**

**File:** `src/types/__tests__/attachment.test.ts`

```typescript
import type { StorageIdentifiers, AttachmentFileRecord } from '../attachment';

describe('StorageIdentifiers', () => {
  it('should allow id field', () => {
    const ids: StorageIdentifiers = { id: 'test-123' };
    expect(ids.id).toBe('test-123');
  });

  it('should allow arbitrary fields', () => {
    const ids: StorageIdentifiers = {
      id: 'test-123',
      customField: 'value',
      anotherField: 42,
    };
    expect(ids.customField).toBe('value');
  });
});

describe('AttachmentFileRecord', () => {
  it('should have all required fields', () => {
    const record: AttachmentFileRecord = {
      id: 'file-123',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      size: 1024,
      checksum: 'abc123',
      createdAt: new Date(),
      updatedAt: new Date(),
      storageIdentifiers: { id: 'file-123' },
    };
    expect(record.storageIdentifiers.id).toBe('file-123');
  });
});
```

**File:** `src/implementations/vintasend-medplum/__tests__/types.test.ts`

```typescript
import type { MedplumStorageIdentifiers } from '../src/types';

describe('MedplumStorageIdentifiers', () => {
  it('should extend StorageIdentifiers with Medplum fields', () => {
    const ids: MedplumStorageIdentifiers = {
      id: 'media-123',
      medplumBinaryId: 'binary-456',
      medplumMediaId: 'media-123',
      url: 'Binary/binary-456',
    };
    
    expect(ids.id).toBe('media-123');
    expect(ids.medplumBinaryId).toBe('binary-456');
    expect(ids.url).toBe('Binary/binary-456');
  });
});
```

**File:** `src/implementations/vintasend-aws-s3-attachments/__tests__/types.test.ts`

```typescript
import type { S3StorageIdentifiers } from '../src/types';

describe('S3StorageIdentifiers', () => {
  it('should extend StorageIdentifiers with S3 fields', () => {
    const ids: S3StorageIdentifiers = {
      id: 'file-123',
      awsS3Bucket: 'my-bucket',
      awsS3Key: 'uploads/file-123.pdf',
      awsS3Region: 'us-east-1',
    };
    
    expect(ids.awsS3Bucket).toBe('my-bucket');
    expect(ids.awsS3Key).toBe('uploads/file-123.pdf');
  });
});
```

**Run Phase 1 tests:**
```bash
# Core types tests (run from root)
cd /Users/hugobessa/Workspaces/vintasend-ts
npm test -- src/types/__tests__/attachment.test.ts

# Medplum types tests
cd src/implementations/vintasend-medplum
npm test -- __tests__/types.test.ts

# S3 types tests
cd ../vintasend-aws-s3-attachments
npm test -- __tests__/types.test.ts

# Type check all packages
cd /Users/hugobessa/Workspaces/vintasend-ts
npm run type-check
```

✅ **Phase 1 complete when:** All type tests pass and TypeScript compilation succeeds.

---

### Phase 2: Update BaseAttachmentManager Interface

**File:** `src/services/attachment-manager/base-attachment-manager.ts`

The attachment manager is responsible ONLY for file storage operations:

```typescript
export abstract class BaseAttachmentManager {
  /**
   * Upload a file to storage.
   * Returns file record with storage identifiers that backend will persist.
   */
  abstract uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord>;

  /**
   * Reconstruct an AttachmentFile accessor from storage identifiers.
   * Called by backend when it needs to access a file it has stored.
   */
  abstract reconstructAttachmentFile(
    storageIdentifiers: StorageIdentifiers,
  ): AttachmentFile;

  /**
   * Delete a file from storage using its identifiers.
   * Backend calls this after removing file reference from its database.
   */
  abstract deleteFileByIdentifiers(
    storageIdentifiers: StorageIdentifiers,
  ): Promise<void>;

  // Existing utility methods (public for backend use)
  public detectContentType(filename: string): string;
  public calculateChecksum(data: Buffer): string;
  public async fileToBuffer(file: FileAttachment): Promise<Buffer>;
}
```

**Note:** Remove `getFile(fileId)` and `deleteFile(fileId)` - these require database access. Backends will use `reconstructAttachmentFile()` with stored identifiers instead.

#### Phase 2 Testing

**Create base interface tests:**

**File:** `src/services/attachment-manager/__tests__/base-attachment-manager.test.ts`

```typescript
import { BaseAttachmentManager } from '../base-attachment-manager';
import type { AttachmentFileRecord, StorageIdentifiers } from '../../../types/attachment';
import type { AttachmentFile } from '../../../types/attachment';

class MockAttachmentManager extends BaseAttachmentManager {
  async uploadFile(): Promise<AttachmentFileRecord> {
    return {
      id: 'test-id',
      filename: 'test.txt',
      contentType: 'text/plain',
      size: 100,
      checksum: 'abc123',
      createdAt: new Date(),
      updatedAt: new Date(),
      storageIdentifiers: { id: 'test-id' },
    };
  }

  reconstructAttachmentFile(ids: StorageIdentifiers): AttachmentFile {
    return {
      read: async () => Buffer.from('test'),
      stream: () => null as any,
      url: async () => 'http://example.com/test',
    };
  }

  async deleteFileByIdentifiers(): Promise<void> {
    // Mock implementation
  }
}

describe('BaseAttachmentManager', () => {
  let manager: MockAttachmentManager;

  beforeEach(() => {
    manager = new MockAttachmentManager();
  });

  describe('uploadFile', () => {
    it('should return AttachmentFileRecord with storageIdentifiers', async () => {
      const record = await manager.uploadFile(
        Buffer.from('test'),
        'test.txt',
        'text/plain'
      );
      
      expect(record).toHaveProperty('storageIdentifiers');
      expect(record.storageIdentifiers).toHaveProperty('id');
    });
  });

  describe('reconstructAttachmentFile', () => {
    it('should create AttachmentFile from storageIdentifiers', () => {
      const ids: StorageIdentifiers = { id: 'test-id' };
      const file = manager.reconstructAttachmentFile(ids);
      
      expect(file).toHaveProperty('read');
      expect(file).toHaveProperty('stream');
      expect(file).toHaveProperty('url');
    });
  });

  describe('utility methods', () => {
    it('should calculate checksum', () => {
      const buffer = Buffer.from('test data');
      const checksum = manager.calculateChecksum(buffer);
      expect(checksum).toBeTruthy();
      expect(typeof checksum).toBe('string');
    });

    it('should detect content type from filename', () => {
      expect(manager.detectContentType('test.pdf')).toBe('application/pdf');
      expect(manager.detectContentType('image.png')).toBe('image/png');
      expect(manager.detectContentType('doc.txt')).toBe('text/plain');
    });
  });
});
```

**Run Phase 2 tests:**
```bash
# Base attachment manager tests (run from root)
cd /Users/hugobessa/Workspaces/vintasend-ts
npm test -- src/services/attachment-manager/__tests__/base-attachment-manager.test.ts

# Type check
npm run type-check
```

✅ **Phase 2 complete when:** Base interface tests pass and existing attachment manager implementations still compile.

---

### Phase 3: Update MedplumAttachmentManager

**File:** `src/implementations/vintasend-medplum/src/medplum-attachment-manager.ts`

```typescript
import type { MedplumStorageIdentifiers } from './types';

export class MedplumAttachmentManager extends BaseAttachmentManager {
  constructor(private medplum: MedplumClient) {
    super();
  }

  async uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord> {
    const buffer = await this.fileToBuffer(file);
    const checksum = this.calculateChecksum(buffer);
    const finalContentType = contentType || this.detectContentType(filename);

    // Create Binary resource with file data
    const binary = await this.medplum.createResource({
      resourceType: 'Binary',
      contentType: finalContentType,
      data: buffer.toString('base64'),
    });

    // Create Media resource with metadata
    // This is ONLY for MedplumAttachmentManager's internal tracking
    // NOT the backend's database (backend may have its own storage)
    const media = await this.medplum.createResource({
      resourceType: 'Media',
      status: 'completed',
      content: {
        contentType: finalContentType,
        url: `Binary/${binary.id}`,
        size: buffer.length,
        title: filename,
        creation: new Date().toISOString(),
      },
      identifier: [
        { system: 'http://vintasend.com/fhir/attachment-checksum', value: checksum },
        { system: 'http://vintasend.com/fhir/binary-id', value: binary.id },
      ],
      meta: { tag: [{ code: 'vintasend-attachment-manager-file' }] },
    });

    const storageIdentifiers: MedplumStorageIdentifiers = {
      id: media.id as string,
      medplumBinaryId: binary.id as string,
      medplumMediaId: media.id as string,
      url: `Binary/${binary.id}`,
    };

    return {
      id: media.id as string,
      filename,
      contentType: finalContentType,
      size: buffer.length,
      checksum,
      createdAt: new Date(),
      updatedAt: new Date(),
      storageIdentifiers,
    };
  }

  reconstructAttachmentFile(storageIdentifiers: StorageIdentifiers): AttachmentFile {
    // Type guard to check if we have Medplum identifiers
    const medplumIds = storageIdentifiers as MedplumStorageIdentifiers;
    if (!medplumIds.medplumBinaryId) {
      throw new Error('Invalid storage identifiers for MedplumAttachmentManager: missing medplumBinaryId');
    }
    return new MedplumAttachmentFile(this.medplum, medplumIds.medplumBinaryId);
  }

  async deleteFileByIdentifiers(storageIdentifiers: StorageIdentifiers): Promise<void> {
    const medplumIds = storageIdentifiers as MedplumStorageIdentifiers;
    
    // Delete Binary resource
    if (medplumIds.medplumBinaryId) {
      try {
        await this.medplum.deleteResource('Binary', medplumIds.medplumBinaryId);
      } catch { /* may not exist */ }
    }
    
    // Delete Media resource (manager's internal tracking)
    if (medplumIds.medplumMediaId) {
      try {
        await this.medplum.deleteResource('Media', medplumIds.medplumMediaId);
      } catch { /* may not exist */ }
    }
  }
}
```

#### Phase 3 Testing

**Create MedplumAttachmentManager tests:**

**File:** `src/implementations/vintasend-medplum/__tests__/medplum-attachment-manager.test.ts`

```typescript
import { MedplumClient } from '@medplum/core';
import { MedplumAttachmentManager } from '../src/medplum-attachment-manager';
import type { MedplumStorageIdentifiers } from '../src/types';

describe('MedplumAttachmentManager', () => {
  let medplum: MedplumClient;
  let manager: MedplumAttachmentManager;

  beforeEach(() => {
    medplum = new MedplumClient();
    manager = new MedplumAttachmentManager(medplum);
  });

  describe('uploadFile', () => {
    it('should upload file and return MedplumStorageIdentifiers', async () => {
      const buffer = Buffer.from('test content');
      const record = await manager.uploadFile(buffer, 'test.txt', 'text/plain');
      
      expect(record.storageIdentifiers).toHaveProperty('medplumBinaryId');
      expect(record.storageIdentifiers).toHaveProperty('medplumMediaId');
      expect(record.storageIdentifiers).toHaveProperty('url');
      expect((record.storageIdentifiers as MedplumStorageIdentifiers).url).toMatch(/^Binary\//);
    });

    it('should tag Media resource as attachment-manager-file', async () => {
      const buffer = Buffer.from('test');
      const record = await manager.uploadFile(buffer, 'test.txt');
      
      const media = await medplum.readResource('Media', record.id);
      expect(media.meta?.tag).toContainEqual({ code: 'vintasend-attachment-manager-file' });
    });
  });

  describe('reconstructAttachmentFile', () => {
    it('should create MedplumAttachmentFile from identifiers', async () => {
      const buffer = Buffer.from('test');
      const record = await manager.uploadFile(buffer, 'test.txt');
      
      const file = manager.reconstructAttachmentFile(record.storageIdentifiers);
      expect(file).toHaveProperty('read');
      
      const content = await file.read();
      expect(content.toString()).toBe('test');
    });

    it('should throw error if missing medplumBinaryId', () => {
      expect(() => {
        manager.reconstructAttachmentFile({ id: 'test' });
      }).toThrow('Invalid storage identifiers');
    });
  });

  describe('deleteFileByIdentifiers', () => {
    it('should delete both Binary and Media resources', async () => {
      const buffer = Buffer.from('test');
      const record = await manager.uploadFile(buffer, 'test.txt');
      
      await manager.deleteFileByIdentifiers(record.storageIdentifiers);
      
      const ids = record.storageIdentifiers as MedplumStorageIdentifiers;
      await expect(medplum.readResource('Binary', ids.medplumBinaryId)).rejects.toThrow();
      await expect(medplum.readResource('Media', ids.medplumMediaId)).rejects.toThrow();
    });
  });
});
```

**Run Phase 3 tests:**
```bash
# Medplum attachment manager tests
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-medplum
npm test -- __tests__/medplum-attachment-manager.test.ts

# Type check
cd /Users/hugobessa/Workspaces/vintasend-ts
npm run type-check
```

✅ **Phase 3 complete when:** MedplumAttachmentManager tests pass and manager properly tags resources.

---

### Phase 4: Update S3AttachmentManager

**File:** `src/implementations/vintasend-aws-s3-attachments/src/aws-s3-attachment-manager.ts`

```typescript
import type { S3StorageIdentifiers } from './types';

export class S3AttachmentManager extends BaseAttachmentManager {
  async uploadFile(
    file: FileAttachment,
    filename: string,
    contentType?: string,
  ): Promise<AttachmentFileRecord> {
    const buffer = await this.fileToBuffer(file);
    const checksum = this.calculateChecksum(buffer);
    const finalContentType = contentType || this.detectContentType(filename);
    
    const fileId = randomUUID();
    const key = this.buildS3Key(fileId, filename);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: finalContentType,
      Metadata: { originalFilename: filename, checksum },
    }));

    const storageIdentifiers: S3StorageIdentifiers = {
      id: fileId,
      awsS3Bucket: this.bucket,
      awsS3Key: key,
      awsS3Region: this.s3Client.config.region as string,
    };

    return {
      id: fileId,
      filename,
      contentType: finalContentType,
      size: buffer.length,
      checksum,
      createdAt: new Date(),
      updatedAt: new Date(),
      storageIdentifiers,
    };
  }

  reconstructAttachmentFile(storageIdentifiers: StorageIdentifiers): AttachmentFile {
    const s3Ids = storageIdentifiers as S3StorageIdentifiers;
    
    if (!s3Ids.awsS3Bucket || !s3Ids.awsS3Key) {
      throw new Error('Invalid storage identifiers for S3AttachmentManager: missing awsS3Bucket or awsS3Key');
    }
    
    return new S3AttachmentFile(this.s3Client, s3Ids.awsS3Bucket, s3Ids.awsS3Key);
  }

  async deleteFileByIdentifiers(storageIdentifiers: StorageIdentifiers): Promise<void> {
    const s3Ids = storageIdentifiers as S3StorageIdentifiers;
    const bucket = s3Ids.awsS3Bucket || this.bucket;
    
    if (!s3Ids.awsS3Key) {
      throw new Error('Invalid storage identifiers for S3AttachmentManager: missing awsS3Key');
    }
    
    await this.s3Client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: s3Ids.awsS3Key,
    }));
  }
}
```

#### Phase 4 Testing

**Create S3AttachmentManager tests:**

**File:** `src/implementations/vintasend-aws-s3-attachments/__tests__/aws-s3-attachment-manager.test.ts`

```typescript
import { S3Client } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { S3AttachmentManager } from '../src/aws-s3-attachment-manager';
import type { S3StorageIdentifiers } from '../src/types';

const s3Mock = mockClient(S3Client);

describe('S3AttachmentManager', () => {
  let manager: S3AttachmentManager;

  beforeEach(() => {
    s3Mock.reset();
    const s3 = new S3Client({ region: 'us-east-1' });
    manager = new S3AttachmentManager(s3, 'test-bucket');
  });

  describe('uploadFile', () => {
    it('should upload file and return S3StorageIdentifiers', async () => {
      const buffer = Buffer.from('test');
      const record = await manager.uploadFile(buffer, 'test.txt', 'text/plain');
      
      expect(record.storageIdentifiers).toHaveProperty('awsS3Bucket');
      expect(record.storageIdentifiers).toHaveProperty('awsS3Key');
      expect(record.storageIdentifiers).toHaveProperty('awsS3Region');
      expect((record.storageIdentifiers as S3StorageIdentifiers).awsS3Bucket).toBe('test-bucket');
    });
  });

  describe('reconstructAttachmentFile', () => {
    it('should create S3AttachmentFile from identifiers', () => {
      const ids: S3StorageIdentifiers = {
        id: 'test-id',
        awsS3Bucket: 'test-bucket',
        awsS3Key: 'test-key',
        awsS3Region: 'us-east-1',
      };
      
      const file = manager.reconstructAttachmentFile(ids);
      expect(file).toHaveProperty('read');
      expect(file).toHaveProperty('stream');
    });

    it('should throw error if missing S3 fields', () => {
      expect(() => {
        manager.reconstructAttachmentFile({ id: 'test' });
      }).toThrow('Invalid storage identifiers');
    });
  });
});
```

**Run Phase 4 tests:**
```bash
# S3 attachment manager tests
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-aws-s3-attachments
npm test -- __tests__/aws-s3-attachment-manager.test.ts

# Type check
cd /Users/hugobessa/Workspaces/vintasend-ts
npm run type-check
```

✅ **Phase 4 complete when:** S3AttachmentManager tests pass and both attachment managers work independently.

---

### Phase 5: Update Backend Interface

**File:** `src/services/notification-backends/base-notification-backend.ts`

Clarify that backends are responsible for:
- Storing file metadata and storage identifiers in their database
- Deduplication (via checksum lookup in their database)
- Orphan detection (via database queries)

```typescript
export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  // ... existing notification methods ...

  // Attachment methods (backend stores metadata, delegates file ops to manager)
  
  /**
   * Store attachment file record in database.
   * Called after AttachmentManager.uploadFile() returns.
   */
  storeAttachmentFileRecord?(record: AttachmentFileRecord): Promise<void>;
  
  /**
   * Get attachment file record from database by ID.
   */
  getAttachmentFileRecord?(fileId: string): Promise<AttachmentFileRecord | null>;
  
  /**
   * Find attachment by checksum for deduplication.
   * Backend searches its database, not the file storage.
   */
  findAttachmentFileByChecksum?(checksum: string): Promise<AttachmentFileRecord | null>;
  
  /**
   * Delete attachment file record from database.
   * Should also call AttachmentManager.deleteFileByIdentifiers().
   */
  deleteAttachmentFile?(fileId: string): Promise<void>;
  
  /**
   * Get orphaned files (in database but not referenced by notifications).
   */
  getOrphanedAttachmentFiles?(): Promise<AttachmentFileRecord[]>;
  
  /**
   * Get all attachments for a notification.
   */
  getAttachments?(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]>;
}
```

#### Phase 5 Testing

**Update backend interface tests (TypeScript validation):**

**File:** `src/services/notification-backends/__tests__/base-notification-backend.test.ts`

```typescript
import type { BaseNotificationBackend } from '../base-notification-backend';
import type { AttachmentFileRecord, StoredAttachment } from '../../../types/attachment';

// TypeScript compilation test - ensure methods are properly typed
class TestBackend implements Partial<BaseNotificationBackend<any>> {
  async storeAttachmentFileRecord(record: AttachmentFileRecord): Promise<void> {
    // Implementation
  }
  
  async getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null> {
    return null;
  }
  
  async findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    return null;
  }
  
  async deleteAttachmentFile(fileId: string): Promise<void> {
    // Implementation
  }
  
  async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    return [];
  }
  
  async getAttachments(notificationId: any): Promise<StoredAttachment[]> {
    return [];
  }
}

describe('BaseNotificationBackend Interface', () => {
  it('should compile with new attachment methods', () => {
    const backend = new TestBackend();
    expect(backend).toBeDefined();
  });
});
```

**Run Phase 5 tests:**
```bash
# Backend interface tests (run from root)
cd /Users/hugobessa/Workspaces/vintasend-ts
npm test -- src/services/notification-backends/__tests__/base-notification-backend.test.ts

# Type check
npm run type-check
```

✅ **Phase 5 complete when:** Backend interface compiles and existing backend implementations are updated to match signature.

---

### Phase 6: Refactor MedplumNotificationBackend

**File:** `src/implementations/vintasend-medplum/src/medplum-backend.ts`

The backend now:
1. **Always** stores file metadata in its own database (Media resources for Medplum backend)
2. Stores the `storageIdentifiers` as opaque JSON (doesn't inspect specific fields)
3. Works with **any** AttachmentManager (S3, Medplum, local filesystem, etc.)
4. Handles deduplication by querying its own database
5. Delegates file storage operations to the AttachmentManager

**Key Insight:** MedplumBackend uses Media resources as its file metadata database, regardless of which AttachmentManager is used. The storageIdentifiers tell the backend how to reconstruct file access later.

#### 6.1 Store attachment records in database

```typescript
async storeAttachmentFileRecord(record: AttachmentFileRecord): Promise<void> {
  // Create a Media resource in Medplum to store file metadata
  // This is the backend's database record, separate from the file storage
  
  await this.medplum.createResource({
    resourceType: 'Media',
    id: record.id, // Use the same ID from the file record
    status: 'completed',
    content: {
      contentType: record.contentType,
      size: record.size,
      title: record.filename,
      creation: record.createdAt.toISOString(),
    },
    identifier: [
      { 
        system: 'http://vintasend.com/fhir/attachment-checksum', 
        value: record.checksum 
      },
    ],
    // Store the opaque storageIdentifiers as an extension
    extension: [
      {
        url: 'http://vintasend.com/fhir/StructureDefinition/storage-identifiers',
        valueString: JSON.stringify(record.storageIdentifiers),
      },
    ],
    meta: { 
      tag: [{ code: 'vintasend-backend-attachment-metadata' }],
      lastUpdated: record.updatedAt.toISOString(),
    },
  });
}
```

**Important:** This Media resource is the **backend's database record**, not the AttachmentManager's storage. If using MedplumAttachmentManager, there will be TWO Media resources:
1. One created by MedplumAttachmentManager (tagged `vintasend-attachment-manager-file`) - for file storage
2. One created by MedplumBackend (tagged `vintasend-backend-attachment-metadata`) - for backend database

If using S3AttachmentManager, there will only be one Media resource (backend's database record), and files are in S3.

#### 6.2 Add getAttachmentFileRecord()

```typescript
async getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null> {
  try {
    const media = await this.medplum.readResource('Media', fileId);
    
    // Only return if it's a backend metadata record
    const isBackendRecord = media.meta?.tag?.some(
      tag => tag.code === 'vintasend-backend-attachment-metadata'
    );
    if (!isBackendRecord) return null;
    
    return this.mediaToAttachmentFileRecord(media);
  } catch {
    return null;
  }
}

/**
 * Convert Media resource to AttachmentFileRecord
 */
private mediaToAttachmentFileRecord(media: Media): AttachmentFileRecord | null {
  if (!media.id || !media.content) return null;
  
  // Extract checksum from identifier
  const checksumIdentifier = media.identifier?.find(
    id => id.system === 'http://vintasend.com/fhir/attachment-checksum'
  );
  const checksum = checksumIdentifier?.value || '';
  
  // Extract storage identifiers from extension
  const storageIdExt = media.extension?.find(
    ext => ext.url === 'http://vintasend.com/fhir/StructureDefinition/storage-identifiers'
  );
  const storageIdentifiers: StorageIdentifiers = storageIdExt?.valueString
    ? JSON.parse(storageIdExt.valueString)
    : { id: media.id };
  
  return {
    id: media.id,
    filename: media.content.title || 'untitled',
    contentType: media.content.contentType || 'application/octet-stream',
    size: media.content.size || 0,
    checksum,
    createdAt: media.content.creation ? new Date(media.content.creation) : new Date(),
    updatedAt: media.meta?.lastUpdated ? new Date(media.meta.lastUpdated) : new Date(),
    storageIdentifiers,
  };
}
```

#### 6.3 Refactor findAttachmentFileByChecksum()

Backend queries its own database:

```typescript
async findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
  // Search in backend's Media resources (our database for file metadata)
  const results = await this.medplum.searchResources(
    'Media',
    `identifier=${checksum}&_tag=vintasend-backend-attachment-metadata`
  );
  
  if (results.length === 0) return null;
  
  return this.mediaToAttachmentFileRecord(results[0]);
}
```

#### 6.4 Refactor deleteAttachmentFile()

```typescript
async deleteAttachmentFile(fileId: string): Promise<void> {
  // 1. Check if referenced by notifications
  const isReferenced = await this.isFileReferencedByNotifications(fileId);
  if (isReferenced) {
    throw new Error('Cannot delete: file still referenced by notifications');
  }
  
  // 2. Get the stored record to access storage identifiers
  const record = await this.getAttachmentFileRecord(fileId);
  if (!record) return;
  
  // 3. Delete from file storage via AttachmentManager
  const manager = this.getAttachmentManager();
  await manager.deleteFileByIdentifiers(record.storageIdentifiers);
  
  // 4. Delete from our database (Media resource)
  await this.medplum.deleteResource('Media', fileId);
}

private async isFileReferencedByNotifications(fileId: string): Promise<boolean> {
  const communications = await this.medplum.searchResources('Communication', {
    _tag: 'notification',
  });
  return communications.some(comm =>
    comm.payload?.some(p => p.contentAttachment?.url?.includes(fileId))
  );
}
```

#### 6.5 Refactor getAttachments()

```typescript
async getAttachments(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]> {
  const communication = await this.medplum.readResource('Communication', notificationId as string);
  const attachments: StoredAttachment[] = [];
  
  for (const payload of communication.payload || []) {
    const url = payload.contentAttachment?.url;
    if (!url) continue;
    
    // Extract file ID from our database reference
    const match = url.match(/Media\/([^/]+)/);
    if (!match) continue;
    
    const fileId = match[1];
    const record = await this.getAttachmentFileRecord(fileId);
    if (!record) continue;
    
    // Reconstruct file accessor using stored identifiers
    const manager = this.getAttachmentManager();
    const attachmentFile = manager.reconstructAttachmentFile(record.storageIdentifiers);
    
    attachments.push({
      id: `${notificationId}-${fileId}`,
      fileId: record.id,
      filename: record.filename,
      contentType: record.contentType,
      size: record.size,
      checksum: record.checksum,
      createdAt: record.createdAt,
      file: attachmentFile,
      description: payload.contentAttachment?.title,
      storageMetadata: record.storageIdentifiers,
    });
  }
  
  return attachments;
}
```

#### 6.6 Refactor processAttachments()

```typescript
private async processAttachments(
  attachments: NotificationAttachment[]
): Promise<Communication['payload']> {
  const manager = this.getAttachmentManager();
  const payload: Communication['payload'] = [];

  for (const attachment of attachments) {
    let fileRecord: AttachmentFileRecord;

    if ('fileId' in attachment) {
      // Reference to existing file - get from backend database
      const existing = await this.getAttachmentFileRecord(attachment.fileId);
      if (!existing) {
        throw new Error(`Attachment file not found: ${attachment.fileId}`);
      }
      fileRecord = existing;
      
    } else if ('file' in attachment) {
      // New file upload - check for deduplication in backend database
      const buffer = await manager.fileToBuffer(attachment.file);
      const checksum = manager.calculateChecksum(buffer);
      
      const existingFile = await this.findAttachmentFileByChecksum(checksum);
      
      if (existingFile) {
        // Reuse existing file (already in storage and backend database)
        fileRecord = existingFile;
      } else {
        // Upload new file to storage
        fileRecord = await manager.uploadFile(
          attachment.file,
          attachment.filename,
          attachment.contentType
        );
        
        // Store file metadata in backend database
        // This creates a Media resource with the storageIdentifiers
        await this.storeAttachmentFileRecord(fileRecord);
      }
    } else {
      continue;
    }

    // Build notification payload with reference to backend's database record
    payload.push({
      contentAttachment: {
        contentType: fileRecord.contentType,
        url: `Media/${fileRecord.id}`, // Reference to backend's Media resource
        size: fileRecord.size,
        title: attachment.description || fileRecord.filename,
        creation: fileRecord.createdAt.toISOString(),
      },
    });
  }

  return payload;
}
```

#### 6.7 Refactor getOrphanedAttachmentFiles()

```typescript
async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
  // Get all backend's file metadata records
  const allMedia = await this.medplum.searchResources('Media', {
    _tag: 'vintasend-backend-attachment-metadata',
  });

  // Get all notifications
  const communications = await this.medplum.searchResources('Communication', {
    _tag: 'notification',
  });

  // Build set of referenced file IDs
  const referencedIds = new Set<string>();
  for (const comm of communications) {
    for (const payload of comm.payload || []) {
      const url = payload.contentAttachment?.url;
      if (url) {
        const match = url.match(/Media\/([^/]+)/);
        if (match) referencedIds.add(match[1]);
      }
    }
  }

  // Filter orphaned media
  const orphaned = allMedia.filter(media => media.id && !referencedIds.has(media.id));
  const fileRecords = await Promise.all(
    orphaned.map(media => this.mediaToAttachmentFileRecord(media))
  );
  return fileRecords.filter((record): record is AttachmentFileRecord => record !== null);
}
```

#### 6.8 Remove duplicated fileToBuffer()

Use `manager.fileToBuffer()` instead.

#### Phase 6 Testing

**Create comprehensive MedplumBackend attachment tests:**

**File:** `src/implementations/vintasend-medplum/__tests__/medplum-backend-attachments.test.ts`

```typescript
import { MedplumClient } from '@medplum/core';
import { MedplumNotificationBackend } from '../src/medplum-backend';
import { MedplumAttachmentManager } from '../src/medplum-attachment-manager';
import { S3AttachmentManager } from '../../vintasend-aws-s3-attachments/src/aws-s3-attachment-manager';

describe('MedplumBackend Attachments', () => {
  let medplum: MedplumClient;
  let backend: MedplumNotificationBackend;
  let manager: MedplumAttachmentManager;

  beforeEach(() => {
    medplum = new MedplumClient();
    manager = new MedplumAttachmentManager(medplum);
    backend = new MedplumNotificationBackend(medplum);
    backend.injectAttachmentManager(manager);
  });

  describe('storeAttachmentFileRecord', () => {
    it('should store file record as Media resource with backend tag', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      const media = await medplum.readResource('Media', record.id);
      expect(media.meta?.tag).toContainEqual({ code: 'vintasend-backend-attachment-metadata' });
    });

    it('should store storageIdentifiers as extension', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      const media = await medplum.readResource('Media', record.id);
      const ext = media.extension?.find(
        e => e.url === 'http://vintasend.com/fhir/StructureDefinition/storage-identifiers'
      );
      expect(ext).toBeDefined();
      expect(ext?.valueString).toBeTruthy();
      
      const stored = JSON.parse(ext!.valueString!);
      expect(stored).toHaveProperty('id');
    });
  });

  describe('getAttachmentFileRecord', () => {
    it('should retrieve file record from backend Media resource', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      const retrieved = await backend.getAttachmentFileRecord(record.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(record.id);
      expect(retrieved?.checksum).toBe(record.checksum);
    });

    it('should not return manager Media resources', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      // Don't call storeAttachmentFileRecord - only manager's Media exists
      
      const retrieved = await backend.getAttachmentFileRecord(record.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('findAttachmentFileByChecksum', () => {
    it('should find file by checksum in backend database', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      const found = await backend.findAttachmentFileByChecksum(record.checksum);
      expect(found).toBeDefined();
      expect(found?.id).toBe(record.id);
    });
  });

  describe('deleteAttachmentFile', () => {
    it('should delete from both storage and backend database', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      await backend.deleteAttachmentFile(record.id);
      
      const retrieved = await backend.getAttachmentFileRecord(record.id);
      expect(retrieved).toBeNull();
    });

    it('should throw if file is still referenced', async () => {
      const record = await manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      const notification = await backend.persistNotification({
        userId: 'user-123',
        notificationType: 'EMAIL',
        bodyTemplate: 'test',
        contextName: 'test',
        contextParameters: {},
        attachments: [{ fileId: record.id }],
      });
      
      await expect(backend.deleteAttachmentFile(record.id)).rejects.toThrow();
    });
  });

  describe('Cross-manager compatibility', () => {
    it('should work with S3AttachmentManager', async () => {
      const s3Manager = new S3AttachmentManager(s3Client, 'test-bucket');
      backend.injectAttachmentManager(s3Manager);
      
      const record = await s3Manager.uploadFile(Buffer.from('test'), 'test.txt');
      await backend.storeAttachmentFileRecord(record);
      
      const retrieved = await backend.getAttachmentFileRecord(record.id);
      expect(retrieved).toBeDefined();
      
      const file = s3Manager.reconstructAttachmentFile(retrieved!.storageIdentifiers);
      expect(file).toHaveProperty('read');
    });
  });
});
```

**Run Phase 6 tests:**
```bash
# Medplum backend attachment tests
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-medplum
npm test -- __tests__/medplum-backend-attachments.test.ts

# Run all Medplum package tests
npm test

# Type check from root
cd /Users/hugobessa/Workspaces/vintasend-ts
npm run type-check
```

✅ **Phase 6 complete when:** 
- All MedplumBackend attachment tests pass
- MedplumBackend works with both MedplumAttachmentManager and S3AttachmentManager
- Existing MedplumBackend tests still pass

---

### Phase 7: Refactor PrismaNotificationBackend

**File:** `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`

The PrismaBackend is already closer to the target architecture since it uses database tables for file metadata. We need to ensure it follows the same pattern:

#### 7.1 Update storageMetadata field usage

The `PrismaAttachmentFileModel` already has `storageMetadata: JsonValue` which is perfect for storing `StorageIdentifiers`. We just need to ensure the type is correct:

```typescript
export interface PrismaAttachmentFileModel {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  storageMetadata: JsonValue; // This will store StorageIdentifiers as JSON
  createdAt: Date;
  updatedAt: Date;
}
```

#### 7.2 Update serializeAttachmentFileRecord()

```typescript
private serializeAttachmentFileRecord(file: PrismaAttachmentFileModel): AttachmentFileRecord {
  return {
    id: file.id,
    filename: file.filename,
    contentType: file.contentType,
    size: file.size,
    checksum: file.checksum,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    // Parse storageMetadata as StorageIdentifiers
    storageIdentifiers: file.storageMetadata as StorageIdentifiers,
  };
}
```

#### 7.3 Update getOrCreateFileRecordForUploadInTransaction()

```typescript
private async getOrCreateFileRecordForUploadInTransaction(
  tx: NotificationPrismaClientInterface<Config['NotificationIdType'], Config['UserIdType']>,
  att: Extract<NotificationAttachment, { file: unknown }>,
): Promise<AttachmentFileRecord> {
  const manager = this.getAttachmentManager();

  const buffer = await manager.fileToBuffer(att.file);
  const checksum = manager.calculateChecksum(buffer);

  let fileRecord = await this.findAttachmentFileByChecksumInTransaction(tx, checksum);
  if (!fileRecord) {
    // Upload new file via AttachmentManager
    const uploadedRecord = await manager.uploadFile(
      att.file,
      att.filename,
      att.contentType,
    );
    
    // Store file record in database with storage identifiers
    const dbFile = await tx.attachmentFile.create({
      data: {
        id: uploadedRecord.id,
        filename: uploadedRecord.filename,
        contentType: uploadedRecord.contentType,
        size: uploadedRecord.size,
        checksum: uploadedRecord.checksum,
        // Store opaque storage identifiers as JSON
        storageMetadata: uploadedRecord.storageIdentifiers as InputJsonValue,
      },
    });
    
    fileRecord = this.serializeAttachmentFileRecord(dbFile);
    this.logger?.info(`Uploaded new file: ${fileRecord.id} (${fileRecord.filename})`);
  } else {
    this.logger?.info(`Reusing existing file: ${fileRecord.id} (checksum: ${checksum})`);
  }

  return fileRecord;
}
```

#### 7.4 Update deleteAttachmentFile()

```typescript
async deleteAttachmentFile(fileId: string): Promise<void> {
  const manager = this.getAttachmentManager();
  
  // Get file record from database
  const file = await this.prismaClient.attachmentFile.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    this.logger?.warn(`Attachment file not found: ${fileId}`);
    return;
  }

  // Check if file is still referenced by any notifications
  const attachments = await this.prismaClient.notificationAttachment.findMany({
    where: { fileId },
  });

  if (attachments.length > 0) {
    throw new Error(
      `Cannot delete attachment file ${fileId}: still referenced by ${attachments.length} notification(s)`,
    );
  }

  // Parse storage identifiers and delete from storage
  const storageIdentifiers = file.storageMetadata as StorageIdentifiers;
  await manager.deleteFileByIdentifiers(storageIdentifiers);

  // Delete from database
  await this.prismaClient.attachmentFile.delete({
    where: { id: fileId },
  });

  this.logger?.info(`Deleted attachment file: ${fileId}`);
}
```

#### 7.5 Update serializeStoredAttachment()

```typescript
private serializeStoredAttachment(
  attachment: PrismaNotificationAttachmentModel,
): StoredAttachment {
  if (!attachment.attachmentFile) {
    throw new Error(`Attachment file not loaded: ${attachment.fileId}`);
  }

  const fileRecord = this.serializeAttachmentFileRecord(attachment.attachmentFile);
  const manager = this.getAttachmentManager();
  
  // Reconstruct file accessor using stored identifiers
  const attachmentFile = manager.reconstructAttachmentFile(fileRecord.storageIdentifiers);

  return {
    id: attachment.id,
    fileId: attachment.fileId,
    filename: fileRecord.filename,
    contentType: fileRecord.contentType,
    size: fileRecord.size,
    checksum: fileRecord.checksum,
    createdAt: fileRecord.createdAt,
    file: attachmentFile,
    description: attachment.description ?? undefined,
    storageMetadata: fileRecord.storageIdentifiers,
  };
}
```

#### 7.6 Update getOrphanedAttachmentFiles()

```typescript
async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
  // Find files not referenced by any notification attachments
  const orphanedFiles = await this.prismaClient.attachmentFile.findMany({
    where: {
      notificationAttachments: { none: {} },
      // Optionally: only find files older than X days
      createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  return orphanedFiles.map(file => this.serializeAttachmentFileRecord(file));
}
```

#### Phase 7 Testing

**Create comprehensive PrismaBackend attachment tests:**

**File:** `src/implementations/vintasend-prisma/__tests__/prisma-backend-attachments.test.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaNotificationBackend } from '../src/prisma-notification-backend';
import { S3AttachmentManager } from '../../vintasend-aws-s3-attachments/src/aws-s3-attachment-manager';
import { MedplumAttachmentManager } from '../../vintasend-medplum/src/medplum-attachment-manager';

describe('PrismaBackend Attachments', () => {
  let prisma: PrismaClient;
  let backend: PrismaNotificationBackend;
  let s3Manager: S3AttachmentManager;

  beforeEach(async () => {
    prisma = new PrismaClient();
    s3Manager = new S3AttachmentManager(s3Client, 'test-bucket');
    backend = new PrismaNotificationBackend(prisma, s3Manager);
  });

  describe('Storage identifiers persistence', () => {
    it('should store S3StorageIdentifiers as JSON', async () => {
      const notification = await backend.persistNotification({
        userId: 1,
        notificationType: 'EMAIL',
        bodyTemplate: 'test',
        contextName: 'test',
        contextParameters: {},
        attachments: [
          {
            file: Buffer.from('test'),
            filename: 'test.txt',
            contentType: 'text/plain',
          },
        ],
      });
      
      const dbFile = await prisma.attachmentFile.findFirst();
      expect(dbFile?.storageMetadata).toHaveProperty('awsS3Bucket');
      expect(dbFile?.storageMetadata).toHaveProperty('awsS3Key');
    });
  });

  describe('File reconstruction', () => {
    it('should reconstruct AttachmentFile from stored identifiers', async () => {
      const notification = await backend.persistNotification({
        userId: 1,
        notificationType: 'EMAIL',
        bodyTemplate: 'test',
        contextName: 'test',
        contextParameters: {},
        attachments: [{ file: Buffer.from('test'), filename: 'test.txt' }],
      });
      
      const attachments = await backend.getAttachments(notification.id);
      expect(attachments).toHaveLength(1);
      expect(attachments[0].file).toHaveProperty('read');
    });
  });

  describe('Deduplication', () => {
    it('should deduplicate files via backend database', async () => {
      const file1 = Buffer.from('identical content');
      const file2 = Buffer.from('identical content');
      
      await backend.persistNotification({
        userId: 1,
        notificationType: 'EMAIL',
        bodyTemplate: 'test1',
        contextName: 'test',
        contextParameters: {},
        attachments: [{ file: file1, filename: 'test1.txt' }],
      });
      
      await backend.persistNotification({
        userId: 1,
        notificationType: 'EMAIL',
        bodyTemplate: 'test2',
        contextName: 'test',
        contextParameters: {},
        attachments: [{ file: file2, filename: 'test2.txt' }],
      });
      
      const filesCount = await prisma.attachmentFile.count();
      expect(filesCount).toBe(1);
    });
  });

  describe('Cross-manager compatibility', () => {
    it('should work with MedplumAttachmentManager', async () => {
      const medplumManager = new MedplumAttachmentManager(medplumClient);
      backend.injectAttachmentManager(medplumManager);
      
      const notification = await backend.persistNotification({
        userId: 1,
        notificationType: 'EMAIL',
        bodyTemplate: 'test',
        contextName: 'test',
        contextParameters: {},
        attachments: [{ file: Buffer.from('test'), filename: 'test.txt' }],
      });
      
      const dbFile = await prisma.attachmentFile.findFirst();
      expect(dbFile?.storageMetadata).toHaveProperty('medplumBinaryId');
      expect(dbFile?.storageMetadata).toHaveProperty('medplumMediaId');
    });
  });

  describe('Orphan detection', () => {
    it('should find files not referenced by notifications', async () => {
      const notif = await backend.persistNotification({
        userId: 1,
        notificationType: 'EMAIL',
        bodyTemplate: 'test',
        contextName: 'test',
        contextParameters: {},
        attachments: [{ file: Buffer.from('test'), filename: 'test.txt' }],
      });
      
      const orphanRecord = await s3Manager.uploadFile(
        Buffer.from('orphan'),
        'orphan.txt'
      );
      await prisma.attachmentFile.create({
        data: {
          id: orphanRecord.id,
          filename: orphanRecord.filename,
          contentType: orphanRecord.contentType,
          size: orphanRecord.size,
          checksum: orphanRecord.checksum,
          storageMetadata: orphanRecord.storageIdentifiers as any,
        },
      });
      
      const orphans = await backend.getOrphanedAttachmentFiles();
      expect(orphans.length).toBeGreaterThan(0);
      expect(orphans.some(f => f.id === orphanRecord.id)).toBe(true);
    });
  });
});
```

**Run Phase 7 tests:**
```bash
# Prisma backend attachment tests
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-prisma
npm test -- __tests__/prisma-backend-attachments.test.ts

# Run all Prisma package tests
npm test

# Type check from root
cd /Users/hugobessa/Workspaces/vintasend-ts
npm run type-check
```

✅ **Phase 7 complete when:**
- All PrismaBackend attachment tests pass
- PrismaBackend works with both S3AttachmentManager and MedplumAttachmentManager
- Deduplication works correctly
- Existing PrismaBackend tests still pass

---

## Summary of Changes

| Phase | File | Changes |
|-------|------|---------|
| 1 | `types/attachment.ts` | Add generic `StorageIdentifiers` interface, update `AttachmentFileRecord` |
| 1 | `medplum/src/types.ts` | Add `MedplumStorageIdentifiers` |
| 1 | `aws-s3/src/types.ts` | Add `S3StorageIdentifiers` |
| 2 | `base-attachment-manager.ts` | Remove `getFile()`, add `reconstructAttachmentFile()`, `deleteFileByIdentifiers()` |
| 3 | `medplum-attachment-manager.ts` | Update to use `MedplumStorageIdentifiers`, implement new methods |
| 4 | `aws-s3-attachment-manager.ts` | Update to use `S3StorageIdentifiers`, implement new methods |
| 5 | `base-notification-backend.ts` | Add `storeAttachmentFileRecord()`, `getAttachmentFileRecord()`, clarify responsibilities |
| 6 | `medplum-backend.ts` | Keep database operations, delegate file operations to manager |
| 7 | `prisma-backend.ts` | Update to use `StorageIdentifiers`, ensure consistent pattern with Medplum |

---

## Data Flow Examples

### Upload New Attachment

```
1. User provides file to VintaSend
2. Backend calculates checksum
3. Backend checks database for existing file with same checksum
   - If found: reuse existing record
   - If not found:
     a. AttachmentManager.uploadFile() → returns AttachmentFileRecord with storageIdentifiers
     b. Backend stores record in database (for Medplum: Media resource)
4. Backend links file to notification
```

### Retrieve Attachment

```
1. Backend reads notification from database
2. Backend extracts file ID from notification
3. Backend reads AttachmentFileRecord from database (includes storageIdentifiers)
4. Backend calls AttachmentManager.reconstructAttachmentFile(storageIdentifiers)
5. Returns AttachmentFile with read(), stream(), url() methods
```

### Delete Attachment

```
1. Backend checks if file is referenced by any notifications
2. Backend reads AttachmentFileRecord from database
3. Backend calls AttachmentManager.deleteFileByIdentifiers(storageIdentifiers)
4. Backend deletes record from database
```

---

## Final Testing Phase: Integration & Regression

**After completing all 7 phases, run comprehensive integration and regression tests.**

### Integration Tests

**File:** `src/__tests__/integration/cross-backend-manager.test.ts`

```typescript
describe('Cross-Backend and Manager Integration', () => {
  const combinations = [
    { backend: 'Prisma', manager: 'S3' },
    { backend: 'Prisma', manager: 'Medplum' },
    { backend: 'Medplum', manager: 'S3' },
    { backend: 'Medplum', manager: 'Medplum' },
  ];

  combinations.forEach(({ backend, manager }) => {
    describe(`${backend}Backend + ${manager}AttachmentManager`, () => {
      it('should upload, store, retrieve, and delete files', async () => {
        // Test full lifecycle
      });

      it('should handle deduplication', async () => {
        // Test checksum-based deduplication
      });

      it('should handle attachments in notifications', async () => {
        // Test notification creation with attachments
      });
    });
  });
});
```

### Regression Tests

**File:** `src/__tests__/regression/existing-functionality.test.ts`

Ensure all existing tests still pass:
```bash
# Run from root
cd /Users/hugobessa/Workspaces/vintasend-ts
npm test

# Run each package's tests
cd src/implementations/vintasend-medplum && npm test
cd ../vintasend-prisma && npm test
cd ../vintasend-aws-s3-attachments && npm test
```

### Test Execution Summary

After completing all phases:

1. **Run integration tests:**
   ```bash
   cd /Users/hugobessa/Workspaces/vintasend-ts
   npm test -- src/__tests__/integration/
   ```

2. **Run all package tests:**
   ```bash
   # Root package
   cd /Users/hugobessa/Workspaces/vintasend-ts
   npm test
   
   # Medplum package
   cd src/implementations/vintasend-medplum
   npm test
   
   # Prisma package
   cd ../vintasend-prisma
   npm test
   
   # S3 package
   cd ../vintasend-aws-s3-attachments
   npm test
   ```

3. **Check test coverage:**
   ```bash
   cd /Users/hugobessa/Workspaces/vintasend-ts
   npm run test:coverage
   ```
   Ensure coverage remains above 80% for modified files.

4. **Run type checking:**
   ```bash
   cd /Users/hugobessa/Workspaces/vintasend-ts
   npm run type-check
   ```

### Continuous Integration

Update CI pipeline to run tests after each phase:

```yaml
# .github/workflows/test-refactoring.yml
name: Attachment Refactoring Tests

on:
  pull_request:
    paths:
      - 'src/types/attachment.ts'
      - 'src/services/attachment-manager/**'
      - 'src/implementations/vintasend-medplum/**'
      - 'src/implementations/vintasend-aws-s3-attachments/**'
      - 'src/implementations/vintasend-prisma/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

---

## Benefits of This Architecture

1. **Clear separation of concerns:**
   - AttachmentManager: file storage only
   - Backend: database + coordination

2. **Any backend works with any attachment manager:**
   - Prisma + S3 ✓
   - Prisma + Medplum ✓
   - Medplum + S3 ✓
   - Medplum + Medplum ✓

3. **Deduplication always works:**
   - Backend stores checksums in its database
   - Works regardless of attachment manager capabilities

4. **Storage identifiers are extensible:**
   - Each manager populates its specific fields
   - Backends store and pass them through unchanged

5. **File reconstruction is reliable:**
   - Identifiers contain everything needed to access the file
   - No dependency on manager having database access
