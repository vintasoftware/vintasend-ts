# Changelog

# Version 0.13.0

* Fix bug on VintaSend service that was mistakenly trying to notification as success after it has just failed. 
* **BREAKING CHANGE**: The service now can't be instatiated with multiple adapters for the same notification type. Doing this would end up messing with the statuses, as notification could be sent successfuly by one adapter and fail on another.
* Fixed the root package tests' imports
* Adjust logger definition in template renderers


# Version 0.12.3

* Fix notification creation for prisma.

# Version 0.12.2

* Added the missing `getAllPendingNotification` method to the service.

# Version 0.12.1

* Fixed Prisma pending notifications queries in `vintasend-prisma` by moving `OR` conditions to the `where` root level (Prisma-compatible), preventing runtime validation errors in workers.
* Updated Prisma backend tests to assert the correct `OR` query shape for pending notifications.

# Version 0.12.0

* Standardized ESM output strategy across the monorepo by migrating `vintasend` and all official implementations to TypeScript `NodeNext` module settings.
* Added explicit `.js` relative import/export specifiers in implementation and root TypeScript source where required by NodeNext resolution.
* Updated root package publishing metadata to use explicit ESM exports/types mapping (`exports` + `types`) for clearer consumer resolution.
* Removed legacy ESM post-processing dependency from build flows and aligned package builds to native TypeScript ESM output.
* Improved local build hygiene to prevent generated artifacts from polluting `src/` and commits (cleanup step + tighter TS include scope + ignore rules).
* Replaced deep/internal third-party type imports with stable public typings in adapters (notably Nodemailer and SendGrid) to improve compatibility under NodeNext.

# Version 0.11.4

* Adjust root package tsconfig.json.

# Version 0.11.3

* Add type module to all package.json files.

# Version 0.11.2

* Adjust prisma client interface.

# Version 0.11.1

* Adjust test imports.
* Adjust prisma client interface.

# Version 0.11.0

* Centralized most type exports in the root package, so all usages can import directly from 'vintasend'.
* Adjusted linter/formatter rules and scripts to ensure consistency between the root package and all implementations.

## Version 0.10.0

* Support vintasend-react-email.
* Improve vintasend-implementation-template to help contributors to build new implementations.
* Create script to clone vintasend-implementation-template to help contributors to build new implementations.
* **BREAKING CHANGE**: Move pug-inline-email-template-renderer from vintasend-medplum to vintasend-pug.

## Version 0.9.1

* Migrate vintasend and all officially supported packages from jest to vitest
* Update dependencies on all officially supported packages

## Version 0.9.0

* **Asynchronous replication queue (per backend) added**:
  * Added replication queue contract `BaseNotificationReplicationQueueService.enqueueReplication(notificationId, backendIdentifier)`.
  * Added queued replication mode support in `VintaSend` (`options.replicationMode = 'queued'`) with one enqueue per additional backend.
  * Added safe fallback behavior: if enqueue fails for a backend, replication falls back to inline for that backend.
* **Worker targeting support**:
  * `processReplication` now accepts an optional `targetBackendIdentifier`.
  * Workers can process one queued replication task for one backend: `processReplication(notificationId, backendIdentifier)`.
  * Calling `processReplication(notificationId)` still processes all additional backends.
* **Ordering safety and idempotency improvements**:
  * Added optional backend contract `applyReplicationSnapshotIfNewer(snapshot): Promise<{ applied: boolean }>`.
  * `processReplication` prefers this contract when implemented to skip stale/out-of-order updates.
  * Maintained duplicate-create idempotency guard (create→update fallback on duplicate/unique conflict errors).
* **Official backend updates**:
  * `vintasend-prisma` implements conditional apply-only-if-newer replication behavior.
  * `vintasend-medplum` implements conditional apply-only-if-newer replication behavior.
* **Notes for implementers**:
  * ⚠️ If you implemented a custom replication queue service, update the method signature to accept `backendIdentifier`.

## Version 0.8.2

