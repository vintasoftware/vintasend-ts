import type { JsonObject } from '../types/json-values.js';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
} from '../types/notification.js';
import type { NotificationType } from '../types/notification-type.js';
import type { BaseNotificationTypeConfig } from '../types/notification-type-config.js';
import type { OneOffNotificationInput } from '../types/one-off-notification.js';
import type { BaseAttachmentManager } from './attachment-manager/base-attachment-manager.js';
import type { BaseGitCommitShaProvider } from './git-commit-sha/base-git-commit-sha-provider.js';
import type { BaseLogger } from './loggers/base-logger.js';
import { log, logCount, logError, logId, logLabel, logTimestamp } from './loggers/log-message.js';
import { NotificationActionError } from './notification-action-error.js';
import {
  type BaseNotificationAdapter,
  isOneOffNotification,
} from './notification-adapters/base-notification-adapter.js';
import {
  type BaseNotificationBackend,
  type BulkNotificationActionOutcome,
  type BulkNotificationActionResult,
  type BulkRequeueNotificationOptions,
  DEFAULT_BACKEND_ACTION_CAPABILITIES,
  DEFAULT_BACKEND_FILTER_CAPABILITIES,
  type NotificationActionCapabilities,
  type NotificationFilter,
  type NotificationFilterFields,
  type NotificationOrderBy,
  type NotificationVersion,
  type NotificationWriteOptions,
  type NotificationWriteResult,
  REPINNABLE_NOTIFICATION_STATUSES,
  REQUEUEABLE_NOTIFICATION_STATUSES,
  type RequeueNotificationOptions,
  supportsTemplateVersions,
} from './notification-backends/base-notification-backend.js';
import { NotificationContextGeneratorsMap } from './notification-context-generators-map.js';
import type { BaseNotificationQueueService } from './notification-queue-service/base-notification-queue-service.js';
import type { BaseNotificationReplicationQueueService } from './notification-queue-service/base-notification-replication-queue-service.js';
import type {
  EmailTemplate,
  EmailTemplateContent,
} from './notification-template-renderers/base-email-template-renderer.js';
import type {
  BaseNotificationTemplateRenderer,
  NotificationSendInput,
} from './notification-template-renderers/base-notification-template-renderer.js';

type VintaSendOptions = {
  raiseErrorOnFailedSend: boolean;
  replicationMode?: 'inline' | 'queued';
  /**
   * The default answer to "should a notification created or repointed without an explicit
   * `requestedTemplateVersion` be pinned to whatever version is current right now?".
   *
   * Off by default, because turning it on changes what an existing deployment sends: unpinned, a
   * notification scheduled for next week renders whatever the template says next week, which is
   * sometimes exactly what a team wants. Every create and update takes a `pinTemplateVersions` of
   * its own that overrides this in both directions.
   *
   * Never stored. It decides what `requestedTemplateVersion` is set to at that moment, and nothing
   * afterwards consults it. Resolved through
   * `BaseNotificationTemplateRenderer.getLatestTemplateVersion`, so with a file-based renderer it
   * has nothing to pin and quietly does nothing.
   */
  pinTemplateVersions?: boolean;
};

/**
 * Per-call control over template-version pinning.
 *
 * `pinTemplateVersions` left out means "whatever the service was built with". A caller with one
 * notification that must not move, in a deployment that pins nothing — or the reverse — says so
 * here rather than building a second service.
 */
export type TemplateVersionPinningOptions = {
  pinTemplateVersions?: boolean;
};

/**
 * Options for `VintaSend.requeueNotification`.
 */
export type RequeueOptions = {
  /**
   * Left out, the notification keeps its own schedule. `null`, or a date in the past, makes it due
   * now; a future date leaves it pending until then.
   */
  sendAfter?: Date | null;
  /**
   * Pin the notification to this template version in the same backend write that re-queues it.
   * Needs a primary backend reporting `requeue.templateVersion`. Not checked against the renderer,
   * as with `repinNotification`.
   */
  templateVersion?: number;
  /**
   * Re-queue only if the notification is still at this version, the token
   * `filterNotificationVersions` returned for it. Needs a primary backend reporting
   * `requeue.expectedVersion`.
   */
  expectedVersion?: string;
  /**
   * `false` re-queues without sending, even when the notification is due. It is then left to
   * whatever sends pending notifications (`sendPendingNotifications`, typically a scheduled job),
   * and no adapter is used, so a service built only to re-queue needs no delivery credentials.
   * Defaults to `true`.
   */
  send?: boolean;
};

/**
 * Options for `VintaSend.repinNotification`.
 */
export type RepinOptions = {
  /** Left out, pins to `getCurrentTemplateVersion` for the notification's template. */
  templateVersion?: number;
  /**
   * Re-pin only if the notification is still at this version, the token
   * `filterNotificationVersions` returned for it. Needs a primary backend reporting
   * `repin.expectedVersion`.
   */
  expectedVersion?: string;
};

/**
 * Options for `VintaSend.repinNotifications`.
 */
export type BulkRepinOptions<Config extends BaseNotificationTypeConfig> = {
  /**
   * The version to pin every target to. Required: resolving the current version per notification
   * would mean reading each one, which is what the bulk action exists to avoid. Get it once with
   * `getCurrentTemplateVersion`.
   */
  templateVersion: number;
  /**
   * Re-pin only the targets that still match this filter, typically the one they were listed
   * with. Evaluated by the backend in the same pass that checks the versions.
   */
  filter?: NotificationFilter<Config>;
};

/**
 * Options for `VintaSend.requeueNotifications`.
 */
