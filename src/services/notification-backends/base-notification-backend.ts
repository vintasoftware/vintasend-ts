import type { InputJsonValue } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';
import type { DatabaseNotification, Notification } from '../../types/notification';
import type { ContextGenerator } from '../notification-context-registry';

export interface BaseNotificationBackend<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> {
  getAllPendingNotifications(): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  getPendingNotifications(): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  getAllFutureNotifications(): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  getFutureNotifications(): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  getAllFutureNotificationsFromUser(
    userId: Identifier,
  ): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  getFutureNotificationsFromUser(userId: Identifier): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  persistNotification(
    notification: Omit<Notification<AvailableContexts, NotificationIdType, UserIdType>, 'id'>,
  ): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>>;
  persistNotificationUpdate(
    notificationId: Identifier,
    notification: Partial<Omit<Notification<AvailableContexts, NotificationIdType, UserIdType>, 'id'>>,
  ): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>>;
  markPendingAsSent(notificationId: Identifier): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>>;
  markPendingAsFailed(notificationId: Identifier): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>>;
  markSentAsRead(notificationId: Identifier): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>>;
  cancelNotification(notificationId: Identifier): Promise<void>;
  getNotification(
    notificationId: Identifier,
    forUpdate: boolean,
  ): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType> | null>;
  filterAllInAppUnreadNotifications(
    userId: Identifier,
  ): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  filterInAppUnreadNotifications(
    userId: Identifier,
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<AvailableContexts, NotificationIdType, UserIdType>[]>;
  getUserEmailFromNotification(notificationId: Identifier): Promise<string | undefined>;
  storeContextUsed(
    notificationId: Identifier,
    context: InputJsonValue,
  ): Promise<void>;
}
