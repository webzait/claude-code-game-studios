// npm run build        -> dist/: the folder build, for shipping (itch.io, a website)
// npm run build:single -> dist-single/index.html: one file with everything
//                         inlined, which every check opens from disk
// Vitest reads the test block; Playwright has its own config.
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { inlineLinkIconsPlugin } from './tools/single-file/inlineLinkIcons';

/** Modes that build one self-contained HTML file. */
const SINGLE_FILE_MODES = ['single', 'parts', 'sounds'];
/** Output folder per mode; any other mode builds the folder version into dist/. */
const OUT_DIRS: Record<string, string> = { single: 'dist-single', parts: 'dist-parts', sounds: 'dist-sounds' };

export default defineConfig(({ mode }) => ({
  // Relative paths, so the build works from any folder, itch.io included.
  base: './',
  // Assets are imported in the code (new URL('../assets/x.png', import.meta.url)),
  // so Vite hashes them and the single file inlines them. A public folder would
  // not be inlined, so there is none.
  publicDir: false,
  // The asset kit's 3D models are imported from code like the images are.
  assetsInclude: ['**/*.glb'],
  // The single file also carries its tab and home-screen icon (tools/single-file/inlineLinkIcons.ts).
  plugins: mode === 'single' ? [viteSingleFile(), inlineLinkIconsPlugin()] : SINGLE_FILE_MODES.includes(mode) ? [viteSingleFile()] : [],
  // The game's page only: other pages in the project (one-shots in prototypes/)
  // are not scanned for packages.
  optimizeDeps: { entries: ['index.html'] },
  build: {
    outDir: OUT_DIRS[mode] ?? 'dist',
    emptyOutDir: true,
    // npm run build:parts -> dist-parts/parts.html: every game element on its own, for review.
    ...(mode === 'parts' ? { rollupOptions: { input: 'parts.html' } } : {}),
    // npm run build:sounds -> dist-sounds/sounds.html: every button sound of every set, to listen to.
    ...(mode === 'sounds' ? { rollupOptions: { input: 'sounds.html' } } : {}),
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 60000,
  },
}));
