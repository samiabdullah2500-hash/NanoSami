/**
 * NanoSami — multi-dataset scientific plotting (canvas).
 * Zero external chart libraries — offline footprint small; PNG via canvas.toDataURL.
 */

function cssVar(name, el = document.documentElement) {
  return getComputedStyle(el).getPropertyValue(name).trim() || '#333';
}

const PALETTE = [
  '#0e7c86', '#c45c26', '#2f6fed', '#8b5cf6', '#059669',
  '#db2777', '#ca8a04', '#64748b',
];

export function plotMulti(canvas, {
  series = [], title = '', xLabel = '', yLabel = '', reverseX = false,
  markers = [], range = {}, showLegend = true, grid = true,
} = {}) {
  if (!canvas) return;
  const dpr = (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) || 1;
  const W = canvas.clientWidth || 640;
  const H = canvas.clientHeight || 360;
  canvas.width = Math.max(1, Math.floor(W * dpr));
  canvas.height = Math.max(1, Math.floor(H * dpr));
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = cssVar('--card') || '#fff';
  ctx.fillRect(0, 0, W, H);

  if (!series.length || !series.some((s) => s.x?.length)) {
    ctx.fillStyle = cssVar('--ink-2') || '#888';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data to plot', W / 2, H / 2);
    return;
  }

  let xmin = range.xMin, xmax = range.xMax, ymin = range.yMin, ymax = range.yMax;
  if (xmin == null || xmax == null || ymin == null || ymax == null) {
    let xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
    for (const s of series) {
      for (let i = 0; i < s.x.length; i++) {
        const xv = s.x[i], yv = s.y[i];
        if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
        if (xv < xa) xa = xv; if (xv > xb) xb = xv;
        if (yv < ya) ya = yv; if (yv > yb) yb = yv;
      }
    }
    if (xmin == null) xmin = xa;
    if (xmax == null) xmax = xb;
    if (ymin == null) ymin = ya;
    if (ymax == null) ymax = yb;
  }
  if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || xmin === xmax) {
    xmin = (xmin || 0) - 1; xmax = (xmax || 0) + 1;
  }
  if (!Number.isFinite(ymin) || !Number.isFinite(ymax) || ymin === ymax) {
    ymin = (ymin || 0) - 1; ymax = (ymax || 0) + 1;
  }
  const ypad = (ymax - ymin) * 0.06 || 0.1;
  ymin -= ypad; ymax += ypad;

  const padL = 56, padR = showLegend ? 120 : 16, padT = title ? 28 : 12, padB = 40;
  const px = (v) => {
    const t = (v - xmin) / (xmax - xmin || 1);
    return padL + (reverseX ? 1 - t : t) * (W - padL - padR);
  };
  const py = (v) => padT + (1 - (v - ymin) / (ymax - ymin || 1)) * (H - padT - padB);

  ctx.strokeStyle = cssVar('--grid') || '#e5e7eb';
  ctx.fillStyle = cssVar('--ink-2') || '#6b7280';
  ctx.lineWidth = 1;
  ctx.font = `10px ${cssVar('--mono') || 'ui-monospace, monospace'}`;
  const nTx = 6, nTy = 5;
  for (let i = 0; i <= nTx; i++) {
    const v = xmin + (i / nTx) * (xmax - xmin);
    const X = px(v);
    if (grid) { ctx.beginPath(); ctx.moveTo(X, padT); ctx.lineTo(X, H - padB); ctx.stroke(); }
    ctx.textAlign = 'center';
    ctx.fillText(formatTick(v), X, H - padB + 14);
  }
  for (let i = 0; i <= nTy; i++) {
    const v = ymin + (i / nTy) * (ymax - ymin);
    const Y = py(v);
    if (grid) { ctx.beginPath(); ctx.moveTo(padL, Y); ctx.lineTo(W - padR, Y); ctx.stroke(); }
    ctx.textAlign = 'right';
    ctx.fillText(formatTick(v), padL - 6, Y + 3);
  }

  ctx.fillStyle = cssVar('--ink') || '#111';
  ctx.font = `11px ${cssVar('--sans') || 'system-ui, sans-serif'}`;
  ctx.textAlign = 'center';
  if (xLabel) ctx.fillText(xLabel + (reverseX ? '  ⟵' : ''), padL + (W - padL - padR) / 2, H - 8);
  if (yLabel) {
    ctx.save();
    ctx.translate(14, padT + (H - padT - padB) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();
  }
  if (title) {
    ctx.font = `600 13px ${cssVar('--sans') || 'system-ui, sans-serif'}`;
    ctx.textAlign = 'left';
    ctx.fillText(title, padL, 18);
  }

  series.forEach((s, si) => {
    const color = s.color || PALETTE[si % PALETTE.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = s.lineWidth || 1.6;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < s.x.length; i++) {
      const xv = s.x[i], yv = s.y[i];
      if (!Number.isFinite(xv) || !Number.isFinite(yv)) continue;
      const X = px(xv), Y = py(yv);
      if (!started) { ctx.moveTo(X, Y); started = true; }
      else ctx.lineTo(X, Y);
    }
    ctx.stroke();
  });

  for (const m of markers) {
    if (!Number.isFinite(m.x) || !Number.isFinite(m.y)) continue;
    const X = px(m.x), Y = py(m.y);
    ctx.fillStyle = m.color || cssVar('--warn') || '#c45c26';
    ctx.beginPath();
    ctx.arc(X, Y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    if (m.label) {
      ctx.font = `9px ${cssVar('--mono') || 'monospace'}`;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, X, Y - 8);
    }
  }

  if (showLegend && series.length) {
    let ly = padT + 4;
    ctx.font = `11px ${cssVar('--sans') || 'system-ui'}`;
    series.forEach((s, si) => {
      const color = s.color || PALETTE[si % PALETTE.length];
      const lx = W - padR + 10;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 16, ly);
      ctx.stroke();
      ctx.fillStyle = cssVar('--ink') || '#111';
      ctx.textAlign = 'left';
      ctx.fillText(s.name || `Series ${si + 1}`, lx + 20, ly + 3);
      ly += 16;
    });
  }
}

function formatTick(v) {
  const a = Math.abs(v);
  if (a === 0) return '0';
  if (a >= 1000 || (a < 0.01 && a > 0)) return v.toPrecision(3);
  if (a >= 100) return String(Math.round(v));
  if (a >= 10) return v.toFixed(1);
  return v.toPrecision(3);
}

export function canvasPngDataURL(canvas) {
  return canvas.toDataURL('image/png');
}

export { PALETTE };
