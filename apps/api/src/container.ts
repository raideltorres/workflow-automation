import MongoStore from 'connect-mongo';
import type { Store } from 'express-session';
import type mongoose from 'mongoose';

import type { AppConfig } from './core/config.js';
import type { Logger } from './core/logger.js';
import type { GitHubGateway } from './integrations/github/github.gateway.js';
import { OctokitGitHubGateway } from './integrations/github/octokit-github.gateway.js';
import type { CopilotGateway } from './integrations/openai/copilot.gateway.js';
import { OpenAiCopilotGateway } from './integrations/openai/openai-copilot.gateway.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthService } from './modules/auth/auth.service.js';
import { CopilotController } from './modules/copilot/copilot.controller.js';
import { CopilotService } from './modules/copilot/copilot.service.js';
import { CommentOnPullRequestAction } from './modules/engine/actions/comment-on-pull-request.action.js';
import { EngineRegistry } from './modules/engine/engine.registry.js';
import { pullRequestOpenedTrigger } from './modules/engine/triggers/pull-request-opened.trigger.js';
import { ZapExecutor } from './modules/engine/zap-executor.service.js';
import { GitHubAccessService } from './modules/github/github-access.service.js';
import { GitHubRepository } from './modules/github/github.repository.js';
import { ZapRunRepository } from './modules/runs/zap-run.repository.js';
import { UserRepository } from './modules/users/user.repository.js';
import { WebhookController } from './modules/webhooks/webhook.controller.js';
import { WebhookService } from './modules/webhooks/webhook.service.js';
import { ZapController } from './modules/zaps/zap.controller.js';
import { ZapRepository } from './modules/zaps/zap.repository.js';
import { ZapService } from './modules/zaps/zap.service.js';

export interface Container {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly sessionStore: Store;
  readonly githubGateway: GitHubGateway;
  readonly githubAccess: GitHubAccessService;
  readonly authController: AuthController;
  readonly copilotController: CopilotController;
  readonly zapController: ZapController;
  readonly webhookController: WebhookController;
}

export interface ContainerOverrides {
  readonly githubGateway?: GitHubGateway;
  readonly copilotGateway?: CopilotGateway;
}

export function oauthCallbackUrl(webUrl: string): string {
  return `${webUrl}/api/auth/github/callback`;
}

export function createContainer(
  config: AppConfig,
  logger: Logger,
  db: typeof mongoose,
  overrides: ContainerOverrides = {},
): Container {
  const sessionStore = MongoStore.create({
    client: db.connection.getClient(),
    dbName: config.mongo.dbName,
    collectionName: 'sessions',
  });

  const githubGateway =
    overrides.githubGateway ??
    new OctokitGitHubGateway({ ...config.github, callbackUrl: oauthCallbackUrl(config.webUrl) });
  const copilotGateway =
    overrides.copilotGateway ??
    (config.openai.apiKey ? new OpenAiCopilotGateway(config.openai.apiKey, config.openai.model) : undefined);

  const users = new UserRepository();
  const githubRepository = new GitHubRepository();
  const zapRepository = new ZapRepository();
  const zapRunRepository = new ZapRunRepository();

  const githubAccess = new GitHubAccessService(users, githubRepository);
  const authService = new AuthService(githubGateway, githubAccess, users);
  const zapService = new ZapService(zapRepository, zapRunRepository, githubAccess);
  const copilotService = new CopilotService(copilotGateway, zapService);

  const registry = new EngineRegistry([pullRequestOpenedTrigger], [new CommentOnPullRequestAction(githubGateway)]);
  const executor = new ZapExecutor(zapRepository, zapRunRepository, githubAccess, registry, logger);
  const webhookService = new WebhookService(registry, executor, githubAccess, logger);

  return {
    config,
    logger,
    sessionStore,
    githubGateway,
    githubAccess,
    authController: new AuthController(authService, config.webUrl, logger),
    copilotController: new CopilotController(copilotService),
    zapController: new ZapController(zapService),
    webhookController: new WebhookController(webhookService, config.github.webhookSecret, logger),
  };
}
