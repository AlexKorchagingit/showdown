import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  define: {
    __APP_BUILD_ID__: JSON.stringify('unit-test-build'),
  },
  test: {
    setupFiles: ['./tests/unit-setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:55430',
      VITE_SUPABASE_ANON_KEY: 'unit-test-only',
    },
  },
});
