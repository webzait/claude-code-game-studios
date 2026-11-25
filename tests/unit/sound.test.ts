// Button sounds (design/button-sounds.md): the sets, when a move's sounds play, the fast-tapping rule,
// and what can be measured about every sound without hearing it.
import { describe, expect, it } from 'vitest';
import config from '../../data/config.json';
import data from '../../data/sound-sets.json';
import { DEFAULT_LAB } from '../../src/game/lab';
import { defaultSave, migrate, SAVE_VERSION } from '../../src/game/save';
import { busyPeak, buttonFacts, CHECK_RATE, soundFacts } from '../../src/sound/report';
import { BASE_SET, BUTTON_SOUNDS, isSoundSet, movePlan, rapidGain, SOUND_NAMES, soundGroup, soundSet, soundSetIds, tuningOf, type SoundName } from '../../src/sound/sets';
import { envelope, measure, MIN_ATTACK, recipeSeconds, renderRecipe, type Layer } from '../../src/sound/synth';

const LIMITS = config.audio.limits;
const RAPID = config.audio.rapid;
const IDS = soundSetIds();
const NEW_SETS = IDS.filter((id) => id !== BASE_SET);
const PRESSES: SoundName[] = ['press-red', 'press-blue', 'press-yellow', 'press-forward'];
const rawLayers = (): { set: string; sound: string; layer: Layer }[] =>
  Object.entries(data).flatMap(([set, raw]) => Object.entries(raw.sounds).flatMap(([sound, recipe]) => (typeof recipe === 'string' ? [] : (recipe as Layer[]).map((layer) => ({ set, sound, layer })))));

describe('sound sets: the catalogue', () => {
  it('test_sets_offers_three_to_five_sets_with_names', () => {
    expect(IDS.length).toBeGreaterThanOrEqual(3);
    expect(IDS.length).toBeLessThanOrEqual(5);
    for (const id of IDS) {
      const set = soundSet(id);
      expect(set.name.length).toBeGreaterThan(0);
      expect(set.blurb.length).toBeGreaterThan(0);
      expect(set.nl.name.length).toBeGreaterThan(0);
      expect(set.nl.blurb.length).toBeGreaterThan(0);
    }
    expect(new Set(IDS.map((id) => soundSet(id).name)).size).toBe(IDS.length);
  });

  it('test_sets_configured_default_exists_and_is_the_lab_default', () => {
    expect(isSoundSet(config.audio.set)).toBe(true);
    expect(DEFAULT_LAB.soundSet).toBe(config.audio.set);
  });

  it('test_sets_every_set_has_tuning_in_config_and_config_names_no_other', () => {
    expect(Object.keys(config.audio.sets).sort()).toEqual([...IDS].sort());
  });

  it('test_sets_data_names_only_known_sounds_and_waves', () => {
    for (const [id, raw] of Object.entries(data)) {
      for (const [name, recipe] of Object.entries(raw.sounds)) {
        expect(SOUND_NAMES, `${id}/${name}`).toContain(name);
        if (typeof recipe === 'string') expect(SOUND_NAMES, `${id}/${name} points at`).toContain(recipe);
      }
      expect(['tap', 'motion']).toContain(raw.timing);
    }
    for (const { set, sound, layer } of rawLayers()) {
      expect(['sine', 'triangle', 'square', 'saw', 'noise'], `${set}/${sound}`).toContain(layer.wave);
      expect(layer.length, `${set}/${sound}`).toBeGreaterThan(0);
      expect(layer.attack ?? MIN_ATTACK, `${set}/${sound}`).toBeGreaterThanOrEqual(MIN_ATTACK);
    }
  });

  it('test_sets_base_set_answers_every_shared_sound', () => {
    const base = soundSet(BASE_SET);
    for (const name of SOUND_NAMES.filter((n) => !n.startsWith('press-'))) expect(base.recipes[name].length, name).toBeGreaterThan(0);
  });

  it('test_sets_every_new_set_covers_colours_forward_turn_step_and_refusal', () => {
    for (const id of NEW_SETS) {
      const set = soundSet(id);
      expect(set.timing, id).toBe('motion');
      for (const name of BUTTON_SOUNDS) {
        expect(set.own, `${id}/${name}`).toContain(name);
        expect(set.recipes[name].length, `${id}/${name}`).toBeGreaterThan(0);
      }
    }
  });

  it('test_sets_the_three_colours_and_forward_differ_within_a_set', () => {
    for (const id of NEW_SETS) {
      const rendered = PRESSES.map((name) => Array.from(renderRecipe(soundSet(id).recipes[name], { sampleRate: 8000 })).join(','));
      expect(new Set(rendered).size, id).toBe(PRESSES.length);
    }
  });

  it('test_sets_shared_sounds_are_the_same_in_every_set', () => {
    for (const name of ['exit', 'win', 'fail', 'scan', 'coin'] as const) {
      for (const id of IDS) {
        expect(soundSet(id).recipes[name], `${id}/${name}`).toEqual(soundSet(BASE_SET).recipes[name]);
        expect(tuningOf(soundSet(id), name)).toEqual(id === BASE_SET ? { gain: soundSet(id).gain, pitch: soundSet(id).pitch } : { gain: 1, pitch: 0 });
      }
    }
  });

  it('test_sets_unknown_id_gives_the_default_set', () => {
    expect(soundSet('no-such-set').id).toBe(config.audio.set);
    expect(isSoundSet('no-such-set')).toBe(false);
    expect(isSoundSet('toString')).toBe(false);
    expect(isSoundSet(3)).toBe(false);
  });

  it('test_sets_classic_refusal_is_its_bump', () => {
    expect(soundSet(BASE_SET).recipes.deny).toEqual(soundSet(BASE_SET).recipes.bump);
  });
});

