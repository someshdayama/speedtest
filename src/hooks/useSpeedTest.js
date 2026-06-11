/**
 * @file useSpeedTest.js
 * Encapsulates all speed-test state and worker lifecycle.
 *
 * App.jsx should call this hook and receive only what it needs to render.
 * No business logic should live in App.jsx.
 */

import { useReducer, useCallback, useEffect, useRef, useMemo } from 'react';
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

const initialState = {
  status: STATUS.IDLE,
  metrics: emptyMetrics(),
  displaySpeed: 0,
  gaugeMax: LIMITS.GAUGE_INITIAL_MAX,
  dlData: [],
  ulData: [],
  history: loadHistory(),
};

const updateSpeedState = (state, speed) => {
  let { gaugeMax } = state;
  if (speed > gaugeMax * LIMITS.GAUGE_SCALE_UP) {
    const requiredMax = speed / LIMITS.GAUGE_SCALE_UP;
    const GAUGE_STEPS = [100, 150, 250, 500, 1000, 2000, 5000];
    let stepMax = GAUGE_STEPS.find((step) => step >= requiredMax);
    if (!stepMax) {
      let fallbackMax = GAUGE_STEPS[GAUGE_STEPS.length - 1];
      while (speed > fallbackMax * LIMITS.GAUGE_SCALE_UP) {
        fallbackMax *= 2;
      }
      stepMax = fallbackMax;
    }
    gaugeMax = stepMax;
  }
  return { displaySpeed: speed, gaugeMax };
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        status: STATUS.PINGING,
        displaySpeed: 0,
        gaugeMax: LIMITS.GAUGE_INITIAL_MAX,
        metrics: emptyMetrics(),
        dlData: [],
        ulData: [],
      };
    case 'SET_STATUS':
      return { ...state, status: action.payload };
    case 'PING_RESULT': {
      const { ping, jitter } = action.payload;
      return {
        ...state,
        metrics: { ...state.metrics, ping, jitter },
        ...updateSpeedState(state, ping),
      };
    }
    case 'DL_PROGRESS': {
      const { speed, time } = action.payload;
      return {
        ...state,
        metrics: { ...state.metrics, download: speed },
        dlData: [...state.dlData, { time, speed }],
        ...updateSpeedState(state, speed),
      };
    }
    case 'DL_COMPLETE': {
      const { speed, loadedPing } = action.payload;
      return {
        ...state,
        metrics: { ...state.metrics, download: speed, loadedPing: loadedPing || state.metrics.loadedPing },
        ...updateSpeedState(state, speed),
      };
    }
    case 'UL_PROGRESS': {
      const { speed, time } = action.payload;
      return {
        ...state,
        metrics: { ...state.metrics, upload: speed },
        ulData: [...state.ulData, { time, speed }],
        ...updateSpeedState(state, speed),
      };
    }
    case 'UL_COMPLETE': {
      const { speed, loadedPing, historyEntry } = action.payload;
      const newHistory = [historyEntry, ...state.history].slice(0, 30);
      saveHistory(newHistory);
      return {
        ...state,
        metrics: { ...state.metrics, upload: speed, loadedPing: loadedPing || state.metrics.loadedPing },
        history: newHistory,
        ...updateSpeedState(state, speed),
      };
    }
    case 'CLEAR_HISTORY':
      saveHistory([]);
      return { ...state, history: [] };
    case 'STOP':
      return { ...state, status: STATUS.IDLE };
    default:
      return state;
  }
};

/** @returns {SpeedTestHook} */
const useSpeedTest = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { status, metrics, displaySpeed, gaugeMax, dlData, ulData, history } = state;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const networkInfoRef = useRef('Unknown');
  const setProvider = useCallback((p) => { networkInfoRef.current = p; }, []);

  useEffect(() => () => stopSpeedTest(), []);

  const runTest = useCallback(() => {
    if (stateRef.current.status !== STATUS.IDLE && stateRef.current.status !== STATUS.FINISHED) return;

    const t0 = Date.now();
    dispatch({ type: 'START' });

    startSpeedTest({
      onStatus: (st) => dispatch({ type: 'SET_STATUS', payload: st }),
      onPing: (ping, jitter) => dispatch({ type: 'PING_RESULT', payload: { ping, jitter } }),
      onDownloadProgress: (speed) => dispatch({ type: 'DL_PROGRESS', payload: { speed, time: Date.now() - t0 } }),
      onDownloadComplete: (speed, loadedPing) => dispatch({ type: 'DL_COMPLETE', payload: { speed, loadedPing } }),
      onUploadProgress: (speed) => dispatch({ type: 'UL_PROGRESS', payload: { speed, time: Date.now() - t0 } }),
      onUploadComplete: (speed, loadedPing) => {
        const currentDlData = stateRef.current.dlData || [];
        const currentUlData = stateRef.current.ulData || [];
        const finalUlData = [...currentUlData, { time: Date.now() - t0, speed }];
        const latestMetrics = stateRef.current.metrics;
        
        const historyEntry = {
          date: new Date().toISOString(),
          download: latestMetrics.download,
          upload: speed,
          ping: latestMetrics.ping,
          jitter: latestMetrics.jitter,
          loadedPing: loadedPing || latestMetrics.loadedPing,
          dlStability: calcStability(currentDlData),
          ulStability: calcStability(finalUlData),
          dlData: currentDlData,
          ulData: finalUlData,
          provider: networkInfoRef.current,
        };
        dispatch({ type: 'UL_COMPLETE', payload: { speed, loadedPing, historyEntry } });
      },
      onError: (err) => {
        if (import.meta.env.DEV) console.error('[SpeedTest]', err);
        dispatch({ type: 'SET_STATUS', payload: STATUS.IDLE });
      },
    });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  const stopTest = useCallback(() => {
    stopSpeedTest();
    dispatch({ type: 'STOP' });
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
    stopTest,
    clearHistory,
  };
};

export default useSpeedTest;
