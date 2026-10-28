import type { GitHubInstallationInfo, GitHubRepositoryInfo } from '../../integrations/github/github.gateway.js';
import { InstallationModel, RepositoryModel } from './github.models.js';

interface RepositoryLean {
  githubId: number;
  fullName: string;
  private: boolean;
  installationId: number;
}

function toInfo(doc: RepositoryLean): GitHubRepositoryInfo {
  return { id: doc.githubId, fullName: doc.fullName, private: doc.private, installationId: doc.installationId };
}

/** Persistence for GitHub App installations and the repositories they grant. */
export class GitHubRepository {
  async upsertInstallations(installations: readonly GitHubInstallationInfo[]): Promise<void> {
    if (installations.length === 0) return;
    await InstallationModel.bulkWrite(
      installations.map((i) => ({
        updateOne: {
          filter: { githubId: i.id },
          update: { accountLogin: i.accountLogin, accountType: i.accountType },
          upsert: true,
        },
      })),
    );
  }

  async upsertRepositories(repositories: readonly GitHubRepositoryInfo[]): Promise<void> {
    if (repositories.length === 0) return;
    await RepositoryModel.bulkWrite(
      repositories.map((r) => ({
        updateOne: {
          filter: { githubId: r.id },
          update: { fullName: r.fullName, private: r.private, installationId: r.installationId },
          upsert: true,
        },
      })),
    );
  }

  async findRepositoriesByIds(ids: readonly number[]): Promise<GitHubRepositoryInfo[]> {
    const docs = await RepositoryModel.find({ githubId: { $in: ids } })
      .sort({ fullName: 1 })
      .lean<RepositoryLean[]>();
    return docs.map(toInfo);
  }

  async findRepositoryById(id: number): Promise<GitHubRepositoryInfo | null> {
    const doc = await RepositoryModel.findOne({ githubId: id }).lean<RepositoryLean>();
    return doc ? toInfo(doc) : null;
  }

  async findRepositoryIdsByInstallation(installationId: number): Promise<number[]> {
    const docs = await RepositoryModel.find({ installationId }, { githubId: 1 }).lean<RepositoryLean[]>();
    return docs.map((d) => d.githubId);
  }

  async deleteRepositories(ids: readonly number[]): Promise<void> {
    await RepositoryModel.deleteMany({ githubId: { $in: ids } });
  }

  async deleteInstallation(installationId: number): Promise<void> {
    await InstallationModel.deleteOne({ githubId: installationId });
  }
}
