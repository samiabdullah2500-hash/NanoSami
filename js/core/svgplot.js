/**
 * NanoSami — publication-oriented SVG plot generator (v0.4.0).
 * Pure string generation (no DOM), so it runs in Node tests, renders inline in
 * the browser, and the SVG export is TRUE vector output (what you see is what
 * you export). PNG export rasterizes this same SVG in the browser at a stated
 * pixel size — no fabricated "600 dpi" claims.
 */

const escXml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SERIES_COLORS = ['#0e7c86', '#c2571a', '#5b5ea6', '#2e7d32', '#ad1457', '#6d4c41', '#0277bd', '#9e9d24'];

function niceTicks(lo, hi, n = 6) {
  if (!(hi > lo)) return [lo];
  const span = hi - lo;
  const step0 = span / Math.max(1, n);
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || 10 * mag;
  const start = Math.ceil(lo / step) * step;
  const out = [];
  for (let v = start; v <= hi + 1e-9 * span; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : v);
  return out;
}
function logTicks(lo, hi) {
  const out = [];
  for (let e = Math.ceil(Math.log10(lo)); Math.pow(10, e) <= hi * (1 + 1e-9); e++) out.push(Math.pow(10, e));
  return out.length ? out : [lo, hi];
}
const fmt = (v) => {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(1).replace('e+', 'e');
  return Number(v.toPrecision(4)).toString();
};

/**
 * Render a plot specification to an SVG string.
 * @param {object} spec
 * @param {{name:string,x:number[],y:number[],color?:string}[]} spec.series
 * @param {{x:number,y:number,label?:string,series?:number}[]} [spec.peakMarkers]
 * @param {string} [spec.title]
 * @param {string} [spec.xLabel] , [spec.yLabel]
 * @param {boolean} [spec.reverseX]  e.g. FTIR convention
 * @param {'linear'|'log'} [spec.xScale] , [spec.yScale]
 * @param {[number,number]|null} [spec.xRange] , [spec.yRange] manual ranges
 * @param {number} [spec.width=760] , [spec.height=440]
 * @param {boolean} [spec.legend=true]
 * @returns {{svg:string, warnings:string[]}}
 */
