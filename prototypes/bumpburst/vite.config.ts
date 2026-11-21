// PROTOTYPE - NOT FOR PRODUCTION
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 inlines everything into one dist/index.html that opens by double-click.
export default defineConfig({
  base: './',
  plugins: process.env.SINGLE ? [viteSingleFile()] : [],
  build: { target: 'es2020', chunkSizeWarningLimit: 1200 },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
