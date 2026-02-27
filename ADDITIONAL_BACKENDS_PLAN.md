# Additional Backends Implementation Plan

## Overview

This plan outlines the implementation of multi-backend support for VintaSend, allowing notifications to be saved to a primary backend and optionally replicated to additional backends for redundancy, data distribution, or migration purposes.

## Goals

1. Enable VintaSend to be configured with multiple backends (1 primary + N additional)
2. All write operations must succeed on the primary backend before propagating to additional backends
3. Read operations should support an optional backend identifier to query specific backends
4. Maintain full backward compatibility with existing single-backend implementations
5. Ensure failures in additional backends don't block the primary operation

## Architecture Principles

- **Primary Backend First**: All write operations happen on the primary backend first
- **Best Effort Replication**: Additional backends receive updates on a best-effort basis
- **Fail-Safe**: Failures in additional backends are logged but don't fail the operation
- **Optional Backend Selection**: Read methods accept optional backend identifier for targeted queries
- **Backward Compatible**: Existing code continues to work without modification

---

## Phase 1: Add Backend Identifiers

### Objective
Add a unique identifier property to all backends to enable backend selection.

### Changes Required

#### 1.1 Update `BaseNotificationBackend` Interface
- Add optional `getBackendIdentifier(): string` method to the interface
- Document that this should return a unique, stable identifier for the backend instance
- Default behavior: if not implemented, use a fallback identifier strategy

**File**: `src/services/notification-backends/base-notification-backend.ts`

```typescript
export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  // ... existing methods ...
  
  /**
   * Get a unique identifier for this backend instance.
   * Used to distinguish between multiple backend instances in a multi-backend setup.
   * 
   * @returns A stable, unique identifier for this backend (e.g., "primary-postgres", "replica-medplum")
   * 
   * @example
   * // In backend constructor:
   * constructor(private identifier: string = "default") {}
   * 
   * getBackendIdentifier(): string {
   *   return this.identifier;
   * }
   */
  getBackendIdentifier?(): string;
}
```

#### 1.2 Update `PrismaNotificationBackend`
- Add `identifier` property to constructor (with default value for backward compatibility)
- Implement `getBackendIdentifier()` method

**File**: `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`

```typescript
export class PrismaNotificationBackend<...> implements BaseNotificationBackend<Config> {
  private logger?: BaseLogger;

  constructor(
    private prismaClient: Client,
    private attachmentManager?: BaseAttachmentManager,
    private identifier: string = 'default-prisma',
  ) {}
  
  getBackendIdentifier(): string {
    return this.identifier;
  }
  
  // ... rest of implementation
}
```

#### 1.3 Update `MedplumNotificationBackend`
- Add `identifier` property to constructor options (with default value)
- Implement `getBackendIdentifier()` method

**File**: `src/implementations/vintasend-medplum/src/medplum-backend.ts`

```typescript
type MedplumNotificationBackendOptions = {
  emailNotificationSubjectExtensionUrl?: string;
  identifier?: string;
};

export class MedplumNotificationBackend<...> implements BaseNotificationBackend<Config> {
  private identifier: string;
  
  constructor(
    private medplum: MedplumClient,
    private options: MedplumNotificationBackendOptions = {
      emailNotificationSubjectExtensionUrl: '...',
      identifier: 'default-medplum',
    }
  ) {
    this.identifier = options.identifier || 'default-medplum';
  }
  
  getBackendIdentifier(): string {
    return this.identifier;
  }
  
  // ... rest of implementation
}
```

#### 1.4 Update Backend Factories
- Update `PrismaNotificationBackendFactory` to accept optional identifier
- Update `MedplumNotificationBackendFactory` to accept optional identifier

### Tests Required

**Test File**: `src/services/notification-backends/__tests__/backend-identifier.test.ts`

- ✅ Test that backends return default identifier when none provided
- ✅ Test that backends return custom identifier when provided
- ✅ Test that identifier is stable across multiple calls
- ✅ Test backward compatibility: backends work without identifier parameter
- ✅ Test that two instances with different identifiers return different values
- ✅ Test PrismaNotificationBackend with custom identifier
- ✅ Test MedplumNotificationBackend with custom identifier
- ✅ Test factories create backends with correct identifiers

