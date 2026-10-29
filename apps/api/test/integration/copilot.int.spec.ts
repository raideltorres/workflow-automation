import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { ExternalServiceError } from '../../src/core/errors.js';
import { buildRepository, buildUserAccess } from '../../src/testing/factories.js';
import { useIntegrationApp } from './support/integration-context.js';

const ctx = useIntegrationApp();

describe('Copilot API', () => {
  it('creates a validated, disabled draft for an accessible repository', async () => {
    const agent = await ctx.signIn();
    ctx.copilot.setDraft({
      name: 'Welcome contributors',
      comment: 'Thanks @{{pull_request.author}} for opening {{pull_request.title}}!',
    });

    const response = await agent
      .post('/api/copilot/zap-drafts')
      .send({ prompt: 'thank authors when they open a PR', repositoryId: 100 })
      .expect(201);

    expect(response.body).toMatchObject({
      name: 'Welcome contributors',
      enabled: false,
      trigger: { key: 'github.pull_request.opened', config: { repositoryId: 100, repositoryFullName: 'acme/app' } },
      action: { key: 'github.pull_request.comment', input: { body: expect.stringContaining('{{pull_request.author}}') } },
    });
  });

  it('requires a signed-in user, valid input, and access to the selected repository', async () => {
    await request(ctx.app).post('/api/copilot/zap-drafts').send({ prompt: 'draft', repositoryId: 100 }).expect(401);

    const agent = await ctx.signIn(buildUserAccess({ repositories: [buildRepository({ id: 100 })] }));
    await agent.post('/api/copilot/zap-drafts').send({ prompt: '', repositoryId: 100 }).expect(400);
    await agent.post('/api/copilot/zap-drafts').send({ prompt: 'draft', repositoryId: 200 }).expect(403);
  });

  it('rejects an invalid model draft without persisting a Zap', async () => {
    const agent = await ctx.signIn();
    ctx.copilot.setDraft({ name: 'Leaky', comment: 'Here is {{secret.token}}' });

    await agent.post('/api/copilot/zap-drafts').send({ prompt: 'draft', repositoryId: 100 }).expect(400);
    expect((await agent.get('/api/zaps')).body).toEqual([]);
  });

  it('returns a safe upstream error when the provider is unavailable', async () => {
    const agent = await ctx.signIn();
    ctx.copilot.failWith(new ExternalServiceError('OpenAI', 'returned 429'));

    const response = await agent.post('/api/copilot/zap-drafts').send({ prompt: 'draft', repositoryId: 100 }).expect(502);
    expect(response.body).toEqual({
      error: { code: 'external_service_error', message: 'OpenAI: returned 429' },
    });
  });
});
