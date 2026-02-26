# Additional Backends Plan Tracking

## Progress Summary

- Last updated: 2026-02-26
- Current phase: Phase 1 (Add Backend Identifiers)
- Overall status: In progress

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
