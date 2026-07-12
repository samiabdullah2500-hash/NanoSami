/**
 * NanoSami — FTIR dictionary lookup & rule-based material identification.
 * Algorithm version: 2 (v0.2.0)
 *
 * ============================ SCORING METHOD ============================
 * (documented, deterministic, explainable — see docs/METHODOLOGY.md)
 *
 * 1. WEIGHTS (diagnosticity). Each reference peak carries a weight:
 *      essential  w = 2.0   genuinely material-specific band
 *      supporting w = 1.0   consistent but less specific band
 *      common     w = 0.5   environmental / preparation band (adsorbed H₂O,
 *                           surface –OH, atmospheric CO₂, carbonate impurity).
 *    Common bands appear on many samples regardless of identity, so they may
 *    support a candidate but can never establish one.
 *
 * 2. ONE-TO-ONE ASSIGNMENT. All (reference, detected) pairs with
 *    |Δν̃| ≤ tolerance are sorted by ascending |Δν̃| (ties: lower reference
 *    wavenumber first — deterministic). Pairs are accepted greedily; once a
 *    detected or reference peak is assigned it cannot be reused. This is a
 *    greedy minimum-distance matching and prevents a single detected peak
 *    from satisfying several reference peaks.
 *
 * 3. PROXIMITY FACTOR. A matched peak contributes
 *        w × (1 − 0.25 × Δν̃/tolerance)
 *    so an exact hit counts fully and a hit at the tolerance edge counts 75%.
 *
 * 4. COVERAGE.  coverage = Σ contributions / Σ weights   (0–1)
 *
 * 5. UNEXPLAINED-PEAK PENALTY. Detected peaks assigned to no reference peak
 *    of this material: −5 points each, capped at −30.
 *
 * 6. ESSENTIAL GATE. If a material defines essential peaks and NONE are
 *    matched, the score is capped at 25 and flagged 'noEssential' — common/
 *    supporting bands alone cannot produce a candidate identification.
 *
 * 7. score = clamp(coverage×100 − penalty, 0…gate)
 *
 * 8. CONFIDENCE LABELS (qualitative, not probabilities):
 *      ≥75 strong candidate · 50–74 moderate · 25–49 weak · <25 insufficient
 *    AMBIGUITY: if the top two candidates lie within 10 points, both are
 *    flagged ambiguous — FTIR alone cannot distinguish them here.
 * =======================================================================
 */

export const ALGORITHM_VERSION = 2;

/** Look up a single wavenumber in the FTIR dictionary. */
export function lookupWavenumber(dict, wavenumber, { tolerance = 0 } = {}) {
  if (!Number.isFinite(wavenumber)) throw new Error('Enter a numeric wavenumber (cm⁻¹).');
  if (wavenumber < 100 || wavenumber > 6000) {
    throw new Error('Wavenumber outside the usual mid-IR range (≈400–4000 cm⁻¹). Check the value.');
  }
  const results = [];
  for (const entry of dict) {
    // Ranges may be stored high→low (FTIR convention) or low→high; normalize.
    const rLo = Math.min(entry.range[0], entry.range[1]);
    const rHi = Math.max(entry.range[0], entry.range[1]);
    if (wavenumber >= rLo - tolerance && wavenumber <= rHi + tolerance) {
      const inCore = wavenumber >= rLo && wavenumber <= rHi;
      const center = (rLo + rHi) / 2;
      results.push({
        ...entry,
        matchType: inCore
          ? (entry.typical && Math.abs(wavenumber - entry.typical) <= 15 ? 'exact' : 'range')
          : 'possible',
        distance: Math.abs(wavenumber - (entry.typical ?? center)),
      });
    }
  }
  results.sort((a, b) => {
    const order = { exact: 0, range: 1, possible: 2 };
    return order[a.matchType] - order[b.matchType] || a.distance - b.distance;
  });
  return results;
}

