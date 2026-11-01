/**
 * @file useSpeedTest.js
 * Encapsulates all speed-test state and worker lifecycle.
 *
 * App.jsx should call this hook and receive only what it needs to render.
 * No business logic should live in App.jsx.
 */

import { useReducer, useCallback, useEffect, useRef } from 'react';
import { startSpeedTest, stopSpeedTest } from '../utils/speedTest.js';
import { STATUS, LIMITS } from '../constants.js';
import { loadHistory, saveHistory, sanitizeRun } from '../utils/history.js';

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

export const OFFLINE_MESSAGE = 'You appear to be offline. Reconnect and try again.';

const initialState = {
  status: STATUS.IDLE,
  metrics: emptyMetrics(),
  displaySpeed: 0,
  dlData: [],
  ulData: [],
  history: [],
  phaseProgress: 0,
  errorMessage: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'START':
      return {
        ...state,
        status: STATUS.PINGING,
        displaySpeed: 0,
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
        displaySpeed: ping,
      };
    }
    case 'DL_PROGRESS': {
      const { speed, time } = action.payload;
      return {
        ...state,
        metrics: { ...state.metrics, download: speed },
        dlData: [...state.dlData, { time, speed }],
        displaySpeed: speed,
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
        displaySpeed: speed,
      };
    }
    case 'UL_PROGRESS': {
      const { speed, time } = action.payload;
      return {
        ...state,
        metrics: { ...state.metrics, upload: speed },
        ulData: [...state.ulData, { time, speed }],
        displaySpeed: speed,
      };
    }
    case 'UL_COMPLETE': {
      const { speed, loadedPing, historyEntry } = action.payload;
      const newHistory = [sanitizeRun(historyEntry), ...state.history].filter(Boolean).slice(0, LIMITS.MAX_HISTORY);
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
        displaySpeed: speed,
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
  const [state, dispatch] = useReducer(reducer, initialState, (s) => ({ ...s, history: loadHistory() }));
  const {
    status, metrics, displaySpeed,
    dlData, ulData, history, phaseProgress, errorMessage,
  } = state;

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const networkInfoRef = useRef('Unknown');
  const setProvider = useCallback((p) => { networkInfoRef.current = p; }, []);

  useEffect(() => () => stopSpeedTest(), []);

  // Offline: abort a running test cleanly and say so; when the connection
  // returns, clear the offline message so Start is ready again.
  useEffect(() => {
    const onOffline = () => {
      const { status: st } = stateRef.current;
      if (st === STATUS.FINISHED) return;
      if (!canStart(st)) stopSpeedTest();
      dispatch({
        type: 'SET_ERROR',
        payload: canStart(st)
          ? OFFLINE_MESSAGE
          : 'Connection lost during the test. Reconnect and try again.',
      });
    };
    const onOnline = () => {
      const { status: st, errorMessage: msg } = stateRef.current;
      if (st === STATUS.ERROR && (msg === OFFLINE_MESSAGE || msg?.startsWith('Connection lost'))) {
        dispatch({ type: 'STOP' });
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const runTest = useCallback(() => {
    if (!canStart(stateRef.current.status)) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      dispatch({ type: 'SET_ERROR', payload: OFFLINE_MESSAGE });
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

  return {
    status,
    metrics,
    displaySpeed,
    dlData,
    ulData,
    history,
    isRunning,
    phaseProgress,
    errorMessage,
    setProvider,
    runTest,
    stopTest,
    clearHistory,
  };
};

export default useSpeedTest;
