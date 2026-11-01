/**
 * @file gaugeScale.js
 * Fixed, piecewise-linear gauge scale.
 *
 * Labels never rescale during a test. Every label sits at an equal angular
 * step, so low speeds get as much room as high ones. Only the last label is
 * allowed to grow: when the peak speed passes the base maximum it becomes the
 * next "nice" number above the peak, and the last segment stretches to cover it.
 */

import { GAUGE } from '../constants.js';

const { STOPS, OVERFLOW_STEPS } = GAUGE;
export const BASE_MAX = STOPS[STOPS.length - 1];

/**
 * Upper label for a given peak speed.
 * @param {number} peak
 * @returns {number}
 */
export const scaleMaxFor = (peak) => {
  if (!Number.isFinite(peak) || peak <= BASE_MAX) return BASE_MAX;
  const step = OVERFLOW_STEPS.find((s) => s >= peak);
  return step ?? Math.ceil(peak / 5000) * 5000;
};

/**
 * Scale labels; only the last one ever changes.
 * @param {number} max
 * @returns {number[]}
 */
export const labelsFor = (max) => [...STOPS.slice(0, -1), Math.max(max, BASE_MAX)];

/**
 * Map a value to its 0–1 position along the arc.
 * @param {number} value
 * @param {number[]} labels
 * @returns {number}
 */
export const fractionFor = (value, labels) => {
  const segments = labels.length - 1;
  if (!(value > 0)) return 0;
  if (value >= labels[segments]) return 1;
  const i = labels.findIndex((stop, idx) => idx > 0 && value <= stop) - 1;
  const lo = labels[i];
  const hi = labels[i + 1];
  return (i + (value - lo) / (hi - lo)) / segments;
};
