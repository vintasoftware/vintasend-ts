import { VintaSendFactory } from '../../index';
import type { BaseLogger } from '../loggers/base-logger';
import type { BaseNotificationAdapter } from '../notification-adapters/base-notification-adapter';
import type {
  BaseNotificationBackend,
  NotificationFilterFields,
  NotificationOrderBy,
} from '../notification-backends/base-notification-backend';
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
  getFilterCapabilities: jest.Mock<Record<string, boolean>, []>;
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
    getFilterCapabilities: jest.fn(() => ({
      'fields.adapterUsed': false,
    })),
  } as unknown as MockBackend;
}

describe('VintaSend multi-backend reads (Phase 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses primary backend by default when backend identifier is not provided', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getNotification.mockResolvedValue(null);
    primaryBackend.getNotifications.mockResolvedValue([]);
    primaryBackend.getPendingNotifications.mockResolvedValue([]);
    primaryBackend.getFutureNotifications.mockResolvedValue([]);
    primaryBackend.getOneOffNotifications.mockResolvedValue([]);
    primaryBackend.filterAllInAppUnreadNotifications.mockResolvedValue([]);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.getNotification('notif-1');
    await service.getNotifications(1, 10);
    await service.getPendingNotifications(1, 10);
    await service.getFutureNotifications(1, 10);
    await service.getOneOffNotifications(1, 10);
    await service.getInAppUnread('user-1');

    expect(primaryBackend.getNotification).toHaveBeenCalledWith('notif-1', false);
    expect(primaryBackend.getNotifications).toHaveBeenCalledWith(1, 10);
    expect(primaryBackend.getPendingNotifications).toHaveBeenCalledWith(1, 10);
    expect(primaryBackend.getFutureNotifications).toHaveBeenCalledWith(1, 10);
    expect(primaryBackend.getOneOffNotifications).toHaveBeenCalledWith(1, 10);
    expect(primaryBackend.filterAllInAppUnreadNotifications).toHaveBeenCalledWith('user-1');

    expect(replicaBackend.getNotification).not.toHaveBeenCalled();
    expect(replicaBackend.getNotifications).not.toHaveBeenCalled();
  });

  it('routes getNotification to the specified backend identifier', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    replicaBackend.getNotification.mockResolvedValue(null);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.getNotification('notif-1', false, 'replica');

    expect(replicaBackend.getNotification).toHaveBeenCalledWith('notif-1', false);
    expect(primaryBackend.getNotification).not.toHaveBeenCalled();
  });

  it('throws clear error for invalid backend identifier in read methods', async () => {
    const primaryBackend = createMockBackend('primary');

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await expect(service.getNotification('notif-1', false, 'unknown')).rejects.toThrow(
      'Backend not found: unknown',
    );
  });

  it('routes getOneOffNotification and getNotifications to specified backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    replicaBackend.getOneOffNotification.mockResolvedValue(null);
    replicaBackend.getNotifications.mockResolvedValue([]);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.getOneOffNotification('oneoff-1', false, 'replica');
    await service.getNotifications(2, 20, 'replica');

    expect(replicaBackend.getOneOffNotification).toHaveBeenCalledWith('oneoff-1', false);
    expect(replicaBackend.getNotifications).toHaveBeenCalledWith(2, 20);
  });

  it('routes pending and future reads to specified backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    replicaBackend.getPendingNotifications.mockResolvedValue([]);
    replicaBackend.getFutureNotifications.mockResolvedValue([]);
    replicaBackend.getAllFutureNotifications.mockResolvedValue([]);
    replicaBackend.getFutureNotificationsFromUser.mockResolvedValue([]);
    replicaBackend.getAllFutureNotificationsFromUser.mockResolvedValue([]);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.getPendingNotifications(1, 10, 'replica');
    await service.getFutureNotifications(1, 10, 'replica');
    await service.getAllFutureNotifications('replica');
    await service.getFutureNotificationsFromUser('user-1', 1, 10, 'replica');
    await service.getAllFutureNotificationsFromUser('user-1', 'replica');

    expect(replicaBackend.getPendingNotifications).toHaveBeenCalledWith(1, 10);
    expect(replicaBackend.getFutureNotifications).toHaveBeenCalledWith(1, 10);
    expect(replicaBackend.getAllFutureNotifications).toHaveBeenCalled();
    expect(replicaBackend.getFutureNotificationsFromUser).toHaveBeenCalledWith('user-1', 1, 10);
    expect(replicaBackend.getAllFutureNotificationsFromUser).toHaveBeenCalledWith('user-1');
  });

  it('routes filterNotifications and getInAppUnread to specified backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const filter: NotificationFilterFields<Config> = { status: 'PENDING_SEND' };

    replicaBackend.filterNotifications.mockResolvedValue([]);
    replicaBackend.filterAllInAppUnreadNotifications.mockResolvedValue([]);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.filterNotifications(filter, 1, 25, undefined, 'replica');
    await service.getInAppUnread('user-1', 'replica');

    expect(replicaBackend.filterNotifications).toHaveBeenCalledWith(filter, 1, 25, undefined);
    expect(replicaBackend.filterAllInAppUnreadNotifications).toHaveBeenCalledWith('user-1');
  });

  it('forwards orderBy to the selected backend unchanged', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    const filter: NotificationFilterFields<Config> = { status: 'PENDING_SEND' };
    const ascOrderBy: NotificationOrderBy = { field: 'createdAt', direction: 'asc' };
    const descOrderBy: NotificationOrderBy = { field: 'createdAt', direction: 'desc' };

    replicaBackend.filterNotifications.mockResolvedValue([]);

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    await service.filterNotifications(filter, 1, 25, ascOrderBy, 'replica');
    await service.filterNotifications(filter, 1, 25, descOrderBy, 'replica');

    expect(replicaBackend.filterNotifications).toHaveBeenNthCalledWith(
      1,
      filter,
      1,
      25,
      ascOrderBy,
    );
    expect(replicaBackend.filterNotifications).toHaveBeenNthCalledWith(
      2,
      filter,
      1,
      25,
      descOrderBy,
    );
  });

  it('gets filter capabilities from the specified backend', async () => {
    const primaryBackend = createMockBackend('primary');
    const replicaBackend = createMockBackend('replica');

    primaryBackend.getFilterCapabilities.mockReturnValue({
      'fields.adapterUsed': true,
    });
    replicaBackend.getFilterCapabilities.mockReturnValue({
      'fields.adapterUsed': false,
      'logical.or': false,
      'orderBy.readAt': false,
      'orderBy.updatedAt': false,
    });

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaBackend],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    const capabilities = await service.getBackendSupportedFilterCapabilities('replica');

    expect(capabilities['fields.adapterUsed']).toBe(false);
    expect(capabilities['logical.or']).toBe(false);
    expect(capabilities['orderBy.sendAfter']).toBe(true);
    expect(capabilities['orderBy.sentAt']).toBe(true);
    expect(capabilities['orderBy.readAt']).toBe(false);
    expect(capabilities['orderBy.createdAt']).toBe(true);
    expect(capabilities['orderBy.updatedAt']).toBe(false);
  });

  it('exposes backend identifier management helpers', () => {
    const primaryBackend = createMockBackend('primary');
    const replicaA = createMockBackend('replica-a');
    const replicaB = createMockBackend('replica-b');

    const service = new VintaSendFactory<Config>().create({
      adapters: [adapter],
      backend: primaryBackend,
      additionalBackends: [replicaA, replicaB],
      logger,
      contextGeneratorsMap: contextGenerators,
    });

    expect(service.getPrimaryBackendIdentifier()).toBe('primary');
    expect(service.getAllBackendIdentifiers()).toEqual(['primary', 'replica-a', 'replica-b']);
    expect(service.getAdditionalBackendIdentifiers()).toEqual(['replica-a', 'replica-b']);
    expect(service.hasBackend('replica-a')).toBe(true);
    expect(service.hasBackend('unknown')).toBe(false);
  });
});
