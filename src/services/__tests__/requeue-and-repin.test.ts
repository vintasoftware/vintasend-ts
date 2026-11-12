/**
 * `requeueNotification` and `repinNotification`, through the service.
 *
 * Both act on a notification that already exists, so the rules are about which states allow them
 * and what each leaves alone: a re-queue changes the status and may send, a re-pin changes the
 * template version and never sends.
 */

import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';

import { isNotificationActionError, NotificationActionError, VintaSendFactory } from '../../index';
import type { DatabaseNotification } from '../../types/notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationQueueService } from '../notification-queue-service/base-notification-queue-service';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';

type AnyBackend = Mocked<BaseNotificationBackend<any>>;

const PAST = new Date('2000-01-01T00:00:00Z');
const FUTURE = new Date('2999-01-01T00:00:00Z');

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    id: 'notification-1',
    userId: 'user-1',
    notificationType: 'EMAIL',
    title: 'Hi',
    bodyTemplate: 'welcome',
    contextName: 'testContext',
    contextParameters: {},
    sendAfter: null,
    subjectTemplate: null,
    status: 'FAILED',
    contextUsed: null,
    extraParams: null,
    tenant: null,
    adapterUsed: null,
    sentAt: PAST,
    readAt: null,
    gitCommitSha: null,
    requestedTemplateVersion: 2,
    ...overrides,
  } as unknown as DatabaseNotification<any>;
}

function makeOneOff(overrides: Record<string, unknown> = {}) {
  const { userId: _userId, ...rest } = makeNotification(overrides) as unknown as Record<
    string,
    unknown
  >;
  return {
    ...rest,
    emailOrPhone: 'someone@example.com',
    firstName: 'Ana',
    lastName: 'Silva',
  } as unknown as DatabaseNotification<any>;
}

/**
 * A backend that keeps one notification and behaves like a real one: `requeueNotification` clears
 * `sentAt` and applies `sendAfter` only when the key is present, and `markAsSent` /
 * `markAsFailed` move the stored status, so a read after a send sees its outcome.
 *
 * It implements none of the optional actions; `makeConditionalBackend` adds them.
 */
function makeBackend(
  stored: DatabaseNotification<any> | null = makeNotification(),
  overrides: Partial<AnyBackend> = {},
): AnyBackend {
  let current: DatabaseNotification<any> | null = stored === null ? null : { ...stored };
  const write = (patch: object) => {
    current = { ...(current as DatabaseNotification<any>), ...patch };
    return { ...current };
  };
  return {
    getNotification: vi.fn().mockImplementation(async () => (current ? { ...current } : null)),
    getOneOffNotification: vi.fn().mockResolvedValue(null),
    persistNotificationUpdate: vi
      .fn()
      .mockImplementation(async (_id: unknown, update: object) => write(update)),
    persistOneOffNotificationUpdate: vi
      .fn()
      .mockImplementation(async (_id: unknown, update: object) => write(update)),
    requeueNotification: vi
      .fn()
      .mockImplementation(async (_id: unknown, options: { sendAfter?: Date | null }) =>
        write({
          status: 'PENDING_SEND',
          sentAt: null,
          ...('sendAfter' in options ? { sendAfter: options.sendAfter } : {}),
        }),
      ),
    markAsSent: vi.fn().mockImplementation(async () => write({ status: 'SENT', sentAt: PAST })),
    markAsFailed: vi.fn().mockImplementation(async () => write({ status: 'FAILED', sentAt: PAST })),
    storeAdapterAndContextUsed: vi.fn().mockResolvedValue(undefined),
    getBackendIdentifier: () => 'primary',
    ...overrides,
  } as unknown as AnyBackend;
}

/**
 * `makeBackend` plus the optional actions, with a version token that every write bumps, the way
 * `vintasend-medplum` uses `meta.versionId`. A write given a stale `expectedVersion` throws
 * `CHANGED` and writes nothing.
 */
