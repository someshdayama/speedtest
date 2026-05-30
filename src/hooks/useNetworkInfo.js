/**
 * @file useNetworkInfo.js
 * Detects network metadata on mount; aborts on unmount.
 *
 * Security: all string values from external APIs are sanitised
 * (trimmed, max-length capped) before being stored in state.
 */

import { useState, useEffect } from 'react';
import { ENDPOINTS, TIMEOUTS } from '../constants.js';

/** @typedef {{ provider: string, type: string, downlink: string, ip: string }} NetworkInfo */

/** @returns {NetworkInfo} */
const defaults = () => ({
  provider: 'Detecting…',
  type:     'Unknown',
  downlink: 'N/A',
  ip:       'Detecting…',
});

/**
 * Trim a value and cap its length to prevent oversized strings reaching the UI.
 * @param {unknown} v
 * @param {number} [max=64]
 * @returns {string}
 */
const safe = (v, max = 64) =>
  typeof v === 'string' ? v.trim().slice(0, max) : '';

/**
 * Custom hook — returns network info; updates once on mount.
 * @returns {NetworkInfo}
 */
const useNetworkInfo = () => {
  const [info, setInfo] = useState(defaults);

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      const result = { ...defaults() };

      // — IP / provider via ipinfo.io —
      try {
        const res = await fetch(ENDPOINTS.IP_PRIMARY, {
          signal: AbortSignal.timeout(TIMEOUTS.NETWORK_INFO),
        });
        if (res.ok) {
          const data = await res.json();
          result.ip       = safe(data.ip)  || result.ip;
          // Strip leading "AS12345 " from org string
          result.provider = safe((data.org ?? data.asn ?? '').replace(/^AS\d+\s*/, ''))
            || 'ISP Detected';
        }
      } catch {
        // Fallback — IP only
        try {
          const res = await fetch(ENDPOINTS.IP_FALLBACK, {
            signal: AbortSignal.timeout(TIMEOUTS.NETWORK_INFO),
          });
          if (res.ok) {
            const data = await res.json();
            result.ip       = safe(data.ip) || result.ip;
            result.provider = 'General Network';
          }
        } catch {
          result.ip       = 'Hidden by browser';
          result.provider = 'Unknown';
        }
      }

      // — Connection API (best-effort, not available in all browsers) —
      const conn = navigator.connection ?? navigator.mozConnection ?? navigator.webkitConnection;
      if (conn) {
        result.type     = safe(conn.effectiveType ?? conn.type ?? 'Unknown');
        result.downlink = conn.downlink ? `${conn.downlink} Mbps` : 'N/A';
      }

      if (!cancelled) setInfo(result);
    };

    detect();
    return () => { cancelled = true; };
  }, []);

  return info;
};

export default useNetworkInfo;
