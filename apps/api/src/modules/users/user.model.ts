import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    login: { type: String, required: true },
    name: { type: String, default: null },
    avatarUrl: { type: String, required: true },
    /** GitHub repository ids this user can access through an app installation (snapshot from last sign-in). */
    repositoryIds: { type: [Number], default: [] },
    accessSyncedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;
export const UserModel = model('User', userSchema);
