import type { InputJsonValue } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';
import type { DatabaseNotification, Notification } from '../../types/notification';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config';

export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  getAllPendingNotifications(): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  getPendingNotifications(): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  getAllFutureNotifications(): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  getFutureNotifications(): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  getAllFutureNotificationsFromUser(
    userId: Config["UserIdType"],
  ): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  getFutureNotificationsFromUser(userId: Config["UserIdType"]): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  persistNotification(
    notification: Omit<Notification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>, 'id'>,
  ): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>>;
  persistNotificationUpdate(
    notificationId: Config["NotificationIdType"],
    notification: Partial<Omit<Notification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>, 'id'>>,
  ): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>>;
  markPendingAsSent(notificationId: Config["NotificationIdType"],): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>>;
  markPendingAsFailed(notificationId: Config["NotificationIdType"],): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>>;
  markSentAsRead(notificationId: Config["NotificationIdType"],): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>>;
  cancelNotification(notificationId: Config["NotificationIdType"],): Promise<void>;
  getNotification(
    notificationId: Config["NotificationIdType"],
    forUpdate: boolean,
  ): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]> | null>;
  filterAllInAppUnreadNotifications(
    userId: Config["UserIdType"],
  ): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  filterInAppUnreadNotifications(
    userId: Config["UserIdType"],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config["ContextMap"], Config["NotificationIdType"], Config["UserIdType"]>[]>;
  getUserEmailFromNotification(notificationId: Config["NotificationIdType"],): Promise<string | undefined>;
  storeContextUsed(
    notificationId: Config["NotificationIdType"],
    context: InputJsonValue,
  ): Promise<void>;
}
