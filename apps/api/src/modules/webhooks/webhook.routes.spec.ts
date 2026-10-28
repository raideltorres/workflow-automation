import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createErrorHandler } from '../../core/middleware/error-handler.js';
import { createLogger } from '../../core/logger.js';
import { buildPullRequestOpenedPayload } from '../../testing/factories.js';
import { signGitHubPayload } from './github-signature.js';
import { WebhookController } from './webhook.controller.js';
import { createWebhookRouter } from './webhook.routes.js';
import type { WebhookService } from './webhook.service.js';

const secret = 'webhook-secret';
const logger = createLogger('test');

function buildApp(handle: WebhookService['handle']) {
  const service = { handle } as unknown as WebhookService;
  const app = express();
  app.use('/api/webhooks', createWebhookRouter(new WebhookController(service, secret, logger)));
  app.use(createErrorHandler(logger));
  return app;
}

describe('POST /api/webhooks/github', () => {
  const body = JSON.stringify(buildPullRequestOpenedPayload());
  let handle: ReturnType<typeof vi.fn<WebhookService['handle']>>;

  beforeEach(() => {
    handle = vi.fn<WebhookService['handle']>().mockResolvedValue(undefined);
  });

  it('acknowledges a correctly signed delivery and hands it to the service', async () => {
    const response = await request(buildApp(handle))
      .post('/api/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'delivery-1')
      .set('x-hub-signature-256', signGitHubPayload(secret, body))
      .send(body);

    expect(response.status).toBe(202);
    expect(handle).toHaveBeenCalledWith('pull_request', 'delivery-1', JSON.parse(body));
  });

  it('rejects an invalid signature without processing', async () => {
    const response = await request(buildApp(handle))
      .post('/api/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'pull_request')
      .set('x-github-delivery', 'delivery-1')
      .set('x-hub-signature-256', signGitHubPayload('wrong-secret', body))
      .send(body);

    expect(response.status).toBe(401);
    expect(handle).not.toHaveBeenCalled();
  });

  it('rejects signed requests that are missing GitHub event headers', async () => {
    const response = await request(buildApp(handle))
      .post('/api/webhooks/github')
      .set('content-type', 'application/json')
      .set('x-hub-signature-256', signGitHubPayload(secret, body))
      .send(body);

    expect(response.status).toBe(400);
    expect(handle).not.toHaveBeenCalled();
  });
});
