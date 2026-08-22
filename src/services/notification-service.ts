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
import {
  type BaseNotificationAdapter,
  isOneOffNotification,
} from './notification-adapters/base-notification-adapter.js';
import {
  type BaseNotificationBackend,
  DEFAULT_BACKEND_FILTER_CAPABILITIES,
  type NotificationFilterFields,
  type NotificationOrderBy,
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
            `${operation} replicated to backend ${backendIdentifier} in inline mode`,
          );
        } catch (replicationError) {
          this.logger.error(
            `Failed to replicate ${operation} to backend ${backendIdentifier}: ${replicationError}`,
          );
        }
      }
    };

    if (this.options.replicationMode === 'queued') {
      const notificationIdToReplicate = resolveReplicationNotificationId();

      if (!notificationIdToReplicate) {
        this.logger.warn(
          `Replication mode is queued, but no notification id was resolved for ${operation}. Falling back to inline replication.`,
        );
        await executeInlineReplication();
        return primaryResult;
      }

      if (!this.replicationQueueService) {
        this.logger.warn(
          `Replication mode is queued, but no replication queue service is registered for ${operation}. Falling back to inline replication.`,
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
          `${operation} replication enqueued for notification ${String(notificationIdToReplicate)} to ${additionalBackends.length} backend(s) in queued mode`,
        );
        return primaryResult;
      }

      for (const failedEnqueue of failedEnqueues) {
        this.logger.error(
          `Failed to enqueue replication for ${operation}, notification ${String(notificationIdToReplicate)} and backend ${failedEnqueue.backendIdentifier}: ${failedEnqueue.error}`,
        );
      }

      this.logger.warn(
        `Falling back to inline replication for ${operation} in ${failedEnqueues.length} backend(s) after queue enqueue failure.`,
      );

      for (const failedEnqueue of failedEnqueues) {
        try {
          await additionalWrite(failedEnqueue.backend, primaryResult);
          this.logger.info(
            `${operation} replicated to backend ${failedEnqueue.backendIdentifier} in inline fallback mode`,
          );
        } catch (replicationError) {
          this.logger.error(
            `Failed to replicate ${operation} to backend ${failedEnqueue.backendIdentifier} in inline fallback mode: ${replicationError}`,
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
        async (backend) => {
          await backend.persistOneOffNotificationUpdate(notification.id, oneOffNotificationUpdate);
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
      async (backend) => {
        await backend.persistNotificationUpdate(notification.id, notificationUpdate);
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

    for (const adapter of this.adapters) {
      if (adapter.notificationType !== notificationType) {
        continue;
      }
      try {
        // Optional-chained: a renderer that never grew the method — anything written before
        // template versioning, or against the `implements` form of the seam — simply has no
        // version to offer, which is the same answer the default implementation gives.
        const version = await adapter
          .getTemplateRenderer()
          .getLatestTemplateVersion?.(bodyTemplate);
        if (version !== null && version !== undefined) {
          return version;
        }
      } catch (resolveError) {
        this.logger.error(
          `Template renderer for adapter ${adapter.key ?? 'unknown'} threw while resolving the ` +
            `current version of template "${bodyTemplate}"; leaving the notification unpinned: ` +
            `${resolveError}`,
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
            await backend.storeTemplateVersion(notification.id, version);
          }
        },
        async (backend) => {
          if (supportsTemplateVersions(backend)) {
            await backend.storeTemplateVersion(notification.id, version);
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
        `Error storing the template version used for notification ${String(notification.id)}: ${storeError}`,
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

      // biome-ignore lint/suspicious/noConfusingVoidType: mirrors `BaseNotificationAdapter.send`
      let sendInput: NotificationSendInput | void;
      try {
        this.logger.info(
          `Sending notification ${notificationWithExecutionGitCommitSha.id} with adapter ${adapter.key}`,
        );
        sendInput = await adapter.send(notificationWithExecutionGitCommitSha, context);
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
            notificationWithExecutionGitCommitSha.id,
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
          notificationWithExecutionGitCommitSha.id,
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
          notificationWithExecutionGitCommitSha.id,
        );
      } catch (storeContextError) {
        this.logger.error(
          `Error storing adapter and context for notification ${notificationWithExecutionGitCommitSha.id}: ${storeContextError}`,
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
        await backend.persistNotification({
          ...notificationToPersist,
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
      async (backend) => {
        await backend.persistNotificationUpdate(notificationId, notificationUpdate);
      },
      notificationId,
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
        await backend.persistOneOffNotification({
          ...notificationToPersist,
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
      async (backend) => {
        await backend.persistOneOffNotificationUpdate(notificationId, notificationUpdate);
      },
      notificationId,
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
   * Returns the effective filter capabilities for the primary backend by default or for a specific backend.
   */
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
      async (backend) => {
        await backend.markAsRead(notificationId, checkIsSent);
      },
      notificationId,
    );
    this.logger.info(`Notification ${notificationId} marked as read`);
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
        await backend.cancelNotification(notificationId);
      },
      async (backend) => {
        await backend.cancelNotification(notificationId);
      },
      notificationId,
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
            async (backend) => {
              await backend.markAsSent(notificationWithExecutionGitCommitSha.id, true);
            },
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (markSentError) {
          this.logger.error(
            `Error marking notification ${notificationWithExecutionGitCommitSha.id} as sent: ${markSentError}`,
          );
        }
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
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (markFailedError) {
          this.logger.error(
            `Error marking notification ${notificationWithExecutionGitCommitSha.id} as failed: ${markFailedError}`,
          );
        }
      } finally {
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
            notificationWithExecutionGitCommitSha.id,
          );
        } catch (storeContextError) {
          this.logger.error(
            `Error storing adapter and context for notification ${notificationWithExecutionGitCommitSha.id}: ${storeContextError}`,
          );
        }
      }
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
                `Skipped replication for notification ${String(notificationId)} on backend ${backendIdentifier} because destination state is newer or equal`,
              );
            }

            return {
              backendIdentifier,
              error: null,
            };
          }

          const existingNotification = await backend.getNotification(notificationId, false);

          if (existingNotification) {
            await backend.persistNotificationUpdate(
              notificationId,
              primaryNotification as unknown as Partial<Omit<Notification<Config>, 'id'>>,
            );
          } else {
            try {
              await backend.persistNotification(
                primaryNotification as unknown as Omit<Notification<Config>, 'id'> & {
                  id?: Config['NotificationIdType'];
                },
              );
            } catch (createError) {
              if (!this.isLikelyDuplicateReplicationConflict(createError)) {
                throw createError;
              }

              this.logger.warn(
                `Detected duplicate replication create on backend ${backendIdentifier} for notification ${String(notificationId)}. Retrying as update for idempotency.`,
              );

              await backend.persistNotificationUpdate(
                notificationId,
                primaryNotification as unknown as Partial<Omit<Notification<Config>, 'id'>>,
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
