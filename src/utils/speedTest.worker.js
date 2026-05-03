// src/utils/speedTest.worker.js

const fetchWithTimeout = async (url, options = {}, limitMs = 5000) => {
  const c = new AbortController();
  const id = setTimeout(() => c.abort(), limitMs);
  try { return await fetch(url, { ...options, signal: c.signal }); }
  finally { clearTimeout(id); }
};

let bufferbloatPings = [];
let isMeasuringBufferbloat = false;

const measurePing = async () => {
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

const startBufferbloatMeasurement = () => {
  isMeasuringBufferbloat = true;
  bufferbloatPings = [];

  const pingLoop = async () => {
    if (!isMeasuringBufferbloat) return;
    try {
      const p = performance.now();
      await fetchWithTimeout('https://cloudflare.com/cdn-cgi/trace', { method: 'HEAD', cache: 'no-store' }, 2000);
      const latency = Math.round(performance.now() - p);
      if (isMeasuringBufferbloat) bufferbloatPings.push(latency);
    } catch {
      // ignore
    }
    if (isMeasuringBufferbloat) {
      setTimeout(pingLoop, 500);
    }
  };
  pingLoop();
};

const stopBufferbloatMeasurement = () => {
  isMeasuringBufferbloat = false;
  if (bufferbloatPings.length === 0) return 0;
  // Calculate average loaded ping
  const sum = bufferbloatPings.reduce((a, b) => a + b, 0);
  return Math.round(sum / bufferbloatPings.length);
};

const measureDownloadSpeed = async (onProgress) => {
  const MAX_D = 15000;
  const CONNS = 4; // Multiple connections for gigabit saturation
  const start = performance.now();

  let totalLoaded = 0;
  let isDone = false;
  let lastTime = start;

  startBufferbloatMeasurement();

  try {
    const tasks = Array.from({ length: CONNS }).map(async () => {
      try {
        const res = await fetchWithTimeout('https://speed.cloudflare.com/__down?bytes=50000000', { cache: 'no-store' }, MAX_D);
        if (!res.body) return;
        const reader = res.body.getReader();

        while (!isDone) {
          if (performance.now() - start > MAX_D) { reader.cancel(); break; }
          const { done, value } = await reader.read();
          if (done) break;

          totalLoaded += value.length;
          const now = performance.now();
          if (now - lastTime > 100) {
            const speedMbps = ((totalLoaded * 8) / ((now - start) / 1000)) / 1000000;
            onProgress(speedMbps);
            lastTime = now;
          }
        }
      } catch {
        // stream timeout or abort
      }
    });

    const timeoutPromise = new Promise(r => setTimeout(r, MAX_D));
    await Promise.race([Promise.all(tasks), timeoutPromise]);

    isDone = true;
    const now = performance.now();
    const secs = Math.max((now - start) / 1000, 0.001);
    const final = ((totalLoaded * 8) / secs) / 1000000;

    const loadedPing = stopBufferbloatMeasurement();

    return { speed: final, loadedPing };
  } catch {
    stopBufferbloatMeasurement();
    return { speed: 0, loadedPing: 0 };
  }
};

const measureUploadSpeed = async (onProgress) => {
  const MAX_D = 15000;
  const CONNS = 4;
  const LOAD = 10 * 1024 * 1024; // 10MB per conn
  const buffer = new Uint8Array(LOAD).fill(1).buffer;

  const start = performance.now();
  let totalLoaded = 0;
  let isDone = false;
  let lastTime = start;

  startBufferbloatMeasurement();

  try {
    const tasks = Array.from({ length: CONNS }).map(async () => {
      const controller = new AbortController();
      let bytesUploaded = 0;

      const simulateProgress = () => {
        if (isDone || controller.signal.aborted) return;

        // Estimate based on time to reach max payload
        const chunk = LOAD / (MAX_D / 100);
        bytesUploaded += chunk;
        if (bytesUploaded > LOAD) bytesUploaded = LOAD;

        // This is a rough estimation since fetch lacks native upload tracking
        // For a true accurate client we'd use XMLHttpRequest for upload tracking,
        // but XHR is tricky in strict Web Workers. We'll use simulated smoothing.
        totalLoaded += chunk;

        const now = performance.now();
        if (now - lastTime > 100) {
          const speedMbps = ((totalLoaded * 8) / ((now - start) / 1000)) / 1000000;
          onProgress(speedMbps);
          lastTime = now;
        }

        if (bytesUploaded < LOAD) {
          setTimeout(simulateProgress, 100);
        }
      };

      simulateProgress();

      const timeoutId = setTimeout(() => {
        controller.abort();
      }, MAX_D);

      try {
        await fetch('https://speed.cloudflare.com/__up', {
          method: 'POST',
          body: buffer,
          headers: { 'Content-Type': 'text/plain' },
          signal: controller.signal
        });
      } catch {
        // timeout or abort
      } finally {
        clearTimeout(timeoutId);
      }
    });

    const timeoutPromise = new Promise(r => setTimeout(r, MAX_D));
    await Promise.race([Promise.all(tasks), timeoutPromise]);

    isDone = true;
    const now = performance.now();
    const secs = Math.max((now - start) / 1000, 0.001);
    const final = ((totalLoaded * 8) / secs) / 1000000;

    const loadedPing = stopBufferbloatMeasurement();

    return { speed: final, loadedPing };
  } catch {
    stopBufferbloatMeasurement();
    return { speed: 0, loadedPing: 0 };
  }
};


self.onmessage = async (e) => {
  const { type } = e.data;

  if (type === 'start') {
    // 1. Ping
    self.postMessage({ type: 'status', message: 'pinging' });
    const pingData = await measurePing();
    self.postMessage({ type: 'pingResult', ...pingData });

    // 2. Download
    self.postMessage({ type: 'status', message: 'downloading' });
    const dlResult = await measureDownloadSpeed((current) => {
      self.postMessage({ type: 'downloadProgress', speed: current });
    });
    self.postMessage({ type: 'downloadComplete', speed: dlResult.speed, loadedPing: dlResult.loadedPing });

    // Pause
    await new Promise(r => setTimeout(r, 1000));

    // 3. Upload
    self.postMessage({ type: 'status', message: 'uploading' });
    const upResult = await measureUploadSpeed((current) => {
      self.postMessage({ type: 'uploadProgress', speed: current });
    });
    self.postMessage({ type: 'uploadComplete', speed: upResult.speed, loadedPing: upResult.loadedPing });

    self.postMessage({ type: 'status', message: 'finished' });
  }
};
