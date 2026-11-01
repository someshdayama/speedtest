/**
 * @file pwa.js
 * Service-worker registration that never interrupts a running test.
 * A new version is applied silently while the app is idle; otherwise the UI
 * offers a quiet "Update" action once the test is over.
 */

import { registerSW } from 'virtual:pwa-register';

let updateSW = null;
let ready = false;
const listeners = new Set();

export const startPWA = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      listeners.forEach((fn) => fn(true));
    },
  });
};

/** Subscribe to "update ready"; returns an unsubscribe function. */
export const onUpdateReady = (fn) => {
  listeners.add(fn);
  if (ready) fn(true);
  return () => listeners.delete(fn);
};

/** Activate the waiting service worker and reload. */
export const applyUpdate = () => updateSW?.(true);
