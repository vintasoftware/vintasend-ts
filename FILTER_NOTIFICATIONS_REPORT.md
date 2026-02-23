# filterNotifications Implementation Report

## Overview

Added a `filterNotifications` method to the `BaseNotificationBackend` interface, along with supporting filter types that enable flexible querying of notifications with logical operators (AND, OR, NOT). Implemented the method in the Medplum FHIR backend with purely server-side filtering.

---

## 1. Core Type System

### New Types (`src/services/notification-backends/base-notification-backend.ts`)

#### `DateRange`
```typescript
{ from?: Date; to?: Date }
```
Represents a date interval for range-based filtering (e.g., creation date, sent date).

#### `NotificationFilterFields<Config>`
A filter object with optional fields:

| Field | Type | Description |
|---|---|---|
| `status` | `NotificationStatus \| NotificationStatus[]` | Filter by notification status |
| `notificationType` | `NotificationType \| NotificationType[]` | Filter by notification type (email, SMS, etc.) |
| `adapterUsed` | `string \| string[]` | Filter by the adapter that sent the notification |
| `userId` | `Identifier` | Filter by recipient user ID |
| `bodyTemplate` | `string` | Filter by body template name |
| `subjectTemplate` | `string` | Filter by subject template name |
| `contextName` | `string` | Filter by the context generator name |
| `createdAtRange` | `DateRange` | Filter by creation date range |
| `sentAtRange` | `DateRange` | Filter by sent-at date range |

#### `NotificationFilter<Config>`
A discriminated union type supporting logical composition:

```typescript
type NotificationFilter<Config> =
  | NotificationFilterFields<Config>            // field-level filter
  | { and: NotificationFilter<Config>[] }       // logical AND
  | { or: NotificationFilter<Config>[] }        // logical OR
  | { not: NotificationFilter<Config> }         // logical NOT
```

#### `isFieldFilter()` Type Guard
Utility function to distinguish a field filter from logical operator filters at runtime.

### Interface Method

Added to `BaseNotificationBackend`:

```typescript
filterNotifications(
  filter: NotificationFilter<Config>,
  page: number,
  pageSize: number
): Promise<AnyDatabaseNotification<Config>[]>
```

### Exports (`src/index.ts`)

Re-exported from the package entry point:
- `NotificationFilter`
- `NotificationFilterFields`
- `DateRange`
- `isFieldFilter`

---

## 2. Tests (`src/services/notification-backends/__tests__/base-notification-backend.test.ts`)

Added 22 new tests covering:

| Category | Tests |
|---|---|
| **Individual Fields** | status, notificationType, adapterUsed, userId, bodyTemplate, subjectTemplate, contextName, createdAtRange, sentAtRange |
| **Combined Fields** | Multiple fields in a single filter |
| **Logical Operators** | AND, OR, NOT |
| **Deep Nesting** | AND containing OR containing NOT |
| **Date Range Bounds** | `from` only, `to` only, both bounds |
| **Edge Cases** | Empty filter object |
| **Type Guard** | `isFieldFilter` correctly identifies field vs. logical filters |

All 40 tests in the suite pass.

---

## 3. Medplum Backend Implementation (`src/implementations/vintasend-medplum/src/medplum-backend.ts`)

### Storage Changes (BREAKING)

To enable server-side FHIR filtering on fields that were previously stored only in the Communication payload, the following data is now stored as **FHIR `Communication.identifier`** entries:

| Field | Identifier System URI |
|---|---|
| `bodyTemplate` | `http://vintasend.com/fhir/body-template` |
| `subjectTemplate` | `http://vintasend.com/fhir/subject-template` |
| `adapterUsed` | `http://vintasend.com/fhir/adapter-used` |

The `contextName` and `notificationType` fields are stored as `meta.tag` entries on the Communication resource and are searchable via the FHIR `_tag` parameter.

#### Affected Write Paths
- `persistNotification()` — adds identifier entries on creation
- `bulkPersistNotifications()` — adds identifier entries on bulk creation
- `persistNotificationUpdate()` — upserts identifiers via `updateIdentifiers()` helper
- `persistOneOffNotification()` — adds identifier entries on creation
- `persistOneOffNotificationUpdate()` — upserts identifiers via `updateIdentifiers()` helper

#### Read Path
`mapToDatabaseNotification()` reads `bodyTemplate`, `subjectTemplate`, and `adapterUsed` from identifiers, with a fallback to the old payload location for backward compatibility on `bodyTemplate`/`subjectTemplate`.

### Filter Field → FHIR Parameter Mapping

| Filter Field | FHIR Search Parameter | Notes |
|---|---|---|
| `status` | `status` | Mapped via `notificationStatusToFhirStatus()` |
| `notificationType` | `_tag` | Tag code from `meta.tag` |
| `contextName` | `_tag` | Appended to existing `_tag` param |
| `userId` | `recipient` | FHIR reference |
| `adapterUsed` | `identifier` | System\|value format |
| `bodyTemplate` | `identifier` | System\|value format |
| `subjectTemplate` | `identifier` | System\|value format |
| `sentAtRange.from` | `sent:ge` | ISO date string |
| `sentAtRange.to` | `sent:le` | ISO date string |
| `createdAtRange.from` | `_lastUpdated:ge` | ISO date string |
| `createdAtRange.to` | `_lastUpdated:le` | ISO date string |

