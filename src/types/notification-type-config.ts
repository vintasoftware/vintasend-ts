import type { ContextGenerator } from "./notification-context-generators";
import type { Identifier } from "./identifier";

export type BaseNotificationTypeConfig = {
  ContextMap: Record<string, ContextGenerator>;
  NotificationIdType: Identifier;
  UserIdType: Identifier;
};
