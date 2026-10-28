import mongoose, { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { RepositoryModel } from '../../src/modules/github/github.models.js';
import { ZapRunModel } from '../../src/modules/runs/zap-run.model.js';
import { ZapRunRepository } from '../../src/modules/runs/zap-run.repository.js';
import { UserRepository } from '../../src/modules/users/user.repository.js';
import { ZapModel } from '../../src/modules/zaps/zap.model.js';
import { ZapRepository } from '../../src/modules/zaps/zap.repository.js';
import { buildZapInput } from '../../src/testing/factories.js';
import { useIntegrationApp } from './support/integration-context.js';

useIntegrationApp();

const zaps = new ZapRepository();
const runs = new ZapRunRepository();
const users = new UserRepository();

const trigger = {
  repositoryFullName: 'acme/app',
  pullRequestNumber: 42,
  pullRequestTitle: 'Add login',
  pullRequestUrl: 'https://github.com/acme/app/pull/42',
};

function ownerId(): string {
  return new Types.ObjectId().toString();
}

async function createZap(owner: string, overrides: Parameters<typeof buildZapInput>[0] = {}) {
  return zaps.create(owner, { ...buildZapInput(overrides), repositoryFullName: 'acme/app' });
}

describe('Persistence', () => {
  describe('zap runs', () => {
    it('declares a unique index on zapId + deliveryId for idempotency', async () => {
      const indexes = await ZapRunModel.collection.indexes();

      expect(indexes).toEqual(
        expect.arrayContaining([expect.objectContaining({ key: { zapId: 1, deliveryId: 1 }, unique: true })]),
      );
    });

    it('claims a delivery once per zap and lets other zaps claim the same delivery', async () => {
      const owner = ownerId();
      const [a, b] = [new Types.ObjectId().toString(), new Types.ObjectId().toString()];

      expect(await runs.claim({ zapId: a, ownerId: owner, deliveryId: 'd-1', trigger })).toEqual({ id: expect.any(String) });
      expect(await runs.claim({ zapId: a, ownerId: owner, deliveryId: 'd-1', trigger })).toBeNull();
      expect(await runs.claim({ zapId: b, ownerId: owner, deliveryId: 'd-1', trigger })).not.toBeNull();
      expect(await ZapRunModel.countDocuments()).toBe(2);
    });

    it('handles concurrent claims of the same delivery with exactly one winner', async () => {
      const params = { zapId: new Types.ObjectId().toString(), ownerId: ownerId(), deliveryId: 'd-1', trigger };

      const results = await Promise.all(Array.from({ length: 5 }, () => runs.claim(params)));

      expect(results.filter(Boolean)).toHaveLength(1);
    });

    it('rethrows persistence errors other than duplicates', async () => {
      await expect(
        runs.claim({ zapId: 'not-an-id', ownerId: ownerId(), deliveryId: 'd', trigger }),
      ).rejects.toThrow();
    });

    it('lists only the given zap runs, newest first, capped at 50', async () => {
      const owner = ownerId();
      const zapId = new Types.ObjectId();
      const other = new Types.ObjectId();
      const base = Date.UTC(2026, 9, 28);
      await ZapRunModel.insertMany([
        ...Array.from({ length: 55 }, (_, i) => ({
          zapId,
          ownerId: owner,
          deliveryId: `d-${i}`,
          status: 'succeeded',
          trigger,
          startedAt: new Date(base + i * 1000),
        })),
        { zapId: other, ownerId: owner, deliveryId: 'x', status: 'running', trigger, startedAt: new Date(base) },
      ]);

      const history = await runs.listByZap(zapId.toString());

      expect(history).toHaveLength(50);
      expect(history[0]?.deliveryId).toBe('d-54');
      expect(history.every((run) => run.zapId === zapId.toString())).toBe(true);
    });

    it('records the final state of a run', async () => {
      const zapId = new Types.ObjectId().toString();
      const ok = await runs.claim({ zapId, ownerId: ownerId(), deliveryId: 'ok', trigger });
      const bad = await runs.claim({ zapId, ownerId: ownerId(), deliveryId: 'bad', trigger });

      await runs.markSucceeded(ok!.id, { commentUrl: 'https://github.com/c/1' });
      await runs.markFailed(bad!.id, 'boom');

      const byDelivery = Object.fromEntries((await runs.listByZap(zapId)).map((run) => [run.deliveryId, run]));
      expect(byDelivery['ok']).toMatchObject({ status: 'succeeded', output: { commentUrl: 'https://github.com/c/1' } });
      expect(byDelivery['bad']).toMatchObject({ status: 'failed', error: 'boom' });
      expect(byDelivery['bad']).not.toHaveProperty('output');
    });
  });

  describe('zaps', () => {
    it('scopes reads, updates and deletes to the owner', async () => {
      const owner = ownerId();
      const stranger = ownerId();
      const zap = await createZap(owner);
      const data = { ...buildZapInput({ name: 'Hijacked' }), repositoryFullName: 'acme/app' };

      expect(await zaps.findOwned(zap.id, stranger)).toBeNull();
      expect(await zaps.updateOwned(zap.id, stranger, data)).toBeNull();
      expect(await zaps.deleteOwned(zap.id, stranger)).toBe(false);
      expect(await zaps.listByOwner(stranger)).toEqual([]);

      expect((await zaps.findOwned(zap.id, owner))?.name).toBe('Thank contributors');
    });

    it('finds only enabled zaps for the trigger and repository', async () => {
      const owner = ownerId();
      const match = await createZap(owner);
      await createZap(owner, { enabled: false });
      await createZap(owner, { repositoryId: 101 });

      const found = await zaps.findEnabledByTrigger('github.pull_request.opened', 100);

      expect(found.map((zap) => zap.id)).toEqual([match.id]);
    });

    it('enforces the catalog and required fields at the schema level', async () => {
      const unknownTrigger: Record<string, unknown> = {
        ownerId: new Types.ObjectId(),
        name: 'x',
        trigger: { key: 'github.push', config: { repositoryId: 1, repositoryFullName: 'a/b' } },
        action: { key: 'github.pull_request.comment', input: { body: 'x' } },
      };

      await expect(new ZapModel(unknownTrigger).save()).rejects.toThrow(mongoose.Error.ValidationError);
      await expect(new ZapModel({ ownerId: new Types.ObjectId() }).save()).rejects.toThrow(
        mongoose.Error.ValidationError,
      );
    });
  });

  describe('users and repositories', () => {
    it('upserts users by GitHub id and replaces their access snapshot', async () => {
      const profile = { id: 1, login: 'octocat', name: null, avatarUrl: 'a' };

      const first = await users.upsertWithAccess(profile, [100, 101]);
      const second = await users.upsertWithAccess({ ...profile, login: 'renamed' }, [100]);

      expect(second.id).toBe(first.id);
      expect(second).toMatchObject({ login: 'renamed', repositoryIds: [100] });
    });

    it('grants without duplicates and revokes across every user', async () => {
      const a = await users.upsertWithAccess({ id: 1, login: 'a', name: null, avatarUrl: 'a' }, [100]);
      const b = await users.upsertWithAccess({ id: 2, login: 'b', name: null, avatarUrl: 'b' }, [100, 101]);

      await users.grantRepositories(1, [100, 102]);
      await users.revokeRepositoriesForAll([100]);

      expect((await users.findById(a.id))?.repositoryIds).toEqual([102]);
      expect((await users.findById(b.id))?.repositoryIds).toEqual([101]);
    });

    it('keeps GitHub repository ids unique', async () => {
      await RepositoryModel.create({ githubId: 100, fullName: 'acme/app', private: false, installationId: 7 });

      await expect(
        RepositoryModel.create({ githubId: 100, fullName: 'acme/copy', private: false, installationId: 8 }),
      ).rejects.toMatchObject({ code: 11000 });
    });
  });
});
