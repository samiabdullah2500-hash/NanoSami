/**
 * NanoSami — signal processing helpers (smoothing, baseline, normalize, offset).
 * Pure functions. All methods are documented with assumptions.
 */

export function smoothMovingAverage(y, window = 5) {
  if (!Array.isArray(y) || y.length < 3) return y.slice();
  let w = Math.max(3, Math.floor(window));
  if (w % 2 === 0) w += 1;
  const half = Math.floor(w / 2);
  const out = new Array(y.length);
  for (let i = 0; i < y.length; i++) {
    let sum = 0, n = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < y.length) { sum += y[j]; n++; }
    }
    out[i] = sum / n;
  }
  return out;
}

export function linearBaseline(y, i0 = 0, i1 = null) {
  const n = y.length;
  if (i1 == null) i1 = n - 1;
  i0 = Math.max(0, Math.min(n - 1, i0));
  i1 = Math.max(0, Math.min(n - 1, i1));
  if (i0 === i1) return y.map(() => y[i0]);
  const y0 = y[i0], y1 = y[i1];
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = (i - i0) / (i1 - i0);
    out[i] = y0 + t * (y1 - y0);
  }
  return out;
}

export function subtractBaseline(y, baseline) {
  return y.map((v, i) => v - baseline[i]);
}

/** Lightweight ALS-style baseline approximation (educational). */
export function baselineALSLite(y, { lambda = 1e5, p = 0.01, nIter = 6 } = {}) {
  let z = y.slice();
  const n = y.length;
  for (let iter = 0; iter < nIter; iter++) {
    z = smoothMovingAverage(z, Math.min(51, Math.max(5, Math.floor(n / 40))));
    for (let i = 0; i < n; i++) {
      if (z[i] > y[i]) z[i] = p * y[i] + (1 - p) * z[i];
      else z[i] = (1 - p) * y[i] + p * z[i];
    }
  }
  return smoothMovingAverage(z, 7);
}

export function normalizeMinMax(y) {
  const lo = Math.min(...y), hi = Math.max(...y);
  const span = hi - lo || 1;
  return y.map((v) => (v - lo) / span);
}

export function normalizeMax(y) {
  const hi = Math.max(...y.map(Math.abs)) || 1;
  return y.map((v) => v / hi);
}

export function addOffset(y, offset = 0) {
  return y.map((v) => v + offset);
}

/** Half-max FWHM with local baseline estimate. */
export function estimateFWHM(x, s, peakIdx) {
  if (peakIdx <= 0 || peakIdx >= s.length - 1) return { fwhmX: null, leftX: null, rightX: null, half: null };
  const peakVal = s[peakIdx];
  const w = Math.max(8, Math.floor(s.length / 40));
  let base = peakVal;
  for (let j = Math.max(0, peakIdx - w * 4); j <= Math.min(s.length - 1, peakIdx + w * 4); j++) {
    if (Math.abs(j - peakIdx) > w) base = Math.min(base, s[j]);
  }
  if (!(peakVal - base > 0)) base = Math.min(...s);
  const half = base + (peakVal - base) / 2;
  let leftX = null;
  for (let j = peakIdx; j > 0; j--) {
    if (s[j] >= half && s[j - 1] < half) {
      const t = (half - s[j - 1]) / (s[j] - s[j - 1] || 1e-12);
      leftX = x[j - 1] + t * (x[j] - x[j - 1]);
      break;
    }
  }
  let rightX = null;
  for (let j = peakIdx; j < s.length - 1; j++) {
    if (s[j] >= half && s[j + 1] < half) {
      const t = (half - s[j]) / (s[j + 1] - s[j] || 1e-12);
      rightX = x[j] + t * (x[j + 1] - x[j]);
      break;
    }
  }
  if (leftX == null || rightX == null) return { fwhmX: null, leftX, rightX, half };
  return { fwhmX: Math.abs(rightX - leftX), leftX, rightX, half };
}

export function applyChain(x, y, chain = []) {
  let yy = y.slice();
  const steps = [];
  for (const step of chain) {
    switch (step.op) {
      case 'smooth':
        yy = smoothMovingAverage(yy, step.window ?? 5);
        steps.push(`Smooth (moving average, window=${step.window ?? 5})`);
        break;
      case 'baseline_linear': {
        const bl = linearBaseline(yy, step.i0 ?? 0, step.i1 ?? (yy.length - 1));
        yy = subtractBaseline(yy, bl);
        steps.push('Linear baseline subtraction');
        break;
      }
      case 'baseline_als': {
        const bl = baselineALSLite(yy, { lambda: step.lambda, p: step.p, nIter: step.nIter });
        yy = subtractBaseline(yy, bl);
        steps.push('Baseline correction (ALS-lite approximation)');
        break;
      }
      case 'normalize_minmax':
        yy = normalizeMinMax(yy);
        steps.push('Min–max normalization to [0, 1]');
        break;
      case 'normalize_max':
        yy = normalizeMax(yy);
        steps.push('Max normalization (peak = 1)');
        break;
      case 'offset':
        yy = addOffset(yy, step.value ?? 0);
        steps.push(`Offset +${step.value ?? 0}`);
        break;
      default:
        steps.push(`Unknown op skipped: ${step.op}`);
    }
  }
  return { x: x.slice(), y: yy, steps };
}
