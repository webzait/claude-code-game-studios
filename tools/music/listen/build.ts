// npm run music:listen -> production/qa/evidence/music/luisterpagina.html: one self-contained page
// on which the three variants can be heard and compared, made from the game's own synth and scores.
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const out = 'production/qa/evidence/music/luisterpagina.html';
const result = await build({ entryPoints: ['tools/music/listen/main.ts'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false });
const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
const page = readFileSync('tools/music/listen/page.html', 'utf8').replace('/*SCRIPT*/', () => script);
mkdirSync('production/qa/evidence/music', { recursive: true });
writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024).toFixed(1)} kB`);
