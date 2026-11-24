/**
 * Runs the economy model and writes its tables.
 * Usage: npm run economy                 -> every tuning of data/config.json (`economy`), tables in production/qa/evidence/economy-tighten/
 *        npm run economy -- --print      -> also print the summary
 *        npm run economy -- --runs=500   -> fewer or more runs per player (default 2000)
 * Tunings: `coins`, `shop.packs` and `economy` in data/config.json (the game's own data). Player types: tools/economy/players.json (assumptions).
 * The first round's proposals (tools/economy/sets.json) and their tables (production/qa/evidence/economy/) are kept as a record and no longer run.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CONFIG } from '../../src/config';
import { DEFAULT_TUNING, TUNINGS, type Tuning } from '../../src/game/coins';
import { configuredPacks } from '../../src/game/shop';
import { PAGE, euroPerHelp, helpPerTenLevels, priceAware, scoresFromReport, summarise, withScores, type EconLevel, type PlayerType, type RuleSet, type Summary } from './model';

const OUT = 'production/qa/evidence/economy-tighten';
/** Fixed, so the tables are the same on every run. */
const SEED = 20261123;
/** The tuning whose prices the habits in players.json were assumed under. */
const BASE = 'roomy';
/** Levels after which the wallet is shown in the summary. */
const CHECKPOINTS = [5, 10, 20, 40, 60, 100];
/** The players the summary dwells on: perfect, average, often stuck. */
const MAIN = ['expert', 'average', 'struggler'];

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const n = (value: number): string => String(Math.round(value));
const one = (value: number): string => (Number.isFinite(value) ? (value >= 10 ? n(value) : value.toFixed(1).replace('.', ',')) : '∞');
const pct = (share: number): string => `${Math.round(share * 100)}%`;
const euro = (value: number): string => `€${value.toFixed(2).replace('.', ',')}`;
const table = (head: readonly string[], rows: readonly (readonly string[])[]): string =>
  [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i === 0 ? '---' : '--:')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const asSet = (t: Tuning): RuleSet => ({ id: t.id, name: t.label, about: t.about, coins: t.coins });
const name = (t: Tuning): string => `${t.label}${t.id === DEFAULT_TUNING ? ' (in het spel)' : ''}`;

function firstShort(s: Summary, brief = false): string {
  if (!s.firstShort) return 'nooit';
  const f = s.firstShort;
  return brief ? `level ${f.median} (${f.early}–${f.late})${s.shortShare < 0.995 ? `, ${pct(s.shortShare)}` : ''}` : `level ${f.median} (${f.early}–${f.late}), ${pct(s.shortShare)} van de runs`;
}

/** The main table of one tuning over one range of levels: a row per player type. */
function summaryTable(players: readonly PlayerType[], rows: readonly Summary[]): string {
  return table(
    ['Speler', 'Sterren per level', 'Verdient', 'Wil uitgeven', 'Geeft uit', 'waarvan Undo / hint / +3', 'Geweigerd (keer)', 'Eerste keer tekort', 'Saldo aan het eind', 'Moet bijleggen (gem. / mediaan / 90%)'],
    rows.map((s, i) => [
      players[i].name,
      s.stars.toFixed(2),
      n(s.earned),
      n(s.wanted),
      n(s.spentTotal),
      `${n(s.spent.undo)} / ${n(s.spent.hint)} / ${n(s.spent.extraMoves)}`,
      s.refusals.toFixed(1),
      firstShort(s),
      n(s.balance[s.balance.length - 1]),
      `${n(s.added.mean)} / ${n(s.added.median)} / ${n(s.added.high)}`,
    ]),
  );
}

/** Per page: what a level pays and what the player wants to spend on it, and the coins added on that page. */
function pageTable(players: readonly PlayerType[], rows: readonly Summary[]): string {
  const pages = rows[0].perPage.length;
  const head = ['Speler'];
  for (let p = 0; p < pages; p++) head.push(`P${p + 1} verdient/level`, `P${p + 1} wil uitgeven/level`, `P${p + 1} bijleggen`);
  return table(
    head,
    rows.map((s, i) => [players[i].name, ...s.perPage.flatMap((p, k) => [p.earned.toFixed(1), p.wanted.toFixed(1), n(s.added.perPage[k])])]),
  );
}

/** Mean wallet after every level, for the player who never adds coins. */
function balanceTable(levels: readonly EconLevel[], players: readonly PlayerType[], rows: readonly Summary[]): string {
  return table(
    ['Level', 'Naam', 'Score', ...players.map((p) => p.name)],
    levels.map((level, i) => [String(i + 1), level.name, level.score.toFixed(1), ...rows.map((s) => n(s.balance[i]))]),
  );
}

