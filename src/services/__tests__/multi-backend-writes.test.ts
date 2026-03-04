import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from 'vitest';
import { VintaSendFactory } from '../../index';
import type { DatabaseNotification, NotificationInput } from '../../types/notification';
import type {
  DatabaseOneOffNotification,
  OneOffNotificationInput,
} from '../../types/one-off-notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseNotificationReplicationQueueService } from '../notification-queue-service/base-notification-replication-queue-service';
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

const mockTemplateRenderer: Mocked<BaseEmailTemplateRenderer<Config>> = {
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
  templateRenderer: mockTemplateRenderer,
  logger,
  supportsAttachments: false,
  getTemplateRenderer: () => mockTemplateRenderer,
} as any;

const contextGenerators: ContextGenerators = {
  testContext: {
    generate: vi.fn(),
  },
};

const replicationQueueService: Mocked<BaseNotificationReplicationQueueService<Config>> = {
  enqueueReplication: vi.fn(),
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

describe('VintaSend multi-backend writes (Phase 4)', () => {
  const baseNotificationInput: Omit<NotificationInput<Config>, 'id'> = {
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

  const baseOneOffInput: Omit<OneOffNotificationInput<Config>, 'id'> = {
    emailOrPhone: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    notificationType: 'EMAIL',
    title: 'OneOff',
    bodyTemplate: 'body',
    contextName: 'testContext',
    contextParameters: { userId: 'user-1' },
    sendAfter: new Date(Date.now() + 60_000),
    subjectTemplate: 'subject',
    extraParams: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    contextGenerators.testContext.generate = vi.fn();
  });

  it('replicates createNotification to additional backends with primary id', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);
    replicaBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.createNotification(baseNotificationInput);

    expect(result.id).toBe('notif-1');
    expect(primaryBackend.persistNotification).toHaveBeenCalledWith(baseNotificationInput);
    expect(replicaBackend.persistNotification).toHaveBeenCalledWith({
      ...baseNotificationInput,
      id: 'notif-1',
    });
  });

  it('preserves inline replication behavior when replicationMode is inline', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-inline-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);
    replicaBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-inline-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
      replicationQueueService,
      options: { raiseErrorOnFailedSend: false, replicationMode: 'inline' },
    });

    await service.createNotification(baseNotificationInput);

    expect(replicaBackend.persistNotification).toHaveBeenCalledWith({
      ...baseNotificationInput,
      id: 'notif-inline-1',
    });
    expect(replicationQueueService.enqueueReplication).not.toHaveBeenCalled();
  });

  it('enqueues replication and skips immediate additional writes when replicationMode is queued', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaA = createMockBackend('replica-a');
    const replicaB = createMockBackend('replica-b');

    primaryBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-queued-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaA, replicaB],
      logger,
      contextGeneratorsMap: contextGenerators,
      replicationQueueService,
      options: { raiseErrorOnFailedSend: false, replicationMode: 'queued' },
    });

    await service.createNotification(baseNotificationInput);

    expect(replicationQueueService.enqueueReplication).toHaveBeenCalledTimes(2);
    expect(replicationQueueService.enqueueReplication).toHaveBeenNthCalledWith(
      1,
      'notif-queued-1',
      'replica-a',
    );
    expect(replicationQueueService.enqueueReplication).toHaveBeenNthCalledWith(
      2,
      'notif-queued-1',
      'replica-b',
    );
    expect(replicaA.persistNotification).not.toHaveBeenCalled();
    expect(replicaB.persistNotification).not.toHaveBeenCalled();
  });

  it('falls back to inline replication when replicationMode is queued but no replication queue service is provided', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-fallback-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);
    replicaBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-fallback-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
      options: { raiseErrorOnFailedSend: false, replicationMode: 'queued' },
    });

    await service.createNotification(baseNotificationInput);

    expect(replicaBackend.persistNotification).toHaveBeenCalledWith({
      ...baseNotificationInput,
      id: 'notif-fallback-1',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('no replication queue service is registered'),
    );
  });

  it('replicates updateNotification to additional backends', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');
    const updates = { title: 'Updated' };

    primaryBackend.persistNotificationUpdate.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-1',
      ...updates,
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);
    replicaBackend.persistNotificationUpdate.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-1',
      ...updates,
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.updateNotification('notif-1', updates);

    expect(primaryBackend.persistNotificationUpdate).toHaveBeenCalledWith('notif-1', updates);
    expect(replicaBackend.persistNotificationUpdate).toHaveBeenCalledWith('notif-1', updates);
  });

  it('replicates createOneOffNotification and updateOneOffNotification', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const createdOneOff = {
      ...baseOneOffInput,
      id: 'oneoff-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      gitCommitSha: null,
    } as DatabaseOneOffNotification<Config>;

    primaryBackend.persistOneOffNotification.mockResolvedValue(createdOneOff);
    replicaBackend.persistOneOffNotification.mockResolvedValue(createdOneOff);

    const updatedOneOff = {
      ...createdOneOff,
      title: 'Updated OneOff',
      sendAfter: new Date(Date.now() + 120_000),
    };

    primaryBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedOneOff);
    replicaBackend.persistOneOffNotificationUpdate.mockResolvedValue(updatedOneOff);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.createOneOffNotification(baseOneOffInput);
    await service.updateOneOffNotification('oneoff-1', { title: 'Updated OneOff' });

    expect(replicaBackend.persistOneOffNotification).toHaveBeenCalledWith({
      ...baseOneOffInput,
      id: 'oneoff-1',
    });
    expect(replicaBackend.persistOneOffNotificationUpdate).toHaveBeenCalledWith('oneoff-1', {
      title: 'Updated OneOff',
    });
  });

  it('replicates markRead and cancelNotification to additional backends', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.markAsRead.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-1',
      status: 'SENT',
      contextUsed: null,
      adapterUsed: null,
      sentAt: new Date(),
      readAt: new Date(),
      gitCommitSha: null,
    } as DatabaseNotification<Config>);
    replicaBackend.markAsRead.mockResolvedValue({
      ...baseNotificationInput,
      id: 'notif-1',
      status: 'SENT',
      contextUsed: null,
      adapterUsed: null,
      sentAt: new Date(),
      readAt: new Date(),
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    primaryBackend.cancelNotification.mockResolvedValue();
    replicaBackend.cancelNotification.mockResolvedValue();

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.markRead('notif-1');
    await service.cancelNotification('notif-1');

    expect(primaryBackend.markAsRead).toHaveBeenCalledWith('notif-1', true);
    expect(replicaBackend.markAsRead).toHaveBeenCalledWith('notif-1', true);
    expect(primaryBackend.cancelNotification).toHaveBeenCalledWith('notif-1');
    expect(replicaBackend.cancelNotification).toHaveBeenCalledWith('notif-1');
  });

  it('replicates bulkPersistNotifications to additional backends', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const bulkPayload = [
      {
        ...baseNotificationInput,
        title: 'A',
      },
      {
        ...baseNotificationInput,
        title: 'B',
      },
    ];

    primaryBackend.bulkPersistNotifications.mockResolvedValue(['n1', 'n2']);
    replicaBackend.bulkPersistNotifications.mockResolvedValue(['n1', 'n2']);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.bulkPersistNotifications(bulkPayload);

    expect(result).toEqual(['n1', 'n2']);
    expect(replicaBackend.bulkPersistNotifications).toHaveBeenCalledWith([
      {
        ...bulkPayload[0],
        id: 'n1',
      },
      {
        ...bulkPayload[1],
        id: 'n2',
      },
    ]);
  });

  it('does not replicate when primary createNotification fails', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.persistNotification.mockRejectedValue(new Error('primary error'));

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await expect(service.createNotification(baseNotificationInput)).rejects.toThrow(
      'primary error',
    );
    expect(replicaBackend.persistNotification).not.toHaveBeenCalled();
  });

  it('keeps single-backend write compatibility', async () => {
    const primaryBackend = createMockBackend('primary');
    primaryBackend.persistNotification.mockResolvedValue({
      ...baseNotificationInput,
      id: 'single-1',
      status: 'PENDING_SEND',
      contextUsed: null,
      adapterUsed: null,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
    } as DatabaseNotification<Config>);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const created = await service.createNotification(baseNotificationInput);

    expect(created.id).toBe('single-1');
    expect(primaryBackend.persistNotification).toHaveBeenCalledTimes(1);
  });
});
