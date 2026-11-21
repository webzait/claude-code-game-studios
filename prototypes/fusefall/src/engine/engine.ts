// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// The FUSEFALL puzzle engine: a deterministic graph model. Pure functions, no rendering,
// no randomness, no clock. One pulse resolves in four fixed phases:
//
//   1. HEAT    The source emits `strength`. Heat spreads hop by hop over closed conductors,
//              breadth-first; a node d hops away receives strength - d and passes heat on only
//              while that is above 0. Within a hop, nodes are handled in id order and their
//              conductors in id order. Latches absorb heat (charge += heat) and never relay it.
//              Charge stays between pulses. An open latch is a dead end.
//   2. LATCHES Every latch charged this pulse whose charge >= threshold opens, in the order the
//              heat arrived (hop, then id). Each queues its platform's tilt.
//   3. MECHANICS The tilt queue is emptied first-in first-out. A tilt (a) breaks the platform's
//              `opens` conductors, (b) closes its `closes` conductors, (c) sends all its balls
//              to `dropsTo`. Balls reaching a flat platform rest there, and queue its tilt when
//              it now holds >= tipsAtLoad. Balls reaching a tilted platform run straight on to
//              that platform's target. No heat flows in this phase: changed conductors count
//              from the next pulse on.
//   4. SETTLE  Won when bin >= goal. Otherwise lost when no pulses remain, or when no order of
//              the remaining pulses can still reach the goal.

import {
  BIN,
  VOID,
  type GameEvent,
  type GameState,
  type LatchNode,
  type LevelDef,
  type PulseResult,
  type Target,
} from './types';

/** The starting state of a level. */
export function createState(level: LevelDef): GameState {
  const state: GameState = {
    pulsesLeft: level.pulses,
    bin: 0,
    lost: 0,
    charge: {},
    open: {},
    closed: {},
    balls: {},
    tilted: {},
    status: 'playing',
    history: [],
  };
  for (const n of level.nodes) {
    if (n.kind === 'latch') {
      state.charge[n.id] = 0;
      state.open[n.id] = false;
    }
  }
  for (const e of level.edges) state.closed[e.id] = e.closed;
  for (const p of level.platforms) {
    state.balls[p.id] = p.balls;
    state.tilted[p.id] = false;
  }
  return state;
}

function clone(state: GameState): GameState {
  return {
    ...state,
    charge: { ...state.charge },
    open: { ...state.open },
    closed: { ...state.closed },
    balls: { ...state.balls },
    tilted: { ...state.tilted },
    history: [...state.history],
  };
}

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Total balls in a level (on platforms at the start). */
export function totalBalls(level: LevelDef): number {
  return level.platforms.reduce((sum, p) => sum + p.balls, 0);
}

/** The ids of a level's sources, in id order. */
export function sourceIds(level: LevelDef): string[] {
  return level.nodes
    .filter((n) => n.kind === 'source')
    .map((n) => n.id)
    .sort();
}

/**
 * Structural problems in a level definition: unknown ids, a ball route that loops, a latch
 * without a platform. An empty list means the level is well formed.
 */
