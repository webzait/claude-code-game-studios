/**
 * Runs the economy model and writes its tables.
 * Usage: npm run economy                 -> every rule set, levels 1-40 and 1-60, tables in production/qa/evidence/economy/
 *        npm run economy -- --print      -> also print the summary
 *        npm run economy -- --runs=500   -> fewer or more runs per player (default 2000)
 * Rule sets: tools/economy/sets.json. Player types: tools/economy/players.json. Both are assumptions to edit.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PAGE, scaled, scoresFromReport, summarise, withScores, type EconLevel, type PlayerType, type RuleSet, type Summary } from './model';

const OUT = 'production/qa/evidence/economy';
/** Fixed, so the tables are the same on every run. */
const SEED = 20261122;

const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const n = (value: number): string => String(Math.round(value));
const pct = (share: number): string => `${Math.round(share * 100)}%`;
const table = (head: readonly string[], rows: readonly (readonly string[])[]): string =>
  [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i === 0 ? '---' : '--:')).join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

function firstShort(s: Summary): string {
  if (!s.firstShort) return 'nooit';
  const f = s.firstShort;
  return `level ${f.median} (${f.early}–${f.late}), ${pct(s.shortShare)} van de runs`;
}

/** The main table of one rule set over one range of levels: a row per player type. */
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
  const sets = read<RuleSet[]>('tools/economy/sets.json');
  const players = read<PlayerType[]>('tools/economy/players.json');
  const scores = scoresFromReport(readFileSync('design/level-report.md', 'utf8'));
  const shipped = read<{ id: string; name: string; par: number }[]>('data/levels.json');
  const upcoming = existsSync('data/levels-upcoming.json') ? read<{ id: string; name: string; par: number }[]>('data/levels-upcoming.json') : [];
  // Two ranges, as design/economy.md reasons with: the first two pages, and the first three.
  // Pages added later (page 4, the exit per colour) are not in these tables until that document is revisited.
  const all = [...shipped, ...upcoming];
  const ranges = [withScores(all.slice(0, 2 * PAGE), scores)];
  if (all.length > 2 * PAGE) ranges.push(withScores(all.slice(0, 3 * PAGE), scores));
  mkdirSync(OUT, { recursive: true });

  const note = `> Gegenereerd door \`npm run economy\` (${runs} runs per speler, vaste seed ${SEED}). Niet met de hand aanpassen.\n> De spelers zijn aannames (\`tools/economy/players.json\`), de bedragen staan in \`tools/economy/sets.json\`. Scenario's, geen voorspellingen.\n> "Eerste keer tekort": het level waarop voor het eerst een gewenste hulp niet te betalen is; mediaan, tussen haakjes het 10e en 90e percentiel, en het deel van de runs waarin het gebeurt.\n> "Moet bijleggen": munten die de speler van buiten moet toevoegen om alles te kopen wat hij wil.`;
  const summary: string[] = ['# Economiemodel TURNFLOCK: samenvatting', '', note, ''];
  for (const set of sets) {
    const c = set.coins;
    const out: string[] = [`# Economiemodel: ${set.name}`, '', note, '', set.about, ''];
    out.push(`Start ${c.start} · 1 ster ${c.win} · 2 sterren ${c.win + c.twoStars}${c.perSpareMove ? ` (+${c.perSpareMove} per zet over)` : ''} · 3 sterren ${c.win + c.perfect + c.perSpareMove * 2} · winst met hint betaalt ${c.hintedWinPays === 'base' ? `alleen ${c.win}` : 'naar sterren'} · Undo ${c.undoCost}${c.freeUndosPerLevel ? ` (eerste ${c.freeUndosPerLevel} per level gratis)` : ''} · hint ${c.hintCost} · +3 moves ${c.extraMovesCost}`, '');
    summary.push(`## ${set.name}`, '', out[out.length - 2], '');
    for (const levels of ranges) {
      const rows = players.map((p) => summarise(levels, p, set, runs, SEED));
      const title = `Levels 1 tot ${levels.length}`;
      out.push(`## ${title}`, '', summaryTable(players, rows), '', `### Per pagina van ${PAGE} levels`, '', pageTable(players, rows), '', '### Gemiddeld saldo na elk level (speler die nooit bijlegt)', '', balanceTable(levels, players, rows), '');
      summary.push(`### ${title}`, '', summaryTable(players, rows), '', pageTable(players, rows), '');
    }
    writeFileSync(`${OUT}/model-${set.id}.md`, out.join('\n'));
  }

  // How much the answer leans on the least certain habit: how often players really take an Undo at a price.
  const last = ranges[ranges.length - 1];
  const sens: string[] = ['# Economiemodel: gevoeligheid voor het aantal Undo\'s', '', note, '', `De gewone speler en de speler met moeite, levels 1 tot ${last.length}, met de helft, hetzelfde en het dubbele aantal Undo's.`, ''];
  for (const set of sets) {
    const rows: string[][] = [];
    for (const id of ['average', 'struggler']) {
      const player = players.find((p) => p.id === id);
      if (!player) continue;
      for (const factor of [0.5, 1, 2]) {
        const s = summarise(last, scaled(player, 'undos', factor), set, runs, SEED);
        rows.push([player.name, `×${factor}`, n(s.earned), n(s.wanted), firstShort(s), `${n(s.added.mean)} / ${n(s.added.median)} / ${n(s.added.high)}`]);
      }
    }
    sens.push(`## ${set.name}`, '', table(['Speler', "Undo's", 'Verdient', 'Wil uitgeven', 'Eerste keer tekort', 'Moet bijleggen (gem. / mediaan / 90%)'], rows), '');
  }
  writeFileSync(`${OUT}/model-sensitivity.md`, sens.join('\n'));
  writeFileSync(`${OUT}/model-summary.md`, summary.join('\n'));
  if (print) console.log(summary.join('\n'));
  console.log(`Wrote ${sets.length + 2} tables to ${OUT}/`);
}

main();
