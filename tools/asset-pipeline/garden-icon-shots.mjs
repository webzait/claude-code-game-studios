// Evidence for the garden app icon (design/themes/garden-icon.md): screenshots of the parts sheet's
// garden icon cards and a sheet of both themes' icons at 180, 64, 32 and 16 px. Run after
// `npx vite build --mode parts`:
//   node tools/asset-pipeline/garden-icon-shots.mjs
// Writes to production/qa/evidence/garden-icon/.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = resolve('production/qa/evidence/garden-icon');
// A browser other than Playwright's own (e.g. /opt/pw-browsers/chromium) through PAGE_SHOT_BROWSER.
const browser = await chromium.launch({ executablePath: process.env.PAGE_SHOT_BROWSER || undefined });
for (const [scale, suffix] of [[2, ''], [1, '-1x']]) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: scale });
  page.setDefaultTimeout(300000);
  await page.goto('file://' + resolve('dist-parts/parts.html'), { timeout: 300000 });
  await page.waitForTimeout(1000);
  for (const id of ['garden-icon', 'garden-icon-in-use']) {
    await page.locator(`#${id}`).screenshot({ path: `${OUT}/${id}${suffix}.png` });
  }
  await page.close();
}
await browser.close();
console.log(`written to ${OUT}`);
