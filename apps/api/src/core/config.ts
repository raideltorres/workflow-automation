import { readFileSync } from 'node:fs';

import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WEB_URL: z.url().default('http://localhost:4200'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  MONGODB_URI: z.string().min(1),
  MONGODB_DB: z.string().min(1).default('workflow-automation'),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_SLUG: z.string().min(1),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_PRIVATE_KEY_PATH: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
});

export interface AppConfig {
  readonly env: 'development' | 'test' | 'production';
  readonly port: number;
  readonly webUrl: string;
  readonly sessionSecret: string;
  readonly mongo: { readonly uri: string; readonly dbName: string };
  readonly github: {
    readonly appId: string;
    readonly appSlug: string;
    readonly clientId: string;
    readonly clientSecret: string;
    readonly webhookSecret: string;
    readonly privateKey: string;
  };
  readonly openai: { readonly apiKey: string | undefined; readonly model: string };
}

function resolvePrivateKey(inline: string | undefined, path: string | undefined): string {
  if (inline) return inline.replace(/\\n/g, '\n');
  if (path) return readFileSync(path, 'utf8');
  throw new Error('Set GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    port: e.PORT,
    webUrl: e.WEB_URL.replace(/\/$/, ''),
    sessionSecret: e.SESSION_SECRET,
    mongo: { uri: e.MONGODB_URI, dbName: e.MONGODB_DB },
    github: {
      appId: e.GITHUB_APP_ID,
      appSlug: e.GITHUB_APP_SLUG,
      clientId: e.GITHUB_CLIENT_ID,
      clientSecret: e.GITHUB_CLIENT_SECRET,
      webhookSecret: e.GITHUB_WEBHOOK_SECRET,
      privateKey: resolvePrivateKey(e.GITHUB_PRIVATE_KEY, e.GITHUB_PRIVATE_KEY_PATH),
    },
    openai: { apiKey: e.OPENAI_API_KEY || undefined, model: e.OPENAI_MODEL },
  };
}
