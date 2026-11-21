// PROTOTYPE - NOT FOR PRODUCTION
// Question: Geeft het activeren van één warmtebron een verrassende maar begrijpelijke mechanische kettingreactie?
// Date: 2026-11-21
//
// Game flow: scenes, input, HUD. The engine decides, the diorama shows, this file connects them.

import { CONFIG, tune } from './config';
import { createState, firePulse, sourceIds } from './engine/engine';
import type { GameState, LevelDef } from './engine/types';
import { LEVELS, latchSeat } from './levels/levels';
import { Diorama } from './view/diorama';

type Scene = 'title' | 'play' | 'results' | 'figures';

declare global {
  interface Window {
    GAME_CLOCK?: { now: () => number };
    game: unknown;
  }
}

const params = new URLSearchParams(location.search);
const STEP = 1 / 60; // simulation step in seconds; motion is per second, never per frame
const CHEAP = params.get('render') === 'cheap'; // a headless shot or check: 3D draws cheap; players never see it
const clock = window.GAME_CLOCK || { now: () => performance.now() / 1000 };

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>('game');
const hud = $('hud');
const titleEl = $('title');
const card = $('card');
const fade = $('fade');
const labels = $('labels');

const diorama = new Diorama(canvas, CHEAP);

// ---- state: what window.game.state reports ------------------------------------------------
const state = {
  t: 0,
  seed: Number(params.get('seed')) || CONFIG.seed,
  level: 1,
  levels: LEVELS.length,
  bin: 0, // balls visibly in the bin
  goal: 0,
  pulses: 0,
  pulsesLeft: 0,
  status: 'playing' as GameState['status'],
  lossReason: '' as string,
  busy: false,
  attempts: LEVELS.map(() => 0),
  completed: [] as number[],
  goalReached: false, // every level finished
  score: 0, // balls caught over the whole run
};
let scene: Scene = 'title';
let logic: GameState = createState(LEVELS[0]);
let level: LevelDef = LEVELS[0];
const events: unknown[] = [];

// ---- step timers: nothing in the game waits on the real clock ------------------------------
let timers: { at: number; fn: () => void }[] = [];
const after = (seconds: number, fn: () => void) => timers.push({ at: state.t + seconds, fn });
let fadeTarget = 0;
let fadeNow = 0;

// ---- HUD -----------------------------------------------------------------------------------
function drawPips(): void {
  const pips = $('pips');
  pips.replaceChildren();
  for (let i = 0; i < state.pulses; i++) {
    const pip = document.createElement('i');
    if (i >= state.pulsesLeft) pip.className = 'spent';
    pips.append(pip);
  }
}

function drawCount(bump = false): void {
  const bin = $('bin');
  bin.textContent = String(state.bin);
  $('goal').textContent = String(state.goal);
  $('bar').style.width = `${Math.min(100, (state.bin / Math.max(1, state.goal)) * 100)}%`;
  if (bump) {
    bin.classList.remove('bump');
    void bin.offsetWidth;
    bin.classList.add('bump');
  }
}

function showCard(title: string, text: string, main: string, onMain: () => void, list: [string, string][] = [], second?: [string, () => void]): void {
  $('card-title').textContent = title;
  $('card-text').textContent = text;
  const ul = $('card-list');
  ul.replaceChildren();
  for (const [a, b] of list) {
    const li = document.createElement('li');
    const left = document.createElement('span');
    const right = document.createElement('span');
    left.textContent = a;
    right.textContent = b;
    li.append(left, right);
    ul.append(li);
  }
  const mainBtn = $<HTMLButtonElement>('card-main');
  mainBtn.textContent = main;
  mainBtn.onclick = onMain;
  cardMain = onMain;
  const secondBtn = $<HTMLButtonElement>('card-second');
  secondBtn.hidden = !second;
  if (second) {
    secondBtn.textContent = second[0];
    secondBtn.onclick = second[1];
  }
  card.hidden = false;
  hud.classList.add('carded');
}
let cardMain: (() => void) | null = null;

function hideCard(): void {
  card.hidden = true;
  cardMain = null;
  hud.classList.remove('carded');
}

// ---- levels --------------------------------------------------------------------------------
function loadLevel(n: number, countAttempt = true): void {
  level = LEVELS[n - 1];
  logic = createState(level);
  diorama.load(level);
  diorama.interactive = true;
  state.level = n;
  state.bin = 0;
  state.goal = level.goal;
  state.pulses = level.pulses;
  state.pulsesLeft = level.pulses;
  state.status = 'playing';
  state.lossReason = '';
  state.busy = false;
  if (countAttempt) state.attempts[n - 1]++;
  timers = [];
  hideCard();
  $('reset').classList.remove('nudge');
  $('lvl-num').textContent = `${n} / ${LEVELS.length}`;
  $('lvl-name').textContent = level.name;
  $('hint').textContent = level.hint;
  drawPips();
  drawCount();
}

