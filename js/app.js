/* NanoSami — application shell & module UIs.
 * All computation lives in js/core/*, all reference data in data/*.
 * Everything runs locally in the browser: no network calls, no tracking.
 */
import { scherrer, braggD, WAVELENGTHS } from './core/xrd.js';
import * as chem from './core/chem.js';
import { parseSpectrumText, detectPeaks } from './core/spectrum.js';
import { lookupWavenumber, matchMaterials, ALGORITHM_VERSION } from './core/matcher.js';
import FTIR_DICT from '../data/ftir_peaks.js';
import MATERIALS from '../data/materials_ftir.js';
import LIBRARY from '../data/nanomaterials.js';

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"' }[c]));
/* Platform-aware export.
 * Browser: normal Blob download. Android (Capacitor): Blob downloads fail
 * silently in WebViews, so we write to the app cache and open the system
 * share sheet instead (user can save to Files, Drive, email, etc.). */
async function download(filename, text, type = 'text/plain') {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    try {
      const res = await cap.Plugins.Filesystem.writeFile({
        path: filename, data: text, directory: 'CACHE', encoding: 'utf8',
      });
      await cap.Plugins.Share.share({ title: filename, url: res.uri });
      return;
    } catch (e) { console.warn('Native share failed, falling back', e); }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
const DISCLAIMER = 'NanoSami provides computational and educational assistance for materials characterization. Automated interpretations are preliminary and should be verified using appropriate reference data, complementary characterization techniques, and expert analysis.';

/* ---------------- state ---------------- */
const state = {
  spectrum: null,        // {x, y, mode, warnings}
  peaks: [],             // detected peaks
  sensitivity: 0.5,
  minDistance: 12,
  tolerance: 10,
  replot: null,
};

/* ---------------- theme ---------------- */
const themeBtn = $('#theme-toggle');
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === 'dark' ? '◑ Light mode' : '◐ Dark mode';
  themeBtn.setAttribute('aria-pressed', String(t === 'dark'));
}
let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
applyTheme(theme);
themeBtn.addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(theme); });

/* ---------------- navigation ---------------- */
const ROUTES = [
  { hash: '#/home', label: 'Home', glyph: '⌂' },
  { hash: '#/ftir', label: 'FTIR', glyph: 'ν̃' },
  { hash: '#/xrd', label: 'XRD', glyph: '2θ' },
  { hash: '#/calc', label: 'Calculators', glyph: 'Σ' },
  { hash: '#/library', label: 'Library', glyph: '▤' },
  { hash: '#/about', label: 'About', glyph: 'ⓘ' },
];
function renderNav() {
  const current = location.hash.split('?')[0] || '#/home';
  const mk = (r) => `<a class="nav-link ${current.startsWith(r.hash) ? 'active' : ''}" href="${r.hash}"><span class="glyph">${r.glyph}</span>${r.label}</a>`;
  $('#nav-desktop').innerHTML = ROUTES.map(mk).join('');
  $('#nav-mobile').innerHTML = ROUTES.map((r) =>
    `<a href="${r.hash}" class="${current.startsWith(r.hash) ? 'active' : ''}"><span class="glyph">${r.glyph}</span>${r.label}</a>`).join('');
}

