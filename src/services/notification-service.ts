import type { DatabaseNotification, Notification } from '../types/notification';
import {
  NotificationContextRegistry,
} from './notification-context-registry';
import type { JsonObject } from '../types/json-values';
import type { BaseNotificationTypeConfig } from '../types/notification-type-config';
import type { BaseNotificationAdapter } from './notification-adapters/base-notification-adapter';
import type { BaseNotificationTemplateRenderer } from './notification-template-renderers/base-notification-template-renderer';
import type { BaseNotificationBackend } from './notification-backends/base-notification-backend';
import type { BaseLogger } from './loggers/base-logger';
import type { BaseNotificationQueueService } from './notification-queue-service/base-notification-queue-service';


type NotificationServiceOptions = {
  raiseErrorOnFailedSend: boolean;
};

export class NotificationService<
  Config extends BaseNotificationTypeConfig
> {
  constructor(
    private adapters: BaseNotificationAdapter<BaseNotificationTemplateRenderer<Config>, Config>[],
    private backend: BaseNotificationBackend<Config>,
    private logger: BaseLogger,
    private queueService?: BaseNotificationQueueService<Config>,
    private options: NotificationServiceOptions = {
      raiseErrorOnFailedSend: false,
    },
  ) {
    for (const adapter of adapters) {
      adapter.injectBackend(backend);
    }
  }

  registerQueueService(queueService: BaseNotificationQueueService<Config>): void {
    this.queueService = queueService;
  }

  async send(
    notification: DatabaseNotification<Config>,
  ): Promise<void> {
    const adaptersOfType = this.adapters.filter(
      (adapter) => adapter.notificationType === notification.notificationType,
    );
    if (adaptersOfType.length === 0) {
      this.logger.error(`No adapter found for notification type ${notification.notificationType}`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`No adapter found for notification type ${notification.notificationType}`);
      }
      return;
    }

    if (!notification.id) {
      throw new Error("Notification wasn't created in the database. Please create it first");
    }

    for (const adapter of adaptersOfType) {
      if (adapter.enqueueNotifications) {
        if (!this.queueService) {
          this.logger.error('Distributed adapter found but no queue service provided');
          continue;
        }
        try {
          this.logger.info(`Enqueuing notification ${notification.id} with adapter ${adapter.key}`);
          await this.queueService.enqueueNotification(notification.id);
          this.logger.info(`Enqueued notification ${notification.id} with adapter ${adapter.key} successfully`);
          continue;
        } catch (enqueueError) {
          this.logger.error(`Error enqueuing notification ${notification.id}: ${enqueueError} with adapter ${adapter.key}`);
          continue;
        }
      }

      let context: JsonObject | null = null;
      try {
        context = await this.getNotificationContext(
          notification.contextName,
          notification.contextParameters,
        );
        this.logger.info(`Generated context for notification ${notification.id}`);
      } catch (contextError) {
        this.logger.error(`Error getting context for notification ${notification.id}: ${contextError}`);
        if (this.options.raiseErrorOnFailedSend) {
          throw contextError;
        }
        return;
      }

      try {
        this.logger.info(`Sending notification ${notification.id} with adapter ${adapter.key}`);
        await adapter.send(notification, context);
        this.logger.info(`Sent notification ${notification.id} with adapter ${adapter.key} successfully`);
      } catch (sendError) {
        this.logger.error(
          `Error sending notification ${notification.id} with adapter ${adapter.key}: ${sendError}`,
        );
        try {
          await this.backend.markPendingAsFailed(notification.id);
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notification.id} as failed: ${markFailedError}`,
          );
        }
        continue;
      }

      try {
        await this.backend.markPendingAsSent(notification.id);
      } catch (markSentError) {
        this.logger.error(
          `Error marking notification ${notification.id} as sent: ${markSentError}`,
        );
      }

      try {
        await this.backend.storeContextUsed(notification.id, context ?? {});
      } catch (storeContextError) {
        this.logger.error(
          `Error storing context for notification ${notification.id}: ${storeContextError}`,
        );
      }
    }
  }

  async createNotification(
    notification: Omit<Notification<Config>, 'id'>,
  ): Promise<Notification<Config>> {
    const createdNotification = await this.backend.persistNotification(notification);
    this.logger.error(`Notification ${createdNotification.id} created`);

    if (notification.sendAfter && notification.sendAfter <= new Date()) {
      this.logger.info(`Notification ${createdNotification.id} sent immediately because sendAfter is in the past`);
      this.send(createdNotification);
    } else {
      this.logger.info(`Notification ${createdNotification.id} scheduled for ${notification.sendAfter}`);
    }

    return createdNotification;
  }

  async updateNotification(
    notificationId: Config['NotificationIdType'],
    notification: Partial<
      Omit<Notification<Config>, 'id'>
    >,
  ) {
    const updatedNotification = this.backend.persistNotificationUpdate(notificationId, notification);
    this.logger.info(`Notification ${notificationId} updated`);
    return updatedNotification;
  }

  async getAllFutureNotifications() {
    return this.backend.getAllFutureNotifications();
  }

  async getAllFutureNotificationsFromUser(userId: Config['NotificationIdType']) {
    return this.backend.getAllFutureNotificationsFromUser(userId);
  }

  async getFutureNotificationsFromUser(userId: Config['NotificationIdType']) {
    return this.backend.getFutureNotificationsFromUser(userId);
  }

  async getFutureNotifications() {
    return this.backend.getFutureNotifications();
  }

  async getNotificationContext(
    contextName: keyof Config['ContextMap'],
    parameters: Parameters<Config['ContextMap'][keyof Config['ContextMap']]['generate']>[0],
  ): Promise<JsonObject> {
    const contextRegistry = NotificationContextRegistry.getInstance();
    return contextRegistry.getContext(contextName as string, parameters);
  }

  async sendPendingNotifications(): Promise<void> {
    const pendingNotifications = await this.backend.getAllPendingNotifications();
    await Promise.all(
      pendingNotifications.map((notification) =>
        this.send(notification),
      ),
    );
  }

  async getPendingNotifications() {
    return this.backend.getPendingNotifications();
  }

  async getNotification(notificationId: Config['NotificationIdType'], forUpdate = false) {
    return this.backend.getNotification(notificationId, forUpdate);
  }

  async markRead(notificationId: Config['NotificationIdType']) {
    const notification = this.backend.markSentAsRead(notificationId);
    this.logger.info(`Notification ${notificationId} marked as read`);
    return notification;
  }

  async getInAppUnread(userId: Config['NotificationIdType']) {
    return this.backend.filterAllInAppUnreadNotifications(userId);
  }

  async cancelNotification(notificationId: Config['NotificationIdType']): Promise<void> {
    await this.backend.cancelNotification(notificationId);
    this.logger.info(`Notification ${notificationId} cancelled`);
  }

  async delayedSend(notificationId: Config['NotificationIdType']): Promise<void> {
    const notification = await this.getNotification(notificationId, false);

    if (!notification) {
      this.logger.error(`Notification ${notificationId} not found`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} not found`);
      }
      return;
    }

    const enqueueNotificationsAdapters = this.adapters.filter(
      (adapter) => adapter.enqueueNotifications,
    );

    if (enqueueNotificationsAdapters.length === 0) {
      this.logger.error('Delayed send is not supported if there are no distributed adapters');
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error('Delayed send is not supported if there are no distributed adapters');
      }
      return;
    }

    const context = await this.getNotificationContext(
      notification.contextName,
      notification.contextParameters,
    );

    for (const adapter of enqueueNotificationsAdapters) {
      try {
        await adapter.send(notification, context);
      } catch (sendError) {
        this.logger.error(
          `Error sending notification ${notification.id} with adapter ${adapter.key}: ${sendError}`,
        );
        try {
          await this.backend.markPendingAsFailed(notification.id);
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notification.id} as failed: ${markFailedError}`,
          );
        }
      }

      try {
        await this.backend.markPendingAsSent(notification.id);
      } catch (markSentError) {
        this.logger.error(
          `Error marking notification ${notification.id} as sent: ${markSentError}`,
        );
      }

    }

    try {
      await this.backend.storeContextUsed(notification.id, context);
    } catch (storeContextError) {
      this.logger.error(
        `Error storing context for notification ${notification.id}: ${storeContextError}`,
      );
    }
  }
}

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class NotificationServiceSingleton {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private static instance: NotificationService<any>;

  static getInstance<Config extends BaseNotificationTypeConfig>(
    ...args: ConstructorParameters<typeof NotificationService> | []
  ): NotificationService<Config> {
    if (!NotificationServiceSingleton.instance) {
      if (!args || args.length === 0) {
        throw new Error(
          'NotificationServiceSingleton is not initialized. Please call getInstance with the required arguments',
        );
      }
      NotificationServiceSingleton.instance = new NotificationService(...args);
    }

    return NotificationServiceSingleton.instance;
  }
}
