/**
 * @file retry.js
 * Small timing helpers shared by the measurement worker.
 */

/** Capped exponential backoff between retries after a failed request (ms). */
export const backoffMs = (attempt, base) => Math.min(base * 2 ** Math.max(0, attempt), 1_000);

/** Resolve after `ms`, or immediately once `signal` aborts. Never leaves a timer behind. */
export const sleep = (ms, signal) => new Promise((resolve) => {
  if (signal?.aborted) { resolve(); return; }
  const id = setTimeout(done, ms);
  function done() {
    clearTimeout(id);
    signal?.removeEventListener('abort', done);
    resolve();
  }
  signal?.addEventListener('abort', done, { once: true });
});
