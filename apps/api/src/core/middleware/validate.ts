import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

import { ValidationError } from '../errors.js';

export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
      throw new ValidationError('Invalid request body', details);
    }
    req.body = result.data;
    next();
  };
}
