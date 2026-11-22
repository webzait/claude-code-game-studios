// Builds the turntable into one self-contained file: npx vite build -c prototypes/flockbot-look/vite.config.ts
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  root: import.meta.dirname,
  base: './',
  publicDir: false,
  plugins: [viteSingleFile()],
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: `${import.meta.dirname}/viewer.html` } },
});
