import type * as THREE from 'three';
import type { Level } from '../../../levels/parse';
import { chooseObstacles } from './obstacleChoice';
import { buildObstacle } from './obstacles';

/**
 * The garden's obstacles for one level (register hook `obstaclesFor`, src/render/themes.ts):
 * per wall cell the kind and turn `chooseObstacles` picks, so a level always looks the same and
 * touching walls differ. The cards are kept out of the fused board (`userData.keepApart`): they
 * cast no shadow (it is in the picture) and are blended, so three.js sorts them back to front.
 * Design: design/themes/garden-obstacles.md.
 */
export function obstaclesFor(level: Level): (x: number, y: number) => THREE.Object3D {
  const { width, height, walls } = level.board;
  const choices = chooseObstacles(level.id, width, height, walls);
  return (x, y) => {
    const choice = choices[y * width + x];
    const card = choice ? buildObstacle(choice.kind, choice.turn) : buildObstacle();
    card.userData.keepApart = true;
    return card;
  };
}
