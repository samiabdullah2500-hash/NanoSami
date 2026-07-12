/**
 * NanoSami — scientific/laboratory calculators.
 * Every function returns { value(s), unit, steps[] } and validates inputs.
 */

function num(name, v, { pos = true } = {}) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${name} must be a finite number.`);
  if (pos && v <= 0) throw new Error(`${name} must be positive.`);
  return v;
}

/** Molarity: M = n/V = m/(MW·V) */
export function molarity({ massG, molarMass, volumeL }) {
  num('Solute mass (g)', massG); num('Molar mass (g/mol)', molarMass); num('Volume (L)', volumeL);
  const moles = massG / molarMass;
  const M = moles / volumeL;
  return {
    molarity: M, moles,
    steps: [
      `n = m / MW = ${massG} g / ${molarMass} g·mol⁻¹ = ${moles.toPrecision(6)} mol`,
      `M = n / V = ${moles.toPrecision(6)} mol / ${volumeL} L = ${M.toPrecision(6)} mol·L⁻¹`,
    ],
  };
}

/** Required solute mass: m = M·V·MW */
export function soluteMass({ molarityM, volumeL, molarMass }) {
  num('Target molarity (mol/L)', molarityM); num('Volume (L)', volumeL); num('Molar mass (g/mol)', molarMass);
  const massG = molarityM * volumeL * molarMass;
  return {
    massG,
    steps: [
      `m = M × V × MW`,
      `m = ${molarityM} mol·L⁻¹ × ${volumeL} L × ${molarMass} g·mol⁻¹ = ${massG.toPrecision(6)} g`,
    ],
  };
}

/** Dilution C1V1 = C2V2 — solve for the one missing variable (pass null). */
export function dilution({ c1 = null, v1 = null, c2 = null, v2 = null }) {
  const vals = { c1, v1, c2, v2 };
  const missing = Object.keys(vals).filter((k) => vals[k] === null || vals[k] === undefined || vals[k] === '');
  if (missing.length !== 1) throw new Error('Provide exactly three values; leave one field empty to solve for it.');
  for (const k of Object.keys(vals)) if (!missing.includes(k)) num(k.toUpperCase(), vals[k]);
  const target = missing[0];
  let result;
  if (target === 'c1') result = (c2 * v2) / v1;
  if (target === 'v1') result = (c2 * v2) / c1;
  if (target === 'c2') result = (c1 * v1) / v2;
  if (target === 'v2') result = (c1 * v1) / c2;
  const labels = { c1: 'C₁', v1: 'V₁', c2: 'C₂', v2: 'V₂' };
  const steps = [
    `C₁V₁ = C₂V₂`,
    `${labels[target]} = ${result.toPrecision(5)} (same units as the paired inputs)`,
  ];
  const V1 = target === 'v1' ? result : v1;
  const V2 = target === 'v2' ? result : v2;
  if (Number.isFinite(V1) && Number.isFinite(V2) && V1 > V2) {
    steps.push('Note: V₁ > V₂ means this is a concentration step, not a dilution — check that this is intended.');
  }
  return { target, value: result, steps };
}

/** Weight percent of one component: wt% = m_i / Σm × 100 */
export function weightPercent({ componentMass, totalMass }) {
  num('Component mass', componentMass); num('Total mass', totalMass);
  if (componentMass > totalMass) throw new Error('Component mass cannot exceed total mass.');
  const wt = (componentMass / totalMass) * 100;
  return { wtPercent: wt, steps: [`wt% = (${componentMass} / ${totalMass}) × 100 = ${wt.toPrecision(6)} %`] };
}

/** Atomic percent from moles list: at%_i = n_i / Σn × 100 */
export function atomicPercent(molesList) {
  if (!Array.isArray(molesList) || molesList.length < 2) throw new Error('Provide at least two mole values.');
  molesList.forEach((m, i) => num(`n${i + 1}`, m));
  const total = molesList.reduce((a, b) => a + b, 0);
  const at = molesList.map((m) => (m / total) * 100);
  return {
    atPercents: at,
    steps: [
      `Σn = ${total.toPrecision(6)} mol`,
      ...at.map((p, i) => `at%₍${i + 1}₎ = ${molesList[i]} / ${total.toPrecision(6)} × 100 = ${p.toPrecision(5)} %`),
    ],
  };
}

/**
 * Precursor calculator: mass of precursor salt needed to deliver a target
 * mass/moles of product, via stoichiometric mole ratio.
 * m_precursor = (m_product / MW_product) × (ratio) × MW_precursor
 */
export function precursorMass({ productMassG, productMW, precursorMW, moleRatio = 1 }) {
  num('Target product mass (g)', productMassG); num('Product molar mass', productMW);
  num('Precursor molar mass', precursorMW); num('Mole ratio (precursor:product)', moleRatio);
  const nProd = productMassG / productMW;
  const nPre = nProd * moleRatio;
  const mPre = nPre * precursorMW;
  return {
    precursorMassG: mPre, molesProduct: nProd, molesPrecursor: nPre,
    steps: [
      `n(product) = ${productMassG} / ${productMW} = ${nProd.toPrecision(6)} mol`,
      `n(precursor) = ${nProd.toPrecision(6)} × ${moleRatio} = ${nPre.toPrecision(6)} mol`,
      `m(precursor) = ${nPre.toPrecision(6)} × ${precursorMW} = ${mPre.toPrecision(6)} g`,
    ],
  };
}

/**
 * Fuel-to-oxidizer (precursor) ratio for solution-combustion synthesis,
 * using the propellant-chemistry valence method (Jain et al.).
 * φ = Σ(oxidizing valences) / (−Σ(reducing valences)) — user supplies the
 * summed valences; the stoichiometric condition is φ = 1.
 */
export function fuelRatio({ oxidizerValenceTotal, fuelValencePerMole }) {
  num('Total oxidizing valence of precursors', oxidizerValenceTotal);
  num('Reducing valence per mole of fuel (absolute value)', fuelValencePerMole);
  const molesFuel = oxidizerValenceTotal / fuelValencePerMole;
  return {
    molesFuelPerMolePrecursor: molesFuel,
    steps: [
      `Stoichiometric condition (φ = 1): moles fuel = Σ oxidizing valence / |reducing valence per mole fuel|`,
      `moles fuel = ${oxidizerValenceTotal} / ${fuelValencePerMole} = ${molesFuel.toPrecision(6)} mol per mole of precursor`,
      `Note: valences follow the propellant-chemistry convention (C=+4, H=+1, O=−2, N=0, metals = oxidation state).`,
    ],
  };
}
