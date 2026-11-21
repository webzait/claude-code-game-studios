// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The shell: the fixed-step loop, input, the screens and the HUD. Rules live in game/, physics
// in sim/, drawing in render/, levels in levels/*.json.
import { Progress } from './game/progress';
import { EXTRA_MOVES_REWARD, createStandInServices } from './game/services';
import { Session, TICK } from './game/session';
import { LEVELS } from './levels/index';
import { View } from './render/view';
import type { LevelData, Tuning } from './sim/types';
import { Sound } from './ui/audio';

type Scene = 'title' | 'play' | 'pause' | 'results' | 'over' | 'figures';
interface Cfg { [k: string]: { value: number } | number }
interface GameWindow {
  CONFIG: Cfg; GAME_CLOCK?: { now(): number };
  game?: unknown;
}
const win = window as unknown as GameWindow;
const params = new URLSearchParams(location.search);
/** Live tuning: tune.gravity is CONFIG.gravity.value, read each time it is needed. */
const tune = new Proxy({}, { get: (_, k: string) => (win.CONFIG[k] as { value: number }).value }) as Tuning & { volume: number };
const STEP = TICK; // 1/60 s game tick (two simulation steps); motion is per second, never per frame
const CHEAP = params.get('render') === 'cheap';
const clock = win.GAME_CLOCK ?? { now: () => performance.now() / 1000 };
const events: unknown[] = [];

const services = createStandInServices();
let storage: Storage | null = null;
try { storage = window.localStorage; } catch { storage = null; }
const progress = new Progress(storage);
const sound = new Sound(() => tune.volume);
const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = new View(canvas, tune, CHEAP, services.skins.marblePalette());
const $ = (id: string): HTMLElement => document.getElementById(id)!;

/** The pieces of the game side by side, for the outline check (?scene=figures). */
const FIGURES: LevelData = {
  id: 'figures', name: 'Figures', moves: 0, par: 0, target: 1, tray: { w: 8, d: 6 },
  anchors: [{ x: -1.2, z: 1.2, r: 1.1, heights: [-0.4] }, { x: 1.2, z: 1.2, r: 1.1, heights: [0.6] }],
  catchers: [{ x: -2.6, z: -1.3, r: 0.7 }], walls: [{ x1: -0.6, z1: -1.4, x2: 0.8, z2: -1.4, t: 0.14 }],
  pegs: [{ x: 2.6, z: -1.4, r: 0.2 }], marbles: [{ x: -3.2, z: 1.4, count: 3, spacing: 0.5 }], solution: [],
};
const FIGURE_LABELS: [string, number, number][] = [['Marble', -3.2, 2.3], ['Clamp, down', -1.2, 2.3], ['Clamp, up', 1.2, 2.3],
  ['Catcher', -2.6, -0.2], ['Wall', 0.1, -0.7], ['Peg', 2.6, -0.7]];

let scene: Scene = 'title';
let levelIndex = 0;
let session: Session;
let endTimer = 0;
const hit = new Set<string>(), down = new Set<string>();
const state = { t: 0, score: 0, level: 1, target: 0, movesLeft: 0, phase: 'idle', stars: 0, goalReached: false, gained: '' };

function startLevel(i: number): void {
  levelIndex = Math.max(0, Math.min(LEVELS.length - 1, i));
  session = new Session(scene === 'figures' ? FIGURES : LEVELS[levelIndex], tune);
  view.setWorld(session.world); endTimer = 0; hudKey = '';
  services.analytics.track('level_start', { level: session.level.id });
}

function setScene(s: Scene): void {
  scene = s;
  $('hud').classList.toggle('off', s === 'title' || s === 'figures');
  $('hint').classList.toggle('off', s !== 'play');
  const card = $('card'); card.classList.toggle('on', s !== 'play' && s !== 'figures');
  if (s === 'title') panel(`<h1 class="logo">FLEXFALL</h1><p>Tap a clamp. The floor bends.<br>Catch the marbles.</p>
    <p class="keys">Touch or click a clamp · keys 1-9<br>R restart · P pause · M sound</p>
    <button class="big" data-act="play">Play</button>${chips()}`);
  if (s === 'pause') panel(`<h1>Paused</h1><p>Level ${levelIndex + 1} · ${session.level.name}</p>
    <button class="big" data-act="resume">Resume</button><button class="big alt" data-act="restart">Restart level</button>${chips()}`);
  if (s === 'results') {
    const n = session.stars(), last = levelIndex === LEVELS.length - 1;
    panel(`<div class="stars">${[1, 2, 3].map(k => star(k <= n)).join('')}</div><h1>${last ? 'All clear' : 'Cleared'}</h1>
      <p>${session.collected} marbles caught in ${session.movesUsed} ${session.movesUsed === 1 ? 'tap' : 'taps'}</p>
      ${n < 3 ? `<p class="keys">Three stars: ${session.level.par} ${session.level.par === 1 ? 'tap' : 'taps'}</p>` : ''}
      <button class="big" data-act="next">${last ? 'Play again from level 1' : 'Next level'}</button><button class="big alt" data-act="restart">Replay this level</button>`);
  }
  if (s === 'over') {
    const offer = services.ads.rewardedReady('extra_moves');
    panel(`<h1>Out of taps</h1><p>${session.collected} of ${session.target} marbles caught</p>
      <button class="big" data-act="restart">Try again</button>
      ${offer ? `<button class="big alt" data-act="reward">+${EXTRA_MOVES_REWARD} taps</button>` : ''}`);
  }
}
const star = (on: boolean): string => `<svg viewBox="0 0 24 24" class="${on ? 'on' : ''}"><path d="M12 2.2l2.9 6.2 6.8.8-5 4.7 1.3 6.7-6-3.3-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>`;
const chips = (): string => `<div class="chips">${LEVELS.map((l, i) =>
  `<button class="chip${i === levelIndex ? ' cur' : ''}" data-act="level" data-i="${i}" aria-label="Level ${i + 1}, ${progress.data.stars[l.id] ?? 0} stars">${i + 1}</button>`).join('')}</div>`;
