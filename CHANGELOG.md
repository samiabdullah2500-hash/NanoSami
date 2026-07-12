# Changelog

## [0.4.0] — Data Studio (feature branch)

### Added
- **Data & Plotting Studio** (`#/studio`): universal import (CSV/TSV/TXT/XLSX),
  sheet selection, data preview, automatic + manual X/Y column mapping,
  multi-Y and multi-dataset plotting, editable titles/axes, reverse-X for FTIR,
  smoothing, baseline (ALS-lite), normalization, offsets, peak detection with
  editable labels and FWHM, PNG/CSV export.
- **Vendored SheetJS** (`js/vendor/xlsx.mjs`) for offline XLSX support (`npm run vendor:xlsx`).
- **Advanced XRD pattern tools**: peak table, d-spacing, Scherrer per peak,
  instrumental FWHM correction, **careful hkl assignment only against explicit
  references** (never guessed). Curated Cu Kα references: ZnO wurtzite, TiO₂
  anatase, α-quartz, Fe₃O₄ magnetite.
- **Analysis Recipes** (`js/core/recipe.js`): versioned JSON capturing input
  summary, parameters, processing chain, peaks, references, disclaimer.
- **AI assistance foundation** (`js/core/ai_context.js`): structured context
  export for external LLMs; optional BYO API endpoint via sessionStorage;
  no passwords; app fully usable without AI.
- Core modules: `import.js`, `processing.js`, `plot.js`, `xrd_advanced.js`,
  `recipe.js`, `ai_context.js`.
- Sample data: multi-column demo, densified synthetic XRD ZnO-like pattern.
- **20 new unit tests** (`tests/test_v040.mjs`); original 46 still pass.

### Preserved
- FTIR dictionary, spectrum analyzer, material identification (algorithm v2).
- XRD Scherrer/Bragg calculators, lab calculators, nanomaterials library.
- Capacitor Android project, Tauri Windows desktop source, GitHub Pages/CI.

### Honest limitations
- ALS baseline is a lightweight approximation.
- FWHM is half-max geometric, not a refined profile fit.
- hkl references are typical literature positions for education — not a substitute
  for ICDD/COD in publication work.
- UI smoke tests require jsdom; run `npm ci` then `npm run test:ui`.
- XLSX library ~900 KB when vendored (acceptable for scientific use).

## [0.3.0] — Android + Windows desktop packaging
- Capacitor Android skeleton, Tauri 2 Windows source + CI.

## [0.2.0] — scientific & quality upgrade
- Matcher algorithm v2, Scherrer instrumental correction, tests, methodology.

## [0.1.0] — first functional release
