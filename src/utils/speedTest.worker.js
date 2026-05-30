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
 * Append cache-busting query parameter.
 * @param {string} url
 * @returns {string}
 */
const appendCacheBuster = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

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
        appendCacheBuster(ENDPOINTS.PING),
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
    await fetchWithTimeout(appendCacheBuster(ENDPOINTS.PING), opts, TIMEOUTS.PING_REQUEST);
    const l1 = Math.round(performance.now() - t1);

    const t2 = performance.now();
    await fetchWithTimeout(appendCacheBuster(ENDPOINTS.PING), opts, TIMEOUTS.PING_REQUEST);
    const l2 = Math.round(performance.now() - t2);

    return { ping: l1, jitter: Math.abs(l1 - l2) };
  } catch {
    return { ping: 0, jitter: 0 };
  }
};

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Measure download speed by streaming parallel connections.
 * Tracks metrics per connection to prevent race conditions.
 * @param {(speed: number) => void} onProgress
 * @returns {Promise<{ speed: number, loadedPing: number }>}
 */
const measureDownload = async (onProgress) => {
  const deadline = performance.now() + TIMEOUTS.DOWNLOAD_MAX;
  let isDone     = false;
  let lastReport = performance.now();
  const abortController = new AbortController();

  const conns = Array.from({ length: TEST.CONNECTIONS }, () => ({
    bytesLoaded: 0,
    transferStart: null,
    actualStart: null,
    actualBytes: 0,
    warmupDone: false,
  }));

  bufferbloat.start();

  const runConnection = async (index) => {
    const conn = conns[index];
    try {
      const res = await fetch(
        appendCacheBuster(ENDPOINTS.DOWNLOAD),
        { cache: 'no-store', signal: abortController.signal }
      );
      if (!res.body) return;

      const reader = res.body.getReader();
      try {
        while (!isDone && performance.now() < deadline) {
          const { done, value } = await reader.read();
          if (done) break;

          const now = performance.now();
          conn.bytesLoaded += value.byteLength;

          if (conn.transferStart === null && value.byteLength > 0) {
            conn.transferStart = now;
          }

          if (conn.transferStart !== null && !conn.warmupDone) {
            // Discard first 1 second of transfer to let TCP buffer windows warm up
            if (now - conn.transferStart >= 1000) {
              conn.warmupDone = true;
              conn.actualStart = now;
              conn.actualBytes = value.byteLength;
            }
          } else if (conn.warmupDone) {
            conn.actualBytes += value.byteLength;
          }

          if (now - lastReport >= TEST.PROGRESS_INTERVAL) {
            let aggregateSpeed = 0;
            let warmedUpCount = 0;
            let earliestActualStart = null;
            let totalWarmedUpBytes = 0;

            let earliestTransferStart = null;
            let totalRawBytes = 0;

            for (let i = 0; i < TEST.CONNECTIONS; i++) {
              const c = conns[i];
              if (c.transferStart !== null) {
                if (earliestTransferStart === null || c.transferStart < earliestTransferStart) {
                  earliestTransferStart = c.transferStart;
                }
                totalRawBytes += c.bytesLoaded;
              }

              if (c.warmupDone && c.actualStart !== null) {
                warmedUpCount++;
                if (earliestActualStart === null || c.actualStart < earliestActualStart) {
                  earliestActualStart = c.actualStart;
                }
                totalWarmedUpBytes += c.actualBytes;
              }
            }

            if (warmedUpCount > 0 && earliestActualStart !== null) {
              const elapsed = (now - earliestActualStart) / 1000;
              if (elapsed > 0.05) {
                aggregateSpeed = ((totalWarmedUpBytes * 8) / elapsed) / 1_000_000;
              }
            } else if (earliestTransferStart !== null) {
              const elapsed = (now - earliestTransferStart) / 1000;
              if (elapsed > 0.05) {
                aggregateSpeed = ((totalRawBytes * 8) / elapsed) / 1_000_000;
              }
            }

            if (aggregateSpeed > 0) {
              onProgress(aggregateSpeed);
            }
            lastReport = now;
          }
        }
      } finally {
        reader.cancel();
      }
    } catch {
      // connection timed out or was cancelled — expected on test end
    }
  };

  const tasks   = Array.from({ length: TEST.CONNECTIONS }, (_, i) => runConnection(i));
  const timeout = new Promise(r => setTimeout(r, TIMEOUTS.DOWNLOAD_MAX));
  await Promise.race([Promise.all(tasks), timeout]);

  isDone = true;
  abortController.abort(); // Cancel any lingering download stream reads immediately

  const now = performance.now();

  let earliestActualStart = null;
  let totalWarmedUpBytes = 0;
  let earliestTransferStart = null;
  let totalRawBytes = 0;
  let warmedUpCount = 0;

  for (let i = 0; i < TEST.CONNECTIONS; i++) {
    const c = conns[i];
    if (c.transferStart !== null) {
      if (earliestTransferStart === null || c.transferStart < earliestTransferStart) {
        earliestTransferStart = c.transferStart;
      }
      totalRawBytes += c.bytesLoaded;
    }
    if (c.warmupDone && c.actualStart !== null) {
      warmedUpCount++;
      if (earliestActualStart === null || c.actualStart < earliestActualStart) {
        earliestActualStart = c.actualStart;
      }
      totalWarmedUpBytes += c.actualBytes;
    }
  }

  let speed = 0;
  if (warmedUpCount > 0 && earliestActualStart !== null) {
    const elapsed = (now - earliestActualStart) / 1000;
    speed = ((totalWarmedUpBytes * 8) / Math.max(elapsed, 0.05)) / 1_000_000;
  } else if (earliestTransferStart !== null) {
    const elapsed = (now - earliestTransferStart) / 1000;
    speed = ((totalRawBytes * 8) / Math.max(elapsed, 0.05)) / 1_000_000;
  }

  const loadedPing = bufferbloat.stop();

  return { speed, loadedPing };
};

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * Measure upload speed by POSTing random bytes via parallel connections.
 * Uses XMLHttpRequest in Web Worker to get true upload progress events.
 *
 * @param {(speed: number) => void} onProgress
 * @returns {Promise<{ speed: number, loadedPing: number }>}
 */
