/**
 * @file App.jsx
 * Root component — composes hooks and components.
 * Contains no business logic; all state lives in useSpeedTest / useNetworkInfo.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence, animate } from 'framer-motion';
import { Zap, ArrowDown, ArrowUp, Activity, History } from 'lucide-react';

import useSpeedTest            from './hooks/useSpeedTest.js';
import useNetworkInfo          from './hooks/useNetworkInfo.js';

import ArcGauge                from './components/ArcGauge.jsx';
import PhaseBar                from './components/PhaseBar.jsx';
import StatCard                from './components/StatCard.jsx';
import ScoreCard               from './components/ScoreCard.jsx';
import NetworkCard             from './components/NetworkCard.jsx';
import SpeedChart              from './components/SpeedChart.jsx';
import HistoryModal            from './components/HistoryModal.jsx';
import ParticleBackground      from './components/ParticleBackground.jsx';

import { STATUS } from './constants.js';
import './App.css';

const ICON_DOWNLOAD = <ArrowDown size={13} />;
const ICON_UPLOAD   = <ArrowUp size={13} />;
const ICON_PING     = <Activity size={13} />;
const ICON_LOADED   = <Activity size={13} />;

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABELS = {
  [STATUS.IDLE]:        'READY',
  [STATUS.PINGING]:     'Latency',
  [STATUS.DOWNLOADING]: 'Download',
  [STATUS.UPLOADING]:   'Upload',
  [STATUS.FINISHED]:    'Done',
};

/**
 * Format a speed number for the large readout.
 * @param {number} n
 * @returns {string}
 */
const fmtBig = (n) =>
  n <= 0 ? '0.0' : n >= 100 ? n.toFixed(0) : n.toFixed(1);

/**
 * Pick the value shown in the big gauge readout.
 * @param {string} status
 * @param {{ ping: number, download: number }} metrics
 * @param {number} displaySpeed
 * @returns {number}
 */
