/**
 * @file App.jsx
 * Root component — composes hooks and components.
 * Contains no business logic; all state lives in useSpeedTest / useNetworkInfo.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Activity, History, Share2, FileText } from 'lucide-react';

import useSpeedTest            from './hooks/useSpeedTest.js';
import useNetworkInfo          from './hooks/useNetworkInfo.js';

import StatCard                from './components/StatCard.jsx';
import ScoreCard               from './components/ScoreCard.jsx';
import NetworkCard             from './components/NetworkCard.jsx';
import HistoryModal            from './components/HistoryModal.jsx';
import ParticleBackground      from './components/ParticleBackground.jsx';
import SpeedometerCard         from './components/SpeedometerCard.jsx';
import ExpertReportModal       from './components/ExpertReportModal.jsx';

import { STATUS } from './constants.js';
import './App.css';

const ICON_DOWNLOAD = <ArrowDown size={13} />;
const ICON_UPLOAD   = <ArrowUp size={13} />;
const ICON_PING     = <Activity size={13} />;
const ICON_LOADED   = <Activity size={13} />;



// Build a shareable text summary of results
const buildShareText = (metrics, score) => {
  const grade = score >= 85 ? 'Excellent' : score >= 65 ? 'Good' : score >= 45 ? 'Fair' : 'Poor';
  return [
    '⚡ Velocity Speed Test Results',
    '──────────────────────────────',
    `↓  Download:  ${metrics.download > 0 ? metrics.download.toFixed(1) : '--'} Mbps`,
    `↑  Upload:    ${metrics.upload > 0 ? metrics.upload.toFixed(1) : '--'} Mbps`,
    `◎  Latency:   ${metrics.ping > 0 ? metrics.ping : '--'} ms`,
    `∿  Jitter:    ${metrics.jitter > 0 ? metrics.jitter.toFixed(1) : '--'} ms`,
    `★  Rating:    ${grade} (${score}/100)`,
    '',
    'velocity.app',
  ].join('\n');
};

export default function App() {
  const {
    status, metrics, displaySpeed, gaugeMax,
    dlData, ulData, history, isRunning, score,
    dlStability, ulStability,
    setProvider, runTest, stopTest, clearHistory,
  } = useSpeedTest();

  const networkInfo = useNetworkInfo();

  useEffect(() => {
    setProvider(networkInfo.provider);
  }, [networkInfo.provider, setProvider]);

  const [showHistory, setShowHistory]         = useState(false);
  const [showExpertReport, setShowExpertReport] = useState(false);
  const [toast, setToast]                     = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isTransitioningBack, setIsTransitioningBack] = useState(false);
  const [hasStarted, setHasStarted]           = useState(false);
  const toastTimerRef = useRef(null);
  const transTimerRef = useRef(null);

  const openHistory  = useCallback(() => setShowHistory(true),  []);
  const closeHistory = useCallback(() => setShowHistory(false), []);

  const showScore  = status === STATUS.FINISHED && score > 0;
  const isFinished = status === STATUS.FINISHED;
  const isIdle     = status === STATUS.IDLE;

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const handleShare = useCallback(async () => {
    const text = buildShareText(metrics, score);
    try {
      await navigator.clipboard.writeText(text);
      showToast('Results copied to clipboard ✓');
    } catch {
      showToast('Copy failed — try manually');
    }
  }, [metrics, score, showToast]);

  // Kick off the cinematic hero→nav transition, then start the test
  const handleStartTest = useCallback(() => {
    setHasStarted(true);
    setIsTransitioning(true);
    runTest();
    if (transTimerRef.current) clearTimeout(transTimerRef.current);
    transTimerRef.current = setTimeout(() => setIsTransitioning(false), 750);
  }, [runTest]);

  // Reset from dashboard/running state back to idle hero
  const handleHeaderBrandClick = useCallback(() => {
    if (!isIdle && !isTransitioning && !isTransitioningBack) {
      setIsTransitioningBack(true);
      stopTest();
      if (transTimerRef.current) clearTimeout(transTimerRef.current);
      transTimerRef.current = setTimeout(() => setIsTransitioningBack(false), 750);
    }
  }, [isIdle, isTransitioning, isTransitioningBack, stopTest]);

  const isNavMode = isTransitioning || (!isIdle && !isTransitioningBack);
  const brandMode = isNavMode ? 'nav-mode' : 'hero-mode';

  const showHero = isIdle || isTransitioning || isTransitioningBack;
  const showDashboard = !isIdle || isTransitioning || isTransitioningBack;

  const latestReport = history[0] ?? null;



  return (
    <>
      {/* Background decoration */}
      <div className="bg-grid-overlay" aria-hidden="true" />
      <ParticleBackground status={status} />



      <div className="app-container">

        {/* Unified animated brand */}
        <div
          className={`unified-brand ${brandMode} ${!hasStarted ? 'is-initial' : ''}`}
          onClick={isNavMode ? handleHeaderBrandClick : undefined}
          aria-hidden="true"
        >
          <h1>Velocity</h1>
        </div>

        {/* ── Header ── */}
        <header className={`header ${!isNavMode ? 'is-idle' : ''}`}>
          {/* Placeholder to keep layout spacing in the header */}
          <div className="header-brand-placeholder">
            <h1>Velocity</h1>
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

        {/* ── Idle Hero ── */}
        {showHero && (
          <div
            className={`idle-hero ${
              isTransitioning ? 'hero-transitioning' :
              isTransitioningBack ? 'hero-transitioning-back' :
              ''
            }`}
            aria-label="Ready to test"
          >
            <button
              id="start-test-btn"
              className="action-button-pill"
              onClick={handleStartTest}
              aria-label="Start speed test"
            >
              Start Test
            </button>
          </div>
        )}

        {/* ── Dashboard (running or finished) ── */}
        {showDashboard && (
          <main
            className={`dashboard ${
              isTransitioning ? 'dashboard-enter' :
              isTransitioningBack ? 'dashboard-exit' :
              ''
            }`}
          >

            {/* Left — Gauge + actions */}
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

              {/* CTA row */}
              {isRunning && (
                <button
                  className="action-button is-stopping"
                  onClick={stopTest}
                  aria-label="Stop test"
                >
                  Stop Test
                </button>
              )}

              {isFinished && (
                <div className="finished-actions">
                  <button
                    className="action-button"
                    onClick={runTest}
                    aria-label="Run test again"
                  >
                    Test Again
                  </button>
                  <div className="finished-actions-secondary">
                    {latestReport && (
                      <button
                        className="action-btn-ghost"
                        onClick={() => setShowExpertReport(true)}
                        aria-label="View expert report"
                        title="Expert Report"
                      >
                        <FileText size={14} />
                        Report
                      </button>
                    )}
                    <button
                      className="action-btn-ghost"
                      onClick={handleShare}
                      aria-label="Share results"
                      title="Copy results to clipboard"
                    >
                      <Share2 size={14} />
                      Share
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Right — Stats, score, network */}
            <section
              className={`stats-column${isFinished ? ' reveal-stagger' : ' fade-in-delayed'}`}
              aria-label="Test results"
            >
              {/* 2×2 metric cards */}
              <div className="stat-cards">
                <StatCard
                  label="Download" icon={ICON_DOWNLOAD}
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

              {/* Score panel — cascading reveal after test finishes */}
              {showScore && (
                <div className="stagger-child">
                  <ScoreCard score={score} metrics={metrics} />
                </div>
              )}

              {/* Network info */}
              <div className={showScore ? 'stagger-child-2' : ''}>
                <NetworkCard
                  info={networkInfo}
                  dlStability={dlStability}
                  ulStability={ulStability}
                />
              </div>
            </section>
          </main>
        )}

        {/* ── History Modal ── */}
        <HistoryModal
          open={showHistory}
          onClose={closeHistory}
          history={history}
          clearHistory={clearHistory}
        />

        {/* ── Expert Report Modal (direct from latest test) ── */}
        <ExpertReportModal
          report={showExpertReport ? latestReport : null}
          onClose={() => setShowExpertReport(false)}
        />

      </div>

      {/* ── Toast Notification ── */}
      {toast && (
        <div className="toast-notification fade-in" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* ── Persistent Last-Result Footer Bar ── */}
      {isIdle && history.length > 0 && (() => {
        const last = history[0];
        const timeAgo = (() => {
          const diff = Date.now() - new Date(last.date).getTime();
          const mins = Math.floor(diff / 60000);
          const hrs  = Math.floor(mins / 60);
          const days = Math.floor(hrs / 24);
          if (days > 0)  return `${days}d ago`;
          if (hrs > 0)   return `${hrs}h ago`;
          if (mins > 0)  return `${mins}m ago`;
          return 'just now';
        })();
        return (
          <div className="last-result-bar lrb-fade-in" role="complementary" aria-label="Last test results">
            <span className="lrb-label">Last<span className="lrb-text-extra"> run</span></span>
            <span className="lrb-sep">·</span>
            <span className="lrb-item lrb-dl">↓ {last.download > 0 ? last.download.toFixed(1) : '--'}<span className="lrb-unit"> Mbps</span></span>
            <span className="lrb-item lrb-ul">↑ {last.upload > 0 ? last.upload.toFixed(1) : '--'}<span className="lrb-unit"> Mbps</span></span>
            <span className="lrb-item lrb-ping">◎ {last.ping || '--'}<span className="lrb-unit"> ms</span></span>
            <span className="lrb-sep">·</span>
            <span className="lrb-time">{timeAgo}</span>
          </div>
        );
      })()}
    </>
  );
}
