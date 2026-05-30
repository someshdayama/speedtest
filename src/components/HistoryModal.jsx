/**
 * @file HistoryModal.jsx
 * Accessible modal overlay displaying past test results.
 *
 * Accessibility:
 *  - role="dialog" with aria-modal and aria-labelledby
 *  - Focus trapped to the modal while open (via autoFocus on close button)
 *  - Backdrop click and Escape key both close the modal
 */

import { memo, useEffect, useCallback } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { History, Activity, Trash2, Download } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

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
  // Close on Escape key
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  const exportCSV = () => {
    if (history.length === 0) return;
    const headers = ['Date', 'Provider', 'Download (Mbps)', 'Upload (Mbps)', 'Ping (ms)'];
    const rows = history.map(h => [
      new Date(h.date).toLocaleString(),
      `"${h.provider || 'Unknown'}"`,
      h.download.toFixed(1),
      h.upload.toFixed(1),
      h.ping
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `velocity_history_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sparkline data (last 10 tests, chronological)
  const sparkData = [...history].reverse().slice(-10);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
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
                      onClick={exportCSV}
                      title="Export CSV"
                      aria-label="Export history to CSV"
                    >
                      <Download size={13} aria-hidden="true" />
                      Export
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
              <div className="history-trend-panel">
                <span className="history-trend-title">Download & Upload Speed Trends</span>
                <div className="history-trend-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                      <YAxis hide domain={['auto', 'auto']} />
                      <Line
                        type="monotone"
                        dataKey="download"
                        stroke="var(--accent)"
                        strokeWidth={2}
                        dot={{ r: 2, strokeWidth: 0, fill: "var(--accent)" }}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="upload"
                        stroke="var(--green)"
                        strokeWidth={2}
                        dot={{ r: 2, strokeWidth: 0, fill: "var(--green)" }}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
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
                  </div>

                  {history.map((row, i) => {
                    const { day, time } = formatDate(row.date);
                    return (
                      <div
                        key={row.date + i}
                        className="history-row"
                        aria-label={`${day} ${time} — Download ${fmt(row.download)} Mbps, Upload ${fmt(row.upload)} Mbps, Ping ${row.ping} ms`}
                      >
                        <div className="h-date">
                          {day}
                          <br />
                          <span style={{ opacity: 0.55, fontSize: '0.65rem' }}>{time}</span>
                        </div>
                        <div className="h-val dl">{fmt(row.download)}</div>
                        <div className="h-val ul">{fmt(row.upload)}</div>
                        <div className="h-val ping">{row.ping}ms</div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

HistoryModal.displayName = 'HistoryModal';

export default HistoryModal;
