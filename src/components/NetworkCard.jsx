/**
 * @file NetworkCard.jsx
 * Displays detected network provider, connection type, IP address,
 * and an expandable advanced diagnostics panel.
 */

import { useState, memo } from 'react';
import { Globe, Wifi, ArrowDown, Server, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * @param {{ label: string, icon: React.ReactNode, value: string }} props
 */
const Row = memo(({ label, icon, value }) => (
  <div className="network-row">
    <div className="network-row-label">
      <span aria-hidden="true">{icon}</span>
      {label}
    </div>
    <div className="network-row-value">{value}</div>
  </div>
));
Row.displayName = 'NetworkRow';

/**
 * @param {{
 *   info: import('../hooks/useNetworkInfo.js').NetworkInfo,
 *   dlStability: number,
 *   ulStability: number,
 * }} props
 */
const NetworkCard = memo(({ info, dlStability, ulStability }) => {
  const [expanded, setExpanded] = useState(false);

  const regionLabel = info.loc !== '--' ? `${info.loc} (Edge Node)` : '--';

  return (
    <section className="network-card" aria-label="Network information and diagnostics">
      <div className="network-card-header">
        <Globe size={12} aria-hidden="true" /> Network Info
        <span className="network-estimate-hint">Browser estimate</span>
      </div>
      
      <div className="network-rows">
        <Row icon={<Server size={13} />}    label="Provider"   value={info.provider} />
        <Row icon={<Wifi size={13} />}      label="Connection type" value={info.type} />
        <Row icon={<ArrowDown size={13} />} label="Browser downlink" value={info.downlink} />
        <Row icon={<Globe size={13} />}     label="IP Address" value={info.ip} />
      </div>

      <button
        className="diagnostics-toggle-btn"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <ShieldCheck size={11} aria-hidden="true" />
        {expanded ? 'Hide Advanced Diagnostics' : 'Show Advanced Diagnostics'}
        {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {expanded && (
        <div
          className="fade-in-up"
          style={{ overflow: 'hidden' }}
        >
          <div className="diagnostics-panel">
            <div className="diag-grid">
              <div className="diag-item">
                <span className="diag-label">HTTP Protocol</span>
                <span className="diag-val">{info.http}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">TLS Cipher Security</span>
                <span className="diag-val">{info.tls}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Edge Gateway Node</span>
                <span className="diag-val">{info.colo}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Warp Accel Tunnel</span>
                <span className="diag-val">{info.warp === 'on' ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Diagnostics Region</span>
                <span className="diag-val">{regionLabel}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Platform OS</span>
                <span className="diag-val">{info.os}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">User Browser</span>
                <span className="diag-val">{info.browser}</span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Download Stream Stability</span>
                <span className={`diag-val${dlStability > 85 ? ' green' : dlStability > 60 ? ' amber' : ''}`}>
                  {dlStability > 0 ? `${dlStability}%` : '--'}
                </span>
              </div>
              <div className="diag-item">
                <span className="diag-label">Upload Stream Stability</span>
                <span className={`diag-val${ulStability > 85 ? ' green' : ulStability > 60 ? ' amber' : ''}`}>
                  {ulStability > 0 ? `${ulStability}%` : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

NetworkCard.displayName = 'NetworkCard';

export default NetworkCard;
