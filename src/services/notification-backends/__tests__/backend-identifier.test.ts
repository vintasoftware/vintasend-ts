import type { BaseNotificationTypeConfig } from '../../../types/notification-type-config';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
  OneOffNotificationInput,
} from '../../../types/notification';
import type { AttachmentFileRecord } from '../../../types/attachment';
import type { InputJsonValue } from '../../../types/json-values';
import type {
  BaseNotificationBackend,
  NotificationFilter,
} from '../base-notification-backend';

type TestConfig = BaseNotificationTypeConfig & {
  ContextMap: {
    testContext: {
      generate: (params: { userId: string }) => Promise<{ value: string }>;
    };
  };
  NotificationIdType: string;
  UserIdType: string;
};

type BackendWithIdentifier = BaseNotificationBackend<TestConfig> & {
  getBackendIdentifier: () => string;
};

function createBackendBase(): BaseNotificationBackend<TestConfig> {
  return {
    getAllPendingNotifications: jest.fn().mockResolvedValue([]),
    getPendingNotifications: jest.fn().mockResolvedValue([]),
    getAllFutureNotifications: jest.fn().mockResolvedValue([]),
    getFutureNotifications: jest.fn().mockResolvedValue([]),
    getAllFutureNotificationsFromUser: jest.fn().mockResolvedValue([]),
    getFutureNotificationsFromUser: jest.fn().mockResolvedValue([]),
    persistNotification: jest
      .fn()
      .mockResolvedValue({} as unknown as DatabaseNotification<TestConfig>),
    getAllNotifications: jest.fn().mockResolvedValue([]),
    getNotifications: jest.fn().mockResolvedValue([]),
    bulkPersistNotifications: jest
      .fn()
      .mockResolvedValue([] as TestConfig['NotificationIdType'][]),
    persistNotificationUpdate: jest
      .fn()
      .mockResolvedValue({} as unknown as DatabaseNotification<TestConfig>),
    markAsSent: jest.fn().mockResolvedValue({} as unknown as AnyDatabaseNotification<TestConfig>),
    markAsFailed: jest.fn().mockResolvedValue({} as unknown as AnyDatabaseNotification<TestConfig>),
    markAsRead: jest.fn().mockResolvedValue({} as unknown as DatabaseNotification<TestConfig>),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getNotification: jest.fn().mockResolvedValue(null),
    filterAllInAppUnreadNotifications: jest.fn().mockResolvedValue([]),
    filterInAppUnreadNotifications: jest.fn().mockResolvedValue([]),
    getUserEmailFromNotification: jest.fn().mockResolvedValue(undefined),
    storeAdapterAndContextUsed: jest.fn().mockResolvedValue(undefined),
    persistOneOffNotification: jest
      .fn()
      .mockResolvedValue({} as unknown as DatabaseOneOffNotification<TestConfig>),
    persistOneOffNotificationUpdate: jest
      .fn()
      .mockResolvedValue({} as unknown as DatabaseOneOffNotification<TestConfig>),
    getOneOffNotification: jest.fn().mockResolvedValue(null),
    getAllOneOffNotifications: jest.fn().mockResolvedValue([]),
    getOneOffNotifications: jest.fn().mockResolvedValue([]),
    filterNotifications: jest.fn().mockResolvedValue([]),
    storeAttachmentFileRecord: jest.fn().mockResolvedValue(undefined),
    getAttachmentFileRecord: jest.fn().mockResolvedValue(null),
    getAttachmentFile: jest.fn().mockResolvedValue(null),
    findAttachmentFileByChecksum: jest.fn().mockResolvedValue(null),
    deleteAttachmentFile: jest.fn().mockResolvedValue(undefined),
    getOrphanedAttachmentFiles: jest.fn().mockResolvedValue([]),
    getAttachments: jest.fn().mockResolvedValue([]),
    deleteNotificationAttachment: jest.fn().mockResolvedValue(undefined),
  };
}

function createBackendWithIdentifier(identifier = 'default-backend'): BackendWithIdentifier {
  return {
    ...createBackendBase(),
    getBackendIdentifier: () => identifier,
  };
}

class LocalBackendWithIdentifier implements BackendWithIdentifier {
  constructor(private identifier = 'default-local-backend') {}

  getBackendIdentifier(): string {
    return this.identifier;
  }

  getAllPendingNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getPendingNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getAllFutureNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getFutureNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getAllFutureNotificationsFromUser(): Promise<DatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getFutureNotificationsFromUser(): Promise<DatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  persistNotification(
    _notification: Omit<Notification<TestConfig>, 'id'>,
  ): Promise<DatabaseNotification<TestConfig>> {
    return Promise.resolve({} as unknown as DatabaseNotification<TestConfig>);
  }
  getAllNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getNotifications(): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  bulkPersistNotifications(
    _notifications: Omit<AnyNotification<TestConfig>, 'id'>[],
  ): Promise<TestConfig['NotificationIdType'][]> {
    return Promise.resolve([]);
  }
  persistNotificationUpdate(): Promise<DatabaseNotification<TestConfig>> {
    return Promise.resolve({} as unknown as DatabaseNotification<TestConfig>);
  }
  markAsSent(): Promise<AnyDatabaseNotification<TestConfig>> {
    return Promise.resolve({} as unknown as AnyDatabaseNotification<TestConfig>);
  }
  markAsFailed(): Promise<AnyDatabaseNotification<TestConfig>> {
    return Promise.resolve({} as unknown as AnyDatabaseNotification<TestConfig>);
  }
  markAsRead(): Promise<DatabaseNotification<TestConfig>> {
    return Promise.resolve({} as unknown as DatabaseNotification<TestConfig>);
  }
  cancelNotification(): Promise<void> {
    return Promise.resolve();
  }
  getNotification(): Promise<AnyDatabaseNotification<TestConfig> | null> {
    return Promise.resolve(null);
  }
  filterAllInAppUnreadNotifications(): Promise<DatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  filterInAppUnreadNotifications(): Promise<DatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getUserEmailFromNotification(): Promise<string | undefined> {
    return Promise.resolve(undefined);
  }
  storeAdapterAndContextUsed(
    _notificationId: TestConfig['NotificationIdType'],
    _adapterKey: string,
    _context: InputJsonValue,
  ): Promise<void> {
    return Promise.resolve();
  }
  persistOneOffNotification(
    _notification: Omit<OneOffNotificationInput<TestConfig>, 'id'>,
  ): Promise<DatabaseOneOffNotification<TestConfig>> {
    return Promise.resolve({} as unknown as DatabaseOneOffNotification<TestConfig>);
  }
  persistOneOffNotificationUpdate(): Promise<DatabaseOneOffNotification<TestConfig>> {
    return Promise.resolve({} as unknown as DatabaseOneOffNotification<TestConfig>);
  }
  getOneOffNotification(): Promise<DatabaseOneOffNotification<TestConfig> | null> {
    return Promise.resolve(null);
  }
  getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  getOneOffNotifications(): Promise<DatabaseOneOffNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  filterNotifications(
    _filter: NotificationFilter<TestConfig>,
  ): Promise<AnyDatabaseNotification<TestConfig>[]> {
    return Promise.resolve([]);
  }
  storeAttachmentFileRecord(_record: AttachmentFileRecord): Promise<void> {
    return Promise.resolve();
  }
  getAttachmentFileRecord(): Promise<AttachmentFileRecord | null> {
    return Promise.resolve(null);
  }
  getAttachmentFile(): Promise<AttachmentFileRecord | null> {
    return Promise.resolve(null);
  }
  findAttachmentFileByChecksum(): Promise<AttachmentFileRecord | null> {
    return Promise.resolve(null);
  }
  deleteAttachmentFile(): Promise<void> {
    return Promise.resolve();
  }
  getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]> {
    return Promise.resolve([]);
  }
  getAttachments(): Promise<import('../../../types/attachment').StoredAttachment[]> {
    return Promise.resolve([]);
  }
  deleteNotificationAttachment(): Promise<void> {
    return Promise.resolve();
  }
}

class LocalBackendFactory {
  create(identifier?: string): BackendWithIdentifier {
    return new LocalBackendWithIdentifier(identifier);
  }
}

describe('Backend identifiers (Phase 1)', () => {
  it('keeps backward compatibility for backends without getBackendIdentifier', () => {
    const backend = createBackendBase();
    expect(typeof backend.getBackendIdentifier).toBe('undefined');
  });

  it('returns default identifier when no custom identifier is provided', () => {
    const backend = new LocalBackendWithIdentifier();
    expect(backend.getBackendIdentifier()).toBe('default-local-backend');
  });

  it('returns custom identifier when provided', () => {
    const backend = createBackendWithIdentifier('primary-backend');
    expect(backend.getBackendIdentifier()).toBe('primary-backend');
  });

  it('returns stable identifier across multiple calls', () => {
    const backend = createBackendWithIdentifier('stable-backend-id');
    expect(backend.getBackendIdentifier()).toBe('stable-backend-id');
    expect(backend.getBackendIdentifier()).toBe('stable-backend-id');
    expect(backend.getBackendIdentifier()).toBe('stable-backend-id');
  });

  it('returns different identifiers for different instances', () => {
    const backendA = createBackendWithIdentifier('backend-a');
    const backendB = createBackendWithIdentifier('backend-b');
    expect(backendA.getBackendIdentifier()).toBe('backend-a');
    expect(backendB.getBackendIdentifier()).toBe('backend-b');
    expect(backendA.getBackendIdentifier()).not.toBe(backendB.getBackendIdentifier());
  });

  it('local factory creates backends with default and custom identifiers', () => {
    const factory = new LocalBackendFactory();
    const defaultBackend = factory.create();
    const customBackend = factory.create('factory-backend');

    expect(defaultBackend.getBackendIdentifier()).toBe('default-local-backend');
    expect(customBackend.getBackendIdentifier()).toBe('factory-backend');
  });
});
