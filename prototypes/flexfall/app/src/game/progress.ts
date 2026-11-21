// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// What is kept between sessions: the furthest level reached and the best stars per level.
// Storage is injected, so the rules stay testable and a native store can replace it later.

export interface KeyValueStore { getItem(key: string): string | null; setItem(key: string, value: string): void }
export interface ProgressData { unlocked: number; stars: Record<string, number> }

const KEY = 'flexfall.progress.v1';

export class Progress {
  data: ProgressData = { unlocked: 0, stars: {} };
  constructor(private readonly store: KeyValueStore | null) {
    try {
      const raw = store?.getItem(KEY);
      if (raw) { const d = JSON.parse(raw) as ProgressData; if (typeof d.unlocked === 'number' && d.stars) this.data = d; }
    } catch { /* unreadable or blocked storage: start fresh */ }
  }
  /** Record a clear of level index i with n stars; the next level unlocks. */
  recordWin(levelId: string, index: number, stars: number): void {
    this.data.stars[levelId] = Math.max(this.data.stars[levelId] ?? 0, stars);
    this.data.unlocked = Math.max(this.data.unlocked, index + 1);
    try { this.store?.setItem(KEY, JSON.stringify(this.data)); } catch { /* storage full or blocked */ }
  }
}
