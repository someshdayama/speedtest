// src/utils/speedTest.js

export const getNetworkInfo = async () => {
  let info = { provider: 'Local/Private Network', type: 'Unknown', downlink: 'N/A', rtt: 'N/A', ip: 'Hidden by Browser' };

  try {
    const res = await fetch('https://ipinfo.io/json', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error();
    const data = await res.json();
    info.ip = data.ip || info.ip;
    info.provider = (data.org || data.asn || 'ISP Identified').replace(/^AS\d+\s/, '');
  } catch {
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      info.ip = (await res.json()).ip || 'Hidden';
      info.provider = 'General Network';
    } catch { }
  }

  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c) {
    info.type = c.effectiveType || c.type || 'Unknown';
    info.downlink = c.downlink ? `${c.downlink} Mbps est.` : 'N/A';
    info.rtt = c.rtt ? `${c.rtt} ms est.` : 'N/A';
  }
  return info;
};

// Singleton worker manager
let worker = null;

export const startSpeedTest = (callbacks) => {
  if (worker) {
    worker.terminate();
  }
  
  // Create worker
  worker = new Worker(new URL('./speedTest.worker.js', import.meta.url), { type: 'module' });
  
  worker.onmessage = (e) => {
    const data = e.data;
    switch (data.type) {
      case 'status':
        callbacks.onStatus(data.message);
        break;
      case 'pingResult':
        callbacks.onPing(data.ping, data.jitter);
        break;
      case 'downloadProgress':
        callbacks.onDownloadProgress(data.speed);
        break;
      case 'downloadComplete':
        callbacks.onDownloadComplete(data.speed, data.loadedPing);
        break;
      case 'uploadProgress':
        callbacks.onUploadProgress(data.speed);
        break;
      case 'uploadComplete':
        callbacks.onUploadComplete(data.speed, data.loadedPing);
        break;
    }
  };

  worker.onerror = (err) => {
    callbacks.onError(err);
  };

  worker.postMessage({ type: 'start' });
};

export const stopSpeedTest = () => {
  if (worker) {
    worker.terminate();
    worker = null;
  }
};

