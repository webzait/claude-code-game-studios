import type { Command } from '../engine/types';

/** Things worth counting later. Nothing here leaves the device in this build. */
export type MetricsEvent =
  | { type: 'level_start'; level: string }
  | { type: 'level_win'; level: string; moves: number; par: number; stars: number; usedBackup: boolean }
  | { type: 'level_fail'; level: string; rescuable: 'yes' | 'no' | 'not-assessed' }
  | { type: 'route_scan'; level: string; result: 'on-route' | 'dead-end' | 'not-assessed'; rung: number }
  | { type: 'backup_signals'; level: string }
  | { type: 'command'; level: string; command: Command }
  | { type: 'milestone'; id: string };

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