/** Fades to black, runs `swap`, fades back in. */
function transition(swap: () => void): void {
  fadeTarget = 1;
  state.busy = true;
  after(0.28, () => {
    swap();
    fadeTarget = 0;
  });
}

function startGame(): void {
  if (scene !== 'title') return;
  transition(() => {
    scene = 'play';
    titleEl.hidden = true;
    hud.hidden = false;
    state.attempts = LEVELS.map(() => 0);
    state.completed = [];
    state.goalReached = false;
    state.score = 0;
    loadLevel(Number(params.get('level')) || 1);
  });
}

function resetLevel(): void {
  if (scene !== 'play') return;
  loadLevel(state.level);
}

function nextLevel(): void {
  if (state.level >= LEVELS.length) {
    showResults();
    return;
  }
  transition(() => loadLevel(state.level + 1));
}

function showResults(): void {
  scene = 'results';
  state.goalReached = true;
  const list = LEVELS.map((l, i): [string, string] => [
    `${l.id}  ${l.name}`,
    state.attempts[i] === 1 ? 'in één keer' : `${state.attempts[i]} pogingen`,
  ]);
  showCard('Machine voltooid', `Alle vijf levels opgelost. ${state.score} bolletjes opgevangen.`, 'Opnieuw spelen', () => {
    transition(() => {
      scene = 'title';
      hideCard();
      hud.hidden = true;
      titleEl.hidden = false;
      diorama.load(LEVELS[0]);
      state.busy = false;
    });
  }, list);
}

function fire(sourceId: string): void {
  if (scene !== 'play' || state.busy || logic.status !== 'playing') return;
  const result = firePulse(level, logic, sourceId);
  if (result.events.length === 0) return;
  logic = result.state;
  state.busy = true;
  state.pulsesLeft = logic.pulsesLeft;
  drawPips();
  events.push({ t: state.t, fire: sourceId, level: state.level });
  const loaded = level;
  diorama.play(result.events, {
    onBin: (count) => {
      state.bin = count;
      drawCount(true);
    },
    onDone: () => {
      if (loaded !== level) return;
      state.bin = logic.bin;
      drawCount();
      state.status = logic.status;
      state.lossReason = logic.lossReason ?? '';
      if (logic.status === 'playing') {
        state.busy = false;
        return;
      }
      diorama.interactive = false;
      after(tune.end_delay, () => {
        state.busy = false;
        if (logic.status === 'won') {
          if (!state.completed.includes(state.level)) state.completed.push(state.level);
          state.score += logic.bin;
          const used = level.pulses - logic.pulsesLeft;
          showCard(
            'Level gehaald',
            `${logic.bin} bolletjes in ${used} ${used === 1 ? 'puls' : 'pulsen'}.`,
            state.level >= LEVELS.length ? 'Afronden' : 'Volgende',
            nextLevel,
          );
        } else {
          $('reset').classList.add('nudge');
          const stuck = logic.lossReason === 'unreachable';
          showCard(
            stuck ? 'Vastgelopen' : 'Pulsen op',
            stuck
              ? `${logic.bin} van ${level.goal}. Met de pulsen die over zijn is het doel niet meer haalbaar.`
              : `${logic.bin} van ${level.goal} bolletjes. Probeer een andere bron of volgorde.`,
            'Opnieuw',
            resetLevel,
          );
        }
      });
    },
  });
}

// ---- the parts catalogue (?scene=figures) ---------------------------------------------------
function loadFigures(): void {
  const pf = { id: 'PF', pos: [-1.15, 6.3] as [number, number], width: 1.5, low: 'right' as const, balls: 3, dropsTo: 'PB' };
  const pb = {
    id: 'PB',
    pos: [1.1, 4.6] as [number, number],
    width: 1.5,
    low: 'left' as const,
    balls: 2,
    dropsTo: 'bin',
    tipsAtLoad: 4,
    closes: ['sw'],
  };
  const seat = latchSeat(pf);
  const figures: LevelDef = {
    id: 0,
    name: 'Onderdelen',
    hint: '',
    pulses: 1,
    goal: 1,
    platforms: [pf, pb],
    nodes: [
      { id: 'S', kind: 'source', pos: [-1.6, 3.2], strength: 3 },
      { id: 'J', kind: 'junction', pos: [-1.6, 4.6] },
      { id: 'J2', kind: 'junction', pos: [-0.3, 4.6] },
      { id: 'J3', kind: 'junction', pos: [-0.3, seat[1]] },
      { id: 'L', kind: 'latch', pos: seat, threshold: 2, releases: 'PF' },
    ],
    edges: [
      { id: 'e1', a: 'S', b: 'J', closed: true },
      { id: 'sw', a: 'J', b: 'J2', closed: false },
      { id: 'e2', a: 'J2', b: 'J3', closed: true },
      { id: 'e3', a: 'J3', b: 'L', closed: true },
    ],
    solution: ['S'],
  };
  diorama.load(figures);
  diorama.interactive = true;
  const names: [string, number, number][] = [
    ['Warmtebron', -1.6, 2.75],
    ['Knooppunt', -1.6, 5.0],
    ['Contact', -0.95, 4.42],
    ['Geleider', -0.3, 5.45],
    ['Sluiting', seat[0], seat[1] - 0.3],
    ['Platform', -1.3, 7.0],
    ['Bolletje', -0.75, 7.35],
    ['Weegplatform', 1.1, 4.05],
    ['Opvangbak', 0, 1.6],
  ];
  figureLabels = names;
}
let figureLabels: [string, number, number][] = [];