function panel(html: string): void { $('panel').innerHTML = html; }

function act(a: string, i = 0): void {
  sound.start();
  if (a === 'play') { startLevel(levelIndex); setScene('play'); }
  if (a === 'resume') setScene('play');
  if (a === 'restart') { startLevel(levelIndex); setScene('play'); }
  if (a === 'next') { startLevel(levelIndex === LEVELS.length - 1 ? 0 : levelIndex + 1); setScene('play'); }
  if (a === 'level') { startLevel(i); setScene('play'); }
  if (a === 'pause' && scene === 'play') setScene('pause');
  if (a === 'mute') { sound.setMuted(!sound.muted); $('mute-x').setAttribute('d', sound.muted ? 'M16 9l5 6M21 9l-5 6' : 'M17 9a4 4 0 0 1 0 6'); }
  if (a === 'reward') void services.ads.showRewarded('extra_moves').then(ok => { if (ok && session.grantMoves(EXTRA_MOVES_REWARD)) setScene('play'); });
}

function tapAnchor(i: number): void {
  if (scene !== 'play') return;
  const a = session.level.anchors[i];
  if (!a) return;
  const before = a.heights[session.world.aIndex[i]];
  if (session.tap(i)) {
    view.onTap(i); sound.flex(a.heights[session.world.aIndex[i]] > before);
    services.analytics.track('tap', { level: session.level.id, anchor: i });
  } else sound.refuse();
}

