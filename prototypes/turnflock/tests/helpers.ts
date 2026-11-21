// PROTOTYPE - NOT FOR PRODUCTION
import type { Command, GameState, Robot, StepResult } from '../src/engine/types';
import { step } from '../src/engine/engine';
import { parseLevel, type Level } from '../src/levels/parse';

/** Build a level from grid rows (see parseLevel for the cell format). */
export function board(grid: string[], moveBudget = 99): Level {
  return parseLevel({ id: 'test', name: 'test', moveBudget, grid });
}

/** Apply one command to a level's start state. */
export function first(level: Level, command: Command): StepResult {
  return step(level.board, level.start, command);
}

/** Apply a list of commands and return the final state. */
export function run(level: Level, commands: Command[]): GameState {
  return commands.reduce((state, c) => step(level.board, state, c).state, level.start);
}

/** "x,y,dir" of a robot, or "collected". */
export function at(r: Robot): string {
  return r.collected ? 'collected' : `${r.x},${r.y},${r.dir}`;
}
