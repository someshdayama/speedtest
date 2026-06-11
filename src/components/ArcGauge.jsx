/**
 * @file ArcGauge.jsx
 * SVG semicircular arc gauge.
 * Designed with a premium, minimalist, double-ring HUD aesthetic.
 */

import { memo } from 'react';

import { GAUGE } from '../constants.js';

const { WIDTH, HEIGHT, CX, CY, RADIUS, START_ANGLE, SWEEP, TICKS } = GAUGE;

/**
 * Convert polar angle (degrees, 0° = top/north) to SVG x/y coordinates.
 * @param {number} angleDeg
 * @param {number} r
 * @returns {{ x: number, y: number }}
 */
const toXY = (angleDeg, r) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
};

/**
 * SVG arc path string.
 * @param {number} startDeg
 * @param {number} endDeg
 * @param {number} r
 * @returns {string}
 */
const arcPath = (startDeg, endDeg, r) => {
  const s     = toXY(startDeg, r);
  const e     = toXY(endDeg, r);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(3)} ${s.y.toFixed(3)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(3)} ${e.y.toFixed(3)}`;
};

const TRACK_START = START_ANGLE;
const TRACK_END   = START_ANGLE + SWEEP;

/**
 * @param {{ percent: number, phase: string, max: number }} props
 */
const ArcGauge = memo(({ percent, phase, max = 100 }) => {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const fillEnd = TRACK_START + (SWEEP * clamped) / 100;
  // Ensure the filled arc is always at least a tiny sliver so strokeLinecap
  // renders the starting cap even at 0%.
  const fillEndClamped = Math.max(TRACK_START + 0.5, fillEnd);

  const strokeColor =
    phase === 'uploading' ? 'url(#ul-grad)' :
    phase === 'pinging' ? 'url(#ping-grad)' : 'url(#dl-grad)';

  const activeColor =
    phase === 'uploading' ? 'var(--green)' :
    phase === 'pinging' ? 'var(--amber)' : 'var(--accent)';

  // Calculate tip coordinates for the glowing needle head
  const tipPos = toXY(fillEndClamped, RADIUS);
  
  // Calculate start/end of the radar needle line (clearing the center number display)
  const needleStart = toXY(fillEndClamped, RADIUS * 0.45);
  const needleEnd   = toXY(fillEndClamped, RADIUS - 2);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      aria-hidden="true"
      style={{ overflow: 'visible', display: 'block', width: '100%', height: '100%' }}
    >
      <defs>
        {/* Gradients */}
        <linearGradient id="dl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f2fe" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
        
        <linearGradient id="ul-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f260" />
          <stop offset="100%" stopColor="var(--green)" />
        </linearGradient>
        
        <linearGradient id="ping-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffe259" />
          <stop offset="100%" stopColor="var(--amber)" />
        </linearGradient>

        {/* Glow filter */}
        <filter id="gauge-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* 1. Outer Accent Track (Ultra-faint thin ring) */}
      <path
        d={arcPath(TRACK_START, TRACK_END, RADIUS + 8)}
        fill="none"
        stroke="rgba(255, 255, 255, 0.015)"
        strokeWidth="1"
      />

      {/* 2. Main Track (Background) */}
      <path
        d={arcPath(TRACK_START, TRACK_END, RADIUS)}
        fill="none"
        stroke="rgba(255, 255, 255, 0.03)"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* 3. Inner Concentric Track (Faint guide) */}
      <path
        d={arcPath(TRACK_START, TRACK_END, RADIUS - 8)}
        fill="none"
        stroke="rgba(255, 255, 255, 0.01)"
        strokeWidth="0.75"
      />

      {/* 4. Active Fill (Progress Arc) */}
      <path
        d={arcPath(TRACK_START, fillEndClamped, RADIUS)}
        fill="none"
        stroke={strokeColor}
        strokeWidth="4"
        strokeLinecap="round"
        style={{ opacity: clamped > 0 ? 1 : 0.2, transition: 'opacity 0.2s ease-out' }}
      />

      {/* 5. Glowing Radar Needle Line */}
      {clamped > 0 && (
        <line
          x1={needleStart.x}
          y1={needleStart.y}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={activeColor}
          strokeWidth="1"
          strokeDasharray="2 3"
          style={{ opacity: 0.2, transition: 'opacity 0.2s ease-out' }}
        />
      )}

      {/* 6. Glowing Tip Needle Head & Halo */}
      {clamped > 0 && (
        <g>
          {/* Subtle Outer Glowing Ring */}
          <circle
            cx={tipPos.x}
            cy={tipPos.y}
            r="7"
            fill="none"
            stroke={activeColor}
            strokeWidth="1"
            style={{ opacity: 0.3, transition: 'opacity 0.2s ease-out' }}
          />
          {/* Solid White Core Dot */}
          <circle
            cx={tipPos.x}
            cy={tipPos.y}
            r="3"
            fill="#ffffff"
            stroke={activeColor}
            strokeWidth="2"
            filter="url(#gauge-glow)"
            style={{ transition: 'opacity 0.2s ease-out' }}
          />
        </g>
      )}

      {/* 7. Breathing Inner Circle (Only when Idle) */}
      {phase === 'idle' && (
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS * 0.4}
          fill="none"
          stroke="rgba(255, 255, 255, 0.025)"
          strokeWidth="1"
          className="idle-pulse-ring"
        />
      )}

      {/* 8. Elegant Dynamic Scale Ticks & Numbers */}
      {TICKS.map((t) => {
        const angle = TRACK_START + (SWEEP * t) / 100;
        const outer = toXY(angle, RADIUS + 4);
        const inner = toXY(angle, RADIUS - 2);
        const textPos = toXY(angle, RADIUS - 14);
        const val = Math.round((max * t) / 100);

        const isActive = clamped >= t;
        const tickOpacity = isActive ? 0.6 : 0.12;
        const textOpacity = isActive ? 0.75 : 0.22;
        const tickStroke = isActive ? activeColor : 'rgba(255, 255, 255, 0.4)';

        return (
          <g key={t} style={{ transition: 'opacity 0.25s ease' }}>
            {/* Tick Mark */}
            <line
              x1={inner.x.toFixed(2)} y1={inner.y.toFixed(2)}
              x2={outer.x.toFixed(2)} y2={outer.y.toFixed(2)}
              stroke={tickStroke}
              strokeWidth={isActive ? '1.5' : '1'}
              opacity={tickOpacity}
              strokeLinecap="round"
            />
            {/* Label inside the dial */}
            <text
              x={textPos.x.toFixed(2)}
              y={textPos.y.toFixed(2)}
              fill={isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)'}
              opacity={textOpacity}
              fontSize="7"
              fontWeight={isActive ? '700' : '500'}
              fontFamily="var(--font-heading)"
              textAnchor="middle"
              alignmentBaseline="middle"
              style={{ transition: 'fill 0.2s, opacity 0.2s' }}
            >
              {val}
            </text>
          </g>
        );
      })}
    </svg>
  );
});

ArcGauge.displayName = 'ArcGauge';

export default ArcGauge;
