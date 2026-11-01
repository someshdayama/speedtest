import { describe, it, expect, vi } from 'vitest';
import { backoffMs, sleep } from './retry.js';

describe('retry helpers', () => {
  it('backs off exponentially and caps at 1 s', () => {
    expect(backoffMs(0, 80)).toBe(80);
    expect(backoffMs(2, 80)).toBe(320);
    expect(backoffMs(10, 80)).toBe(1000);
  });

  it('sleep resolves early on abort and clears its timer', async () => {
    vi.useFakeTimers();
    const ac = new AbortController();
    let done = false;
    sleep(10_000, ac.signal).then(() => { done = true; });
    ac.abort();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('sleep resolves after the delay', async () => {
    vi.useFakeTimers();
    let done = false;
    sleep(500).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(500);
    expect(done).toBe(true);
    vi.useRealTimers();
  });
});
