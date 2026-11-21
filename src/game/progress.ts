import { CONFIG } from '../config';

/** Best move count per solved level id. */
export type Best = Readonly<Record<string, number>>;

/** A level is open when it is the first, or the one before it is solved. */
export function isUnlocked(levelIds: readonly string[], best: Best, index: number, unlockAll = false): boolean {
  if (unlockAll || index === 0) return true;
  return best[levelIds[index - 1]] !== undefined;
}

/** Where PLAY resumes: the first unsolved level, or the last level when all are solved. */
export function resumeIndex(levelIds: readonly string[], best: Best): number {
  const open = levelIds.findIndex((id) => best[id] === undefined);
  return open < 0 ? levelIds.length - 1 : open;
}

/** Stars for a win. Using extra moves caps the result at one star. */
export function starsFor(moves: number, par: number, usedBackup: boolean): 1 | 2 | 3 {
  if (usedBackup) return 1;
  const over = moves - par;
  return over <= CONFIG.stars.three ? 3 : over <= CONFIG.stars.two ? 2 : 1;
}

/** How many levels are solved. */
export function solvedCount(levelIds: readonly string[], best: Best): number {
  return levelIds.filter((id) => best[id] !== undefined).length;
}

/** Stars a stored best is worth; 0 when unsolved. A win carried over from the first prototype has no move count (0) and shows one star. */
export function starsOfBest(moves: number | undefined, par: number): 0 | 1 | 2 | 3 {
  if (moves === undefined) return 0;
  return moves === 0 ? 1 : starsFor(moves, par, false);
}

/** What the main button of the level selection does, and for which level. */
export interface MainAction {
  /** Position of the level it opens. */
  readonly index: number;
  /** `play` the next unsolved level, `improve` the first one without three stars, or start `again` at level 1. */
  readonly kind: 'play' | 'improve' | 'again';
}

/**
 * Where the main button points: the first unsolved level; with everything
 * solved the first level without three stars; with nothing left to improve,
 * level 1 again.
 */
export function mainAction(levels: readonly { readonly id: string; readonly par: number }[], best: Best): MainAction {
  const open = levels.findIndex((l) => best[l.id] === undefined);
  if (open >= 0) return { index: open, kind: 'play' };
  const improve = levels.findIndex((l) => starsOfBest(best[l.id], l.par) < 3);
  return improve >= 0 ? { index: improve, kind: 'improve' } : { index: 0, kind: 'again' };
}
