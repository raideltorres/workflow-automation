import type { Server } from 'node:http';

import type { Express } from 'express';

import type { Logger } from './logger.js';

type Exit = (code: number) => never;

/**
 * Binds the API exclusively. A taken port emits `EADDRINUSE` instead of sharing the socket,
 * which on Windows otherwise lets another process keep the connections while this one logs "listening".
 */
export function startHttpServer(app: Express, port: number, logger: Logger, exit: Exit = process.exit): Server {
  const server = app.listen({ port, exclusive: true });

  server.on('error', (error: NodeJS.ErrnoException) => {
    const detail = error.code === 'EADDRINUSE' ? `Port ${port} is already in use` : error.message;
    logger.error({ err: error, port }, detail);
    exit(1);
  });

  server.on('listening', () => {
    logger.info({ port }, 'API listening');
  });

  return server;
}
