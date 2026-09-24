import { defineConfig } from 'vitest/config';

/** Renders real PDFs in Chrome from the built web app (`pnpm --filter @planner/web build`). */
export default defineConfig({
  test: {
    include: ['test/**/*.e2e.test.ts'],
    testTimeout: 180_000,
    hookTimeout: 60_000,
  },
});
