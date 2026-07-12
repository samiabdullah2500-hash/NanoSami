/* NanoSami — Scientific Plotting Studio (v0.4.0).
 * Upload → understand columns → process → plot → export.
 * Processing is non-destructive: raw imported data are kept and the enabled
 * steps are re-applied in a fixed, documented order on every refresh:
 *   smoothing → baseline → normalize → offset(stack). Every applied step is
 * recorded in the exportable Analysis Recipe.
 */
import { mountImporter } from './importer.js';
import { mountAiPanel } from './ai_panel.js';
import { $, esc, downloadText, downloadBase64, noticeHtml } from './util.js';
import { normalize, movingAverage, savitzkyGolay, baseline } from '../core/processing.js';
import { findPeaks } from '../core/peaks.js';
import { renderPlotSVG, SERIES_COLORS } from '../core/svgplot.js';
import { createRecipe, setSource, setImport, addStep, setAnalysis, serializeRecipe } from '../core/recipe.js';
import { buildAnalysisContext } from '../core/ai_context.js';

export const APP_VERSION = '0.4.0';

const st = {
  datasets: [],      // {name, x, y, source, importMap, visible:true}
  opts: {
    smoothing: 'none', maWindow: 5, sgWindow: 7, sgOrder: 2,
    baseline: 'none', blEdge: 5, blWindow: 51,
    normalize: 'none', stackOffset: 0,
    detectPeaks: false, prominence: 0.08, minDistanceX: 0, peakLabels: true,
    xLabel: 'x', yLabel: 'y', title: '', reverseX: false,
    xScale: 'linear', yScale: 'linear', xMin: '', xMax: '', yMin: '', yMax: '',
  },
  lastWarnings: [], lastPeaks: [], lastSvg: '',
};

function processSeries(s, index) {
  const o = st.opts;
  let x = s.x.slice(), y = s.y.slice();
  const applied = [];
  try {
    if (o.smoothing === 'ma') { const r = movingAverage(y, o.maWindow); y = r.y; applied.push(r.description); }
    if (o.smoothing === 'sg') { const r = savitzkyGolay(x, y, { window: o.sgWindow, order: o.sgOrder }); y = r.y; applied.push(r.description); (r.warnings || []).forEach((w) => st.lastWarnings.push(`${s.name}: ${w}`)); }
    if (o.baseline !== 'none') { const r = baseline(x, y, { method: o.baseline, edge: o.blEdge, window: o.blWindow }); y = r.y; applied.push(r.description); }
    if (o.normalize !== 'none') { const r = normalize(x, y, o.normalize); y = r.y; applied.push(r.description); }
    if (o.stackOffset) { const off = o.stackOffset * index; y = y.map((v) => v + off); applied.push(`stack offset +${off}`); }
  } catch (e) {
    st.lastWarnings.push(`${s.name}: ${e.message}`);
  }
  return { x, y, applied };
}

