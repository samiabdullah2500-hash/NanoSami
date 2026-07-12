# Changelog

## [0.4.0] — Studios, universal import, Miller matching, AI assistance

### Added — Universal scientific data import (`js/core/dataio.js`, `js/ui/importer.js`)
- XLSX / XLS / CSV / TSV / TXT (+ paste). Excel: sheet detection, sheet picker,
  data preview. Delimiter auto-detection with decimal-comma handling.
- Header detection with explicit confidence (certain/likely/ambiguous) — the
  app never silently guesses; X and Y columns are always confirmed by the user,
  multiple Y columns supported, invalid/missing values reported not hidden.
- SheetJS 0.18.5 vendored at `js/vendor/xlsx.full.min.js` (Apache-2.0, license
  included; SHA-256 identical to the npm `xlsx@0.18.5` dist file). Loaded
  lazily only when an Excel file is opened — zero cost otherwise, offline-safe.

### Added — Scientific Plotting Studio (`#/plot`)
- Multiple datasets, rename series, overlay samples; axis labels/title, manual
  ranges, linear/log scales, reversed X (spectroscopy convention).
- Normalization (max/area/min–max), moving-average & Savitzky–Golay smoothing,
  linear & rolling-minimum baseline correction, stack offsets, generic peak
  detection with optional labels. Processing is non-destructive and re-applied
  from raw data in a fixed documented order.
- Export: SVG (true vector) and PNG via canvas rasterization; processed data
  as CSV; Analysis Recipe as JSON.

### Added — XRD Studio (`#/xrdstudio`)
- Full pattern workflow: import → plot → adjustable peak detection →
  per-peak table with 2θ, intensity, FWHM (half-prominence numerical estimate,
  clearly labelled), Bragg d-spacing, Scherrer size with optional instrumental
  correction. CSV + recipe export.
- Miller-index matching that never guesses from position alone:
  MODE A — user-provided reference peak list (2θ or d), reference name recorded;
  MODE C — reflections computed from user-selected crystal system + lattice
  parameters (geometry only; extinction rules explicitly NOT applied).
  Output shows observed 2θ, reference 2θ, Δ2θ, (hkl), match status and all
  assumptions; phase identification is never claimed. No unlicensed built-in
  reference database was fabricated (deliberate decision).

### Added — AI assistance layer (optional, `js/core/ai_context.js`, `js/ui/ai_panel.js`, `docs/AI.md`)
- Structured, origin-labelled analysis context (settings, assumptions,
  NanoSami-calculated tables, limitations) generated from the live analysis.
- MODE A: copy structured prompt / open ChatGPT, Claude, Gemini, Grok (no
  account integration claimed; prompt always copied because URL prefill is
  unofficial). MODE B: bring-your-own API key (Anthropic, OpenAI, or any
  OpenAI-compatible endpoint — Gemini and Grok expose one) with explicit consent, separate-billing notice, local-only
  storage, delete button; keys never touch Git or NanoSami's servers.
- AI is explanation-only: it cannot compute or modify data; every answer is
  labelled AI-generated and unverified. Core app verified to work with the AI
  layer absent/offline.

### Added — Reproducibility
- Exportable "Analysis Recipe" JSON: source metadata, sheet, column mapping,
  ordered processing steps + parameters, detection/calculation settings,
  Miller reference, results, app version, timestamp (`js/core/recipe.js`).

### Added — Tests
- 45 new unit tests (`tests/run_tests_v04.mjs`): delimiter/header/mapping,
  Excel grids, invalid values, smoothing/baseline, peak detection & FWHM
  accuracy vs 2.355σ, d-spacing vs published Si/ZnO values, reference parsing,
  one-to-one matching, SVG rendering (log-scale safety, escaping, manual
  ranges), recipe round-trip, AI context/prompt/request builders, offline
  import safety. 12 new UI smoke tests driving both studios end-to-end through
  the real import wizard. Totals: 91 unit + 31 smoke.

### Fixed
- Tauri desktop CSP `connect-src` now permits HTTPS so the optional BYO-API
  calls work in the desktop app (scripts remain restricted to `'self'`;
  NanoSami itself still makes no network calls).

### Changed
- `npm test` now runs both unit suites; home page has 8 tool cards; version
  0.4.0 across package.json / Tauri config / About page.
- METHODOLOGY.md sections 7–12 document every new algorithm and its limits.

### Preserved
- All v0.3.0 FTIR/XRD/calculator/library features and tests unchanged
  (46/46 legacy tests still pass). Web, Android (Capacitor) and Windows
  (Tauri) projects untouched apart from the version bump; build script and CI
  unchanged (the whole `js/` tree, including new modules and vendor file, was
  already copied by `build:web`).

## [0.3.0] — Android + Windows desktop packaging

### Added — Windows desktop (Tauri 2)
- Full Tauri 2 project under `src-tauri/` (productName NanoSami, identifier
  com.samiabdullah.nanosami, version 0.3.0).
- NSIS installer + MSI targets; Start Menu folder “NanoSami”.
- `npm run desktop:dev` / `desktop:build` scripts.
- GitHub Actions workflow `.github/workflows/desktop-windows.yml` builds the
  Windows installer on tags and on manual dispatch (windows-latest runner).
- Documentation: `docs/WINDOWS.md`, `docs/DESKTOP.md`.

### Added — Android (Capacitor 6)
- Capacitor Android project skeleton + platform-aware export.
- `npm run build:web` + docs/ANDROID.md.

### Honest status
- **No Windows .exe / .msi was produced in the packaging environment** (Linux
  container without Windows MSVC toolchain). Complete source and CI workflow are
  ready so a real installer is produced by GitHub Actions or on Windows.
- No Android APK/AAB was produced (Android SDK unreachable here).

### Preserved
- All scientific functionality unchanged and offline-first.
- Web and Android trees remain independent.


## [0.2.0] — scientific & quality upgrade

### Fixed (critical)
- Local HTTP server required for ES modules.
- One-to-one peak assignment; essential-peak gate; environmental weighting.
- Reproducible tests with jsdom.

### Added
- Algorithm v2, Scherrer instrumental correction, export, methodology docs,
  46 core unit tests.


## [0.1.0] — first functional release

FTIR, spectrum analyzer, material ID, XRD, lab calculators, library.
