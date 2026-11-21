import { CONFIG } from './config';

/** Moments the game can answer with a short vibration. */
export type BuzzName = keyof typeof CONFIG.haptics;

/** The device's vibration call (`navigator.vibrate`), or null where there is none. */
export type Vibrate = ((pattern: number[]) => boolean) | null;

/**
 * Short vibrations on moves and wins. Silent when the player switched them
 * off or the device cannot vibrate; the device call is passed in, so this is
 * testable without a phone.
 */
export class Haptics {
  constructor(
    private isOn: () => boolean,
    private vibrate: Vibrate,
  ) {}

  /** True when this device can vibrate at all; without it the setting is not shown. */
  get supported(): boolean {
    return this.vibrate !== null;
  }

  /** Vibrate for `name`. Returns true when the device was asked to. */
  play(name: BuzzName): boolean {
    if (!this.vibrate || !this.isOn()) return false;
    try {
      this.vibrate([...CONFIG.haptics[name]]);
      return true;
    } catch {
      return false;
    }
  }
}

/** The browser's vibration call, bound, or null when the browser has none (for example Safari on iPhone). */
export function deviceVibrate(nav: { vibrate?: (pattern: number[]) => boolean }): Vibrate {
  return typeof nav.vibrate === 'function' ? (pattern) => nav.vibrate!(pattern) : null;
}
