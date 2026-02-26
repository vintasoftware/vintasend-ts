# Additional Backends Plan Tracking

## Progress Summary

- Last updated: 2026-02-26
- Current phase: Phase 4 (Implement multi-backend write operations)
- Overall status: In progress

## Phase 4 — Implement Multi-Backend Write Operations

### Status

- ✅ Phase 4 implementation started
- ✅ Primary-first + best-effort replication helper added
- ✅ Core write paths migrated to replication flow
- ✅ Initial Phase 4 test suites added and passing
- ⏳ Remaining: attachment replication paths and deeper parity checks

### Completed Items (Current Slice)

1. **Added shared primary-first replication helper**
    - Added internal `executeMultiBackendWrite<T>()` helper in `VintaSend`.
    - Behavior:
       - runs write on primary backend first
       - replicates to additional backends on best-effort basis
       - logs replication success/failure with backend identifier
       - does not throw on additional backend failures
    - File: `src/services/notification-service.ts`

2. **Migrated core write operations to multi-backend flow**
    - Updated methods:
       - `createNotification`
       - `updateNotification`
       - `createOneOffNotification`
       - `updateOneOffNotification`
       - `markRead`
       - `cancelNotification`
       - `bulkPersistNotifications` (replicates using IDs returned by primary)
    - File: `src/services/notification-service.ts`

3. **Replicated send-path write side effects**
    - Updated send-related backend writes to replicate across additional backends:
       - `markAsSent`
       - `markAsFailed`
       - `storeAdapterAndContextUsed`
       - git commit SHA persistence updates (`persistNotificationUpdate` / `persistOneOffNotificationUpdate` in execution path)
    - Applied in both `send` and `delayedSend` flows.
    - File: `src/services/notification-service.ts`

4. **Added Phase 4 test coverage (initial)**
    - New test suite: `src/services/__tests__/multi-backend-writes.test.ts`
       - create/update replication for regular and one-off notifications
       - mark/cancel replication
       - bulk replication with primary-generated IDs
       - primary failure blocks replication
       - single-backend backward compatibility
    - New test suite: `src/services/__tests__/multi-backend-error-handling.test.ts`
       - additional backend failure does not fail operation
       - failure logs include backend identifier
       - operation continues through other backends and send-path writes

### Test Results (Executed)

- Targeted run executed and passing.
- Result: **112 passed, 0 failed**
- Executed files:
   - `src/services/__tests__/multi-backend-initialization.test.ts`
   - `src/services/__tests__/multi-backend-writes.test.ts`
   - `src/services/__tests__/multi-backend-error-handling.test.ts`
   - `src/services/__tests__/notification-service.test.ts`
   - `src/services/__tests__/notification-service-one-off.test.ts`

### Phase 4 Acceptance Criteria Check (Current)

- [x] All write operations replicate to additional backends *(implemented for current core write paths and send-path status/context writes)*
- [x] Primary backend writes complete before replication
- [x] Failures in additional backends are logged but don't fail operations
- [x] Notification IDs are consistent across backends *(covered for create + bulk in this slice)*
- [x] Queue operations only happen for primary backend *(unchanged behavior)*
- [x] All existing tests pass *(targeted service suites)*
- [x] New multi-backend write tests pass
- [x] Error handling tests pass

### Notes

- Attachment-specific replication operations (`storeAttachmentFileRecord`, `deleteAttachmentFile`, `deleteNotificationAttachment`) are still pending and will be handled in the next Phase 4 increment.
- This change set focuses on core notification write replication with backward-compatible behavior in single-backend mode.

## Phase 3 — Update VintaSend to Support Multiple Backends

### Status

- ✅ Core implementation completed
- ✅ Phase 3 initialization tests added and passing
- ✅ Broader compatibility validation confirmed (manual run)

### Completed Items

1. **Updated `VintaSendFactoryCreateParams` and factory overloads**
   - Added optional `additionalBackends?: Backend[]` to object create params.
   - Added `additionalBackends?: Backend[]` to deprecated positional create overload.
   - Threaded additional backends through factory implementation to `VintaSend` constructor.
   - File: `src/services/notification-service.ts`

2. **Updated `VintaSend` constructor for multi-backend initialization**
   - Added constructor support for optional `additionalBackends`.
   - Added internal backend registry `Map<string, Backend>` plus `primaryBackendIdentifier`.
   - Added identifier resolution with fallback for backends without `getBackendIdentifier()`.
   - Added duplicate identifier validation.
   - Injected logger and attachment manager into additional backends.
   - File: `src/services/notification-service.ts`

3. **Added internal backend helper methods**
   - Added internal backend selection helpers:
     - `getBackend(identifier?: string)`
     - `getAdditionalBackends()`
     - `getBackendIdentifier(backend)`
   - Updated current read/list methods to route through `getBackend()` while preserving primary-backend default behavior.
   - File: `src/services/notification-service.ts`

4. **Added Phase 3 initialization tests**
   - New test suite created covering:
     - single-backend backward compatibility
     - primary + additional backend initialization
     - duplicate identifier rejection
     - logger/attachment manager injection into all backends
     - deprecated factory signature with `additionalBackends`
     - fallback identifiers for backends without `getBackendIdentifier()`
     - unknown backend identifier error
   - File: `src/services/__tests__/multi-backend-initialization.test.ts`

