import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? '/haruharu/' : './',
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'prompt',
    injectRegister: false,
    includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png'],
    manifest: {
      id: './',
      name: 'HaruHaru — Корейська щодня',
      short_name: 'HaruHaru',
      lang: 'uk',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#FFF7ED',
      theme_color: '#FFF7ED',
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: 'pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      importScripts: ['notification-events.js'],
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2,webmanifest}'],
      maximumFileSizeToCacheInBytes: 4000000,
    },
  })],
}));