function main(): void {
  const runs = Number(process.argv.find((a) => a.startsWith('--runs='))?.slice(7) ?? 2000);
  const print = process.argv.includes('--print');
  const players = read<PlayerType[]>('tools/economy/players.json');
  const scores = scoresFromReport(readFileSync('design/level-report.md', 'utf8'));
  const all = withScores(read<{ id: string; name: string; par: number }[]>('data/levels.json'), scores);
  // Three ranges: the first page (where the rules are taught), the first two, and every level.
  const ranges = [...new Set([PAGE, 2 * PAGE, all.length].filter((count) => count <= all.length))].map((count) => all.slice(0, count));
  const base = TUNINGS.find((t) => t.id === BASE) ?? TUNINGS[0];
  const main = MAIN.map((id) => players.find((p) => p.id === id)).filter((p): p is PlayerType => p !== undefined);
  mkdirSync(OUT, { recursive: true });

  const note = `> Gegenereerd door \`npm run economy\` (${runs} runs per speler, vaste seed ${SEED}). Niet met de hand aanpassen.\n> De spelers zijn aannames (\`tools/economy/players.json\`), de bedragen zijn die van het spel (\`data/config.json\`: \`coins\`, \`shop.packs\`, \`economy\`). Scenario's, geen voorspellingen.\n> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.\n> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil. Euro's zijn voorbeeldprijzen van de testwinkel; er wordt nergens iets afgerekend.`;

  // Every tuning over every level, for every player, under the plain assumption and under price-aware habits.
  const full = new Map<string, Summary[]>();
  const aware = new Map<string, Summary[]>();
  for (const t of TUNINGS) {
    full.set(t.id, players.map((p) => summarise(all, p, asSet(t), runs, SEED)));
    aware.set(t.id, players.map((p) => summarise(all, priceAware(p, base.coins, t.coins, 1), asSet(t), runs, SEED)));
  }
  const of = (map: Map<string, Summary[]>, t: Tuning, p: PlayerType): Summary => map.get(t.id)![players.indexOf(p)];

  const summary: string[] = ['# Economiemodel TURNFLOCK, bevinding B12: de afstellingen naast elkaar', '', note, ''];
  const heads = TUNINGS.map(name);

  summary.push('## 1. De bedragen', '');
  const packs = (t: Tuning): string => configuredPacks(t.packs).map((p) => `${p.coins} voor ${euro(p.examplePriceCents / 100)}`).join('<br>');
  summary.push(
    table(['', ...heads], [
      ['Startsaldo', ...TUNINGS.map((t) => String(t.coins.start))],
      ['1 / 2 / 3 sterren', ...TUNINGS.map((t) => `${t.coins.win} / ${t.coins.win + t.coins.twoStars} / ${t.coins.win + t.coins.perfect}`)],
      ['Undo, per stap', ...TUNINGS.map((t) => String(t.coins.undoCost))],
      ['Hint', ...TUNINGS.map((t) => String(t.coins.hintCost))],
      [`+${CONFIG.extraMoves} moves`, ...TUNINGS.map((t) => String(t.coins.extraMovesCost))],
      ['Restart', ...TUNINGS.map(() => 'gratis')],
      ['Pakketten (voorbeeldprijs)', ...TUNINGS.map(packs)],
    ]),
    '',
  );

  summary.push('## 2. De verhoudingen', '', 'Hoeveel hulp één winst van drie sterren betaalt, hoeveel hulp het startsaldo en het kleinste pakket kopen.', '');
  const ratio = (a: number, b: number): string => one(a / b);
  summary.push(
    table(['', ...heads], [
      ["Undo's per 3-sterrenwinst", ...TUNINGS.map((t) => ratio(t.coins.win + t.coins.perfect, t.coins.undoCost))],
      ['3-sterrenwinsten voor één hint', ...TUNINGS.map((t) => ratio(t.coins.hintCost, t.coins.win + t.coins.perfect))],
      [`3-sterrenwinsten voor één +${CONFIG.extraMoves} moves`, ...TUNINGS.map((t) => ratio(t.coins.extraMovesCost, t.coins.win + t.coins.perfect))],
      ["Startsaldo in Undo's", ...TUNINGS.map((t) => ratio(t.coins.start, t.coins.undoCost))],
      ['Startsaldo in hints', ...TUNINGS.map((t) => ratio(t.coins.start, t.coins.hintCost))],
      ['Kleinste pakket in hints', ...TUNINGS.map((t) => ratio(configuredPacks(t.packs)[0].coins, t.coins.hintCost))],
      [`Kleinste pakket in +${CONFIG.extraMoves} moves`, ...TUNINGS.map((t) => ratio(configuredPacks(t.packs)[0].coins, t.coins.extraMovesCost))],
      ['Kleinste pakket in 3-sterrenwinsten', ...TUNINGS.map((t) => ratio(configuredPacks(t.packs)[0].coins, t.coins.win + t.coins.perfect))],
    ]),
    '',
  );

  summary.push('## 3. Wat één keer hulp in euro kost', '', 'De prijs in munten maal de prijs per munt van een pakket: eerst uit het kleinste pakket, tussen haakjes uit het grootste.', '');
  const inEuro = (t: Tuning, price: number): string => {
    const sorted = configuredPacks(t.packs);
    return `${euro(euroPerHelp(price, sorted[0]))} (${euro(euroPerHelp(price, sorted[sorted.length - 1]))})`;
  };
  summary.push(
    table(['', ...heads], [
      ['Eén Undo', ...TUNINGS.map((t) => inEuro(t, t.coins.undoCost))],
      ['Eén hint', ...TUNINGS.map((t) => inEuro(t, t.coins.hintCost))],
      [`Eén keer +${CONFIG.extraMoves} moves`, ...TUNINGS.map((t) => inEuro(t, t.coins.extraMovesCost))],
      ['Wat een 3-sterrenwinst in euro "waard" is', ...TUNINGS.map((t) => inEuro(t, t.coins.win + t.coins.perfect))],
    ]),
    '',
  );

  summary.push('## 4. Hulp per tien levels uit verdiende munten', '', `Wat een speler over ${all.length} levels gemiddeld per tien levels verdient, en hoeveel Undo's, of hints, of keren +${CONFIG.extraMoves} moves dat koopt als hij er niets anders mee doet.`, '');
  summary.push(
    table(['Speler', 'Verdient per 10 levels', ...heads.map((h) => `${h}: Undo / hint / +${CONFIG.extraMoves}`)], main.map((p) => {
      const earned = of(full, TUNINGS[0], p).toppedUp.earned;
      return [p.name, n((earned / all.length) * 10), ...TUNINGS.map((t) => {
        const e = of(full, t, p).toppedUp.earned;
        return `${one(helpPerTenLevels(e, all.length, t.coins.undoCost))} / ${one(helpPerTenLevels(e, all.length, t.coins.hintCost))} / ${one(helpPerTenLevels(e, all.length, t.coins.extraMovesCost))}`;
      })];
    })),
    '',
  );

  summary.push('## 5. Eerste keer tekort', '', `Over ${all.length} levels. "Wil hetzelfde": de speler wil de hulp van \`players.json\`, wat die ook kost. "Prijsbewust": hij neemt minder van een hulp naarmate die duurder is dan onder ${base.label} (drie keer zo duur: een derde zo vaak).`, '');
  const shortRows: string[][] = [];
  for (const p of players) {
    shortRows.push([p.name, 'wil hetzelfde', ...TUNINGS.map((t) => firstShort(of(full, t, p), true))]);
    if (p.id !== 'frugal') shortRows.push(['', 'prijsbewust', ...TUNINGS.map((t) => firstShort(of(aware, t, p), true))]);
  }
  summary.push(table(['Speler', 'Gedrag', ...heads], shortRows), '');

  summary.push('## 6. Het saldo over de levels', '', 'Gemiddeld saldo van een speler die nooit bijlegt (hulp die hij niet kan betalen, krijgt hij niet), onder "wil hetzelfde".', '');
  for (const p of main) {
    summary.push(`**${p.name}**`, '', table(['Na level', ...heads], [['start', ...TUNINGS.map((t) => String(t.coins.start))], ...CHECKPOINTS.filter((c) => c <= all.length).map((c) => [String(c), ...TUNINGS.map((t) => n(of(full, t, p).balance[c - 1]))])]), '');
  }

  summary.push('## 7. Hoeveel van de gewenste hulp een speler krijgt zonder bij te leggen', '', `Over ${all.length} levels, onder "wil hetzelfde": het deel van de catalogusprijs van alles wat hij wilde dat hij uit eigen munten kon betalen.`, '');
  summary.push(table(['Speler', ...heads], players.filter((p) => p.id !== 'frugal').map((p) => [p.name, ...TUNINGS.map((t) => { const s = of(full, t, p); return s.wanted > 0 ? pct(s.spentTotal / s.wanted) : '—'; })])), '');

  summary.push('## 8. Bijleggen om alles te kopen wat de speler wil', '', `Over ${all.length} levels: munten (gemiddeld) en wat dat kost uit het kleinste pakket. Eerst "wil hetzelfde", daaronder "prijsbewust".`, '');
  const addRows: string[][] = [];
  for (const p of players.filter((q) => q.id !== 'frugal')) {
    const cell = (map: Map<string, Summary[]>, t: Tuning): string => { const a = of(map, t, p).added.mean; return `${n(a)} (${euro(euroPerHelp(a, configuredPacks(t.packs)[0]))})`; };
    addRows.push([p.name, 'wil hetzelfde', ...TUNINGS.map((t) => cell(full, t))], ['', 'prijsbewust', ...TUNINGS.map((t) => cell(aware, t))]);
  }
  summary.push(table(['Speler', 'Gedrag', ...heads], addRows), '');

  for (const t of TUNINGS) {
    const c = t.coins;
    const out: string[] = [`# Economiemodel: ${name(t)}`, '', note, '', t.about, ''];
    out.push(`Start ${c.start} · 1 ster ${c.win} · 2 sterren ${c.win + c.twoStars} · 3 sterren ${c.win + c.perfect} · Undo ${c.undoCost}${c.freeUndosPerLevel ? ` (eerste ${c.freeUndosPerLevel} per level gratis)` : ''} · hint ${c.hintCost} · +${CONFIG.extraMoves} moves ${c.extraMovesCost} · pakketten ${packs(t).replaceAll('<br>', ', ')}`, '');
    for (const levels of ranges) {
      const rows = levels.length === all.length ? full.get(t.id)! : players.map((p) => summarise(levels, p, asSet(t), runs, SEED));
      out.push(`## Levels 1 tot ${levels.length}`, '', summaryTable(players, rows), '', `### Per pagina van ${PAGE} levels`, '', pageTable(players, rows), '');
      if (levels.length === all.length) out.push('### Gemiddeld saldo na elk level (speler die nooit bijlegt)', '', balanceTable(levels, players, rows), '');
    }
    writeFileSync(`${OUT}/model-${t.id}.md`, out.join('\n'));
  }

  // How much the answer leans on the least certain habit: how much help players still take when it costs more.
  const sens: string[] = ['# Economiemodel: gevoeligheid voor prijsbewust gedrag', '', note, '', `De gewone speler en de speler met moeite, levels 1 tot ${all.length}. Elasticiteit 0: wil dezelfde hulp, wat die ook kost. 1: wil evenveel munten uitgeven per soort hulp als onder ${base.label}, en krijgt dus minder hulp naarmate die duurder is. 0,5 zit ertussen.`, ''];
  for (const t of TUNINGS) {
    const rows: string[][] = [];
    for (const p of main.filter((q) => q.id !== 'expert')) {
      for (const elasticity of [0, 0.5, 1]) {
        const q = priceAware(p, base.coins, t.coins, elasticity);
        const s = elasticity === 0 ? of(full, t, p) : elasticity === 1 ? of(aware, t, p) : summarise(all, q, asSet(t), runs, SEED);
        const mid = all[Math.floor(all.length / 2)].score;
        const want = (range: readonly [number, number]): string => (range[0] + ((range[1] - range[0]) * mid) / 10).toFixed(1);
        rows.push([p.name, String(elasticity).replace('.', ','), `${want(q.undos)} / ${want(q.hints)}`, n(s.earned), n(s.wanted), firstShort(s), `${n(s.added.mean)} (${euro(euroPerHelp(s.added.mean, configuredPacks(t.packs)[0]))})`]);
      }
    }
    sens.push(`## ${name(t)}`, '', table(['Speler', 'Elasticiteit', "Wil Undo's / hints op een middelzwaar level", 'Verdient', 'Wil uitgeven', 'Eerste keer tekort', 'Moet bijleggen (gem., en uit het kleinste pakket)'], rows), '');
  }
  writeFileSync(`${OUT}/model-sensitivity.md`, sens.join('\n'));
  writeFileSync(`${OUT}/model-summary.md`, summary.join('\n'));
  if (print) console.log(summary.join('\n'));
  console.log(`Wrote ${TUNINGS.length + 2} tables to ${OUT}/`);
}

main();
