import { createApp } from './app.js';
import { createContainer } from './container.js';
import { loadConfig } from './core/config.js';
import { connectDatabase, disconnectDatabase } from './core/database.js';
import { startHttpServer } from './core/http-server.js';
import { createLogger } from './core/logger.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.env);
  const db = await connectDatabase(config.mongo.uri, config.mongo.dbName, logger);
  const app = createApp(createContainer(config, logger, db));

  const server = startHttpServer(app, config.port, logger);

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err: unknown) => {
  process.stderr.write(`Failed to start API: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
