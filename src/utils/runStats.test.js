import { describe, it, expect } from 'vitest';
import { phaseSpanMs, estimateMB, runTiming, peakOf } from './runStats.js';

const s = (pairs) => pairs.map(([time, speed]) => ({ time, speed }));

describe('runStats', () => {
  it('measures the sample span', () => {
    expect(phaseSpanMs(s([[1000, 10], [3500, 20]]))).toBe(2500);
    expect(phaseSpanMs([])).toBe(0);
  });

  it('estimates megabytes from Mbps × time', () => {
    // 80 Mbps for 1 s = 10 MB
    expect(estimateMB(s([[0, 80], [1000, 80]]))).toBeCloseTo(10);
  });

  it('derives start time from the last sample', () => {
    const run = { date: '2026-11-01T10:00:20.000Z', dlData: s([[1000, 5]]), ulData: s([[20000, 5]]) };
    const t = runTiming(run);
    expect(t.durationMs).toBe(20000);
    expect(t.startedAt).toBe('2026-11-01T10:00:00.000Z');
  });

  it('finds the peak', () => {
    expect(peakOf(s([[0, 3], [1, 9], [2, 4]]))).toBe(9);
  });
});
