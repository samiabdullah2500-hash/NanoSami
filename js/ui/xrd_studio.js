/* NanoSami — XRD Studio (v0.4.0).
 * Workflow: import pattern → plot → detect peaks (adjustable) → per-peak
 * table (2θ, I, FWHM, d, Scherrer D) → optional Miller-index matching:
 *   MODE A: user-pasted reference peak list (from a card the user has).
 *   MODE C: reflections computed from a user-selected crystal system +
 *           lattice parameters (geometry only — extinctions NOT applied).
 * hkl labels are never guessed from peak position alone; every match shows
 * observed 2θ, reference 2θ, Δ2θ and status, plus the assumptions used.
 */
import { mountImporter } from './importer.js';
import { mountAiPanel } from './ai_panel.js';
import { $, esc, downloadText, noticeHtml } from './util.js';
import { baseline, savitzkyGolay } from '../core/processing.js';
import { findPeaks } from '../core/peaks.js';
import { renderPlotSVG } from '../core/svgplot.js';
import { scherrer, WAVELENGTHS } from '../core/xrd.js';
import { dFromTwoTheta, generateReflections, parseReferenceList, matchPeaks, CRYSTAL_SYSTEMS } from '../core/xrd_match.js';
import { createRecipe, setSource, setImport, addStep, setAnalysis, setResults, serializeRecipe } from '../core/recipe.js';
import { buildAnalysisContext } from '../core/ai_context.js';
import { APP_VERSION } from './plot_studio.js';

const st = {
  data: null,           // {x:2θ[], y:I[], name, source, importMap}
  opts: {
    wavelength: 1.5406, K: 0.9, fwhmInst: '',
    smooth: false, sgWindow: 9,
    baseline: 'none', blWindow: 101,
    prominence: 0.05, minDist2T: 0.2,
  },
  peaks: [],            // enriched rows
  match: null,          // matchPeaks() result
  refSourceLabel: null,
  warnings: [],
};

function processed() {
  const o = st.opts;
  let { x, y } = st.data;
  x = x.slice(); y = y.slice();
  const steps = [];
  if (o.smooth) {
    try { const r = savitzkyGolay(x, y, { window: o.sgWindow, order: 2 }); y = r.y; steps.push(r.description); (r.warnings || []).forEach((w) => st.warnings.push(w)); }
    catch (e) { st.warnings.push(`Smoothing skipped: ${e.message}`); }
  }
  if (o.baseline !== 'none') {
    try { const r = baseline(x, y, { method: o.baseline, window: o.blWindow }); y = r.y; steps.push(r.description); }
    catch (e) { st.warnings.push(`Baseline skipped: ${e.message}`); }
  }
  return { x, y, steps };
}

function analyze() {
  st.warnings = [];
  st.peaks = [];
  if (!st.data) return null;
  const o = st.opts;
  const p = processed();
  let det = { peaks: [] };
  try { det = findPeaks(p.x, p.y, { minProminenceFrac: o.prominence, minDistanceX: o.minDist2T }); }
  catch (e) { st.warnings.push(e.message); }
  st.peaks = det.peaks.map((pk) => {
    const row = {
      twoTheta: pk.x, intensity: pk.y, prominence: pk.prominence,
      fwhmDeg: pk.fwhm, fwhmNote: pk.fwhmNote, d: null, sizeNm: null, sizeNote: null,
    };
    try { row.d = dFromTwoTheta(pk.x, o.wavelength); } catch { /* out of range */ }
    if (pk.fwhm !== null && pk.fwhm > 0) {
      try {
        const inst = o.fwhmInst === '' ? null : parseFloat(o.fwhmInst);
        const r = scherrer({ wavelength: o.wavelength, twoTheta: pk.x, fwhm: pk.fwhm, fwhmUnit: 'deg', K: o.K, fwhmInst: inst });
        row.sizeNm = r.sizeNm;
      } catch (e) { row.sizeNote = e.message; }
    } else {
      row.sizeNote = 'no FWHM estimate';
    }
    return row;
  });
  return p;
}

