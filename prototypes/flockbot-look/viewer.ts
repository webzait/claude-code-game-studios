// Turntable for the Flockbot design study: drag to turn, pick a colour, save the model as a .glb file.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import config from '../../data/config.json';
import { buildFlockbot, type Color } from './flockbot';

const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f4f3f8');
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = config.light.reflections;
pmrem.dispose();
// The game's own light, so the bot is lit here as the game would light it.
scene.add(new THREE.HemisphereLight(config.light.sky, config.light.ground, config.light.ambient));
const sun = new THREE.DirectionalLight('#FFFFFF', config.light.sun);
sun.position.set(-2.5, 6, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.radius = 6;
sun.shadow.normalBias = 0.03;
Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2 });
scene.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ color: '#3B3560', opacity: 0.22 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
camera.position.set(-2.3, 2.3, 3.3);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.48, 0);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 2;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.52;
controls.autoRotate = true;
controls.autoRotateSpeed = 1.6;

let bot: THREE.Group | null = null;
/** Show the bot in one colour, replacing the one on stage. */
function show(color: Color): void {
  if (bot) scene.remove(bot);
  const parts = buildFlockbot(color);
  // The symbol rests pointing to the back of the part; turned, it points the way the robot faces.
  parts.symbol.rotation.y = Math.PI;
  bot = parts.root;
  scene.add(bot);
  for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-color]')) b.setAttribute('aria-pressed', String(b.dataset.color === color));
}
for (const b of document.querySelectorAll<HTMLButtonElement>('button[data-color]')) b.addEventListener('click', () => show(b.dataset.color as Color));

const spin = document.getElementById('spin') as HTMLButtonElement;
spin.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  spin.setAttribute('aria-pressed', String(controls.autoRotate));
});
canvas.addEventListener('pointerdown', () => {
  controls.autoRotate = false;
  spin.setAttribute('aria-pressed', 'false');
});

document.getElementById('glb')!.addEventListener('click', () => {
  if (!bot) return;
  new GLTFExporter().parse(
    bot,
    (data) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' }));
      link.download = 'flockbot.glb';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    (error) => console.error(error),
    { binary: true },
  );
});

function resize(): void {
  // Up to three device pixels per CSS pixel: sharp on a phone without drawing more than the screen has.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  // On a tall phone screen the bot would fill the width; widen the view there.
  camera.fov = camera.aspect < 1 ? 26 / Math.max(0.55, camera.aspect) : 26;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
show('red');
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
document.body.dataset.ready = '1';
