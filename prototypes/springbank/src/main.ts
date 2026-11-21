// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is het opvangen en krachtig teruglanceren van dezelfde grote groep balletjes zo leuk dat spelers het steeds opnieuw willen doen?
// The game around the simulation: scenes, input (touch, mouse, keys), HUD, and the hooks a check drives.
import { DT, Sim, WORLD_W, type Input } from './sim/sim.ts';
import { LEVELS, type LevelDef } from './sim/levels.ts';
import { tune } from './sim/tune.ts';
import { View } from './view/view.ts';
import { Sound } from './view/audio.ts';

type SceneName = 'title' | 'play' | 'pause' | 'over' | 'results' | 'figures';
const params = new URLSearchParams(location.search);
const w = window as unknown as { GAME_CLOCK?: { now(): number }; game: unknown };
const STEP = 1 / 60; // the game's step; the physics runs SUB sub-steps of DT inside it
const SUB = Math.round(STEP / DT);
const END_STEPS = 70; // steps the board keeps moving after a win or a loss, before its screen
const clock = w.GAME_CLOCK || { now: () => performance.now() / 1000 };
const CHEAP = params.get('render') === 'cheap';
const $ = (id: string) => document.getElementById(id)!;

// Every piece of the board side by side, each named: the figures scene (?scene=figures).
const FIGURES: LevelDef = {
  name: 'Figuren', hint: '', balls: 9, launches: 9, target: 99, capacity: 6, trayStart: 2.2, streams: [2.2],
  goals: [{ x: 6.6, y: 11.6, w: 2.0, capacity: 6 }],
  pegs: [{ x: 5.2, y: 7.2, r: 0.32 }],
  bars: [{ x1: 6.6, y1: 7.0, x2: 8.2, y2: 7.4 }, { x1: 4.6, y1: 4.0, x2: 6.2, y2: 4.05, move: { dx: 1.0, dy: 0, period: 3.6 } }],
  solution: [],
};
const FIGURE_LABELS = [
  { text: 'opvangbak en veer', x: 2.2, y: 4.3 }, { text: 'balletje', x: 2.2, y: 9.0 }, { text: 'stroom', x: 2.2, y: 14.6 },
  { text: 'opvangdoel', x: 6.6, y: 10.9 }, { text: 'pin', x: 5.2, y: 6.4 }, { text: 'balk', x: 7.4, y: 6.3 }, { text: 'schuifdeur', x: 5.4, y: 3.3 },
];

const canvas = $('game') as HTMLCanvasElement;
const view = new View(canvas, CHEAP);
const sound = new Sound();
const events: unknown[] = []; // window.game.events: launches and scores, for a run to see

let scene: SceneName = 'title';
let sim: Sim;
let levelIndex = 0;
let endCount = 0;
let scoreCount = 0;
let hintGone = false;
/** The game's own state, as the checks read it. */
const state = { t: 0, level: 1, levels: LEVELS.length, balls: 0, scored: 0, target: 0, held: 0, charge: 0, launchesLeft: 0, status: 'playing', cleared: 0, gained: '' };

// ---- Input: one finger or the mouse; keys by position ---------------------------------
const down = new Set<string>(), hit = new Set<string>();
const pressed = (code: string) => hit.has(code);
let pointerId = -1, pointerHold = false, targetX = WORLD_W / 2;
function pointerX(e: PointerEvent): number { return view.worldX(e.clientX, e.clientY, canvas.getBoundingClientRect()); }
canvas.addEventListener('pointerdown', (e) => {
  sound.start(); e.preventDefault();
  if (pointerId !== -1) return; // one finger plays; a second touch is ignored
  pointerId = e.pointerId; pointerHold = true; targetX = pointerX(e);
  try { canvas.setPointerCapture(e.pointerId); } catch { /* an old browser: the window listeners below still end the hold */ }
});
canvas.addEventListener('pointermove', (e) => { if (e.pointerId === pointerId) targetX = pointerX(e); });
const pointerEnd = (e: PointerEvent) => { if (e.pointerId === pointerId) { pointerId = -1; pointerHold = false; } };
addEventListener('pointerup', pointerEnd); addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); // no rubber-band scroll on iPhone
addEventListener('keydown', (e) => {
  sound.start();
  if (!e.repeat) { down.add(e.code); hit.add(e.code); }
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
});
addEventListener('keyup', (e) => down.delete(e.code));
addEventListener('blur', () => { down.clear(); pointerHold = false; pointerId = -1; });
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'play') hit.add('KeyP'); });
$('btn-reset').addEventListener('click', () => { sound.start(); hit.add('KeyR'); });
$('btn-pause').addEventListener('click', () => { sound.start(); hit.add('KeyP'); });
$('btn-mute').addEventListener('click', () => { sound.start(); hit.add('KeyM'); });
$('go').addEventListener('click', () => { sound.start(); hit.add('Enter'); });
LEVELS.forEach((_, i) => {
  const b = document.createElement('button'); b.textContent = `${i + 1}`; b.setAttribute('aria-label', `Level ${i + 1}`);
  b.addEventListener('click', () => { sound.start(); levelIndex = i; hit.add('Enter'); });
  $('levels').appendChild(b);
});