export function confidenceLabel(score) {
  if (score >= 75) return 'strong candidate';
  if (score >= 50) return 'moderate candidate';
  if (score >= 25) return 'weak candidate';
  return 'insufficient evidence';
}

function peakWeight(p) {
  if (p.common) return 0.5;
  return p.essential ? 2 : 1;
}

/**
 * Match detected peak wavenumbers against material reference sets.
 * @param {Array} materials  entries from materials_ftir.js
 * @param {number[]} detected detected peak wavenumbers (cm⁻¹)
 * @param {object} opt {tolerance: ±cm⁻¹ in [1,50], default 10}
 */
export function matchMaterials(materials, detected, { tolerance = 10 } = {}) {
  if (!Array.isArray(detected) || detected.length === 0) throw new Error('No detected peaks to match.');
  if (!Number.isFinite(tolerance) || tolerance < 1 || tolerance > 50) {
    throw new Error('Tolerance must be between 1 and 50 cm⁻¹.');
  }
  const det = detected.filter(Number.isFinite);
  if (det.length === 0) throw new Error('Peak list contains no finite numeric values.');

  const results = materials.map((mat) => {
    // --- one-to-one greedy minimum-distance assignment -------------------
    const pairs = [];
    mat.peaks.forEach((p, ri) => det.forEach((d, di) => {
      const diff = Math.abs(d - p.wavenumber);
      if (diff <= tolerance) pairs.push({ ri, di, diff });
    }));
    pairs.sort((a, b) => a.diff - b.diff || mat.peaks[a.ri].wavenumber - mat.peaks[b.ri].wavenumber || det[a.di] - det[b.di]);

    const refUsed = new Set(), detUsed = new Set();
    const matched = [];
    for (const pr of pairs) {
      if (refUsed.has(pr.ri) || detUsed.has(pr.di)) continue;
      refUsed.add(pr.ri); detUsed.add(pr.di);
      matched.push({ ref: mat.peaks[pr.ri], detected: det[pr.di], diff: pr.diff });
    }
    const missing = mat.peaks.filter((_, i) => !refUsed.has(i));
    const extras = det.filter((_, i) => !detUsed.has(i));

    // --- weighted coverage with proximity factor -------------------------
    let contrib = 0, totalW = 0;
    for (const p of mat.peaks) totalW += peakWeight(p);
    for (const m of matched) contrib += peakWeight(m.ref) * (1 - 0.25 * (m.diff / tolerance));
    const coverage = totalW ? contrib / totalW : 0;

    // --- penalties & gates ------------------------------------------------
    const extraPenalty = Math.min(30, 5 * extras.length);
    const hasEssentialDefined = mat.peaks.some((p) => p.essential && !p.common);
    const essentialMatched = matched.some((m) => m.ref.essential && !m.ref.common);
    const noEssential = hasEssentialDefined && !essentialMatched;

    let score = Math.max(0, coverage * 100 - extraPenalty);
    if (noEssential) score = Math.min(score, 25);

    const explanation =
      `Weighted coverage ${contrib.toFixed(2)}/${totalW.toFixed(1)} = ${(coverage * 100).toFixed(1)}% ` +
      `(essential ×2, supporting ×1, common/environmental ×0.5; near matches scaled by distance). ` +
      `${extras.length} unexplained peak(s) → −${extraPenalty} pts.` +
      (noEssential ? ' No material-specific (essential) band matched → score capped at 25.' : '');

    return {
      material: mat.name, formula: mat.formula, class: mat.class,
      score, coverage: coverage * 100,
      matched, missing, extras,
      noEssential, explanation,
      confidence: confidenceLabel(score),
      ambiguous: false,
    };
  });

  results.sort((a, b) => b.score - a.score || a.material.localeCompare(b.material));
  if (results.length >= 2 && results[0].score - results[1].score < 10 && results[1].score > 0) {
    results[0].ambiguous = true; results[1].ambiguous = true;
  }
  return results;
}
