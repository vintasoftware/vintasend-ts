import type { Identifier } from './identifier';
import type { ContextGenerator } from './notification-context-generators';

export type BaseNotificationTypeConfig = {
  ContextMap: Record<string, ContextGenerator>;
  NotificationIdType: Identifier;
  UserIdType: Identifier;
};
