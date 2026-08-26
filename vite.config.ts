import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Production (Timeweb) is the domain root. GitHub Pages still lives under /showdown/.
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/showdown/' : '/',
  publicDir: 'public',
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
})
