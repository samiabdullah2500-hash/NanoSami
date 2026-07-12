# NanoSami — Materials Science & Nanotechnology Toolkit

**v0.3.0** · **Analyze. Calculate. Identify. Explore Nanomaterials.**

Live app: `https://samiabdullah2500-hash.github.io/NanoSami/` (enable GitHub Pages on `main` / root if not already live)

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

**Android (Capacitor 6)** — full project under `android/` (appId `com.samiabdullah.nanosami`).
See `docs/ANDROID.md`. Platform-aware export uses native share sheet on device.

---

## Installation & running (web)

NanoSami has **zero runtime dependencies for the web app** (jsdom is a dev-only test dependency;
Capacitor packages are for Android packaging only). It is a static web application.

NanoSami uses browser ES modules, which **cannot be loaded from file://** —
serve it over a local HTTP server:

```bash
python3 -m http.server 8080     # then open http://localhost:8080
# or: npm start
```

Requirements: any modern browser. Node.js ≥ 18 for tests and Android packaging.

## Running the tests

```bash
npm ci             # reproducible install
npm test           # core unit tests (no network needed after install)
npm run test:ui    # headless UI smoke tests (jsdom)
npm run test:all   # both
```

**Verified locally:** 46/46 core unit tests pass.

## Sample data

`sample_data/` contains **clearly labeled synthetic** files (not measured spectra).

## Scientific limitations

> NanoSami provides computational and educational assistance for materials
> characterization. Automated interpretations are preliminary and should be verified
> using appropriate reference data, complementary characterization techniques, and
> expert analysis.

- A single FTIR peak is never definitive proof of a material.
- The material identifier returns a **similarity indicator** ("most consistent with…"),
  not an identification. Full algorithm in `docs/METHODOLOGY.md`; provenance in `docs/SOURCES.md`.
- Scherrer sizes are apparent crystallite sizes (instrumental correction optional, Gaussian assumption stated).
- Library values are typical literature ranges; verify against primary sources for your system.

## Project structure

```
├── index.html, css/, js/, data/, assets/, sample_data/
├── scripts/build-web.mjs   # builds www/ for Capacitor
├── capacitor.config.json
├── android/                # Capacitor Android project (skeleton + config)
├── tests/
├── docs/                   # METHODOLOGY, SOURCES, ANDROID, PRIVACY, RELEASE
└── .github/workflows/      # CI + Pages
```

## Android

See **docs/ANDROID.md**. Short path:
```bash
npm ci && npm run build:web && npx cap sync android
cd android && ./gradlew assembleDebug
```
No APK/AAB is committed or claimed from the packaging environment.

## Roadmap

- Williamson–Hall, lattice parameter, XRD indexing
- Baseline correction / peak fitting
- Expanded dictionary & reference sets
- PWA + refined Android release pipeline

## Security & contributing

See `SECURITY.md`, `CONTRIBUTING.md`. Methodology: `docs/METHODOLOGY.md`. Privacy: `docs/PRIVACY_POLICY.md`.

## Credits & license

Created by **Sami Abdullah Mohammed** — M.Sc. Physics, Nanoscience and Nanotechnology.

**MIT** (see `LICENSE`). Scientific reference values compiled from standard tables and literature ranges; no fabricated DOIs.
