import { Schema, model, type Types } from 'mongoose';

import { ACTION_KEYS, TRIGGER_KEYS } from '@workflow/shared';

const zapSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, required: true, default: false },
    trigger: {
      key: { type: String, enum: TRIGGER_KEYS, required: true },
      config: {
        repositoryId: { type: Number, required: true },
        repositoryFullName: { type: String, required: true },
      },
    },
    action: {
      key: { type: String, enum: ACTION_KEYS, required: true },
      input: {
        body: { type: String, required: true },
      },
    },
  },
  { timestamps: true },
);

zapSchema.index({ 'trigger.key': 1, 'trigger.config.repositoryId': 1, enabled: 1 });

export const ZapModel = model('Zap', zapSchema);

export interface ZapLean {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  enabled: boolean;
  trigger: { key: (typeof TRIGGER_KEYS)[number]; config: { repositoryId: number; repositoryFullName: string } };
  action: { key: (typeof ACTION_KEYS)[number]; input: { body: string } };
  createdAt: Date;
  updatedAt: Date;
}
