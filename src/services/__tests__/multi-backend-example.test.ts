import {
  createMultiBackendNotificationService,
  getBackendIdentifiers,
  getBackendManagementSnapshot,
  readNotificationFromBackend,
  verifyAndRepairNotification,
} from '../../examples/multi-backend-example';
import type { DatabaseNotification } from '../../types/notification';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type { BaseNotificationBackend } from '../notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from '../notification-template-renderers/base-email-template-renderer';

type ContextGenerators = {
  orderShipped: {
    generate: (params: { orderId: string }) => Promise<{ orderId: string }>;
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

function createDatabaseNotification(
  id: string,
  status: 'PENDING_SEND' | 'SENT' | 'FAILED' = 'PENDING_SEND',
): DatabaseNotification<Config> {
  return {
    id,
    userId: 'user-1',
    notificationType: 'EMAIL',
    title: 'Order shipped',
    bodyTemplate: 'body',
    contextName: 'orderShipped',
    contextParameters: { orderId: 'order-1' },
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

describe('Multi-backend example', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a service with backend identifier helpers', () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const service = createMultiBackendNotificationService({
      adapters: [adapter],
      primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
    });

    const identifiers = getBackendIdentifiers(service);

    expect(identifiers.primary).toBe('primary');
    expect(identifiers.all).toEqual(['primary', 'replica']);
    expect(identifiers.additional).toEqual(['replica']);
  });

  it('supports backend-targeted read in example helper', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const notification = createDatabaseNotification('notif-1', 'SENT');
    replicaBackend.getNotification.mockResolvedValue(notification);

    const service = createMultiBackendNotificationService({
      adapters: [adapter],
      primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
    });

    const result = await readNotificationFromBackend(service, 'notif-1', 'replica');

    expect(result).toEqual(notification);
    expect(replicaBackend.getNotification).toHaveBeenCalledWith('notif-1', false);
  });

  it('replicates during verifyAndRepairNotification when sync has discrepancies', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const primaryNotification = createDatabaseNotification('notif-1', 'SENT');

    primaryBackend.getNotification.mockResolvedValue(primaryNotification);
    replicaBackend.getNotification.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    replicaBackend.persistNotification.mockResolvedValue(primaryNotification);

    const service = createMultiBackendNotificationService({
      adapters: [adapter],
      primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
    });

    const result = await verifyAndRepairNotification(service, 'notif-1');

    expect(result.syncReport.synced).toBe(false);
    expect(result.syncReport.discrepancies).toContain('Notification missing in backend: replica');
    expect(result.replicationResult?.successes).toEqual(['replica']);
  });

  it('returns backend sync stats in example helper', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getAllNotifications.mockResolvedValue([
      createDatabaseNotification('notif-1'),
      createDatabaseNotification('notif-2'),
    ]);
    replicaBackend.getAllNotifications.mockResolvedValue([createDatabaseNotification('notif-1')]);

    const service = createMultiBackendNotificationService({
      adapters: [adapter],
      primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
    });

    const stats = await getBackendManagementSnapshot(service);

    expect(stats.backends.primary).toEqual({
      totalNotifications: 2,
      status: 'healthy',
    });
    expect(stats.backends.replica).toEqual({
      totalNotifications: 1,
      status: 'healthy',
    });
  });
});
