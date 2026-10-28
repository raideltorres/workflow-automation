import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadConfig } from './config.js';

vi.mock('node:fs', () => ({ readFileSync: vi.fn() }));

const KEY = '-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----';

function env(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    SESSION_SECRET: 's'.repeat(32),
    MONGODB_URI: 'mongodb://localhost:27017',
    GITHUB_APP_ID: '1',
    GITHUB_APP_SLUG: 'app',
    GITHUB_CLIENT_ID: 'client',
    GITHUB_CLIENT_SECRET: 'secret',
    GITHUB_WEBHOOK_SECRET: 'hook',
    GITHUB_PRIVATE_KEY: KEY,
    ...overrides,
  };
}

describe('loadConfig', () => {
  beforeEach(() => {
    vi.mocked(readFileSync).mockReset();
  });

  it('applies defaults and strips a trailing slash from the web URL', () => {
    const config = loadConfig(env({ WEB_URL: 'http://localhost:4200/' }));

    expect(config).toMatchObject({
      env: 'development',
      port: 3000,
      webUrl: 'http://localhost:4200',
      mongo: { dbName: 'workflow-automation' },
      openai: { apiKey: undefined, model: 'gpt-4o-mini' },
    });
  });

  it('lists every missing or invalid variable in one error', () => {
    expect(() => loadConfig({ SESSION_SECRET: 'short' })).toThrow(
      /SESSION_SECRET: SESSION_SECRET must be at least 32 characters[\s\S]*MONGODB_URI[\s\S]*GITHUB_WEBHOOK_SECRET/,
    );
  });

  it('rejects an unknown NODE_ENV and a non-numeric PORT', () => {
    expect(() => loadConfig(env({ NODE_ENV: 'staging' }))).toThrow(/NODE_ENV/);
    expect(() => loadConfig(env({ PORT: 'abc' }))).toThrow(/PORT/);
  });

  it('expands escaped newlines in an inline private key', () => {
    const config = loadConfig(env({ GITHUB_PRIVATE_KEY: KEY.replaceAll('\n', '\\n') }));

    expect(config.github.privateKey).toBe(KEY);
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it('reads the private key from a file when no inline key is set', () => {
    vi.mocked(readFileSync).mockReturnValue(KEY);

    const config = loadConfig(env({ GITHUB_PRIVATE_KEY: undefined, GITHUB_PRIVATE_KEY_PATH: './key.pem' }));

    expect(readFileSync).toHaveBeenCalledWith('./key.pem', 'utf8');
    expect(config.github.privateKey).toBe(KEY);
  });

  it('fails fast when no private key source is configured', () => {
    expect(() => loadConfig(env({ GITHUB_PRIVATE_KEY: undefined }))).toThrow(
      'Set GITHUB_PRIVATE_KEY or GITHUB_PRIVATE_KEY_PATH',
    );
  });
});
