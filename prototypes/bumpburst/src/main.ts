// PROTOTYPE - NOT FOR PRODUCTION
import './style.css';
import { tune, type ColorId } from './config';
import { Sfx } from './audio/sfx';
import { Game } from './game/game';
import { loadProgress, saveProgress } from './game/progress';
import { bindInput } from './input/input';
import { LEVELS } from './levels/levels';
import type { WorldEvent } from './physics/world';
import { View } from './render/view';
import { Hud } from './ui/hud';

const params = new URLSearchParams(location.search);
const progress = loadProgress();
const sfx = new Sfx();
sfx.muted = progress.muted;
const hud = new Hud();

/** Shows a problem on screen instead of leaving dead buttons, so it can be reported from a phone. */
function report(what: string, err: unknown): void {
  const el = document.getElementById('fps')!;
  el.hidden = false;
  el.style.pointerEvents = 'auto';
  el.style.whiteSpace = 'pre-wrap';
  el.style.right = '8px';
  el.textContent = `${what}: ${err instanceof Error ? err.message : String(err)}`;
}
window.addEventListener('error', (e) => report('Error', e.error ?? e.message));
window.addEventListener('unhandledrejection', (e) => report('Error', e.reason));

function makeView(): View {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  try {
    return new View(canvas);
  } catch (first) {
    // Second try without antialiasing, shadows or reflections, for a weak or restricted GPU.
    try {
      const fresh = canvas.cloneNode() as HTMLCanvasElement;
      canvas.replaceWith(fresh);
      return new View(fresh, true);
    } catch (second) {
      report('This browser could not start 3D graphics (WebGL)', second ?? first);
      throw second;
    }
  }
}
const view = makeView();
hud.setMuted(sfx.muted);

let levelIdx = 0;
let game = new Game(LEVELS[0]);
let prev = new Float32Array(0);
let acc = 0;
let dirty = 3;
let attempt = 0;
const events: WorldEvent[] = [];
const perf = { frames: 0, frameMs: 0, worstMs: 0, simMs: 0, fps: 0 };

function snapshotPrev(): void {
  for (const m of game.world.marbles) {
    prev[m.id * 2] = m.x;
    prev[m.id * 2 + 1] = m.y;
  }
}

function startLevel(idx: number): void {
  levelIdx = idx;
  attempt++;
  game = new Game(LEVELS[idx]);
  prev = new Float32Array(game.total * 2);
  snapshotPrev();
  acc = 0;
  view.load(game.level, game.world);
  hud.setLevel(game.level, game.colors);
  hud.update(game);
  hud.hideResult();
  dirty = 3;
}

function pulse(color: ColorId): void {
  if (hud.titleOpen || hud.resultOpen) return;
  sfx.unlock();
  // Game.pulse refuses while a pulse resolves, so a double tap can never spend two pulses.
  if (!game.pulse(color)) return;
  acc = 0;
  sfx.pulse(color);
  view.pulse(color);
  navigator.vibrate?.(12);
  hud.update(game);
}

function onSettled(): void {
  hud.update(game);
  if (game.phase !== 'won' && game.phase !== 'lost') return;
  const won = game.phase === 'won';
  if (won && game.level.id > progress.cleared) {
    progress.cleared = game.level.id;
    saveProgress(progress);
  }
  const mine = attempt;
  // A short beat so the last marble is seen dropping before the sheet covers the board.
  // (A later "watch an ad for +1 pulse" offer would sit here, calling game.grantExtraPulses.)
  setTimeout(() => {
    if (mine !== attempt) return;
    if (won) sfx.win();
    else sfx.lose();
    hud.showResult(game, levelIdx === LEVELS.length - 1);
  }, 520);
}

function confirm(): void {
  sfx.unlock();
  if (hud.titleOpen) {
    hud.hideTitle();
    startLevel(Math.min(progress.cleared, LEVELS.length - 1));
  } else if (hud.resultOpen) {
    if (game.phase === 'won') startLevel((levelIdx + 1) % LEVELS.length);
    else startLevel(levelIdx);
  }
}