function refreshMatchTable() {
  const el = $('#xs-match-out');
  if (!st.match) { el.innerHTML = ''; return; }
  const m = st.match;
  el.innerHTML = `
    ${noticeHtml(m.assumptions, 'info')}
    <table><thead><tr><th>Observed 2θ (°)</th><th>Reference 2θ (°)</th><th>Δ2θ (°)</th><th>(hkl)</th><th>Status</th></tr></thead>
    <tbody>${m.rows.map((r) => `<tr>
      <td>${r.observed2Theta.toFixed(3)}</td>
      <td>${r.reference2Theta !== null ? r.reference2Theta.toFixed(3) : '—'}</td>
      <td>${r.delta !== null ? (r.delta >= 0 ? '+' : '') + r.delta.toFixed(3) : '—'}</td>
      <td>${r.hkl ? `(${r.hkl.join('')})` : '—'}</td>
      <td><span class="badge ${r.status === 'match' ? 'exact' : r.status === 'tentative' ? 'range' : 'possible'}">${r.status}</span></td>
    </tr>`).join('')}</tbody></table>
    <div class="footnote">Matched ${m.matchedCount} / ${m.rows.length} observed peaks · ${m.unmatchedReference} reference line(s) unused · tolerance ±${m.tolerance}° · reference: ${esc(m.source)}</div>
    <div class="notice">${esc(m.caveat)}</div>`;
}

