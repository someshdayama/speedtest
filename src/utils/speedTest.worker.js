/**
 * @file speedTest.worker.js
 * Web Worker that runs all network measurements off the main thread.
 *
 * Phases: ping → download → upload → finished
 * Uses Cloudflare public speed endpoints only (no private test server).
 *
 * Every number is computed the same way in every engine, from our own clock
 * and byte counts (no Resource Timing, Server-Timing or navigator.connection):
 *  - Ping: median time-to-response-headers over a warm connection.
 *  - Download and upload: XHR with progress events. The browser accumulates
 *    the bytes natively and reports totals, so there is no per-chunk
 *    JavaScript (reading a fetch ReadableStream chunk by chunk in a worker is
 *    slow in Safari, which under-reported download there). A timer samples
 *    the running byte total. Requests stay small (≤10 MB) and step down after
 *    a failure, since the endpoint rate-limits large bursts with 429s.
 *  - Throughput = bytes moved over the most recent half of the transfer, so
 *    TCP ramp-up is discarded however long a given network stack takes.
 */

import { ENDPOINTS, TIMEOUTS, TEST, MSG, STATUS } from '../constants.js';
import { backoffMs, sleep } from './retry.js';

// ─── Shared abort ─────────────────────────────────────────────────────────────

/** @type {AbortController | null} */
let runAbort = null;

const isAborted = () => runAbort?.signal.aborted === true;

const abortError = () => {
  const err = new Error('Test aborted');
  err.name = 'AbortError';
  return err;
};

const throwIfAborted = () => {
  if (isAborted()) throw abortError();
};

// ─── Utility ─────────────────────────────────────────────────────────────────

const appendCacheBuster = (url) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_=${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
};

const median = (values) => {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const roundMbps = (n) => Math.round(n * 10) / 10;

/**
 * Time one tiny GET to the edge: request start → response headers.
 * The body is drained afterwards, outside the timed span.
 * @returns {Promise<number>} ms
 */
const timeRequest = async (limitMs, signal) => {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), limitMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const t0 = performance.now();
    const res = await fetch(appendCacheBuster(ENDPOINTS.PING), { cache: 'no-store', signal: controller.signal });
    const ms = performance.now() - t0;
    await res.arrayBuffer().catch(() => {});
    if (!res.ok) throw new Error(`Ping HTTP ${res.status}`);
    return ms;
  } finally {
    clearTimeout(timerId);
    signal?.removeEventListener('abort', onAbort);
  }
};

// ─── Loaded latency ───────────────────────────────────────────────────────────

/**
 * Latency probes while the download saturates the link. Only the download
 * phase is probed: during upload, Chromium queues other requests behind its
 * own upload pipeline (hundreds of ms on a link where WebKit shows none), so
 * that number described the browser, not the network.
 */
const loadedLatency = (() => {
  let active = false;
  let samples = [];
  let timerId = null;

  const tick = async () => {
    if (!active || isAborted()) return;
    try {
      const ms = await timeRequest(TIMEOUTS.BUFFERBLOAT_REQ, runAbort?.signal);
      if (active) samples.push(ms);
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
      return Math.round(median(samples));
    },
  };
})();

// ─── Ping ─────────────────────────────────────────────────────────────────────

/**
 * RTT (median) + jitter (mean difference between consecutive samples).
 * The first TEST.PING_WARMUP requests open the connection and are discarded.
 * @returns {Promise<{ ping: number, jitter: number }>}
 */
const measurePing = async () => {
  const samples = [];

  for (let i = 0; i < TEST.PING_WARMUP + TEST.PING_SAMPLES; i++) {
    throwIfAborted();
    try {
      const ms = await timeRequest(TIMEOUTS.PING_REQUEST, runAbort?.signal);
      if (i >= TEST.PING_WARMUP) samples.push(ms);
    } catch {
      if (isAborted()) throw abortError();
      // transient — continue
    }
  }

  if (samples.length === 0) {
    const err = new Error('Unable to reach the network. Check your connection and try again.');
    err.code = 'OFFLINE';
    throw err;
  }

  let jitter = 0;
  if (samples.length >= 2) {
    let sumDiffs = 0;
    for (let i = 1; i < samples.length; i++) sumDiffs += Math.abs(samples[i] - samples[i - 1]);
    jitter = Math.round((sumDiffs / (samples.length - 1)) * 10) / 10;
  }

  return { ping: Math.round(median(samples)), jitter };
};

