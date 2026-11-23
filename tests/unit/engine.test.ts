import { describe, expect, it } from 'vitest';
import { gatesOpen, isWon, step } from '../../src/engine/engine';
import { at, board, first, run } from './helpers';
import { solve } from '../../src/solver/bfs';

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

describe('turn tile', () => {
  it('turns a robot that steps onto it a quarter clockwise, whatever its colour', () => {
    const level = board(['r> @@ ..', 'b> @@ EX', '.. .. ..']);
    const { state, events } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['1,0,2', '1,1,2']);
    expect(events.map((e) => e.tileTurned)).toEqual([true, true]);
    // The event keeps the heading the robot moved with; the tile's turn comes on top.
    expect(events[0]).toMatchObject({ dir: 1, outcome: 'moved', turned: false });
  });

  it('adds its turn to the colour turn of the same move', () => {
    const level = board(['.. @@ ..', '.. r< ..', '.. .. EX']);
    // RED turns the robot north and it steps onto the tile, which turns it east.
    expect(at(first(level, 'red').state.robots[0])).toBe('1,0,1');
  });

  it('does not turn a robot again while it stays on the tile', () => {
    const level = board(['r> @@ ##', '.. .. EX']);
    // Arrives facing south; the next FORWARD walks off the tile: no second turn, and none for standing still.
    const afterOne = run(level, ['forward']);
    expect(at(afterOne.robots[0])).toBe('1,0,2');
    const blocked = board(['r> @@', '.. ##', '.. EX']);
    const stuck = run(blocked, ['forward', 'forward', 'forward']);
    expect(at(stuck.robots[0])).toBe('1,0,2');
    expect(step(blocked.board, stuck, 'forward').events[0]).toMatchObject({ outcome: 'blocked-wall', tileTurned: false });
  });

  it('does not turn a robot that was blocked from stepping onto it', () => {
    const level = board(['r> @@ b<', '.. .. EX']);
    // Both want the tile: a conflict, nobody moves, nobody turns.
    const { state, events } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['0,0,1', '2,0,3']);
    expect(events.every((e) => !e.tileTurned)).toBe(true);
  });

  it('lets a robot be won without a colour command: the board does the turning', () => {
    const level = board(['r> .. @@ ..', '.. .. .. ..', '.. .. EX ..']);
    expect(isWon(run(level, ['forward', 'forward', 'forward', 'forward']))).toBe(true);
    expect(solve(level.board, level.start, 8).solution).toEqual(['forward', 'forward', 'forward', 'forward']);
  });

  it('leaves a board without turn tiles exactly as it was', () => {
    expect(board(['r> .. EX']).board.turnTiles).toBeUndefined();
    expect(first(board(['r> .. EX']), 'forward').events[0].tileTurned).toBe(false);
  });
});

describe('exit for one colour', () => {
  it('collects only robots of its colour; to the others it is plain floor', () => {
    const level = board(['r> ER .. b< EB']);
    // Red steps into its exit and is collected; blue steps onto plain floor next to it.
    const one = first(level, 'forward');
    expect(one.state.robots.map(at)).toEqual(['collected', '2,0,3']);
    expect(one.events.map((e) => e.outcome)).toEqual(['exited', 'moved']);
    // Blue walks across the red exit without being collected, and stands on it.
    const two = step(level.board, one.state, 'forward').state;
    expect(at(two.robots[1])).toBe('1,0,3');
    expect(isWon(two)).toBe(false);
  });

  it('wins only when every robot has left through an exit that takes it', () => {
    const level = board(['ER r< b> EB']);
    expect(isWon(run(level, ['forward']))).toBe(true);
    expect(solve(level.board, level.start, 6).solution).toEqual(['forward']);
  });

  it('lets several robots of its colour enter together, but not a robot of another colour with them', () => {
    const level = board(['r> ER r<', '.. b^ ..', '.. EB ..']);
    // Two reds enter at once. Blue wants the same cell but is not taken there: for blue it is floor
    // that others are stepping onto, so blue waits.
    const { state, events } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['collected', 'collected', '1,1,0']);
    expect(events[2].outcome).toBe('blocked-conflict');
  });

  it('is blocked for its own colour while a robot of another colour stands on it', () => {
    const level = board(['r> .. ER b<', '.. .. .. EB']);
    // Blue steps onto the red exit first; red arrives behind it and has to wait until blue has moved on.
    const one = run(level, ['forward']);
    expect(one.robots.map(at)).toEqual(['1,0,1', '2,0,3']);
    const two = step(level.board, one, 'forward');
    // Face to face: neither can pass the other. Red cannot enter its own exit while blue is on it.
    expect(two.state.robots.map(at)).toEqual(['1,0,1', '2,0,3']);
    expect(isWon(two.state)).toBe(false);
  });

  it('two robots of the wrong colour block each other on it as on any floor', () => {
    const level = board(['b> ER b<', '.. EB ..']);
    const { state, events } = first(level, 'forward');
    expect(state.robots.map(at)).toEqual(['0,0,1', '2,0,3']);
    expect(events.every((e) => e.outcome === 'blocked-conflict')).toBe(true);
  });

  it('refuses a level in which a colour has no exit', () => {
    expect(() => board(['r> ER b<'])).toThrow(/no exit takes the blue robots/);
  });

  it('leaves a board with the one plain exit exactly as it was', () => {
    const plain = board(['r> .. EX']).board;
    expect(plain.exits).toBeUndefined();
    expect([plain.exitX, plain.exitY]).toEqual([2, 0]);
    expect(board(['r> EX EB b<']).board.exits).toHaveLength(2);
  });
});

