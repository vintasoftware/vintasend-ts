import type { AttachmentFileRecord, StoredAttachment } from '../../types/attachment.js';
import type { InputJsonValue } from '../../types/json-values.js';
import type {
  AnyDatabaseNotification,
  AnyNotification,
  DatabaseNotification,
  DatabaseOneOffNotification,
  Notification,
  OneOffNotificationInput,
} from '../../types/notification.js';
import type { NotificationStatus } from '../../types/notification-status.js';
import type { NotificationType } from '../../types/notification-type.js';
import type { BaseNotificationTypeConfig } from '../../types/notification-type-config.js';
import type { BaseLogger } from '../loggers/base-logger.js';

/**
 * Date range filter with optional lower and upper bounds.
 */
export type DateRange = {
  from?: Date;
  to?: Date;
};

export type StringFilterLookup = {
  lookup: 'exact' | 'startsWith' | 'endsWith' | 'includes';
  value: string;
  caseSensitive?: boolean;
};

export type StringFieldFilter = string | StringFilterLookup;

export type NotificationOrderByField =
  | 'sendAfter'
  | 'sentAt'
  | 'readAt'
  | 'createdAt'
  | 'updatedAt';

export type NotificationOrderDirection = 'asc' | 'desc';

export type NotificationOrderBy = {
  field: NotificationOrderByField;
  direction: NotificationOrderDirection;
};

/**
 * Flat dotted key capability map describing which filter features a backend supports.
 * Use flat dotted keys for logical operators, fields, and negations:
 * - `logical.*`: Operator support (and, or, not, notNested)
 * - `fields.*`: Field filtering support
 * - `negation.*`: Negation support for specific fields
 * - `pagination.*`: Pagination conventions the backend follows
 *
 * When a backend implements getFilterCapabilities(), missing keys default to true (supported),
 * ensuring forward compatibility when new capabilities are added.
 * Backends that don't implement getFilterCapabilities() are treated as supporting all features.
 *
 * `stringLookups.caseSensitive` and `stringLookups.caseInsensitive` are two
 * independent capabilities, not a flag and its negation. A backend on a
 * case-insensitive collation (MySQL `*_ci`) matches case-insensitively and
 * cannot do otherwise, so it reports `caseSensitive: false`. A backend with
 * `LIKE` but no `ILIKE` and no case folding matches case-sensitively only, so it
 * reports `caseInsensitive: false`. Deriving either from the other inverts the
 * answer for exactly the backends that had a constraint worth reporting.
 *
 * `pagination.oneIndexed` describes a convention rather than a feature: `false`
 * (the default) means the backend's first page is page `0`, `true` means it is
 * page `1`. Every TypeScript backend is 0-indexed; the Python VintaSend backends
 * are 1-indexed, which is why callers that expose page numbers of their own must
 * read this instead of assuming an offset. It covers **every** paginated backend
 * method — `getNotifications`, `getPendingNotifications`, `getFutureNotifications`,
 * `getOneOffNotifications`, `filterNotifications` and the rest — because a
 * backend follows one pagination convention throughout.
 *
 * It is one of the keys whose default is `false` rather than `true`, since the
 * TypeScript convention is 0-indexed. That is safe: `getBackendSupportedFilterCapabilities()`
 * merges these defaults under the backend's own report, so the key is always
 * present in what a caller receives and the "missing keys default to true" rule
 * never applies to it in practice.
 *
 * `fields.readAtRange` and `negation.readAtRange` default to `false` for a
 * different reason. Defaulting to true is safe for a capability that describes
 * behaviour backends already have — it says "assume support unless a backend
 * says otherwise". `readAtRange` is new filter vocabulary that no backend
 * implemented when it was introduced, so a `true` default would have made every
 * shipped and third-party backend claim a filter it would silently ignore or
 * throw on, which is the exact failure these capabilities exist to prevent. A
 * backend flips both keys to `true` when it implements the field; a backend that
 * cannot search on `readAt` at all (`vintasend-medplum`, which does not expose it
 * as a searchable field and already reports `orderBy.readAt: false`) leaves them
 * alone.
 */
export type NotificationFilterCapabilities = {
  [key: string]: boolean;
};

