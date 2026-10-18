import { readFileSync } from 'node:fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

/**
 * Politique de sécurité de contenu (CSP) injectée au build : elle reste active quel que soit
 * l'hébergeur statique (le fichier public/_headers la double pour Netlify / Cloudflare Pages).
 * Aucun script ni style externe : tout est servi par l'application elle-même.
 */
const cspPlugin = (): Plugin => ({
  name: 'arpentis-csp',
  apply: 'build',
  transformIndexHtml(html) {
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
    return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`);
  },
});

export default defineConfig(({ mode }) => {
  // Build pour le conteneur Android (Capacitor) : ressources embarquées dans l'APK, donc ni service worker ni CSP meta
  const isAndroid = mode === 'android';
  return {
  // Chemins relatifs : l'application se déploie à la racine d'un domaine comme dans un sous-dossier.
  // Pour imposer une base absolue : BASE_PATH=/arpentis/ npm run build
  base: process.env.BASE_PATH ?? './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(isAndroid ? [] : [cspPlugin()]),
    VitePWA({
      disable: isAndroid,
      registerType: 'prompt', // jamais de rechargement imposé en plein relevé : l'utilisateur choisit
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Arpentis — Calcul de superficies',
        short_name: 'Arpentis',
        description: 'Calcul précis de superficies et métré de parcelles, utilisable hors ligne.',
        lang: 'fr',
        dir: 'ltr',
        categories: ['utilities', 'productivity', 'navigation'],
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'any',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
};
});
