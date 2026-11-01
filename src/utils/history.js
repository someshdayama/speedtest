/**
 * @file history.js
 * Defensive persistence for past runs. Storage may be missing (private mode,
 * disabled cookies), full, or hold corrupt / hand-edited data — none of that
 * may crash the app.
 */

import { LIMITS, STORAGE } from '../constants.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

const samples = (arr) => (Array.isArray(arr)
  ? arr
    .filter((s) => s && Number.isFinite(s.time) && Number.isFinite(s.speed) && s.speed >= 0)
    .slice(-LIMITS.MAX_SAMPLES)
    .map((s) => ({ time: s.time, speed: s.speed }))
  : []);

/** Normalise one stored run, or return null if it is unusable. */
export const sanitizeRun = (r) => {
  if (!r || typeof r !== 'object' || typeof r.date !== 'string' || Number.isNaN(Date.parse(r.date))) return null;
  if (typeof r.download !== 'number' || typeof r.upload !== 'number' || typeof r.ping !== 'number') return null;
  return {
    date: r.date,
    download: num(r.download),
    upload: num(r.upload),
    ping: num(r.ping),
    jitter: num(r.jitter),
    loadedPing: num(r.loadedPing),
    dlStability: num(r.dlStability),
    ulStability: num(r.ulStability),
    dlData: samples(r.dlData),
    ulData: samples(r.ulData),
    provider: typeof r.provider === 'string' ? r.provider.slice(0, 64) : 'Unknown',
  };
};

const storage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // Access can throw when storage is blocked.
  }
};

/** @returns {object[]} newest first, at most LIMITS.MAX_HISTORY entries */
export const loadHistory = () => {
  try {
    const raw = storage()?.getItem(STORAGE.HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeRun).filter(Boolean).slice(0, LIMITS.MAX_HISTORY);
  } catch {
    return [];
  }
};

/** Persist; trims to the cap and drops the oldest runs if storage is full. */
export const saveHistory = (history) => {
  const store = storage();
  if (!store) return;
  let list = history.slice(0, LIMITS.MAX_HISTORY);
  while (list.length >= 0) {
    try {
      if (list.length) store.setItem(STORAGE.HISTORY, JSON.stringify(list));
      else store.removeItem(STORAGE.HISTORY);
      return;
    } catch {
      if (!list.length) return;
      list = list.slice(0, Math.floor(list.length / 2));
    }
  }
};