bindInput(hud.buttons, {
  pulse,
  reset: () => {
    if (!hud.titleOpen) startLevel(levelIdx);
  },
  confirm,
  mute: () => {
    sfx.muted = progress.muted = !sfx.muted;
    hud.setMuted(sfx.muted);
    saveProgress(progress);
    sfx.unlock();
  },
  colors: () => game.colors,
});
document.getElementById('btn-play')!.addEventListener('click', confirm);
document.getElementById('res-main')!.addEventListener('click', confirm);
document.getElementById('res-alt')!.addEventListener('click', () => startLevel(levelIdx));
document.getElementById('dots')!.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-level]');
  if (!b || b.disabled) return;
  sfx.unlock();
  hud.hideTitle();
  startLevel(Number(b.dataset.level) - 1);
});

const refit = () => {
  view.fit();
  dirty = 3;
};
window.addEventListener('resize', refit);
window.addEventListener('orientationchange', refit);
new ResizeObserver(refit).observe(document.getElementById('stage')!);

const fpsEl = document.getElementById('fps')!;
const showFps = params.has('fps');
let last = performance.now();
let fpsT = 0;

function frame(now: number): void {
  requestAnimationFrame(frame);
  const rawMs = now - last;
  const dt = Math.min(0.1, rawMs / 1000);
  last = now;

  if (game.phase === 'resolving') {
    const t0 = performance.now();
    acc += dt;
    while (acc >= tune.dt && game.phase === 'resolving') {
      snapshotPrev();
      events.length = 0;
      game.step(events);
      acc -= tune.dt;
      for (const e of events) {
        if (e.type === 'collect') {
          view.collect(e.id, e.x, e.y, e.catcher);
          sfx.collect(game.collected - 1);
          hud.update(game);
        } else if (e.type === 'hit') sfx.click(e.speed);
      }
      if (game.phase !== 'resolving') {
        snapshotPrev();
        onSettled();
      }
    }
    perf.simMs += performance.now() - t0;
  }

  // Draw only when something moves: an idle board costs no GPU time or battery.
  const active = game.phase === 'resolving' || view.animating;
  if (active || dirty > 0) {
    if (dirty > 0) dirty--;
    const alpha = game.phase === 'resolving' ? acc / tune.dt : 1;
    view.render(game.world, prev, alpha, dt);
    if (active) {
      perf.frames++;
      perf.frameMs += rawMs;
      perf.worstMs = Math.max(perf.worstMs, rawMs);
    }
  }

  if (showFps && now - fpsT > 500 && perf.frames > 0) {
    fpsT = now;
    perf.fps = 1000 / (perf.frameMs / perf.frames);
    const s = view.stats();
    fpsEl.hidden = false;
    fpsEl.textContent = `${perf.fps.toFixed(0)} fps  worst ${perf.worstMs.toFixed(0)} ms\nsim ${(perf.simMs / perf.frames).toFixed(2)} ms/frame\n${s.calls} calls  ${s.triangles} tris`;
  }
}

// Hooks for the automated browser check (tools/e2e.mjs); not used by the game itself.
Object.assign(window, {
  bumpburst: {
    get game() { return game; },
    get levelIndex() { return levelIdx; },
    levels: LEVELS,
    perf,
    startLevel,
    resetPerf() { perf.frames = perf.frameMs = perf.worstMs = perf.simMs = 0; },
  },
});

const wanted = Number(params.get('level'));
if (wanted >= 1 && wanted <= LEVELS.length) {
  hud.hideTitle();
  startLevel(wanted - 1);
} else {
  startLevel(Math.min(progress.cleared, LEVELS.length - 1));
  hud.showTitle(LEVELS, progress.cleared);
}
requestAnimationFrame(frame);
