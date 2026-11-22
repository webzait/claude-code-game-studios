// The model behind the economy note in design/shop.md: what three kinds of
// player earn and want to spend over the levels, where the wallet runs dry and
// how many coins they would be short. Run: node tools/economy/shop-sim.mjs
// The player profiles are assumptions, not measurements; change them here.
import { readFileSync } from 'node:fs';

const levels = JSON.parse(readFileSync('data/levels.json', 'utf8'));
const config = JSON.parse(readFileSync('data/config.json', 'utf8'));
const c = config.coins;
const perfect = c.win + config.moveSlack * c.perSpareMove + c.perfect;
const oneOver = c.win + (config.moveSlack - 1) * c.perSpareMove;
const base = c.win;
// Difficulty by the length of the shortest solution: easy (up to 6), middle (7 or 8), hard (9 and more).
const tier = (par) => (par <= 6 ? 0 : par <= 8 ? 1 : 2);
const mix = (perfect + oneOver + base) / 3;
const profiles = {
  strong: { earn: [perfect, perfect, perfect], spend: [0, 0, 0] },
  average: {
    earn: [mix, mix * 0.5 + base * 0.5, base * 0.75 + oneOver * 0.25],
    spend: [1 * c.undoCost, 3 * c.undoCost + 0.5 * c.hintCost, 4 * c.undoCost + 1 * c.hintCost + 0.25 * c.extraMovesCost],
  },
  weak: {
    earn: [base, base, base],
    spend: [2 * c.undoCost, 4 * c.undoCost + 1 * c.hintCost, 5 * c.undoCost + 2 * c.hintCost + 0.5 * c.extraMovesCost],
  },
};
console.log(`levels per tier (easy, middle, hard): ${[0, 1, 2].map((t) => levels.filter((l) => tier(l.par) === t).length).join(', ')}`);
for (const [name, p] of Object.entries(profiles)) {
  let balance = c.start;
  let short = 0;
  let dry = 0;
  let earned = 0;
  let wanted = 0;
  const marks = [];
  levels.forEach((level, i) => {
    const t = tier(level.par);
    wanted += p.spend[t];
    balance -= p.spend[t];
    if (balance < 0) {
      dry ||= i + 1;
      short -= balance;
      balance = 0;
    }
    balance += p.earn[t];
    earned += p.earn[t];
    if ((i + 1) % 10 === 0) marks.push(`after ${i + 1}: balance ${Math.round(balance)}, short ${Math.round(short)}`);
  });
  console.log(`${name}: earns ${Math.round(earned)}, wants to spend ${Math.round(wanted)}, runs dry at level ${dry || 'never'}, short ${Math.round(short)} in total`);
  for (const m of marks) console.log(`  ${m}`);
}
