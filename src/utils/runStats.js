/**
 * @file runStats.js
 * Derived numbers for the Nerd panel, computed only from samples the test
 * actually recorded ({ time: ms since start, speed: Mbps }).
 */

/** Time span covered by a phase's samples, in ms. */
export const phaseSpanMs = (samples = []) =>
  samples.length > 1 ? samples[samples.length - 1].time - samples[0].time : 0;

/**
 * Approximate megabytes moved during a phase, integrating Mbps over the
 * sample intervals. This is an estimate, not a byte counter.
 */
export const estimateMB = (samples = []) => {
  let mb = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const dt = samples[i].time - samples[i - 1].time;
    if (dt > 0 && samples[i].speed > 0) mb += (samples[i].speed * dt) / 8000;
  }
  return mb;
};

/** Total run duration (ms) and start time, derived from the last sample. */
export const runTiming = (run) => {
  const last = [...(run?.ulData ?? []), ...(run?.dlData ?? [])]
    .reduce((m, s) => (s.time > m ? s.time : m), 0);
  if (!run?.date || !last) return { durationMs: 0, startedAt: null, finishedAt: run?.date ?? null };
  const finished = new Date(run.date);
  return {
    durationMs: last,
    startedAt: new Date(finished.getTime() - last).toISOString(),
    finishedAt: run.date,
  };
};

export const peakOf = (samples = []) => samples.reduce((m, s) => (s.speed > m ? s.speed : m), 0);
