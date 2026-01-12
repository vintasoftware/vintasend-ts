import type { InputJsonValue, JsonObject, JsonValue } from './json-values';
import type { NotificationStatus } from './notification-status';
import type { NotificationType } from './notification-type';
import type { BaseNotificationTypeConfig } from './notification-type-config';
import type {
  DatabaseOneOffNotification,
  OneOffNotification,
  OneOffNotificationInput,
} from './one-off-notification';

// Export one-off notification types
export type {
  OneOffNotificationInput,
  OneOffNotificationResendWithContextInput,
  DatabaseOneOffNotification,
  OneOffNotification,
} from './one-off-notification';

export type NotificationInput<Config extends BaseNotificationTypeConfig> = {
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
};

export type NotificationResendWithContextInput<Config extends BaseNotificationTypeConfig> = {
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
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
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
