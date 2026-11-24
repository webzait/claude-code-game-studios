/**
 * The 2D side of a theme: `data-theme` on the page's root element, the theme's
 * colours as CSS custom properties, and every theme style sheet. A theme's
 * sheets (src/ui/themes/<theme>/*.css) are always in the page, and every rule
 * in them starts with `[data-theme="<theme>"]`, so only the active theme's
 * rules apply. Contract: design/themes.md.
 */
import type { ResolvedTheme } from '../render/themes';

// Every theme style sheet is bundled; a new file in a theme folder needs no line here.
import.meta.glob('./themes/*/*.css', { eager: true });

/** Custom properties set by the previous call, so a theme switch removes the old theme's colours. */
let shownColours: string[] = [];

/** Show `theme` on the page: sets `data-theme` on `root` and the theme's colours as custom properties. */
export function applyPageTheme(theme: ResolvedTheme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme.id;
  for (const name of shownColours) root.style.removeProperty(name);
  for (const [name, value] of Object.entries(theme.colours)) root.style.setProperty(name, value);
  shownColours = Object.keys(theme.colours);
}
