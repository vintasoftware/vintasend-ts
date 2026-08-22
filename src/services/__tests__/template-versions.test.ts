/**
 * Template version pinning, end to end through the service.
 *
 * Two fields and one flag, and the rules between them are all about precedence:
 *
 * * `requestedTemplateVersion` is decided when a notification is created or repointed. An explicit
 *   value beats the per-call flag, which beats the service's own setting.
 * * `usedTemplateVersion` is written at send time from what the renderer reported, and nothing
 *   else may write it.
 * * `pinTemplateVersions` is never stored. It only decides what `requestedTemplateVersion` becomes
 *   at that moment.
 */

import { beforeEach, describe, expect, it, type Mocked, vi } from 'vitest';

import { VintaSendFactory } from '../../index';
import type { DatabaseNotification } from '../../types/notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';

type AnyBackend = Mocked<BaseNotificationBackend<any>>;

function makeNotification(overrides: Partial<DatabaseNotification<any>> = {}) {
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
    status: 'PENDING_SEND',
    contextUsed: null,
    extraParams: null,
    tenant: null,
    adapterUsed: null,
    sentAt: null,
    readAt: null,
    gitCommitSha: null,
    ...overrides,
  } as unknown as DatabaseNotification<any>;
}

function makeBackend(overrides: Partial<AnyBackend> = {}): AnyBackend {
  return {
    persistNotification: vi.fn().mockImplementation(async (n: any) => makeNotification(n)),
    persistNotificationUpdate: vi
      .fn()
      .mockImplementation(async (id: any, n: any) => makeNotification({ id, ...n })),
    persistOneOffNotification: vi.fn().mockImplementation(async (n: any) => makeNotification(n)),
    persistOneOffNotificationUpdate: vi
      .fn()
      .mockImplementation(async (id: any, n: any) => makeNotification({ id, ...n })),
    getNotification: vi.fn().mockResolvedValue(makeNotification()),
    getOneOffNotification: vi.fn().mockResolvedValue(null),
    markAsSent: vi.fn().mockResolvedValue(makeNotification({ status: 'SENT' })),
    markAsFailed: vi.fn().mockResolvedValue(makeNotification({ status: 'FAILED' })),
    storeAdapterAndContextUsed: vi.fn().mockResolvedValue(undefined),
    storeTemplateVersion: vi.fn().mockResolvedValue(undefined),
    getBackendIdentifier: () => 'primary',
    ...overrides,
  } as unknown as AnyBackend;
}

function makeRenderer(latest: number | null = null): Mocked<BaseEmailTemplateRenderer<any>> {
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
  sendResult: unknown = undefined,
): Mocked<BaseNotificationAdapter<any, any>> {
  return {
    notificationType: 'EMAIL',
    key: 'test-adapter',
    enqueueNotifications: false,
    send: vi.fn().mockResolvedValue(sendResult),
    injectBackend: vi.fn(),
    injectLogger: vi.fn(),
    getTemplateRenderer: () => renderer,
    supportsAttachments: false,
  } as unknown as Mocked<BaseNotificationAdapter<any, any>>;
}

const logger: Mocked<BaseLogger> = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };

function makeService(options: {
  backend?: AnyBackend;
  renderer?: Mocked<BaseEmailTemplateRenderer<any>>;
  sendResult?: unknown;
  pinTemplateVersions?: boolean;
  additionalBackends?: AnyBackend[];
}) {
  const backend = options.backend ?? makeBackend();
  const renderer = options.renderer ?? makeRenderer();
  const adapter = makeAdapter(renderer, options.sendResult);

  const service = new VintaSendFactory<any>().create({
    adapters: [adapter],
    backend,
    ...(options.additionalBackends ? { additionalBackends: options.additionalBackends } : {}),
    logger,
    contextGeneratorsMap: { testContext: { generate: async () => ({}) } },
    options: {
      raiseErrorOnFailedSend: false,
      ...(options.pinTemplateVersions === undefined
        ? {}
        : { pinTemplateVersions: options.pinTemplateVersions }),
    },
  });

  return { service, backend, renderer, adapter };
}