export function renderPlotSVG(spec) {
  const {
    series, peakMarkers = [], title = '', xLabel = '', yLabel = '',
    reverseX = false, xScale = 'linear', yScale = 'linear',
    xRange = null, yRange = null, width = 760, height = 440, legend = true,
  } = spec;
  if (!Array.isArray(series) || !series.length) throw new Error('At least one data series is required.');
  const warnings = [];

  // effective data per scale (log scales drop non-positive values, reported)
  const eff = series.map((s) => {
    if (!Array.isArray(s.x) || !Array.isArray(s.y) || s.x.length !== s.y.length || s.x.length < 2) {
      throw new Error(`Series "${s.name || '?'}" needs at least 2 aligned points.`);
    }
    let x = s.x, y = s.y, dropped = 0;
    if (xScale === 'log' || yScale === 'log') {
      const xs = [], ys = [];
      for (let i = 0; i < x.length; i++) {
        if ((xScale === 'log' && !(x[i] > 0)) || (yScale === 'log' && !(y[i] > 0))) { dropped++; continue; }
        xs.push(x[i]); ys.push(y[i]);
      }
      x = xs; y = ys;
    }
    if (dropped) warnings.push(`Series "${s.name}": ${dropped} non-positive point(s) omitted on the log scale.`);
    if (x.length < 2) throw new Error(`Series "${s.name}" has fewer than 2 plottable points on the chosen scale.`);
    return { ...s, x, y };
  });

  let xmin = xRange ? xRange[0] : Math.min(...eff.map((s) => Math.min(...s.x)));
  let xmax = xRange ? xRange[1] : Math.max(...eff.map((s) => Math.max(...s.x)));
  let ymin = yRange ? yRange[0] : Math.min(...eff.map((s) => Math.min(...s.y)));
  let ymax = yRange ? yRange[1] : Math.max(...eff.map((s) => Math.max(...s.y)));
  if (!(xmax > xmin)) { xmax = xmin + 1; }
  if (!(ymax > ymin)) { ymax = ymin + 1; }
  if (xScale === 'log' && !(xmin > 0)) throw new Error('Log x-scale requires positive x range.');
  if (yScale === 'log' && !(ymin > 0)) throw new Error('Log y-scale requires positive y range.');
  if (!yRange && yScale === 'linear') { const pad = 0.05 * (ymax - ymin); ymin -= pad; ymax += pad; }

  const padL = 64, padR = 16, padT = title ? 34 : 16, padB = 52;
  const legendH = legend && eff.length > 1 ? 20 : 0;
  const W = width, H = height;
  const plotW = W - padL - padR, plotH = H - padT - padB - legendH;

  const tx = (v) => {
    const t = xScale === 'log' ? (Math.log10(v) - Math.log10(xmin)) / (Math.log10(xmax) - Math.log10(xmin))
      : (v - xmin) / (xmax - xmin);
    return padL + (reverseX ? 1 - t : t) * plotW;
  };
  const ty = (v) => {
    const t = yScale === 'log' ? (Math.log10(v) - Math.log10(ymin)) / (Math.log10(ymax) - Math.log10(ymin))
      : (v - ymin) / (ymax - ymin);
    return padT + (1 - t) * plotH;
  };

  const xt = xScale === 'log' ? logTicks(xmin, xmax) : niceTicks(xmin, xmax, 7);
  const yt = yScale === 'log' ? logTicks(ymin, ymax) : niceTicks(ymin, ymax, 6);

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`);
  if (title) parts.push(`<text x="${W / 2}" y="20" text-anchor="middle" font-size="14" fill="#1a1a1a">${escXml(title)}</text>`);

  // grid + ticks
  for (const v of xt) {
    if (v < Math.min(xmin, xmax) || v > Math.max(xmin, xmax)) continue;
    const X = tx(v);
    parts.push(`<line x1="${X.toFixed(1)}" y1="${padT}" x2="${X.toFixed(1)}" y2="${padT + plotH}" stroke="#e3e6e8" stroke-width="1"/>`);
    parts.push(`<text x="${X.toFixed(1)}" y="${padT + plotH + 16}" text-anchor="middle" font-size="10" fill="#444">${escXml(fmt(v))}</text>`);
  }
  for (const v of yt) {
    if (v < ymin || v > ymax) continue;
    const Y = ty(v);
    parts.push(`<line x1="${padL}" y1="${Y.toFixed(1)}" x2="${padL + plotW}" y2="${Y.toFixed(1)}" stroke="#e3e6e8" stroke-width="1"/>`);
    parts.push(`<text x="${padL - 6}" y="${(Y + 3).toFixed(1)}" text-anchor="end" font-size="10" fill="#444">${escXml(fmt(v))}</text>`);
  }
  // frame
  parts.push(`<rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}" fill="none" stroke="#606468" stroke-width="1"/>`);
  // axis labels
  if (xLabel) parts.push(`<text x="${padL + plotW / 2}" y="${padT + plotH + 36}" text-anchor="middle" font-size="12" fill="#1a1a1a">${escXml(xLabel)}${reverseX ? '  ⟵' : ''}</text>`);
  if (yLabel) parts.push(`<text transform="translate(16 ${padT + plotH / 2}) rotate(-90)" text-anchor="middle" font-size="12" fill="#1a1a1a">${escXml(yLabel)}</text>`);

  // clip traces to the plot area
  parts.push(`<clipPath id="plotArea"><rect x="${padL}" y="${padT}" width="${plotW}" height="${plotH}"/></clipPath>`);
  parts.push(`<g clip-path="url(#plotArea)">`);
  eff.forEach((s, si) => {
    const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
    let d = '';
    for (let i = 0; i < s.x.length; i++) d += `${i ? 'L' : 'M'}${tx(s.x[i]).toFixed(2)} ${ty(s.y[i]).toFixed(2)}`;
    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`);
  });
  // peak markers
  for (const m of peakMarkers) {
    const color = SERIES_COLORS[(m.series || 0) % SERIES_COLORS.length];
    const X = tx(m.x), Y = ty(m.y);
    parts.push(`<line x1="${X.toFixed(1)}" y1="${(Y - 6).toFixed(1)}" x2="${X.toFixed(1)}" y2="${(Y - 16).toFixed(1)}" stroke="${color}" stroke-width="1"/>`);
    if (m.label) parts.push(`<text x="${X.toFixed(1)}" y="${(Y - 19).toFixed(1)}" text-anchor="middle" font-size="9" fill="${color}">${escXml(m.label)}</text>`);
  }
  parts.push(`</g>`);

  // legend
  if (legend && eff.length > 1) {
    let lx = padL;
    const ly = H - 12;
    eff.forEach((s, si) => {
      const color = s.color || SERIES_COLORS[si % SERIES_COLORS.length];
      parts.push(`<line x1="${lx}" y1="${ly - 4}" x2="${lx + 18}" y2="${ly - 4}" stroke="${color}" stroke-width="2"/>`);
      const label = escXml(s.name || `Series ${si + 1}`);
      parts.push(`<text x="${lx + 22}" y="${ly}" font-size="10" fill="#1a1a1a">${label}</text>`);
      lx += 22 + 7 * String(s.name || 'Series 0').length + 16;
    });
  }
  parts.push('</svg>');
  return { svg: parts.join('\n'), warnings };
}