* **`orderBy` support added to `filterNotifications`**:
  * Added optional `orderBy` contract to service/backend filtering flow with date-based fields: `sendAfter`, `sentAt`, `readAt`, `createdAt`, `updatedAt`.
  * Added explicit ordering direction support: `asc` and `desc`.
  * Added/extended backend filter capability keys for ordering: `orderBy.sendAfter`, `orderBy.sentAt`, `orderBy.readAt`, `orderBy.createdAt`, `orderBy.updatedAt`.
  * Updated service-level capability merge behavior coverage for multi-backend reads (`defaults + backend overrides`).
* **Backend behavior**:
  * Prisma backend supports all `orderBy.*` fields.
  * Medplum backend supports ordering by `sendAfter`, `sentAt`, `createdAt`, `updatedAt`; `orderBy.readAt` is unsupported and reported as `false`.
* **Documentation updates**:
  * Added README section describing `filterNotifications(..., orderBy)`, `NotificationOrderBy` shape, and capability discovery with `getBackendSupportedFilterCapabilities()`.

## Version 0.8.1

* **Multi-backend support added to VintaSend**:
  * Added support for configuring one primary backend plus optional additional backends.
  * Implemented primary-first write replication with best-effort propagation to additional backends.
  * Added backend-targeted read operations with optional `backendIdentifier` parameters.
  * Added backend management operations: `verifyNotificationSync`, `replicateNotification`, and `getBackendSyncStats`.
  * Enhanced `migrateToBackend` with optional source backend selection.
* **Documentation and examples**:
  * Added multi-backend configuration section to README.
  * Added `MULTI_BACKEND_MIGRATION.md` migration guide.
  * Added `src/examples/multi-backend-example.ts` with setup, read-routing, and management operation examples.

## Version 0.7.1

* Add `renderEmailTemplateFromContent` method to the VintaSend service, so users can preview older notifications by providing the template content at the time.
* Implement this capability in all the supported template renderers.


## Version 0.7.0

* **Git Commit SHA tracking added across core + official backends**:
  * Added persisted notification field `gitCommitSha: string | null` for regular and one-off notifications.
  * `gitCommitSha` is system-managed and not accepted in notification create/resend input payloads.
  * Added `BaseGitCommitShaProvider` integration in `VintaSendFactory` / `VintaSend` execution paths.
  * Added object-parameter factory create overload with optional `gitCommitShaProvider` (positional create remains supported, but is deprecated).
  * SHA is resolved at send/render execution time, normalized to lowercase, validated as full 40-char hex, and persisted.
  * Provider returning `null` persists `null`; invalid SHA values throw deterministic errors.
  * Prisma backend now persists, updates, and serializes `gitCommitSha`.
  * Medplum backend now persists and reads `gitCommitSha` using `Communication.identifier` (`http://vintasend.com/fhir/git-commit-sha`) with upsert/removal on updates.
  * Added Prisma schema updates (`gitCommitSha String?` + index) to schema example and official Next.js Prisma example.
  * Added migration guidance for Prisma consumers in README.
* **String lookup filters added for advanced filtering**:
  * Implemented string lookup filters on `bodyTemplate`, `subjectTemplate`, and `contextName` fields
  * Supports lookup types: `exact`, `startsWith`, `endsWith`, `includes` with optional case-insensitive matching
  * Added `StringFilterLookup` type with structure: `{ lookup: 'exact' | 'startsWith' | 'endsWith' | 'includes', value: string, caseSensitive?: boolean }`
  * Added `StringFieldFilter` union type for filter field values: plain string (treated as case-sensitive exact match) or lookup object
  * Added `isStringFilterLookup()` type guard to distinguish lookup objects from plain strings
  * **Prisma implementation**: Full support for all lookup types with case-insensitive mode via Prisma's `StringFilter` mechanism
  * **Medplum implementation**: Exact-only support (FHIR token search limitation); `startsWith`, `endsWith`, `includes` throw with informative error; capability flags (`stringLookups.startsWith|endsWith|includes`) report false
  * **Backward compatibility**: Plain string filters continue to work without breaking changes, treated as case-sensitive exact matches
  * **Type exports**: Added `StringFilterLookup`, `StringFieldFilter` to public API exports

