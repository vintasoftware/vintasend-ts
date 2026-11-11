/**
 * The primary backend generates a notification's version token and every additional backend
 * stores that same token, so a version listed from any backend can be acted on at the primary.
 *
 * The fake backends here keep tokens the way `NotificationWriteOptions` says a real one must: a
 * write without `notificationVersion` mints a new token, and a write with it stores it as given.
 * Each mints tokens of its own shape (`primary-1`, `replica-1`, ...), so a replica that minted its
 * own instead of copying the primary's is caught.
 */
import { describe, expect, it, vi } from 'vitest';
import { VintaSendFactory } from '../../index';
import type { BaseLogger } from '../loggers/base-logger';
import type {
  BaseNotificationBackend,
  BulkNotificationWriteOptions,
  NotificationWriteOptions,
} from '../notification-backends/base-notification-backend';

type Config = {
  ContextMap: {
    testContext: { generate: (params: { userId: string }) => Promise<{ userId: string }> };
  };
  NotificationIdType: string;
  UserIdType: string;
};

type Backend = BaseNotificationBackend<Config>;
type StoredFields = Record<string, unknown>;

const FUTURE = new Date('2999-01-01T00:00:00Z');

const notificationInput = {
  userId: 'user-1',
  notificationType: 'EMAIL' as const,
  title: 'Title',
  bodyTemplate: 'body',
  contextName: 'testContext' as const,
  contextParameters: { userId: 'user-1' },
  sendAfter: FUTURE,
  subjectTemplate: 'subject',
  extraParams: null,
  tenant: null,
};

const logger: BaseLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** A backend that stores notifications and their tokens, and mints `<identifier>-<n>` tokens. */
function tokenBackend(identifier: string) {
  let minted = 0;
  let createdIds = 0;
  const rows = new Map<string, StoredFields>();
  const tokens = new Map<string, string>();

  const record = (id: string, options?: NotificationWriteOptions): string => {
    minted += 1;
    const token = options?.notificationVersion ?? `${identifier}-${minted}`;
    tokens.set(id, token);
    return token;
  };
  const write = (id: string, fields: StoredFields, options?: NotificationWriteOptions) => {
    rows.set(id, {
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
      ...rows.get(id),
      ...fields,
    });
    record(id, options);
    return { ...rows.get(id), id, notificationVersion: tokens.get(id) };
  };
  const nextId = () => {
    createdIds += 1;
    return `notif-${createdIds}`;
  };

  const backend = {
    getBackendIdentifier: () => identifier,
    getNotification: vi.fn(async (id: string) =>
      rows.has(id) ? { ...rows.get(id), id, notificationVersion: tokens.get(id) } : null,
    ),
    getOneOffNotification: vi.fn(async () => null),
    persistNotification: vi.fn(
      async (notification: StoredFields & { id?: string }, options?: NotificationWriteOptions) =>
        write(notification.id ?? nextId(), notification, options),
    ),
    persistNotificationUpdate: vi.fn(
      async (id: string, update: StoredFields, options?: NotificationWriteOptions) =>
        write(id, update, options),
    ),
    bulkPersistNotifications: vi.fn(
      async (
        notifications: (StoredFields & { id?: string })[],
        options?: BulkNotificationWriteOptions,
      ) =>
        notifications.map((notification, index) => {
          const id = notification.id ?? nextId();
          write(id, notification, { notificationVersion: options?.notificationVersions?.[index] });
          return id;
        }),
    ),
    markAsRead: vi.fn(
      async (id: string, _checkIsSent: boolean, options?: NotificationWriteOptions) =>
        write(id, { readAt: FUTURE }, options),
    ),
    markAsSent: vi.fn(
      async (id: string, _checkIsPending: boolean, options?: NotificationWriteOptions) =>
        write(id, { status: 'SENT', sentAt: FUTURE }, options),
    ),
    markAsFailed: vi.fn(
      async (id: string, _checkIsPending: boolean, options?: NotificationWriteOptions) =>
        write(id, { status: 'FAILED', sentAt: FUTURE }, options),
    ),
    cancelNotification: vi.fn(async (id: string, options?: NotificationWriteOptions) => {
      write(id, { status: 'CANCELLED' }, options);
      return { notificationVersion: tokens.get(id) };
    }),
    storeAdapterAndContextUsed: vi.fn(
      async (
        id: string,
        adapterKey: string,
        context: unknown,
        options?: NotificationWriteOptions,
      ) => {
        write(id, { adapterUsed: adapterKey, contextUsed: context }, options);
        return { notificationVersion: tokens.get(id) };
      },
    ),
    requeueNotification: vi.fn(
      async (
        id: string,
        options: NotificationWriteOptions & { sendAfter?: Date | null; expectedVersion?: string },
      ) => {
        if (options.expectedVersion !== undefined && options.expectedVersion !== tokens.get(id)) {
          throw new Error(`${identifier}: notification ${id} changed`);
        }
        return write(
          id,
          {
            status: 'PENDING_SEND',
            sentAt: null,
            ...('sendAfter' in options ? { sendAfter: options.sendAfter } : {}),
          },
          options,
        );
      },
    ),
    getActionCapabilities: () => ({ 'requeue.expectedVersion': true }),
  };

  return {
    backend: backend as unknown as Backend & typeof backend,
    tokenOf: (id: string) => tokens.get(id),
  };
}

