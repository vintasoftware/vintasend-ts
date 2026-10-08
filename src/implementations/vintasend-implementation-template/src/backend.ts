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
  NotificationOrderBy,
  OneOffNotificationInput,
  StoredAttachment,
} from 'vintasend';

export class NotificationBackend<Config extends BaseNotificationTypeConfig>
  implements BaseNotificationBackend<Config>
{
  protected logger: BaseLogger | null = null;

  getBackendIdentifier?(): string {
    return 'vintasend-implementation-template'; // Return a unique identifier for this backend implementation (e.g., 'postgresql', 'mongodb', 'dynamodb', etc.)
  }

  async getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getPendingNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getFutureNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getAllFutureNotificationsFromUser(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getFutureNotificationsFromUser(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async persistNotification(
    notification: Omit<Notification<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    throw new Error('Method not implemented.');
  }

  async persistNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async applyReplicationSnapshotIfNewer?(snapshot: AnyDatabaseNotification<Config>): Promise<{
    applied: boolean;
  }> {
    throw new Error('Method not implemented.');
  }

  async markAsSent(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
  ): Promise<AnyDatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async markAsFailed(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
  ): Promise<AnyDatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async markAsRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent: boolean,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async cancelNotification(notificationId: Config['NotificationIdType']): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<AnyDatabaseNotification<Config> | null> {
    throw new Error('Method not implemented.');
  }

  async filterAllInAppUnreadNotifications(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async filterInAppUnreadNotifications(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getUserEmailFromNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<string | undefined> {
    throw new Error('Method not implemented.');
  }

  async storeAdapterAndContextUsed(
    notificationId: Config['NotificationIdType'],
    adapterKey: string,
    context: InputJsonValue,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Record which version of the template actually rendered this notification.
   *
   * Optional on the interface: delete this method entirely if your store has nowhere to put it,
   * and `usedTemplateVersion` simply stays absent on the records you hold. Everything else keeps
   * working.
   *
   * The service only calls this when the renderer reported a version that differs from what is
   * stored, so there is nothing to deduplicate here. To store the *requested* version too, read
   * `notification.requestedTemplateVersion` in `persistNotification` /
   * `persistOneOffNotification` and their update twins — it arrives as an ordinary field, not
   * through a dedicated method.
   */
  async storeTemplateVersion(
    notificationId: Config['NotificationIdType'],
    templateVersion: number,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async persistOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
  ): Promise<DatabaseOneOffNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async persistOneOffNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async getOneOffNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<DatabaseOneOffNotification<Config> | null> {
    throw new Error('Method not implemented.');
  }

  async getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getOneOffNotifications(
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
   * @param page - Page number (0-indexed) for pagination
   * @param pageSize - Number of results per page
   * @returns Matching notifications
   */
  async filterNotifications(
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
   *   `fields.sendAfterRange`, `fields.createdAtRange`, `fields.sentAtRange`,
   *   `fields.readAtRange`
   * - `negation.sendAfterRange`, `negation.createdAtRange`, `negation.sentAtRange`,
   *   `negation.readAtRange`
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
  async storeAttachmentFileRecord?(record: AttachmentFileRecord): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get attachment file record from database by ID.
   * Returns the file metadata and storage identifiers needed to reconstruct file access.
   * Used by AttachmentManager.reconstructAttachmentFile() to get file content.
   */
  async getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * @deprecated Use getAttachmentFileRecord instead.
   * Get an attachment file record by ID
   */
  async getAttachmentFile(fileId: string): Promise<AttachmentFileRecord | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * Find an attachment file by checksum for deduplication.
   * Backend queries its database for files with matching checksums.
   * Used during file upload to avoid storing duplicate files.
   */
  async findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null> {
    throw new Error('Method not implemented.');
  }

  /**
   * Delete an attachment file (only if not referenced by any notifications)
   */
  async deleteAttachmentFile(fileId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get all attachment files not referenced by any notifications (for cleanup)
   */
  async getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get all attachments for a specific notification
   */
  async getAttachments(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Delete a specific attachment from a notification
   */
  async deleteNotificationAttachment?(
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
