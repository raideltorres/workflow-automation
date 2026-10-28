import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.spec.ts'], restoreMocks: true },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/integration/**/*.int.spec.ts'],
          // Files share one dedicated database, so they run one at a time.
          fileParallelism: false,
          hookTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/testing/**', 'src/types/**', 'src/main.ts'],
      reporter: ['text-summary', 'text', 'html', 'lcov'],
      thresholds: { lines: 80, branches: 75 },
    },
  },
});
