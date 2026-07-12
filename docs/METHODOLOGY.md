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

---

# v0.4.0 additions — Studios, import pipeline, Miller matching

## 7. Universal import pipeline (`js/core/dataio.js`)

- CSV / TSV / TXT: delimiter auto-detected (comma, semicolon, tab, whitespace)
  by column-count consistency; decimal commas handled when the delimiter is not
  a comma. XLSX/XLS: read via vendored SheetJS 0.18.5 (`js/vendor/`, Apache-2.0,
  byte-identical to the npm `xlsx@0.18.5` dist file); each sheet becomes a grid
  and the user picks the sheet.
- Header detection is reported with a confidence level (**certain / likely /
  ambiguous**) based on the numeric fraction of the first row vs the rows below.
  When ambiguous, the app warns and the user confirms; import never silently
  guesses X/Y roles — the mapping UI always shows a preview and requires
  explicit confirmation.
- Missing/invalid cells: rows with a non-numeric X are dropped; non-numeric Y
  values become gaps; counts of dropped/invalid values are reported as warnings.
  Duplicate X values are averaged; data are sorted by X.

## 8. Processing steps (`js/core/processing.js`)

Applied non-destructively in a fixed, documented order:
smoothing → baseline → normalization → stack offset.

- **Moving average** (odd window) and **Savitzky–Golay** (least-squares
  polynomial convolution; warns when X spacing is non-uniform, since SG assumes
  uniform sampling).
- **Baseline:** *linear* (line through the mean of the first/last edge points)
  and *rolling minimum* (windowed minimum followed by a smoothing pass) —
  simple, explainable estimators, not asymmetric-least-squares fits; the
  description of the applied step is recorded in the Analysis Recipe.
- **Normalization:** max = 1, area = 1 (trapezoidal), or min–max 0–1.

## 9. Generic peak detection (`js/core/peaks.js`)

Local maxima filtered by **prominence** (fraction of the data span) and a
minimum X separation. **FWHM is measured at half-prominence** by linear
interpolation of the crossing points (the scipy `peak_widths` convention),
which stays finite for overlapping peaks; the UI labels these as numerical
estimates, not profile fits.

## 10. XRD Studio and Miller-index matching (`js/core/xrd_match.js`)

- Per-peak d-spacing (Bragg, n = 1) and Scherrer size (Section 5) from the
  detected 2θ and FWHM.
- **(hkl) labels are never guessed from peak position alone.** Two modes:
  - **A — user-provided reference list** (2θ or d values with hkl), e.g. from an
    ICDD/COD card or publication the user has access to; the reference name is
    recorded and displayed.
  - **C — computed reflections** from a user-selected crystal system (cubic,
    tetragonal, orthorhombic, hexagonal) and lattice parameters using the
    standard 1/d² formulas. Only geometrically allowed lines are generated;
    space-group extinctions and intensities are **not** applied and the UI says
    so — agreement is a consistency check with the assumed structure, not
    phase identification.
- Matching is greedy one-to-one nearest-Δ2θ within a user tolerance; each row
  shows observed 2θ, reference 2θ, Δ2θ, (hkl) and a match status, plus the
  assumptions used. No built-in reference database ships with v0.4.0 —
  fabricating one without licensed provenance was rejected deliberately.

## 11. Reproducibility (Analysis Recipe, `js/core/recipe.js`)

Exportable JSON recording source-file metadata, selected sheet, X/Y column
mapping, every applied processing step with parameters, peak-detection and
calculation settings, the Miller reference used, key results, the app version
and a timestamp — enough to reproduce the analysis by hand or in a future
recipe-replay feature.

## 12. AI assistance boundaries

See `docs/AI.md`. Deterministic code computes everything; the AI layer only
explains a labelled context and its output is always marked as AI-generated
and unverified.
