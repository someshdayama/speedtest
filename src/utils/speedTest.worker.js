/**
 * @file speedTest.worker.js
 * Web Worker that runs all network measurements off the main thread.
 *
 * Phases: ping → download → upload → finished
 * Uses Cloudflare public speed endpoints only (no private test server).
 *
 * Stability:
 *  - Progressive download payload sizes via __down?bytes=N
 *  - Parallel streams with TCP warmup discard
 *  - Final Mbps from trimmed mean of late progress samples
 *  - AbortController for mid-test cancel + timeouts
 */

import { ENDPOINTS, TIMEOUTS, TEST, MSG, STATUS } from '../constants.js';

// ─── Shared abort ─────────────────────────────────────────────────────────────

/** @type {AbortController | null} */
let runAbort = null;

const isAborted = () => runAbort?.signal.aborted === true;

const throwIfAborted = () => {
  if (isAborted()) {
    const err = new Error('Test aborted');
    err.name = 'AbortError';
    throw err;
  }
};

// ─── Utility ─────────────────────────────────────────────────────────────────

const appendCacheBuster = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

/**
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} limitMs
 * @param {AbortSignal} [externalSignal]
 */
const fetchWithTimeout = (url, options = {}, limitMs = TIMEOUTS.PING_REQUEST, externalSignal) => {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), limitMs);

  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => {
      clearTimeout(timerId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    });
};

/**
 * Trimmed mean of the highest-stability late samples (drop outliers).
 * @param {number[]} samples
 * @returns {number}
 */
const stableMbps = (samples) => {
  const valid = samples.filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (valid.length === 0) return 0;
  if (valid.length < TEST.FINAL_MIN_SAMPLES) {
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }

  const start = Math.max(0, Math.floor(valid.length * (1 - TEST.FINAL_SAMPLE_RATIO)));
  const window = valid.slice(start).sort((a, b) => a - b);

  // Drop top/bottom 12.5% when enough samples
  if (window.length >= 8) {
    const trim = Math.floor(window.length * 0.125);
    const trimmed = window.slice(trim, window.length - trim);
    return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
  }

  return window.reduce((a, b) => a + b, 0) / window.length;
};

const roundMbps = (n) => Math.round(n * 10) / 10;

/**
 * True when recent Mbps samples are stable enough to stop early.
 * @param {number[]} samples
 * @param {number} elapsedMs
 */
const canEarlyExit = (samples, elapsedMs) => {
  if (elapsedMs < TEST.EARLY_EXIT_MIN_MS) return false;
  if (samples.length < TEST.EARLY_EXIT_MIN_SAMPLES) return false;
  const window = samples.slice(-TEST.EARLY_EXIT_MIN_SAMPLES);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  if (mean <= 0) return false;
  const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
  const cv = Math.sqrt(variance) / mean;
  return cv <= TEST.EARLY_EXIT_CV;
};


// ─── Bufferbloat ──────────────────────────────────────────────────────────────

