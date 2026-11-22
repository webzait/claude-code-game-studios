import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, isWon, step } from '../../src/engine/engine';
import type { Command, GameState } from '../../src/engine/types';
import { checkRescue, previewStep, routeScan, witnessNext } from '../../src/game/assist';
import { Session } from '../../src/game/session';
import { LEVELS } from '../../src/levels/index';
import { board, run } from './helpers';

const CAP = 1_000_000;

describe('Backup Signals fairness', () => {
  // One robot, exit two cells ahead after one turn.
  const level = board(['r^ .. .. EX', '.. .. .. ..']);

  it('offers the rescue only when the exact position can be won in the extra moves', () => {
    const close = run(level, ['red']); // at 1,0 facing east: two more moves win
    const result = checkRescue(level.board, close, 3, DEFAULT_RULES, CAP);
    expect(result.kind).toBe('rescuable');
    if (result.kind !== 'rescuable') return;
    const end = result.solution.reduce((s: GameState, c: Command) => step(level.board, s, c).state, close);
    expect(isWon(end)).toBe(true);
    expect(result.solution.length).toBeLessThanOrEqual(3);
  });

  it('refuses when three more moves cannot win from that position', () => {
    const far = run(level, ['red', 'red', 'forward']); // turned south, walked away
    expect(checkRescue(level.board, far, 3, DEFAULT_RULES, CAP).kind).toBe('hopeless');
  });

  it('reports "not assessed" rather than "hopeless" when the search is cut short', () => {
    const big = LEVELS.find((l) => l.id === 'one-command-many-consequences')!;
    expect(checkRescue(big.board, big.start, 12, DEFAULT_RULES, 20).kind).toBe('not-assessed');
  });
});

describe('Route Scan', () => {
  const level = LEVELS.find((l) => l.id === 'follow-the-arrow')!;
  const budget = level.par + 2;

  it('on a winnable position, names a first move that keeps it winnable', () => {
    const session = new Session(level, { budget });
    session.apply(level.witness[0]);
    const scan = routeScan(level.board, session.states, session.totalBudget, session.rules, CAP);
    expect(scan.kind).toBe('on-route');
    if (scan.kind !== 'on-route') return;
    expect(scan.movesNeeded).toBe(level.par - 1);
    session.apply(scan.next);
    expect(routeScan(level.board, session.states, session.totalBudget, session.rules, CAP).kind).toBe('on-route');
  });

  it('following the scan from the start wins the level', () => {
    for (const lvl of LEVELS.slice(0, 6)) {
      const session = new Session(lvl, { budget: lvl.par + 2 });
      while (session.status === 'playing') {
        const scan = routeScan(lvl.board, session.states, session.totalBudget, session.rules, CAP);
        if (scan.kind !== 'on-route') throw new Error(`${lvl.id}: scan said ${scan.kind}`);
        session.apply(scan.next);
      }
      expect(session.status).toBe('won');
    }
  });

  it('in a dead end, says how many moves to undo, and that position is winnable again', () => {
    const session = new Session(level, { budget });
    for (const c of ['red', 'red', 'red'] as const) session.apply(c);
    const scan = routeScan(level.board, session.states, session.totalBudget, session.rules, CAP);
    expect(scan.kind).toBe('dead-end');
    if (scan.kind !== 'dead-end') return;
    expect(scan.undo).toBeGreaterThan(0);
    for (let i = 0; i < scan.undo; i++) session.undo();
    expect(routeScan(level.board, session.states, session.totalBudget, session.rules, CAP).kind).toBe('on-route');
  });

  it('is "not assessed" when cut short', () => {
    const big = LEVELS.find((l) => l.id === 'one-command-many-consequences')!;
    const session = new Session(big, { budget: big.par + 2 });
    session.apply('blue');
    expect(routeScan(big.board, session.states, session.totalBudget, session.rules, 20).kind).toBe('not-assessed');
  });
});

describe('witness shortcut', () => {
  const witness: Command[] = ['forward', 'red', 'forward'];
  it('gives the next witness move while the player follows it', () => {
    expect(witnessNext(witness, [])).toBe('forward');
    expect(witnessNext(witness, ['forward'])).toBe('red');
  });
  it('gives nothing once the player has left it or finished it', () => {
    expect(witnessNext(witness, ['red'])).toBeNull();
    expect(witnessNext(witness, witness)).toBeNull();
  });
});

describe('the hint picture (finding B1)', () => {
  it('previews exactly what the engine then does, for every command at every step of every level witness', () => {
    for (const level of LEVELS) {
      const session = new Session(level, { budget: level.par });
      for (const command of level.witness) {
        const before = session.state;
        const preview = previewStep(level.board, before, command, session.rules);
        // Looking does not move anything.
        expect(session.state).toBe(before);
        expect(preview).toEqual(session.apply(command)!.events);
      }
    }
  });

  it('marks who turns, who steps and who is blocked', () => {
    // Red faces the wall above it; blue walks east.
    const level = board(['r^ b> .. EX', '.. .. .. ..']);
    const forward = previewStep(level.board, level.start, 'forward', DEFAULT_RULES);
    expect(forward.map((e) => [e.turned, e.outcome])).toEqual([[false, 'blocked-wall'], [false, 'moved']]);
    const red = previewStep(level.board, level.start, 'red', DEFAULT_RULES);
    expect(red[0]).toMatchObject({ turned: true, dir: 1 });
    expect(red[1]).toMatchObject({ turned: false, outcome: 'moved', toX: 2 });
  });
});
