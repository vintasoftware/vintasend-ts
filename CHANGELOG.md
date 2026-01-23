# Changelog

## Version 0.4.3

* **Template Renderer Logger Injection**: Template renderers now support optional logger injection for better error handling and debugging:
  * Added optional `injectLogger()` method to `BaseEmailTemplateRenderer` interface
  * `PugEmailTemplateRenderer` now supports logger injection
  * `InlineTemplateRenderer` now uses injected logger instead of `console.error`
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