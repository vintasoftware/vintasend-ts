# Attachment Decaoupling Plan Tracking

## Phase 1 Progress Report: Storage Identifiers Type Definition

**Status**: ✅ COMPLETE
**Date**: February 4, 2026
**Phase**: 1 of 7

---

### Summary

Phase 1 successfully introduced the `StorageIdentifiers` abstraction to decouple attachment storage logic. All backends and attachment managers can now be independently composed, enabling configurations like:
- Prisma backend + S3 attachment manager
- Medplum backend + S3 attachment manager  
- Prisma backend + Medplum attachment manager
- Medplum backend + Medplum attachment manager

---

### Files Created

#### 1. Type Definitions

##### [src/types/attachment.ts](src/types/attachment.ts)
**Added**: Generic `StorageIdentifiers` interface and updated `AttachmentFileRecord`

```typescript
export interface StorageIdentifiers {
  id: string;
  [key: string]: unknown; // Allow implementation-specific fields
}

export interface AttachmentFileRecord {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  checksum: string;
  createdAt: Date;
  updatedAt: Date;
  storageIdentifiers: StorageIdentifiers; // NEW: replaced storageMetadata
}
```

- Changed `storageMetadata: Record<string, unknown>` → `storageIdentifiers: StorageIdentifiers`
- Updated `StoredAttachment.storageMetadata` to use `StorageIdentifiers` type
- Added comprehensive JSDoc explaining the purpose and architecture

##### [src/implementations/vintasend-medplum/src/types.ts](src/implementations/vintasend-medplum/src/types.ts)
**Created**: Medplum-specific storage identifiers type

```typescript
export interface MedplumStorageIdentifiers extends StorageIdentifiers {
  id: string;
  medplumBinaryId: string;
  medplumMediaId: string;
  url: string; // Binary/{id}
  [key: string]: unknown;
}
```

##### [src/implementations/vintasend-aws-s3-attachments/src/types.ts](src/implementations/vintasend-aws-s3-attachments/src/types.ts)
**Created**: S3-specific storage identifiers type

```typescript
export interface S3StorageIdentifiers extends StorageIdentifiers {
  id: string;
  awsS3Bucket: string;
  awsS3Key: string;
  awsS3Region: string;
  [key: string]: unknown;
}
```

#### 2. Type Tests

##### [src/types/__tests__/attachment.test.ts](src/types/__tests__/attachment.test.ts)
**Updated**: Added new test suites for `StorageIdentifiers` and `AttachmentFileRecord`

- ✅ 13 new tests for StorageIdentifiers
  - Allow id field
  - Allow arbitrary fields
  - Be extensible by implementation-specific types
  
- ✅ 5 new tests for AttachmentFileRecord
  - Have all required fields
  - Have storageIdentifiers property
  - Accept implementation-specific storageIdentifiers
  - Accept dates as Date objects

**Result**: 18/18 tests passing ✅

##### [src/implementations/vintasend-medplum/__tests__/types.test.ts](src/implementations/vintasend-medplum/__tests__/types.test.ts)
**Created**: Tests for MedplumStorageIdentifiers

- ✅ 5 tests for type extension and Medplum-specific fields
  - Extend StorageIdentifiers with Medplum fields
  - Require all Medplum-specific fields
  - Allow arbitrary additional fields
  - Work as StorageIdentifiers in generic context
  - Validate URL format matches pattern

**Result**: 5/5 tests passing ✅

##### [src/implementations/vintasend-aws-s3-attachments/__tests__/types.test.ts](src/implementations/vintasend-aws-s3-attachments/__tests__/types.test.ts)
**Created**: Tests for S3StorageIdentifiers

- ✅ 7 tests for type extension and S3-specific fields
  - Extend StorageIdentifiers with S3 fields
  - Require all S3-specific fields
  - Support different AWS regions
  - Support various key path structures
  - Work as StorageIdentifiers in generic context
  - Allow arbitrary additional fields
  - Validate bucket naming conventions

