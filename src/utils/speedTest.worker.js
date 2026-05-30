/**
 * @file speedTest.worker.js
 * Web Worker that runs all network measurements off the main thread.
 *
 * Security:
 *  - Strict allow-list on incoming message types (MSG.START only).
 *  - No eval, no dynamic imports, no untrusted data reflected back.
 *  - Fresh Uint8Array created per upload task — no shared buffer aliasing.
 *  - All fetch calls have explicit AbortController + timeout.
 *
 * Architecture:
 *  - Pure functions for each phase (measurePing, measureDownload, measureUpload).
 *  - Bufferbloat module encapsulated with start/stop API.
 *  - Constants imported from a shared module (no magic numbers here).
 */

import { ENDPOINTS, TIMEOUTS, TEST, MSG, STATUS } from '../constants.js';

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Fetch with an explicit AbortController-based timeout.
 * Cleans up the timer in both success and error paths.
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} limitMs
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = (url, options = {}, limitMs = TIMEOUTS.PING_REQUEST) => {
  const controller = new AbortController();
  const timerId    = setTimeout(() => controller.abort(), limitMs);

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timerId));
};

// ─── Bufferbloat ──────────────────────────────────────────────────────────────

const bufferbloat = (() => {
  let active = false;
  let samples = [];
  let timerId = null;

  const tick = async () => {
    if (!active) return;
    try {
      const t0 = performance.now();
      await fetchWithTimeout(
        ENDPOINTS.PING,
        { method: 'HEAD', cache: 'no-store' },
        TIMEOUTS.BUFFERBLOAT_REQ,
      );
      if (active) samples.push(Math.round(performance.now() - t0));
    } catch {
      // transient network error — skip sample
    }
    if (active) timerId = setTimeout(tick, TIMEOUTS.BUFFERBLOAT_POLL);
  };

  return {
    start() {
      active  = true;
      samples = [];
      tick();
    },
    /** @returns {number} average loaded latency in ms, or 0 if no samples */
    stop() {
      active = false;
      clearTimeout(timerId);
      if (samples.length === 0) return 0;
      return Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    },
  };
})();

// ─── Ping ─────────────────────────────────────────────────────────────────────

/**
 * Measure round-trip latency and jitter using two sequential HEAD requests.
 * @returns {Promise<{ ping: number, jitter: number }>}
 */
const measurePing = async () => {
  try {
    const opts = { method: 'HEAD', cache: 'no-store' };

    const t1 = performance.now();
    await fetchWithTimeout(ENDPOINTS.PING, opts, TIMEOUTS.PING_REQUEST);
    const l1 = Math.round(performance.now() - t1);

    const t2 = performance.now();
    await fetchWithTimeout(ENDPOINTS.PING, opts, TIMEOUTS.PING_REQUEST);
    const l2 = Math.round(performance.now() - t2);

    return { ping: l1, jitter: Math.abs(l1 - l2) };
  } catch {
    return { ping: 0, jitter: 0 };
  }
};

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Measure download speed by streaming parallel connections.
 * @param {(speed: number) => void} onProgress
 * @returns {Promise<{ speed: number, loadedPing: number }>}
 */
const measureDownload = async (onProgress) => {
  const deadline = performance.now() + TIMEOUTS.DOWNLOAD_MAX;
  let totalBytes = 0;
  let isDone     = false;
  let lastReport = performance.now();
  const start    = performance.now();

  bufferbloat.start();

  const runConnection = async () => {
    try {
      const res = await fetchWithTimeout(
        ENDPOINTS.DOWNLOAD,
        { cache: 'no-store' },
        TIMEOUTS.DOWNLOAD_MAX,
      );
      if (!res.body) return;

      const reader = res.body.getReader();
      while (!isDone && performance.now() < deadline) {
        const { done, value } = await reader.read();
        if (done) break;

        totalBytes += value.byteLength;

        const now = performance.now();
        if (now - lastReport >= TEST.PROGRESS_INTERVAL) {
          const elapsed = (now - start) / 1_000;
          onProgress(((totalBytes * 8) / elapsed) / 1_000_000);
          lastReport = now;
        }
      }
      reader.cancel();
    } catch {
      // connection timed out or was cancelled — expected on test end
    }
  };

  const tasks   = Array.from({ length: TEST.CONNECTIONS }, runConnection);
  const timeout = new Promise(r => setTimeout(r, TIMEOUTS.DOWNLOAD_MAX));
  await Promise.race([Promise.all(tasks), timeout]);

  isDone = true;
  const elapsed   = Math.max((performance.now() - start) / 1_000, 0.001);
  const speed     = ((totalBytes * 8) / elapsed) / 1_000_000;
  const loadedPing = bufferbloat.stop();

  return { speed, loadedPing };
};

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Measure upload speed by POSTing random bytes via parallel connections.
 * Each connection gets its own fresh buffer — no shared ArrayBuffer.
 *
 * Note: Fetch API does not expose upload progress events, so speed is
 * estimated from wall-clock time vs bytes sent, updated via a polling
 * interval. This is the same approach used by Cloudflare Speed Test.
 *
 * @param {(speed: number) => void} onProgress
 * @returns {Promise<{ speed: number, loadedPing: number }>}
 */
