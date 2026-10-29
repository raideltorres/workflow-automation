import { once } from 'node:events';

import express from 'express';
import { describe, expect, it, vi } from 'vitest';

import type { Logger } from './logger.js';
import { startHttpServer } from './http-server.js';

function buildLogger() {
  return { error: vi.fn(), info: vi.fn() } as unknown as Logger & { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
}

describe('startHttpServer', () => {
  it('logs once the port is bound', async () => {
    const logger = buildLogger();
    const server = startHttpServer(express(), 0, logger, vi.fn() as unknown as (code: number) => never);

    await once(server, 'listening');
    const address = server.address();
    server.close();

    expect(typeof address === 'object' && address !== null && address.port > 0).toBe(true);
    expect(logger.info).toHaveBeenCalledWith({ port: 0 }, 'API listening');
  });

  it('exits when the port is already in use', async () => {
    const logger = buildLogger();
    const exit = vi.fn() as unknown as (code: number) => never;
    const server = startHttpServer(express(), 0, logger, exit);
    await once(server, 'listening');

    const error = Object.assign(new Error('listen EADDRINUSE'), { code: 'EADDRINUSE' });
    server.emit('error', error);
    server.close();

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith({ err: error, port: 0 }, 'Port 0 is already in use');
  });

  it('exits with the system message for any other bind failure', () => {
    const logger = buildLogger();
    const exit = vi.fn() as unknown as (code: number) => never;
    const server = startHttpServer(express(), 0, logger, exit);

    const error = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    server.emit('error', error);
    server.close();

    expect(exit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith({ err: error, port: 0 }, 'permission denied');
  });
});
