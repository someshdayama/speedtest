import { useState, useEffect, useRef } from 'react';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  Wifi,
  Globe,
  Cpu,
  ChevronRight,
  Zap
} from 'lucide-react';
import { measurePing, measureDownloadSpeed, measureUploadSpeed, getNetworkInfo } from './utils/speedTest';
import './App.css';

function App() {
  const [status, setStatus] = useState('idle'); // idle, pinging, downloading, uploading, finished
  const [metrics, setMetrics] = useState({
    ping: 0,
    jitter: 0,
    download: 0,
    upload: 0
  });
  const [networkInfo, setNetworkInfo] = useState({
    provider: 'Checking...',
    type: 'Unknown',
    downlink: 'N/A',
    rtt: 'N/A',
    ip: 'Checking...'
  });

  useEffect(() => {
    // Fetch real IP and Provider info once on mount
    getNetworkInfo().then(info => setNetworkInfo(info));
  }, []);

  // For the speedometer animation
  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [maxDialSpeed, setMaxDialSpeed] = useState(100);

  // Speedometer calculation
  const circleRadius = 110;
  const circumference = 2 * Math.PI * circleRadius;
  // Convert speed to a percentage for the dial. 
  // We use a non-linear scale so small speeds still look good, but high speeds don't wrap trivially
  const dialPercentage = Math.min((displaySpeed / maxDialSpeed) * 100, 100);
  const strokeDashoffset = circumference - (dialPercentage / 100) * circumference;

  useEffect(() => {
    // Dynamically adjust scale based on current speed
    if (displaySpeed > maxDialSpeed * 0.9) {
      setMaxDialSpeed(prev => prev * 2);
    } else if (displaySpeed < maxDialSpeed * 0.2 && maxDialSpeed > 100 && status === 'idle') {
      setMaxDialSpeed(100);
    }
  }, [displaySpeed, maxDialSpeed, status]);

  const runTest = async () => {
    if (status !== 'idle' && status !== 'finished') return;

    // Reset state
    setStatus('pinging');
    setDisplaySpeed(0);
    setMaxDialSpeed(100);
    setMetrics({ ping: 0, jitter: 0, download: 0, upload: 0 });

    try {
      // 1. Measure Ping & Jitter
      const pingResult = await measurePing();
      setMetrics(prev => ({ ...prev, ping: pingResult.ping, jitter: pingResult.jitter }));

      // 2. Measure Download
      setStatus('downloading');
      const finalDownload = await measureDownloadSpeed((current) => {
        setDisplaySpeed(current);
        setMetrics(prev => ({ ...prev, download: current }));
      });
      // Snap to final value
      setDisplaySpeed(finalDownload);
      setMetrics(prev => ({ ...prev, download: finalDownload }));

      // Small pause between tests
      await new Promise(r => setTimeout(r, 1000));
      setDisplaySpeed(0); // Reset dial for upload

      // 3. Measure Upload
      setStatus('uploading');
      const finalUpload = await measureUploadSpeed((current) => {
        setDisplaySpeed(current);
        setMetrics(prev => ({ ...prev, upload: current }));
      });
      // Snap to final value
      setDisplaySpeed(finalUpload);
      setMetrics(prev => ({ ...prev, upload: finalUpload }));

      // Short pause before showing final score (download)
      await new Promise(r => setTimeout(r, 800));

      setStatus('finished');
      setDisplaySpeed(finalDownload);

    } catch (error) {
      console.error("Test failed:", error);
      setStatus('idle');
    }
  };

  const getDialColor = () => {
    if (status === 'downloading') return 'url(#gradient-dl)';
    if (status === 'uploading') return 'url(#gradient-ul)';
    if (status === 'finished') return 'url(#gradient-dl)'; // Show download color for final state
    return 'rgba(255,255,255,0.1)';
  };

  const currentUnit = (status === 'pinging') ? 'ms' : 'Mbps';
  const getStatusLabel = () => {
    switch (status) {
      case 'idle': return 'READY';
      case 'pinging': return 'LATENCY...';
      case 'downloading': return 'DOWNLOAD...';
      case 'uploading': return 'UPLOAD...';
      case 'finished': return 'DOWNLOAD SPEED';
      default: return '';
    }
  };

  return (
    <div className="app-container">

      {/* Header */}
      <header className="header">
        <h1><Zap size={40} className="text-accent" /> Velocity</h1>
        <p>True Network Performance Insights</p>
      </header>

      <main className="dashboard">
        {/* Left Column: Speedometer & Action */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div className="speedometer-container">
            <div className="circle-progress">
              <svg viewBox="0 0 240 240">
                <defs>
                  <linearGradient id="gradient-dl" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-primary)" />
                    <stop offset="100%" stopColor="var(--accent-secondary)" />
                  </linearGradient>
                  <linearGradient id="gradient-ul" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent-secondary)" />
                    <stop offset="100%" stopColor="var(--accent-tertiary)" />
                  </linearGradient>
                  <linearGradient id="gradient-finished" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--status-success)" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>
                </defs>
                <circle cx="120" cy="120" r={circleRadius} className="circle-bg" />
                <circle
                  cx="120"
                  cy="120"
                  r={circleRadius}
                  className="circle-bar"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  stroke={getDialColor()}
                />
              </svg>
            </div>

            <div className="speed-value-display">
              <div className="value">
                {status === 'pinging' ? metrics.ping : displaySpeed.toFixed(1)}
              </div>
              <div className="unit">{currentUnit}</div>
              <div className="label">{getStatusLabel()}</div>
            </div>
          </div>

          <button
            className="action-button"
            onClick={runTest}
            disabled={status !== 'idle' && status !== 'finished'}
          >
            {status === 'finished' ? 'TEST AGAIN' : (status === 'idle' ? 'START TEST' : 'TESTING...')}
          </button>
        </div>

        {/* Right Column: Stats & Info */}
        <div className="stats-grid">

          <div className="stat-card">
            <div className="stat-header">
              <ArrowDownCircle className="stat-icon download" />
              Download
            </div>
            <div className="stat-value text-glow-indigo">
              {metrics.download > 0 ? metrics.download.toFixed(1) : '--'}
              <span className="stat-unit">Mbps</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <ArrowUpCircle className="stat-icon upload" />
              Upload
            </div>
            <div className="stat-value text-glow-violet">
              {metrics.upload > 0 ? metrics.upload.toFixed(1) : '--'}
              <span className="stat-unit">Mbps</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Activity className="stat-icon ping" />
              Ping
            </div>
            <div className="stat-value">
              {metrics.ping > 0 ? metrics.ping : '--'}
              <span className="stat-unit">ms</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <Activity className="stat-icon jitter" />
              Jitter
            </div>
            <div className="stat-value">
              {metrics.jitter > 0 ? metrics.jitter : '--'}
              <span className="stat-unit">ms</span>
            </div>
          </div>

          <div className="network-info">
            <div className="info-item">
              <span className="info-label">PROVIDER</span>
              <span className="info-value"><Globe size={16} /> {networkInfo.provider}</span>
            </div>
            <div className="info-item">
              <span className="info-label">CONNECTION</span>
              <span className="info-value"><Wifi size={16} /> {networkInfo.type.toUpperCase()}</span>
            </div>
            <div className="info-item">
              <span className="info-label">EST. DOWNLINK</span>
              <span className="info-value"><ArrowDownCircle size={16} /> {networkInfo.downlink}</span>
            </div>
            <div className="info-item">
              <span className="info-label">EST. RTT</span>
              <span className="info-value"><Activity size={16} /> {networkInfo.rtt}</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;
