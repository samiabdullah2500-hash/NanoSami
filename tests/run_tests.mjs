/* NanoSami test suite — run with:  node tests/run_tests.mjs  */
import { readFileSync } from 'node:fs';
import { scherrer, braggD, deg2rad } from '../js/core/xrd.js';
import * as chem from '../js/core/chem.js';
import { parseSpectrumText, detectPeaks } from '../js/core/spectrum.js';
import { lookupWavenumber, matchMaterials, confidenceLabel, ALGORITHM_VERSION } from '../js/core/matcher.js';
import FTIR_DICT from '../data/ftir_peaks.js';
import MATERIALS from '../data/materials_ftir.js';

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}
function approx(a, b, tol, msg = '') {
  if (Math.abs(a - b) > tol) throw new Error(`${msg} expected ≈${b}, got ${a}`);
}
function throws(fn, msg = 'expected an error') {
  let threw = false; try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(msg);
}

console.log('\nXRD — Scherrer equation');
t('ZnO(101): λ=1.5406 Å, 2θ=36.25°, β=0.45°, K=0.9 → ≈18.6 nm', () => {
  const r = scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: 0.45 });
  // hand check: β=0.007854 rad, θ=18.125°, cosθ=0.95039 → D=185.77 Å
  approx(r.sizeNm, 18.58, 0.05);
});
t('FWHM given in radians gives the same result', () => {
  const a = scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: 0.45 });
  const b = scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: deg2rad(0.45), fwhmUnit: 'rad' });
  approx(a.sizeNm, b.sizeNm, 1e-9);
});
t('rejects zero/negative FWHM and out-of-range 2θ', () => {
  throws(() => scherrer({ wavelength: 1.5406, twoTheta: 36, fwhm: 0 }));
  throws(() => scherrer({ wavelength: 1.5406, twoTheta: 190, fwhm: 0.4 }));
  throws(() => scherrer({ wavelength: 1.5406, twoTheta: 36, fwhm: NaN }));
});

console.log('\nXRD — Bragg d-spacing');
t('anatase (101): λ=1.5406 Å, 2θ=25.3° → d≈3.52 Å', () => {
  approx(braggD({ wavelength: 1.5406, twoTheta: 25.3 }).dA, 3.52, 0.01);
});
t('2θ=90° gives d = λ/√2', () => {
  approx(braggD({ wavelength: 1.5406, twoTheta: 90 }).dA, 1.5406 / Math.SQRT2, 1e-6);
});
t('rejects non-integer order n', () => throws(() => braggD({ wavelength: 1.54, twoTheta: 30, n: 1.5 })));

console.log('\nUnit conversions');
t('deg2rad(180) = π', () => approx(deg2rad(180), Math.PI, 1e-12));

console.log('\nChemistry calculators');
t('molarity: 5.844 g NaCl (58.44) in 1 L → 0.1 M', () => {
  approx(chem.molarity({ massG: 5.844, molarMass: 58.44, volumeL: 1 }).molarity, 0.1, 1e-6);
});
t('solute mass: 0.1 M × 0.25 L × 58.44 → 1.461 g', () => {
  approx(chem.soluteMass({ molarityM: 0.1, volumeL: 0.25, molarMass: 58.44 }).massG, 1.461, 1e-3);
});
t('dilution solves the missing variable (V1 = C2V2/C1)', () => {
  const r = chem.dilution({ c1: 1, v1: null, c2: 0.1, v2: 100 });
  if (r.target !== 'v1') throw new Error('wrong target');
  approx(r.value, 10, 1e-9);
});
t('dilution rejects 2 unknowns', () => throws(() => chem.dilution({ c1: 1, v1: null, c2: null, v2: 100 })));
t('weight percent 2/50 → 4%', () => approx(chem.weightPercent({ componentMass: 2, totalMass: 50 }).wtPercent, 4, 1e-9));
t('weight percent rejects component > total', () => throws(() => chem.weightPercent({ componentMass: 60, totalMass: 50 })));
t('atomic percent sums to 100', () => {
  const r = chem.atomicPercent([0.5, 0.5, 1]);
  approx(r.atPercents.reduce((a, b) => a + b, 0), 100, 1e-9);
  approx(r.atPercents[2], 50, 1e-9);
});
t('precursor: 1 g ZnO (81.38) from Zn(NO₃)₂·6H₂O (297.49) → ≈3.656 g', () => {
  approx(chem.precursorMass({ productMassG: 1, productMW: 81.38, precursorMW: 297.49, moleRatio: 1 }).precursorMassG, 3.6556, 1e-3);
});
t('fuel ratio: Zn(NO₃)₂ (10) with urea (6) → 1.667 mol', () => {
  approx(chem.fuelRatio({ oxidizerValenceTotal: 10, fuelValencePerMole: 6 }).molesFuelPerMolePrecursor, 1.6667, 1e-3);
});

