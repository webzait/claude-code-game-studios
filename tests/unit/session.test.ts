import { describe, expect, it } from 'vitest';
import { step } from '../../src/engine/engine';
import { Session } from '../../src/game/session';
import { board } from './helpers';

const level = board(['r^ .. EX', '.. .. ..', 'b^ .. ..'], 4);

describe('session', () => {
  it('undo restores the exact previous state', () => {
    const s = new Session(level);
    s.apply('forward');
    const before = s.state;
    s.apply('red');
    expect(s.undo()).toBe(true);
    expect(s.state).toEqual(before);
    expect(s.commands).toEqual(['forward']);
  });

  it('undo with no history does nothing', () => {
    expect(new Session(level).undo()).toBe(false);
  });

  it('restart returns to the start and clears the log', () => {
    const s = new Session(level);
    s.apply('red');
    s.apply('blue');
    s.restart();
    expect(s.state).toEqual(level.start);
    expect(s.commands).toEqual([]);
    expect(s.movesLeft).toBe(4);
  });

  it('replaying the command log from the start reproduces the state', () => {
    const s = new Session(level);
    for (const c of ['forward', 'red', 'blue'] as const) s.apply(c);
    const replayed = s.commands.reduce((state, c) => step(level.board, state, c).state, level.start);
    expect(replayed).toEqual(s.state);
  });

  it('is lost when the moves run out, and refuses further commands', () => {
    const s = new Session(level);
    for (let i = 0; i < 4; i++) s.apply('forward');
    expect(s.status).toBe('lost');
    expect(s.apply('forward')).toBeNull();
    s.undo();
    expect(s.status).toBe('playing');
  });

  it('is won when every robot is collected', () => {
    const s = new Session(level);
    for (const c of ['red', 'forward', 'blue'] as const) s.apply(c);
    expect(s.collected).toBe(1);
    s.apply('forward'); // last allowed move: winning on it still counts
    expect(s.status).toBe('won');
  });
});
