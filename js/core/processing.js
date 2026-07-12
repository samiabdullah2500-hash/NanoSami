/**
 * NanoSami — signal processing for the Plotting/XRD studios (v0.4.0).
 * Pure functions; every operation returns a NEW array and a human-readable
 * description of what was done (for the Analysis Recipe). Original data are
 * never mutated — AI or UI suggestions must go through these explicit steps.
 */

const assertXY = (x, y, min = 3) => {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < min) {
    throw new Error(`Need at least ${min} aligned (x, y) points.`);
  }
};

/** Normalize intensities.
 * method: 'max' (y/ymax), 'minmax' (0–1), 'area' (unit trapezoidal area).
 */
export function normalize(x, y, method = 'max') {
  assertXY(x, y, 2);
  if (method === 'max') {
    const m = Math.max(...y.map(Math.abs));
    if (m === 0) throw new Error('Cannot normalize: all intensities are zero.');
    return { y: y.map((v) => v / m), description: 'normalized to maximum |y| = 1' };
  }
  if (method === 'minmax') {
    const lo = Math.min(...y), hi = Math.max(...y);
    if (hi === lo) throw new Error('Cannot min–max normalize: constant signal.');
    return { y: y.map((v) => (v - lo) / (hi - lo)), description: 'min–max normalized to [0, 1]' };
  }
  if (method === 'area') {
    let area = 0;
    for (let i = 1; i < x.length; i++) area += 0.5 * (y[i] + y[i - 1]) * (x[i] - x[i - 1]);
    area = Math.abs(area);
    if (area === 0) throw new Error('Cannot area-normalize: zero integrated area.');
    return { y: y.map((v) => v / area), description: 'normalized to unit trapezoidal area' };
  }
  throw new Error(`Unknown normalization method "${method}".`);
}

/** Vertical offset (for stacking spectra). */
export function offset(y, amount) {
  if (!Number.isFinite(amount)) throw new Error('Offset must be a finite number.');
  return { y: y.map((v) => v + amount), description: `offset by ${amount}` };
}

/** Moving-average smoothing, window must be odd ≥ 3. */
export function movingAverage(y, window = 5) {
  if (!Number.isInteger(window) || window < 3 || window % 2 === 0) throw new Error('Window must be an odd integer ≥ 3.');
  if (y.length < window) throw new Error('Signal shorter than the smoothing window.');
  const h = (window - 1) / 2, out = new Array(y.length);
  for (let i = 0; i < y.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(y.length - 1, i + h); j++) { s += y[j]; n++; }
    out[i] = s / n;
  }
  return { y: out, description: `moving-average smoothing (window ${window})` };
}

/** Savitzky–Golay smoothing (polynomial least squares in a sliding window).
 * Implemented by solving the normal equations per window offset; coefficients
 * are precomputed once per (window, order). Assumes approximately uniform x
 * spacing — a warning is included when spacing is strongly non-uniform.
 */
export function savitzkyGolay(x, y, { window = 7, order = 2 } = {}) {
  assertXY(x, y, window);
  if (!Number.isInteger(window) || window < 5 || window % 2 === 0) throw new Error('SG window must be an odd integer ≥ 5.');
  if (!Number.isInteger(order) || order < 1 || order >= window) throw new Error('SG polynomial order must satisfy 1 ≤ order < window.');
  const warnings = [];
  const dx = [];
  for (let i = 1; i < x.length; i++) dx.push(x[i] - x[i - 1]);
  const mean = dx.reduce((a, b) => a + b, 0) / dx.length;
  if (dx.some((d) => Math.abs(d - mean) > 0.25 * Math.abs(mean))) {
    warnings.push('x spacing is non-uniform (>25% variation) — Savitzky–Golay assumes uniform spacing; result is approximate.');
  }
  const h = (window - 1) / 2;
  // Build convolution coefficients: c = first row of (AᵀA)⁻¹Aᵀ with A[i][j]=i^j.
  const A = [];
  for (let i = -h; i <= h; i++) { const row = []; for (let j = 0; j <= order; j++) row.push(Math.pow(i, j)); A.push(row); }
  const AT = A[0].map((_, j) => A.map((r) => r[j]));
  const M = AT.map((r1) => AT.map((r2) => r1.reduce((s, v, k) => s + v * r2[k], 0))); // AᵀA
  // Gaussian elimination solve M z = e0
  const n = M.length, aug = M.map((r, i) => [...r, i === 0 ? 1 : 0]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(aug[r][c]) > Math.abs(aug[p][c])) p = r;
    [aug[c], aug[p]] = [aug[p], aug[c]];
    for (let r = 0; r < n; r++) if (r !== c) {
      const f = aug[r][c] / aug[c][c];
      for (let k = c; k <= n; k++) aug[r][k] -= f * aug[c][k];
    }
  }
  const z = aug.map((r, i) => r[n] / r[i]);
  const coeff = A.map((row) => row.reduce((s, v, j) => s + v * z[j], 0)); // c_i = Σ_j A[i][j] z_j
  const out = new Array(y.length);
  for (let i = 0; i < y.length; i++) {
    if (i < h || i >= y.length - h) { out[i] = y[i]; continue; } // edges untouched (stated)
    let s = 0;
    for (let k = -h; k <= h; k++) s += coeff[k + h] * y[i + k];
    out[i] = s;
  }
  return { y: out, warnings, description: `Savitzky–Golay smoothing (window ${window}, order ${order}; edge points unsmoothed)` };
}

/** Baseline correction.
 * method:
 *  'linear'  — straight line through the means of the first/last `edge` points.
 *  'rolling' — morphological rolling-minimum baseline (erosion + dilation +
 *              light smoothing). Suitable for broad backgrounds under sharp
 *              peaks (XRD, Raman). Window is in POINTS.
 * Returns corrected y AND the estimated baseline so the UI can show it.
 */
export function baseline(x, y, { method = 'linear', edge = 5, window = 51 } = {}) {
  assertXY(x, y, 5);
  if (method === 'linear') {
    const e = Math.max(1, Math.min(edge, Math.floor(y.length / 4)));
    const m0 = y.slice(0, e).reduce((a, b) => a + b, 0) / e;
    const m1 = y.slice(-e).reduce((a, b) => a + b, 0) / e;
    const x0 = x.slice(0, e).reduce((a, b) => a + b, 0) / e;
    const x1 = x.slice(-e).reduce((a, b) => a + b, 0) / e;
    const slope = (m1 - m0) / (x1 - x0 || 1);
    const base = x.map((xv) => m0 + slope * (xv - x0));
    return { y: y.map((v, i) => v - base[i]), baseline: base, description: `linear baseline through first/last ${e}-point means` };
  }
  if (method === 'rolling') {
    let w = Math.max(3, window | 0); if (w % 2 === 0) w += 1;
    if (w >= y.length) throw new Error('Baseline window must be smaller than the signal length.');
    const h = (w - 1) / 2;
    const erode = (arr, f) => arr.map((_, i) => {
      let m = arr[i];
      for (let j = Math.max(0, i - h); j <= Math.min(arr.length - 1, i + h); j++) m = f(m, arr[j]);
      return m;
    });
    let base = erode(y, Math.min);          // erosion
    base = erode(base, Math.max);           // dilation → morphological opening
    base = movingAverage(base, Math.min(w, 2 * h + 1)).y; // light smoothing
    // baseline must never exceed the signal
    base = base.map((b, i) => Math.min(b, y[i]));
    return { y: y.map((v, i) => v - base[i]), baseline: base, description: `rolling-minimum (morphological) baseline, window ${w} points` };
  }
  throw new Error(`Unknown baseline method "${method}".`);
}