/**
 * Leaf-level filter conditions for notification fields.
 * All specified fields are combined with implicit AND.
 *
 * Date-range fields (`sendAfterRange`, `createdAtRange`, `sentAtRange`,
 * `readAtRange`) all share the same NULL semantics, which backends must
 * implement consistently: a notification whose date field is null does **not**
 * match a positive range filter, and because `{ not: ... }` inverts the positive
 * result, such a notification **is** included by a negated one. A notification
 * that was never read is therefore excluded by `readAtRange` and returned by
 * `{ not: { readAtRange } }`.
 */
export type NotificationFilterFields<Config extends BaseNotificationTypeConfig> = {
  /**
   * The notification's ID, or one of several.
   *
   * AND it with another filter to ask about just these notifications:
   * `{ and: [filter, { id: ids }] }` counts which of a batch still match `filter`, without listing
   * everything else that does. An empty array matches nothing. Reported by `fields.id` and
   * `negation.id`, both `false` by default.
   */
  id?: Config['NotificationIdType'] | Config['NotificationIdType'][];
  status?: NotificationStatus | NotificationStatus[];
  notificationType?: NotificationType | NotificationType[];
  adapterUsed?: string | string[];
  userId?: Config['UserIdType'];
  bodyTemplate?: StringFieldFilter;
  subjectTemplate?: StringFieldFilter;
  contextName?: StringFieldFilter;
  tenant?: string | string[];
  sendAfterRange?: DateRange;
  createdAtRange?: DateRange;
  sentAtRange?: DateRange;
  readAtRange?: DateRange;
  /**
   * Which template version a notification asked for, and which one it actually rendered.
   *
   * Scalar or array, like the other membership fields. Both are `null` on a notification whose
   * renderer does not version templates, and `usedTemplateVersion` is `null` until it has been
   * sent; under the NULL semantics above such a notification never matches a positive filter on
   * either field and is included by a negated one.
   */
  requestedTemplateVersion?: number | number[];
  usedTemplateVersion?: number | number[];
  /**
   * Whether a notification has a send time: `true` matches one whose `sendAfter` is set, `false`
   * one whose `sendAfter` is `null`.
   *
   * `sendAfterRange` cannot say this. A range with no bounds matches every notification on some
   * backends and none on others, and a negated range is unsupported on several. Reported by
   * `fields.hasSendAfter` and `negation.hasSendAfter`, both `false` by default. Negating it is the
   * same as asking for the other value.
   */
  hasSendAfter?: boolean;
  /**
   * Whether a notification is pinned to a template version: `true` matches one whose
   * `requestedTemplateVersion` is set, `false` one that renders whatever is current at send time.
   *
   * Combine it with a negated `requestedTemplateVersion` to ask for "pinned, but not to V":
   * `{ and: [{ hasRequestedTemplateVersion: true }, { not: { requestedTemplateVersion: V } }] }`.
   * A negated version alone also matches unpinned notifications, under the NULL semantics above.
   * Reported by `fields.hasRequestedTemplateVersion` and `negation.hasRequestedTemplateVersion`,
   * both `false` by default.
   */
  hasRequestedTemplateVersion?: boolean;
};

/**
 * Composable notification filter supporting logical operators.
 *
 * - A plain field filter applies all conditions with implicit AND.
 * - `{ and: [...] }` requires all sub-filters to match.
 * - `{ or: [...] }` requires at least one sub-filter to match.
 * - `{ not: filter }` inverts the sub-filter.
 */
export type NotificationFilter<Config extends BaseNotificationTypeConfig> =
  | NotificationFilterFields<Config>
  | { and: NotificationFilter<Config>[] }
  | { or: NotificationFilter<Config>[] }
  | { not: NotificationFilter<Config> };

