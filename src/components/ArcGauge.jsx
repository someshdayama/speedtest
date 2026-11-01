/**
 * @file ArcGauge.jsx
 * Minimal SVG arc gauge: flat track, solid progress arc, fixed major/minor
 * ticks, a slim indicator and a peak marker. No filters, glows or blurs.
 *
 * Per-frame work is limited to one stroke-dashoffset and two transforms;
 * ticks and labels only re-render when the value crosses a tick.
 */

import { memo } from 'react';

import { GAUGE } from '../constants.js';

const { WIDTH, HEIGHT, CX, CY, RADIUS, START_ANGLE, SWEEP, MINOR_TICKS } = GAUGE;

const TRACK_WIDTH = 6;
const TICK_IN = RADIUS - TRACK_WIDTH / 2 - 4;
const MAJOR_OUT = TICK_IN - 8;
const MINOR_OUT = TICK_IN - 4;
const LABEL_R = RADIUS + 15;
const OUTER = RADIUS + TRACK_WIDTH / 2;

/** Polar (0° = north) → SVG coordinates. */
const toXY = (angleDeg, r) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: +(CX + r * Math.cos(rad)).toFixed(2), y: +(CY + r * Math.sin(rad)).toFixed(2) };
};

const START = toXY(START_ANGLE, RADIUS);
const END = toXY(START_ANGLE + SWEEP, RADIUS);
const ARC = `M ${START.x} ${START.y} A ${RADIUS} ${RADIUS} 0 1 1 ${END.x} ${END.y}`;

/* Indicator and peak marker are drawn pointing straight up, then rotated. */
const NEEDLE = { x: CX, y1: CY - (MAJOR_OUT - 6), y2: CY - (OUTER + 2) };
const PEAK = `M ${CX} ${CY - OUTER - 1.5} l -3.5 -6 h 7 Z`;
const rotateTo = (fraction) => ({ transform: `rotate(${START_ANGLE + SWEEP * fraction}deg)` });

const PHASE_COLOR = { pinging: 'var(--amber)', uploading: 'var(--green)' };

const STEPS_PER_SEGMENT = MINOR_TICKS + 1;

const Ticks = memo(({ segments, passed }) => {
  const total = segments * STEPS_PER_SEGMENT;
  const lines = [];
  for (let i = 0; i <= total; i += 1) {
    const major = i % STEPS_PER_SEGMENT === 0;
    const angle = START_ANGLE + (SWEEP * i) / total;
    const a = toXY(angle, TICK_IN);
    const b = toXY(angle, major ? MAJOR_OUT : MINOR_OUT);
    lines.push(
      <line
        key={i}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        className={`gauge-tick${major ? ' major' : ''}${i < passed ? ' passed' : ''}`}
      />,
    );
  }
  return <g>{lines}</g>;
});
Ticks.displayName = 'Ticks';

const Labels = memo(({ labels, passed, overflow }) => {
  const segments = labels.length - 1;
  return (
    <g>
      {labels.map((value, i) => {
        const p = toXY(START_ANGLE + (SWEEP * i) / segments, LABEL_R);
        const last = i === segments;
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={`gauge-label${i * STEPS_PER_SEGMENT < passed ? ' passed' : ''}${last && overflow ? ' overflow' : ''}`}
          >
            {value}
          </text>
        );
      })}
    </g>
  );
});
Labels.displayName = 'Labels';

/**
 * @param {{
 *   fraction: number,
 *   peakFraction?: number,
 *   labels: number[],
 *   overflow?: boolean,
 *   phase: string,
 * }} props
 */
const ArcGauge = memo(({ fraction, peakFraction = 0, labels, overflow = false, phase }) => {
  const f = Math.min(Math.max(fraction, 0), 1);
  const segments = labels.length - 1;
  const active = f > 0.001;
  // Number of ticks the value has passed (changes rarely → cheap memo hits).
  const passed = active ? Math.floor(f * segments * STEPS_PER_SEGMENT + 1e-6) + 1 : 0;
  const showPeak = peakFraction > f + 0.01;

  return (
    <svg
      className="arc-gauge"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      style={{ '--gauge-color': PHASE_COLOR[phase] ?? 'var(--accent)' }}
      aria-hidden="true"
      focusable="false"
    >
      <path d={ARC} className="gauge-track" strokeWidth={TRACK_WIDTH} />
      <path
        d={ARC}
        className="gauge-fill"
        strokeWidth={TRACK_WIDTH}
        pathLength="1"
        strokeDasharray="1 2"
        strokeDashoffset={1 - f}
        opacity={active ? 1 : 0}
      />

      <Ticks segments={segments} passed={passed} />
      <Labels labels={labels} passed={passed} overflow={overflow} />

      <path d={PEAK} className="gauge-peak gauge-rot" style={rotateTo(Math.min(peakFraction, 1))} opacity={showPeak ? 1 : 0} />
      <line
        x1={NEEDLE.x} y1={NEEDLE.y1} x2={NEEDLE.x} y2={NEEDLE.y2}
        className="gauge-needle gauge-rot"
        style={rotateTo(f)}
        opacity={active ? 1 : 0}
      />
    </svg>
  );
});

ArcGauge.displayName = 'ArcGauge';

export default ArcGauge;
