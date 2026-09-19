/**
 * @file speedTest.js
 * Main-thread interface to the speed test Web Worker.
 *
 * Manages a single worker instance — calling startSpeedTest while one is
 * already running will terminate the old one first (safe reset).
 *
 * Security:
 *  - Validates every inbound worker message against MSG allow-list.
 *  - Callbacks are invoked only for known message types.
 */

import { MSG } from '../constants.js';
import SpeedTestWorker from './speedTest.worker.js?worker&inline';

/** @type {Worker | null} */
let activeWorker = null;

/**
 * @typedef {Object} SpeedTestCallbacks
 * @property {(status: string)  => void} onStatus
 * @property {(ping: number, jitter: number) => void} onPing
 * @property {(speed: number)   => void} onDownloadProgress
 * @property {(speed: number, loadedPing: number) => void} onDownloadComplete
 * @property {(speed: number)   => void} onUploadProgress
 * @property {(speed: number, loadedPing: number) => void} onUploadComplete
 * @property {(progress: number) => void} [onPhaseProgress]
 * @property {(err: Error) => void} onError
 */

/**
 * Start a new speed test. Terminates any existing run first.
 * @param {SpeedTestCallbacks} callbacks
 */
export const startSpeedTest = (callbacks) => {
  stopSpeedTest();

  activeWorker = new SpeedTestWorker();

  activeWorker.onmessage = ({ data }) => {
    if (!data || typeof data.type !== 'string') return;

    switch (data.type) {
      case MSG.STATUS:
        callbacks.onStatus(data.message);
        break;
      case MSG.PING_RESULT:
        callbacks.onPing(data.ping, data.jitter);
        break;
      case MSG.DOWNLOAD_PROGRESS:
        callbacks.onDownloadProgress(data.speed);
        break;
      case MSG.DOWNLOAD_COMPLETE:
        callbacks.onDownloadComplete(data.speed, data.loadedPing ?? 0);
        break;
      case MSG.UPLOAD_PROGRESS:
        callbacks.onUploadProgress(data.speed);
        break;
      case MSG.UPLOAD_COMPLETE:
        callbacks.onUploadComplete(data.speed, data.loadedPing ?? 0);
        break;
      case MSG.PHASE_PROGRESS:
        callbacks.onPhaseProgress?.(data.progress ?? 0);
        break;
      case MSG.ERROR: {
        const err = new Error(data.message ?? 'Worker error');
        err.code = data.code;
        callbacks.onError(err);
        break;
      }
      default:
        break;
    }
  };

  activeWorker.onerror = (err) => {
    callbacks.onError(err instanceof Error ? err : new Error('Worker crashed'));
  };

  activeWorker.postMessage({ type: MSG.START });
};

/**
 * Request a graceful abort, then terminate the worker.
 * Safe to call even when no test is in progress.
 */
export const stopSpeedTest = () => {
  if (!activeWorker) return;
  try {
    activeWorker.postMessage({ type: MSG.ABORT });
  } catch {
    // worker may already be dead
  }
  activeWorker.terminate();
  activeWorker = null;
};