## Version 0.6.2

* **Fix tag filters on medplum-backend**:
  * Some filters for fields stored as tags like `notificationType` and `context` wasn't filtering because we always include the filter by the `notification` tag, the way it was working the filter was including records with ANY of tags, not with ALL the tags. If we filtered by a specific `notificationType`, we'd still return all other notificationTypes, making the filter pointless.

## Version 0.6.1

* **Filter capability defaults exposed at core level**:
  * Added and exported `DEFAULT_BACKEND_FILTER_CAPABILITIES` in `BaseNotificationBackend` module.
  * Centralized default support map for logical operators, filterable fields, and range-negation capabilities.
* **Notification service API additions**:
  * Added `filterNotifications(filter, page, pageSize)` to `VintaSend` service to expose backend filtering through the root service.
  * Added `getBackendSupportedFilterCapabilities()` to `VintaSend`, merging backend-reported capabilities with defaults for forward-compatible capability checks.

## Version 0.6.0

* **Composable notification filtering added to root package**:
  * Added `filterNotifications(filter, page, pageSize)` to `BaseNotificationBackend`
  * Added and exported `NotificationFilter`, `NotificationFilterFields`, `DateRange`, `NotificationFilterCapabilities`, and `isFieldFilter`
  * Added comprehensive backend-interface tests for field filters, logical composition (`AND`/`OR`/`NOT`), nested filters, and date ranges
* **Prisma implementation (`vintasend-prisma`) updates**:
  * Implemented full server-side `filterNotifications` using Prisma `where` conversion
  * Added recursive filter conversion for `AND` / `OR` / `NOT`
  * Added range filtering support for `sendAfter`, `createdAt`, and `sentAt`
  * Expanded internal Prisma where typings to support the new filter model
  * Added focused Prisma tests for pagination, nested logical filters, and date-range behavior
* **Medplum implementation (`vintasend-medplum`) updates**:
  * Implemented server-side `filterNotifications` by translating VintaSend filters to FHIR search parameters
  * Added Medplum filter capability reporting (`getFilterCapabilities`) so clients can detect unsupported operators
  * Persisted searchable fields in `Communication.identifier`:
    * `http://vintasend.com/fhir/body-template`
    * `http://vintasend.com/fhir/subject-template`
    * `http://vintasend.com/fhir/adapter-used`
  * Updated read/write paths to use identifier-based fields with backward-compatible read fallback for body/subject from payload
  * Added identifier upsert behavior in update paths for regular and one-off notifications
* **Bug fixes**:
  * Fixed `adapterUsed` not being persisted in Medplum (`storeAdapterAndContextUsed` now upserts the adapter identifier)
  * Fixed `contextUsed` persistence/read path in Medplum (stored as extension and mapped back on reads)
  * Fixed Medplum filterability gaps for `bodyTemplate`, `subjectTemplate`, and `adapterUsed` by storing them in searchable FHIR identifiers
* **Breaking changes (Medplum data format)**:
  * ⚠️ Existing `Communication` resources created before this version may not contain the new identifier systems.
  * ⚠️ Filtering by `bodyTemplate`, `subjectTemplate`, and `adapterUsed` only works for records that have been backfilled or newly written in the new format.
  * ⚠️ Medplum backend does not support `OR` across arbitrary fields in a single FHIR query; `OR` filters now throw explicitly.
* **Migration plan for existing Medplum data**:
  1. Query all `Communication` resources tagged with `notification`.
  2. For each resource, upsert missing identifiers:
     * `body-template`: from `payload[0].contentString` when available
     * `subject-template`: from payload extension (`email-notification-subject`) when available
     * `adapter-used`: from historical execution metadata if available; otherwise leave unset (do not guess)
  3. Preserve all existing identifiers and only add/replace the three VintaSend systems above.
  4. Update resources in batches and log failures for retry.
  5. Validate by sampling migrated records and running `filterNotifications` queries for `bodyTemplate`, `subjectTemplate`, and `adapterUsed`.
  6. Keep fallback reads enabled during rollout; after migration completion, treat identifier-based fields as the canonical source.
  7. Example bulk migration bot (Medplum Bot + TypeScript, inspiration-only):

