# VintaSend Implementation Template

This template provides a starting point for creating VintaSend implementations with custom storage backends, adapters, template renderers, and other components.

## Overview

VintaSend is designed to be extensible, allowing you to implement custom components for different services and requirements. This template package shows the structure and patterns for creating these implementations.

**Note:** The template files reference `vintasend` package imports which will cause TypeScript errors until you:
1. Add `vintasend` to your package.json dependencies/peerDependencies
2. Install the package with `npm install`
3. Build the main vintasend package if developing in the monorepo

These errors are expected for the template and will resolve when you create an actual implementation.

## Components

### AttachmentManager

The `TemplateAttachmentManager` provides a structure for implementing file attachment storage for notifications.

**Supported Storage Backends:**
- AWS S3 (see [`vintasend-aws-s3-attachments`](../vintasend-aws-s3-attachments))
- Azure Blob Storage
- Google Cloud Storage
- Local Filesystem (development only)
- Any S3-compatible storage (MinIO, DigitalOcean Spaces, etc.)

**Implementation Steps:**

1. **Copy this template** to a new package:
   ```bash
   cp -r src/implementations/vintasend-implementation-template src/implementations/vintasend-{your-storage}-attachments
   ```

2. **Update package.json**:
   - Change package name to match your implementation
   - Add storage-specific dependencies (e.g., `@aws-sdk/client-s3` for S3)
   - Update description and keywords

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Rename the class**:
   - Rename `TemplateAttachmentManager` to your implementation name (e.g., `S3AttachmentManager`)
   - Update all references in exports and tests

4. **Implement the required methods**:

   - `uploadFile(file, filename, contentType?)` - Upload file to your storage backend
     - Convert file to Buffer using `this.fileToBuffer(file)`
     - Calculate checksum using `this.calculateChecksum(buffer)`
     - Auto-detect content type using `this.detectContentType(filename)`
     - Upload to storage and return file record

   - `getFile(fileId)` - Retrieve file record from database
     - Query your backend's database for file metadata
     - Return `AttachmentFileRecord` or `null`

   - `deleteFile(fileId)` - Delete file from storage
     - Remove from storage backend
     - Remove file record from database
     - Only called for orphaned files (not referenced by any notifications)

   - `reconstructAttachmentFile(storageMetadata)` - Recreate file accessor
     - Create and return an `AttachmentFile` instance
     - Use storage metadata to configure access (e.g., S3 bucket/key)

   - `findFileByChecksum(checksum)` _(optional)_ - Enable file deduplication
     - Query database for existing file with same checksum
     - Return existing `AttachmentFileRecord` or `null`
     - Enables automatic deduplication when uploading identical files

5. **Implement the AttachmentFile class**:

   Create a storage-specific implementation of the `AttachmentFile` interface:

   - `read()` - Load entire file into memory as Buffer
   - `stream()` - Return ReadableStream for large files
   - `url(expiresIn?)` - Generate presigned/temporary URL for access
   - `delete()` - Delete file from storage

6. **Write comprehensive tests**:
   - Use the test template as a starting point
   - Test all methods with various file types
   - Test error handling
   - Use mocks for unit tests
   - Consider integration tests with real storage (or LocalStack/emulators)

7. **Document configuration**:
   - Document all configuration options
   - Provide usage examples
   - Document authentication methods
   - Include troubleshooting tips

**Example Implementation:**

See [`vintasend-s3-attachments`](../vintasend-s3-attachments) for a complete AWS S3 implementation that follows this pattern.

**Key Design Patterns:**

- **Reusable Files**: Files are stored once in `AttachmentFile` table and referenced by multiple notifications via `NotificationAttachment` join table
- **Deduplication**: Implement `findFileByChecksum()` to prevent storing duplicate files
- **Presigned URLs**: Generate temporary URLs for secure file access without exposing credentials
- **Streaming**: Support streaming for large files to avoid memory issues
- **Type Safety**: All methods use strict TypeScript types from `vintasend/dist/types/attachment`

## Other Components

### Adapter

Custom notification delivery adapters (email, SMS, push notifications, etc.)

**Examples:**
- `vintasend-nodemailer` - Email via Nodemailer
- Custom SMS adapter
- Custom push notification adapter

### Backend

Custom database persistence layers

**Examples:**
- `vintasend-prisma` - Prisma ORM backend
- Custom MongoDB backend
- Custom PostgreSQL backend

### Template Renderer

Custom notification content rendering

**Examples:**
- `vintasend-pug` - Pug template engine
- Custom Handlebars renderer
- Custom React email renderer

### Logger

Custom logging implementations

**Examples:**
- `vintasend-winston` - Winston logger
- Custom Pino logger
- Custom cloud logging service

## Getting Started

1. Choose the component type you want to implement
2. Copy this template package to a new directory
3. Follow the implementation steps for that component type
4. Write comprehensive tests
5. Document your implementation
6. Publish as a separate npm package (optional)

## Best Practices

- **Type Safety**: Use TypeScript strict mode and leverage VintaSend's type system
- **Testing**: Aim for high test coverage, including edge cases and error conditions
- **Documentation**: Document all configuration options and provide clear examples
- **Error Handling**: Provide clear error messages and proper error types
- **Performance**: Consider streaming for large files, connection pooling for databases, etc.
- **Security**: Never expose credentials, use presigned URLs, validate inputs

## Contributing

When creating implementations:
- Follow the existing code style (use Biome for linting)
- Include comprehensive tests
- Document all public APIs
- Add examples in README
- Consider adding to the main VintaSend monorepo

## License

MIT
