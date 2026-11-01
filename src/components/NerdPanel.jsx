/**
 * @file NerdPanel.jsx
 * Raw technical details. Only shows what the app measured or the browser
 * exposes; anything else is labelled as unavailable rather than guessed.
 */

import { memo } from 'react';
import Trace from './Trace.jsx';
import { ENDPOINTS, TEST } from '../constants.js';
import { phaseSpanMs, estimateMB, runTiming, peakOf } from '../utils/runStats.js';

const NA = <span className="nerd-na">Not available</span>;
const host = (url) => { try { return new URL(url).host + new URL(url).pathname; } catch { return url; } };
const sec = (ms) => (ms > 0 ? `${(ms / 1000).toFixed(1)} s` : null);
const mbps = (v) => (v > 0 ? `${v.toFixed(1)} Mbps` : null);
const known = (v) => v && v !== '--' && v !== 'N/A' && v !== 'Unknown' && !String(v).startsWith('Detecting');
const time = (iso) => (iso ? new Date(iso).toLocaleString(undefined, {
  dateStyle: 'medium', timeStyle: 'medium',
}) : null);

const Row = ({ k, v, note }) => (
  <div className="nerd-row">
    <dt>{k}</dt>
    <dd>{v ?? NA}{note && <small> {note}</small>}</dd>
  </div>
);

const readConnection = () => {
  const c = typeof navigator !== 'undefined'
    ? navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection
    : null;
  if (!c) return null;
  return {
    type: c.type || null,
    effectiveType: c.effectiveType || null,
    downlink: typeof c.downlink === 'number' ? `${c.downlink} Mbps` : null,
    rtt: typeof c.rtt === 'number' ? `${c.rtt} ms` : null,
    saveData: typeof c.saveData === 'boolean' ? (c.saveData ? 'On' : 'Off') : null,
  };
};

/**
 * @param {{ run: object, env?: object | null }} props
 * `env` (network info for this session) is only passed for the current run;
 * past runs never stored it.
 */
const NerdPanel = memo(({ run, env = null }) => {
  if (!run) return null;
  const dl = run.dlData ?? [];
  const ul = run.ulData ?? [];
  const { durationMs, startedAt, finishedAt } = runTiming(run);
  const conn = env ? readConnection() : null;
  const dlMB = estimateMB(dl);
  const ulMB = estimateMB(ul);

  return (
    <section className="nerd" aria-label="Technical details">
      <h3>Throughput</h3>
      <Trace dlData={dl} ulData={ul} />

      <h3>Test</h3>
      <dl>
        <Row k="Download endpoint" v={host(ENDPOINTS.DOWNLOAD)} />
        <Row k="Upload endpoint" v={host(ENDPOINTS.UPLOAD)} />
        <Row k="Latency endpoint" v={host(ENDPOINTS.PING)} />
        {env && <Row k="Edge server" v={known(env.colo) ? `Cloudflare ${env.colo}${known(env.loc) ? ` (${env.loc})` : ''}` : null} />}
        {env && <Row k="HTTP / TLS" v={known(env.http) ? `${env.http}${known(env.tls) ? ` · ${env.tls}` : ''}` : null} />}
        <Row k="Parallel streams" v={String(TEST.CONNECTIONS)} />
        <Row k="Started" v={time(startedAt)} />
        <Row k="Finished" v={time(finishedAt)} />
        <Row k="Duration" v={sec(durationMs)} note="(from first to last sample)" />
      </dl>

      <h3>Latency</h3>
      <dl>
        <Row k="Ping (idle, avg)" v={run.ping > 0 ? `${run.ping} ms` : null}
          note={`(${TEST.PING_SAMPLES} samples, ${TEST.PING_WARMUP} warm-up discarded)`} />
        <Row k="Ping min / max" v={null} note="(not reported by this test)" />
        <Row k="Jitter" v={run.jitter > 0 ? `${Number(run.jitter).toFixed(1)} ms` : null} note="(mean change between samples)" />
        <Row k="Loaded ping" v={run.loadedPing > 0 ? `${run.loadedPing} ms` : null} note="(while transferring)" />
        <Row k="Packet loss" v={null} note="(browsers can't measure it)" />
      </dl>

      <h3>Transfer</h3>
      <dl>
        <Row k="Download" v={mbps(run.download)} note={`peak ${mbps(peakOf(dl)) ?? '–'}`} />
        <Row k="Upload" v={mbps(run.upload)} note={`peak ${mbps(peakOf(ul)) ?? '–'}`} />
        <Row k="Download samples" v={dl.length ? `${dl.length} over ${sec(phaseSpanMs(dl)) ?? '–'}` : null} />
        <Row k="Upload samples" v={ul.length ? `${ul.length} over ${sec(phaseSpanMs(ul)) ?? '–'}` : null} />
        <Row k="Data moved" v={dlMB + ulMB > 0 ? `≈ ${dlMB.toFixed(0)} MB down · ${ulMB.toFixed(0)} MB up` : null}
          note="(estimated from samples)" />
        <Row k="Stability" v={run.dlStability ? `${run.dlStability}% down · ${run.ulStability || '–'}% up` : null} />
      </dl>

      {env ? (
        <>
          <h3>Device &amp; network</h3>
          <dl>
            <Row k="Provider" v={known(env.provider) ? env.provider : null} />
            <Row k="Connection type" v={conn?.type ?? null} note={conn ? '' : '(Network Information API unavailable)'} />
            <Row k="Effective type" v={conn?.effectiveType ?? null} />
            <Row k="Browser downlink est." v={conn?.downlink ?? null} />
            <Row k="Browser RTT est." v={conn?.rtt ?? null} />
            <Row k="Data saver" v={conn?.saveData ?? null} />
            <Row k="User agent" v={<span className="nerd-ua">{navigator.userAgent}</span>} />
          </dl>
        </>
      ) : (
        <p className="nerd-na">Server and device details are only captured for the current session.</p>
      )}
    </section>
  );
});
NerdPanel.displayName = 'NerdPanel';

export default NerdPanel;
