# Additional Backends Plan Tracking

## Progress Summary

- Last updated: 2026-02-26
- Current phase: Phase 2 (Support predefined notification IDs)
- Overall status: In progress

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
