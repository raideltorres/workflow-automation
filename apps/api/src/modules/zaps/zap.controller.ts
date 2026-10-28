import type { Request, Response } from 'express';

import type { ZapInput, ZapPatch } from '@workflow/shared';

import { currentUserId } from '../../core/middleware/require-auth.js';
import type { ZapService } from './zap.service.js';

type IdParams = { id: string };

export class ZapController {
  constructor(private readonly zaps: ZapService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    res.json(await this.zaps.list(currentUserId(req)));
  };

  get = async (req: Request<IdParams>, res: Response): Promise<void> => {
    res.json(await this.zaps.get(currentUserId(req), req.params.id));
  };

  create = async (req: Request<Record<string, string>, unknown, ZapInput>, res: Response): Promise<void> => {
    res.status(201).json(await this.zaps.create(currentUserId(req), req.body));
  };

  update = async (req: Request<IdParams, unknown, ZapPatch>, res: Response): Promise<void> => {
    res.json(await this.zaps.update(currentUserId(req), req.params.id, req.body));
  };

  remove = async (req: Request<IdParams>, res: Response): Promise<void> => {
    await this.zaps.delete(currentUserId(req), req.params.id);
    res.status(204).end();
  };

  runs = async (req: Request<IdParams>, res: Response): Promise<void> => {
    res.json(await this.zaps.listRuns(currentUserId(req), req.params.id));
  };
}