export const DEFAULT_BACKEND_FILTER_CAPABILITIES = {
  'logical.and': true,
  'logical.or': true,
  'logical.not': true,
  'logical.notNested': true,
  'fields.status': true,
  'fields.notificationType': true,
  'fields.adapterUsed': true,
  'fields.userId': true,
  'fields.bodyTemplate': true,
  'fields.subjectTemplate': true,
  'fields.contextName': true,
  'fields.tenant': true,
  'fields.sendAfterRange': true,
  'fields.createdAtRange': true,
  'fields.sentAtRange': true,
  'negation.sendAfterRange': true,
  'negation.createdAtRange': true,
  'negation.sentAtRange': true,
  // `readAtRange` is new vocabulary rather than behaviour backends already have,
  // so it defaults to false — see the note on this constant.
  'fields.readAtRange': false,
  'negation.readAtRange': false,
  // The template-version fields default to false for the same reason: they are vocabulary no
  // backend implemented when they were introduced, so a `true` default would have every shipped
  // and third-party backend claim a filter it would silently ignore.
  'fields.requestedTemplateVersion': false,
  'fields.usedTemplateVersion': false,
  'negation.requestedTemplateVersion': false,
  'negation.usedTemplateVersion': false,
  // The presence filters are new vocabulary as well.
  'fields.hasSendAfter': false,
  'negation.hasSendAfter': false,
  'fields.hasRequestedTemplateVersion': false,
  'negation.hasRequestedTemplateVersion': false,
  // So is `id`: a backend that predates it would ignore it and act on every match.
  'fields.id': false,
  'negation.id': false,
  'stringLookups.exact': true,
  'stringLookups.startsWith': true,
  'stringLookups.endsWith': true,
  'stringLookups.includes': true,
  'stringLookups.caseInsensitive': true,
  'stringLookups.caseSensitive': true,
  'orderBy.sendAfter': true,
  'orderBy.sentAt': true,
  'orderBy.readAt': true,
  'orderBy.createdAt': true,
  'orderBy.updatedAt': true,
  // Unlike the keys above, this reports a convention rather than a feature:
  // every TypeScript backend numbers its first page 0.
  'pagination.oneIndexed': false,
};

/**
 * The statuses a notification can be re-queued from: the ones that end without a delivery.
 *
 * `SENT` and `READ` are left out on purpose. Re-queuing a delivered notification would deliver it
 * twice under one record and overwrite the record of the first delivery; `resendNotification`
 * creates a new notification for that instead. `PENDING_SEND` is already queued.
 */
export const REQUEUEABLE_NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  'FAILED',
  'CANCELLED',
];

/**
 * The statuses whose template pin can still be changed: every one that may yet render.
 *
 * A sent notification's `requestedTemplateVersion` describes what it was asked to render when it
 * went out, so moving it afterwards would make the record disagree with what was delivered.
 */
export const REPINNABLE_NOTIFICATION_STATUSES: readonly NotificationStatus[] = [
  'PENDING_SEND',
  'FAILED',
  'CANCELLED',
];

/**
 * How a write records the notification's version token (`notificationVersion`).
 *
 * Without `notificationVersion` the backend is the primary: the write generates a new token and
 * stores it. With it, the write replicates a write the primary already made, and the backend
 * stores this token as it is instead of generating one, so every backend holds the same token for
 * the same version of the notification. `VintaSend` passes it only to additional backends, taken
 * from what the primary's write returned.
 */
export type NotificationWriteOptions = {
  notificationVersion?: string;
};

/**
 * What a write that returns no notification hands back: the token it recorded, so `VintaSend` can
 * pass it on to the additional backends. A backend that keeps no tokens may return nothing.
 */
export type NotificationWriteResult = {
  notificationVersion?: string;
};

/**
 * `NotificationWriteOptions` for `bulkPersistNotifications`: one token per notification, in the
 * order of the notifications.
 */
export type BulkNotificationWriteOptions = {
  notificationVersions?: (string | undefined)[];
};

/**
 * What `BaseNotificationBackend.requeueNotification` is asked to change besides the status.
 *
 * `sendAfter` left out keeps the notification's own; `null` means "as soon as possible".
 *
 * `templateVersion` and `expectedVersion` are only ever passed to a backend whose
 * `getActionCapabilities()` reports `requeue.templateVersion` and `requeue.expectedVersion`. A
 * backend that reports them must honour them, and one that does not must throw if it is handed
 * them anyway, never ignore them.
 */
export type RequeueNotificationOptions = NotificationWriteOptions & {
  sendAfter?: Date | null;
  /**
   * Pin the notification to this template version in the same write that re-queues it, so it is
   * never left pinned but not pending, or pending on the old pin.
   */
  templateVersion?: number;
  /**
   * Write only if the notification is still at this version, the opaque token
   * `filterNotificationVersions` returned for it. Otherwise throw a `NotificationActionError` with
   * reason `CHANGED` and write nothing.
   */
  expectedVersion?: string;
};

