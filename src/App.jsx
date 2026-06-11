/**
 * @file App.jsx
 * Root component — composes hooks and components.
 * Contains no business logic; all state lives in useSpeedTest / useNetworkInfo.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Zap, ArrowDown, ArrowUp, Activity, History } from 'lucide-react';

import useSpeedTest            from './hooks/useSpeedTest.js';
import useNetworkInfo          from './hooks/useNetworkInfo.js';

import StatCard                from './components/StatCard.jsx';
import ScoreCard               from './components/ScoreCard.jsx';
import NetworkCard             from './components/NetworkCard.jsx';
import HistoryModal            from './components/HistoryModal.jsx';
import ParticleBackground      from './components/ParticleBackground.jsx';
import SpeedometerCard         from './components/SpeedometerCard.jsx';

import { STATUS } from './constants.js';
import './App.css';

const ICON_DOWNLOAD = <ArrowDown size={13} />;
const ICON_UPLOAD   = <ArrowUp size={13} />;
const ICON_PING     = <Activity size={13} />;
const ICON_LOADED   = <Activity size={13} />;

// ─── Constants ────────────────────────────────────────────────────────────────

export default function App() {
  const {
    status, metrics, displaySpeed, gaugeMax,
    dlData, ulData, history, isRunning, score,
    dlStability, ulStability,
    setProvider, runTest, stopTest, clearHistory,
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

  const showScore = status === STATUS.FINISHED && score > 0;

  const btnLabel  = status === STATUS.FINISHED
    ? 'Test Again'
    : isRunning ? 'Stop Test' : 'Start Test';

  return (
    <>
      {/* Background decoration */}
      <div className="bg-grid-overlay" aria-hidden="true" />
      <ParticleBackground status={status} />

      <div className="app-container">

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
        <section
          className="speed-column fade-in"
          aria-label="Speed gauge"
        >
          <SpeedometerCard
            status={status}
            metrics={metrics}
            displaySpeed={displaySpeed}
            gaugeMax={gaugeMax}
            dlData={dlData}
            ulData={ulData}
            isRunning={isRunning}
          />

          {/* CTA */}
          <button
            className={`action-button ${isRunning ? 'is-stopping' : 'is-starting'}`}
            onClick={isRunning ? stopTest : runTest}
            aria-label={btnLabel}
          >
            {btnLabel}
          </button>
        </section>

        {/* Right — Stats, score, network */}
        <section
          className="stats-column fade-in-delayed"
          aria-label="Test results"
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
          {showScore && (
            <div className="fade-in">
              <ScoreCard score={score} metrics={metrics} />
            </div>
          )}

          {/* Network info */}
          <NetworkCard
            info={networkInfo}
            dlStability={dlStability}
            ulStability={ulStability}
          />
        </section>
      </main>

      {/* ── History Modal ── */}
      <HistoryModal
        open={showHistory}
        onClose={closeHistory}
        history={history}
        clearHistory={clearHistory}
      />
      </div>
    </>
  );
}
