import type { AttachmentFileRecord, StoredAttachment } from '../../types/attachment';
import type { InputJsonValue } from '../../types/json-values';
import type { NotificationStatus } from '../../types/notification-status';
import type { NotificationType } from '../../types/notification-type';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
  OneOffNotificationInput,
} from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';
import type { BaseLogger } from '../loggers/base-logger';

/**
 * Date range filter with optional lower and upper bounds.
 */
export type DateRange = {
  from?: Date;
  to?: Date;
};

/**
 * Flat dotted key capability map describing which filter features a backend supports.
 * Use flat dotted keys for logical operators, fields, and negations:
 * - `logical.*`: Operator support (and, or, not, notNested)
 * - `fields.*`: Field filtering support
 * - `negation.*`: Negation support for specific fields
 *
 * When a backend implements getFilterCapabilities(), missing keys default to true (supported),
 * ensuring forward compatibility when new capabilities are added.
 * Backends that don't implement getFilterCapabilities() are treated as supporting all features.
 */
export type NotificationFilterCapabilities = {
  [key: string]: boolean;
};

/**
 * Leaf-level filter conditions for notification fields.
 * All specified fields are combined with implicit AND.
 */
export type NotificationFilterFields<Config extends BaseNotificationTypeConfig> = {
  status?: NotificationStatus | NotificationStatus[];
  notificationType?: NotificationType | NotificationType[];
  adapterUsed?: string | string[];
  userId?: Config['UserIdType'];
  bodyTemplate?: string;
  subjectTemplate?: string;
  contextName?: string;
  sendAfterRange?: DateRange;
  createdAtRange?: DateRange;
  sentAtRange?: DateRange;
};

/**
 * Composable notification filter supporting logical operators.
 *
 * - A plain field filter applies all conditions with implicit AND.
 * - `{ and: [...] }` requires all sub-filters to match.
 * - `{ or: [...] }` requires at least one sub-filter to match.
 * - `{ not: filter }` inverts the sub-filter.
 */
export type NotificationFilter<Config extends BaseNotificationTypeConfig> =
  | NotificationFilterFields<Config>
  | { and: NotificationFilter<Config>[] }
  | { or: NotificationFilter<Config>[] }
  | { not: NotificationFilter<Config> };

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
  storeAdapterAndContextUsed(
    notificationId: Config['NotificationIdType'],
    adapterKey: string,
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

  /**
   * Filter notifications using composable query filters.
   * Supports filtering by status, notification type, adapter, recipient,
    * body/subject templates, context, and date ranges (sendAfter, created, sent).
   * Filters can be combined with logical operators (and, or, not).
   *
   * @param filter - Composable filter expression
   * @param page - Page number (1-indexed) for pagination
   * @param pageSize - Number of results per page
   * @returns Matching notifications
   */
  filterNotifications(
    filter: NotificationFilter<Config>,
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]>;

  /**
   * Get the filter capabilities supported by this backend.
   * Returns an object with flat dotted keys indicating which filtering features are supported.
   *
   * Example capability names:
   * - `logical.and`, `logical.or`, `logical.not`, `logical.notNested`
   * - `fields.status`, `fields.notificationType`, `fields.adapterUsed`, `fields.userId`,
   *   `fields.bodyTemplate`, `fields.subjectTemplate`, `fields.contextName`,
  *   `fields.sendAfterRange`, `fields.createdAtRange`, `fields.sentAtRange`
  * - `negation.sendAfterRange`, `negation.createdAtRange`, `negation.sentAtRange`
   *
   * If this method is not implemented, all features are assumed to be supported.
   * If this method is implemented, missing keys default to true (supported) for forward compatibility.
   * Only explicitly set keys to false to indicate unsupported features.
   */
  getFilterCapabilities?(): NotificationFilterCapabilities;

  // Optional logger injection for debugging and monitoring
  /**
   * Inject logger into backend for debugging and monitoring
   */
  injectLogger?(logger: BaseLogger): void;

  // Attachment management methods (optional - only needed if backend supports attachments)

  /**
   * Store attachment file record in database.
   * Called after AttachmentManager.uploadFile() returns storageIdentifiers.
   * Backend persists file metadata and storage identifiers for later retrieval.
   */
  storeAttachmentFileRecord?(record: AttachmentFileRecord): Promise<void>;

  /**
   * Get attachment file record from database by ID.
   * Returns the file metadata and storage identifiers needed to reconstruct file access.
   * Used by AttachmentManager.reconstructAttachmentFile() to get file content.
   */
  getAttachmentFileRecord?(fileId: string): Promise<AttachmentFileRecord | null>;

  /**
   * @deprecated Use getAttachmentFileRecord instead.
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
 * Type guard to check if a filter is a field filter (leaf node).
 */
export function isFieldFilter<Config extends BaseNotificationTypeConfig>(
  filter: NotificationFilter<Config>,
): filter is NotificationFilterFields<Config> {
  return !('and' in filter) && !('or' in filter) && !('not' in filter);
}

/**
 * Type guard to check if backend supports attachment operations
 */
export function supportsAttachments<Config extends BaseNotificationTypeConfig>(
  backend: BaseNotificationBackend<Config>,
): backend is BaseNotificationBackend<Config> & {
  storeAttachmentFileRecord(record: AttachmentFileRecord): Promise<void>;
  getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null>;
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
    typeof backend.storeAttachmentFileRecord === 'function' &&
    typeof backend.getAttachmentFileRecord === 'function' &&
    typeof backend.findAttachmentFileByChecksum === 'function' &&
    typeof backend.deleteAttachmentFile === 'function' &&
    typeof backend.getOrphanedAttachmentFiles === 'function' &&
    typeof backend.getAttachments === 'function' &&
    typeof backend.deleteNotificationAttachment === 'function'
  );
}
