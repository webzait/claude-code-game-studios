import { describe, expect, it } from 'vitest';
import { SOUNDS } from '../../src/audio';
import { CONFIG } from '../../src/config';
import { DEFAULT_LAB } from '../../src/game/lab';
import { defaultSave, loadSave, migrate, SAVE_VERSION, writeSave, type KeyValueStore } from '../../src/game/save';
import { analyse } from '../../src/music/analyse';
import { MusicController, renderInSlices, type MusicOutput, type MusicState } from '../../src/music/player';
import { barsOf, hertz, INSTRUMENT_NAMES, loopSamples, midiOf, notesOf, parsePhrase, renderLoop, type Loop, type Score, type Voice } from '../../src/music/synth';
import { DEFAULT_VARIANT, isMusicVariant, MUSIC_VARIANTS, renderOptionsOf, scoreOf, type MusicVariant } from '../../src/music/tracks';

/** The seven notes of C major as pitch classes: the key the sound effects are in. */
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11];
/** Register the music stays in: from the low E of a bass to the C two octaves above middle C. */
const LOWEST = midiOf('E2');
const HIGHEST = midiOf('C6');
/** A tolerance for sums of 32-bit samples made in a different order. */
const SAMPLE_NOISE = 1e-4;

/** Each variant rendered once for the whole file; a render is the slow part. */
const LOOPS = new Map<MusicVariant, Loop>();
const loopOf = (variant: MusicVariant): Loop => {
  if (!LOOPS.has(variant)) LOOPS.set(variant, renderLoop(scoreOf(variant), renderOptionsOf(variant)));
  return LOOPS.get(variant)!;
};

/** A music output that only writes down what it is asked. */
function recorder(): MusicOutput & { calls: string[] } {
  const calls: string[] = [];
  return { calls, prepare: (v) => calls.push(`prepare ${v}`), play: (v) => calls.push(`play ${v}`), stop: (atOnce) => calls.push(atOnce ? 'cut' : 'fade') };
}
const SCREENS = ['map', 'level'];
const state = (over: Partial<MusicState> = {}): MusicState => ({ enabled: true, variant: 'meadow', screen: 'map', visible: true, ...over });