// ─── Transfers ────────────────────────────────────────────────────────────────

/**
 * One XHR transfer. Reports byte deltas from progress events (download:
 * response bytes received; upload: request bytes sent).
 * @param {{ method: 'GET'|'POST', url: string, body?: Uint8Array, signal: AbortSignal,
 *           onBytes: (delta: number) => void }} opts
 */
const xhrTransfer = ({ method, url, body, signal, onBytes }) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const target = body ? xhr.upload : xhr;
    let reported = 0;

    const credit = (loaded) => {
      if (loaded > reported) {
        onBytes(loaded - reported);
        reported = loaded;
      }
    };
    const finish = (fn, arg) => {
      signal.removeEventListener('abort', onAbort);
      fn(arg);
    };
    const onAbort = () => {
      xhr.abort();
      finish(reject, abortError());
    };

    if (signal.aborted) {
      reject(abortError());
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    target.onprogress = (ev) => credit(ev.loaded);
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        finish(reject, new Error(`HTTP ${xhr.status}`));
        return;
      }
      // Progress events may stop short of the total; the transfer is complete.
      credit(body ? body.byteLength : Math.max(reported, xhr.response?.byteLength ?? 0));
      finish(resolve);
    };
    xhr.onerror = () => finish(reject, new Error('Network error'));
    xhr.ontimeout = () => finish(reject, new Error('Timeout'));

    xhr.open(method, url);
    xhr.responseType = 'arraybuffer';
    xhr.timeout = TIMEOUTS.TRANSFER_MAX;
    if (body) xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.send(body ?? null);
  });

/**
 * Run TEST.CONNECTIONS parallel transfer loops for up to `maxMs`, sampling
 * the shared byte counter on a timer.
 *
 * @param {object} opts
 * @param {(sizeIndex: number) => { url: string, body?: Uint8Array, method: 'GET'|'POST' }} opts.request
 * @param {number} opts.sizes        number of payload steps (each loop grows one step per transfer)
 * @param {number} opts.maxMs
 * @param {(mbps: number) => void} opts.onProgress
 * @returns {Promise<{ speed: number, bytes: number }>}
 */
const measureThroughput = async ({ request, sizes, maxMs, onProgress }) => {
  const abortController = new AbortController();
  const signal = abortController.signal;
  const onRunAbort = () => abortController.abort();
  runAbort?.signal.addEventListener('abort', onRunAbort, { once: true });

  let bytes = 0;
  let firstByteAt = null;
  /** @type {{ t: number, bytes: number }[]} cumulative byte count over time */
  const series = [];
  const rates = [];

  // Throughput over the most recent half of the transfer (discards ramp-up).
  const rateNow = (now) => {
    if (firstByteAt === null || now - firstByteAt < TEST.MIN_WINDOW_MS) return 0;
    const from = firstByteAt + (now - firstByteAt) / 2;
    let i = 0;
    while (i < series.length - 1 && series[i + 1].t <= from) i++;
    const base = series[i];
    const dt = now - base.t;
    return dt > 0 ? ((bytes - base.bytes) * 8) / dt / 1000 : 0;
  };

  const loop = async () => {
    let step = 0;
    let failures = 0;
    while (!signal.aborted) {
      try {
        await xhrTransfer({
          ...request(step),
          signal,
          onBytes: (delta) => {
            if (firstByteAt === null) {
              firstByteAt = performance.now();
              series.push({ t: firstByteAt, bytes: 0 });
            }
            bytes += delta;
          },
        });
        failures = 0;
        step = Math.min(step + 1, sizes - 1);
      } catch {
        if (signal.aborted) return;
        // Failed or rate-limited (a 429 reaches us as a CORS error): back off, go smaller.
        step = Math.max(step - 1, 0);
        await sleep(backoffMs(failures, 250), signal);
        failures += 1;
      }
    }
  };

  const started = performance.now();
  const sampler = setInterval(() => {
    const now = performance.now();
    if (firstByteAt !== null) series.push({ t: now, bytes });
    const mbps = rateNow(now);
    if (mbps > 0) {
      rates.push(mbps);
      onProgress(roundMbps(mbps));
    }
    const window = rates.slice(-TEST.EARLY_EXIT_MIN_SAMPLES);
    const stable = firstByteAt !== null && now - firstByteAt >= TEST.EARLY_EXIT_MIN_MS
      && window.length === TEST.EARLY_EXIT_MIN_SAMPLES
      && (Math.max(...window) - Math.min(...window)) / Math.max(...window) <= TEST.EARLY_EXIT_SPREAD;
    if (stable || now - started >= maxMs) abortController.abort();
  }, TEST.PROGRESS_INTERVAL);

  const loops = Array.from({ length: TEST.CONNECTIONS }, loop);
  await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
  clearInterval(sampler);
  await Promise.allSettled(loops);
  runAbort?.signal.removeEventListener('abort', onRunAbort);
  throwIfAborted();

  const now = performance.now();
  series.push({ t: now, bytes });
  return { speed: roundMbps(rateNow(now)), bytes };
};

