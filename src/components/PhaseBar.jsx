/**
 * @file PhaseBar.jsx
 * Three-step phase indicator shown above the gauge.
 */

import { memo } from 'react';
import { STATUS } from '../constants.js';

const STEPS = [
  { key: STATUS.PINGING,     label: 'Latency'  },
  { key: STATUS.DOWNLOADING, label: 'Download' },
  { key: STATUS.UPLOADING,   label: 'Upload'   },
];

const ORDER = [STATUS.PINGING, STATUS.DOWNLOADING, STATUS.UPLOADING, STATUS.FINISHED];

/**
 * @param {{ status: string }} props
 */
const PhaseBar = memo(({ status }) => (
  <div className="phase-bar" role="status" aria-label={`Testing phase: ${status}`}>
    {STEPS.map(({ key, label }, i) => {
      const statusIdx = ORDER.indexOf(status);
      const isDone    = statusIdx > i + 1 || status === STATUS.FINISHED;
      const isActive  = status === key;

      return (
        <div key={key} style={{ display: 'contents' }}>
          {i > 0 && <div className="phase-rule" aria-hidden="true" />}
          <div
            className={`phase-step${isActive ? ' active' : ''}${isDone ? ' done' : ''}`}
          >
            <div className="phase-dot" aria-hidden="true" />
            {label}
          </div>
        </div>
      );
    })}
  </div>
));

PhaseBar.displayName = 'PhaseBar';

export default PhaseBar;