### Acceptance Criteria

- [ ] All backends implement `getBackendIdentifier()` method
- [ ] Default identifiers are assigned when not specified
- [ ] Custom identifiers can be provided during construction
- [ ] All existing tests pass (backward compatibility)
- [ ] New identifier tests pass

---

## Phase 2: Support creating notifications with a predefined ID

### Objective
Adjust VintaSend Backend interface and implementations (prisma-notification-backend.ts and medplum-backend.ts) to support creating notifications with a predefined `id` if passed. This will allow us to match the id when creating notifications in multiple backends.

### Changes Required

#### 2.1 Update `NotificationInput` Type and other related types
- Add the id field as optional

#### 2.2 Update PrismaNotificationBackend.persistNotification method to support saving the notification with a pre-defined id
- Update the method to support it, if not already supported

#### 2.3 Update MedplumNotificationBackend.persistNotification method to support saving the notification with a pre-defined id
- Update the method to support it, if not already supported

### Tests Required

**Test File**: `src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend.test.ts`

- ✅ Test calling persistNotification with an input containing an id


**Test File**: `src/implementations/vintasend-medplum/src/__tests__/medplum-backend.test.ts`

- ✅ Test calling persistNotification with an input containing an id

### Acceptance Criteria

- [ ] `persistNotification` accepts optional predefined `id` in backend interface
- [ ] Prisma backend persists notifications with predefined `id`
- [ ] Medplum backend persists notifications with predefined `id`
- [ ] Existing calls without `id` keep current behavior (backward compatibility)
- [ ] Phase 2 backend tests pass

---


## Phase 3: Update VintaSend to Support Multiple Backends

### Objective
Modify VintaSend service to accept and manage multiple backends (primary + additional).

### Changes Required

#### 3.1 Update `VintaSendFactoryCreateParams` Type
- Add `additionalBackends` optional parameter (array)
- Maintain `backend` as the primary backend

**File**: `src/services/notification-service.ts`

```typescript
type VintaSendFactoryCreateParams<...> = {
  adapters: AdaptersList;
  backend: Backend;  // Primary backend
  additionalBackends?: Backend[];  // Optional additional backends
  logger: Logger;
  contextGeneratorsMap: BaseNotificationTypeConfig['ContextMap'];
  queueService?: QueueService;
  attachmentManager?: AttachmentMgr;
  options?: VintaSendOptions;
  gitCommitShaProvider?: BaseGitCommitShaProvider;
};
```

#### 3.2 Update `VintaSend` Class Constructor
- Accept `additionalBackends` parameter
- Store backends in a map keyed by identifier
- Maintain `this.backend` for primary backend (backward compatibility)
- Create `this.backends` map for all backends

