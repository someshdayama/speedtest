import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  Wifi,
  Globe,
  Zap,
  History
} from 'lucide-react';
import { getNetworkInfo, startSpeedTest, stopSpeedTest } from './utils/speedTest';
import SpeedChart from './components/SpeedChart';
import './App.css';

function App() {
  const [status, setStatus] = useState('idle'); // idle, pinging, downloading, uploading, finished
  const [metrics, setMetrics] = useState({ ping: 0, jitter: 0, download: 0, upload: 0, loadedPing: 0 });
  const [networkInfo, setNetworkInfo] = useState({
    provider: 'Checking...', type: 'Unknown', downlink: 'N/A', rtt: 'N/A', ip: 'Checking...'
  });

  const [displaySpeed, setDisplaySpeed] = useState(0);
  const [maxDialSpeed, setMaxDialSpeed] = useState(100);

  // Real-time chart data
  const [dlData, setDlData] = useState([]);
  const [ulData, setUlData] = useState([]);

  // History Modal
  const [showHistory, setShowHistory] = useState(false);
  const [testHistory, setTestHistory] = useState([]);

  useEffect(() => {
    getNetworkInfo().then(info => setNetworkInfo(info));
    const saved = localStorage.getItem('speedTestHistory');
    if (saved) setTestHistory(JSON.parse(saved));
  }, []);

  const circleRadius = 110;
  const circumference = 2 * Math.PI * circleRadius;
  const dialPercentage = Math.min((displaySpeed / maxDialSpeed) * 100, 100);
  const strokeDashoffset = circumference - (dialPercentage / 100) * circumference;

  useEffect(() => {
    if (displaySpeed > maxDialSpeed * 0.9) setMaxDialSpeed(prev => prev * 2);
    else if (displaySpeed < maxDialSpeed * 0.2 && maxDialSpeed > 100 && status === 'idle') setMaxDialSpeed(100);
  }, [displaySpeed, maxDialSpeed, status]);

  const runTest = () => {
    if (status !== 'idle' && status !== 'finished') return;

    setStatus('pinging');
    setDisplaySpeed(0);
    setMaxDialSpeed(100);
    setMetrics({ ping: 0, jitter: 0, download: 0, upload: 0, loadedPing: 0 });
    setDlData([]);
    setUlData([]);

    let startTime = Date.now();

    startSpeedTest({
      onStatus: (msg) => setStatus(msg),
      onPing: (ping, jitter) => {
        setMetrics(prev => ({ ...prev, ping, jitter }));
        setDisplaySpeed(ping); // momentarily show ping
      },
      onDownloadProgress: (speed) => {
        setDisplaySpeed(speed);
        setMetrics(prev => ({ ...prev, download: speed }));
        setDlData(prev => [...prev, { time: Date.now() - startTime, speed }]);
      },
      onDownloadComplete: (speed, loadedPing) => {
        setDisplaySpeed(speed);
        setMetrics(prev => ({ ...prev, download: speed, loadedPing: loadedPing || prev.loadedPing }));
      },
      onUploadProgress: (speed) => {
        setDisplaySpeed(speed);
        setMetrics(prev => ({ ...prev, upload: speed }));
        setUlData(prev => [...prev, { time: Date.now() - startTime, speed }]);
      },
      onUploadComplete: (speed, loadedPing) => {
        setMetrics(prevMetrics => {
          const finalMetrics = { ...prevMetrics, upload: speed, loadedPing: loadedPing || prevMetrics.loadedPing };

          setTestHistory(prevHistory => {
            const newHistory = [{
              date: new Date().toISOString(),
              download: finalMetrics.download,
              upload: finalMetrics.upload,
              ping: finalMetrics.ping,
              provider: networkInfo.provider
            }, ...prevHistory].slice(0, 50);

            localStorage.setItem('speedTestHistory', JSON.stringify(newHistory));
            return newHistory;
          });

          return finalMetrics;
        });
        setDisplaySpeed(speed);
      },
      onError: (err) => {
        console.error(err);
        setStatus('idle');
      }
    });
  };

  const getDialColor = () => {
    if (status === 'downloading') return 'url(#gradient-dl)';
    if (status === 'uploading') return 'url(#gradient-ul)';
    if (status === 'finished') return 'url(#gradient-dl)';
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
      <header className="header">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span style={{ WebkitTextFillColor: 'initial', display: 'flex' }}>
            <Zap size={38} className="text-accent" />
          </span>
          Velocity
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          True Network Performance Insights
        </motion.p>
      </header>

      <main className="dashboard">
        {/* Left Column: Speedometer */}
        <motion.div
          className="speed-column"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, type: 'spring' }}
        >
          <div className={`speedometer-container${status !== 'idle' && status !== 'finished' ? ' is-running' : ''}`}>
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
                </defs>
                <circle cx="120" cy="120" r={circleRadius} className="circle-bg" />
                <motion.circle
                  cx="120"
                  cy="120"
                  r={circleRadius}
                  className="circle-bar"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
                  stroke={getDialColor()}
                />
              </svg>

              <div className="speed-value-display">
                <motion.div
                  className="value"
                  // Key forces re-animation jump when switching statuses
                  key={status}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {status === 'pinging' ? metrics.ping : (
                    status === 'finished' ? metrics.download.toFixed(1) :
                      (displaySpeed > 0 ? displaySpeed.toFixed(1) : '0.0')
                  )}
                </motion.div>
                <div className="unit">{status === 'finished' ? 'Mbps' : currentUnit}</div>
                <div className="label">{getStatusLabel()}</div>
              </div>
            </div>

            {/* Real-time Chart nested inside the container for a clean look */}
            <AnimatePresence>
              {(status === 'downloading' || status === 'uploading' || status === 'finished') && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="chart-wrapper"
                >
                  <SpeedChart
                    data={status === 'uploading' ? ulData : dlData}
                    type={status === 'uploading' ? 'upload' : 'download'}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="action-button"
            onClick={runTest}
            disabled={status !== 'idle' && status !== 'finished'}
          >
            {status === 'finished' ? 'TEST AGAIN' : (status === 'idle' ? 'START TEST' : 'TESTING...')}
          </motion.button>
        </motion.div>

        {/* Right Column: Stats & Info */}
        <motion.div
          className="stats-grid"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
        >
          <StatCard icon={<ArrowDownCircle className="stat-icon download" />} title="Download" value={metrics.download} unit="Mbps" glow="indigo" />
          <StatCard icon={<ArrowUpCircle className="stat-icon upload" />} title="Upload" value={metrics.upload} unit="Mbps" glow="violet" />
          <StatCard icon={<Activity className="stat-icon ping" />} title="Ping" value={metrics.ping} unit="ms" />
          <StatCard icon={<Activity className="stat-icon jitter" />} title="Bufferbloat" value={metrics.loadedPing || '--'} unit="ms" />

          <motion.div
            className="network-info"
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
          >
            <InfoItem label="PROVIDER" icon={<Globe size={16} />} value={networkInfo.provider} />
            <InfoItem label="CONNECTION" icon={<Wifi size={16} />} value={networkInfo.type.toUpperCase()} />
            <InfoItem label="EST. DOWNLINK" icon={<ArrowDownCircle size={16} />} value={networkInfo.downlink} />
            <InfoItem label="IP ADDRESS" icon={<Activity size={16} />} value={networkInfo.ip} />
          </motion.div>

          <motion.div
            className="history-controls"
            variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
            style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}
          >
            <button className="history-btn" onClick={() => setShowHistory(true)}>
              <History size={16} /> View Past Tests
            </button>
          </motion.div>

        </motion.div>
      </main>

      {/* History Modal Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            className="history-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowHistory(false)}
          >
            <motion.div
              className="history-modal-content"
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              onClick={e => e.stopPropagation()} // Prevent close on modal click
            >
              <div className="history-header">
                <h2>Test History</h2>
                <button onClick={() => setShowHistory(false)} className="close-btn">&times;</button>
              </div>
              <div className="history-list">
                {testHistory.length === 0 ? (
                  <p className="no-history">No tests run yet.</p>
                ) : (
                  testHistory.map((test, i) => (
                    <div key={i} className="history-row">
                      <div className="h-date">{new Date(test.date).toLocaleString()}</div>
                      <div className="h-stat down"><ArrowDownCircle size={14} /> {test.download.toFixed(1)}</div>
                      <div className="h-stat up"><ArrowUpCircle size={14} /> {test.upload.toFixed(1)}</div>
                      <div className="h-stat"><Activity size={14} /> {test.ping}ms</div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, title, value, unit, glow }) {
  return (
    <motion.div
      className="stat-card"
      variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="stat-header">{icon} {title}</div>
      <div className={`stat-value ${glow ? `text-glow-${glow}` : ''}`}>
        {(typeof value === 'number' && value > 0) ? value.toFixed(1).replace(/\.0$/, '') : (typeof value === 'string' ? value : '--')}
        <span className="stat-unit">{unit}</span>
      </div>
    </motion.div>
  );
}

function InfoItem({ label, icon, value }) {
  return (
    <div className="info-item">
      <span className="info-label">{label}</span>
      <span className="info-value">{icon} {value}</span>
    </div>
  );
}

export default App;
