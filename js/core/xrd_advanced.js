/**
 * NanoSami — Advanced XRD analysis helpers.
 * hkl is NEVER guessed. Assignment only against explicit reference reflections.
 */

import { braggD, scherrer, WAVELENGTHS } from './xrd.js';
import { detectPeaks } from './spectrum.js';
import { estimateFWHM } from './processing.js';

export { WAVELENGTHS };

export function detectXrdPeaks(twoTheta, intensity, { sensitivity = 0.45, minDistance = 0.4 } = {}) {
  const peaks = detectPeaks(twoTheta, intensity, {
    mode: 'absorbance',
    sensitivity,
    minDistance,
  });
  const sig = intensity;
  return peaks.map((p) => {
    let idx = 0;
    let best = Infinity;
    for (let i = 0; i < twoTheta.length; i++) {
      const d = Math.abs(twoTheta[i] - p.wavenumber);
      if (d < best) { best = d; idx = i; }
    }
    const fw = estimateFWHM(twoTheta, sig, idx);
    return {
      twoTheta: p.wavenumber,
      intensity: p.value,
      prominence: p.prominence,
      idx,
      fwhmDeg: fw.fwhmX,
      label: '',
      hkl: null,
      dA: null,
      sizeNm: null,
    };
  }).sort((a, b) => a.twoTheta - b.twoTheta);
}

export function enrichPeaks(peaks, {
  wavelength = 1.5406,
  K = 0.9,
  fwhmInstDeg = null,
  computeSize = true,
} = {}) {
  return peaks.map((p) => {
    const out = { ...p };
    try {
      const d = braggD({ wavelength, twoTheta: p.twoTheta, n: 1 });
      out.dA = d.dA;
    } catch { out.dA = null; }
    if (computeSize && p.fwhmDeg && p.fwhmDeg > 0) {
      try {
        const s = scherrer({
          wavelength,
          twoTheta: p.twoTheta,
          fwhm: p.fwhmDeg,
          fwhmUnit: 'deg',
          K,
          fwhmInst: fwhmInstDeg,
        });
        out.sizeNm = s.sizeNm;
        out.sizeSteps = s.steps;
      } catch { out.sizeNm = null; }
    } else {
      out.sizeNm = null;
    }
    return out;
  });
}

/** Curated Cu Kα reference reflections — education only; verify vs ICDD/COD. */
export const XRD_REFERENCES = [
  {
    id: 'zno_wurtzite', phase: 'ZnO (wurtzite)', formula: 'ZnO', system: 'hexagonal',
    source: 'Typical literature positions for Cu Kα; verify against ICDD/COD for your sample.',
    reflections: [
      { hkl: '100', dA: 2.814, twoThetaCu: 31.77 },
      { hkl: '002', dA: 2.603, twoThetaCu: 34.42 },
      { hkl: '101', dA: 2.476, twoThetaCu: 36.25 },
      { hkl: '102', dA: 1.911, twoThetaCu: 47.54 },
      { hkl: '110', dA: 1.625, twoThetaCu: 56.60 },
      { hkl: '103', dA: 1.477, twoThetaCu: 62.86 },
      { hkl: '112', dA: 1.378, twoThetaCu: 67.96 },
    ],
  },
  {
    id: 'tio2_anatase', phase: 'TiO₂ (anatase)', formula: 'TiO2', system: 'tetragonal',
    source: 'Typical literature positions for Cu Kα; verify against ICDD/COD.',
    reflections: [
      { hkl: '101', dA: 3.52, twoThetaCu: 25.28 },
      { hkl: '004', dA: 2.38, twoThetaCu: 37.80 },
      { hkl: '200', dA: 1.89, twoThetaCu: 48.05 },
      { hkl: '105', dA: 1.70, twoThetaCu: 53.89 },
      { hkl: '211', dA: 1.67, twoThetaCu: 55.06 },
      { hkl: '204', dA: 1.48, twoThetaCu: 62.69 },
    ],
  },
  {
    id: 'sio2_quartz', phase: 'SiO₂ (α-quartz)', formula: 'SiO2', system: 'trigonal',
    source: 'Typical literature positions for Cu Kα; verify against ICDD/COD.',
    reflections: [
      { hkl: '100', dA: 4.26, twoThetaCu: 20.86 },
      { hkl: '101', dA: 3.34, twoThetaCu: 26.64 },
      { hkl: '110', dA: 2.46, twoThetaCu: 36.54 },
      { hkl: '102', dA: 2.28, twoThetaCu: 39.46 },
      { hkl: '111', dA: 2.24, twoThetaCu: 40.30 },
      { hkl: '200', dA: 2.13, twoThetaCu: 42.45 },
    ],
  },
  {
    id: 'fe3o4_magnetite', phase: 'Fe₃O₄ (magnetite)', formula: 'Fe3O4', system: 'cubic',
    source: 'Typical literature positions for Cu Kα; verify against ICDD/COD.',
    reflections: [
      { hkl: '220', dA: 2.97, twoThetaCu: 30.1 },
      { hkl: '311', dA: 2.53, twoThetaCu: 35.4 },
      { hkl: '400', dA: 2.10, twoThetaCu: 43.1 },
      { hkl: '511', dA: 1.62, twoThetaCu: 56.9 },
      { hkl: '440', dA: 1.48, twoThetaCu: 62.5 },
    ],
  },
];