// ---- Levels ------------------------------------------------------------------------------
/** Put the level back in its starting state: the same balls, the same stream, the same outcome for the same input. */
function loadLevel(i: number): void {
  levelIndex = i;
  sim = new Sim(LEVELS[i]);
  view.setSim(sim);
  targetX = sim.trayX; pointerHold = false; pointerId = -1; down.delete('Space');
  endCount = 0; scoreCount = 0; hintGone = false;
  state.gained = '';
  sync();
}
function sync(): void {
  state.level = levelIndex + 1; state.balls = sim.n; state.scored = sim.scored; state.target = sim.level.target;
  state.held = sim.held; state.charge = Math.round(sim.charge * 1000) / 1000; state.launchesLeft = sim.launchesLeft; state.status = sim.status;
}
function stepSim(input: Input): void {
  for (let k = 0; k < SUB; k++) {
    sim.step(input);
    for (const e of sim.events) {
      view.onEvent(e);
      if (e.type === 'catch') { sound.catch(e.held, sim.capacity); hintGone = true; }
      else if (e.type === 'launch') { sound.launch(e.power); events.push({ type: 'launch', count: e.count, speed: e.speed }); if (navigator.vibrate && !CHEAP) navigator.vibrate(Math.round(15 + 35 * e.power)); }
      else if (e.type === 'score') { sound.score(scoreCount++); events.push({ type: 'score', goal: e.goal }); }
      else if (e.type === 'full') sound.full();
      else if (e.type === 'won') sound.win();
      else if (e.type === 'lost') sound.lose();
    }
    sim.events.length = 0;
  }
  sync();
}

// ---- Scenes ------------------------------------------------------------------------------
const scenes: Record<SceneName, { update(dt: number): void }> = {
  figures: { update(dt) { state.t += dt; stepSim({ hold: true, targetX: 2.2 }); } },
  title: {
    update() { if (pressed('Enter') || pressed('Space')) { loadLevel(levelIndex); scene = 'play'; down.delete('Space'); } },
  },
  play: {
    update(dt) {
      if (pressed('KeyP') || pressed('Escape')) { scene = 'pause'; return; }
      if (pressed('KeyR')) { loadLevel(levelIndex); return; }
      state.t += dt;
      if (pointerId === -1) { // keys move the tray when no finger is down
        const dir = (down.has('ArrowRight') || down.has('KeyD') ? 1 : 0) - (down.has('ArrowLeft') || down.has('KeyA') ? 1 : 0);
        const half = tune.tray_width / 2 + 0.15;
        targetX = Math.min(WORLD_W - half, Math.max(half, (dir ? sim.trayX : targetX) + dir * tune.tray_speed * dt * 2));
      }
      stepSim({ hold: pointerHold || down.has('Space'), targetX });
      if (sim.status !== 'playing' && ++endCount >= END_STEPS) {
        if (sim.status === 'won') {
          state.cleared = Math.max(state.cleared, levelIndex + 1);
          state.gained = `Level ${levelIndex + 1} gehaald in ${sim.launchesUsed} ${sim.launchesUsed === 1 ? 'lancering' : 'lanceringen'}`;
          scene = 'results';
        } else { state.gained = `${sim.scored} van ${sim.level.target} in de doelen`; scene = 'over'; }
      }
    },
  },
  pause: { update() { if (pressed('KeyP') || pressed('Escape') || pressed('Enter')) scene = 'play'; else if (pressed('KeyR')) { loadLevel(levelIndex); scene = 'play'; } } },
  over: { update() { if (pressed('KeyR') || pressed('Enter') || pressed('Space')) { loadLevel(levelIndex); scene = 'play'; } } },
  results: {
    update() {
      if (pressed('KeyR')) { loadLevel(levelIndex); scene = 'play'; return; }
      if (!(pressed('Enter') || pressed('Space'))) return;
      if (levelIndex + 1 < LEVELS.length) { loadLevel(levelIndex + 1); scene = 'play'; }
      else { levelIndex = 0; loadLevel(0); scene = 'title'; }
    },
  },
};