function makeConditionalBackend(
  stored: DatabaseNotification<any> = makeNotification(),
  overrides: Partial<AnyBackend> = {},
): AnyBackend & { version: () => string } {
  const base = makeBackend(stored);
  let version = 1;
  const bump = <T>(result: T): T => {
    version += 1;
    return result;
  };
  const check = (action: 'requeue' | 'repin', id: unknown, expectedVersion?: string) => {
    if (expectedVersion !== undefined && expectedVersion !== String(version)) {
      throw new NotificationActionError({
        action,
        reason: 'CHANGED',
        notificationId: id,
        message: `Notification ${String(id)} changed`,
      });
    }
  };
  const persistNotificationUpdate = base.persistNotificationUpdate;
  const requeue = base.requeueNotification;
  const markAsSent = base.markAsSent;
  const markAsFailed = base.markAsFailed;
  return {
    ...base,
    persistNotificationUpdate: vi
      .fn()
      .mockImplementation(async (...args: [any, any]) =>
        bump(await persistNotificationUpdate(...args)),
      ),
    markAsSent: vi
      .fn()
      .mockImplementation(async (...args: [any, any]) => bump(await markAsSent(...args))),
    markAsFailed: vi
      .fn()
      .mockImplementation(async (...args: [any, any]) => bump(await markAsFailed(...args))),
    requeueNotification: vi
      .fn()
      .mockImplementation(
        async (
          id: unknown,
          options: { sendAfter?: Date | null; templateVersion?: number; expectedVersion?: string },
        ) => {
          check('requeue', id, options.expectedVersion);
          const { templateVersion, expectedVersion: _expected, ...rest } = options;
          if (templateVersion !== undefined) {
            await persistNotificationUpdate(id, { requestedTemplateVersion: templateVersion });
          }
          return bump(await requeue(id, rest));
        },
      ),
    repinNotification: vi
      .fn()
      .mockImplementation(
        async (id: unknown, templateVersion: number, options: { expectedVersion?: string }) => {
          check('repin', id, options.expectedVersion);
          return bump(
            await persistNotificationUpdate(id, { requestedTemplateVersion: templateVersion }),
          );
        },
      ),
    filterNotificationVersions: vi
      .fn()
      .mockImplementation(async () => [{ id: 'notification-1', version: String(version) }]),
    getActionCapabilities: () => ({
      'repin.expectedVersion': true,
      'requeue.expectedVersion': true,
      'requeue.templateVersion': true,
      'versions.filter': true,
    }),
    version: () => String(version),
    ...overrides,
  } as unknown as AnyBackend & { version: () => string };
}

function makeRenderer(latest: number | null = 5) {
  return {
    logger: null,
    render: vi.fn(),
    renderFromTemplateContent: vi.fn(),
    injectLogger: vi.fn(),
    getLatestTemplateVersion: vi.fn().mockResolvedValue(latest),
  } as unknown as Mocked<BaseEmailTemplateRenderer<any>>;
}

function makeAdapter(
  renderer: Mocked<BaseEmailTemplateRenderer<any>>,
  enqueueNotifications = false,
): Mocked<BaseNotificationAdapter<any, any>> {
  return {
    notificationType: 'EMAIL',
    key: 'test-adapter',
    enqueueNotifications,
    send: vi.fn().mockResolvedValue(undefined),
    injectBackend: vi.fn(),
    injectLogger: vi.fn(),
    getTemplateRenderer: () => renderer,
    supportsAttachments: false,
  } as unknown as Mocked<BaseNotificationAdapter<any, any>>;
}

const logger: Mocked<BaseLogger> = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

function makeService(
  options: {
    backend?: AnyBackend;
    additionalBackends?: AnyBackend[];
    renderer?: Mocked<BaseEmailTemplateRenderer<any>>;
    enqueueNotifications?: boolean;
    queueService?: Mocked<BaseNotificationQueueService<any>>;
    /** Build the service with no adapter at all, as a process that only re-queues would. */
    withoutAdapters?: boolean;
  } = {},
) {
  const backend = options.backend ?? makeBackend();
  const renderer = options.renderer ?? makeRenderer();
  const adapter = makeAdapter(renderer, options.enqueueNotifications);

  const service = new VintaSendFactory<any>().create({
    adapters: options.withoutAdapters ? [] : [adapter],
    backend,
    ...(options.additionalBackends ? { additionalBackends: options.additionalBackends } : {}),
    ...(options.queueService ? { queueService: options.queueService } : {}),
    logger,
    contextGeneratorsMap: { testContext: { generate: async () => ({}) } },
    options: { raiseErrorOnFailedSend: false },
  });

  return { service, backend, renderer, adapter };
}