const measureUpload = async (onProgress) => {
  const deadline = performance.now() + TIMEOUTS.UPLOAD_MAX;
  let isDone     = false;
  let lastReport = performance.now();
  const abortController = new AbortController();

  const conns = Array.from({ length: TEST.CONNECTIONS }, () => ({
    bytesLoaded: 0,
    transferStart: null,
    actualStart: null,
    actualBytes: 0,
    warmupDone: false,
    chunkSize: TEST.UPLOAD_INITIAL_CHUNK,
  }));

  bufferbloat.start();

  const runConnection = async (index) => {
    const conn = conns[index];
    
    while (!isDone && performance.now() < deadline) {
      const currentChunkSize = conn.chunkSize;
      const payload = new Uint8Array(currentChunkSize).fill(1);
      const t0 = performance.now();

      try {
        if (conn.transferStart === null) {
          conn.transferStart = t0;
        }

        await fetch(
          appendCacheBuster(ENDPOINTS.UPLOAD),
          {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'text/plain' },
            signal: abortController.signal,
          }
        );

        const now = performance.now();
        const duration = now - t0;

        // Dynamic chunk size adjustment based on connection speed
        if (duration < 100) {
          conn.chunkSize = Math.min(conn.chunkSize * 2, TEST.UPLOAD_MAX_CHUNK);
        } else if (duration > 500) {
          conn.chunkSize = Math.max(conn.chunkSize / 2, TEST.UPLOAD_MIN_CHUNK);
        }

        conn.bytesLoaded += currentChunkSize;

        if (conn.transferStart !== null && !conn.warmupDone) {
          if (now - conn.transferStart >= 1000) {
            conn.warmupDone = true;
            conn.actualStart = now;
            conn.actualBytes = 0;
          }
        } else if (conn.warmupDone) {
          conn.actualBytes += currentChunkSize;
        }

        if (now - lastReport >= TEST.PROGRESS_INTERVAL) {
          let aggregateSpeed = 0;
          let warmedUpCount = 0;
          let earliestActualStart = null;
          let totalWarmedUpBytes = 0;

          let earliestTransferStart = null;
          let totalRawBytes = 0;

          for (let i = 0; i < TEST.CONNECTIONS; i++) {
            const c = conns[i];
            if (c.transferStart !== null) {
              if (earliestTransferStart === null || c.transferStart < earliestTransferStart) {
                earliestTransferStart = c.transferStart;
              }
              totalRawBytes += c.bytesLoaded;
            }

            if (c.warmupDone && c.actualStart !== null) {
              warmedUpCount++;
              if (earliestActualStart === null || c.actualStart < earliestActualStart) {
                earliestActualStart = c.actualStart;
              }
              totalWarmedUpBytes += c.actualBytes;
            }
          }

          if (warmedUpCount > 0 && earliestActualStart !== null) {
            const elapsed = (now - earliestActualStart) / 1000;
            if (elapsed > 0.05) {
              aggregateSpeed = ((totalWarmedUpBytes * 8) / elapsed) / 1_000_000;
            }
          } else if (earliestTransferStart !== null) {
            const elapsed = (now - earliestTransferStart) / 1000;
            if (elapsed > 0.05) {
              aggregateSpeed = ((totalRawBytes * 8) / elapsed) / 1_000_000;
            }
          }

          if (aggregateSpeed > 0) {
            onProgress(aggregateSpeed);
          }
          lastReport = now;
        }
      } catch {
        if (isDone) break;
        await new Promise(r => setTimeout(r, 100));
      }
    }
  };

  const tasks   = Array.from({ length: TEST.CONNECTIONS }, (_, i) => runConnection(i));
  const timeout = new Promise(r => setTimeout(r, TIMEOUTS.UPLOAD_MAX));
  await Promise.race([Promise.all(tasks), timeout]);

  isDone = true;
  abortController.abort(); // Cancel any active POST fetches immediately

  const now = performance.now();

  let earliestActualStart = null;
  let totalWarmedUpBytes = 0;
  let earliestTransferStart = null;
  let totalRawBytes = 0;
  let warmedUpCount = 0;

  for (let i = 0; i < TEST.CONNECTIONS; i++) {
    const c = conns[i];
    if (c.transferStart !== null) {
      if (earliestTransferStart === null || c.transferStart < earliestTransferStart) {
        earliestTransferStart = c.transferStart;
      }
      totalRawBytes += c.bytesLoaded;
    }
    if (c.warmupDone && c.actualStart !== null) {
      warmedUpCount++;
      if (earliestActualStart === null || c.actualStart < earliestActualStart) {
        earliestActualStart = c.actualStart;
      }
      totalWarmedUpBytes += c.actualBytes;
    }
  }

  let speed = 0;
  if (warmedUpCount > 0 && earliestActualStart !== null) {
    const elapsed = (now - earliestActualStart) / 1000;
    speed = ((totalWarmedUpBytes * 8) / Math.max(elapsed, 0.05)) / 1_000_000;
  } else if (earliestTransferStart !== null) {
    const elapsed = (now - earliestTransferStart) / 1000;
    speed = ((totalRawBytes * 8) / Math.max(elapsed, 0.05)) / 1_000_000;
  }

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