export function validateLevel(level: LevelDef): string[] {
  const problems: string[] = [];
  const nodeIds = new Set(level.nodes.map((n) => n.id));
  const edgeIds = new Set(level.edges.map((e) => e.id));
  const platforms = new Map(level.platforms.map((p) => [p.id, p]));
  if (nodeIds.size !== level.nodes.length) problems.push('duplicate node id');
  if (edgeIds.size !== level.edges.length) problems.push('duplicate edge id');
  if (platforms.size !== level.platforms.length) problems.push('duplicate platform id');
  for (const e of level.edges) {
    if (!nodeIds.has(e.a) || !nodeIds.has(e.b)) problems.push(`edge ${e.id} joins an unknown node`);
  }
  for (const n of level.nodes) {
    if (n.kind === 'latch' && !platforms.has(n.releases)) {
      problems.push(`latch ${n.id} releases unknown platform ${n.releases}`);
    }
    if (n.kind === 'latch' && n.threshold < 1) problems.push(`latch ${n.id} needs a threshold >= 1`);
    if (n.kind === 'source' && n.strength < 1) problems.push(`source ${n.id} needs a strength >= 1`);
  }
  for (const p of level.platforms) {
    for (const id of [...(p.opens ?? []), ...(p.closes ?? [])]) {
      if (!edgeIds.has(id)) problems.push(`platform ${p.id} switches unknown edge ${id}`);
    }
    if (p.dropsTo !== BIN && p.dropsTo !== VOID && !platforms.has(p.dropsTo)) {
      problems.push(`platform ${p.id} drops to unknown target ${p.dropsTo}`);
    }
    // A ball route must end in the bin or the void: follow it and look for a loop.
    const seen = new Set<string>([p.id]);
    let next: Target = p.dropsTo;
    while (next !== BIN && next !== VOID) {
      if (seen.has(next)) {
        problems.push(`ball route from ${p.id} loops at ${next}`);
        break;
      }
      seen.add(next);
      const q = platforms.get(next);
      if (!q) break;
      next = q.dropsTo;
    }
  }
  if (!level.nodes.some((n) => n.kind === 'source')) problems.push('no source');
  if (level.goal > totalBalls(level)) problems.push('goal exceeds the balls in the level');
  for (const s of level.solution) {
    const n = level.nodes.find((x) => x.id === s);
    if (!n || n.kind !== 'source') problems.push(`solution names ${s}, which is not a source`);
  }
  return problems;
}

/**
 * Fires one pulse from `sourceId` and resolves it completely. Returns the new state and the
 * ordered list of events; the input state is not modified. Firing when the level is over, or
 * from something that is not a source, changes nothing and returns no events.
 */
export function firePulse(level: LevelDef, prev: GameState, sourceId: string): PulseResult {
  const source = level.nodes.find((n) => n.id === sourceId);
  if (prev.status !== 'playing' || prev.pulsesLeft <= 0 || !source || source.kind !== 'source') {
    return { state: prev, events: [] };
  }
  const state = clone(prev);
  const events: GameEvent[] = [];
  state.pulsesLeft -= 1;
  state.history.push(sourceId);
  events.push({ type: 'pulse', source: sourceId, strength: source.strength });

  // ---- 1. HEAT ---------------------------------------------------------------------------
  const nodes = new Map(level.nodes.map((n) => [n.id, n]));
  const edges = [...level.edges].sort(byId);
  const visited = new Set<string>([sourceId]);
  const charged: LatchNode[] = []; // in arrival order
  let frontier = [sourceId];
  for (let step = 1; frontier.length > 0; step++) {
    const heat = source.strength - step;
    if (heat <= 0) break;
    const next: string[] = [];
    for (const from of [...frontier].sort()) {
      for (const e of edges) {
        if (!state.closed[e.id]) continue;
        const to = e.a === from ? e.b : e.b === from ? e.a : null;
        if (to === null || visited.has(to)) continue;
        visited.add(to);
        events.push({ type: 'heat', step, edge: e.id, from, to, heat });
        const node = nodes.get(to)!;
        if (node.kind === 'latch') {
          if (!state.open[to]) {
            state.charge[to] += heat;
            charged.push(node);
            events.push({
              type: 'charge',
              step,
              latch: to,
              added: heat,
              charge: state.charge[to],
              threshold: node.threshold,
            });
          }
        } else {
          next.push(to);
        }
      }
    }
    frontier = next;
  }

  // ---- 2. LATCHES ------------------------------------------------------------------------
  const queue: { platform: string; cause: 'latch' | 'load'; latch?: string }[] = [];
  for (const latch of charged) {
    if (state.charge[latch.id] >= latch.threshold) {
      state.open[latch.id] = true;
      events.push({ type: 'latchOpen', latch: latch.id, platform: latch.releases });
      queue.push({ platform: latch.releases, cause: 'latch', latch: latch.id });
    }
  }

  // ---- 3. MECHANICS ----------------------------------------------------------------------
  const platforms = new Map(level.platforms.map((p) => [p.id, p]));
  const deliver = (from: string, to: Target, count: number): void => {
    events.push({ type: 'balls', from, to, count });
    if (to === BIN) state.bin += count;
    else if (to === VOID) state.lost += count;
    else {
      const q = platforms.get(to)!;
      if (state.tilted[to]) {
        deliver(to, q.dropsTo, count); // a tilted platform is a chute
      } else {
        state.balls[to] += count;
        if (q.tipsAtLoad !== undefined && state.balls[to] >= q.tipsAtLoad) {
          queue.push({ platform: to, cause: 'load' });
        }
      }
    }
  };
  while (queue.length > 0) {
    const job = queue.shift()!;
    if (state.tilted[job.platform]) continue;
    const p = platforms.get(job.platform)!;
    state.tilted[p.id] = true;
    events.push({ type: 'tilt', platform: p.id, cause: job.cause, latch: job.latch });
    for (const id of p.opens ?? []) {
      if (state.closed[id]) {
        state.closed[id] = false;
        events.push({ type: 'edge', edge: id, closed: false, platform: p.id });
      }
    }
    for (const id of p.closes ?? []) {
      if (!state.closed[id]) {
        state.closed[id] = true;
        events.push({ type: 'edge', edge: id, closed: true, platform: p.id });
      }
    }
    const count = state.balls[p.id];
    if (count > 0) {
      state.balls[p.id] = 0;
      deliver(p.id, p.dropsTo, count);
    }
  }

  // ---- 4. SETTLE -------------------------------------------------------------------------
  if (state.bin >= level.goal) {
    state.status = 'won';
  } else if (state.pulsesLeft <= 0) {
    state.status = 'lost';
    state.lossReason = 'out-of-pulses';
  } else if (!canStillWin(level, state)) {
    state.status = 'lost';
    state.lossReason = 'unreachable';
  }
  events.push({ type: 'settle', status: state.status, bin: state.bin, lossReason: state.lossReason });
  return { state, events };
}