async function expectActionError(promise: Promise<unknown>, reason: string) {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to throw');
    },
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(NotificationActionError);
  expect((error as NotificationActionError).reason).toBe(reason);
  return error as NotificationActionError;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requeueNotification', () => {
  it('puts a failed notification back to pending and sends it when it is due', async () => {
    const { service, backend, adapter } = makeService();

    const requeued = await service.requeueNotification('notification-1');

    expect(backend.requeueNotification).toHaveBeenCalledWith('notification-1', {});
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(backend.markAsSent).toHaveBeenCalledWith('notification-1', true);
    // The notification as it stands after the send, not as the requeue left it.
    expect(requeued).toMatchObject({ status: 'SENT' });
  });

  it('requeues a cancelled notification too', async () => {
    const { service, backend } = makeService({
      backend: makeBackend(makeNotification({ status: 'CANCELLED', sentAt: null })),
    });

    await service.requeueNotification('notification-1');

    expect(backend.requeueNotification).toHaveBeenCalledTimes(1);
  });

  it('sends right away when the kept sendAfter is in the past', async () => {
    const { service, adapter } = makeService({
      backend: makeBackend(makeNotification({ sendAfter: PAST })),
    });

    await service.requeueNotification('notification-1');

    expect(adapter.send).toHaveBeenCalledTimes(1);
  });

  it('leaves a notification with a future sendAfter pending without sending', async () => {
    const { service, backend, adapter } = makeService();

    const requeued = await service.requeueNotification('notification-1', { sendAfter: FUTURE });

    expect(backend.requeueNotification).toHaveBeenCalledWith('notification-1', {
      sendAfter: FUTURE,
    });
    expect(requeued.sendAfter).toEqual(FUTURE);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('passes an explicit null sendAfter through, meaning now', async () => {
    const { service, backend, adapter } = makeService({
      backend: makeBackend(makeNotification({ sendAfter: FUTURE })),
    });

    await service.requeueNotification('notification-1', { sendAfter: null });

    expect(backend.requeueNotification).toHaveBeenCalledWith('notification-1', {
      sendAfter: null,
    });
    expect(adapter.send).toHaveBeenCalledTimes(1);
  });

  it('puts the notification back on the queue for an adapter that enqueues', async () => {
    const queueService = { enqueueNotification: vi.fn().mockResolvedValue(undefined) };
    const { service, adapter } = makeService({ enqueueNotifications: true, queueService });

    await service.requeueNotification('notification-1');

    expect(queueService.enqueueNotification).toHaveBeenCalledWith('notification-1');
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('does not touch the template pin', async () => {
    const { service, backend } = makeService();

    const requeued = await service.requeueNotification('notification-1');

    expect(backend.persistNotificationUpdate).not.toHaveBeenCalledWith(
      'notification-1',
      expect.objectContaining({ requestedTemplateVersion: expect.anything() }),
    );
    expect(requeued.requestedTemplateVersion).toBe(2);
  });

  it('finds a one-off notification the primary backend only returns as one-off', async () => {
    const oneOff = makeOneOff();
    const backend = makeBackend(oneOff, {
      getNotification: vi.fn().mockResolvedValue(null),
      getOneOffNotification: vi.fn().mockResolvedValue(oneOff),
    });
    const { service } = makeService({ backend });

    await service.requeueNotification('notification-1');

    expect(backend.requeueNotification).toHaveBeenCalledWith('notification-1', {});
  });

  it.each(['PENDING_SEND', 'SENT', 'READ'])('refuses a notification in %s', async (status) => {
    const { service, backend, adapter } = makeService({
      backend: makeBackend(makeNotification({ status })),
    });

    const error = await expectActionError(
      service.requeueNotification('notification-1'),
      'INVALID_STATUS',
    );

    expect(error.status).toBe(status);
    expect(error.action).toBe('requeue');
    expect(backend.requeueNotification).not.toHaveBeenCalled();
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('refuses a notification that does not exist', async () => {
    const { service } = makeService({ backend: makeBackend(null) });

    await expectActionError(service.requeueNotification('missing'), 'NOT_FOUND');
  });

  it('replicates the requeue to additional backends', async () => {
    const additional = makeBackend(makeNotification(), {
      getBackendIdentifier: () => 'replica',
    });
    const { service } = makeService({
      additionalBackends: [additional],
    });

    await service.requeueNotification('notification-1', { sendAfter: FUTURE });

    expect(additional.requeueNotification).toHaveBeenCalledWith('notification-1', {
      sendAfter: FUTURE,
    });
  });

  it('keeps the primary requeue when an additional backend fails to requeue', async () => {
    const additional = makeBackend(makeNotification(), {
      getBackendIdentifier: () => 'replica',
      requeueNotification: vi.fn().mockRejectedValue(new Error('replica refused')),
    });
    const { service } = makeService({ additionalBackends: [additional] });

    const requeued = await service.requeueNotification('notification-1', { sendAfter: FUTURE });

    expect(requeued.status).toBe('PENDING_SEND');
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('repinNotification', () => {
  it('pins to the version the renderer reports as current', async () => {
    const renderer = makeRenderer(5);
    const { service, backend } = makeService({ renderer });

    const repinned = await service.repinNotification('notification-1');

    expect(renderer.getLatestTemplateVersion).toHaveBeenCalledWith('welcome');
    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 5,
      },
      {},
    );
    expect(repinned.requestedTemplateVersion).toBe(5);
  });

  it('pins the version the caller names, without asking the renderer', async () => {
    const renderer = makeRenderer(5);
    const { service, backend } = makeService({ renderer });

    await service.repinNotification('notification-1', { templateVersion: 3 });

    expect(renderer.getLatestTemplateVersion).not.toHaveBeenCalled();
    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 3,
      },
      {},
    );
  });

  it('pins a notification that was not pinned before', async () => {
    const { service, backend } = makeService({
      backend: makeBackend(makeNotification({ requestedTemplateVersion: null })),
    });

    await service.repinNotification('notification-1');

    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 5,
      },
      {},
    );
  });

  it('writes nothing when the notification is already on that version', async () => {
    const { service, backend } = makeService({
      backend: makeBackend(makeNotification({ requestedTemplateVersion: 5 })),
    });

    const repinned = await service.repinNotification('notification-1');

    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
    expect(repinned.requestedTemplateVersion).toBe(5);
  });

  it('neither sends nor changes the status', async () => {
    const { service, backend, adapter } = makeService();

    const repinned = await service.repinNotification('notification-1');

    expect(adapter.send).not.toHaveBeenCalled();
    expect(backend.requeueNotification).not.toHaveBeenCalled();
    expect(repinned.status).toBe('FAILED');
  });

  it('updates a one-off notification through the one-off update', async () => {
    const { service, backend } = makeService({ backend: makeBackend(makeOneOff()) });

    await service.repinNotification('notification-1');

    expect(backend.persistOneOffNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 5,
      },
      {},
    );
    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
  });

  it.each(['PENDING_SEND', 'FAILED', 'CANCELLED'])(
    'repins a notification in %s',
    async (status) => {
      const { service, backend } = makeService({
        backend: makeBackend(makeNotification({ status })),
      });

      await service.repinNotification('notification-1');

      expect(backend.persistNotificationUpdate).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['SENT', 'READ'])('refuses a notification in %s', async (status) => {
    const { service, backend } = makeService({
      backend: makeBackend(makeNotification({ status })),
    });

    const error = await expectActionError(
      service.repinNotification('notification-1'),
      'INVALID_STATUS',
    );

    expect(error.action).toBe('repin');
    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
  });

  it('refuses when the renderer does not version templates', async () => {
    const { service, backend } = makeService({ renderer: makeRenderer(null) });

    await expectActionError(service.repinNotification('notification-1'), 'NO_TEMPLATE_VERSION');
    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
  });

  it('refuses when the renderer throws, and logs it', async () => {
    const renderer = makeRenderer(5);
    renderer.getLatestTemplateVersion = vi.fn().mockRejectedValue(new Error('boom'));
    const { service } = makeService({ renderer });

    await expectActionError(service.repinNotification('notification-1'), 'NO_TEMPLATE_VERSION');
    expect(logger.error).toHaveBeenCalled();
  });

  it('refuses a notification that does not exist', async () => {
    const { service } = makeService({ backend: makeBackend(null) });

    await expectActionError(service.repinNotification('missing'), 'NOT_FOUND');
  });

  it.each([-1, 1.5, Number.NaN])('rejects templateVersion %s', async (templateVersion) => {
    const { service, backend } = makeService();

    await expect(service.repinNotification('notification-1', { templateVersion })).rejects.toThrow(
      RangeError,
    );
    expect(backend.getNotification).not.toHaveBeenCalled();
  });

  it('accepts version 0', async () => {
    const { service, backend } = makeService();

    await service.repinNotification('notification-1', { templateVersion: 0 });

    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 0,
      },
      {},
    );
  });

  it('replicates the new pin to additional backends', async () => {
    const additional = makeBackend(makeNotification(), {
      getBackendIdentifier: () => 'replica',
    });
    const { service } = makeService({ additionalBackends: [additional] });

    await service.repinNotification('notification-1');

    expect(additional.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 5,
      },
      {},
    );
  });
});