function refresh() {
  st.lastWarnings = [];
  st.lastPeaks = [];
  const visible = st.datasets.filter((d) => d.visible);
  const plotEl = $('#ps-plot');
  const warnEl = $('#ps-warn');
  if (!visible.length) {
    plotEl.innerHTML = '<div class="notice info">Import at least one dataset to plot.</div>';
    warnEl.innerHTML = '';
    $('#ps-peaktable').innerHTML = '';
    return;
  }
  const o = st.opts;
  const series = visible.map((d, i) => {
    const p = processSeries(d, i);
    d._proc = p;
    return { name: d.name, x: p.x, y: p.y };
  });
  const peakMarkers = [];
  if (o.detectPeaks) {
    series.forEach((s, si) => {
      try {
        const { peaks } = findPeaks(s.x, s.y, { minProminenceFrac: o.prominence, minDistanceX: o.minDistanceX || 0 });
        peaks.forEach((p) => {
          st.lastPeaks.push({ series: s.name, ...p });
          peakMarkers.push({ x: p.x, y: p.y, series: si, label: o.peakLabels ? p.x.toPrecision(5) : '' });
        });
      } catch (e) { st.lastWarnings.push(`${s.name}: ${e.message}`); }
    });
  }
  const num = (v) => (v === '' || v === null ? null : +v);
  const xr = num(o.xMin) !== null && num(o.xMax) !== null ? [num(o.xMin), num(o.xMax)] : null;
  const yr = num(o.yMin) !== null && num(o.yMax) !== null ? [num(o.yMin), num(o.yMax)] : null;
  try {
    const { svg, warnings } = renderPlotSVG({
      series, peakMarkers, title: o.title, xLabel: o.xLabel, yLabel: o.yLabel,
      reverseX: o.reverseX, xScale: o.xScale, yScale: o.yScale, xRange: xr, yRange: yr,
    });
    st.lastSvg = svg;
    plotEl.innerHTML = svg;
    st.lastWarnings.push(...warnings);
  } catch (e) { plotEl.innerHTML = `<div class="notice">${esc(e.message)}</div>`; st.lastSvg = ''; }
  warnEl.innerHTML = noticeHtml(st.lastWarnings, 'info');
  $('#ps-peaktable').innerHTML = st.lastPeaks.length ? `
    <h2>Detected peaks <span class="badge possible">preliminary</span></h2>
    <table><thead><tr><th>Series</th><th>x</th><th>y</th><th>Prominence</th><th>FWHM (x units)</th></tr></thead>
    <tbody>${st.lastPeaks.map((p) => `<tr><td>${esc(p.series)}</td><td>${p.x.toPrecision(6)}</td><td>${p.y.toPrecision(5)}</td><td>${p.prominence.toPrecision(4)}</td><td>${p.fwhm !== null ? p.fwhm.toPrecision(4) : '—'}${p.fwhmNote ? ` <span class="footnote">${esc(p.fwhmNote)}</span>` : ''}</td></tr>`).join('')}</tbody></table>` : '';
  renderDatasetList();
}

function renderDatasetList() {
  const el = $('#ps-datasets');
  el.innerHTML = st.datasets.length ? `<table><thead><tr><th>Show</th><th>Series name</th><th>Points</th><th>Source</th><th></th></tr></thead><tbody>
    ${st.datasets.map((d, i) => `<tr>
      <td><input type="checkbox" data-i="${i}" data-act="vis" ${d.visible ? 'checked' : ''}></td>
      <td><input data-i="${i}" data-act="name" value="${esc(d.name)}" style="min-width:8rem"></td>
      <td>${d.x.length}</td>
      <td class="footnote">${esc(d.source?.fileName || '')}${d.source?.sheet ? ` / ${esc(d.source.sheet)}` : ''}</td>
      <td><button class="btn secondary" data-i="${i}" data-act="rm">Remove</button></td></tr>`).join('')}
  </tbody></table>` : '';
}

function buildRecipe() {
  const r = createRecipe({ appVersion: APP_VERSION, analysisType: 'plotting-studio' });
  const first = st.datasets[0];
  if (first) { setSource(r, first.source || {}); setImport(r, first.importMap || {}); }
  r.datasets = st.datasets.map((d) => ({ name: d.name, points: d.x.length, source: d.source, importMap: d.importMap }));
  const o = st.opts;
  if (o.smoothing === 'ma') addStep(r, { op: 'smooth.movingAverage', params: { window: o.maWindow }, description: `moving-average smoothing (window ${o.maWindow})` });
  if (o.smoothing === 'sg') addStep(r, { op: 'smooth.savitzkyGolay', params: { window: o.sgWindow, order: o.sgOrder }, description: `Savitzky–Golay smoothing (window ${o.sgWindow}, order ${o.sgOrder})` });
  if (o.baseline !== 'none') addStep(r, { op: `baseline.${o.baseline}`, params: { edge: o.blEdge, window: o.blWindow }, description: `${o.baseline} baseline correction` });
  if (o.normalize !== 'none') addStep(r, { op: `normalize.${o.normalize}`, params: {}, description: `${o.normalize} normalization` });
  if (o.stackOffset) addStep(r, { op: 'offset.stack', params: { step: o.stackOffset }, description: `stacked with offset step ${o.stackOffset}` });
  setAnalysis(r, {
    peakDetection: o.detectPeaks ? { minProminenceFrac: o.prominence, minDistanceX: o.minDistanceX } : null,
    axes: { xLabel: o.xLabel, yLabel: o.yLabel, xScale: o.xScale, yScale: o.yScale, reverseX: o.reverseX },
  });
  if (st.lastPeaks.length) r.results = { peaks: st.lastPeaks.map((p) => ({ series: p.series, x: +p.x.toPrecision(7), y: +p.y.toPrecision(6), fwhm: p.fwhm !== null ? +p.fwhm.toPrecision(5) : null })) };
  return r;
}

