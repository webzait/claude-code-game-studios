// The listening page's script: the same synth, scores and settings as the game, bundled into one page.
import { SOUNDS } from '../../../src/audio';
type SoundName = string;
import { CONFIG } from '../../../src/config';
import { renderInSlices } from '../../../src/music/player';
import type { Loop } from '../../../src/music/synth';
import { MUSIC_VARIANTS, scoreOf, type MusicVariant } from '../../../src/music/tracks';

/** Dutch words for the listener; the game's own texts are English. */
const WORDS: Record<MusicVariant, { name: string; mood: string }> = {
  meadow: { name: 'Meadow (weide)', mood: 'Licht en zonnig: een houten marimba-patroon met een klein duimpiano-wijsje erboven.' },
  drift: { name: 'Drift (drijven)', mood: 'Langzaam en zwevend: zachte piano-akkoorden met een paar lange belletjes. De rustigste van de drie.' },
  stroll: { name: 'Stroll (wandeling)', mood: 'Een vrolijke wandeling: verende bas, zachte getokkelde akkoorden, een lichte shaker en een speels wijsje. De levendigste van de drie.' },
};
const EFFECTS: [SoundName, string][] = [['tap', 'Tik'], ['step', 'Stap'], ['turn', 'Draai'], ['bump', 'Bots'], ['exit', 'Uitgang'], ['coin', 'Munt'], ['win', 'Gewonnen'], ['fail', 'Mislukt']];
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
const STOP = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

let ctx: AudioContext | null = null;
let volume = CONFIG.music.volume;
const buffers = new Map<MusicVariant, Promise<AudioBuffer>>();
let now: { variant: MusicVariant; source: AudioBufferSourceNode; gain: GainNode; startedAt: number; offset: number; seconds: number } | null = null;
let wanted: MusicVariant | null = null;

function context(): AudioContext {
  ctx ??= new AudioContext();
  if (ctx.state !== 'running') void ctx.resume();
  return ctx;
}

function bufferOf(variant: MusicVariant): Promise<AudioBuffer> {
  if (!buffers.has(variant)) {
    buffers.set(
      variant,
      renderInSlices(variant, 12).then((loop: Loop) => {
        const buffer = context().createBuffer(2, loop.left.length, loop.sampleRate);
        buffer.getChannelData(0).set(loop.left);
        buffer.getChannelData(1).set(loop.right);
        return buffer;
      }),
    );
  }
  return buffers.get(variant)!;
}

function stop(): void {
  wanted = null;
  if (!now || !ctx) return;
  const at = ctx.currentTime;
  now.gain.gain.cancelScheduledValues(at);
  now.gain.gain.setValueAtTime(now.gain.gain.value, at);
  now.gain.gain.linearRampToValueAtTime(0, at + 0.15);
  now.source.stop(at + 0.2);
  now = null;
  draw();
}

async function play(variant: MusicVariant, from = 0): Promise<void> {
  stop();
  wanted = variant;
  context();
  $('status').textContent = `${WORDS[variant].name} wordt klaargezet…`;
  draw();
  const buffer = await bufferOf(variant);
  if (wanted !== variant) return;
  $('status').textContent = '';
  const c = context();
  const source = c.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.4);
  source.connect(gain).connect(c.destination);
  source.start(c.currentTime, from % buffer.duration);
  now = { variant, source, gain, startedAt: c.currentTime, offset: from, seconds: buffer.duration };
  draw();
}

/** One sound effect, exactly as the game makes it. */
function effect(name: SoundName): void {
  const c = context();
  const at = c.currentTime;
  for (const [frequency, start, length, type] of SOUNDS[name]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type ?? 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, at + start);
    gain.gain.linearRampToValueAtTime(CONFIG.audio.volume, at + start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + start + length);
    osc.connect(gain).connect(c.destination);
    osc.start(at + start);
    osc.stop(at + start + length + 0.02);
  }
}

function draw(): void {
  for (const variant of MUSIC_VARIANTS) {
    const on = now?.variant === variant;
    const waiting = wanted === variant && !on;
    const card = $(`card-${variant}`);
    card.classList.toggle('on', on);
    const button = card.querySelector<HTMLButtonElement>('.play')!;
    button.innerHTML = on ? STOP : PLAY;
    button.disabled = waiting;
    button.setAttribute('aria-label', `${on ? 'Stop' : 'Speel'} ${WORDS[variant].name}`);
  }
}

function tick(): void {
  for (const variant of MUSIC_VARIANTS) {
    const card = $(`card-${variant}`);
    const on = now?.variant === variant && ctx;
    const at = on ? (now!.offset + ctx!.currentTime - now!.startedAt) % now!.seconds : 0;
    card.querySelector<HTMLElement>('.bar i')!.style.width = on ? `${(at / now!.seconds) * 100}%` : '0';
    card.querySelector<HTMLElement>('.at')!.textContent = clock(at);
  }
  requestAnimationFrame(tick);
}

function start(): void {
  for (const variant of MUSIC_VARIANTS) {
    const score = scoreOf(variant);
    const bpm = CONFIG.music.tempo[variant];
    const seconds = (score.progression.trim().split(/\s+/).length * score.beatsPerBar * 60) / bpm;
    const card = document.createElement('article');
    card.className = 'card';
    card.id = `card-${variant}`;
    card.innerHTML = `<div class="head"><button type="button" class="play" id="play-${variant}">${PLAY}</button><div><h2>${WORDS[variant].name}</h2><p class="facts">${bpm} tellen per minuut · herhaalt na ${clock(seconds)}</p></div></div><p>${WORDS[variant].mood}</p><div class="bar"><i></i></div><div class="row"><span class="time"><span class="at">0:00</span> / ${clock(seconds)}</span><button type="button" class="chip" id="seam-${variant}">Naar het herhaalpunt</button></div>`;
    $('cards').appendChild(card);
    card.querySelector('.play')!.addEventListener('click', () => (now?.variant === variant ? stop() : void play(variant)));
    // Ten beats before the end: enough to hear the last notes run into the first ones.
    card.querySelector('.chip')!.addEventListener('click', () => void play(variant, seconds - (10 * 60) / bpm));
  }
  for (const [name, label] of EFFECTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.id = `fx-${name}`;
    button.textContent = label;
    button.addEventListener('click', () => effect(name));
    $('effects').appendChild(button);
  }
  const slider = $<HTMLInputElement>('volume');
  slider.value = String(volume);
  const show = (): void => {
    $('volume-out').textContent = volume.toFixed(2);
  };
  slider.addEventListener('input', () => {
    volume = Number(slider.value);
    if (now && ctx) now.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
    show();
  });
  show();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
  });
  draw();
  tick();
}
start();
