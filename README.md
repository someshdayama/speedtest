# Velocity — internet speed test

Velocity is a one-screen, one-button speed test that runs in the browser.
It measures **download**, **upload**, **ping**, **jitter** and **loaded ping**
(latency while the line is busy, a rough bufferbloat check). It needs no
account and has no ads or tracking. Results stay on your device.

Live: <https://velocity-speedtest.netlify.app>

## How it measures

All measurement runs in a Web Worker against Cloudflare's public speed
endpoints, so the UI thread stays smooth.

| Step | What happens |
| --- | --- |
| Ping & jitter | 8 small requests to `cloudflare.com/cdn-cgi/trace` (after 1 warm-up). Ping is the average round trip. Jitter is the mean change between consecutive samples. |
| Download | 4 parallel streams fetch `speed.cloudflare.com/__down`, stepping up in size (1 → 5 → 25 → 50 MB). Bytes are counted as they arrive. |
| Upload | 4 parallel streams POST to `speed.cloudflare.com/__up`, with chunk sizes that adapt to the line (64 KB – 2 MB). |
| Loaded ping | The latency endpoint is polled during each transfer. |
| Result | The first second of each transfer is dropped (TCP warm-up). The final Mbps is a trimmed mean of the last ~35 % of samples. A phase ends early once its samples are stable. Each phase stops after 12 s at most. |

Failed requests are retried with capped exponential backoff. HTTP error
responses never count as throughput. Cancel, going offline or closing the page
aborts every in-flight request and timer. Packet loss isn't shown because
browsers can't measure it.

The gauge uses a fixed scale: 0, 5, 10, 25, 50, 100, 150, 200 Mbps. If a line
is faster than 200 Mbps, only the last label moves (250, 300, 400 … 10 000).

## Features

- History of the last 50 runs, saved in `localStorage` and checked on load.
  Corrupt or unavailable storage is handled safely. Each run has a full
  report and a "Copy results" option.
- Nerd stats: raw values only. Endpoints, Cloudflare edge, protocol,
  streams, timings, sample counts and data used. Anything unknown is left out
  or marked as such.
- Responsive layout. On phones the button sits at the bottom, within thumb reach. On desktop the meter scales with the window, and the meter, results and button form one centred group.
- Installable PWA with an offline shell. A new version is applied only while
  idle, or when you tap "reload" after a test. It never interrupts a run.
- Accessible:
  - phase and result are announced to screen readers
  - full keyboard use with visible focus. **Space** or **Enter** starts a test and **Esc** cancels one. A small hint shows on devices with a mouse.
  - the history sheet is a proper dialog (focus trap, Esc closes)
  - text contrast meets WCAG AA
  - reduced motion is respected

## Scripts

```bash
npm ci            # install
npm run dev       # dev server on http://localhost:5173
npm run lint      # ESLint
npm test          # Vitest (jsdom)
npm run build     # production build into dist/
npm run preview   # serve dist/ on http://localhost:4173
```

Stack: React 19 and Vite 7, with `vite-plugin-pwa` (Workbox) for the service
worker. The only runtime dependencies are `react` and `react-dom`.

## Project layout

```
src/
  App.jsx                    screen layout, live region, update handling
  components/                Meter, RingGauge, HistorySheet, NerdPanel, Trace, ErrorBoundary
  hooks/useSpeedTest.js      test state machine (reducer) + offline handling
  utils/speedTest.worker.js  the measurement engine (Web Worker)
  utils/history.js           safe localStorage persistence
  constants.js               endpoints, timings, gauge geometry
public/                      icons, OG image, self-hosted Inter font, robots.txt
netlify.toml                 security headers, caching, SPA fallback
```

## Deploy (Netlify)

The site is deployed from the CLI with a prebuilt `dist/`. `netlify.toml`
provides:

- the Content-Security-Policy, which only allows connections to Cloudflare,
  ipinfo.io (ISP name)
- `nosniff`, Referrer-Policy, Permissions-Policy, frame denial and HSTS
- long-lived caching for hashed assets
- `no-cache` for `index.html`, `sw.js` and the manifest
- the SPA fallback

```bash
npm ci && npm run lint && npm test && npm run build

# preview deploy
netlify deploy --dir dist --site <site-id> --alias preview

# production
netlify deploy --prod --dir dist --site <site-id>
```

If you add a new external endpoint, add it to `connect-src` in
`netlify.toml`. If you don't, the CSP will block it.