/**
 * What `BaseNotificationBackend.repinNotification` is asked to check besides the status.
 */
export type RepinNotificationOptions = NotificationWriteOptions & {
  /**
   * Write only if the notification is still at this version. Otherwise throw a
   * `NotificationActionError` with reason `CHANGED` and write nothing.
   */
  expectedVersion?: string;
};

/**
 * A notification's ID and the opaque token for the version of it a backend holds.
 *
 * The token changes whenever the notification is written, by anyone. Pass it back as
 * `expectedVersion` to act on the notification only if nothing has changed since it was listed.
 * Compare tokens for equality only: they are not ordered, and a backend may use any string.
 *
 * The primary backend generates the token and replication copies it (see
 * `NotificationWriteOptions`), so a token listed from an additional backend can be passed to an
 * action on the primary. It matches once the replica has caught up with the primary's last write;
 * until then the action is refused with `CHANGED`.
 */
export type NotificationVersion<Config extends BaseNotificationTypeConfig> = {
  id: Config['NotificationIdType'];
  version: string;
};

/**
 * Options shared by the bulk actions, `repinNotifications` and `requeueNotifications`.
 */
export type BulkNotificationActionOptions<Config extends BaseNotificationTypeConfig> = {
  /**
   * Act only on the notifications that still match this filter, evaluated by the backend in the
   * same pass that checks the versions. Typically the filter the targets were listed with. The
   * backend must support every field it uses, as for `filterNotificationVersions`.
   */
  filter?: NotificationFilter<Config>;
};

/**
 * What `BaseNotificationBackend.requeueNotifications` is asked to change besides the status. The
 * same as `RequeueNotificationOptions`, for every target alike, without `expectedVersion`, which
 * each target carries.
 */
export type BulkRequeueNotificationOptions<Config extends BaseNotificationTypeConfig> =
  BulkNotificationActionOptions<Config> & {
    sendAfter?: Date | null;
    templateVersion?: number;
  };

/**
 * What a bulk action did with one target.
 *
 * * `WRITTEN`: the notification was moved. `version` is its new token.
 * * `UNCHANGED`: a re-pin found it already on the version and wrote nothing. `version` is its
 *   token, the one the caller expected.
 * * `CHANGED`: it is no longer at the version the caller expected, or it changed while being
 *   written. Nothing was written.
 * * `INVALID_STATUS`: its status does not allow the action. `status` says which. Nothing was
 *   written.
 * * `NOT_MATCHED`: it no longer exists, or no longer matches `filter`. Nothing was written.
 * * `FAILED`: the backend refused the write for another reason, such as a permission error from
 *   the store. Nothing was written for this one; the others are unaffected.
 */
export type BulkNotificationActionOutcome =
  | 'WRITTEN'
  | 'UNCHANGED'
  | 'CHANGED'
  | 'INVALID_STATUS'
  | 'NOT_MATCHED'
  | 'FAILED';

/**
 * One target's result from a bulk action. Results come back in the order of the targets.
 */
export type BulkNotificationActionResult<Config extends BaseNotificationTypeConfig> = {
  id: Config['NotificationIdType'];
  outcome: BulkNotificationActionOutcome;
  /** The token the notification is at now, for `WRITTEN` and `UNCHANGED`. */
  version?: string;
  /** For `INVALID_STATUS`. */
  status?: NotificationStatus;
};

/**
 * Flat dotted keys describing which notification actions a backend supports beyond the required
 * ones. Every key defaults to `false`: a backend that predates them, or does not implement
 * `getActionCapabilities()`, supports none of them, and `VintaSend` refuses the option with
 * `NotificationActionError` reason `UNSUPPORTED` rather than letting the backend ignore it.
 *
 * * `repin.expectedVersion`: `repinNotification` is implemented and checks `expectedVersion`.
 * * `requeue.expectedVersion`: `requeueNotification` checks `expectedVersion`.
 * * `requeue.templateVersion`: `requeueNotification` pins `templateVersion` in the same write.
 * * `versions.filter`: `filterNotificationVersions` is implemented.
 * * `repin.bulk`: `repinNotifications` is implemented.
 * * `requeue.bulk`: `requeueNotifications` is implemented, `templateVersion` included.
 */
export type NotificationActionCapabilities = {
  [key: string]: boolean;
};

