/**
 * @file RingGauge.jsx
 * Two concentric arcs on one fixed scale: the inner white ring fills during
 * download, the outer amber ring during upload. Flat strokes only — no
 * filters, glows or blurs. Per frame: two dash offsets and two transforms;
 * ticks and labels are memoised and only change when the value crosses a tick.
 */

import { memo } from 'react';
import { GAUGE } from '../constants.js';

const { WIDTH, HEIGHT, CX, CY, R_DL, R_UL, RING_WIDTH, START_ANGLE, SWEEP, MINOR_TICKS } = GAUGE;

const STEPS = MINOR_TICKS + 1;
const TICK_IN = R_DL - RING_WIDTH / 2 - 5;
const LABEL_R = R_UL + RING_WIDTH / 2 + 13;

const toXY = (deg, r) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: +(CX + r * Math.cos(rad)).toFixed(2), y: +(CY + r * Math.sin(rad)).toFixed(2) };
};

const arc = (r) => {
  const s = toXY(START_ANGLE, r);
  const e = toXY(START_ANGLE + SWEEP, r);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`;
};

const ARC_DL = arc(R_DL);
const ARC_UL = arc(R_UL);
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const rotate = (f) => ({ transform: `rotate(${START_ANGLE + SWEEP * clamp01(f)}deg)` });

const Scale = memo(({ labels, passed, overflow }) => {
  const segments = labels.length - 1;
  const total = segments * STEPS;
  const ticks = [];
  for (let i = 0; i <= total; i += 1) {
    const major = i % STEPS === 0;
    const angle = START_ANGLE + (SWEEP * i) / total;
    const a = toXY(angle, TICK_IN);
    const b = toXY(angle, TICK_IN - (major ? 7 : 3.5));
    ticks.push(
      <line
        key={i}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        className={`ring-tick${major ? ' major' : ''}${i < passed ? ' passed' : ''}`}
      />,
    );
  }
  return (
    <g>
      {ticks}
      {labels.map((value, i) => {
        const p = toXY(START_ANGLE + (SWEEP * i) / segments, LABEL_R);
        const isLast = i === segments;
        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            className={`ring-label${i * STEPS < passed ? ' passed' : ''}${isLast && overflow ? ' overflow' : ''}`}
          >
            {value}
          </text>
        );
      })}
    </g>
  );
});
Scale.displayName = 'Scale';

const Ring = ({ d, r, fraction, className, showTip }) => {
  const f = clamp01(fraction);
  const on = f > 0.002;
  return (
    <g className={className}>
      <path d={d} className="ring-track" strokeWidth={RING_WIDTH} />
      <path
        d={d}
        className="ring-fill"
        strokeWidth={RING_WIDTH}
        pathLength="1"
        strokeDasharray="1 2"
        strokeDashoffset={1 - f}
        opacity={on ? 1 : 0}
      />
      <circle
        cx={CX}
        cy={CY - r}
        r={RING_WIDTH / 2 + 2}
        className="ring-tip"
        style={rotate(f)}
        opacity={on && showTip ? 1 : 0}
      />
    </g>
  );
};

/**
 * @param {{ dl: number, ul: number, labels: number[], overflow: boolean, active: 'dl' | 'ul' | null }} props
 * dl / ul are 0–1 positions along the arc (may overshoot slightly while settling).
 */
const RingGauge = memo(({ dl, ul, labels, overflow, active }) => {
  const lead = Math.max(clamp01(dl), clamp01(ul));
  const segments = labels.length - 1;
  const passed = lead > 0.002 ? Math.floor(lead * segments * STEPS + 1e-6) + 1 : 0;

  return (
    <svg className="ring-gauge" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true" focusable="false">
      <Ring d={ARC_UL} r={R_UL} fraction={ul} className="ring ul" showTip={active === 'ul'} />
      <Ring d={ARC_DL} r={R_DL} fraction={dl} className="ring dl" showTip={active === 'dl'} />
      <Scale labels={labels} passed={passed} overflow={overflow} />
    </svg>
  );
});
RingGauge.displayName = 'RingGauge';

export default RingGauge;
