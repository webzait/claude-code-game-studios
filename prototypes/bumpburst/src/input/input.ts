// PROTOTYPE - NOT FOR PRODUCTION
import type { ColorId } from '../config';

export interface InputHandlers {
  /** A colour button was pressed (touch, mouse or number key). */
  pulse(color: ColorId): void;
  reset(): void;
  /** Enter / Space: the primary action of whatever sheet is open. */
  confirm(): void;
  mute(): void;
  /** Colours currently on the board, in button order (for the number keys). */
  colors(): ColorId[];
}

/**
 * All player input in one place: one finger on the big buttons, or the keyboard on desktop
 * (1-6 colours, R reset, Enter/Space confirm, M mute). Only translates events into intents;
 * the game decides whether an intent is allowed.
 */
export function bindInput(buttons: HTMLElement, h: InputHandlers): void {
  // Fire on the first contact for a snappy feel; `click` is the fallback where pointer events are missing
  // or swallowed (some embedded mobile browsers). The stamp keeps one tap from counting twice.
  let lastDown = 0;
  const press = (e: Event) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-color]');
    if (!b) return;
    if (e.type === 'click' && performance.now() - lastDown < 700) return;
    if (e.type !== 'click') lastDown = performance.now();
    h.pulse(b.dataset.color as ColorId);
  };
  buttons.addEventListener('pointerdown', press);
  buttons.addEventListener('touchstart', press, { passive: true });
  buttons.addEventListener('click', press);
  document.getElementById('btn-reset')!.addEventListener('click', () => h.reset());
  document.getElementById('btn-mute')!.addEventListener('click', () => h.mute());

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 6) {
      const c = h.colors()[n - 1];
      if (c) h.pulse(c);
    } else if (e.key === 'r' || e.key === 'R') h.reset();
    else if (e.key === 'm' || e.key === 'M') h.mute();
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      h.confirm();
    }
  });

  // Mobile Safari: no pinch or double-tap zoom (scrolling is already off through CSS).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}