const CREATE_INPUT = {
  userId: 'user-1',
  notificationType: 'EMAIL' as const,
  title: 'Hi',
  bodyTemplate: 'welcome',
  contextName: 'testContext',
  contextParameters: {},
  sendAfter: new Date('2999-01-01'),
  subjectTemplate: null,
  extraParams: null,
};

const ONE_OFF_INPUT = {
  emailOrPhone: 'someone@example.com',
  firstName: 'Ana',
  lastName: 'Silva',
  notificationType: 'EMAIL' as const,
  title: 'Hi',
  bodyTemplate: 'welcome',
  contextName: 'testContext',
  contextParameters: {},
  sendAfter: new Date('2999-01-01'),
  subjectTemplate: null,
  extraParams: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pinning on create', () => {
  it('leaves a notification unpinned by default', async () => {
    const { service, backend } = makeService({ renderer: makeRenderer(7) });

    await service.createNotification(CREATE_INPUT);

    expect(backend.persistNotification.mock.calls[0]?.[0]).not.toHaveProperty(
      'requestedTemplateVersion',
    );
  });

  it('uses an explicit version whatever the service is configured with', async () => {
    const { service, backend } = makeService({ renderer: makeRenderer(7) });

    await service.createNotification({ ...CREATE_INPUT, requestedTemplateVersion: 3 });

    expect(backend.persistNotification.mock.calls[0]?.[0]).toMatchObject({
      requestedTemplateVersion: 3,
    });
  });

  it('resolves the current version when the call asks to pin', async () => {
    const renderer = makeRenderer(7);
    const { service, backend } = makeService({ renderer });

    await service.createNotification(CREATE_INPUT, { pinTemplateVersions: true });

    expect(renderer.getLatestTemplateVersion).toHaveBeenCalledWith('welcome');
    expect(backend.persistNotification.mock.calls[0]?.[0]).toMatchObject({
      requestedTemplateVersion: 7,
    });
  });

  it('pins every create when the service is configured to', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(7),
      pinTemplateVersions: true,
    });

    await service.createNotification(CREATE_INPUT);

    expect(backend.persistNotification.mock.calls[0]?.[0]).toMatchObject({
      requestedTemplateVersion: 7,
    });
  });

  it('lets a call opt out of a service that pins', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(7),
      pinTemplateVersions: true,
    });

    await service.createNotification(CREATE_INPUT, { pinTemplateVersions: false });

    expect(backend.persistNotification.mock.calls[0]?.[0]).not.toHaveProperty(
      'requestedTemplateVersion',
    );
  });

  it('prefers an explicit version over the service default', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(7),
      pinTemplateVersions: true,
    });

    await service.createNotification({ ...CREATE_INPUT, requestedTemplateVersion: 2 });

    expect(backend.persistNotification.mock.calls[0]?.[0]).toMatchObject({
      requestedTemplateVersion: 2,
    });
  });

  it('passes no key at all to a backend when there is nothing to pin', async () => {
    // A renderer whose templates are not versioned answers null, and a backend that predates
    // template versioning must not be handed a field it does not know.
    const { service, backend } = makeService({
      renderer: makeRenderer(null),
      pinTemplateVersions: true,
    });

    await service.createNotification(CREATE_INPUT);

    expect(backend.persistNotification.mock.calls[0]?.[0]).not.toHaveProperty(
      'requestedTemplateVersion',
    );
  });

  it('creates unpinned when the renderer throws, rather than failing the write', async () => {
    const renderer = makeRenderer();
    renderer.getLatestTemplateVersion.mockRejectedValue(new Error('store unreachable'));
    const { service, backend } = makeService({ renderer, pinTemplateVersions: true });

    const created = await service.createNotification(CREATE_INPUT);

    expect(created.id).toBe('notification-1');
    expect(backend.persistNotification.mock.calls[0]?.[0]).not.toHaveProperty(
      'requestedTemplateVersion',
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('leaving the notification unpinned'),
    );
  });

  it('pins a one-off notification the same way', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(7),
      pinTemplateVersions: true,
    });

    await service.createOneOffNotification(ONE_OFF_INPUT);

    expect(backend.persistOneOffNotification.mock.calls[0]?.[0]).toMatchObject({
      requestedTemplateVersion: 7,
    });
  });

  it('only asks the renderer for the notification type it is creating', async () => {
    const emailRenderer = makeRenderer(7);
    const smsRenderer = makeRenderer(99);
    const backend = makeBackend();
    const service = new VintaSendFactory<any>().create({
      adapters: [
        makeAdapter(emailRenderer),
        {
          ...makeAdapter(smsRenderer),
          notificationType: 'SMS',
          key: 'sms',
          getTemplateRenderer: () => smsRenderer,
        } as any,
      ],
      backend,
      logger,
      contextGeneratorsMap: { testContext: { generate: async () => ({}) } },
      options: { raiseErrorOnFailedSend: false, pinTemplateVersions: true },
    });

    await service.createNotification(CREATE_INPUT);

    expect(emailRenderer.getLatestTemplateVersion).toHaveBeenCalled();
    expect(smsRenderer.getLatestTemplateVersion).not.toHaveBeenCalled();
  });
});

