import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Color } from '../engine/types';
import parts from '../../data/parts.json';
import { boardPixels, buildFloorTile } from '../render/parts/board';
import { buildChick, CHICK_EXPRESSIONS, type ChickExpression, type ChickParts, type ChickTip } from '../render/parts/chick';
import { buildFlockbot } from '../render/parts/flockbot';
import { fuse } from '../render/kit';

/**
 * The flock chick on the parts sheet: a chick to turn around, each colour on its own, the four headings
 * under the game's camera (large and at the size of a board tile), the choice of forehead mark, and what
 * a chick costs to draw next to the Flockbot.
 */

/** What the sheet's stage (src/parts/main.ts) lends to this page: its one renderer, lights and ground. */
export interface ChickStage {
  /** Draw `object` with `camera` into a new canvas of `width` by `height` pixels; `floorY` is where shadows fall. */
  readonly shoot: (object: THREE.Object3D, camera: THREE.Camera, width: number, height: number, floorY: number, target: THREE.Vector3, shadows?: boolean) => HTMLCanvasElement;
}

const K = parts.chick;
const COLOURS: readonly Color[] = ['red', 'blue', 'yellow'];
const NAMES: Record<Color, string> = { red: 'Rood flockkuiken', blue: 'Blauw flockkuiken', yellow: 'Geel flockkuiken' };
const SHORT: Record<Color, string> = { red: 'Rood', blue: 'Blauw', yellow: 'Geel' };
const HEADINGS = ['noord', 'oost', 'zuid', 'west'] as const;
const FACES: Record<ChickExpression, string> = { open: 'Ogen open', happy: 'Blij (ogen dicht)' };
const TILT = (CONFIG.board.roomy.tilt * Math.PI) / 180;
const PHONE = { width: 390, height: 844 };

/** A symbol choice as the owner is asked to pick it. */
interface SymbolOption {
  readonly key: string;
  readonly title: string;
  readonly tip: ChickTip;
  readonly shape: boolean;
  readonly text: string;
}
const OPTIONS: readonly SymbolOption[] = [
  { key: 'A', title: 'Gewoon', tip: 'beak', shape: false, text: 'Elke kleur heeft dezelfde driehoek, met de punt naar de snavel. Van boven gezien wijst hij waarheen het kuiken stapt, in alle vier de richtingen.' },
  { key: 'C', title: 'Met de instelling Kleurvormen', tip: 'beak', shape: true, text: 'Voor spelers die kleuren moeilijk onderscheiden: de driehoek ligt op de vorm van de kleur (rood rondje, blauw vierkant, gele ruit). Dit is de bestaande instelling van het spel.' },
];

/** A finished picture as an image: it keeps its full resolution but frees the canvas it was drawn on, which a phone runs out of. */
function picture(canvas: HTMLCanvasElement): HTMLImageElement {
  const img = document.createElement('img');
  img.width = canvas.width;
  img.height = canvas.height;
  img.alt = '';
  img.src = canvas.toDataURL('image/webp', 0.96);
  canvas.width = canvas.height = 0;
  return img;
}

/** The game's camera over the middle of a 6×6 board on a phone, cropped to a picture `wide` by `high` cells around `target`. */
function gameCamera(wide: number, high: number, target: THREE.Vector3): THREE.PerspectiveCamera {
  const pitch = parts.floorTile.size + CONFIG.board.grid.gap;
  const px = boardPixels(6, 6, CONFIG.board.grid.gap, PHONE.width - 2 * CONFIG.camera.marginX);
  // How many cells the phone's width shows, and from how far the game's lens then looks.
  const cellsAcross = (PHONE.width / px.tile) * parts.floorTile.size;
  const halfFov = (CONFIG.camera.fov * Math.PI) / 360;
  const distance = cellsAcross / 2 / (Math.tan(halfFov) * (PHONE.width / PHONE.height));
  void pitch;
  // Same place and direction as in the game, a narrower lens: a cut-out of the game's picture, with its perspective.
  const camera = new THREE.PerspectiveCamera((2 * Math.atan(high / 2 / distance) * 180) / Math.PI, wide / high, 1, 200);
  camera.position.copy(target).add(new THREE.Vector3(0, Math.cos(TILT), Math.sin(TILT)).multiplyScalar(distance));
  camera.lookAt(target);
  return camera;
}

