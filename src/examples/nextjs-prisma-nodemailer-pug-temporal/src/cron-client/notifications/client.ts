import { sendAllPendingNotificationsWorkflow } from '../../workers/notifications/workflows';
import { NOTIFICATIONS_QUEUE } from '../../workers/notifications/constants';
import { logger } from '../../lib/logger';
import { getTemporalClient } from '../../lib/temporal';
import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client';

// Save this to later terminate or cancel this schedule
const workflowId = 'send-all-pending-notifications-workflow';

async function run() {
  const client = await getTemporalClient();

  try {
    const handle = await client.workflow.start(sendAllPendingNotificationsWorkflow, {
      taskQueue: NOTIFICATIONS_QUEUE,
      workflowId,
      cronSchedule: '*/5 * * * *', // start every 5 minutes
      args: [],
    });

    try {
      await handle.result(); // await completion of Workflow, which doesn't happen since it's a cron Workflow
    } catch (err) {
      logger.error(`${err instanceof Error ? err : 'error'}: ${handle.workflowId}`);
    }
  } catch (err) {
    if (err instanceof WorkflowExecutionAlreadyStartedError) {
      logger.info('Workflow is already running, skipping start');
    } else {
      throw err;
    }
  }
}

// just for this demo - cancel the workflow on Ctrl+C
process.on('SIGINT', async () => {
  const client = await getTemporalClient();

  const handle = client.workflow.getHandle(workflowId);
  await handle.cancel();
  logger.info(`\nCanceled Workflow ${handle.workflowId}`);
  process.exit(0);
});
// you cannot catch SIGKILL

run().catch((err) => {
  logger.error(err);
  process.exit(1);
});


