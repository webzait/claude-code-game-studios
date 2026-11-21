// PROTOTYPE - NOT FOR PRODUCTION
// The five levels, as data. Each carries a recorded clear (solution): tests/solutions.test.ts
// replays it through the simulation and fails when it no longer wins.
import type { InputEvent } from './sim.ts';

export type GoalDef = { x: number; y: number; w: number; capacity: number };
export type PegDef = { x: number; y: number; r: number };
export type BarDef = { x1: number; y1: number; x2: number; y2: number; move?: { dx: number; dy: number; period: number; phase?: number } };
export type LevelDef = {
  name: string;
  hint: string;
  balls: number;
  launches: number;
  target: number;
  capacity?: number;
  trayStart?: number;
  /** Seconds between balls leaving the top; config.js's spawn_interval when absent. */
  spawnInterval?: number;
  streams: number[];
  goals: GoalDef[];
  pegs: PegDef[];
  bars: BarDef[];
  solution: InputEvent[];
};

const T = 120; // ticks per second

/** A recorded clear, written as "seconds,hold,trayX" steps: where to catch, when to move, when to let go. */
function sol(text: string): InputEvent[] {
  return text.split(' ').map((s) => {
    const [t, h, x] = s.split(',');
    return { t: Math.round(Number(t) * T), hold: h === '1', x: Number(x) };
  });
}

export const LEVELS: LevelDef[] = [
  {
    name: 'Eerste worp', hint: 'Houd vast om te vangen. Sleep onder het doel. Laat los.',
    balls: 8, launches: 3, target: 5, trayStart: 4.5,
    streams: [2.4],
    goals: [{ x: 6.4, y: 7.4, w: 2.2, capacity: 8 }],
    pegs: [], bars: [],
    solution: sol('0,1,2.4 2.0,1,6.4 2.6,0,6.4'),
  },
  {
    name: 'Twee doelen', hint: 'Het hoge doel vraagt meer balletjes.',
    balls: 16, launches: 4, target: 12,
    streams: [4.5],
    goals: [{ x: 1.9, y: 7.4, w: 2.0, capacity: 7 }, { x: 7.1, y: 10.6, w: 2.0, capacity: 7 }],
    pegs: [], bars: [],
    solution: sol('0,1,4.5 3.4,1,7.1 4.0,0,7.1 5.2,1,4.5 8.0,1,1.9 8.6,0,1.9'),
  },
  {
    name: 'De balk', hint: 'De rechte weg is dicht. Zoek de opening.',
    balls: 30, launches: 3, target: 16,
    streams: [1.6],
    goals: [{ x: 6.0, y: 10.2, w: 2.4, capacity: 18 }],
    pegs: [{ x: 3.4, y: 12.6, r: 0.32 }, { x: 2.6, y: 10.6, r: 0.32 }, { x: 8.3, y: 9.6, r: 0.32 }],
    bars: [{ x1: 4.0, y1: 7.5, x2: 5.3, y2: 7.9 }],
    solution: sol('0,1,1.6 6.2,1,7.0 7.0,0,7.0'),
  },
  {
    name: 'Schuifdeur', hint: 'Drie lanceringen. Wacht op de opening.',
    balls: 40, launches: 3, target: 26,
    streams: [0.8, 8.2], spawnInterval: 0.07,
    goals: [
      { x: 2.3, y: 7.6, w: 1.6, capacity: 8 },
      { x: 4.5, y: 11.6, w: 2.6, capacity: 16 },
      { x: 6.7, y: 8.6, w: 1.6, capacity: 8 },
    ],
    pegs: [],
    bars: [{ x1: 5.0, y1: 10.85, x2: 6.4, y2: 10.9, move: { dx: 1.2, dy: 0, period: 3.6 } }],
    solution: sol('0,1,0.8 6,1,4.5 7.6,0,4.5 8.5,1,8.2 11.5,1,6.7 12.2,0,6.7 13,1,0.8 16,1,2.3 16.8,0,2.3'),
  },
  {
    name: 'De grote ontlading', hint: 'Vul de veer. Laat alles tegelijk los.',
    balls: 80, launches: 3, target: 55,
    streams: [1.0, 8.0], spawnInterval: 0.05,
    goals: [{ x: 4.5, y: 11.8, w: 4.4, capacity: 64 }],
    pegs: [{ x: 2.1, y: 8.6, r: 0.3 }, { x: 6.9, y: 8.6, r: 0.3 }],
    bars: [],
    solution: sol('0,1,1 6,1,4.5 6.8,0,4.5 8,1,8 14,1,4.5 14.8,0,4.5'),
  },
];
export { T };
