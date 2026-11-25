/// <reference lib="webworker" />
import { renderLoop, type RenderOptions, type Score } from './synth';

// Renders one music loop off the main thread, so the game never stutters while the music is made.
self.onmessage = (event: MessageEvent<{ score: Score; options: RenderOptions }>): void => {
  const loop = renderLoop(event.data.score, event.data.options);
  self.postMessage(loop, [loop.left.buffer, loop.right.buffer]);
};
