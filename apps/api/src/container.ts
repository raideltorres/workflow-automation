import MongoStore from 'connect-mongo';
import type { Store } from 'express-session';
import type mongoose from 'mongoose';

import type { AppConfig } from './core/config.js';
import type { Logger } from './core/logger.js';
import type { GitHubGateway } from './integrations/github/github.gateway.js';
import { OctokitGitHubGateway } from './integrations/github/octokit-github.gateway.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthService } from './modules/auth/auth.service.js';
import { GitHubAccessService } from './modules/github/github-access.service.js';
import { GitHubRepository } from './modules/github/github.repository.js';
import { ZapRunRepository } from './modules/runs/zap-run.repository.js';
import { UserRepository } from './modules/users/user.repository.js';
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
  readonly zapController: ZapController;
}

export function createContainer(config: AppConfig, logger: Logger, db: typeof mongoose): Container {
  const sessionStore = MongoStore.create({
    client: db.connection.getClient(),
    dbName: config.mongo.dbName,
    collectionName: 'sessions',
  });

  const githubGateway = new OctokitGitHubGateway({
    ...config.github,
    callbackUrl: `${config.webUrl}/api/auth/github/callback`,
  });

  const users = new UserRepository();
  const githubRepository = new GitHubRepository();
  const githubAccess = new GitHubAccessService(users, githubRepository);
  const authService = new AuthService(githubGateway, githubAccess, users);
  const authController = new AuthController(authService, config.webUrl, logger);

  const zapRepository = new ZapRepository();
  const zapRunRepository = new ZapRunRepository();
  const zapController = new ZapController(new ZapService(zapRepository, zapRunRepository, githubAccess));

  return { config, logger, sessionStore, githubGateway, githubAccess, authController, zapController };
}
