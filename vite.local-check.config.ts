import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// An offline compilation check, not a deployable production build.
export default defineConfig({
  envDir: false,
  plugins: [react()],
  build: { outDir: 'dist/local-check' },
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:55430'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('local-check-only'),
  },
});
