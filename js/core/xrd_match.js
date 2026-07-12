/**
 * NanoSami — XRD Miller-index support (v0.4.0).
 *
 * Scientific policy (see docs/METHODOLOGY.md):
 *  - (hkl) labels are NEVER assigned by guessing from peak position alone.
 *  - Two defensible modes are implemented:
 *      MODE A: user-provided reference peak list (2θ or d + hkl), e.g. copied
 *              from an ICDD/COD card the user has access to.
 *      MODE C: user-selected crystal system + lattice parameters; reference
 *              2θ values are COMPUTED from standard d-spacing formulas.
 *              This yields geometrically allowed reflections only — it does
 *              NOT apply space-group extinction rules, and matching a computed
 *              line is consistency, not phase identification. This limitation
 *              is stated in every result.
 *  - Every match reports observed 2θ, reference 2θ, Δ2θ, tolerance, status.
 *
 * d-spacing formulas (standard crystallography, e.g. Cullity, "Elements of
 * X-ray Diffraction"):
 *   cubic:        1/d² = (h²+k²+l²)/a²
 *   tetragonal:   1/d² = (h²+k²)/a² + l²/c²
 *   orthorhombic: 1/d² = h²/a² + k²/b² + l²/c²
 *   hexagonal:    1/d² = 4/3·(h²+hk+k²)/a² + l²/c²
 */

import { deg2rad, rad2deg } from './xrd.js';

export const CRYSTAL_SYSTEMS = ['cubic', 'tetragonal', 'orthorhombic', 'hexagonal'];

/** d-spacing (Å) for (hkl) in the given system. Params in Å. */
export function dSpacing(system, hkl, { a, b, c }) {
  const [h, k, l] = hkl;
  if (![h, k, l].every(Number.isInteger)) throw new Error('h, k, l must be integers.');
  if (h === 0 && k === 0 && l === 0) throw new Error('(000) is not a reflection.');
  const need = (v, name) => { if (!Number.isFinite(v) || v <= 0) throw new Error(`Lattice parameter ${name} must be a positive number (Å).`); };
  let inv2;
  switch (system) {
    case 'cubic': need(a, 'a'); inv2 = (h * h + k * k + l * l) / (a * a); break;
    case 'tetragonal': need(a, 'a'); need(c, 'c'); inv2 = (h * h + k * k) / (a * a) + (l * l) / (c * c); break;
    case 'orthorhombic': need(a, 'a'); need(b, 'b'); need(c, 'c'); inv2 = (h * h) / (a * a) + (k * k) / (b * b) + (l * l) / (c * c); break;
    case 'hexagonal': need(a, 'a'); need(c, 'c'); inv2 = (4 / 3) * (h * h + h * k + k * k) / (a * a) + (l * l) / (c * c); break;
    default: throw new Error(`Unsupported crystal system "${system}". Supported: ${CRYSTAL_SYSTEMS.join(', ')}.`);
  }
  return 1 / Math.sqrt(inv2);
}

/** 2θ (degrees) from d (Å) and wavelength λ (Å), first order (n=1). */
export function twoThetaFromD(d, wavelength) {
  if (!(d > 0) || !(wavelength > 0)) throw new Error('d and λ must be positive.');
  const s = wavelength / (2 * d);
  if (s > 1) return null; // reflection outside the accessible range for this λ
  return rad2deg(2 * Math.asin(s));
}

/** d (Å) from 2θ (degrees) and λ (Å), n=1. */
export function dFromTwoTheta(twoTheta, wavelength) {
  if (!(twoTheta > 0 && twoTheta < 180)) throw new Error('2θ must be between 0° and 180°.');
  return wavelength / (2 * Math.sin(deg2rad(twoTheta / 2)));
}

/**
 * MODE C: generate geometrically allowed reflections for a crystal system and
 * lattice parameters, sorted by 2θ, deduplicated by d (symmetry-equivalent
 * families collapse to one line with a representative hkl).
 * @returns {{lines: {hkl:number[], d:number, twoTheta:number}[], assumptions: string[]}}
 */
export function generateReflections(system, params, {
  wavelength, maxIndex = 5, twoThetaMax = 90, twoThetaMin = 5,
} = {}) {
  if (!(wavelength > 0)) throw new Error('Provide the X-ray wavelength λ (Å).');
  const seen = new Map();
  for (let h = 0; h <= maxIndex; h++) for (let k = 0; k <= maxIndex; k++) for (let l = 0; l <= maxIndex; l++) {
    if (h === 0 && k === 0 && l === 0) continue;
    const d = dSpacing(system, [h, k, l], params);
    const tt = twoThetaFromD(d, wavelength);
    if (tt === null || tt < twoThetaMin || tt > twoThetaMax) continue;
    const key = d.toFixed(5);
    if (!seen.has(key)) seen.set(key, { hkl: [h, k, l], d, twoTheta: tt });
  }
  const lines = [...seen.values()].sort((p, q) => p.twoTheta - q.twoTheta);
  return {
    lines,
    assumptions: [
      `Reflections computed from ${system} d-spacing geometry with the given lattice parameters (λ = ${wavelength} Å, n = 1).`,
      'Space-group extinction rules are NOT applied: some listed lines may be systematically absent in the real structure.',
      'Relative intensities are not computed — matching is by position only.',
      'Agreement with computed lines is a consistency check, not phase identification.',
    ],
  };
}

