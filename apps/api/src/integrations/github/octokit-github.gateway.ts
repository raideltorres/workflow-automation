import { App } from '@octokit/app';

import { ExternalServiceError } from '../../core/errors.js';
import type {
  CreatePullRequestCommentParams,
  GitHubGateway,
  GitHubInstallationInfo,
  GitHubRepositoryInfo,
  GitHubUserAccess,
} from './github.gateway.js';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export interface GitHubAppOptions {
  readonly appId: string;
  readonly appSlug: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly privateKey: string;
  readonly callbackUrl: string;
}

type UserOctokit = Awaited<ReturnType<App['oauth']['getUserOctokit']>>;

export class OctokitGitHubGateway implements GitHubGateway {
  private readonly app: App;
  readonly installUrl: string;

  constructor(private readonly options: GitHubAppOptions) {
    this.app = new App({
      appId: options.appId,
      privateKey: options.privateKey,
      oauth: { clientId: options.clientId, clientSecret: options.clientSecret },
    });
    this.installUrl = `https://github.com/apps/${options.appSlug}/installations/new`;
  }

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.callbackUrl,
      state,
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async fetchUserAccess(code: string): Promise<GitHubUserAccess> {
    try {
      const octokit = await this.app.oauth.getUserOctokit({ code });
      const { data: user } = await octokit.request('GET /user');
      const installations = await this.listUserInstallations(octokit);
      const repositories = (
        await Promise.all(installations.map((installation) => this.listInstallationRepositories(octokit, installation.id)))
      ).flat();

      return {
        profile: { id: Number(user.id), login: user.login, name: user.name ?? null, avatarUrl: user.avatar_url },
        installations,
        repositories,
      };
    } catch (error) {
      throw new ExternalServiceError('GitHub', 'Could not complete sign-in', { cause: error });
    }
  }

  async createPullRequestComment(params: CreatePullRequestCommentParams): Promise<{ url: string }> {
    const [owner, repo] = params.repositoryFullName.split('/');
    if (!owner || !repo) throw new Error(`Invalid repository name: ${params.repositoryFullName}`);

    const octokit = await this.app.getInstallationOctokit(params.installationId);
    const { data } = await octokit.request('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
      owner,
      repo,
      issue_number: params.pullRequestNumber,
      body: params.body,
    });
    return { url: data.html_url };
  }

  private async listUserInstallations(octokit: UserOctokit): Promise<GitHubInstallationInfo[]> {
    const result: GitHubInstallationInfo[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await octokit.request('GET /user/installations', { per_page: PAGE_SIZE, page });
      for (const installation of data.installations) {
        const account = installation.account;
        result.push({
          id: Number(installation.id),
          accountLogin: account && 'login' in account ? account.login : (account?.slug ?? 'unknown'),
          accountType: installation.target_type,
        });
      }
      if (data.installations.length < PAGE_SIZE) break;
    }
    return result;
  }

  private async listInstallationRepositories(
    octokit: UserOctokit,
    installationId: number,
  ): Promise<GitHubRepositoryInfo[]> {
    const result: GitHubRepositoryInfo[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const { data } = await octokit.request('GET /user/installations/{installation_id}/repositories', {
        installation_id: installationId,
        per_page: PAGE_SIZE,
        page,
      });
      for (const repo of data.repositories) {
        result.push({ id: Number(repo.id), fullName: repo.full_name, private: repo.private, installationId });
      }
      if (data.repositories.length < PAGE_SIZE) break;
    }
    return result;
  }
}
