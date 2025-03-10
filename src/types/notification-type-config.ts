import type { BaseLogger } from "../services/loggers/base-logger";
import type { BaseNotificationAdapter } from "../services/notification-adapters/base-notification-adapter";
import type { BaseNotificationBackend } from "../services/notification-backends/base-notification-backend";
import type { ContextGenerator } from "../services/notification-context-registry";
import type { BaseNotificationQueueService } from "../services/notification-queue-service/base-notification-queue-service";
import type { BaseNotificationTemplateRenderer } from "../services/notification-template-renderers/base-notification-template-renderer";
import type { Identifier } from "./identifier";

export type BaseNotificationTypeConfig = {
  ContextMap: Record<string, ContextGenerator>;
  NotificationIdType: Identifier;
  UserIdType: Identifier;
};
