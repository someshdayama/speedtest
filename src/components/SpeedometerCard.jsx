/**
 * @file SpeedometerCard.jsx
 * Isolated component to wrap the high-frequency speedometer rendering.
 * Prevents full App.jsx reconciliation at 60fps.
 */

import { memo, useMemo, useEffect } from 'react';
import useSpring from '../hooks/useSpring.js';
import PhaseBar from './PhaseBar.jsx';
import ArcGauge from './ArcGauge.jsx';
import SpeedChart from './SpeedChart.jsx';
import { STATUS } from '../constants.js';

const PHASE_LABELS = {
  [STATUS.IDLE]:        'READY',
  [STATUS.PINGING]:     'Latency',
  [STATUS.DOWNLOADING]: 'Download',
  [STATUS.UPLOADING]:   'Upload',
  [STATUS.FINISHED]:    'Done',
};

const fmtBig = (n) =>
  n <= 0 ? '0.0' : n >= 100 ? n.toFixed(0) : n.toFixed(1);

const resolveDisplayNum = (status, metrics, displaySpeed) => {
  if (status === STATUS.PINGING)  return metrics.ping;
  if (status === STATUS.FINISHED) return metrics.download;
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
}) => {
  const displayNum = resolveDisplayNum(status, metrics, displaySpeed);
  const animatedSpeed = useSpring(displayNum, { stiffness: 120, damping: 28 });

  const gaugePercent = useMemo(
    () => Math.min((animatedSpeed / gaugeMax) * 100, 100),
    [animatedSpeed, gaugeMax],
  );

  const displayString = fmtBig(animatedSpeed);

  const unitLabel   = status === STATUS.PINGING ? 'ms' : 'Mbps';
  const phaseLabel  = PHASE_LABELS[status] ?? '';
  const numColor    = status === STATUS.UPLOADING
    ? ' ul'
    : (status === STATUS.DOWNLOADING || status === STATUS.FINISHED ? ' dl' : '');

  const showChart = dlData.length > 1 || ulData.length > 1;
  const chartData = status === STATUS.UPLOADING ? ulData : dlData;
  const chartType = status === STATUS.UPLOADING ? 'upload' : 'download';

  // Broadcast speed updates directly for the canvas background to bypass React state updates
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('speed-update', { detail: animatedSpeed }));
  }, [animatedSpeed]);

  return (
    <div
      className={`speedometer-card ${status}${isRunning ? ' is-running' : ''}`}
      style={{ '--speed-pct': gaugePercent / 100 }}
    >
      {/* Phase indicator */}
      <PhaseBar status={status} />

      {/* Gauge and readout */}
      <div className="gauge-block">
        <div className="gauge-svg-wrap" aria-hidden="true">
          <ArcGauge percent={gaugePercent} phase={status} max={gaugeMax} />
        </div>

        <div
          className="gauge-readout"
          aria-live="polite"
          aria-label={`${fmtBig(displayNum)} ${unitLabel}`}
        >
          <div
            className={`speed-number${numColor}`}
            aria-hidden="true"
          >
            {displayString}
          </div>

          <div className="speed-meta" aria-hidden="true">
            <span className="speed-unit">{unitLabel}</span>
            <span className="speed-label">{phaseLabel}</span>
          </div>
        </div>
      </div>

      {/* Ping + Jitter row */}
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

      {/* Live chart */}
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
