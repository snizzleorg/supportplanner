import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'frontend',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./public-legacy/js/__tests__/setup.js'],
    include: ['public-legacy/js/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['public-legacy/js/**/*.js'],
      exclude: [
        'public-legacy/js/__tests__/**',
        'public-legacy/app.js', // Integration file, tested separately
        'public-legacy/custom-tooltip.js', // Legacy file
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