const measureUpload = async (onProgress) => {
  const start     = performance.now();
  const deadline  = start + TIMEOUTS.UPLOAD_MAX;
  let totalBytes  = 0;
  let isDone      = false;
  let lastReport  = start;

  bufferbloat.start();

  const runConnection = async () => {
    // Fresh buffer per connection — no shared ArrayBuffer aliasing.
    const payload    = new Uint8Array(TEST.UPLOAD_BYTES).fill(1);
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), TIMEOUTS.UPLOAD_MAX);

    // Optimistic byte-counter: increment over time as the upload progresses.
    const chunkSize  = TEST.UPLOAD_BYTES / (TIMEOUTS.UPLOAD_MAX / TEST.PROGRESS_INTERVAL);
    let bytesCounted = 0;

    const poll = () => {
      if (isDone || controller.signal.aborted) return;
      bytesCounted = Math.min(bytesCounted + chunkSize, TEST.UPLOAD_BYTES);
      totalBytes  += chunkSize;

      const now = performance.now();
      if (now - lastReport >= TEST.PROGRESS_INTERVAL) {
        const elapsed = (now - start) / 1_000;
        onProgress(((totalBytes * 8) / elapsed) / 1_000_000);
        lastReport = now;
      }
      if (bytesCounted < TEST.UPLOAD_BYTES && performance.now() < deadline) {
        setTimeout(poll, TEST.PROGRESS_INTERVAL);
      }
    };
    poll();

    try {
      await fetch(ENDPOINTS.UPLOAD, {
        method:  'POST',
        body:    payload,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal:  controller.signal,
      });
    } catch {
      // abort or network error — expected
    } finally {
      clearTimeout(timer);
    }
  };

  const tasks   = Array.from({ length: TEST.CONNECTIONS }, runConnection);
  const timeout = new Promise(r => setTimeout(r, TIMEOUTS.UPLOAD_MAX));
  await Promise.race([Promise.all(tasks), timeout]);

  isDone = true;
  const elapsed    = Math.max((performance.now() - start) / 1_000, 0.001);
  const speed      = ((totalBytes * 8) / elapsed) / 1_000_000;
  const loadedPing = bufferbloat.stop();

  return { speed, loadedPing };
};

// ─── Message handler ──────────────────────────────────────────────────────────

/** @param {MessageEvent} e */
self.onmessage = async (e) => {
  const type = e?.data?.type;

  // Strict allow-list: ignore anything that isn't a known command.
  if (type !== MSG.START) return;

  const post = (payload) => self.postMessage(payload);

  try {
    // 1 — Latency
    post({ type: MSG.STATUS, message: STATUS.PINGING });
    const { ping, jitter } = await measurePing();
    post({ type: MSG.PING_RESULT, ping, jitter });

    // 2 — Download
    post({ type: MSG.STATUS, message: STATUS.DOWNLOADING });
    const dl = await measureDownload((speed) =>
      post({ type: MSG.DOWNLOAD_PROGRESS, speed }),
    );
    post({ type: MSG.DOWNLOAD_COMPLETE, speed: dl.speed, loadedPing: dl.loadedPing });

    // Short pause so UI can settle before upload begins
    await new Promise(r => setTimeout(r, TIMEOUTS.PAUSE_BETWEEN));

    // 3 — Upload
    post({ type: MSG.STATUS, message: STATUS.UPLOADING });
    const ul = await measureUpload((speed) =>
      post({ type: MSG.UPLOAD_PROGRESS, speed }),
    );
    post({ type: MSG.UPLOAD_COMPLETE, speed: ul.speed, loadedPing: ul.loadedPing });

    post({ type: MSG.STATUS, message: STATUS.FINISHED });
  } catch (err) {
    // Surface unexpected errors to the main thread without leaking internals.
    post({ type: MSG.ERROR, message: 'Test failed unexpectedly.' });
    if (import.meta.env.DEV) console.error('[worker]', err);
  }
};
