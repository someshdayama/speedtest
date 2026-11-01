/**
 * @file SpeedometerCard.jsx
 * Isolated component to wrap the high-frequency speedometer rendering.
 * Prevents full App.jsx reconciliation at 60fps.
 */

import { memo, useMemo } from 'react';
import useSpring from '../hooks/useSpring.js';
import PhaseBar from './PhaseBar.jsx';
import ArcGauge from './ArcGauge.jsx';
import { STATUS, PHASE_LABELS } from '../constants.js';
import { BASE_MAX, scaleMaxFor, labelsFor, fractionFor } from '../utils/gaugeScale.js';

const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const SPARK_W = 120;
const SPARK_H = 26;

/** Thin live trace of the current phase, drawn under the readout. */
const LiveSpark = memo(({ data }) => {
  if (data.length < 2) return <span className="live-spark" aria-hidden="true" />;
  const max = Math.max(1, ...data.map((d) => d.speed));
  const step = SPARK_W / (data.length - 1);
  const pts = data.map((d, i) => [i * step, SPARK_H - 2 - (d.speed / max) * (SPARK_H - 4)]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg className="live-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} aria-hidden="true" focusable="false">
      <path d={`${line} L${SPARK_W} ${SPARK_H} L0 ${SPARK_H} Z`} className="live-spark-area" />
      <path d={line} className="live-spark-line" />
      <circle cx={lx} cy={ly} r="2" className="live-spark-dot" />
    </svg>
  );
});
LiveSpark.displayName = 'LiveSpark';

const peakOf = (data) => data.reduce((m, d) => (d.speed > m ? d.speed : m), 0);

const SHORT_PHASE = {
  [STATUS.IDLE]: 'READY',
  [STATUS.PINGING]: 'Latency',
  [STATUS.DOWNLOADING]: 'Download',
  [STATUS.UPLOADING]: 'Upload',
  [STATUS.FINISHED]: 'Done',
  [STATUS.ERROR]: 'Error',
};

const fmtBig = (n) =>
  n <= 0 ? '0.0' : n >= 100 ? n.toFixed(0) : n.toFixed(1);

const resolveDisplayNum = (status, metrics, displaySpeed) => {
  if (status === STATUS.PINGING) return metrics.ping;
  if (status === STATUS.FINISHED) return metrics.download;
  if (status === STATUS.ERROR) return metrics.download || metrics.ping || 0;
  return displaySpeed > 0 ? displaySpeed : 0;
};

const SpeedometerCard = memo(({
  status,
  metrics,
  displaySpeed,
  dlData,
  ulData,
  isRunning,
  phaseProgress = 0,
}) => {
  const displayNum = resolveDisplayNum(status, metrics, displaySpeed);
  const animatedSpeed = useSpring(
    displayNum,
    prefersReducedMotion
      ? { stiffness: 1000, damping: 100 }
      : { stiffness: 120, damping: 28 },
  );

  const isUpload = status === STATUS.UPLOADING;
  const phaseData = isUpload ? ulData : dlData;
  const dlPeak = useMemo(() => peakOf(dlData), [dlData]);
  const ulPeak = useMemo(() => peakOf(ulData), [ulData]);

  // Fixed labels; only the last one grows once a throughput peak passes 200.
  const testPeak = Math.max(dlPeak, ulPeak, metrics.download, metrics.upload);
  const scaleMax = scaleMaxFor(testPeak);
  const labels = useMemo(() => labelsFor(scaleMax), [scaleMax]);
  const overflow = scaleMax > BASE_MAX;

  const fraction = fractionFor(animatedSpeed, labels);
  const showPeak = status === STATUS.DOWNLOADING || isUpload || status === STATUS.FINISHED;
  const peakFraction = showPeak ? fractionFor(isUpload ? ulPeak : dlPeak, labels) : 0;

  const displayString = fmtBig(animatedSpeed);

  const unitLabel = status === STATUS.PINGING ? 'ms' : 'Mbps';
  const phaseLabel = SHORT_PHASE[status] ?? '';
  const liveHint = PHASE_LABELS[status] ?? '';
  const numColor = isUpload
    ? ' ul'
    : (status === STATUS.DOWNLOADING || status === STATUS.FINISHED ? ' dl' : status === STATUS.PINGING ? ' ping' : '');

  return (
    <div className={`speedometer-card ${status}${isRunning ? ' is-running' : ''}`}>
      <PhaseBar status={status} progress={phaseProgress} />

      <div className="gauge-block">
        <ArcGauge
          fraction={fraction}
          peakFraction={peakFraction}
          labels={labels}
          overflow={overflow}
          phase={status}
        />

        <div
          className="gauge-readout"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${fmtBig(displayNum)} ${unitLabel}. ${liveHint}`}
        >
          <span className={`speed-label${numColor}`} aria-hidden="true">{phaseLabel}</span>
          <div className={`speed-number${numColor}`} aria-hidden="true">
            {displayString}
          </div>
          <span className="speed-unit" aria-hidden="true">{unitLabel}</span>
          <LiveSpark data={status === STATUS.PINGING ? [] : phaseData} />
        </div>
      </div>

      {/* Secondary metrics: ping + jitter + peak */}
      <div className="quick-stats">
        <div className="qs-item">
          <div className="qs-label">Ping</div>
          <div className="qs-value" aria-live="polite">
            {metrics.ping > 0 ? metrics.ping : '--'}
          </div>
          <div className="qs-unit">ms</div>
        </div>

        <div className="qs-divider" aria-hidden="true" />

        <div className="qs-item">
          <div className="qs-label">Jitter</div>
          <div className="qs-value" aria-live="polite">
            {metrics.jitter > 0 ? metrics.jitter.toFixed(1) : '--'}
          </div>
          <div className="qs-unit">ms</div>
        </div>

        <div className="qs-divider" aria-hidden="true" />

        <div className="qs-item">
          <div className="qs-label">Peak</div>
          <div className="qs-value">
            {testPeak > 0 ? fmtBig(testPeak) : '--'}
          </div>
          <div className="qs-unit">Mbps</div>
        </div>
      </div>
    </div>
  );
});

SpeedometerCard.displayName = 'SpeedometerCard';

export default SpeedometerCard;
