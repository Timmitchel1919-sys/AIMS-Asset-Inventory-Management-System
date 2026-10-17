import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export const requiredFirebaseBuildVariables = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (mode === 'production') {
    const missing = requiredFirebaseBuildVariables.filter(
      (key) => !(process.env[key] || env[key])?.trim(),
    );
    if (missing.length) {
      throw new Error(
        `Production build blocked: missing Firebase environment variables: ${missing.join(', ')}`,
      );
    }
  }

  return {
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
  };
});