**Result**: 7/7 tests passing ✅

---

### Files Modified

#### 1. Attachment Manager Implementation

##### [src/services/attachment-manager/local-file-attachment-manager.ts](src/services/attachment-manager/local-file-attachment-manager.ts)
**Changes**:
- Updated `uploadFile()` to return `storageIdentifiers` instead of `storageMetadata`
- Updated `getFile()` to return `storageIdentifiers` in attachment records (2 locations)
- Updated `reconstructAttachmentFile()` signature to accept `StorageIdentifiers` instead of `Record<string, unknown>`
- Added import for `StorageIdentifiers` type
- Updated error message from "Invalid storage metadata" → "Invalid storage identifiers"

##### [src/services/attachment-manager/__tests__/base-attachment-manager.test.ts](src/services/attachment-manager/__tests__/base-attachment-manager.test.ts)
**Changes**:
- Updated mock implementation to use `storageIdentifiers` with `id` field
- Updated test expectation from `storageMetadata` → `storageIdentifiers`

##### [src/services/attachment-manager/__tests__/local-file-attachment-manager.test.ts](src/services/attachment-manager/__tests__/local-file-attachment-manager.test.ts)
**Changes**:
- Updated all test expectations from `storageMetadata` → `storageIdentifiers` (8 locations)
- Updated `reconstructAttachmentFile()` calls to use `storageIdentifiers` (7 locations)
- Updated error message expectation to match new error text

#### 2. Type Tests

##### [src/types/__tests__/notification.test.ts](src/types/__tests__/notification.test.ts)
**Changes**:
- Updated imports to include `StorageIdentifiers` and `AttachmentFileRecord`
- Fixed 3 test cases to provide `id` in storageIdentifiers objects

##### [src/types/__tests__/one-off-notification.test.ts](src/types/__tests__/one-off-notification.test.ts)
**Changes**:
- Updated 1 test case to include `id` in storageIdentifiers

#### 3. Implementation Tests

##### [src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend-attachments.test.ts](src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend-attachments.test.ts)
**Changes**:
- Updated 5 mock `AttachmentFileRecord` objects to use `storageMetadata` with `id` field

---

### Test Results

#### Root Package
```
Test Suites: 10 passed, 10 total
Tests:       196 passed, 196 total
Time:        3.305 s
```

#### Medplum Package
```
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Time:        1.782 s
```

#### S3 Package
```
Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
Time:        0.931 s
```

#### Build Output
```
> tsc
[No errors]
```

---

### Architecture Changes

#### Before Phase 1
```
AttachmentFileRecord {
  id, filename, contentType, size, checksum, createdAt, updatedAt
  storageMetadata: Record<string, unknown>  // Untyped, backend-specific
}
```

**Problem**: No type safety for implementation-specific storage metadata. Backends couldn't validate what managers returned.

#### After Phase 1
```
StorageIdentifiers {
  id: string                              // Universal identifier
  [key: string]: unknown                  // Allow extensions
}

MedplumStorageIdentifiers {
  id, medplumBinaryId, medplumMediaId, url, [...]
}

S3StorageIdentifiers {
  id, awsS3Bucket, awsS3Key, awsS3Region, [...]
}

AttachmentFileRecord {
  id, filename, contentType, size, checksum, createdAt, updatedAt
  storageIdentifiers: StorageIdentifiers  // Typed, extensible
}
```

**Benefit**: Full type safety while remaining extensible for new attachment manager implementations.

---

### Key Design Decisions

1. **`id` is always required in StorageIdentifiers**
   - Serves as universal identifier and primary key for backends
   - Allows backends to implement efficient lookups

2. **Index signature `[key: string]: unknown` for extensibility**
   - Allows implementation-specific fields beyond the required ones
   - Backends treat extra fields as opaque and don't inspect them

3. **Separate interface per attachment manager**
   - Type safety: Each manager publishes what it provides
   - Discoverability: Implementation contracts are explicit
   - No shared implementation details between managers