const bufferbloat = (() => {
  let active = false;
  let samples = [];
  let timerId = null;

  const tick = async () => {
    if (!active || isAborted()) return;
    try {
      const t0 = performance.now();
      const res = await fetchWithTimeout(
        appendCacheBuster(ENDPOINTS.PING),
        { method: 'GET', cache: 'no-store' },
        TIMEOUTS.BUFFERBLOAT_REQ,
        runAbort?.signal,
      );
      // Consume body so the connection isn't left hanging (HEAD returns 404 on this endpoint)
      if (res.ok) await res.text().catch(() => {});
      if (active) samples.push(Math.round(performance.now() - t0));
    } catch {
      // skip sample
    }
    if (active && !isAborted()) timerId = setTimeout(tick, TIMEOUTS.BUFFERBLOAT_POLL);
  };

  return {
    start() {
      active = true;
      samples = [];
      tick();
    },
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
 * Measure RTT + jitter from multiple samples (warmup discarded).
 * @param {(pct: number) => void} onPhaseProgress
 * @returns {Promise<{ ping: number, jitter: number }>}
 */
const measurePing = async (onPhaseProgress) => {
  const samples = [];
  const opts = { method: 'GET', cache: 'no-store' };
  const total = TEST.PING_SAMPLES;

  for (let i = 0; i < total; i++) {
    throwIfAborted();
    try {
      const t0 = performance.now();
      const res = await fetchWithTimeout(
        appendCacheBuster(ENDPOINTS.PING),
        opts,
        TIMEOUTS.PING_REQUEST,
        runAbort?.signal,
      );
      // Consume body lightly so connection isn't left hanging
      if (res.ok) await res.text().catch(() => {});
      const rtt = Math.round(performance.now() - t0);
      // Skip first sample(s) as DNS/TLS warmup
      if (i >= TEST.PING_WARMUP) samples.push(rtt);
    } catch (err) {
      if (err?.name === 'AbortError' && isAborted()) throw err;
      // transient — continue
    }
    onPhaseProgress(Math.round(((i + 1) / total) * 100));
  }

  if (samples.length === 0) {
    const err = new Error('Unable to reach the network. Check your connection and try again.');
    err.code = 'OFFLINE';
    throw err;
  }

  const avgPing = Math.round(samples.reduce((sum, s) => sum + s, 0) / samples.length);

  let jitter = 0;
  if (samples.length >= 2) {
    let sumDiffs = 0;
    for (let i = 1; i < samples.length; i++) {
      sumDiffs += Math.abs(samples[i] - samples[i - 1]);
    }
    jitter = Math.round((sumDiffs / (samples.length - 1)) * 10) / 10;
  }

  return { ping: avgPing, jitter };
};

const calculateAggregateSpeed = (conns, now) => {
  let earliestActualStart = null;
  let totalWarmedUpBytes = 0;
  let earliestTransferStart = null;
  let totalRawBytes = 0;
  let warmedUpCount = 0;

  for (let i = 0; i < conns.length; i++) {
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
    const elapsed = Math.max((now - earliestActualStart) / 1000, 0.05);
    speed = ((totalWarmedUpBytes * 8) / elapsed) / 1_000_000;
  } else if (earliestTransferStart !== null) {
    const elapsed = Math.max((now - earliestTransferStart) / 1000, 0.05);
    speed = ((totalRawBytes * 8) / elapsed) / 1_000_000;
  }
  return speed;
};

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Parallel download with progressive payload sizes for more stable Mbps.
 * @param {(speed: number) => void} onProgress
 * @param {(pct: number) => void} onPhaseProgress
 */
const measureDownload = async (onProgress, onPhaseProgress) => {
  const deadline = performance.now() + TIMEOUTS.DOWNLOAD_MAX;
  let isDone = false;
  let lastReport = performance.now();
  const abortController = new AbortController();
  const progressSamples = [];

  const onRunAbort = () => {
    isDone = true;
    abortController.abort();
  };
  runAbort?.signal.addEventListener('abort', onRunAbort, { once: true });

  const conns = Array.from({ length: TEST.CONNECTIONS }, () => ({
    bytesLoaded: 0,
    transferStart: null,
    actualStart: null,
    actualBytes: 0,
    warmupDone: false,
    sizeIndex: 0,
  }));

  bufferbloat.start();

  const downloadUrl = (bytes) =>
    appendCacheBuster(`${ENDPOINTS.DOWNLOAD}?bytes=${bytes}`);

  const runConnection = async (index) => {
    const conn = conns[index];

    while (!isDone && performance.now() < deadline && !isAborted()) {
      const sizeIdx = Math.min(conn.sizeIndex, TEST.DOWNLOAD_SIZES.length - 1);
      const bytes = TEST.DOWNLOAD_SIZES[sizeIdx];

      try {
        const res = await fetch(downloadUrl(bytes), {
          cache: 'no-store',
          signal: abortController.signal,
        });
        if (!res.body) break;

        const reader = res.body.getReader();
        try {
          while (!isDone && performance.now() < deadline && !isAborted()) {
            const { done, value } = await reader.read();
            if (done) break;

            const now = performance.now();
            conn.bytesLoaded += value.byteLength;

            if (conn.transferStart === null && value.byteLength > 0) {
              conn.transferStart = now;
            }

            if (conn.transferStart !== null && !conn.warmupDone) {
              if (now - conn.transferStart >= TEST.WARMUP_MS) {
                conn.warmupDone = true;
                conn.actualStart = now;
                conn.actualBytes = value.byteLength;
              }
            } else if (conn.warmupDone) {
              conn.actualBytes += value.byteLength;
            }

            if (now - lastReport >= TEST.PROGRESS_INTERVAL) {
              const aggregateSpeed = calculateAggregateSpeed(conns, now);
              if (aggregateSpeed > 0) {
                progressSamples.push(aggregateSpeed);
                onProgress(roundMbps(aggregateSpeed));
              }
              const transferStart = conns.reduce(
                (min, c) => (c.transferStart !== null && (min === null || c.transferStart < min) ? c.transferStart : min),
                null,
              );
              const elapsed = transferStart !== null ? now - transferStart : 0;
              const pct = Math.min(99, Math.round((elapsed / TIMEOUTS.DOWNLOAD_MAX) * 100));
              onPhaseProgress(pct);
              lastReport = now;

              // Progressive early-exit once TCP is warm and Mbps has stabilized
              if (
                conns.every((c) => c.warmupDone) &&
                canEarlyExit(progressSamples, elapsed)
              ) {
                isDone = true;
                abortController.abort();
                break;
              }
            }
          }
        } finally {
          try { reader.cancel(); } catch { /* ignore */ }
        }

        // Graduate to larger payload when this size completed under time budget
        if (!isDone && conn.sizeIndex < TEST.DOWNLOAD_SIZES.length - 1) {
          conn.sizeIndex += 1;
        }
      } catch {
        if (isDone || isAborted()) break;
        await new Promise((r) => setTimeout(r, 80));
      }
    }
  };

  const tasks = Array.from({ length: TEST.CONNECTIONS }, (_, i) => runConnection(i));
  const timeout = new Promise((r) => setTimeout(r, TIMEOUTS.DOWNLOAD_MAX));
  await Promise.race([Promise.all(tasks), timeout]);

  isDone = true;
  abortController.abort();
  runAbort?.signal.removeEventListener('abort', onRunAbort);

  throwIfAborted();

  const now = performance.now();
  const live = calculateAggregateSpeed(conns, now);
  const speed = roundMbps(stableMbps(progressSamples.length ? progressSamples : [live]));
  const loadedPing = bufferbloat.stop();
  onPhaseProgress(100);

  if (speed <= 0 && conns.every((c) => c.bytesLoaded === 0)) {
    const err = new Error('Download test failed. The endpoint may be blocked or unreachable.');
    err.code = 'DOWNLOAD_FAILED';
    throw err;
  }

  return { speed, loadedPing };
};

// ─── Upload ───────────────────────────────────────────────────────────────────

/**
 * POST a chunk via XHR so we get real upload progress events (fetch cannot).
 * @param {Uint8Array} payload
 * @param {AbortSignal} signal
 * @param {(loaded: number) => void} onBytes
 * @returns {Promise<number>} duration ms
 */
const xhrUploadChunk = (payload, signal, onBytes) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastLoaded = 0;

    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      try { xhr.abort(); } catch { /* ignore */ }
      cleanup();
      const err = new Error('Aborted');
      err.name = 'AbortError';
      reject(err);
    };

    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      const delta = ev.loaded - lastLoaded;
      if (delta > 0) {
        lastLoaded = ev.loaded;
        onBytes(delta);
      }
    };

    xhr.onload = () => {
      cleanup();
      // Account for any remaining bytes not reported in progress events
      if (payload.byteLength > lastLoaded) {
        onBytes(payload.byteLength - lastLoaded);
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(performance.now());
      else reject(new Error(`Upload HTTP ${xhr.status}`));
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error('Upload network error'));
    };

    xhr.ontimeout = () => {
      cleanup();
      reject(new Error('Upload timeout'));
    };

    xhr.open('POST', appendCacheBuster(ENDPOINTS.UPLOAD));
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = TIMEOUTS.UPLOAD_MAX;
    xhr.send(payload);
  });