console.log('\nSpectrum parsing & validation');
t('parses CSV with header, sorts ascending', () => {
  const r = parseSpectrumText('wavenumber,absorbance\n1000,0.5\n4000,0.1\n2000,0.2');
  if (r.x[0] !== 1000 || r.x[2] !== 4000) throw new Error('not sorted');
  if (r.mode !== 'absorbance') throw new Error('header mode not detected');
});
t('detects transmittance from header', () => {
  const r = parseSpectrumText('wavenumber;transmittance\n1000;90\n2000;85');
  if (r.mode !== 'transmittance') throw new Error('mode ' + r.mode);
});
t('auto-detects transmittance from 0–100 top-heavy values', () => {
  let s = '';
  for (let w = 400; w <= 4000; w += 10) s += `${w} ${w > 1500 && w < 1550 ? 40 : 95}\n`;
  const r = parseSpectrumText(s);
  if (r.mode !== 'transmittance') throw new Error('mode ' + r.mode);
});
t('rejects empty input', () => throws(() => parseSpectrumText('')));
t('rejects file with a missing column (real sample file)', () => {
  const txt = readFileSync(new URL('../sample_data/invalid_missing_column.csv', import.meta.url), 'utf8');
  throws(() => parseSpectrumText(txt));
});
t('skips non-numeric junk rows with warning', () => {
  const r = parseSpectrumText('1000,0.1\n2000,0.2\nhello,world\n3000,0.3\n1500,0.15\n2500,0.25\n3500,0.35\n1200,0.12\n1800,0.18\n2200,0.22\n2800,0.28');
  if (r.x.length !== 10) throw new Error('rows ' + r.x.length);
});

console.log('\nPeak detection');
t('finds all major bands in the synthetic polystyrene sample (absorbance)', () => {
  const txt = readFileSync(new URL('../sample_data/synthetic_polystyrene_absorbance.csv', import.meta.url), 'utf8');
  const { x, y, mode } = parseSpectrumText(txt);
  const peaks = detectPeaks(x, y, { mode, sensitivity: 0.7 });
  for (const expect of [3025, 2920, 1600, 1493, 756, 698]) {
    if (!peaks.some((p) => Math.abs(p.wavenumber - expect) <= 8)) throw new Error(`missing peak near ${expect}`);
  }
});
t('finds dips as peaks in the synthetic ZnO transmittance sample', () => {
  const txt = readFileSync(new URL('../sample_data/synthetic_zno_transmittance.csv', import.meta.url), 'utf8');
  const { x, y, mode } = parseSpectrumText(txt);
  if (mode !== 'transmittance') throw new Error('mode not detected: ' + mode);
  const peaks = detectPeaks(x, y, { mode, sensitivity: 0.7 });
  for (const expect of [3430, 1630, 450]) {
    if (!peaks.some((p) => Math.abs(p.wavenumber - expect) <= 12)) throw new Error(`missing band near ${expect}`);
  }
});
t('flat signal yields no peaks; too-short input rejected', () => {
  const x = Array.from({ length: 50 }, (_, i) => 400 + i * 10);
  if (detectPeaks(x, x.map(() => 1), {}).length !== 0) throw new Error('phantom peaks');
  throws(() => detectPeaks([1, 2], [1, 2], {}));
});

