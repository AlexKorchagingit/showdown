import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const appBuild = process.env.GITHUB_SHA?.slice(0, 7) || new Date().toISOString()

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/showdown/' : '/',
  define: {
    'import.meta.env.VITE_APP_BUILD': JSON.stringify(appBuild),
  },
  plugins: [
    react(),
    {
      name: 'showdown-build-meta',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `    <meta name="showdown-build" content="${appBuild}" />\n  </head>`,
        )
      },
    },
  ],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
})
