import { defineConfig } from 'vite'
import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'

// Android 8 shipped with Chromium WebView 61. Android 9/10 started with
// Chromium 69/74, so Chrome 61 is the lowest supported JavaScript/CSS target.
export const ANDROID_WEBVIEW_BUILD_TARGET = 'chrome61'
export const ANDROID_WEBVIEW_LEGACY_TARGETS = [
  'Chrome >= 61',
  'ChromeAndroid >= 61',
]

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
  build: {
    target: ANDROID_WEBVIEW_BUILD_TARGET,
    cssTarget: ANDROID_WEBVIEW_BUILD_TARGET,
  },
  plugins: [
    react(),
    legacy({
      targets: ANDROID_WEBVIEW_LEGACY_TARGETS,
      // Avoid regenerator-runtime's dynamic Function fallback on older WebView.
      additionalLegacyPolyfills: ['core-js/proposals/global-this'],
    }),
  ],
  server: {
    allowedHosts: true,
  },
  preview: {
    allowedHosts: true,
  },
})
