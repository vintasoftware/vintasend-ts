import type { BaseNotificationBackend, NotificationFilter } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { InputJsonValue } from 'vintasend/dist/types/json-values';
import type { AnyDatabaseNotification, AnyNotification, DatabaseNotification, DatabaseOneOffNotification, NotificationInput, OneOffNotificationInput } from 'vintasend/dist/types/notification';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';

export class NotificationBackend<Config extends BaseNotificationTypeConfig>
  implements BaseNotificationBackend<Config>
{
  async getAllPendingNotifications(): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getPendingNotifications(): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getAllFutureNotifications(): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getFutureNotifications(): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getAllFutureNotificationsFromUser(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async getFutureNotificationsFromUser(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  async persistNotification(
    notification: NotificationInput<Config>,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async persistNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<DatabaseNotification<Config>, 'id'>>,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async markAsSent(
    notificationId: Config['NotificationIdType'],
    checkIsPending = true,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async markAsFailed(
    notificationId: Config['NotificationIdType'],
    checkIsPending = true,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async markAsRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent = true,
  ): Promise<DatabaseNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  async cancelNotification(notificationId: Config['NotificationIdType']): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async getNotification(
    notificationId: Config['NotificationIdType'],
    _forUpdate: boolean,
  ): Promise<DatabaseNotification<Config> | null> {
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

  getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  bulkPersistNotifications(notifications: Omit<AnyNotification<Config>, 'id'>[]): Promise<Config['NotificationIdType'][]> {
    throw new Error('Method not implemented.');
  }

  persistOneOffNotification(notification: Omit<OneOffNotificationInput<Config>, 'id'>): Promise<DatabaseOneOffNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  persistOneOffNotificationUpdate(notificationId: Config['NotificationIdType'], notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>): Promise<DatabaseOneOffNotification<Config>> {
    throw new Error('Method not implemented.');
  }

  getOneOffNotification(notificationId: Config['NotificationIdType'], forUpdate: boolean): Promise<DatabaseOneOffNotification<Config> | null> {
    throw new Error('Method not implemented.');
  }

  getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  getOneOffNotifications(page: number, pageSize: number): Promise<DatabaseOneOffNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }

  filterNotifications(filter: NotificationFilter<Config>, page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]> {
    throw new Error('Method not implemented.');
  }
}

export class NotificationBackendFactory<Config extends BaseNotificationTypeConfig> {
  create() {
    return new NotificationBackend<Config>();
  }
}