const resolveDisplayNum = (status, metrics, displaySpeed) => {
  if (status === STATUS.PINGING)  return metrics.ping;
  if (status === STATUS.FINISHED) return metrics.download;
  return displaySpeed > 0 ? displaySpeed : 0;
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const {
    status, metrics, displaySpeed, gaugeMax,
    dlData, ulData, history, isRunning, score,
    setProvider, runTest, clearHistory,
  } = useSpeedTest();

  const networkInfo = useNetworkInfo();

  // Sync the provider string into the speed-test hook so history entries
  // get the right label — happens once per detected change.
  useEffect(() => {
    setProvider(networkInfo.provider);
  }, [networkInfo.provider, setProvider]);

  const [showHistory, setShowHistory] = useState(false);
  const openHistory  = useCallback(() => setShowHistory(true),  []);
  const closeHistory = useCallback(() => setShowHistory(false), []);

  // ── Derived values (memoized) ──
  const displayNum = resolveDisplayNum(status, metrics, displaySpeed);
  const [animatedSpeed, setAnimatedSpeed] = useState(0);

  const animatedSpeedRef = useRef(0);
  useEffect(() => {
    animatedSpeedRef.current = animatedSpeed;
  }, [animatedSpeed]);

  // Animate speed with a smooth spring to keep the digits and gauge in perfect sync
  useEffect(() => {
    const controls = animate(animatedSpeedRef.current, displayNum, {
      type: 'spring',
      damping: 28,
      stiffness: 120,
      restDelta: 0.05,
      onUpdate: (latest) => {
        setAnimatedSpeed(latest);
      },
    });
    return () => controls.stop();
  }, [displayNum]);

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

  const showScore = status === STATUS.FINISHED && score > 0;

  const showChart = dlData.length > 1 || ulData.length > 1;
  const chartData = status === STATUS.UPLOADING ? ulData : dlData;
  const chartType = status === STATUS.UPLOADING ? 'upload' : 'download';

  const btnLabel  = status === STATUS.FINISHED
    ? 'Test Again'
    : isRunning ? 'Testing…' : 'Start Test';

  return (
    <div className="app-container">
      {/* Background decoration */}
      <div className="bg-grid-overlay" aria-hidden="true" />
      <ParticleBackground speed={animatedSpeed} status={status} />

      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <Zap size={20} className="header-icon" aria-hidden="true" />
          <div className="header-wordmark">
            <h1>Velocity</h1>
            <p className="header-tagline">True Network Performance Insights</p>
          </div>
        </div>

        <nav className="header-actions" aria-label="App controls">
          <button
            className="history-btn"
            onClick={openHistory}
            aria-label="View test history"
          >
            <History size={13} aria-hidden="true" />
            History
          </button>
        </nav>
      </header>

      {/* ── Dashboard ── */}
      <main className="dashboard">

        {/* Left — Gauge + button */}
        <motion.section
          className="speed-column"
          aria-label="Speed gauge"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div
            className={`speedometer-card ${status}${isRunning ? ' is-running' : ''}`}
            style={{ '--speed-pct': gaugePercent / 100 }}
          >

            {/* Phase indicator */}
            <PhaseBar status={status} />

            {/*
              Gauge block: the SVG arc and the overlaid readout live inside
              the same positioned container so the number sits exactly at
              the arc's circle-centre (top: 54 %, left: 50 %).
            */}
            <div className="gauge-block">
              <div className="gauge-svg-wrap" aria-hidden="true">
                <ArcGauge percent={gaugePercent} phase={status} max={gaugeMax} />
              </div>

              <div
                className="gauge-readout"
                aria-live="polite"
                aria-label={`${fmtBig(displayNum)} ${unitLabel}`}
              >
                <motion.div
                  className={`speed-number${numColor}`}
                  aria-hidden="true"
                >
                  {displayString}
                </motion.div>

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

            {/* Live chart — mounts only when data is available */}
            <AnimatePresence>
              {showChart && (
                <motion.div
                  className="chart-wrap"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="chart-heading" aria-hidden="true">
                    {chartType === 'upload' ? 'Upload' : 'Download'} — live
                  </div>
                  <SpeedChart data={chartData} type={chartType} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* CTA */}
          <motion.button
            className="action-button"
            onClick={runTest}
            disabled={isRunning}
            aria-label={btnLabel}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            {btnLabel}
          </motion.button>
        </motion.section>

        {/* Right — Stats, score, network */}
        <motion.section
          className="stats-column"
          aria-label="Test results"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
        >
          {/* 2×2 metric cards */}
          <div className="stat-cards">
            <StatCard
              label="DOWNLOAD SPEED" icon={ICON_DOWNLOAD}
              value={metrics.download} unit="Mbps"
              colorClass="accent" fillClass=""
              max={500}
            />
            <StatCard
              label="Upload"   icon={ICON_UPLOAD}
              value={metrics.upload}   unit="Mbps"
              colorClass="green"  fillClass="green"
              max={200}
            />
            <StatCard
              label="Ping"     icon={ICON_PING}
              value={metrics.ping}     unit="ms"
              colorClass="amber"  fillClass="amber"
              max={200} invertBar
            />
            <StatCard
              label="Bufferbloat" icon={ICON_LOADED}
              value={metrics.loadedPing || null} unit="ms"
              colorClass="amber"  fillClass="amber"
              max={300} invertBar
            />
          </div>

          {/* Score panel — appears after test finishes */}
          <AnimatePresence>
            {showScore && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22 }}
              >
                <ScoreCard score={score} metrics={metrics} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Network info */}
          <NetworkCard info={networkInfo} />
        </motion.section>
      </main>

      {/* ── History Modal ── */}
      <HistoryModal
        open={showHistory}
        onClose={closeHistory}
        history={history}
        clearHistory={clearHistory}
      />
    </div>
  );
}
