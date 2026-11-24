/**
 * The garden theme's flock member: the flock chick (src/render/parts/chick.ts, design/chicks.md),
 * worked out with the owner on 2026-11-23 and put back in the game by the owner's decision of
 * 2026-11-24 ("De kuikens moeten erin"). The register (src/render/themes.ts) picks this up as the
 * garden's `buildPartsRobot`; the robot theme keeps its Flockbot.
 */
import type { Color } from '../../../engine/types';
import type { HeadingStyle } from '../../heading';
import { buildChickRobot, type RobotView } from '../../robot';

/**
 * Same name and parameters as the robot theme's `buildPartsRobot`. The chick always turns as a
 * whole, so the heading style and the view tilt are not needed.
 */
export function buildPartsRobot(id: number, color: Color, _style?: HeadingStyle, _viewTilt?: number): RobotView {
  return buildChickRobot(id, color);
}
