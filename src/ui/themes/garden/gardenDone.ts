/** What the "garden completed" celebration shows. */
export interface GardenDoneView {
  /** The garden just completed, counted from 1. */
  garden: number;
  /** Stars earned in that garden, and the most it can give. */
  stars: number;
  maxStars: number;
  /** It was the last garden: there is no next one. */
  last: boolean;
}

/**
 * Stars earned in garden `garden` (counted from 1) of `size` levels. `stars` holds every level's
 * stars in play order, 0 when not completed.
 */
export function gardenStars(stars: readonly number[], garden: number, size: number): { stars: number; maxStars: number } {
  const part = stars.slice((garden - 1) * size, garden * size);
  return { stars: part.reduce((sum, s) => sum + s, 0), maxStars: part.length * 3 };
}

/** The main action's text: on to the next garden, or back to the levels after the last one. */
export function gardenDoneAction(view: GardenDoneView): string {
  return view.last ? 'Levels' : 'Next garden';
}

/**
 * The celebration as markup: a dialog over the level screen with the gazebo lit, petals falling,
 * the garden's stars and one button. Decoration is hidden from screen readers; the title says it all.
 * `id` names the title, so the dialog can point at it.
 */
export function gardenDoneMarkup(view: GardenDoneView, id = 'gardenDoneTitle'): string {
  const title = view.last ? 'All gardens complete!' : `Garden ${view.garden} complete!`;
  const petals = Array.from({ length: 14 }, (_, k) => `<i style="--k:${k}"></i>`).join('');
  return `<div class="tf-gdone" role="dialog" aria-modal="true" aria-labelledby="${id}">`
    + `<div class="tf-gdone-petals" aria-hidden="true">${petals}</div>`
    + `<div class="tf-gdone-card">`
    + `<div class="tf-gdone-stage" aria-hidden="true"><i class="tf-gdone-rays"></i><i class="tf-gdone-gazebo"></i><i class="tf-gdone-check"></i></div>`
    + `<h2 class="tf-gdone-title" id="${id}">${title}</h2>`
    + `<p class="tf-gdone-stars"><i class="tf-levels-star" aria-hidden="true"></i>${view.stars} of ${view.maxStars} stars</p>`
    + `<button type="button" class="tf-btn tf-action tf-gdone-next" style="--w:100%;--h:56px;--d:8px;--r:20px"><span class="tf-clip"><span class="tf-face"><span class="tf-label">${gardenDoneAction(view)}</span></span></span></button>`
    + `</div></div>`;
}

/**
 * Show the celebration over `screen` (the level screen). The button closes it and calls `onNext`;
 * focus moves to the button so a keyboard or screen reader lands on it.
 */
export function showGardenDone(screen: HTMLElement, view: GardenDoneView, onNext: () => void): HTMLElement {
  screen.insertAdjacentHTML('beforeend', gardenDoneMarkup(view));
  const dialog = screen.lastElementChild as HTMLElement;
  const button = dialog.querySelector<HTMLButtonElement>('.tf-gdone-next')!;
  button.addEventListener('click', () => {
    dialog.remove();
    onNext();
  });
  button.focus({ preventScroll: true });
  return dialog;
}
