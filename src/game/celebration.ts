import { CONFIG } from '../config';

/** The celebrations a win can play on the board; the test lab chooses between them. */
/** `garden`: the garden theme's beam and stars (design/themes/garden-effects.md), a choice next to the others in every theme. */
export const CELEBRATION_VARIANTS = ['confetti', 'wave', 'hop', 'garden'] as const;
/** One of the celebrations. */
export type CelebrationVariant = (typeof CELEBRATION_VARIANTS)[number];

/** The names the test lab shows. */
export const CELEBRATION_NAMES: Record<CelebrationVariant, string> = { confetti: 'Confetti', wave: 'Light wave', hop: 'Victory hop', garden: 'Garden stars' };

/** The tuning values of the celebration (`celebration` in data/config.json). */
export type CelebrationConfig = typeof CONFIG.celebration;

/** The variant the game ships with: the configured one, or the first when the config names an unknown one. */
export function defaultVariant(config: Pick<CelebrationConfig, 'variant'> = CONFIG.celebration): CelebrationVariant {
  return CELEBRATION_VARIANTS.includes(config.variant as CelebrationVariant) ? (config.variant as CelebrationVariant) : CELEBRATION_VARIANTS[0];
}

/** What is known when a level is won. */
export interface CelebrationInput {
  readonly variant: CelebrationVariant;
  /** Stars of this win; three is the perfect solution. A level won before counts the same as a first win. */
  readonly stars: 1 | 2 | 3;
  /** The device or the player asks for less motion. */
  readonly reduced: boolean;
  /** Sound effects are switched off. */
  readonly muted: boolean;
}

/** One celebration, decided: what plays, for how long, and when the pop-up comes. */
export interface CelebrationPlan {
  readonly variant: CelebrationVariant;
  /** Three stars: the more exuberant version. */
  readonly perfect: boolean;
  /** The quiet version for reduced motion: a soft glow, nothing flies or jumps. */
  readonly calm: boolean;
  /** How long the board effect lasts, in seconds. */
  readonly seconds: number;
  /** Seconds from the start until the win pop-up appears; the effect plays on behind it. */
  readonly cardDelay: number;
  /** The sound to play, or null when sound effects are off. */
  readonly sound: 'win' | 'perfect' | null;
}

/** Decide the celebration for a win. */
export function planCelebration(input: CelebrationInput, config: CelebrationConfig = CONFIG.celebration): CelebrationPlan {
  const perfect = input.stars === 3;
  const sound = input.muted ? null : perfect ? 'perfect' : 'win';
  if (input.reduced) return { variant: input.variant, perfect, calm: true, seconds: config.calm.seconds, cardDelay: config.calm.cardDelay, sound };
  const v = config[input.variant];
  return { variant: input.variant, perfect, calm: false, seconds: perfect ? v.perfectSeconds : v.seconds, cardDelay: perfect ? config.perfectCardDelay : config.cardDelay, sound };
}

/** What a running celebration drives. */
export interface CelebrationHooks {
  /** Start the board effect (and its sound). */
  start(plan: CelebrationPlan): void;
  /** End the board effect at once. */
  stop(): void;
  /** Show the win pop-up. Called exactly once, unless the celebration is cancelled first. */
  showCard(): void;
}

/** Run `fn` after `seconds`; the returned function calls it off. */
export type Timer = (seconds: number, fn: () => void) => () => void;

/**
 * One celebration from the last robot's exit to its end. The pop-up comes after `cardDelay`
 * while the effect plays on; a tap (`skip`) ends the effect and brings the pop-up at once;
 * leaving or restarting the level (`cancel`) ends everything without a pop-up.
 */
export class CelebrationRun {
  private cancels: (() => void)[] = [];
  private playing = false;
  private carded = false;

  constructor(
    readonly plan: CelebrationPlan,
    private hooks: CelebrationHooks,
    private timer: Timer,
  ) {}

  /** The board effect is still playing. */
  get active(): boolean {
    return this.playing;
  }

  /** The pop-up has been asked for. */
  get cardShown(): boolean {
    return this.carded;
  }

  /** Start the effect and the clock. */
  begin(): void {
    if (this.playing || this.carded) return;
    this.playing = true;
    this.hooks.start(this.plan);
    this.cancels.push(this.timer(this.plan.cardDelay, () => this.card()));
    this.cancels.push(
      this.timer(Math.max(this.plan.seconds, this.plan.cardDelay), () => {
        this.playing = false;
        this.hooks.stop();
      }),
    );
  }

  /** The player tapped: end the effect now and show the pop-up if it is not there yet. True when there was something to skip. */
  skip(): boolean {
    if (!this.playing) return false;
    this.halt();
    this.card();
    return true;
  }

  /** The level was left or restarted: end the effect, and no pop-up. */
  cancel(): void {
    const pending = this.playing;
    this.carded = true;
    if (pending) this.halt();
  }

  private halt(): void {
    this.playing = false;
    for (const off of this.cancels) off();
    this.cancels = [];
    this.hooks.stop();
  }

  private card(): void {
    if (this.carded) return;
    this.carded = true;
    this.hooks.showCard();
  }
}
