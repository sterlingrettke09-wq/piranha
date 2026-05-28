import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['netlify/functions/**', 'src/**'],
    },
  },
})
