import { describe, it, expect } from 'vitest';
import { calcStability } from './useSpeedTest';

describe('useSpeedTest helper functions', () => {
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
