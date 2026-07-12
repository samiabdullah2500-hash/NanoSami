# NanoSami — Materials Science & Nanotechnology Toolkit

**v0.2.0** · **Analyze. Calculate. Identify. Explore Nanomaterials.**

Live app (once GitHub Pages is enabled): `https://samiabdullah2500-hash.github.io/NanoSami/`

NanoSami is an offline-first scientific toolkit for students, researchers and laboratory
users in materials science and nanotechnology. It combines FTIR interpretation tools,
XRD calculators, laboratory calculators and a curated nanomaterials reference library
in a single privacy-friendly application. All processing happens on your device.

Created by **Sami Abdullah Mohammed** (M.Sc. Physics — Nanoscience and Nanotechnology).

---

## Features

**FTIR**
- **Peak dictionary** — look up any wavenumber against a curated band table (bond,
  functional group, typical range, vibration type, intensity, possible compounds).
  Matches are classified as *exact*, *range*, or *possible* — never presented as proof.
- **Spectrum analyzer** — import CSV/TSV/TXT or paste data, automatic column and
  absorbance/transmittance detection, plotting in the standard FTIR convention
  (wavenumber decreasing left→right), prominence-based peak detection with adjustable
  sensitivity and minimum peak separation, peak table with preliminary band assignments.
  Transmittance dips are correctly treated as absorption bands (detected as minima).
- **Material identification** — transparent rule-based matching against 12 reference
  materials (PS, PE, PP, PET, PVC, PMMA, ZnO, TiO₂, SiO₂, Fe₂O₃, Fe₃O₄, g-C₃N₄) with
  configurable tolerance (±5/±10/±20 cm⁻¹), showing matched peaks, missing characteristic
  peaks, unexplained peaks, and exactly how each similarity score was computed.

**XRD**
- **Scherrer crystallite size** (D = Kλ/βcosθ) with degree→radian handling, common
  anode wavelengths, and explicit caveats (crystallite ≠ particle size; instrumental
  broadening; strain).
- **Bragg d-spacing** (nλ = 2d sinθ) with step-by-step working.

**Scientific calculators** — molarity, required solute mass, dilution (C₁V₁ = C₂V₂,
solve any variable), weight %, atomic %, precursor mass, fuel:precursor ratio for
combustion synthesis. Every calculator shows its equation, variables and steps.

**Nanomaterials library** — 12 curated reference pages (ZnO, TiO₂, SiO₂, Fe₃O₄, Fe₂O₃,
ZnS, CdS, graphene, graphene oxide, CNTs, g-C₃N₄, MXenes) covering structure, band gap,
properties, synthesis, applications, characterization, and FTIR/XRD features. Where a
value varies with phase/size/morphology, the entry says so explicitly.

---

## Installation & running

NanoSami has **zero runtime dependencies** (jsdom is a dev-only test dependency). It is a static web application.

NanoSami uses browser ES modules, which **cannot be loaded from file://** —
serve it over a local HTTP server (any one of these):

```bash
python3 -m http.server 8080     # then open http://localhost:8080
# or: npm start
# or: npx serve .
```

Requirements: any modern browser (Chrome, Firefox, Safari, Edge). Node.js ≥ 18 only
for running the tests.

## Running the tests

```bash
npm ci             # reproducible install (jsdom is dev-only, for the UI smoke test)
npm test           # 46 core unit tests (no dependencies needed)
npm run test:ui    # 20 headless UI smoke tests
npm run test:all   # both
```

**Status:** 46/46 core + 20/20 UI smoke tests passing. The same suite runs in CI
(GitHub Actions) on every push and pull request to `main`.

46 unit tests cover the Scherrer and Bragg equations, unit conversions, all chemistry
calculators, spectrum parsing/validation (empty files, missing columns, non-numeric
rows), peak detection on synthetic absorbance and transmittance spectra, FTIR
dictionary lookup, and material similarity scoring — including regression tests for one-to-one peak assignment, the environmental-band/essential-peak gate, proximity weighting, ambiguity flagging, determinism, NaN/Infinity input, swapped columns, and the Scherrer instrumental correction.

