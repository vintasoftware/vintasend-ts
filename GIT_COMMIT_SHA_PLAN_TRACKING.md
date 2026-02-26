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

---

## Phase 3 — Prisma Backend Persistence ✅ COMPLETED

**Completion Date:** February 25, 2026

### Completed So Far

1. ✅ Updated Prisma backend model typing and serializers in [src/implementations/vintasend-prisma/src/prisma-notification-backend.ts](src/implementations/vintasend-prisma/src/prisma-notification-backend.ts):
    - Added `gitCommitSha: string | null` to `PrismaNotificationModel`.
    - Included `gitCommitSha` in `serializeAnyNotification` output for both regular and one-off notifications.
    - Added `gitCommitSha` support in create/update mapper contracts:
       - `BaseNotificationCreateInput`
       - `BaseNotificationUpdateInput`
    - Wired `gitCommitSha` in:
       - create data builder (`buildCreateData`)
       - update data builder (`buildUpdateData`)
       - `deserializeNotificationForUpdate`

2. ✅ Updated Prisma schemas:
    - [src/implementations/vintasend-prisma/schema.prisma.example](src/implementations/vintasend-prisma/schema.prisma.example)
       - Added nullable `gitCommitSha String?`
       - Added `@@index([gitCommitSha])`
    - [src/examples/nextjs-prisma-nodemailer-pug-temporal/schema.prisma](src/examples/nextjs-prisma-nodemailer-pug-temporal/schema.prisma)
       - Added nullable `gitCommitSha String?`
       - Added `@@index([gitCommitSha])`

3. ✅ Added/updated Prisma backend tests in [src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend.test.ts](src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend.test.ts):
    - Added test: regular create payload includes `gitCommitSha` when provided.
    - Added test: one-off create payload includes `gitCommitSha` when provided.
    - Added test: update payload includes `gitCommitSha`.
    - Updated serialization assertion to include `gitCommitSha` in expected output.
    - Updated baseline mock fixtures to include `gitCommitSha` for model compatibility.

4. ✅ Updated attachments test fixture model shape in [src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend-attachments.test.ts](src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend-attachments.test.ts).

### Validation

Prisma implementation targeted tests passing: **94/94 tests** ✅

Command run:

```shell
cd src/implementations/vintasend-prisma && npm test -- src/__tests__/prisma-notification-backend.test.ts src/__tests__/prisma-notification-backend-attachments.test.ts
```

5. ✅ Added migration guidance in docs/changelog:
   - Updated [CHANGELOG.md](CHANGELOG.md) with Prisma migration steps for adding `gitCommitSha` and index.

### Next Step

Ready to proceed to **Phase 4 — Medplum Backend Persistence**.

---

## Phase 4 — Medplum Backend Persistence ✅ COMPLETED

**Completion Date:** February 25, 2026

### Tasks Completed

1. ✅ Added `gitCommitSha` identifier system constant in [src/implementations/vintasend-medplum/src/medplum-backend.ts](src/implementations/vintasend-medplum/src/medplum-backend.ts):
   - `IDENTIFIER_SYSTEMS.gitCommitSha = 'http://vintasend.com/fhir/git-commit-sha'`

2. ✅ Persist path updates for regular + one-off notifications:
   - `persistNotification(...)` now writes git SHA identifier when present.
   - `persistOneOffNotification(...)` now writes git SHA identifier when present.
   - `bulkPersistNotifications(...)` also propagates git SHA identifier when present.

3. ✅ Read/serialization updates:
   - `mapToDatabaseNotification(...)` now extracts SHA from `Communication.identifier` and maps it to `gitCommitSha`.
   - Missing identifier correctly maps to `gitCommitSha: null`.

4. ✅ Update upsert/removal logic:
   - Extended `updateIdentifiers(...)` to upsert/remove `IDENTIFIER_SYSTEMS.gitCommitSha`.
   - Covers both regular and one-off update flows (`persistNotificationUpdate`, `persistOneOffNotificationUpdate`).

5. ✅ Added/updated Medplum tests in [src/implementations/vintasend-medplum/src/__tests__/medplum-backend.test.ts](src/implementations/vintasend-medplum/src/__tests__/medplum-backend.test.ts):
   - Regular persist writes SHA identifier and maps back.
   - One-off persist writes SHA identifier and maps back.
   - Update flow upserts SHA.
   - Update flow clears SHA when set to `null`.
   - Missing identifier maps to `null`.

### Validation

Medplum implementation targeted tests passing: **49/49 tests** ✅

Command run:

```shell
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-medplum && npm test -- src/__tests__/medplum-backend.test.ts
```

### Files Modified (Phase 4)

