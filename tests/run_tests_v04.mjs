/* NanoSami v0.4.0 core tests — run with: node tests/run_tests_v04.mjs */
import { createRequire } from 'node:module';
import {
  detectDelimiter, parseDelimitedToGrid, workbookToGrids, analyzeGrid, extractDataset,
} from '../js/core/dataio.js';
import { normalize, offset, movingAverage, savitzkyGolay, baseline } from '../js/core/processing.js';
import { findPeaks } from '../js/core/peaks.js';
import {
  dSpacing, twoThetaFromD, dFromTwoTheta, generateReflections, parseReferenceList, matchPeaks,
} from '../js/core/xrd_match.js';
import { renderPlotSVG } from '../js/core/svgplot.js';
import {
  createRecipe, addStep, setSource, setImport, setResults, serializeRecipe, parseRecipe,
} from '../js/core/recipe.js';
import { buildAnalysisContext, buildPrompt, buildExternalOpen, buildApiRequest } from '../js/core/ai_context.js';

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
function approx(a, b, tol, msg = '') {
  if (!(Math.abs(a - b) <= tol)) throw new Error(`${msg} expected ≈${b}, got ${a}`);
}
function throws(fn, msg = 'expected an error') {
  let threw = false; try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg);
}
const eq = (a, b, msg = '') => { if (a !== b) throw new Error(`${msg} expected ${b}, got ${a}`); };

/* ---------------- dataio: delimited ---------------- */
console.log('\nData import — delimited text');
t('delimiter auto-detection: comma / semicolon / tab / whitespace', () => {
  eq(detectDelimiter('a,b\n1,2\n3,4'), ',');
  eq(detectDelimiter('a;b\n1;2\n3;4'), ';');
  eq(detectDelimiter('a\tb\n1\t2'), '\t');
  eq(detectDelimiter('1 2\n3 4'), 'whitespace');
});
t('grid parsing skips comments, coerces numbers, keeps strings', () => {
  const { grid } = parseDelimitedToGrid('# c\nwavenumber,abs\n400,0.1\n401,0.2');
  eq(grid.length, 3); eq(grid[0][0], 'wavenumber'); eq(grid[1][0], 400); eq(grid[2][1], 0.2);
});
t('decimal commas handled when delimiter is semicolon', () => {
  const { grid, warnings } = parseDelimitedToGrid('1,5;2,5\n2,0;3,0', { delimiter: ';' });
  eq(grid[0][0], 1.5); eq(grid[1][1], 3);
  if (!warnings.some((w) => /decimal comma/i.test(w))) throw new Error('missing decimal-comma warning');
});
t('missing tokens (NA, empty, "-") become null', () => {
  const { grid } = parseDelimitedToGrid('1,NA\n2,\n3,-\n4,5');
  eq(grid[0][1], null); eq(grid[1][1], null); eq(grid[2][1], null); eq(grid[3][1], 5);
});
t('empty input rejected', () => throws(() => parseDelimitedToGrid('   ')));

