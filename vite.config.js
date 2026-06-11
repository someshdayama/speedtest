import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'vite.svg'],
      manifest: {
        name:             'Velocity Speed Test',
        short_name:       'Velocity',
        description:      'Accurate, real-time internet speed test.',
        theme_color:      '#0c0c0e',
        background_color: '#0c0c0e',
        display:          'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
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
