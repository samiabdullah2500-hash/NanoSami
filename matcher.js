# NanoSami — Scientific Methodology (v0.2.0, algorithm version 2)

This document specifies exactly how NanoSami processes spectra and computes results,
so every output can be independently reproduced and criticized.

## 1. Spectrum import

Two numeric columns are required: wavenumber (cm⁻¹) and absorbance **or**
transmittance. Delimiters: comma, semicolon, tab or whitespace. Header rows are
optional and, when present, are used to detect the y-axis mode from the words
"abs"/"trans". Non-numeric and non-finite (NaN/Infinity) rows are skipped with a
warning; data are sorted ascending; duplicate wavenumbers are averaged. Warnings are
raised for <10 points, negative wavenumbers, and implausibly small wavenumbers
(likely swapped columns). If no header identifies the mode, it is auto-detected:
values in ~0–110 with a top-heavy distribution (median in the upper 40% of the span)
are treated as transmittance; the user can always override. **Raw data are never
modified**; the only processing before peak detection is a 3-point moving average
used internally for peak finding only — the plotted trace and reported peak values
are the raw data.

## 2. Peak detection

Absorption bands are maxima in absorbance and minima in transmittance; transmittance
signals are inverted internally so one algorithm serves both. Candidate peaks are
local maxima of the lightly smoothed signal; each candidate's **topographic
prominence** is computed (height above the higher of the two flanking minima that
separate it from taller points). A candidate is kept if
`prominence ≥ (1 − sensitivity)·0.30·span + 0.01·span`, where `span` is the signal
range and `sensitivity ∈ [0.1, 0.95]` is user-controlled. Peaks closer together than
the user-set minimum separation (default 12 cm⁻¹) are pruned, keeping the most
prominent. Prominence-based detection is baseline-offset-invariant, which is why no
automatic baseline correction is applied; strongly sloping baselines remain a known
limitation (see §6).

## 3. Dictionary assignment

A wavenumber matches a dictionary entry if it falls inside the entry's typical range
(± optional tolerance). Match classes: **exact** (within 15 cm⁻¹ of the typical
position), **range** (inside the range), **possible** (within tolerance of the range
edge). Assignments are *preliminary band assignments*, never identifications.

## 4. Material identification (algorithm v2)

Given detected peaks D and a material's reference peaks R with weights
w(essential)=2, w(supporting)=1, w(common/environmental)=0.5:

1. **One-to-one assignment.** All pairs (r∈R, d∈D) with |Δν̃|≤tolerance are sorted
   by ascending |Δν̃| (ties broken by lower reference wavenumber, then lower detected
   wavenumber — fully deterministic) and accepted greedily; assigned peaks cannot be
   reused. This prevents one detected peak from satisfying several reference peaks
   (a score-inflation defect fixed from v0.1.0).
2. **Contribution.** Each match contributes `w × (1 − 0.25·Δν̃/tolerance)`.
3. **Coverage.** `coverage = Σcontributions / Σw` over all reference peaks.
4. **Penalty.** Unassigned detected peaks: −5 points each, capped at −30.
5. **Essential gate.** If the material defines essential peaks and none matched,
   the score is capped at 25 and flagged — environmental bands (adsorbed water,
   surface –OH, carbonate impurity, atmospheric CO₂) can support but never establish
   an identification.
6. **Score** = clamp(coverage×100 − penalty), then the gate.
7. **Confidence labels** are qualitative bins (≥75 strong / 50 moderate / 25 weak /
   <25 insufficient), *not* probabilities. If the top two candidates are within 10
   points, both are flagged **ambiguous**.

Rationale for greedy minimum-distance over Hungarian assignment: with ≤~10 reference
peaks and generous tolerances, optimal and greedy assignments differ only in
contrived cases, while greedy is trivially explainable to users and deterministic;
the difference cannot change a confidence bin in practice. This trade-off is
documented rather than hidden.

## 5. XRD calculations

- **Scherrer:** D = Kλ/(β·cosθ), θ = 2θ/2, β in radians (degree input converted).
  Optional instrumental correction β = √(β²obs − β²inst), which assumes
  Gaussian-dominated profiles (for pure Lorentzian profiles the linear subtraction
  βobs − βinst would apply; the app states its assumption in the calculation steps).
  Output is an **apparent crystallite size**, not particle size; microstrain
  broadening is not separated (Williamson–Hall is deliberately not implemented yet).
- **Bragg:** d = nλ/(2·sinθ), n a positive integer, 0<2θ<180°.

## 6. Known limitations

- No baseline correction or peak fitting: strongly sloping baselines and overlapping
  bands reduce detection quality.
- Peak positions only — relative intensities are not yet used in matching.
- Reference set: 12 materials; anything outside it cannot be suggested.
- Reference positions are typical literature values; polymorph, size and preparation
  shifts are only partially covered by the tolerance setting.
- FTIR alone cannot definitively identify unknown materials. Every identification
  output repeats this.