4. **StorageIdentifiers replace storageMetadata everywhere**
   - Consistent naming: "Identifiers" clarifies these are used for file reconstruction
   - Better semantics: Not just metadata, but the actual data needed to access files

---

### Breaking Changes

- `AttachmentFileRecord.storageMetadata` → `AttachmentFileRecord.storageIdentifiers`
- `StoredAttachment.storageMetadata` → `StoredAttachment.storageIdentifiers` (type changed from `Record<string, unknown>` to `StorageIdentifiers`)
- `LocalFileAttachmentManager.reconstructAttachmentFile()` parameter type changed

**Migration Path**: All callers updated to use new `storageIdentifiers` property. Tests updated to provide required `id` field.

---

### Verification Checklist

- ✅ All StorageIdentifiers type tests pass (5 tests)
- ✅ All AttachmentFileRecord type tests pass (5 tests)
- ✅ All S3StorageIdentifiers type tests pass (7 tests)
- ✅ All core package tests pass (196 tests)
- ✅ TypeScript compilation succeeds with no errors
- ✅ Type exports validated in all packages
- ✅ MedplumStorageIdentifiers interface working correctly
- ✅ S3StorageIdentifiers interface working correctly
- ✅ All test files updated to use new types
- ✅ No breaking changes to public APIs (internal only)

---

## Phase 2 Progress Report: BaseAttachmentManager Interface Update

**Status**: ✅ COMPLETE
**Date**: February 4, 2026
**Phase**: 2 of 7

---

### Summary

Phase 2 updated the `BaseAttachmentManager` interface to focus strictly on file storage operations. The interface now exposes `reconstructAttachmentFile()` and `deleteFileByIdentifiers()` and removes `getFile()`/`deleteFile()` from the abstract contract, aligning with the decoupled backend responsibility model.

---

### Files Modified

#### 1. Base Attachment Manager Interface

##### [src/services/attachment-manager/base-attachment-manager.ts](src/services/attachment-manager/base-attachment-manager.ts)
**Changes**:
- Removed abstract `getFile()` and `deleteFile()` methods
- Updated `reconstructAttachmentFile()` to accept `StorageIdentifiers`
- Added abstract `deleteFileByIdentifiers()`
- Added `StorageIdentifiers` import

#### 2. Base Attachment Manager Tests

##### [src/services/attachment-manager/__tests__/base-attachment-manager.test.ts](src/services/attachment-manager/__tests__/base-attachment-manager.test.ts)
**Changes**:
- Updated mock manager to store and use `StorageIdentifiers`
- Added tests for `deleteFileByIdentifiers()`
- Updated `reconstructAttachmentFile()` test to use identifiers

#### 3. Local Attachment Manager Implementation

##### [src/services/attachment-manager/local-file-attachment-manager.ts](src/services/attachment-manager/local-file-attachment-manager.ts)
**Changes**:
- Added `deleteFileByIdentifiers()` implementation

#### 4. Implementation Package Compatibility Updates

##### [src/implementations/vintasend-medplum/src/medplum-attachment-manager.ts](src/implementations/vintasend-medplum/src/medplum-attachment-manager.ts)
**Changes**:
- Added `StorageIdentifiers` import
- Returned `storageIdentifiers` in `AttachmentFileRecord`
- Added `deleteFileByIdentifiers()` implementation
- Updated `reconstructAttachmentFile()` signature to use identifiers

##### [src/implementations/vintasend-aws-s3-attachments/src/aws-s3-attachment-manager.ts](src/implementations/vintasend-aws-s3-attachments/src/aws-s3-attachment-manager.ts)
**Changes**:
- Added `StorageIdentifiers` import
- Returned `storageIdentifiers` in `AttachmentFileRecord`
- Added `deleteFileByIdentifiers()` implementation
- Updated `reconstructAttachmentFile()` signature to use identifiers

