import { getNotificationService } from '../../lib/services/notifications';

type NotificationIdType = Parameters<ReturnType<typeof getNotificationService>['getNotification']>[0];

export async function sendNotification(notificationId: NotificationIdType): Promise<void> {
  const notificationService = getNotificationService();

  if (!notificationId) {
    throw new Error("Notification ID is required");
  }

  await notificationService.delayedSend(notificationId);
};

export const getAllPendingNotifications = async (): Promise<NotificationIdType[]> => {
  const notificationServices = getNotificationService();
  const pendingNotifications = await notificationServices.getPendingNotifications();
  return pendingNotifications.map((notification) => notification.id).filter((nid) => nid !== undefined);
};

// Export as an object for Temporal activity registration
export const emailActivities = {
  sendNotification,
  getAllPendingNotifications,
};

// Optionally export a type for proxyActivities
export type EmailActivities = typeof emailActivities;