function aiContext() {
  const o = st.opts;
  return buildAnalysisContext({
    analysisType: 'General x–y data plotting and peak inspection',
    appVersion: APP_VERSION,
    sampleName: st.datasets.map((d) => d.name).join(', ') || undefined,
    settings: {
      'smoothing': o.smoothing, 'baseline correction': o.baseline, 'normalization': o.normalize,
      'peak detection': o.detectPeaks ? `prominence ≥ ${o.prominence} × span` : 'off',
      'axes': `${o.xLabel} vs ${o.yLabel} (${o.xScale}/${o.yScale}${o.reverseX ? ', x reversed' : ''})`,
    },
    tables: st.lastPeaks.length ? [{
      origin: 'NanoSami-calculated peak table (preliminary)',
      columns: ['series', 'x', 'y', 'prominence', 'FWHM'],
      rows: st.lastPeaks.map((p) => [p.series, p.x.toPrecision(6), p.y.toPrecision(5), p.prominence.toPrecision(4), p.fwhm !== null ? p.fwhm.toPrecision(4) : null]),
    }] : [],
    limitations: [
      'Peak positions/FWHM are numerical estimates (half-prominence), not profile fits.',
      'Applied processing (smoothing/baseline/normalization) changes intensities — listed in Settings.',
      'No material identification has been performed in this view.',
    ],
  });
}

async function exportPng() {
  if (!st.lastSvg) return;
  const scale = 2;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([st.lastSvg], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('SVG rasterization failed')); img.src = url; });
  const c = document.createElement('canvas');
  c.width = img.width * scale; c.height = img.height * scale;
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const b64 = c.toDataURL('image/png').split(',')[1];
  await downloadBase64('nanosami_plot.png', b64, 'image/png');
}

function exportCsv() {
  const visible = st.datasets.filter((d) => d.visible);
  if (!visible.length) return;
  let out = `# NanoSami ${APP_VERSION} processed data export\n# processing: ${JSON.stringify(st.opts)}\n`;
  for (const d of visible) {
    const p = d._proc || { x: d.x, y: d.y };
    out += `\n# series: ${d.name}\nx,y\n` + p.x.map((xv, i) => `${xv},${p.y[i]}`).join('\n') + '\n';
  }
  downloadText('nanosami_processed_data.csv', out, 'text/csv');
}

