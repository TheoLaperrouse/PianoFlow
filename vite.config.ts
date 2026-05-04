import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Le `base` est piloté par PIANOFLOW_BASE pour pouvoir le surcharger en CI.
// Par défaut : `/PianoFlow/` afin que le build fonctionne directement sur
// GitHub Pages (https://<user>.github.io/PianoFlow/). Les URLs Pages sont
// sensibles à la casse, donc le segment doit matcher exactement le nom du
// dépôt (`PianoFlow`).
export default defineConfig(() => ({
  base: process.env.PIANOFLOW_BASE ?? '/PianoFlow/',
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icons/apple-touch-icon.png'],
      workbox: {
        // Le bundle TF.js + sample piano dépassent largement 2 Mo.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // On ne pré-cache pas les samples (CDN tiers) ni les modèles (gros).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Mais on les cache à la volée la 1re fois pour pouvoir jouer hors ligne.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tonejs\.github\.io\/audio\/salamander\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'salamander-samples',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/models/basic-pitch/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'basic-pitch-model',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.includes('/library/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pianoflow-library' },
          },
        ],
      },
      manifest: {
        name: 'PianoFlow',
        short_name: 'PianoFlow',
        description: 'Apprenez le piano sans solfège — les notes descendent vers le clavier.',
        theme_color: '#7c3aed',
        background_color: '#0f0d1a',
        display: 'standalone',
        orientation: 'any',
        lang: 'fr',
        categories: ['music', 'education', 'entertainment'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
}));
