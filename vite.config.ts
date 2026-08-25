import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Site is served from the domain root (https://showdown-br.ru).
export default defineConfig({
  base: '/',
  publicDir: 'public',
  plugins: [react()],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
})