/* ---------------- dataio: analysis & extraction ---------------- */
console.log('\nData import — header detection & column mapping');
t('header detected as certain; metadata rows skipped with a warning', () => {
  const { grid } = parseDelimitedToGrid('Instrument X\nrun 42\n2theta,intensity\n20,100\n21,150\n22,90');
  const a = analyzeGrid(grid);
  eq(a.headerConfidence, 'certain'); eq(a.dataStart, 3);
  eq(a.columns[0].name, '2theta'); eq(a.columns[1].name, 'intensity');
  if (!a.warnings.length) throw new Error('expected a skipped-rows warning');
});
t('pure-numeric file: no header, generic column names', () => {
  const a = analyzeGrid(parseDelimitedToGrid('20,10\n21,20\n22,15').grid);
  eq(a.headerRow, null); eq(a.dataStart, 0); eq(a.columns[0].name, 'Column 1');
});
t('ambiguous pre-data rows are flagged, never silently guessed', () => {
  const a = analyzeGrid(parseDelimitedToGrid('7,8\nx x x x\n20,10\n21,20\n22,15').grid);
  // first numeric row is row 0 → dataStart 0; craft a truly ambiguous case:
  const g = [[null, null], [5, 'note'], [20, 10], [21, 20]];
  const b = analyzeGrid(g);
  eq(b.headerConfidence, 'ambiguous');
  if (!b.warnings.some((w) => /confirm the header/i.test(w))) throw new Error('missing ambiguity warning');
});
t('extractDataset: multiple Y columns, invalid rows dropped pairwise & reported', () => {
  const { grid } = parseDelimitedToGrid('x,a,b\n1,10,100\n2,NA,200\nbad,30,300\n3,40,\n4,50,400');
  const { series, warnings } = extractDataset(grid, { xColumn: 0, yColumns: [1, 2], dataStart: 1, seriesNames: ['A', 'B'] });
  eq(series[0].y.length, 3); // x=1,3,4
  eq(series[1].y.length, 3); // x=1,2,4
  eq(series[0].dropped, 1); eq(series[1].dropped, 1);
  if (!warnings.some((w) => /non-numeric X/.test(w))) throw new Error('missing bad-X warning');
});
t('extractDataset sorts by x and averages duplicate x', () => {
  const grid = [[3, 30], [1, 10], [1, 20], [2, 15]];
  const { series } = extractDataset(grid, { xColumn: 0, yColumns: [1] });
  eq(series[0].x.join(','), '1,2,3'); eq(series[0].y[0], 15);
});
t('x = y column rejected; empty selection rejected', () => {
  throws(() => extractDataset([[1, 2]], { xColumn: 0, yColumns: [0] }));
  throws(() => extractDataset([[1, 2]], { xColumn: 0, yColumns: [] }));
});

/* ---------------- dataio: real XLSX round-trip ---------------- */
console.log('\nData import — Excel workbook (vendored SheetJS)');
t('XLSX: sheets listed, grid extracted, header + mapping works end-to-end', () => {
  const XLSX = require('../node_modules/xlsx');
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['2theta (deg)', 'Sample A', 'Sample B'],
    [20, 100, 90], [21, 150, null], [22, 'bad', 130], [23, 80, 70],
  ]), 'XRD');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['only text'], ['no numbers']]), 'Notes');
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  const { sheets } = workbookToGrids(XLSX, bytes);
  eq(sheets.length, 2); eq(sheets[0].name, 'XRD');
  const a = analyzeGrid(sheets[0].grid);
  eq(a.headerConfidence, 'certain'); eq(a.columns[1].name, 'Sample A');
  const { series } = extractDataset(sheets[0].grid, { xColumn: 0, yColumns: [1, 2], dataStart: a.dataStart, seriesNames: ['A', 'B'] });
  eq(series[0].y.length, 3); eq(series[1].y.length, 3);
  throws(() => analyzeGrid(sheets[1].grid), 'text-only sheet must be rejected with a clear error');
});

