import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadHistory, saveHistory, sanitizeRun } from './history.js';
import { LIMITS, STORAGE } from '../constants.js';

const run = (i = 0) => ({
  date: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(),
  download: 100, upload: 20, ping: 15, jitter: 2,
  dlData: [{ time: 1, speed: 10 }], ulData: [],
});

describe('history storage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('survives corrupt JSON and non-arrays', () => {
    window.localStorage.setItem(STORAGE.HISTORY, '{oops');
    expect(loadHistory()).toEqual([]);
    window.localStorage.setItem(STORAGE.HISTORY, '{"a":1}');
    expect(loadHistory()).toEqual([]);
  });

  it('drops malformed entries and normalises numbers', () => {
    window.localStorage.setItem(STORAGE.HISTORY, JSON.stringify([
      run(1), null, { date: 'nope', download: 1, upload: 1, ping: 1 },
      { ...run(2), jitter: 'x', loadedPing: -5, dlData: [{ time: 'a' }, { time: 2, speed: 3 }] },
    ]));
    const h = loadHistory();
    expect(h).toHaveLength(2);
    expect(h[1].jitter).toBe(0);
    expect(h[1].loadedPing).toBe(0);
    expect(h[1].dlData).toEqual([{ time: 2, speed: 3 }]);
  });

  it('caps history and per-run samples', () => {
    const many = Array.from({ length: LIMITS.MAX_HISTORY + 20 }, (_, i) => run(i));
    saveHistory(many);
    expect(loadHistory()).toHaveLength(LIMITS.MAX_HISTORY);
    const big = { ...run(), dlData: Array.from({ length: LIMITS.MAX_SAMPLES + 50 }, (_, i) => ({ time: i, speed: 1 })) };
    expect(sanitizeRun(big).dlData).toHaveLength(LIMITS.MAX_SAMPLES);
  });

  it('does not throw when storage is unavailable or full', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded'); });
    expect(() => saveHistory([run(1), run(2)])).not.toThrow();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    expect(loadHistory()).toEqual([]);
  });
});
