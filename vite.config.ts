import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appBuildId =
  process.env.GITHUB_SHA?.slice(0, 12) ||
  process.env.SOURCE_COMMIT?.slice(0, 12) ||
  Date.now().toString(36)

// Production (Timeweb) is the domain root. GitHub Pages still lives under /showdown/.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/showdown/' : '/',
  publicDir: 'public',
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
})