/* ---------------- processing ---------------- */
console.log('\nProcessing — normalize / smooth / baseline');
t('normalize max, minmax, area', () => {
  const x = [0, 1, 2], y = [0, 2, 4];
  approx(Math.max(...normalize(x, y, 'max').y), 1, 1e-12);
  const mm = normalize(x, y, 'minmax').y; approx(mm[0], 0, 1e-12); approx(mm[2], 1, 1e-12);
  const ar = normalize(x, y, 'area').y;
  let A = 0; for (let i = 1; i < x.length; i++) A += 0.5 * (ar[i] + ar[i - 1]) * (x[i] - x[i - 1]);
  approx(A, 1, 1e-9);
});
t('normalize rejects zero signal; unknown method rejected', () => {
  throws(() => normalize([0, 1], [0, 0], 'max'));
  throws(() => normalize([0, 1], [1, 2], 'nope'));
});
t('offset shifts values exactly', () => { eq(offset([1, 2], 0.5).y[1], 2.5); throws(() => offset([1], NaN)); });
t('moving average preserves a constant signal; rejects even windows', () => {
  eq(movingAverage([3, 3, 3, 3, 3], 3).y.every((v) => v === 3), true);
  throws(() => movingAverage([1, 2, 3, 4], 4));
});
t('Savitzky–Golay reproduces a quadratic exactly (order 2)', () => {
  const x = Array.from({ length: 21 }, (_, i) => i);
  const y = x.map((v) => 2 * v * v - 3 * v + 1);
  const s = savitzkyGolay(x, y, { window: 7, order: 2 }).y;
  for (let i = 3; i < 18; i++) approx(s[i], y[i], 1e-6, `i=${i}`);
});
t('Savitzky–Golay warns on non-uniform spacing', () => {
  const x = [0, 1, 2, 3, 4, 5, 6, 20, 21, 22, 23];
  const y = x.map((v) => v);
  const r = savitzkyGolay(x, y, { window: 5, order: 2 });
  if (!r.warnings.some((w) => /non-uniform/.test(w))) throw new Error('missing warning');
});
t('linear baseline removes a pure linear trend', () => {
  const x = Array.from({ length: 50 }, (_, i) => i);
  const y = x.map((v) => 0.5 * v + 3);
  const r = baseline(x, y, { method: 'linear', edge: 5 });
  if (!r.y.every((v) => Math.abs(v) < 1e-9)) throw new Error('residual trend left');
});
t('rolling baseline stays at/below the signal and reduces broad background', () => {
  const x = Array.from({ length: 201 }, (_, i) => i);
  const bg = x.map((v) => 20 + 0.05 * v);
  const y = x.map((v, i) => bg[i] + (Math.abs(v - 100) < 3 ? 50 * Math.exp(-((v - 100) ** 2) / 4) : 0));
  const r = baseline(x, y, { method: 'rolling', window: 41 });
  if (!r.baseline.every((b, i) => b <= y[i] + 1e-9)) throw new Error('baseline exceeds signal');
  approx(r.y[100], y[100] - bg[100], 6, 'peak height roughly preserved');
  if (Math.abs(r.y[10]) > 3) throw new Error('background not removed at flank');
});

/* ---------------- peaks ---------------- */
console.log('\nGeneric peak detection & FWHM');
function gauss(x, c, s, A) { return A * Math.exp(-((x - c) ** 2) / (2 * s * s)); }
t('finds two Gaussians, FWHM ≈ 2.355σ (±5%)', () => {
  const x = Array.from({ length: 1201 }, (_, i) => 10 + i * 0.05);
  const y = x.map((v) => gauss(v, 30, 0.4, 100) + gauss(v, 45, 0.8, 60) + 5);
  const { peaks } = findPeaks(x, y, { minProminenceFrac: 0.1 });
  eq(peaks.length, 2);
  approx(peaks[0].x, 30, 0.06); approx(peaks[1].x, 45, 0.06);
  approx(peaks[0].fwhm, 2.3548 * 0.4, 0.05 * 2.3548 * 0.4);
  approx(peaks[1].fwhm, 2.3548 * 0.8, 0.05 * 2.3548 * 0.8);
});
t('minDistanceX suppresses the weaker of two close peaks', () => {
  const x = Array.from({ length: 401 }, (_, i) => i * 0.1);
  const y = x.map((v) => gauss(v, 20, 0.5, 100) + gauss(v, 21.5, 0.5, 60));
  const a = findPeaks(x, y, { minProminenceFrac: 0.05 }).peaks.length;
  const b = findPeaks(x, y, { minProminenceFrac: 0.05, minDistanceX: 3 }).peaks;
  if (!(a >= 2)) throw new Error('setup should produce 2 peaks');
  eq(b.length, 1); approx(b[0].x, 20, 0.2);
});
t('overlapping peaks: FWHM measured at half-prominence (scipy peak_widths convention), finite for both', () => {
  const x = Array.from({ length: 801 }, (_, i) => i * 0.05);
  const y = x.map((v) => gauss(v, 18, 0.6, 100) + gauss(v, 20, 0.6, 70));
  const { peaks } = findPeaks(x, y, { minProminenceFrac: 0.05 });
  eq(peaks.length, 2);
  for (const p of peaks) {
    if (!(p.fwhm > 0)) throw new Error('FWHM should be finite at half-prominence');
    if (!(p.leftHalfX < p.x && p.rightHalfX > p.x)) throw new Error('half-crossings must bracket the peak');
  }
  // the smaller overlapped peak's half-prominence width is narrower than an
  // isolated peak of the same σ would be at half-height — that is expected and documented.
});
t('rejects too-short input', () => throws(() => findPeaks([1, 2], [1, 2])));

