import { beforeEach, describe, expect, it, type Mock, type Mocked, vi } from 'vitest';
import { VintaSendFactory } from '../../index';
import type { DatabaseNotification } from '../../types/notification';
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

function createDatabaseNotification(
  id: string,
  status: 'PENDING_SEND' | 'SENT' | 'FAILED' = 'PENDING_SEND',
): DatabaseNotification<Config> {
  return {
    id,
    userId: 'user-1',
    notificationType: 'EMAIL',
    title: 'Title',
    bodyTemplate: 'body',
    contextName: 'testContext',
    contextParameters: { userId: 'user-1' },
    sendAfter: null,
    subjectTemplate: 'subject',
    status,
    contextUsed: null,
    extraParams: null,
    adapterUsed: null,
    sentAt: null,
    readAt: null,
    gitCommitSha: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('VintaSend multi-backend management (Phase 6)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifyNotificationSync returns synced true when all backends match', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const notification = createDatabaseNotification('notif-1', 'SENT');
    primaryBackend.getNotification.mockResolvedValue(notification);
    replicaBackend.getNotification.mockResolvedValue(notification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const report = await service.verifyNotificationSync('notif-1');

    expect(report.synced).toBe(true);
    expect(report.discrepancies).toEqual([]);
    expect(report.backends.primary.exists).toBe(true);
    expect(report.backends.replica.exists).toBe(true);
  });

  it('verifyNotificationSync reports missing notification in additional backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getNotification.mockResolvedValue(createDatabaseNotification('notif-1', 'SENT'));
    replicaBackend.getNotification.mockResolvedValue(null);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const report = await service.verifyNotificationSync('notif-1');

    expect(report.synced).toBe(false);
    expect(report.discrepancies).toContain('Notification missing in backend: replica');
  });

  it('verifyNotificationSync reports status mismatch', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getNotification.mockResolvedValue(createDatabaseNotification('notif-1', 'SENT'));
    replicaBackend.getNotification.mockResolvedValue(
      createDatabaseNotification('notif-1', 'FAILED'),
    );

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const report = await service.verifyNotificationSync('notif-1');

    expect(report.synced).toBe(false);
    expect(report.discrepancies).toContain('Status mismatch in replica: FAILED vs SENT');
  });

  it('verifyNotificationSync reports additional field mismatches', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const primaryNotification = {
      ...createDatabaseNotification('notif-1', 'SENT'),
      title: 'Primary title',
      subjectTemplate: 'primary subject',
    };
    const replicaNotification = {
      ...createDatabaseNotification('notif-1', 'SENT'),
      title: 'Replica title',
      subjectTemplate: 'replica subject',
    };

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaBackend.getNotification.mockResolvedValue(replicaNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const report = await service.verifyNotificationSync('notif-1');

    expect(report.synced).toBe(false);
    expect(report.discrepancies).toContain(
      'Field mismatch in replica for title: Replica title vs Primary title',
    );
    expect(report.discrepancies).toContain(
      'Field mismatch in replica for subjectTemplate: replica subject vs primary subject',
    );
  });

  it('verifyNotificationSync reports backend read errors and primary missing', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getNotification.mockResolvedValue(null);
    replicaBackend.getNotification.mockRejectedValue(new Error('read failed'));

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const report = await service.verifyNotificationSync('notif-1');

    expect(report.synced).toBe(false);
    expect(report.discrepancies).toContain('Backend replica: Error: read failed');
    expect(report.discrepancies).toContain('Notification not found in primary backend');
  });

  it('replicateNotification creates missing notifications and updates existing ones', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaCreate = createMockBackend('replica-create');
    const replicaUpdate = createMockBackend('replica-update');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaCreate.getNotification.mockResolvedValue(null);
    replicaUpdate.getNotification.mockResolvedValue(
      createDatabaseNotification('notif-1', 'PENDING_SEND'),
    );
    replicaCreate.persistNotification.mockResolvedValue(primaryNotification);
    replicaUpdate.persistNotificationUpdate.mockResolvedValue(primaryNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaCreate, replicaUpdate],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.replicateNotification('notif-1');

    expect(replicaCreate.persistNotification).toHaveBeenCalledWith(primaryNotification);
    expect(replicaUpdate.persistNotificationUpdate).toHaveBeenCalledWith(
      'notif-1',
      primaryNotification,
    );
    expect(result.successes).toEqual(['replica-create', 'replica-update']);
    expect(result.failures).toEqual([]);
  });

  it('replicateNotification returns partial failures without throwing', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaOk = createMockBackend('replica-ok');
    const replicaFail = createMockBackend('replica-fail');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaOk.getNotification.mockResolvedValue(null);
    replicaFail.getNotification.mockResolvedValue(null);
    replicaOk.persistNotification.mockResolvedValue(primaryNotification);
    replicaFail.persistNotification.mockRejectedValue(new Error('replication failed'));

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaOk, replicaFail],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.replicateNotification('notif-1');

    expect(result.successes).toEqual(['replica-ok']);
    expect(result.failures).toEqual([
      {
        backend: 'replica-fail',
        error: 'Error: replication failed',
      },
    ]);
  });

  it('replicateNotification throws when notification is missing in primary backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getNotification.mockResolvedValue(null);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await expect(service.replicateNotification('missing-id')).rejects.toThrow(
      'Notification missing-id not found in primary backend',
    );
  });

  it('processReplication replicates to all additional backends', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaA = createMockBackend('replica-a');
    const replicaB = createMockBackend('replica-b');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaA.getNotification.mockResolvedValue(null);
    replicaB.getNotification.mockResolvedValue(null);
    replicaA.persistNotification.mockResolvedValue(primaryNotification);
    replicaB.persistNotification.mockResolvedValue(primaryNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaA, replicaB],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.processReplication('notif-1');

    expect(replicaA.persistNotification).toHaveBeenCalledWith(primaryNotification);
    expect(replicaB.persistNotification).toHaveBeenCalledWith(primaryNotification);
    expect(result.successes).toEqual(['replica-a', 'replica-b']);
    expect(result.failures).toEqual([]);
  });

  it('processReplication runs additional backend replication in parallel', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaA = createMockBackend('replica-a');
    const replicaB = createMockBackend('replica-b');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);

    let releaseReplicaAGetNotification: () => void = () => {};
    const replicaAGetNotificationGate = new Promise<void>((resolve) => {
      releaseReplicaAGetNotification = resolve;
    });

    replicaA.getNotification.mockImplementation(async () => {
      await replicaAGetNotificationGate;
      return null;
    });
    replicaA.persistNotification.mockResolvedValue(primaryNotification);

    replicaB.getNotification.mockResolvedValue(null);
    replicaB.persistNotification.mockResolvedValue(primaryNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaA, replicaB],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const processingPromise = service.processReplication('notif-1');
    await Promise.resolve();

    expect(replicaA.getNotification).toHaveBeenCalledTimes(1);
    expect(replicaB.getNotification).toHaveBeenCalledTimes(1);

    releaseReplicaAGetNotification();
    const result = await processingPromise;

    expect(result.successes).toEqual(['replica-a', 'replica-b']);
    expect(result.failures).toEqual([]);
  });

  it('processReplication returns partial failures per backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaOk = createMockBackend('replica-ok');
    const replicaFail = createMockBackend('replica-fail');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaOk.getNotification.mockResolvedValue(null);
    replicaFail.getNotification.mockResolvedValue(null);
    replicaOk.persistNotification.mockResolvedValue(primaryNotification);
    replicaFail.persistNotification.mockRejectedValue(new Error('write failed'));

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaOk, replicaFail],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.processReplication('notif-1');

    expect(result.successes).toEqual(['replica-ok']);
    expect(result.failures).toEqual([
      {
        backend: 'replica-fail',
        error: 'Error: write failed',
      },
    ]);
  });

  it('processReplication is idempotent when notification already exists in destination', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaExisting = createMockBackend('replica-existing');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');
    const existingNotification = createDatabaseNotification('notif-1', 'PENDING_SEND');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaExisting.getNotification.mockResolvedValue(existingNotification);
    replicaExisting.persistNotificationUpdate.mockResolvedValue(primaryNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaExisting],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.processReplication('notif-1');

    expect(replicaExisting.persistNotification).not.toHaveBeenCalled();
    expect(replicaExisting.persistNotificationUpdate).toHaveBeenCalledWith(
      'notif-1',
      primaryNotification,
    );
    expect(result.successes).toEqual(['replica-existing']);
    expect(result.failures).toEqual([]);
  });

  it('processReplication is idempotent on duplicate create race by retrying as update', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaBackend.getNotification.mockResolvedValue(null);
    replicaBackend.persistNotification.mockRejectedValue(
      new Error('duplicate key value violates unique constraint'),
    );
    replicaBackend.persistNotificationUpdate.mockResolvedValue(primaryNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.processReplication('notif-1');

    expect(replicaBackend.persistNotification).toHaveBeenCalledTimes(1);
    expect(replicaBackend.persistNotificationUpdate).toHaveBeenCalledWith(
      'notif-1',
      primaryNotification,
    );
    expect(result.successes).toEqual(['replica']);
    expect(result.failures).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Retrying as update for idempotency'),
    );
  });

  it('processReplication prefers backend apply-only-if-newer operation when implemented', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    const applyReplicationSnapshotIfNewer = vi.fn().mockResolvedValue({ applied: false });
    Object.assign(replicaBackend, { applyReplicationSnapshotIfNewer });

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.processReplication('notif-1');

    expect(applyReplicationSnapshotIfNewer).toHaveBeenCalledWith(primaryNotification);
    expect(replicaBackend.persistNotification).not.toHaveBeenCalled();
    expect(replicaBackend.persistNotificationUpdate).not.toHaveBeenCalled();
    expect(result.successes).toEqual(['replica']);
    expect(result.failures).toEqual([]);
  });

  it('processReplication targets only the specified additional backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaA = createMockBackend('replica-a');
    const replicaB = createMockBackend('replica-b');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaA.getNotification.mockResolvedValue(null);
    replicaB.getNotification.mockResolvedValue(null);
    replicaA.persistNotification.mockResolvedValue(primaryNotification);
    replicaB.persistNotification.mockResolvedValue(primaryNotification);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaA, replicaB],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const result = await service.processReplication('notif-1', 'replica-b');

    expect(replicaA.persistNotification).not.toHaveBeenCalled();
    expect(replicaB.persistNotification).toHaveBeenCalledWith(primaryNotification);
    expect(result.successes).toEqual(['replica-b']);
    expect(result.failures).toEqual([]);
  });

  it('getBackendSyncStats returns healthy and error backend statuses', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getAllNotifications.mockResolvedValue([
      createDatabaseNotification('notif-1'),
      createDatabaseNotification('notif-2'),
    ]);
    replicaBackend.getAllNotifications.mockRejectedValue(new Error('backend unavailable'));

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const stats = await service.getBackendSyncStats();

    expect(stats.backends.primary).toEqual({
      totalNotifications: 2,
      status: 'healthy',
    });
    expect(stats.backends.replica).toEqual({
      totalNotifications: 0,
      status: 'error',
      error: 'Error: backend unavailable',
    });
  });

  it('migrateToBackend defaults to primary backend as source', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');
    const destinationBackend = createMockBackend('destination');

    const sourceNotifications = [createDatabaseNotification('notif-1')];

    primaryBackend.getNotifications
      .mockResolvedValueOnce(sourceNotifications)
      .mockResolvedValueOnce([]);
    destinationBackend.bulkPersistNotifications.mockResolvedValue(['notif-1']);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.migrateToBackend(destinationBackend, 100);

    expect(primaryBackend.getNotifications).toHaveBeenCalledTimes(2);
    expect(primaryBackend.getNotifications).toHaveBeenNthCalledWith(1, 0, 100);
    expect(primaryBackend.getNotifications).toHaveBeenNthCalledWith(2, 1, 100);
    expect(replicaBackend.getNotifications).not.toHaveBeenCalled();
    expect(destinationBackend.bulkPersistNotifications).toHaveBeenCalledTimes(1);
  });

  it('migrateToBackend supports selecting source backend by identifier', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');
    const destinationBackend = createMockBackend('destination');

    const sourceNotifications = [createDatabaseNotification('notif-1')];

    replicaBackend.getNotifications
      .mockResolvedValueOnce(sourceNotifications)
      .mockResolvedValueOnce([]);
    destinationBackend.bulkPersistNotifications.mockResolvedValue(['notif-1']);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.migrateToBackend(destinationBackend, 100, 'replica');

    expect(replicaBackend.getNotifications).toHaveBeenCalledTimes(2);
    expect(replicaBackend.getNotifications).toHaveBeenNthCalledWith(1, 0, 100);
    expect(replicaBackend.getNotifications).toHaveBeenNthCalledWith(2, 1, 100);
    expect(primaryBackend.getNotifications).not.toHaveBeenCalled();
    expect(destinationBackend.bulkPersistNotifications).toHaveBeenCalledTimes(1);
  });

  it('migrateToBackend throws clear error for invalid source backend identifier', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');
    const destinationBackend = createMockBackend('destination');

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await expect(
      service.migrateToBackend(destinationBackend, 100, 'unknown-backend'),
    ).rejects.toThrow('Backend not found: unknown-backend');
  });
});
