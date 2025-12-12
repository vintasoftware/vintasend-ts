import type { InputJsonValue } from '../../types/json-values';
import type { DatabaseNotification, Notification, DatabaseOneOffNotification, OneOffNotificationInput, AnyDatabaseNotification } from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getPendingNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]>;
  getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getFutureNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]>;
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
    notifications: Omit<Notification<Config>, 'id'>[],
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
  getOneOffNotifications(page: number, pageSize: number): Promise<DatabaseOneOffNotification<Config>[]>;
}
