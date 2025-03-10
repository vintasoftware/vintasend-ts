import { Worker, NativeConnection } from '@temporalio/worker';
import { emailActivities } from './activities.js';
import { NOTIFICATIONS_QUEUE } from './constants.js';
import { CONNECTION_CONFIG } from './config.js';
import { fileURLToPath } from 'node:url';

async function runWorker() {
  const connection = await NativeConnection.connect(CONNECTION_CONFIG);
  try {
    const worker = await Worker.create({
      workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)),
      activities: emailActivities,
      taskQueue: NOTIFICATIONS_QUEUE,
      connection,
    });
    await worker.run();
  } finally {
    connection.close();
  }
}

runWorker().catch(err => {
  console.error(err);
  process.exit(1);
});
