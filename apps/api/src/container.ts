import MongoStore from 'connect-mongo';
import type { Store } from 'express-session';
import type mongoose from 'mongoose';

import type { AppConfig } from './core/config.js';
import type { Logger } from './core/logger.js';

export interface Container {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly sessionStore: Store;
}

export function createContainer(config: AppConfig, logger: Logger, db: typeof mongoose): Container {
  const sessionStore = MongoStore.create({
    client: db.connection.getClient(),
    dbName: config.mongo.dbName,
    collectionName: 'sessions',
  });

  return { config, logger, sessionStore };
}