### Test Results (Executed)

- Targeted test run executed and passing.
- Result: **22 passed, 0 failed**
- Executed files:
  - `src/services/__tests__/multi-backend-initialization.test.ts`
  - `src/services/notification-backends/__tests__/backend-identifier.test.ts`
  - `src/services/notification-backends/__tests__/base-backend-interface.test.ts`

### Phase 3 Acceptance Criteria Check (Current)

- [x] VintaSend accepts multiple backends
- [x] Primary backend is tracked separately
- [x] Backends are accessible by identifier (internal helper)
- [x] Duplicate identifiers are rejected
- [x] Logger and attachment manager injected into all backends
- [x] All existing tests pass (backward compatibility)
- [x] New multi-backend initialization tests pass

### Notes

- This completes Phase 3 constructor/factory initialization scaffolding and test coverage baseline.
- Broader test pass status confirmed manually by user after initial targeted run.
- Phase 4 write replication and Phase 5 public backend-targeted reads are not included in this change set.

## Phase 2 — Support creating notifications with a predefined ID

### Status

- ✅ Core implementation completed
- ✅ Prisma and Medplum backend behavior updated
- ✅ Targeted implementation tests updated and passing

### Completed Items

1. **Updated notification input types to support optional predefined IDs**
   - Added optional `id?: Config['NotificationIdType']` to notification input types.
   - Files:
     - `src/types/notification.ts`
     - `src/types/one-off-notification.ts`

2. **Updated `BaseNotificationBackend` create method contracts**
   - `persistNotification` now accepts create payloads with optional `id` while preserving backward compatibility.
   - `persistOneOffNotification` now accepts create payloads with optional `id` while preserving backward compatibility.
   - File: `src/services/notification-backends/base-notification-backend.ts`

3. **Updated Prisma backend create flow**
   - Threaded optional `id` through create data builder so predefined IDs are persisted when provided.
   - Aligned deserialize/create typing with bulk creation paths.
   - File: `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`

4. **Updated Medplum backend create flow**
   - `persistNotification` now accepts optional `id` and passes it to `Communication.id` on create.
   - `persistOneOffNotification` now accepts optional `id` and passes it to `Communication.id` on create.
   - File: `src/implementations/vintasend-medplum/src/medplum-backend.ts`

5. **Added/updated Phase 2 backend tests**
   - Added Prisma test case for `persistNotification` with predefined `id`.
   - Added Medplum test case for `persistNotification` with predefined `id`.
   - Files:
     - `src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend.test.ts`
     - `src/implementations/vintasend-medplum/src/__tests__/medplum-backend.test.ts`

### Test Results (Executed)

- Root compile check executed: `npm run build` (passing).
- Implementation-local test runs were used for Prisma/Medplum validation.
- Final status: **tests passing** (confirmed after Phase 2 fixes).

### Phase 2 Acceptance Criteria Check

- [x] `persistNotification` accepts optional predefined `id` in backend interface
- [x] Prisma backend persists notifications with predefined `id`
- [x] Medplum backend persists notifications with predefined `id`
- [x] Existing calls without `id` keep current behavior (backward compatibility)
- [x] Phase 2 backend tests pass

### Notes

- While validating implementation-local suites, a few Medplum adapter tests required mock updates for `BaseEmailTemplateRenderer` (`renderFromTemplateContent`) to satisfy current interface typing.

## Phase 1 — Add Backend Identifiers

### Status

- ✅ Core implementation completed
- ✅ Initial tests added and passing
- ⏳ Remaining: optional follow-up validation in implementation package test runners

### Completed Items

1. **Updated `BaseNotificationBackend` interface**
   - Added optional `getBackendIdentifier?(): string` method.
   - File: `src/services/notification-backends/base-notification-backend.ts`

2. **Updated Prisma backend**
   - Added constructor `identifier` parameter with default: `default-prisma`.
   - Implemented `getBackendIdentifier()`.
   - Updated factory `create` to accept optional `identifier`.
   - File: `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`

3. **Updated Medplum backend**
   - Added `identifier?: string` to backend options.
   - Added default option value: `default-medplum`.
   - Implemented `getBackendIdentifier()`.
   - Updated factory `create` to accept optional options with `identifier`.
   - File: `src/implementations/vintasend-medplum/src/medplum-backend.ts`

4. **Added Phase 1 identifier tests**
   - New test file created for identifier behaviors and factory wiring.
   - Adjusted to use only root application files (no `src/implementations/*` imports).
   - File: `src/services/notification-backends/__tests__/backend-identifier.test.ts`

### Test Results (Executed)

- Command scope: targeted service/backend-interface tests
- Result: **9 passed, 0 failed**
- Executed files:
  - `src/services/notification-backends/__tests__/backend-identifier.test.ts`
  - `src/services/notification-backends/__tests__/base-backend-interface.test.ts`

### Phase 1 Acceptance Criteria Check

- [x] All backends implement `getBackendIdentifier()` method
- [x] Default identifiers are assigned when not specified
- [x] Custom identifiers can be provided during construction
- [x] New identifier tests pass
- [x] Existing targeted compatibility tests pass

### Notes

- Root workspace Jest config ignores implementation package test folders (`src/implementations/**/*`).
- Additional validation for implementation-local test suites can be run with:
  - `npm run test:implementations:local`
