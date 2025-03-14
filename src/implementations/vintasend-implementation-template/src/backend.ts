import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { InputJsonValue } from 'vintasend/dist/types/json-values';
import type { DatabaseNotification, NotificationInput } from 'vintasend/dist/types/notification';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';


export class NotificationBackend<
  Config extends BaseNotificationTypeConfig
> implements BaseNotificationBackend<Config> {
    async getAllPendingNotifications(): Promise<
    DatabaseNotification<Config>[]
  > {
    throw new Error('Method not implemented.');
  }

  async getPendingNotifications(): Promise<
    DatabaseNotification<Config>[]
  > {
    throw new Error('Method not implemented.');
  }

  async getAllFutureNotifications(): Promise<
    DatabaseNotification<Config>[]
  > {
    throw new Error('Method not implemented.');
  }

  async getFutureNotifications(): Promise<
    DatabaseNotification<Config>[]
  > {
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
    notification: Partial<
      Omit<DatabaseNotification<Config>, 'id'>
    >,
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

  async cancelNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<void> {
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

  async storeContextUsed(
    notificationId: Config['NotificationIdType'],
    context: InputJsonValue,
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export class NotificationBackendFactory<
  Config extends BaseNotificationTypeConfig
> {
  create() {
    return new NotificationBackend<Config>();
  }
}