### Logical Operator Handling

| Operator | Behavior |
|---|---|
| **AND** | Merges all child filters' FHIR params into a single query |
| **OR** | **Throws an error** — FHIR does not natively support OR across different fields in a single query |
| **NOT** | Uses FHIR `:not` modifier on each parameter (e.g., `status:not`, `_tag:not`, `identifier:not`) |

### Key Helper Methods

- `buildFhirSearchParams(filter)` — Recursively processes the filter tree into FHIR `URLSearchParams`
- `fieldFilterToFhirParams(filter)` — Maps individual field filters to FHIR search parameters
- `negateFilter(filter)` — Converts a field filter into its FHIR negation using `:not` modifiers
- `mergeAndFilters(paramsList)` — Combines multiple FHIR param sets, joining values for shared keys
- `ensureNotificationTag(params)` — Ensures the vintasend Communication tag is always present
- `updateIdentifiers(identifiers, system, value)` — Upserts an identifier entry by system URI

---

## 4. Prisma Backend Implementation (`src/implementations/vintasend-prisma/src/prisma-notification-backend.ts`)

Implemented `filterNotifications` in the Prisma backend with server-side filtering using Prisma `findMany({ where, skip, take })`.

### What was added

- A private converter method: `convertNotificationFilterToPrismaWhere(filter)`
- Full recursive mapping from `NotificationFilter` to Prisma-style `where`
- Typed support in `NotificationPrismaClientInterface` for richer `where` objects

### Filter mapping in Prisma

| VintaSend Filter | Prisma Where Mapping |
|---|---|
| `status: string` | `status: value` |
| `status: string[]` | `status: { in: [...] }` |
| `notificationType: string` | `notificationType: value` |
| `notificationType: string[]` | `notificationType: { in: [...] }` |
| `adapterUsed: string` | `adapterUsed: value` |
| `adapterUsed: string[]` | `adapterUsed: { in: [...] }` |
| `userId` | `userId` |
| `bodyTemplate` | `bodyTemplate` |
| `subjectTemplate` | `subjectTemplate` |
| `contextName` | `contextName` |
| `createdAtRange.from` | `createdAt.gte` |
| `createdAtRange.to` | `createdAt.lte` |
| `sentAtRange.from` | `sentAt.gte` |
| `sentAtRange.to` | `sentAt.lte` |
| `{ and: [...] }` | `{ AND: [...] }` |
| `{ or: [...] }` | `{ OR: [...] }` |
| `{ not: ... }` | `{ NOT: ... }` |

### Pagination behavior

- `skip = page * pageSize`
- `take = pageSize`

---

## 5. Prisma Tests Added (`src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend.test.ts`)

Added focused tests for the new Prisma implementation:

- Field-filter + pagination behavior in `filterNotifications`
- Nested logical filters conversion (`AND`, `OR`, `NOT`)
- Date-range conversion behavior and empty-range handling

### Validation result

- Targeted Prisma backend test file passes:
  - **Test suites:** 1 passed
  - **Tests:** 63 passed

---

## 6. Summary of Files Changed

| File | Change Type | Description |
|---|---|---|
| `src/services/notification-backends/base-notification-backend.ts` | Modified | Added filter types, `isFieldFilter`, and `filterNotifications` to interface |
| `src/services/notification-backends/__tests__/base-notification-backend.test.ts` | Modified | Added 22 filter tests |
| `src/index.ts` | Modified | Re-exported new filter types |
| `src/implementations/vintasend-medplum/src/medplum-backend.ts` | Modified | Implemented `filterNotifications` with FHIR search; changed storage to use identifiers |
| `src/implementations/vintasend-prisma/src/prisma-notification-backend.ts` | Modified | Implemented `filterNotifications`, added private `NotificationFilter` → Prisma `where` converter, and expanded Prisma `where` typing |
| `src/implementations/vintasend-prisma/src/__tests__/prisma-notification-backend.test.ts` | Modified | Added Prisma filter conversion and query behavior tests |

---

## 7. Known Remaining Work

- **Rebuild core package**: The `vintasend/dist/` output needs to be rebuilt (`npm run build`) so the Medplum backend can resolve imports for `NotificationFilter`, `NotificationFilterFields`, and `isFieldFilter`.
- **Medplum backend tests**: Should be run after the core rebuild to verify the full implementation.
- **Migration**: Existing Communication resources in Medplum will not have the new identifier entries. A migration may be needed for production data, or the backward-compatible fallback in `mapToDatabaseNotification` can be relied upon for reads (but filtering on old records by `bodyTemplate`/`subjectTemplate`/`adapterUsed` will not work until they are updated).
