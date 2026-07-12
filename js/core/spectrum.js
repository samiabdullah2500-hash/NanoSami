/**
 * NanoSami — FTIR spectrum parsing and peak detection.
 *
 * Scientific notes:
 * - Absorbance spectra: absorption bands are LOCAL MAXIMA.
 * - Transmittance spectra: absorption bands are LOCAL MINIMA. We detect peaks
 *   on the inverted signal so the same prominence-based algorithm applies.
 * - Peak detection uses topographic prominence (relative to the signal span),
 *   not a naive threshold, so baseline offset does not create false peaks.
 */

/**
 * Parse delimited text (CSV / TSV / semicolon / whitespace, pasted or file).
 * Returns { x, y, mode, warnings } where mode is 'absorbance'|'transmittance'.
 */
export function parseSpectrumText(text, { mode = 'auto' } = {}) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error('The file or pasted text is empty.');
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trim()).filter((l) => l !== '');
  const warnings = [];
  const rows = [];
  let headerMode = null;

  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('//')) continue;
    const parts = line.split(/[,;\t]+|\s{1,}/).map((p) => p.trim()).filter((p) => p !== '');
    if (parts.length < 2) continue;
    const a = Number(parts[0]), b = Number(parts[1]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      rows.push([a, b]);
    } else {
      // Possible header row — try to detect the y-column meaning.
      const joined = line.toLowerCase();
      if (/trans/.test(joined)) headerMode = 'transmittance';
      else if (/abs/.test(joined)) headerMode = 'absorbance';
      else if (rows.length > 0) warnings.push(`Skipped non-numeric line: "${line.slice(0, 40)}"`);
    }
  }

  if (rows.length === 0) throw new Error('No numeric data rows found. Expected two columns: wavenumber and absorbance/transmittance.');
  if (rows.length < 10) warnings.push('Fewer than 10 data points — peak detection will be unreliable.');

  // Sort by ascending wavenumber internally (plotting reverses the axis).
  rows.sort((r1, r2) => r1[0] - r2[0]);
  const x = rows.map((r) => r[0]);
  const y = rows.map((r) => r[1]);

  // Deduplicate identical x values (keep mean y).
  const xs = [], ys = [];
  for (let i = 0; i < x.length; i++) {
    if (xs.length && x[i] === xs[xs.length - 1]) {
      ys[ys.length - 1] = (ys[ys.length - 1] + y[i]) / 2;
    } else { xs.push(x[i]); ys.push(y[i]); }
  }

  // Mode detection
  let detected = mode;
  if (mode === 'auto') {
    if (headerMode) detected = headerMode;
    else {
      const maxY = Math.max(...ys), minY = Math.min(...ys);
      // Transmittance is typically 0–100 % (or 0–1) with most values NEAR THE TOP.
      const median = [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)];
      const nearTop = (median - minY) / (maxY - minY || 1) > 0.6;
      if (maxY > 5 && maxY <= 110 && nearTop) detected = 'transmittance';
      else detected = 'absorbance';
      warnings.push(`Y-axis mode auto-detected as ${detected} — verify and switch manually if wrong.`);
    }
  }

  if (xs[0] < 0) warnings.push('Negative wavenumbers found — check the column order.');
  if (xs[xs.length - 1] < 100) warnings.push('All wavenumbers are below 100 cm⁻¹ — the columns may be swapped (expected: wavenumber first, intensity second).');
  return { x: xs, y: ys, mode: detected, warnings };
}

/**
 * Prominence-based peak detection.
 * @param {number[]} x wavenumbers ascending
 * @param {number[]} y intensities
 * @param {object} opt
 * @param {'absorbance'|'transmittance'} opt.mode
 * @param {number} [opt.sensitivity] 0–1; higher = more peaks. Maps to a
 *        prominence threshold of (1 − sensitivity) × 30% of signal span.
 * @param {number} [opt.minDistance] minimum separation in cm⁻¹ (default 12)
 * @returns [{wavenumber, value, prominence}] sorted by descending prominence
 */
export function detectPeaks(x, y, { mode = 'absorbance', sensitivity = 0.5, minDistance = 12 } = {}) {
  if (!Array.isArray(x) || !Array.isArray(y) || x.length !== y.length || x.length < 5) {
    throw new Error('Need at least 5 aligned (x, y) points for peak detection.');
  }
  if (sensitivity < 0 || sensitivity > 1) throw new Error('Sensitivity must be between 0 and 1.');

  // Work on a signal where absorption bands are maxima.
  const sig = mode === 'transmittance' ? y.map((v) => -v) : y.slice();

  // Light smoothing (3-point moving average) to suppress single-point noise.
  const s = sig.map((v, i) => {
    const a = sig[Math.max(0, i - 1)], c = sig[Math.min(sig.length - 1, i + 1)];
    return (a + v + c) / 3;
  });

  const span = Math.max(...s) - Math.min(...s);
  if (span === 0) return [];
  const minProm = (1 - sensitivity) * 0.3 * span + 0.01 * span;

  // Local maxima
  const candidates = [];
  for (let i = 1; i < s.length - 1; i++) {
    if (s[i] > s[i - 1] && s[i] >= s[i + 1]) candidates.push(i);
  }

  // Topographic prominence
  const peaks = [];
  for (const i of candidates) {
    let leftMin = s[i], rightMin = s[i];
    for (let j = i - 1; j >= 0; j--) { if (s[j] > s[i]) break; leftMin = Math.min(leftMin, s[j]); }
    for (let j = i + 1; j < s.length; j++) { if (s[j] > s[i]) break; rightMin = Math.min(rightMin, s[j]); }
    const prom = s[i] - Math.max(leftMin, rightMin);
    if (prom >= minProm) peaks.push({ idx: i, prominence: prom });
  }

  // Enforce minimum distance in cm⁻¹, keeping the most prominent peak.
  peaks.sort((a, b) => b.prominence - a.prominence);
  const kept = [];
  for (const p of peaks) {
    if (kept.every((k) => Math.abs(x[k.idx] - x[p.idx]) >= minDistance)) kept.push(p);
  }

  return kept.map((p) => ({
    wavenumber: x[p.idx],
    value: y[p.idx],                 // report the ORIGINAL y value
    prominence: p.prominence,
  })).sort((a, b) => b.prominence - a.prominence);
}
