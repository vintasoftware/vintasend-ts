import type { AttachmentFileRecord, StoredAttachment } from '../../types/attachment';
import type { InputJsonValue } from '../../types/json-values';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
  OneOffNotificationInput,
} from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getPendingNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]>;
  getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getFutureNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]>;
  getAllFutureNotificationsFromUser(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]>;
  getFutureNotificationsFromUser(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]>;
  persistNotification(
    notification: Omit<Notification<Config>, 'id'>,
  ): Promise<DatabaseNotification<Config>>;
  getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]>;
  bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]>;
  persistNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>>;
  markAsSent(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
  ): Promise<AnyDatabaseNotification<Config>>;
  markAsFailed(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
  ): Promise<AnyDatabaseNotification<Config>>;
  markAsRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent: boolean,
  ): Promise<DatabaseNotification<Config>>;
  cancelNotification(notificationId: Config['NotificationIdType']): Promise<void>;
  getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<AnyDatabaseNotification<Config> | null>;
  filterAllInAppUnreadNotifications(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]>;
  filterInAppUnreadNotifications(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]>;
  getUserEmailFromNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<string | undefined>;
  storeContextUsed(
    notificationId: Config['NotificationIdType'],
    context: InputJsonValue,
  ): Promise<void>;

  // One-off notification methods
  persistOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'>,
  ): Promise<DatabaseOneOffNotification<Config>>;
  persistOneOffNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>>;
  getOneOffNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<DatabaseOneOffNotification<Config> | null>;
  getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]>;
  getOneOffNotifications(
    page: number,
    pageSize: number,
  ): Promise<DatabaseOneOffNotification<Config>[]>;

  // Attachment management methods (optional - only needed if backend supports attachments)
  /**
   * Get an attachment file record by ID
   */
  getAttachmentFile?(fileId: string): Promise<AttachmentFileRecord | null>;

  /**
   * Find an attachment file by checksum for deduplication.
   * Backend queries its database for files with matching checksums.
   * Used during file upload to avoid storing duplicate files.
   */
  findAttachmentFileByChecksum?(checksum: string): Promise<AttachmentFileRecord | null>;

  /**
   * Delete an attachment file (only if not referenced by any notifications)
   */
  deleteAttachmentFile?(fileId: string): Promise<void>;

  /**
   * Get all attachment files not referenced by any notifications (for cleanup)
   */
  getOrphanedAttachmentFiles?(): Promise<AttachmentFileRecord[]>;

  /**
   * Get all attachments for a specific notification
   */
  getAttachments?(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]>;

  /**
   * Delete a specific attachment from a notification
   */
  deleteNotificationAttachment?(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void>;
}

/**
 * Type guard to check if backend supports attachment operations
 */
export function supportsAttachments<Config extends BaseNotificationTypeConfig>(
  backend: BaseNotificationBackend<Config>,
): backend is BaseNotificationBackend<Config> & {
  getAttachmentFile(fileId: string): Promise<AttachmentFileRecord | null>;
  findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null>;
  deleteAttachmentFile(fileId: string): Promise<void>;
  getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]>;
  getAttachments(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]>;
  deleteNotificationAttachment(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void>;
} {
  return (
    typeof backend.getAttachmentFile === 'function' &&
    typeof backend.findAttachmentFileByChecksum === 'function' &&
    typeof backend.deleteAttachmentFile === 'function' &&
    typeof backend.getOrphanedAttachmentFiles === 'function' &&
    typeof backend.getAttachments === 'function' &&
    typeof backend.deleteNotificationAttachment === 'function'
  );
}
