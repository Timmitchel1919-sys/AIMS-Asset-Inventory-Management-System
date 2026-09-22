import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    exclude: ['tests/e2e/**', '**/node_modules/**', 'dist/**', '.claude/**', 'functions/**', 'firestore.emulator.test.ts', 'storage.emulator.test.ts']
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' left the generated service worker waiting indefinitely for
      // an explicit skipWaiting() call that nothing in the app ever sent, so
      // every deploy after the first was invisible to already-open sessions
      // until a full browser restart. 'autoUpdate' has workbox call
      // self.skipWaiting() + clientsClaim() itself, so a new deploy takes
      // over on the next load without user action.
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png','manifest-azure.webmanifest','manifest-emerald-gloss.webmanifest'],
      manifest: false
    })
  ]
});
