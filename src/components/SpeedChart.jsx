/**
 * @file SpeedChart.jsx
 * Real-time area chart for download / upload speed over time.
 * Memoized — only re-renders when `data` or `type` changes.
 */

import { memo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const TOOLTIP_STYLE = {
  background:   '#111114',
  border:       '1px solid #222228',
  borderRadius: '6px',
  padding:      '4px 10px',
  fontSize:     '0.72rem',
  color:        '#f2f2f4',
};

/** @param {number} v */
const formatValue = (v) => `${typeof v === 'number' ? v.toFixed(1) : '--'} Mbps`;

/**
 * @param {{ data: Array<{time:number,speed:number}>, type: 'download'|'upload' }} props
 */
const SpeedChart = memo(({ data, type }) => {
  if (!data || data.length < 2) return null;

  const color = type === 'upload' ? 'var(--green)' : 'var(--accent)';
  const gradId = `grad-${type}`;

  return (
    <div style={{ width: '100%', height: 72 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>

          <XAxis dataKey="time" hide />
          <YAxis   hide domain={['auto', 'auto']} />

          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            itemStyle={{ color }}
            labelStyle={{ display: 'none' }}
            formatter={formatValue}
          />

          <Area
            type="monotone"
            dataKey="speed"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradId})`}
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

SpeedChart.displayName = 'SpeedChart';

export default SpeedChart;
