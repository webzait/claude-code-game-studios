// Every tuning value is read live from config.js through this proxy: tune.gravity is CONFIG.gravity.value.
type Entry = { value: number; min: number; max: number; step: number };
type Config = { seed: number } & Record<string, Entry | number>;
const g = globalThis as unknown as { CONFIG: Config };

/** Live view on config.js: `tune.<name>` returns the current value of that entry. */
export const tune = new Proxy({} as Record<string, number>, {
  get: (_, k: string) => {
    const e = g.CONFIG[k];
    return typeof e === 'number' ? e : e.value;
  },
});
