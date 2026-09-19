/**
 * @file constants.js
 * Single source of truth for all configuration, URLs, and magic values.
 */

// ─── External endpoints ──────────────────────────────────────────────────────

export const ENDPOINTS = Object.freeze({
  PING: 'https://cloudflare.com/cdn-cgi/trace',
  /** Base download URL — append bytes=N for progressive payload sizes */
  DOWNLOAD: 'https://speed.cloudflare.com/__down',
  UPLOAD: 'https://speed.cloudflare.com/__up',
  IP_PRIMARY: 'https://ipinfo.io/json',
  IP_FALLBACK: 'https://api.ipify.org?format=json',
});

// ─── Timing (ms) ─────────────────────────────────────────────────────────────

export const TIMEOUTS = Object.freeze({
  PING_REQUEST: 5_000,
  BUFFERBLOAT_POLL: 500,
  BUFFERBLOAT_REQ: 2_000,
  DOWNLOAD_MAX: 12_000,
  UPLOAD_MAX: 12_000,
  NETWORK_INFO: 3_000,
  PAUSE_BETWEEN: 800,
});

// ─── Test parameters ─────────────────────────────────────────────────────────

export const TEST = Object.freeze({
  CONNECTIONS: 4,
  PROGRESS_INTERVAL: 100,
  PING_SAMPLES: 8,
  PING_WARMUP: 1,
  /** Progressive download payload sizes (bytes) — Cloudflare __down?bytes=N */
  DOWNLOAD_SIZES: Object.freeze([
    1_000_000,   // 1 MB  — warm TCP / early estimate
    5_000_000,   // 5 MB
    25_000_000,  // 25 MB
    50_000_000,  // 50 MB — saturate high-bandwidth links
  ]),
  UPLOAD_INITIAL_CHUNK: 256 * 1024,
  UPLOAD_MIN_CHUNK: 64 * 1024,
  UPLOAD_MAX_CHUNK: 2 * 1024 * 1024,
  /** Discard first N seconds of transfer for TCP window warmup */
  WARMUP_MS: 1_000,
  /** Use last portion of progress samples for final Mbps (stability) */
  FINAL_SAMPLE_RATIO: 0.35,
  FINAL_MIN_SAMPLES: 4,
  /** Early-exit when post-warmup samples are stable */
  EARLY_EXIT_MIN_MS: 4_000,
  EARLY_EXIT_MIN_SAMPLES: 12,
  EARLY_EXIT_CV: 0.08,
});

// ─── Gauge geometry ───────────────────────────────────────────────────────────
//
// Coordinate system used by polarToXY:
//   0°   → top (north)
//   90°  → right (east)
//   180° → bottom (south)
//   270° → left (west)
//
// Arc: symmetric about vertical axis, gap at the bottom.
//   START = 220°, SWEEP = 280°, END = 140°
//
export const GAUGE = Object.freeze({
  WIDTH: 280,
  HEIGHT: 200,
  CX: 140,
  CY: 110,
  RADIUS: 95,
  START_ANGLE: 220,
  SWEEP: 280,
  TICKS: [0, 25, 50, 75, 100],
});

// ─── Application limits ───────────────────────────────────────────────────────

export const LIMITS = Object.freeze({
  MAX_HISTORY: 50,
  GAUGE_SCALE_UP: 0.88,
  GAUGE_SCALE_DOWN: 0.15,
  GAUGE_INITIAL_MAX: 100,
});

// ─── Worker message types ─────────────────────────────────────────────────────

export const MSG = Object.freeze({
  START: 'start',
  ABORT: 'abort',
  STATUS: 'status',
  PING_RESULT: 'pingResult',
  DOWNLOAD_PROGRESS: 'downloadProgress',
  DOWNLOAD_COMPLETE: 'downloadComplete',
  UPLOAD_PROGRESS: 'uploadProgress',
  UPLOAD_COMPLETE: 'uploadComplete',
  PHASE_PROGRESS: 'phaseProgress',
  ERROR: 'error',
});

// ─── Status values ────────────────────────────────────────────────────────────

export const STATUS = Object.freeze({
  IDLE: 'idle',
  PINGING: 'pinging',
  DOWNLOADING: 'downloading',
  UPLOADING: 'uploading',
  FINISHED: 'finished',
  ERROR: 'error',
});

// ─── Local storage keys ───────────────────────────────────────────────────────

export const STORAGE = Object.freeze({
  HISTORY: 'velocity_history_v1',
});

// ─── Score thresholds ─────────────────────────────────────────────────────────

export const SCORE = Object.freeze({
  EXCELLENT: 85,
  GOOD: 65,
  FAIR: 45,
});

export const SCORE_BANDS = Object.freeze({
  DL: { GREAT: 100, OK: 25, LOW: 5 },
  UL: { GREAT: 20, OK: 5, LOW: 1 },
  PING: { GREAT: 20, OK: 50, LOW: 100 },
});

// ─── Human-readable phase labels ──────────────────────────────────────────────

export const PHASE_LABELS = Object.freeze({
  [STATUS.IDLE]: 'Ready',
  [STATUS.PINGING]: 'Measuring latency…',
  [STATUS.DOWNLOADING]: 'Testing download…',
  [STATUS.UPLOADING]: 'Testing upload…',
  [STATUS.FINISHED]: 'Complete',
  [STATUS.ERROR]: 'Test failed',
});