/** A chick as it stands on a board tile: board size, turned to `heading` (0 north, clockwise), on one of the game's floor tiles. */
function onTile(color: Color, heading: number, option: SymbolOption, expression: ChickExpression = 'open', detail: 'fine' | 'game' = 'game'): THREE.Group {
  const chick = buildChick(color, { detail, tip: option.tip });
  chick.showShape(option.shape);
  chick.setExpression(expression);
  chick.root.rotation.y = Math.PI - (heading * Math.PI) / 2;
  const lean = new THREE.Group();
  lean.rotation.x = -K.board.lean;
  lean.scale.setScalar(CONFIG.board.grid.robotFill);
  lean.position.y = parts.floorTile.height;
  lean.add(chick.root);
  const group = new THREE.Group();
  group.add(buildFloorTile(false, false), lean);
  return group;
}

/** Four tiles in a row with the chick facing north, east, south and west. */
function headingRow(color: Color, option: SymbolOption, detail: 'fine' | 'game'): THREE.Group {
  const pitch = parts.floorTile.size + CONFIG.board.grid.gap;
  const row = new THREE.Group();
  for (let heading = 0; heading < 4; heading++) {
    const cell = onTile(color, heading, option, 'open', detail);
    cell.position.x = (heading - 1.5) * pitch;
    row.add(cell);
  }
  return row;
}

/** A picture scaled down to `cssWidth` CSS pixels, drawn at three times that for sharp phone screens. */
function shrink(shot: HTMLCanvasElement, cssWidth: number): HTMLCanvasElement {
  const small = document.createElement('canvas');
  small.width = cssWidth * 3;
  small.height = Math.round((cssWidth * 3 * shot.height) / shot.width);
  const ctx = small.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  // In halving steps: one big step would skip pixels and look gritty.
  let from: HTMLCanvasElement = shot;
  while (from.width > small.width * 2) {
    const half = document.createElement('canvas');
    half.width = from.width / 2;
    half.height = from.height / 2;
    const h = half.getContext('2d')!;
    h.imageSmoothingQuality = 'high';
    h.drawImage(from, 0, 0, half.width, half.height);
    from = half;
  }
  ctx.drawImage(from, 0, 0, small.width, small.height);
  small.style.width = `${cssWidth}px`;
  small.style.height = `${small.height / 3}px`;
  return small;
}

/** Triangles and draw calls of what is visible under `object`. */
function cost(object: THREE.Object3D): { triangles: number; calls: number } {
  let triangles = 0;
  let calls = 0;
  object.traverseVisible((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const g = node.geometry as THREE.BufferGeometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    calls++;
  });
  return { triangles, calls };
}

/** A chick as the game draws it: everything that never changes fused, the mark and the eyes apart. */
function gameChick(color: Color, detail: 'fine' | 'game'): THREE.Group {
  const chick = buildChick(color, { detail });
  chick.root.remove(chick.symbol, chick.eyes);
  const group = new THREE.Group();
  group.add(fuse(chick.root), chick.symbol, chick.eyes);
  return group;
}

/** A Flockbot as the game draws it: fused, the symbol apart. */
function gameFlockbot(color: Color): THREE.Group {
  const bot = buildFlockbot(color);
  bot.root.remove(bot.symbol);
  const group = new THREE.Group();
  group.add(fuse(bot.root), bot.symbol);
  return group;
}

