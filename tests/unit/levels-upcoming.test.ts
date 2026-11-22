import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import type { Command } from '../../src/engine/types';
import { Session } from '../../src/game/session';
import { LEVELS } from '../../src/levels/index';
import { parseLevel } from '../../src/levels/parse';
import { solve } from '../../src/solver/bfs';
import catalogData from '../../design/levels-catalog.json';
import upcomingData from '../../data/levels-upcoming.json';
import { fastSolve, prepare } from '../../tools/level-design/fast';
import { replayMeasures } from '../../tools/level-design/measure';

/**
 * Page 3: certified like every shipped level, but kept out of the game (and out of
 * data/levels.json) until the turn tile is drawn. Moving a level into data/levels.json
 * must not change it, so the same proofs run here.
 */
const UPCOMING = upcomingData.map((def) => ({ ...parseLevel(def), par: def.par, witness: def.witness as Command[] }));

describe('upcoming levels (page 3, turn tile)', () => {
  it('is one full page with ids and names no shipped level uses', () => {
    expect(UPCOMING.length).toBe(CONFIG.levelsPerPage);
    const ids = [...LEVELS, ...UPCOMING].map((l) => l.id);
    const names = [...LEVELS, ...UPCOMING].map((l) => l.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it('is not in the game yet: no shipped level has a turn tile', () => {
    expect(LEVELS.every((l) => l.board.turnTiles === undefined)).toBe(true);
  });

  it('teaches the turn tile in its first five levels, starting with a board that does all the turning', () => {
    const first = UPCOMING.slice(0, 5);
    expect(first.every((l) => l.board.turnTiles?.some(Boolean))).toBe(true);
    expect(new Set(first[0].witness)).toEqual(new Set(['forward']));
    expect(first.every((l) => l.par <= 7 && l.start.robots.length <= 3)).toBe(true);
    // One of the five is about a tile to stay off: its solution never touches it.
    expect(first.filter((l) => replayMeasures(l, l.witness).tileTurns === 0).length).toBe(1);
  });

  it('uses the tile in most levels and leaves it out of a few, on boards up to 8x8', () => {
    const withTile = UPCOMING.filter((l) => l.board.turnTiles?.some(Boolean)).length;
    expect(withTile).toBeGreaterThanOrEqual(16);
    expect(withTile).toBeLessThan(UPCOMING.length);
    const sizes = new Set(UPCOMING.map((l) => `${l.board.width}x${l.board.height}`));
    expect(sizes.has('8x8')).toBe(true);
    expect(sizes.size).toBeGreaterThanOrEqual(7);
  });

  it('has a design note for every level', () => {
    const catalog = catalogData as unknown as { ideas: Record<string, string>; origins: Record<string, string>; upcoming: Record<string, { idea: string; origin: string; about: string }> };
    expect(Object.keys(catalog.upcoming).sort()).toEqual(UPCOMING.map((l) => l.id).sort());
    for (const [id, note] of Object.entries(catalog.upcoming)) {
      expect(catalog.ideas[note.idea], id).toBeDefined();
      expect(catalog.origins[note.origin], id).toBeDefined();
      expect(note.about.length, id).toBeGreaterThan(20);
    }
  });

  for (const [index, level] of UPCOMING.entries()) {
    describe(`level ${LEVELS.length + index + 1}: ${level.name}`, () => {
      const budget = level.par + CONFIG.moveSlack;

      it('is won by its stored witness, played through the real game session', () => {
        const session = new Session(level, { budget });
        for (const command of level.witness) session.apply(command);
        expect(session.status).toBe('won');
        expect(level.witness.length).toBe(level.par);
      });

      it('has a par equal to the true shortest solution, found without a search cap', () => {
        const result = solve(level.board, level.start, budget);
        expect(result.capped).toBe(false);
        expect(result.solution?.length).toBe(level.par);
      });

      it('agrees with a second, independent search on the shortest length', () => {
        expect(fastSolve(prepare(level.board, level.start, CONFIG.rules.exitAcceptsMany), budget).solution?.length).toBe(level.par);
      });
    });
  }
});
