import logoUrl from '../../../../assets/turnflock/garden/logo/logo-garden.webp';
import garden from '../../../../data/themes/garden/logo.json';

/**
 * The garden theme's logo: the owner's chick logo in place of the robot logo, in the same
 * places (the level screen's heading). Values: data/themes/garden/logo.json; design:
 * design/themes/garden-logo.md. The styles are in tf-logo-garden.css, under [data-theme="garden"].
 */

/** The garden logo's tuning values. */
export type GardenLogo = typeof garden;

/** The values as shipped. */
export const GARDEN_LOGO: GardenLogo = garden;

/** The garden logo picture (a hashed URL, or a data URL in the single-file build). */
export const GARDEN_LOGO_URL: string = logoUrl;

/**
 * How much higher the garden logo is than the robot logo at the same width (times `widthVsRobot`).
 * The robot styles size the logo by height; the garden logo is narrower for its height (the chicks
 * stand on the letters), so the same height would make the word smaller. Scaling the height by this
 * keeps the word as wide as the robot's.
 */
export function logoGrow(config: GardenLogo = GARDEN_LOGO): number {
  const robot = config.robot.width / config.robot.height;
  const own = config.picture.width / config.picture.height;
  return (robot / own) * config.widthVsRobot;
}

/** The custom properties tf-logo-garden.css reads. The stylesheet has the same values as fallbacks. */
export function gardenLogoVars(config: GardenLogo = GARDEN_LOGO): Record<string, string> {
  return {
    '--tg-logo-grow': logoGrow(config).toFixed(4),
    '--tg-logo-wide': String(config.widthVsRobot),
    '--tg-logo-shadow': config.shadow,
  };
}

/** The parts of an <img> and its screen this module touches; a stub in the tests. */
export interface LogoImage {
  setAttribute(name: string, value: string): void;
}
export interface StyleHost {
  style: { setProperty(name: string, value: string): void };
}

/**
 * Show the garden logo in the level screen's <img class="tf-levels-logo"> and put the sizing values
 * on the screen. The width and height attributes change with it, so the box is reserved before the
 * picture is decoded. The robot theme puts its own picture back with `showRobotLogo`.
 */
export function showGardenLogo(img: LogoImage, screen: StyleHost, config: GardenLogo = GARDEN_LOGO, url: string = GARDEN_LOGO_URL): void {
  img.setAttribute('src', url);
  img.setAttribute('width', String(config.picture.width));
  img.setAttribute('height', String(config.picture.height));
  for (const [name, value] of Object.entries(gardenLogoVars(config))) screen.style.setProperty(name, value);
}

/** Put the robot logo back (index.html's own picture and size). */
export function showRobotLogo(img: LogoImage, robotUrl: string, config: GardenLogo = GARDEN_LOGO): void {
  img.setAttribute('src', robotUrl);
  img.setAttribute('width', String(config.robot.width));
  img.setAttribute('height', String(config.robot.height));
}
