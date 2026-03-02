import type {
  AnyDatabaseNotification,
  AnyNotification,
  AttachmentFileRecord,
  BaseLogger,
  BaseNotificationBackend,
  BaseNotificationTypeConfig,
  DatabaseNotification,
  DatabaseOneOffNotification,
  InputJsonValue,
  Notification,
  NotificationFilter,
  NotificationFilterCapabilities,
  NotificationInput,
  NotificationOrderBy,
  OneOffNotificationInput,
  StoredAttachment,
} from 'vintasend';

export class NotificationBackend<Config extends BaseNotificationTypeConfig>
  implements BaseNotificationBackend<Config>
{
  private logger: BaseLogger | null = null;

  getBackendIdentifier?(): string {
    return 'vintasend-implementation-template'; // Return a unique identifier for this backend implementation (e.g., 'postgresql', 'mongodb', 'dynamodb', etc.)
  }

  getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getPendingNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getFutureNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getAllFutureNotificationsFromUser(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getFutureNotificationsFromUser(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  persistNotification(
    notification: Omit<Notification<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    throw new Error('Method not implemented.');
  }

  persistNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  applyReplicationSnapshotIfNewer?(snapshot: AnyDatabaseNotification<Config>): Promise<{
    applied: boolean;
  }> {
    throw new Error('Method not implemented.');
  }

  markAsSent(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
  ): Promise<AnyDatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  markAsFailed(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
  ): Promise<AnyDatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  markAsRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent: boolean,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  cancelNotification(notificationId: Config['NotificationIdType']): Promise<void> {
    throw new Error('Method not implemented.');
  }

  getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<AnyDatabaseNotification<Config> | null> {
    throw new Error('Method not implemented.');
  }

  filterAllInAppUnreadNotifications(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  filterInAppUnreadNotifications(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getUserEmailFromNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<string | undefined> {
    throw new Error('Method not implemented.');
  }

  storeAdapterAndContextUsed(
    notificationId: Config['NotificationIdType'],
    adapterKey: string,
    context: InputJsonValue,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  persistOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
  ): Promise<DatabaseOneOffNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  persistOneOffNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  getOneOffNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<DatabaseOneOffNotification<Config> | null> {
    throw new Error('Method not implemented.');
  }

  getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getOneOffNotifications(
    page: number,
    pageSize: number,
  ): Promise<DatabaseOneOffNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

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
  ): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

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
  getFilterCapabilities?(): NotificationFilterCapabilities {
    return {};
  }

  /**
   * Inject logger into backend for debugging and monitoring
   */
  injectLogger(logger: BaseLogger) {
    this.logger = logger;
    // Optional method to receive a logger instance from VintaSend for logging within the backend implementation
  }

  /**
   * Store attachment file record in database.
   * Called after AttachmentManager.uploadFile() returns storageIdentifiers.
   * Backend persists file metadata and storage identifiers for later retrieval.
   */
  storeAttachmentFileRecord?(record: AttachmentFileRecord): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get attachment file record from database by ID.
   * Returns the file metadata and storage identifiers needed to reconstruct file access.
   * Used by AttachmentManager.reconstructAttachmentFile() to get file content.
   */
  getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * @deprecated Use getAttachmentFileRecord instead.
   * Get an attachment file record by ID
   */
  getAttachmentFile(fileId: string): Promise<AttachmentFileRecord | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * Find an attachment file by checksum for deduplication.
   * Backend queries its database for files with matching checksums.
   * Used during file upload to avoid storing duplicate files.
   */
  findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * Delete an attachment file (only if not referenced by any notifications)
   */
  deleteAttachmentFile(fileId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get all attachment files not referenced by any notifications (for cleanup)
   */
  getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get all attachments for a specific notification
   */
  getAttachments(notificationId: Config['NotificationIdType']): Promise<type[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Delete a specific attachment from a notification
   */
  deleteNotificationAttachment?(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export class NotificationBackendFactory<Config extends BaseNotificationTypeConfig> {
  create() {
    return new NotificationBackend<Config>();
  }
}