// ─── Download ─────────────────────────────────────────────────────────────────

const measureDownload = async (onProgress) => {
  loadedLatency.start();
  try {
    const { speed, bytes } = await measureThroughput({
      request: (step) => ({
        method: 'GET',
        url: appendCacheBuster(`${ENDPOINTS.DOWNLOAD}?bytes=${TEST.DOWNLOAD_SIZES[step]}`),
      }),
      sizes: TEST.DOWNLOAD_SIZES.length,
      maxMs: TIMEOUTS.DOWNLOAD_MAX,
      onProgress,
    });
    if (speed <= 0 && bytes === 0) {
      const err = new Error('Download test failed. The test server may be limiting requests from your network; wait a minute and try again.');
      err.code = 'DOWNLOAD_FAILED';
      throw err;
    }
    return { speed, loadedPing: loadedLatency.stop() };
  } finally {
    loadedLatency.stop();
  }
};

// ─── Upload ───────────────────────────────────────────────────────────────────

const measureUpload = async (onProgress) => {
  const payload = new Uint8Array(TEST.UPLOAD_SIZES[TEST.UPLOAD_SIZES.length - 1]).fill(1);
  const { speed, bytes } = await measureThroughput({
    // POSTs are never cached, and a fixed URL lets the browser reuse its CORS
    // preflight instead of paying one per request.
    request: (step) => ({
      method: 'POST',
      url: ENDPOINTS.UPLOAD,
      body: payload.subarray(0, TEST.UPLOAD_SIZES[step]),
    }),
    sizes: TEST.UPLOAD_SIZES.length,
    maxMs: TIMEOUTS.UPLOAD_MAX,
    onProgress,
  });
  if (speed <= 0 && bytes === 0) {
    const err = new Error('Upload test failed. The test server may be limiting requests from your network; wait a minute and try again.');
    err.code = 'UPLOAD_FAILED';
    throw err;
  }
  return { speed };
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
    const { ping, jitter } = await measurePing();
    post({ type: MSG.PING_RESULT, ping, jitter });

    // 2 — Download
    post({ type: MSG.STATUS, message: STATUS.DOWNLOADING });
    const dl = await measureDownload(
      (speed) => post({ type: MSG.DOWNLOAD_PROGRESS, speed }),
    );
    post({ type: MSG.DOWNLOAD_COMPLETE, speed: dl.speed, loadedPing: dl.loadedPing });

    await sleep(TIMEOUTS.PAUSE_BETWEEN, runAbort.signal);
    throwIfAborted();

    // 3 — Upload (loaded latency comes from the download phase)
    post({ type: MSG.STATUS, message: STATUS.UPLOADING });
    const ul = await measureUpload(
      (speed) => post({ type: MSG.UPLOAD_PROGRESS, speed }),
    );
    post({ type: MSG.UPLOAD_COMPLETE, speed: ul.speed, loadedPing: 0 });

    post({ type: MSG.STATUS, message: STATUS.FINISHED });
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
    loadedLatency.stop();
  }
};