console.log('\nFTIR dictionary lookup');
t('1720 cm⁻¹ returns carbonyl C=O as a top match', () => {
  const r = lookupWavenumber(FTIR_DICT, 1720);
  if (!r.length || !/C=O/.test(r[0].bond)) throw new Error('top: ' + (r[0] && r[0].bond));
});
t('match types: 2920 exact, edge value → range/possible', () => {
  const a = lookupWavenumber(FTIR_DICT, 2920);
  if (a[0].matchType !== 'exact') throw new Error('2920 type ' + a[0].matchType);
  const b = lookupWavenumber(FTIR_DICT, 2995, { tolerance: 10 });
  if (!b.some((e) => e.matchType === 'possible' || e.matchType === 'range')) throw new Error('no soft match');
});
t('rejects nonsense wavenumbers', () => { throws(() => lookupWavenumber(FTIR_DICT, NaN)); throws(() => lookupWavenumber(FTIR_DICT, 99999)); });

console.log('\nMaterial similarity scoring');
t('polystyrene peak list ranks Polystyrene first with high score', () => {
  const res = matchMaterials(MATERIALS, [3025, 2920, 1600, 1493, 1452, 756, 698], { tolerance: 10 });
  if (!/Polystyrene/.test(res[0].material)) throw new Error('top: ' + res[0].material);
  if (res[0].score < 85) throw new Error('score too low: ' + res[0].score);
});
t('ZnO-like peak list ranks ZnO first', () => {
  const res = matchMaterials(MATERIALS, [3430, 1630, 1420, 450], { tolerance: 10 });
  if (!/ZnO/.test(res[0].material)) throw new Error('top: ' + res[0].material);
});
t('unexplained peaks lower the score (penalty applied)', () => {
  const clean = matchMaterials(MATERIALS, [2915, 2848, 1465, 719], { tolerance: 10 })[0];
  const noisy = matchMaterials(MATERIALS, [2915, 2848, 1465, 719, 3300, 2100, 990], { tolerance: 10 })
    .find((r) => r.material === clean.material);
  if (!(noisy.score < clean.score)) throw new Error(`penalty not applied: ${noisy.score} vs ${clean.score}`);
});
t('rejects empty peak list and silly tolerance', () => {
  throws(() => matchMaterials(MATERIALS, []));
  throws(() => matchMaterials(MATERIALS, [1000], { tolerance: 500 }));
});


console.log('\nAlgorithm v2 regressions (matcher rebuild)');
const TWIN = [{ name: 'Twin', formula: 'X', class: 'test', peaks: [
  { wavenumber: 1600, label: 'a', essential: true },
  { wavenumber: 1606, label: 'b', essential: true },
]}];
t('one-to-one: a single detected peak cannot satisfy two reference peaks', () => {
  const r = matchMaterials(TWIN, [1602], { tolerance: 10 })[0];
  if (r.matched.length !== 1) throw new Error('matched ' + r.matched.length);
  if (r.missing.length !== 1) throw new Error('missing ' + r.missing.length);
  if (r.score >= 60) throw new Error('inflated score ' + r.score);
});
t('one-to-one: two detected peaks satisfy both twins', () => {
  const r = matchMaterials(TWIN, [1600, 1606], { tolerance: 10 })[0];
  if (r.matched.length !== 2) throw new Error('matched ' + r.matched.length);
});
t('environmental-only bands cannot establish ZnO (essential gate)', () => {
  const r = matchMaterials(MATERIALS, [3430, 1630, 1420], { tolerance: 10 })
    .find((x) => /ZnO/.test(x.material));
  if (!r.noEssential) throw new Error('gate not triggered');
  if (r.score > 25) throw new Error('score ' + r.score + ' exceeds cap');
  if (r.confidence === 'strong candidate' || r.confidence === 'moderate candidate') throw new Error('confidence too high');
});
t('proximity factor: exact match scores higher than near-tolerance match', () => {
  const exact = matchMaterials(MATERIALS, [450, 3430, 1630, 1420], { tolerance: 10 }).find((x) => /ZnO/.test(x.material));
  const off = matchMaterials(MATERIALS, [459, 3430, 1630, 1420], { tolerance: 10 }).find((x) => /ZnO/.test(x.material));
  if (!(exact.score > off.score)) throw new Error(`${exact.score} !> ${off.score}`);
});
t('ambiguity flag set when top two candidates are within 10 points', () => {
  const A = { name: 'A', formula: 'A', class: 't', peaks: [{ wavenumber: 1000, label: 'x', essential: true }] };
  const B = { name: 'B', formula: 'B', class: 't', peaks: [{ wavenumber: 1004, label: 'x', essential: true }] };
  const r = matchMaterials([A, B], [1002], { tolerance: 10 });
  if (!(r[0].ambiguous && r[1].ambiguous)) throw new Error('not flagged');
});
t('scoring is deterministic (identical repeat runs)', () => {
  const a = JSON.stringify(matchMaterials(MATERIALS, [2915, 2848, 1465, 719], { tolerance: 10 }));
  const b = JSON.stringify(matchMaterials(MATERIALS, [2915, 2848, 1465, 719], { tolerance: 10 }));
  if (a !== b) throw new Error('non-deterministic');
});
t('confidence labels map correctly', () => {
  if (confidenceLabel(80) !== 'strong candidate') throw new Error('80');
  if (confidenceLabel(60) !== 'moderate candidate') throw new Error('60');
  if (confidenceLabel(30) !== 'weak candidate') throw new Error('30');
  if (confidenceLabel(10) !== 'insufficient evidence') throw new Error('10');
  if (ALGORITHM_VERSION !== 2) throw new Error('version');
});
t('NaN and Infinity peak entries are ignored, all-invalid list rejected', () => {
  const r = matchMaterials(MATERIALS, [2915, NaN, Infinity, 2848, 1465, 719], { tolerance: 10 })[0];
  if (!/Polyethylene/.test(r.material)) throw new Error(r.material);
  throws(() => matchMaterials(MATERIALS, [NaN, Infinity]));
});

