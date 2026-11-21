// PROTOTYPE - NOT FOR PRODUCTION
// Design aid: rasterises an SVG from tools/trace.ts. Run with NODE_PATH=$(npm root -g).
const { chromium } = require('playwright');
const { readFileSync } = require('node:fs');
(async () => {
  const [, , svg, png] = process.argv;
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent(`<body style="margin:0;background:#fff">${readFileSync(svg, 'utf8')}</body>`);
  await (await p.$('svg')).screenshot({ path: png });
  await b.close();
})();
