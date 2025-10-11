import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'frontend',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./public/js/__tests__/setup.js'],
    include: ['public/js/__tests__/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['public/js/**/*.js'],
      exclude: [
        'public/js/__tests__/**',
        'public/app.js', // Integration file, tested separately
        'public/custom-tooltip.js', // Legacy file
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
