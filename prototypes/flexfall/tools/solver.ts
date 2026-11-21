// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// Exhaustive search over tap sequences with the game's own simulation. A level is solvable
// when some sequence within its tap limit reaches the target; the shortest one is its proof.
import { Session } from '../app/src/game/session';
import type { LevelData, Tuning } from '../app/src/sim/types';

export interface Outcome { taps: number[]; collected: number; won: boolean }

/** Every tap sequence up to the level's limit, shortest first, with what each one catches. */
export function searchLevel(level: LevelData, tuning: Tuning, maxDepth = level.moves): Outcome[] {
  const out: Outcome[] = [];
  let frontier: number[][] = [[]];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: number[][] = [];
    for (const seq of frontier) for (let a = 0; a < level.anchors.length; a++) {
      const taps = [...seq, a];
      const s = run(level, tuning, taps);
      out.push({ taps, collected: s.collected, won: s.phase === 'won' });
      if (s.phase !== 'won') next.push(taps); // a won attempt has ended: nothing follows it
    }
    frontier = next;
  }
  return out;
}

function run(level: LevelData, tuning: Tuning, taps: number[]): Session {
  const s = new Session({ ...level, moves: Math.max(level.moves, taps.length) }, tuning);
  for (const a of taps) {
    if (!s.tap(a)) break;
    for (let i = 0; i < 3600 && s.phase === 'moving'; i++) s.tick();
  }
  return s;
}

/** The shortest winning sequence, or null: the level cannot be cleared within its taps. */
export function shortestClear(level: LevelData, tuning: Tuning): number[] | null {
  const wins = searchLevel(level, tuning).filter(o => o.won);
  return wins.length ? wins[0].taps : null;
}