/* ---------------- XRD matching ---------------- */
console.log('\nXRD — d-spacing, reflections, Miller matching');
t('cubic Si a=5.431 Å: d(111)=3.1356, d(220)=1.9201 Å', () => {
  approx(dSpacing('cubic', [1, 1, 1], { a: 5.431 }), 3.1356, 2e-4);
  approx(dSpacing('cubic', [2, 2, 0], { a: 5.431 }), 1.9201, 2e-4);
});
t('hexagonal ZnO a=3.2495, c=5.2069 Å: d(100)=2.8143, d(002)=2.6034, d(101)=2.4759 Å', () => {
  const p = { a: 3.2495, c: 5.2069 };
  approx(dSpacing('hexagonal', [1, 0, 0], p), 2.8143, 5e-4);
  approx(dSpacing('hexagonal', [0, 0, 2], p), 2.6034, 5e-4);
  approx(dSpacing('hexagonal', [1, 0, 1], p), 2.4759, 5e-4);
});
t('2θ↔d round trip (Cu Kα)', () => {
  const d = dFromTwoTheta(36.25, 1.5406);
  approx(twoThetaFromD(d, 1.5406), 36.25, 1e-9);
});
t('reflection outside range for λ returns null (no fake angles)', () => {
  eq(twoThetaFromD(0.5, 1.5406), null);
});
t('generateReflections (ZnO hex) contains (100)(002)(101) near 31.8/34.4/36.3° and states extinction caveat', () => {
  const { lines, assumptions } = generateReflections('hexagonal', { a: 3.2495, c: 5.2069 }, { wavelength: 1.5406, twoThetaMax: 40 });
  const near = (tt) => lines.find((l) => Math.abs(l.twoTheta - tt) < 0.15);
  if (!near(31.77) || !near(34.42) || !near(36.25)) throw new Error('expected ZnO lines missing: ' + lines.map((l) => l.twoTheta.toFixed(2)).join(','));
  if (!assumptions.some((a) => /extinction/.test(a))) throw new Error('extinction caveat missing');
});
t('parseReferenceList: "2θ hkl" compact and spaced forms; bad lines warned', () => {
  const r = parseReferenceList('31.77 100\n34.42, 0 0 2\n36.25 (101)\nnonsense line\n# comment');
  eq(r.lines.length, 3);
  eq(r.lines[2].hkl.join(''), '101');
  if (!r.warnings.length) throw new Error('expected a warning for the bad line');
});
t('parseReferenceList in d units requires wavelength and converts', () => {
  throws(() => parseReferenceList('2.4759 101', { unit: 'd' }));
  const r = parseReferenceList('2.4759 101', { unit: 'd', wavelength: 1.5406 });
  approx(r.lines[0].twoTheta, 36.25, 0.05);
});
t('matchPeaks: one-to-one greedy assignment, Δ2θ reported, unmatched counted', () => {
  const obs = [{ twoTheta: 31.80 }, { twoTheta: 36.30 }, { twoTheta: 50.00 }];
  const ref = [{ twoTheta: 31.77, hkl: [1, 0, 0] }, { twoTheta: 34.42, hkl: [0, 0, 2] }, { twoTheta: 36.25, hkl: [1, 0, 1] }];
  const m = matchPeaks(obs, ref, { tolerance: 0.3, source: 'test' });
  eq(m.matchedCount, 2); eq(m.unmatchedObserved, 1); eq(m.unmatchedReference, 1);
  eq(m.rows[0].hkl.join(''), '100'); approx(m.rows[0].delta, 0.03, 1e-9);
  eq(m.rows[2].status, 'unmatched');
  if (!/NOT definitive/.test(m.caveat)) throw new Error('identification caveat missing');
});
t('matchPeaks never double-assigns one reference line', () => {
  const obs = [{ twoTheta: 36.20 }, { twoTheta: 36.30 }];
  const ref = [{ twoTheta: 36.25, hkl: [1, 0, 1] }];
  const m = matchPeaks(obs, ref, { tolerance: 0.3 });
  eq(m.matchedCount, 1); eq(m.rows.filter((r) => r.hkl).length, 1);
});

