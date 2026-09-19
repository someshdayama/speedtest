/**
 * @file PhaseBar.jsx
 * Three-step phase indicator with optional in-phase progress.
 */

import { memo } from 'react';
import { STATUS } from '../constants.js';

const STEPS = [
  { key: STATUS.PINGING,     label: 'Latency',  activeClass: 'ping' },
  { key: STATUS.DOWNLOADING, label: 'Download', activeClass: '' },
  { key: STATUS.UPLOADING,   label: 'Upload',   activeClass: 'ul' },
];

const ORDER = [STATUS.PINGING, STATUS.DOWNLOADING, STATUS.UPLOADING, STATUS.FINISHED];

/**
 * @param {{ status: string, progress?: number }} props
 */
const PhaseBar = memo(({ status, progress = 0 }) => {
  const statusIdx = ORDER.indexOf(status);
  const pct = Math.max(0, Math.min(100, progress || 0));

  return (
    <div
      className="phase-bar"
      role="status"
      aria-label={
        status === STATUS.IDLE
          ? 'Ready to test'
          : status === STATUS.ERROR
            ? 'Test failed'
            : `Testing phase: ${status}${statusIdx >= 0 && statusIdx < 3 ? `, ${pct}%` : ''}`
      }
    >
      {STEPS.map(({ key, label, activeClass }, i) => {
        const isDone = statusIdx > i || status === STATUS.FINISHED;
        const isActive = status === key;

        return (
          <div key={key} style={{ display: 'contents' }}>
            {i > 0 && <div className="phase-rule" aria-hidden="true" />}
            <div
              className={`phase-step${isActive ? ` active${activeClass ? ` ${activeClass}` : ''}` : ''}${isDone ? ' done' : ''}`}
            >
              <div className="phase-dot" aria-hidden="true" />
              <span className="phase-step-label">
                {label}
                {isActive && pct > 0 && (
                  <span className="phase-pct" aria-hidden="true"> {pct}%</span>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

PhaseBar.displayName = 'PhaseBar';

export default PhaseBar;