```typescript
import { BotEvent, MedplumClient } from '@medplum/core';
import type { Communication, Identifier } from '@medplum/fhirtypes';

/**
 * Medplum Bot: Backfill Notification Identifiers
 *
 * This is an inspiration template for teams to adapt to their own projects.
 * It migrates old Communication resources tagged as "notification" so they
 * contain searchable identifiers used by vintasend-medplum filterNotifications.
 *
 * Suggested schedule: run once manually, then re-run as needed while monitoring logs.
 */

const IDENTIFIER_SYSTEMS = {
  bodyTemplate: 'http://vintasend.com/fhir/body-template',
  subjectTemplate: 'http://vintasend.com/fhir/subject-template',
  adapterUsed: 'http://vintasend.com/fhir/adapter-used',
} as const;

const SUBJECT_EXTENSION_URL =
  'http://vintasend.com/fhir/StructureDefinition/email-notification-subject';

function upsertIdentifier(
  identifiers: Identifier[] = [],
  system: string,
  value: string | undefined,
): Identifier[] {
  if (!value) return identifiers;

  const next = [...identifiers];
  const idx = next.findIndex((id) => id.system === system);

  if (idx >= 0) {
    next[idx] = { ...next[idx], system, value };
  } else {
    next.push({ system, value });
  }

  return next;
}

function extractSubjectTemplate(comm: Communication): string | undefined {
  return comm.payload?.[0]?.extension?.find((ext) => ext.url === SUBJECT_EXTENSION_URL)?.valueString;
}

function getAdapterUsedFromHistoricalSource(
  _comm: Communication,
  _event: BotEvent,
): string | undefined {
  // IMPORTANT:
  // Fill this using your authoritative historical source (audit logs, prior execution records, etc).
  // Do not infer or guess adapter values.
  return undefined;
}

export async function handler(medplum: MedplumClient, event: BotEvent): Promise<any> {
  console.log('[BackfillNotificationIdentifiersBot] Starting migration');

  const dryRun =
    event.input?.dryRun === true ||
    event.input?.dryRun === 'true' ||
    process.env.DRY_RUN === 'true';

  const pageSize = Number(event.input?.pageSize ?? process.env.PAGE_SIZE ?? 200);
  const maxPages = Number(event.input?.maxPages ?? process.env.MAX_PAGES ?? 0); // 0 = no cap

  let page = 0;
  let totalScanned = 0;
  let totalUpdated = 0;
  let totalFailed = 0;

  while (true) {
    if (maxPages > 0 && page >= maxPages) {
      console.log(`[BackfillNotificationIdentifiersBot] maxPages=${maxPages} reached, stopping`);
      break;
    }

    const communications = await medplum.searchResources('Communication', {
      _tag: 'notification',
      _count: pageSize.toString(),
      _offset: (page * pageSize).toString(),
    });

    if (communications.length === 0) break;

    for (const comm of communications) {
      totalScanned += 1;

      try {
        const bodyTemplate = comm.payload?.[0]?.contentString;
        const subjectTemplate = extractSubjectTemplate(comm);
        const adapterUsed = getAdapterUsedFromHistoricalSource(comm, event);

        let nextIdentifiers = comm.identifier ?? [];
        nextIdentifiers = upsertIdentifier(nextIdentifiers, IDENTIFIER_SYSTEMS.bodyTemplate, bodyTemplate);
        nextIdentifiers = upsertIdentifier(nextIdentifiers, IDENTIFIER_SYSTEMS.subjectTemplate, subjectTemplate);
        nextIdentifiers = upsertIdentifier(nextIdentifiers, IDENTIFIER_SYSTEMS.adapterUsed, adapterUsed);

        const changed = JSON.stringify(nextIdentifiers) !== JSON.stringify(comm.identifier ?? []);
        if (!changed) continue;

        totalUpdated += 1;

        if (!dryRun) {
          await medplum.updateResource<Communication>({
            ...comm,
            identifier: nextIdentifiers,
          });
        }
      } catch (error) {
        totalFailed += 1;
        console.error(`Failed migrating Communication/${comm.id}:`, error);
      }
    }

    page += 1;
  }

  const result = {
    dryRun,
    pageSize,
    pagesProcessed: page,
    totalScanned,
    totalUpdated,
    totalFailed,
  };

  console.log('[BackfillNotificationIdentifiersBot] Completed migration');
  console.log('[BackfillNotificationIdentifiersBot] Result:', JSON.stringify(result, null, 2));

  return {
    message: 'Communication identifier backfill completed',
    result,
  };
}
```

