/**
 * The visual themes the game can be played in. A theme changes how the game
 * looks, never how it plays: levels, rules and the save are the same in every
 * theme. The contract the theme parts follow is in design/themes.md.
 */

/** Every theme, in the order the settings screen lists them. */
export const THEME_IDS = ['garden', 'robot'] as const;
/** One theme: `robot` (the harbour and its flock robots) or `garden` (a sunny garden with flock chicks). */
export type ThemeId = (typeof THEME_IDS)[number];

/** Names the settings screen shows. */
export const THEME_NAMES: Readonly<Record<ThemeId, string>> = { robot: 'Robots', garden: 'Garden' };

/** True for a known theme id; anything else (a removed theme, damaged data) is not. */
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

/**
 * The theme a new player starts in, and every player who never picked one: the garden, the main
 * theme (owner, 2026-11-24). vite.config.ts defines `__TF_DEFAULT_THEME__`; without it (tools run
 * outside Vite) or with an unknown value it is the garden too.
 */
export const DEFAULT_THEME: ThemeId = isThemeId(typeof __TF_DEFAULT_THEME__ === 'string' ? __TF_DEFAULT_THEME__ : undefined) ? (__TF_DEFAULT_THEME__ as ThemeId) : 'garden';