/** Nothing was written to `backend` by any write method. */
function expectNothingWritten(backend: AnyBackend) {
  expect(backend.requeueNotification).not.toHaveBeenCalled();
  expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
  expect(backend.persistOneOffNotificationUpdate).not.toHaveBeenCalled();
  expect(backend.markAsSent).not.toHaveBeenCalled();
  expect(backend.markAsFailed).not.toHaveBeenCalled();
  if (backend.repinNotification) {
    expect(backend.repinNotification).not.toHaveBeenCalled();
  }
}

describe('requeueNotification outcome', () => {
  it('returns FAILED when the adapter fails, with raiseErrorOnFailedSend false', async () => {
    const { service, adapter } = makeService();
    adapter.send.mockRejectedValue(new Error('smtp down'));

    const requeued = await service.requeueNotification('notification-1');

    expect(requeued.status).toBe('FAILED');
  });

  it('returns PENDING_SEND for a notification scheduled for later', async () => {
    const { service } = makeService();

    const requeued = await service.requeueNotification('notification-1', { sendAfter: FUTURE });

    expect(requeued.status).toBe('PENDING_SEND');
  });

  it('returns PENDING_SEND for a notification handed to the queue service', async () => {
    const queueService = { enqueueNotification: vi.fn().mockResolvedValue(undefined) };
    const { service } = makeService({ enqueueNotifications: true, queueService });

    const requeued = await service.requeueNotification('notification-1');

    expect(queueService.enqueueNotification).toHaveBeenCalledWith('notification-1');
    expect(requeued.status).toBe('PENDING_SEND');
  });
});

