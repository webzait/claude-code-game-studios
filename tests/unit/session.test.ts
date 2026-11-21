import { describe, expect, it } from 'vitest';
import { step } from '../../src/engine/engine';
import { Session } from '../../src/game/session';
import { board } from './helpers';

const level = board(['r^ .. EX', '.. .. ..', 'b^ .. ..']);
const BUDGET = 4;
const open = (): Session => new Session(level, { budget: BUDGET });

describe('session', () => {
  it('undo restores the exact previous state', () => {
    const s = open();
    s.apply('forward');
    const before = s.state;
    s.apply('red');
    expect(s.undo()).toBe(true);
    expect(s.state).toEqual(before);
    expect(s.commands).toEqual(['forward']);
  });

  it('undo with no history does nothing', () => {
    expect(open().undo()).toBe(false);
  });

  it('restart returns to the start and clears the log', () => {
    const s = open();
    s.apply('red');
    s.apply('blue');
    s.restart();
    expect(s.state).toEqual(level.start);
    expect(s.commands).toEqual([]);
    expect(s.movesLeft).toBe(4);
  });

  it('replaying the command log from the start reproduces the state', () => {
    const s = open();
    for (const c of ['forward', 'red', 'blue'] as const) s.apply(c);
    const replayed = s.commands.reduce((state, c) => step(level.board, state, c).state, level.start);
    expect(replayed).toEqual(s.state);
  });

  it('is lost when the moves run out, and refuses further commands', () => {
    const s = open();
    for (let i = 0; i < 4; i++) s.apply('forward');
    expect(s.status).toBe('lost');
    expect(s.apply('forward')).toBeNull();
    s.undo();
    expect(s.status).toBe('playing');
  });

  it('is won when every robot is collected', () => {
    const s = open();
    for (const c of ['red', 'forward', 'blue'] as const) s.apply(c);
    expect(s.collected).toBe(1);
    s.apply('forward'); // last allowed move: winning on it still counts
    expect(s.status).toBe('won');
  });

  it('Backup Signals reopen a lost attempt and are cleared by restart', () => {
    const s = open();
    for (let i = 0; i < BUDGET; i++) s.apply('forward');
    expect(s.status).toBe('lost');
    s.grantBonus(3);
    expect(s.status).toBe('playing');
    expect(s.movesLeft).toBe(3);
    s.restart();
    expect(s.movesLeft).toBe(BUDGET);
  });

  it('lists every state of the attempt, oldest first', () => {
    const s = open();
    s.apply('forward');
    s.apply('red');
    expect(s.states.map((st) => st.movesUsed)).toEqual([0, 1, 2]);
  });

  it('plays by the rules it was given', () => {
    const two = board(['r> EX', '.. b^']);
    const single = new Session(two, { budget: 5, rules: { exitAcceptsMany: false } });
    single.apply('forward');
    expect(single.collected).toBe(0);
    const many = new Session(two, { budget: 5 });
    many.apply('forward');
    expect(many.collected).toBe(2);
  });
});
