# Changelog

## [0.2.0] — scientific & quality upgrade (unpublished)

### Fixed (critical)
- **Run instructions were wrong:** the app uses ES modules, which browsers block on
  file:// — a local HTTP server is required. README corrected; `npm start` added.
- **Score inflation:** one detected peak could satisfy several reference peaks.
  Matching is now strict one-to-one (greedy minimum-distance, deterministic).
- **Environmental bands could drive identification:** adsorbed-water, surface –OH
  and carbonate bands are now weighted ×0.5 and an essential-peak gate caps the
  score at 25 when no material-specific band matches.
- **Unreproducible UI tests:** jsdom is now a declared devDependency; `npm install`
  then `npm run test:all` works from a clean checkout.

### Added
- Proximity-weighted scoring, qualitative confidence labels, ambiguity flag when
  the top two candidates are within 10 points (algorithm version 2, documented in
  docs/METHODOLOGY.md with rationale).
- Optional instrumental-broadening correction in Scherrer: β = √(β²obs − β²inst),
  with stated Gaussian assumption and validation (βinst < βobs).
- Export of detected peaks (CSV) and a full analysis report (JSON) recording mode,
  sensitivity, minimum separation and algorithm version for reproducibility.
- Swapped-column detection warning in the spectrum parser.
- docs/METHODOLOGY.md (full algorithm specification) and docs/SOURCES.md
  (data provenance, no fabricated citations).
- Dilution calculator warns when the result is a concentration step (V₁ > V₂).
- Accessibility: aria-selected on tabs, aria-live on all result regions.
- 14 new regression/edge-case tests (46 core + 20 UI smoke, all passing).

### Changed
- chem.dilution dead code removed; result precision unified (5 significant figures).
- Identification UI explains the one-to-one method, weights, gate and what the
  score does and does not mean.


## [0.1.0] — first functional release (unpublished)

### Added
- FTIR peak dictionary (~50 curated bands) with exact/range/possible match classes
- FTIR spectrum analyzer: CSV/TSV/paste import, validation, absorbance/transmittance
  handling, standard reversed-axis plotting, prominence-based peak detection with
  adjustable sensitivity and minimum separation, peak table with preliminary assignments
- Explainable rule-based material identification (12 reference materials,
  ±5/±10/±20 cm⁻¹ tolerance, documented weighted scoring with unexplained-peak penalty)
- XRD Scherrer crystallite-size and Bragg d-spacing calculators with step-by-step
  working, anode wavelength presets and scientific caveats
- Scientific calculators: molarity, solute mass, dilution, wt%, at%, precursor mass,
  fuel:precursor ratio — all with visible equations and steps
- Nanomaterials reference library (12 materials)
- About page with creator section, privacy statement and scientific disclaimer
- Light/dark theme, responsive layout (sidebar / mobile bottom bar)
- 32 unit tests; synthetic sample datasets (clearly labeled synthetic)

### Notes
- No published builds yet; Android packaging is planned via Capacitor (see docs/RELEASE.md)