function memory(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

describe('music scores', () => {
  it('offers two or three variants and the configured one is among them', () => {
    expect(MUSIC_VARIANTS.length).toBeGreaterThanOrEqual(2);
    expect(MUSIC_VARIANTS.length).toBeLessThanOrEqual(3);
    expect(isMusicVariant(CONFIG.music.variant)).toBe(true);
    expect(DEFAULT_VARIANT).toBe(CONFIG.music.variant);
    expect(isMusicVariant('toString')).toBe(false);
  });

  it.each(MUSIC_VARIANTS)('%s adds up: every bar is full, every phrase and chord exists, every instrument is known', (variant) => {
    const score = scoreOf(variant);
    const notes = notesOf(score);
    expect(notes.length).toBeGreaterThan(0);
    for (const voice of score.voices) expect(INSTRUMENT_NAMES).toContain(voice.instrument);
    expect(CONFIG.music.tempo[variant]).toBeGreaterThan(0);
    expect(score.title.length).toBeGreaterThan(0);
    expect(score.mood.length).toBeGreaterThan(0);
  });

  it.each(MUSIC_VARIANTS)('%s uses only the notes of C major, within a gentle register', (variant) => {
    for (const note of notesOf(scoreOf(variant))) {
      if (note.instrument === 'shaker') continue;
      expect(WHITE_KEYS).toContain(note.midi % 12);
      expect(note.midi).toBeGreaterThanOrEqual(LOWEST);
      expect(note.midi).toBeLessThanOrEqual(HIGHEST);
    }
  });

  it('the sound effects are in C major too, so effect and music cannot sound out of tune together', () => {
    for (const notes of Object.values(SOUNDS)) {
      for (const [frequency] of notes) {
        // Bumps are a low thud, not a pitch.
        if (frequency < 200) continue;
        const midi = 69 + 12 * Math.log2(frequency / 440);
        expect(Math.abs(midi - Math.round(midi))).toBeLessThan(0.2);
        expect(WHITE_KEYS).toContain(((Math.round(midi) % 12) + 12) % 12);
      }
    }
  });

  it('the variants differ in tempo and in the instruments they use', () => {
    const tempos = MUSIC_VARIANTS.map((v) => CONFIG.music.tempo[v]);
    expect(new Set(tempos).size).toBe(MUSIC_VARIANTS.length);
    const line = (v: MusicVariant): string => scoreOf(v).voices.map((voice) => voice.instrument).sort().join(' ');
    expect(new Set(MUSIC_VARIANTS.map(line)).size).toBe(MUSIC_VARIANTS.length);
  });

  it('reads note names, chord tones, rests and lengths', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('A4')).toBe(69);
    expect(hertz(69)).toBe(440);
    const voice: Voice = { instrument: 'marimba', gain: 1, pan: 0, step: 0.5, phrases: {}, form: '' };
    const chord = { bass: 48, tones: [60, 64, 67] };
    const notes = parsePhrase('0 . 2:1 b:1 f C5:1 *', voice, chord, 8);
    expect(notes.map((n) => [n.midi, n.beat, n.beats])).toEqual([[60, 8, 0.5], [67, 9, 1], [48, 10, 1], [55, 11, 0.5], [72, 11.5, 1], [60, 12.5, 0.5], [64, 12.5, 0.5], [67, 12.5, 0.5]]);
  });

  it('plays an off-beat eighth late when the score swings', () => {
    const voice: Voice = { instrument: 'marimba', gain: 1, pan: 0, step: 0.5, phrases: {}, form: '' };
    const notes = parsePhrase('0 0 0 0', voice, { bass: 48, tones: [60] }, 0, 0.1);
    expect(notes.map((n) => n.beat)).toEqual([0, 0.6, 1, 1.6]);
  });

  it('refuses a score that does not add up', () => {
    const base = scoreOf('meadow');
    const voice = base.voices[0];
    expect(() => notesOf({ ...base, voices: [{ ...voice, form: 'a a' }] })).toThrow(/bars/);
    expect(() => notesOf({ ...base, voices: [{ ...voice, phrases: { ...voice.phrases, a: '0 2 3' } }] })).toThrow(/beats/);
    expect(() => notesOf({ ...base, voices: [{ ...voice, form: voice.form.replace('a', 'zz') }] })).toThrow(/phrase/);
  });
});

