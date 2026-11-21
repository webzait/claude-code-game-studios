// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
import { describe, expect, it } from 'vitest';
import { createState, firePulse, playSequence, validateLevel } from '../src/engine/engine';
import type { GameEvent } from '../src/engine/types';
import { joint, latch, line, machine, plat, src, wire } from './fixtures';

const types = (events: GameEvent[]) => events.map((e) => e.type);
const of = <T extends GameEvent['type']>(events: GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe('energy transfer', () => {
  it('test_heat_node_at_d_hops_receives_strength_minus_d', () => {
    const level = line(4, 2, 99);
    const { events } = firePulse(level, createState(level), 'S');
    expect(of(events, 'heat').map((e) => [e.to, e.step, e.heat])).toEqual([
      ['j1', 1, 3],
      ['j2', 2, 2],
      ['L', 3, 1],
    ]);
  });

  it('test_heat_stops_when_it_reaches_zero', () => {
    const level = line(2, 2, 1); // the latch is 3 hops away, heat would be -1
    const { state, events } = firePulse(level, createState(level), 'S');
    expect(of(events, 'heat').map((e) => e.to)).toEqual(['j1']);
    expect(state.charge.L).toBe(0);
    expect(state.open.L).toBe(false);
  });

  it('test_latch_opens_exactly_at_threshold', () => {
    const below = line(3, 1, 2); // receives 1
    expect(firePulse(below, createState(below), 'S').state.open.L).toBe(false);
    const at = line(4, 1, 2); // receives 2
    expect(firePulse(at, createState(at), 'S').state.open.L).toBe(true);
  });

  it('test_latch_keeps_charge_between_pulses', () => {
    const level = line(3, 1, 2); // 1 heat per pulse, threshold 2
    const first = firePulse(level, createState(level), 'S');
    expect(first.state.charge.L).toBe(1);
    expect(first.state.open.L).toBe(false);
    const second = firePulse(level, first.state, 'S');
    expect(second.state.charge.L).toBe(2);
    expect(second.state.open.L).toBe(true);
    expect(second.state.bin).toBe(3);
  });

  it('test_latch_absorbs_heat_and_does_not_relay_it', () => {
    const level = machine({
      nodes: [src('S', 9), latch('L1', 99, 'P'), latch('L2', 1, 'P')],
      edges: [wire('e1', 'S', 'L1'), wire('e2', 'L1', 'L2')],
      platforms: [plat('P', 1, 'bin')],
    });
    const { state } = firePulse(level, createState(level), 'S');
    expect(state.charge.L1).toBe(8);
    expect(state.charge.L2).toBe(0);
  });

  it('test_heat_takes_the_shortest_path_once', () => {
    // Two routes to the latch: 1 hop and 3 hops. It is charged once, with the short route's heat.
    const level = machine({
      nodes: [src('S', 5), joint('a'), joint('b'), latch('L', 99, 'P')],
      edges: [wire('e1', 'S', 'L'), wire('e2', 'S', 'a'), wire('e3', 'a', 'b'), wire('e4', 'b', 'L')],
      platforms: [plat('P', 1, 'bin')],
    });
    const { state, events } = firePulse(level, createState(level), 'S');
    expect(state.charge.L).toBe(4);
    expect(of(events, 'charge')).toHaveLength(1);
  });

  it('test_open_conductor_blocks_heat', () => {
    const level = machine({
      nodes: [src('S', 5), joint('a'), latch('L', 1, 'P')],
      edges: [wire('e1', 'S', 'a'), wire('gap', 'a', 'L', false)],
      platforms: [plat('P', 1, 'bin')],
    });
    const { state } = firePulse(level, createState(level), 'S');
    expect(state.charge.L).toBe(0);
  });

  it('test_firing_does_not_modify_the_input_state', () => {
    const level = line(3, 0, 1);
    const before = createState(level);
    const snapshot = JSON.stringify(before);
    firePulse(level, before, 'S');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('test_same_inputs_give_identical_events', () => {
    const level = line(4, 2, 1);
    const a = playSequence(level, ['S']);
    const b = playSequence(level, ['S']);
    expect(a).toEqual(b);
  });
});

describe('changing connections', () => {
  // S1 -> L1 releases P1, whose tilt closes `k` and breaks `x`.
  // S2 -k-> L2 (needs k closed).  S3 -x-> L3 (needs x intact).
  const level = machine({
    pulses: 3,
    goal: 99,
    nodes: [src('S1', 3), src('S2', 3), src('S3', 3), latch('L1', 1, 'P1'), latch('L2', 1, 'P2'), latch('L3', 1, 'P3')],
    edges: [wire('e1', 'S1', 'L1'), wire('k', 'S2', 'L2', false), wire('x', 'S3', 'L3')],
    platforms: [
      plat('P1', 1, 'bin', { closes: ['k'], opens: ['x'] }),
      plat('P2', 1, 'bin'),
      plat('P3', 1, 'bin'),
    ],
  });
  const noGoal = { ...level, goal: 2 };

  it('test_tilt_closes_a_contact_for_the_next_pulse', () => {
    const blocked = firePulse(noGoal, createState(noGoal), 'S2');
    expect(blocked.state.open.L2).toBe(false);
    const { state } = playSequence(noGoal, ['S1', 'S2']);
    expect(state.closed.k).toBe(true);
    expect(state.open.L2).toBe(true);
  });

  it('test_tilt_breaks_a_conductor_for_the_next_pulse', () => {
    const intact = firePulse(noGoal, createState(noGoal), 'S3');
    expect(intact.state.open.L3).toBe(true);
    const { state } = playSequence(noGoal, ['S1', 'S3']);
    expect(state.closed.x).toBe(false);
    expect(state.open.L3).toBe(false);
  });

  it('test_edge_events_name_the_platform_that_caused_them', () => {
    const { events } = firePulse(noGoal, createState(noGoal), 'S1');
    expect(of(events, 'edge')).toEqual([
      { type: 'edge', edge: 'x', closed: false, platform: 'P1' },
      { type: 'edge', edge: 'k', closed: true, platform: 'P1' },
    ]);
  });

  it('test_no_heat_flows_through_a_contact_closed_in_the_same_pulse', () => {
    // S reaches L1 (1 hop) and, through contact k, L2. P1's tilt closes k, but only after the heat phase.
    const m = machine({
      goal: 2,
      nodes: [src('S', 5), joint('a'), latch('L1', 1, 'P1'), latch('L2', 1, 'P2')],
      edges: [wire('e1', 'S', 'L1'), wire('e2', 'S', 'a'), wire('k', 'a', 'L2', false)],
      platforms: [plat('P1', 1, 'bin', { closes: ['k'] }), plat('P2', 1, 'bin')],
    });
    const first = firePulse(m, createState(m), 'S');
    expect(first.state.closed.k).toBe(true);
    expect(first.state.open.L2).toBe(false);
    expect(firePulse(m, first.state, 'S').state.open.L2).toBe(true);
  });
});

describe('order of events', () => {
  it('test_phases_run_heat_then_latches_then_mechanics_then_settle', () => {
    const level = line(3, 1, 1);
    const { events } = firePulse(level, createState(level), 'S');
    expect(types(events)).toEqual(['pulse', 'heat', 'heat', 'charge', 'latchOpen', 'tilt', 'balls', 'settle']);
  });

  it('test_latches_open_in_arrival_order_then_id_order', () => {
    // Lz is 1 hop away, La and Lb are both 2 hops away.
    const level = machine({
      goal: 3,
      nodes: [src('S', 5), joint('j'), latch('Lz', 1, 'Pz'), latch('Lb', 1, 'Pb'), latch('La', 1, 'Pa')],
      edges: [wire('e1', 'S', 'j'), wire('e0', 'S', 'Lz'), wire('e3', 'j', 'Lb'), wire('e2', 'j', 'La')],
      platforms: [plat('Pa', 1, 'bin'), plat('Pb', 1, 'bin'), plat('Pz', 1, 'bin')],
    });
    const { events } = firePulse(level, createState(level), 'S');
    expect(of(events, 'latchOpen').map((e) => e.latch)).toEqual(['Lz', 'La', 'Lb']);
    // every latch opens before any platform moves
    const firstTilt = types(events).indexOf('tilt');
    expect(types(events).lastIndexOf('latchOpen')).toBeLessThan(firstTilt);
    expect(of(events, 'tilt').map((e) => e.platform)).toEqual(['Pz', 'Pa', 'Pb']);
  });

  it('test_tilt_switches_conductors_before_it_moves_balls', () => {
    const level = machine({
      goal: 2,
      nodes: [src('S', 3), joint('a'), latch('L', 1, 'P')],
      edges: [wire('e1', 'S', 'L'), wire('k', 'S', 'a', false)],
      platforms: [plat('P', 2, 'bin', { closes: ['k'] })],
    });
    const { events } = firePulse(level, createState(level), 'S');
    expect(types(events).slice(-4)).toEqual(['tilt', 'edge', 'balls', 'settle']);
  });

  it('test_balls_rest_on_a_flat_platform', () => {
    const level = machine({
      goal: 2,
      nodes: [src('S', 3), latch('L', 1, 'P1'), latch('L2', 9, 'P2')],
      edges: [wire('e1', 'S', 'L')],
      platforms: [plat('P1', 2, 'P2'), plat('P2', 0, 'bin')],
    });
    const { state } = firePulse(level, createState(level), 'S');
    expect(state.balls).toEqual({ P1: 0, P2: 2 });
    expect(state.bin).toBe(0);
  });

  it('test_balls_run_through_a_tilted_platform', () => {
    // Lower latch is nearer, so the chute P2 tilts before P1 releases its balls.
    const level = machine({
      goal: 2,
      nodes: [src('S', 5), joint('j'), latch('L1', 1, 'P1'), latch('L2', 1, 'P2')],
      edges: [wire('e1', 'S', 'L2'), wire('e2', 'S', 'j'), wire('e3', 'j', 'L1')],
      platforms: [plat('P1', 2, 'P2'), plat('P2', 0, 'bin')],
    });
    const { state, events } = firePulse(level, createState(level), 'S');
    expect(of(events, 'tilt').map((e) => e.platform)).toEqual(['P2', 'P1']);
    expect(of(events, 'balls').map((e) => [e.from, e.to, e.count])).toEqual([
      ['P1', 'P2', 2],
      ['P2', 'bin', 2],
    ]);
    expect(state.bin).toBe(2);
  });

  it('test_overloaded_balance_tips_and_chains', () => {
    const level = machine({
      goal: 6,
      nodes: [src('S', 3), latch('L', 1, 'P1')],
      edges: [wire('e1', 'S', 'L')],
      platforms: [
        plat('P1', 2, 'P2'),
        plat('P2', 1, 'P3', { tipsAtLoad: 3 }),
        plat('P3', 3, 'bin', { tipsAtLoad: 6 }),
      ],
    });
    const { state, events } = firePulse(level, createState(level), 'S');
    expect(of(events, 'tilt').map((e) => [e.platform, e.cause])).toEqual([
      ['P1', 'latch'],
      ['P2', 'load'],
      ['P3', 'load'],
    ]);
    expect(state.bin).toBe(6);
  });

  it('test_balance_below_its_load_does_not_tip', () => {
    const level = machine({
      goal: 5,
      nodes: [src('S', 3), latch('L', 1, 'P1')],
      edges: [wire('e1', 'S', 'L')],
      platforms: [plat('P1', 2, 'P2'), plat('P2', 0, 'bin', { tipsAtLoad: 3 })],
    });
    const { state } = firePulse(level, createState(level), 'S');
    expect(state.tilted.P2).toBe(false);
    expect(state.balls.P2).toBe(2);
  });

  it('test_balls_sent_to_the_void_are_lost', () => {
    const level = machine({
      goal: 1,
      nodes: [src('S', 3), latch('L', 1, 'P')],
      edges: [wire('e1', 'S', 'L')],
      platforms: [plat('P', 2, 'void'), plat('Q', 1, 'bin')],
    });
    const { state } = firePulse(level, createState(level), 'S');
    expect(state.lost).toBe(2);
    expect(state.bin).toBe(0);
  });
});

describe('win and loss', () => {
  it('test_win_when_bin_reaches_goal', () => {
    const level = line(3, 0, 1);
    const { state, events } = firePulse(level, createState(level), 'S');
    expect(state.status).toBe('won');
    expect(events.at(-1)).toEqual({ type: 'settle', status: 'won', bin: 3, lossReason: undefined });
  });

  it('test_loss_when_pulses_run_out', () => {
    const level = { ...line(3, 1, 2), pulses: 1 }; // 1 heat per pulse, needs 2, one pulse
    const { state } = playSequence(level, ['S']);
    expect(state.status).toBe('lost');
    expect(state.lossReason).toBe('out-of-pulses');
    expect(state.pulsesLeft).toBe(0);
  });

  it('test_still_playing_while_the_goal_is_reachable', () => {
    const level = { ...line(3, 1, 2), pulses: 3 };
    const { state } = firePulse(level, createState(level), 'S');
    expect(state.status).toBe('playing');
    expect(state.pulsesLeft).toBe(2);
  });

  it('test_loss_as_soon_as_the_goal_is_unreachable', () => {
    // The only balls go to the void: one pulse in, nothing can reach the bin any more.
    const level = machine({
      pulses: 3,
      goal: 1,
      nodes: [src('S', 3), latch('L', 1, 'P')],
      edges: [wire('e1', 'S', 'L')],
      platforms: [plat('P', 2, 'void')],
    });
    const { state } = firePulse({ ...level, goal: 1 }, createState(level), 'S');
    expect(state.status).toBe('lost');
    expect(state.lossReason).toBe('unreachable');
    expect(state.pulsesLeft).toBe(2);
  });

  it('test_each_pulse_spends_exactly_one', () => {
    const level = { ...line(3, 1, 9), pulses: 3 };
    const { state } = playSequence({ ...level, goal: 3 }, ['S']);
    expect(state.pulsesLeft).toBe(2);
    expect(state.history).toEqual(['S']);
  });

  it('test_nothing_happens_after_the_level_is_over', () => {
    const level = line(3, 0, 1);
    const won = firePulse(level, createState(level), 'S').state;
    const again = firePulse(level, won, 'S');
    expect(again.events).toEqual([]);
    expect(again.state).toBe(won);
  });

  it('test_firing_something_that_is_not_a_source_changes_nothing', () => {
    const level = line(3, 1, 1);
    const start = createState(level);
    expect(firePulse(level, start, 'j1').events).toEqual([]);
    expect(firePulse(level, start, 'nope').state).toBe(start);
  });
});

describe('level validation', () => {
  it('test_well_formed_machine_has_no_problems', () => {
    expect(validateLevel(line(3, 1, 1))).toEqual([]);
  });

  it('test_looping_ball_route_is_reported', () => {
    const level = machine({
      nodes: [src('S', 3)],
      platforms: [plat('P1', 1, 'P2'), plat('P2', 0, 'P1')],
    });
    expect(validateLevel(level).some((p) => p.includes('loops'))).toBe(true);
  });

  it('test_unknown_ids_are_reported', () => {
    const level = machine({
      nodes: [src('S', 3), latch('L', 1, 'ghost')],
      edges: [wire('e1', 'S', 'nowhere')],
      platforms: [plat('P', 1, 'bin', { opens: ['missing'] })],
    });
    expect(validateLevel(level)).toHaveLength(3);
  });
});
