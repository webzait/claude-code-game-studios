// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// Small hand-made machines for the engine tests. Positions do not matter to the engine.

import type { EdgeDef, LevelDef, NodeDef, PlatformDef } from '../src/engine/types';

export const src = (id: string, strength: number): NodeDef => ({ id, kind: 'source', pos: [0, 0], strength });
export const joint = (id: string): NodeDef => ({ id, kind: 'junction', pos: [0, 0] });
export const latch = (id: string, threshold: number, releases: string): NodeDef => ({
  id,
  kind: 'latch',
  pos: [0, 0],
  threshold,
  releases,
});
export const wire = (id: string, a: string, b: string, closed = true): EdgeDef => ({ id, a, b, closed });
export const plat = (id: string, balls: number, dropsTo: string, extra: Partial<PlatformDef> = {}): PlatformDef => ({
  id,
  pos: [0, 0],
  width: 1,
  low: 'right',
  balls,
  dropsTo,
  ...extra,
});

export function machine(parts: Partial<LevelDef>): LevelDef {
  return {
    id: 0,
    name: 'test',
    hint: '',
    pulses: 3,
    goal: 1,
    nodes: [],
    edges: [],
    platforms: [],
    solution: [],
    ...parts,
  };
}

/** A straight line: source S, joints j1..jN, then a latch L holding platform P (3 balls -> bin). */
export function line(strength: number, joints: number, threshold: number): LevelDef {
  const ids = ['S', ...Array.from({ length: joints }, (_, i) => `j${i + 1}`), 'L'];
  return machine({
    goal: 3,
    nodes: [src('S', strength), ...ids.slice(1, -1).map(joint), latch('L', threshold, 'P')],
    edges: ids.slice(1).map((id, i) => wire(`e${i + 1}`, ids[i], id)),
    platforms: [plat('P', 3, 'bin')],
  });
}
