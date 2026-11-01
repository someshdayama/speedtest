import { describe, it, expect } from 'vitest';
import { verdictFor } from './verdict.js';

describe('verdictFor', () => {
  it('handles a missing result', () => {
    expect(verdictFor({ download: 0 }).level).toBe('red');
  });

  it('calls a fast, low-latency line great', () => {
    expect(verdictFor({ download: 350, upload: 40, ping: 12 }).text).toMatch(/Great/);
  });

  it('says good for 4K and calls on a decent line', () => {
    expect(verdictFor({ download: 60, upload: 10, ping: 30 }).text).toBe('Good for 4K streaming and video calls.');
  });

  it('warns about gaming when ping is middling', () => {
    expect(verdictFor({ download: 60, upload: 10, ping: 70 }).text).toMatch(/games may feel laggy/);
  });

  it('downgrades on very high ping or weak upload', () => {
    expect(verdictFor({ download: 60, upload: 10, ping: 150 }).text).toMatch(/may stutter/);
    expect(verdictFor({ download: 15, upload: 1, ping: 20 }).level).toBe('amber');
  });

  it('flags slow lines', () => {
    expect(verdictFor({ download: 6, upload: 1, ping: 40 }).text).toMatch(/browsing/);
    expect(verdictFor({ download: 2, upload: 0.5, ping: 40 }).level).toBe('red');
  });
});
