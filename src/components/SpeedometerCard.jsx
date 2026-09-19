/**
 * @file SpeedometerCard.jsx
 * Isolated component to wrap the high-frequency speedometer rendering.
 * Prevents full App.jsx reconciliation at 60fps.
 */

import { memo, useMemo, useEffect, useRef } from 'react';
import useSpring from '../hooks/useSpring.js';
import PhaseBar from './PhaseBar.jsx';
import ArcGauge from './ArcGauge.jsx';
import SpeedChart from './SpeedChart.jsx';
import { STATUS, PHASE_LABELS } from '../constants.js';

const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

const DIGITS = '0123456789';

const OdometerDigit = memo(({ char }) => {
  const isDigit = DIGITS.includes(char);
  const prevRef = useRef(char);
  useEffect(() => { prevRef.current = char; });

  if (!isDigit) {
    return <span className="odo-separator">{char}</span>;
  }

  return (
    <span className="odo-digit-wrap" aria-hidden="true">
      <span className="odo-digit-reel" style={{ '--d': char }} key={char}>
        {[...DIGITS].map((d) => (
          <span key={d} className="odo-digit-cell">{d}</span>
        ))}
      </span>
    </span>
  );
});
OdometerDigit.displayName = 'OdometerDigit';

const OdometerNumber = memo(({ value }) => (
  <span className="odo-number">
    {[...String(value)].map((char, i) => (
      <OdometerDigit key={i} char={char} />
    ))}
  </span>
));
OdometerNumber.displayName = 'OdometerNumber';

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
  gaugeMax,
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

  const gaugePercent = useMemo(
    () => Math.min((animatedSpeed / gaugeMax) * 100, 100),
    [animatedSpeed, gaugeMax],
  );

  const displayString = fmtBig(animatedSpeed);

  const unitLabel = status === STATUS.PINGING ? 'ms' : 'Mbps';
  const phaseLabel = SHORT_PHASE[status] ?? '';
  const liveHint = PHASE_LABELS[status] ?? '';
  const numColor = status === STATUS.UPLOADING
    ? ' ul'
    : (status === STATUS.DOWNLOADING || status === STATUS.FINISHED ? ' dl' : '');

  const showChart = dlData.length > 1 || ulData.length > 1;
  const chartData = status === STATUS.UPLOADING ? ulData : dlData;
  const chartType = status === STATUS.UPLOADING ? 'upload' : 'download';

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('speed-update', { detail: animatedSpeed }));
  }, [animatedSpeed]);

  return (
    <div
      className={`speedometer-card ${status}${isRunning ? ' is-running' : ''}`}
      style={{ '--speed-pct': gaugePercent / 100 }}
    >
      <PhaseBar status={status} progress={phaseProgress} />

      <div className="gauge-block">
        <div className="gauge-svg-wrap" aria-hidden="true">
          <ArcGauge percent={gaugePercent} phase={status} max={gaugeMax} />
        </div>

        <div
          className="gauge-readout"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${fmtBig(displayNum)} ${unitLabel}. ${liveHint}`}
        >
          <div className={`speed-number${numColor}`} aria-hidden="true">
            <OdometerNumber value={displayString} />
          </div>

          <div className="speed-meta" aria-hidden="true">
            <span className="speed-unit">{unitLabel}</span>
            <span className="speed-label">{phaseLabel}</span>
          </div>
        </div>
      </div>

      {/* Secondary metrics: ping + jitter */}
      <div className="quick-stats">
        <div className="qs-item">
          <div className="qs-label">Ping</div>
          <div
            className={`qs-value${metrics.ping > 0 ? ' amber' : ''}`}
            aria-live="polite"
          >
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
      </div>

      {showChart && (
        <div className="chart-wrap fade-in">
          <div className="chart-heading" aria-hidden="true">
            {chartType === 'upload' ? 'Upload' : 'Download'} — live
          </div>
          <SpeedChart data={chartData} type={chartType} />
        </div>
      )}
    </div>
  );
});

SpeedometerCard.displayName = 'SpeedometerCard';

export default SpeedometerCard;
