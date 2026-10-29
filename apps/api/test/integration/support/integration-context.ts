import request from 'supertest';
import { type MockInstance, afterAll, beforeAll, beforeEach, expect, vi } from 'vitest';

import type { GitHubUserAccess } from '../../../src/integrations/github/github.gateway.js';
import { signGitHubPayload } from '../../../src/modules/webhooks/github-signature.js';
import { WebhookService } from '../../../src/modules/webhooks/webhook.service.js';
import { buildUserAccess } from '../../../src/testing/factories.js';
import { type TestApp, TEST_WEBHOOK_SECRET, buildTestConfig, createTestApp } from '../../support/test-app.js';
import { FakeCopilotGateway } from '../../support/fake-copilot.gateway.js';
import { clearDatabase, connectTestDatabase, disconnectTestDatabase } from '../../support/test-database.js';

const DB_NAME = 'workflow-automation-integration';
const SESSION_COOKIE = 'wa.sid';

export type Agent = ReturnType<typeof request.agent>;

export interface IntegrationContext {
  readonly app: TestApp['app'];
  readonly github: TestApp['github'];
  readonly copilot: FakeCopilotGateway;
  readonly webUrl: string;
  /** Signs in through the real OAuth login and callback routes, with GitHub replaced by the fake gateway. */
  signIn(access?: GitHubUserAccess): Promise<Agent>;
  sendWebhook(event: string, deliveryId: string, payload: unknown, secret?: string): Promise<request.Response>;
  /** Resolves once every webhook acknowledged so far has finished its background processing. */
  settleWebhooks(): Promise<void>;
}

export function sessionCookie(response: request.Response): string | undefined {
  const header: unknown = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? (header as string[]) : [];
  return cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`));
}

export function useIntegrationApp(): IntegrationContext {
  let testApp: TestApp;
  let copilot: FakeCopilotGateway;
  let handleSpy: MockInstance<WebhookService['handle']>;
  let codeCounter = 0;

  beforeAll(async () => {
    const db = await connectTestDatabase(DB_NAME);
    copilot = new FakeCopilotGateway();
    testApp = createTestApp(db, buildTestConfig(DB_NAME), undefined, copilot);
    handleSpy = vi.spyOn(WebhookService.prototype, 'handle');
  });

  beforeEach(async () => {
    await clearDatabase();
    testApp.github.reset();
    copilot.reset();
    handleSpy.mockClear();
  });

  afterAll(async () => {
    handleSpy.mockRestore();
    await disconnectTestDatabase();
  });

  return {
    get app() {
      return testApp.app;
    },
    get github() {
      return testApp.github;
    },
    get copilot() {
      return copilot;
    },
    get webUrl() {
      return testApp.config.webUrl;
    },

    async signIn(access = buildUserAccess()) {
      const code = `code-${++codeCounter}`;
      testApp.github.registerAccount(code, access);
      const agent = request.agent(testApp.app);

      const login = await agent.get('/api/auth/github/login').expect(302);
      const state = new URL(login.headers['location'] as string).searchParams.get('state');
      const callback = await agent.get('/api/auth/github/callback').query({ code, state }).expect(302);
      expect(callback.headers['location']).toBe(`${testApp.config.webUrl}/zaps`);
      return agent;
    },

    sendWebhook(event, deliveryId, payload, secret = TEST_WEBHOOK_SECRET) {
      const body = JSON.stringify(payload);
      return request(testApp.app)
        .post('/api/webhooks/github')
        .set('content-type', 'application/json')
        .set('x-github-event', event)
        .set('x-github-delivery', deliveryId)
        .set('x-hub-signature-256', signGitHubPayload(secret, body))
        .send(body);
    },

    async settleWebhooks() {
      await Promise.allSettled(handleSpy.mock.results.map((result) => result.value));
    },
  };
}
