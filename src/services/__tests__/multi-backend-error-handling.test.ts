import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from 'vitest';
import { VintaSendFactory } from '../../index';
import type { DatabaseNotification, NotificationInput } from '../../types/notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';

type ContextGenerators = {
  testContext: {
    generate: (params: { userId: string }) => Promise<{ userId: string }>;
  };
};

type Config = {
  ContextMap: ContextGenerators;
  NotificationIdType: string;
  UserIdType: string;
};

type MockBackend = Mocked<BaseNotificationBackend<Config>> & {
  injectLogger: Mock;
  injectAttachmentManager: Mock;
  getBackendIdentifier: Mock<
    Exclude<BaseNotificationBackend<Config>['getBackendIdentifier'], undefined>
  >;
};

const templateRenderer: Mocked<BaseEmailTemplateRenderer<Config>> = {
  logger: null,
  render: vi.fn(),
  renderFromTemplateContent: vi.fn(),
  injectLogger: vi.fn(),
};

const logger: Mocked<BaseLogger> = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const adapter: Mocked<BaseNotificationAdapter<any, Config>> = {
  notificationType: 'EMAIL',
  key: 'adapter-1',
  enqueueNotifications: false,
  send: vi.fn(),
  injectBackend: vi.fn(),
  injectLogger: vi.fn(),
  backend: null,
  templateRenderer,
  logger,
  supportsAttachments: false,
  getTemplateRenderer: () => templateRenderer,
} as any;

const contextGenerators: ContextGenerators = {
  testContext: {
    generate: vi.fn(),
  },
};

function createMockBackend(identifier: string): MockBackend {
  return {
    persistNotification: vi.fn(),
    persistNotificationUpdate: vi.fn(),
    getAllFutureNotifications: vi.fn(),
    getAllFutureNotificationsFromUser: vi.fn(),
    getFutureNotificationsFromUser: vi.fn(),
    getFutureNotifications: vi.fn(),
    getAllPendingNotifications: vi.fn(),
    getPendingNotifications: vi.fn(),
    getNotification: vi.fn(),
    markAsRead: vi.fn(),
    filterAllInAppUnreadNotifications: vi.fn(),
    cancelNotification: vi.fn(),
    markAsSent: vi.fn(),
    markAsFailed: vi.fn(),
    storeAdapterAndContextUsed: vi.fn(),
    getUserEmailFromNotification: vi.fn(),
    filterInAppUnreadNotifications: vi.fn(),
    filterNotifications: vi.fn(),
    bulkPersistNotifications: vi.fn(),
    getAllNotifications: vi.fn(),
    getNotifications: vi.fn(),
    persistOneOffNotification: vi.fn(),
    persistOneOffNotificationUpdate: vi.fn(),
    getOneOffNotification: vi.fn(),
    getAllOneOffNotifications: vi.fn(),
    getOneOffNotifications: vi.fn(),
    storeAttachmentFileRecord: vi.fn(),
    getAttachmentFileRecord: vi.fn(),
    getAttachmentFile: vi.fn(),
    findAttachmentFileByChecksum: vi.fn(),
    deleteAttachmentFile: vi.fn(),
    getOrphanedAttachmentFiles: vi.fn(),
    getAttachments: vi.fn(),
    deleteNotificationAttachment: vi.fn(),
    injectLogger: vi.fn(),
    injectAttachmentManager: vi.fn(),
    getBackendIdentifier: vi.fn(() => identifier),
  } as unknown as MockBackend;
}

describe('VintaSend multi-backend error handling (Phase 4)', () => {
  const createNotificationInput: Omit<NotificationInput<Config>, 'id'> = {
    userId: 'user-1',
    notificationType: 'EMAIL',
    title: 'Title',
    bodyTemplate: 'body',
    contextName: 'testContext',
    contextParameters: { userId: 'user-1' },
    sendAfter: new Date(Date.now() + 60_000),
    subjectTemplate: 'subject',
    extraParams: null,
  };

  const databaseNotification = {
    ...createNotificationInput,
    id: 'notif-1',
    status: 'PENDING_SEND',
    contextUsed: null,
    adapterUsed: null,
    sentAt: null,
    readAt: null,
    gitCommitSha: null,
  } as DatabaseNotification<Config>;

  beforeEach(() => {
    vi.clearAllMocks();
    contextGenerators.testContext.generate = vi.fn().mockResolvedValue({ userId: 'user-1' });
  });

  it('continues when one additional backend replication fails', async () => {
    const primaryBackend = createMockBackend('primary');
    const failingReplica = createMockBackend('replica-a');
    const healthyReplica = createMockBackend('replica-b');

    primaryBackend.persistNotification.mockResolvedValue(databaseNotification);
    failingReplica.persistNotification.mockRejectedValue(new Error('replication failed'));
    healthyReplica.persistNotification.mockResolvedValue(databaseNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [failingReplica, healthyReplica],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.createNotification(createNotificationInput);

    expect(result.id).toBe('notif-1');
    expect(healthyReplica.persistNotification).toHaveBeenCalledWith({
      ...createNotificationInput,
      id: 'notif-1',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to replicate createNotification to backend replica-a'),
    );
  });

  it('continues processing send path when additional backend markAsSent fails', async () => {
    const primaryBackend = createMockBackend('primary');
    const failingReplica = createMockBackend('replica-a');

    adapter.send.mockResolvedValue();

    primaryBackend.markAsSent.mockResolvedValue(databaseNotification);
    failingReplica.markAsSent.mockRejectedValue(new Error('markAsSent failed'));

    primaryBackend.storeAdapterAndContextUsed.mockResolvedValue();
    failingReplica.storeAdapterAndContextUsed.mockResolvedValue();

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [failingReplica],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await expect(service.send(databaseNotification)).resolves.toBeUndefined();

    expect(primaryBackend.markAsSent).toHaveBeenCalledWith('notif-1', true);
    expect(failingReplica.markAsSent).toHaveBeenCalledWith('notif-1', true);
    expect(primaryBackend.storeAdapterAndContextUsed).toHaveBeenCalled();
    expect(failingReplica.storeAdapterAndContextUsed).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to replicate markAsSent to backend replica-a'),
    );
  });

  it('logs all additional backend failures without failing operation', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaA = createMockBackend('replica-a');
    const replicaB = createMockBackend('replica-b');

    primaryBackend.markAsRead.mockResolvedValue({
      ...databaseNotification,
      status: 'SENT',
      readAt: new Date(),
    });
    replicaA.markAsRead.mockRejectedValue(new Error('replica A fail'));
    replicaB.markAsRead.mockRejectedValue(new Error('replica B fail'));

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaA, replicaB],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await expect(service.markRead('notif-1')).resolves.toMatchObject({ id: 'notif-1' });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to replicate markRead to backend replica-a'),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to replicate markRead to backend replica-b'),
    );
  });
});
