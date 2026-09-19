/**
 * @file App.jsx
 * Root component — composes hooks and components.
 * Contains no business logic; all state lives in useSpeedTest / useNetworkInfo.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowDown, ArrowUp, Activity, History, Share2, FileText, Waves, AlertTriangle } from 'lucide-react';

import useSpeedTest from './hooks/useSpeedTest.js';
import useNetworkInfo from './hooks/useNetworkInfo.js';

import StatCard from './components/StatCard.jsx';
import ScoreCard from './components/ScoreCard.jsx';
import NetworkCard from './components/NetworkCard.jsx';
import HistoryModal from './components/HistoryModal.jsx';
import ParticleBackground from './components/ParticleBackground.jsx';
import SpeedometerCard from './components/SpeedometerCard.jsx';
import ExpertReportModal from './components/ExpertReportModal.jsx';

import { STATUS, PHASE_LABELS } from './constants.js';
import './App.css';

const ICON_DOWNLOAD = <ArrowDown size={13} />;
const ICON_UPLOAD = <ArrowUp size={13} />;
const ICON_PING = <Activity size={13} />;
const ICON_JITTER = <Waves size={13} />;

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
    'https://velocity-speedtest.netlify.app',
  ].join('\n');
};

export default function App() {
  const {
    status, metrics, displaySpeed, gaugeMax,
    dlData, ulData, history, isRunning, score,
    dlStability, ulStability, phaseProgress, errorMessage,
    setProvider, runTest, stopTest, clearHistory,
  } = useSpeedTest();

  const networkInfo = useNetworkInfo();

  useEffect(() => {
    setProvider(networkInfo.provider);
  }, [networkInfo.provider, setProvider]);

  const [showHistory, setShowHistory] = useState(false);
  const [showExpertReport, setShowExpertReport] = useState(false);
  const [toast, setToast] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const toastTimerRef = useRef(null);

  const openHistory = useCallback(() => setShowHistory(true), []);
  const closeHistory = useCallback(() => setShowHistory(false), []);

  const showScore = status === STATUS.FINISHED && score > 0;
  const isFinished = status === STATUS.FINISHED;
  const isIdle = status === STATUS.IDLE;
  const isError = status === STATUS.ERROR;

  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2800);
  }, []);

  const handleShare = useCallback(async () => {
    const text = buildShareText(metrics, score);
    const shareUrl = 'https://velocity-speedtest.netlify.app';
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({
          title: 'Velocity Speed Test Results',
          text,
          url: shareUrl,
        });
        showToast('Results shared ✓');
        return;
      }
    } catch (err) {
      // User cancelled share sheet — don't fall through as failure
      if (err?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Results copied to clipboard ✓');
    } catch {
      showToast('Copy failed — try manually');
    }
  }, [metrics, score, showToast]);

  const handleStartTest = useCallback(() => {
    setHasStarted(true);
    runTest();
  }, [runTest]);

  const brandMode = 'nav-mode';
  const latestReport = history[0] ?? null;
  const statusAnnouncement = PHASE_LABELS[status] ?? '';

  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <div className="bg-grid-overlay" aria-hidden="true" />
      <ParticleBackground status={status} />

      <div className="app-container">
        <div
          className={`unified-brand ${brandMode} ${!hasStarted ? 'is-initial' : ''}`}
        >
          <h1>Velocity</h1>
        </div>

        <header className="header">
          <div className="header-brand-placeholder" aria-hidden="true">
            <span className="header-brand-spacer">Velocity</span>
          </div>

          <nav className="header-actions" aria-label="App controls">
            <button
              className="history-btn"
              onClick={openHistory}
              aria-label="View test history"
              type="button"
            >
              <History size={13} aria-hidden="true" />
              History
              {history.length > 0 && (
                <span className="history-count" aria-hidden="true">{Math.min(history.length, 99)}</span>
              )}
            </button>
          </nav>
        </header>

        {/* Screen-reader live phase announcements */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {statusAnnouncement}
        </div>

        <main id="main-content" className="dashboard" tabIndex={-1}>
          <section className="speed-column fade-in" aria-label="Speed gauge">
            <SpeedometerCard
              status={status}
              metrics={metrics}
              displaySpeed={displaySpeed}
              gaugeMax={gaugeMax}
              dlData={dlData}
              ulData={ulData}
              isRunning={isRunning}
              phaseProgress={phaseProgress}
            />

            {isError && (
              <div className="error-banner fade-in" role="alert">
                <AlertTriangle size={16} aria-hidden="true" />
                <div className="error-banner-body">
                  <strong>Test interrupted</strong>
                  <p>{errorMessage || 'Something went wrong. Please try again.'}</p>
                </div>
              </div>
            )}

            {(isIdle || isError) && (
              <button
                className="action-button"
                onClick={handleStartTest}
                aria-label="Start speed test"
                type="button"
              >
                {isError ? 'Try Again' : 'Start Test'}
              </button>
            )}

            {isRunning && (
              <button
                className="action-button is-stopping"
                onClick={stopTest}
                aria-label="Cancel speed test"
                type="button"
              >
                Cancel Test
              </button>
            )}

            {isFinished && (
              <div className="finished-actions">
                <button
                  className="action-button"
                  onClick={runTest}
                  aria-label="Run test again"
                  type="button"
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
                      type="button"
                    >
                      <FileText size={14} />
                      Report
                    </button>
                  )}
                  <button
                    className="action-btn-ghost"
                    onClick={handleShare}
                    aria-label="Copy results to clipboard"
                    title="Copy results to clipboard"
                    type="button"
                  >
                    <Share2 size={14} />
                    Share
                  </button>
                </div>
              </div>
            )}
          </section>

          <section
            className={`stats-column${isFinished ? ' reveal-stagger' : ' fade-in-delayed'}`}
            aria-label="Test results"
          >
            <div className="stat-cards">
              <StatCard
                label="Download"
                icon={ICON_DOWNLOAD}
                value={metrics.download}
                unit="Mbps"
                colorClass="accent"
                fillClass=""
                max={500}
              />
              <StatCard
                label="Upload"
                icon={ICON_UPLOAD}
                value={metrics.upload}
                unit="Mbps"
                colorClass="green"
                fillClass="green"
                max={200}
              />
              <StatCard
                label="Ping"
                icon={ICON_PING}
                value={metrics.ping}
                unit="ms"
                colorClass="amber"
                fillClass="amber"
                max={200}
                invertBar
              />
              <StatCard
                label="Jitter"
                icon={ICON_JITTER}
                value={metrics.jitter || null}
                unit="ms"
                colorClass="amber"
                fillClass="amber"
                max={50}
                invertBar
              />
            </div>

            {showScore && (
              <div className="stagger-child">
                <ScoreCard score={score} metrics={metrics} />
              </div>
            )}

            <div className={showScore ? 'stagger-child-2' : ''}>
              <NetworkCard
                info={networkInfo}
                dlStability={dlStability}
                ulStability={ulStability}
              />
            </div>

            {/* Compact in-session recent results (idle / finished) */}
            {(isIdle || isFinished || isError) && history.length > 0 && (
              <div className="session-history fade-in" aria-label="Recent results">
                <div className="session-history-header">
                  <span>Recent</span>
                  <button
                    type="button"
                    className="session-history-link"
                    onClick={openHistory}
                  >
                    View all
                  </button>
                </div>
                <ul className="session-history-list">
                  {history.slice(0, 3).map((r) => (
                    <li key={r.date} className="session-history-item">
                      <span className="shi-dl">↓ {r.download > 0 ? r.download.toFixed(1) : '--'}</span>
                      <span className="shi-ul">↑ {r.upload > 0 ? r.upload.toFixed(1) : '--'}</span>
                      <span className="shi-ping">◎ {r.ping || '--'} ms</span>
                      <span className="shi-time">
                        {new Date(r.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </main>

        <HistoryModal
          open={showHistory}
          onClose={closeHistory}
          history={history}
          clearHistory={clearHistory}
        />

        <ExpertReportModal
          report={showExpertReport ? latestReport : null}
          onClose={() => setShowExpertReport(false)}
        />
      </div>

      {toast && (
        <div className="toast-notification fade-in" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {isIdle && history.length > 0 && (() => {
        const last = history[0];
        const timeAgo = (() => {
          const diff = Date.now() - new Date(last.date).getTime();
          const mins = Math.floor(diff / 60000);
          const hrs = Math.floor(mins / 60);
          const days = Math.floor(hrs / 24);
          if (days > 0) return `${days}d ago`;
          if (hrs > 0) return `${hrs}h ago`;
          if (mins > 0) return `${mins}m ago`;
          return 'just now';
        })();
        return (
          <div className="last-result-bar lrb-fade-in" role="complementary" aria-label="Last test results">
            <span className="lrb-label">Last<span className="lrb-text-extra"> run</span></span>
            <span className="lrb-sep">·</span>
            <span className="lrb-item lrb-dl">
              ↓ {last.download > 0 ? last.download.toFixed(1) : '--'}
              <span className="lrb-unit"> Mbps</span>
            </span>
            <span className="lrb-item lrb-ul">
              ↑ {last.upload > 0 ? last.upload.toFixed(1) : '--'}
              <span className="lrb-unit"> Mbps</span>
            </span>
            <span className="lrb-item lrb-ping">
              ◎ {last.ping || '--'}
              <span className="lrb-unit"> ms</span>
            </span>
            <span className="lrb-sep">·</span>
            <span className="lrb-time">{timeAgo}</span>
          </div>
        );
      })()}
    </>
  );
}
