/**
 * @file HistoryModal.jsx
 * Accessible modal overlay displaying past test results.
 *
 * Accessibility:
 *  - role="dialog" with aria-modal and aria-labelledby
 *  - Focus trapped to the modal while open (via autoFocus on close button)
 *  - Backdrop click and Escape key both close the modal
 */

import { memo, useEffect, useCallback, useState, useRef } from 'react';
import { History, Activity, Trash2, Download, ChevronRight } from 'lucide-react';
import Sparkline from './Sparkline.jsx';
import ExpertReportModal from './ExpertReportModal.jsx';

/**
 * @param {{ date: string }} row
 * @returns {{ day: string, time: string }}
 */
const formatDate = (date) => {
  const d = new Date(date);
  return {
    day:  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
};

const fmt = (n) => (typeof n === 'number' && n > 0 ? n.toFixed(1) : '--');

/**
 * @param {{ open: boolean, onClose: () => void, history: Array<object>, clearHistory: () => void }} props
 */
const HistoryModal = memo(({ open, onClose, history, clearHistory }) => {
  const [selectedReport, setSelectedReport] = useState(null);
  const chartRef = useRef(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement;

    if (modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length > 0) {
        const autoFocused = Array.from(focusable).find(el => el.hasAttribute('autoFocus'));
        if (autoFocused) {
          autoFocused.focus();
        } else {
          focusable[0].focus();
        }
      }
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        );

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
        previousActiveElement.focus();
      }
    };
  }, [open, onClose]);

  const handleExportPDF = () => {
    if (history.length > 0) {
      window.print();
    }
  };

  // Sparkline data (last 10 tests, chronological)
  const sparkData = [...history].reverse().slice(-10);

  return (
    <>
      {open && (
        <div
          className="modal-backdrop fade-in"
          role="presentation"
          onClick={onClose}
        >
          <div
            ref={modalRef}
            className="modal print-modal fade-in-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <div className="modal-title" id="history-title">
                <History size={15} aria-hidden="true" />
                Test History
              </div>
              
              <div className="header-actions">
                {history.length > 0 && (
                  <>
                    <button
                      className="history-btn"
                      onClick={handleExportPDF}
                      title="Export PDF"
                      aria-label="Export history to PDF"
                    >
                      <Download size={13} aria-hidden="true" />
                      Export PDF
                    </button>
                    <button
                      className="history-btn"
                      onClick={clearHistory}
                      style={{ color: 'var(--red)', borderColor: 'rgba(248,113,113,0.15)' }}
                      title="Clear History"
                      aria-label="Clear all test history"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                      Clear
                    </button>
                  </>
                )}
                <button
                  className="modal-close"
                  onClick={onClose}
                  aria-label="Close history"
                  autoFocus
                >
                  ×
                </button>
              </div>
            </div>

            {/* Sparkline chart of history */}
            {history.length >= 2 && (
              <div className="history-trend-panel" ref={chartRef}>
                <span className="history-trend-title">Download & Upload Speed Trends</span>
                <div className="history-trend-chart">
                  <Sparkline data={sparkData} />
                </div>
              </div>
            )}

            {/* Body */}
            <div className="modal-body" role="region" aria-label="Past test results">
              {history.length === 0 ? (
                <div className="no-history" role="status">
                  <Activity size={22} aria-hidden="true" />
                  No tests run yet.
                </div>
              ) : (
                <>
                  <div className="history-cols" aria-hidden="true">
                    <span className="hcol-label">Date</span>
                    <span className="hcol-label">Download</span>
                    <span className="hcol-label">Upload</span>
                    <span className="hcol-label">Ping</span>
                    <span className="hcol-label" style={{width: 24}}></span>
                  </div>

                  {history.map((row, i) => {
                    const { day, time } = formatDate(row.date);
                    return (
                      <div
                        key={row.date + i}
                        className="history-row clickable-row"
                        onClick={() => setSelectedReport(row)}
                        title="Click to view Expert Report"
                        aria-label={`View expert report for ${day} ${time}`}
                      >
                        <div className="h-date">
                          {day}
                          <br />
                          <span style={{ opacity: 0.55, fontSize: '0.65rem' }}>{time}</span>
                        </div>
                        <div className="h-val dl">{fmt(row.download)}</div>
                        <div className="h-val ul">{fmt(row.upload)}</div>
                        <div className="h-val ping">{row.ping}ms</div>
                        <div className="h-val h-icon"><ChevronRight size={14} opacity={0.5} /></div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
          <ExpertReportModal report={selectedReport} onClose={() => setSelectedReport(null)} />
        </div>
      )}
    </>
  );
});

HistoryModal.displayName = 'HistoryModal';

export default HistoryModal;
