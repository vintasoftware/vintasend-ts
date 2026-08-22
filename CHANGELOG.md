# Changelog

# Version 1.0.0-alpha1

First alpha of the 1.0.0 line, published to npm under the `alpha` dist-tag. The version number
reflects the size of what landed — template version pinning, managed templates, and the API/UI
split — not a rewrite of the VintaSend API: every seam it touches was added as optional, so an
adapter, renderer, or backend that ignores all of it keeps working. The one change that requires
action is a Prisma column migration, noted below.

* **Template version pinning added across core, backends, and adapters**: a notification can now
  name which version of its template it renders, and record which version actually went out. This
  only means anything with a renderer whose templates are versioned — a store-backed one such as
  `vintasend-managed-templates`. With a file-based renderer, which is every other one, both fields
  stay absent and nothing about sending changes.
  * **Core types**: `requestedTemplateVersion?: number | null` was added to `NotificationInput`,
    `NotificationResendWithContextInput`, `OneOffNotificationInput`, and
    `OneOffNotificationResendWithContextInput`, which also declare `usedTemplateVersion?: never`.
    `DatabaseNotification` and `DatabaseOneOffNotification` carry both fields as optional, so a
    backend with nowhere to store them stays valid.
  * **Service options**: `pinTemplateVersions` on `VintaSendOptions` decides whether a create — or
    an update that repoints `bodyTemplate` — is pinned to whatever version is current at that
    moment. It defaults to **off**, because turning it on changes what an existing deployment
    sends: unpinned, a notification scheduled for next week renders whatever the template says next
    week. The flag is never stored; it only decides what `requestedTemplateVersion` is set to.
  * **Per-call override**: `createNotification`, `updateNotification`, `createOneOffNotification`,
    and `updateOneOffNotification` each take a new optional `TemplateVersionPinningOptions`
    argument, whose `pinTemplateVersions` overrides the service's setting in both directions. An
    explicit `requestedTemplateVersion` always wins over both.
  * **Updates re-pin only when the template changes.** An update carrying a new `bodyTemplate` is
    re-pinned to that template's current version; an update to anything else leaves an existing pin
    exactly as it was, since silently moving a pin forward is what pinning exists to prevent.
  * **`usedTemplateVersion` is system-managed.** `updateNotification` and `updateOneOffNotification`
    throw if it is present in the payload, the same defence `tenant` and `gitCommitSha` already had.
  * **Renderer contract**: added `NotificationSendInput` (`templateVersion?: number | null`), which
    `EmailTemplate` and `TextNotificationTemplate` now extend, and the optional
    `BaseNotificationTemplateRenderer.getLatestTemplateVersion(templateKey)`. The default
    implementation returns `null`, so a renderer over a file tree needs no changes. Resolution is
    best-effort: a renderer that throws is logged and the notification is created unpinned rather
    than the write failing.
  * **Adapter contract**: `BaseNotificationAdapter.send()` may now return the render —
    `Promise<NotificationSendInput | void>` — which is the channel the service reads the version
    through. `void` is kept in the union deliberately so every adapter written before this, which
    returns `Promise<void>`, still typechecks.
  * **Backend contract**: added the optional `storeTemplateVersion(notificationId, templateVersion)`
    and the exported `supportsTemplateVersions()` guard the service asks with. It is called after
    delivery and only when the reported version differs from what is stored, and any failure is
    logged rather than thrown — the notification has already been sent by then, and losing a line
    of audit metadata is not worth reporting a successful send as failed.
  * **Filtering**: `requestedTemplateVersion` and `usedTemplateVersion` were added to
    `NotificationFilterFields`, as a single version or a list. Their four capability keys default to
    **`false`** for the same reason `fields.readAtRange` does — vocabulary no backend implemented
    when it was introduced, where a `true` default would have every shipped and third-party backend
    claim a filter it would silently ignore.
  * **Multi-backend**: both fields joined the `verifyNotificationSync` comparison list. Neither is
    per-backend detail — `requestedTemplateVersion` travels with the create/update that fans out to
    every backend, and `usedTemplateVersion` is written to all of them together at send time — so a
    backend disagreeing on either really is replication drift.
  * **New exports**: `supportsTemplateVersions`, `TemplateVersionPinningOptions`,
    `NotificationSendInput`, `TextNotificationTemplate`, `TextNotificationTemplateContent`.
