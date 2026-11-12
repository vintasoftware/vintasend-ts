/**
 * `repinNotifications` and `requeueNotifications`, through the service: what reaches the primary
 * backend, what is refused before anything is written, and how each written target reaches the
 * additional backends.
 */
import { describe, expect, it, vi } from 'vitest';
import { VintaSendFactory } from '../../index';
import type { BaseLogger } from '../loggers/base-logger';
import type {
  BaseNotificationBackend,
  BulkNotificationActionResult,
  NotificationVersion,
} from '../notification-backends/base-notification-backend';

type Config = {
  ContextMap: { testContext: { generate: () => Promise<Record<string, never>> } };
  NotificationIdType: string;
  UserIdType: string;
};
type Backend = BaseNotificationBackend<Config>;

const FUTURE = new Date('2999-01-01T00:00:00Z');
const V = 3;

const logger: BaseLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const TARGETS: NotificationVersion<Config>[] = [
  { id: 'a', version: 'a-1' },
  { id: 'b', version: 'b-1' },
];

/** What the primary reports: `a` written, `b` changed since it was listed. */
const RESULTS: BulkNotificationActionResult<Config>[] = [
  { id: 'a', outcome: 'WRITTEN', version: 'a-2' },
  { id: 'b', outcome: 'CHANGED' },
];

function primaryBackend(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getBackendIdentifier: () => 'primary',
    getActionCapabilities: () => ({ 'repin.bulk': true, 'requeue.bulk': true }),
    repinNotifications: vi.fn(async () => RESULTS),
    requeueNotifications: vi.fn(async () => RESULTS),
    getNotification: vi.fn(),
    getOneOffNotification: vi.fn(),
    persistNotificationUpdate: vi.fn(),
    requeueNotification: vi.fn(),
    ...overrides,
  };
}

function replicaBackend(options: { pinsOnRequeue?: boolean } = {}) {
  const notification = { id: 'a', status: 'FAILED', notificationType: 'EMAIL' };
  return {
    getBackendIdentifier: () => 'replica',
    getActionCapabilities: () => ({ 'requeue.templateVersion': options.pinsOnRequeue === true }),
    getNotification: vi.fn(async () => notification),
    getOneOffNotification: vi.fn(async () => null),
    persistNotificationUpdate: vi.fn(async () => notification),
    persistOneOffNotificationUpdate: vi.fn(),
    requeueNotification: vi.fn(async () => notification),
  };
}

function makeService(primary: object, replicas: object[] = []) {
  return new VintaSendFactory<Config>().create({
    adapters: [],
    backend: primary as unknown as Backend,
    additionalBackends: replicas as unknown as Backend[],
    logger,
    contextGeneratorsMap: { testContext: { generate: async () => ({}) } },
  });
}

describe('repinNotifications', () => {
  it('hands the targets, version and filter to the primary and returns its results', async () => {
    const primary = primaryBackend();
    const filter = { bodyTemplate: 'welcome' };

    const results = await makeService(primary).repinNotifications(TARGETS, {
      templateVersion: V,
      filter,
    });

    expect(results).toEqual(RESULTS);
    expect(primary.repinNotifications).toHaveBeenCalledWith(TARGETS, V, { filter });
    expect(primary.getNotification).not.toHaveBeenCalled();
  });

  it('pins each written target on the replicas with the primary token, and nothing else', async () => {
    const replica = replicaBackend();

    await makeService(primaryBackend(), [replica]).repinNotifications(TARGETS, {
      templateVersion: V,
    });

    expect(replica.persistNotificationUpdate).toHaveBeenCalledTimes(1);
    expect(replica.persistNotificationUpdate).toHaveBeenCalledWith(
      'a',
      { requestedTemplateVersion: V },
      { notificationVersion: 'a-2' },
    );
  });

  it('is refused, before anything is written, by a backend without it', async () => {
    const primary = primaryBackend({ repinNotifications: undefined });
    const service = makeService(primary);

    await expect(service.repinNotifications(TARGETS, { templateVersion: V })).rejects.toThrow(
      'does not support repinNotifications',
    );
    expect((await service.getBackendSupportedActionCapabilities())['repin.bulk']).toBe(false);
  });

  it('refuses repeated IDs and a version that is not a non-negative integer', async () => {
    const primary = primaryBackend();
    const service = makeService(primary);

    await expect(
      service.repinNotifications([TARGETS[0], TARGETS[0]], { templateVersion: V }),
    ).rejects.toThrow('repeat a notification ID');
    await expect(service.repinNotifications(TARGETS, { templateVersion: 1.5 })).rejects.toThrow(
      RangeError,
    );
    expect(primary.repinNotifications).not.toHaveBeenCalled();
  });

  it('does nothing for no targets', async () => {
    const primary = primaryBackend();

    expect(await makeService(primary).repinNotifications([], { templateVersion: V })).toEqual([]);
    expect(primary.repinNotifications).not.toHaveBeenCalled();
  });
});

describe('requeueNotifications', () => {
  it('passes only the options given: an absent sendAfter is not a null one', async () => {
    const primary = primaryBackend();
    const service = makeService(primary);

    await service.requeueNotifications(TARGETS);
    await service.requeueNotifications(TARGETS, { sendAfter: null, templateVersion: V });

    expect(primary.requeueNotifications).toHaveBeenNthCalledWith(1, TARGETS, {});
    expect(primary.requeueNotifications).toHaveBeenNthCalledWith(2, TARGETS, {
      sendAfter: null,
      templateVersion: V,
    });
  });

  it('re-queues each written target on a replica that pins in the same write', async () => {
    const replica = replicaBackend({ pinsOnRequeue: true });

    await makeService(primaryBackend(), [replica]).requeueNotifications(TARGETS, {
      sendAfter: FUTURE,
      templateVersion: V,
    });

    expect(replica.requeueNotification).toHaveBeenCalledTimes(1);
    expect(replica.requeueNotification).toHaveBeenCalledWith('a', {
      sendAfter: FUTURE,
      templateVersion: V,
      notificationVersion: 'a-2',
    });
    expect(replica.persistNotificationUpdate).not.toHaveBeenCalled();
  });

  it('pins first, then re-queues, on a replica that cannot do both at once', async () => {
    const replica = replicaBackend({ pinsOnRequeue: false });

    await makeService(primaryBackend(), [replica]).requeueNotifications(TARGETS, {
      templateVersion: V,
    });

    expect(replica.persistNotificationUpdate).toHaveBeenCalledWith(
      'a',
      { requestedTemplateVersion: V },
      { notificationVersion: 'a-2' },
    );
    expect(replica.requeueNotification).toHaveBeenCalledWith('a', { notificationVersion: 'a-2' });
  });

  it('is refused by a backend that does not report it', async () => {
    const primary = primaryBackend({ getActionCapabilities: () => ({}) });

    await expect(makeService(primary).requeueNotifications(TARGETS)).rejects.toThrow(
      'does not support requeueNotifications',
    );
    expect(primary.requeueNotifications).not.toHaveBeenCalled();
  });
});