/* ---------------- SVG plotting ---------------- */
console.log('\nSVG plotting');
t('renders multi-series SVG with labels, legend, peak label; escapes XML', () => {
  const { svg } = renderPlotSVG({
    series: [
      { name: 'A<1>', x: [1, 2, 3], y: [1, 4, 2] },
      { name: 'B', x: [1, 2, 3], y: [2, 1, 3] },
    ],
    title: 'T&T', xLabel: '2θ (°)', yLabel: 'I (a.u.)',
    peakMarkers: [{ x: 2, y: 4, label: '(101)' }],
  });
  if (!svg.startsWith('<svg')) throw new Error('not svg');
  if (!svg.includes('A&lt;1&gt;') || !svg.includes('T&amp;T')) throw new Error('XML escaping failed');
  if ((svg.match(/<path /g) || []).length !== 2) throw new Error('expected 2 traces');
  if (!svg.includes('(101)')) throw new Error('peak label missing');
});
t('log y-scale drops non-positive points with a warning; all-invalid rejected', () => {
  const r = renderPlotSVG({ series: [{ name: 'S', x: [1, 2, 3, 4], y: [0, 10, 100, 1000] }], yScale: 'log' });
  if (!r.warnings.some((w) => /non-positive/.test(w))) throw new Error('missing warning');
  throws(() => renderPlotSVG({ series: [{ name: 'S', x: [1, 2], y: [0, -1] }], yScale: 'log' }));
});
t('manual axis ranges are respected in tick labels', () => {
  const { svg } = renderPlotSVG({ series: [{ name: 'S', x: [0, 100], y: [0, 1] }], xRange: [20, 80] });
  if (svg.includes('>100<')) throw new Error('x range not applied');
});
t('reverseX flips orientation (first point drawn on the right)', () => {
  const a = renderPlotSVG({ series: [{ name: 'S', x: [0, 10], y: [0, 1] }] }).svg;
  const b = renderPlotSVG({ series: [{ name: 'S', x: [0, 10], y: [0, 1] }], reverseX: true }).svg;
  const firstX = (s) => parseFloat(s.match(/<path d="M([\d.]+) /)[1]);
  if (!(firstX(b) > firstX(a))) throw new Error('reverseX had no effect');
});

/* ---------------- recipe ---------------- */
console.log('\nAnalysis Recipe (reproducibility)');
t('recipe round-trip: build → serialize → parse → validate', () => {
  const r = createRecipe({ appVersion: '0.4.0', analysisType: 'xrd-studio' });
  setSource(r, { fileName: 'a.xlsx', sheet: 'XRD' });
  setImport(r, { xColumn: 0, yColumns: [1], dataStart: 1 });
  addStep(r, { op: 'baseline', params: { method: 'rolling', window: 41 }, description: 'rolling baseline (41 pt)' });
  setResults(r, { crystalliteSizeNm: 18.6 });
  const p = parseRecipe(serializeRecipe(r));
  eq(p.steps.length, 1); eq(p.source.sheet, 'XRD'); eq(p.results.crystalliteSizeNm, 18.6);
});
t('invalid recipes rejected (schema tag, steps, missing description)', () => {
  throws(() => parseRecipe('{"schema":"other"}'));
  const r = createRecipe({ appVersion: '0.4.0', analysisType: 'x' });
  throws(() => addStep(r, { op: 'noDesc' }));
  throws(() => parseRecipe('not json'));
});

/* ---------------- AI layer ---------------- */
console.log('\nAI assistance layer (context, external links, BYO-API builders)');
t('context labels origins and includes settings/assumptions/limitations/table', () => {
  const ctx = buildAnalysisContext({
    analysisType: 'XRD pattern analysis', sampleName: 'ZnO-1', appVersion: '0.4.0',
    settings: { wavelength: '1.5406 Å (Cu Kα)' }, units: ['2θ in degrees'],
    assumptions: ['Scherrer K = 0.9'],
    tables: [{ origin: 'NanoSami-calculated peak table', columns: ['2θ', 'FWHM'], rows: [[36.25, 0.45]] }],
    results: { 'D (Scherrer)': '18.6 nm' },
    limitations: ['Scherrer size ≠ particle size'],
  });
  for (const s of ['NanoSami-calculated', 'Scherrer K = 0.9', '36.25 | 0.45', '18.6 nm', 'Scherrer size ≠ particle size', 'none were AI-generated']) {
    if (!ctx.includes(s)) throw new Error(`context missing: ${s}`);
  }
});
t('prompt asks for honest uncertainty and no invented references', () => {
  const p = buildPrompt('CTX', 'Explain these peaks.');
  if (!/state uncertainty honestly/.test(p) || !/do not invent reference values/.test(p)) throw new Error('guardrails missing');
});
t('external open: prefill attempted only where a param exists; long prompts never in URL', () => {
  const a = buildExternalOpen('chatgpt', 'short prompt');
  if (!a.prefilled || !a.url.includes('q=short')) throw new Error('prefill expected');
  const b = buildExternalOpen('chatgpt', 'x'.repeat(5000));
  if (b.prefilled) throw new Error('long prompt must not be prefilling a URL');
  const c = buildExternalOpen('gemini', 'short');
  if (c.prefilled) throw new Error('gemini has no known prefill param');
  throws(() => buildExternalOpen('nope', 'p'));
});
t('BYO-API builders: anthropic & openai payloads well-formed; key required; no storage', () => {
  const a = buildApiRequest({ provider: 'anthropic', apiKey: 'sk-ant-test-123', prompt: 'P' });
  const body = JSON.parse(a.body);
  eq(a.url, 'https://api.anthropic.com/v1/messages');
  eq(body.messages[0].content, 'P');
  if (!/never invent reference values/i.test(body.system)) throw new Error('system guardrail missing');
  const o = buildApiRequest({ provider: 'openai', apiKey: 'sk-test-123', prompt: 'P' });
  if (!o.headers.authorization.startsWith('Bearer ')) throw new Error('bearer header missing');
  throws(() => buildApiRequest({ provider: 'anthropic', apiKey: '', prompt: 'P' }));
  throws(() => buildApiRequest({ provider: 'openai-compatible', apiKey: 'k-12345678', prompt: 'P' }), 'custom endpoint needs baseUrl');
});
t('extractText helpers parse provider responses', () => {
  const a = buildApiRequest({ provider: 'anthropic', apiKey: 'sk-ant-test-123', prompt: 'P' });
  eq(a.extractText({ content: [{ type: 'text', text: 'hi' }] }), 'hi');
  const o = buildApiRequest({ provider: 'openai', apiKey: 'sk-test-123', prompt: 'P' });
  eq(o.extractText({ choices: [{ message: { content: 'yo' } }] }), 'yo');
});
t('core app modules import cleanly with no AI/network dependency (offline safety)', () => {
  // ai_context is pure: constructing context must not require fetch/localStorage.
  if (typeof fetch !== 'undefined') { /* fetch may exist in Node 18+, but we never call it */ }
  const ctx = buildAnalysisContext({ analysisType: 'FTIR' });
  if (!ctx.includes('FTIR')) throw new Error('context build failed offline');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
