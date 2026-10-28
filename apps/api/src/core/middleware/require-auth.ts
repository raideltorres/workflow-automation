import type { Request, RequestHandler } from 'express';

import { UnauthorizedError } from '../errors.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) throw new UnauthorizedError();
  next();
};

export function currentUserId(req: Request): string {
  const userId = req.session.userId;
  if (!userId) throw new UnauthorizedError();
  return userId;
}