export const DEFAULT_BACKEND_ACTION_CAPABILITIES: Readonly<NotificationActionCapabilities> = {
  'repin.expectedVersion': false,
  'requeue.expectedVersion': false,
  'requeue.templateVersion': false,
  'versions.filter': false,
  'repin.bulk': false,
  'requeue.bulk': false,
};

export interface BaseNotificationBackend<Config extends BaseNotificationTypeConfig> {
  /**
   * Get a unique identifier for this backend instance.
   *
   * Used to distinguish between multiple backend instances in a multi-backend setup.
   * When not implemented, callers should use a fallback identifier strategy.
   */
  getBackendIdentifier?(): string;

  getAllPendingNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getPendingNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]>;
  getAllFutureNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getFutureNotifications(
    page: number,
    pageSize: number,
  ): Promise<AnyDatabaseNotification<Config>[]>;
  getAllFutureNotificationsFromUser(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]>;
  getFutureNotificationsFromUser(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]>;
  persistNotification(
    notification: Omit<Notification<Config>, 'id'> & { id?: Config['NotificationIdType'] },
    options?: NotificationWriteOptions,
  ): Promise<DatabaseNotification<Config>>;
  getAllNotifications(): Promise<AnyDatabaseNotification<Config>[]>;
  getNotifications(page: number, pageSize: number): Promise<AnyDatabaseNotification<Config>[]>;
  bulkPersistNotifications(
    notifications: Omit<AnyNotification<Config>, 'id'>[],
    options?: BulkNotificationWriteOptions,
  ): Promise<Config['NotificationIdType'][]>;
  persistNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<Notification<Config>, 'id'>>,
    options?: NotificationWriteOptions,
  ): Promise<DatabaseNotification<Config>>;
  /**
   * Applies a replication snapshot only when the destination state is older.
   *
   * This is used to mitigate out-of-order async replication deliveries.
   * Implementations should return `applied: false` when the destination notification
   * is already newer or equal to the snapshot.
   *
   * The snapshot is read from the primary, so its `notificationVersion` is the primary's token:
   * store it as it is, as a write given `NotificationWriteOptions.notificationVersion` does.
   */
  applyReplicationSnapshotIfNewer?(
    snapshot: AnyDatabaseNotification<Config>,
  ): Promise<{ applied: boolean }>;
  markAsSent(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
    options?: NotificationWriteOptions,
  ): Promise<AnyDatabaseNotification<Config>>;
  markAsFailed(
    notificationId: Config['NotificationIdType'],
    checkIsPending: boolean,
    options?: NotificationWriteOptions,
  ): Promise<AnyDatabaseNotification<Config>>;
  markAsRead(
    notificationId: Config['NotificationIdType'],
    checkIsSent: boolean,
    options?: NotificationWriteOptions,
  ): Promise<DatabaseNotification<Config>>;
  cancelNotification(
    notificationId: Config['NotificationIdType'],
    options?: NotificationWriteOptions,
    // biome-ignore lint/suspicious/noConfusingVoidType: `void` keeps backends written before tokens, which return `Promise<void>`, assignable.
  ): Promise<NotificationWriteResult | void>;
  getNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<AnyDatabaseNotification<Config> | null>;
  filterAllInAppUnreadNotifications(
    userId: Config['UserIdType'],
  ): Promise<DatabaseNotification<Config>[]>;
  filterInAppUnreadNotifications(
    userId: Config['UserIdType'],
    page: number,
    pageSize: number,
  ): Promise<DatabaseNotification<Config>[]>;
  getUserEmailFromNotification(
    notificationId: Config['NotificationIdType'],
  ): Promise<string | undefined>;
  storeAdapterAndContextUsed(
    notificationId: Config['NotificationIdType'],
    adapterKey: string,
    context: InputJsonValue,
    options?: NotificationWriteOptions,
    // biome-ignore lint/suspicious/noConfusingVoidType: `void` keeps backends written before tokens, which return `Promise<void>`, assignable.
  ): Promise<NotificationWriteResult | void>;

  /**
   * Persist which version of the template actually rendered this notification.
   *
   * Called by the service at send time, only when the renderer reported a version and it differs
   * from what is already stored — so an implementation need not deduplicate writes itself.
   *
   * Optional on purpose: a backend with no column for it simply omits the method and keeps
   * working, which is what lets the field be added without a major version. The cost of not
   * implementing it is only that `usedTemplateVersion` stays absent on the records that backend
   * holds.
   */
  storeTemplateVersion?(
    notificationId: Config['NotificationIdType'],
    templateVersion: number,
    options?: NotificationWriteOptions,
    // biome-ignore lint/suspicious/noConfusingVoidType: `void` keeps backends written before tokens, which return `Promise<void>`, assignable.
  ): Promise<NotificationWriteResult | void>;

  /**
   * Put a notification that did not go out back into `PENDING_SEND`, so it is sent again.
   *
   * Works for regular and one-off notifications alike. An implementation must:
   * * only move a notification whose status is one of `REQUEUEABLE_NOTIFICATION_STATUSES`, and
   *   throw for any other, checking and writing in one step where the store allows it, so two
   *   callers racing cannot both succeed against a notification a worker has meanwhile sent;
   * * clear `sentAt`, which `markAsFailed` uses to record when the attempt failed;
   * * set `sendAfter` to `options.sendAfter` when that key is present, `null` included, and leave
   *   it as it is when the key is absent.
   *
   * Everything else stays as it is: the template pin, `contextUsed`, `adapterUsed` and the git
   * commit SHA are history of the earlier attempt, and the next send overwrites what it needs to.
   *
   * The returned notification is what the service sends next, so it must carry everything
   * `getNotification` returns for it, attachments included.
   *
   * Required since 1.0.0-alpha10. A backend written against an earlier version must add it.
   */
  requeueNotification(
    notificationId: Config['NotificationIdType'],
    options: RequeueNotificationOptions,
  ): Promise<AnyDatabaseNotification<Config>>;

  /**
   * Pin a notification to a template version in one conditional write.
   *
   * Optional. Without it the service re-pins through `persistNotificationUpdate`, and cannot
   * check `expectedVersion`. An implementation must:
   * * only move a notification whose status is one of `REPINNABLE_NOTIFICATION_STATUSES`, and
   *   throw a `NotificationActionError` with reason `INVALID_STATUS` for any other;
   * * throw one with reason `CHANGED` when `options.expectedVersion` is given and the notification
   *   is at another version, or when it changes between the read and the write;
   * * write nothing in either case, and write nothing when the notification is already pinned to
   *   `templateVersion`;
   * * change `requestedTemplateVersion` only.
   *
   * Report `repin.expectedVersion` in `getActionCapabilities()` once it does all of that.
   */
  repinNotification?(
    notificationId: Config['NotificationIdType'],
    templateVersion: number,
    options: RepinNotificationOptions,
  ): Promise<AnyDatabaseNotification<Config>>;

  /**
   * The ID and version token of every notification matching `filter`, a page at a time.
   *
   * For counting and selecting notifications without reading them. An implementation must not
   * read recipients, contexts, context parameters, rendered content or attachments to answer it,
   * and must return nothing but `{ id, version }`. Results are ordered by ID, so pages are stable
   * while nothing is written; a caller that changes what it lists as it goes should list again
   * from page 0 rather than move on to the next page.
   *
   * Optional. Report `versions.filter` in `getActionCapabilities()` when it is implemented.
   */
  filterNotificationVersions?(
    filter: NotificationFilter<Config>,
    page: number,
    pageSize: number,
  ): Promise<NotificationVersion<Config>[]>;

  /**
   * Pin several notifications to `templateVersion`, each only if it is still at the version its
   * target names, still in one of `REPINNABLE_NOTIFICATION_STATUSES`, and still matches
   * `options.filter` when one is given.
   *
   * The point is to skip reading each notification before writing it: the caller already holds
   * the tokens, from `filterNotificationVersions`. An implementation must:
   * * check the token, the status and the filter in the write itself, or against a read of the
   *   IDs, tokens and statuses alone, and make the write conditional on nothing having changed
   *   since;
   * * never read recipients, contexts, context parameters, rendered content or attachments;
   * * write nothing for a target that fails a check, and report why in its result, rather than
   *   throwing, so one changed notification does not stop the rest;
   * * change `requestedTemplateVersion` and the token only, and write nothing for a notification
   *   already pinned to `templateVersion` (`UNCHANGED`).
   *
   * Targets are distinct IDs. Return one result per target, in their order. Report `repin.bulk`
   * in `getActionCapabilities()` once it does all of that.
   */
  repinNotifications?(
    targets: NotificationVersion<Config>[],
    templateVersion: number,
    options: BulkNotificationActionOptions<Config>,
  ): Promise<BulkNotificationActionResult<Config>[]>;

  /**
   * Put several notifications back into `PENDING_SEND`, each only if it is still at the version
   * its target names, still in one of `REQUEUEABLE_NOTIFICATION_STATUSES`, and still matches
   * `options.filter` when one is given.
   *
   * The same rules as `repinNotifications`, and each write changes what `requeueNotification`
   * changes: the status, `sentAt`, `sendAfter` when the key is present, the template pin when
   * `templateVersion` is given, and the token. Report `requeue.bulk` once it does all of that.
   */
  requeueNotifications?(
    targets: NotificationVersion<Config>[],
    options: BulkRequeueNotificationOptions<Config>,
  ): Promise<BulkNotificationActionResult<Config>[]>;

  /**
   * Which optional notification actions this backend supports. See
   * `NotificationActionCapabilities`. Missing keys are `false`.
   */
  getActionCapabilities?(): NotificationActionCapabilities;

  // One-off notification methods
  persistOneOffNotification(
    notification: Omit<OneOffNotificationInput<Config>, 'id'> & {
      id?: Config['NotificationIdType'];
    },
    options?: NotificationWriteOptions,
  ): Promise<DatabaseOneOffNotification<Config>>;
  persistOneOffNotificationUpdate(
    notificationId: Config['NotificationIdType'],
    notification: Partial<Omit<OneOffNotificationInput<Config>, 'id'>>,
    options?: NotificationWriteOptions,
  ): Promise<DatabaseOneOffNotification<Config>>;
  getOneOffNotification(
    notificationId: Config['NotificationIdType'],
    forUpdate: boolean,
  ): Promise<DatabaseOneOffNotification<Config> | null>;
  getAllOneOffNotifications(): Promise<DatabaseOneOffNotification<Config>[]>;
  getOneOffNotifications(
    page: number,
    pageSize: number,
  ): Promise<DatabaseOneOffNotification<Config>[]>;

  /**
   * Filter notifications using composable query filters.
   * Supports filtering by status, notification type, adapter, recipient,
   * body/subject templates, context, and date ranges (sendAfter, created, sent).
   * Filters can be combined with logical operators (and, or, not).
   *
   * @param filter - Composable filter expression
   * @param page - Page number (0-indexed) for pagination
   * @param pageSize - Number of results per page
   * @returns Matching notifications
   */
  filterNotifications(
    filter: NotificationFilter<Config>,
    page: number,
    pageSize: number,
    orderBy?: NotificationOrderBy,
  ): Promise<AnyDatabaseNotification<Config>[]>;

  /**
   * Get the filter capabilities supported by this backend.
   * Returns an object with flat dotted keys indicating which filtering features are supported.
   *
   * Example capability names:
   * - `logical.and`, `logical.or`, `logical.not`, `logical.notNested`
   * - `fields.status`, `fields.notificationType`, `fields.adapterUsed`, `fields.userId`,
   *   `fields.bodyTemplate`, `fields.subjectTemplate`, `fields.contextName`,
   *   `fields.sendAfterRange`, `fields.createdAtRange`, `fields.sentAtRange`,
   *   `fields.readAtRange`, `fields.hasSendAfter`, `fields.hasRequestedTemplateVersion`
   * - `negation.sendAfterRange`, `negation.createdAtRange`, `negation.sentAtRange`,
   *   `negation.readAtRange`
   * - `stringLookups.exact`, `stringLookups.startsWith`, `stringLookups.endsWith`,
   *   `stringLookups.includes`, `stringLookups.caseSensitive`, `stringLookups.caseInsensitive`
   * - `pagination.oneIndexed`: whether the first page is page `1`, or page `0` (default)
   *
   * If this method is not implemented, all features are assumed to be supported.
   * If this method is implemented, missing keys default to true (supported) for forward compatibility.
   * Only explicitly set keys to false to indicate unsupported features.
   */
  getFilterCapabilities?(): NotificationFilterCapabilities;

  // Optional logger injection for debugging and monitoring
  /**
   * Inject logger into backend for debugging and monitoring
   */
  injectLogger?(logger: BaseLogger): void;

  // Attachment management methods (optional - only needed if backend supports attachments)

  /**
   * Store attachment file record in database.
   * Called after AttachmentManager.uploadFile() returns storageIdentifiers.
   * Backend persists file metadata and storage identifiers for later retrieval.
   */
  storeAttachmentFileRecord?(record: AttachmentFileRecord): Promise<void>;

  /**
   * Get attachment file record from database by ID.
   * Returns the file metadata and storage identifiers needed to reconstruct file access.
   * Used by AttachmentManager.reconstructAttachmentFile() to get file content.
   */
  getAttachmentFileRecord?(fileId: string): Promise<AttachmentFileRecord | null>;

  /**
   * @deprecated Use getAttachmentFileRecord instead.
   * Get an attachment file record by ID
   */
  getAttachmentFile?(fileId: string): Promise<AttachmentFileRecord | null>;

  /**
   * Find an attachment file by checksum for deduplication.
   * Backend queries its database for files with matching checksums.
   * Used during file upload to avoid storing duplicate files.
   */
  findAttachmentFileByChecksum?(checksum: string): Promise<AttachmentFileRecord | null>;

  /**
   * Delete an attachment file (only if not referenced by any notifications)
   */
  deleteAttachmentFile?(fileId: string): Promise<void>;

  /**
   * Get all attachment files not referenced by any notifications (for cleanup)
   */
  getOrphanedAttachmentFiles?(): Promise<AttachmentFileRecord[]>;

  /**
   * Get all attachments for a specific notification
   */
  getAttachments?(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]>;

  /**
   * Delete a specific attachment from a notification
   */
  deleteNotificationAttachment?(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void>;
}

