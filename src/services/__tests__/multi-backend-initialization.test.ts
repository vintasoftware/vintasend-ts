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

type MockBackend = vi.Mocked<BaseNotificationBackend<Config>> & {
  injectLogger: vi.Mock;
  injectAttachmentManager: vi.Mock;
  getBackendIdentifier?: () => string;
};

type ServiceInternals = {
  getBackend: (identifier?: string) => BaseNotificationBackend<Config>;
  getAdditionalBackends: () => BaseNotificationBackend<Config>[];
};

const mockTemplateRenderer: vi.Mocked<BaseEmailTemplateRenderer<Config>> = {
  render: vi.fn(),
  renderFromTemplateContent: vi.fn(),
};

const mockLogger: vi.Mocked<BaseLogger> = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

// biome-ignore lint/suspicious/noExplicitAny: testing adapter mocking
const mockAdapter: vi.Mocked<BaseNotificationAdapter<any, Config>> = {
  notificationType: 'EMAIL',
  key: 'adapter-1',
  enqueueNotifications: false,
  send: vi.fn(),
  injectBackend: vi.fn(),
  injectLogger: vi.fn(),
  backend: null,
  templateRenderer: mockTemplateRenderer,
  logger: mockLogger,
  supportsAttachments: false,
  // biome-ignore lint/suspicious/noExplicitAny: test-only mock
} as any;

const contextGenerators: ContextGenerators = {
  testContext: {
    generate: vi.fn(),
  },
};

function createMockBackend(identifier?: string): MockBackend {
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
    ...(identifier
      ? {
          getBackendIdentifier: () => identifier,
        }
      : {}),
  } as unknown as MockBackend;
}

function createMockAttachmentManager(): BaseAttachmentManager {
  return {
    uploadFile: vi.fn(),
    reconstructAttachmentFile: vi.fn(),
    deleteFileByIdentifiers: vi.fn(),
  } as unknown as BaseAttachmentManager;
}

describe('VintaSend multi-backend initialization (Phase 3)', () => {
  function asInternals(service: unknown): ServiceInternals {
    return service as ServiceInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
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
