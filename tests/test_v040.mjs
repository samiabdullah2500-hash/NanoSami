/* NanoSami v0.4.0 regression tests */
import { readFileSync } from 'node:fs';
import {
  parseTextTable, mapColumns, guessMapping, previewTable, detectDelimiter,
} from '../js/core/import.js';
import {
  smoothMovingAverage, normalizeMax, normalizeMinMax,
  applyChain, estimateFWHM,
} from '../js/core/processing.js';
import {
  detectXrdPeaks, enrichPeaks, assignHklFromReference, XRD_REFERENCES, peaksToCsv,
} from '../js/core/xrd_advanced.js';
import { createRecipe, recipeToJSON, recipeFromJSON, summarizeRecipe, APP_VERSION } from '../js/core/recipe.js';
import { buildAnalysisContext, contextToMarkdown } from '../js/core/ai_context.js';
import { scherrer, braggD } from '../js/core/xrd.js';

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
function approx(a, b, tol, msg = '') {
  if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ≈${b}, got ${a}`);
}
function throws(fn, msg = 'expected error') {
  let threw = false; try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg);
}

console.log('\n=== v0.4.0 Import ===');
t('parses multi-column CSV with header', () => {
  const txt = readFileSync(new URL('../sample_data/multi_column_demo.csv', import.meta.url), 'utf8');
  const table = parseTextTable(txt);
  if (table.columnCount !== 4) throw new Error('cols ' + table.columnCount);
  if (table.headers[0].toLowerCase() !== 'wavenumber') throw new Error('header ' + table.headers[0]);
});
t('guessMapping finds wavenumber + intensity-like columns', () => {
  const g = guessMapping(['wavenumber', 'sample_A', 'sample_B', 'background']);
  if (g.xCol !== 0) throw new Error('xCol ' + g.xCol);
  if (!g.yCols.includes(1)) throw new Error('yCols ' + g.yCols);
});
t('mapColumns multi-Y with sort and drop invalid', () => {
  const table = parseTextTable('x,y1,y2\n3,1,2\n1,4,5\n2,bad,7\n2,6,8');
  const m = mapColumns(table, { xCol: 0, yCols: [1, 2] });
  if (m.series.length !== 2) throw new Error('series');
  if (m.x[0] !== 1) throw new Error('not sorted');
});
t('rejects X=Y column', () => {
  const table = parseTextTable('a,b\n1,2\n3,4\n5,6');
  throws(() => mapColumns(table, { xCol: 0, yCols: [0] }));
});
t('detectDelimiter prefers tabs when present', () => {
  const d = detectDelimiter('a\tb\n1\t2\n3\t4');
  if (d !== '\t') throw new Error(String(d));
});
t('previewTable limits rows', () => {
  const table = parseTextTable('a,b\n' + Array.from({ length: 50 }, (_, i) => `${i},${i}`).join('\n'));
  const p = previewTable(table, 12);
  if (p.rows.length !== 12) throw new Error('preview len');
});

console.log('\n=== v0.4.0 Processing ===');
t('smoothMovingAverage preserves length', () => {
  const y = [1, 2, 3, 4, 5, 4, 3, 2, 1];
  const s = smoothMovingAverage(y, 3);
  if (s.length !== y.length) throw new Error('len');
});
t('normalizeMax peaks at 1', () => {
  approx(Math.max(...normalizeMax([0, 2, 4, 1])), 1, 1e-12);
});
t('normalizeMinMax to [0,1]', () => {
  const n = normalizeMinMax([10, 20, 30]);
  approx(n[0], 0, 1e-12); approx(n[2], 1, 1e-12);
});
t('applyChain records steps', () => {
  const r = applyChain([1, 2, 3], [1, 5, 1], [{ op: 'smooth', window: 3 }, { op: 'normalize_max' }]);
  if (r.steps.length !== 2) throw new Error('steps');
  approx(Math.max(...r.y), 1, 1e-9);
});
t('estimateFWHM on synthetic Gaussian', () => {
  const x = [], y = [];
  for (let i = 0; i <= 2000; i++) {
    const xv = i * 0.01;
    x.push(xv);
    y.push(0.05 + Math.exp(-((xv - 10) ** 2) / (2 * 1 ** 2)));
  }
  const fw = estimateFWHM(x, y, 1000);
  if (fw.fwhmX == null) throw new Error('null fwhm');
  approx(fw.fwhmX, 2.355, 0.4);
});

console.log('\n=== v0.4.0 Advanced XRD ===');
t('detectXrdPeaks finds major ZnO-like lines in synthetic', () => {
  const txt = readFileSync(new URL('../sample_data/synthetic_xrd_zno.csv', import.meta.url), 'utf8');
  const xs = [], ys = [];
  for (const line of txt.split(/\n/)) {
    if (!line || line.startsWith('#')) continue;
    const p = line.split(',').map(Number);
    if (p.length >= 2 && Number.isFinite(p[0])) { xs.push(p[0]); ys.push(p[1]); }
  }
  const peaks = detectXrdPeaks(xs, ys, { sensitivity: 0.55, minDistance: 0.35 });
  for (const expect of [31.77, 34.42, 36.25]) {
    if (!peaks.some((p) => Math.abs(p.twoTheta - expect) < 0.35)) throw new Error('missing ' + expect);
  }
});
t('enrichPeaks computes d and size', () => {
  const peaks = [{ twoTheta: 36.25, intensity: 100, prominence: 1, idx: 0, fwhmDeg: 0.45, label: '', hkl: null, dA: null, sizeNm: null }];
  const e = enrichPeaks(peaks, { wavelength: 1.5406 });
  approx(e[0].dA, braggD({ wavelength: 1.5406, twoTheta: 36.25 }).dA, 1e-6);
  approx(e[0].sizeNm, scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: 0.45 }).sizeNm, 0.05);
});
t('assignHklFromReference never invents; matches within tolerance', () => {
  const peaks = [
    { twoTheta: 36.25, intensity: 1, prominence: 1, idx: 0, fwhmDeg: 0.4, label: '', hkl: null, dA: null, sizeNm: null },
    { twoTheta: 31.77, intensity: 1, prominence: 1, idx: 1, fwhmDeg: 0.4, label: '', hkl: null, dA: null, sizeNm: null },
    { twoTheta: 40.0, intensity: 1, prominence: 1, idx: 2, fwhmDeg: 0.4, label: '', hkl: null, dA: null, sizeNm: null },
  ];
  const ref = XRD_REFERENCES.find((r) => r.id === 'zno_wurtzite');
  const r = assignHklFromReference(peaks, ref, { toleranceDeg: 0.3 });
  const p36 = r.peaks.find((p) => Math.abs(p.twoTheta - 36.25) < 0.01);
  if (p36.hkl !== '101') throw new Error('hkl ' + p36.hkl);
  const p40 = r.peaks.find((p) => Math.abs(p.twoTheta - 40) < 0.01);
  if (p40.hkl != null) throw new Error('should not assign hkl to unmatched');
});
t('assignHkl rejects missing reference reflections', () => {
  throws(() => assignHklFromReference([], {}));
});
t('peaksToCsv includes header', () => {
  const csv = peaksToCsv([{ twoTheta: 1, intensity: 2, fwhmDeg: 0.1, dA: 3, sizeNm: 10, hkl: '101', label: 'a' }]);
  if (!csv.includes('two_theta_deg') || !csv.includes('101')) throw new Error('csv');
});

console.log('\n=== v0.4.0 Recipe & AI context ===');
t('recipe round-trip JSON', () => {
  const r = createRecipe({ title: 'T', kind: 'xrd', peaks: [{ twoTheta: 1 }], parameters: { a: 1 } });
  if (r.app !== `NanoSami ${APP_VERSION}`) throw new Error(r.app);
  const back = recipeFromJSON(recipeToJSON(r));
  if (back.title !== 'T') throw new Error('title');
});
t('summarizeRecipe non-empty', () => {
  const s = summarizeRecipe(createRecipe({ title: 'Demo', processing: [{ op: 'smooth', description: 'smooth' }] }));
  if (!/Demo/.test(s) || !/smooth/.test(s)) throw new Error(s);
});
t('buildAnalysisContext + markdown', () => {
  const ctx = buildAnalysisContext({ kind: 'ftir', peaks: [{ x: 1720, y: 0.8 }], userQuestion: 'What is this band?' });
  const md = contextToMarkdown(ctx);
  if (!md.includes('NanoSami') || !md.includes('1720') || !md.includes('Do not invent')) throw new Error('context');
});
t('APP_VERSION is 0.4.0', () => {
  if (APP_VERSION !== '0.4.0') throw new Error(APP_VERSION);
});

console.log(`\n${pass} passed, ${fail} failed (v0.4.0 suite)\n`);
process.exit(fail ? 1 : 0);
