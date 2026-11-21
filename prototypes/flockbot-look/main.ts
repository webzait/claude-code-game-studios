import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import config from '../../data/config.json';
import { buildFlockbot } from './flockbot';

// The game's own light, so the study shows the bot as the game would light it.
const CONFIG = { light: config.light };
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.NoToneMapping;
function shot(color: 'red' | 'blue' | 'yellow', pos: [number, number, number], px: number, fov = 24): string {
  renderer.setPixelRatio(2); renderer.setSize(px, px, false);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#f4f3f8');
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = CONFIG.light.reflections;
  scene.add(new THREE.HemisphereLight(CONFIG.light.sky, CONFIG.light.ground, CONFIG.light.ambient));
  const sun = new THREE.DirectionalLight('#fff', CONFIG.light.sun); sun.position.set(-2.5, 6, 3.5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 6;
  const c = sun.shadow.camera; c.left = c.bottom = -2; c.right = c.top = 2; sun.shadow.normalBias = 0.03; scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: '#3b3560', opacity: 0.22 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const bot = buildFlockbot(color); bot.symbol.rotation.y = Math.PI; scene.add(bot.root);
  const cam = new THREE.PerspectiveCamera(fov, 1, 0.1, 50); cam.position.set(...pos); cam.lookAt(0, 0.48, 0);
  renderer.render(scene, cam); pmrem.dispose();
  return renderer.domElement.toDataURL('image/png');
}
const fig = (src: string, cap: string, cls = '') => `<figure class="${cls}"><img src="${src}"><figcaption>${cap}</figcaption></figure>`;
const D = 4.6;
document.getElementById('g')!.innerHTML =
  fig(shot('red', [-2.3, 2.3, 3.3], 520), 'Schuin van voren', 'hero') +
  fig(shot('red', [0, 0.5, D], 200), 'Voor') + fig(shot('red', [D, 0.5, 0], 200), 'Zij') + fig(shot('red', [0, 0.5, -D], 200), 'Achter') +
  fig(shot('red', [0, D + 0.5, 0.001], 200), 'Boven') + fig(shot('red', [0, 4.2, 2.4], 200), 'Zoals de spelcamera kijkt') + fig(shot('red', [2.3, 2.3, 3.3], 200), 'Schuin, andere kant');
document.getElementById('r')!.innerHTML = (['blue', 'yellow'] as const).map((k) => fig(shot(k, [-2.3, 2.3, 3.3], 230), k === 'blue' ? 'Blauw' : 'Geel') + fig(shot(k, [0, 4.2, 2.4], 230), 'Spelcamera')).join('');
document.body.dataset.ready = '1';
