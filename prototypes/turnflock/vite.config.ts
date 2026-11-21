// PROTOTYPE - NOT FOR PRODUCTION
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 800 },
  test: { include: ['tests/**/*.test.ts'], testTimeout: 60000 },
});
