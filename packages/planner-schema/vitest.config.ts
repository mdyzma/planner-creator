import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // The property tests generate hundreds of random planners; on a small CI machine running
    // several packages at once they can take longer than the default 5 s.
    testTimeout: 30_000,
  },
});
