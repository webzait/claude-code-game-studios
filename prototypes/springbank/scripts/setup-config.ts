// Loads config.js outside a browser (tests, scripts): it writes window.CONFIG.
(globalThis as any).window = globalThis;
await import('../config.js' as string);
export {};
