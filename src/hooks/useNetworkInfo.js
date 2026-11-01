/**
 * @file useNetworkInfo.js
 * Looks up the Cloudflare edge (colo, location, HTTP/TLS) and the ISP name
 * once on mount, for the Nerd stats panel. External strings are trimmed and
 * length-capped before they reach state.
 */

import { useState, useEffect } from 'react';
import { ENDPOINTS, TIMEOUTS } from '../constants.js';

/**
 * @typedef {Object} NetworkInfo
 * @property {string} provider  ISP name, 'Detecting…' or 'Unknown'
 * @property {string} loc       country code of the edge, or '--'
 * @property {string} colo      Cloudflare data-centre code, or '--'
 * @property {string} http      HTTP version, or '--'
 * @property {string} tls       TLS version, or '--'
 */

/** @returns {NetworkInfo} */
const defaults = () => ({ provider: 'Detecting…', loc: '--', colo: '--', http: '--', tls: '--' });

const safe = (v, max = 64) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Parse the plain-text `key=value` Cloudflare trace response. */
const parseTrace = (text) => {
  const obj = {};
  for (const line of (text || '').split('\n')) {
    const parts = line.split('=');
    if (parts.length === 2) obj[parts[0].trim()] = parts[1].trim();
  }
  return obj;
};

const get = (url) => fetch(url, { signal: AbortSignal.timeout(TIMEOUTS.NETWORK_INFO) });

/** @returns {NetworkInfo} */
const useNetworkInfo = () => {
  const [info, setInfo] = useState(defaults);

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      const result = defaults();

      try {
        const res = await get(ENDPOINTS.PING);
        if (res.ok) {
          const t = parseTrace(await res.text());
          result.loc = safe(t.loc) || result.loc;
          result.colo = safe(t.colo) || result.colo;
          result.http = safe(t.http) || result.http;
          result.tls = safe(t.tls) || result.tls;
        }
      } catch { /* edge details stay '--' */ }

      try {
        const res = await get(ENDPOINTS.ISP);
        if (res.ok) {
          const data = await res.json();
          result.provider = safe(String(data.org ?? data.asn ?? '').replace(/^AS\d+\s*/, ''));
        }
      } catch { /* provider stays unknown */ }
      if (!result.provider || result.provider === 'Detecting…') result.provider = 'Unknown';

      if (!cancelled) setInfo(result);
    };

    detect();
    return () => { cancelled = true; };
  }, []);

  return info;
};

export default useNetworkInfo;
