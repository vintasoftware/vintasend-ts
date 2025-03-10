import type { InputJsonValue } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';
import type { DatabaseNotification, Notification } from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  getAllPendingNotifications(): Promise<DatabaseNotification<Config>[]>;
  getPendingNotifications(): Promise<DatabaseNotification<Config>[]>;
  getAllFutureNotifications(): Promise<DatabaseNotification<Config>[]>;
  getFutureNotifications(): Promise<DatabaseNotification<Config>[]>;
  getAllFutureNotificationsFromUser(
    userId: Config["UserIdType"],
  ): Promise<DatabaseNotification<Config>[]>;
  getFutureNotificationsFromUser(userId: Config["UserIdType"]): Promise<DatabaseNotification<Config>[]>;
  persistNotification(
    notification: Omit<Notification<Config>, 'id'>,
  ): Promise<DatabaseNotification<Config>>;
  persistNotificationUpdate(
    notificationId: Config["NotificationIdType"],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>>;
  markPendingAsSent(notificationId: Config["NotificationIdType"],): Promise<DatabaseNotification<Config>>;
  markPendingAsFailed(notificationId: Config["NotificationIdType"],): Promise<DatabaseNotification<Config>>;
  markSentAsRead(notificationId: Config["NotificationIdType"],): Promise<DatabaseNotification<Config>>;
  cancelNotification(notificationId: Config["NotificationIdType"],): Promise<void>;
  getNotification(
    notificationId: Config["NotificationIdType"],
    forUpdate: boolean,
  ): Promise<DatabaseNotification<Config> | null>;
  filterAllInAppUnreadNotifications(
    userId: Config["UserIdType"],
  ): Promise<DatabaseNotification<Config>[]>;
  filterInAppUnreadNotifications(
    userId: Config["UserIdType"],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]>;
  getUserEmailFromNotification(notificationId: Config["NotificationIdType"],): Promise<string | undefined>;
  storeContextUsed(
    notificationId: Config["NotificationIdType"],
    context: InputJsonValue,
  ): Promise<void>;
}
