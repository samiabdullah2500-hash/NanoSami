/* Headless smoke test of the UI: renders every route in jsdom with a mocked
 * canvas context and exercises key interactions. Run: node tests/smoke_ui.mjs
 * (requires: npm install — jsdom is a declared devDependency). */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html, { url: 'http://localhost/#/home', runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

// Globals the app expects
for (const k of ['document', 'location', 'HTMLCanvasElement', 'FileReader', 'URLSearchParams', 'devicePixelRatio']) {
  globalThis[k] = window[k];
}
globalThis.addEventListener = window.addEventListener.bind(window);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {} });
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '#000' });
const ctxMock = new Proxy({}, { get: (t, p) => (p === 'canvas' ? {} : () => ctxMock) });
window.HTMLCanvasElement.prototype.getContext = () => ctxMock;
Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientWidth', { get: () => 800 });
Object.defineProperty(window.HTMLCanvasElement.prototype, 'clientHeight', { get: () => 300 });

let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log(`  ${cond ? '✓' : '✗'} ${name}`); };
const $ = (s) => window.document.querySelector(s);
const goto = (hash) => { window.location.hash = hash; window.dispatchEvent(new window.Event('hashchange')); };

await import('../js/app.js');

check('home renders hero + 8 tool cards (v0.4 adds Plotting & XRD studios)', $('#main .hero') && window.document.querySelectorAll('.tool-card').length === 8);

goto('#/ftir?tab=dictionary');
$('#wn').value = '1720'; $('#wn-go').click();
check('dictionary: 1720 returns a table with C=O', $('#wn-out table') && $('#wn-out').textContent.includes('C=O'));

goto('#/ftir?tab=analyzer');
$('#sp-demo').click();
check('analyzer: demo loads, plot panel visible', !$('#sp-panel').classList.contains('hide'));
check('analyzer: peaks table produced', $('#sp-peaks table') !== null);

goto('#/ftir?tab=identify');
$('#id-peaks').value = '3025, 2920, 1600, 1493, 1452, 756, 698'; $('#id-go').click();
check('identify: Polystyrene is the top result', ($('#id-out .result')?.textContent || '').includes('Polystyrene'));
check('identify: cautious wording present', $('#id-out').textContent.includes('most consistent with'));

goto('#/xrd');
$('#sc-2t').value = '36.25'; $('#sc-fwhm').value = '0.45'; $('#sc-go').click();
check('XRD: Scherrer result ≈18.58 nm with steps', $('#sc-out').textContent.includes('18.58 nm') && $('#sc-out .steps'));
$('#br-2t').value = '25.3'; $('#br-go').click();
check('XRD: Bragg result ≈3.52 Å', $('#br-out').textContent.includes('3.51') || $('#br-out').textContent.includes('3.52'));
$('#sc-fwhm').value = '-1'; $('#sc-go').click();
check('XRD: invalid FWHM shows an error notice', $('#sc-out .notice') !== null);

goto('#/calc');
$('#mol-m').value = '5.844'; $('#mol-mw').value = '58.44'; $('#mol-v').value = '1';
$('#main [data-calc="mol"]').click();
check('calculators: molarity 0.1 mol/L with steps', $('#out-mol').textContent.includes('0.10000') && $('#out-mol .steps'));

goto('#/library');
check('library: 12 material cards', window.document.querySelectorAll('.lib-card').length === 12);
goto('#/library?m=' + encodeURIComponent('ZnO'));
check('library: ZnO detail page shows wurtzite + caveat notice', $('#main').textContent.includes('wurtzite') && $('#main .notice'));

goto('#/about');
check('about: creator card with photo and credit', $('.creator-card img')?.getAttribute('src') === 'assets/creator_avatar.jpg' && $('#main').textContent.includes('Sami Abdullah Mohammed'));
check('about: privacy + disclaimer present', $('#main').textContent.includes('never leave your device') && $('#main').textContent.includes('preliminary'));

goto('#/ftir?tab=identify');
$('#id-peaks').value = '3025, 2920, 1600, 1493, 1452, 756, 698'; $('#id-go').click();
check('identify: confidence label shown', $('#id-out').textContent.includes('strong candidate'));
check('identify: one-to-one method described in UI', $('#main').textContent.includes('one-to-one'));

goto('#/ftir?tab=identify');
$('#id-peaks').value = '3430, 1630, 1420'; $('#id-go').click();
check('identify: environmental-only input shows essential-gate warning', $('#id-out').textContent.includes('cannot establish an identification'));

