import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['firestore.emulator.test.ts', 'storage.emulator.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 15_000,
  },
})