export function assignHklFromReference(peaks, reference, { toleranceDeg = 0.3, wavelength = 1.5406 } = {}) {
  if (!reference || !Array.isArray(reference.reflections)) {
    throw new Error('A reference with an explicit reflections list is required. NanoSami will not guess hkl indices.');
  }
  const notes = [
    `hkl assignment against reference: ${reference.phase || reference.id || 'custom'}`,
    `Tolerance: ±${toleranceDeg}° in 2θ.`,
    'Assignment is a proximity match only — not phase identification.',
    reference.source || '',
  ].filter(Boolean);

  const refs = reference.reflections.map((r) => {
    let tt = r.twoThetaCu;
    if (tt == null && r.dA) {
      const s = wavelength / (2 * r.dA);
      if (s > 0 && s <= 1) tt = (2 * Math.asin(s) * 180) / Math.PI;
    }
    return { ...r, twoTheta: tt };
  }).filter((r) => r.twoTheta != null);

  const usedRef = new Set();
  const assignments = [];
  const outPeaks = peaks.map((p) => {
    let best = null;
    let bestDiff = Infinity;
    for (let i = 0; i < refs.length; i++) {
      if (usedRef.has(i)) continue;
      const diff = Math.abs(refs[i].twoTheta - p.twoTheta);
      if (diff <= toleranceDeg && diff < bestDiff) {
        bestDiff = diff;
        best = { i, ref: refs[i], diff };
      }
    }
    if (best) {
      usedRef.add(best.i);
      assignments.push({
        twoTheta: p.twoTheta, hkl: best.ref.hkl,
        refTwoTheta: best.ref.twoTheta, delta: best.diff,
      });
      return {
        ...p,
        hkl: best.ref.hkl,
        label: p.label || best.ref.hkl,
        hklDelta: best.diff,
        hklRef: reference.phase || reference.id,
      };
    }
    return { ...p, hkl: null, hklDelta: null, hklRef: null };
  });

  const unmatchedRef = refs.filter((_, i) => !usedRef.has(i));
  return { peaks: outPeaks, assignments, unmatchedRef, notes };
}

export function peaksToCsv(peaks, { wavelength } = {}) {
  const header = 'two_theta_deg,intensity,fwhm_deg,d_A,scherrer_nm,hkl,label';
  const lines = peaks.map((p) =>
    [
      p.twoTheta?.toFixed(4) ?? '',
      p.intensity?.toPrecision(6) ?? '',
      p.fwhmDeg != null ? p.fwhmDeg.toFixed(4) : '',
      p.dA != null ? p.dA.toFixed(4) : '',
      p.sizeNm != null ? p.sizeNm.toPrecision(4) : '',
      p.hkl ?? '',
      (p.label || '').replace(/,/g, ';'),
    ].join(','),
  );
  return `# NanoSami XRD peaks — preliminary\n# wavelength_A=${wavelength ?? ''}\n${header}\n${lines.join('\n')}`;
}