## Version 0.5.2

* Add missing methods on the service that were already available on the backends.


## Version 0.5.1

* Fix pending/future message logic on all officially supported backends (Prisma and Medplum)


## Version 0.5.0

* **Attachment Decoupling Architecture** (Complete refactor): Fully decoupled attachment storage from notification backends, enabling any backend to work with any attachment manager:
  * **StorageIdentifiers Type System**: Introduced `StorageIdentifiers` base interface with implementation-specific types (`MedplumStorageIdentifiers`, `S3StorageIdentifiers`, etc.) for type-safe attachment identification
  * **Backend-Manager Separation**: Clear separation of concerns - backends handle database operations, attachment managers handle file storage only
  * **Flexible Manager Support**: All backends now work with any attachment manager (S3, Medplum, local filesystem, or custom implementations)
  * **BaseAttachmentManager Redesign**:
    * Removed `getFile()` and `deleteFile()` methods requiring database access
    * Added `deleteFileByIdentifiers()` for clean file deletion using opaque identifiers
    * Updated `reconstructAttachmentFile()` to accept typed `StorageIdentifiers` instead of untyped metadata
    * Managers now focused solely on file storage operations
  * **MedplumNotificationBackend Updates**:
    * Refactored to store `storageIdentifiers` (opaque JSON) instead of backend-specific metadata
    * Works seamlessly with S3, local filesystem, or any custom attachment manager
    * Maintains Media resources for backend database records while supporting any storage backend
    * Proper separation: manager identifiers vs backend metadata
  * **PrismaNotificationBackend Updates**:
    * Updated `PrismaAttachmentFileModel` to use `storageIdentifiers` field for opaque storage
    * Refactored file deletion to use `deleteFileByIdentifiers()` with proper identifiers
    * Works with any attachment manager without coupling to specific implementations
    * Full type safety with `StorageIdentifiers` type
  * **Type Safety Improvements**:
    * All attachment operations now use properly typed `StorageIdentifiers`
    * Implementation-specific identifier types ensure correct manager selection
    * TypeScript compilation validates identifier structures
  * **Comprehensive Testing**:
    * All 207 root package tests passing
    * All 82 Prisma package tests passing  
    * All 140+ Medplum package tests passing
    * Zero TypeScript compilation errors
  * **Breaking Changes**:
    * ⚠️ **BREAKING**: Attachment field renamed: `storageMetadata` → `storageIdentifiers` in `AttachmentFileRecord` and `StoredAttachment`
    * ⚠️ **BREAKING**: `BaseAttachmentManager.deleteFile(fileId)` → `deleteFileByIdentifiers(storageIdentifiers)`
    * ⚠️ **BREAKING**: `BaseAttachmentManager.getFile()` and `deleteFile()` removed from interface
    * **Migration Path**: Internal changes to backend implementations only - public VintaSend API unchanged
    * **Benefits**: Enables true multi-backend support and cleaner architecture going forward
  * **Documentation**: Complete progress tracking in `ATTACHMENT_DECOUPLING_PLAN_PROGRESS.md`

## Version 0.4.17