describe('requeueNotification with send: false', () => {
  it('leaves a due notification pending without sending it', async () => {
    const { service, backend, adapter } = makeService();

    const requeued = await service.requeueNotification('notification-1', {
      sendAfter: null,
      send: false,
    });

    expect(backend.requeueNotification).toHaveBeenCalledWith('notification-1', {
      sendAfter: null,
    });
    expect(adapter.send).not.toHaveBeenCalled();
    expect(backend.markAsSent).not.toHaveBeenCalled();
    expect(requeued.status).toBe('PENDING_SEND');
  });

  it('works on a service built with no adapter at all', async () => {
    const { service, backend } = makeService({ withoutAdapters: true });

    const requeued = await service.requeueNotification('notification-1', { send: false });

    expect(backend.requeueNotification).toHaveBeenCalledTimes(1);
    expect(requeued.status).toBe('PENDING_SEND');
  });

  it('re-pins and re-queues in one write on a service with no adapter', async () => {
    const backend = makeConditionalBackend();
    const { service } = makeService({ backend, withoutAdapters: true });

    const requeued = await service.requeueNotification('notification-1', {
      templateVersion: 7,
      send: false,
    });

    expect(requeued).toMatchObject({ status: 'PENDING_SEND', requestedTemplateVersion: 7 });
  });
});