function placeLabels(): void {
  if (labels.childElementCount !== figureLabels.length) {
    labels.replaceChildren(
      ...figureLabels.map(([name]) => {
        const s = document.createElement('span');
        s.textContent = name;
        return s;
      }),
    );
  }
  figureLabels.forEach(([, x, y], i) => {
    const p = diorama.project(x, y, 0.5);
    const el = labels.children[i] as HTMLElement;
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
  });
}

// ---- input ---------------------------------------------------------------------------------
const hit = new Set<string>();

function onKey(code: string): void {
  if (code === 'Enter' || code === 'Space') {
    if (scene === 'title') startGame();
    else if (cardMain && !state.busy) cardMain();
  } else if (code === 'KeyR') resetLevel();
  else if (/^Digit[1-9]$/.test(code) && scene === 'play') {
    const id = sourceIds(level)[Number(code.slice(5)) - 1];
    if (id) fire(id);
  }
}

addEventListener('keydown', (e) => {
  if (e.repeat) return;
  hit.add(e.code);
  if (e.code === 'Space') e.preventDefault();
});
canvas.addEventListener('pointerdown', (e) => {
  if (scene !== 'play') return;
  const id = diorama.pickSource(e.clientX, e.clientY);
  if (id) fire(id);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  const over = scene === 'play' && !state.busy && diorama.pickSource(e.clientX, e.clientY);
  canvas.style.cursor = over ? 'pointer' : 'default';
});
$('start').addEventListener('click', startGame);
$('reset').addEventListener('click', resetLevel);
addEventListener('resize', () => diorama.resize());
addEventListener('contextmenu', (e) => e.preventDefault());

// ---- loop: fixed step, frame time clamped --------------------------------------------------
function step(): void {
  for (const code of hit) onKey(code);
  hit.clear();
  state.t += STEP;
  if (timers.length > 0) {
    const due = timers.filter((t) => t.at <= state.t);
    timers = timers.filter((t) => t.at > state.t);
    due.forEach((t) => t.fn());
  }
  fadeNow += Math.sign(fadeTarget - fadeNow) * Math.min(Math.abs(fadeTarget - fadeNow), STEP / 0.26);
  diorama.advance(STEP);
}

function drawFrame(): void {
  fade.style.opacity = String(fadeNow);
  if (scene === 'figures') placeLabels();
  diorama.render();
}

let last = clock.now();
let acc = 0;
function tick(): void {
  const now = clock.now();
  acc += Math.min(now - last, 0.25); // a stall never fast-forwards the game
  last = now;
  while (acc >= STEP) {
    step();
    acc -= STEP;
  }
  drawFrame();
}
function frame(): void {
  tick();
  requestAnimationFrame(frame);
}
// A headless browser on a time budget runs timers but almost no animation frames.
function timer(): void {
  if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick();
}

// ---- what a check can read and drive (?manual=1 stops the loop; players never see it) -------
window.game = {
  get scene() {
    return scene;
  },
  get state() {
    return state;
  },
  press(code: string) {
    hit.add(code);
  },
  hold(_code: string, _on: boolean) {},
  get events() {
    return events;
  },
  /** Where a source's button is on screen, so a check can tap it the way a player does. */
  where(id: string) {
    return diorama.sourceScreen(id);
  },
  step(n = 1, draw = true) {
    for (let i = 0; i < n; i++) step();
    if (draw) drawFrame();
  },
};

// ---- boot ----------------------------------------------------------------------------------
const first = params.get('scene');
if (first === 'figures') {
  scene = 'figures';
  loadFigures();
} else if (first === 'play') {
  scene = 'play';
  hud.hidden = false;
  loadLevel(Number(params.get('level')) || 1);
} else {
  scene = 'title';
  titleEl.hidden = false;
  diorama.load(LEVELS[0]);
}
last = clock.now();
if (params.get('manual') === '1') drawFrame();
else {
  requestAnimationFrame(frame);
  setInterval(timer, 50);
}
