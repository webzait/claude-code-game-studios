import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { Session } from '../../src/game/session';
import { LEVELS } from '../../src/levels/index';
import { solve } from '../../src/solver/bfs';
import catalogData from '../../design/levels-catalog.json';
import { fastSolve, prepare } from '../../tools/level-design/fast';
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
    const level = byId('one-command-many-consequences');
    expect(solve(level.board, level.start, 12, undefined, false, 50)).toMatchObject({ solution: null, capped: true });
  });
});

describe('levels', () => {
  it('ships two full pages of levels with unique ids and names', () => {
    expect(LEVELS.length).toBe(2 * CONFIG.levelsPerPage);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((l) => l.name)).size).toBe(LEVELS.length);
  });

  it('still has every level an old save can name, each meaning the same board', () => {
    // Progress is stored per id. The ten original ids must stay, on their original boards.
    const original: Record<string, string> = {
      'follow-the-arrow': '5x4/3',
      'one-color-turns': '5x5/4',
      'side-door': '6x6/3',
      'use-the-wall': '6x5/4',
      'queue-up': '6x6/5',
      'traffic-jam': '6x6/6',
      'long-way-round': '6x5/4',
      'two-lanes': '6x5/6',
      patience: '6x6/5',
      'one-command-many-consequences': '6x6/12',
    };
    for (const [id, shape] of Object.entries(original)) {
      const level = byId(id);
      expect(level, id).toBeDefined();
      expect(`${level.board.width}x${level.board.height}/${level.start.robots.length}`, id).toBe(shape);
    }
    expect(CONFIG.save.v1LevelOrder).toEqual(Object.keys(original));
  });

  it('varies the board: at least eight sizes, from 4x4 to 8x8, square and not', () => {
    const sizes = new Set(LEVELS.map((l) => `${l.board.width}x${l.board.height}`));
    expect(sizes.size).toBeGreaterThanOrEqual(8);
    expect(sizes.has('4x4')).toBe(true);
    expect(sizes.has('8x8')).toBe(true);
    expect([...sizes].some((s) => s.split('x')[0] !== s.split('x')[1])).toBe(true);
  });

  it('teaches the rules one at a time in the first five levels', () => {
    const first = LEVELS.slice(0, 5);
    // Level 1: FORWARD alone wins. Level 2 and 3: one colour. Level 4: a second colour. Level 5: the first wall.
    expect(new Set(first[0].witness)).toEqual(new Set(['forward']));
    expect(first.slice(0, 3).every((l) => new Set(l.start.robots.map((r) => r.color)).size === 1)).toBe(true);
    expect(new Set(first[3].start.robots.map((r) => r.color)).size).toBe(2);
    expect(first.slice(0, 4).every((l) => !l.board.walls.some(Boolean))).toBe(true);
    expect(first[4].board.walls.some(Boolean)).toBe(true);
    expect(first.every((l) => l.par <= 7 && l.start.robots.length <= 3)).toBe(true);
  });

  it('has a design note for every level: a known idea, an origin and one sentence', () => {
    const catalog = catalogData as { ideas: Record<string, string>; origins: Record<string, string>; levels: Record<string, { idea: string; origin: string; about: string }> };
    expect(Object.keys(catalog.levels).sort()).toEqual(LEVELS.map((l) => l.id).sort());
    for (const [id, note] of Object.entries(catalog.levels)) {
      expect(catalog.ideas[note.idea], id).toBeDefined();
      expect(catalog.origins[note.origin], id).toBeDefined();
      expect(note.about.length, id).toBeGreaterThan(20);
    }
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

      it('agrees with a second, independent search on the shortest length', () => {
        // The sieve has its own position keys, so a key collision in the solver cannot hide here.
        const result = fastSolve(prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany), budget);
        expect(result.solution?.length).toBe(level.par);
      });

      it(index === 0 ? 'is the one level won by only pressing forward' : 'cannot be won by only pressing forward', () => {
        const session = new Session(level, { budget });
        while (session.status === 'playing') session.apply('forward');
        expect(session.status).toBe(index === 0 ? 'won' : 'lost');
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

describe('board-size test boards', () => {
  it('cover_the_four_sizes_and_parse_cleanly', async () => {
    const { TEST_BOARDS } = await import('../../src/levels/index');
    const sizes = TEST_BOARDS.map((b) => `${b.board.width}x${b.board.height}`);
    expect(sizes).toEqual(['5x5', '6x6', '8x8', '4x7']);
    for (const b of TEST_BOARDS) expect(b.start.robots.length).toBeGreaterThan(0);
  });
});
