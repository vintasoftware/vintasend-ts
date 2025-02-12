import type { Identifier } from "../../types/identifier";

export interface BaseNotificationQueueService {
  enqueueNotification(notificationId: Identifier): Promise<void>;
}
