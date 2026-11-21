// PROTOTYPE - NOT FOR PRODUCTION
/**
 * What survives between sessions. One small interface so later meta-progression
 * (skins, daily challenges, currencies) has a single place to grow.
 */
export interface Progress {
  /** Highest level id cleared so far (0 = none). */
  cleared: number;
  muted: boolean;
}

const KEY = 'bumpburst.progress.v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { cleared: Number(p.cleared) || 0, muted: !!p.muted };
    }
  } catch {
    /* storage unavailable (private mode): play without saving */
  }
  return { cleared: 0, muted: false };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