describe('music loops', () => {
  it.each(MUSIC_VARIANTS)('%s is exactly its bars long, and long enough not to wear thin', (variant) => {
    const score = scoreOf(variant);
    const options = renderOptionsOf(variant);
    const loop = loopOf(variant);
    const seconds = (barsOf(score).length * score.beatsPerBar * 60) / options.bpm;
    expect(loop.left.length).toBe(loopSamples(score, options));
    expect(loop.right.length).toBe(loop.left.length);
    expect(Math.abs(loop.seconds - seconds)).toBeLessThan(1 / options.sampleRate);
    expect(loop.seconds).toBeGreaterThan(45);
    expect(loop.seconds).toBeLessThan(120);
  });

  it.each(MUSIC_VARIANTS)('%s has no click at the loop point', (variant) => {
    const report = analyse(loopOf(variant));
    // The jump from the last sample to the first is no larger than jumps inside the loop.
    expect(report.seamStep).toBeLessThanOrEqual(report.largestStep);
    // And no jump anywhere is a click: a step of a quarter of full scale would be one.
    expect(report.largestStep).toBeLessThan(0.25);
  });

  it.each(MUSIC_VARIANTS)('%s is levelled, never overdrives, has no offset and no silent stretch', (variant) => {
    const report = analyse(loopOf(variant));
    expect(report.peak).toBeLessThanOrEqual(CONFIG.music.peakLimit + SAMPLE_NOISE);
    expect(report.rms).toBeLessThanOrEqual(CONFIG.music.level + SAMPLE_NOISE);
    expect(report.rms).toBeGreaterThan(CONFIG.music.level * 0.5);
    expect(Math.abs(report.dcOffset)).toBeLessThan(0.001);
    expect(report.quietestSecond).toBeGreaterThan(report.rms * 0.25);
    expect(report.loudestSecond).toBeLessThan(report.rms * 2);
    // Soft sounds only: next to nothing in the range where harshness lives.
    expect(report.energyAbove4kHz).toBeLessThan(0.01);
    for (const sample of [loopOf(variant).left, loopOf(variant).right]) expect(sample.every(Number.isFinite)).toBe(true);
  });

  it.each(MUSIC_VARIANTS)('%s leaves room for the loudest sound effect on top', (variant) => {
    const musicPeak = analyse(loopOf(variant)).peak * CONFIG.music.volume;
    // The most notes of one effect that sound at the same moment, each at the effects' volume.
    const overlap = Math.max(...Object.values(SOUNDS).map((notes) => Math.max(...notes.map(([, start]) => notes.filter(([, s, length]) => s <= start && start < s + length).length))));
    expect(musicPeak + overlap * CONFIG.audio.volume).toBeLessThan(1);
    // The music sits under the effects, not over them.
    expect(analyse(loopOf(variant)).rms * CONFIG.music.volume).toBeLessThan(CONFIG.audio.volume);
  });

  it('renders the same samples every time', () => {
    const again = renderLoop(scoreOf('stroll'), renderOptionsOf('stroll'));
    expect(again.left).toEqual(loopOf('stroll').left);
    expect(again.right).toEqual(loopOf('stroll').right);
  });

  it('wraps ringing notes round the end: starting the piece two bars later gives the same loop, turned', () => {
    // 60 beats a minute at 24000 samples a second: a bar of four beats is exactly 96000 samples.
    const options = { bpm: 60, sampleRate: 24000, level: 0, peakLimit: 1 };
    const voice = (form: string): Voice => ({ instrument: 'keys', gain: 0.3, pan: -0.2, step: 1, phrases: { a: '0 1 2 1', b: '2:2 0:2', c: '*:3 b:1' }, form });
    const chords = { C: { bass: 48, tones: [60, 64, 67] }, F: { bass: 41, tones: [57, 60, 65] } };
    const score = (progression: string, form: string): Score => ({ title: 't', mood: 'm', beatsPerBar: 4, chords, progression, voices: [voice(form)] });
    const straight = renderLoop(score('C F C F', 'a b c -'), options);
    const turned = renderLoop(score('C F C F', 'c - a b'), options);
    const shift = 2 * 96000;
    let worst = 0;
    for (let i = 0; i < straight.left.length; i++) worst = Math.max(worst, Math.abs(straight.left[i] - turned.left[(i + shift) % turned.left.length]));
    expect(worst).toBeLessThan(SAMPLE_NOISE);
    // The last bar is written as silence, yet it still rings: the tail of bar three is there.
    expect(Math.abs(straight.left[3 * 96000 + 100])).toBeGreaterThan(0);
  });

  it('renders in slices with pauses between them, to the same result', async () => {
    let clock = 0;
    let pauses = 0;
    // Every look at the clock costs a millisecond, so a slice of 5 ms ends after a few notes.
    const loop = await renderInSlices('drift', 5, async () => void pauses++, () => clock++);
    expect(pauses).toBeGreaterThan(10);
    expect(loop.left).toEqual(loopOf('drift').left);
  });
});

