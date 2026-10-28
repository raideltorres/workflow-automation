import { isValidObjectId } from 'mongoose';

import type { TriggerKey, Zap, ZapInput } from '@workflow/shared';

import { ZapModel, type ZapLean } from './zap.model.js';

export interface ZapRecord extends Zap {
  readonly ownerId: string;
}

export type ZapWriteData = ZapInput & { readonly repositoryFullName: string };

function toRecord(doc: ZapLean): ZapRecord {
  return {
    id: doc._id.toString(),
    ownerId: doc.ownerId.toString(),
    name: doc.name,
    enabled: doc.enabled,
    trigger: { key: doc.trigger.key, config: { ...doc.trigger.config } },
    action: { key: doc.action.key, input: { ...doc.action.input } },
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toDocument(data: ZapWriteData) {
  return {
    name: data.name,
    enabled: data.enabled,
    trigger: {
      key: data.trigger.key,
      config: { repositoryId: data.trigger.config.repositoryId, repositoryFullName: data.repositoryFullName },
    },
    action: data.action,
  };
}

export class ZapRepository {
  async create(ownerId: string, data: ZapWriteData): Promise<ZapRecord> {
    const doc = await ZapModel.create({ ownerId, ...toDocument(data) });
    return toRecord(doc.toObject() as ZapLean);
  }

  async listByOwner(ownerId: string): Promise<ZapRecord[]> {
    const docs = await ZapModel.find({ ownerId }).sort({ updatedAt: -1 }).lean<ZapLean[]>();
    return docs.map(toRecord);
  }

  async findOwned(id: string, ownerId: string): Promise<ZapRecord | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ZapModel.findOne({ _id: id, ownerId }).lean<ZapLean>();
    return doc ? toRecord(doc) : null;
  }

  async updateOwned(id: string, ownerId: string, data: ZapWriteData): Promise<ZapRecord | null> {
    if (!isValidObjectId(id)) return null;
    const doc = await ZapModel.findOneAndUpdate({ _id: id, ownerId }, toDocument(data), {
      returnDocument: 'after',
      runValidators: true,
    }).lean<ZapLean>();
    return doc ? toRecord(doc) : null;
  }

  async deleteOwned(id: string, ownerId: string): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await ZapModel.deleteOne({ _id: id, ownerId });
    return result.deletedCount === 1;
  }

  async findEnabledByTrigger(key: TriggerKey, repositoryId: number): Promise<ZapRecord[]> {
    const docs = await ZapModel.find({
      enabled: true,
      'trigger.key': key,
      'trigger.config.repositoryId': repositoryId,
    }).lean<ZapLean[]>();
    return docs.map(toRecord);
  }
}