/**
 * Parallel upload with adaptive chunk sizing + real XHR upload progress.
 * @param {(speed: number) => void} onProgress
 * @param {(pct: number) => void} onPhaseProgress
 */
const measureUpload = async (onProgress, onPhaseProgress) => {
  const deadline = performance.now() + TIMEOUTS.UPLOAD_MAX;
  let isDone = false;
  let lastReport = performance.now();
  const abortController = new AbortController();
  const progressSamples = [];

  const onRunAbort = () => {
    isDone = true;
    abortController.abort();
  };
  runAbort?.signal.addEventListener('abort', onRunAbort, { once: true });

  const maxPayload = new Uint8Array(TEST.UPLOAD_MAX_CHUNK).fill(1);

  const conns = Array.from({ length: TEST.CONNECTIONS }, () => ({
    bytesLoaded: 0,
    transferStart: null,
    actualStart: null,
    actualBytes: 0,
    warmupDone: false,
    chunkSize: TEST.UPLOAD_INITIAL_CHUNK,
  }));

  bufferbloat.start();

  const reportProgress = () => {
    const now = performance.now();
    if (now - lastReport < TEST.PROGRESS_INTERVAL) return;
    const aggregateSpeed = calculateAggregateSpeed(conns, now);
    if (aggregateSpeed > 0) {
      progressSamples.push(aggregateSpeed);
      onProgress(roundMbps(aggregateSpeed));
    }
    const transferStart = conns.reduce(
      (min, c) => (c.transferStart !== null && (min === null || c.transferStart < min) ? c.transferStart : min),
      null,
    );
    const elapsed = transferStart !== null ? now - transferStart : 0;
    onPhaseProgress(Math.min(99, Math.round((elapsed / TIMEOUTS.UPLOAD_MAX) * 100)));
    lastReport = now;

    if (
      conns.every((c) => c.warmupDone) &&
      canEarlyExit(progressSamples, elapsed)
    ) {
      isDone = true;
      abortController.abort();
    }
  };

  const runConnection = async (index) => {
    const conn = conns[index];

    while (!isDone && performance.now() < deadline && !isAborted()) {
      const currentChunkSize = conn.chunkSize;
      const payload = maxPayload.subarray(0, currentChunkSize);
      const t0 = performance.now();

      try {
        if (conn.transferStart === null) {
          conn.transferStart = t0;
        }

        await xhrUploadChunk(payload, abortController.signal, (delta) => {
          conn.bytesLoaded += delta;

          const now = performance.now();
          if (conn.transferStart !== null && !conn.warmupDone) {
            if (now - conn.transferStart >= TEST.WARMUP_MS) {
              conn.warmupDone = true;
              conn.actualStart = now;
              conn.actualBytes = delta;
            }
          } else if (conn.warmupDone) {
            conn.actualBytes += delta;
          }
          reportProgress();
        });

        const duration = performance.now() - t0;
        if (duration < 100) {
          conn.chunkSize = Math.min(conn.chunkSize * 2, TEST.UPLOAD_MAX_CHUNK);
        } else if (duration > 500) {
          conn.chunkSize = Math.max(Math.floor(conn.chunkSize / 2), TEST.UPLOAD_MIN_CHUNK);
        }
      } catch (err) {
        if (isDone || isAborted() || err?.name === 'AbortError') break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }
  };

  const tasks = Array.from({ length: TEST.CONNECTIONS }, (_, i) => runConnection(i));
  const timeout = new Promise((r) => setTimeout(r, TIMEOUTS.UPLOAD_MAX));
  await Promise.race([Promise.all(tasks), timeout]);

  isDone = true;
  abortController.abort();
  runAbort?.signal.removeEventListener('abort', onRunAbort);

  throwIfAborted();

  const now = performance.now();
  const live = calculateAggregateSpeed(conns, now);
  const speed = roundMbps(stableMbps(progressSamples.length ? progressSamples : [live]));
  const loadedPing = bufferbloat.stop();
  onPhaseProgress(100);

  if (speed <= 0 && conns.every((c) => c.bytesLoaded === 0)) {
    const err = new Error('Upload test failed. The endpoint may be blocked or unreachable.');
    err.code = 'UPLOAD_FAILED';
    throw err;
  }

  return { speed, loadedPing };
};

// ─── Message handler ──────────────────────────────────────────────────────────

self.onmessage = async (e) => {
  const type = e?.data?.type;

  if (type === MSG.ABORT) {
    runAbort?.abort();
    return;
  }

  if (type !== MSG.START) return;

  // Cancel any previous run in this worker (shouldn't happen — main recreates worker)
  runAbort?.abort();
  runAbort = new AbortController();

  const post = (payload) => self.postMessage(payload);
  const postPhase = (pct) => post({ type: MSG.PHASE_PROGRESS, progress: pct });

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      post({
        type: MSG.ERROR,
        message: 'You appear to be offline. Reconnect and try again.',
        code: 'OFFLINE',
      });
      return;
    }

    // 1 — Latency
    post({ type: MSG.STATUS, message: STATUS.PINGING });
    postPhase(0);
    const { ping, jitter } = await measurePing(postPhase);
    post({ type: MSG.PING_RESULT, ping, jitter });

    // 2 — Download
    post({ type: MSG.STATUS, message: STATUS.DOWNLOADING });
    postPhase(0);
    const dl = await measureDownload(
      (speed) => post({ type: MSG.DOWNLOAD_PROGRESS, speed }),
      postPhase,
    );
    post({ type: MSG.DOWNLOAD_COMPLETE, speed: dl.speed, loadedPing: dl.loadedPing });

    await new Promise((r) => setTimeout(r, TIMEOUTS.PAUSE_BETWEEN));
    throwIfAborted();

    // 3 — Upload
    post({ type: MSG.STATUS, message: STATUS.UPLOADING });
    postPhase(0);
    const ul = await measureUpload(
      (speed) => post({ type: MSG.UPLOAD_PROGRESS, speed }),
      postPhase,
    );
    post({ type: MSG.UPLOAD_COMPLETE, speed: ul.speed, loadedPing: ul.loadedPing });

    post({ type: MSG.STATUS, message: STATUS.FINISHED });
    postPhase(100);
  } catch (err) {
    if (err?.name === 'AbortError' || isAborted()) {
      // Silent — main thread handles cancel UI
      return;
    }
    post({
      type: MSG.ERROR,
      message: err?.message || 'Test failed unexpectedly. Please try again.',
      code: err?.code || 'UNKNOWN',
    });
  } finally {
    bufferbloat.stop();
  }
};
