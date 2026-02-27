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
import type { BaseGitCommitShaProvider } from './git-commit-sha/base-git-commit-sha-provider';
import type { BaseLogger } from './loggers/base-logger';
import {
  type BaseNotificationAdapter,
  isOneOffNotification,
} from './notification-adapters/base-notification-adapter';
import { DEFAULT_BACKEND_FILTER_CAPABILITIES, type BaseNotificationBackend, type NotificationFilterFields } from './notification-backends/base-notification-backend';
import { NotificationContextGeneratorsMap } from './notification-context-generators-map';
import type { BaseNotificationQueueService } from './notification-queue-service/base-notification-queue-service';
import type {
  EmailTemplate,
  EmailTemplateContent,
} from './notification-template-renderers/base-email-template-renderer';
import type { BaseNotificationTemplateRenderer } from './notification-template-renderers/base-notification-template-renderer';

type VintaSendOptions = {
  raiseErrorOnFailedSend: boolean;
};

type RenderEmailTemplateContextInput<Config extends BaseNotificationTypeConfig> =
  | {
      context: JsonObject;
    }
  | {
      contextName: string & keyof Config['ContextMap'];
      contextParameters: JsonObject;
    };

type VintaSendFactoryCreateParams<
  Config extends BaseNotificationTypeConfig,
  AdaptersList extends BaseNotificationAdapter<
    BaseNotificationTemplateRenderer<Config>,
    Config
  >[],
  Backend extends BaseNotificationBackend<Config>,
  Logger extends BaseLogger,
  QueueService extends BaseNotificationQueueService<Config>,
  AttachmentMgr extends BaseAttachmentManager,
> = {
  adapters: AdaptersList;
  backend: Backend;
  additionalBackends?: Backend[];
  logger: Logger;
  contextGeneratorsMap: BaseNotificationTypeConfig['ContextMap'];
  queueService?: QueueService;
  attachmentManager?: AttachmentMgr;
  options?: VintaSendOptions;
  gitCommitShaProvider?: BaseGitCommitShaProvider;
};

export class VintaSendFactory<Config extends BaseNotificationTypeConfig> {
  /**
   * Creates a new VintaSend notification service instance
   *
   * @param adapters - Array of notification adapters (email, SMS, push, etc.)
   * @param backend - Notification storage backend
   * @param logger - Logger instance
   * @param contextGeneratorsMap - Map of context generators for notification rendering
   * @param queueService - Optional queue service for background notification processing
   * @param attachmentManager - Optional attachment manager for file handling
   * @param options - Optional configuration options
   *
   * @example
   * // Without attachments or options
   * factory.create(adapters, backend, logger, contextGeneratorsMap);
   *
   * @example
   * // With queue service and options (note: pass undefined for attachmentManager)
   * factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, undefined, { raiseErrorOnFailedSend: true });
   *
   * @example
   * // With attachments and options
   * factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, attachmentManager, { raiseErrorOnFailedSend: true });
   *
   * @since v0.4.0 - BREAKING CHANGE: attachmentManager parameter added before options
   * @see https://github.com/vintasoftware/vintasend-ts/blob/main/README.md#migrating-to-v040-attachment-support
   */
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
    params: VintaSendFactoryCreateParams<
      Config,
      AdaptersList,
      Backend,
      Logger,
      QueueService,
      AttachmentMgr
    >,
  ): VintaSend<Config, AdaptersList, Backend, Logger, QueueService, AttachmentMgr>;

  /**
   * @deprecated Use the object parameter overload instead.
   */
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
    options?: VintaSendOptions,
    gitCommitShaProvider?: BaseGitCommitShaProvider,
    additionalBackends?: Backend[],
  ): VintaSend<Config, AdaptersList, Backend, Logger, QueueService, AttachmentMgr>;

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
    adaptersOrParams:
      | AdaptersList
      | VintaSendFactoryCreateParams<
          Config,
          AdaptersList,
          Backend,
          Logger,
          QueueService,
          AttachmentMgr
        >,
    backend?: Backend,
    logger?: Logger,
    contextGeneratorsMap?: BaseNotificationTypeConfig['ContextMap'],
    queueService?: QueueService,
    attachmentManager?: AttachmentMgr,
    options: VintaSendOptions = {
      raiseErrorOnFailedSend: false,
    },
    gitCommitShaProvider?: BaseGitCommitShaProvider,
    additionalBackends?: Backend[],
  ): VintaSend<Config, AdaptersList, Backend, Logger, QueueService, AttachmentMgr> {
    if (!Array.isArray(adaptersOrParams)) {
      return new VintaSend<Config, AdaptersList, Backend, Logger, QueueService, AttachmentMgr>(
        adaptersOrParams.adapters,
        adaptersOrParams.backend,
        adaptersOrParams.logger,
        adaptersOrParams.contextGeneratorsMap,
        adaptersOrParams.queueService,
        adaptersOrParams.attachmentManager,
        adaptersOrParams.options ?? {
          raiseErrorOnFailedSend: false,
        },
        adaptersOrParams.gitCommitShaProvider,
        adaptersOrParams.additionalBackends,
      );
    }

    return new VintaSend<Config, AdaptersList, Backend, Logger, QueueService, AttachmentMgr>(
      adaptersOrParams,
      backend as Backend,
      logger as Logger,
      contextGeneratorsMap as BaseNotificationTypeConfig['ContextMap'],
      queueService,
      attachmentManager,
      options,
      gitCommitShaProvider,
      additionalBackends,
    );
  }
}

