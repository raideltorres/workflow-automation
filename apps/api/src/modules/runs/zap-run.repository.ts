import { mongo } from 'mongoose';

import type { ZapRun } from '@workflow/shared';

import { ZapRunModel, type ZapRunLean } from './zap-run.model.js';

const DUPLICATE_KEY_ERROR = 11000;
const RUN_HISTORY_LIMIT = 50;

export interface ClaimRunParams {
  readonly zapId: string;
  readonly ownerId: string;
  readonly deliveryId: string;
  readonly trigger: ZapRun['trigger'];
}

function toDto(doc: ZapRunLean): ZapRun {
  return {
    id: doc._id.toString(),
    zapId: doc.zapId.toString(),
    deliveryId: doc.deliveryId,
    status: doc.status,
    trigger: { ...doc.trigger },
    ...(doc.output?.commentUrl ? { output: { commentUrl: doc.output.commentUrl } } : {}),
    ...(doc.error ? { error: doc.error } : {}),
    startedAt: doc.startedAt.toISOString(),
    ...(doc.finishedAt ? { finishedAt: doc.finishedAt.toISOString() } : {}),
  };
}

export class ZapRunRepository {
  /** Inserts a running record. Returns null when this Zap already processed the delivery. */
  async claim(params: ClaimRunParams): Promise<{ id: string } | null> {
    try {
      const doc = await ZapRunModel.create({ ...params, status: 'running', startedAt: new Date() });
      return { id: doc._id.toString() };
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === DUPLICATE_KEY_ERROR) return null;
      throw error;
    }
  }

  async markSucceeded(id: string, output: { commentUrl: string }): Promise<void> {
    await ZapRunModel.updateOne({ _id: id }, { status: 'succeeded', output, finishedAt: new Date() });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await ZapRunModel.updateOne({ _id: id }, { status: 'failed', error, finishedAt: new Date() });
  }

  async listByZap(zapId: string): Promise<ZapRun[]> {
    const docs = await ZapRunModel.find({ zapId })
      .sort({ startedAt: -1 })
      .limit(RUN_HISTORY_LIMIT)
      .lean<ZapRunLean[]>();
    return docs.map(toDto);
  }
}
