# Changelog

## Version 0.4.17

* **Release Automation**: Introduced a comprehensive two-step release automation system for managing vintasend-ts and all implementation packages:
  * **Two-step release process**: Separate version bumping from publishing for better control
  * **Version bump step** (`npm run release:bump`): Updates all package.json files, then prompts for CHANGELOG updates
  * **Publish step** (`npm run release:publish`): Individual commit messages for each package (main + 8 implementations)
  * **2FA Support**: Browser-based npm 2FA authentication with 5-minute authorization window
  * **Automatic dependency management**: Runs `npm install` for each implementation to ensure correct vintasend version
  * **Includes all changes**: Commits all modified and untracked files (no clean working directory required)
  * **State tracking**: Uses `.release-state.json` to maintain context between steps
  * **Comprehensive documentation**: Release guide, quick reference, and technical documentation
  * **Safety features**: Confirmation prompts, test execution before publish, error handling
* **Attachment Manager Improvements**:
  * **BaseAttachmentManager**: Created mandatory getFile method and implemented in both AWS S3 and Medplum attachment managers.
* **Developer Experience**: 
  * New npm scripts: `release:bump`, `release:bump:patch`, `release:bump:minor`, `release:publish`
  * Complete workflow: bump versions → update CHANGELOG → publish all packages
  * Each package gets its own descriptive commit message
  * Documentation linked in README.md under Contributing section

## Version 0.4.7

* Inject logger into backend (optional)

## Version 0.4.3

* **Template Renderer Logger Injection**: Template renderers now support optional logger injection for better error handling and debugging:
  * Added optional `injectLogger()` method to `BaseEmailTemplateRenderer` interface
  * `PugEmailTemplateRenderer` now supports logger injection
  * `PugInlineEmailTemplateRenderer` now uses injected logger instead of `console.error`
  * VintaSend automatically injects logger into template renderers that support it
  * Template renderers continue to work without implementing logger injection (backward compatible)


## Version 0.4.0

* **Attachment Support**: VintaSend now supports file attachments for notifications with comprehensive features:
  * Production-ready AWS S3 storage via `vintasend-aws-s3-attachments` package
  * Reusable attachments - upload files once, attach to multiple notifications
  * Automatic deduplication via SHA-256 checksums
  * Presigned URLs for secure file access with configurable expiration
  * Streaming support for efficient handling of large files
  * S3-compatible services support (MinIO, DigitalOcean Spaces, Cloudflare R2, Wasabi, etc.)
  * Extensible architecture for custom storage backends (Azure Blob, GCS, local filesystem, etc.)
  * Email adapter support via Nodemailer
  * Comprehensive documentation in ATTACHMENTS.md
  * Implementation template for creating custom AttachmentManagers
* **Backend Updates**: Added attachment management methods to backend interface:
  * `getAttachmentFile()` - Retrieve attachment file metadata
  * `deleteAttachmentFile()` - Delete attachment files
  * `getOrphanedAttachmentFiles()` - Find files not linked to any notifications
  * `getAttachments()` - Get all attachments for a notification
  * `deleteNotificationAttachment()` - Remove notification-attachment links
* **Prisma Backend**: Full attachment support with database models and cascade delete rules
* **Type System Updates**: Added attachment types to notification inputs and database types
* **Backend Interface**: Attachment methods are now **optional** in `BaseNotificationBackend` - existing backends continue to work without implementing them
* **Breaking Changes**:
  * ⚠️ **BREAKING**: `VintaSendFactory.create()` signature changed - `attachmentManager` parameter now comes before `options`
    * **Old signature**: `create(adapters, backend, logger, contextGeneratorsMap, queueService?, options?)`
    * **New signature**: `create(adapters, backend, logger, contextGeneratorsMap, queueService?, attachmentManager?, options?)`
    * **Migration**: If you were passing 6 arguments with `options` as the last parameter, you must now pass `undefined` for `attachmentManager`:
      ```typescript
      // Before (v0.3.x):
      factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, { raiseErrorOnFailedSend: true });
      
      // After (v0.4.0):
      factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, undefined, { raiseErrorOnFailedSend: true });
      // Or with attachment manager:
      factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, attachmentManager, { raiseErrorOnFailedSend: true });
      ```

## Version 0.3.0

* **One-off Notifications support**: now VintaSend supports sending notifications directly to emails/phone numbers, instead of registered users. 

# Version 0.2.0

* Added await when calling the send method of the adapter when creating notifications
* Implemented backend migration