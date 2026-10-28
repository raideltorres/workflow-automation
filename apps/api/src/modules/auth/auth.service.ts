import type { CurrentUser } from '@workflow/shared';

import type { GitHubGateway } from '../../integrations/github/github.gateway.js';
import type { GitHubAccessService } from '../github/github-access.service.js';
import type { UserRecord, UserRepository } from '../users/user.repository.js';

function toCurrentUser(user: UserRecord): CurrentUser {
  return { id: user.id, login: user.login, name: user.name, avatarUrl: user.avatarUrl };
}

export class AuthService {
  constructor(
    private readonly github: GitHubGateway,
    private readonly access: GitHubAccessService,
    private readonly users: UserRepository,
  ) {}

  buildAuthorizationUrl(state: string): string {
    return this.github.buildAuthorizationUrl(state);
  }

  async signIn(code: string): Promise<CurrentUser> {
    const access = await this.github.fetchUserAccess(code);
    const user = await this.access.syncFromSignIn(access);
    return toCurrentUser(user);
  }

  async getCurrentUser(userId: string): Promise<CurrentUser | null> {
    const user = await this.users.findById(userId);
    return user ? toCurrentUser(user) : null;
  }
}