* **Release Automation**: Introduced a comprehensive two-step release automation system for managing vintasend-ts and all implementation packages:
  * **Two-step release process**: Separate version bumping from publishing for better control
  * **Version bump step** (`npm run release:bump`): Updates all package.json files, then prompts for CHANGELOG updates
  * **Publish step** (`npm run release:publish`): Individual commit messages for each package (main + 8 implementations)
  * **2FA Support**: Browser-based npm 2FA authentication with 5-minute authorization window
  * **Automatic dependency management**: Runs `npm install` for each implementation to ensure correct vintasend version
  * **Includes all changes**: Commits all modified and untracked files (no clean working directory required)
  * **State tracking**: Uses `.release-state.json` to maintain context between steps
  * **Comprehensive documentation**: Release guide, quick reference, and technical documentation
  * **Safety features**: Confirmation prompts, test execution before publish, error handling
* **Attachment Manager Improvements**:
  * **BaseAttachmentManager**: Created mandatory getFile method and implemented in both AWS S3 and Medplum attachment managers.
* **Developer Experience**: 
  * New npm scripts: `release:bump`, `release:bump:patch`, `release:bump:minor`, `release:publish`
  * Complete workflow: bump versions → update CHANGELOG → publish all packages
  * Each package gets its own descriptive commit message
  * Documentation linked in README.md under Contributing section

## Version 0.4.7

* Inject logger into backend (optional)

## Version 0.4.3

* **Template Renderer Logger Injection**: Template renderers now support optional logger injection for better error handling and debugging:
  * Added optional `injectLogger()` method to `BaseEmailTemplateRenderer` interface
  * `PugEmailTemplateRenderer` now supports logger injection
  * `PugInlineEmailTemplateRenderer` now uses injected logger instead of `console.error`
  * VintaSend automatically injects logger into template renderers that support it
  * Template renderers continue to work without implementing logger injection (backward compatible)


## Version 0.4.0

* **Attachment Support**: VintaSend now supports file attachments for notifications with comprehensive features:
  * Production-ready AWS S3 storage via `vintasend-aws-s3-attachments` package
  * Reusable attachments - upload files once, attach to multiple notifications
  * Automatic deduplication via SHA-256 checksums
  * Presigned URLs for secure file access with configurable expiration
  * Streaming support for efficient handling of large files
  * S3-compatible services support (MinIO, DigitalOcean Spaces, Cloudflare R2, Wasabi, etc.)
  * Extensible architecture for custom storage backends (Azure Blob, GCS, local filesystem, etc.)
  * Email adapter support via Nodemailer
  * Comprehensive documentation in ATTACHMENTS.md
  * Implementation template for creating custom AttachmentManagers
* **Backend Updates**: Added attachment management methods to backend interface:
  * `getAttachmentFile()` - Retrieve attachment file metadata
  * `deleteAttachmentFile()` - Delete attachment files
  * `getOrphanedAttachmentFiles()` - Find files not linked to any notifications
  * `getAttachments()` - Get all attachments for a notification
  * `deleteNotificationAttachment()` - Remove notification-attachment links
* **Prisma Backend**: Full attachment support with database models and cascade delete rules
* **Type System Updates**: Added attachment types to notification inputs and database types
* **Backend Interface**: Attachment methods are now **optional** in `BaseNotificationBackend` - existing backends continue to work without implementing them
* **Breaking Changes**:
  * ⚠️ **BREAKING**: `VintaSendFactory.create()` signature changed - `attachmentManager` parameter now comes before `options`
    * **Old signature**: `create(adapters, backend, logger, contextGeneratorsMap, queueService?, options?)`
    * **New signature**: `create(adapters, backend, logger, contextGeneratorsMap, queueService?, attachmentManager?, options?)`
    * **Migration**: If you were passing 6 arguments with `options` as the last parameter, you must now pass `undefined` for `attachmentManager`:
      ```typescript
      // Before (v0.3.x):
      factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, { raiseErrorOnFailedSend: true });
      
      // After (v0.4.0):
      factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, undefined, { raiseErrorOnFailedSend: true });
      // Or with attachment manager:
      factory.create(adapters, backend, logger, contextGeneratorsMap, queueService, attachmentManager, { raiseErrorOnFailedSend: true });
      ```

## Version 0.3.0

* **One-off Notifications support**: now VintaSend supports sending notifications directly to emails/phone numbers, instead of registered users. 

# Version 0.2.0

* Added await when calling the send method of the adapter when creating notifications
* Implemented backend migration