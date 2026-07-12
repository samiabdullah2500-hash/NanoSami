/**
 * NanoSami — XRD core calculations.
 * Pure functions, no UI. Used by the app and by Node unit tests.
 *
 * Scherrer:  D = K·λ / (β·cosθ)
 *   D  crystallite size (same length unit as λ)
 *   K  shape factor (dimensionless, commonly 0.9)
 *   λ  X-ray wavelength
 *   β  FWHM of the peak in RADIANS (2θ scale)
 *   θ  Bragg angle in RADIANS (= 2θ/2)
 *
 * Bragg:  nλ = 2·d·sinθ  →  d = nλ / (2·sinθ)
 */

export const WAVELENGTHS = {
  'Cu Kα (1.5406 Å)': 1.5406,
  'Cu Kα mean (1.5418 Å)': 1.5418,
  'Co Kα (1.7890 Å)': 1.789,
  'Cr Kα (2.2897 Å)': 2.2897,
  'Mo Kα (0.7107 Å)': 0.7107,
  'Fe Kα (1.9373 Å)': 1.9373,
};

export const deg2rad = (deg) => (deg * Math.PI) / 180;
export const rad2deg = (rad) => (rad * 180) / Math.PI;

function assertFinite(name, v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`${name} must be a finite number (got ${v}).`);
  }
}

/**
 * Scherrer crystallite size.
 * @param {object} p
 * @param {number} p.wavelength  λ in Å
 * @param {number} p.twoTheta    peak position 2θ in DEGREES (0 < 2θ < 180)
 * @param {number} p.fwhm        FWHM in the unit given by fwhmUnit
 * @param {string} [p.fwhmUnit]  'deg' (default) or 'rad'
 * @param {number} [p.K]         shape factor, default 0.9
 * @param {number} [p.fwhmInst]  optional instrumental FWHM (same unit as fwhm);
 *                               corrected as β = √(β²obs − β²inst) — valid for
 *                               Gaussian-dominated profiles (β = βobs − βinst
 *                               would apply to pure Lorentzian; we use the
 *                               quadratic form and state the assumption).
 * @returns {{sizeA:number, sizeNm:number, betaRad:number, thetaRad:number, steps:string[]}}
 */
export function scherrer({ wavelength, twoTheta, fwhm, fwhmUnit = 'deg', K = 0.9, fwhmInst = null }) {
  assertFinite('Wavelength λ', wavelength);
  assertFinite('Peak position 2θ', twoTheta);
  assertFinite('FWHM β', fwhm);
  assertFinite('Shape factor K', K);
  if (wavelength <= 0) throw new Error('Wavelength λ must be positive.');
  if (twoTheta <= 0 || twoTheta >= 180) throw new Error('2θ must be between 0° and 180°.');
  if (fwhm <= 0) throw new Error('FWHM must be positive.');
  if (K <= 0 || K > 2) throw new Error('Shape factor K is normally between 0.6 and 2 (commonly 0.9).');

  const steps = [];
  let fwhmUse = fwhm;
  if (fwhmInst !== null && fwhmInst !== undefined && fwhmInst !== '') {
    assertFinite('Instrumental FWHM', fwhmInst);
    if (fwhmInst < 0) throw new Error('Instrumental FWHM cannot be negative.');
    if (fwhmInst >= fwhm) throw new Error('Instrumental FWHM must be smaller than the observed FWHM — otherwise the sample broadening is zero or undefined and no size can be computed.');
    fwhmUse = Math.sqrt(fwhm * fwhm - fwhmInst * fwhmInst);
    steps.push(`β(sample) = √(β²obs − β²inst) = √(${fwhm}² − ${fwhmInst}²) = ${fwhmUse.toPrecision(5)} (Gaussian-profile assumption)`);
  }

  const betaRad = fwhmUnit === 'rad' ? fwhmUse : deg2rad(fwhmUse);
  const thetaRad = deg2rad(twoTheta / 2);
  const sizeA = (K * wavelength) / (betaRad * Math.cos(thetaRad));
  const sizeNm = sizeA / 10;

  steps.push(
    `θ = 2θ / 2 = ${(twoTheta / 2).toFixed(4)}° = ${thetaRad.toFixed(6)} rad`,
    fwhmUnit === 'rad'
      ? `β = ${fwhmUse.toPrecision(5)} rad (already in radians)`
      : `β = ${fwhmUse.toPrecision(5)}° × π/180 = ${betaRad.toFixed(6)} rad`,
    `cos θ = ${Math.cos(thetaRad).toFixed(6)}`,
    `D = (K·λ)/(β·cosθ) = (${K} × ${wavelength} Å) / (${betaRad.toFixed(6)} × ${Math.cos(thetaRad).toFixed(6)})`,
    `D = ${sizeA.toFixed(1)} Å = ${sizeNm.toPrecision(3)} nm`,
  );
  return { sizeA, sizeNm, betaRad, thetaRad, steps };
}

/**
 * Bragg's law d-spacing.
 * @param {object} p
 * @param {number} p.wavelength λ in Å
 * @param {number} p.twoTheta   2θ in degrees
 * @param {number} [p.n]        diffraction order, default 1
 * @returns {{dA:number, dNm:number, steps:string[]}}
 */
export function braggD({ wavelength, twoTheta, n = 1 }) {
  assertFinite('Wavelength λ', wavelength);
  assertFinite('2θ', twoTheta);
  assertFinite('Order n', n);
  if (wavelength <= 0) throw new Error('Wavelength λ must be positive.');
  if (twoTheta <= 0 || twoTheta >= 180) throw new Error('2θ must be between 0° and 180°.');
  if (n < 1 || !Number.isInteger(n)) throw new Error('Order n must be a positive integer.');

  const thetaRad = deg2rad(twoTheta / 2);
  const dA = (n * wavelength) / (2 * Math.sin(thetaRad));
  const steps = [
    `θ = 2θ / 2 = ${(twoTheta / 2).toFixed(4)}°`,
    `sin θ = ${Math.sin(thetaRad).toFixed(6)}`,
    `d = nλ / (2 sinθ) = (${n} × ${wavelength} Å) / (2 × ${Math.sin(thetaRad).toFixed(6)})`,
    `d = ${dA.toFixed(4)} Å = ${(dA / 10).toFixed(4)} nm`,
  ];
  return { dA, dNm: dA / 10, steps };
}
