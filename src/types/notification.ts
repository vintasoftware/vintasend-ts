import type { NotificationAttachment, StoredAttachment } from './attachment.js';
import type { InputJsonValue, JsonValue } from './json-values.js';
import type { NotificationStatus } from './notification-status.js';
import type { NotificationType } from './notification-type.js';
import type { BaseNotificationTypeConfig } from './notification-type-config.js';
import type {
  DatabaseOneOffNotification,
  OneOffNotification,
  OneOffNotificationInput,
} from './one-off-notification.js';

// Export one-off notification types
export type {
  DatabaseOneOffNotification,
  OneOffNotification,
  OneOffNotificationInput,
  OneOffNotificationResendWithContextInput,
} from './one-off-notification.js';

export type NotificationInput<Config extends BaseNotificationTypeConfig> = {
  id?: Config['NotificationIdType'];
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][NotificationInput<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
  tenant?: string | null;
  gitCommitSha?: never;
  /**
   * Which version of `bodyTemplate` to render, for a renderer whose templates are versioned.
   *
   * Absent (or `null`) means "whatever is current at send time", which is how every notification
   * behaved before pinning existed and how they still behave unless a version is passed here or
   * the service was built with `pinTemplateVersions: true`. Pinned, an edit to the template
   * cannot change what this notification renders -- which is the point.
   *
   * An explicit value always wins over `pinTemplateVersions`, on create and on update alike.
   */
  requestedTemplateVersion?: number | null;
  /**
   * System-managed. Written by the service at send time from the version the renderer reported,
   * never by a caller -- `updateNotification` throws if it is passed. Set
   * `requestedTemplateVersion` instead to change which version renders.
   */
  usedTemplateVersion?: never;
  attachments?: NotificationAttachment[];
};

export type NotificationResendWithContextInput<Config extends BaseNotificationTypeConfig> = {
  id?: Config['NotificationIdType'];
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][NotificationResendWithContextInput<Config>['contextName']]['generate']
  >[0];
  contextUsed: ReturnType<
    Config['ContextMap'][NotificationResendWithContextInput<Config>['contextName']]['generate']
  > extends Promise<infer T>
    ? T
    : ReturnType<
        Config['ContextMap'][NotificationResendWithContextInput<Config>['contextName']]['generate']
      >;
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
  tenant?: string | null;
  gitCommitSha?: never;
  /**
   * Which version of `bodyTemplate` to render, for a renderer whose templates are versioned.
   *
   * Absent (or `null`) means "whatever is current at send time", which is how every notification
   * behaved before pinning existed and how they still behave unless a version is passed here or
   * the service was built with `pinTemplateVersions: true`. Pinned, an edit to the template
   * cannot change what this notification renders -- which is the point.
   *
   * An explicit value always wins over `pinTemplateVersions`, on create and on update alike.
   */
  requestedTemplateVersion?: number | null;
  /**
   * System-managed. Written by the service at send time from the version the renderer reported,
   * never by a caller -- `updateNotification` throws if it is passed. Set
   * `requestedTemplateVersion` instead to change which version renders.
   */
  usedTemplateVersion?: never;
  attachments?: NotificationAttachment[];
};

export type DatabaseNotification<Config extends BaseNotificationTypeConfig> = {
  id: Config['NotificationIdType'];
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][DatabaseNotification<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed:
    | null
    | (ReturnType<
        Config['ContextMap'][DatabaseNotification<Config>['contextName']]['generate']
      > extends Promise<infer T>
        ? T
        : ReturnType<
            Config['ContextMap'][DatabaseNotification<Config>['contextName']]['generate']
          >);
  extraParams: JsonValue;
  tenant: string | null;
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  gitCommitSha: string | null;
  /**
   * Which version of `bodyTemplate` this notification renders, when its renderer versions
   * templates at all. `null` (or absent, on a backend that does not store it) means "whatever is
   * current at send time".
   */
  requestedTemplateVersion?: number | null;
  /**
   * What the renderer reported it actually used, written by the service at send time.
   *
   * Reads the same as `requestedTemplateVersion` on a pinned notification, and tells you which
   * version went out on an unpinned one -- the only record of that, since the template has moved
   * on by the time anyone asks. Optional rather than required so a backend with nowhere to put it
   * keeps working; it simply stays absent on the records that backend holds.
   */
  usedTemplateVersion?: number | null;
  attachments?: StoredAttachment[];
};

export type Notification<Config extends BaseNotificationTypeConfig> =
  | NotificationInput<Config>
  | NotificationResendWithContextInput<Config>
  | DatabaseNotification<Config>;

/**
 * Union type representing any notification type (regular or one-off).
 * This is useful for methods that handle both notification types.
 */
export type AnyNotification<Config extends BaseNotificationTypeConfig> =
  | Notification<Config>
  | OneOffNotification<Config>;

/**
 * Union type for database notifications only (regular or one-off).
 * Useful for send methods and database queries.
 */
export type AnyDatabaseNotification<Config extends BaseNotificationTypeConfig> =
  | DatabaseNotification<Config>
  | DatabaseOneOffNotification<Config>;

/**
 * Union type for notification inputs only (regular or one-off).
 * Useful for creation methods.
 */
export type AnyNotificationInput<Config extends BaseNotificationTypeConfig> =
  | NotificationInput<Config>
  | OneOffNotificationInput<Config>;
