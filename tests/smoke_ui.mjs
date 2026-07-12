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

check('home renders hero + 6 tool cards', $('#main .hero') && window.document.querySelectorAll('.tool-card').length === 6);

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

console.log(`\nSmoke test: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
