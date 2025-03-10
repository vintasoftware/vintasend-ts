import type { Client } from '@temporalio/client';
import type { BaseNotificationQueueService } from "vintasend/dist/services/notification-queue-service/base-notification-queue-service";
import type { NotificationTypeConfig } from './notifications';
import { sendNotificationWorkflow } from "../../workers/notifications/workflows";

export class TemporalQueueService implements BaseNotificationQueueService<NotificationTypeConfig> {
  constructor(private client: Client, private taskQueue: string, ) {}

  async enqueueNotification(notificationId: NotificationTypeConfig['NotificationIdType']): Promise<void> {
    await this.client.workflow.start(sendNotificationWorkflow, {
      taskQueue: this.taskQueue,
      workflowId: `sendNotification-${notificationId}`,
      args: [notificationId],
    })
    await this.client.connection.close();
  }
}
