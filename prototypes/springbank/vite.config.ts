import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
// The game is built to ONE html file (three.js and the game inlined), so it opens from a
// double-click and on a phone. config.js stays beside it as a plain script: the tuning values.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: { rollupOptions: { input: 'dev.html' }, target: 'es2020', chunkSizeWarningLimit: 2000 },
});
