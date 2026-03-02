# VintaSend Implementation Template

This template provides a starting point for creating VintaSend implementations with custom storage backends, adapters, template renderers, and other components.

## Overview

VintaSend is designed to be extensible, allowing you to implement custom components for different services and requirements. This template package shows the structure and patterns for creating these implementations.

**Note:** The template files reference `vintasend` package imports which will cause TypeScript errors until you:
1. Add `vintasend` to your package.json dependencies/peerDependencies
2. Install the package with `npm install`
3. Build the main vintasend package if developing in the monorepo

These errors are expected for the template and will resolve when you create an actual implementation.

## Build Any VintaSend Component

Use this workflow for **any** implementation type: backend, adapter, template renderer, logger, attachment manager, queue service, etc.

1. **Copy the template package** to a new implementation directory:
   ```bash
   cp -r src/implementations/vintasend-implementation-template src/implementations/vintasend-{your-component}
   ```

2. **Rename and configure package metadata** in `package.json`:
   - Set the new package name
   - Update description/keywords
   - Add required runtime dependencies for your implementation

3. **Implement only the component files you need**:
   - `src/backend.ts` for persistence backends
   - `src/adapter.ts` for delivery adapters
   - `src/template-renderer.ts` for renderers
   - `src/logger.ts` for loggers
   - `src/attachment-manager.ts` for file storage
   - Remove the unused files and their respective tests

4. **Export your implementations** from `src/index.ts`.

5. **Install dependencies**:
   ```bash
   npm install
   ```

6. **Build**:
   ```bash
   npm run build
   ```

7. **Run tests**:
   ```bash
   npm test
   ```

8. **Validate package output**:
   - Ensure compiled artifacts are in `dist/`
   - Confirm `main` and `files` entries in `package.json` are correct

9. **Document the package**:
   - Replace this README.md file by your own, including the description of the package and instructions on how to use it. 

9. **Publish (optional)**:
   ```bash
   npm publish
   ```

### Component-specific checklist

- **Backend**
  - Implement persistence, filtering, status transitions, and attachment-related methods as needed
  - Keep pagination/filtering behavior consistent with VintaSend expectations
- **Adapter**
  - Set `key` and supported notification type
  - Implement `send()` and backend integration (`injectBackend` usage)
- **Template Renderer**
  - Implement `render()` and `renderFromTemplateContent()`
  - Validate missing/invalid template input and surface clear errors
- **Logger**
  - Implement `info`, `warn`, and `error` methods
  - Add environment-aware transport/output configuration if needed
- **Attachment Manager**
  - Implement file upload/read/url/delete lifecycle and deduplication hooks
  - Ensure storage identifiers are sufficient to reconstruct file access

## Components

### Backend

The backend component is responsible for notification persistence, filtering, state transitions, and (optionally) attachment metadata relations.

**Implementation Steps:**

1. Rename `NotificationBackend` and `NotificationBackendFactory` to match your implementation.
2. Implement core persistence methods:
   - `persistNotification`, `persistNotificationUpdate`
   - `getNotification`, `getAllPendingNotifications`
3. Implement status transitions:
   - `markAsSent`, `markAsFailed`, `markAsRead`, `cancelNotification`
4. Implement listing and filtering:
   - `getNotifications`, `getAllNotifications`, `filterNotifications`
   - Keep pagination and ordering behavior explicit and consistent
5. Implement one-off notification support if your use case requires it.
6. Implement attachment-related backend methods if your project uses attachments.

**Testing Focus:**
- Pending/future notification queries
- State transition guards and timestamps
- Filter + pagination behavior
- Attachment lookup and cleanup behavior (when applicable)

**Example Implementation:**
- `vintasend-prisma` - Prisma ORM backend

### Adapter

The adapter component delivers notifications to providers (email, SMS, push, etc.) and bridges template rendering with backend recipient lookup.

**Implementation Steps:**

1. Rename `NotificationAdapter` and `NotificationAdapterFactory`.
2. Set adapter identity and type:
   - `key`
   - notification type (`EMAIL`, `SMS`, etc.)
3. Implement `send()`:
   - Render template using the injected renderer
   - Validate notification id and recipient data
   - Call provider SDK/API with mapped payload
4. Add one-off notification handling if your adapter supports direct recipient delivery.
5. Add attachment payload mapping if your adapter/provider supports attachments.
6. Ensure clear error messages for missing backend/config/recipient/provider failures.

**Testing Focus:**
- Happy path delivery
- Missing backend / missing id / missing recipient
- One-off notification support
- Attachments mapping (single, multiple, empty)

**Example Implementations:**
- `vintasend-nodemailer` - Nodemailer email adapter
- `vintasend-ts-sendgrid` - SendGrid email adapter

### Template Renderer

The template renderer component transforms templates + context into provider-ready content (subject/body/text/etc.).

**Implementation Steps:**

1. Rename `TemplateRenderer` and `TemplateRendererFactory`.
2. Implement `render(notification, context)` for template path/reference rendering.
3. Implement `renderFromTemplateContent(notification, templateContent, context)` for inline template rendering.
4. Validate required template fields and throw clear validation errors.
5. Add optional logger support for debugging render failures if useful.

**Testing Focus:**
- Rendering with normal and empty context
- Inline template rendering behavior
- Missing subject/body validation
- Template compilation/runtime error handling

**Example Implementation:**
- `vintasend-pug` - Pug template renderer

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

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Rename the class**:
   - Rename `TemplateAttachmentManager` to your implementation name (e.g., `S3AttachmentManager`)
   - Update all references in exports and tests

5. **Implement the required methods**:

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

6. **Implement the AttachmentFile class**:

   Create a storage-specific implementation of the `AttachmentFile` interface:

   - `read()` - Load entire file into memory as Buffer
   - `stream()` - Return ReadableStream for large files
   - `url(expiresIn?)` - Generate presigned/temporary URL for access
   - `delete()` - Delete file from storage

7. **Write comprehensive tests**:
   - Use the test template as a starting point
   - Test all methods with various file types
   - Test error handling
   - Use mocks for unit tests
   - Consider integration tests with real storage (or LocalStack/emulators)

8. **Document configuration**:
   - Document all configuration options
   - Provide usage examples
   - Document authentication methods
   - Include troubleshooting tips

**Example Implementation:**

See [`vintasend-aws-s3-attachments`](../vintasend-aws-s3-attachments) for a complete AWS S3 implementation that follows this pattern.

**Key Design Patterns:**

- **Reusable Files**: Files are stored once in `AttachmentFile` table and referenced by multiple notifications via `NotificationAttachment` join table
- **Deduplication**: Implement `findFileByChecksum()` to prevent storing duplicate files
- **Presigned URLs**: Generate temporary URLs for secure file access without exposing credentials
- **Streaming**: Support streaming for large files to avoid memory issues
- **Type Safety**: All methods use strict TypeScript types from `vintasend`

### Logger

The logger component receives VintaSend log messages and forwards them to your logging stack.

**Implementation Steps:**

1. Rename `Logger` to your implementation name.
2. Implement `info`, `warn`, and `error` methods.
3. Configure transports/formatters for your runtime environments.
4. Keep logging side effects predictable and non-blocking.

**Testing Focus:**
- Correct method forwarding (`info`, `warn`, `error`)
- Initialization with default and custom options (if applicable)
- Environment-specific transport setup (if applicable)

**Example Implementation:**
- `vintasend-winston` - Winston logger

## Getting Started

1. Choose the component type you want to implement
2. Copy this template package to a new directory
3. Follow **Build Any VintaSend Component** and the component-specific checklist above
4. Build and test (`npm run build` and `npm test`)
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
