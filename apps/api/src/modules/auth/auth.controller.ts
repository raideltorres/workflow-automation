import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { Request, Response } from 'express';

import { UnauthorizedError } from '../../core/errors.js';
import type { Logger } from '../../core/logger.js';
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '../../core/session-cookie.js';
import type { AuthService } from './auth.service.js';

function promisify(fn: (cb: (err?: unknown) => void) => void): Promise<void> {
  return new Promise((resolve, reject) => fn((err) => (err ? reject(err) : resolve())));
}

function statesMatch(expected: string | undefined, received: unknown): boolean {
  if (!expected || typeof received !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}

export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly webUrl: string,
    private readonly logger: Logger,
    private readonly env: string,
  ) {}

  login = async (req: Request, res: Response): Promise<void> => {
    const state = randomBytes(16).toString('hex');
    req.session.oauthState = state;
    await promisify((cb) => req.session.save(cb));
    res.redirect(this.auth.buildAuthorizationUrl(state));
  };

  callback = async (req: Request, res: Response): Promise<void> => {
    const { code, state, error } = req.query;
    const expectedState = req.session.oauthState;
    delete req.session.oauthState;

    if (error || typeof code !== 'string' || !statesMatch(expectedState, state)) {
      this.logger.warn({ error }, 'Rejected OAuth callback');
      res.redirect(`${this.webUrl}/login?error=oauth_failed`);
      return;
    }

    try {
      const user = await this.auth.signIn(code);
      await promisify((cb) => req.session.regenerate(cb));
      req.session.userId = user.id;
      await promisify((cb) => req.session.save(cb));
      res.redirect(`${this.webUrl}/zaps`);
    } catch (err) {
      this.logger.error({ err }, 'Sign-in failed');
      res.redirect(`${this.webUrl}/login?error=sign_in_failed`);
    }
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const userId = req.session.userId;
    const user = userId ? await this.auth.getCurrentUser(userId) : null;
    if (!user) throw new UnauthorizedError();
    res.json(user);
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    await promisify((cb) => req.session.destroy(cb));
    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions(this.env);
    res.clearCookie(SESSION_COOKIE_NAME, clearOptions);
    res.status(204).end();
  };
}
