/**
 * @file Meter.jsx
 * The one thing on screen: concentric rings, a huge tabular readout, and
 * ping / jitter tucked into the gap at the bottom of the dial.
 * Isolated so the 60 fps spring updates never re-render the rest of the app.
 */

import { memo, useMemo } from 'react';
import useSpring from '../hooks/useSpring.js';
import RingGauge from './RingGauge.jsx';
import { STATUS } from '../constants.js';
import { BASE_MAX, scaleMaxFor, labelsFor, fractionFor } from '../utils/gaugeScale.js';
import { pingLevel, jitterLevel } from '../utils/levels.js';
import { peakOf } from '../utils/runStats.js';

const reducedMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

/** Slightly under-damped: the arc overshoots a hair and settles. */
const SPRING = reducedMotion ? { stiffness: 1000, damping: 100 } : { stiffness: 170, damping: 19 };

const LABEL = {
  [STATUS.IDLE]: 'Ready',
  [STATUS.PINGING]: 'Ping',
  [STATUS.DOWNLOADING]: 'Download',
  [STATUS.UPLOADING]: 'Upload',
  [STATUS.FINISHED]: 'Download',
  [STATUS.ERROR]: 'Stopped',
};

const fmt = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

const Meter = memo(({ status, metrics, displaySpeed, dlData, ulData }) => {
  const isPing = status === STATUS.PINGING;
  const isDl = status === STATUS.DOWNLOADING;
  const isUl = status === STATUS.UPLOADING;
  const done = status === STATUS.FINISHED;

  const dlTarget = isDl ? displaySpeed : (isUl || done ? metrics.download : 0);
  const ulTarget = isUl ? displaySpeed : (done ? metrics.upload : 0);

  const dl = useSpring(dlTarget, SPRING);
  const ul = useSpring(ulTarget, SPRING);
  const ping = useSpring(isPing || done ? metrics.ping : 0, SPRING);

  const dlPeak = useMemo(() => peakOf(dlData), [dlData]);
  const ulPeak = useMemo(() => peakOf(ulData), [ulData]);
  const scaleMax = scaleMaxFor(Math.max(dlPeak, ulPeak, metrics.download, metrics.upload));
  const labels = useMemo(() => labelsFor(scaleMax), [scaleMax]);

  const toPos = (v) => (v > 0 ? fractionFor(v, labels) : 0);

  const readout = isPing ? ping : isUl ? ul : dl;
  const unit = isPing ? 'ms' : 'Mbps';
  const value = Math.max(0, readout);
  const live = isPing || isDl || isUl;

  return (
    <div className={`meter ${status}`}>
      <RingGauge
        dl={toPos(dl)}
        ul={toPos(ul)}
        labels={labels}
        overflow={scaleMax > BASE_MAX}
        active={isDl ? 'dl' : isUl ? 'ul' : null}
      />

      <div className="readout">
        <span className={`readout-label${isUl ? ' ul' : ''}`}>{LABEL[status]}</span>
        <span className={`readout-value${value > 0 || live ? '' : ' empty'}`}>
          {isPing ? Math.round(value) : fmt(value)}
        </span>
        <span className="readout-unit">{unit}</span>
      </div>

      <dl className="meter-sub">
        <div>
          <dt>Ping</dt>
          <dd className={pingLevel(metrics.ping)}>{metrics.ping > 0 ? metrics.ping : '–'}<small> ms</small></dd>
        </div>
        <div>
          <dt>Jitter</dt>
          <dd className={jitterLevel(metrics.jitter)}>{metrics.jitter > 0 ? metrics.jitter.toFixed(1) : '–'}<small> ms</small></dd>
        </div>
      </dl>
    </div>
  );
});
Meter.displayName = 'Meter';

export default Meter;
