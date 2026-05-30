/**
 * @file StatCard.jsx
 * Individual metric card (Download, Upload, Ping, Bufferbloat).
 *
 * Performance: memoized — only re-renders when value/label changes.
 */

import { memo, useMemo } from 'react';

/**
 * Clamp a value into a [0, 100] percentage.
 * @param {number} val
 * @param {number} max
 * @param {boolean} [invert] - invert for metrics where lower is better (ping)
 * @returns {number}
 */
const toPercent = (val, max, invert = false) => {
  if (!val || val <= 0) return 0;
  const pct = Math.min((val / max) * 100, 100);
  return invert ? Math.max(0, 100 - pct) : pct;
};

/**
 * Format a numeric value for display.
 * @param {number | null} v
 * @returns {string}
 */
const display = (v) => {
  if (v === null || v === undefined || v <= 0) return '--';
  return v >= 100 ? v.toFixed(0) : v.toFixed(1);
};

/**
 * @param {{
 *   label: string,
 *   icon: React.ReactNode,
 *   value: number | null,
 *   unit: string,
 *   colorClass: string,
 *   fillClass: string,
 *   max: number,
 *   invertBar?: boolean,
 * }} props
 */
const StatCard = memo(({
  label,
  icon,
  value,
  unit,
  colorClass,
  fillClass,
  max,
  invertBar = false,
}) => {
  const num    = typeof value === 'number' && value > 0 ? value : null;
  const barPct = useMemo(
    () => toPercent(num, max, invertBar),
    [num, max, invertBar],
  );

  return (
    <article className="stat-card" aria-label={`${label}: ${display(num)} ${unit}`}>
      <div className="stat-card-top">
        <div className="stat-card-label">
          <span className="stat-icon" aria-hidden="true">{icon}</span>
          {label}
        </div>
      </div>

      <div className={`stat-card-value${colorClass ? ` ${colorClass}` : ''}`}>
        {display(num)}
        <span className="stat-unit">{unit}</span>
      </div>

      <div className="stat-track" role="progressbar" aria-valuenow={barPct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`stat-track-fill${fillClass ? ` ${fillClass}` : ''}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </article>
  );
});

StatCard.displayName = 'StatCard';

export default StatCard;
