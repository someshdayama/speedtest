/**
 * @file HistorySheet.jsx
 * Bottom sheet: swipe up (or tap the handle) to see past runs as one thin
 * line each; tap a line to read its full report inside the sheet.
 */

import { memo, useEffect, useRef, useState } from 'react';
import NerdPanel from './NerdPanel.jsx';
import { verdictFor } from '../utils/verdict.js';
import { pingLevel, jitterLevel } from '../utils/levels.js';

const SWIPE = 28;
const fmt = (n) => (n > 0 ? (n >= 100 ? n.toFixed(0) : n.toFixed(1)) : '–');
const when = (iso) => {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
};


/** Vertical swipe detector for a handle element. */
const useSwipe = (onUp, onDown) => {
  const y0 = useRef(null);
  return {
    onPointerDown: (e) => { y0.current = e.clientY; },
    onPointerUp: (e) => {
      if (y0.current == null) return;
      const dy = e.clientY - y0.current;
      y0.current = null;
      if (dy < -SWIPE) onUp?.();
      else if (dy > SWIPE) onDown?.();
    },
    onPointerCancel: () => { y0.current = null; },
  };
};

const Report = ({ run, env, onBack, onShare }) => {
  const [nerd, setNerd] = useState(false);
  const { day, time } = when(run.date);
  const v = verdictFor(run);
  return (
    <div className="report">
      <button type="button" className="text-btn back" onClick={onBack}>‹ All runs</button>
      <p className="report-date">{day}, {time}</p>
      <p className={`verdict ${v.level}`}>{v.text}</p>
      <dl className="report-grid">
        <div><dt>Download</dt><dd>{fmt(run.download)}<small> Mbps</small></dd></div>
        <div><dt>Upload</dt><dd className="ul">{fmt(run.upload)}<small> Mbps</small></dd></div>
        <div><dt>Ping</dt><dd className={pingLevel(run.ping)}>{run.ping || '–'}<small> ms</small></dd></div>
        <div><dt>Jitter</dt><dd className={jitterLevel(run.jitter)}>{run.jitter ? Number(run.jitter).toFixed(1) : '–'}<small> ms</small></dd></div>
        <div><dt>Loaded ping</dt><dd className={pingLevel(run.loadedPing)}>{run.loadedPing || '–'}<small> ms</small></dd></div>
        <div><dt>Provider</dt><dd className="small">{run.provider && run.provider !== 'Unknown' ? run.provider : '–'}</dd></div>
      </dl>
      <div className="report-actions">
        <button type="button" className="text-btn" onClick={() => onShare(run)}>Copy results</button>
        <button type="button" className="text-btn" aria-expanded={nerd} onClick={() => setNerd((n) => !n)}>
          {nerd ? 'Hide nerd stats' : 'Nerd stats'}
        </button>
      </div>
      {nerd && <NerdPanel run={run} env={env} />}
    </div>
  );
};

/**
 * @param {{
 *   history: object[], open: boolean, onOpenChange: (open: boolean) => void,
 *   onClear: () => void, onShare: (run: object) => void, env: object, sessionStart: number,
 *   hidden?: boolean,
 * }} props
 */
const HistorySheet = memo(({ history, open, onOpenChange, onClear, onShare, env, sessionStart, hidden = false }) => {
  const [selected, setSelected] = useState(null);
  const sheetRef = useRef(null);
  const close = () => { onOpenChange(false); setSelected(null); };
  const peekSwipe = useSwipe(() => onOpenChange(true), null);
  const headSwipe = useSwipe(null, close);

  useEffect(() => {
    if (!open) return undefined;
    sheetRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onOpenChange(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  if (!history.length) return null;
  const run = selected != null ? history[selected] : null;

  return (
    <>
      {!open && !hidden && (
        <button
          type="button"
          className="sheet-peek"
          onClick={() => onOpenChange(true)}
          {...peekSwipe}
          aria-label={`Open history, ${history.length} past runs`}
        >
          <span className="grabber" aria-hidden="true" />
          History · {history.length}
        </button>
      )}

      <div className={`scrim${open ? ' is-open' : ''}`} onClick={close} aria-hidden="true" />

      <section
        ref={sheetRef}
        className={`sheet${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="History"
        tabIndex={-1}
        inert={!open}
      >
        <header className="sheet-head" {...headSwipe}>
          <span className="grabber" aria-hidden="true" />
          <div className="sheet-title">
            <h2>History</h2>
            <button type="button" className="text-btn" onClick={close} aria-label="Close history">Close</button>
          </div>
        </header>

        <div className="sheet-body">
          {run ? (
            <Report run={run} env={Date.parse(run.date) >= sessionStart ? env : null} onBack={() => setSelected(null)} onShare={onShare} />
          ) : (
            <>
              <ul className="runs">
                {history.map((r, i) => {
                  const { day, time } = when(r.date);
                  return (
                    <li key={r.date + i}>
                      <button type="button" className="run-line" onClick={() => setSelected(i)}
                        aria-label={`${day} ${time}: download ${fmt(r.download)}, upload ${fmt(r.upload)} Mbps, ping ${r.ping} ms. Open report`}>
                        <span className="run-when">{day} <small>{time}</small></span>
                        <span>↓ {fmt(r.download)}</span>
                        <span className="ul">↑ {fmt(r.upload)}</span>
                        <span className={pingLevel(r.ping)}>{r.ping || '–'}<small> ms</small></span>
                        <span className="chev" aria-hidden="true">›</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button type="button" className="text-btn danger" onClick={() => { onClear(); close(); }}>
                Clear history
              </button>
            </>
          )}
        </div>
      </section>
    </>
  );
});
HistorySheet.displayName = 'HistorySheet';

export default HistorySheet;