/**
 * Type guard to check if a filter is a field filter (leaf node).
 */
export function isFieldFilter<Config extends BaseNotificationTypeConfig>(
  filter: NotificationFilter<Config>,
): filter is NotificationFilterFields<Config> {
  return !('and' in filter) && !('or' in filter) && !('not' in filter);
}

export function isStringFilterLookup(value: StringFieldFilter): value is StringFilterLookup {
  return typeof value === 'object' && value !== null && 'lookup' in value && 'value' in value;
}

/**
 * Type guard to check if backend supports attachment operations
 */
export function supportsAttachments<Config extends BaseNotificationTypeConfig>(
  backend: BaseNotificationBackend<Config>,
): backend is BaseNotificationBackend<Config> & {
  storeAttachmentFileRecord(record: AttachmentFileRecord): Promise<void>;
  getAttachmentFileRecord(fileId: string): Promise<AttachmentFileRecord | null>;
  findAttachmentFileByChecksum(checksum: string): Promise<AttachmentFileRecord | null>;
  deleteAttachmentFile(fileId: string): Promise<void>;
  getOrphanedAttachmentFiles(): Promise<AttachmentFileRecord[]>;
  getAttachments(notificationId: Config['NotificationIdType']): Promise<StoredAttachment[]>;
  deleteNotificationAttachment(
    notificationId: Config['NotificationIdType'],
    attachmentId: string,
  ): Promise<void>;
} {
  return (
    typeof backend.storeAttachmentFileRecord === 'function' &&
    typeof backend.getAttachmentFileRecord === 'function' &&
    typeof backend.findAttachmentFileByChecksum === 'function' &&
    typeof backend.deleteAttachmentFile === 'function' &&
    typeof backend.getOrphanedAttachmentFiles === 'function' &&
    typeof backend.getAttachments === 'function' &&
    typeof backend.deleteNotificationAttachment === 'function'
  );
}

/**
 * Whether a backend can record which template version rendered a notification.
 *
 * `storeTemplateVersion` is optional on the interface, so this is how the service asks before
 * calling it — a backend that predates template versioning is skipped rather than erroring.
 */
export function supportsTemplateVersions<Config extends BaseNotificationTypeConfig>(
  backend: BaseNotificationBackend<Config>,
): backend is BaseNotificationBackend<Config> & {
  storeTemplateVersion(
    notificationId: Config['NotificationIdType'],
    templateVersion: number,
  ): Promise<void>;
} {
  return typeof backend.storeTemplateVersion === 'function';
}
