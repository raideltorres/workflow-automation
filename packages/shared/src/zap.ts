import { z } from 'zod';

import { ACTION_KEYS, TRIGGER_KEYS, findTrigger } from './catalog.js';
import { findUnknownTemplateTokens } from './template.js';

export const ZAP_NAME_MAX_LENGTH = 100;
export const COMMENT_BODY_MAX_LENGTH = 65_536;

export const ZapTriggerSchema = z.object({
  key: z.enum(TRIGGER_KEYS),
  config: z.object({
    repositoryId: z.number().int().positive(),
  }),
});
export type ZapTrigger = z.infer<typeof ZapTriggerSchema>;

export const ZapActionSchema = z.object({
  key: z.enum(ACTION_KEYS),
  input: z.object({
    body: z.string().trim().min(1, 'Comment is required').max(COMMENT_BODY_MAX_LENGTH),
  }),
});
export type ZapAction = z.infer<typeof ZapActionSchema>;

const ZapFieldsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(ZAP_NAME_MAX_LENGTH),
  enabled: z.boolean(),
  trigger: ZapTriggerSchema,
  action: ZapActionSchema,
});

export const ZapInputSchema = ZapFieldsSchema.superRefine((zap, ctx) => {
  const allowed = findTrigger(zap.trigger.key).outputFields.map((field) => field.key);
  const unknown = findUnknownTemplateTokens(zap.action.input.body, allowed);
  if (unknown.length > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['action', 'input', 'body'],
      message: `Unknown fields: ${unknown.join(', ')}`,
    });
  }
});
export type ZapInput = z.infer<typeof ZapInputSchema>;

export const ZapPatchSchema = ZapFieldsSchema.partial();
export type ZapPatch = z.infer<typeof ZapPatchSchema>;

export interface Zap {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: ZapTrigger & { readonly config: { readonly repositoryFullName: string } };
  readonly action: ZapAction;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const ZAP_RUN_STATUSES = ['running', 'succeeded', 'failed'] as const;
export type ZapRunStatus = (typeof ZAP_RUN_STATUSES)[number];

export interface ZapRun {
  readonly id: string;
  readonly zapId: string;
  readonly deliveryId: string;
  readonly status: ZapRunStatus;
  readonly trigger: {
    readonly repositoryFullName: string;
    readonly pullRequestNumber: number;
    readonly pullRequestTitle: string;
    readonly pullRequestUrl: string;
  };
  readonly output?: { readonly commentUrl: string };
  readonly error?: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
}
