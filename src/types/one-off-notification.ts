import type { NotificationAttachment, StoredAttachment } from './attachment.js';
import type { InputJsonValue, JsonValue } from './json-values.js';
import type { NotificationStatus } from './notification-status.js';
import type { NotificationType } from './notification-type.js';
import type { BaseNotificationTypeConfig } from './notification-type-config.js';

/**
 * Input type for creating a one-off notification.
 * One-off notifications are sent directly to an email/phone without requiring a user account.
 */
export type OneOffNotificationInput<Config extends BaseNotificationTypeConfig> = {
  id?: Config['NotificationIdType'];
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][OneOffNotificationInput<Config>['contextName']]['generate']
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

/**
 * Input type for resending a one-off notification with stored context.
 * Similar to OneOffNotificationInput but includes the contextUsed field.
 */
export type OneOffNotificationResendWithContextInput<Config extends BaseNotificationTypeConfig> = {
  id?: Config['NotificationIdType'];
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][OneOffNotificationResendWithContextInput<Config>['contextName']]['generate']
  >[0];
  contextUsed: ReturnType<
    Config['ContextMap'][OneOffNotificationResendWithContextInput<Config>['contextName']]['generate']
  > extends Promise<infer T>
    ? T
    : ReturnType<
        Config['ContextMap'][OneOffNotificationResendWithContextInput<Config>['contextName']]['generate']
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

/**
 * Database representation of a one-off notification.
 * Includes all fields from input plus database-managed fields (id, status, timestamps, etc.)
 */
export type DatabaseOneOffNotification<Config extends BaseNotificationTypeConfig> = {
  id: Config['NotificationIdType'];
  emailOrPhone: string;
  firstName: string;
  lastName: string;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: string & keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][DatabaseOneOffNotification<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed:
    | null
    | (ReturnType<
        Config['ContextMap'][DatabaseOneOffNotification<Config>['contextName']]['generate']
      > extends Promise<infer T>
        ? T
        : ReturnType<
            Config['ContextMap'][DatabaseOneOffNotification<Config>['contextName']]['generate']
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

/**
 * Union type representing any one-off notification (input, resend, or database).
 */
export type OneOffNotification<Config extends BaseNotificationTypeConfig> =
  | OneOffNotificationInput<Config>
  | OneOffNotificationResendWithContextInput<Config>
  | DatabaseOneOffNotification<Config>;
