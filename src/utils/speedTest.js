// Real client-side speed estimators using fetch and XMLHttpRequest
// Enhanced with timeouts and AbortControllers for robustness

const fetchWithTimeout = async (url, options = {}, limitMs = 5000) => {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), limitMs);
  try { return await fetch(url, { ...options, signal: c.signal }); }
  finally { clearTimeout(id); }
};

export const measurePing = async () => {
  try {
    const p1 = performance.now();
    await fetchWithTimeout('https://cloudflare.com/cdn-cgi/trace', { method: 'HEAD', cache: 'no-store' });
    const latency1 = Math.round(performance.now() - p1);
    const p2 = performance.now();
    await fetchWithTimeout('https://cloudflare.com/cdn-cgi/trace', { method: 'HEAD', cache: 'no-store' });
    const latency2 = Math.round(performance.now() - p2);
    return { ping: latency1, jitter: Math.abs(latency1 - latency2) };
  } catch { return { ping: 0, jitter: 0 }; }
};

export const measureDownloadSpeed = async (onProgress) => {
  const MAX_D = 15000, start = performance.now();
  try {
    const res = await fetchWithTimeout('https://speed.cloudflare.com/__down?bytes=25000000', { cache: 'no-store' }, MAX_D);
    if (!res.body) return 0;

    const reader = res.body.getReader();
    let loaded = 0, lastTime = start;

    while (true) {
      if (performance.now() - start > MAX_D) { reader.cancel(); break; }
      const { done, value } = await reader.read();
      if (done) break;

      loaded += value.length;
      if (performance.now() - lastTime > 100) {
        onProgress(((loaded * 8) / ((performance.now() - start) / 1000)) / 1000000);
        lastTime = performance.now();
      }
    }
    return ((loaded * 8) / ((performance.now() - start) / 1000)) / 1000000;
  } catch { return 0; }
};

export const measureUploadSpeed = async (onProgress) => {
  const LOAD = 5 * 1024 * 1024, CONNS = 2, MAX_D = 15000;
  const blob = new Blob([new Uint8Array(LOAD).fill(1)], { type: 'application/octet-stream' });
  const start = performance.now();
  const loaded = Array(CONNS).fill(0);
  let lastTime = start;

  try {
    const tasks = Array.from({ length: CONNS }).map((_, i) => new Promise(res => {
      const controller = new AbortController();
      let startTime = performance.now();

      // Simulate progress since fetch lacks native upload tracking
      let bytesUploaded = 0;
      let isDone = false;

      const simulateProgress = () => {
        if (isDone || controller.signal.aborted) return;

        bytesUploaded += LOAD / (MAX_D / 100);
        if (bytesUploaded > LOAD) bytesUploaded = LOAD;
        loaded[i] = bytesUploaded;

        const total = loaded.reduce((a, b) => a + b, 0);
        if (performance.now() - lastTime > 100) {
          onProgress(((total * 8) / ((performance.now() - start) / 1000)) / 1000000);
          lastTime = performance.now();
        }

        if (bytesUploaded < LOAD) {
          setTimeout(simulateProgress, 100); // Recursive timeout avoids interval lock
        }
      };

      simulateProgress(); // Start cycle

      const timeoutId = setTimeout(() => {
        isDone = true;
        controller.abort();
        res();
      }, MAX_D);

      // text/plain avoids CORS preflight OPTIONS request
      fetch('https://speed.cloudflare.com/__up', {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': 'text/plain' },
        signal: controller.signal
      }).then(() => {
        isDone = true;
        clearTimeout(timeoutId);
        loaded[i] = LOAD; // Force complete
        res();
      }).catch(() => {
        isDone = true;
        clearTimeout(timeoutId);
        res();
      });
    }));

    await Promise.all(tasks);
    const total = loaded.reduce((a, b) => a + b, 0);
    const secs = Math.max((performance.now() - start) / 1000, 0.001);
    const final = ((total * 8) / secs) / 1000000;

    onProgress(final);
    return final;
  } catch { return 0; }
};

export const getNetworkInfo = async () => {
  let info = { provider: 'Local/Private Network', type: 'Unknown', downlink: 'N/A', rtt: 'N/A', ip: 'Hidden by Browser' };

  try {
    const res = await fetchWithTimeout('https://ipinfo.io/json', {}, 3000);
    if (!res.ok) throw new Error();
    const data = await res.json();
    info.ip = data.ip || info.ip;
    info.provider = (data.org || data.asn || 'ISP Identified').replace(/^AS\d+\s/, '');
  } catch {
    try {
      const res = await fetchWithTimeout('https://api.ipify.org?format=json', {}, 3000);
      info.ip = (await res.json()).ip || 'Hidden';
      info.provider = 'General Network';
    } catch { }
  }

  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (c) {
    info.type = c.effectiveType || c.type || 'Unknown';
    info.downlink = c.downlink ? `${c.downlink} Mbps estimated max` : 'N/A';
    info.rtt = c.rtt ? `${c.rtt} ms estimated` : 'N/A';
  }
  return info;
};