describe('requeueNotification with templateVersion', () => {
  it('pins and re-queues in one backend write, then sends', async () => {
    const backend = makeConditionalBackend();
    const { service, adapter } = makeService({ backend });

    const requeued = await service.requeueNotification('notification-1', { templateVersion: 7 });

    expect(backend.requeueNotification).toHaveBeenCalledTimes(1);
    expect(backend.requeueNotification).toHaveBeenCalledWith('notification-1', {
      templateVersion: 7,
    });
    expect(backend.repinNotification).not.toHaveBeenCalled();
    expect(adapter.send).toHaveBeenCalledWith(
      expect.objectContaining({ requestedTemplateVersion: 7, status: 'PENDING_SEND' }),
      expect.anything(),
    );
    expect(requeued).toMatchObject({ status: 'SENT', requestedTemplateVersion: 7 });
  });

  it('keeps the send time unless one is given', async () => {
    const backend = makeConditionalBackend(makeNotification({ sendAfter: FUTURE }));
    const { service, adapter } = makeService({ backend });

    const requeued = await service.requeueNotification('notification-1', { templateVersion: 7 });

    expect(requeued.sendAfter).toEqual(FUTURE);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it('refuses a backend that cannot pin in the same write, writing nothing', async () => {
    const { service, backend, adapter } = makeService();

    await expectActionError(
      service.requeueNotification('notification-1', { templateVersion: 7 }),
      'UNSUPPORTED',
    );

    expectNothingWritten(backend);
    expect(adapter.send).not.toHaveBeenCalled();
  });

  it.each(['PENDING_SEND', 'SENT', 'READ'])(
    'refuses a notification in %s, writing nothing',
    async (status) => {
      const backend = makeConditionalBackend(makeNotification({ status }));
      const { service } = makeService({ backend });

      await expectActionError(
        service.requeueNotification('notification-1', { templateVersion: 7 }),
        'INVALID_STATUS',
      );

      expectNothingWritten(backend);
    },
  );

  it.each([-1, 1.5])('rejects templateVersion %s before reading', async (templateVersion) => {
    const backend = makeConditionalBackend();
    const { service } = makeService({ backend });

    await expect(
      service.requeueNotification('notification-1', { templateVersion }),
    ).rejects.toThrow(RangeError);
    expect(backend.getNotification).not.toHaveBeenCalled();
    expectNothingWritten(backend);
  });

  it('pins a replica that cannot pin in the same write with an update, then re-queues it', async () => {
    const replica = makeBackend(makeNotification(), { getBackendIdentifier: () => 'replica' });
    const { service } = makeService({
      backend: makeConditionalBackend(),
      additionalBackends: [replica],
    });

    await service.requeueNotification('notification-1', { templateVersion: 7 });

    expect(replica.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 7,
      },
      {},
    );
    expect(replica.requeueNotification).toHaveBeenCalledWith('notification-1', {});
  });

  it('pins a capable replica in its own single write, without the version token', async () => {
    const replica = makeConditionalBackend(makeNotification(), {
      getBackendIdentifier: () => 'replica',
    });
    const primary = makeConditionalBackend();
    const { service } = makeService({ backend: primary, additionalBackends: [replica] });

    await service.requeueNotification('notification-1', {
      templateVersion: 7,
      expectedVersion: primary.version(),
      sendAfter: FUTURE,
    });

    expect(replica.requeueNotification).toHaveBeenCalledWith('notification-1', {
      sendAfter: FUTURE,
      templateVersion: 7,
    });
  });
});

describe('requeueNotification with expectedVersion', () => {
  it('re-queues when the notification is still at that version', async () => {
    const backend = makeConditionalBackend();
    const { service } = makeService({ backend });

    const requeued = await service.requeueNotification('notification-1', {
      expectedVersion: backend.version(),
      templateVersion: 7,
    });

    expect(requeued).toMatchObject({ status: 'SENT', requestedTemplateVersion: 7 });
  });

  it('refuses CHANGED when the notification moved on, writing and sending nothing', async () => {
    const backend = makeConditionalBackend();
    const replica = makeBackend(makeNotification(), { getBackendIdentifier: () => 'replica' });
    const { service, adapter } = makeService({ backend, additionalBackends: [replica] });
    const listed = backend.version();
    await service.repinNotification('notification-1', { templateVersion: 3 });
    vi.clearAllMocks();

    const error = await expectActionError(
      service.requeueNotification('notification-1', {
        expectedVersion: listed,
        templateVersion: 7,
      }),
      'CHANGED',
    );

    expect(error.action).toBe('requeue');
    expect((await backend.getNotification('notification-1', false))?.status).toBe('FAILED');
    expect(adapter.send).not.toHaveBeenCalled();
    expectNothingWritten(replica);
  });

  it('refuses a backend that cannot check versions, writing nothing', async () => {
    const { service, backend } = makeService();

    await expectActionError(
      service.requeueNotification('notification-1', { expectedVersion: '1' }),
      'UNSUPPORTED',
    );

    expectNothingWritten(backend);
  });
});

describe('repinNotification with expectedVersion', () => {
  it('passes the version to the backend, which checks it', async () => {
    const backend = makeConditionalBackend();
    const { service } = makeService({ backend });

    const repinned = await service.repinNotification('notification-1', {
      templateVersion: 7,
      expectedVersion: backend.version(),
    });

    expect(backend.repinNotification).toHaveBeenCalledWith('notification-1', 7, {
      expectedVersion: '1',
    });
    expect(repinned.requestedTemplateVersion).toBe(7);
  });

  it('refuses CHANGED when the notification moved on, writing nothing', async () => {
    const backend = makeConditionalBackend();
    const { service } = makeService({ backend });
    const listed = backend.version();
    await service.requeueNotification('notification-1', { sendAfter: FUTURE });
    const before = await backend.getNotification('notification-1', false);
    vi.clearAllMocks();

    await expectActionError(
      service.repinNotification('notification-1', { templateVersion: 7, expectedVersion: listed }),
      'CHANGED',
    );

    expect(await backend.getNotification('notification-1', false)).toEqual(before);
    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
  });

  it('asks the backend even when the pin already matches, so a change is still caught', async () => {
    const backend = makeConditionalBackend(makeNotification({ requestedTemplateVersion: 7 }));
    const { service } = makeService({ backend });

    await expectActionError(
      service.repinNotification('notification-1', { templateVersion: 7, expectedVersion: 'old' }),
      'CHANGED',
    );
  });

  it('refuses a backend without repinNotification, writing nothing', async () => {
    const backend = makeBackend(makeNotification(), {
      getActionCapabilities: () => ({ 'repin.expectedVersion': true }),
    });
    const { service } = makeService({ backend });

    await expectActionError(
      service.repinNotification('notification-1', { expectedVersion: '1' }),
      'UNSUPPORTED',
    );

    expectNothingWritten(backend);
  });

  it('refuses a backend that does not report the capability, writing nothing', async () => {
    const backend = makeConditionalBackend(makeNotification(), {
      getActionCapabilities: () => ({}),
    });
    const { service } = makeService({ backend });

    await expectActionError(
      service.repinNotification('notification-1', { expectedVersion: backend.version() }),
      'UNSUPPORTED',
    );

    expectNothingWritten(backend);
  });

  it('uses the backend repin without a version too, and replicates through an update', async () => {
    const backend = makeConditionalBackend();
    const replica = makeBackend(makeNotification(), { getBackendIdentifier: () => 'replica' });
    const { service } = makeService({ backend, additionalBackends: [replica] });

    await service.repinNotification('notification-1');

    expect(backend.repinNotification).toHaveBeenCalledWith('notification-1', 5, {});
    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
    expect(replica.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 5,
      },
      {},
    );
  });
});

