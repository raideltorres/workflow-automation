import express, { type Router } from 'express';

import type { GitHubUserAccess } from '../../src/integrations/github/github.gateway.js';
import { FakeGitHubGateway } from '../support/fake-github.gateway.js';
import { buildTestConfig, createTestApp } from '../support/test-app.js';
import { clearDatabase, connectTestDatabase } from '../support/test-database.js';

/**
 * API for Playwright: the real app wired to a fake GitHub gateway plus a control router under /api/__e2e.
 * Lives under test/ so it is never part of the production build (tsconfig.build.json only compiles src/).
 */

const DB_NAME = 'workflow-automation-e2e';
const PORT = Number(process.env['E2E_API_PORT'] ?? 3100);
const WEB_URL = process.env['E2E_WEB_URL'] ?? 'http://localhost:4300';
const CONTROL_PREFIX = '/api/__e2e';

function createControlRouter(github: FakeGitHubGateway, webUrl: string): Router {
  const router = express.Router();
  const pendingSignIns: string[] = [];
  let codeCounter = 0;

  router.use(express.json());

  router.post('/reset', async (_req, res) => {
    await clearDatabase();
    github.reset();
    pendingSignIns.length = 0;
    res.status(204).end();
  });

  /** Queues the account the next GitHub "authorize" redirect will sign in as. */
  router.post('/sign-in-as', (req, res) => {
    const code = `e2e-code-${++codeCounter}`;
    github.registerAccount(code, req.body as GitHubUserAccess);
    pendingSignIns.push(code);
    res.status(204).end();
  });

  /** Stands in for github.com/login/oauth/authorize: approves immediately and returns to the real callback. */
  router.get('/github/authorize', (req, res) => {
    const code = pendingSignIns.shift();
    const callback = new URL('/api/auth/github/callback', webUrl);
    if (code) callback.searchParams.set('code', code);
    else callback.searchParams.set('error', 'access_denied');
    callback.searchParams.set('state', String(req.query['state'] ?? ''));
    res.redirect(callback.toString());
  });

  router.get('/github/comments', (_req, res) => {
    res.json(github.comments);
  });

  return router;
}

async function start(): Promise<void> {
  const db = await connectTestDatabase(DB_NAME);
  await clearDatabase();

  const github = new FakeGitHubGateway(`${WEB_URL}${CONTROL_PREFIX}/github/authorize`);
  const { app } = createTestApp(db, buildTestConfig(DB_NAME, WEB_URL), github);

  const server = express();
  server.use(CONTROL_PREFIX, createControlRouter(github, WEB_URL));
  server.use(app);
  server.listen(PORT, () => {
    process.stdout.write(`E2E API listening on ${PORT} (db ${DB_NAME})\n`);
  });
}

start().catch((error: unknown) => {
  process.stderr.write(`Failed to start E2E API: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
