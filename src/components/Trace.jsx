/**
 * @file Trace.jsx
 * Throughput over time for one run: download in white, upload in amber.
 */

import { memo } from 'react';

const W = 320;
const H = 72;

const Trace = memo(({ dlData = [], ulData = [] }) => {
  const all = [...dlData, ...ulData];
  if (all.length < 2) return <p className="nerd-na">No throughput samples recorded.</p>;

  const t0 = Math.min(...all.map((s) => s.time));
  const t1 = Math.max(...all.map((s) => s.time));
  const vMax = Math.max(1, ...all.map((s) => s.speed));
  const x = (t) => (((t - t0) / Math.max(1, t1 - t0)) * W).toFixed(1);
  const y = (v) => (H - 2 - (v / vMax) * (H - 6)).toFixed(1);
  const line = (data) => data.map((s, i) => `${i ? 'L' : 'M'}${x(s.time)} ${y(s.speed)}`).join(' ');

  return (
    <figure className="trace">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img"
        aria-label={`Throughput graph, peak ${vMax.toFixed(1)} Mbps over ${((t1 - t0) / 1000).toFixed(1)} seconds`}>
        <line x1="0" y1={H - 1} x2={W} y2={H - 1} className="trace-axis" />
        {dlData.length > 1 && <path d={line(dlData)} className="trace-dl" />}
        {ulData.length > 1 && <path d={line(ulData)} className="trace-ul" />}
      </svg>
      <figcaption>
        <span>0 s</span>
        <span>peak {vMax.toFixed(1)} Mbps</span>
        <span>{((t1 - t0) / 1000).toFixed(1)} s</span>
      </figcaption>
    </figure>
  );
});
Trace.displayName = 'Trace';

export default Trace;
