import { CONFIG } from '../config';
import { renderInSlices } from './player';
import type { Loop } from './synth';
import { renderOptionsOf, scoreOf, type MusicVariant } from './tracks';
import MusicWorker from './worker?worker&inline';

/**
 * Render a variant in a background worker, which is closed again when it is done. If the browser
 * refuses the worker, the same loop is rendered on the main thread in small slices instead.
 */
export function renderInBackground(variant: MusicVariant): Promise<Loop> {
  const fallback = (): Promise<Loop> => renderInSlices(variant, CONFIG.music.renderSliceMs);
  return new Promise<Loop>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new MusicWorker();
    } catch {
      fallback().then(resolve, reject);
      return;
    }
    worker.onmessage = (event: MessageEvent<Loop>): void => {
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = (): void => {
      worker.terminate();
      fallback().then(resolve, reject);
    };
    worker.postMessage({ score: scoreOf(variant), options: renderOptionsOf(variant) });
  });
}
