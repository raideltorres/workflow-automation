import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';

import { buildPullRequestOpenedPayload, buildRepository, buildUserAccess, buildZapInput } from '../../src/testing/factories.js';
import { type Agent, useIntegrationApp } from './support/integration-context.js';

const ctx = useIntegrationApp();

const TEMPLATE = 'Thanks @{{pull_request.author}} for #{{pull_request.number}} "{{pull_request.title}}" on {{repository.full_name}}';

async function createZap(agent: Agent, overrides: Parameters<typeof buildZapInput>[0] = {}): Promise<string> {
  const input = buildZapInput({
    action: { key: 'github.pull_request.comment', input: { body: TEMPLATE } },
    ...overrides,
  });
  const response = await agent.post('/api/zaps').send(input).expect(201);
  return response.body.id as string;
}

async function runsFor(agent: Agent, zapId: string) {
  return (await agent.get(`/api/zaps/${zapId}/runs`).expect(200)).body as Array<Record<string, unknown>>;
}

async function deliver(deliveryId: string, payload = buildPullRequestOpenedPayload()) {
  const response = await ctx.sendWebhook('pull_request', deliveryId, payload);
  await ctx.settleWebhooks();
  return response;
}

describe('Webhook API', () => {
  it('runs a matching zap: comments on the PR and records a successful run', async () => {
    const agent = await ctx.signIn();
    const zapId = await createZap(agent);

    const response = await deliver('delivery-1');

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true });
    expect(ctx.github.comments).toEqual([
      {
        installationId: 7,
        repositoryFullName: 'acme/app',
        pullRequestNumber: 42,
        body: 'Thanks @octocat for #42 "Add login" on acme/app',
      },
    ]);
    const runs = await runsFor(agent, zapId);
    expect(runs).toEqual([
      expect.objectContaining({
        zapId,
        deliveryId: 'delivery-1',
        status: 'succeeded',
        trigger: {
          repositoryFullName: 'acme/app',
          pullRequestNumber: 42,
          pullRequestTitle: 'Add login',
          pullRequestUrl: 'https://github.com/acme/app/pull/42',
        },
        output: { commentUrl: 'https://github.com/acme/app/pull/42#issuecomment-1' },
        finishedAt: expect.any(String),
      }),
    ]);
  });

  it('executes each zap at most once per delivery, even when GitHub redelivers', async () => {
    const agent = await ctx.signIn();
    const zapId = await createZap(agent);

    await deliver('delivery-1');
    const redelivery = await deliver('delivery-1');

    expect(redelivery.status).toBe(202);
    expect(ctx.github.comments).toHaveLength(1);
    expect(await runsFor(agent, zapId)).toHaveLength(1);
  });

  it('fans one delivery out to every enabled zap on the repository', async () => {
    const agent = await ctx.signIn();
    const first = await createZap(agent, { name: 'A' });
    const second = await createZap(agent, { name: 'B' });

    await deliver('delivery-1');

    expect(ctx.github.comments).toHaveLength(2);
    expect(await runsFor(agent, first)).toHaveLength(1);
    expect(await runsFor(agent, second)).toHaveLength(1);
  });

  it('ignores disabled zaps and zaps on other repositories', async () => {
    const agent = await ctx.signIn(
      buildUserAccess({ repositories: [buildRepository(), buildRepository({ id: 101, fullName: 'acme/other' })] }),
    );
    const disabled = await createZap(agent, { enabled: false });
    const otherRepo = await createZap(agent, { repositoryId: 101 });

    await deliver('delivery-1');

    expect(ctx.github.comments).toEqual([]);
    expect(await runsFor(agent, disabled)).toEqual([]);
    expect(await runsFor(agent, otherRepo)).toEqual([]);
  });

  it.each([
    ['pull_request', buildPullRequestOpenedPayload({ action: 'closed' })],
    ['pull_request', buildPullRequestOpenedPayload({ action: 'synchronize' })],
    ['push', { ref: 'refs/heads/main', repository: { id: 100 } }],
    ['ping', { zen: 'Design for failure.' }],
  ])('acknowledges but ignores %s events no trigger handles', async (event, payload) => {
    const agent = await ctx.signIn();
    const zapId = await createZap(agent);

    const response = await ctx.sendWebhook(event, 'delivery-x', payload);
    await ctx.settleWebhooks();

    expect(response.status).toBe(202);
    expect(ctx.github.comments).toEqual([]);
    expect(await runsFor(agent, zapId)).toEqual([]);
  });

  it('rejects an invalid signature without creating runs', async () => {
    const agent = await ctx.signIn();
    const zapId = await createZap(agent);

    const response = await ctx.sendWebhook('pull_request', 'delivery-1', buildPullRequestOpenedPayload(), 'wrong-secret');
    await ctx.settleWebhooks();

    expect(response.status).toBe(401);
    expect(ctx.github.comments).toEqual([]);
    expect(await runsFor(agent, zapId)).toEqual([]);
  });

  it('records a failed run with the GitHub error when commenting fails', async () => {
    const agent = await ctx.signIn();
    const zapId = await createZap(agent);
    ctx.github.failComments(new Error('Resource not accessible by integration'));

    await deliver('delivery-1');

    expect(await runsFor(agent, zapId)).toEqual([
      expect.objectContaining({ status: 'failed', error: 'Resource not accessible by integration' }),
    ]);
  });

  it('stops acting for a user once the repository is removed from the installation', async () => {
    const agent = await ctx.signIn();
    const zapId = await createZap(agent);

    await ctx.sendWebhook('installation_repositories', 'delivery-0', {
      action: 'removed',
      installation: { id: 7 },
      sender: { id: 1 },
      repositories_added: [],
      repositories_removed: [{ id: 100, full_name: 'acme/app', private: false }],
    });
    await ctx.settleWebhooks();
    await deliver('delivery-1');

    expect(ctx.github.comments).toEqual([]);
    expect(await runsFor(agent, zapId)).toEqual([
      expect.objectContaining({ status: 'failed', error: 'Zap owner no longer has access to this repository' }),
    ]);
    expect((await agent.get('/api/github/repositories')).body.repositories).toEqual([]);
  });

  it('revokes all access when the app is uninstalled', async () => {
    const agent = await ctx.signIn();

    await ctx.sendWebhook('installation', 'delivery-0', { action: 'deleted', installation: { id: 7 }, sender: { id: 1 } });
    await ctx.settleWebhooks();

    expect((await agent.get('/api/github/repositories')).body.repositories).toEqual([]);
    expect(await mongoose.connection.collection('installations').countDocuments()).toBe(0);
    await agent.post('/api/zaps').send(buildZapInput()).expect(403);
  });

  it('grants newly installed repositories to the installing user', async () => {
    const agent = await ctx.signIn(buildUserAccess({ repositories: [] }));

    await ctx.sendWebhook('installation', 'delivery-0', {
      action: 'created',
      installation: { id: 9 },
      sender: { id: 1 },
      repositories: [{ id: 300, full_name: 'octocat/new', private: true }],
    });
    await ctx.settleWebhooks();

    expect((await agent.get('/api/github/repositories')).body.repositories).toEqual([
      { id: 300, fullName: 'octocat/new', private: true },
    ]);
  });
});
