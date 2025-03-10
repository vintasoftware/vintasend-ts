import { Connection, Client } from '@temporalio/client';
import { CONNECTION_CONFIG } from '../workers/notifications/config';

let connection: Connection | null = null;

export async function getTemporalClient(): Promise<Client> {
  if (!connection) {
    connection = await Connection.connect(CONNECTION_CONFIG);
  }
  
  return new Client({
    connection,
  });
}