goto('#/ftir?tab=analyzer');
$('#sp-demo').click();
check('analyzer: export buttons rendered with peaks', $('#sp-export-csv') !== null && $('#sp-export-json') !== null);

goto('#/xrd');
$('#sc-2t').value = '36.25'; $('#sc-fwhm').value = '0.45'; $('#sc-inst').value = '0.2'; $('#sc-go').click();
check('XRD: instrumental correction step shown', $('#sc-out').textContent.includes('β(sample)'));
$('#sc-inst').value = '0.5'; $('#sc-go').click();
check('XRD: inst ≥ obs FWHM gives clear error', $('#sc-out .notice') !== null);

/* ---- v0.4 Plotting Studio: paste → map columns → import → plot ---- */
goto('#/plot');
check('plot studio: importer + paste box rendered', $('#main h1').textContent.includes('Plotting Studio') && window.document.querySelector('textarea[id$="-paste"]') !== null);
{
  const paste = window.document.querySelector('#main textarea[id$="-paste"]');
  paste.value = 'wavenumber,sampleA,sampleB\n400,1.0,0.5\n500,1.2,0.6\n600,5.0,2.5\n700,1.1,0.4\n800,0.9,0.6';
  window.document.querySelector('#main button[id$="-load"]').click();
  check('plot studio: header detected & mapper shown', $('#main [id$="-map"] table') !== null && $('#main').textContent.includes('Header detection'));
  // select both Y columns
  window.document.querySelectorAll('#main [id$="-ys"] input').forEach((cb, i) => { cb.checked = i > 0; });
  window.document.querySelector('#main button[id$="-import"]').click();
  check('plot studio: SVG plot with legend for two series', $('#ps-plot svg') !== null && $('#ps-plot').innerHTML.includes('sampleA') && $('#ps-plot').innerHTML.includes('sampleB'));
  check('plot studio: recipe + export buttons present', $('#ps-exp-recipe') !== null && $('#ps-exp-svg') !== null);
  check('plot studio: AI panel mounted, labelled optional, offline-safe wording', $('#ps-ai') && $('#ps-ai').textContent.includes('optional') && $('#ps-ai').textContent.includes('does not calculate'));
}

/* ---- v0.4 XRD Studio: import pattern → peaks → Miller matching ---- */
goto('#/xrdstudio');
{
  // synthetic ZnO-like pattern: three Gaussians at 31.8 / 34.4 / 36.3° on a flat background
  const rows = ['2theta,I'];
  for (let t = 25; t <= 45; t += 0.05) {
    const g = (c, s, A) => A * Math.exp(-((t - c) ** 2) / (2 * s * s));
    rows.push(`${t.toFixed(2)},${(10 + g(31.77, 0.12, 60) + g(34.42, 0.12, 45) + g(36.25, 0.12, 100)).toFixed(3)}`);
  }
  const paste = window.document.querySelector('#xs-import textarea[id$="-paste"]');
  paste.value = rows.join('\n');
  window.document.querySelector('#xs-import button[id$="-load"]').click();
  window.document.querySelector('#xs-import button[id$="-import"]').click();
  check('xrd studio: peak table with d and Scherrer columns', $('#xs-peaks table') !== null && $('#xs-peaks').textContent.includes('Scherrer'));
  check('xrd studio: three peaks detected', window.document.querySelectorAll('#xs-peaks tbody tr').length === 3);
  check('xrd studio: honest FWHM/size caveat shown', $('#xs-peaks').textContent.includes('Crystallite size ≠ particle size'));
  // Mode A: user reference list
  $('#xs-reflist').value = '31.77 100\n34.42 002\n36.25 101';
  $('#xs-refname').value = 'ZnO wurtzite (test reference)';
  $('#xs-match-go').click();
  const mt = $('#xs-match-out').textContent;
  check('xrd studio: Miller matching assigns (100)(002)(101) with Δ2θ + status', $('#xs-match-out table') !== null && mt.includes('(100)') && mt.includes('(002)') && mt.includes('(101)'));
  check('xrd studio: matching states reference + no-phase-ID caveat', mt.includes('ZnO wurtzite (test reference)') && /not.*(phase identification|proof)/i.test(mt));
  check('xrd studio: AI panel + recipe export present', $('#xs-ai h2') !== null && $('#xs-exp-recipe') !== null);
}

console.log(`\nSmoke test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
