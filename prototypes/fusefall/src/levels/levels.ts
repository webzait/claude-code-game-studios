// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// The five levels, as data. Positions are diorama units: x -2.3..2.3, y 0..8, bin at x 0.
// Every number here (strengths, thresholds, pulse budgets, goals) is a tuning value.

import type { EdgeDef, LatchNode, LevelDef, NodeDef, PlatformDef } from '../engine/types';

const source = (id: string, x: number, y: number, strength: number): NodeDef => ({
  id,
  kind: 'source',
  pos: [x, y],
  strength,
});
const joint = (id: string, x: number, y: number): NodeDef => ({ id, kind: 'junction', pos: [x, y] });
const wire = (id: string, a: string, b: string, closed = true): EdgeDef => ({ id, a, b, closed });

/** Where a latch sits: just under the end of its platform that will drop. */
export function latchSeat(p: PlatformDef): [number, number] {
  const dir = p.low === 'right' ? 1 : -1;
  return [p.pos[0] + dir * (p.width / 2 - 0.12), p.pos[1] - 0.1];
}

/** A latch holding `platform`, seated under its low end. */
const latch = (id: string, threshold: number, platform: PlatformDef): LatchNode => ({
  id,
  kind: 'latch',
  pos: latchSeat(platform),
  threshold,
  releases: platform.id,
});

// ---- Level 1: one pulse -------------------------------------------------------------------
function level1(): LevelDef {
  const p1: PlatformDef = { id: 'P1', pos: [-0.75, 4.4], width: 1.7, low: 'right', balls: 4, dropsTo: 'bin' };
  const l1 = latch('L1', 1, p1);
  return {
    id: 1,
    name: 'Eerste vonk',
    hint: 'Tik op de gloeiende warmtebron.',
    pulses: 1,
    goal: 4,
    platforms: [p1],
    nodes: [source('A', 1.5, 2.6, 3), joint('j1', 1.5, l1.pos[1]), l1],
    edges: [wire('e1', 'A', 'j1'), wire('e2', 'j1', 'L1')],
    solution: ['A'],
  };
}

// ---- Level 2: a choice between sources ------------------------------------------------------
// A is close and only opens the top latch: the balls land on the still-locked lower platform.
// B is further and stronger: its heat reaches the lower latch first, then the upper one.
function level2(): LevelDef {
  const p1: PlatformDef = { id: 'P1', pos: [-1.05, 5.8], width: 1.7, low: 'right', balls: 5, dropsTo: 'P2' };
  const p2: PlatformDef = { id: 'P2', pos: [0.4, 3.7], width: 1.9, low: 'left', balls: 0, dropsTo: 'bin' };
  const l1 = latch('L1', 1, p1);
  const l2 = latch('L2', 1, p2);
  return {
    id: 2,
    name: 'Twee bronnen',
    hint: 'Eén puls. Welke bron bereikt beide sluitingen?',
    pulses: 1,
    goal: 5,
    platforms: [p1, p2],
    nodes: [
      source('A', -1.9, 4.5, 3),
      joint('jA', -1.9, l1.pos[1]),
      source('B', 1.9, 2.4, 4),
      joint('j1', 1.9, l2.pos[1]),
      joint('j2', 1.9, l1.pos[1]),
      l1,
      l2,
    ],
    edges: [
      wire('a1', 'A', 'jA'),
      wire('a2', 'jA', 'L1'),
      wire('b1', 'B', 'j1'),
      wire('b2', 'j1', 'L2'),
      wire('b3', 'j1', 'j2'),
      wire('b4', 'j2', 'L1'),
    ],
    solution: ['B'],
  };
}

// ---- Level 3: a mechanical chain reaction ---------------------------------------------------
// A frees three balls. They overload balance P2 (2 + 3 = 5), whose five balls overload
// balance P3 (3 + 5 = 8). B is the tempting source next to the bin: it only frees P3's three.
function level3(): LevelDef {
  const p1: PlatformDef = { id: 'P1', pos: [-1.15, 6.5], width: 1.5, low: 'right', balls: 3, dropsTo: 'P2' };
  const p2: PlatformDef = {
    id: 'P2',
    pos: [0.15, 5.0],
    width: 1.6,
    low: 'right',
    balls: 2,
    dropsTo: 'P3',
    tipsAtLoad: 5,
  };
  const p3: PlatformDef = {
    id: 'P3',
    pos: [0.95, 3.4],
    width: 1.9,
    low: 'left',
    balls: 3,
    dropsTo: 'bin',
    tipsAtLoad: 8,
  };
  const l1 = latch('L1', 1, p1);
  const l3 = latch('L3', 1, p3);
  return {
    id: 3,
    name: 'Kettingreactie',
    hint: 'Een vol weegplatform kantelt vanzelf.',
    pulses: 1,
    goal: 8,
    platforms: [p1, p2, p3],
    nodes: [
      source('A', -1.9, 5.2, 3),
      joint('jA', -1.9, l1.pos[1]),
      source('B', -1.5, 2.2, 3),
      joint('jB', -1.5, l3.pos[1]),
      l1,
      l3,
    ],
    edges: [wire('a1', 'A', 'jA'), wire('a2', 'jA', 'L1'), wire('b1', 'B', 'jB'), wire('b2', 'jB', 'L3')],
    solution: ['A'],
  };
}

