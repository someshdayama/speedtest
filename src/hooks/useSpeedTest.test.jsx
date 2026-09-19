import { describe, it, expect } from 'vitest';
import { calcScore, calcStability } from './useSpeedTest';

describe('useSpeedTest helper functions', () => {
  describe('calcScore', () => {
    it('should return 0 when download speed is 0 or missing', () => {
      expect(calcScore(0, 50, 10)).toBe(0);
      expect(calcScore(null, 50, 10)).toBe(0);
    });

    it('should calculate perfect score (100) for great network metrics', () => {
      // Great: download >= 100, upload >= 20, ping <= 20 (and ping > 0)
      expect(calcScore(100, 40, 8)).toBe(100);
    });

    it('should calculate an intermediate score for average network metrics', () => {
      // OK download (30 -> 25), OK upload (15 -> 18), OK ping (35 -> 20)
      expect(calcScore(30, 15, 35)).toBe(63);
    });

    it('should calculate lower score for poor/low network metrics', () => {
      // Low download (5 -> 10), Low upload (2 -> 8), Low ping (80 -> 10)
      expect(calcScore(5, 2, 80)).toBe(28);
    });

    it('must not award ping points when latency sample is missing (ping=0)', () => {
      // Great DL + UL but no valid ping → 40 + 30 + 0 = 70, not 100
      expect(calcScore(100, 40, 0)).toBe(70);
      expect(calcScore(100, 40, null)).toBe(70);
      expect(calcScore(100, 40, undefined)).toBe(70);
    });
  });

  describe('calcStability', () => {
    it('should return 0 for insufficient samples (less than 3)', () => {
      expect(calcStability([])).toBe(0);
      expect(calcStability([{ speed: 50 }, { speed: 55 }])).toBe(0);
    });

    it('should calculate stability correctly for highly stable samples', () => {
      const stableSamples = [
        { speed: 100 },
        { speed: 100 },
        { speed: 100 },
      ];
      expect(calcStability(stableSamples)).toBe(100);
    });

    it('should calculate a lower stability for highly volatile samples', () => {
      const volatileSamples = [
        { speed: 10 },
        { speed: 100 },
        { speed: 10 },
      ];
      expect(calcStability(volatileSamples)).toBe(50);
    });

    it('should filter out invalid or non-numeric speed values', () => {
      const mixedSamples = [
        { speed: 100 },
        { speed: null },
        { speed: 100 },
        { speed: 'invalid' },
        { speed: 100 },
      ];
      expect(calcStability(mixedSamples)).toBe(100);
    });
  });
});
