import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useSpring from './useSpring';

describe('useSpring Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately on mount', () => {
    const { result } = renderHook(() => useSpring(10));
    expect(result.current).toBe(10);
  });

  it('should animate towards target value when it changes and eventually converge', () => {
    const { result, rerender } = renderHook(({ val }) => useSpring(val), {
      initialProps: { val: 0 },
    });

    expect(result.current).toBe(0);

    // Update target
    rerender({ val: 100 });

    // Advance a few frames
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // The value should be moving towards 100
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    // Advance fully to allow convergence
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // It should have converged exactly to the target value
    expect(result.current).toBe(100);
  });
});
