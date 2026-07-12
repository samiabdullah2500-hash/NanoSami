# Changelog

## [0.3.0] — Android platform (unpublished; no APK/AAB built yet)

### Added
- Complete Capacitor Android project skeleton (`android/`): appId com.samiabdullah.nanosami,
  app name NanoSami, versionCode 3 / versionName 0.3.0; brand-only launcher icons
  (regular, round, adaptive).
- Platform-aware export: on Android, exports write to the app cache and open the
  system share sheet via @capacitor/filesystem + @capacitor/share (Blob downloads
  fail silently in Android WebViews); browsers keep the normal download.
- `npm run build:web` produces the packaged `www/` bundle; docs/ANDROID.md documents
  the exact build steps and what was/wasn't verified.
- viewport-fit=cover, plot re-render on rotation/resize, file picker MIME types.

### Honest status
- The environment cannot reach the Gradle/Android SDK download servers, so the
  project compiles only on a machine with Android tooling; no APK/AAB was produced
  here and none is claimed.


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
- Spectrum analyzer (CSV/TSV/paste, auto mode detect, prominence peaks)
- Material identification against 12 reference materials
- XRD Scherrer + Bragg calculators with steps
- Lab calculators (molarity, dilution, wt%, at%, precursor, fuel ratio)
- Nanomaterials library (12 entries)
- Zero runtime dependencies, offline-first, privacy-first design
