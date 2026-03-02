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
export type StringFilterLookup = {
  lookup: 'exact' | 'startsWith' | 'endsWith' | 'includes';
  value: string;
  caseSensitive?: boolean;
};
export type StringFieldFilter = string | StringFilterLookup;
export type NotificationOrderByField =
  | 'sendAfter'
  | 'sentAt'
  | 'readAt'
  | 'createdAt'
  | 'updatedAt';
export type NotificationOrderDirection = 'asc' | 'desc';
export type NotificationOrderBy = {
  field: NotificationOrderByField;
  direction: NotificationOrderDirection;
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
  bodyTemplate?: StringFieldFilter;
  subjectTemplate?: StringFieldFilter;
  contextName?: StringFieldFilter;
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
  | {
      and: NotificationFilter<Config>[];
    }
  | {
      or: NotificationFilter<Config>[];
    }
  | {
      not: NotificationFilter<Config>;
    };
export declare const DEFAULT_BACKEND_FILTER_CAPABILITIES: {
  'logical.and': boolean;
  'logical.or': boolean;
  'logical.not': boolean;
  'logical.notNested': boolean;
  'fields.status': boolean;
  'fields.notificationType': boolean;
  'fields.adapterUsed': boolean;
  'fields.userId': boolean;
  'fields.bodyTemplate': boolean;
  'fields.subjectTemplate': boolean;
  'fields.contextName': boolean;
  'fields.sendAfterRange': boolean;
  'fields.createdAtRange': boolean;
  'fields.sentAtRange': boolean;
  'negation.sendAfterRange': boolean;
  'negation.createdAtRange': boolean;
  'negation.sentAtRange': boolean;
  'stringLookups.startsWith': boolean;
  'stringLookups.endsWith': boolean;
  'stringLookups.includes': boolean;
  'stringLookups.caseInsensitive': boolean;
  'orderBy.sendAfter': boolean;
  'orderBy.sentAt': boolean;
  'orderBy.readAt': boolean;
  'orderBy.createdAt': boolean;
  'orderBy.updatedAt': boolean;
};
export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  /**
   * Get a unique identifier for this backend instance.
   *
   * Used to distinguish between multiple backend instances in a multi-backend setup.
   * When not implemented, callers should use a fallback identifier strategy.
   */
  getBackendIdentifier?(): string;
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
    notification: Omit<Notification<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
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
  /**
   * Applies a replication snapshot only when the destination state is older.
   *
   * This is used to mitigate out-of-order async replication deliveries.
   * Implementations should return `applied: false` when the destination notification
   * is already newer or equal to the snapshot.
   */
  applyReplicationSnapshotIfNewer?(snapshot: AnyDatabaseNotification<Config>): Promise<{
    applied: boolean;
  }>;
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
  persistOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
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
    orderBy?: NotificationOrderBy,
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
  /**
   * Inject logger into backend for debugging and monitoring
   */
  injectLogger?(logger: BaseLogger): void;
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
export declare function isFieldFilter<Config extends BaseNotificationTypeConfig>(
  filter: NotificationFilter<Config>,
): filter is NotificationFilterFields<Config>;
export declare function isStringFilterLookup(value: StringFieldFilter): value is StringFilterLookup;
/**
 * Type guard to check if backend supports attachment operations
 */
export declare function supportsAttachments<Config extends BaseNotificationTypeConfig>(
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
};
//# sourceMappingURL=base-notification-backend.d.ts.map