// ---- Level 4: two pulses that work together -------------------------------------------------
// The lower latch needs 3 heat. A delivers 1 and tips P1, whose arm closes contact `k`.
// Only then can B reach the lower latch with the other 2.
function level4(): LevelDef {
  const p1: PlatformDef = {
    id: 'P1',
    pos: [-1.0, 6.2],
    width: 1.7,
    low: 'right',
    balls: 6,
    dropsTo: 'P2',
    closes: ['k'],
  };
  const p2: PlatformDef = { id: 'P2', pos: [0.5, 3.9], width: 2.0, low: 'left', balls: 0, dropsTo: 'bin' };
  const l1 = latch('L1', 1, p1);
  const l2 = latch('L2', 3, p2);
  return {
    id: 4,
    name: 'Samenspel',
    hint: 'De onderste sluiting vraagt warmte van twee kanten.',
    pulses: 2,
    goal: 6,
    platforms: [p1, p2],
    nodes: [
      source('A', -1.9, 4.9, 3),
      joint('jA1', -1.9, l1.pos[1]),
      joint('jA2', -1.9, l2.pos[1]),
      source('B', 1.9, 5.3, 5),
      joint('k1', 0.55, 5.3),
      joint('k2', 0.55, 4.6),
      l1,
      l2,
    ],
    edges: [
      wire('a1', 'A', 'jA1'),
      wire('a2', 'jA1', 'L1'),
      wire('a3', 'A', 'jA2'),
      wire('a4', 'jA2', 'L2'),
      wire('b1', 'B', 'k1'),
      wire('k', 'k1', 'k2', false),
      wire('b2', 'k2', 'L2'),
    ],
    solution: ['A', 'B'],
  };
}

// ---- Level 5: the big reservoir -------------------------------------------------------------
// The reservoir latch needs 3 heat: 2 from A, 1 from C. But C is dead until the chute M has
// tilted and closed contact `y`, and B's conductor to M's latch runs under the reservoir:
// the reservoir cuts it (`x`) when it tips. Freeing the reservoir first strands everything.
function level5(): LevelDef {
  const r: PlatformDef = {
    id: 'R',
    pos: [-0.7, 6.7],
    width: 2.7,
    low: 'right',
    balls: 10,
    dropsTo: 'M',
    opens: ['x'],
  };
  const s: PlatformDef = { id: 'S', pos: [1.55, 5.45], width: 1.1, low: 'left', balls: 4, dropsTo: 'M' };
  const m: PlatformDef = {
    id: 'M',
    pos: [0.6, 3.8],
    width: 2.1,
    low: 'left',
    balls: 0,
    dropsTo: 'bin',
    closes: ['y'],
  };
  const lr = latch('LR', 3, r);
  const ls = latch('LS', 1, s);
  const lm = latch('LM', 1, m);
  return {
    id: 5,
    name: 'Het grote reservoir',
    hint: 'Drie pulsen. Wat moet openstaan vóór het reservoir kantelt?',
    pulses: 3,
    goal: 12,
    platforms: [r, s, m],
    nodes: [
      source('A', lr.pos[0], 7.55, 3),
      source('B', -1.9, 4.4, 5),
      joint('n0', -1.9, 5.5),
      joint('n1', -1.1, 5.5),
      joint('n2', lm.pos[0], 5.5),
      source('C', 2.0, 3.0, 4),
      joint('y2', 2.0, ls.pos[1] - 0.45),
      joint('nY', 2.0, lr.pos[1]),
      lr,
      ls,
      lm,
    ],
    edges: [
      wire('a1', 'A', 'LR'),
      wire('b0', 'B', 'n0'),
      wire('b1', 'n0', 'n1'),
      wire('x', 'n1', 'n2'),
      wire('b2', 'n2', 'LM'),
      wire('y', 'C', 'y2', false),
      wire('c1', 'y2', 'LS'),
      wire('c2', 'y2', 'nY'),
      wire('c3', 'nY', 'LR'),
    ],
    solution: ['B', 'A', 'C'],
  };
}

/** The five levels, in play order. */
export const LEVELS: LevelDef[] = [level1(), level2(), level3(), level4(), level5()];
