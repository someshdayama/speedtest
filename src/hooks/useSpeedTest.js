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
  // Require a real download sample — incomplete / failed tests score 0.
  if (!dl || dl <= 0) return 0;
  let s = 0;

  if (dl >= SCORE_BANDS.DL.GREAT) s += 40;
  else if (dl >= SCORE_BANDS.DL.OK) s += 25;
  else if (dl >= SCORE_BANDS.DL.LOW) s += 10;

  if (ul >= SCORE_BANDS.UL.GREAT) s += 30;
  else if (ul >= SCORE_BANDS.UL.OK) s += 18;
  else if (ul >= SCORE_BANDS.UL.LOW) s += 8;

  // ping === 0 means "no valid latency sample" (failed/skipped), NOT perfect latency.
  // Only award ping points when we have a positive measured RTT.
  if (typeof ping === 'number' && ping > 0) {
    if (ping <= SCORE_BANDS.PING.GREAT) s += 30;
    else if (ping <= SCORE_BANDS.PING.OK) s += 20;
    else if (ping <= SCORE_BANDS.PING.LOW) s += 10;
  }

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
 * @returns {Array<object>}
 */
const loadHistory = () => {
  try {
    const raw = localStorage.getItem(STORAGE.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r) =>
        r &&
        typeof r.date === 'string' &&
        typeof r.download === 'number' &&
        typeof r.upload === 'number' &&
        typeof r.ping === 'number',
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

const initialState = {
  status: STATUS.IDLE,
  metrics: emptyMetrics(),
  displaySpeed: 0,
  gaugeMax: LIMITS.GAUGE_INITIAL_MAX,
  dlData: [],
  ulData: [],
  history: loadHistory(),
  phaseProgress: 0,
  errorMessage: null,
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
        phaseProgress: 0,
        errorMessage: null,
      };
    case 'SET_STATUS':
      return { ...state, status: action.payload, errorMessage: null };
    case 'SET_PHASE_PROGRESS':
      return { ...state, phaseProgress: action.payload };
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
        metrics: {
          ...state.metrics,
          download: speed,
          loadedPing: loadedPing || state.metrics.loadedPing,
        },
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
      const newHistory = [historyEntry, ...state.history].slice(0, LIMITS.MAX_HISTORY);
      saveHistory(newHistory);
      return {
        ...state,
        metrics: {
          ...state.metrics,
          upload: speed,
          loadedPing: loadedPing || state.metrics.loadedPing,
        },
        history: newHistory,
        phaseProgress: 100,
        ...updateSpeedState(state, speed),
      };
    }
    case 'SET_ERROR':
      return {
        ...state,
        status: STATUS.ERROR,
        errorMessage: action.payload || 'Test failed. Please try again.',
        phaseProgress: 0,
      };
    case 'CLEAR_HISTORY':
      saveHistory([]);
      return { ...state, history: [] };
    case 'STOP':
      return {
        ...state,
        status: STATUS.IDLE,
        phaseProgress: 0,
        errorMessage: null,
      };
    default:
      return state;
  }
};

/** Idle-like statuses that allow starting a new test */
const canStart = (status) =>
  status === STATUS.IDLE || status === STATUS.FINISHED || status === STATUS.ERROR;

const useSpeedTest = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const {
    status, metrics, displaySpeed, gaugeMax,
    dlData, ulData, history, phaseProgress, errorMessage,
  } = state;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const networkInfoRef = useRef('Unknown');
  const setProvider = useCallback((p) => { networkInfoRef.current = p; }, []);

  useEffect(() => () => stopSpeedTest(), []);

  // Reflect browser offline events into error state when idle
  useEffect(() => {
    const onOffline = () => {
      if (canStart(stateRef.current.status) && stateRef.current.status !== STATUS.FINISHED) {
        dispatch({
          type: 'SET_ERROR',
          payload: 'You appear to be offline. Reconnect and try again.',
        });
      }
    };
    window.addEventListener('offline', onOffline);
    return () => window.removeEventListener('offline', onOffline);
  }, []);

  const runTest = useCallback(() => {
    if (!canStart(stateRef.current.status)) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      dispatch({
        type: 'SET_ERROR',
        payload: 'You appear to be offline. Reconnect and try again.',
      });
      return;
    }

    const t0 = Date.now();
    dispatch({ type: 'START' });

    startSpeedTest({
      onStatus: (st) => dispatch({ type: 'SET_STATUS', payload: st }),
      onPhaseProgress: (pct) => dispatch({ type: 'SET_PHASE_PROGRESS', payload: pct }),
      onPing: (ping, jitter) => dispatch({ type: 'PING_RESULT', payload: { ping, jitter } }),
      onDownloadProgress: (speed) =>
        dispatch({ type: 'DL_PROGRESS', payload: { speed, time: Date.now() - t0 } }),
      onDownloadComplete: (speed, loadedPing) =>
        dispatch({ type: 'DL_COMPLETE', payload: { speed, loadedPing } }),
      onUploadProgress: (speed) =>
        dispatch({ type: 'UL_PROGRESS', payload: { speed, time: Date.now() - t0 } }),
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
        stopSpeedTest();
        dispatch({
          type: 'SET_ERROR',
          payload: err?.message || 'Test failed unexpectedly. Please try again.',
        });
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

  const isRunning =
    status !== STATUS.IDLE &&
    status !== STATUS.FINISHED &&
    status !== STATUS.ERROR;

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
    phaseProgress,
    errorMessage,
    setProvider,
    runTest,
    stopTest,
    clearHistory,
  };
};

export default useSpeedTest;