// ---- Input: one finger. Keys mirror it for desktop and for the checks. --------------------
canvas.addEventListener('pointerdown', e => { sound.start(); if (scene === 'play') { const i = view.pick(e.clientX, e.clientY); if (i >= 0) tapAnchor(i); } });
canvas.addEventListener('pointermove', e => { view.hover = e.pointerType === 'mouse' && scene === 'play' ? view.pick(e.clientX, e.clientY) : -1; canvas.style.cursor = view.hover >= 0 ? 'pointer' : 'default'; });
document.addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (b) act(b.dataset.act!, Number(b.dataset.i ?? 0));
});
$('b-restart').dataset.act = 'restart'; $('b-pause').dataset.act = 'pause'; $('b-mute').dataset.act = 'mute';
addEventListener('keydown', e => {
  sound.start();
  if (!e.repeat) { down.add(e.code); hit.add(e.code); }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', e => down.delete(e.code));
addEventListener('blur', () => down.clear());
addEventListener('resize', () => view.resize());
addEventListener('tune', () => sound.apply());
document.addEventListener('gesturestart', e => e.preventDefault());
const pressed = (code: string): boolean => hit.has(code);

// ---- One game tick -------------------------------------------------------------------------
function step(): void {
  if (pressed('KeyM')) act('mute');
  if (scene === 'title') { if (pressed('Enter') || pressed('Space')) act('play'); }
  else if (scene === 'pause') { if (pressed('KeyP') || pressed('Escape') || pressed('Enter')) act('resume'); else if (pressed('KeyR')) act('restart'); }
  else if (scene === 'results') { if (pressed('Enter') || pressed('Space')) act('next'); else if (pressed('KeyR')) act('restart'); }
  else if (scene === 'over') { if (pressed('KeyR') || pressed('Enter') || pressed('Space')) act('restart'); }
  else if (scene === 'play') {
    if (pressed('KeyP') || pressed('Escape')) act('pause');
    else if (pressed('KeyR')) act('restart');
    else for (let k = 1; k <= 9; k++) if (pressed('Digit' + k)) tapAnchor(k - 1);
  }
  hit.clear();
  if (scene === 'pause' || scene === 'title') return;
  view.snapshot();
  const was = session.phase;
  session.tick();
  state.t += STEP;
  let clacks = 0;
  for (const ev of session.world.events) {
    if (ev.type === 'catch') { view.onCatch(ev.id, ev.catcher, ev.x, ev.z); sound.plink(session.collected); bump(); }
    else if (clacks < 3 && ev.speed > 0.7) { sound.clack(ev.speed, ev.id); clacks++; }
  }
  session.world.events.length = 0;
  if (scene === 'play' && session.phase !== was && (session.phase === 'won' || session.phase === 'lost')) {
    endTimer = 0.55;
    if (session.phase === 'won') { sound.win(); progress.recordWin(session.level.id, levelIndex, session.stars()); } else sound.lose();
    services.analytics.track('level_end', { level: session.level.id, result: session.phase, taps: session.movesUsed, caught: session.collected });
    events.push({ type: session.phase, level: session.level.id });
  }
  if (scene === 'play' && endTimer > 0) { endTimer -= STEP; if (endTimer <= 0) setScene(session.phase === 'won' ? 'results' : 'over'); }
  Object.assign(state, { score: session.collected, level: levelIndex + 1, target: session.target, movesLeft: session.movesLeft, phase: session.phase,
    stars: session.stars(), goalReached: session.collected >= session.target,
    gained: session.phase === 'won' ? `${session.collected} marbles in ${session.movesUsed} taps` : '' });
}

// ---- HUD: marbles caught and taps left, always in view ------------------------------------
let hudKey = '';
function bump(): void { const c = $('count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
function hud(): void {
  const key = `${levelIndex}|${session.collected}|${session.movesLeft}|${session.phase}|${session.level.id}`;
  if (key === hudKey) return; hudKey = key;
  $('lvl-n').textContent = `Level ${levelIndex + 1}`; $('lvl-name').textContent = session.level.name;
  $('got').textContent = String(session.collected); $('need').textContent = String(session.target);
  $('count').classList.toggle('done', session.collected >= session.target);
  const total = session.level.moves + session.extraMoves;
  $('pips').innerHTML = Array.from({ length: total }, (_, i) => `<i class="pip${i < session.movesLeft ? '' : ' used'}"></i>`).join('');
  $('moves-t').textContent = `${session.movesLeft} ${session.movesLeft === 1 ? 'tap' : 'taps'} left`;
  $('hint-t').textContent = session.phase === 'moving' ? 'Rolling…' : session.phase === 'idle' ? (session.level.hint ?? 'Tap a clamp') : '';
  $('hint').style.visibility = $('hint-t').textContent ? 'visible' : 'hidden';
}

// ---- Loop: fixed step, frame time clamped --------------------------------------------------
let last = clock.now(), acc = 0, alpha = 1, lastFrame = last;
function tick(): void {
  const now = clock.now();
  acc += Math.min(now - last, 0.25); last = now; // a stall never fast-forwards the game
  while (acc >= STEP) { step(); acc -= STEP; }
  alpha = acc / STEP;
  drawFrame(Math.min(0.05, Math.max(0, now - lastFrame))); lastFrame = now;
}
function drawFrame(dt: number): void {
  hud();
  view.draw(scene === 'pause' ? 1 : alpha, scene === 'pause' ? 0 : dt, scene === 'play' && session.canTap());
  if (scene === 'figures' && !$('labels').childElementCount) {
    $('labels').innerHTML = FIGURE_LABELS.map(([name, x, z]) => { const p = view.project(x, z); return `<div style="left:${p.x}px;top:${p.y}px">${name}</div>`; }).join('');
  }
}
function frame(): void { tick(); requestAnimationFrame(frame); }
// A headless browser on a time budget runs timers but almost no animation frames.
function timer(): void { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }

// ---- What a check can read and drive (?manual=1 stops the loop; players never see it) -----
win.game = {
  get scene() { return scene; },
  get state() { return state; },
  get session() { return session; },
  get services() { return services; },
  press(code: string) { hit.add(code); },
  hold(code: string, on: boolean) { if (on) down.add(code); else down.delete(code); },
  get events() { return events; },
  step(n = 1, draw = true, a = 1) {
    for (let i = 0; i < n; i++) step();
    if (draw) { alpha = a; drawFrame(STEP); }
  },
};

const wanted = params.get('scene');
scene = wanted === 'figures' ? 'figures' : 'title';
const startAt = Number(params.get('level'));
startLevel(startAt >= 1 ? startAt - 1 : Math.min(progress.data.unlocked, LEVELS.length - 1));
setScene(wanted === 'play' ? 'play' : scene);
last = lastFrame = clock.now();
if (params.get('manual') === '1') drawFrame(STEP);
else { requestAnimationFrame(frame); setInterval(timer, 50); }
