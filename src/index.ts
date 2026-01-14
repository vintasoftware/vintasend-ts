// Attachment Manager
export { BaseAttachmentManager } from './services/attachment-manager/base-attachment-manager';
export type { LocalFileAttachmentManagerConfig } from './services/attachment-manager/local-file-attachment-manager';
export { LocalFileAttachmentManager } from './services/attachment-manager/local-file-attachment-manager';
export {
  BaseNotificationAdapter,
  isOneOffNotification,
} from './services/notification-adapters/base-notification-adapter';
export type { BaseNotificationBackend } from './services/notification-backends/base-notification-backend';
export { supportsAttachments } from './services/notification-backends/base-notification-backend';
export type { BaseNotificationQueueService } from './services/notification-queue-service/base-notification-queue-service';
export type { VintaSend } from './services/notification-service';
export { VintaSendFactory } from './services/notification-service';
export type { BaseEmailTemplateRenderer } from './services/notification-template-renderers/base-email-template-renderer';
export type { BaseNotificationTemplateRenderer } from './services/notification-template-renderers/base-notification-template-renderer';
// Attachment Types
export type {
  AttachmentFile,
  AttachmentFileRecord,
  FileAttachment,
  NotificationAttachment,
  NotificationAttachmentReference,
  NotificationAttachmentUpload,
  StoredAttachment,
} from './types/attachment';
export { isAttachmentReference } from './types/attachment';
export type {
  AnyDatabaseNotification,
  AnyNotification,
  AnyNotificationInput,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
  NotificationInput,
  NotificationResendWithContextInput,
  OneOffNotification,
  OneOffNotificationInput,
  OneOffNotificationResendWithContextInput,
} from './types/notification';
export type { ContextGenerator } from './types/notification-context-generators';
export type { BaseNotificationTypeConfig } from './types/notification-type-config';
