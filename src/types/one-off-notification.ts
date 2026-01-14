import type { NotificationAttachment, StoredAttachment } from './attachment';
import type { InputJsonValue, JsonValue } from './json-values';
import type { NotificationStatus } from './notification-status';
import type { NotificationType } from './notification-type';
import type { BaseNotificationTypeConfig } from './notification-type-config';

/**
 * Input type for creating a one-off notification.
 * One-off notifications are sent directly to an email/phone without requiring a user account.
 */
export type OneOffNotificationInput<Config extends BaseNotificationTypeConfig> = {
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
  attachments?: NotificationAttachment[];
};

/**
 * Input type for resending a one-off notification with stored context.
 * Similar to OneOffNotificationInput but includes the contextUsed field.
 */
export type OneOffNotificationResendWithContextInput<Config extends BaseNotificationTypeConfig> = {
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
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
  attachments?: StoredAttachment[];
};

/**
 * Union type representing any one-off notification (input, resend, or database).
 */
export type OneOffNotification<Config extends BaseNotificationTypeConfig> =
  | OneOffNotificationInput<Config>
  | OneOffNotificationResendWithContextInput<Config>
  | DatabaseOneOffNotification<Config>;
