import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    setupFiles: ['./tests/unit-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:55430',
      VITE_SUPABASE_ANON_KEY: 'unit-test-only',
    },
  },
});
