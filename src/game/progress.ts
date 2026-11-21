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
