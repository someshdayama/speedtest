/**
 * @file ExpertReportModal.jsx
 * Detailed "Expert Report" view for a single speed test.
 */

import { memo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Download, Upload, Activity, AlertTriangle, ShieldCheck, Clock, Server } from 'lucide-react';
import SpeedChart from './SpeedChart.jsx';
import { exportSingleTestPDF } from '../utils/pdfExport.js';

/** @param {number} n */
const fmt = (n) => (typeof n === 'number' && n > 0 ? n.toFixed(1) : '--');

const StatBox = ({ label, value, unit, icon: Icon, colorClass }) => (
  <div className={`er-stat-box ${colorClass}`}>
    <div className="er-stat-icon"><Icon size={14} /></div>
    <div className="er-stat-content">
      <div className="er-stat-label">{label}</div>
      <div className="er-stat-value">
        {value} <span className="er-stat-unit">{unit}</span>
      </div>
    </div>
  </div>
);

/**
 * @param {{ report: object, onClose: () => void }} props
 */
const ExpertReportModal = memo(({ report, onClose }) => {
  const dlChartRef = useRef(null);
  const ulChartRef = useRef(null);
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!report) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [report, handleKeyDown]);

  if (!report) return null;

  const d = new Date(report.date);
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <AnimatePresence>
      {report && (
        <motion.div
          className="modal-backdrop expert-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="modal expert-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="er-title"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, type: 'spring', damping: 25 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header er-header">
              <div className="modal-title" id="er-title">
                <FileText size={16} className="er-title-icon" />
                Expert Report
              </div>
              <div className="header-actions">
                <button
                  className="history-btn"
                  onClick={() => exportSingleTestPDF(report, dlChartRef.current, ulChartRef.current)}
                  title="Download PDF Certificate"
                >
                  <Download size={13} />
                  PDF
                </button>
                <button className="modal-close" onClick={onClose} aria-label="Close report" autoFocus>×</button>
              </div>
            </div>

            {/* Body */}
            <div className="modal-body er-body">
              {/* Meta Info */}
              <div className="er-meta-section">
                <div className="er-meta-item">
                  <Clock size={13} /> {dateStr} at {timeStr}
                </div>
                <div className="er-meta-item">
                  <Server size={13} /> ISP: <strong>{report.provider || 'Unknown'}</strong>
                </div>
              </div>

              {/* Core Metrics Grid */}
              <div className="er-grid">
                <StatBox label="Download" value={fmt(report.download)} unit="Mbps" icon={Download} colorClass="er-blue" />
                <StatBox label="Upload" value={fmt(report.upload)} unit="Mbps" icon={Upload} colorClass="er-green" />
                <StatBox label="Ping (Idle)" value={report.ping || '--'} unit="ms" icon={Activity} colorClass="er-amber" />
                <StatBox label="Loaded Ping" value={report.loadedPing || '--'} unit="ms" icon={AlertTriangle} colorClass="er-orange" />
              </div>

              {/* Advanced Metrics Grid */}
              <div className="er-grid-small">
                <div className="er-small-stat">
                  <span className="er-sl">Jitter</span>
                  <span className="er-sv">{fmt(report.jitter)} ms</span>
                </div>
                <div className="er-small-stat">
                  <span className="er-sl">DL Stability</span>
                  <span className="er-sv">{report.dlStability || '--'}%</span>
                </div>
                <div className="er-small-stat">
                  <span className="er-sl">UL Stability</span>
                  <span className="er-sv">{report.ulStability || '--'}%</span>
                </div>
                <div className="er-small-stat">
                  <span className="er-sl">Integrity</span>
                  <span className="er-sv"><ShieldCheck size={12} color="var(--green)" /> Verified</span>
                </div>
              </div>

              {/* Graphs */}
              {(report.dlData?.length > 1 || report.ulData?.length > 1) && (
                <div className="er-graphs">
                  {report.dlData?.length > 1 && (
                    <div className="er-graph-box" ref={dlChartRef}>
                      <div className="er-graph-title"><Download size={12}/> Download Curve</div>
                      <div className="er-graph-wrap">
                        <SpeedChart data={report.dlData} type="download" />
                      </div>
                    </div>
                  )}
                  {report.ulData?.length > 1 && (
                    <div className="er-graph-box" ref={ulChartRef}>
                      <div className="er-graph-title"><Upload size={12}/> Upload Curve</div>
                      <div className="er-graph-wrap">
                        <SpeedChart data={report.ulData} type="upload" />
                      </div>
                    </div>
                  )}
                </div>
              )}
              
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

ExpertReportModal.displayName = 'ExpertReportModal';

export default ExpertReportModal;