describe('sound sets: when a move sounds', () => {
  it('test_move_plan_tap_timing_plays_one_sound_at_the_touch_as_before', () => {
    expect(movePlan('red', ['moved', 'blocked-wall'], true, 'tap')).toEqual({ tap: ['turn'], turn: [], step: [] });
    expect(movePlan('forward', ['moved'], false, 'tap')).toEqual({ tap: ['step'], turn: [], step: [] });
    expect(movePlan('blue', ['blocked-wall', 'blocked-robot'], true, 'tap')).toEqual({ tap: ['bump'], turn: [], step: [] });
    expect(movePlan('forward', ['moved', 'exited'], false, 'tap')).toEqual({ tap: ['exit'], turn: [], step: [] });
  });

  it('test_move_plan_motion_timing_answers_the_button_then_follows_the_robots', () => {
    expect(movePlan('red', ['moved'], true, 'motion')).toEqual({ tap: ['press-red'], turn: ['turn'], step: ['step'] });
    expect(movePlan('blue', ['moved'], true, 'motion').tap).toEqual(['press-blue']);
    expect(movePlan('yellow', ['moved'], true, 'motion').tap).toEqual(['press-yellow']);
    expect(movePlan('forward', ['moved'], false, 'motion')).toEqual({ tap: ['press-forward'], turn: [], step: ['step'] });
  });

  it('test_move_plan_motion_colour_without_such_robot_turning_has_no_turn_sound', () => {
    expect(movePlan('yellow', ['moved'], false, 'motion').turn).toEqual([]);
  });

  it('test_move_plan_motion_all_blocked_bumps_and_an_exit_sounds_the_exit', () => {
    expect(movePlan('forward', ['blocked-wall', 'blocked-wall'], false, 'motion').step).toEqual(['bump']);
    expect(movePlan('red', ['exited', 'blocked-wall'], true, 'motion').step).toEqual(['exit']);
  });
});