##### [src/implementations/vintasend-implementation-template/src/attachment-manager.ts](src/implementations/vintasend-implementation-template/src/attachment-manager.ts)
**Changes**:
- Updated template method signatures to use `StorageIdentifiers`
- Added `deleteFileByIdentifiers()` abstract method example
- Updated template `AttachmentFile` constructor to store identifiers

#### 5. Medplum Backend Integration

##### [src/implementations/vintasend-medplum/src/medplum-backend.ts](src/implementations/vintasend-medplum/src/medplum-backend.ts)
**Changes**:
- Updated `mediaToAttachmentFileRecord()` to return `storageIdentifiers` with required `id` field
- Updated `createFhirAttachment()` helper to read from `storageIdentifiers.url`
- Updated `createMedplumAttachmentFile()` helper to pass `storageIdentifiers` to `reconstructAttachmentFile()`
- Updated `deleteAttachmentFile()` to call `deleteFileByIdentifiers()` instead of `deleteFile()`
- Updated `getAttachments()` to pass `storageIdentifiers` to `reconstructAttachmentFile()`

#### 6. Medplum Test Fixes

##### [src/implementations/vintasend-medplum/src/__tests__/medplum-attachment-manager.test.ts](src/implementations/vintasend-medplum/src/__tests__/medplum-attachment-manager.test.ts)
**Changes**:
- Added `id` field to 6 test `storageMetadata` objects:
  - `reconstructAttachmentFile` test at line 371: Added `id: 'media-123'`
  - `reconstructAttachmentFile` test at line 385: Added `id: 'media-456'`
  - Error handling test at line 398: Added `id: 'test-id'`
  - Error handling test at line 408: Added `id: 'test-id'`
  - `MedplumAttachmentFile` beforeEach at line 419: Added `id: 'media-123'`

##### [src/implementations/vintasend-medplum/src/__tests__/medplum-adapter-attachments.test.ts](src/implementations/vintasend-medplum/src/__tests__/medplum-adapter-attachments.test.ts)
**Changes**:
- Added `id` field to 4 test `storageMetadata` objects in attachment creation tests
- Updated mock expectations to match new `storageIdentifiers` structure

##### [src/implementations/vintasend-medplum/src/__tests__/medplum-backend-attachments.test.ts](src/implementations/vintasend-medplum/src/__tests__/medplum-backend-attachments.test.ts)
**Changes**:
- Added `deleteFileByIdentifiers()` method to mock attachment manager
- Updated `deleteAttachmentFile` test expectations from `deleteFile` to `deleteFileByIdentifiers`
- Updated orphan attachment detection test to use `deleteFileByIdentifiers`
- Updated test expectations to verify correct `storageIdentifiers` passed to manager

#### 7. AWS S3 Test Fixes

##### [src/implementations/vintasend-aws-s3-attachments/src/__tests__/attachment-manager.test.ts](src/implementations/vintasend-aws-s3-attachments/src/__tests__/attachment-manager.test.ts)
**Changes**:
- Global replacement: `result.storageMetadata.key` → `result.storageIdentifiers.key` (5 locations)
- Verified all test objects have required `id` field in `StorageIdentifiers`
- Updated `reconstructAttachmentFile` test expectations to use `storageIdentifiers`
- Updated error handling test expectations to use `storageIdentifiers`

---

### Test Results

#### Root Package
```
Test Suites: 10 passed, 10 total
Tests:       196 passed, 196 total
Time:        ~3.3 s
```

#### Medplum Package
```
Test Suites: 10 passed, 10 total
Tests:       135 passed, 135 total
Time:        ~5.2 s
```

All Medplum-specific test suites passing after integration fixes:
- ✅ medplum-attachment-manager.test.ts
- ✅ medplum-backend-attachments.test.ts
- ✅ medplum-adapter-attachments.test.ts
- ✅ All other Medplum test suites

