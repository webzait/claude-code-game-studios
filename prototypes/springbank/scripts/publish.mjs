// Copies the single-file build to index.html, the file a person opens. Run by `npm run build`.
import { readFileSync, writeFileSync } from 'node:fs';
const html = readFileSync('dist/dev.html', 'utf8');
if (!html.includes('config.js')) throw new Error('the build lost its config.js script line');
writeFileSync('index.html', html);
console.log(`index.html written: ${(html.length / 1024).toFixed(0)} KB`);