/**
 * MODE A: parse a user-pasted reference peak list.
 * Accepted per line: "2theta hkl" / "2theta h k l" / "d(Å) hkl" (auto by
 * `unit`), separated by comma/semicolon/whitespace. hkl may be "101" or "1 0 1".
 * @param {string} text
 * @param {{unit:'2theta'|'d', wavelength?:number}} opt wavelength required for unit 'd' → 2θ conversion
 */
export function parseReferenceList(text, { unit = '2theta', wavelength = null } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Reference list is empty.');
  if (unit === 'd' && !(wavelength > 0)) throw new Error('Wavelength λ is required to convert reference d values to 2θ.');
  const lines = [], warnings = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const t = raw.trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) continue;
    const parts = t.split(/[,;\s]+/).filter(Boolean);
    if (parts.length < 2) { warnings.push(`Skipped line (need value + hkl): "${t.slice(0, 40)}"`); continue; }
    const v = Number(parts[0]);
    if (!Number.isFinite(v) || v <= 0) { warnings.push(`Skipped line (bad numeric value): "${t.slice(0, 40)}"`); continue; }
    let hkl = null;
    const rest = parts.slice(1);
    if (rest.length >= 3 && rest.slice(0, 3).every((p) => /^-?\d+$/.test(p))) {
      hkl = rest.slice(0, 3).map(Number);
    } else if (/^\(?-?\d{3}\)?$/.test(rest[0])) {
      const digits = rest[0].replace(/[()]/g, '');
      hkl = digits.split('').map(Number); // "101" → [1,0,1] (single-digit indices only)
    } else {
      warnings.push(`Skipped line (could not read hkl — use "h k l" for indices ≥ 10): "${t.slice(0, 40)}"`);
      continue;
    }
    const twoTheta = unit === 'd' ? twoThetaFromD(v, wavelength) : v;
    if (twoTheta === null || twoTheta <= 0 || twoTheta >= 180) { warnings.push(`Skipped line (out of range): "${t.slice(0, 40)}"`); continue; }
    lines.push({ hkl, d: unit === 'd' ? v : null, twoTheta });
  }
  if (!lines.length) throw new Error('No usable reference lines were parsed.');
  lines.sort((p, q) => p.twoTheta - q.twoTheta);
  return { lines, warnings };
}

/**
 * Match observed peaks against reference lines within a 2θ tolerance.
 * One-to-one greedy assignment by smallest |Δ2θ| (each reference line used once).
 * @param {{twoTheta:number}[]} observed
 * @param {{twoTheta:number, hkl:number[]}[]} reference
 * @param {{tolerance?:number, source:string, assumptions?:string[]}} opt
 * @returns {{rows, matchedCount, unmatchedObserved, unmatchedReference, tolerance, source, assumptions, caveat}}
 */
export function matchPeaks(observed, reference, { tolerance = 0.3, source = 'user reference', assumptions = [] } = {}) {
  if (!Array.isArray(observed) || !observed.length) throw new Error('No observed peaks to match.');
  if (!Array.isArray(reference) || !reference.length) throw new Error('No reference lines to match against.');
  if (!(tolerance > 0)) throw new Error('Tolerance must be positive.');
  // candidate pairs sorted by |Δ|
  const pairs = [];
  observed.forEach((o, i) => reference.forEach((r, j) => {
    const dlt = o.twoTheta - r.twoTheta;
    if (Math.abs(dlt) <= tolerance) pairs.push({ i, j, dlt });
  }));
  pairs.sort((p, q) => Math.abs(p.dlt) - Math.abs(q.dlt));
  const obsUsed = new Set(), refUsed = new Set(), assign = new Map();
  for (const p of pairs) {
    if (obsUsed.has(p.i) || refUsed.has(p.j)) continue;
    obsUsed.add(p.i); refUsed.add(p.j); assign.set(p.i, p);
  }
  const rows = observed.map((o, i) => {
    const p = assign.get(i);
    if (!p) return { observed2Theta: o.twoTheta, reference2Theta: null, delta: null, hkl: null, status: 'unmatched' };
    const r = reference[p.j];
    const status = Math.abs(p.dlt) <= tolerance / 2 ? 'match' : 'tentative';
    return { observed2Theta: o.twoTheta, reference2Theta: r.twoTheta, delta: p.dlt, hkl: r.hkl, status };
  });
  return {
    rows,
    matchedCount: obsUsed.size,
    unmatchedObserved: observed.length - obsUsed.size,
    unmatchedReference: reference.length - refUsed.size,
    tolerance, source, assumptions,
    caveat: 'Index assignments are position matches against the stated reference only. They are NOT definitive phase identification; verify with full-pattern analysis and complementary techniques.',
  };
}