describe('getCurrentTemplateVersion', () => {
  it('answers what the renderer reports, and repin pins exactly that', async () => {
    const renderer = makeRenderer(9);
    const { service, backend } = makeService({ renderer });

    expect(await service.getCurrentTemplateVersion('EMAIL', 'welcome')).toBe(9);
    const spy = vi.spyOn(service, 'getCurrentTemplateVersion');
    await service.repinNotification('notification-1');

    expect(spy).toHaveBeenCalledWith('EMAIL', 'welcome');
    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith(
      'notification-1',
      {
        requestedTemplateVersion: 9,
      },
      {},
    );
  });

  it('answers null for a type no adapter handles', async () => {
    const { service } = makeService();

    expect(await service.getCurrentTemplateVersion('SMS', 'welcome')).toBeNull();
  });
});

describe('filterNotificationVersions', () => {
  it('passes the filter through and returns IDs and versions only', async () => {
    const backend = makeConditionalBackend();
    const { service } = makeService({ backend });
    const filter = { or: [{ status: 'FAILED' as const }, { hasSendAfter: true }] };

    const page = await service.filterNotificationVersions(filter, 0, 50);

    expect(backend.filterNotificationVersions).toHaveBeenCalledWith(filter, 0, 50);
    expect(page).toEqual([{ id: 'notification-1', version: '1' }]);
    expect(backend.getNotification).not.toHaveBeenCalled();
  });

  it('throws for a backend that does not implement it', async () => {
    const { service } = makeService();

    await expect(service.filterNotificationVersions({}, 0, 50)).rejects.toThrow(
      'does not support filterNotificationVersions',
    );
  });
});