function makeService(primary: Backend, replicas: Backend[]) {
  const adapter = {
    notificationType: 'EMAIL',
    key: 'adapter-1',
    enqueueNotifications: false,
    send: vi.fn().mockResolvedValue(undefined),
    injectBackend: vi.fn(),
    injectLogger: vi.fn(),
    supportsAttachments: false,
    getTemplateRenderer: () => ({ render: vi.fn(), injectLogger: vi.fn() }),
  };
  return new VintaSendFactory<Config>().create({
    adapters: [adapter as never],
    backend: primary,
    additionalBackends: replicas,
    logger,
    contextGeneratorsMap: {
      testContext: { generate: async ({ userId }: { userId: string }) => ({ userId }) },
    },
  });
}

describe('version tokens across backends', () => {
  it('stores the token the primary generated on every replica when a notification is created', async () => {
    const primary = tokenBackend('primary');
    const replicaA = tokenBackend('replica-a');
    const replicaB = tokenBackend('replica-b');
    const service = makeService(primary.backend, [replicaA.backend, replicaB.backend]);

    const created = await service.createNotification(notificationInput);

    expect(created.notificationVersion).toBe('primary-1');
    expect(replicaA.tokenOf(created.id)).toBe('primary-1');
    expect(replicaB.tokenOf(created.id)).toBe('primary-1');
    // The primary is given no token: it generates its own.
    expect(primary.backend.persistNotification).toHaveBeenCalledWith(notificationInput);
  });

  it('copies the primary token after updates, reads and cancellations', async () => {
    const primary = tokenBackend('primary');
    const replica = tokenBackend('replica');
    const service = makeService(primary.backend, [replica.backend]);
    const { id } = await service.createNotification(notificationInput);

    await service.updateNotification(id, { title: 'Updated' });
    expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));

    await service.markRead(id, false);
    expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));

    // `cancelNotification` returns no notification: the token comes from what its write returned.
    await service.cancelNotification(id);
    expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));
    expect(primary.tokenOf(id)).toMatch(/^primary-/);
  });

  it('copies the primary token through every write of a send', async () => {
    const primary = tokenBackend('primary');
    const replica = tokenBackend('replica');
    const service = makeService(primary.backend, [replica.backend]);
    const { id } = await service.createNotification(notificationInput);

    const notification = await primary.backend.getNotification(id, false);
    await service.send(notification as never);

    expect(primary.backend.markAsSent).toHaveBeenCalled();
    expect(primary.backend.storeAdapterAndContextUsed).toHaveBeenCalled();
    expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));
  });

  it('copies the primary token when a notification is re-queued', async () => {
    const primary = tokenBackend('primary');
    const replica = tokenBackend('replica');
    const service = makeService(primary.backend, [replica.backend]);
    const { id } = await service.createNotification(notificationInput);
    await primary.backend.markAsFailed(id, false);
    const failedVersion = primary.tokenOf(id);

    await service.requeueNotification(id, { expectedVersion: failedVersion, send: false });

    expect(primary.tokenOf(id)).not.toBe(failedVersion);
    expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));
    // The check belongs to the primary; the replica only stores the outcome.
    expect(replica.backend.requeueNotification).toHaveBeenCalledWith(id, {
      notificationVersion: primary.tokenOf(id),
    });
  });

  it('reads the tokens a bulk create generated back from the primary, in order', async () => {
    const primary = tokenBackend('primary');
    const replica = tokenBackend('replica');
    const service = makeService(primary.backend, [replica.backend]);

    const ids = await service.bulkPersistNotifications([
      notificationInput,
      { ...notificationInput, userId: 'user-2' },
    ] as never);

    expect(ids).toHaveLength(2);
    for (const id of ids) {
      expect(primary.tokenOf(id)).toMatch(/^primary-/);
      expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));
    }
  });

  it('copies the primary token when a notification is replicated from a snapshot', async () => {
    const primary = tokenBackend('primary');
    const replica = tokenBackend('replica');
    const service = makeService(primary.backend, []);
    const { id } = await service.createNotification(notificationInput);
    await primary.backend.persistNotificationUpdate(id, { title: 'Changed on the primary' });

    const withReplica = makeService(primary.backend, [replica.backend]);
    await withReplica.replicateNotification(id);

    expect(replica.tokenOf(id)).toBe(primary.tokenOf(id));
  });
});
