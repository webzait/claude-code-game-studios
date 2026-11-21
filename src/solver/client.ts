import SolverWorker from './worker?worker&inline';
import { handleSolverRequest, type SolverAnswer, type SolverRequest } from './requests';

/**
 * Asks the solver in a background worker. If the browser refuses the worker,
 * the same question is answered on the main thread instead (slower, same answer).
 */
export class SolverClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private waiting = new Map<number, { resolve: (a: SolverAnswer) => void; request: SolverRequest }>();

  private ensure(): Worker | null {
    if (this.worker) return this.worker;
    try {
      const worker = new SolverWorker();
      worker.onmessage = (event: MessageEvent<{ id: number; result: SolverAnswer }>): void => {
        const entry = this.waiting.get(event.data.id);
        this.waiting.delete(event.data.id);
        entry?.resolve(event.data.result);
      };
      worker.onerror = (): void => {
        // Answer everything pending on the main thread and stop using the worker.
        this.worker = null;
        const pending = [...this.waiting.values()];
        this.waiting.clear();
        for (const entry of pending) entry.resolve(handleSolverRequest(entry.request));
      };
      this.worker = worker;
    } catch {
      this.worker = null;
    }
    return this.worker;
  }

  /** Ask one question; resolves with the solver's answer. */
  ask<T extends SolverAnswer>(request: SolverRequest): Promise<T> {
    return new Promise((resolve) => {
      const worker = this.ensure();
      if (!worker) {
        window.setTimeout(() => resolve(handleSolverRequest(request) as T), 0);
        return;
      }
      const id = this.nextId++;
      this.waiting.set(id, { resolve: resolve as (a: SolverAnswer) => void, request });
      worker.postMessage({ id, request });
    });
  }
}
