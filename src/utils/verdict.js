/**
 * @file verdict.js
 * Plain-English, one-line summary of a finished run.
 */

/**
 * @param {{ download: number, upload: number, ping: number }} m
 * @returns {{ text: string, level: '' | 'amber' | 'red' }}
 */
export const verdictFor = ({ download = 0, upload = 0, ping = 0 }) => {
  if (!(download > 0)) return { text: 'No result — the test did not complete.', level: 'red' };

  const laggy = ping > 100;
  const shaky = ping > 50;

  if (download >= 100 && upload >= 20 && !shaky) {
    return { text: 'Great for 4K streaming, gaming and big uploads.', level: '' };
  }
  if (download >= 25 && upload >= 5 && !laggy) {
    return {
      text: shaky
        ? 'Good for 4K streaming; calls fine, games may feel laggy.'
        : 'Good for 4K streaming and video calls.',
      level: '',
    };
  }
  if (download >= 10) {
    return {
      text: upload < 3 || laggy
        ? 'Fine for HD streaming; video calls may stutter.'
        : 'Fine for HD streaming and video calls.',
      level: 'amber',
    };
  }
  if (download >= 5) return { text: 'OK for browsing and SD video.', level: 'amber' };
  return { text: 'Slow — expect buffering on video.', level: 'red' };
};

const fmt = (n) => (n > 0 ? (n >= 100 ? n.toFixed(0) : n.toFixed(1)) : '–');

/** Plain-text summary used by "Copy results". */
export const shareText = (r) => [
  'Velocity speed test',
  `Download ${fmt(r.download)} Mbps · Upload ${fmt(r.upload)} Mbps`,
  `Ping ${r.ping || '–'} ms · Jitter ${r.jitter ? Number(r.jitter).toFixed(1) : '–'} ms`,
  verdictFor(r).text,
].join('\n');