// Type guard to check if backend has attachment manager injection support
function hasAttachmentManagerInjection<Config extends BaseNotificationTypeConfig>(
  backend: BaseNotificationBackend<Config>,
): backend is BaseNotificationBackend<Config> & {
  injectAttachmentManager(manager: BaseAttachmentManager): void;
} {
  return (
    'injectAttachmentManager' in backend &&
    // biome-ignore lint/suspicious/noExplicitAny:: this is a necessary check
    typeof (backend as any).injectAttachmentManager === 'function'
  );
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
  private backends: Map<string, Backend>;
  private primaryBackendIdentifier: string;
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
    private gitCommitShaProvider?: BaseGitCommitShaProvider,
    additionalBackends: Backend[] = [],
  ) {
    this.contextGeneratorsMap = new NotificationContextGeneratorsMap(contextGeneratorsMap);
    this.backends = new Map();

    this.primaryBackendIdentifier = this.getBackendIdentifier(backend);
    this.backends.set(this.primaryBackendIdentifier, backend);

    for (const additionalBackend of additionalBackends) {
      const additionalBackendIdentifier = this.getBackendIdentifier(additionalBackend);

      if (this.backends.has(additionalBackendIdentifier)) {
        throw new Error(`Duplicate backend identifier: ${additionalBackendIdentifier}`);
      }

      this.backends.set(additionalBackendIdentifier, additionalBackend);

      if (typeof additionalBackend.injectLogger === 'function') {
        additionalBackend.injectLogger(logger);
      }

      if (this.attachmentManager && hasAttachmentManagerInjection(additionalBackend)) {
        additionalBackend.injectAttachmentManager(this.attachmentManager);
      }
    }

    if (this.getAdditionalBackends().length !== additionalBackends.length) {
      throw new Error('Invalid additional backends configuration');
    }

    for (const adapter of adapters) {
      adapter.injectBackend(backend);
      adapter.injectLogger(logger);
      // Inject logger into template renderer if it supports it
      // biome-ignore lint/suspicious/noExplicitAny: accessing protected templateRenderer property
      const templateRenderer = (adapter as any).templateRenderer;
      if (templateRenderer && typeof templateRenderer.injectLogger === 'function') {
        templateRenderer.injectLogger(logger);
      }
    }
    // Inject logger into backend if it supports it
    if (typeof backend.injectLogger === 'function') {
      backend.injectLogger(logger);
    }
    // Inject attachment manager into backend if both exist
    if (this.attachmentManager && hasAttachmentManagerInjection(backend)) {
      backend.injectAttachmentManager(this.attachmentManager);
    }
  }

  private getBackendIdentifier(backend: Backend): string {
    if (typeof backend.getBackendIdentifier === 'function') {
      return backend.getBackendIdentifier();
    }

    return `backend-${this.backends.size}`;
  }

  private getBackend(identifier?: string): Backend {
    if (!identifier) {
      return this.backend;
    }

    const backend = this.backends.get(identifier);
    if (!backend) {
      throw new Error(`Backend not found: ${identifier}`);
    }

    return backend;
  }

  private getAdditionalBackends(): Backend[] {
    return Array.from(this.backends.entries())
      .filter(([identifier]) => identifier !== this.primaryBackendIdentifier)
      .map(([, backend]) => backend);
  }

  getPrimaryBackendIdentifier(): string {
    return this.primaryBackendIdentifier;
  }

  getAllBackendIdentifiers(): string[] {
    return Array.from(this.backends.keys());
  }

  getAdditionalBackendIdentifiers(): string[] {
    return this.getAllBackendIdentifiers().filter(
      (identifier) => identifier !== this.primaryBackendIdentifier,
    );
  }

  hasBackend(identifier: string): boolean {
    return this.backends.has(identifier);
  }

  private async executeMultiBackendWrite<T>(
    operation: string,
    primaryWrite: (backend: Backend) => Promise<T>,
    additionalWrite?: (backend: Backend, primaryResult: T) => Promise<void>,
  ): Promise<T> {
    const primaryResult = await primaryWrite(this.backend);

    if (!additionalWrite) {
      return primaryResult;
    }

    for (const additionalBackend of this.getAdditionalBackends()) {
      const backendIdentifier = this.getBackendIdentifier(additionalBackend);

      try {
        await additionalWrite(additionalBackend, primaryResult);
        this.logger.info(`${operation} replicated to backend ${backendIdentifier}`);
      } catch (replicationError) {
        this.logger.error(
          `Failed to replicate ${operation} to backend ${backendIdentifier}: ${replicationError}`,
        );
      }
    }

    return primaryResult;
  }

  registerQueueService(queueService: QueueService): void {
    this.queueService = queueService;
  }

  private normalizeGitCommitSha(gitCommitSha: string): string {
    const normalizedSha = gitCommitSha.trim().toLowerCase();
    if (!/^[a-f0-9]{40}$/.test(normalizedSha)) {
      throw new Error(
        'Invalid gitCommitSha resolved by provider. Expected a 40-character hexadecimal SHA.',
      );
    }
    return normalizedSha;
  }

  private async resolveGitCommitShaForExecution(): Promise<string | null> {
    if (!this.gitCommitShaProvider) {
      return null;
    }

    const resolvedGitCommitSha = await this.gitCommitShaProvider.getCurrentGitCommitSha();
    if (resolvedGitCommitSha === null) {
      return null;
    }

    return this.normalizeGitCommitSha(resolvedGitCommitSha);
  }

  private async persistGitCommitShaForExecution(
    notification: AnyDatabaseNotification<Config>,
    gitCommitSha: string | null,
  ): Promise<AnyDatabaseNotification<Config>> {
    const currentGitCommitSha = notification.gitCommitSha ?? null;
    if (currentGitCommitSha === gitCommitSha) {
      return notification;
    }

    if (isOneOffNotification(notification)) {
      const oneOffNotificationUpdate = {
        gitCommitSha,
      } as unknown as Partial<Omit<OneOffNotificationInput<Config>, 'id'>>;

      return this.executeMultiBackendWrite(
        'persistOneOffNotificationGitCommitSha',
        async (backend) => {
          return backend.persistOneOffNotificationUpdate(notification.id, oneOffNotificationUpdate);
        },
        async (backend) => {
          await backend.persistOneOffNotificationUpdate(notification.id, oneOffNotificationUpdate);
        },
      );
    }

    const notificationUpdate = {
      gitCommitSha,
    } as unknown as Partial<Omit<Notification<Config>, 'id'>>;

    return this.executeMultiBackendWrite(
      'persistNotificationGitCommitSha',
      async (backend) => {
        return backend.persistNotificationUpdate(notification.id, notificationUpdate);
      },
      async (backend) => {
        await backend.persistNotificationUpdate(notification.id, notificationUpdate);
      },
    );
  }

  private async resolveAndPersistGitCommitShaForExecution(
    notification: AnyDatabaseNotification<Config>,
  ): Promise<AnyDatabaseNotification<Config>> {
    const gitCommitSha = await this.resolveGitCommitShaForExecution();
    return this.persistGitCommitShaForExecution(notification, gitCommitSha);
  }

  async send(notification: AnyDatabaseNotification<Config>): Promise<void> {
    const notificationWithExecutionGitCommitSha = await this.resolveAndPersistGitCommitShaForExecution(
      notification,
    );

    const adaptersOfType = this.adapters.filter(
      (adapter) => adapter.notificationType === notificationWithExecutionGitCommitSha.notificationType,
    );
    if (adaptersOfType.length === 0) {
      this.logger.error(
        `No adapter found for notification type ${notificationWithExecutionGitCommitSha.notificationType}`,
      );
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(
          `No adapter found for notification type ${notificationWithExecutionGitCommitSha.notificationType}`,
        );
      }
      return;
    }

    if (!notificationWithExecutionGitCommitSha.id) {
      throw new Error("Notification wasn't created in the database. Please create it first");
    }

    for (const adapter of adaptersOfType) {
      if (adapter.enqueueNotifications) {
        if (!this.queueService) {
          this.logger.error('Distributed adapter found but no queue service provided');
          continue;
        }
        try {
          this.logger.info(
            `Enqueuing notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key}`,
          );
          await this.queueService.enqueueNotification(notificationWithExecutionGitCommitSha.id);
          this.logger.info(
            `Enqueued notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key} successfully`,
          );
          continue;
        } catch (enqueueError) {
          this.logger.error(
            `Error enqueuing notification ${notificationWithExecutionGitCommitSha.id}: ${enqueueError} with adapter ${adapter.key}`,
          );
          continue;
        }
      }

      let context: JsonObject | null = null;
      if (notificationWithExecutionGitCommitSha.contextUsed) {
        context = notificationWithExecutionGitCommitSha.contextUsed;
      } else {
        try {
          context = await this.getNotificationContext(
            notificationWithExecutionGitCommitSha.contextName,
            notificationWithExecutionGitCommitSha.contextParameters,
          );
          this.logger.info(
            `Generated context for notification ${notificationWithExecutionGitCommitSha.id}`,
          );
        } catch (contextError) {
          this.logger.error(
            `Error getting context for notification ${notificationWithExecutionGitCommitSha.id}: ${contextError}`,
          );
          if (this.options.raiseErrorOnFailedSend) {
            throw contextError;
          }
          return;
        }
      }

      try {
        this.logger.info(
          `Sending notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key}`,
        );
        await adapter.send(notificationWithExecutionGitCommitSha, context);
        this.logger.info(
          `Sent notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key} successfully`,
        );
      } catch (sendError) {
        this.logger.error(
          `Error sending notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key}: ${sendError}`,
        );
        try {
          await this.executeMultiBackendWrite(
            'markAsFailed',
            async (backend) => {
              return backend.markAsFailed(notificationWithExecutionGitCommitSha.id, true);
            },
            async (backend) => {
              await backend.markAsFailed(notificationWithExecutionGitCommitSha.id, true);
            },
          );
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notificationWithExecutionGitCommitSha.id} as failed: ${markFailedError}`,
          );
        }
        continue;
      }

      try {
        await this.executeMultiBackendWrite(
          'markAsSent',
          async (backend) => {
            return backend.markAsSent(notificationWithExecutionGitCommitSha.id, true);
          },
          async (backend) => {
            await backend.markAsSent(notificationWithExecutionGitCommitSha.id, true);
          },
        );
      } catch (markSentError) {
        this.logger.error(
          `Error marking notification ${notificationWithExecutionGitCommitSha.id} as sent: ${markSentError}`,
        );
      }

      try {
        await this.executeMultiBackendWrite(
          'storeAdapterAndContextUsed',
          async (backend) => {
            await backend.storeAdapterAndContextUsed(
              notificationWithExecutionGitCommitSha.id,
              adapter.key ?? 'unknown',
              context ?? {},
            );
          },
          async (backend) => {
            await backend.storeAdapterAndContextUsed(
              notificationWithExecutionGitCommitSha.id,
              adapter.key ?? 'unknown',
              context ?? {},
            );
          },
        );
      } catch (storeContextError) {
        this.logger.error(
          `Error storing adapter and context for notification ${notificationWithExecutionGitCommitSha.id}: ${storeContextError}`,
        );
      }
    }
  }

  async createNotification(
    notification: Omit<Notification<Config>, 'id'>,
  ): Promise<DatabaseNotification<Config>> {
    const createdNotification = await this.executeMultiBackendWrite(
      'createNotification',
      async (backend) => {
        return backend.persistNotification(notification);
      },
      async (backend, primaryResult) => {
        await backend.persistNotification({
          ...notification,
          id: primaryResult.id,
        });
      },
    );
    this.logger.info(`Notification ${createdNotification.id} created`);

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
    const updatedNotification = this.executeMultiBackendWrite(
      'updateNotification',
      async (backend) => {
        return backend.persistNotificationUpdate(notificationId, notification);
      },
      async (backend) => {
        await backend.persistNotificationUpdate(notificationId, notification);
      },
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

    const createdNotification = await this.executeMultiBackendWrite(
      'createOneOffNotification',
      async (backend) => {
        return backend.persistOneOffNotification(notification);
      },
      async (backend, primaryResult) => {
        await backend.persistOneOffNotification({
          ...notification,
          id: primaryResult.id,
        });
      },
    );
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

    const updatedNotification = await this.executeMultiBackendWrite(
      'updateOneOffNotification',
      async (backend) => {
        return backend.persistOneOffNotificationUpdate(notificationId, notification);
      },
      async (backend) => {
        await backend.persistOneOffNotificationUpdate(notificationId, notification);
      },
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

  async getAllFutureNotifications(backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getAllFutureNotifications();
  }

  async getAllFutureNotificationsFromUser(
    userId: Config['NotificationIdType'],
    backendIdentifier?: string,
  ) {
    return this.getBackend(backendIdentifier).getAllFutureNotificationsFromUser(userId);
  }

  async getFutureNotificationsFromUser(
    userId: Config['NotificationIdType'],
    page: number,
    pageSize: number,
    backendIdentifier?: string,
  ) {
    return this.getBackend(backendIdentifier).getFutureNotificationsFromUser(userId, page, pageSize);
  }

  async getFutureNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getFutureNotifications(page, pageSize);
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

  async renderEmailTemplateFromContent(
    notification: AnyDatabaseNotification<Config>,
    templateContent: EmailTemplateContent,
    contextInput: RenderEmailTemplateContextInput<Config>,
  ): Promise<EmailTemplate> {
    const adaptersOfType = this.adapters.filter(
      (adapter) => adapter.notificationType === notification.notificationType,
    );

    if (adaptersOfType.length === 0) {
      throw new Error(`No adapter found for notification type ${notification.notificationType}`);
    }

    const adapter = adaptersOfType[0];

    const context =
      'context' in contextInput
        ? contextInput.context
        : await this.getNotificationContext(
            contextInput.contextName,
            contextInput.contextParameters as never,
          );

    return adapter.renderFromTemplateContent(notification, templateContent, context);
  }

  async sendPendingNotifications(): Promise<void> {
    const pendingNotifications = await this.getBackend().getAllPendingNotifications();
    await Promise.all(pendingNotifications.map((notification) => this.send(notification)));
  }

  async getPendingNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getPendingNotifications(page, pageSize);
  }

  async getNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getNotifications(page, pageSize);
  }

  async getOneOffNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getOneOffNotifications(page, pageSize);
  }

  async getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate = false,
    backendIdentifier?: string,
  ) {
    return this.getBackend(backendIdentifier).getNotification(notificationId, forUpdate);
  }

  async filterNotifications(
    filter: NotificationFilterFields<Config>,
    page: number,
    pageSize: number,
    backendIdentifier?: string,
  ) {
    return this.getBackend(backendIdentifier).filterNotifications(filter, page, pageSize);
  }

  async getBackendSupportedFilterCapabilities(backendIdentifier?: string) {
    return {
      ...DEFAULT_BACKEND_FILTER_CAPABILITIES,
      ...(this.getBackend(backendIdentifier).getFilterCapabilities?.() ?? {}),
    };
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
    backendIdentifier?: string,
  ): Promise<DatabaseOneOffNotification<Config> | null> {
    return this.getBackend(backendIdentifier).getOneOffNotification(notificationId, forUpdate);
  }

  async markRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent = true,
  ): Promise<DatabaseNotification<Config>> {
    const notification = await this.executeMultiBackendWrite(
      'markRead',
      async (backend) => {
        return backend.markAsRead(notificationId, checkIsSent);
      },
      async (backend) => {
        await backend.markAsRead(notificationId, checkIsSent);
      },
    );
    this.logger.info(`Notification ${notificationId} marked as read`);
    return notification;
  }

  async getInAppUnread(userId: Config['NotificationIdType'], backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).filterAllInAppUnreadNotifications(userId);
  }

  async cancelNotification(notificationId: Config['NotificationIdType']): Promise<void> {
    await this.executeMultiBackendWrite(
      'cancelNotification',
      async (backend) => {
        await backend.cancelNotification(notificationId);
      },
      async (backend) => {
        await backend.cancelNotification(notificationId);
      },
    );
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

    const notificationWithExecutionGitCommitSha = await this.resolveAndPersistGitCommitShaForExecution(
      notification,
    );

    const context = await this.getNotificationContext(
      notificationWithExecutionGitCommitSha.contextName,
      notificationWithExecutionGitCommitSha.contextParameters,
    );

    let lastAdapterKey = 'unknown';
    for (const adapter of enqueueNotificationsAdapters) {
      lastAdapterKey = adapter.key ?? 'unknown';
      try {
        await adapter.send(notificationWithExecutionGitCommitSha, context);
      } catch (sendError) {
        this.logger.error(
          `Error sending notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key}: ${sendError}`,
        );
        try {
            await this.executeMultiBackendWrite(
              'markAsFailed',
              async (backend) => {
                return backend.markAsFailed(notificationWithExecutionGitCommitSha.id, true);
              },
              async (backend) => {
                await backend.markAsFailed(notificationWithExecutionGitCommitSha.id, true);
              },
            );
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notificationWithExecutionGitCommitSha.id} as failed: ${markFailedError}`,
          );
        }
      }

      try {
        await this.executeMultiBackendWrite(
          'markAsSent',
          async (backend) => {
            return backend.markAsSent(notificationWithExecutionGitCommitSha.id, true);
          },
          async (backend) => {
            await backend.markAsSent(notificationWithExecutionGitCommitSha.id, true);
          },
        );
      } catch (markSentError) {
        this.logger.error(
          `Error marking notification ${notificationWithExecutionGitCommitSha.id} as sent: ${markSentError}`,
        );
      }
    }

    try {
      await this.executeMultiBackendWrite(
        'storeAdapterAndContextUsed',
        async (backend) => {
          await backend.storeAdapterAndContextUsed(
            notificationWithExecutionGitCommitSha.id,
            lastAdapterKey,
            context,
          );
        },
        async (backend) => {
          await backend.storeAdapterAndContextUsed(
            notificationWithExecutionGitCommitSha.id,
            lastAdapterKey,
            context,
          );
        },
      );
    } catch (storeContextError) {
      this.logger.error(
        `Error storing adapter and context for notification ${notificationWithExecutionGitCommitSha.id}: ${storeContextError}`,
      );
    }
  }

  async bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    return this.executeMultiBackendWrite(
      'bulkPersistNotifications',
      async (backend) => {
        return backend.bulkPersistNotifications(notifications);
      },
      async (backend, createdIds) => {
        const notificationsWithIds = notifications.map((notification, index) => {
          return {
            ...notification,
            id: createdIds[index],
          };
        });

        await backend.bulkPersistNotifications(
          notificationsWithIds as unknown as Omit<AnyNotification<Config>, 'id'>[],
        );
      },
    );
  }

  private normalizeValueForSyncComparison(value: unknown): string {
    if (value === null) {
      return 'null';
    }

    if (value === undefined) {
      return 'undefined';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[unserializable-object]';
      }
    }

    return String(value);
  }

  async verifyNotificationSync(
    notificationId: Config['NotificationIdType'],
  ): Promise<{
    synced: boolean;
    backends: Record<
      string,
      {
        exists: boolean;
        notification?: AnyDatabaseNotification<Config>;
        error?: string;
      }
    >;
    discrepancies: string[];
  }> {
    const report: {
      synced: boolean;
      backends: Record<
        string,
        {
          exists: boolean;
          notification?: AnyDatabaseNotification<Config>;
          error?: string;
        }
      >;
      discrepancies: string[];
    } = {
      synced: true,
      backends: {},
      discrepancies: [],
    };

    for (const [identifier, backend] of this.backends.entries()) {
      try {
        const notification = await backend.getNotification(notificationId, false);
        report.backends[identifier] = {
          exists: notification !== null,
          notification: notification ?? undefined,
        };
      } catch (error) {
        report.backends[identifier] = {
          exists: false,
          error: String(error),
        };
        report.discrepancies.push(`Backend ${identifier}: ${String(error)}`);
        report.synced = false;
      }
    }

    const primaryNotification = report.backends[this.primaryBackendIdentifier]?.notification;
    if (!primaryNotification) {
      report.synced = false;
      report.discrepancies.push('Notification not found in primary backend');
      return report;
    }

    for (const [identifier, backendReport] of Object.entries(report.backends)) {
      if (identifier === this.primaryBackendIdentifier) {
        continue;
      }

      if (!backendReport.exists) {
        report.synced = false;
        report.discrepancies.push(`Notification missing in backend: ${identifier}`);
        continue;
      }

      if (backendReport.notification?.status !== primaryNotification.status) {
        report.synced = false;
        report.discrepancies.push(
          `Status mismatch in ${identifier}: ${String(backendReport.notification?.status)} vs ${String(primaryNotification.status)}`,
        );
      }

      const primaryNotificationRecord = primaryNotification as unknown as Record<string, unknown>;
      const backendNotificationRecord = backendReport.notification as unknown as Record<
        string,
        unknown
      >;

      const fieldsToCompare = [
        'notificationType',
        'title',
        'bodyTemplate',
        'subjectTemplate',
        'contextName',
        'contextParameters',
        'contextUsed',
        'extraParams',
        'adapterUsed',
        'sendAfter',
        'sentAt',
        'readAt',
        'createdAt',
        'updatedAt',
        'gitCommitSha',
      ] as const;

      for (const fieldName of fieldsToCompare) {
        const primaryValue = this.normalizeValueForSyncComparison(
          primaryNotificationRecord[fieldName],
        );
        const backendValue = this.normalizeValueForSyncComparison(
          backendNotificationRecord[fieldName],
        );

        if (primaryValue !== backendValue) {
          report.synced = false;
          report.discrepancies.push(
            `Field mismatch in ${identifier} for ${fieldName}: ${backendValue} vs ${primaryValue}`,
          );
        }
      }
    }

    return report;
  }

  async replicateNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<{
    successes: string[];
    failures: {
      backend: string;
      error: string;
    }[];
  }> {
    const primaryNotification = await this.backend.getNotification(notificationId, false);

    if (!primaryNotification) {
      throw new Error(`Notification ${String(notificationId)} not found in primary backend`);
    }

    const result: {
      successes: string[];
      failures: {
        backend: string;
        error: string;
      }[];
    } = {
      successes: [],
      failures: [],
    };

    for (const backend of this.getAdditionalBackends()) {
      const backendIdentifier = this.getBackendIdentifier(backend);

      try {
        const existingNotification = await backend.getNotification(notificationId, false);

        if (existingNotification) {
          await backend.persistNotificationUpdate(
            notificationId,
            primaryNotification as unknown as Partial<Omit<Notification<Config>, 'id'>>,
          );
        } else {
          await backend.persistNotification(
            primaryNotification as unknown as Omit<Notification<Config>, 'id'> & {
              id?: Config['NotificationIdType'];
            },
          );
        }

        result.successes.push(backendIdentifier);
      } catch (error) {
        result.failures.push({
          backend: backendIdentifier,
          error: String(error),
        });
      }
    }

    return result;
  }

  async getBackendSyncStats(): Promise<{
    backends: Record<
      string,
      {
        totalNotifications: number;
        status: 'healthy' | 'error';
        error?: string;
      }
    >;
  }> {
    const stats: {
      backends: Record<
        string,
        {
          totalNotifications: number;
          status: 'healthy' | 'error';
          error?: string;
        }
      >;
    } = {
      backends: {},
    };

    for (const [identifier, backend] of this.backends.entries()) {
      try {
        const notifications = await backend.getAllNotifications();
        stats.backends[identifier] = {
          totalNotifications: notifications.length,
          status: 'healthy',
        };
      } catch (error) {
        stats.backends[identifier] = {
          totalNotifications: 0,
          status: 'error',
          error: String(error),
        };
      }
    }

    return stats;
  }

  async migrateToBackend<DestinationBackend extends BaseNotificationBackend<Config>>(
    destinationBackend: DestinationBackend,
    batchSize = 5000,
    sourceBackendIdentifier?: string,
  ): Promise<void> {
    const sourceBackend = this.getBackend(sourceBackendIdentifier);
    let pageNumber = 0;
    let allNotifications: AnyDatabaseNotification<Config>[] = await sourceBackend.getNotifications(
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

      allNotifications = await sourceBackend.getNotifications(pageNumber, batchSize);
    }
  }
}
