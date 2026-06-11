import { describe, it, expect } from 'vitest';
import { calcScore, calcStability } from './useSpeedTest';

describe('useSpeedTest helper functions', () => {
  describe('calcScore', () => {
    it('should return 0 when download speed is 0 or missing', () => {
      expect(calcScore(0, 50, 10)).toBe(0);
      expect(calcScore(null, 50, 10)).toBe(0);
    });

    it('should calculate perfect score (100) for great network metrics', () => {
      // Great: download >= 80, upload >= 30, ping <= 15
      expect(calcScore(100, 40, 8)).toBe(100);
    });

    it('should calculate an intermediate score for average network metrics', () => {
      // OK download (e.g. 30 Mbps -> 25 points), OK upload (15 Mbps -> 18 points), OK ping (35 ms -> 20 points)
      expect(calcScore(30, 15, 35)).toBe(63);
    });

    it('should calculate lower score for poor/low network metrics', () => {
      // Low download (5 Mbps -> 10 points), Low upload (2 Mbps -> 8 points), Low ping (80 ms -> 10 points)
      expect(calcScore(5, 2, 80)).toBe(28);
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
      // Standard deviation should be 0, cv = 0, stability = 100%
      expect(calcStability(stableSamples)).toBe(100);
    });

    it('should calculate a lower stability for highly volatile samples', () => {
      const volatileSamples = [
        { speed: 10 },
        { speed: 100 },
        { speed: 10 },
      ];
      // Variance/standard deviation is high, stability should be clamped to minimum 50%
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
      // Only the three 100 speed values should be counted, making it 100% stable
      expect(calcStability(mixedSamples)).toBe(100);
    });
  });
});
