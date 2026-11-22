// Mood render of the Flockbot design study: three bots on a strip of board tiles in warm studio light.
// Open /prototypes/flockbot-look/render.html (npx vite in the repo root); add ?w=2400&h=1500 for another size.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import parts from '../../data/parts.json';
import { buildFloorTile } from '../../src/render/parts/board';
import { buildFlockbot, type Color } from './flockbot';

const query = new URLSearchParams(location.search);
const W = Number(query.get('w') ?? 2400);
const H = Number(query.get('h') ?? 1500);
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Neutral tone mapping rolls off the highlights without washing out the saturated body colours.
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;

const scene = new THREE.Scene();
// Backdrop: a soft vertical fade, deep blue above to a light haze at the horizon.
const fade = document.createElement('canvas');
fade.width = 4;
fade.height = 512;
const ink = fade.getContext('2d')!;
const gradient = ink.createLinearGradient(0, 0, 0, 512);
gradient.addColorStop(0, '#4E97F0');
gradient.addColorStop(0.5, '#9AD3FF');
gradient.addColorStop(1, '#E8F6FF');
ink.fillStyle = gradient;
ink.fillRect(0, 0, 4, 512);
const backdrop = new THREE.CanvasTexture(fade);
backdrop.colorSpace = THREE.SRGBColorSpace;
scene.background = backdrop;
scene.fog = new THREE.Fog('#CDE9FF', 11, 30);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.24;
pmrem.dispose();

scene.add(new THREE.HemisphereLight('#DCEBFF', '#5F8FE0', 0.2));
// Key: warm, high and from the left, casting the soft shadows.
const key = new THREE.DirectionalLight('#FFE7BF', 2.5);
key.position.set(-3.2, 5.5, 3.6);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.normalBias = 0.03;
Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.5, far: 30 });
key.shadow.camera.updateProjectionMatrix();
scene.add(key);
// Rim: cool, from behind on the right, to lift the edges off the backdrop.
const rim = new THREE.DirectionalLight('#BFD9FF', 1.2);
rim.position.set(5, 3.5, -5);
scene.add(rim);

// Ground: the water-blue the board lies on in the game, fading into the haze.
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#6CC0F5', roughness: 0.9 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// A strip of board tiles, and the three bots on it.
const pitch = 1.055;
for (let x = -3; x <= 3; x++) {
  for (let z = -2; z <= 1; z++) {
    const tile = buildFloorTile((x + z) % 2 !== 0, false);
    tile.position.set(x * pitch, 0, z * pitch);
    tile.traverse((node) => {
      if (node instanceof THREE.Mesh) node.receiveShadow = node.castShadow = true;
    });
    scene.add(tile);
  }
}
const cast: readonly (readonly [Color, number, number, number])[] = [
  ['blue', -1, -1, 0.42],
  ['yellow', 1, -1, -0.5],
  ['red', 0, 0, -0.16],
];
for (const [color, x, z, yaw] of cast) {
  const bot = buildFlockbot(color);
  // The symbol rests pointing to the back of the part; turned, it points the way the robot faces.
  bot.symbol.rotation.y = Math.PI;
  bot.root.scale.setScalar(0.86);
  bot.root.rotation.y = yaw;
  bot.root.position.set(x * pitch, parts.floorTile.height, z * pitch);
  scene.add(bot.root);
}

const camera = new THREE.PerspectiveCamera(19, W / H, 0.1, 80);
camera.position.set(-2.1, 3.3, 7.8);
camera.lookAt(0.05, 0.5, -0.35);
renderer.render(scene, camera);
document.body.dataset.ready = '1';