```typescript
export class VintaSend<..., AdditionalBackends extends BaseNotificationBackedn<Config>[]> {
  private contextGeneratorsMap: NotificationContextGeneratorsMap<Config['ContextMap']>;
  private backends: Map<string, Backend>;  // All backends by identifier
  private primaryBackendIdentifier: string;
  
  constructor(
    private adapters: AdaptersList,
    private backend: Backend,  // Primary backend (backward compatibility)
    private logger: Logger,
    contextGeneratorsMap: Config['ContextMap'],
    private queueService?: QueueService,
    private attachmentManager?: AttachmentMgr,
    private options: VintaSendOptions = { raiseErrorOnFailedSend: false },
    private gitCommitShaProvider?: BaseGitCommitShaProvider,
    private additionalBackends: AdditionalBackends = [],
  ) {
    // Initialize backends map
    this.backends = new Map();
    
    // Add primary backend
    const primaryId = this.getBackendIdentifier(backend);
    this.primaryBackendIdentifier = primaryId;
    this.backends.set(primaryId, backend);
    
    // Add additional backends
    for (const additionalBackend of additionalBackends) {
      const id = this.getBackendIdentifier(additionalBackend);
      if (this.backends.has(id)) {
        throw new Error(`Duplicate backend identifier: ${id}`);
      }
      this.backends.set(id, additionalBackend);
      
      // Inject logger and attachment manager into additional backends
      if (typeof additionalBackend.injectLogger === 'function') {
        additionalBackend.injectLogger(logger);
      }
      if (this.attachmentManager && hasAttachmentManagerInjection(additionalBackend)) {
        additionalBackend.injectAttachmentManager(this.attachmentManager);
      }
    }
    
    // ... rest of initialization
  }
  
  private getBackendIdentifier(backend: Backend): string {
    if (typeof backend.getBackendIdentifier === 'function') {
      return backend.getBackendIdentifier();
    }
    // Fallback: use object identity/counter for backends without identifier
    return `backend-${this.backends.size}`;
  }
  
  private getBackend(identifier?: string): Backend {
    if (!identifier) {
      return this.backend; // Primary backend
    }
    const backend = this.backends.get(identifier);
    if (!backend) {
      throw new Error(`Backend not found: ${identifier}`);
    }
    return backend;
  }
  
  private getAdditionalBackends(): Backend[] {
    return Array.from(this.backends.values()).filter(
      (b) => this.getBackendIdentifier(b) !== this.primaryBackendIdentifier
    );
  }
}
```

#### 3.3 Update Factory `create` Methods
- Add `additionalBackends` to both overload signatures
- Maintain backward compatibility with deprecated positional signature

```typescript
export class VintaSendFactory<Config extends BaseNotificationTypeConfig> {
  create<...>(
    params: VintaSendFactoryCreateParams<...>,
  ): VintaSend<...>;

  /** @deprecated Use the object parameter overload instead. */
  create<...>(
    adapters: AdaptersList,
    backend: Backend,
    logger: Logger,
    contextGeneratorsMap: BaseNotificationTypeConfig['ContextMap'],
    queueService?: QueueService,
    attachmentManager?: AttachmentMgr,
    options?: VintaSendOptions,
    gitCommitShaProvider?: BaseGitCommitShaProvider,
    additionalBackends?: Backend[],  // Add here for backward compat
  ): VintaSend<...>;
  
  // Implementation handles both signatures
}
```

### Tests Required

**Test File**: `src/services/__tests__/multi-backend-initialization.test.ts`

- ✅ Test VintaSend initializes with single backend (backward compatibility)
- ✅ Test VintaSend initializes with primary + additional backends
- ✅ Test backend identifier uniqueness validation (should throw on duplicates)
- ✅ Test logger injection into all backends
- ✅ Test attachment manager injection into all backends
- ✅ Test `getBackend()` returns primary backend when no identifier specified
- ✅ Test `getBackend(identifier)` returns correct backend
- ✅ Test `getBackend(invalid_identifier)` throws error
- ✅ Test `getAdditionalBackends()` returns only additional backends
- ✅ Test factory creates VintaSend with additional backends
- ✅ Test backward compatibility: factory works with old signature
- ✅ Test backends without `getBackendIdentifier()` get fallback identifiers

### Acceptance Criteria

- [ ] VintaSend accepts multiple backends
- [ ] Primary backend is tracked separately
- [ ] Backends are accessible by identifier
- [ ] Duplicate identifiers are rejected
- [ ] Logger and attachment manager injected into all backends
- [ ] All existing tests pass (backward compatibility)
- [ ] New multi-backend initialization tests pass

---

## Phase 4: Implement Multi-Backend Write Operations

### Objective
Update all write operations to save to primary backend first, then replicate to additional backends.

### Changes Required

#### 4.1 Create Helper Method for Multi-Backend Writes

