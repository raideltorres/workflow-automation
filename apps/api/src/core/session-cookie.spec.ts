import { describe, expect, it } from 'vitest';

import { SESSION_COOKIE_NAME, sessionCookieOptions } from './session-cookie.js';

describe('sessionCookieOptions', () => {
  it('uses one name and the same attributes for every environment except secure', () => {
    expect(SESSION_COOKIE_NAME).toBe('wa.sid');

    const shared = { httpOnly: true, sameSite: 'lax', path: '/' };
    expect(sessionCookieOptions('development')).toMatchObject({ ...shared, secure: false });
    expect(sessionCookieOptions('test')).toMatchObject({ ...shared, secure: false });
    expect(sessionCookieOptions('production')).toMatchObject({ ...shared, secure: true });
  });
});