describe('sound sets: fast tapping', () => {
  it('test_rapid_first_sound_is_full', () => {
    expect(rapidGain(5, undefined, RAPID)).toBe(1);
  });

  it('test_rapid_same_sound_inside_min_gap_is_skipped', () => {
    expect(rapidGain(1 + RAPID.minGap / 2, 1, RAPID)).toBe(0);
  });

  it('test_rapid_same_sound_inside_soft_window_is_softer', () => {
    expect(rapidGain(1 + (RAPID.minGap + RAPID.softWindow) / 2, 1, RAPID)).toBe(RAPID.softGain);
    expect(RAPID.softGain).toBeLessThan(1);
    expect(RAPID.softGain).toBeGreaterThan(0);
  });

  it('test_rapid_after_soft_window_is_full_again', () => {
    expect(rapidGain(1 + RAPID.softWindow, 1, RAPID)).toBe(1);
  });

  it('test_rapid_min_gap_is_too_short_to_swallow_a_deliberate_tap', () => {
    // Nobody taps the same button twice within a twentieth of a second on purpose.
    expect(RAPID.minGap).toBeLessThanOrEqual(0.05);
  });

  it('test_groups_buttons_and_robots_each_sound_one_at_a_time', () => {
    for (const name of [...PRESSES, 'tap', 'deny'] as const) expect(soundGroup(name)).toBe('press');
    for (const name of ['turn', 'step', 'bump'] as const) expect(soundGroup(name)).toBe('motion');
    for (const name of ['exit', 'win', 'fail', 'scan', 'coin'] as const) expect(soundGroup(name)).toBeNull();
  });
});

describe('synthesiser', () => {
  const beep: Layer[] = [{ wave: 'sine', freq: 440, length: 0.1 }];

  it('test_render_length_is_the_recipe_length', () => {
    expect(recipeSeconds([{ wave: 'sine', freq: 440, at: 0.05, length: 0.1 }, { wave: 'noise', length: 0.02 }])).toBeCloseTo(0.15, 6);
    expect(renderRecipe(beep, { sampleRate: 8000 }).length).toBe(801);
    expect(renderRecipe([], { sampleRate: 8000 }).every((v) => v === 0)).toBe(true);
  });

  it('test_render_is_the_same_every_time_noise_included', () => {
    const noisy: Layer[] = [{ wave: 'noise', length: 0.02, filter: { type: 'bandpass', freq: 2000, q: 2 } }];
    expect(Array.from(renderRecipe(noisy, { sampleRate: 8000 }))).toEqual(Array.from(renderRecipe(noisy, { sampleRate: 8000 })));
  });

  it('test_render_gain_scales_the_peak', () => {
    const full = measure(renderRecipe(beep, { sampleRate: CHECK_RATE }), CHECK_RATE).peak;
    expect(measure(renderRecipe(beep, { sampleRate: CHECK_RATE, gain: 0.5 }), CHECK_RATE).peak).toBeCloseTo(full / 2, 5);
  });

  it('test_render_pitch_of_twelve_semitones_doubles_the_frequency', () => {
    const crossings = (samples: Float32Array): number => samples.reduce((n, v, i) => n + (i > 0 && samples[i - 1] <= 0 && v > 0 ? 1 : 0), 0);
    const steady: Layer[] = [{ wave: 'sine', freq: 400, length: 0.1 }];
    const low = crossings(renderRecipe(steady, { sampleRate: CHECK_RATE }));
    const high = crossings(renderRecipe(steady, { sampleRate: CHECK_RATE, pitch: 12 }));
    expect(low).toBeGreaterThanOrEqual(39);
    expect(low).toBeLessThanOrEqual(41);
    expect(Math.abs(high - 2 * low)).toBeLessThanOrEqual(1);
  });

  it('test_envelope_starts_and_ends_on_silence_and_never_exceeds_one', () => {
    expect(envelope(0, 0.1, 0.005)).toBe(0);
    expect(envelope(0.1, 0.1, 0.005)).toBe(0);
    expect(envelope(0.005, 0.1, 0.005)).toBeCloseTo(1, 6);
    for (let t = 0; t <= 0.1; t += 0.0005) expect(envelope(t, 0.1, 0.005)).toBeLessThanOrEqual(1);
  });

  it('test_envelope_attack_shorter_than_the_minimum_is_raised_to_it', () => {
    expect(envelope(MIN_ATTACK / 2, 0.1, 0)).toBeCloseTo(0.5, 6);
  });

  it('test_measure_reports_peak_onset_and_edges', () => {
    const m = measure(new Float32Array([0, 0.2, 1, 0.5, 0.05, 0]), 1000);
    expect(m.peak).toBe(1);
    expect(m.onsetMs).toBe(2);
    expect(m.heardMs).toBe(3);
    expect(m.edge).toBe(0);
    expect(measure(new Float32Array([0.5, 1, 0.5]), 1000).edge).toBe(0.5);
  });
});