function refresh() {
  const p = analyze();
  const plotEl = $('#xs-plot'), warnEl = $('#xs-warn'), tbl = $('#xs-peaks');
  if (!p) { plotEl.innerHTML = ''; warnEl.innerHTML = ''; tbl.innerHTML = ''; return; }
  const o = st.opts;
  const matchByObs = new Map((st.match?.rows || []).map((r) => [r.observed2Theta, r]));
  try {
    const { svg, warnings } = renderPlotSVG({
      series: [{ name: st.data.name, x: p.x, y: p.y }],
      xLabel: '2θ (degrees)', yLabel: 'Intensity (a.u.)',
      peakMarkers: st.peaks.map((pk) => {
        const mr = matchByObs.get(pk.twoTheta);
        return { x: pk.twoTheta, y: pk.intensity, label: mr?.hkl ? `(${mr.hkl.join('')})` : pk.twoTheta.toFixed(1) };
      }),
      legend: false,
    });
    st.lastSvg = svg;
    plotEl.innerHTML = svg;
    st.warnings.push(...warnings);
  } catch (e) { plotEl.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  warnEl.innerHTML = noticeHtml(st.warnings, 'info');
  tbl.innerHTML = st.peaks.length ? `
    <table><thead><tr><th>#</th><th>2θ (°)</th><th>I</th><th>FWHM (°)</th><th>d (Å)</th><th>Scherrer D (nm)</th></tr></thead>
    <tbody>${st.peaks.map((r, i) => `<tr>
      <td>${i + 1}</td><td>${r.twoTheta.toFixed(3)}</td><td>${r.intensity.toPrecision(4)}</td>
      <td>${r.fwhmDeg !== null ? r.fwhmDeg.toFixed(3) : '—'}${r.fwhmNote ? ` <span class="footnote">${esc(r.fwhmNote)}</span>` : ''}</td>
      <td>${r.d !== null ? r.d.toFixed(4) : '—'}</td>
      <td>${r.sizeNm !== null ? r.sizeNm.toPrecision(3) : '—'}${r.sizeNote ? ` <span class="footnote">${esc(r.sizeNote)}</span>` : ''}</td>
    </tr>`).join('')}</tbody></table>
    <div class="notice">FWHM values are numerical half-prominence estimates from the (optionally processed) pattern —
    not profile fits. Scherrer D uses K = ${o.K}${o.fwhmInst !== '' ? `, instrumental FWHM ${o.fwhmInst}° (β = √(β²obs − β²inst), Gaussian assumption)` : ', no instrumental correction'}.
    Crystallite size ≠ particle size; strain broadening is not separated (Williamson–Hall planned).</div>`
    : '<div class="notice">No peaks passed the current prominence threshold.</div>';
  refreshMatchTable();
}

function buildXrdRecipe() {
  const o = st.opts;
  const r = createRecipe({ appVersion: APP_VERSION, analysisType: 'xrd-studio' });
  if (st.data) { setSource(r, st.data.source || {}); setImport(r, st.data.importMap || {}); }
  if (o.smooth) addStep(r, { op: 'smooth.savitzkyGolay', params: { window: o.sgWindow, order: 2 }, description: `Savitzky–Golay smoothing (window ${o.sgWindow}, order 2)` });
  if (o.baseline !== 'none') addStep(r, { op: `baseline.${o.baseline}`, params: { window: o.blWindow }, description: `${o.baseline} baseline correction (window ${o.blWindow})` });
  setAnalysis(r, {
    wavelengthA: o.wavelength, scherrerK: o.K,
    instrumentalFwhmDeg: o.fwhmInst === '' ? null : +o.fwhmInst,
    peakDetection: { minProminenceFrac: o.prominence, minDistance2Theta: o.minDist2T },
    millerMatching: st.match ? { source: st.match.source, tolerance: st.match.tolerance, assumptions: st.match.assumptions } : null,
  });
  setResults(r, {
    peaks: st.peaks.map((p) => ({
      twoTheta: +p.twoTheta.toFixed(4), intensity: +p.intensity.toPrecision(5),
      fwhmDeg: p.fwhmDeg !== null ? +p.fwhmDeg.toFixed(4) : null,
      dA: p.d !== null ? +p.d.toFixed(4) : null,
      scherrerNm: p.sizeNm !== null ? +p.sizeNm.toPrecision(4) : null,
    })),
    matching: st.match ? st.match.rows : null,
  });
  return r;
}

function aiContext() {
  const o = st.opts;
  const matchByObs = new Map((st.match?.rows || []).map((r) => [r.observed2Theta, r]));
  return buildAnalysisContext({
    analysisType: 'XRD pattern analysis',
    appVersion: APP_VERSION,
    sampleName: st.data?.name,
    units: ['2θ in degrees', 'd-spacing in Å', 'crystallite size in nm', 'FWHM in degrees (2θ scale)'],
    settings: {
      'X-ray wavelength λ': `${o.wavelength} Å`,
      'Scherrer shape factor K': o.K,
      'instrumental FWHM': o.fwhmInst === '' ? 'none applied' : `${o.fwhmInst}° (β = √(β²obs − β²inst))`,
      'smoothing': o.smooth ? `Savitzky–Golay (window ${o.sgWindow})` : 'none',
      'baseline': o.baseline,
      'peak detection': `prominence ≥ ${o.prominence} × span, min separation ${o.minDist2T}° 2θ`,
      'Miller-index reference': st.refSourceLabel || 'none used',
    },
    assumptions: st.match?.assumptions || [],
    tables: st.peaks.length ? [{
      origin: 'NanoSami-calculated peak table',
      columns: ['2θ (°)', 'intensity', 'FWHM (°)', 'd (Å)', 'Scherrer D (nm)', 'assigned (hkl)', 'Δ2θ (°)'],
      rows: st.peaks.map((p) => {
        const mr = matchByObs.get(p.twoTheta);
        return [p.twoTheta.toFixed(3), p.intensity.toPrecision(4),
          p.fwhmDeg !== null ? p.fwhmDeg.toFixed(3) : null,
          p.d !== null ? p.d.toFixed(4) : null,
          p.sizeNm !== null ? p.sizeNm.toPrecision(3) : null,
          mr?.hkl ? `(${mr.hkl.join('')})` : null,
          mr?.delta !== null && mr?.delta !== undefined ? mr.delta.toFixed(3) : null];
      }),
    }] : [],
    limitations: [
      'FWHM values are half-prominence numerical estimates, not profile fits.',
      'Scherrer size is a volume-weighted coherent-domain size, not the SEM/TEM particle size; strain broadening is not separated.',
      'Any (hkl) assignments are position matches against the stated reference only — NOT definitive phase identification.',
      st.match ? null : 'No Miller-index matching has been performed.',
    ].filter(Boolean),
  });
}

export function xrdStudioPage() {
  const wlOpts = Object.entries(WAVELENGTHS).map(([k, v]) => `<option value="${v}" ${+v === st.opts.wavelength ? 'selected' : ''}>${k}</option>`).join('');
  $('#main').innerHTML = `
    <h1>XRD Studio</h1>
    <p class="footnote">Import a diffraction pattern → detect peaks → get FWHM, d-spacing and Scherrer size per peak →
    optionally match Miller indices against a reference you provide. Single-value calculators remain on the
    <a href="#/xrd">XRD calculators</a> page.</p>
    <section class="card" id="xs-import"></section>
    <section class="card ${st.data ? '' : 'hide'}" id="xs-panel">
      <h2>Pattern &amp; peak analysis</h2>
      <div class="row">
        <div><label>Wavelength λ</label><select id="xs-wl">${wlOpts}<option value="custom">Custom (Å)…</option></select>
          <input id="xs-wl-custom" class="hide" type="number" step="any" placeholder="λ in Å" style="margin-top:.3rem"></div>
        <div><label>Scherrer K</label><input id="xs-k" type="number" step="any" value="0.9"></div>
        <div><label>Instrumental FWHM (°, optional)</label><input id="xs-inst" type="number" step="any" placeholder="from standard"></div>
      </div>
      <div class="row">
        <div><label style="font-weight:400"><input type="checkbox" id="xs-smooth"> Savitzky–Golay smoothing</label></div>
        <div><label>Baseline</label><select id="xs-baseline"><option value="none">none</option><option value="linear">linear (endpoints)</option><option value="rolling">rolling minimum</option></select></div>
        <div><label>Peak prominence: <span id="xs-prom-v" class="mono">0.05</span></label>
          <input id="xs-prom" type="range" min="0.01" max="0.5" step="0.01" value="0.05"></div>
        <div><label>Min. separation (° 2θ)</label><input id="xs-mindist" type="number" step="any" min="0" value="0.2"></div>
      </div>
      <div id="xs-plot" class="plot-wrap" style="overflow-x:auto"></div>
      <div id="xs-warn" aria-live="polite"></div>
      <div id="xs-peaks"></div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.6rem">
        <button class="btn secondary" id="xs-exp-svg">Export SVG</button>
        <button class="btn secondary" id="xs-exp-csv">Export peak table (CSV)</button>
        <button class="btn secondary" id="xs-exp-recipe">Export Analysis Recipe (JSON)</button>
      </div>
    </section>
    <section class="card ${st.data ? '' : 'hide'}" id="xs-miller">
      <h2>Miller-index matching <span class="badge possible">reference required</span></h2>
      <p class="footnote">NanoSami never guesses (hkl) from peak position alone. Provide a reference:</p>
      <div class="tabs">
        <button class="tab active" data-mtab="ref">A — paste reference peak list</button>
        <button class="tab" data-mtab="lattice">C — compute from lattice parameters</button>
      </div>
      <div id="xs-mtab-ref">
        <label for="xs-reflist">One line per reflection: <code>2θ hkl</code> (e.g. <code>36.25 101</code> or <code>36.25 1 0 1</code>).
        Use values from a reference card you have access to (ICDD/COD/publication) and cite it in your work.</label>
        <textarea id="xs-reflist" placeholder="31.77 100&#10;34.42 002&#10;36.25 101"></textarea>
        <div class="row">
          <div><label>Values are</label><select id="xs-refunit"><option value="2theta">2θ (degrees)</option><option value="d">d (Å)</option></select></div>
          <div><label>Reference name (for the record)</label><input id="xs-refname" placeholder="e.g. ZnO wurtzite, COD 2300112"></div>
        </div>
      </div>
      <div id="xs-mtab-lattice" class="hide">
        <div class="row">
          <div><label>Crystal system</label><select id="xs-sys">${CRYSTAL_SYSTEMS.map((s) => `<option value="${s}">${s}</option>`).join('')}</select></div>
          <div><label>a (Å)</label><input id="xs-la" type="number" step="any" placeholder="3.2495"></div>
          <div><label>b (Å)</label><input id="xs-lb" type="number" step="any" placeholder="orthorhombic only"></div>
          <div><label>c (Å)</label><input id="xs-lc" type="number" step="any" placeholder="5.2069"></div>
          <div><label>Max index</label><input id="xs-maxidx" type="number" min="1" max="8" value="4"></div>
        </div>
        <div class="notice info">Computed lines are geometrically allowed reflections only — space-group extinction rules and
        intensities are not applied. Agreement is a consistency check with <em>your</em> assumed structure, not phase ID.</div>
      </div>
      <div class="row">
        <div><label>Match tolerance (° 2θ)</label><input id="xs-tol" type="number" step="any" min="0.01" value="0.3"></div>
      </div>
      <button class="btn" id="xs-match-go">Match detected peaks</button>
      <div id="xs-match-out" aria-live="polite"></div>
    </section>
    <section class="card ${st.data ? '' : 'hide'}" id="xs-ai"></section>`;

  mountImporter($('#xs-import'), {
    label: 'Import XRD pattern (2θ vs intensity)',
    onImport: ({ series, source, importMap }) => {
      const s = series[0];
      if (series.length > 1) $('#xs-warn').innerHTML = '<div class="notice info">Multiple Y columns selected — XRD Studio analyzes the first; use the Plotting Studio to overlay several patterns.</div>';
      const looksLike2T = s.x[0] >= 0 && s.x[s.x.length - 1] <= 180;
      st.data = { ...s, source, importMap };
      st.match = null; st.refSourceLabel = null;
      ['#xs-panel', '#xs-miller', '#xs-ai'].forEach((sel) => $(sel).classList.remove('hide'));
      if (!looksLike2T) st.warnings.push('X values fall outside 0–180 — is this really a 2θ axis?');
      refresh();
    },
  });
  mountAiPanel($('#xs-ai'), aiContext);

  const o = st.opts;
  $('#xs-wl').addEventListener('change', () => {
    const v = $('#xs-wl').value;
    $('#xs-wl-custom').classList.toggle('hide', v !== 'custom');
    if (v !== 'custom') { o.wavelength = parseFloat(v); st.match = null; refresh(); }
  });
  $('#xs-wl-custom').addEventListener('change', () => {
    const v = parseFloat($('#xs-wl-custom').value);
    if (v > 0) { o.wavelength = v; st.match = null; refresh(); }
  });
  const on = (sel, key, map = (v) => v, ev = 'change') => $(sel).addEventListener(ev, (e) => {
    o[key] = map(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    if (sel === '#xs-prom') $('#xs-prom-v').textContent = (+o.prominence).toFixed(2);
    st.match = null; // settings changed → previous matching is stale
    refresh();
  });
  on('#xs-k', 'K', parseFloat);
  on('#xs-inst', 'fwhmInst');
  on('#xs-smooth', 'smooth', Boolean);
  on('#xs-baseline', 'baseline');
  on('#xs-prom', 'prominence', parseFloat, 'input');
  on('#xs-mindist', 'minDist2T', (v) => Math.max(0, parseFloat(v) || 0));

  document.querySelectorAll('[data-mtab]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-mtab]').forEach((x) => x.classList.toggle('active', x === b));
    $('#xs-mtab-ref').classList.toggle('hide', b.dataset.mtab !== 'ref');
    $('#xs-mtab-lattice').classList.toggle('hide', b.dataset.mtab !== 'lattice');
  }));

  $('#xs-match-go').addEventListener('click', () => {
    const out = $('#xs-match-out');
    try {
      if (!st.peaks.length) throw new Error('Detect peaks first (adjust prominence if the table is empty).');
      const tol = Math.max(0.01, parseFloat($('#xs-tol').value) || 0.3);
      const observed = st.peaks.map((p) => ({ twoTheta: p.twoTheta }));
      const modeA = !$('#xs-mtab-ref').classList.contains('hide');
      if (modeA) {
        const unit = $('#xs-refunit').value;
        const parsed = parseReferenceList($('#xs-reflist').value, { unit, wavelength: o.wavelength });
        const name = $('#xs-refname').value.trim() || 'user-provided reference list';
        st.refSourceLabel = name;
        st.match = matchPeaks(observed, parsed.lines, {
          tolerance: tol, source: name,
          assumptions: [
            `Reference peak list provided by the user (${parsed.lines.length} lines, values in ${unit === 'd' ? 'd (Å), converted with λ = ' + o.wavelength + ' Å' : '2θ degrees'}).`,
            ...parsed.warnings,
          ],
        });
      } else {
        const sys = $('#xs-sys').value;
        const params = { a: parseFloat($('#xs-la').value), b: parseFloat($('#xs-lb').value), c: parseFloat($('#xs-lc').value) };
        const maxIndex = Math.min(8, Math.max(1, parseInt($('#xs-maxidx').value, 10) || 4));
        const tmax = Math.min(179, Math.max(...st.data.x) + 2);
        const gen = generateReflections(sys, params, { wavelength: o.wavelength, maxIndex, twoThetaMax: tmax, twoThetaMin: Math.max(1, Math.min(...st.data.x) - 2) });
        st.refSourceLabel = `computed ${sys} lattice (a=${params.a}${params.b ? ', b=' + params.b : ''}${params.c ? ', c=' + params.c : ''} Å)`;
        st.match = matchPeaks(observed, gen.lines, { tolerance: tol, source: st.refSourceLabel, assumptions: gen.assumptions });
      }
      refresh();
    } catch (e) { out.innerHTML = `<div class="notice">${esc(e.message)}</div>`; }
  });

  $('#xs-exp-svg').addEventListener('click', () => st.lastSvg && downloadText('nanosami_xrd.svg', st.lastSvg, 'image/svg+xml'));
  $('#xs-exp-csv').addEventListener('click', () => {
    if (!st.peaks.length) return;
    const matchByObs = new Map((st.match?.rows || []).map((r) => [r.observed2Theta, r]));
    const head = '# NanoSami XRD Studio peak table — FWHM are numerical estimates, hkl are reference matches, NOT phase identification\n' +
      `# lambda_A=${o.wavelength} K=${o.K} inst_fwhm_deg=${o.fwhmInst || 'none'} reference=${st.refSourceLabel || 'none'}\n` +
      '2theta_deg,intensity,fwhm_deg,d_A,scherrer_nm,hkl,delta_2theta_deg,match_status\n';
    downloadText('nanosami_xrd_peaks.csv', head + st.peaks.map((p) => {
      const mr = matchByObs.get(p.twoTheta);
      return [p.twoTheta.toFixed(4), p.intensity.toPrecision(5),
        p.fwhmDeg !== null ? p.fwhmDeg.toFixed(4) : '', p.d !== null ? p.d.toFixed(4) : '',
        p.sizeNm !== null ? p.sizeNm.toPrecision(4) : '',
        mr?.hkl ? mr.hkl.join('') : '', mr?.delta != null ? mr.delta.toFixed(4) : '', mr?.status || ''].join(',');
    }).join('\n'), 'text/csv');
  });
  $('#xs-exp-recipe').addEventListener('click', () => downloadText('nanosami_xrd_recipe.json', serializeRecipe(buildXrdRecipe()), 'application/json'));

  if (st.data) refresh();
}
