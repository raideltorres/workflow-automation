import type { Express } from 'express';
import type mongoose from 'mongoose';

import { createApp } from '../../src/app.js';
import { createContainer } from '../../src/container.js';
import type { AppConfig } from '../../src/core/config.js';
import { createLogger } from '../../src/core/logger.js';
import { FakeGitHubGateway } from './fake-github.gateway.js';

export const TEST_WEBHOOK_SECRET = 'test-webhook-secret';
export const TEST_SESSION_SECRET = 'test-session-secret-that-is-at-least-32-chars';

export function buildTestConfig(dbName: string, webUrl = 'http://localhost:4200'): AppConfig {
  return {
    env: 'test',
    port: 0,
    webUrl,
    sessionSecret: TEST_SESSION_SECRET,
    mongo: { uri: 'unused-in-tests', dbName },
    github: {
      appId: '1',
      appSlug: 'workflow-test',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      webhookSecret: TEST_WEBHOOK_SECRET,
      privateKey: 'unused-with-fake-gateway',
    },
    openai: { apiKey: undefined, model: 'unused' },
  };
}

export interface TestApp {
  readonly app: Express;
  readonly github: FakeGitHubGateway;
  readonly config: AppConfig;
}

export function createTestApp(db: typeof mongoose, config: AppConfig, github = new FakeGitHubGateway()): TestApp {
  const container = createContainer(config, createLogger(config.env), db, { githubGateway: github });
  return { app: createApp(container), github, config };
}
