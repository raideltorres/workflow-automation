import type { ErrorRequestHandler, RequestHandler } from 'express';

import type { ApiErrorBody } from '@workflow/shared';

import { AppError, NotFoundError } from '../errors.js';
import type { Logger } from '../logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.path}`));
};

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, _next) => {
    if (err instanceof AppError) {
      if (err.status >= 500) logger.error({ err, path: req.path }, err.message);
      const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details } };
      res.status(err.status).json(body);
      return;
    }
    logger.error({ err, path: req.path }, 'Unhandled error');
    const body: ApiErrorBody = { error: { code: 'internal_error', message: 'Something went wrong' } };
    res.status(500).json(body);
  };
}