- [src/implementations/vintasend-medplum/src/medplum-backend.ts](src/implementations/vintasend-medplum/src/medplum-backend.ts)
  - Identifier constant
  - Persist/read/update wiring for `gitCommitSha`
- [src/implementations/vintasend-medplum/src/__tests__/medplum-backend.test.ts](src/implementations/vintasend-medplum/src/__tests__/medplum-backend.test.ts)
  - Phase 4 coverage

### Next Step

Ready to proceed to **Phase 5 — Cross-Cutting Docs, Versioning, and Compatibility**.

---

## Phase 5 — Cross-Cutting Docs, Versioning, and Compatibility ✅ COMPLETED

**Completion Date:** February 26, 2026

### Tasks Completed

1. ✅ Updated [README.md](README.md) with comprehensive git-commit-sha tracking documentation:
   - Added "Git Commit SHA Tracking" section with feature overview.
   - Included three provider configuration examples:
     - Environment variable-based provider (`process.env.GIT_COMMIT_SHA`)
     - Shell command-based provider (`git rev-parse HEAD`)
     - Static value provider hardcoded SHA)
   - Added factory usage examples for both positional and object-parameter overloads.
   - Added v0.7.0 migration guidance subsection with step-by-step integrator instructions.

2. ✅ Updated [CHANGELOG.md](CHANGELOG.md) with v0.7.0 release entry:
   - Added comprehensive bullet list covering all 5 phases of implementation.
   - Included backend-specific notes (Prisma schema updates, Medplum FHIR identifier system).
   - Documented new provider interface and factory wiring.
   - Included migration guidance for integrators updating from v0.6.2 to v0.7.0.

3. ✅ Validated core package build and tests:
   - Core package [VintaSend v0.6.2](package.json) builds successfully with TypeScript 5.9.3.
   - All test suites passing: **265/265 tests** across 12 test suites.
   - Confirmed no regressions in existing functionality.
   - Build output: ✅ `tsc` completed without errors.

4. ✅ Verified [CHANGELOG.md](CHANGELOG.md) state:
   - Confirmed `Version 0.7.0` section is present and correctly formatted.
   - Confirmed git-commit-sha rollout details are preserved.

5. ✅ Validated Prisma implementation package build and tests:
   - Package: [src/implementations/vintasend-prisma/package.json](src/implementations/vintasend-prisma/package.json)
   - Build output: ✅ `tsc` completed without errors.
   - Tests passing: **94/94 tests** across 2 test suites.

6. ✅ Validated Medplum implementation package build and tests:
   - Package: [src/implementations/vintasend-medplum/package.json](src/implementations/vintasend-medplum/package.json)
   - Build output: ✅ `tsc` completed without errors.
   - Tests passing: **163/163 tests** across 10 test suites.

### Validation Results

Core package validation command:

```shell
cd /Users/hugobessa/Workspaces/vintasend-ts && npm run build && npm test
```

**Test Results:** **265/265 tests passing** ✅
- Test Suites: 12 passed, 12 total
- All existing tests pass with new gitCommitSha field included in mock data
- New gitCommitSha provider and persistence tests included in phase totals

Prisma implementation validation command:

```shell
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-prisma && npm run build && npm test
```

**Test Results:** **94/94 tests passing** ✅
- Test Suites: 2 passed, 2 total

Medplum implementation validation command:

```shell
cd /Users/hugobessa/Workspaces/vintasend-ts/src/implementations/vintasend-medplum && npm run build && npm test
```

**Test Results:** **163/163 tests passing** ✅
- Test Suites: 10 passed, 10 total

### Files Modified/Created (Phase 5)

- [README.md](README.md) 
  - Added "Git Commit SHA Tracking" section with provider configuration examples
  - Added "Migrating to v0.7.0" subsection with integration guidance
- [CHANGELOG.md](CHANGELOG.md)
  - Added v0.7.0 release notes covering all implementation phases and backend specifics

### Implementation Summary

**Phase 5 encompasses cross-cutting concerns:**
- **Documentation**: README and CHANGELOG updated with comprehensive guidance for users upgrading to v0.7.0.
- **Versioning**: v0.7.0 release notes document all 5 phases of git-commit-sha feature rollout.
- **Compatibility**: Core package and official backend packages regression tested and validated.

**Feature Complete:**
- Core types contract finalized (forbidden on input, required nullable on database types)
- Provider interface and factory wiring fully operational
- Prisma backend persistence with schema index
- Medplum backend FHIR identifier persistence
- Comprehensive documentation and migration guidance

### Next Steps

✅ Phase 5 is fully complete.

Ready to proceed to **Phase 6 — Dashboard Foundation for Template Version Preview**.
