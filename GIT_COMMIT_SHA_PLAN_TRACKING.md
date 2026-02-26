# Git Commit SHA Tracking + Dashboard Template Version Progress Tracking

## Phase 1 — Core Types + Provider Interface ✅ COMPLETED (Reconciled with Updated Plan)

**Completion Date:** February 25, 2026

### Tasks Completed

1. ✅ Updated `gitCommitSha` contract in notification domain types:
   - Updated `NotificationInput` in [src/types/notification.ts](src/types/notification.ts)
   - Updated `NotificationResendWithContextInput` in [src/types/notification.ts](src/types/notification.ts)
   - Updated `DatabaseNotification` in [src/types/notification.ts](src/types/notification.ts)
   - Input/resend types now explicitly forbid this field (`gitCommitSha?: never`)
   - Database type keeps required nullable field (`gitCommitSha: string | null`)

2. ✅ Updated `gitCommitSha` contract in one-off notification types:
   - Updated `OneOffNotificationInput` in [src/types/one-off-notification.ts](src/types/one-off-notification.ts)
   - Updated `OneOffNotificationResendWithContextInput` in [src/types/one-off-notification.ts](src/types/one-off-notification.ts)
   - Updated `DatabaseOneOffNotification` in [src/types/one-off-notification.ts](src/types/one-off-notification.ts)
   - Input/resend types now explicitly forbid this field (`gitCommitSha?: never`)
   - Database type keeps required nullable field (`gitCommitSha: string | null`)

3. ✅ Created `BaseGitCommitShaProvider` interface:
   - New file: [src/services/git-commit-sha/base-git-commit-sha-provider.ts](src/services/git-commit-sha/base-git-commit-sha-provider.ts)
   - Interface supports synchronous and asynchronous SHA resolution
   - Returns `string | Promise<string | null> | null`
   - Includes comprehensive JSDoc documentation with usage examples

4. ✅ Exported new types from main index:
   - Added export for `BaseGitCommitShaProvider` in [src/index.ts](src/index.ts)

5. ✅ Added/updated comprehensive tests:
   - Added tests for `gitCommitSha` persisted field behavior in [src/types/__tests__/notification.test.ts](src/types/__tests__/notification.test.ts)
   - Added tests for `gitCommitSha` persisted field behavior in [src/types/__tests__/one-off-notification.test.ts](src/types/__tests__/one-off-notification.test.ts)
   - Added type-level tests asserting create/resend input types reject `gitCommitSha` in both files above
   - Created full test suite for provider interface in [src/services/git-commit-sha/__tests__/base-git-commit-sha-provider.test.ts](src/services/git-commit-sha/__tests__/base-git-commit-sha-provider.test.ts)
   - Phase 1 targeted suites passing (47/47) ✅

### Data Contract Established

**Persisted field:** `gitCommitSha: string | null`

**Field behavior:**
- Input/resend types (`NotificationInput`, `OneOffNotificationInput`, etc.): `gitCommitSha` is forbidden (`gitCommitSha?: never`)
- Database types (`DatabaseNotification`, `DatabaseOneOffNotification`): Required nullable field `gitCommitSha: string | null`

**Provider interface:**
```typescript
interface BaseGitCommitShaProvider {
  getCurrentGitCommitSha(): string | Promise<string | null> | null;
}
```

### Next Steps

Ready to proceed to **Phase 2 — Service Initialization Strategy in VintaSendFactory**.

### Test Results

Phase 1 targeted tests passing: **47/47 tests** ✅

### Files Modified

#### Core Type Files
- [src/types/notification.ts](src/types/notification.ts) - `gitCommitSha` forbidden on input/resend; required nullable on database types
- [src/types/one-off-notification.ts](src/types/one-off-notification.ts) - `gitCommitSha` forbidden on input/resend; required nullable on database types
- [src/services/git-commit-sha/base-git-commit-sha-provider.ts](src/services/git-commit-sha/base-git-commit-sha-provider.ts) - New provider interface
- [src/services/git-commit-sha/index.ts](src/services/git-commit-sha/index.ts) - New directory index
- [src/index.ts](src/index.ts) - Updated exports