/** Resolves heat, latches and mechanics only: the search below must not recurse into settle. */
function fireRaw(level: LevelDef, state: GameState, sourceId: string): GameState {
  // Settle is the only phase that looks ahead; give it nothing to look at.
  const probe: LevelDef = { ...level, goal: Number.POSITIVE_INFINITY };
  const s = firePulse(probe, { ...state, pulsesLeft: 1, status: 'playing' }, sourceId).state;
  return { ...s, pulsesLeft: state.pulsesLeft - 1, status: 'playing', lossReason: undefined };
}

/** True when some order of the remaining pulses still reaches the goal. */
export function canStillWin(level: LevelDef, state: GameState): boolean {
  if (state.bin >= level.goal) return true;
  if (state.pulsesLeft <= 0) return false;
  for (const id of sourceIds(level)) {
    if (canStillWin(level, fireRaw(level, state, id))) return true;
  }
  return false;
}

/** Plays a whole sequence from the start of a level. Stops firing once the level is over. */
export function playSequence(level: LevelDef, sequence: string[]): { state: GameState; events: GameEvent[][] } {
  let state = createState(level);
  const events: GameEvent[][] = [];
  for (const id of sequence) {
    const result = firePulse(level, state, id);
    state = result.state;
    events.push(result.events);
  }
  return { state, events };
}

/** Every sequence of sources, no longer than the level's pulse budget, that wins the level. */
export function winningSequences(level: LevelDef): string[][] {
  const wins: string[][] = [];
  const ids = sourceIds(level);
  const walk = (state: GameState, path: string[]): void => {
    if (state.status === 'won') {
      wins.push(path);
      return;
    }
    if (state.status === 'lost') return;
    for (const id of ids) walk(firePulse(level, state, id).state, [...path, id]);
  };
  walk(createState(level), []);
  return wins;
}

/** How many distinct full-length sequences the pulse budget allows (sources ^ pulses). */
export function sequenceSpace(level: LevelDef): number {
  return Math.pow(sourceIds(level).length, level.pulses);
}
