export interface GitHubUserProfile {
  readonly id: number;
  readonly login: string;
  readonly name: string | null;
  readonly avatarUrl: string;
}

export interface GitHubInstallationInfo {
  readonly id: number;
  readonly accountLogin: string;
  readonly accountType: string;
}

export interface GitHubRepositoryInfo {
  readonly id: number;
  readonly fullName: string;
  readonly private: boolean;
  readonly installationId: number;
}

export interface GitHubUserAccess {
  readonly profile: GitHubUserProfile;
  readonly installations: readonly GitHubInstallationInfo[];
  readonly repositories: readonly GitHubRepositoryInfo[];
}

export interface CreatePullRequestCommentParams {
  readonly installationId: number;
  readonly repositoryFullName: string;
  readonly pullRequestNumber: number;
  readonly body: string;
}

export interface GitHubGateway {
  buildAuthorizationUrl(state: string): string;
  /** Exchanges the OAuth code and reads what the user can access. The user token is never returned. */
  fetchUserAccess(code: string): Promise<GitHubUserAccess>;
  createPullRequestComment(params: CreatePullRequestCommentParams): Promise<{ url: string }>;
  readonly installUrl: string;
}
