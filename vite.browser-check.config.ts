import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Interactive browser smoke test against scripts/security-browser-api.mjs.
// This loopback-only build must never be deployed.
export default defineConfig({
  envDir: false,
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('http://127.0.0.1:55431'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('local-browser-check-only'),
  },
});
