# Git Commit SHA Tracking + Dashboard Template Version Preview Plan

## Objective

Add support for tracking which Git commit produced each notification render/send. Service can be configured with a provider (`BaseGitCommitShaProvider`) that resolves the current commit SHA automatically at runtime (via `VintaSendFactory`).

`gitCommitSha` is a system-managed field and must not be accepted from user notification input. This ensures the stored SHA reflects the version running when the notification is actually rendered/sent, which may differ from creation time.

Persist this field in notifications for both Prisma and Medplum backends, and use it in `vintasend-dashboard` to fetch template content from GitHub for historical preview.

---

## Scope

### In scope
- Type updates in `src/types/notification.ts` and related one-off types.
- New strategy/provider interface for resolving commit SHA.
- `VintaSendFactory` / `VintaSend` initialization wiring.
- Persistence + retrieval in:
  - `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`
  - `src/implementations/vintasend-medplum/src/medplum-backend.ts`
- Dashboard planning for GitHub-backed template preview by commit.
- Tests for all phases.

### Out of scope (for this workstream)
- Building a full code browser for arbitrary files.
- Re-rendering templates with every adapter-specific runtime side effect.
- Production-grade GitHub caching infrastructure beyond a first, bounded cache.

---

## Proposed Data Contract

### New field
- `gitCommitSha?: string | null`

### Precedence rules
1. Resolve SHA only via `BaseGitCommitShaProvider` at render/send time.
2. If provider resolves a valid SHA, persist normalized lowercase value.
3. If provider returns `null` or no provider is configured, persist `null`.
4. Ignore/reject any attempt to set `gitCommitSha` through notification input payloads.

### Validation rules
- Accept full SHA (`40` hex), normalized to lowercase.
- Reject invalid format with clear error at notification creation boundary.
- Keep nullable for backward compatibility.

---

## Phase 1 — Core Types + Provider Interface

### Tasks
1. Add `gitCommitSha` to notification domain types:
   - `DatabaseNotification` in `src/types/notification.ts`.
   - `DatabaseOneOffNotification` in `src/types/one-off-notification.ts`.
   - Keep `NotificationInput`/resend input types without `gitCommitSha` (system-managed only).
2. Add provider interface (new file), e.g.:
   - `src/services/git-commit-sha/base-git-commit-sha-provider.ts`
   - `interface BaseGitCommitShaProvider { getCurrentGitCommitSha(): string | Promise<string | null> | null; }`
3. Export new types/interface from `src/index.ts`.

### Test cases
- **Type-level:** notification creation/resend input does **not** accept `gitCommitSha`.
- **Type-level:** one-off notification creation/resend input does **not** accept `gitCommitSha`.
- **Type-level:** persisted notification types expose `gitCommitSha` as nullable.
- **Runtime unit (if validator helper added):** valid/invalid SHA normalization behavior.

---

## Phase 2 — Service Initialization Strategy in `VintaSendFactory`

### Tasks
1. Extend `VintaSendFactory.create(...)` signature to accept optional commit SHA provider (without breaking existing call sites).
2. Inject provider into `VintaSend` instance.
3. On render/send execution paths (including one-off + resend flows):
   - Resolve `gitCommitSha` via provider at execution time.
   - Persist/update `gitCommitSha` based on that execution-time value.
4. Add internal helper for resolution + validation to avoid duplication.

### Backward compatibility
- Keep existing positional parameters stable where possible. Add the possibility of passing a single object as parameter with all the fields. Mark the usage with positional parameters as deprecated.

### Test cases
- `createNotification`/`createOneOffNotification` input cannot provide `gitCommitSha`.
- Send/render execution uses provider SHA and persists normalized value.
- Provider returns `null` => persisted `null`.
- Invalid SHA from provider throws deterministic error.
- Existing tests without SHA/provider continue passing.

---

## Phase 3 — Prisma Backend Persistence

### Tasks
1. Update Prisma backend model typing in `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`:
   - `PrismaNotificationModel` includes `gitCommitSha: string | null`.
   - Create/update data mappers include field.
   - Serialization (`serializeAnyNotification`) maps field to database notification return.
2. Update filter capabilities/contracts only if we choose to filter by SHA now.
3. Update `schema.prisma.example` (`Notification` model) with nullable `gitCommitSha` + index.
4. Update real example Prisma schema:
   - `src/examples/nextjs-prisma-nodemailer-pug-temporal/schema.prisma`.
5. Add migration guidance in docs (package README / changelog note).

### Test cases
- Persist regular notification with SHA -> create payload contains `gitCommitSha`.
- Persist one-off notification with SHA -> create payload contains `gitCommitSha`.
- Read/serialize notifications returns correct SHA for regular and one-off.
- Execution-time update flow sets/clears SHA based on provider output.
- No-SHA notifications remain readable and functional.

---

## Phase 4 — Medplum Backend Persistence

### Tasks
1. Add identifier system constant in `medplum-backend.ts`:
   - `IDENTIFIER_SYSTEMS.gitCommitSha`.
