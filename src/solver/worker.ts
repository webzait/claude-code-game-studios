/// <reference lib="webworker" />
import { handleSolverRequest, type SolverRequest } from './requests';

// Runs solver questions off the main thread so the game never freezes while it thinks.
self.onmessage = (event: MessageEvent<{ id: number; request: SolverRequest }>): void => {
  const { id, request } = event.data;
  self.postMessage({ id, result: handleSolverRequest(request) });
};
