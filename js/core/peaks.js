/**
 * NanoSami — generic peak detection (v0.4.0).
 * Generalizes the FTIR prominence algorithm (js/core/spectrum.js, unchanged)
 * for any x–y signal (XRD patterns, Raman, UV–Vis, …) and adds:
 *  - explicit minProminence (absolute or fraction of signal span)
 *  - FWHM estimation by linear interpolation at half of the PEAK HEIGHT ABOVE
 *    THE LOCAL BASE (half-prominence crossing), the same convention as scipy.signal.peak_widths
 *    (rel_height = 0.5). This is a numerical estimate, not a profile fit; for
 *    overlapping peaks the half-prominence width is narrower than the true
 *    half-max width of the underlying isolated profile — treat with care.
 */

/**
 * @param {number[]} x ascending
 * @param {number[]} y
 * @param {object} opt
 * @param {number} [opt.minProminenceFrac] fraction of signal span (default 0.05)
 * @param {number} [opt.minProminenceAbs]  absolute prominence threshold (overrides frac if larger)
 * @param {number} [opt.minDistanceX]      minimum separation in x units (default 0 = off)
 * @param {number} [opt.maxPeaks]          keep at most N most prominent (default 60)
 * @returns {{peaks: {x:number, y:number, index:number, prominence:number,
 *            fwhm:number|null, leftHalfX:number|null, rightHalfX:number|null,
 *            fwhmNote:string|null}[], span:number}}
 */
export function findPeaks(x, y, {
  minProminenceFrac = 0.05, minProminenceAbs = 0,
  minDistanceX = 0, maxPeaks = 60,
} = {}) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 5) {
    throw new Error('Need at least 5 aligned (x, y) points for peak detection.');
  }
  if (minProminenceFrac < 0 || minProminenceFrac > 1) throw new Error('minProminenceFrac must be within [0, 1].');
  const n = y.length;
  const ymin = Math.min(...y), ymax = Math.max(...y);
  const span = ymax - ymin || 1;
  const thr = Math.max(minProminenceFrac * span, minProminenceAbs);

  // local maxima (plateau-aware: take plateau center)
  const cand = [];
  for (let i = 1; i < n - 1; i++) {
    if (y[i] > y[i - 1] && y[i] >= y[i + 1]) {
      let j = i;
      while (j + 1 < n && y[j + 1] === y[i]) j++;
      if (j + 1 < n && y[j + 1] < y[i]) cand.push(Math.round((i + j) / 2));
      i = j;
    }
  }

  // topographic prominence
  const peaks = [];
  for (const i of cand) {
    let lmin = y[i];
    for (let j = i - 1; j >= 0; j--) { if (y[j] > y[i]) break; lmin = Math.min(lmin, y[j]); }
    let rmin = y[i];
    for (let j = i + 1; j < n; j++) { if (y[j] > y[i]) break; rmin = Math.min(rmin, y[j]); }
    const prom = y[i] - Math.max(lmin, rmin);
    if (prom >= thr) peaks.push({ index: i, x: x[i], y: y[i], prominence: prom });
  }
  peaks.sort((a, b) => b.prominence - a.prominence);

  // minimum x separation — keep the most prominent
  const kept = [];
  for (const p of peaks) {
    if (minDistanceX > 0 && kept.some((k) => Math.abs(k.x - p.x) < minDistanceX)) continue;
    kept.push(p);
    if (kept.length >= maxPeaks) break;
  }
  kept.sort((a, b) => a.x - b.x);

  // FWHM at half-prominence
  for (const p of kept) {
    const half = p.y - p.prominence / 2;
    let L = null, R = null, note = null;
    for (let j = p.index; j > 0; j--) {
      if (y[j - 1] > p.y) { note = 'left side merges into a higher neighbour'; break; }
      if (y[j - 1] <= half && y[j] > half) {
        const t = (half - y[j]) / (y[j - 1] - y[j]);
        L = x[j] + t * (x[j - 1] - x[j]);
        break;
      }
      if (j - 1 === 0) note = 'half-height not reached on the left (edge)';
    }
    for (let j = p.index; j < n - 1; j++) {
      if (y[j + 1] > p.y) { note = note || 'right side merges into a higher neighbour'; break; }
      if (y[j + 1] <= half && y[j] > half) {
        const t = (half - y[j]) / (y[j + 1] - y[j]);
        R = x[j] + t * (x[j + 1] - x[j]);
        break;
      }
      if (j + 1 === n - 1) note = note || 'half-height not reached on the right (edge)';
    }
    p.leftHalfX = L; p.rightHalfX = R;
    p.fwhm = L !== null && R !== null ? Math.abs(R - L) : null;
    p.fwhmNote = p.fwhm === null ? (note || 'FWHM could not be determined') :
      (note ? `estimate uncertain: ${note}` : null);
  }
  return { peaks: kept, span };
}
