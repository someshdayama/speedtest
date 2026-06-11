import { memo } from 'react';

const formatValue = (v) => `${typeof v === 'number' ? v.toFixed(1) : '--'} Mbps`;

const SpeedChart = memo(({ data, type }) => {
  if (!data || data.length < 2) return null;

  const color = type === 'upload' ? 'var(--green)' : 'var(--accent)';
  const gradId = `grad-${type}`;

  const width = 1000; // Use a large internal resolution for smoothness
  const height = 100;
  
  const maxSpeed = Math.max(1, ...data.map(d => d.speed));
  
  const getX = (index) => (index / (data.length - 1)) * width;
  const getY = (val) => height - (val / maxSpeed) * height;

  const points = data.map((d, i) => `${getX(i)},${getY(d.speed)}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <div style={{ width: '100%', height: 72, position: 'relative' }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.15} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        
        <polygon points={areaPoints} fill={`url(#${gradId})`} />
        
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
});

SpeedChart.displayName = 'SpeedChart';

export default SpeedChart;
