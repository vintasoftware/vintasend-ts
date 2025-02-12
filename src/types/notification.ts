import type { ContextGenerator } from '../services/notification-context-registry';
import type { Identifier } from './identifier';
import type { InputJsonValue, JsonValue } from './json-values';
import type { NotificationStatus } from './notification-status';
import type { NotificationType } from './notification-type';

export type NotificationInput<
  AvailableContexts extends Record<string, ContextGenerator>,
  UserIdType extends Identifier = Identifier
> = {
  id: undefined;
  userId: UserIdType;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: keyof AvailableContexts;
  contextParameters: Parameters<
    AvailableContexts[NotificationInput<AvailableContexts>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  extraParams: InputJsonValue | null;
};

type DatabaseNotification<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificatioIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier
> = {
  id: NotificatioIdType;
  userId: UserIdType;
  notificationType: NotificationType;
  title: string | null;
  bodyTemplate: string;
  contextName: keyof AvailableContexts;
  contextParameters: Parameters<
    AvailableContexts[NotificationInput<AvailableContexts>['contextName']]['generate']
  >[0];
  sendAfter: Date | null;
  subjectTemplate: string | null;
  status: NotificationStatus;
  contextUsed: ReturnType<
    AvailableContexts[NotificationInput<AvailableContexts>['contextName']]['generate']
  > | null;
  extraParams: JsonValue;
  adapterUsed: string | null;
  sentAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
};

export type Notification<
  AvailableContexts extends Record<string, ContextGenerator>,
  NotificatioIdType extends Identifier = Identifier,
  UserIdType extends Identifier = Identifier
> =
  | NotificationInput<AvailableContexts, UserIdType>
  | DatabaseNotification<AvailableContexts, NotificatioIdType, UserIdType>;