* **`vintasend-prisma`**: stores, filters, and records both versions, and now implements
  `getFilterCapabilities()` declaring the new keys (plus `readAtRange`, whose clause was added while
  the translation was open). `requestedTemplateVersion` travels with ordinary create and update
  writes; `usedTemplateVersion` is written only by `storeTemplateVersion`, so a caller cannot
  rewrite which version actually went out.
  * ⚠️ **Migration required.** Consumers must add two nullable integer columns to their
    `Notification` model — `requestedTemplateVersion Int?` and `usedTemplateVersion Int?`. This is
    the one part of the feature that is not opt-in for this backend: without the columns, Prisma
    rejects the write.
* **`vintasend-medplum`**: stores both versions as `Communication.identifier` entries —
  `http://vintasend.com/fhir/requested-template-version` and
  `http://vintasend.com/fhir/used-template-version` — so a token search finds them the same way it
  already does for `bodyTemplate` and `adapterUsed`, which is what makes them filterable. FHIR
  identifier values are strings, so a version round-trips through `String()`/`parseInt` and a value
  that does not parse reads back as `null` rather than `NaN`. `storeTemplateVersion` replaces the
  existing identifier instead of accumulating them, and the adapter returns its render from `send()`.
* **Adapters returning the render from `send()`**: `vintasend-nodemailer`, `vintasend-ts-mailgun`,
  `vintasend-ts-sendgrid`, and `vintasend-ts-twilio`.