describe('music controller', () => {
  it('prepares the music at once but plays nothing before the first touch', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state());
    music.set({ screen: 'level' });
    music.set({ visible: true });
    expect(out.calls).toEqual(['prepare meadow']);
    expect(music.playing).toBeNull();
  });

  it('starts at the first touch, once', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state());
    music.unlock();
    music.unlock();
    music.set({ screen: 'level' });
    expect(out.calls).toEqual(['prepare meadow', 'play meadow']);
    expect(music.playing).toBe('meadow');
  });

  it('is cut when the page goes to the background and comes back with it', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state());
    music.unlock();
    music.set({ visible: false });
    expect(music.playing).toBeNull();
    music.set({ visible: true });
    expect(out.calls).toEqual(['prepare meadow', 'play meadow', 'cut', 'play meadow']);
  });

  it('does not start in the background, even after a touch', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state({ visible: false }));
    music.unlock();
    expect(music.playing).toBeNull();
    music.set({ visible: true });
    expect(music.playing).toBe('meadow');
  });

  it('follows the Music setting: off fades it out, on brings it back', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state());
    music.unlock();
    music.set({ enabled: false });
    expect(music.playing).toBeNull();
    music.set({ enabled: true });
    expect(out.calls).toEqual(['prepare meadow', 'play meadow', 'fade', 'play meadow']);
  });

  it('stays silent, and prepares nothing, when the setting is off from the start', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state({ enabled: false }));
    music.unlock();
    music.set({ screen: 'level' });
    expect(out.calls).toEqual([]);
    music.set({ enabled: true });
    expect(out.calls).toEqual(['play meadow']);
  });

  it('plays on the screens that have music and fades out on the others', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state());
    music.unlock();
    music.set({ screen: 'level' });
    music.set({ screen: 'elsewhere' });
    music.set({ screen: 'map' });
    expect(out.calls).toEqual(['prepare meadow', 'play meadow', 'fade', 'play meadow']);
  });

  it('plays on the level screen and the puzzle screen of the game as configured', () => {
    expect(CONFIG.music.screens).toContain('map');
    expect(CONFIG.music.screens).toContain('level');
  });

  it('switches to another variant when the lab picks one', () => {
    const out = recorder();
    const music = new MusicController(out, SCREENS, state());
    music.unlock();
    music.set({ variant: 'drift' });
    music.set({ variant: 'drift' });
    expect(out.calls).toEqual(['prepare meadow', 'play meadow', 'play drift']);
    expect(music.playing).toBe('drift');
  });
});

describe('music setting', () => {
  const ids = ['a', 'b'];

  it('is on for a new player and separate from the sound effects', () => {
    const save = defaultSave();
    expect(save.settings.music).toBe(true);
    expect(save.settings.mute).toBe(false);
  });

  it('is kept between visits, whatever the Sound setting says', () => {
    for (const [music, mute] of [[false, false], [false, true], [true, true], [true, false]]) {
      const store = memory();
      const save = defaultSave();
      save.settings.music = music;
      save.settings.mute = mute;
      expect(writeSave(store, save)).toBe(true);
      const back = loadSave(store, ids);
      expect(back.settings.music).toBe(music);
      expect(back.settings.mute).toBe(mute);
    }
  });

  it('migrates version 6 (no music): everything is kept and the music starts switched on', () => {
    const save = migrate({ version: 6, best: { a: 7 }, coins: 73, paid: { a: 20 }, economy: 2, settings: { mute: true, colourShapes: true }, lab: { unlockAll: true } }, ids);
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.best).toEqual({ a: 7 });
    expect(save.coins).toBe(73);
    expect(save.settings).toEqual({ mute: true, music: true, reduceMotion: null, colourShapes: true });
    expect(save.lab.unlockAll).toBe(true);
    expect(save.lab.music).toBe(DEFAULT_LAB.music);
  });

  it('reads only a real on or off', () => {
    expect(migrate({ version: SAVE_VERSION, settings: { music: false } }, ids).settings.music).toBe(false);
    expect(migrate({ version: SAVE_VERSION, settings: { music: 'no' } }, ids).settings.music).toBe(true);
    expect(migrate({ version: SAVE_VERSION, settings: {} }, ids).settings.music).toBe(true);
  });

  it('keeps the variant picked in the test lab and drops one that does not exist', () => {
    expect(DEFAULT_LAB.music).toBe(CONFIG.music.variant);
    for (const variant of MUSIC_VARIANTS) expect(migrate({ version: SAVE_VERSION, lab: { music: variant } }, ids).lab.music).toBe(variant);
    expect(migrate({ version: SAVE_VERSION, lab: { music: 'polka' } }, ids).lab.music).toBe(DEFAULT_LAB.music);
    expect(migrate({ version: SAVE_VERSION, lab: { music: 3 } }, ids).lab.music).toBe(DEFAULT_LAB.music);
  });
});
