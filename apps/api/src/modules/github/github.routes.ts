import { Router } from 'express';

import type { RepositoryListResponse } from '@workflow/shared';

import { currentUserId, requireAuth } from '../../core/middleware/require-auth.js';
import type { GitHubAccessService } from './github-access.service.js';

export function createGitHubRouter(access: GitHubAccessService, installUrl: string): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/repositories', async (req, res) => {
    const repositories = await access.listAccessibleRepositories(currentUserId(req));
    const body: RepositoryListResponse = { repositories, installUrl };
    res.json(body);
  });

  return router;
}