/** Add the chick cards to the parts sheet. */
export function addChickCards(sheet: HTMLElement, stage: ChickStage): void {
  const add = (id: string, html: string): HTMLElement => {
    const el = document.createElement('section');
    el.className = 'card wide chick-card';
    el.id = id;
    el.innerHTML = html;
    sheet.appendChild(el);
    return el;
  };
  const figure = (canvas: HTMLCanvasElement, caption: string, id = ''): HTMLElement => {
    const el = document.createElement('figure');
    if (id) el.id = id;
    el.appendChild(picture(canvas));
    if (caption) el.insertAdjacentHTML('beforeend', `<figcaption>${caption}</figcaption>`);
    return el;
  };
  const centre = new THREE.Vector3(0, K.height / 2, 0);

  // 1. A chick to turn around.
  {
    const el = add(
      'chick-viewer',
      `<h2>Flockkuiken · bekijken en draaien</h2><p class="dims">Sleep over het plaatje om het kuiken te draaien. Een styling-idee naast de Flockbot; nog niet in het spel.</p>
      <div class="chick-viewer"><canvas id="chick-viewer-canvas" width="2000" height="2000" aria-label="Flockkuiken, draaibaar"></canvas>
      <div class="chick-controls">
        <div role="group" aria-label="Kleur" data-pick="color">${COLOURS.map((c) => `<button type="button" data-value="${c}">${SHORT[c]}</button>`).join('')}</div>
        <div role="group" aria-label="Gezicht" data-pick="face">${CHICK_EXPRESSIONS.map((e) => `<button type="button" data-value="${e}">${FACES[e]}</button>`).join('')}</div>
        <div role="group" aria-label="Teken" data-pick="option">${OPTIONS.map((o) => `<button type="button" data-value="${o.key}">${o.key === 'C' ? 'Met kleurvorm' : 'Gewoon'}</button>`).join('')}</div>
        <div role="group" aria-label="Kijkhoek" data-pick="view"><button type="button" data-value="front">Van voren</button><button type="button" data-value="game">Spelcamera</button><button type="button" data-value="top">Van boven</button></div>
      </div></div>`,
    );
    const canvas = el.querySelector<HTMLCanvasElement>('#chick-viewer-canvas')!;
    const state = { color: 'yellow' as Color, face: 'open' as ChickExpression, option: 'A', view: 'front', yaw: -0.45, pitch: 0.3 };
    const built = new Map<string, ChickParts>();
    const camera = new THREE.OrthographicCamera(-0.68, 0.68, 0.68, -0.68, 0.1, 100);
    const draw = (): void => {
      const option = OPTIONS.find((o) => o.key === state.option)!;
      const key = `${state.color}:${option.tip}`;
      if (!built.has(key)) built.set(key, buildChick(state.color, { detail: 'fine', tip: option.tip }));
      const chick = built.get(key)!;
      chick.showShape(option.shape);
      chick.setExpression(state.face);
      camera.position.copy(centre).add(new THREE.Vector3(Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), Math.cos(state.yaw) * Math.cos(state.pitch)).multiplyScalar(20));
      camera.lookAt(centre);
      const shot = stage.shoot(chick.root, camera, 2000, 2000, 0, centre);
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 2000, 2000);
      ctx.drawImage(shot, 0, 0);
      for (const group of el.querySelectorAll<HTMLElement>('[data-pick]')) {
        const pick = group.dataset.pick as 'color' | 'face' | 'option' | 'view';
        for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === state[pick]));
      }
    };
    let queued = false;
    const redraw = (): void => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        draw();
      });
    };
    el.querySelector('.chick-controls')!.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button');
      const pick = button?.parentElement?.dataset.pick;
      if (!button || !pick) return;
      const value = button.dataset.value!;
      if (pick === 'color') state.color = value as Color;
      else if (pick === 'face') state.face = value as ChickExpression;
      else if (pick === 'option') state.option = value;
      else {
        state.view = value;
        [state.yaw, state.pitch] = value === 'front' ? [0, 0.12] : value === 'game' ? [0, Math.PI / 2 - TILT] : [0, Math.PI / 2 - 0.001];
      }
      redraw();
    });
    let last: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', (event) => {
      last = { x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!last) return;
      const size = canvas.getBoundingClientRect().width;
      state.yaw -= ((event.clientX - last.x) / size) * Math.PI * 1.4;
      state.pitch = Math.min(Math.PI / 2 - 0.001, Math.max(-0.2, state.pitch + ((event.clientY - last.y) / size) * Math.PI));
      state.view = '';
      last = { x: event.clientX, y: event.clientY };
      redraw();
    });
    const release = (): void => void (last = null);
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    draw();
  }

  // 2. Each colour on its own, from the sheet's four sides, and both faces up close.
  for (const color of COLOURS) {
    {
      const chick = buildChick(color);
      const size = new THREE.Box3().setFromObject(chick.root).getSize(new THREE.Vector3());
      const px = (cells: number): string => `${Math.round(cells * parts.unitPx)} px`;
      const el = add(
        `chick-${color}`,
        `<h2>${NAMES[color]}</h2><p class="dims">breedte ${px(size.x)} · hoogte ${px(size.y)} · diepte ${px(size.z)}</p><div class="views chick-views"></div>
        <p class="note">Lijfje met lichtere buik en blosjes · kuifje · ogen · snavel · 2 vleugels · staartje · pootjes · driehoek op het voorhoofd. Het hele kuiken draait mee met de richting.</p>`,
      );
      // The sheet's sides, as in the owner's turnaround drawings: three-quarter large, then front, side, back and top.
      const sides: [string, THREE.Vector3, number, boolean][] = [
        ['', new THREE.Vector3(-0.55, 0.42, 1), 2000, true],
        ['Voorkant', new THREE.Vector3(0, 0.0001, 1), 1400, false],
        ['Zijaanzicht', new THREE.Vector3(1, 0.0001, 0), 1400, false],
        ['Achterkant', new THREE.Vector3(0, 0.0001, -1), 1400, false],
        ['Bovenaanzicht', new THREE.Vector3(0, 1, 0.0001), 1400, true],
      ];
      const holder = el.querySelector('.views')!;
      for (const [label, dir, pixels, shadows] of sides) {
        const camera = new THREE.OrthographicCamera(-0.66, 0.66, 0.66, -0.66, 0.1, 100);
        camera.position.copy(centre).addScaledVector(dir.normalize(), 20);
        camera.lookAt(centre);
        const view = figure(stage.shoot(chick.root, camera, pixels, pixels, 0, centre, shadows), label);
        if (!label) view.className = 'main';
        holder.appendChild(view);
      }
    }
    const row = document.createElement('div');
    row.className = 'chick-faces';
    for (const expression of CHICK_EXPRESSIONS) {
      const chick = buildChick(color);
      chick.setExpression(expression);
      const camera = new THREE.OrthographicCamera(-0.6, 0.6, 0.6, -0.6, 0.1, 100);
      camera.position.copy(centre).add(new THREE.Vector3(0, 0.22, 1).normalize().multiplyScalar(20));
      camera.lookAt(centre);
      row.appendChild(figure(stage.shoot(chick.root, camera, 1800, 1800, 0, centre), FACES[expression], `chick-${color}-${expression}`));
    }
    // The face up close, as large as the sheet draws anything: eyes, blush and beak are judged here.
    {
      const chick = buildChick(color);
      const face = new THREE.Vector3(0, K.body.widest + 0.06, 0);
      const camera = new THREE.OrthographicCamera(-0.36, 0.36, 0.18, -0.18, 0.1, 100);
      camera.position.copy(face).add(new THREE.Vector3(0, 0.12, 1).normalize().multiplyScalar(20));
      camera.lookAt(face);
      const close = figure(stage.shoot(chick.root, camera, 3200, 1600, 0, centre, false), 'Gezicht van dichtbij', `chick-${color}-face`);
      close.className = 'chick-face';
      row.appendChild(close);
    }
    document.getElementById(`chick-${color}`)!.querySelector('.views')!.insertAdjacentElement('afterend', row);
  }

  // 3. The four headings under the game's camera: large, then at the size of a board tile.
  {
    const pitch = parts.floorTile.size + CONFIG.board.grid.gap;
    const wide = 4 * pitch + 0.1;
    const high = 1.5;
    const target = new THREE.Vector3(0, parts.floorTile.height + 0.3, 0);
    const el = add(
      'chick-headings',
      `<h2>Kijkrichting · vier richtingen onder de spelcamera</h2><p class="dims">Camera van het spel: ${CONFIG.board.roomy.tilt}° gekanteld, perspectief, midden van een 6×6-bord op een telefoon van ${PHONE.width} px. Van links naar rechts: ${HEADINGS.join(', ')}.</p><div class="chick-rows"></div>
      <p class="note">Waaraan je de richting ziet: de oranje snavel en de ogen zitten aan de voorkant, het staartje steekt achter uit, de vleugels zitten opzij, en de driehoek op het voorhoofd wijst naar de snavel. Naar het noorden zie je de achterkant: geen ogen, wel staart en driehoek.</p>`,
    );
    const rows = el.querySelector('.chick-rows')!;
    for (const color of COLOURS) {
      const large = stage.shoot(headingRow(color, OPTIONS[0], 'fine'), gameCamera(wide, high, target), 3200, Math.round((3200 * high) / wide), parts.floorTile.height, target);
      rows.appendChild(figure(large, `${SHORT[color]} · ${HEADINGS.join(' · ')}`, `chick-headings-${color}`));
    }
    const small = document.createElement('div');
    small.className = 'chick-small';
    small.id = 'chick-headings-small';
    for (const tilePx of [46, 42]) {
      for (const color of COLOURS) {
        const shot = stage.shoot(headingRow(color, OPTIONS[0], 'game'), gameCamera(wide, high, target), 2400, Math.round((2400 * high) / wide), parts.floorTile.height, target);
        small.appendChild(shrink(shot, Math.round((wide / parts.floorTile.size) * tilePx)));
      }
      small.insertAdjacentHTML('beforeend', `<span>tegel van ${tilePx} px, zoals op het bord (lichte uitvoering: ${cost(gameChick('red', 'game')).triangles.toLocaleString('nl-NL')} driehoeken)</span><i></i>`);
    }
    rows.insertAdjacentElement('afterend', small);
  }

  // 4. The choice of forehead mark.
  {
    const el = add(
      'chick-symbols',
      `<h2>Driehoek op het voorhoofd</h2><p class="dims">Gekozen: elke kleur dezelfde driehoek, punt naar de snavel. Groot van voren, en eronder de vier richtingen op tegelgrootte (46 px) onder de spelcamera.</p><div class="chick-options"></div>`,
    );
    const holder = el.querySelector('.chick-options')!;
    const pitch = parts.floorTile.size + CONFIG.board.grid.gap;
    const wide = 4 * pitch + 0.1;
    const high = 1.5;
    const target = new THREE.Vector3(0, parts.floorTile.height + 0.3, 0);
    for (const option of OPTIONS) {
      const block = document.createElement('div');
      block.className = 'chick-option';
      block.id = `chick-option-${option.key}`;
      block.innerHTML = `<h3>${option.title}</h3><p>${option.text}</p>`;
      // The three colours side by side, seen a little from above so the forehead shows.
      const trio = new THREE.Group();
      COLOURS.forEach((color, i) => {
        const chick = buildChick(color, { tip: option.tip });
        chick.showShape(option.shape);
        chick.root.position.x = (i - 1) * 1.08;
        trio.add(chick.root);
      });
      const camera = new THREE.OrthographicCamera(-1.7, 1.7, 0.68, -0.68, 0.1, 100);
      camera.position.copy(centre).add(new THREE.Vector3(0, 0.5, 1).normalize().multiplyScalar(20));
      camera.lookAt(centre);
      block.appendChild(figure(stage.shoot(trio, camera, 3000, 1200, 0, centre), 'Rood · blauw · geel'));
      const small = document.createElement('div');
      small.className = 'chick-small';
      for (const color of COLOURS) {
        const shot = stage.shoot(headingRow(color, option, 'game'), gameCamera(wide, high, target), 2400, Math.round((2400 * high) / wide), parts.floorTile.height, target);
        small.appendChild(shrink(shot, Math.round((wide / parts.floorTile.size) * 46)));
      }
      block.appendChild(small);
      holder.appendChild(block);
    }
  }

  // 5. What a chick costs to draw, next to the Flockbot.
  {
    const rows: [string, { triangles: number; calls: number }][] = [
      ['Flockkuiken op het bord (lichte uitvoering)', cost(gameChick('red', 'game'))],
      ['Flockkuiken op deze pagina (fijne uitvoering)', cost(gameChick('red', 'fine'))],
      ['Flockbot (huidige robot, op het bord)', cost(gameFlockbot('red'))],
    ];
    const n = (v: number): string => Math.round(v).toLocaleString('nl-NL');
    add(
      'chick-cost',
      `<h2>Gewicht · driehoeken en tekenopdrachten</h2><p class="dims">Per figuur, zoals het spel het tekent (vaste delen samengevoegd; teken en ogen los). Op het grootste bord staan er twaalf.</p>
      <table class="chick-table"><thead><tr><th>Figuur</th><th>Driehoeken</th><th>Tekenopdrachten</th><th>× 12 driehoeken</th><th>× 12 opdrachten</th></tr></thead>
      <tbody>${rows.map(([name, c]) => `<tr><td>${name}</td><td>${n(c.triangles)}</td><td>${c.calls}</td><td>${n(c.triangles * 12)}</td><td>${c.calls * 12}</td></tr>`).join('')}</tbody></table>`,
    );
  }
}