/* ---------------- plotting ---------------- */
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
/** Draw a spectrum on canvas. FTIR convention: wavenumber DECREASES left→right. */
function plotSpectrum(canvas, x, y, { peaks = [], mode = 'absorbance', reverseX = true } = {}) {
  const dpr = devicePixelRatio || 1;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);
  const padL = 48, padR = 14, padT = 12, padB = 34;
  const xmin = Math.min(...x), xmax = Math.max(...x);
  const ymin = Math.min(...y), ymax = Math.max(...y);
  const yr = ymax - ymin || 1;
  const px = (v) => {
    const t = (v - xmin) / (xmax - xmin || 1);
    return padL + (reverseX ? 1 - t : t) * (W - padL - padR);
  };
  const py = (v) => padT + (1 - (v - ymin - 0.04 * yr) / (yr * 1.08)) * (H - padT - padB);

  // grid + x ticks
  ctx.strokeStyle = cssVar('--grid'); ctx.lineWidth = 1;
  ctx.fillStyle = cssVar('--ink-2'); ctx.font = `10px ${cssVar('--mono')}`;
  const nT = 6;
  for (let i = 0; i <= nT; i++) {
    const v = xmin + (i / nT) * (xmax - xmin);
    const X = px(v);
    ctx.beginPath(); ctx.moveTo(X, padT); ctx.lineTo(X, H - padB); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillText(Math.round(v), X, H - padB + 14);
  }
  for (let i = 0; i <= 4; i++) {
    const v = ymin + (i / 4) * yr, Y = py(v);
    ctx.beginPath(); ctx.moveTo(padL, Y); ctx.lineTo(W - padR, Y); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(v.toPrecision(3), padL - 5, Y + 3);
  }
  ctx.textAlign = 'center';
  ctx.fillText('Wavenumber (cm⁻¹)' + (reverseX ? '  ⟵' : ''), padL + (W - padL - padR) / 2, H - 6);
  ctx.save(); ctx.translate(11, padT + (H - padT - padB) / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(mode === 'transmittance' ? 'Transmittance' : 'Absorbance', 0, 0); ctx.restore();

  // trace
  ctx.strokeStyle = cssVar('--trace'); ctx.lineWidth = 1.6;
  ctx.beginPath();
  x.forEach((xv, i) => { const X = px(xv), Y = py(y[i]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
  ctx.stroke();

  // peaks
  ctx.fillStyle = cssVar('--warn');
  for (const p of peaks) {
    const X = px(p.wavenumber), Y = py(p.value);
    ctx.beginPath(); ctx.arc(X, Y, 3, 0, 7); ctx.fill();
    ctx.font = `9px ${cssVar('--mono')}`;
    ctx.fillText(Math.round(p.wavenumber), X, mode === 'transmittance' ? Y + 14 : Y - 7);
  }
}

/* Synthetic hero trace (clearly synthetic, drawn by the real engine). */
function heroSpectrum() {
  const x = [], y = [];
  const bands = [[3400, 260, .5], [2920, 40, .65], [2850, 35, .4], [1720, 45, .9], [1600, 30, .45], [1450, 35, .35], [1240, 45, .5], [1090, 55, .8], [800, 30, .3], [465, 25, .55]];
  for (let w = 4000; w >= 400; w -= 4) {
    let a = 0.03 + 0.012 * Math.sin(w / 90);
    for (const [c, s, h] of bands) a += h * Math.exp(-((w - c) ** 2) / (2 * s * s));
    x.push(w); y.push(a);
  }
  return { x: x.reverse(), y: y.reverse() };
}

/* ================= PAGES ================= */
const pages = {};

pages.home = () => {
  $('#main').innerHTML = `
    <section class="card hero">
      <div class="hero-tag">NANOSAMI · MATERIALS SCIENCE & NANOTECHNOLOGY TOOLKIT</div>
      <h1>Analyze. Calculate. Identify.<br>Explore nanomaterials.</h1>
      <p class="lede">FTIR interpretation, XRD calculations, laboratory calculators and a curated nanomaterials
      reference — running entirely on your device.</p>
      <canvas id="hero-plot" aria-label="Synthetic FTIR spectrum illustration"></canvas>
      <p class="footnote mono">synthetic illustrative spectrum — rendered by NanoSami's own plotting engine</p>
    </section>
    <div class="grid-cards">
      ${[
        ['#/ftir?tab=analyzer', 'FTIR·02', 'Analyze FTIR Spectrum', 'Import CSV or paste data, detect peaks, plot in standard convention.'],
        ['#/ftir?tab=dictionary', 'FTIR·01', 'Search FTIR Peak', 'Look up a wavenumber against a curated band dictionary.'],
        ['#/ftir?tab=identify', 'FTIR·03', 'Identify Possible Material', 'Rule-based, explainable matching against reference peak sets.'],
        ['#/xrd', 'XRD·01', 'Calculate Crystallite Size', 'Scherrer equation with unit handling and caveats.'],
        ['#/calc', 'LAB·Σ', 'Scientific Calculators', 'Molarity, dilution, wt%, at%, precursor and fuel ratios.'],
        ['#/library', 'REF·▤', 'Explore Nanomaterials', 'Curated reference pages: ZnO, TiO₂, graphene, MXenes and more.'],
      ].map(([h, g, t, d]) => `<a class="card tool-card" href="${h}"><div class="glyph">${g}</div><h3>${t}</h3><p>${d}</p></a>`).join('')}
    </div>
    <p class="footnote">${DISCLAIMER}</p>`;
  const c = $('#hero-plot');
  const draw = () => { const s = heroSpectrum(); plotSpectrum(c, s.x, s.y, { mode: 'absorbance' }); };
  draw(); state.replot = draw;
};

/* ---------------- FTIR ---------------- */
pages.ftir = (query) => {
  const tab = query.get('tab') || 'dictionary';
  $('#main').innerHTML = `
    <h1>FTIR</h1>
    <div class="tabs" role="tablist">
      ${[['dictionary', 'Peak dictionary'], ['analyzer', 'Spectrum analyzer'], ['identify', 'Material identification']]
        .map(([id, l]) => `<button class="tab ${tab === id ? 'active' : ''}" data-tab="${id}" role="tab" aria-selected="${tab === id}">${l}</button>`).join('')}
    </div>
    <div id="tab-body"></div>`;
  $('#main').querySelectorAll('.tab').forEach((b) =>
    b.addEventListener('click', () => { location.hash = `#/ftir?tab=${b.dataset.tab}`; }));
  ({ dictionary: ftirDictionary, analyzer: ftirAnalyzer, identify: ftirIdentify })[tab]($('#tab-body'));
};

function ftirDictionary(el) {
  el.innerHTML = `
    <section class="card">
      <h2>FTIR peak dictionary</h2>
      <p class="footnote">Enter an observed band position. Matches are grouped as
        <span class="badge exact">exact</span> (near the typical value),
        <span class="badge range">range</span> (inside the typical range) and
        <span class="badge possible">possible</span> (within tolerance of the range edge).</p>
      <div class="row">
        <div><label for="wn">Wavenumber (cm⁻¹)</label><input id="wn" type="number" inputmode="decimal" placeholder="e.g. 1720"></div>
        <div><label for="wn-tol">Extra tolerance (± cm⁻¹)</label>
          <select id="wn-tol"><option>0</option><option selected>10</option><option>20</option></select></div>
      </div>
      <button class="btn" id="wn-go">Search dictionary</button>
      <div id="wn-out" aria-live="polite"></div>
    </section>`;
  const run = () => {
    const out = $('#wn-out');
    try {
      const v = parseFloat($('#wn').value);
      const res = lookupWavenumber(FTIR_DICT, v, { tolerance: parseFloat($('#wn-tol').value) });
      if (!res.length) { out.innerHTML = `<div class="notice">No dictionary entry covers ${esc(v)} cm⁻¹. The band may be a lattice mode below 400 cm⁻¹, an overtone, or outside the curated set.</div>`; return; }
      out.innerHTML = `
        <table><thead><tr><th>Match</th><th>Bond</th><th>Group</th><th>Range (cm⁻¹)</th><th>Vibration</th><th>Intensity</th><th>Possible compounds / notes</th></tr></thead>
        <tbody>${res.map((r) => `<tr>
          <td><span class="badge ${r.matchType}">${r.matchType}</span></td>
          <td>${esc(r.bond)}</td><td>${esc(r.group)}</td>
          <td>${Math.max(...r.range)}–${Math.min(...r.range)}</td><td>${esc(r.vibration)}</td><td>${esc(r.intensity)}</td>
          <td>${esc(r.compounds.join(', '))}${r.notes ? `<br><span class="footnote">${esc(r.notes)}</span>` : ''}</td></tr>`).join('')}
        </tbody></table>
        <div class="notice">A single FTIR peak is never definitive proof of a material — interpret bands together and confirm with complementary techniques.</div>`;
    } catch (e) { out.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  };
  $('#wn-go').addEventListener('click', run);
  $('#wn').addEventListener('keydown', (e) => e.key === 'Enter' && run());
}

function ftirAnalyzer(el) {
  el.innerHTML = `
    <section class="card">
      <h2>Spectrum analyzer</h2>
      <p class="footnote">Two columns expected: wavenumber and absorbance <em>or</em> transmittance
      (CSV, TSV, semicolon or space separated; a header row is optional). Data are processed
      entirely in your browser and never uploaded.</p>
      <div class="row">
        <div><label for="sp-file">Import file (.csv / .txt / .tsv)</label><input id="sp-file" type="file" accept=".csv,.txt,.tsv,.dat,text/csv,text/plain"></div>
        <div><label for="sp-mode">Y-axis mode</label>
          <select id="sp-mode"><option value="auto" selected>Auto-detect</option><option value="absorbance">Absorbance</option><option value="transmittance">Transmittance</option></select></div>
      </div>
      <label for="sp-paste">…or paste data</label>
      <textarea id="sp-paste" placeholder="4000, 0.02&#10;3996, 0.03&#10;…"></textarea>
      <button class="btn" id="sp-load">Load spectrum</button>
      <button class="btn secondary" id="sp-demo">Load synthetic demo</button>
      <div id="sp-warn" aria-live="polite"></div>
    </section>
    <section class="card ${state.spectrum ? '' : 'hide'}" id="sp-panel">
      <h2>Spectrum & peaks</h2>
      <div class="plot-wrap"><canvas id="sp-plot"></canvas></div>
      <div class="row" style="margin-top:.8rem">
        <div><label for="sp-sens">Peak sensitivity: <span id="sp-sens-v" class="mono"></span></label>
          <input id="sp-sens" type="range" min="0.1" max="0.95" step="0.05"></div>
        <div><label for="sp-dist">Min. peak separation (cm⁻¹)</label>
          <input id="sp-dist" type="number" min="1" step="1"></div>
      </div>
      <div id="sp-peaks" aria-live="polite"></div>
    </section>`;

  const warnEl = $('#sp-warn');
  const setSpectrum = (text) => {
    try {
      const mode = $('#sp-mode').value;
      state.spectrum = parseSpectrumText(text, { mode });
      state.peaks = [];
      warnEl.innerHTML = state.spectrum.warnings.map((w) => `<div class="notice">${esc(w)}</div>`).join('');
      $('#sp-panel').classList.remove('hide');
      refresh();
    } catch (e) { warnEl.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  };

  $('#sp-load').addEventListener('click', () => {
    const f = $('#sp-file').files[0];
    if (f) { const r = new FileReader(); r.onload = () => setSpectrum(r.result); r.readAsText(f); }
    else if ($('#sp-paste').value.trim()) setSpectrum($('#sp-paste').value);
    else warnEl.innerHTML = `<div class="notice">Choose a file or paste data first.</div>`;
  });
  $('#sp-demo').addEventListener('click', () => {
    const s = heroSpectrum();
    setSpectrum('# synthetic demo spectrum (not a real material)\nwavenumber,absorbance\n' + s.x.map((x, i) => `${x},${s.y[i].toFixed(4)}`).join('\n'));
  });

  function refresh() {
    if (!state.spectrum) return;
    $('#sp-sens').value = state.sensitivity; $('#sp-sens-v').textContent = state.sensitivity.toFixed(2);
    $('#sp-dist').value = state.minDistance;
    const { x, y, mode } = state.spectrum;
    state.peaks = detectPeaks(x, y, { mode, sensitivity: state.sensitivity, minDistance: state.minDistance });
    plotSpectrum($('#sp-plot'), x, y, { peaks: state.peaks, mode });
    state.replot = () => plotSpectrum($('#sp-plot'), x, y, { peaks: state.peaks, mode });
    const dict = (w) => {
      const r = lookupWavenumber(FTIR_DICT, w, { tolerance: 10 })[0];
      return r ? `${r.bond} — ${r.group} <span class="badge ${r.matchType}">${r.matchType}</span>` : '<span class="footnote">no dictionary match</span>';
    };
    $('#sp-peaks').innerHTML = state.peaks.length ? `
      <table><thead><tr><th>#</th><th>ν̃ (cm⁻¹)</th><th>${mode === 'transmittance' ? '%T' : 'Abs'}</th><th>Prominence</th><th>Preliminary interpretation</th></tr></thead>
      <tbody>${state.peaks.map((p, i) => `<tr><td>${i + 1}</td><td>${p.wavenumber.toFixed(0)}</td><td>${p.value.toPrecision(4)}</td><td>${p.prominence.toPrecision(3)}</td><td>${dict(p.wavenumber)}</td></tr>`).join('')}</tbody></table>
      <div class="notice info">Interpretations are preliminary band assignments, not identifications.
        <a href="#/ftir?tab=identify">Continue to material identification →</a></div>
      <button class="btn secondary" id="sp-export-csv">Export peaks (CSV)</button>
      <button class="btn secondary" id="sp-export-json">Export analysis report (JSON)</button>`
      : `<div class="notice">No peaks passed the current sensitivity. Increase sensitivity or check the y-axis mode.</div>`;
  }
  $('#sp-peaks').addEventListener('click', (e) => {
    if (!state.spectrum || !state.peaks.length) return;
    const params = { mode: state.spectrum.mode, sensitivity: state.sensitivity, minDistance: state.minDistance, algorithmVersion: ALGORITHM_VERSION, app: 'NanoSami 0.3.0', exported: new Date().toISOString() };
    if (e.target.id === 'sp-export-csv') {
      download('nanosami_peaks.csv',
        `# NanoSami detected peaks — preliminary, unconfirmed\n# ${JSON.stringify(params)}\nwavenumber_cm-1,${state.spectrum.mode},prominence\n` +
        state.peaks.map((p) => `${p.wavenumber.toFixed(1)},${p.value.toPrecision(5)},${p.prominence.toPrecision(4)}`).join('\n'), 'text/csv');
    }
    if (e.target.id === 'sp-export-json') {
      download('nanosami_analysis.json', JSON.stringify({
        disclaimer: DISCLAIMER, parameters: params,
        peaks: state.peaks.map((p) => ({ wavenumber: +p.wavenumber.toFixed(1), value: +p.value.toPrecision(5), prominence: +p.prominence.toPrecision(4) })),
        dataPoints: state.spectrum.x.length,
      }, null, 2), 'application/json');
    }
  });
  $('#sp-sens')?.addEventListener('input', (e) => { state.sensitivity = parseFloat(e.target.value); refresh(); });
  $('#sp-dist')?.addEventListener('change', (e) => { state.minDistance = Math.max(1, parseFloat(e.target.value) || 12); refresh(); });
  if (state.spectrum) refresh();
}

function ftirIdentify(el) {
  const fromAnalyzer = state.peaks.map((p) => p.wavenumber.toFixed(0)).join(', ');
  el.innerHTML = `
    <section class="card">
      <h2>Material identification (rule-based, explainable)</h2>
      <p class="footnote">Detected peaks are compared with curated reference peak sets using
      <strong>one-to-one</strong> minimum-distance assignment (a detected peak can satisfy only one reference peak).
      Weights: material-specific "essential" bands ×2, supporting ×1, environmental bands (adsorbed water,
      surface –OH, carbonate) ×0.5. Near-tolerance matches count less; unexplained peaks cost −5 pts each (max −30);
      if no essential band matches, the score is capped at 25. Full method in docs/METHODOLOGY.md.
      Scores are <strong>similarity indicators, not probabilities and not proof of identity</strong>.</p>
      <label for="id-peaks">Peak list (cm⁻¹, comma-separated)</label>
      <textarea id="id-peaks" placeholder="e.g. 3025, 2920, 1600, 1493, 1452, 756, 698">${esc(fromAnalyzer)}</textarea>
      <div class="row">
        <div><label for="id-tol">Peak tolerance (± cm⁻¹)</label>
          <select id="id-tol"><option>5</option><option selected>10</option><option>20</option></select></div>
      </div>
      <button class="btn" id="id-go">Match against reference materials</button>
      <div id="id-out" aria-live="polite"></div>
    </section>`;
  $('#id-go').addEventListener('click', () => {
    const out = $('#id-out');
    try {
      const peaks = $('#id-peaks').value.split(/[,\s;]+/).map(Number).filter((n) => Number.isFinite(n));
      const res = matchMaterials(MATERIALS, peaks, { tolerance: parseFloat($('#id-tol').value) }).filter((r) => r.score > 0).slice(0, 6);
      if (!res.length) { out.innerHTML = `<div class="notice">No reference material reached a positive similarity score. The material may not be in the current reference set (12 materials).</div>`; return; }
      out.innerHTML = res.map((r, i) => `
        <div class="result">
          <div><strong>${i + 1}. ${esc(r.material)}</strong> <span class="footnote">(${esc(r.formula)}, ${esc(r.class)})</span>
            — <span class="big">${r.score.toFixed(1)}</span><span class="footnote">/100 · ${esc(r.confidence)}</span></div>
          <div class="scorebar" style="margin:.4rem 0"><div style="width:${r.score}%"></div></div>
          ${r.ambiguous ? `<div class="notice">Ambiguous: the next candidate scores within 10 points — FTIR alone cannot distinguish them here. Use XRD, Raman or other complementary methods.</div>` : ''}
          ${r.noEssential ? `<div class="notice">Only environmental / non-specific bands matched — this cannot establish an identification.</div>` : ''}
          <div class="footnote">${esc(r.explanation)}</div>
          <table><tbody>
            <tr><th>Matched</th><td>${r.matched.map((m) => `${m.detected.toFixed(0)}→${m.ref.wavenumber} (${esc(m.ref.label)}, Δ${m.diff.toFixed(0)})`).join('; ') || '—'}</td></tr>
            <tr><th>Missing</th><td>${r.missing.map((m) => `${m.wavenumber} (${esc(m.label)}${m.essential ? ', essential' : ''})`).join('; ') || 'none'}</td></tr>
            <tr><th>Unexplained</th><td>${r.extras.map((e2) => e2.toFixed(0)).join(', ') || 'none'}</td></tr>
          </tbody></table>
        </div>`).join('') +
        `<div class="notice">The spectrum is <em>most consistent with</em> the top-scoring entries above. This is a preliminary identification — confirmation using additional characterization (XRD, Raman, EDS…) may be required.</div>`;
    } catch (e) { out.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  });
}

/* ---------------- XRD ---------------- */
pages.xrd = () => {
  const wlOpts = Object.entries(WAVELENGTHS).map(([k, v]) => `<option value="${v}">${k}</option>`).join('');
  $('#main').innerHTML = `
    <h1>XRD calculators</h1>
    <section class="card">
      <h2>Scherrer crystallite size</h2>
      <p class="mono footnote">D = K·λ / (β·cos θ) — β is the FWHM in radians on the 2θ scale; θ = 2θ/2.</p>
      <div class="row">
        <div><label for="sc-wl">Wavelength λ</label><select id="sc-wl">${wlOpts}<option value="custom">Custom (Å)…</option></select>
          <input id="sc-wl-custom" class="hide" type="number" step="any" placeholder="λ in Å" style="margin-top:.3rem"></div>
        <div><label for="sc-2t">Peak position 2θ (°)</label><input id="sc-2t" type="number" step="any" placeholder="36.25"></div>
        <div><label for="sc-fwhm">FWHM β</label><input id="sc-fwhm" type="number" step="any" placeholder="0.45"></div>
        <div><label for="sc-unit">β unit</label><select id="sc-unit"><option value="deg" selected>degrees</option><option value="rad">radians</option></select></div>
        <div><label for="sc-k">Shape factor K</label><input id="sc-k" type="number" step="any" value="0.9"></div>
        <div><label for="sc-inst">Instrumental FWHM (optional, same unit)</label><input id="sc-inst" type="number" step="any" placeholder="from a standard, e.g. 0.08"></div>
      </div>
      <button class="btn" id="sc-go">Calculate size</button>
      <div id="sc-out" aria-live="polite"></div>
      <div class="notice">Scherrer gives the coherently diffracting <em>crystallite</em> size — not necessarily the particle size seen by SEM/TEM (particles can be polycrystalline or aggregated). If you know the instrumental FWHM from a standard (e.g. LaB₆ or Si), enter it above and NanoSami applies β = √(β²obs − β²inst), which assumes Gaussian-dominated profiles; strain also broadens peaks (see Williamson–Hall, planned).</div>
    </section>
    <section class="card">
      <h2>Bragg d-spacing</h2>
      <p class="mono footnote">nλ = 2·d·sin θ → d = nλ / (2 sin θ)</p>
      <div class="row">
        <div><label for="br-wl">Wavelength λ</label><select id="br-wl">${wlOpts}<option value="custom">Custom (Å)…</option></select>
          <input id="br-wl-custom" class="hide" type="number" step="any" placeholder="λ in Å" style="margin-top:.3rem"></div>
        <div><label for="br-2t">Peak position 2θ (°)</label><input id="br-2t" type="number" step="any" placeholder="25.3"></div>
        <div><label for="br-n">Order n</label><input id="br-n" type="number" step="1" value="1"></div>
      </div>
      <button class="btn" id="br-go">Calculate d-spacing</button>
      <div id="br-out" aria-live="polite"></div>
    </section>
    <p class="footnote">Planned for future releases: lattice-parameter calculation, Williamson–Hall size/strain analysis, peak indexing and phase comparison — the calculation core is structured so these plug in as additional modules.</p>`;

  const wl = (selId, customId) => {
    const v = $(selId).value;
    return v === 'custom' ? parseFloat($(customId).value) : parseFloat(v);
  };
  for (const [sel, custom] of [['#sc-wl', '#sc-wl-custom'], ['#br-wl', '#br-wl-custom']]) {
    $(sel).addEventListener('change', () => $(custom).classList.toggle('hide', $(sel).value !== 'custom'));
  }
  $('#sc-go').addEventListener('click', () => {
    const out = $('#sc-out');
    try {
      const r = scherrer({ wavelength: wl('#sc-wl', '#sc-wl-custom'), twoTheta: parseFloat($('#sc-2t').value), fwhm: parseFloat($('#sc-fwhm').value), fwhmUnit: $('#sc-unit').value, K: parseFloat($('#sc-k').value), fwhmInst: $('#sc-inst').value.trim() === '' ? null : parseFloat($('#sc-inst').value) });
      out.innerHTML = `<div class="result"><div>Crystallite size D = <span class="big">${r.sizeNm.toFixed(2)} nm</span> <span class="footnote">(${r.sizeA.toFixed(1)} Å)</span></div><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
    } catch (e) { out.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  });
  $('#br-go').addEventListener('click', () => {
    const out = $('#br-out');
    try {
      const r = braggD({ wavelength: wl('#br-wl', '#br-wl-custom'), twoTheta: parseFloat($('#br-2t').value), n: parseInt($('#br-n').value, 10) });
      out.innerHTML = `<div class="result"><div>d-spacing = <span class="big">${r.dA.toFixed(4)} Å</span> <span class="footnote">(${r.dNm.toFixed(4)} nm)</span></div><ol class="steps">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
    } catch (e) { out.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  });
};

/* ---------------- Calculators ---------------- */
pages.calc = () => {
  const card = (id, title, eq, fields, btn = 'Calculate') => `
    <section class="card"><h2>${title}</h2><p class="mono footnote">${eq}</p>
    <div class="row">${fields}</div><button class="btn" data-calc="${id}">${btn}</button><div id="out-${id}"></div></section>`;
  const F = (id, label, ph = '', val = '') => `<div><label for="${id}">${label}</label><input id="${id}" type="number" step="any" placeholder="${ph}" value="${val}"></div>`;

  $('#main').innerHTML = `<h1>Scientific calculators</h1>
    <p class="footnote">Every calculator shows its equation, variable definitions and calculation steps — no hidden math.</p>
    ${card('mol', 'Molarity', 'M = n / V = m / (MW · V) — m: solute mass (g), MW: molar mass (g·mol⁻¹), V: solution volume (L)',
      F('mol-m', 'Solute mass m (g)', '5.85') + F('mol-mw', 'Molar mass MW (g/mol)', '58.44') + F('mol-v', 'Volume V (L)', '1'))}
    ${card('mass', 'Required solute mass', 'm = M · V · MW — M: target molarity, V: volume (L), MW: molar mass',
      F('mass-M', 'Target molarity (mol/L)', '0.1') + F('mass-v', 'Volume V (L)', '0.25') + F('mass-mw', 'Molar mass MW (g/mol)', '58.44'))}
    ${card('dil', 'Dilution', 'C₁V₁ = C₂V₂ — fill any three fields; leave the unknown empty (consistent units)',
      F('dil-c1', 'C₁ (stock conc.)') + F('dil-v1', 'V₁ (stock volume)') + F('dil-c2', 'C₂ (final conc.)') + F('dil-v2', 'V₂ (final volume)'), 'Solve')}
    ${card('wt', 'Weight percent', 'wt% = m(component) / m(total) × 100',
      F('wt-c', 'Component mass', '2') + F('wt-t', 'Total mass', '50'))}
    ${card('at', 'Atomic percent', 'at%ᵢ = nᵢ / Σn × 100 — enter moles of each element, comma-separated',
      `<div style="grid-column:1/-1"><label for="at-list">Moles (comma-separated)</label><input id="at-list" type="text" placeholder="0.5, 0.5, 1.0"></div>`)}
    ${card('pre', 'Precursor mass', 'm(precursor) = m(product)/MW(product) × ratio × MW(precursor)',
      F('pre-mp', 'Target product mass (g)', '1') + F('pre-mwp', 'Product MW (g/mol)', '81.38') + F('pre-mwpre', 'Precursor MW (g/mol)', '297.49') + F('pre-r', 'Mole ratio precursor:product', '', '1'))}
    ${card('fuel', 'Fuel : precursor ratio (combustion synthesis)', 'φ = 1 ⇒ mol fuel = Σ(oxidizing valence of precursor) / |reducing valence per mol fuel| — valence method (Jain), e.g. Zn(NO₃)₂ = +10 oxidizing? No: total = −10 ⇒ enter |−10| = 10; urea = +6, glycine = +9, citric acid = +18',
      F('fuel-ox', '|Σ oxidizing valence| of precursor', '10') + F('fuel-f', '|reducing valence| per mol fuel', '6'))}`;

  const show = (id, html) => { $(`#out-${id}`).innerHTML = html; };
  const res = (id, main, steps) => show(id, `<div class="result"><div>${main}</div><ol class="steps">${steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`);
  const err = (id, e) => show(id, `<div class="notice">${esc(e.message)}</div>`);
  const v = (id) => { const x = $(id).value.trim(); return x === '' ? null : parseFloat(x); };

  $('#main').addEventListener('click', (ev) => {
    const id = ev.target.dataset?.calc; if (!id) return;
    try {
      if (id === 'mol') { const r = chem.molarity({ massG: v('#mol-m'), molarMass: v('#mol-mw'), volumeL: v('#mol-v') }); res(id, `M = <span class="big">${r.molarity.toPrecision(5)} mol/L</span>`, r.steps); }
      if (id === 'mass') { const r = chem.soluteMass({ molarityM: v('#mass-M'), volumeL: v('#mass-v'), molarMass: v('#mass-mw') }); res(id, `m = <span class="big">${r.massG.toPrecision(5)} g</span>`, r.steps); }
      if (id === 'dil') { const r = chem.dilution({ c1: v('#dil-c1'), v1: v('#dil-v1'), c2: v('#dil-c2'), v2: v('#dil-v2') }); res(id, `${r.target.toUpperCase()} = <span class="big">${r.value.toPrecision(5)}</span>`, r.steps); }
      if (id === 'wt') { const r = chem.weightPercent({ componentMass: v('#wt-c'), totalMass: v('#wt-t') }); res(id, `wt% = <span class="big">${r.wtPercent.toPrecision(5)} %</span>`, r.steps); }
      if (id === 'at') { const list = $('#at-list').value.split(/[,\s]+/).map(Number).filter(Number.isFinite); const r = chem.atomicPercent(list); res(id, `at% = <span class="big">${r.atPercents.map((p) => p.toPrecision(4)).join(' / ')}</span>`, r.steps); }
      if (id === 'pre') { const r = chem.precursorMass({ productMassG: v('#pre-mp'), productMW: v('#pre-mwp'), precursorMW: v('#pre-mwpre'), moleRatio: v('#pre-r') }); res(id, `m(precursor) = <span class="big">${r.precursorMassG.toPrecision(5)} g</span>`, r.steps); }
      if (id === 'fuel') { const r = chem.fuelRatio({ oxidizerValenceTotal: v('#fuel-ox'), fuelValencePerMole: v('#fuel-f') }); res(id, `mol fuel / mol precursor = <span class="big">${r.molesFuelPerMolePrecursor.toPrecision(5)}</span>`, r.steps); }
    } catch (e) { err(id, e); }
  });
};

/* ---------------- Library ---------------- */
pages.library = (query) => {
  const sel = query.get('m');
  const mat = LIBRARY.find((m) => m.formula === sel || m.name === sel);
  if (mat) {
    const li = (arr) => `<ul>${arr.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>`;
    $('#main').innerHTML = `
      <p><a href="#/library">← All materials</a></p>
      <section class="card">
        <h1>${esc(mat.name)} <span class="mono" style="font-size:1rem;color:var(--accent)">${esc(mat.formula)}</span></h1>
        <p class="footnote">${esc(mat.class)}</p>
        <dl class="detail">
          <dt>Crystal structure</dt><dd>${esc(mat.structure)}</dd>
          <dt>Band gap</dt><dd>${esc(mat.bandGap)}</dd>
          <dt>Important properties</dt><dd>${li(mat.properties)}</dd>
          <dt>Common synthesis methods</dt><dd>${li(mat.synthesis)}</dd>
          <dt>Common applications</dt><dd>${li(mat.applications)}</dd>
          <dt>Typical characterization</dt><dd>${esc(mat.characterization.join(', '))}</dd>
          <dt>FTIR features</dt><dd class="mono" style="font-size:.87rem">${esc(mat.ftir)}</dd>
          <dt>XRD features</dt><dd class="mono" style="font-size:.87rem">${esc(mat.xrd)}</dd>
        </dl>
        <div class="notice">Curated reference values. Properties can vary substantially with phase, size, morphology and synthesis route — always verify against primary literature for your specific system.</div>
      </section>`;
    return;
  }
  $('#main').innerHTML = `<h1>Nanomaterials library</h1>
    <p class="footnote">Curated reference pages (kept separate from any user experimental data).</p>
    <div class="lib-grid">${LIBRARY.map((m) => `
      <a class="card lib-card" href="#/library?m=${encodeURIComponent(m.formula)}" style="text-decoration:none;color:inherit">
        <div class="formula">${esc(m.formula)}</div><h3>${esc(m.name)}</h3>
        <p class="footnote">${esc(m.class)}</p></a>`).join('')}</div>`;
};

/* ---------------- About ---------------- */
pages.about = () => {
  $('#main').innerHTML = `
    <h1>About NanoSami</h1>
    <section class="card">
      <p><strong>NanoSami — Materials Science & Nanotechnology Toolkit</strong> brings FTIR interpretation,
      XRD calculations, laboratory calculators and a curated nanomaterials reference together in one
      offline-first application for students and researchers.</p>
      <p class="mono footnote">Version 0.3.0 · open scientific tooling · all processing on-device</p>
    </section>
    <section class="card">
      <h2>About the creator</h2>
      <div class="creator-card">
        <img src="assets/creator_avatar.jpg" alt="Portrait of Sami Abdullah Mohammed" width="128" height="128">
        <div>
          <h3 style="margin:0">Sami Abdullah Mohammed</h3>
          <div class="role">CREATOR OF NANOSAMI</div>
          <div class="field">M.Sc. Physics — Nanoscience and Nanotechnology</div>
        </div>
      </div>
      <p style="margin-top:1rem">NanoSami was created by Sami Abdullah Mohammed as a scientific toolkit designed to make
      materials characterization, nanotechnology calculations, and scientific reference tools more accessible
      to students and researchers.</p>
    </section>
    <section class="card">
      <h2>Data privacy</h2>
      <p>All calculations and file processing happen locally in your browser. Imported spectra
      <strong>never leave your device</strong>, are held only in memory, and are discarded when you close or
      reload the page. NanoSami stores no personal data and contains no analytics or advertising trackers.</p>
    </section>
    <section class="card">
      <h2>Scientific integrity</h2>
      <p>${DISCLAIMER}</p>
      <p class="footnote">Reference values are typical literature ranges; where a property varies strongly with phase,
      size, morphology or synthesis, the entry says so. Nothing in NanoSami replaces professional characterization
      or expert interpretation.</p>
    </section>`;
};

/* ---------------- router ---------------- */
function route() {
  const [path, qs] = (location.hash || '#/home').split('?');
  const query = new URLSearchParams(qs || '');
  const page = pages[path.replace('#/', '')] || pages.home;
  renderNav();
  page(query);
  $('#main').scrollIntoView?.();
}
let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => state.replot?.(), 180);
});
addEventListener('hashchange', route);
route();
