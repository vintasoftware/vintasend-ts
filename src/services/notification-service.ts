import type { DatabaseNotification, Notification, NotificationResendWithContextInput } from '../types/notification';
import type { JsonObject } from '../types/json-values';
import type { BaseNotificationTypeConfig } from '../types/notification-type-config';
import type { BaseNotificationAdapter } from './notification-adapters/base-notification-adapter';
import type { BaseNotificationTemplateRenderer } from './notification-template-renderers/base-notification-template-renderer';
import type { BaseNotificationBackend } from './notification-backends/base-notification-backend';
import type { BaseLogger } from './loggers/base-logger';
import type { BaseNotificationQueueService } from './notification-queue-service/base-notification-queue-service';
import { NotificationContextGeneratorsMap } from './notification-context-generators-map';

type VintaSendOptions = {
  raiseErrorOnFailedSend: boolean;
};

export class VintaSendFactory<
  Config extends BaseNotificationTypeConfig
> {
  create<
    AdaptersList extends BaseNotificationAdapter<BaseNotificationTemplateRenderer<Config>, Config>[],
    Backend extends BaseNotificationBackend<Config>,
    Logger extends BaseLogger,
    QueueService extends BaseNotificationQueueService<Config>,
  >(
    adapters: AdaptersList,
    backend: Backend,
    logger: Logger,
    contextGeneratorsMap: BaseNotificationTypeConfig['ContextMap'],
    queueService?: QueueService,
    options: VintaSendOptions = {
      raiseErrorOnFailedSend: false,
    },
  ) {
    return new VintaSend<
      Config,
      AdaptersList,
      Backend,
      Logger,
      QueueService
    >(
      adapters,
      backend,
      logger,
      contextGeneratorsMap,
      queueService,
      options,
    );
  }
}

export class VintaSend<
  Config extends BaseNotificationTypeConfig,
  AdaptersList extends BaseNotificationAdapter<BaseNotificationTemplateRenderer<Config>, Config>[],
  Backend extends BaseNotificationBackend<Config>,
  Logger extends BaseLogger,
  QueueService extends BaseNotificationQueueService<Config>,