* **Managed templates: a new family of packages.** A template renderer reads templates from wherever
  its engine looks, which is usually files on disk, so every copy change is a deploy. These move
  templates into a data store instead.
  * **[`vintasend-managed-templates`](https://github.com/vintasoftware/vintasend-ts-managed-templates)**
    (`src/implementations/vintasend-managed-templates`): storage-agnostic managed templates —
    versioning (a write creates the next version and leaves the previous one untouched), a
    `draft → active → inactive → archived` lifecycle with an audit trail and `allowedTransitions` on
    every payload, tags and filtering spelled the way VintaSend spells its notification filters, and
    composition through its own `{% managed_extends %}` / `{% managed_block %}` /
    `{% managed_include %}` tags, resolved against the store before the engine runs. Ships
    `BaseTemplateManagerBackend`, `ManagedTemplateService`, `ManagedTemplateEmailRenderer` /
    `ManagedTemplateTextRenderer`, `TemplateComposer`, the shared `slugifyTag` /
    `nextAvailableSlug` rules, and a complete `InMemoryTemplateManagerBackend`. It agrees with the
    Python `vintasend-managed-templates` on the tag language, slug rules, lifecycle, and filter
    vocabulary, so a store written by one is readable by the other.
  * **[`vintasend-medplum-template-manager`](https://github.com/vintasoftware/vintasend-medplum-template-manager)**
    (`src/implementations/vintasend-medplum-template-manager`): the storage seam over Medplum,
    keeping template versions, tags, and the status audit trail as FHIR `MessageDefinition`
    resources — same project, same access policies, same infrastructure as the `Communication`
    resources the notifications live in. Every read is answered by a query, version ordering works
    by zero-padding the string FHIR stores the version in, `mostRecentActiveVersion` comes from a
    flag maintained on write, and the package declares what FHIR cannot do rather than pretending.
  * To send through a managed template, wrap your existing renderer and set the notification's
    `bodyTemplate` to a template **key** instead of a path. Note that a pin covers the template
    named, not what that template builds on: a base reached through `managed_extends` without a
    `version=` still resolves to whatever that base is today.
* **Tools: the dashboard split into an API and a UI.**
  * **[`vintasend-api`](https://github.com/vintasoftware/vintasend-ts-api)**
    (`src/tools/vintasend-api`): new REST API exposing a configured VintaSend service over HTTP,
    with `openapi.yaml` as the normative contract. It owns everything needing backend credentials —
    database access, template rendering, template lookups.
  * **`vintasend-dashboard`**: now a pure client of that contract, holding no backend credentials of
    its own, so any implementation of the contract can serve it — including a future one built on
    the Python `vintasend` package. It also displays the template version a notification asked for
    and the one it rendered.
  * **[`vintasend-templates-management-api`](https://github.com/vintasoftware/vintasend-ts-templates-management-api)**
    (`src/tools/vintasend-templates-management-api`): new REST API over a configured
    `ManagedTemplateService` — versions, the status lifecycle, tags, composition, and previewing
    what a version renders to before anyone publishes it. Its `openapi.yaml` is shared verbatim with
    the Python implementation, so one generated client works against either server, and a contract
    test walks every path and method the file declares. Listing supports ordering, negotiated
    through `/capabilities`.
* Added `readAtRange` to `NotificationFilterFields`, closing the last gap between the TypeScript and Python capability maps. Notifications can now be filtered by when they were read, not just ordered by it.
  * **Backend authors must opt in.** Unlike most capabilities, `'fields.readAtRange'` and `'negation.readAtRange'` default to **`false`**. This is new filter vocabulary rather than behaviour backends already have, so a `true` default would make every existing backend claim a filter it would silently ignore or throw on. To support it: implement `readAtRange` in your `filterNotifications` conversion — matching the NULL semantics of the other date ranges, where a row with a null `readAt` does not match a positive range and *is* returned by a negated one — then report `'fields.readAtRange': true` from `getFilterCapabilities()`, and `'negation.readAtRange': true` if you can negate it. Backends that cannot search on `readAt` need no change.
  * `vintasend-prisma` implements it and reports both keys as `true`. `vintasend-medplum` does not expose `readAt` as a searchable field — it already reports `orderBy.readAt: false` — and continues to report both keys as `false`.
* Added `'stringLookups.caseSensitive'` (default `true`) as a capability independent of `'stringLookups.caseInsensitive'`. `StringFilterLookup` has always accepted `caseSensitive`, so a backend could be asked for case-sensitive matching with no way to decline. The two are not a flag and its negation: a case-insensitive collation can only fold case, a backend with `LIKE` but no `ILIKE` can only match case-sensitively, and deriving either from the other declines the one lookup such a backend supports.
* Added `'stringLookups.exact'` (default `true`) for parity with the Python capability report, since `exact` is the default lookup.
* Added `'pagination.oneIndexed'` (default `false`) so callers that expose page numbers of their own can read the backend's convention instead of assuming an offset. It covers every paginated backend method. The TypeScript backends are 0-indexed; the Python ones are 1-indexed.
* **Documentation fix:** `filterNotifications` documented `@param page` as 1-indexed, and `vintasend-implementation-template` repeated it, but every backend translates it as `page * pageSize` — `vintasend-prisma` and `vintasend-medplum` at seven call sites each. The interface now documents pages as 0-indexed, which is what backends implement. No behaviour changed, but a backend written from the old docs would have been one page off, silently.
* **Repository and packaging**:
  * Submodules renamed to match their repositories: `vintasend-aws-s3-attachments` →
    `vintasend-ts-aws-s3-attachments` and `vintasend-aws-sqs` → `vintasend-ts-aws-sqs`, both under
    `src/implementations`; the dashboard's remote is now `vintasoftware/vintasend-dashboard`.
  * Added a `publish.yml` GitHub Actions workflow — to this repository and to
    `vintasend-implementation-template` — that publishes to npm with OIDC trusted publishing and no
    `NPM_TOKEN`. It runs on a `v*` tag or manual dispatch, verifies the tag matches
    `package.json`, resolves the dist-tag from the version's prerelease id (so `1.0.0-alpha1`
    publishes under `alpha`), and supports a dry run.
  * Release tooling: added a `major` bump and an `--alpha-base=patch|minor|major` flag, with
    `npm run release:bump:major` and `npm run release:bump:alpha:major` as shortcuts.
  * Upgraded Biome to 2.5.10 across the root package and the implementation template, migrating the
    config to `"preset": "recommended"`.

# Version 0.14.1

* **`vintasend-pug`**: Fixed `compile-pug-templates` bin being a no-op when installed from npm. The direct-execution guard compared `import.meta.url` against `path.resolve(process.argv[1])`, but when invoked via the `node_modules/.bin` symlink `process.argv[1]` is the symlink path while `import.meta.url` points at the real file in `dist/scripts/`, so the two never matched and `runCli` never ran. Switched the comparison to `fs.realpathSync(process.argv[1])` so the symlinked bin resolves to the same path.

# Version 0.14.0

* Added multi-tenant support via a new optional `tenant` field on notifications. Notifications can now be scoped to a specific tenant (e.g. an organization, clinic, or workspace), and `filterNotifications` accepts a `tenant` filter that returns only notifications belonging to the given tenant(s).
  * **Core types**: `NotificationInput`, `NotificationResendWithContextInput`, `OneOffNotificationInput`, and `OneOffNotificationResendWithContextInput` accept an optional `tenant?: string | null`. `DatabaseNotification` and `DatabaseOneOffNotification` include a `tenant: string | null` field. `NotificationFilterFields` accepts `tenant?: string | string[]`, and `'fields.tenant'` was added to the default backend filter capabilities.
  * **Tenant reassignment is forbidden on update.** The service methods `updateNotification` and `updateOneOffNotification` now statically `Omit<'tenant'>` from their partial payloads and throw at runtime if a `tenant` key is present. Backends also enforce this defensively: both `vintasend-prisma` and `vintasend-medplum` read the existing resource and reject any update whose incoming tenant differs from the current tenant. Idempotent updates (same tenant, or no `tenant` field) are still allowed so multi-backend replication continues to work.
* **`vintasend-prisma`**: `PrismaNotificationModel` now has a `tenant: string | null` column. The Prisma `where` conversion supports `tenant` filters (single value, array, and negation). Consumers must run a migration adding a nullable `tenant` text column (and ideally an index) to their notification table.
* **`vintasend-medplum`**: Tenant support uses Medplum's native compartment mechanism. On persist, `meta.accounts` is set directly on the `Communication` resource inline (no separate `$set-accounts` call), so Medplum populates `meta.compartment` server-side and your `AccessPolicy` with parameterized compartment variables scopes reads automatically. On query, `tenant` filters are translated to the FHIR `_compartment` search parameter. See: https://www.medplum.com/docs/access/multi-tenant-access-policy
* **`vintasend-dashboard`**: Added a tenant text filter to the notifications filter bar, a tenant column to the notifications table, a tenant field to the notification detail view, and URL query param sync for the `tenant` filter (bookmarkable/shareable URLs).
* Updated the notification resend reconstruction in the service layer so `tenant` is carried through, and added `'tenant'` to the multi-backend sync verification field list.
* Updated the example Prisma schema in `examples/nextjs-prisma-nodemailer-pug-temporal` to document the required column and index.

# Version 0.13.3

* Refactor compile-pug-templates script to be compatible with Node 20.x

# Version 0.13.2

* Add `@types/node` as a dev dependency to some packages that were missing it (to fix CI builds). Packages affected:
  * vintasend-aws-s3-attachments 
  * vintasend-pug 
  * vintasend-winston 
  * vintasend-implementation-template


# Version 0.13.1

* Fix wrong vintasend version reference on all implementations

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