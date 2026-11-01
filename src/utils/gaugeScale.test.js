import { describe, it, expect } from 'vitest';
import { scaleMaxFor, labelsFor, fractionFor } from './gaugeScale.js';

describe('gaugeScale', () => {
  it('keeps 200 as the max up to 200 Mbps', () => {
    expect(scaleMaxFor(0)).toBe(200);
    expect(scaleMaxFor(199.9)).toBe(200);
    expect(scaleMaxFor(200)).toBe(200);
  });

  it('rounds the overflow max up to a nice number', () => {
    expect(scaleMaxFor(201)).toBe(250);
    expect(scaleMaxFor(312)).toBe(400);
    expect(scaleMaxFor(940)).toBe(1000);
    expect(scaleMaxFor(12_345)).toBe(15_000);
  });

  it('only changes the last label', () => {
    const base = labelsFor(200);
    const grown = labelsFor(500);
    expect(grown.slice(0, -1)).toEqual(base.slice(0, -1));
    expect(base.at(-1)).toBe(200);
    expect(grown.at(-1)).toBe(500);
  });

  it('maps values piecewise-linearly between fixed stops', () => {
    const labels = labelsFor(200);
    const step = 1 / (labels.length - 1);
    expect(fractionFor(0, labels)).toBe(0);
    expect(fractionFor(-5, labels)).toBe(0);
    expect(fractionFor(labels[1], labels)).toBeCloseTo(step);
    expect(fractionFor(200, labels)).toBe(1);
    expect(fractionFor(999, labels)).toBe(1);
  });

  it('stretches only the last segment on overflow', () => {
    const labels = labelsFor(500);
    const segments = labels.length - 1;
    expect(fractionFor(100, labels)).toBeCloseTo(fractionFor(100, labelsFor(200)));
    expect(fractionFor(500, labels)).toBe(1);
    const mid = (labels[segments - 1] + 500) / 2;
    expect(fractionFor(mid, labels)).toBeCloseTo((segments - 0.5) / segments);
  });
});
