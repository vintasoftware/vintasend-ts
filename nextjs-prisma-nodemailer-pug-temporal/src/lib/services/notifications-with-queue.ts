import { getNotificationService } from "./notifications";
import { TemporalQueueService } from "./temporal-queue-service";
import { NOTIFICATIONS_QUEUE } from "../../workers/notifications/constants";
import { getTemporalClient } from "../temporal";

export async function getNotificationServiceWithQueue() {
  const notificationService = getNotificationService();

  const temporalClient = await getTemporalClient();

  notificationService.registerQueueService(
    new TemporalQueueService(temporalClient, NOTIFICATIONS_QUEUE)
  );

  return notificationService;
}