/**
 * @file ScoreCard.jsx
 * Connection quality score panel shown after a test completes.
 */

import { memo, useMemo } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { Gamepad2, Tv, Globe } from 'lucide-react';
import { SCORE, SCORE_BANDS } from '../constants.js';



/**
 * Get descriptive text ratings.
 * @param {number} score
 */
const getRating = (score) => {
  if (score >= SCORE.EXCELLENT) return {
    title: 'Excellent',
    desc:  'Perfect for gaming, 4K streaming, and massive file syncs.',
    color: 'var(--green)',
  };
  if (score >= SCORE.GOOD) return {
    title: 'Good',
    desc:  'Great for HD streaming, responsive video calls, and remote work.',
    color: 'var(--green)',
  };
  if (score >= SCORE.FAIR) return {
    title: 'Fair',
    desc:  'Best for web browsing, audio streaming, and standard-def video.',
    color: 'var(--amber)',
  };
  return {
    title: 'Poor',
    desc:  'May struggle with multi-user streaming or online video calls.',
    color: 'var(--red)',
  };
};

/**
 * Calculate specific sub-ratings for the dashboard.
 */
const calcSubRatings = (metrics) => {
  const { download = 0, upload = 0, ping = 0, jitter = 0 } = metrics || {};

  // 1. Gaming (highly sensitive to ping and jitter)
  let gaming = { grade: 'C', status: 'poor', label: 'Laggy' };
  if (ping > 0) {
    if (ping <= 15 && jitter <= 3)      gaming = { grade: 'A+', status: 'excellent', label: 'Ultra Low Ping' };
    else if (ping <= 30 && jitter <= 5) gaming = { grade: 'A',  status: 'good',      label: 'Good Latency' };
    else if (ping <= 55 && jitter <= 9) gaming = { grade: 'B',  status: 'fair',      label: 'Casual Play' };
  }

  // 2. Streaming (highly sensitive to download bandwidth)
  let streaming = { grade: 'C', status: 'poor', label: 'SD Only' };
  if (download >= 80)        streaming = { grade: 'A+', status: 'excellent', label: 'Multi-4K Ready' };
  else if (download >= 25)   streaming = { grade: 'A',  status: 'good',      label: '4K / HD Stream' };
  else if (download >= 10)   streaming = { grade: 'B',  status: 'fair',      label: 'Single HD Stream' };

  // 3. Browsing & Work (sensitive to general stability, download and upload)
  let browsing = { grade: 'C', status: 'poor', label: 'Slow Loading' };
  if (download >= 20 && upload >= 8 && ping <= 35)      browsing = { grade: 'A+', status: 'excellent', label: 'Snappy Loading' };
  else if (download >= 8 && upload >= 3 && ping <= 60)  browsing = { grade: 'A',  status: 'good',      label: 'Responsive' };
  else if (download >= 3 && upload >= 1 && ping <= 100) browsing = { grade: 'B',  status: 'fair',      label: 'Standard Web' };

  return { gaming, streaming, browsing };
};

/**
 * @param {{ score: number, metrics: object }} props
 */
const ScoreCard = memo(({ score, metrics }) => {
  const rating = useMemo(() => getRating(score), [score]);
  const subs   = useMemo(() => calcSubRatings(metrics), [metrics]);

  const r      = 28;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (circ * Math.min(score, 100)) / 100;

  return (
    <article className="score-card" aria-label={`Connection quality: ${rating.title}, score ${score}`}>
      <div className="score-main">
        <div className="score-dial" aria-hidden="true">
          <svg viewBox="0 0 68 68" width="68" height="68">
            <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="4.5" />
            <motion.circle
              cx="34" cy="34" r={r}
              fill="none"
              stroke={rating.color}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ transformOrigin: '34px 34px', rotate: '-90deg' }}
            />
          </svg>
          <div className="score-dial-num">{score}</div>
        </div>

        <div className="score-info">
          <div className="score-title">{rating.title}</div>
          <div className="score-desc">{rating.desc}</div>
        </div>
      </div>

      {/* Breakdown categories */}
      <div className="score-sub-grid">
        <div className="score-sub-item">
          <div className="score-sub-head">
            <span className="score-sub-title">Streaming</span>
            <span className="score-sub-icon"><Tv size={12} /></span>
          </div>
          <div className={`score-sub-grade ${subs.streaming.status}`}>
            {subs.streaming.grade}
          </div>
          <div className="score-sub-label">{subs.streaming.label}</div>
        </div>

        <div className="score-sub-item">
          <div className="score-sub-head">
            <span className="score-sub-title">Gaming</span>
            <span className="score-sub-icon"><Gamepad2 size={12} /></span>
          </div>
          <div className={`score-sub-grade ${subs.gaming.status}`}>
            {subs.gaming.grade}
          </div>
          <div className="score-sub-label">{subs.gaming.label}</div>
        </div>

        <div className="score-sub-item">
          <div className="score-sub-head">
            <span className="score-sub-title">Browsing</span>
            <span className="score-sub-icon"><Globe size={12} /></span>
          </div>
          <div className={`score-sub-grade ${subs.browsing.status}`}>
            {subs.browsing.grade}
          </div>
          <div className="score-sub-label">{subs.browsing.label}</div>
        </div>
      </div>
    </article>
  );
});

ScoreCard.displayName = 'ScoreCard';

export default ScoreCard;