```typescript
export class VintaSend<...> {
  /**
   * Execute a write operation on primary backend, then replicate to additional backends.
   * Failures in additional backends are logged but don't fail the operation.
   * 
   * @param operation - Description of the operation for logging
   * @param primaryWrite - Function to execute on primary backend
   * @param additionalWrite - Function to execute on each additional backend
   * @returns Result from primary backend
   */
  private async executeMultiBackendWrite<T>(
    operation: string,
    primaryWrite: (backend: Backend) => Promise<T>,
    additionalWrite?: (backend: Backend, primaryResult: T) => Promise<void>,
  ): Promise<T> {
    // Execute on primary backend first
    const primaryResult = await primaryWrite(this.backend);
    this.logger.info(`${operation} completed on primary backend`);
    
    // Replicate to additional backends (best effort)
    if (additionalWrite) {
      const additionalBackends = this.getAdditionalBackends();
      for (const backend of additionalBackends) {
        try {
          await additionalWrite(backend, primaryResult);
          const backendId = this.getBackendIdentifier(backend);
          this.logger.info(`${operation} replicated to backend: ${backendId}`);
        } catch (error) {
          const backendId = this.getBackendIdentifier(backend);
          this.logger.error(
            `Failed to replicate ${operation} to backend ${backendId}:`,
            error
          );
          // Don't throw - continue with other backends
        }
      }
    }
    
    return primaryResult;
  }
}
```

#### 4.2 Update Write Methods

Update these methods to use `executeMultiBackendWrite`:

1. **`createNotification`**
```typescript
async createNotification(
  notification: Omit<Notification<Config>, 'id'>,
): Promise<DatabaseNotification<Config>> {
  return this.executeMultiBackendWrite(
    'createNotification',
    async (backend) => {
      const created = await backend.persistNotification(notification);
      this.logger.info(`Notification ${created.id} created`);
      
      // Queue logic (only for primary)
      if (!notification.sendAfter || notification.sendAfter <= new Date()) {
        if (this.queueService) {
          await this.queueService.sendNotification(created.id);
        } else {
          await this.send(created);
        }
      } else {
        if (this.queueService) {
          this.queueService.scheduleNotification(created.id, notification.sendAfter);
        }
      }
      
      return created;
    },
    async (backend, primaryResult) => {
      // Replicate with same ID from primary
      const notificationWithId = {
        ...notification,
        id: primaryResult.id,
        createdAt: primaryResult.createdAt,
        updatedAt: primaryResult.updatedAt,
      };
      await backend.persistNotification(notificationWithId);
    },
  );
}
```

2. **`updateNotification`**
3. **`createOneOffNotification`**
4. **`updateOneOffNotification`**
5. **`markRead`**
6. **`cancelNotification`**
7. **`bulkPersistNotifications`**
8. **`storeAdapterAndContextUsed`** (called from `send` method)
9. **`markAsSent`** and **`markAsFailed`** (called from `send` method)

#### 4.3 Handle Special Cases

**Attachment Operations**: When storing attachments, replicate file records and associations:
- `storeAttachmentFileRecord`
- `deleteAttachmentFile`
- `deleteNotificationAttachment`

**Transaction Boundaries**: For backends that use transactions (like Prisma), ensure replication happens after primary transaction commits.

### Tests Required

**Test File**: `src/services/__tests__/multi-backend-writes.test.ts`

