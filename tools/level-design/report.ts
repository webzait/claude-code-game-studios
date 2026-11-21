/**
 * Measures every level in data/levels.json and writes design/level-report.md
 * (in Dutch, for the owner). The numbers come from measure.ts; the idea and the
 * origin of each level come from design/levels-catalog.json.
 *
 * Usage: npm run measure            -> write the report
 *        npm run measure -- --print -> also print one line per level
 * Measurements are cached per board in tools/level-design/.cache (not committed).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { parseLevel } from '../../src/levels/parse';
import { measure, type Metrics } from './measure';

interface LevelRow {
  id: string;
  name: string;
  par: number;
  witness: string[];
  grid: string[];
}
/** Design notes per level: which idea it carries, how it was made, and one sentence (Dutch). */
export interface Catalog {
  /** Idea key -> Dutch name. */
  ideas: Record<string, string>;
  /** Origin key -> Dutch name. */
  origins: Record<string, string>;
  levels: Record<string, { idea: string; origin: string; about: string }>;
  /** Ids no longer in the sequence, with the reason. */
  retired?: Record<string, string>;
}

const CACHE_DIR = new URL('./.cache/', import.meta.url);
const CACHE_FILE = new URL('metrics.json', CACHE_DIR);

/** Measure all levels, reusing cached numbers for boards (and tuning values) that did not change. */
export function measureAll(levels: readonly LevelRow[], log: (line: string) => void = () => {}): Metrics[] {
  const cache: Record<string, Metrics> = existsSync(CACHE_FILE) ? JSON.parse(readFileSync(CACHE_FILE, 'utf8')) : {};
  const settings = JSON.stringify([CONFIG.levelDesign, CONFIG.moveSlack, CONFIG.rules]);
  const next: Record<string, Metrics> = {};
  const all = levels.map((def) => {
    const key = `${def.grid.join('|')}#${def.par}#${settings}`;
    const t0 = Date.now();
    const m = cache[key] ?? measure(parseLevel(def), { par: def.par });
    next[key] = m;
    log(`${def.id}: score ${m.score} par ${m.par} states ${m.states}${cache[key] ? ' (cached)' : ` ${Date.now() - t0} ms`}`);
    return m;
  });
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(next));
  return all;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const bar = (score: number): string => '█'.repeat(Math.round(score * 2)).padEnd(20, '·');

