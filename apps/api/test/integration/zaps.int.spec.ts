import { describe, expect, it } from 'vitest';

import { buildRepository, buildUserAccess, buildZapInput } from '../../src/testing/factories.js';
import { type Agent, useIntegrationApp } from './support/integration-context.js';

const ctx = useIntegrationApp();

const alice = () => buildUserAccess({ githubId: 1, login: 'alice', repositories: [buildRepository()] });
const bob = () =>
  buildUserAccess({
    githubId: 2,
    login: 'bob',
    repositories: [buildRepository({ id: 200, fullName: 'bob/site', installationId: 8 })],
  });

async function createZap(agent: Agent, overrides: Parameters<typeof buildZapInput>[0] = {}) {
  const response = await agent.post('/api/zaps').send(buildZapInput(overrides)).expect(201);
  return response.body as { id: string };
}

describe('Zap API', () => {
  it('creates a zap on an accessible repository and returns it without the owner id', async () => {
    const agent = await ctx.signIn(alice());

    const response = await agent.post('/api/zaps').send(buildZapInput()).expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      name: 'Thank contributors',
      enabled: true,
      trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100, repositoryFullName: 'acme/app' } },
      action: { key: 'github.pull_request.comment', input: { body: expect.stringContaining('{{pull_request.author}}') } },
    });
    expect(response.body).not.toHaveProperty('ownerId');
    const fetched = await agent.get(`/api/zaps/${response.body.id}`).expect(200);
    expect(fetched.body).toEqual(response.body);
  });

  it.each([
    ['a blank name', { name: ' ' }, 'name'],
    ['an unknown template field', { action: { key: 'github.pull_request.comment', input: { body: '{{user.email}}' } } }, 'action.input.body'],
    ['an unsupported action', { action: { key: 'slack.post_message', input: { body: 'Hi' } } }, 'action.key'],
    ['an unsupported trigger', { trigger: { key: 'gitlab.merge_request.opened', config: { repositoryId: 100 } } }, 'trigger.key'],
    ['a non-numeric repository id', { trigger: { key: 'github.pull_request.opened', config: { repositoryId: 'x' } } }, 'trigger.config.repositoryId'],
  ])('rejects %s with field-level details', async (_label, overrides, path) => {
    const agent = await ctx.signIn(alice());

    const response = await agent
      .post('/api/zaps')
      .send({ ...buildZapInput(), ...overrides })
      .expect(400);

    expect(response.body.error.code).toBe('validation_error');
    expect(response.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ path })]));
    expect((await agent.get('/api/zaps')).body).toEqual([]);
  });

  it('only accepts JSON bodies, so cross-site form posts cannot create zaps', async () => {
    const agent = await ctx.signIn(alice());

    await agent
      .post('/api/zaps')
      .set('content-type', 'text/plain')
      .send(JSON.stringify(buildZapInput()))
      .expect(400);
  });

  it('refuses repositories the app is not installed on for this user', async () => {
    const agent = await ctx.signIn(alice());

    const response = await agent.post('/api/zaps').send(buildZapInput({ repositoryId: 200 })).expect(403);

    expect(response.body.error.code).toBe('forbidden');
  });

  it('lists only the signed-in user zaps, most recently updated first', async () => {
    const aliceAgent = await ctx.signIn(alice());
    const bobAgent = await ctx.signIn(bob());
    const first = await createZap(aliceAgent, { name: 'First' });
    await createZap(aliceAgent, { name: 'Second' });
    await createZap(bobAgent, { name: 'Bob zap', repositoryId: 200 });
    await aliceAgent.patch(`/api/zaps/${first.id}`).send({ name: 'First, renamed' }).expect(200);

    const response = await aliceAgent.get('/api/zaps').expect(200);

    expect(response.body.map((z: { name: string }) => z.name)).toEqual(['First, renamed', 'Second']);
  });

  it("hides another user's zap and its run history behind 404s on every route", async () => {
    const owner = await ctx.signIn(alice());
    const intruder = await ctx.signIn(bob());
    const zap = await createZap(owner);

    await intruder.get(`/api/zaps/${zap.id}`).expect(404);
    await intruder.get(`/api/zaps/${zap.id}/runs`).expect(404);
    await intruder.patch(`/api/zaps/${zap.id}`).send({ enabled: false }).expect(404);
    await intruder.delete(`/api/zaps/${zap.id}`).expect(404);

    const untouched = await owner.get(`/api/zaps/${zap.id}`).expect(200);
    expect(untouched.body.enabled).toBe(true);
  });

  it('updates name and template, keeping the rest of the zap', async () => {
    const agent = await ctx.signIn(alice());
    const zap = await createZap(agent);

    const response = await agent
      .patch(`/api/zaps/${zap.id}`)
      .send({ name: 'Greeter', action: { key: 'github.pull_request.comment', input: { body: 'Hello {{pull_request.author}}' } } })
      .expect(200);

    expect(response.body).toMatchObject({
      name: 'Greeter',
      enabled: true,
      action: { input: { body: 'Hello {{pull_request.author}}' } },
      trigger: { config: { repositoryFullName: 'acme/app' } },
    });
  });

  it('toggles a zap off and back on, persisting each state', async () => {
    const agent = await ctx.signIn(alice());
    const zap = await createZap(agent);

    await agent.patch(`/api/zaps/${zap.id}`).send({ enabled: false }).expect(200);
    expect((await agent.get(`/api/zaps/${zap.id}`)).body.enabled).toBe(false);

    await agent.patch(`/api/zaps/${zap.id}`).send({ enabled: true }).expect(200);
    expect((await agent.get(`/api/zaps/${zap.id}`)).body.enabled).toBe(true);
  });

  it('rejects an invalid patch and moving a zap to an inaccessible repository', async () => {
    const agent = await ctx.signIn(alice());
    const zap = await createZap(agent);

    await agent.patch(`/api/zaps/${zap.id}`).send({ enabled: 'yes' }).expect(400);
    await agent
      .patch(`/api/zaps/${zap.id}`)
      .send({ trigger: { key: 'github.pull_request.opened', config: { repositoryId: 200 } } })
      .expect(403);
  });

  it('deletes an owned zap', async () => {
    const agent = await ctx.signIn(alice());
    const zap = await createZap(agent);

    await agent.delete(`/api/zaps/${zap.id}`).expect(204);

    await agent.get(`/api/zaps/${zap.id}`).expect(404);
  });

  it('treats malformed ids as not found rather than server errors', async () => {
    const agent = await ctx.signIn(alice());

    await agent.get('/api/zaps/not-an-object-id').expect(404);
    await agent.patch('/api/zaps/not-an-object-id').send({ enabled: true }).expect(404);
    await agent.delete('/api/zaps/not-an-object-id').expect(404);
  });
});
