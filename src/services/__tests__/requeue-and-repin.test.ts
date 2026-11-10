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
 * A backend whose `requeueNotification` behaves like a real one: refuses the wrong status, clears
 * `sentAt`, and applies `sendAfter` only when the key is present.
 */
function makeBackend(
  stored: DatabaseNotification<any> | null = makeNotification(),
  overrides: Partial<AnyBackend> = {},
): AnyBackend {
  return {
    getNotification: vi.fn().mockResolvedValue(stored),
    getOneOffNotification: vi.fn().mockResolvedValue(null),
    persistNotificationUpdate: vi
      .fn()
      .mockImplementation(async (_id: unknown, update: object) => ({ ...stored, ...update })),
    persistOneOffNotificationUpdate: vi
      .fn()
      .mockImplementation(async (_id: unknown, update: object) => ({ ...stored, ...update })),
    requeueNotification: vi
      .fn()
      .mockImplementation(async (_id: unknown, options: { sendAfter?: Date | null }) => ({
        ...stored,
        status: 'PENDING_SEND',
        sentAt: null,
        ...('sendAfter' in options ? { sendAfter: options.sendAfter } : {}),
      })),
    markAsSent: vi.fn().mockResolvedValue(makeNotification({ status: 'SENT' })),
    markAsFailed: vi.fn().mockResolvedValue(makeNotification({ status: 'FAILED' })),
    storeAdapterAndContextUsed: vi.fn().mockResolvedValue(undefined),
    getBackendIdentifier: () => 'primary',
    ...overrides,
  } as unknown as AnyBackend;
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
  } = {},
) {
  const backend = options.backend ?? makeBackend();
  const renderer = options.renderer ?? makeRenderer();
  const adapter = makeAdapter(renderer, options.enqueueNotifications);

  const service = new VintaSendFactory<any>().create({
    adapters: [adapter],
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
    expect(requeued).toMatchObject({ status: 'PENDING_SEND', sentAt: null });
    expect(adapter.send).toHaveBeenCalledTimes(1);
    expect(backend.markAsSent).toHaveBeenCalledWith('notification-1', true);
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
    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith('notification-1', {
      requestedTemplateVersion: 5,
    });
    expect(repinned.requestedTemplateVersion).toBe(5);
  });

  it('pins the version the caller names, without asking the renderer', async () => {
    const renderer = makeRenderer(5);
    const { service, backend } = makeService({ renderer });

    await service.repinNotification('notification-1', { templateVersion: 3 });

    expect(renderer.getLatestTemplateVersion).not.toHaveBeenCalled();
    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith('notification-1', {
      requestedTemplateVersion: 3,
    });
  });

  it('pins a notification that was not pinned before', async () => {
    const { service, backend } = makeService({
      backend: makeBackend(makeNotification({ requestedTemplateVersion: null })),
    });

    await service.repinNotification('notification-1');

    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith('notification-1', {
      requestedTemplateVersion: 5,
    });
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

    expect(backend.persistOneOffNotificationUpdate).toHaveBeenCalledWith('notification-1', {
      requestedTemplateVersion: 5,
    });
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

    expect(backend.persistNotificationUpdate).toHaveBeenCalledWith('notification-1', {
      requestedTemplateVersion: 0,
    });
  });

  it('replicates the new pin to additional backends', async () => {
    const additional = makeBackend(makeNotification(), {
      getBackendIdentifier: () => 'replica',
    });
    const { service } = makeService({ additionalBackends: [additional] });

    await service.repinNotification('notification-1');

    expect(additional.persistNotificationUpdate).toHaveBeenCalledWith('notification-1', {
      requestedTemplateVersion: 5,
    });
  });
});

describe('isNotificationActionError', () => {
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
