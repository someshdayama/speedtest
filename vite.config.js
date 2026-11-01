import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until the app says it is safe to swap
      // (idle, or the user taps reload) — never in the middle of a test.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'favicon.svg', 'fonts/inter-v20-latin.woff2'],
      manifest: {
        id:               '/',
        name:             'Velocity Speed Test',
        short_name:       'Velocity',
        description:      'Check your internet speed in one tap: download, upload, ping and jitter.',
        start_url:        '/',
        scope:            '/',
        display:          'standalone',
        orientation:      'portrait',
        theme_color:      '#000000',
        background_color: '#000000',
        categories:       ['utilities'],
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Offline shell: every navigation falls back to the cached app.
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,woff2,svg,ico}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — changes least often, cache longest.
          vendor: ['react', 'react-dom'],
        },
      },
    },
  },

  // Vitest configuration (co-located to avoid a separate vitest.config file).
  test: {
    environment: 'jsdom',
    globals:     true,
    setupFiles:  './src/setupTests.js',
  },
});
