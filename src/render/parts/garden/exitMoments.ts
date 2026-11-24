/**
 * When the garden exit pad wears which of its three looks. Pure logic, no
 * Three.js, so it is unit-tested on its own (tests/unit/garden-exit.test.ts).
 *
 * The pad has three looks, after the owner's sheet `22-sheet-exit-pad-states`:
 * `grey` (a plain stone pad), `green` (the lit pad) and `rays` (the lit pad with
 * yellow rays above it), and since the owner's corrected pictures `portal` (a beam of light). Which look belongs to which moment of play is data
 * (`moments` in data/themes/garden/exit.json), so it can be changed without
 * touching code. Design: design/themes/garden-exit.md.
 */

/**
 * The looks of the pad: the three of the owner's sheet, plus `portal` (the owner's corrected
 * pictures, 2026-11-24: the stone frame with a green ring and a beam of light rising from it,
 * no tick). The modelled pad (exit.ts) has no portal of its own and shows it as `green`.
 */
export type ExitLook = 'grey' | 'green' | 'rays' | 'portal';

/**
 * The moments of play an exit can be in.
 * - `waiting`: chicks this exit takes are still out.
 * - `entered`: a chick has just gone in through this exit.
 * - `complete`: every chick is in; the level is won.
 * - `spent`: this exit takes no one any more (an exit for one colour whose chicks are all in), while
 *   other chicks are still out.
 */
export type ExitMoment = 'waiting' | 'entered' | 'complete' | 'spent';

/** Which look each moment wears. */
export type ExitMomentLooks = Record<ExitMoment, ExitLook>;

/** What the board knows about one exit at one instant. */
export interface ExitSituation {
  /** Chicks still out that this exit would take: all of them for a shared exit, those of its colour for a colour exit. */
  readonly waitingFor: number;
  /** Chicks still out anywhere on the board. */
  readonly stillOut: number;
  /** Seconds since a chick last went in through this exit; `Infinity` if none has. */
  readonly sinceEntry: number;
  /** How long the `entered` moment lasts, in seconds. */
  readonly flashSeconds: number;
}

/** The moment an exit is in. A finished level wins over everything; a fresh entry wins over waiting or spent. */
export function exitMoment(s: ExitSituation): ExitMoment {
  if (s.stillOut <= 0) return 'complete';
  if (s.sinceEntry >= 0 && s.sinceEntry < s.flashSeconds) return 'entered';
  if (s.waitingFor <= 0) return 'spent';
  return 'waiting';
}

/** The look for an exit in `s`, by the `looks` table. */
export function exitLook(s: ExitSituation, looks: ExitMomentLooks): ExitLook {
  return looks[exitMoment(s)];
}