- ✅ Test `createNotification` writes to primary then additional backends
- ✅ Test `updateNotification` replicates to additional backends
- ✅ Test `createOneOffNotification` replicates to additional backends
- ✅ Test `updateOneOffNotification` replicates to additional backends
- ✅ Test `markRead` replicates to additional backends
- ✅ Test `cancelNotification` replicates to additional backends
- ✅ Test `bulkPersistNotifications` replicates to additional backends
- ✅ Test failure in primary backend stops operation (doesn't replicate)
- ✅ Test failure in additional backend doesn't fail operation
- ✅ Test failure in additional backend is logged
- ✅ Test send operations update `adapterUsed` and `contextUsed` on all backends
- ✅ Test `markAsSent` and `markAsFailed` replicate during send
- ✅ Test attachment operations replicate to additional backends
- ✅ Test notification IDs are consistent across backends
- ✅ Test timestamps are consistent across backends
- ✅ Test all backends contain the same data after operations
- ✅ Test single-backend mode still works (backward compatibility)

**Test File**: `src/services/__tests__/multi-backend-error-handling.test.ts`

- ✅ Test partial failure scenarios (some additional backends fail)
- ✅ Test all additional backends fail (operation still succeeds)
- ✅ Test error messages contain backend identifier
- ✅ Test operation continues after backend failure
- ✅ Test multiple consecutive failures are all logged

### Acceptance Criteria

- [ ] All write operations replicate to additional backends
- [ ] Primary backend writes complete before replication
- [ ] Failures in additional backends are logged but don't fail operations
- [ ] Notification IDs are consistent across backends
- [ ] Queue operations only happen for primary backend
- [ ] All existing tests pass
- [ ] New multi-backend write tests pass
- [ ] Error handling tests pass

---

## Phase 5: Implement Multi-Backend Read Operations

### Objective
Add optional `backendIdentifier` parameter to all read methods for targeted queries.

### Changes Required

#### 5.1 Update Read Method Signatures

Add optional `backendIdentifier?: string` parameter to these methods:

1. **`getNotification`**
```typescript
async getNotification(
  notificationId: Config['NotificationIdType'],
  forUpdate = false,
  backendIdentifier?: string,
): Promise<AnyDatabaseNotification<Config> | null> {
  const backend = this.getBackend(backendIdentifier);
  return backend.getNotification(notificationId, forUpdate);
}
```

2. **`getOneOffNotification`**
```typescript
async getOneOffNotification(
  notificationId: Config['NotificationIdType'],
  forUpdate = false,
  backendIdentifier?: string,
): Promise<DatabaseOneOffNotification<Config> | null> {
  const backend = this.getBackend(backendIdentifier);
  return backend.getOneOffNotification(notificationId, forUpdate);
}
```

3. **`getNotifications`** (list with pagination)
4. **`getOneOffNotifications`**
5. **`getPendingNotifications`**
6. **`getFutureNotifications`**
7. **`getFutureNotificationsFromUser`**
8. **`getAllFutureNotifications`**
9. **`getAllFutureNotificationsFromUser`**
10. **`getInAppUnread`**
11. **`filterNotifications`**
12. **`getBackendSupportedFilterCapabilities`**

#### 5.2 Add Backend Listing Methods

```typescript
export class VintaSend<...> {
  /**
   * Get the identifier of the primary backend.
   */
  getPrimaryBackendIdentifier(): string {
    return this.primaryBackendIdentifier;
  }
  
  /**
   * Get identifiers of all configured backends.
   */
  getAllBackendIdentifiers(): string[] {
    return Array.from(this.backends.keys());
  }
  
  /**
   * Get identifiers of additional (non-primary) backends.
   */
  getAdditionalBackendIdentifiers(): string[] {
    return this.getAllBackendIdentifiers().filter(
      (id) => id !== this.primaryBackendIdentifier
    );
  }
  
  /**
   * Check if a backend with the given identifier exists.
   */
  hasBackend(identifier: string): boolean {
    return this.backends.has(identifier);
  }
}
```

#### 5.3 Update Internal Methods

Methods like `sendPendingNotifications` and `delayedSend` should always use the primary backend:

```typescript
async sendPendingNotifications(): Promise<void> {
  // Always use primary backend for batch operations
  const notifications = await this.backend.getAllPendingNotifications();
  // ...
}
```

### Tests Required

**Test File**: `src/services/__tests__/multi-backend-reads.test.ts`

- ✅ Test `getNotification` without backend param uses primary
- ✅ Test `getNotification` with backend param uses specified backend
- ✅ Test `getNotification` with invalid backend throws error
- ✅ Test `getOneOffNotification` with backend selection
- ✅ Test `getNotifications` with backend selection
- ✅ Test `getPendingNotifications` with backend selection
- ✅ Test `getFutureNotifications` with backend selection
- ✅ Test `filterNotifications` with backend selection
- ✅ Test `getInAppUnread` with backend selection
- ✅ Test `getBackendSupportedFilterCapabilities` for specific backend
- ✅ Test `getPrimaryBackendIdentifier` returns correct value
- ✅ Test `getAllBackendIdentifiers` returns all backend IDs
- ✅ Test `getAdditionalBackendIdentifiers` returns only additional IDs
- ✅ Test `hasBackend` returns true for existing backends
- ✅ Test `hasBackend` returns false for non-existent backends
- ✅ Test backward compatibility: methods work without backend param

**Test File**: `src/services/__tests__/multi-backend-read-consistency.test.ts`

- ✅ Test data consistency: same notification read from different backends
- ✅ Test reading from all backends returns same data after write
- ✅ Test pending notifications consistent across backends
- ✅ Test future notifications consistent across backends
- ✅ Test filter results consistent across backends

### Acceptance Criteria

- [ ] All read methods accept optional `backendIdentifier` parameter
- [ ] Methods default to primary backend when parameter not provided
- [ ] Methods query specified backend when parameter provided
- [ ] Invalid backend identifier throws clear error
- [ ] Backend listing methods return correct identifiers
- [ ] Internal batch operations use primary backend
- [ ] All existing tests pass (backward compatibility)
- [ ] New multi-backend read tests pass
- [ ] Data consistency tests pass

---

## Phase 6: Add Backend Management Operations

### Objective
Provide utilities for managing and monitoring multiple backends.

### Changes Required

#### 6.1 Add Backend Sync Verification

```typescript
export class VintaSend<...> {
  /**
   * Verify that a notification exists and matches across all backends.
   * Returns a report of discrepancies.
   */
  async verifyNotificationSync(
    notificationId: Config['NotificationIdType'],
  ): Promise<{
    synced: boolean;
    backends: {
      [identifier: string]: {
        exists: boolean;
        notification?: AnyDatabaseNotification<Config>;
        error?: string;
      };
    };
    discrepancies: string[];
  }> {
    const report = {
      synced: true,
      backends: {} as any,
      discrepancies: [] as string[],
    };
    
    // Query all backends
    for (const [identifier, backend] of this.backends) {
      try {
        const notification = await backend.getNotification(notificationId, false);
        report.backends[identifier] = {
          exists: notification !== null,
          notification: notification || undefined,
        };
      } catch (error) {
        report.backends[identifier] = {
          exists: false,
          error: String(error),
        };
        report.discrepancies.push(`Backend ${identifier}: ${error}`);
      }
    }
    
    // Check for discrepancies
    const primaryNotification = report.backends[this.primaryBackendIdentifier]?.notification;
    if (!primaryNotification) {
      report.synced = false;
      report.discrepancies.push('Notification not found in primary backend');
      return report;
    }
    
    for (const [identifier, info] of Object.entries(report.backends)) {
      if (identifier === this.primaryBackendIdentifier) continue;
      
      if (!info.exists) {
        report.synced = false;
        report.discrepancies.push(`Notification missing in backend: ${identifier}`);
      } else if (info.notification) {
        // Compare key fields
        const notif = info.notification as any;
        if (notif.status !== primaryNotification.status) {
          report.discrepancies.push(
            `Status mismatch in ${identifier}: ${notif.status} vs ${primaryNotification.status}`
          );
          report.synced = false;
        }
        // Add more field comparisons as needed
      }
    }
    
    return report;
  }
  
  /**
   * Manually replicate a notification from primary to additional backends.
   * Useful for recovery after backend failures.
   */
  async replicateNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<{ successes: string[]; failures: { backend: string; error: string }[] }> {
    const result = { successes: [] as string[], failures: [] as any[] };
    
    // Get from primary
    const notification = await this.backend.getNotification(notificationId, false);
    if (!notification) {
      throw new Error(`Notification ${notificationId} not found in primary backend`);
    }
    
    // Replicate to additional backends
    for (const backend of this.getAdditionalBackends()) {
      const identifier = this.getBackendIdentifier(backend);
      try {
        // Check if exists
        const existing = await backend.getNotification(notificationId, false);
        if (existing) {
          // Update
          await backend.persistNotificationUpdate(notificationId, notification as any);
        } else {
          // Create
          await backend.persistNotification(notification as any);
        }
        result.successes.push(identifier);
      } catch (error) {
        result.failures.push({ backend: identifier, error: String(error) });
      }
    }
    
    return result;
  }
  
  /**
   * Get sync status statistics across all backends.
   */
  async getBackendSyncStats(): Promise<{
    backends: {
      [identifier: string]: {
        totalNotifications: number;
        status: 'healthy' | 'error';
        error?: string;
      };
    };
  }> {
    const stats = { backends: {} as any };
    
    for (const [identifier, backend] of this.backends) {
      try {
        const notifications = await backend.getAllNotifications();
        stats.backends[identifier] = {
          totalNotifications: notifications.length,
          status: 'healthy' as const,
        };
      } catch (error) {
        stats.backends[identifier] = {
          totalNotifications: 0,
          status: 'error' as const,
          error: String(error),
        };
      }
    }
    
    return stats;
  }
}
```

#### 6.2 Add Migration Enhancement

Update existing `migrateToBackend` to handle multi-backend scenarios:

```typescript
/**
 * Migrate all notifications to a destination backend.
 * If multi-backend mode is enabled, migrates from primary backend only.
 */
async migrateToBackend<DestinationBackend extends BaseNotificationBackend<Config>>(
  destinationBackend: DestinationBackend,
  batchSize = 5000,
  sourceBackendIdentifier?: string,  // NEW: optional source backend
): Promise<void> {
  const sourceBackend = this.getBackend(sourceBackendIdentifier);
  const allNotifications = await sourceBackend.getAllNotifications();
  
  // ... existing migration logic using sourceBackend instead of this.backend
}
```

### Tests Required

**Test File**: `src/services/__tests__/multi-backend-management.test.ts`

- ✅ Test `verifyNotificationSync` with synced notification
- ✅ Test `verifyNotificationSync` with missing notification in additional backend
- ✅ Test `verifyNotificationSync` with status mismatch
- ✅ Test `verifyNotificationSync` with primary backend missing notification
- ✅ Test `replicateNotification` creates in additional backends
- ✅ Test `replicateNotification` updates existing in additional backends
- ✅ Test `replicateNotification` handles partial failures
- ✅ Test `replicateNotification` throws when not in primary
- ✅ Test `getBackendSyncStats` returns correct counts
- ✅ Test `getBackendSyncStats` handles backend errors
- ✅ Test `migrateToBackend` with source backend selection
- ✅ Test `migrateToBackend` defaults to primary backend

### Acceptance Criteria

- [ ] Sync verification detects missing notifications
- [ ] Sync verification detects data discrepancies
- [ ] Manual replication creates or updates as needed
- [ ] Manual replication handles partial failures gracefully
- [ ] Sync stats provide health overview
- [ ] Migration supports source backend selection
- [ ] All tests pass

---

## Phase 7: Documentation and Examples

### Objective
Document the new multi-backend feature with examples and migration guides.

### Changes Required

#### 7.1 Update README.md

Add section on multi-backend setup:

```markdown
## Multi-Backend Configuration

VintaSend supports configuring multiple backends for redundancy, data distribution, or migration:

### Basic Setup

```typescript
const primaryBackend = new PrismaNotificationBackend(prisma, undefined, 'primary-db');
const replicaBackend = new PrismaNotificationBackend(replicaPrisma, undefined, 'replica-db');

const vintasend = factory.create({
  adapters,
  backend: primaryBackend,
  additionalBackends: [replicaBackend],
  logger,
  contextGeneratorsMap,
});
```

### How It Works

- **Writes**: All write operations (create, update, delete) are performed on the primary backend first. Once successful, they're replicated to additional backends on a best-effort basis.
- **Reads**: By default, read operations query the primary backend. You can target specific backends:

```typescript
// Read from primary (default)
const notification = await vintasend.getNotification(id);

// Read from specific backend
const notification = await vintasend.getNotification(id, false, 'replica-db');
```

### Backend Management

```typescript
// Verify sync status
const syncReport = await vintasend.verifyNotificationSync(notificationId);
console.log(syncReport.synced); // true if all backends match

// Manually replicate a notification
await vintasend.replicateNotification(notificationId);

// Get backend statistics
const stats = await vintasend.getBackendSyncStats();
```

### Failure Handling

- Primary backend failures **will fail** the operation
- Additional backend failures are **logged but don't fail** the operation
- This ensures high availability while maintaining data redundancy
```

#### 7.2 Create Migration Guide

**File**: `MULTI_BACKEND_MIGRATION.md`

Document how to migrate from single-backend to multi-backend setup.

#### 7.3 Add Code Examples

**File**: `src/examples/multi-backend-example.ts`

Create example demonstrating:
- Setup with multiple backends
- Write operations with replication
- Read with backend selection
- Sync verification
- Error handling

#### 7.4 Update API Documentation

Update JSDoc comments for:
- VintaSend constructor
- All methods with new `backendIdentifier` parameter
- New backend management methods

### Tests Required

**Test File**: `src/examples/__tests__/multi-backend-example.test.ts`

- ✅ Test example code runs without errors
- ✅ Test example demonstrates all key features

### Acceptance Criteria

- [ ] README includes multi-backend section
- [ ] Migration guide is complete and accurate
- [ ] Example code is functional and well-documented
- [ ] All API documentation is updated
- [ ] Examples pass their tests

---

## Rollout Strategy

### Stage 1: Beta Release
- Release as experimental feature (v0.x.0)
- Document as "beta" in README
- Gather feedback from early adopters

### Stage 2: Production Ready
- Address feedback and edge cases
- Complete performance optimization
- Mark as stable (v1.0.0)

### Stage 3: Adoption
- Promote in documentation
- Create blog post/tutorial
- Add to example implementations

---

## Risk Mitigation

### Identified Risks

1. **Replication Lag**: Additional backends may lag behind primary
   - *Mitigation*: Document eventual consistency model, provide sync verification tools

2. **Partial Failures**: Some backends succeed, others fail
   - *Mitigation*: Comprehensive logging, manual replication tools, idempotent operations

3. **Performance Impact**: Multiple writes could slow down operations
   - *Mitigation*: Best-effort async replication, performance testing, configurable timeouts

4. **Data Inconsistency**: Backends may diverge over time
   - *Mitigation*: Sync verification tools, alerting, manual reconciliation

5. **Breaking Changes**: New parameters could break existing code
   - *Mitigation*: Optional parameters only, extensive backward compatibility testing

---

## Success Metrics

- [ ] Zero breaking changes for existing users
- [ ] All phases completed with tests passing
- [ ] Documentation complete and reviewed
- [ ] At least one production deployment successful
- [ ] Performance impact < 10% for single-backend mode
- [ ] Code coverage maintained at >= 90%

---

## Timeline Estimate

- **Phase 1**: 2-3 days (backend identifiers)
- **Phase 2**: 1-2 days (support creating notifications with predefined IDs)
- **Phase 3**: 2-3 days (VintaSend multi-backend support)
- **Phase 4**: 5-7 days (multi-backend writes)
- **Phase 5**: 3-4 days (multi-backend reads)
- **Phase 6**: 2-3 days (management operations)
- **Phase 7**: 2-3 days (documentation)
- **Phase 8**: 3-5 days (final testing and integration)

**Total**: 20-30 days (approximately 4-6 weeks)

---

## Open Questions

1. Should we support weighted backend selection for reads (e.g., load balancing)?
2. Should replication be synchronous with configurable timeout, or always async?
3. Do we need a reconciliation job to fix diverged backends?
4. Should we support backend-specific configuration (e.g., retry policies)?
5. Do we need circuit breakers for failing backends?

---

## Future Enhancements (Out of Scope)

- Automatic sync reconciliation jobs
- Read load balancing across backends
- Backend health monitoring and automatic failover
- Selective replication (only certain notification types)
- Bi-directional sync (any backend can be written to)
- Conflict resolution strategies
