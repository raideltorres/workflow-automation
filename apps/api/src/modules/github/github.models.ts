import { Schema, model } from 'mongoose';

const installationSchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    accountLogin: { type: String, required: true },
    accountType: { type: String, required: true },
  },
  { timestamps: true },
);

export const InstallationModel = model('Installation', installationSchema);

const repositorySchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    fullName: { type: String, required: true },
    private: { type: Boolean, required: true },
    installationId: { type: Number, required: true, index: true },
  },
  { timestamps: true },
);

export const RepositoryModel = model('Repository', repositorySchema, 'repositories');
