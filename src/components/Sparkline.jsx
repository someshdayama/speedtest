import React from 'react';

const Sparkline = ({ data, colorMap = { download: 'var(--accent)', upload: 'var(--green)' } }) => {
  if (!data || data.length < 2) return null;

  const width = 300;
  const height = 60;
  const padding = 5;

  // Calculate scales
  const maxVal = Math.max(1, ...data.flatMap(d => [d.download, d.upload].filter(v => v !== undefined)));
  
  const getX = (index) => padding + (index / (data.length - 1)) * (width - padding * 2);
  const getY = (val) => height - padding - (val / maxVal) * (height - padding * 2);

  const getPath = (key) => {
    return data.map((d, i) => {
      if (d[key] === undefined) return '';
      const x = getX(i);
      const y = getY(d[key]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
      {Object.keys(colorMap).map(key => {
        const hasData = data.some(d => d[key] !== undefined);
        if (!hasData) return null;
        
        return (
          <g key={key}>
            <path
              d={getPath(key)}
              fill="none"
              stroke={colorMap[key]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {data.map((d, i) => (
              d[key] !== undefined ? (
                <circle
                  key={`${key}-${i}`}
                  cx={getX(i)}
                  cy={getY(d[key])}
                  r="2"
                  fill={colorMap[key]}
                />
              ) : null
            ))}
          </g>
        );
      })}
    </svg>
  );
};

export default Sparkline;
