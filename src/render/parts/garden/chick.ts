/**
 * The garden theme's flock member: the owner's chick from the 3D master model (chickMaster.ts),
 * as it was in the game on the afternoon of 2026-11-24. Until that model has loaded, the
 * code-built flock chick (src/render/parts/chick.ts) stands in. The register (src/render/themes.ts)
 * picks this up as the garden's `buildPartsRobot`; the robot theme keeps its Flockbot.
 */
import type { Color } from '../../../engine/types';
import type { HeadingStyle } from '../../heading';
import { buildChickRobot, type RobotView } from '../../robot';
import { buildMasterChick, chickMasterReady } from './chickMaster';

/** Same name and parameters as the robot theme's `buildPartsRobot`. */
export function buildPartsRobot(id: number, color: Color, style?: HeadingStyle, _viewTilt?: number): RobotView {
  return chickMasterReady() ? buildMasterChick(id, color, style) : buildChickRobot(id, color);
}
