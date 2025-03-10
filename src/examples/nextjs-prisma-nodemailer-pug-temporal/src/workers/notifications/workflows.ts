import { proxyActivities } from '@temporalio/workflow';
import type { EmailActivities } from './activities';
import type { getNotificationService } from '../../lib/services/notifications';

// Configure activities with a timeout (adjust as needed)
const { sendNotification, getAllPendingNotifications } = proxyActivities<EmailActivities>({
  startToCloseTimeout: '1 minute',
});

type NotificationIdType = Parameters<ReturnType<typeof getNotificationService>['getNotification']>[0];

export async function sendNotificationWorkflow(notificationId: NotificationIdType): Promise<void> {
  await sendNotification(notificationId);
}

export async function sendAllPendingNotificationsWorkflow(): Promise<void> {
  const pendingNotificationIds = await getAllPendingNotifications();

  await Promise.all(
    pendingNotificationIds
    .filter((notificationId) => notificationId !== undefined )
    .map((notificationId) => sendNotification(notificationId))
  );
}