2. On persist (regular + one-off), write SHA into `Communication.identifier` token.
3. On read (`mapToDatabaseNotification`), extract SHA from identifier.
4. On update (`updateIdentifiers`), include SHA upsert/removal logic.
5. (Optional now, recommended) include SHA in filter field capabilities if implementing query support.

### Test cases
- Persist regular notification writes SHA identifier and maps back.
- Persist one-off notification writes SHA identifier and maps back.
- Execution-time SHA refresh updates identifier correctly.
- Missing identifier maps to `null`.
- Existing Medplum tests for non-SHA behavior remain green.

---

## Phase 5 — Cross-Cutting Docs, Versioning, and Compatibility

### Tasks
- Update README/docs with:
   - New persisted `gitCommitSha` notification field (system-managed).
  - New factory/provider option.
   - Clarify that `gitCommitSha` is resolved from provider at send/render time, not accepted in notification input.
  - Recommended provider implementation examples (env var, shell command, CI injected value).
- Add changelog entry describing additive, backward-compatible change.
- Add migration notes for Prisma schema updates.

### Test cases
- Documentation verification checklist (examples compile/type-check in CI where feasible).
- Build and run tests for each package (vintasend, vintasend-prisma, vintasend-medplum). The package.json of the implementation needs to be updates to reference the local version of vintasend, so they build correctly and we're able to run the tests.


### Release
Release a new version of VintaSend and its official implementations:
* Version bump:
    ```shell
    npm run release:bump:patch
    ```
* Commit and publish the new version:
    ```shell
    npm run release:publish
    ```

### Update the examples and tools
* Update the vintasend-medplum-example to use the new versions of vintasend and implementations
* Update the vintasend-dashboard to use the new versions of vintasend and implementations

---

## Phase 6 — Dashboard Foundation for Template Version Preview

### Goal
Enable dashboard to fetch template files from GitHub at the specific commit stored in each notification and use them for preview rendering.

### Tasks
1. Extend dashboard DTOs to include `gitCommitSha` in:
   - `src/tools/vintasend-dashboard/lib/notifications/types.ts`
   - `src/tools/vintasend-dashboard/lib/notifications/serialize.ts`
2. Add configuration:
   - `GITHUB_REPO` (`owner/repo`)
   - `GITHUB_API_KEY` (PAT or GitHub App token)
   - Optional `GITHUB_API_BASE_URL` for GH Enterprise.
3. Create server-only GitHub client module (new):
   - Handles authenticated fetch by `path + ref`.
   - Handles rate-limit and not-found responses.
4. Define template path resolver strategy:
   - Start with configurable base path + `bodyTemplate` / `subjectTemplate` paths.
5. Implement bounded caching (memory or Next.js cache primitives) keyed by `repo:path:sha`.

### Test cases
- Serializer includes `gitCommitSha` for detail payload.
- GitHub client builds correct API URL with `ref=<gitCommitSha>`.
- 404/403/rate-limit errors return safe, user-friendly error states.
- Cache returns same content for repeated requests with same key.

---

## Phase 7 — Dashboard Notification Detail Preview UX

### Tasks
1. In notification detail panel (`app/notifications/components/notification-detail.tsx`):
   - Display `gitCommitSha` with copy action.
2. Add new action in the Action menu for "Preview render"
3. Add a dialog that displays the preview of the notification.
2. Add server action(s) to fetch template source using notification’s SHA.
3. Render preview states:
   - Loading
   - Success (template content fetched)
   - Missing SHA
   - Fetch error / unauthorized
4. Ensure no secrets are exposed to client.

### Test cases
- Detail panel renders SHA when present and fallback when absent.
- Preview action calls server route/action with notification id only.
- Success path renders fetched template text.
- Error states render deterministic messages.
- No API key leakage in client bundles (assert server-only modules).

---

## Rollout Strategy

1. Merge Phases 1–5 first (data capture + storage).
2. Release library/backend updates.
3. Migrate Prisma DB in consumer apps.
4. Enable dashboard Phases 6–7

---

## Risks & Mitigations

- **Risk:** Factory signature breakage in existing integrations.
  - **Mitigation:** additive optional param/options, keep defaults.
- **Risk:** Invalid SHA values from custom providers.
  - **Mitigation:** central validator + explicit error messages.
- **Risk:** GitHub API rate limits.
  - **Mitigation:** caching, clear retry UX, optional backoff.
- **Risk:** Repo/path mismatch prevents preview.
  - **Mitigation:** explicit configuration validation + diagnostics in dashboard.

---

## Suggested Implementation Order (Execution Checklist)

1. Types + provider interface.
2. `VintaSendFactory`/service resolution logic.
3. Prisma backend + schema example updates + tests.
4. Medplum backend + tests.
5. Docs/changelog.
6. Dashboard DTO + GitHub client + preview UI + tests.
7. End-to-end validation in example apps.
