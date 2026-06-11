/**
 * @file useNetworkInfo.js
 * Detects network metadata and diagnostics on mount; aborts on unmount.
 *
 * Security: all string values from external APIs are sanitised
 * (trimmed, max-length capped) before being stored in state.
 */

import { useState, useEffect } from 'react';
import { ENDPOINTS, TIMEOUTS } from '../constants.js';

/**
 * @typedef {Object} NetworkInfo
 * @property {string} provider
 * @property {string} type
 * @property {string} downlink
 * @property {string} ip
 * @property {string} loc
 * @property {string} colo
 * @property {string} http
 * @property {string} tls
 * @property {string} warp
 * @property {string} browser
 * @property {string} os
 */

/** @returns {NetworkInfo} */
const defaults = () => ({
  provider: 'Detecting…',
  type:     'Unknown',
  downlink: 'N/A',
  ip:       'Detecting…',
  loc:      '--',
  colo:     '--',
  http:     '--',
  tls:      '--',
  warp:     '--',
  browser:  '--',
  os:       '--',
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
 * Parse browser name and OS from user agent string.
 * @param {string} ua
 * @returns {{ browser: string, os: string }}
 */
const parseUA = (ua) => {
  if (!ua) return { browser: '--', os: '--' };
  
  let os = '--';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';
  
  let browser = '--';
  if (/Chrome|CriOS/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
  else if (/Edg/i.test(ua)) browser = 'Edge';
  
  return { browser, os };
};

/**
 * Parse plain-text Cloudflare trace response.
 * @param {string} text
 * @returns {Object<string, string>}
 */
const parseTrace = (text) => {
  if (!text) return {};
  const lines = text.split('\n');
  const obj = {};
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length === 2) {
      obj[parts[0].trim()] = parts[1].trim();
    }
  }
  return obj;
};

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

      // Parse UA locally
      const { browser, os } = parseUA(navigator.userAgent);
      result.browser = browser;
      result.os = os;

      // — Cloudflare trace —
      try {
        const traceRes = await fetch(ENDPOINTS.PING, {
          signal: AbortSignal.timeout(TIMEOUTS.NETWORK_INFO),
        });
        if (traceRes.ok) {
          const traceText = await traceRes.text();
          const traceData = parseTrace(traceText);
          result.ip   = safe(traceData.ip)   || result.ip;
          result.loc  = safe(traceData.loc)  || result.loc;
          result.colo = safe(traceData.colo) || result.colo;
          result.http = safe(traceData.http) || result.http;
          result.tls  = safe(traceData.tls)  || result.tls;
          result.warp = safe(traceData.warp) || result.warp;
        }
      } catch {
        // Fallback for IP
        try {
          const res = await fetch(ENDPOINTS.IP_FALLBACK, {
            signal: AbortSignal.timeout(TIMEOUTS.NETWORK_INFO),
          });
          if (res.ok) {
            const data = await res.json();
            result.ip = safe(data.ip) || result.ip;
          }
        } catch {
          result.ip = 'Hidden by browser';
        }
      }

      // — ISP provider via ipinfo.io —
      try {
        const res = await fetch(ENDPOINTS.IP_PRIMARY, {
          signal: AbortSignal.timeout(TIMEOUTS.NETWORK_INFO),
        });
        if (res.ok) {
          const data = await res.json();
          result.provider = safe(String(data.org ?? data.asn ?? '').replace(/^AS\d+\s*/, ''))
            || 'ISP Detected';
        }
      } catch {
        result.provider = 'General Network';
      }

      // — Connection API —
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
