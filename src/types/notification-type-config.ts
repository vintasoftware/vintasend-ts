import type { ContextGenerator } from "./notification-context-generators";
import type { Identifier } from "./identifier";

export type BaseNotificationTypeConfig<ContextMapType extends Record<string, ContextGenerator> = Record<string, ContextGenerator>> = {
  ContextMap: ContextMapType;
  NotificationIdType: Identifier;
  UserIdType: Identifier;
};