describe('pinning on update', () => {
  it('repoints a notification at an explicit version', async () => {
    const { service, backend } = makeService({});

    await service.updateNotification('notification-1', { requestedTemplateVersion: 4 });

    expect(backend.persistNotificationUpdate.mock.calls[0]?.[1]).toMatchObject({
      requestedTemplateVersion: 4,
    });
  });

  it('re-pins an update that changes the template', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(9),
      pinTemplateVersions: true,
    });

    await service.updateNotification('notification-1', { bodyTemplate: 'farewell' });

    expect(backend.persistNotificationUpdate.mock.calls[0]?.[1]).toMatchObject({
      bodyTemplate: 'farewell',
      requestedTemplateVersion: 9,
    });
  });

  it('leaves an existing pin alone on an update that does not change the template', async () => {
    // Silently moving a pin forward is the one thing pinning exists to prevent.
    const { service, backend } = makeService({
      renderer: makeRenderer(9),
      pinTemplateVersions: true,
    });

    await service.updateNotification('notification-1', { title: 'New title' });

    expect(backend.persistNotificationUpdate.mock.calls[0]?.[1]).not.toHaveProperty(
      'requestedTemplateVersion',
    );
  });

  it('prefers the version the caller named over re-pinning', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(9),
      pinTemplateVersions: true,
    });

    await service.updateNotification('notification-1', {
      bodyTemplate: 'farewell',
      requestedTemplateVersion: 2,
    });

    expect(backend.persistNotificationUpdate.mock.calls[0]?.[1]).toMatchObject({
      requestedTemplateVersion: 2,
    });
  });

  it('does not re-pin when the call opts out', async () => {
    const { service, backend } = makeService({
      renderer: makeRenderer(9),
      pinTemplateVersions: true,
    });

    await service.updateNotification(
      'notification-1',
      { bodyTemplate: 'farewell' },
      { pinTemplateVersions: false },
    );

    expect(backend.persistNotificationUpdate.mock.calls[0]?.[1]).not.toHaveProperty(
      'requestedTemplateVersion',
    );
  });

  it('re-pins a one-off update the same way', async () => {
    const backend = makeBackend({
      getNotification: vi.fn().mockResolvedValue(makeNotification()),
    });
    const { service } = makeService({
      backend,
      renderer: makeRenderer(9),
      pinTemplateVersions: true,
    });

    await service.updateOneOffNotification('notification-1', { bodyTemplate: 'farewell' });

    expect(backend.persistOneOffNotificationUpdate.mock.calls[0]?.[1]).toMatchObject({
      requestedTemplateVersion: 9,
    });
  });

  it('refuses to let a caller set usedTemplateVersion', async () => {
    const { service, backend } = makeService({});

    await expect(
      service.updateNotification('notification-1', { usedTemplateVersion: 3 } as never),
    ).rejects.toThrow(/system-managed/);
    expect(backend.persistNotificationUpdate).not.toHaveBeenCalled();
  });

  it('refuses it on a one-off update too', async () => {
    const { service } = makeService({});

    await expect(
      service.updateOneOffNotification('notification-1', { usedTemplateVersion: 3 } as never),
    ).rejects.toThrow(/set requestedTemplateVersion instead/i);
  });
});

