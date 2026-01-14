export { VintaSendFactory } from './services/notification-service';
export type { VintaSend } from './services/notification-service';
export type {
  Notification,
  DatabaseNotification,
  NotificationInput,
  NotificationResendWithContextInput,
  OneOffNotification,
  DatabaseOneOffNotification,
  OneOffNotificationInput,
  OneOffNotificationResendWithContextInput,
  AnyNotification,
  AnyDatabaseNotification,
  AnyNotificationInput,
} from './types/notification';
export type { ContextGenerator } from './types/notification-context-generators';
export type { BaseNotificationTypeConfig } from './types/notification-type-config';
export type { BaseNotificationBackend } from './services/notification-backends/base-notification-backend';
export { supportsAttachments } from './services/notification-backends/base-notification-backend';
export type { BaseNotificationQueueService } from './services/notification-queue-service/base-notification-queue-service';
export type { BaseNotificationTemplateRenderer } from './services/notification-template-renderers/base-notification-template-renderer';
export type { BaseEmailTemplateRenderer } from './services/notification-template-renderers/base-email-template-renderer';
export {
  BaseNotificationAdapter,
  isOneOffNotification,
} from './services/notification-adapters/base-notification-adapter';

// Attachment Manager
export { BaseAttachmentManager } from './services/attachment-manager/base-attachment-manager';
export { LocalFileAttachmentManager } from './services/attachment-manager/local-file-attachment-manager';
export type { LocalFileAttachmentManagerConfig } from './services/attachment-manager/local-file-attachment-manager';

// Attachment Types
export type {
  FileAttachment,
  NotificationAttachmentUpload,
  NotificationAttachmentReference,
  NotificationAttachment,
  AttachmentFile,
  AttachmentFileRecord,
  StoredAttachment,
} from './types/attachment';
export { isAttachmentReference } from './types/attachment';
