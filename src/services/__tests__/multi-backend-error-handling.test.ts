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

type MockBackend = jest.Mocked<BaseNotificationBackend<Config>> & {
  injectLogger: jest.Mock;
  injectAttachmentManager: jest.Mock;
  getBackendIdentifier: jest.Mock<string, []>;
};

const templateRenderer: jest.Mocked<BaseEmailTemplateRenderer<Config>> = {
  render: jest.fn(),
  renderFromTemplateContent: jest.fn(),
};

const logger: jest.Mocked<BaseLogger> = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: test adapter mock
const adapter: jest.Mocked<BaseNotificationAdapter<any, Config>> = {
  notificationType: 'EMAIL',
  key: 'adapter-1',
  enqueueNotifications: false,
  send: jest.fn(),
  injectBackend: jest.fn(),
  injectLogger: jest.fn(),
  backend: null,
  templateRenderer,
  logger,
  supportsAttachments: false,
  // biome-ignore lint/suspicious/noExplicitAny: test-only cast
} as any;

const contextGenerators: ContextGenerators = {
  testContext: {
    generate: jest.fn(),
  },
};

function createMockBackend(identifier: string): MockBackend {
  return {
    persistNotification: jest.fn(),
    persistNotificationUpdate: jest.fn(),
    getAllFutureNotifications: jest.fn(),
    getAllFutureNotificationsFromUser: jest.fn(),
    getFutureNotificationsFromUser: jest.fn(),
    getFutureNotifications: jest.fn(),
    getAllPendingNotifications: jest.fn(),
    getPendingNotifications: jest.fn(),
    getNotification: jest.fn(),
    markAsRead: jest.fn(),
    filterAllInAppUnreadNotifications: jest.fn(),
    cancelNotification: jest.fn(),
    markAsSent: jest.fn(),
    markAsFailed: jest.fn(),
    storeAdapterAndContextUsed: jest.fn(),
    getUserEmailFromNotification: jest.fn(),
    filterInAppUnreadNotifications: jest.fn(),
    filterNotifications: jest.fn(),
    bulkPersistNotifications: jest.fn(),
    getAllNotifications: jest.fn(),
    getNotifications: jest.fn(),
    persistOneOffNotification: jest.fn(),
    persistOneOffNotificationUpdate: jest.fn(),
    getOneOffNotification: jest.fn(),
    getAllOneOffNotifications: jest.fn(),
    getOneOffNotifications: jest.fn(),
    storeAttachmentFileRecord: jest.fn(),
    getAttachmentFileRecord: jest.fn(),
    getAttachmentFile: jest.fn(),
    findAttachmentFileByChecksum: jest.fn(),
    deleteAttachmentFile: jest.fn(),
    getOrphanedAttachmentFiles: jest.fn(),
    getAttachments: jest.fn(),
    deleteNotificationAttachment: jest.fn(),
    injectLogger: jest.fn(),
    injectAttachmentManager: jest.fn(),
    getBackendIdentifier: jest.fn(() => identifier),
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
    jest.clearAllMocks();
    contextGenerators.testContext.generate = jest.fn().mockResolvedValue({ userId: 'user-1' });
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