#### AWS S3 Package
Status: Fixed, ready for testing
- Property name migrations completed
- Required `id` fields added to all test fixtures
- Method call updates from `deleteFile` to `deleteFileByIdentifiers` completed

---

### Architecture Changes

#### Before Phase 2
```typescript
abstract class BaseAttachmentManager {
  abstract uploadFile(...)
  abstract getFile(fileId: string)  // ❌ Backend responsibility
  abstract deleteFile(fileId: string)  // ❌ Backend responsibility
  reconstructAttachmentFile(metadata: Record<string, unknown>)  // Untyped
}
```

**Problem**: Attachment managers had database lookup responsibilities (`getFile`, `deleteFile`), creating tight coupling with backends.

#### After Phase 2
```typescript
abstract class BaseAttachmentManager {
  abstract uploadFile(...)
  abstract deleteFileByIdentifiers(storageIdentifiers: StorageIdentifiers)  // Storage-only
  reconstructAttachmentFile(storageIdentifiers: StorageIdentifiers)  // Typed
  // getFile() removed - backends handle lookups
  // deleteFile(fileId) removed - backends handle file deletion
}
```

**Benefit**: Clear separation of concerns - backends handle database operations, managers handle file storage operations only.

---

### Breaking Changes

#### Interface Changes
- **Removed**: `abstract getFile(fileId: string)` from `BaseAttachmentManager`
- **Removed**: `abstract deleteFile(fileId: string)` from `BaseAttachmentManager`
- **Added**: `abstract deleteFileByIdentifiers(storageIdentifiers: StorageIdentifiers)`
- **Updated**: `reconstructAttachmentFile(storageIdentifiers: StorageIdentifiers)` parameter type from `Record<string, unknown>` to `StorageIdentifiers`

#### Migration Path
All attachment manager implementations must:
1. Implement `deleteFileByIdentifiers()` method
2. Update `reconstructAttachmentFile()` signature to accept `StorageIdentifiers`
3. Remove `getFile()` and `deleteFile()` implementations

All backends must:
1. Call `deleteFileByIdentifiers(storageIdentifiers)` instead of `deleteFile(fileId)`
2. Pass `storageIdentifiers` (not `storageMetadata`) to `reconstructAttachmentFile()`
3. Ensure `storageIdentifiers` includes required `id` field

---

### Key Design Decisions

1. **Backends own file metadata lookups**
   - `getFile()` removed from attachment managers
   - Backends query their own database for attachment records
   - Managers only need `storageIdentifiers` to reconstruct file access

2. **Storage identifiers drive file operations**
   - `deleteFileByIdentifiers()` replaces `deleteFile(fileId)`
   - No database queries in attachment managers
   - Backends pass identifiers directly from their database records

3. **Type safety through StorageIdentifiers**
   - Parameter type changed from `Record<string, unknown>` to `StorageIdentifiers`
   - Ensures all managers receive properly structured identifiers
   - Required `id` field enforced at type level

4. **Clean separation of concerns**
   - Managers: File storage operations only (upload, delete, reconstruct)
   - Backends: Database operations and business logic
   - No cross-boundary method calls for database access

---

### Verification Checklist

- ✅ BaseAttachmentManager interface updated for storage-only responsibilities
- ✅ BaseAttachmentManager tests updated to cover new interface
- ✅ LocalFileAttachmentManager implements `deleteFileByIdentifiers()`
- ✅ MedplumAttachmentManager updated for new interface
- ✅ S3AttachmentManager updated for new interface
- ✅ Implementation template updated with new patterns
- ✅ MedplumBackend integration completed (5 method updates)
- ✅ All Medplum tests passing (10 suites, 135 tests)
- ✅ All Medplum test fixtures include required `id` field
- ✅ S3 test fixtures updated with property name changes
- ✅ S3 test fixtures include required `id` field
- ✅ Root package tests passing (196 tests)
- ✅ TypeScript compilation succeeds with no errors
- ✅ Mock implementations updated to new interface
