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
  /** ISP name for Nerd stats */
  ISP: 'https://ipinfo.io/json',
});

// ─── Timing (ms) ─────────────────────────────────────────────────────────────

export const TIMEOUTS = Object.freeze({
  PING_REQUEST: 5_000,
  BUFFERBLOAT_POLL: 500,
  BUFFERBLOAT_REQ: 2_000,
  DOWNLOAD_MAX: 12_000,
  UPLOAD_MAX: 12_000,
  /** Hard cap for a single XHR transfer (loops are aborted at *_MAX anyway). */
  TRANSFER_MAX: 15_000,
  NETWORK_INFO: 3_000,
  PAUSE_BETWEEN: 800,
});

// ─── Test parameters ─────────────────────────────────────────────────────────

export const TEST = Object.freeze({
  /** Parallel transfers — below every engine's 6-per-host connection limit. */
  CONNECTIONS: 4,
  /** Byte counters are sampled on this timer, never per network chunk. */
  PROGRESS_INTERVAL: 100,
  PING_SAMPLES: 10,
  /** Requests that open the connection (DNS/TCP/TLS) and are discarded. */
  PING_WARMUP: 2,
  /** Each parallel loop steps up one size per completed request and down one after a failure (bytes). */
  DOWNLOAD_SIZES: Object.freeze([1_000_000, 5_000_000, 10_000_000]),
  UPLOAD_SIZES: Object.freeze([256 * 1024, 1024 * 1024, 2 * 1024 * 1024, 4 * 1024 * 1024]),
  /** No live reading until the transfer has run this long. */
  MIN_WINDOW_MS: 600,
  /** Stop early once this long into the transfer and the reading is steady. */
  EARLY_EXIT_MIN_MS: 6_000,
  EARLY_EXIT_MIN_SAMPLES: 20,
  /** Max (max-min)/max spread of the last EARLY_EXIT_MIN_SAMPLES readings. */
  EARLY_EXIT_SPREAD: 0.05,
});

// ─── Gauge geometry & scale ───────────────────────────────────────────────────
//
// Coordinate system used by toXY:
//   0°   → top (north), 90° → right, 180° → bottom, 270° → left
//
// Arc: symmetric about the vertical axis, gap at the bottom.
//   START = 220°, SWEEP = 280°, END = 140°
//
export const GAUGE = Object.freeze({
  WIDTH: 300,
  HEIGHT: 290,
  CX: 150,
  CY: 148,
  /** Inner ring = download (white), outer ring = upload (amber). */
  R_DL: 102,
  R_UL: 117,
  RING_WIDTH: 7,
  START_ANGLE: 220,
  SWEEP: 280,
  /** Fixed scale labels (Mbps), equally spaced. Only the last one can grow. */
  STOPS: Object.freeze([0, 5, 10, 25, 50, 100, 150, 200]),
  /** Candidates for the last label once the peak passes 200 Mbps. */
  OVERFLOW_STEPS: Object.freeze([250, 300, 400, 500, 750, 1000, 1500, 2000, 2500, 5000, 10000]),
  MINOR_TICKS: 4,
});

// ─── Application limits ───────────────────────────────────────────────────────

export const LIMITS = Object.freeze({
  MAX_HISTORY: 50,
  /** Max throughput samples kept per phase for each stored run. */
  MAX_SAMPLES: 300,
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

export const SCORE_BANDS = Object.freeze({
  PING: { OK: 50, LOW: 100 },
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