> {
  private contextGeneratorsMap: NotificationContextGeneratorsMap<Config['ContextMap']>;
  constructor(
    private adapters: AdaptersList,
    private backend: Backend,
    private logger: Logger,
    contextGeneratorsMap: Config['ContextMap'],
    private queueService?: QueueService,
    private options: VintaSendOptions = {
      raiseErrorOnFailedSend: false,
    },
  ) {
    this.contextGeneratorsMap = new NotificationContextGeneratorsMap(contextGeneratorsMap);
    for (const adapter of adapters) {
      adapter.injectBackend(backend);
    }
  }

  registerQueueService(queueService: QueueService): void {
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
      if (notification.contextUsed) {
        context = notification.contextUsed;
      } else {

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
          await this.backend.markAsFailed(notification.id, true);
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notification.id} as failed: ${markFailedError}`,
          );
        }
        continue;
      }

      try {
        await this.backend.markAsSent(notification.id, true);
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
  ): Promise<DatabaseNotification<Config>> {
    const createdNotification = await this.backend.persistNotification(notification);
    this.logger.error(`Notification ${createdNotification.id} created`);

    if (!notification.sendAfter || notification.sendAfter <= new Date()) {
      this.logger.info(`Notification ${createdNotification.id} sent immediately because sendAfter is in the past`);
      await this.send(createdNotification);
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

  async getFutureNotificationsFromUser(userId: Config['NotificationIdType'], page: number, pageSize: number) {
    return this.backend.getFutureNotificationsFromUser(userId, page, pageSize);
  }

  async getFutureNotifications(page: number, pageSize: number) {
    return this.backend.getFutureNotifications(page, pageSize);
  }

  async getNotificationContext<ContextName extends string & keyof Config['ContextMap']>(
    contextName: ContextName,
    parameters: Parameters<ReturnType<typeof this.contextGeneratorsMap.getContextGenerator<ContextName>>['generate']>[0],
  ) {
    const context = this.contextGeneratorsMap.getContextGenerator(contextName).generate(parameters);

    if (context instanceof Promise) {
      return await context;
    }
    return Promise.resolve(context);
  }

  async sendPendingNotifications(): Promise<void> {
    const pendingNotifications = await this.backend.getAllPendingNotifications();
    await Promise.all(
      pendingNotifications.map((notification) =>
        this.send(notification),
      ),
    );
  }

  async getPendingNotifications(page: number, pageSize: number) {
    return this.backend.getPendingNotifications(page, pageSize);
  }

  async getNotification(notificationId: Config['NotificationIdType'], forUpdate = false) {
    return this.backend.getNotification(notificationId, forUpdate);
  }

  async markRead(notificationId: Config['NotificationIdType'], checkIsSent = true): Promise<DatabaseNotification<Config>> {
    const notification = await this.backend.markAsRead(notificationId, checkIsSent);
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

  async resendNotification(notificationId: Config['NotificationIdType'], useStoredContextIfAvailable = false): Promise<DatabaseNotification<Config> | undefined> {
    const notification = await this.getNotification(notificationId, false);

    if (!notification) {
      this.logger.error(`Notification ${notificationId} not found`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} not found`);
      }
      return;
    }

    if (notification.sendAfter && notification.sendAfter > new Date()) {
      this.logger.info(`Notification ${notificationId} is scheduled for the future`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} is scheduled for the future`);
      }
      return;
    }

    if (useStoredContextIfAvailable && !notification.contextUsed) {
      this.logger.error(`Context not found for notification ${notificationId}`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Context not found for notification ${notificationId}`);
      }
      return;
    }

    const notificationResendInputWithoutContext = {
      userId: notification.userId,
      notificationType: notification.notificationType,
      title: notification.title,
      bodyTemplate: notification.bodyTemplate,
      contextName: notification.contextName,
      contextParameters: notification.contextParameters,
      sendAfter: null,
      subjectTemplate: notification.subjectTemplate,
      extraParams: notification.extraParams,
    };

    let createdNotification: DatabaseNotification<Config>;
    if (useStoredContextIfAvailable && notification.contextUsed) {
      const notificationResendInput = {
        ...notificationResendInputWithoutContext,
        contextUsed: notification.contextUsed,
      };
      createdNotification = await this.backend.persistNotification(notificationResendInput);
    } else {
      const notificationResendInput = {
        ...notificationResendInputWithoutContext,
        contextUsed: await this.getNotificationContext(
          notification.contextName,
          notification.contextParameters,
        ),
      };
      createdNotification = await this.backend.persistNotification(notificationResendInput);
    }

    this.logger.info(`Notification ${createdNotification.id} created for resending notification ${notificationId}`);
    this.send(createdNotification);
    return createdNotification;

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
          await this.backend.markAsFailed(notification.id, true);
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notification.id} as failed: ${markFailedError}`,
          );
        }
      }

      try {
        await this.backend.markAsSent(notification.id, true);
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

  async bulkPersistNotifications(
    notifications: Omit<Notification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    return this.backend.bulkPersistNotifications(notifications);
  }

  async migrateToBackend<
    DestinationBackend extends BaseNotificationBackend<Config>
  >(destinationBackend: DestinationBackend, batchSize = 5000): Promise<void> {
    let pageNumber = 0;
    let notifications: DatabaseNotification<Config>[] = await this.backend.getNotifications(pageNumber, batchSize);
    while (notifications.length > 0) {
      pageNumber += 1;
      const notificationsWitoutId = notifications.map((notification) => {
        const { id, ...notificationWithoutId } = notification;
        return notificationWithoutId;
      });
      destinationBackend.bulkPersistNotifications(notificationsWitoutId);
      notifications = await this.backend.getNotifications(pageNumber, batchSize);
    }
  }
}
