// PROTOTYPE - NOT FOR PRODUCTION
import { describe, expect, it } from 'vitest';
import { isWon, step } from '../src/engine/engine';
import { at, board, first, run } from './helpers';

describe('turning', () => {
  it('turns only the commanded colour, 90 degrees clockwise, then everyone steps', () => {
    const level = board(['.. .. .. EX', 'r^ .. b^ ..', '.. .. .. ..']);
    const { state } = first(level, 'red');
    expect(at(state.robots[0])).toBe('1,1,1'); // red: north -> east, stepped east
    expect(at(state.robots[1])).toBe('2,0,0'); // blue: kept north, still stepped
  });

  it('forward moves everyone without turning', () => {
    const level = board(['.. .. .. EX', 'r^ .. b> ..', '.. .. .. ..']);
    const { state, events } = first(level, 'forward');
    expect(at(state.robots[0])).toBe('0,0,0');
    expect(at(state.robots[1])).toBe('3,1,1');
    expect(events.every((e) => !e.turned)).toBe(true);
  });

  it('goes north, east, south, west in four turns', () => {
    const level = board(['.. .. .. ..', '.. r^ .. ..', '.. .. .. ..', 'EX .. .. ..']);
    let state = level.start;
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      state = step(level.board, state, 'red').state;
      seen.push(state.robots[0].dir);
    }
    expect(seen).toEqual([1, 2, 3, 0]);
  });

  it('a blocked robot still turns', () => {
    const level = board(['r< .. EX']); // turns to north, top edge blocks it
    const { state, events } = first(level, 'red');
    expect(at(state.robots[0])).toBe('0,0,0');
    expect(events[0]).toMatchObject({ turned: true, outcome: 'blocked-wall' });
  });
});

describe('blocking', () => {
  it('walls and board edges stop a robot', () => {
    const level = board(['r> ## .. EX', 'b< .. .. ..']);
    const { state, events } = first(level, 'forward');
    expect(at(state.robots[0])).toBe('0,0,1');
    expect(at(state.robots[1])).toBe('0,1,3');
    expect(events.map((e) => e.outcome)).toEqual(['blocked-wall', 'blocked-wall']);
  });

  it('two robots wanting the same cell block each other', () => {
    const level = board(['r> .. b< EX']);
    const { state, events } = first(level, 'forward');
    expect(at(state.robots[0])).toBe('0,0,1');
    expect(at(state.robots[1])).toBe('2,0,3');
    expect(events.map((e) => e.outcome)).toEqual(['blocked-conflict', 'blocked-conflict']);
  });

  it('a robot behind a conflict is blocked too', () => {
    const level = board(['r> r> .. b< EX']);
    const { events } = first(level, 'forward');
    expect(events.map((e) => e.outcome)).toEqual(['blocked-robot', 'blocked-conflict', 'blocked-conflict']);
  });

  it('a robot cannot enter a cell whose occupant stays', () => {
    const level = board(['r> b> ## EX']);
    const { state, events } = first(level, 'forward');
    expect(at(state.robots[0])).toBe('0,0,1');
    expect(events.map((e) => e.outcome)).toEqual(['blocked-robot', 'blocked-wall']);
  });
});

describe('moving together', () => {
  it('a queue shuffles up when its leader really leaves', () => {
    const level = board(['r> b> y> .. .. EX']);
    const { state } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['1,0,1', '2,0,1', '3,0,1']);
  });

  it('a follower may take the cell of a leader that turns away', () => {
    const level = board(['.. .. .. EX', 'r> b> ## ..', '.. .. .. ..']);
    const { state } = first(level, 'blue'); // blue turns south and leaves; red follows
    expect(state.robots.map(at)).toEqual(['1,1,1', '1,2,2']);
  });

  it('a direct swap is not allowed', () => {
    const level = board(['r> b< .. EX']);
    const { state, events } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['0,0,1', '1,0,3']);
    expect(events.map((e) => e.outcome)).toEqual(['blocked-cycle', 'blocked-cycle']);
  });

  it('a closed four-robot cycle does not rotate', () => {
    const level = board(['r> bv .. EX', 'r^ b< .. ..']);
    const { state, events } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['0,0,1', '1,0,2', '0,1,0', '1,1,3']);
    expect(events.every((e) => e.outcome === 'blocked-cycle')).toBe(true);
  });

  it('a robot queued behind a cycle is blocked as well', () => {
    const level = board(['.. r> bv .. EX', 'y> r^ b< .. ..']);
    const { state } = first(level, 'forward');
    expect(at(state.robots[2])).toBe('0,1,1');
  });
});

describe('the exit', () => {
  it('collects a robot that steps onto it', () => {
    const level = board(['r> EX']);
    const { state, events } = first(level, 'forward');
    expect(state.robots[0].collected).toBe(true);
    expect(events[0].outcome).toBe('exited');
    expect(isWon(state)).toBe(true);
  });

  it('takes several robots in the same turn', () => {
    const level = board(['r> EX', '.. b^']);
    const { state } = first(level, 'forward');
    expect(state.robots.every((r) => r.collected)).toBe(true);
  });

  it('with the single-file rule switched on, two arrivals block each other', () => {
    const level = board(['r> EX', '.. b^']);
    const { state } = step(level.board, level.start, 'forward', { exitAcceptsMany: false });
    expect(state.robots.some((r) => r.collected)).toBe(false);
  });

  it('a queue walks into the exit one after another', () => {
    const level = board(['r> b> EX']);
    expect(run(level, ['forward']).robots.map(at)).toEqual(['1,0,1', 'collected']);
    expect(isWon(run(level, ['forward', 'forward']))).toBe(true);
  });

  it('collected robots no longer turn, move or block', () => {
    const level = board(['r> EX', '.. ..', '.. b^']);
    const state = run(level, ['forward', 'red', 'forward']);
    expect(state.robots[0]).toMatchObject({ collected: true, dir: 1 });
    expect(state.robots[1].collected).toBe(true);
  });
});

describe('determinism', () => {
  const level = board(['.. r^ y^ b> b> EX', '.. ## r^ ## .. y^', 'y< .. b^ r< ## ..']);
  const commands = ['forward', 'yellow', 'red', 'blue', 'forward', 'yellow'] as const;

  it('the same start and commands always give the same result', () => {
    const a = run(level, [...commands]);
    const b = run(level, [...commands]);
    expect(a).toEqual(b);
  });

  it('never changes the state it was given', () => {
    const before = JSON.stringify(level.start);
    first(level, 'red');
    expect(JSON.stringify(level.start)).toBe(before);
  });

  it('no two robots ever share a cell', () => {
    let state = level.start;
    for (const c of [...commands, ...commands, ...commands]) {
      state = step(level.board, state, c).state;
      const cells = state.robots.filter((r) => !r.collected).map((r) => `${r.x},${r.y}`);
      expect(new Set(cells).size).toBe(cells.length);
    }
  });

  it('counts one move per command', () => {
    expect(run(level, [...commands]).movesUsed).toBe(commands.length);
  });
});
