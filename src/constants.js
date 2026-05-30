/**
 * @file constants.js
 * Single source of truth for all configuration, URLs, and magic values.
 */

// ─── External endpoints ──────────────────────────────────────────────────────

export const ENDPOINTS = Object.freeze({
  PING:        'https://cloudflare.com/cdn-cgi/trace',
  DOWNLOAD:    'https://speed.cloudflare.com/__down?bytes=50000000',
  UPLOAD:      'https://speed.cloudflare.com/__up',
  IP_PRIMARY:  'https://ipinfo.io/json',
  IP_FALLBACK: 'https://api.ipify.org?format=json',
});

// ─── Timing (ms) ─────────────────────────────────────────────────────────────

export const TIMEOUTS = Object.freeze({
  PING_REQUEST:      5_000,
  BUFFERBLOAT_POLL:    500,
  BUFFERBLOAT_REQ:   2_000,
  DOWNLOAD_MAX:     15_000,
  UPLOAD_MAX:       15_000,
  NETWORK_INFO:      3_000,
  PAUSE_BETWEEN:     1_000,
});

// ─── Test parameters ─────────────────────────────────────────────────────────

export const TEST = Object.freeze({
  CONNECTIONS:       4,
  UPLOAD_BYTES:      10 * 1024 * 1024,
  PROGRESS_INTERVAL: 100,
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
//   Both endpoints land at the same y  (verified: y = CY + R·sin(130°))
//
//   Top of arc : y = CY − R = 110 − 95 = 15    ✓ within HEIGHT
//   Endpoints  : y = CY + R·sin(130°) ≈ 183     ✓ within HEIGHT (200)
//   Left end   : x = CX + R·cos(130°) ≈  79     ✓ within WIDTH
//   Right end  : x = CX + R·cos(50°)  ≈ 201     ✓ within WIDTH
//
// Number overlay sits at the arc's circle-center (CX, CY):
//   top: CY / HEIGHT = 110/200 = 55 %
//
export const GAUGE = Object.freeze({
  WIDTH:       280,
  HEIGHT:      200,
  CX:          140,
  CY:          110,
  RADIUS:      95,
  START_ANGLE: 220,
  SWEEP:       280,
  TICKS:       [0, 25, 50, 75, 100],
});

// ─── Application limits ───────────────────────────────────────────────────────

export const LIMITS = Object.freeze({
  MAX_HISTORY:       50,
  GAUGE_SCALE_UP:    0.88,
  GAUGE_SCALE_DOWN:  0.15,
  GAUGE_INITIAL_MAX: 100,
});

// ─── Worker message types ─────────────────────────────────────────────────────

export const MSG = Object.freeze({
  START:             'start',
  STATUS:            'status',
  PING_RESULT:       'pingResult',
  DOWNLOAD_PROGRESS: 'downloadProgress',
  DOWNLOAD_COMPLETE: 'downloadComplete',
  UPLOAD_PROGRESS:   'uploadProgress',
  UPLOAD_COMPLETE:   'uploadComplete',
  ERROR:             'error',
});

// ─── Status values ────────────────────────────────────────────────────────────

export const STATUS = Object.freeze({
  IDLE:        'idle',
  PINGING:     'pinging',
  DOWNLOADING: 'downloading',
  UPLOADING:   'uploading',
  FINISHED:    'finished',
});

// ─── Local storage keys ───────────────────────────────────────────────────────

export const STORAGE = Object.freeze({
  HISTORY: 'velocity_history_v1',
});

// ─── Score thresholds ─────────────────────────────────────────────────────────

export const SCORE = Object.freeze({
  EXCELLENT: 85,
  GOOD:      65,
  FAIR:      45,
});

export const SCORE_BANDS = Object.freeze({
  DL:   { GREAT: 100, OK: 25,  LOW: 5   },
  UL:   { GREAT: 20,  OK: 5,   LOW: 1   },
  PING: { GREAT: 20,  OK: 50,  LOW: 100 },
});
