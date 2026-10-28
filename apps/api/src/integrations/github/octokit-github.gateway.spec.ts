import { App } from '@octokit/app';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '../../core/errors.js';
import { OctokitGitHubGateway } from './octokit-github.gateway.js';

const userRequest = vi.fn();
const installationRequest = vi.fn();
const getUserOctokit = vi.fn();
const getInstallationOctokit = vi.fn();

vi.mock('@octokit/app', () => ({
  App: vi.fn(function MockApp() {
    return { oauth: { getUserOctokit }, getInstallationOctokit };
  }),
}));

const options = {
  appId: '1',
  appSlug: 'workflow-bot',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  privateKey: 'key',
  callbackUrl: 'http://localhost:4200/api/auth/github/callback',
};

function page<T>(items: T[], key: string) {
  return { data: { [key]: items } };
}

describe('OctokitGitHubGateway', () => {
  let gateway: OctokitGitHubGateway;

  beforeEach(() => {
    vi.mocked(App).mockClear();
    for (const fn of [userRequest, installationRequest, getUserOctokit, getInstallationOctokit]) fn.mockReset();
    getUserOctokit.mockResolvedValue({ request: userRequest });
    getInstallationOctokit.mockResolvedValue({ request: installationRequest });
    gateway = new OctokitGitHubGateway(options);
  });

  it('configures the GitHub App with its credentials and derives the install URL', () => {
    expect(App).toHaveBeenCalledWith({
      appId: '1',
      privateKey: 'key',
      oauth: { clientId: 'client-id', clientSecret: 'client-secret' },
    });
    expect(gateway.installUrl).toBe('https://github.com/apps/workflow-bot/installations/new');
  });

  it('builds an authorization URL carrying the state and exact callback', () => {
    const url = new URL(gateway.buildAuthorizationUrl('state-123'));

    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client-id',
      redirect_uri: options.callbackUrl,
      state: 'state-123',
    });
  });

  describe('fetchUserAccess', () => {
    it('reads the profile, installations and their repositories with the user token', async () => {
      userRequest.mockImplementation(async (route: string) => {
        if (route === 'GET /user') return { data: { id: 1, login: 'octocat', name: null, avatar_url: 'a' } };
        if (route === 'GET /user/installations') {
          return page([{ id: 7, account: { login: 'acme' }, target_type: 'Organization' }], 'installations');
        }
        return page([{ id: 100, full_name: 'acme/app', private: true }], 'repositories');
      });

      const access = await gateway.fetchUserAccess('code-1');

      expect(getUserOctokit).toHaveBeenCalledWith({ code: 'code-1' });
      expect(access).toEqual({
        profile: { id: 1, login: 'octocat', name: null, avatarUrl: 'a' },
        installations: [{ id: 7, accountLogin: 'acme', accountType: 'Organization' }],
        repositories: [{ id: 100, fullName: 'acme/app', private: true, installationId: 7 }],
      });
    });

    it('follows pagination until a short page', async () => {
      const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, full_name: `acme/r${i}`, private: false }));
      userRequest.mockImplementation(async (route: string, params?: { page: number }) => {
        if (route === 'GET /user') return { data: { id: 1, login: 'octocat', avatar_url: 'a' } };
        if (route === 'GET /user/installations') {
          return page([{ id: 7, account: { slug: 'team-app' }, target_type: 'Enterprise' }], 'installations');
        }
        return page(params?.page === 1 ? fullPage : [{ id: 999, full_name: 'acme/last', private: false }], 'repositories');
      });

      const access = await gateway.fetchUserAccess('code-1');

      expect(access.repositories).toHaveLength(101);
      expect(access.installations[0]?.accountLogin).toBe('team-app');
      expect(access.profile.name).toBeNull();
    });

    it('wraps OAuth or API failures without leaking the upstream error', async () => {
      getUserOctokit.mockRejectedValue(new Error('bad_verification_code'));

      const error = await gateway.fetchUserAccess('expired').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ExternalServiceError);
      expect((error as ExternalServiceError).message).toBe('GitHub: Could not complete sign-in');
      expect((error as ExternalServiceError).cause).toEqual(new Error('bad_verification_code'));
    });
  });

  describe('createPullRequestComment', () => {
    it('posts the comment with an installation token', async () => {
      installationRequest.mockResolvedValue({ data: { html_url: 'https://github.com/acme/app/pull/42#c1' } });

      const result = await gateway.createPullRequestComment({
        installationId: 7,
        repositoryFullName: 'acme/app',
        pullRequestNumber: 42,
        body: 'Thanks!',
      });

      expect(getInstallationOctokit).toHaveBeenCalledWith(7);
      expect(installationRequest).toHaveBeenCalledWith('POST /repos/{owner}/{repo}/issues/{issue_number}/comments', {
        owner: 'acme',
        repo: 'app',
        issue_number: 42,
        body: 'Thanks!',
      });
      expect(result).toEqual({ url: 'https://github.com/acme/app/pull/42#c1' });
    });

    it('fails when an installation token cannot be issued', async () => {
      getInstallationOctokit.mockRejectedValue(new Error('Integration not found'));

      await expect(
        gateway.createPullRequestComment({ installationId: 9, repositoryFullName: 'a/b', pullRequestNumber: 1, body: 'x' }),
      ).rejects.toThrow('Integration not found');
      expect(installationRequest).not.toHaveBeenCalled();
    });

    it('surfaces GitHub API errors such as missing permissions', async () => {
      installationRequest.mockRejectedValue(new Error('Resource not accessible by integration'));

      await expect(
        gateway.createPullRequestComment({ installationId: 7, repositoryFullName: 'a/b', pullRequestNumber: 1, body: 'x' }),
      ).rejects.toThrow('Resource not accessible by integration');
    });

    it('rejects a malformed repository name before calling GitHub', async () => {
      await expect(
        gateway.createPullRequestComment({ installationId: 7, repositoryFullName: 'no-slash', pullRequestNumber: 1, body: 'x' }),
      ).rejects.toThrow('Invalid repository name: no-slash');
      expect(getInstallationOctokit).not.toHaveBeenCalled();
    });
  });
});
