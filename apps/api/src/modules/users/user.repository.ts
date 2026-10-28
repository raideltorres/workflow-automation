import type { GitHubUserProfile } from '../../integrations/github/github.gateway.js';
import { UserModel } from './user.model.js';

export interface UserRecord {
  readonly id: string;
  readonly githubId: number;
  readonly login: string;
  readonly name: string | null;
  readonly avatarUrl: string;
  readonly repositoryIds: readonly number[];
}

interface UserLean {
  _id: { toString(): string };
  githubId: number;
  login: string;
  name?: string | null;
  avatarUrl: string;
  repositoryIds?: number[];
}

function toRecord(doc: UserLean): UserRecord {
  return {
    id: doc._id.toString(),
    githubId: doc.githubId,
    login: doc.login,
    name: doc.name ?? null,
    avatarUrl: doc.avatarUrl,
    repositoryIds: doc.repositoryIds ?? [],
  };
}

export class UserRepository {
  async upsertWithAccess(profile: GitHubUserProfile, repositoryIds: readonly number[]): Promise<UserRecord> {
    const doc = await UserModel.findOneAndUpdate(
      { githubId: profile.id },
      {
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatarUrl,
        repositoryIds,
        accessSyncedAt: new Date(),
      },
      { upsert: true, new: true, lean: true },
    );
    return toRecord(doc as UserLean);
  }

  async findById(id: string): Promise<UserRecord | null> {
    const doc = await UserModel.findById(id).lean<UserLean>();
    return doc ? toRecord(doc) : null;
  }

  async grantRepositories(githubUserId: number, repositoryIds: readonly number[]): Promise<void> {
    await UserModel.updateOne({ githubId: githubUserId }, { $addToSet: { repositoryIds: { $each: repositoryIds } } });
  }

  async revokeRepositoriesForAll(repositoryIds: readonly number[]): Promise<void> {
    await UserModel.updateMany({}, { $pull: { repositoryIds: { $in: repositoryIds } } });
  }
}
