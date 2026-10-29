import type { CookieOptions } from 'express';

export const SESSION_COOKIE_NAME = 'wa.sid';

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Options used both when the session is created and when logout clears it. */
export function sessionCookieOptions(env: string): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env === 'production',
    maxAge: SESSION_MAX_AGE_MS,
    path: '/',
  };
}
