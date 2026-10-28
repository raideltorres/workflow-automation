import mongoose from 'mongoose';

import type { Logger } from './logger.js';

export async function connectDatabase(uri: string, dbName: string, logger: Logger): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);
  const connection = await mongoose.connect(uri, { dbName });
  logger.info({ dbName }, 'Connected to MongoDB');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
