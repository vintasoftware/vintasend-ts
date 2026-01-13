import type { JsonObject } from '../types/json-values';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
} from '../types/notification';
import type { BaseNotificationTypeConfig } from '../types/notification-type-config';
import type { OneOffNotificationInput } from '../types/one-off-notification';
import type { BaseAttachmentManager } from './attachment-manager/base-attachment-manager';
import type { BaseLogger } from './loggers/base-logger';
import {
  type BaseNotificationAdapter,
  isOneOffNotification,
} from './notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from './notification-backends/base-notification-backend';
import { NotificationContextGeneratorsMap } from './notification-context-generators-map';
import type { BaseNotificationQueueService } from './notification-queue-service/base-notification-queue-service';
import type { BaseNotificationTemplateRenderer } from './notification-template-renderers/base-notification-template-renderer';

type VintaSendOptions = {
  raiseErrorOnFailedSend: boolean;
};

export class VintaSendFactory<Config extends BaseNotificationTypeConfig> {
  create<
    AdaptersList extends BaseNotificationAdapter<
      BaseNotificationTemplateRenderer<Config>,
      Config
    >[],
    Backend extends BaseNotificationBackend<Config>,
    Logger extends BaseLogger,
    QueueService extends BaseNotificationQueueService<Config>,
    AttachmentMgr extends BaseAttachmentManager,
  >(
    adapters: AdaptersList,
    backend: Backend,
    logger: Logger,
    contextGeneratorsMap: BaseNotificationTypeConfig['ContextMap'],
    queueService?: QueueService,
    attachmentManager?: AttachmentMgr,
    options: VintaSendOptions = {
      raiseErrorOnFailedSend: false,
    },
  ) {
    return new VintaSend<Config, AdaptersList, Backend, Logger, QueueService, AttachmentMgr>(
      adapters,
      backend,
      logger,
      contextGeneratorsMap,
      queueService,
      attachmentManager,
      options,
    );
  }
}

// Type guard to check if backend has attachment manager injection support
function hasAttachmentManagerInjection<Config extends BaseNotificationTypeConfig>(
  backend: BaseNotificationBackend<Config>,
): backend is BaseNotificationBackend<Config> & {
  injectAttachmentManager(manager: BaseAttachmentManager): void;
} {
  return 'injectAttachmentManager' in backend && typeof (backend as any).injectAttachmentManager === 'function';
}

export class VintaSend<
  Config extends BaseNotificationTypeConfig,
  AdaptersList extends BaseNotificationAdapter<BaseNotificationTemplateRenderer<Config>, Config>[],
  Backend extends BaseNotificationBackend<Config>,
  Logger extends BaseLogger,
  QueueService extends BaseNotificationQueueService<Config>,
  AttachmentMgr extends BaseAttachmentManager,
