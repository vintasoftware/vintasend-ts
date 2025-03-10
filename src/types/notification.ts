import type { InputJsonValue, JsonValue } from './json-values';
import type { NotificationStatus } from './notification-status';
import type { NotificationType } from './notification-type';
import type { BaseNotificationTypeConfig } from './notification-type-config';

export type NotificationInput<
  Config extends BaseNotificationTypeConfig,
> = {
  id: undefined;
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][NotificationInput<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
};

export type DatabaseNotification<
  Config extends BaseNotificationTypeConfig,
> = {
  id: Config['NotificationIdType'];
  userId: Config['UserIdType'];
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: keyof Config['ContextMap'];
  contextParameters: Parameters<
    Config['ContextMap'][NotificationInput<Config>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed: ReturnType<
    Config['ContextMap'][NotificationInput<Config>['contextName']]['generate']
  > | null;
  extraParams: JsonValue;
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Notification<
  Config extends BaseNotificationTypeConfig,
> =
  | NotificationInput<Config>
  | DatabaseNotification<Config>;