## Sample data

`sample_data/` contains **clearly labeled synthetic** files for trying the analyzer:

| File | Purpose |
|---|---|
| `synthetic_polystyrene_absorbance.csv` | PS-like absorbance spectrum |
| `synthetic_zno_transmittance.csv` | ZnO-like transmittance spectrum |
| `synthetic_polystyrene_peaks.txt` | PS-like peak list for identification |
| `synthetic_zno_peaks.txt` | ZnO-like peak list for identification |
| `invalid_missing_column.csv` | malformed file for error-handling checks |

These are generated data for testing, **not measured spectra**.

## Scientific limitations

> NanoSami provides computational and educational assistance for materials
> characterization. Automated interpretations are preliminary and should be verified
> using appropriate reference data, complementary characterization techniques, and
> expert analysis.

- A single FTIR peak is never definitive proof of a material.
- The material identifier returns a **similarity indicator** ("most consistent with…"),
  not an identification. The full algorithm (one-to-one assignment, diagnosticity
  weights, essential-peak gate, confidence bins, ambiguity flag) is specified in
  `docs/METHODOLOGY.md`; data provenance is in `docs/SOURCES.md`.
- Scherrer sizes are apparent crystallite sizes; an optional instrumental correction
  β = √(β²obs − β²inst) is provided (Gaussian assumption stated); microstrain is not
  separated (Williamson–Hall deliberately deferred).
- Library values are typical literature ranges; verify against primary sources for
  your specific system.

## Project structure

```
nanosami/
├── index.html              application shell
├── css/style.css           design system (light/dark, responsive)
├── js/
│   ├── app.js              routing, module UIs, canvas spectrum plotter
│   └── core/               pure calculation modules (shared with tests)
│       ├── xrd.js          Scherrer, Bragg, conversions
│       ├── chem.js         laboratory calculators
│       ├── spectrum.js     parsing, validation, peak detection
│       └── matcher.js      dictionary lookup, material scoring
├── data/                   structured reference datasets (JSON-shaped ES modules)
│   ├── ftir_peaks.js       FTIR band dictionary (~50 entries)
│   ├── materials_ftir.js   reference peak sets for identification
│   └── nanomaterials.js    nanomaterials library (12 entries)
├── assets/                 icon, creator photo (optimized, metadata-free)
├── tests/run_tests.mjs     unit test suite (Node)
├── sample_data/            synthetic test datasets
└── docs/                   privacy policy, release/store material
```

Reference datasets are plain JSON arrays wrapped as ES modules so the app runs from
`file://` with no server and no build step; new dictionary entries, materials or
library pages are added by appending one object.

## Screenshots

*(placeholder — add screenshots of Home, Spectrum analyzer, Identification, XRD,
Library before publishing)*

## Roadmap

- Williamson–Hall size/strain analysis, lattice-parameter calculator, XRD peak
  indexing and phase comparison (architecture hooks already in place)
- XLSX import — deliberately deferred: it requires a heavy parser dependency that conflicts with the zero-dependency offline design; export CSV from Excel instead (documented decision)
- Baseline correction and peak-fitting options
- Expanded FTIR dictionary and material reference sets
- PWA packaging (installable, fully offline) and Android build via Capacitor
- Export of peak tables and reports

## Security & contributing

See `SECURITY.md` for the security policy and `CONTRIBUTING.md` for contribution
rules (scientific integrity requirements included). Methodology: `docs/METHODOLOGY.md`.
Data provenance: `docs/SOURCES.md`. Privacy: `docs/PRIVACY_POLICY.md`.

## Credits & license

Created by **Sami Abdullah Mohammed** — M.Sc. Physics, Nanoscience and Nanotechnology.

Recommended license: **MIT** (see `LICENSE`). Scientific reference values are compiled
from standard correlation tables and widely reported literature ranges; no fabricated
references or DOIs are included, and fields that vary strongly are marked as such.
