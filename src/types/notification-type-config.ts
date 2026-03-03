import type { Identifier } from './identifier.js';
import type { ContextGenerator } from './notification-context-generators.js';

export type BaseNotificationTypeConfig = {
  ContextMap: Record<string, ContextGenerator>;
  NotificationIdType: Identifier;
  UserIdType: Identifier;
};
