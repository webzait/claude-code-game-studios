// npm run build        -> dist/: the folder build, for shipping (itch.io, a website)
// npm run build:single -> dist-single/index.html: one file with everything
//                         inlined, which every check opens from disk
// npm run build:single:garden -> dist-single-garden/index.html: the same game,
//                         opening in the garden theme (design/themes.md)
// Vitest reads the test block; Playwright has its own config.
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Modes that build one self-contained HTML file. */
const SINGLE_FILE_MODES = ['single', 'single-garden', 'parts', 'sounds'];
/** Output folder per mode; any other mode builds the folder version into dist/. */
const OUT_DIRS: Record<string, string> = { single: 'dist-single', 'single-garden': 'dist-single-garden', parts: 'dist-parts', sounds: 'dist-sounds' };

export default defineConfig(({ mode }) => ({
  // The theme a fresh save starts in (src/game/theme.ts). Only the garden build changes it.
  define: { __TF_DEFAULT_THEME__: JSON.stringify(mode === 'single-garden' ? 'garden' : 'robot') },
  // Relative paths, so the build works from any folder, itch.io included.
  base: './',
  // Assets are imported in the code (new URL('../assets/x.png', import.meta.url)),
  // so Vite hashes them and the single file inlines them. A public folder would
  // not be inlined, so there is none.
  publicDir: false,
  // The asset kit's 3D models are imported from code like the images are.
  assetsInclude: ['**/*.glb'],
  plugins: SINGLE_FILE_MODES.includes(mode) ? [viteSingleFile()] : [],
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
