/**
 * @file App.jsx
 * One screen, one action: the meter, a single Start button within thumb
 * reach, results filling in around the meter, and history in a bottom sheet.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

import useSpeedTest from './hooks/useSpeedTest.js';
import useNetworkInfo from './hooks/useNetworkInfo.js';
import Meter from './components/Meter.jsx';
import NerdPanel from './components/NerdPanel.jsx';
import HistorySheet from './components/HistorySheet.jsx';
import { STATUS, PHASE_LABELS } from './constants.js';
import { verdictFor, shareText } from './utils/verdict.js';
import './App.css';

const RUNNING = [STATUS.PINGING, STATUS.DOWNLOADING, STATUS.UPLOADING];
const fmt = (n) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));

/** Light haptic tick at the end of each phase, where supported. */
const useHaptics = (status) => {
  const prev = useRef(status);
  useEffect(() => {
    const was = prev.current;
    prev.current = status;
    if (was === status || !RUNNING.includes(was) || status === STATUS.IDLE) return;
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
    navigator.vibrate(status === STATUS.FINISHED ? [12, 70, 12] : status === STATUS.ERROR ? 40 : 10);
  }, [status]);
};

const Result = ({ label, value, ul, ready }) => (
  <div className={`result${ul ? ' ul' : ''}${ready ? ' ready' : ''}`}>
    <span className="result-label">{ul ? '↑' : '↓'} {label}</span>
    <span className="result-value">{ready ? fmt(value) : '–'}<small> Mbps</small></span>
  </div>
);

export default function App() {
  const {
    status, metrics, displaySpeed, dlData, ulData, history, isRunning, errorMessage,
    setProvider, runTest, stopTest, clearHistory,
  } = useSpeedTest();
  const networkInfo = useNetworkInfo();

  useEffect(() => { setProvider(networkInfo.provider); }, [networkInfo.provider, setProvider]);
  useHaptics(status);

  const [sessionStart] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [nerd, setNerd] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const isFinished = status === STATUS.FINISHED;
  const isError = status === STATUS.ERROR;
  const dlReady = metrics.download > 0 && (status === STATUS.UPLOADING || isFinished);
  const ulReady = metrics.upload > 0 && isFinished;
  const verdict = isFinished ? verdictFor(metrics) : null;
  const lastRun = isFinished ? history[0] : null;

  const start = useCallback(() => { setNerd(false); runTest(); }, [runTest]);

  const share = useCallback(async (run) => {
    const say = (msg) => {
      clearTimeout(toastTimer.current);
      setToast(msg);
      toastTimer.current = setTimeout(() => setToast(null), 2400);
    };
    try {
      await navigator.clipboard.writeText(shareText(run));
      say('Copied');
    } catch {
      say('Copy failed');
    }
  }, []);

  return (
    <div className={`screen ${status}`}>
      <h1 className="sr-only">Velocity speed test</h1>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {PHASE_LABELS[status] ?? ''}
        {isFinished && `. Download ${fmt(metrics.download)}, upload ${fmt(metrics.upload)} megabits per second. ${verdict.text}`}
      </div>

      <main className="stage">
        <Meter
          status={status}
          metrics={metrics}
          displaySpeed={displaySpeed}
          dlData={dlData}
          ulData={ulData}
        />

        <div className="results" aria-hidden={!dlReady && !ulReady}>
          <Result label="Download" value={metrics.download} ready={dlReady} />
          <Result label="Upload" value={metrics.upload} ul ready={ulReady} />
        </div>

        <div className="below">
          {isFinished && (
            <div className="verdict-wrap">
              <p className={`verdict ${verdict.level}`}>{verdict.text}</p>
              <button type="button" className="text-btn" aria-expanded={nerd} onClick={() => setNerd((n) => !n)}>
                {nerd ? 'Hide nerd stats' : 'Nerd stats'}
              </button>
            </div>
          )}
          {isError && (
            <p className="error" role="alert">{errorMessage || 'Something went wrong. Please try again.'}</p>
          )}
          {isFinished && nerd && lastRun && <NerdPanel run={lastRun} env={networkInfo} />}
        </div>
      </main>

      <div className="dock">
        {isRunning ? (
          <button type="button" className="go is-cancel" onClick={stopTest} aria-label="Cancel speed test">
            Cancel
          </button>
        ) : (
          <button
            type="button"
            className="go"
            onClick={start}
            aria-label={isFinished ? 'Run test again' : 'Start speed test'}
          >
            {isFinished ? 'Again' : isError ? 'Try again' : 'Start'}
          </button>
        )}

        <HistorySheet
          history={history}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onClear={clearHistory}
          onShare={share}
          env={networkInfo}
          sessionStart={sessionStart}
          hidden={isRunning}
        />
      </div>


      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
