/**
 * @file levels.js
 * Warning levels for lower-is-better metrics: '' (fine), 'amber' (warning), 'red' (bad).
 */

import { SCORE_BANDS } from '../constants.js';

const level = (v, warn, bad) => (v >= bad ? 'red' : v >= warn ? 'amber' : '');

export const pingLevel = (ms) => level(ms, SCORE_BANDS.PING.OK, SCORE_BANDS.PING.LOW);
export const jitterLevel = (ms) => level(ms, 15, 30);