describe('every sound, measured as the game plays it', () => {
  it('test_measured_every_sound_starts_and_ends_on_exact_silence', () => {
    for (const id of IDS) for (const name of SOUND_NAMES) expect(soundFacts(id, name).edge, `${id}/${name}`).toBe(0);
  });

  it('test_measured_no_sample_is_not_a_number', () => {
    for (const id of IDS) for (const name of SOUND_NAMES) expect(Number.isFinite(soundFacts(id, name).peak), `${id}/${name}`).toBe(true);
  });

  it('test_measured_button_sounds_are_short', () => {
    for (const id of IDS) {
      for (const f of buttonFacts(id)) {
        const limit = soundGroup(f.name) === 'motion' ? LIMITS.motionSeconds : f.name === 'deny' ? LIMITS.denySeconds : LIMITS.pressSeconds;
        expect(f.seconds, `${id}/${f.name}`).toBeLessThanOrEqual(limit);
      }
    }
  });

  it('test_measured_button_sounds_answer_at_once', () => {
    for (const id of IDS) for (const f of buttonFacts(id)) expect(f.onsetMs, `${id}/${f.name}`).toBeLessThanOrEqual(LIMITS.onsetMs);
  });

  it('test_measured_no_button_sound_is_louder_than_the_limit', () => {
    for (const id of IDS) for (const f of buttonFacts(id)) expect(f.peak, `${id}/${f.name}`).toBeLessThanOrEqual(LIMITS.peak);
  });

  it('test_measured_robot_sounds_are_softer_than_the_buttons_in_the_new_sets', () => {
    for (const id of NEW_SETS) {
      const press = Math.min(...PRESSES.map((name) => soundFacts(id, name).peak));
      for (const name of ['turn', 'step'] as const) expect(soundFacts(id, name).peak, `${id}/${name}`).toBeLessThan(press);
    }
  });

  it('test_measured_sets_are_about_equally_loud', () => {
    // Peak of the loudest button of each new set within 3 dB of each other, so a comparison is about character, not loudness.
    const tops = NEW_SETS.map((id) => Math.max(...PRESSES.map((name) => soundFacts(id, name).peak)));
    expect(Math.max(...tops) / Math.min(...tops)).toBeLessThan(Math.SQRT2);
  });

  it('test_measured_a_busy_moment_stays_below_distortion', () => {
    for (const id of IDS) expect(busyPeak(id), id).toBeLessThanOrEqual(LIMITS.busyPeak);
  });

  it('test_measured_same_at_44100_and_48000', () => {
    for (const id of IDS) {
      for (const name of BUTTON_SOUNDS) {
        const a = soundFacts(id, name, 44100);
        const b = soundFacts(id, name, 48000);
        expect(a.edge, `${id}/${name}`).toBe(0);
        expect(Math.abs(a.seconds - b.seconds), `${id}/${name}`).toBeLessThan(0.001);
      }
    }
  });
});

describe('sound set in the save', () => {
  it('test_save_keeps_a_chosen_set', () => {
    const other = IDS.find((id) => id !== config.audio.set)!;
    const save = migrate({ version: SAVE_VERSION, lab: { soundSet: other } }, []);
    expect(save.lab.soundSet).toBe(other);
  });

  it('test_save_set_that_no_longer_exists_falls_back_to_default', () => {
    expect(migrate({ version: SAVE_VERSION, lab: { soundSet: 'removed-set' } }, []).lab.soundSet).toBe(config.audio.set);
    expect(migrate({ version: SAVE_VERSION, lab: {} }, []).lab.soundSet).toBe(config.audio.set);
    expect(defaultSave().lab.soundSet).toBe(config.audio.set);
  });

  it('test_save_mute_setting_survives', () => {
    expect(migrate({ version: SAVE_VERSION, settings: { mute: true } }, []).settings.mute).toBe(true);
  });
});
