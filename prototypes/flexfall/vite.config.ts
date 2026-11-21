// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The source lives in app/. "npm run build" writes index.html and game.js into this folder as
// one classic script, so the built game also plays from a double-click, offline.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const here = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

/** config.js stays a plain file beside index.html: serve it in dev, leave it alone in the build. */
function configJs(): Plugin {
  return {
    name: 'flexfall-config-js',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/config.js') return next();
        res.setHeader('Content-Type', 'text/javascript');
        res.end(readFileSync(here('./config.js')));
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler: (html, ctx) => ctx.bundle
        ? html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '<script defer src="$1"></script>')
        : html,
    },
  };
}

export default defineConfig({
  root: here('./app'),
  base: './',
  publicDir: false,
  plugins: [configJs()],
  build: {
    outDir: here('.'),
    emptyOutDir: false,
    modulePreload: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: { output: { format: 'iife', entryFileNames: 'game.js', inlineDynamicImports: true } },
  },
});