export type BulkRequeueOptions<Config extends BaseNotificationTypeConfig> = {
  /** As for `requeueNotification`: left out keeps each notification's own, `null` means now. */
  sendAfter?: Date | null;
  /** Pin every target to this template version in the same write that re-queues it. */
  templateVersion?: number;
  /** As for `repinNotifications`. */
  filter?: NotificationFilter<Config>;
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
  AdaptersList extends BaseNotificationAdapter<BaseNotificationTemplateRenderer<Config>, Config>[],
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
  replicationQueueService?: BaseNotificationReplicationQueueService<Config>;
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
    replicationQueueService?: BaseNotificationReplicationQueueService<Config>,
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
    replicationQueueService?: BaseNotificationReplicationQueueService<Config>,
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
        adaptersOrParams.replicationQueueService,
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
      replicationQueueService,
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

  private validateUniqueAdapterNotificationTypes(adapters: AdaptersList): void {
    const adapterKeysByType = new Map<string, string[]>();

    for (const adapter of adapters) {
      const notificationType = String(adapter.notificationType);
      const adapterKey = adapter.key ?? 'unknown';
      const existingAdapterKeys = adapterKeysByType.get(notificationType);

      if (existingAdapterKeys) {
        existingAdapterKeys.push(adapterKey);
      } else {
        adapterKeysByType.set(notificationType, [adapterKey]);
      }
    }

    const duplicatedTypes = Array.from(adapterKeysByType.entries()).filter(
      ([, adapterKeys]) => adapterKeys.length > 1,
    );

    if (duplicatedTypes.length === 0) {
      return;
    }

    const duplicatedTypesDescription = duplicatedTypes
      .map(([notificationType, adapterKeys]) => {
        return `${notificationType} (${adapterKeys.join(', ')})`;
      })
      .join('; ');

    throw new Error(
      `Duplicate adapter notification types are not allowed. Found duplicates for: ${duplicatedTypesDescription}`,
    );
  }

  /**
   * Creates a VintaSend instance with one primary backend and optional additional backends.
   *
   * In multi-backend mode:
   * - writes execute on the primary backend first
   * - additional backends receive best-effort replication
   * - reads default to primary unless a backend identifier is provided
   */
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
    private replicationQueueService?: BaseNotificationReplicationQueueService<Config>,
  ) {
    this.validateUniqueAdapterNotificationTypes(adapters);

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
      const templateRenderer = adapter.getTemplateRenderer();
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

  /**
   * What an additional backend's copy of a write is given: the version token the primary's write
   * recorded, so the replica stores that token instead of generating its own. Empty when the
   * primary keeps no tokens, which leaves each replica to generate one as before.
   */
  private replicaWriteOptions(primaryResult: unknown): NotificationWriteOptions {
    const notificationVersion =
      primaryResult && typeof primaryResult === 'object'
        ? (primaryResult as NotificationWriteResult).notificationVersion
        : undefined;
    return notificationVersion === undefined ? {} : { notificationVersion };
  }

  private async executeMultiBackendWrite<T>(
    operation: string,
    primaryWrite: (backend: Backend) => Promise<T>,
    additionalWrite?: (backend: Backend, primaryResult: T) => Promise<void>,
    replicationNotificationId?:
      | Config['NotificationIdType']
      | ((primaryResult: T) => Config['NotificationIdType'] | undefined),
  ): Promise<T> {
    const primaryResult = await primaryWrite(this.backend);

    if (!additionalWrite) {
      return primaryResult;
    }

    const additionalBackends = this.getAdditionalBackends();
    if (additionalBackends.length === 0) {
      return primaryResult;
    }

    const resolveReplicationNotificationId = (): Config['NotificationIdType'] | undefined => {
      if (typeof replicationNotificationId === 'function') {
        return replicationNotificationId(primaryResult);
      }

      if (replicationNotificationId !== undefined) {
        return replicationNotificationId;
      }

      const idFromPrimaryResult = (primaryResult as { id?: Config['NotificationIdType'] }).id;
      return idFromPrimaryResult;
    };

    const executeInlineReplication = async (): Promise<void> => {
      for (const additionalBackend of additionalBackends) {
        const backendIdentifier = this.getBackendIdentifier(additionalBackend);

        try {
          await additionalWrite(additionalBackend, primaryResult);
          this.logger.info(
            log`${logLabel(operation)} replicated to backend ${logLabel(backendIdentifier)} in inline mode`,
          );
        } catch (replicationError) {
          this.logger.error(
            log`Failed to replicate ${logLabel(operation)} to backend ${logLabel(backendIdentifier)}: ${logError(replicationError)}`,
          );
        }
      }
    };

    if (this.options.replicationMode === 'queued') {
      const notificationIdToReplicate = resolveReplicationNotificationId();

      if (!notificationIdToReplicate) {
        this.logger.warn(
          log`Replication mode is queued, but no notification id was resolved for ${logLabel(operation)}. Falling back to inline replication.`,
        );
        await executeInlineReplication();
        return primaryResult;
      }

      if (!this.replicationQueueService) {
        this.logger.warn(
          log`Replication mode is queued, but no replication queue service is registered for ${logLabel(operation)}. Falling back to inline replication.`,
        );
        await executeInlineReplication();
        return primaryResult;
      }

      const enqueueResults = await Promise.all(
        additionalBackends.map(async (additionalBackend) => {
          const backendIdentifier = this.getBackendIdentifier(additionalBackend);

          try {
            await this.replicationQueueService?.enqueueReplication(
              notificationIdToReplicate,
              backendIdentifier,
            );

            return {
              backendIdentifier,
              backend: additionalBackend,
              error: null,
            };
          } catch (enqueueReplicationError) {
            return {
              backendIdentifier,
              backend: additionalBackend,
              error: String(enqueueReplicationError),
            };
          }
        }),
      );

      const failedEnqueues = enqueueResults.filter((enqueueResult) => enqueueResult.error);

      if (failedEnqueues.length === 0) {
        this.logger.info(
          log`${logLabel(operation)} replication enqueued for notification ${logId(notificationIdToReplicate)} to ${logCount(additionalBackends.length)} backend(s) in queued mode`,
        );
        return primaryResult;
      }

      for (const failedEnqueue of failedEnqueues) {
        this.logger.error(
          log`Failed to enqueue replication for ${logLabel(operation)}, notification ${logId(notificationIdToReplicate)} and backend ${logLabel(failedEnqueue.backendIdentifier)}: ${logError(failedEnqueue.error)}`,
        );
      }

      this.logger.warn(
        log`Falling back to inline replication for ${logLabel(operation)} in ${logCount(failedEnqueues.length)} backend(s) after queue enqueue failure.`,
      );

      for (const failedEnqueue of failedEnqueues) {
        try {
          await additionalWrite(failedEnqueue.backend, primaryResult);
          this.logger.info(
            log`${logLabel(operation)} replicated to backend ${logLabel(failedEnqueue.backendIdentifier)} in inline fallback mode`,
          );
        } catch (replicationError) {
          this.logger.error(
            log`Failed to replicate ${logLabel(operation)} to backend ${logLabel(failedEnqueue.backendIdentifier)} in inline fallback mode: ${logError(replicationError)}`,
          );
        }
      }

      return primaryResult;
    }

    await executeInlineReplication();

    return primaryResult;
  }

  registerQueueService(queueService: QueueService): void {
    this.queueService = queueService;
  }

  registerReplicationQueueService(
    replicationQueueService: BaseNotificationReplicationQueueService<Config>,
  ): void {
    this.replicationQueueService = replicationQueueService;
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
        async (backend, primaryResult) => {
          await backend.persistOneOffNotificationUpdate(
            notification.id,
            oneOffNotificationUpdate,
            this.replicaWriteOptions(primaryResult),
          );
        },
        notification.id,
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
      async (backend, primaryResult) => {
        await backend.persistNotificationUpdate(
          notification.id,
          notificationUpdate,
          this.replicaWriteOptions(primaryResult),
        );
      },
      notification.id,
    );
  }

  private async resolveAndPersistGitCommitShaForExecution(
    notification: AnyDatabaseNotification<Config>,
  ): Promise<AnyDatabaseNotification<Config>> {
    const gitCommitSha = await this.resolveGitCommitShaForExecution();
    return this.persistGitCommitShaForExecution(notification, gitCommitSha);
  }

  /**
   * Whether this call pins, given what it asked for and what the service defaults to.
   *
   * `undefined` from a call site means it did not ask, so the service's own setting decides.
   * Anything else is the call's decision and overrides it in both directions.
   */
  private shouldPinTemplateVersions(pinTemplateVersions?: boolean): boolean {
    if (pinTemplateVersions === undefined) {
      return this.options.pinTemplateVersions ?? false;
    }
    return pinTemplateVersions;
  }

  /**
   * Which template version to record on a notification being created or repointed.
   *
   * An explicit request always wins — pinning is a default, not an override, so a caller who names
   * a version gets that version whatever the service was configured with. With no request and no
   * pinning asked for, the answer is `null`: the notification goes on resolving its template at
   * send time, exactly as notifications did before any of this existed.
   *
   * Otherwise the renderer for this notification type is asked what the current version is.
   * Best-effort by design: a renderer that does not version templates says `null`, and one that
   * throws is logged and treated the same way. Neither is worth failing a creation over — an
   * unpinned notification still sends, against whatever is current.
   */
  private async resolveTemplateVersionToPin(
    notificationType: NotificationType,
    bodyTemplate: string,
    requestedTemplateVersion: number | null | undefined,
    pinTemplateVersions: boolean | undefined,
  ): Promise<number | null> {
    if (requestedTemplateVersion !== null && requestedTemplateVersion !== undefined) {
      return requestedTemplateVersion;
    }
    if (!this.shouldPinTemplateVersions(pinTemplateVersions)) {
      return null;
    }
    return this.getCurrentTemplateVersion(notificationType, bodyTemplate);
  }

  /**
   * The template version a notification of this type created now would be pinned to: what the
   * renderer reports as current. For `vintasend-managed-templates` that is the key's newest active
   * version, or `null` when nothing is published or the template is a base.
   *
   * `repinNotification` without a `templateVersion`, and `pinTemplateVersions`, both call this, so
   * a caller that shows "the version new notifications get" agrees with what they pin.
   *
   * Asks each adapter of `notificationType` in turn and returns the first version reported.
   * Best-effort: a renderer that does not version templates answers `null`, and one that throws is
   * logged, by template key only, and treated the same way.
   */
  async getCurrentTemplateVersion(
    notificationType: NotificationType,
    templateKey: string,
  ): Promise<number | null> {
    for (const adapter of this.adapters) {
      if (adapter.notificationType !== notificationType) {
        continue;
      }
      try {
        // Optional-chained: a renderer that never grew the method — anything written before
        // template versioning, or against the `implements` form of the seam — simply has no
        // version to offer, which is the same answer the default implementation gives.
        const version = await adapter.getTemplateRenderer().getLatestTemplateVersion?.(templateKey);
        if (version !== null && version !== undefined) {
          return version;
        }
      } catch (resolveError) {
        this.logger.error(
          log`Template renderer for adapter ${logLabel(adapter.key ?? 'unknown')} threw while resolving the current version of template "${logLabel(templateKey)}"; treating it as having none: ${logError(resolveError)}`,
        );
      }
    }
    return null;
  }

  /**
   * The notification to persist, with a pin resolved onto it when one applies.
   *
   * Returns the very object it was given when there is nothing to pin, so a backend that predates
   * template versioning never sees a key it does not know — the same courtesy `attachments` gets.
   */
  private async withResolvedTemplateVersion<
    NotificationInputType extends {
      notificationType: NotificationType;
      bodyTemplate: string;
      requestedTemplateVersion?: number | null;
    },
  >(
    notification: NotificationInputType,
    pinTemplateVersions: boolean | undefined,
  ): Promise<NotificationInputType> {
    const resolved = await this.resolveTemplateVersionToPin(
      notification.notificationType,
      notification.bodyTemplate,
      notification.requestedTemplateVersion,
      pinTemplateVersions,
    );

    if (resolved === null) {
      return notification;
    }
    return { ...notification, requestedTemplateVersion: resolved };
  }

  /**
   * Pin an update that repoints a notification at a different template.
   *
   * Only when `bodyTemplate` is being changed: that is the update where the version that was
   * pinned no longer describes what the notification renders. An update to the title — or to
   * anything else — leaves an existing pin exactly as it is, because silently re-pinning a
   * notification to a newer version is the very thing pinning exists to prevent.
   *
   * Does nothing when the caller named a version themselves; theirs wins, as it does on create.
   */
  private async withRepinnedTemplateVersion<
    UpdateType extends { bodyTemplate?: string; requestedTemplateVersion?: number | null },
  >(
    notificationId: Config['NotificationIdType'],
    update: UpdateType,
    pinTemplateVersions: boolean | undefined,
  ): Promise<UpdateType> {
    if (!this.shouldPinTemplateVersions(pinTemplateVersions)) {
      return update;
    }
    if (update.bodyTemplate === undefined || update.requestedTemplateVersion != null) {
      return update;
    }

    const notification = await this.getNotification(notificationId, false);
    if (!notification) {
      return update;
    }

    const version = await this.resolveTemplateVersionToPin(
      notification.notificationType,
      update.bodyTemplate,
      null,
      pinTemplateVersions,
    );

    if (version === null) {
      return update;
    }
    return { ...update, requestedTemplateVersion: version };
  }

  /**
   * Reject an attempt to set `usedTemplateVersion` through an update.
   *
   * System-managed, the same as `gitCommitSha`: only the service writes it, at send time, from the
   * version the renderer reported. Checked on the raw object because the parameter type says
   * `never` and a caller casting past that is exactly who this is for.
   */
  private assertUsedTemplateVersionNotSet(
    notificationId: Config['NotificationIdType'],
    update: Record<string, unknown>,
  ): void {
    if ('usedTemplateVersion' in update) {
      throw new Error(
        `Cannot update usedTemplateVersion of notification ${String(notificationId)}: ` +
          'it is system-managed and written at send time. ' +
          'Set requestedTemplateVersion instead to change which version renders.',
      );
    }
  }

  /**
   * Store the template version an adapter's renderer reported it used.
   *
   * A no-op unless the adapter returned its send input and the renderer filled the version in,
   * which is every adapter that predates this and every renderer whose templates are not
   * versioned. Backends that cannot store it are skipped rather than erroring.
   *
   * Failures are logged, never thrown: the notification has already been delivered by the time
   * this runs, and losing a line of audit metadata is not worth reporting a successful send as
   * failed.
   */
  private async recordUsedTemplateVersion(
    notification: AnyDatabaseNotification<Config>,
    // biome-ignore lint/suspicious/noConfusingVoidType: mirrors `BaseNotificationAdapter.send`
    sendInput: NotificationSendInput | void,
  ): Promise<void> {
    const version = sendInput?.templateVersion;
    if (version === null || version === undefined) {
      return;
    }
    if (version === notification.usedTemplateVersion) {
      return;
    }

    try {
      await this.executeMultiBackendWrite(
        'storeTemplateVersion',
        async (backend) => {
          if (supportsTemplateVersions(backend)) {
            return backend.storeTemplateVersion(notification.id, version);
          }
        },
        async (backend, primaryResult) => {
          if (supportsTemplateVersions(backend)) {
            await backend.storeTemplateVersion(
              notification.id,
              version,
              this.replicaWriteOptions(primaryResult),
            );
          }
        },
        notification.id,
      );
    } catch (storeError) {
      // Every failure, not just a write error: by the time this runs the notification has been
      // delivered and marked sent, so anything thrown here would report a successful send as a
      // failure. A missing line of audit metadata is the smaller loss, and the log says which
      // notification lost it.
      this.logger.error(
        log`Error storing the template version used for notification ${logId(notification.id)}: ${logError(storeError)}`,
      );
      return;
    }

    notification.usedTemplateVersion = version;
  }

  async send(notification: AnyDatabaseNotification<Config>): Promise<void> {
    const notificationWithExecutionGitCommitSha =
      await this.resolveAndPersistGitCommitShaForExecution(notification);

    const adaptersOfType = this.adapters.filter(
      (adapter) =>
        adapter.notificationType === notificationWithExecutionGitCommitSha.notificationType,
    );
    if (adaptersOfType.length === 0) {
      this.logger.error(
        log`No adapter found for notification type ${logLabel(notificationWithExecutionGitCommitSha.notificationType)}`,
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
          this.logger.error(log`Distributed adapter found but no queue service provided`);
          continue;
        }
        try {
          this.logger.info(
            log`Enqueuing notification ${logId(notificationWithExecutionGitCommitSha.id)} with adapter ${logLabel(adapter.key)}`,
          );
          await this.queueService.enqueueNotification(notificationWithExecutionGitCommitSha.id);
          this.logger.info(
            log`Enqueued notification ${logId(notificationWithExecutionGitCommitSha.id)} with adapter ${logLabel(adapter.key)} successfully`,
          );
          continue;
        } catch (enqueueError) {
          this.logger.error(
            log`Error enqueuing notification ${logId(notificationWithExecutionGitCommitSha.id)}: ${logError(enqueueError)} with adapter ${logLabel(adapter.key)}`,
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
            log`Generated context for notification ${logId(notificationWithExecutionGitCommitSha.id)}`,
          );
        } catch (contextError) {
          this.logger.error(
            log`Error getting context for notification ${logId(notificationWithExecutionGitCommitSha.id)}: ${logError(contextError)}`,
          );
          if (this.options.raiseErrorOnFailedSend) {
            throw contextError;
          }
          return;
        }
      }

      // biome-ignore lint/suspicious/noConfusingVoidType: mirrors `BaseNotificationAdapter.send`
      let sendInput: NotificationSendInput | void;
      try {
        this.logger.info(
          log`Sending notification ${logId(notificationWithExecutionGitCommitSha.id)} with adapter ${logLabel(adapter.key)}`,
        );
        sendInput = await adapter.send(notificationWithExecutionGitCommitSha, context);
        this.logger.info(
          log`Sent notification ${logId(notificationWithExecutionGitCommitSha.id)} with adapter ${logLabel(adapter.key)} successfully`,
        );
      } catch (sendError) {
        this.logger.error(
          log`Error sending notification ${logId(notificationWithExecutionGitCommitSha.id)} with adapter ${logLabel(adapter.key)}: ${logError(sendError)}`,
        );
        try {
          await this.executeMultiBackendWrite(
            'markAsFailed',
            async (backend) => {
              return backend.markAsFailed(notificationWithExecutionGitCommitSha.id, true);
            },
            async (backend, primaryResult) => {
              await backend.markAsFailed(
                notificationWithExecutionGitCommitSha.id,
                true,
                this.replicaWriteOptions(primaryResult),
              );
            },
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (markFailedError) {
          this.logger.error(
            log`Error marking notification ${logId(notificationWithExecutionGitCommitSha.id)} as failed: ${logError(markFailedError)}`,
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
          async (backend, primaryResult) => {
            await backend.markAsSent(
              notificationWithExecutionGitCommitSha.id,
              true,
              this.replicaWriteOptions(primaryResult),
            );
          },
          notificationWithExecutionGitCommitSha.id,
        );
      } catch (markSentError) {
        this.logger.error(
          log`Error marking notification ${logId(notificationWithExecutionGitCommitSha.id)} as sent: ${logError(markSentError)}`,
        );
      }

      try {
        await this.executeMultiBackendWrite(
          'storeAdapterAndContextUsed',
          async (backend) => {
            return backend.storeAdapterAndContextUsed(
              notificationWithExecutionGitCommitSha.id,
              adapter.key ?? 'unknown',
              context ?? {},
            );
          },
          async (backend, primaryResult) => {
            await backend.storeAdapterAndContextUsed(
              notificationWithExecutionGitCommitSha.id,
              adapter.key ?? 'unknown',
              context ?? {},
              this.replicaWriteOptions(primaryResult),
            );
          },
          notificationWithExecutionGitCommitSha.id,
        );
      } catch (storeContextError) {
        this.logger.error(
          log`Error storing adapter and context for notification ${logId(notificationWithExecutionGitCommitSha.id)}: ${logError(storeContextError)}`,
        );
      }

      // Outside every try above on purpose: those handle real delivery outcomes, while recording
      // which template version rendered the notification is audit metadata, and it keeps its own
      // failure handling inside the helper.
      await this.recordUsedTemplateVersion(notificationWithExecutionGitCommitSha, sendInput);
    }
  }

  /**
   * @param notification the notification to create. Pass `requestedTemplateVersion` to render one
   *   exact version of `bodyTemplate` forever, whatever the service is configured with.
   * @param options `pinTemplateVersions` overrides the service's own setting for this call, in
   *   both directions. An explicit `requestedTemplateVersion` still wins over it.
   */
  async createNotification(
    notification: Omit<Notification<Config>, 'id'>,
    options: TemplateVersionPinningOptions = {},
  ): Promise<DatabaseNotification<Config>> {
    const notificationToPersist = await this.withResolvedTemplateVersion(
      notification,
      options.pinTemplateVersions,
    );

    const createdNotification = await this.executeMultiBackendWrite(
      'createNotification',
      async (backend) => {
        return backend.persistNotification(notificationToPersist);
      },
      async (backend, primaryResult) => {
        await backend.persistNotification(
          {
            ...notificationToPersist,
            id: primaryResult.id,
          },
          this.replicaWriteOptions(primaryResult),
        );
      },
    );
    this.logger.info(log`Notification ${logId(createdNotification.id)} created`);

    if (!notification.sendAfter || notification.sendAfter <= new Date()) {
      this.logger.info(
        log`Notification ${logId(createdNotification.id)} sent immediately because sendAfter is null or in the past`,
      );
      await this.send(createdNotification);
    } else {
      this.logger.info(
        log`Notification ${logId(createdNotification.id)} scheduled for ${logTimestamp(notification.sendAfter)}`,
      );
    }

    return createdNotification;
  }

  /**
   * @param notification the fields to change. `requestedTemplateVersion` repoints the
   *   notification at a different version of its template, or pins one that was floating.
   * @param options `pinTemplateVersions` decides whether an update that changes `bodyTemplate`
   *   re-pins to the new template's current version. An update that leaves `bodyTemplate` alone
   *   never moves an existing pin.
   */
  async updateNotification(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id' | 'tenant'>>,
    options: TemplateVersionPinningOptions = {},
  ) {
    // Defense-in-depth: reject tenant changes even if bypassed via `as any`.
    // Reassigning a notification to a different tenant would move it across
    // compartments and could leak data across tenant boundaries.
    if ('tenant' in (notification as Record<string, unknown>)) {
      throw new Error(
        `Cannot update tenant of notification ${String(notificationId)}: ` +
          'tenant reassignment is not allowed.',
      );
    }
    this.assertUsedTemplateVersionNotSet(notificationId, notification as Record<string, unknown>);

    const notificationUpdate = await this.withRepinnedTemplateVersion(
      notificationId,
      notification,
      options.pinTemplateVersions,
    );

    const updatedNotification = this.executeMultiBackendWrite(
      'updateNotification',
      async (backend) => {
        return backend.persistNotificationUpdate(notificationId, notificationUpdate);
      },
      async (backend, primaryResult) => {
        await backend.persistNotificationUpdate(
          notificationId,
          notificationUpdate,
          this.replicaWriteOptions(primaryResult),
        );
      },
      notificationId,
    );
    this.logger.info(log`Notification ${logId(notificationId)} updated`);
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
    options: TemplateVersionPinningOptions = {},
  ): Promise<DatabaseOneOffNotification<Config>> {
    // Validate email or phone format
    this.validateEmailOrPhone(notification.emailOrPhone);

    const notificationToPersist = await this.withResolvedTemplateVersion(
      notification,
      options.pinTemplateVersions,
    );

    const createdNotification = await this.executeMultiBackendWrite(
      'createOneOffNotification',
      async (backend) => {
        return backend.persistOneOffNotification(notificationToPersist);
      },
      async (backend, primaryResult) => {
        await backend.persistOneOffNotification(
          {
            ...notificationToPersist,
            id: primaryResult.id,
          },
          this.replicaWriteOptions(primaryResult),
        );
      },
    );
    this.logger.info(log`One-off notification ${logId(createdNotification.id)} created`);

    if (!notification.sendAfter || notification.sendAfter <= new Date()) {
      this.logger.info(log`One-off notification ${logId(createdNotification.id)} sent immediately`);
      await this.send(createdNotification);
    } else {
      this.logger.info(
        log`One-off notification ${logId(createdNotification.id)} scheduled for ${logTimestamp(notification.sendAfter)}`,
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
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id' | 'tenant'>>,
    options: TemplateVersionPinningOptions = {},
  ): Promise<DatabaseOneOffNotification<Config>> {
    // Defense-in-depth: reject tenant changes even if bypassed via `as any`.
    // See updateNotification for rationale.
    if ('tenant' in (notification as Record<string, unknown>)) {
      throw new Error(
        `Cannot update tenant of one-off notification ${String(notificationId)}: ` +
          'tenant reassignment is not allowed.',
      );
    }
    this.assertUsedTemplateVersionNotSet(notificationId, notification as Record<string, unknown>);
    // Validate email or phone format if provided
    if (notification.emailOrPhone !== undefined) {
      this.validateEmailOrPhone(notification.emailOrPhone);
    }

    const notificationUpdate = await this.withRepinnedTemplateVersion(
      notificationId,
      notification,
      options.pinTemplateVersions,
    );

    const updatedNotification = await this.executeMultiBackendWrite(
      'updateOneOffNotification',
      async (backend) => {
        return backend.persistOneOffNotificationUpdate(notificationId, notificationUpdate);
      },
      async (backend, primaryResult) => {
        await backend.persistOneOffNotificationUpdate(
          notificationId,
          notificationUpdate,
          this.replicaWriteOptions(primaryResult),
        );
      },
      notificationId,
    );
    this.logger.info(log`One-off notification ${logId(notificationId)} updated`);

    if (!updatedNotification.sendAfter || updatedNotification.sendAfter <= new Date()) {
      this.logger.info(log`One-off notification ${logId(notificationId)} sent after update`);
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
    return this.getBackend(backendIdentifier).getFutureNotificationsFromUser(
      userId,
      page,
      pageSize,
    );
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

  /**
   * Gets all pending notifications from the primary backend by default or from a specific backend.
   */
  async getAllPendingNotifications(backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getAllPendingNotifications();
  }

  /**
   * Gets pending notifications from the primary backend by default or from a specific backend.
   */
  async getPendingNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getPendingNotifications(page, pageSize);
  }

  /**
   * Gets notifications from the primary backend by default or from a specific backend.
   */
  async getNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getNotifications(page, pageSize);
  }

  async getOneOffNotifications(page: number, pageSize: number, backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).getOneOffNotifications(page, pageSize);
  }

  /**
   * Gets a notification by ID from the primary backend by default or from a specific backend.
   */
  async getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate = false,
    backendIdentifier?: string,
  ) {
    return this.getBackend(backendIdentifier).getNotification(notificationId, forUpdate);
  }

  /**
   * Filters notifications in the primary backend by default or in a specific backend.
   */
  async filterNotifications(
    filter: NotificationFilterFields<Config>,
    page: number,
    pageSize: number,
    orderBy?: NotificationOrderBy,
    backendIdentifier?: string,
  ) {
    return this.getBackend(backendIdentifier).filterNotifications(filter, page, pageSize, orderBy);
  }

  /**
   * The ID and version token of every notification matching `filter`, a page at a time, from the
   * primary backend by default or from a specific backend.
   *
   * Reads nothing else: no recipient, context, context parameters, rendered content or
   * attachments, so it is the way to count or select notifications that must not be read. Pass a
   * returned `version` as `expectedVersion` to `repinNotification` or `requeueNotification` to act
   * only on a notification that has not changed since it was listed.
   *
   * Ordered by ID. A caller that re-pins or re-queues what it lists may change which notifications
   * match, so it should list again from page 0 instead of moving on to the next page.
   *
   * @throws Error when the backend does not implement it (`versions.filter` is `false` in
   *   `getBackendSupportedActionCapabilities`).
   */
  async filterNotificationVersions(
    filter: NotificationFilter<Config>,
    page: number,
    pageSize: number,
    backendIdentifier?: string,
  ): Promise<NotificationVersion<Config>[]> {
    const backend = this.getBackend(backendIdentifier);
    if (typeof backend.filterNotificationVersions !== 'function') {
      throw new Error(
        `Backend ${this.getBackendIdentifier(backend)} does not support filterNotificationVersions`,
      );
    }
    return backend.filterNotificationVersions(filter, page, pageSize);
  }

  /**
   * Returns the effective filter capabilities for the primary backend by default or for a specific backend.
   */
  async getBackendSupportedFilterCapabilities(backendIdentifier?: string) {
    return {
      ...DEFAULT_BACKEND_FILTER_CAPABILITIES,
      ...(this.getBackend(backendIdentifier).getFilterCapabilities?.() ?? {}),
    };
  }

  /**
   * Which optional notification actions the primary backend, or a specific one, supports. Every
   * key defaults to `false`; see `NotificationActionCapabilities`.
   *
   * A key whose method the backend does not implement reads `false` whatever the backend reports.
   */
  async getBackendSupportedActionCapabilities(
    backendIdentifier?: string,
  ): Promise<NotificationActionCapabilities> {
    return this.getActionCapabilities(this.getBackend(backendIdentifier));
  }

  private getActionCapabilities(backend: Backend): NotificationActionCapabilities {
    const capabilities: NotificationActionCapabilities = {
      ...DEFAULT_BACKEND_ACTION_CAPABILITIES,
      ...(backend.getActionCapabilities?.() ?? {}),
    };
    if (typeof backend.repinNotification !== 'function') {
      capabilities['repin.expectedVersion'] = false;
    }
    if (typeof backend.filterNotificationVersions !== 'function') {
      capabilities['versions.filter'] = false;
    }
    if (typeof backend.repinNotifications !== 'function') {
      capabilities['repin.bulk'] = false;
    }
    if (typeof backend.requeueNotifications !== 'function') {
      capabilities['requeue.bulk'] = false;
    }
    return capabilities;
  }

  /**
   * Refuse an option the primary backend would not honour, before anything is read or written.
   */
  private assertActionSupported(
    notificationId: Config['NotificationIdType'],
    action: 'requeue' | 'repin',
    capability: string,
    option: string,
  ): void {
    if (this.getActionCapabilities(this.backend)[capability] === true) {
      return;
    }
    throw new NotificationActionError({
      action,
      reason: 'UNSUPPORTED',
      notificationId,
      message:
        `Cannot ${action} notification ${String(notificationId)} with ${option}: ` +
        `the primary backend ${this.primaryBackendIdentifier} does not report ${capability}`,
    });
  }

  /** Reject a template version that is not a non-negative integer, before anything is read. */
  private assertValidTemplateVersion(
    notificationId: Config['NotificationIdType'],
    action: 'requeue' | 'repin',
    templateVersion: number | undefined,
  ): void {
    if (
      templateVersion !== undefined &&
      !(Number.isInteger(templateVersion) && templateVersion >= 0)
    ) {
      throw new RangeError(
        `Cannot ${action} notification ${String(notificationId)}: templateVersion must be a non-negative integer`,
      );
    }
  }

  /**
   * Gets a one-off notification by ID.
   *
   * @param notificationId - The ID of the one-off notification to retrieve
   * @param forUpdate - Whether the notification is being retrieved for update (default: false)
   * @param backendIdentifier - Optional backend identifier. When omitted, the primary backend is used.
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
      async (backend, primaryResult) => {
        await backend.markAsRead(
          notificationId,
          checkIsSent,
          this.replicaWriteOptions(primaryResult),
        );
      },
      notificationId,
    );
    this.logger.info(log`Notification ${logId(notificationId)} marked as read`);
    return notification;
  }

  /**
   * Gets unread in-app notifications from the primary backend by default or from a specific backend.
   */
  async getInAppUnread(userId: Config['NotificationIdType'], backendIdentifier?: string) {
    return this.getBackend(backendIdentifier).filterAllInAppUnreadNotifications(userId);
  }

  async cancelNotification(notificationId: Config['NotificationIdType']): Promise<void> {
    await this.executeMultiBackendWrite(
      'cancelNotification',
      async (backend) => {
        return backend.cancelNotification(notificationId);
      },
      async (backend, primaryResult) => {
        await backend.cancelNotification(notificationId, this.replicaWriteOptions(primaryResult));
      },
      notificationId,
    );
    this.logger.info(log`Notification ${logId(notificationId)} cancelled`);
  }

  /**
   * The notification an action is about, regular or one-off, read from the primary backend.
   *
   * Tries `getOneOffNotification` as well because a backend is not required to return one-off
   * notifications from `getNotification`.
   */
  private async getNotificationForAction(
    notificationId: Config['NotificationIdType'],
    action: 'requeue' | 'repin',
  ): Promise<AnyDatabaseNotification<Config>> {
    const notification =
      (await this.backend.getNotification(notificationId, false)) ??
      (await this.backend.getOneOffNotification(notificationId, false));

    if (!notification) {
      throw new NotificationActionError({
        action,
        reason: 'NOT_FOUND',
        notificationId,
        message: `Notification ${String(notificationId)} not found`,
      });
    }
    return notification;
  }

  /**
   * The notification as the primary backend holds it now, or `null` when it is gone.
   */
  private async readNotificationForAction(
    notificationId: Config['NotificationIdType'],
  ): Promise<AnyDatabaseNotification<Config> | null> {
    return (
      (await this.backend.getNotification(notificationId, false)) ??
      (await this.backend.getOneOffNotification(notificationId, false))
    );
  }

  /**
   * Put a failed or cancelled notification back into `PENDING_SEND`, so it is sent again.
   *
   * The notification keeps its ID, content and template pin: this retries the same notification,
   * where `resendNotification` creates a new one from a notification that was delivered. Once the
   * notification is pending again it is due when `sendAfter` is `null` or past, and then it is
   * sent at once, the same as `createNotification` does. A notification handled by an adapter with
   * `enqueueNotifications` goes back on the queue service. A future `sendAfter` leaves it for
   * whatever sends pending notifications. So does `send: false`, even for a due notification.
   *
   * The stored context is not regenerated. A notification created with `contextUsed`, or failed
   * through `delayedSend`, is sent with the context stored on it.
   *
   * To change the template version as well, pass `templateVersion`: the pin and the status change
   * in one backend write, so the notification is never left half-moved. That needs a backend
   * reporting `requeue.templateVersion`. Calling `repinNotification` first and then this still
   * works, in two writes.
   *
   * @param options `sendAfter` left out keeps the notification's own, `null` means "now".
   *   `templateVersion` pins in the same write. `expectedVersion` writes only if the notification
   *   is still at that version. `send: false` re-queues without sending.
   * @returns the notification as it stands after any send this call started, read again from the
   *   primary backend: `SENT` when it went out, `FAILED` when the adapter failed, `PENDING_SEND`
   *   when it is waiting (scheduled, `send: false`, handed to a queue, or the send stopped before
   *   reaching an adapter). This holds with `raiseErrorOnFailedSend: false` too.
   * @throws NotificationActionError when the notification is not found (`NOT_FOUND`), is not
   *   `FAILED` or `CANCELLED` (`INVALID_STATUS`), is no longer at `expectedVersion` (`CHANGED`), or
   *   the primary backend cannot honour `expectedVersion` or `templateVersion` (`UNSUPPORTED`).
   *   Nothing has been written in any of these cases.
   * @throws RangeError when `templateVersion` is not a non-negative integer.
   */
  async requeueNotification(
    notificationId: Config['NotificationIdType'],
    options: RequeueOptions = {},
  ): Promise<AnyDatabaseNotification<Config>> {
    const { templateVersion, expectedVersion } = options;
    this.assertValidTemplateVersion(notificationId, 'requeue', templateVersion);
    if (expectedVersion !== undefined) {
      this.assertActionSupported(
        notificationId,
        'requeue',
        'requeue.expectedVersion',
        'expectedVersion',
      );
    }
    if (templateVersion !== undefined) {
      this.assertActionSupported(
        notificationId,
        'requeue',
        'requeue.templateVersion',
        'templateVersion',
      );
    }

    const notification = await this.getNotificationForAction(notificationId, 'requeue');
    if (!REQUEUEABLE_NOTIFICATION_STATUSES.includes(notification.status)) {
      throw new NotificationActionError({
        action: 'requeue',
        reason: 'INVALID_STATUS',
        notificationId,
        status: notification.status,
        message:
          `Cannot requeue notification ${String(notificationId)} in status ${notification.status}: ` +
          `only ${REQUEUEABLE_NOTIFICATION_STATUSES.join(' and ')} notifications can be requeued. ` +
          'Use resendNotification to send a delivered notification again.',
      });
    }

    // Only the keys the caller passed: an absent `sendAfter` means "keep it", and spreading
    // `undefined` in would read as "set it to undefined" to a backend that checks with `in`.
    const replicaOptions: RequeueNotificationOptions =
      options.sendAfter === undefined ? {} : { sendAfter: options.sendAfter };
    const primaryOptions: RequeueNotificationOptions = {
      ...replicaOptions,
      ...(templateVersion === undefined ? {} : { templateVersion }),
      ...(expectedVersion === undefined ? {} : { expectedVersion }),
    };

    const requeuedNotification = await this.executeMultiBackendWrite(
      'requeueNotification',
      async (backend) => backend.requeueNotification(notificationId, primaryOptions),
      async (backend, primaryResult) => {
        await this.replicateRequeue(
          backend,
          notificationId,
          replicaOptions,
          templateVersion,
          this.replicaWriteOptions(primaryResult),
          notification,
        );
      },
      notificationId,
    );
    if (templateVersion === undefined) {
      this.logger.info(log`Notification ${logId(notificationId)} requeued`);
    } else {
      this.logger.info(
        log`Notification ${logId(notificationId)} requeued on template version ${logCount(templateVersion)}`,
      );
    }

    if (options.send === false) {
      this.logger.info(
        log`Notification ${logId(notificationId)} left for the pending sender because send is false`,
      );
      return requeuedNotification;
    }

    if (requeuedNotification.sendAfter && requeuedNotification.sendAfter > new Date()) {
      this.logger.info(
        log`Notification ${logId(notificationId)} requeued for ${logTimestamp(requeuedNotification.sendAfter)}`,
      );
      return requeuedNotification;
    }

    this.logger.info(
      log`Notification ${logId(notificationId)} sent after requeue because sendAfter is null or in the past`,
    );
    await this.send(requeuedNotification);
    // `send` reports nothing back, and with `raiseErrorOnFailedSend: false` swallows failures, so
    // the record is the only place the outcome is written.
    return (await this.readNotificationForAction(notificationId)) ?? requeuedNotification;
  }

  /**
   * Copy a re-queue the primary made onto an additional backend.
   *
   * `expectedVersion` was checked on the primary, so a replica takes the write as it is, and
   * stores the token the primary's write recorded. A replica that cannot pin in the same write is
   * pinned first through the generic update, which needs the notification: the primary's copy when
   * the caller has it, or the replica's own.
   */
  private async replicateRequeue(
    backend: Backend,
    notificationId: Config['NotificationIdType'],
    replicaOptions: RequeueNotificationOptions,
    templateVersion: number | undefined,
    writeOptions: NotificationWriteOptions,
    notification?: AnyDatabaseNotification<Config>,
  ): Promise<void> {
    if (templateVersion === undefined) {
      await backend.requeueNotification(notificationId, { ...replicaOptions, ...writeOptions });
    } else if (this.getActionCapabilities(backend)['requeue.templateVersion'] === true) {
      await backend.requeueNotification(notificationId, {
        ...replicaOptions,
        templateVersion,
        ...writeOptions,
      });
    } else {
      await this.persistTemplatePin(
        backend,
        notification ?? (await this.readReplicaNotification(backend, notificationId)),
        templateVersion,
        writeOptions,
      );
      await backend.requeueNotification(notificationId, { ...replicaOptions, ...writeOptions });
    }
  }

  /** An additional backend's copy of a notification, regular or one-off. */
  private async readReplicaNotification(
    backend: Backend,
    notificationId: Config['NotificationIdType'],
  ): Promise<AnyDatabaseNotification<Config>> {
    const notification =
      (await backend.getNotification(notificationId, false)) ??
      (await backend.getOneOffNotification(notificationId, false));
    if (!notification) {
      throw new Error(
        `Notification ${String(notificationId)} not found in backend ${this.getBackendIdentifier(backend)}`,
      );
    }
    return notification;
  }

  /**
   * Write a template pin through the generic update, for a backend without `repinNotification`.
   */
  private async persistTemplatePin(
    backend: Backend,
    notification: AnyDatabaseNotification<Config>,
    version: number,
    writeOptions: NotificationWriteOptions = {},
  ): Promise<AnyDatabaseNotification<Config>> {
    if (isOneOffNotification(notification)) {
      const update: Partial<Omit<OneOffNotificationInput<Config>, 'id'>> = {
        requestedTemplateVersion: version,
      };
      return backend.persistOneOffNotificationUpdate(notification.id, update, writeOptions);
    }
    const update: Partial<Omit<Notification<Config>, 'id'>> = {
      requestedTemplateVersion: version,
    };
    return backend.persistNotificationUpdate(notification.id, update, writeOptions);
  }

  /**
   * Pin a notification to a template version, by default the one that is current right now.
   *
   * Use it after publishing a fixed template, to move notifications that are pending, failed or
   * cancelled onto the fix. `updateNotification` keeps an existing pin unless `bodyTemplate`
   * changes, so it cannot do this.
   * Works the same whether the notification was pinned before or not, and for one-off
   * notifications too. It changes `requestedTemplateVersion` only. It sends nothing and leaves the
   * status alone. To re-pin a failed notification and send it again, pass `templateVersion` to
   * `requeueNotification`, which does both in one write.
   *
   * A backend that implements `repinNotification` does the write itself, checking the status and
   * that the notification did not change since it read it. Otherwise it goes through
   * `persistNotificationUpdate`.
   *
   * Re-pinning to the version already pinned writes nothing and returns the notification as it is.
   *
   * @param options `templateVersion` pins that version instead of `getCurrentTemplateVersion`. It
   *   is not checked against the renderer: a version that does not exist fails when the
   *   notification is rendered, as it does when passed to `createNotification`. `expectedVersion`
   *   writes only if the notification is still at that version.
   * @returns the notification with its new pin.
   * @throws NotificationActionError when the notification is not found (`NOT_FOUND`), was already
   *   delivered (`INVALID_STATUS`), no version was given and the renderer reports none
   *   (`NO_TEMPLATE_VERSION`), it is no longer at `expectedVersion` (`CHANGED`), or the primary
   *   backend cannot check `expectedVersion` (`UNSUPPORTED`). Nothing has been written in any of
   *   those cases.
   * @throws RangeError when `templateVersion` is not a non-negative integer.
   */
  async repinNotification(
    notificationId: Config['NotificationIdType'],
    options: RepinOptions = {},
  ): Promise<AnyDatabaseNotification<Config>> {
    const { templateVersion, expectedVersion } = options;
    this.assertValidTemplateVersion(notificationId, 'repin', templateVersion);
    if (expectedVersion !== undefined) {
      this.assertActionSupported(
        notificationId,
        'repin',
        'repin.expectedVersion',
        'expectedVersion',
      );
    }

    const notification = await this.getNotificationForAction(notificationId, 'repin');
    if (!REPINNABLE_NOTIFICATION_STATUSES.includes(notification.status)) {
      throw new NotificationActionError({
        action: 'repin',
        reason: 'INVALID_STATUS',
        notificationId,
        status: notification.status,
        message:
          `Cannot repin notification ${String(notificationId)} in status ${notification.status}: ` +
          'it has already been delivered, and its pin records what it was asked to render.',
      });
    }

    const version =
      templateVersion ??
      (await this.getCurrentTemplateVersion(
        notification.notificationType,
        notification.bodyTemplate,
      ));

    if (version === null) {
      throw new NotificationActionError({
        action: 'repin',
        reason: 'NO_TEMPLATE_VERSION',
        notificationId,
        message:
          `Cannot repin notification ${String(notificationId)}: ` +
          `no template renderer for notification type ${notification.notificationType} reports a version for its template`,
      });
    }

    // With `expectedVersion` the backend has to look: the notification may already carry the pin
    // and still have changed since the caller listed it.
    if (expectedVersion === undefined && notification.requestedTemplateVersion === version) {
      this.logger.info(
        log`Notification ${logId(notificationId)} is already pinned to template version ${logCount(version)}`,
      );
      return notification;
    }

    const repinnedNotification = await this.executeMultiBackendWrite(
      'repinNotification',
      async (backend) => {
        if (typeof backend.repinNotification === 'function') {
          return backend.repinNotification(
            notificationId,
            version,
            expectedVersion === undefined ? {} : { expectedVersion },
          );
        }
        return this.persistTemplatePin(backend, notification, version);
      },
      async (backend, primaryResult) => {
        // Replicas follow the primary, so they take the pin unconditionally, as they always have,
        // and store the token the primary's write recorded.
        await this.persistTemplatePin(
          backend,
          notification,
          version,
          this.replicaWriteOptions(primaryResult),
        );
      },
      notificationId,
    );

    this.logger.info(
      log`Notification ${logId(notificationId)} repinned to template version ${logCount(version)}`,
    );
    return repinnedNotification;
  }

  /**
   * Pin several notifications to `templateVersion` at once, each only if it has not changed since
   * it was listed.
   *
   * Pass the `{ id, version }` pairs `filterNotificationVersions` returned, and the filter they
   * were listed with: the primary backend checks every target's token, status and the filter in
   * one pass and writes the ones that pass, without reading any of them in full first. Where
   * `repinNotification` reads each notification before and inside its write, this costs the
   * backend about one lookup and one write per batch.
   *
   * A target that fails a check is skipped, not thrown for, and its result says why: see
   * `BulkNotificationActionOutcome`. One already on `templateVersion` is `UNCHANGED`. Additional
   * backends take each `WRITTEN` pin, as they do for `repinNotification`.
   *
   * @returns one result per target, in their order.
   * @throws Error when the primary backend does not implement it (`repin.bulk`), or targets repeat
   *   an ID. Nothing has been written then.
   * @throws RangeError when `templateVersion` is not a non-negative integer.
   */
  async repinNotifications(
    targets: NotificationVersion<Config>[],
    options: BulkRepinOptions<Config>,
  ): Promise<BulkNotificationActionResult<Config>[]> {
    const { templateVersion, filter } = options;
    this.assertValidBulkTemplateVersion('repin', templateVersion);
    this.assertBulkActionSupported('repinNotifications', 'repin.bulk');
    this.assertDistinctTargets('repin', targets);
    if (targets.length === 0) {
      return [];
    }

    const results = await (
      this.backend.repinNotifications as NonNullable<Backend['repinNotifications']>
    ).call(this.backend, targets, templateVersion, filter === undefined ? {} : { filter });

    await this.replicateBulkWrites('repinNotifications', results, async (backend, result) => {
      await this.persistTemplatePin(
        backend,
        await this.readReplicaNotification(backend, result.id),
        templateVersion,
        this.replicaWriteOptions({ notificationVersion: result.version }),
      );
    });

    this.logBulkOutcomes('repinned', targets.length, results);
    return results;
  }

  /**
   * Put several failed or cancelled notifications back into `PENDING_SEND` at once, each only if
   * it has not changed since it was listed.
   *
   * Checks and writes as `repinNotifications` does, and changes what `requeueNotification`
   * changes. It sends nothing, whether the notifications are due or not: they are left pending for
   * whatever sends pending notifications, as `requeueNotification` does with `send: false`.
   *
   * @returns one result per target, in their order.
   * @throws Error when the primary backend does not implement it (`requeue.bulk`), or targets
   *   repeat an ID. Nothing has been written then.
   * @throws RangeError when `templateVersion` is not a non-negative integer.
   */
  async requeueNotifications(
    targets: NotificationVersion<Config>[],
    options: BulkRequeueOptions<Config> = {},
  ): Promise<BulkNotificationActionResult<Config>[]> {
    const { templateVersion, filter } = options;
    if (templateVersion !== undefined) {
      this.assertValidBulkTemplateVersion('requeue', templateVersion);
    }
    this.assertBulkActionSupported('requeueNotifications', 'requeue.bulk');
    this.assertDistinctTargets('requeue', targets);
    if (targets.length === 0) {
      return [];
    }

    // Only the keys the caller passed, as in `requeueNotification`.
    const replicaOptions: RequeueNotificationOptions =
      options.sendAfter === undefined ? {} : { sendAfter: options.sendAfter };
    const primaryOptions: BulkRequeueNotificationOptions<Config> = {
      ...replicaOptions,
      ...(templateVersion === undefined ? {} : { templateVersion }),
      ...(filter === undefined ? {} : { filter }),
    };

    const results = await (
      this.backend.requeueNotifications as NonNullable<Backend['requeueNotifications']>
    ).call(this.backend, targets, primaryOptions);

    await this.replicateBulkWrites('requeueNotifications', results, async (backend, result) => {
      await this.replicateRequeue(
        backend,
        result.id,
        replicaOptions,
        templateVersion,
        this.replicaWriteOptions({ notificationVersion: result.version }),
      );
    });

    this.logBulkOutcomes('requeued', targets.length, results);
    return results;
  }

  private assertValidBulkTemplateVersion(action: 'requeue' | 'repin', templateVersion: number) {
    if (!(Number.isInteger(templateVersion) && templateVersion >= 0)) {
      throw new RangeError(
        `Cannot ${action} notifications: templateVersion must be a non-negative integer`,
      );
    }
  }

  private assertBulkActionSupported(method: string, capability: string): void {
    if (this.getActionCapabilities(this.backend)[capability] !== true) {
      throw new Error(
        `Backend ${this.primaryBackendIdentifier} does not support ${method} (${capability})`,
      );
    }
  }

  private assertDistinctTargets(
    action: 'requeue' | 'repin',
    targets: NotificationVersion<Config>[],
  ): void {
    const ids = new Set(targets.map((target) => String(target.id)));
    if (ids.size !== targets.length) {
      throw new Error(`Cannot ${action} notifications: the targets repeat a notification ID`);
    }
  }

  /**
   * Replicate each write a bulk action made on the primary, one notification at a time, through
   * the same inline or queued replication single writes use.
   */
  private async replicateBulkWrites(
    operation: string,
    results: BulkNotificationActionResult<Config>[],
    additionalWrite: (
      backend: Backend,
      result: BulkNotificationActionResult<Config>,
    ) => Promise<void>,
  ): Promise<void> {
    if (this.getAdditionalBackends().length === 0) {
      return;
    }
    for (const result of results) {
      if (result.outcome !== 'WRITTEN') {
        continue;
      }
      await this.executeMultiBackendWrite(
        operation,
        async () => result,
        additionalWrite,
        result.id,
      );
    }
  }

  /** Log how many targets ended in each outcome. Counts only: the IDs are in the results. */
  private logBulkOutcomes(
    verb: string,
    total: number,
    results: BulkNotificationActionResult<Config>[],
  ): void {
    const counts = new Map<BulkNotificationActionOutcome, number>();
    for (const result of results) {
      counts.set(result.outcome, (counts.get(result.outcome) ?? 0) + 1);
    }
    this.logger.info(
      log`${logCount(counts.get('WRITTEN') ?? 0)} of ${logCount(total)} notifications ${logLabel(verb)}`,
    );
    const skipped = total - (counts.get('WRITTEN') ?? 0);
    if (skipped > 0) {
      this.logger.info(
        log`Skipped: ${logCount(counts.get('UNCHANGED') ?? 0)} unchanged, ${logCount(counts.get('CHANGED') ?? 0)} changed, ${logCount(counts.get('INVALID_STATUS') ?? 0)} in another status, ${logCount(counts.get('NOT_MATCHED') ?? 0)} not matched, ${logCount(counts.get('FAILED') ?? 0)} failed`,
      );
    }
  }

  async resendNotification(
    notificationId: Config['NotificationIdType'],
    useStoredContextIfAvailable = false,
  ): Promise<DatabaseNotification<Config> | undefined> {
    const notification = await this.getNotification(notificationId, false);

    if (!notification) {
      this.logger.error(log`Notification ${logId(notificationId)} not found`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} not found`);
      }
      return;
    }

    // Check if this is a one-off notification (which cannot be resent this way)
    if (isOneOffNotification(notification)) {
      this.logger.error(
        log`Cannot resend one-off notification ${logId(notificationId)} using resendNotification. One-off notifications are not supported.`,
      );
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(
          `Cannot resend one-off notification ${notificationId}. One-off notifications must be resent using a different method.`,
        );
      }
      return;
    }

    if (notification.sendAfter && notification.sendAfter > new Date()) {
      this.logger.error(log`Notification ${logId(notificationId)} is scheduled for the future`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} is scheduled for the future`);
      }
      return;
    }

    if (useStoredContextIfAvailable && !notification.contextUsed) {
      this.logger.error(log`Context not found for notification ${logId(notificationId)}`);
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
      tenant: notification.tenant,
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
      log`Notification ${logId(createdNotification.id)} created for resending notification ${logId(notificationId)}`,
    );
    this.send(createdNotification);
    return createdNotification;
  }

  async delayedSend(notificationId: Config['NotificationIdType']): Promise<void> {
    const notification = await this.getNotification(notificationId, false);

    if (!notification) {
      this.logger.error(log`Notification ${logId(notificationId)} not found`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error(`Notification ${notificationId} not found`);
      }
      return;
    }

    const enqueueNotificationsAdapters = this.adapters.filter(
      (adapter) => adapter.enqueueNotifications,
    );

    if (enqueueNotificationsAdapters.length === 0) {
      this.logger.error(log`Delayed send is not supported if there are no distributed adapters`);
      if (this.options.raiseErrorOnFailedSend) {
        throw new Error('Delayed send is not supported if there are no distributed adapters');
      }
      return;
    }

    const notificationWithExecutionGitCommitSha =
      await this.resolveAndPersistGitCommitShaForExecution(notification);

    const context = await this.getNotificationContext(
      notificationWithExecutionGitCommitSha.contextName,
      notificationWithExecutionGitCommitSha.contextParameters,
    );

    let lastAdapterKey = 'unknown';
    for (const adapter of enqueueNotificationsAdapters) {
      lastAdapterKey = adapter.key ?? 'unknown';
      try {
        const sendInput = await adapter.send(notificationWithExecutionGitCommitSha, context);
        await this.recordUsedTemplateVersion(notificationWithExecutionGitCommitSha, sendInput);
        try {
          await this.executeMultiBackendWrite(
            'markAsSent',
            async (backend) => {
              return backend.markAsSent(notificationWithExecutionGitCommitSha.id, true);
            },
            async (backend, primaryResult) => {
              await backend.markAsSent(
                notificationWithExecutionGitCommitSha.id,
                true,
                this.replicaWriteOptions(primaryResult),
              );
            },
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (markSentError) {
          this.logger.error(
            log`Error marking notification ${logId(notificationWithExecutionGitCommitSha.id)} as sent: ${logError(markSentError)}`,
          );
        }
      } catch (sendError) {
        this.logger.error(
          log`Error sending notification ${logId(notificationWithExecutionGitCommitSha.id)} with adapter ${logLabel(adapter.key)}: ${logError(sendError)}`,
        );
        try {
          await this.executeMultiBackendWrite(
            'markAsFailed',
            async (backend) => {
              return backend.markAsFailed(notificationWithExecutionGitCommitSha.id, true);
            },
            async (backend, primaryResult) => {
              await backend.markAsFailed(
                notificationWithExecutionGitCommitSha.id,
                true,
                this.replicaWriteOptions(primaryResult),
              );
            },
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (markFailedError) {
          this.logger.error(
            log`Error marking notification ${logId(notificationWithExecutionGitCommitSha.id)} as failed: ${logError(markFailedError)}`,
          );
        }
      } finally {
        try {
          await this.executeMultiBackendWrite(
            'storeAdapterAndContextUsed',
            async (backend) => {
              return backend.storeAdapterAndContextUsed(
                notificationWithExecutionGitCommitSha.id,
                lastAdapterKey,
                context,
              );
            },
            async (backend, primaryResult) => {
              await backend.storeAdapterAndContextUsed(
                notificationWithExecutionGitCommitSha.id,
                lastAdapterKey,
                context,
                this.replicaWriteOptions(primaryResult),
              );
            },
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (storeContextError) {
          this.logger.error(
            log`Error storing adapter and context for notification ${logId(notificationWithExecutionGitCommitSha.id)}: ${logError(storeContextError)}`,
          );
        }
      }
    }
  }

  async bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
  ): Promise<Config['NotificationIdType'][]> {
    // The bulk write returns IDs only, so the tokens it recorded are read back from the primary,
    // once, for every additional backend to store.
    let primaryVersions: Promise<(string | undefined)[]> | undefined;

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

        primaryVersions ??= this.readPrimaryNotificationVersions(createdIds);
        const notificationVersions = await primaryVersions;
        await backend.bulkPersistNotifications(
          notificationsWithIds as unknown as Omit<AnyNotification<Config>, 'id'>[],
          notificationVersions.some((version) => version !== undefined)
            ? { notificationVersions }
            : {},
        );
      },
    );
  }

  /**
   * The version token the primary holds for each notification, in the same order, `undefined`
   * where it keeps none. Read a few at a time so a large bulk write does not open a read per
   * notification at once.
   */
  private async readPrimaryNotificationVersions(
    notificationIds: Config['NotificationIdType'][],
  ): Promise<(string | undefined)[]> {
    const batchSize = 25;
    const versions: (string | undefined)[] = [];
    for (let start = 0; start < notificationIds.length; start += batchSize) {
      const batch = notificationIds.slice(start, start + batchSize);
      const notifications = await Promise.all(
        batch.map((notificationId) => this.backend.getNotification(notificationId, false)),
      );
      versions.push(...notifications.map((notification) => notification?.notificationVersion));
    }
    return versions;
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

  private isLikelyDuplicateReplicationConflict(error: unknown): boolean {
    const normalizedError = String(error).toLowerCase();

    return (
      normalizedError.includes('duplicate') ||
      normalizedError.includes('unique') ||
      normalizedError.includes('already exists') ||
      normalizedError.includes('conflict')
    );
  }

  /**
   * Verifies whether a notification is synchronized across all configured backends.
   *
   * The report includes backend-level existence/errors and field-level discrepancies
   * when comparing additional backends against the primary backend.
   */
  async verifyNotificationSync(notificationId: Config['NotificationIdType']): Promise<{
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
        'tenant',
        'adapterUsed',
        'sendAfter',
        'sentAt',
        'readAt',
        'createdAt',
        'updatedAt',
        'gitCommitSha',
        // Both hold comparable content rather than per-backend detail:
        // requestedTemplateVersion is written by the same create/update that fans out to every
        // backend, and usedTemplateVersion is written to all of them together at send time. A
        // backend disagreeing on either really is replication drift.
        'requestedTemplateVersion',
        'usedTemplateVersion',
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

  /**
   * Worker-facing replication entrypoint.
   *
   * Reads the notification from the primary backend and upserts into additional backends.
   */
  async processReplication(
    notificationId: Config['NotificationIdType'],
    targetBackendIdentifier?: string,
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

    const replicationTargets = this.getAdditionalBackends()
      .map((backend) => {
        return {
          backend,
          backendIdentifier: this.getBackendIdentifier(backend),
        };
      })
      .filter(({ backendIdentifier }) => {
        if (!targetBackendIdentifier) {
          return true;
        }

        return backendIdentifier === targetBackendIdentifier;
      });

    if (targetBackendIdentifier && replicationTargets.length === 0) {
      throw new Error(`Additional backend not found: ${targetBackendIdentifier}`);
    }

    const replicationTaskResults = await Promise.all(
      replicationTargets.map(async ({ backend, backendIdentifier }) => {
        try {
          if (typeof backend.applyReplicationSnapshotIfNewer === 'function') {
            const conditionalApplyResult =
              await backend.applyReplicationSnapshotIfNewer(primaryNotification);

            if (!conditionalApplyResult.applied) {
              this.logger.info(
                log`Skipped replication for notification ${logId(notificationId)} on backend ${logLabel(backendIdentifier)} because destination state is newer or equal`,
              );
            }

            return {
              backendIdentifier,
              error: null,
            };
          }

          const existingNotification = await backend.getNotification(notificationId, false);
          const writeOptions = this.replicaWriteOptions(primaryNotification);

          if (existingNotification) {
            await backend.persistNotificationUpdate(
              notificationId,
              primaryNotification as unknown as Partial<Omit<Notification<Config>, 'id'>>,
              writeOptions,
            );
          } else {
            try {
              await backend.persistNotification(
                primaryNotification as unknown as Omit<Notification<Config>, 'id'> & {
                  id?: Config['NotificationIdType'];
                },
                writeOptions,
              );
            } catch (createError) {
              if (!this.isLikelyDuplicateReplicationConflict(createError)) {
                throw createError;
              }

              this.logger.warn(
                log`Detected duplicate replication create on backend ${logLabel(backendIdentifier)} for notification ${logId(notificationId)}. Retrying as update for idempotency.`,
              );

              await backend.persistNotificationUpdate(
                notificationId,
                primaryNotification as unknown as Partial<Omit<Notification<Config>, 'id'>>,
                writeOptions,
              );
            }
          }

          return {
            backendIdentifier,
            error: null,
          };
        } catch (error) {
          return {
            backendIdentifier,
            error: String(error),
          };
        }
      }),
    );

    for (const taskResult of replicationTaskResults) {
      if (taskResult.error) {
        result.failures.push({
          backend: taskResult.backendIdentifier,
          error: taskResult.error,
        });
        continue;
      }

      result.successes.push(taskResult.backendIdentifier);
    }

    return result;
  }

  /**
   * Replicates one notification from the primary backend to all additional backends.
   *
   * If a notification already exists in an additional backend, it is updated.
   * Otherwise, it is created.
   */
  async replicateNotification(notificationId: Config['NotificationIdType']): Promise<{
    successes: string[];
    failures: {
      backend: string;
      error: string;
    }[];
  }> {
    return this.processReplication(notificationId);
  }

  /**
   * Returns a lightweight health snapshot for each configured backend.
   */
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

  /**
   * Migrates notifications from a source backend (primary by default) to a destination backend.
   *
   * @param destinationBackend - Backend receiving migrated records
   * @param batchSize - Page size used while iterating source records
   * @param sourceBackendIdentifier - Optional source backend identifier. Defaults to primary backend.
   */
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