export function plotStudioPage() {
  $('#main').innerHTML = `
    <h1>Plotting Studio</h1>
    <p class="footnote">Upload data → understand columns → choose processing → get a useful, exportable plot.
    Processing order (fixed): smoothing → baseline → normalization → stacking. Raw data are never modified.</p>
    <section class="card" id="ps-import"></section>
    <section class="card"><h2>Datasets</h2><div id="ps-datasets"></div><div class="footnote" id="ps-dshint">Imported series appear here — you can rename, hide or remove them, and import more files to overlay samples.</div></section>
    <section class="card">
      <h2>Plot &amp; processing</h2>
      <div class="row">
        <div><label>Title</label><input id="ps-title"></div>
        <div><label>X label / unit</label><input id="ps-xlabel" value="x"></div>
        <div><label>Y label / unit</label><input id="ps-ylabel" value="y"></div>
        <div><label>X scale</label><select id="ps-xscale"><option value="linear">linear</option><option value="log">log</option></select></div>
        <div><label>Y scale</label><select id="ps-yscale"><option value="linear">linear</option><option value="log">log</option></select></div>
        <div><label style="font-weight:400"><input type="checkbox" id="ps-revx"> Reverse X (FTIR convention)</label></div>
      </div>
      <div class="row">
        <div><label>X min</label><input id="ps-xmin" type="number" step="any" placeholder="auto"></div>
        <div><label>X max</label><input id="ps-xmax" type="number" step="any" placeholder="auto"></div>
        <div><label>Y min</label><input id="ps-ymin" type="number" step="any" placeholder="auto"></div>
        <div><label>Y max</label><input id="ps-ymax" type="number" step="any" placeholder="auto"></div>
      </div>
      <div class="row">
        <div><label>Smoothing</label><select id="ps-smooth"><option value="none">none</option><option value="ma">moving average</option><option value="sg">Savitzky–Golay</option></select></div>
        <div id="ps-smooth-ma" class="hide"><label>MA window (odd)</label><input id="ps-mawin" type="number" step="2" min="3" value="5"></div>
        <div id="ps-smooth-sg" class="hide"><label>SG window / order</label>
          <input id="ps-sgwin" type="number" step="2" min="5" value="7" style="width:5rem"> <input id="ps-sgord" type="number" min="1" value="2" style="width:4rem"></div>
        <div><label>Baseline</label><select id="ps-baseline"><option value="none">none</option><option value="linear">linear (endpoints)</option><option value="rolling">rolling minimum</option></select></div>
        <div id="ps-bl-roll" class="hide"><label>Baseline window (points)</label><input id="ps-blwin" type="number" min="5" value="51"></div>
        <div><label>Normalize</label><select id="ps-norm"><option value="none">none</option><option value="max">to max = 1</option><option value="minmax">min–max [0,1]</option><option value="area">unit area</option></select></div>
        <div><label>Stack offset (per series)</label><input id="ps-stack" type="number" step="any" value="0"></div>
      </div>
      <div class="row">
        <div><label style="font-weight:400"><input type="checkbox" id="ps-peaks"> Detect peaks</label></div>
        <div><label>Peak prominence (fraction of span): <span id="ps-prom-v" class="mono">0.08</span></label>
          <input id="ps-prom" type="range" min="0.01" max="0.5" step="0.01" value="0.08"></div>
        <div><label>Min. peak separation (x units, 0 = off)</label><input id="ps-mindist" type="number" step="any" min="0" value="0"></div>
        <div><label style="font-weight:400"><input type="checkbox" id="ps-plabels" checked> Peak labels</label></div>
      </div>
      <div id="ps-plot" class="plot-wrap" style="overflow-x:auto"></div>
      <div id="ps-warn" aria-live="polite"></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem">
        <button class="btn secondary" id="ps-exp-svg">Export SVG (vector)</button>
        <button class="btn secondary" id="ps-exp-png">Export PNG (2× pixels)</button>
        <button class="btn secondary" id="ps-exp-csv">Export processed data (CSV)</button>
        <button class="btn secondary" id="ps-exp-recipe">Export Analysis Recipe (JSON)</button>
      </div>
      <p class="footnote">SVG is true vector output (best for publications; convert to PDF/EPS in Inkscape or your office suite).
      PNG is a raster snapshot at twice the on-screen pixel size — no artificial DPI claims.</p>
    </section>
    <section class="card" id="ps-peaktable"></section>
    <section class="card" id="ps-ai"></section>`;

  mountImporter($('#ps-import'), {
    label: 'Import data (multiple files supported — import again to overlay)',
    onImport: ({ series, source, importMap }) => {
      for (const s of series) st.datasets.push({ name: s.name, x: s.x, y: s.y, source, importMap, visible: true });
      refresh();
    },
  });
  mountAiPanel($('#ps-ai'), aiContext);

  // restore option controls from state
  const o = st.opts;
  const bind = (sel, key, ev = 'change', map = (v) => v, set = null) => {
    const el = $(sel);
    if (set) set(el); else el.value = o[key];
    el.addEventListener(ev, () => { o[key] = map(el.type === 'checkbox' ? el.checked : el.value); syncVisibility(); refresh(); });
  };
  const syncVisibility = () => {
    $('#ps-smooth-ma').classList.toggle('hide', o.smoothing !== 'ma');
    $('#ps-smooth-sg').classList.toggle('hide', o.smoothing !== 'sg');
    $('#ps-bl-roll').classList.toggle('hide', o.baseline !== 'rolling');
    $('#ps-prom-v').textContent = (+o.prominence).toFixed(2);
  };
  bind('#ps-title', 'title', 'input');
  bind('#ps-xlabel', 'xLabel', 'input'); bind('#ps-ylabel', 'yLabel', 'input');
  bind('#ps-xscale', 'xScale'); bind('#ps-yscale', 'yScale');
  bind('#ps-revx', 'reverseX', 'change', Boolean, (el) => { el.checked = o.reverseX; });
  bind('#ps-xmin', 'xMin', 'change'); bind('#ps-xmax', 'xMax', 'change');
  bind('#ps-ymin', 'yMin', 'change'); bind('#ps-ymax', 'yMax', 'change');
  bind('#ps-smooth', 'smoothing');
  bind('#ps-mawin', 'maWindow', 'change', (v) => Math.max(3, parseInt(v, 10) | 1));
  bind('#ps-sgwin', 'sgWindow', 'change', (v) => Math.max(5, parseInt(v, 10) | 1));
  bind('#ps-sgord', 'sgOrder', 'change', (v) => Math.max(1, parseInt(v, 10)));
  bind('#ps-baseline', 'baseline');
  bind('#ps-blwin', 'blWindow', 'change', (v) => Math.max(5, parseInt(v, 10)));
  bind('#ps-norm', 'normalize');
  bind('#ps-stack', 'stackOffset', 'change', parseFloat);
  bind('#ps-peaks', 'detectPeaks', 'change', Boolean, (el) => { el.checked = o.detectPeaks; });
  bind('#ps-prom', 'prominence', 'input', parseFloat);
  bind('#ps-mindist', 'minDistanceX', 'change', (v) => Math.max(0, parseFloat(v) || 0));
  bind('#ps-plabels', 'peakLabels', 'change', Boolean, (el) => { el.checked = o.peakLabels; });
  syncVisibility();

  $('#ps-datasets').addEventListener('input', (e) => {
    const i = +e.target.dataset.i;
    if (e.target.dataset.act === 'name') { st.datasets[i].name = e.target.value; refreshPlotOnly(); }
    if (e.target.dataset.act === 'vis') { st.datasets[i].visible = e.target.checked; refresh(); }
  });
  function refreshPlotOnly() { refresh(); } // simple: full refresh keeps state consistent
  $('#ps-datasets').addEventListener('click', (e) => {
    if (e.target.dataset.act === 'rm') { st.datasets.splice(+e.target.dataset.i, 1); refresh(); }
  });
  $('#ps-exp-svg').addEventListener('click', () => st.lastSvg && downloadText('nanosami_plot.svg', st.lastSvg, 'image/svg+xml'));
  $('#ps-exp-png').addEventListener('click', () => exportPng().catch((e) => { $('#ps-warn').innerHTML = `<div class="notice">${esc(e.message)}</div>`; }));
  $('#ps-exp-csv').addEventListener('click', exportCsv);
  $('#ps-exp-recipe').addEventListener('click', () => downloadText('nanosami_recipe.json', serializeRecipe(buildRecipe()), 'application/json'));

  refresh();
}
