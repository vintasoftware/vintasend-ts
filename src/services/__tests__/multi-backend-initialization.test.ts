import { VintaSendFactory } from '../../index';
import type { BaseAttachmentManager } from '../attachment-manager/base-attachment-manager';
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
  getBackendIdentifier?: () => string;
};

type ServiceInternals = {
  getBackend: (identifier?: string) => BaseNotificationBackend<Config>;
  getAdditionalBackends: () => BaseNotificationBackend<Config>[];
};

const mockTemplateRenderer: jest.Mocked<BaseEmailTemplateRenderer<Config>> = {
  render: jest.fn(),
  renderFromTemplateContent: jest.fn(),
};

const mockLogger: jest.Mocked<BaseLogger> = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: testing adapter mocking
const mockAdapter: jest.Mocked<BaseNotificationAdapter<any, Config>> = {
  notificationType: 'EMAIL',
  key: 'adapter-1',
  enqueueNotifications: false,
  send: jest.fn(),
  injectBackend: jest.fn(),
  injectLogger: jest.fn(),
  backend: null,
  templateRenderer: mockTemplateRenderer,
  logger: mockLogger,
  supportsAttachments: false,
  // biome-ignore lint/suspicious/noExplicitAny: test-only mock
} as any;

const contextGenerators: ContextGenerators = {
  testContext: {
    generate: jest.fn(),
  },
};

function createMockBackend(identifier?: string): MockBackend {
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
    ...(identifier
      ? {
          getBackendIdentifier: () => identifier,
        }
      : {}),
  } as unknown as MockBackend;
}

function createMockAttachmentManager(): BaseAttachmentManager {
  return {
    uploadFile: jest.fn(),
    reconstructAttachmentFile: jest.fn(),
    deleteFileByIdentifiers: jest.fn(),
  } as unknown as BaseAttachmentManager;
}

describe('VintaSend multi-backend initialization (Phase 3)', () => {
  function asInternals(service: unknown): ServiceInternals {
    return service as ServiceInternals;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes with single backend (backward compatibility)', () => {
    const primaryBackend = createMockBackend('primary');

    const service = new VintaSendFactory<Config>().create({
      adapters: [mockAdapter],
      backend: primaryBackend,
      logger: mockLogger,
      contextGeneratorsMap: contextGenerators,
    });

    expect(mockAdapter.injectBackend).toHaveBeenCalledWith(primaryBackend);
    expect(mockAdapter.injectLogger).toHaveBeenCalledWith(mockLogger);
    expect(primaryBackend.injectLogger).toHaveBeenCalledWith(mockLogger);
    expect(asInternals(service).getBackend()).toBe(primaryBackend);
    expect(asInternals(service).getAdditionalBackends()).toEqual([]);
  });

  it('initializes with primary plus additional backends', () => {
    const primaryBackend = createMockBackend('primary-backend');
    const additionalBackendA = createMockBackend('replica-a');
    const additionalBackendB = createMockBackend('replica-b');

    const service = new VintaSendFactory<Config>().create({
      adapters: [mockAdapter],
      backend: primaryBackend,
      additionalBackends: [additionalBackendA, additionalBackendB],
      logger: mockLogger,
      contextGeneratorsMap: contextGenerators,
    });

    expect(asInternals(service).getBackend()).toBe(primaryBackend);
    expect(asInternals(service).getBackend('primary-backend')).toBe(primaryBackend);
    expect(asInternals(service).getBackend('replica-a')).toBe(additionalBackendA);
    expect(asInternals(service).getBackend('replica-b')).toBe(additionalBackendB);
    expect(asInternals(service).getAdditionalBackends()).toEqual([
      additionalBackendA,
      additionalBackendB,
    ]);
  });

  it('throws when additional backend has duplicate identifier', () => {
    const primaryBackend = createMockBackend('shared-id');
    const additionalBackend = createMockBackend('shared-id');

    expect(() =>
      new VintaSendFactory<Config>().create({
        adapters: [mockAdapter],
        backend: primaryBackend,
        additionalBackends: [additionalBackend],
        logger: mockLogger,
        contextGeneratorsMap: contextGenerators,
      }),
    ).toThrow('Duplicate backend identifier: shared-id');
  });

  it('injects logger and attachment manager into all backends', () => {
    const primaryBackend = createMockBackend('primary');
    const additionalBackendA = createMockBackend('replica-a');
    const additionalBackendB = createMockBackend('replica-b');
    const attachmentManager = createMockAttachmentManager();

    new VintaSendFactory<Config>().create({
      adapters: [mockAdapter],
      backend: primaryBackend,
      additionalBackends: [additionalBackendA, additionalBackendB],
      logger: mockLogger,
      contextGeneratorsMap: contextGenerators,
      attachmentManager,
    });

    expect(primaryBackend.injectLogger).toHaveBeenCalledWith(mockLogger);
    expect(additionalBackendA.injectLogger).toHaveBeenCalledWith(mockLogger);
    expect(additionalBackendB.injectLogger).toHaveBeenCalledWith(mockLogger);

    expect(primaryBackend.injectAttachmentManager).toHaveBeenCalledWith(attachmentManager);
    expect(additionalBackendA.injectAttachmentManager).toHaveBeenCalledWith(attachmentManager);
    expect(additionalBackendB.injectAttachmentManager).toHaveBeenCalledWith(attachmentManager);
  });

  it('factory deprecated signature accepts additionalBackends', () => {
    const primaryBackend = createMockBackend('primary');
    const additionalBackend = createMockBackend('replica-a');

    const service = new VintaSendFactory<Config>().create(
      [mockAdapter],
      primaryBackend,
      mockLogger,
      contextGenerators,
      undefined,
      undefined,
      undefined,
      undefined,
      [additionalBackend],
    );

    expect(asInternals(service).getBackend('replica-a')).toBe(additionalBackend);
    expect(asInternals(service).getAdditionalBackends()).toEqual([additionalBackend]);
  });

  it('assigns fallback identifiers for backends without getBackendIdentifier', () => {
    const primaryBackend = createMockBackend();
    const additionalBackend = createMockBackend();

    const service = new VintaSendFactory<Config>().create({
      adapters: [mockAdapter],
      backend: primaryBackend,
      additionalBackends: [additionalBackend],
      logger: mockLogger,
      contextGeneratorsMap: contextGenerators,
    });

    expect(asInternals(service).getBackend('backend-0')).toBe(primaryBackend);
    expect(asInternals(service).getBackend('backend-1')).toBe(additionalBackend);
  });

  it('throws when requesting an unknown backend identifier', () => {
    const primaryBackend = createMockBackend('primary');
    const service = new VintaSendFactory<Config>().create({
      adapters: [mockAdapter],
      backend: primaryBackend,
      logger: mockLogger,
      contextGeneratorsMap: contextGenerators,
    });

    expect(() => asInternals(service).getBackend('unknown-backend')).toThrow(
      'Backend not found: unknown-backend',
    );
  });
});
