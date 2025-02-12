import type { InputJsonValue } from '../../types/json-values';
import type { Identifier } from '../../types/identifier';
import type { Notification } from '../../types/notification';
import type { ContextGenerator } from '../notification-context-registry';

export interface BaseNotificationBackend<AvailableContexts extends Record<string, ContextGenerator>> {
  getAllPendingNotifications(): Promise<Notification<AvailableContexts>[]>;
  getPendingNotifications(): Promise<Notification<AvailableContexts>[]>;
  getAllFutureNotifications(): Promise<Notification<AvailableContexts>[]>;
  getFutureNotifications(): Promise<Notification<AvailableContexts>[]>;
  getAllFutureNotificationsFromUser(
    userId: Identifier,
  ): Promise<Notification<AvailableContexts>[]>;
  getFutureNotificationsFromUser(userId: Identifier): Promise<Notification<AvailableContexts>[]>;
  persistNotification(
    notification: Omit<Notification<AvailableContexts>, 'id'>,
  ): Promise<Notification<AvailableContexts>>;
  persistNotificationUpdate(
    notificationId: Identifier,
    notification: Partial<Omit<Notification<AvailableContexts>, 'id'>>,
  ): Promise<Notification<AvailableContexts>>;
  markPendingAsSent(notificationId: Identifier): Promise<Notification<AvailableContexts>>;
  markPendingAsFailed(notificationId: Identifier): Promise<Notification<AvailableContexts>>;
  markSentAsRead(notificationId: Identifier): Promise<Notification<AvailableContexts>>;
  cancelNotification(notificationId: Identifier): Promise<void>;
  getNotification(
    notificationId: Identifier,
    forUpdate: boolean,
  ): Promise<Notification<AvailableContexts> | null>;
  filterAllInAppUnreadNotifications(
    userId: Identifier,
  ): Promise<Notification<AvailableContexts>[]>;
  filterInAppUnreadNotifications(
    userId: Identifier,
    page: number,
    pageSize: number,
  ): Promise<Notification<AvailableContexts>[]>;
  getUserEmailFromNotification(notificationId: Identifier): Promise<string | undefined>;
  storeContextUsed(
    notificationId: Identifier,
    context: InputJsonValue,
  ): Promise<void>;
}
