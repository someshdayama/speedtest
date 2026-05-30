/**
 * @file useSpeedTest.js
 * Encapsulates all speed-test state and worker lifecycle.
 *
 * App.jsx should call this hook and receive only what it needs to render.
 * No business logic should live in App.jsx.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { startSpeedTest, stopSpeedTest } from '../utils/speedTest.js';
import { STATUS, LIMITS, STORAGE, SCORE_BANDS } from '../constants.js';

/**
 * @typedef {Object} Metrics
 * @property {number} ping
 * @property {number} jitter
 * @property {number} download
 * @property {number} upload
 * @property {number} loadedPing
 */

/** @returns {Metrics} */
const emptyMetrics = () => ({ ping: 0, jitter: 0, download: 0, upload: 0, loadedPing: 0 });

/**
 * Calculate a 0–100 quality score from completed metrics.
 * @param {number} dl  download Mbps
 * @param {number} ul  upload Mbps
 * @param {number} ping ms
 * @returns {number}
 */
export const calcScore = (dl, ul, ping) => {
  if (!dl) return 0;
  let s = 0;

  if (dl >= SCORE_BANDS.DL.GREAT) s += 40;
  else if (dl >= SCORE_BANDS.DL.OK) s += 25;
  else if (dl >= SCORE_BANDS.DL.LOW) s += 10;

  if (ul >= SCORE_BANDS.UL.GREAT) s += 30;
  else if (ul >= SCORE_BANDS.UL.OK) s += 18;
  else if (ul >= SCORE_BANDS.UL.LOW) s += 8;

  if (ping <= SCORE_BANDS.PING.GREAT) s += 30;
  else if (ping <= SCORE_BANDS.PING.OK) s += 20;
  else if (ping <= SCORE_BANDS.PING.LOW) s += 10;

  return s;
};

/**
 * Calculate standard deviation stability percentage from progress samples.
 * @param {Array<{speed: number}>} samples
 * @returns {number} stability index percentage (50-100) or 0 if no samples
 */
export const calcStability = (samples) => {
  if (!samples || samples.length < 3) return 0;
  const speeds = samples.map((s) => s.speed).filter((v) => typeof v === 'number' && v > 0);
  if (speeds.length < 3) return 0;

  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  if (mean === 0) return 0;

  const variance = speeds.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / speeds.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  return Math.max(50, Math.min(100, Math.round((1 - cv) * 100)));
};

/**
 * Safely parse history from localStorage.
 * Returns an empty array on any parse / schema error.
 * @returns {Array<object>}
 */
const loadHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Validate: must be an array of objects with required numeric fields.
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r.date     === 'string' &&
        typeof r.download === 'number' &&
        typeof r.upload   === 'number' &&
        typeof r.ping     === 'number',
    );
  } catch {
    return [];
  }
};

/**
 * Persist history to localStorage.
 * @param {Array<object>} history
 */
const saveHistory = (history) => {
  try {
    localStorage.setItem(STORAGE.HISTORY, JSON.stringify(history));
  } catch {
    // Quota exceeded or private-browsing restriction — fail silently.
  }
};

/**
 * @typedef {Object} SpeedTestHook
 * @property {string}   status
 * @property {Metrics}  metrics
 * @property {number}   displaySpeed
 * @property {number}   gaugeMax
 * @property {Array}    dlData
 * @property {Array}    ulData
 * @property {Array}    history
 * @property {boolean}  isRunning
 * @property {number}   score
 * @property {() => void} runTest
 * @property {() => void} clearHistory
 */

