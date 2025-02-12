import type { Identifier } from '../types/identifier';
import type { Notification } from '../types/notification';
import type { BaseNotificationAdapter } from './notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from './notification-backends/base-notification-backend';
import type { BaseNotificationTemplateRenderer } from './notification-template-renderers/base-notification-template-renderer';
import type { BaseLogger } from './loggers/base-logger';
import type { BaseNotificationQueueService } from './notification-queue-service/base-notification-queue-service';
import {
  type ContextGenerator,
  NotificationContextRegistry,
} from './notification-context-registry';
import type { JsonObject } from '../types/json-values';

export class NotificationService<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificationIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier,
> {
  constructor(
    private adapters: BaseNotificationAdapter<
      BaseNotificationTemplateRenderer<AvailableContexts, NotificationIdType, UserIdType>,
      BaseNotificationBackend<AvailableContexts, NotificationIdType, UserIdType>,
      AvailableContexts,
      NotificationIdType,
      UserIdType
    >[],
    private backend: BaseNotificationBackend<AvailableContexts, NotificationIdType, UserIdType>,
    private logger: BaseLogger,
    private queueService?: BaseNotificationQueueService<NotificationIdType>,
  ) {}

  registerQueueService(queueService: BaseNotificationQueueService<NotificationIdType>): void {
    this.queueService = queueService;
  }

  async send(
    notification: Notification<AvailableContexts, NotificationIdType, UserIdType>,
  ): Promise<void> {
    const adaptersOfType = this.adapters.filter(
      (adapter) => adapter.notificationType === notification.notificationType,
    );
    if (adaptersOfType.length === 0) {
      throw new Error(`No adapter found for notification type ${notification.notificationType}`);
    }
    const context = await this.getNotificationContext(
      notification.contextName,
      notification.contextParameters,
    );

    if (!notification.id) {
      throw new Error("Notification wan't created in the database. Please create it first");
    }

    for (const adapter of adaptersOfType) {
      if (adapter.enqueueNotifications) {
        if (!this.queueService) {
          throw new Error('Distributed adapter found but no queue service provided');
        }
        try {
          return await this.queueService.enqueueNotification(notification.id);
        } catch (enqueueError) {
          this.logger.error(`Error enqueuing notification ${notification.id}: ${enqueueError}`);
          throw enqueueError;
        }
      }

      try {
        await adapter.send(notification, context);
      } catch (sendError) {
        this.logger.error(
          `Error sending notification ${notification.id} with adapter ${adapter.constructor.name}: ${sendError}`,
        );
        try {
          await this.backend.markPendingAsFailed(notification.id);
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notification.id} as failed: ${markFailedError}`,
          );
        }
        throw sendError;
      }

      try {
        await this.backend.markPendingAsSent(notification.id);
      } catch (markSentError) {
        this.logger.error(
          `Error marking notification ${notification.id} as sent: ${markSentError}`,
        );
      }

      await this.backend.storeContextUsed(notification.id, context ?? {});
    }
  }

  async createNotification(
    notification: Omit<Notification<AvailableContexts, NotificationIdType, UserIdType>, 'id'>,
  ): Promise<Notification<AvailableContexts, NotificationIdType, UserIdType>> {
    const createdNotification = await this.backend.persistNotification(notification) as Notification<AvailableContexts, NotificationIdType, UserIdType>;

    if (notification.sendAfter && notification.sendAfter > new Date()) {
      this.send(createdNotification);
    }

    return createdNotification;
  }

  async updateNotification(
    notificationId: Identifier,
    notification: Partial<
      Omit<Notification<AvailableContexts, NotificationIdType, UserIdType>, 'id'>
    >,
  ) {
    return this.backend.persistNotificationUpdate(notificationId, notification);
  }

  async getAllFutureNotifications() {
    return this.backend.getAllFutureNotifications();
  }

  async getAllFutureNotificationsFromUser(userId: NotificationIdType) {
    return this.backend.getAllFutureNotificationsFromUser(userId);
  }

  async getFutureNotificationsFromUser(userId: NotificationIdType) {
    return this.backend.getFutureNotificationsFromUser(userId);
  }

  async getFutureNotifications() {
    return this.backend.getFutureNotifications();
  }

  async getNotificationContext(
    contextName: keyof AvailableContexts,
    parameters: Parameters<AvailableContexts[keyof AvailableContexts]['generate']>[0],
  ): Promise<JsonObject | null> {
    return NotificationContextRegistry.getInstance().getContext(contextName as string, parameters);
  }

  async sendPendingNotifications(): Promise<void> {
    const pendingNotifications = await this.backend.getAllPendingNotifications();
    await Promise.all(
      pendingNotifications.map((notification) =>
        this.send(notification as Notification<AvailableContexts, NotificationIdType, UserIdType>),
      ),
    );
  }

  async getPendingNotifications() {
    return this.backend.getPendingNotifications();
  }

  async getNotification(notificationId: NotificationIdType, forUpdate: boolean) {
    return this.backend.getNotification(notificationId, forUpdate);
  }

  async markRead(notificationId: NotificationIdType) {
    return this.backend.markSentAsRead(notificationId);
  }

  async getInAppUnread(userId: NotificationIdType) {
    return this.backend.filterAllInAppUnreadNotifications(userId);
  }

  async cancelNotification(notificationId: NotificationIdType): Promise<void> {
    return this.backend.cancelNotification(notificationId);
  }

  async delayedSend(notificationId: NotificationIdType): Promise<void> {
    const notification = await this.getNotification(notificationId, false);

    if (!notification) {
      this.logger.error(`Notification ${notificationId} not found`);
      throw new Error(`Notification ${notificationId} not found`);
    }

    const enqueueNotificationsAdapters = this.adapters.filter(
      (adapter) => adapter.enqueueNotifications,
    );

    if (enqueueNotificationsAdapters.length === 0) {
      throw new Error('Delayed send is not supported if there are no distributed adapters');
    }

    if (!this.queueService) {
      throw new Error('Distributed adapter found but no queue service provided');
    }

    const context = await this.getNotificationContext(
      notification.contextName,
      notification.contextParameters,
    );

    if (!notification.id) {
      throw new Error("Notification wan't created in the database. Please create it first");
    }

    for (const adapter of enqueueNotificationsAdapters) {
      try {
        await adapter.send(notification as Notification<AvailableContexts, NotificationIdType, UserIdType>, context);
      } catch (sendError) {
        this.logger.error(
          `Error sending notification ${notification.id} with adapter ${adapter.constructor.name}: ${sendError}`,
        );
        try {
          await this.backend.markPendingAsFailed(notification.id);
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notification.id} as failed: ${markFailedError}`,
          );
        }
        throw sendError;
      }

      try {
        await this.backend.markPendingAsSent(notification.id);
      } catch (markSentError) {
        this.logger.error(
          `Error marking notification ${notification.id} as sent: ${markSentError}`,
        );
      }
    }
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class NotificationServiceSingleton {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private static instance: NotificationService<any>;

  static getInstance<AvailableContexts extends Record<string, ContextGenerator>>(
    ...args: ConstructorParameters<typeof NotificationService>
  ): NotificationService<AvailableContexts> {
    if (!NotificationServiceSingleton.instance) {
      if (!args) {
        throw new Error(
          'NotificationServiceSingleton is not initialized. Please call getInstance with the required arguments',
        );
      }
      NotificationServiceSingleton.instance = new NotificationService(args[0], args[1], args[2]);
    }

    return NotificationServiceSingleton.instance;
  }
}
