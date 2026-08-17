import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**', '.claude/**', 'firestore.emulator.test.ts', 'storage.emulator.test.ts']
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.png','manifest-azure.webmanifest','manifest-emerald-gloss.webmanifest'],
      manifest: false
    })
  ]
});
