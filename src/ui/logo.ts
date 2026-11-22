/** Where the logo sits on the level selection: in the one header row, or in a band of its own above it. */
export type LogoLayout = 'row' | 'band';

/** The logo's tuning values, from data/config.json (`logo`, described in data/config-notes.md). */
export interface LogoConfig {
  levels: {
    layout: string;
    bandMinHeight: number;
    bandMaxHeight: number;
    bandMaxHeightWide: number;
    tileComfort: number;
    rowMaxHeight: number;
  };
  intro: { enabled: boolean; seconds: number; scale: number };
}

/**
 * Lay out the logo on the level selection from the config: which layout, and
 * the sizes its styles (tf-levels.css) work with. The picture itself is in the
 * page, so it needs no code to show.
 *
 * With `intro` the logo opens large over the harbour and settles into its
 * place while the rest of the screen fades in. Nothing waits for it: every
 * button works from the first frame. It is skipped under reduced motion.
 */
export function setupLogo(screen: HTMLElement, config: LogoConfig, opts: { reducedMotion: boolean }): void {
  const { levels, intro } = config;
  const layout: LogoLayout = levels.layout === 'row' ? 'row' : 'band';
  screen.classList.toggle('tf-logo-row', layout === 'row');
  screen.classList.toggle('tf-logo-band', layout === 'band');
  const px = (value: number): string => `${value}px`;
  screen.style.setProperty('--tl-logo-min', px(levels.bandMinHeight));
  screen.style.setProperty('--tl-logo-max', px(levels.bandMaxHeight));
  screen.style.setProperty('--tl-logo-max-wide', px(levels.bandMaxHeightWide));
  screen.style.setProperty('--tl-logo-comfort', px(levels.tileComfort));
  screen.style.setProperty('--tl-logo-row-max', px(levels.rowMaxHeight));
  if (!intro.enabled || opts.reducedMotion) return;
  screen.style.setProperty('--tl-logo-intro', `${intro.seconds}s`);
  screen.style.setProperty('--tl-logo-intro-scale', String(intro.scale));
  screen.classList.add('tf-logo-intro');
  const logo = screen.querySelector('.tf-levels-logo');
  const done = (): void => screen.classList.remove('tf-logo-intro');
  logo?.addEventListener('animationend', done, { once: true });
  // If the animation never runs (hidden tab), the class still goes.
  window.setTimeout(done, intro.seconds * 1000 + 400);
}
