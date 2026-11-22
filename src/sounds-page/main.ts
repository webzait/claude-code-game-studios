import { Sfx } from '../audio';
import { CONFIG } from '../config';
import type { Command } from '../engine/types';
import { BUTTON_SOUNDS, movePlan, soundSet, soundSetIds, tuningOf, type SoundName } from '../sound/sets';
import { CHECK_RATE, soundFacts } from '../sound/report';
import { renderRecipe } from '../sound/synth';
import './sounds.css';

/**
 * The listening page (`npm run build:sounds` → dist-sounds/sounds.html): every sound of every set on a
 * button of its own, played through the game's own sound code, so what is heard here is what the game plays.
 * Design: design/button-sounds.md.
 */

let active = CONFIG.audio.set;
const sfx = new Sfx(() => false, () => active);

const LABEL: Record<string, string> = {
  'press-red': 'ROOD',
  'press-blue': 'BLAUW',
  'press-yellow': 'GEEL',
  'press-forward': 'VOORUIT',
  turn: 'Robots draaien',
  step: 'Robots stappen',
  bump: 'Botsen (niemand kan stappen)',
  deny: 'Geweigerd',
  tap: 'Menuknopje',
};
const COLOUR: Record<string, string> = { 'press-red': CONFIG.colors.red, 'press-blue': CONFIG.colors.blue, 'press-yellow': CONFIG.colors.yellow, 'press-forward': CONFIG.colors.green };
const RATE = CHECK_RATE;

const h = (html: string): HTMLElement => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

/** A small picture of the sound's samples: how long it is and how it dies away. */
function wavePicture(samples: Float32Array, peak: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 240;
  canvas.height = 44;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.fillStyle = CONFIG.colors.ink;
  // Every picture shows the same quarter second, so lengths can be compared by eye.
  const shown = RATE * 0.25;
  for (let x = 0; x < canvas.width; x++) {
    const from = Math.floor((x / canvas.width) * shown);
    const to = Math.floor(((x + 1) / canvas.width) * shown);
    let max = 0;
    for (let i = from; i < to && i < samples.length; i++) max = Math.max(max, Math.abs(samples[i]));
    const bar = Math.max(1, (max / (peak || 1)) * canvas.height);
    g.fillRect(x, (canvas.height - bar) / 2, 1, bar);
  }
  return canvas;
}

/** Play one whole move as the game does: the button at once, the turn and the step when the robots would make them. */
function playMove(setId: string, command: Command): void {
  active = setId;
  const plan = movePlan(command, ['moved'], command !== 'forward', soundSet(setId).timing);
  plan.tap.forEach((name) => sfx.play(name));
  const turnTime = command === 'forward' ? 0 : CONFIG.anim.turnTime;
  window.setTimeout(() => plan.turn.forEach((name) => sfx.play(name)), 0);
  window.setTimeout(() => plan.step.forEach((name) => sfx.play(name)), turnTime * 1000);
}

const host = document.getElementById('sets')!;
for (const id of soundSetIds()) {
  const set = soundSet(id);
  const card = h(`<section class="set" data-set="${id}"><h2>${set.nl.name}${id === CONFIG.audio.set ? ' <span class="chip">nu de standaard</span>' : ''}</h2><p class="blurb">${set.nl.blurb}</p><div class="grid"></div><h3>Een hele zet, zoals in het spel</h3><div class="moves"></div></section>`);
  const grid = card.querySelector('.grid')!;
  for (const name of BUTTON_SOUNDS) {
    const recipe = set.recipes[name];
    const cell = h(`<div class="cell"></div>`);
    const button = h(`<button type="button" class="play" data-sound="${name}">${LABEL[name]}</button>`) as HTMLButtonElement;
    if (COLOUR[name]) {
      button.style.background = COLOUR[name];
      button.classList.add('colour');
    }
    if (recipe.length === 0) {
      button.disabled = true;
      cell.append(button, h(`<p class="facts">geen eigen klank in deze set</p>`));
    } else {
      const samples = renderRecipe(recipe, { sampleRate: RATE, ...tuningOf(set, name) });
      const m = soundFacts(id, name);
      button.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        active = id;
        sfx.play(name as SoundName);
      });
      // Keyboard and switch access: a click that did not come from a pointer.
      button.addEventListener('click', (e) => {
        if (e.detail === 0) {
          active = id;
          sfx.play(name as SoundName);
        }
      });
      cell.append(button, wavePicture(samples, m.peak / CONFIG.audio.volume), h(`<p class="facts">${Math.round(m.heardMs)} ms hoorbaar · piek ${Math.round(m.peak * 100)}%</p>`));
    }
    grid.appendChild(cell);
  }
  const moves = card.querySelector('.moves')!;
  const commands: [Command, string][] = [['red', 'Zet ROOD'], ['blue', 'Zet BLAUW'], ['yellow', 'Zet GEEL'], ['forward', 'Zet VOORUIT']];
  for (const [command, label] of commands) {
    const b = h(`<button type="button" class="play move" data-move="${command}">${label}</button>`);
    b.addEventListener('click', () => playMove(id, command));
    moves.appendChild(b);
  }
  const burst = h(`<button type="button" class="play move" data-burst>12 zetten snel achter elkaar</button>`);
  burst.addEventListener('click', () => {
    const order: Command[] = ['red', 'forward', 'blue', 'forward', 'yellow', 'red', 'forward', 'forward', 'blue', 'yellow', 'forward', 'red'];
    order.forEach((command, i) => window.setTimeout(() => playMove(id, command), i * 140));
  });
  moves.appendChild(burst);
  host.appendChild(card);
}

declare global {
  interface Window {
    /** The page's sound player, exposed for automated checks. */
    turnflockSounds: Sfx;
  }
}
window.turnflockSounds = sfx;
