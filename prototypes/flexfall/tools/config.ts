// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Reads config.js outside a browser, so the solver and the tests use the game's own values.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Tuning } from '../app/src/sim/types';

export function loadTuning(): Tuning {
  const src = readFileSync(fileURLToPath(new URL('../config.js', import.meta.url)), 'utf8');
  const win: { CONFIG?: Record<string, { value: number } | number> } = {};
  new Function('window', src)(win);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(win.CONFIG ?? {})) if (typeof v === 'object') out[k] = v.value;
  return out as unknown as Tuning;
}