describe('recording what rendered', () => {
  const sendable = { ...CREATE_INPUT, sendAfter: null };

  it('stores the version the adapter reported', async () => {
    const { service, backend } = makeService({
      sendResult: { subject: 's', body: 'b', templateVersion: 5 },
    });

    await service.createNotification(sendable);

    expect(backend.storeTemplateVersion).toHaveBeenCalledWith('notification-1', 5);
  });

  it('stores nothing when the adapter returns no send input', async () => {
    const { service, backend } = makeService({ sendResult: undefined });

    await service.createNotification(sendable);

    expect(backend.storeTemplateVersion).not.toHaveBeenCalled();
  });

  it('stores nothing when the renderer reported no version', async () => {
    const { service, backend } = makeService({ sendResult: { subject: 's', body: 'b' } });

    await service.createNotification(sendable);

    expect(backend.storeTemplateVersion).not.toHaveBeenCalled();
  });

  it('skips a backend that cannot store it, rather than erroring', async () => {
    const backend = makeBackend();
    // A backend written before template versioning has no such method at all.
    (backend as unknown as Record<string, unknown>).storeTemplateVersion = undefined;
    const { service } = makeService({
      backend,
      sendResult: { subject: 's', body: 'b', templateVersion: 5 },
    });

    await expect(service.createNotification(sendable)).resolves.toBeDefined();
  });

  it('keeps a notification sent when recording fails', async () => {
    const backend = makeBackend({
      storeTemplateVersion: vi.fn().mockRejectedValue(new Error('column missing')),
    });
    const { service } = makeService({
      backend,
      sendResult: { subject: 's', body: 'b', templateVersion: 5 },
    });

    await expect(service.createNotification(sendable)).resolves.toBeDefined();
    expect(backend.markAsSent).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error storing the template version'),
    );
  });

  it('does not rewrite a version the notification already carries', async () => {
    const backend = makeBackend({
      persistNotification: vi
        .fn()
        .mockImplementation(async (n: any) => makeNotification({ ...n, usedTemplateVersion: 5 })),
    });
    const { service } = makeService({
      backend,
      sendResult: { subject: 's', body: 'b', templateVersion: 5 },
    });

    await service.createNotification(sendable);

    expect(backend.storeTemplateVersion).not.toHaveBeenCalled();
  });

  it('records through delayedSend as well', async () => {
    const backend = makeBackend();
    const renderer = makeRenderer();
    const adapter = makeAdapter(renderer, { subject: 's', body: 'b', templateVersion: 6 });
    (adapter as unknown as Record<string, unknown>).enqueueNotifications = true;

    const service = new VintaSendFactory<any>().create({
      adapters: [adapter],
      backend,
      logger,
      contextGeneratorsMap: { testContext: { generate: async () => ({}) } },
      queueService: { enqueueNotification: vi.fn() } as any,
      options: { raiseErrorOnFailedSend: false },
    });

    await service.delayedSend('notification-1');

    expect(backend.storeTemplateVersion).toHaveBeenCalledWith('notification-1', 6);
  });
});