describe('pressure plate and gate', () => {
  it('keeps the gate shut while nobody stands on a plate', () => {
    const level = board(['r> GG EX', 'b> .. PP']);
    const { state, events } = first(level, 'forward');
    // Red bumps into the closed gate; blue walks on towards the plate.
    expect(state.robots.map(at)).toEqual(['0,0,1', '1,1,1']);
    expect(events[0].outcome).toBe('blocked-gate');
  });

  it('opens the gate from the move after a robot has arrived on the plate', () => {
    const level = board(['r> GG EX', 'b> .. PP']);
    // Move 2: blue arrives on the plate. The gate follows the position before the step, so red still bumps.
    const two = run(level, ['forward', 'forward']);
    expect(two.robots.map(at)).toEqual(['0,0,1', '2,1,1']);
    expect(gatesOpen(level.board, two)).toBe(true);
    // Move 3: blue bumps the edge and stays on the plate; red walks into the gate.
    const three = step(level.board, two, 'forward').state;
    expect(three.robots.map(at)).toEqual(['1,0,1', '2,1,1']);
    // Move 4: red leaves through the exit.
    expect(at(step(level.board, three, 'forward').state.robots[0])).toBe('collected');
  });

  it('never traps a robot in a gate: it may stay and may leave when the plate is empty again', () => {
    const level = board(['r> GG .. EX', 'bv .. .. ..', 'PP .. .. ..', '.. .. .. ..']);
    // Blue steps onto the plate, then off it again while red steps into the gate.
    const inGate = run(level, ['forward', 'forward']);
    expect(inGate.robots.map(at)).toEqual(['1,0,1', '0,3,2']);
    expect(gatesOpen(level.board, inGate)).toBe(false);
    // The gate is shut now, and red simply walks out of it.
    expect(at(step(level.board, inGate, 'forward').state.robots[0])).toBe('2,0,1');
  });

  it('opens every gate of the board for any plate, and a collected robot holds nothing open', () => {
    const level = board(['r> GG .. GG EX', 'PP b< .. .. ..']);
    // Blue steps onto the plate; then red passes the first gate.
    const state = run(level, ['forward', 'forward', 'forward', 'forward']);
    expect(state.robots.map(at)).toEqual(['3,0,1', '0,1,3']);
    expect(gatesOpen(level.board, { ...state, robots: state.robots.map((r) => ({ ...r, collected: true })) })).toBe(false);
  });

  it('is solved by the solver: red waits at the gate until blue has crossed the plate', () => {
    const level = board(['r> GG .. ER', 'b> .. PP EB']);
    // Blue reaches the plate on move 2 and leaves on move 3; red bumps twice and enters the gate on move 3.
    const solved = solve(level.board, level.start, 10);
    expect(solved.solution).toEqual(['forward', 'forward', 'forward', 'forward', 'forward']);
    expect(isWon(run(level, solved.solution!))).toBe(true);
  });

  it('refuses a level with a gate and no plate, and leaves a board without them as it was', () => {
    expect(() => board(['r> GG EX'])).toThrow(/a gate but no plate/);
    const plain = board(['r> .. EX']).board;
    expect(plain.gates).toBeUndefined();
    expect(plain.plates).toBeUndefined();
  });
});