#### Test Files
- [src/types/__tests__/notification.test.ts](src/types/__tests__/notification.test.ts) - Added persisted field tests and input rejection tests
- [src/types/__tests__/one-off-notification.test.ts](src/types/__tests__/one-off-notification.test.ts) - Added persisted field tests and input rejection tests
- [src/services/git-commit-sha/__tests__/base-git-commit-sha-provider.test.ts](src/services/git-commit-sha/__tests__/base-git-commit-sha-provider.test.ts) - New test file
- Updated all existing test files to include `gitCommitSha: null` in mock data for backward compatibility

### Backward Compatibility

✅ Changes are **backward compatible for persisted data** and aligned with the updated plan:
- Input/resend types: `gitCommitSha` is **system-managed and rejected** (`never`)
- Database types: `gitCommitSha` is **required but nullable**
- Existing tests updated and expanded for the revised contract
- No breaking changes to existing API

---

## Phase 2 — Service Initialization Strategy in VintaSendFactory ✅ COMPLETED

**Completion Date:** February 25, 2026

### Tasks Completed

1. ✅ Extended `VintaSendFactory.create(...)` to support optional provider injection:
   - Added support for `gitCommitShaProvider` in positional overload (backward compatible).
   - Added object-parameter overload for create configuration (preferred path).
   - Marked positional-parameter usage as deprecated in JSDoc.

2. ✅ Injected provider into `VintaSend`:
   - `VintaSend` constructor now accepts optional `BaseGitCommitShaProvider`.
   - Factory passes provider through both positional and object-parameter create overloads.

3. ✅ Implemented execution-time SHA resolve + validation + persistence logic:
   - Added centralized helpers in [src/services/notification-service.ts](src/services/notification-service.ts):
     - `resolveGitCommitShaForExecution`
     - `normalizeGitCommitSha`
     - `persistGitCommitShaForExecution`
     - `resolveAndPersistGitCommitShaForExecution`
   - SHA is resolved at execution paths (`send` and `delayedSend`) and persisted before adapter send.
   - Applied for both regular and one-off notifications.
   - Validates full 40-char hex SHA and normalizes to lowercase.
   - Invalid provider values throw deterministic error.

4. ✅ Added null-safe persistence behavior:
   - Avoids unnecessary update calls when both current and resolved SHA are effectively null (`null`/`undefined` equivalence check).

5. ✅ Added/updated test coverage for Phase 2:
   - Existing Phase 2 provider tests verified in [src/services/__tests__/notification-service.test.ts](src/services/__tests__/notification-service.test.ts):
     - provider resolves null => persist null behavior
     - provider resolves invalid SHA => deterministic error
     - delayed send execution path resolves/persists SHA
   - Existing one-off execution path coverage verified in [src/services/__tests__/notification-service-one-off.test.ts](src/services/__tests__/notification-service-one-off.test.ts).
   - Added new test for object-parameter overload wiring + provider behavior in [src/services/__tests__/notification-service.test.ts](src/services/__tests__/notification-service.test.ts).

### Test Results

Phase 2 targeted service tests passing: **92/92 tests** ✅

Command run:

```shell
npm test -- src/services/__tests__/notification-service.test.ts src/services/__tests__/notification-service-one-off.test.ts
```

### Files Modified (Phase 2)

- [src/services/notification-service.ts](src/services/notification-service.ts)
  - Factory overloads + provider injection
  - Execution-time SHA resolution/normalization/persistence helpers
  - Send/delayedSend wiring
  - Null-equivalence guard for SHA persistence updates
- [src/services/__tests__/notification-service.test.ts](src/services/__tests__/notification-service.test.ts)
  - Added object-parameter overload coverage with provider

### Backward Compatibility

✅ Backward compatible with existing integrations:
- Positional factory API still supported.
- New object-style factory API added (preferred).
- Existing tests for non-provider flows remain passing.

### Next Steps

Ready to proceed to **Phase 3 — Prisma Backend Persistence**.
