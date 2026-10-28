import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { ExternalServiceError, ValidationError } from '../errors.js';
import type { Logger } from '../logger.js';
import { createErrorHandler, notFoundHandler } from './error-handler.js';

function buildApp(error: unknown) {
  const logger = { error: vi.fn() };
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger as unknown as Logger));
  return { app, logger };
}

describe('error handler', () => {
  it('maps application errors to their status, code and details', async () => {
    const { app, logger } = buildApp(new ValidationError('Invalid request body', [{ path: 'name', message: 'Required' }]));

    const response = await request(app).get('/boom').expect(400);

    expect(response.body).toEqual({
      error: { code: 'validation_error', message: 'Invalid request body', details: [{ path: 'name', message: 'Required' }] },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs upstream failures but only returns the safe message', async () => {
    const cause = new Error('token ghs_secret rejected');
    const { app, logger } = buildApp(new ExternalServiceError('GitHub', 'Could not complete sign-in', { cause }));

    const response = await request(app).get('/boom').expect(502);

    expect(response.body.error.message).toBe('GitHub: Could not complete sign-in');
    expect(JSON.stringify(response.body)).not.toContain('ghs_secret');
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('hides unexpected errors behind a generic 500', async () => {
    const { app, logger } = buildApp(new Error('Cannot read properties of undefined (reading "db")'));

    const response = await request(app).get('/boom').expect(500);

    expect(response.body).toEqual({ error: { code: 'internal_error', message: 'Something went wrong' } });
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ path: '/boom' }), 'Unhandled error');
  });

  it('returns a JSON 404 for unknown routes', async () => {
    const { app } = buildApp(null);

    const response = await request(app).post('/missing').expect(404);

    expect(response.body.error).toEqual({ code: 'not_found', message: 'Route POST /missing not found' });
  });
});