/** The report as Markdown. */
export function renderReport(levels: readonly LevelRow[], metrics: readonly Metrics[], catalog: Catalog): string {
  const perPage = CONFIG.levelsPerPage;
  const out: string[] = [];
  out.push('# Levelrapport TURNFLOCK', '');
  out.push(
    '> Gegenereerd door `npm run measure` uit `data/levels.json` en `design/levels-catalog.json`. Niet met de hand aanpassen:',
    '> wijzig een level of de catalogus en draai het script opnieuw. Wat de kolommen betekenen staat onderaan;',
    '> hoe de score is opgebouwd en geijkt staat in `design/level-structure.md`.',
    '',
  );
  out.push(`${levels.length} levels · zetbudget = kortste oplossing + ${CONFIG.moveSlack} · alle getallen komen uit de solver-regels.`, '');
  for (let page = 0; page * perPage < levels.length; page++) {
    const from = page * perPage;
    const rows = levels.slice(from, from + perPage);
    out.push(`## Pagina ${page + 1} (level ${from + 1}–${from + rows.length})`, '');
    out.push('### Moeilijkheidscurve', '', '```text');
    rows.forEach((def, i) => {
      const m = metrics[from + i];
      out.push(`${String(from + i + 1).padStart(3)} ${bar(m.score)} ${m.score.toFixed(1).padStart(4)}  ${def.name}`);
    });
    out.push('```', '');
    out.push('### Getallen', '');
    out.push('| # | Level | Bord | Robots | Kleuren | Kortste | Aantal kortste | Draaien | Zoekruimte | Binnen budget | Dood | Fatale zet | Gedwongen | Weg van uitgang | Botsen | Volgorde vrij | Score |');
    out.push('|--:|---|:-:|--:|--:|--:|--:|--:|--:|--:|--:|--:|:-:|--:|--:|--:|--:|');
    rows.forEach((def, i) => {
      const m = metrics[from + i];
      out.push(
        `| ${from + i + 1} | ${def.name} | ${m.width}×${m.height} | ${m.robots} | ${m.colours} | ${m.par} | ${m.optimalSolutions} | ${m.turns} | ` +
          `${m.searchStates}${m.capped ? ' ⚠' : ''} | ${m.states} | ${pct(m.deadShare)} | ${pct(m.fatalShare)} | ${m.forcedPar}/${m.par} (${m.forcedBudget}) | ` +
          `${m.awaySteps} | ${m.bumpSteps} | ${pct(m.orderFreedom)} | **${m.score.toFixed(1)}** |`,
      );
    });
    out.push('', '### Idee per level', '');
    out.push('| # | Level (`id`) | Idee | In één zin | Herkomst | Opbouw van de score |');
    out.push('|--:|---|---|---|---|---|');
    rows.forEach((def, i) => {
      const m = metrics[from + i];
      const note = catalog.levels[def.id];
      const parts = Object.entries(m.scoreParts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${PART_NL[k] ?? k} ${v}`)
        .join(' · ');
      out.push(
        `| ${from + i + 1} | ${def.name} (\`${def.id}\`) | ${note ? (catalog.ideas[note.idea] ?? note.idea) : '—'} | ${note?.about ?? '—'} | ` +
          `${note ? (catalog.origins[note.origin] ?? note.origin) : '—'} | ${parts} |`,
      );
    });
    out.push('');
  }
  if (catalog.retired && Object.keys(catalog.retired).length > 0) {
    out.push('## Uit de reeks gehaald', '');
    for (const [id, reason] of Object.entries(catalog.retired)) out.push(`- \`${id}\`: ${reason}`);
    out.push('');
  }
  out.push('## Wat de kolommen betekenen', '');
  out.push(
    '- **Kortste**: lengte van de kortste oplossing (`par`). **Aantal kortste**: hoeveel verschillende commandoreeksen van die lengte winnen.',
    '- **Draaien**: kleurcommando\'s in de oplossing; de rest is VOORUIT.',
    '- **Zoekruimte**: posities die een breedte-eerst-zoektocht bezoekt tot de eerste winst. **Binnen budget**: alle posities die binnen het zetbudget bereikbaar zijn.',
    '- **Dood**: aandeel van die posities waarvandaan winnen binnen het budget niet meer kan. Bij een krap budget is dit bijna altijd dicht bij 100% (de laatste lagen zijn vrijwel allemaal verloren); het getal onderscheidt levels dus nauwelijks.',
    '- **Fatale zet**: aandeel van alle zetten vanuit een nog winbare positie dat het level onwinbaar maakt. Dit onderscheidt wel.',
    '- **Gedwongen**: commando\'s van de oplossing waarbij elk ander commando de kortste route verlaat; tussen haakjes het aantal waarbij elk ander commando het level verliest.',
    '- **Weg van uitgang** / **Botsen**: het kleinste aantal zetten, over alle kortste oplossingen, waarin een robot van de uitgang wegloopt, respectievelijk ergens tegenaan blijft staan terwijl de rest doorloopt. Groter dan 0 betekent: de oplossing vraagt een zet die verkeerd lijkt.',
    '- **Volgorde vrij**: aandeel van de herschikkingen van de oplossing dat ook wint (100% = elke volgorde werkt).',
    '- **Score**: 0–10, som van de onderdelen in de laatste kolom van de tweede tabel. ⚠ achter een getal: de zoektocht is afgekapt, het getal is een ondergrens.',
    '',
  );
  return out.join('\n');
}

const PART_NL: Record<string, string> = {
  search: 'zoekruimte',
  turns: 'draaien',
  robots: 'robots',
  narrow: 'smal',
  unforgiving: 'onvergeeflijk',
  wrongLooking: 'tegendraads',
};

function main(): void {
  const levels = JSON.parse(readFileSync('data/levels.json', 'utf8')) as LevelRow[];
  const catalog = JSON.parse(readFileSync('design/levels-catalog.json', 'utf8')) as Catalog;
  const print = process.argv.includes('--print');
  const metrics = measureAll(levels, print ? console.log : () => {});
  writeFileSync('design/level-report.md', renderReport(levels, metrics, catalog));
  console.log(`design/level-report.md written: ${levels.length} levels`);
}

if (process.argv[1]?.endsWith('report.ts')) main();
