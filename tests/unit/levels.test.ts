import { describe, expect, it } from 'vitest';
import { Session } from '../../src/game/session';
import { LEVELS } from '../../src/levels/index';
import { solve } from '../../src/solver/bfs';
import { board } from './helpers';

describe('solver', () => {
  it('finds the shortest solution', () => {
    const level = board(['r^ .. EX', '.. .. ..']);
    expect(solve(level.board, level.start, 10).solution).toEqual(['red', 'forward']);
  });

  it('reports no solution when the budget is too small or the exit is sealed', () => {
    const short = board(['r> .. .. EX']);
    expect(solve(short.board, short.start, 2).solution).toBeNull();
    const sealed = board(['r> ## EX']);
    expect(solve(sealed.board, sealed.start, 12).solution).toBeNull();
  });
});

describe('levels', () => {
  it('ships five levels', () => {
    expect(LEVELS.length).toBe(5);
  });

  for (const [index, level] of LEVELS.entries()) {
    describe(`level ${index + 1}: ${level.name}`, () => {
      const result = solve(level.board, level.start, level.moveBudget);

      it('is solvable within its move budget', () => {
        expect(result.solution).not.toBeNull();
      });

      it('has a par equal to the true shortest solution', () => {
        expect(result.solution?.length).toBe(level.par);
      });

      it('leaves a little slack but not much (budget = par + 2)', () => {
        expect(level.moveBudget - level.par).toBe(2);
      });

      it('is won by playing the solver answer through the real game session', () => {
        const session = new Session(level);
        for (const command of result.solution ?? []) session.apply(command);
        expect(session.status).toBe('won');
      });

      it('cannot be won by only pressing forward', () => {
        const session = new Session(level);
        while (session.status === 'playing') session.apply('forward');
        expect(session.status).toBe('lost');
      });
    });
  }

  it('follows the brief: colours and robot counts per level', () => {
    const colours = (i: number): string[] => [...new Set(LEVELS[i].start.robots.map((r) => r.color))].sort();
    const count = (i: number): number => LEVELS[i].start.robots.length;
    expect(colours(0)).toEqual(['red']);
    expect(count(0)).toBeGreaterThanOrEqual(2);
    expect(count(0)).toBeLessThanOrEqual(3);
    expect(colours(1)).toEqual(['blue', 'red']);
    expect(LEVELS[2].board.walls.some(Boolean)).toBe(true);
    expect(colours(4)).toEqual(['blue', 'red', 'yellow']);
    expect(count(4)).toBeGreaterThanOrEqual(10);
    expect(count(4)).toBeLessThanOrEqual(14);
  });
});