console.log('\nParser hardening regressions');
t('Infinity / NaN rows in CSV are skipped', () => {
  const r = parseSpectrumText('1000,0.1\n2000,Infinity\n3000,NaN\n1500,0.2\n2500,0.3\n1200,0.1\n1800,0.2\n2200,0.25\n2800,0.28\n3200,0.3\n3400,0.31');
  if (r.y.some((v) => !Number.isFinite(v))) throw new Error('non-finite y kept');
});
t('unsorted input with duplicate wavenumbers → sorted, deduplicated (mean)', () => {
  const r = parseSpectrumText('2000,0.4\n1000,0.1\n2000,0.2\n1500,0.2\n3000,0.5\n1200,0.1\n1800,0.2\n2200,0.25\n2800,0.28\n3200,0.3\n3400,0.31');
  for (let i = 1; i < r.x.length; i++) if (r.x[i] <= r.x[i - 1]) throw new Error('not strictly ascending');
  const at2000 = r.y[r.x.indexOf(2000)];
  approx(at2000, 0.3, 1e-9, 'mean of duplicates');
});

console.log('\nScherrer instrumental broadening correction');
t('β = √(β²obs − β²inst) matches direct calculation', () => {
  const corrected = scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: 0.45, fwhmInst: 0.2 });
  const direct = scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: Math.sqrt(0.45 ** 2 - 0.2 ** 2) });
  approx(corrected.sizeNm, direct.sizeNm, 1e-9);
  if (!(corrected.sizeNm > 18.58)) throw new Error('correction should increase size');
});
t('instrumental FWHM ≥ observed FWHM is rejected; negative rejected', () => {
  throws(() => scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: 0.45, fwhmInst: 0.45 }));
  throws(() => scherrer({ wavelength: 1.5406, twoTheta: 36.25, fwhm: 0.45, fwhmInst: -0.1 }));
});
t('swapped-column file triggers a warning', () => {
  let txt = '';
  for (let i = 0; i < 20; i++) txt += `${(0.1 + i * 0.01).toFixed(2)},${1000 + i * 100}\n`;
  const r = parseSpectrumText(txt);
  if (!r.warnings.some((w) => w.includes('swapped'))) throw new Error('no swap warning');
});
t('dilution warns when V1 > V2 (concentration step)', () => {
  const r = chem.dilution({ c1: 0.1, v1: 100, c2: 1, v2: null });
  if (!r.steps.some((x) => x.includes('concentration step'))) throw new Error('no warning');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
