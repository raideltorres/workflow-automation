import mongoose from 'mongoose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { buildUserAccess } from '../../src/testing/factories.js';
import { sessionCookie, useIntegrationApp } from './support/integration-context.js';

const ctx = useIntegrationApp();

async function startLogin() {
  const agent = request.agent(ctx.app);
  const login = await agent.get('/api/auth/github/login').expect(302);
  const state = new URL(login.headers['location'] as string).searchParams.get('state') ?? '';
  return { agent, login, state };
}

function sessions() {
  return mongoose.connection.collection('sessions');
}

describe('Authentication API', () => {
  it('rejects unauthenticated requests to protected resources', async () => {
    for (const path of ['/api/auth/me', '/api/zaps', '/api/github/repositories']) {
      const response = await request(ctx.app).get(path);
      expect(response.status, path).toBe(401);
      expect(response.body).toEqual({ error: { code: 'unauthorized', message: 'Authentication required' } });
    }
  });

  it('starts OAuth with a random state and an httpOnly, SameSite=Lax session cookie', async () => {
    const first = await startLogin();
    const second = await startLogin();

    expect(first.login.headers['location']).toMatch(/^https:\/\/github\.test\/login\/oauth\/authorize\?state=/);
    expect(first.state).toMatch(/^[0-9a-f]{32}$/);
    expect(first.state).not.toBe(second.state);
    const cookie = sessionCookie(first.login) ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/);
  });

  it('signs in on a valid callback, rotating the session id and syncing repository access', async () => {
    const { agent, login, state } = await startLogin();
    ctx.github.registerAccount('good-code', buildUserAccess({ login: 'octocat' }));

    const callback = await agent.get('/api/auth/github/callback').query({ code: 'good-code', state });

    expect(callback.status).toBe(302);
    expect(callback.headers['location']).toBe(`${ctx.webUrl}/zaps`);
    expect(sessionCookie(callback)?.split(';')[0]).not.toBe(sessionCookie(login)?.split(';')[0]);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body).toMatchObject({ login: 'octocat', name: null });
    expect(me.body).not.toHaveProperty('repositoryIds');

    const repositories = await agent.get('/api/github/repositories').expect(200);
    expect(repositories.body).toEqual({
      repositories: [{ id: 100, fullName: 'acme/app', private: false }],
      installUrl: 'https://github.test/apps/workflow-test/installations/new',
    });
  });

  it.each<[string, Record<string, string>]>([
    ['a mismatched state', { code: 'good-code', state: 'f'.repeat(32) }],
    ['a missing state', { code: 'good-code' }],
    ['a missing code', { state: 'from-login' }],
    ['a GitHub error response', { error: 'access_denied', state: 'from-login', code: 'good-code' }],
  ])('rejects a callback with %s', async (_label, query) => {
    const { agent, state } = await startLogin();
    ctx.github.registerAccount('good-code', buildUserAccess());
    const params = { ...query, ...(query.state === 'from-login' ? { state } : {}) };

    const callback = await agent.get('/api/auth/github/callback').query(params).expect(302);

    expect(callback.headers['location']).toBe(`${ctx.webUrl}/login?error=oauth_failed`);
    await agent.get('/api/auth/me').expect(401);
  });

  it('rejects a callback that did not start from this browser session', async () => {
    const response = await request(ctx.app).get('/api/auth/github/callback').query({ code: 'c', state: 's' });

    expect(response.headers['location']).toBe(`${ctx.webUrl}/login?error=oauth_failed`);
  });

  it('accepts each state only once', async () => {
    const { agent, state } = await startLogin();
    ctx.github.registerAccount('good-code', buildUserAccess());
    await agent.get('/api/auth/github/callback').query({ code: 'good-code', state }).expect(302);

    const replay = await request(ctx.app).get('/api/auth/github/callback').query({ code: 'good-code', state });

    expect(replay.headers['location']).toBe(`${ctx.webUrl}/login?error=oauth_failed`);
  });

  it('reports a failed code exchange without creating a session', async () => {
    const { agent, state } = await startLogin();

    const callback = await agent.get('/api/auth/github/callback').query({ code: 'expired-code', state });

    expect(callback.headers['location']).toBe(`${ctx.webUrl}/login?error=sign_in_failed`);
    await agent.get('/api/auth/me').expect(401);
  });

  it('accepts the signed session cookie but rejects one with a tampered signature', async () => {
    const { agent, state } = await startLogin();
    ctx.github.registerAccount('good-code', buildUserAccess());
    const callback = await agent.get('/api/auth/github/callback').query({ code: 'good-code', state });
    const cookie = (sessionCookie(callback) ?? '').split(';')[0] ?? '';
    const forged = cookie.slice(0, -1) + (cookie.endsWith('A') ? 'B' : 'A');

    await request(ctx.app).get('/api/auth/me').set('cookie', cookie).expect(200);
    await request(ctx.app).get('/api/auth/me').set('cookie', forged).expect(401);
  });

  it('rejects an expired session', async () => {
    const agent = await ctx.signIn();
    await sessions().updateMany({}, { $set: { expires: new Date(Date.now() - 1000) } });

    await agent.get('/api/auth/me').expect(401);
    await agent.get('/api/zaps').expect(401);
  });

  it('rejects a session whose user no longer exists', async () => {
    const agent = await ctx.signIn();
    await mongoose.connection.collection('users').deleteMany({});

    await agent.get('/api/auth/me').expect(401);
  });

  it('logs out by destroying the server-side session', async () => {
    const agent = await ctx.signIn();
    expect(await sessions().countDocuments()).toBe(1);

    const logout = await agent.post('/api/auth/logout').expect(204);

    expect(sessionCookie(logout)).toMatch(/wa\.sid=;/);
    expect(await sessions().countDocuments()).toBe(0);
    await agent.get('/api/auth/me').expect(401);
  });

  it('exposes a health check without authentication', async () => {
    await request(ctx.app).get('/api/health').expect(200, { status: 'ok' });
  });

  it('returns a JSON 404 for unknown API routes', async () => {
    const response = await request(ctx.app).get('/api/nope').expect(404);

    expect(response.body.error.code).toBe('not_found');
  });
});