> {
  private contextGeneratorsMap: NotificationContextGeneratorsMap<Config['ContextMap']>;
  constructor(
    private adapters: AdaptersList,
    private backend: Backend,
    private logger: Logger,
    contextGeneratorsMap: Config['ContextMap'],
    private queueService?: QueueService,
    private attachmentManager?: AttachmentMgr,
    private options: VintaSendOptions = {
      raiseErrorOnFailedSend: false,
    },
  ) {
    this.contextGeneratorsMap = new NotificationContextGeneratorsMap(contextGeneratorsMap);
    for (const adapter of adapters) {
      adapter.injectBackend(backend);
      adapter.injectLogger(logger);
    }
    // Inject attachment manager into backend if both exist
    if (this.attachmentManager && hasAttachmentManagerInjection(backend)) {
      backend.injectAttachmentManager(this.attachmentManager);
    }
  }

  registerQueueService(queueService: QueueService): void {
    this.queueService = queueService;
  }

  async send(notification: AnyDatabaseNotification<Config>): Promise<void> {
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
          this.logger.info(
            `Enqueued notification ${notification.id} with adapter ${adapter.key} successfully`,
          );
          continue;
        } catch (enqueueError) {
          this.logger.error(
            `Error enqueuing notification ${notification.id}: ${enqueueError} with adapter ${adapter.key}`,
          );
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
          this.logger.error(
            `Error getting context for notification ${notification.id}: ${contextError}`,
          );
          if (this.options.raiseErrorOnFailedSend) {
            throw contextError;
          }
          return;
        }
      }

      try {
        this.logger.info(`Sending notification ${notification.id} with adapter ${adapter.key}`);
        await adapter.send(notification, context);
        this.logger.info(
          `Sent notification ${notification.id} with adapter ${adapter.key} successfully`,
        );
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
      this.logger.info(
        `Notification ${createdNotification.id} sent immediately because sendAfter is null or in the past`,
      );
      await this.send(createdNotification);
    } else {
      this.logger.info(
        `Notification ${createdNotification.id} scheduled for ${notification.sendAfter}`,
      );
    }

    return createdNotification;
  }

  async updateNotification(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
  ) {
    const updatedNotification = this.backend.persistNotificationUpdate(
      notificationId,
      notification,
    );
    this.logger.info(`Notification ${notificationId} updated`);
    return updatedNotification;
  }

  /**
   * Creates and sends a one-off notification.
   * One-off notifications are sent directly to an email/phone without requiring a user account.
   *
   * @param notification - The one-off notification to create (without id)
   * @returns The created database notification
   */
  async createOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    // Validate email or phone format
    this.validateEmailOrPhone(notification.emailOrPhone);

    const createdNotification = await this.backend.persistOneOffNotification(notification);
    this.logger.info(`One-off notification ${createdNotification.id} created`);

    if (!notification.sendAfter || notification.sendAfter <= new Date()) {
      this.logger.info(`One-off notification ${createdNotification.id} sent immediately`);
      await this.send(createdNotification);
    } else {
      this.logger.info(
        `One-off notification ${createdNotification.id} scheduled for ${notification.sendAfter}`,
      );
    }

    return createdNotification;
  }

  /**
   * Updates a one-off notification and re-sends it if the sendAfter date is in the past.
   *
   * @param notificationId - The ID of the notification to update
   * @param notification - The partial notification data to update
   * @returns The updated database notification
   */
  async updateOneOffNotification(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
  ): Promise<DatabaseOneOffNotification<Config>> {
    // Validate email or phone format if provided
    if (notification.emailOrPhone !== undefined) {
      this.validateEmailOrPhone(notification.emailOrPhone);
    }

    const updatedNotification = await this.backend.persistOneOffNotificationUpdate(
      notificationId,
      notification,
    );
    this.logger.info(`One-off notification ${notificationId} updated`);

    if (!updatedNotification.sendAfter || updatedNotification.sendAfter <= new Date()) {
      this.logger.info(`One-off notification ${notificationId} sent after update`);
      await this.send(updatedNotification);
    }

    return updatedNotification;
  }

  /**
   * Validates that an email or phone number has a basic valid format.
   *
   * @param emailOrPhone - The email or phone string to validate
   * @throws Error if the format is invalid
   */
  private validateEmailOrPhone(emailOrPhone: string): void {
    // Basic non-empty check
    if (emailOrPhone === '' || emailOrPhone.trim() === '') {
      throw new Error('emailOrPhone cannot be empty');
    }
    // Check if it's an email (has @ with characters before and after)
    const isEmail = /^.+@.+\..+$/.test(emailOrPhone);
    // Check if it's a phone (10-15 digits, optionally starting with +)
    const isPhone = /^\+?[0-9]{10,15}$/.test(emailOrPhone);

    if (!isEmail && !isPhone) {
      throw new Error('Invalid email or phone format');
    }
  }

  async getAllFutureNotifications() {
    return this.backend.getAllFutureNotifications();
  }

  async getAllFutureNotificationsFromUser(userId: Config['NotificationIdType']) {
    return this.backend.getAllFutureNotificationsFromUser(userId);
  }

  async getFutureNotificationsFromUser(
    userId: Config['NotificationIdType'],
    page: number,
    pageSize: number,
  ) {
    return this.backend.getFutureNotificationsFromUser(userId, page, pageSize);
  }

  async getFutureNotifications(page: number, pageSize: number) {
    return this.backend.getFutureNotifications(page, pageSize);
  }

  async getNotificationContext<ContextName extends string & keyof Config['ContextMap']>(
    contextName: ContextName,
    parameters: Parameters<
      ReturnType<typeof this.contextGeneratorsMap.getContextGenerator<ContextName>>['generate']
    >[0],
  ) {
    const context = this.contextGeneratorsMap.getContextGenerator(contextName).generate(parameters);

    if (context instanceof Promise) {
      return await context;
    }
    return Promise.resolve(context);
  }

  async sendPendingNotifications(): Promise<void> {
    const pendingNotifications = await this.backend.getAllPendingNotifications();
    await Promise.all(pendingNotifications.map((notification) => this.send(notification)));
  }

  async getPendingNotifications(page: number, pageSize: number) {
    return this.backend.getPendingNotifications(page, pageSize);
  }

  async getNotification(notificationId: Config['NotificationIdType'], forUpdate = false) {
    return this.backend.getNotification(notificationId, forUpdate);
  }

  /**
   * Gets a one-off notification by ID.
   *
   * @param notificationId - The ID of the one-off notification to retrieve
   * @param forUpdate - Whether the notification is being retrieved for update (default: false)
   * @returns The one-off notification or null if not found
   */
  async getOneOffNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate = false,
  ): Promise<DatabaseOneOffNotification<Config> | null> {
    return this.backend.getOneOffNotification(notificationId, forUpdate);
  }

  async markRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent = true,
  ): Promise<DatabaseNotification<Config>> {
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

  async resendNotification(
    notificationId: Config['NotificationIdType'],
    useStoredContextIfAvailable = false,
  ): Promise<DatabaseNotification<Config> | undefined> {
    const notification = await this.getNotification(notificationId, false);

    if (!notification) {
      this.logger.error(`Notification ${notificationId} not found`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} not found`);
      }
      return;
    }

    // Check if this is a one-off notification (which cannot be resent this way)
    if (isOneOffNotification(notification)) {
      this.logger.error(
        `Cannot resend one-off notification ${notificationId} using resendNotification. One-off notifications are not supported.`,
      );
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(
          `Cannot resend one-off notification ${notificationId}. One-off notifications must be resent using a different method.`,
        );
      }
      return;
    }

    if (notification.sendAfter && notification.sendAfter > new Date()) {
      this.logger.error(`Notification ${notificationId} is scheduled for the future`);
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

    this.logger.info(
      `Notification ${createdNotification.id} created for resending notification ${notificationId}`,
    );
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
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    return this.backend.bulkPersistNotifications(notifications);
  }

  async migrateToBackend<DestinationBackend extends BaseNotificationBackend<Config>>(
    destinationBackend: DestinationBackend,
    batchSize = 5000,
  ): Promise<void> {
    let pageNumber = 0;
    let allNotifications: AnyDatabaseNotification<Config>[] = await this.backend.getNotifications(
      pageNumber,
      batchSize,
    );

    while (allNotifications.length > 0) {
      pageNumber += 1;

      const notificationsWithoutId = allNotifications.map((notification) => {
        const { id, ...notificationWithoutId } = notification;
        return notificationWithoutId;
      });

      await destinationBackend.bulkPersistNotifications(notificationsWithoutId);

      allNotifications = await this.backend.getNotifications(pageNumber, batchSize);
    }
  }
}
