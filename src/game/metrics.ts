import type { Command } from '../engine/types';

/** Things worth counting later. Nothing here leaves the device in this build. */
export type MetricsEvent =
  | { type: 'level_start'; level: string }
  | { type: 'level_win'; level: string; moves: number; par: number; stars: number; usedBackup: boolean }
  | { type: 'level_fail'; level: string; rescuable: 'yes' | 'no' | 'not-assessed' }
  | { type: 'hint'; level: string; result: 'on-route' | 'dead-end' | 'not-assessed'; rung: number }
  | { type: 'extra_moves'; level: string; price: number }
  /** One command taken back; `price` is what it cost, zero when free. `refused` when the wallet could not pay. */
  | { type: 'undo'; level: string; price: number; refused: boolean }
  | { type: 'coins_earned'; level: string; amount: number; balance: number }
  | { type: 'coins_spent'; level: string; amount: number; on: 'hint' | 'extra_moves' | 'undo'; balance: number }
  | { type: 'command'; level: string; command: Command };

/** Where events go. A real analytics service would implement this later. */
export interface MetricsSink {
  track(event: MetricsEvent): void;
}

/** Keeps the latest events in memory, for inspection during testing. */
export class MemorySink implements MetricsSink {
  readonly events: MetricsEvent[] = [];
  track(event: MetricsEvent): void {
    this.events.push(event);
    if (this.events.length > 500) this.events.shift();
  }
}
