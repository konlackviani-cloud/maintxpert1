import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icone.svg'],
      manifest: {
        name: 'MaintXpert — diagnostic des défaillances',
        short_name: 'MaintXpert',
        description:
          'Diagnostic guidé des défaillances industrielles (modèle SDCR) — service maintenance, usine Terrain Court.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0F172A',
        theme_color: '#14539A',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: '/icones/icone-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icones/icone-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icones/icone-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // La coquille applicative est pré-cachée : l'application démarre sans réseau.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // L'API n'est JAMAIS servie depuis le cache réseau : la consultation
            // hors ligne passe par IndexedDB, pas par le service worker.
            // NetworkOnly évite de renvoyer des données périmées sans le dire.
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // Photos : lecture opportuniste, elles ne bloquent jamais un diagnostic.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'photos-maintxpert',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Permet de tester le comportement hors ligne sans build de production.
        enabled: true,
        type: 'module',
      },
    }),
  ],

  // Le paquet partagé est consommé en source : Vite doit le transpiler, pas le pré-bundler.
  optimizeDeps: { exclude: ['@maintxpert/shared'] },

  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