describe('getBackendSupportedActionCapabilities', () => {
  it('defaults every key to false', async () => {
    const { service } = makeService();

    expect(await service.getBackendSupportedActionCapabilities()).toEqual({
      'repin.expectedVersion': false,
      'requeue.expectedVersion': false,
      'requeue.templateVersion': false,
      'versions.filter': false,
      'repin.bulk': false,
      'requeue.bulk': false,
    });
  });

  it('reports what a capable backend reports', async () => {
    const { service } = makeService({ backend: makeConditionalBackend() });

    const capabilities = await service.getBackendSupportedActionCapabilities();

    // The bulk actions are covered in bulk-actions.test.ts; this backend implements the rest.
    expect(capabilities).toEqual({
      'repin.expectedVersion': true,
      'requeue.expectedVersion': true,
      'requeue.templateVersion': true,
      'versions.filter': true,
      'repin.bulk': false,
      'requeue.bulk': false,
    });
  });

  it('reads a claimed capability as false when its method is missing', async () => {
    const backend = makeBackend(makeNotification(), {
      getActionCapabilities: () => ({ 'repin.expectedVersion': true, 'versions.filter': true }),
    });
    const { service } = makeService({ backend });

    const capabilities = await service.getBackendSupportedActionCapabilities();

    expect(capabilities['repin.expectedVersion']).toBe(false);
    expect(capabilities['versions.filter']).toBe(false);
  });
});

describe('isNotificationActionError', () => {
  it.each(['CHANGED', 'UNSUPPORTED'])('recognises the %s reason across copies', (reason) => {
    const foreign = Object.assign(new Error('nope'), { name: 'NotificationActionError', reason });

    expect(isNotificationActionError(foreign)).toBe(true);
  });

  it('recognises an error from another copy of the package by its shape', () => {
    const foreign = Object.assign(new Error('nope'), {
      name: 'NotificationActionError',
      reason: 'INVALID_STATUS',
    });

    expect(isNotificationActionError(foreign)).toBe(true);
  });

  it('rejects other errors', () => {
    expect(isNotificationActionError(new Error('nope'))).toBe(false);
    expect(isNotificationActionError({ name: 'NotificationActionError', reason: 'OTHER' })).toBe(
      false,
    );
    expect(isNotificationActionError(null)).toBe(false);
  });
});
