import { Schema, model, type Types } from 'mongoose';

import { ZAP_RUN_STATUSES, type ZapRunStatus } from '@workflow/shared';

const zapRunSchema = new Schema({
  zapId: { type: Schema.Types.ObjectId, ref: 'Zap', required: true },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  deliveryId: { type: String, required: true },
  status: { type: String, enum: ZAP_RUN_STATUSES, required: true },
  trigger: {
    repositoryFullName: { type: String, required: true },
    pullRequestNumber: { type: Number, required: true },
    pullRequestTitle: { type: String, required: true },
    pullRequestUrl: { type: String, required: true },
  },
  output: { commentUrl: { type: String } },
  error: { type: String },
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date },
});

/** Idempotency: one run per Zap per GitHub delivery, even when GitHub redelivers. */
zapRunSchema.index({ zapId: 1, deliveryId: 1 }, { unique: true });
zapRunSchema.index({ zapId: 1, startedAt: -1 });

export const ZapRunModel = model('ZapRun', zapRunSchema);

export interface ZapRunLean {
  _id: Types.ObjectId;
  zapId: Types.ObjectId;
  ownerId: Types.ObjectId;
  deliveryId: string;
  status: ZapRunStatus;
  trigger: { repositoryFullName: string; pullRequestNumber: number; pullRequestTitle: string; pullRequestUrl: string };
  output?: { commentUrl?: string };
  error?: string;
  startedAt: Date;
  finishedAt?: Date;
}
