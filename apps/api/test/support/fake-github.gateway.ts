import { ExternalServiceError } from '../../src/core/errors.js';
import type {
  CreatePullRequestCommentParams,
  GitHubGateway,
  GitHubUserAccess,
} from '../../src/integrations/github/github.gateway.js';

export const FAKE_INSTALL_URL = 'https://github.test/apps/workflow-test/installations/new';
const DEFAULT_AUTHORIZE_URL = 'https://github.test/login/oauth/authorize';

/** Stands in for GitHub at the gateway boundary: OAuth codes map to seeded accounts, comments are recorded. */
export class FakeGitHubGateway implements GitHubGateway {
  readonly installUrl = FAKE_INSTALL_URL;
  readonly comments: CreatePullRequestCommentParams[] = [];
  private readonly accounts = new Map<string, GitHubUserAccess>();
  private commentFailure: Error | null = null;

  constructor(private readonly authorizeUrl = DEFAULT_AUTHORIZE_URL) {}

  registerAccount(code: string, access: GitHubUserAccess): void {
    this.accounts.set(code, access);
  }

  failComments(error: Error | null): void {
    this.commentFailure = error;
  }

  reset(): void {
    this.accounts.clear();
    this.comments.length = 0;
    this.commentFailure = null;
  }

  buildAuthorizationUrl(state: string): string {
    const url = new URL(this.authorizeUrl);
    url.searchParams.set('state', state);
    return url.toString();
  }

  async fetchUserAccess(code: string): Promise<GitHubUserAccess> {
    const access = this.accounts.get(code);
    if (!access) throw new ExternalServiceError('GitHub', 'Could not complete sign-in');
    return access;
  }

  async createPullRequestComment(params: CreatePullRequestCommentParams): Promise<{ url: string }> {
    if (this.commentFailure) throw this.commentFailure;
    this.comments.push(params);
    return {
      url: `https://github.com/${params.repositoryFullName}/pull/${params.pullRequestNumber}#issuecomment-${this.comments.length}`,
    };
  }
}