/** @returns {SpeedTestHook} */
const useSpeedTest = () => {
  const [status,       setStatus]       = useState(STATUS.IDLE);
  const [metrics,      setMetrics]      = useState(emptyMetrics);
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [gaugeMax,     setGaugeMax]     = useState(LIMITS.GAUGE_INITIAL_MAX);
  const [dlData,       setDlData]       = useState([]);
  const [ulData,       setUlData]       = useState([]);
  const [history,      setHistory]      = useState(loadHistory);

  // Maintain reference to latest metrics state to avoid stale closure during upload callback
  const metricsRef = useRef(metrics);
  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  // Stable ref for networkInfo so upload-complete closure doesn't go stale.
  const networkInfoRef = useRef('Unknown');
  /** @param {string} provider */
  const setProvider = useCallback((p) => { networkInfoRef.current = p; }, []);

  // Update speed and scale gauge max synchronously to avoid setState in effect
  const updateSpeed = useCallback((speed) => {
    setDisplaySpeed(speed);
    setGaugeMax((currentMax) => {
      if (speed > currentMax * LIMITS.GAUGE_SCALE_UP) {
        const requiredMax = speed / LIMITS.GAUGE_SCALE_UP;
        const GAUGE_STEPS = [100, 150, 250, 500, 1000, 2000, 5000];
        const stepMax = GAUGE_STEPS.find((step) => step >= requiredMax);
        if (stepMax) return stepMax;

        // Fallback: double the largest step size if it exceeds 5000 Mbps
        let fallbackMax = GAUGE_STEPS[GAUGE_STEPS.length - 1];
        while (speed > fallbackMax * LIMITS.GAUGE_SCALE_UP) {
          fallbackMax *= 2;
        }
        return fallbackMax;
      }
      return currentMax;
    });
  }, []);

  // Cleanup worker on unmount
  useEffect(() => () => stopSpeedTest(), []);

  const runTest = useCallback(() => {
    if (status !== STATUS.IDLE && status !== STATUS.FINISHED) return;

    const t0 = Date.now();

    setStatus(STATUS.PINGING);
    setDisplaySpeed(0);
    setGaugeMax(LIMITS.GAUGE_INITIAL_MAX);
    setMetrics(emptyMetrics());
    setDlData([]);
    setUlData([]);

    startSpeedTest({
      onStatus: setStatus,

      onPing: (ping, jitter) => {
        setMetrics((p) => ({ ...p, ping, jitter }));
        updateSpeed(ping);
      },

      onDownloadProgress: (speed) => {
        updateSpeed(speed);
        setMetrics((p) => ({ ...p, download: speed }));
        setDlData((p) => [...p, { time: Date.now() - t0, speed }]);
      },

      onDownloadComplete: (speed, loadedPing) => {
        updateSpeed(speed);
        setMetrics((p) => ({ ...p, download: speed, loadedPing: loadedPing || p.loadedPing }));
      },

      onUploadProgress: (speed) => {
        updateSpeed(speed);
        setMetrics((p) => ({ ...p, upload: speed }));
        setUlData((p) => [...p, { time: Date.now() - t0, speed }]);
      },

      onUploadComplete: (speed, loadedPing) => {
        // 1. Update the metrics state with final upload speeds
        setMetrics((prev) => ({
          ...prev,
          upload:     speed,
          loadedPing: loadedPing || prev.loadedPing,
        }));

        // 2. Obtain the latest completed metrics via the ref to avoid stale closures
        const latestMetrics = metricsRef.current;

        // 3. Append to history exactly once (this block runs exactly once as it is outside the state updater callback)
        setHistory((h) => {
          const entry = {
            date:     new Date().toISOString(),
            download: latestMetrics.download,
            upload:   speed,
            ping:     latestMetrics.ping,
            provider: networkInfoRef.current,
          };
          const next = [entry, ...h].slice(0, LIMITS.MAX_HISTORY);
          saveHistory(next);
          return next;
        });

        updateSpeed(speed);
      },

      onError: (err) => {
        if (import.meta.env.DEV) console.error('[SpeedTest]', err);
        setStatus(STATUS.IDLE);
      },
    });
  }, [status, updateSpeed]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
  }, []);

  const isRunning = status !== STATUS.IDLE && status !== STATUS.FINISHED;

  const score = useMemo(
    () => calcScore(metrics.download, metrics.upload, metrics.ping),
    [metrics],
  );

  const dlStability = useMemo(() => calcStability(dlData), [dlData]);
  const ulStability = useMemo(() => calcStability(ulData), [ulData]);

  return {
    status,
    metrics,
    displaySpeed,
    gaugeMax,
    dlData,
    ulData,
    history,
    isRunning,
    score,
    dlStability,
    ulStability,
    setProvider,
    runTest,
    clearHistory,
  };
};

export default useSpeedTest;
