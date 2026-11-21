import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { Session } from '../../src/game/session';
import { DISTRICTS, LEVELS } from '../../src/levels/index';
import { solve } from '../../src/solver/bfs';
import { board } from './helpers';

const byId = (id: string) => LEVELS.find((l) => l.id === id)!;
const colours = (id: string): string[] => [...new Set(byId(id).start.robots.map((r) => r.color))].sort();

describe('solver', () => {
  it('finds the shortest solution', () => {
    const level = board(['r^ .. EX', '.. .. ..']);
    expect(solve(level.board, level.start, 10).solution).toEqual(['red', 'forward']);
  });

  it('reports no solution when the budget is too small or the exit is sealed', () => {
    const short = board(['r> .. .. EX']);
    expect(solve(short.board, short.start, 2)).toMatchObject({ solution: null, capped: false });
    const sealed = board(['r> ## EX']);
    expect(solve(sealed.board, sealed.start, 12)).toMatchObject({ solution: null, capped: false });
  });

  it('says so when it was cut short instead of claiming "unsolvable"', () => {
    const level = LEVELS[LEVELS.length - 1];
    expect(solve(level.board, level.start, 12, undefined, false, 50)).toMatchObject({ solution: null, capped: true });
  });
});

describe('levels', () => {
  it('ships ten levels with unique ids', () => {
    expect(LEVELS.length).toBe(10);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(10);
  });

  for (const [index, level] of LEVELS.entries()) {
    describe(`level ${index + 1}: ${level.name}`, () => {
      const budget = level.par + CONFIG.moveSlack;

      it('is won by its stored witness, played through the real game session', () => {
        const session = new Session(level, { budget });
        for (const command of level.witness) session.apply(command);
        expect(session.status).toBe('won');
        expect(session.commands.length).toBe(level.witness.length);
      });

      it('has a par equal to the true shortest solution, found without a search cap', () => {
        const result = solve(level.board, level.start, budget);
        expect(result.capped).toBe(false);
        expect(result.solution?.length).toBe(level.par);
        expect(level.witness.length).toBe(level.par);
      });

      it('cannot be won by only pressing forward', () => {
        const session = new Session(level, { budget });
        while (session.status === 'playing') session.apply('forward');
        expect(session.status).toBe('lost');
      });
    });
  }

  it('follows the brief: colours and robot counts of the original five', () => {
    expect(colours('follow-the-arrow')).toEqual(['red']);
    expect(byId('follow-the-arrow').start.robots.length).toBeLessThanOrEqual(3);
    expect(colours('one-color-turns')).toEqual(['blue', 'red']);
    expect(byId('use-the-wall').board.walls.some(Boolean)).toBe(true);
    const last = byId('one-command-many-consequences');
    expect(colours(last.id)).toEqual(['blue', 'red', 'yellow']);
    expect(last.start.robots.length).toBeGreaterThanOrEqual(10);
    expect(last.start.robots.length).toBeLessThanOrEqual(14);
  });
});

describe('districts', () => {
  it('lists six districts; only real levels are referenced, each at most once', () => {
    expect(DISTRICTS.length).toBe(6);
    const used = DISTRICTS.flatMap((d) => d.levels);
    expect(new Set(used).size).toBe(used.length);
    for (const id of used) expect(byId(id)).toBeDefined();
    expect([...used].sort()).toEqual(LEVELS.map((l) => l.id).sort());
  });

  it('keeps a local map view to at most 12 level nodes', () => {
    for (const d of DISTRICTS) expect(d.levels.length).toBeLessThanOrEqual(12);
  });

  it('places milestones inside the number of levels the district has', () => {
    for (const d of DISTRICTS) for (const m of d.milestones) expect(m.afterLevels).toBeLessThanOrEqual(d.levels.length);
  });
});