// ---- HUD and screens: plain HTML over the canvas, changed only when something changed -----
let shown = '';
function drawHud(): void {
  const lv = sim.level, last = levelIndex + 1 >= LEVELS.length;
  const key = [scene, levelIndex, sim.scored, sim.launchesLeft, sound.muted, hintGone, sim.status].join('|');
  if (key !== shown) {
    shown = key;
    const playing = scene === 'play' || scene === 'pause' || scene === 'over' || scene === 'results';
    $('hud').hidden = !playing;
    $('level').textContent = `Level ${levelIndex + 1}`;
    $('scored').textContent = `${Math.min(sim.scored, lv.target)}`; $('target').textContent = `/ ${lv.target}`;
    $('pips').innerHTML = Array.from({ length: lv.launches }, (_, i) => `<b class="${i < sim.launchesLeft ? '' : 'used'}"></b>`).join('');
    $('btn-mute').classList.toggle('off', sound.muted);
    const hint = $('hint');
    hint.hidden = scene !== 'play'; hint.textContent = `${lv.name}. ${lv.hint}`; hint.style.opacity = hintGone ? '0' : '1';
    const card = (title: string, text: string, go: string, opts: { how?: boolean; levels?: boolean; plain?: boolean } = {}) => {
      $('overlay').hidden = false;
      $('card-title').textContent = title; $('card-title').classList.toggle('plain', !!opts.plain);
      $('card-text').textContent = text; $('go').textContent = go;
      $('howto').hidden = !opts.how; $('levels').hidden = !opts.levels; $('keys').hidden = !opts.how;
      ($('howto') as HTMLElement).style.display = opts.how ? '' : 'none';
    };
    if (scene === 'title') card('SPRINGBANK', 'Vang. Spaar. Lanceer.', 'Start', { how: true, levels: true });
    else if (scene === 'pause') card('Pauze', `${levelIndex + 1} · ${lv.name}`, 'Verder', { plain: true });
    else if (scene === 'over') card('Lanceringen op', `${state.gained}. Hetzelfde level, dezelfde start.`, 'Opnieuw', { plain: true });
    else if (scene === 'results') card(last ? 'Alle vijf gehaald' : 'Gehaald', `${state.gained}.`, last ? 'Terug naar start' : 'Volgend level', { plain: true });
    else $('overlay').hidden = true;
  }
}

// ---- Loop: fixed step, frame time clamped (the starter's loop) ---------------------------
function step(): void {
  if (pressed('KeyM')) sound.setMuted(!sound.muted);
  scenes[scene].update(STEP); hit.clear();
}
let last = 0, acc = 0, lastDraw = 0;
function drawFrame(): void {
  const now = clock.now(), dt = Math.min(0.05, Math.max(0, now - lastDraw)); lastDraw = now;
  drawHud();
  view.render(scene === 'pause' ? 0 : dt || STEP);
}
function tick(): void {
  const now = clock.now();
  acc += Math.min(now - last, 0.25); last = now; // a stall never fast-forwards the game
  while (acc >= STEP) { step(); acc -= STEP; }
  drawFrame();
}
function frame(): void { tick(); requestAnimationFrame(frame); }
function timer(): void { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }
function fit(): void { view.resize(innerWidth, innerHeight, 58); }
addEventListener('resize', fit); addEventListener('orientationchange', fit);
addEventListener('tune', () => sound.setMuted(sound.muted));

// ---- What a check can read and drive (?manual=1 stops the loop; players never see it) -----
w.game = {
  get scene() { return scene; },
  get state() { return state; },
  press(code: string) { hit.add(code); },
  hold(code: string, on: boolean) { if (on) down.add(code); else down.delete(code); },
  get events() { return events; },
  step(n = 1, draw = true) { for (let i = 0; i < n; i++) step(); if (draw) drawFrame(); },
};

const first = params.get('scene') as SceneName | null;
const startLevel = Math.min(LEVELS.length, Math.max(1, Number(params.get('level')) || 1)) - 1;
fit();
loadLevel(startLevel);
if (first === 'figures') { sim = new Sim(FIGURES); view.setSim(sim, FIGURE_LABELS); scene = 'figures'; }
else if (first && first in scenes) scene = first;
last = lastDraw = clock.now();
if (params.get('manual') === '1') drawFrame();
else { requestAnimationFrame(frame); setInterval(timer, 50); }
