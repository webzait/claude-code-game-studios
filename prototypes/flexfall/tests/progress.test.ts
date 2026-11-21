// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
import { describe, expect, it } from 'vitest';
import { Progress } from '../app/src/game/progress';
import { createStandInServices } from '../app/src/game/services';

describe('progress and service stand-ins', () => {
  it('keeps the best stars and unlocks the next level across sessions', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    const p = new Progress(store); p.recordWin('a', 0, 2); p.recordWin('a', 0, 1);
    const q = new Progress(store);
    expect(q.data.stars.a).toBe(2); expect(q.data.unlocked).toBe(1);
  });
  it('the stand-in services offer no ad and sell nothing', async () => {
    const s = createStandInServices();
    expect(s.ads.rewardedReady('extra_moves')).toBe(false);
    expect(await s.store.purchase('skin')).toBe(false);
  });
});
