# NanoSami — Materials Science & Nanotechnology Toolkit

**v0.4.0** · **Analyze. Calculate. Identify. Explore Nanomaterials.**

Live web app: `https://samiabdullah2500-hash.github.io/NanoSami/`

NanoSami is an offline-first scientific toolkit for students, researchers and laboratory
users in materials science and nanotechnology.

Created by **Sami Abdullah Mohammed** (M.Sc. Physics — Nanoscience and Nanotechnology).

---

## Features

**Data & Plotting Studio** — XLSX/CSV/TSV/TXT import, sheet preview, X/Y mapping (multi-Y),
multi-dataset plots, smoothing, baseline, normalization, peak detection with editable labels,
PNG/CSV export, analysis recipes, optional AI context.

**FTIR** — Peak dictionary, spectrum analyzer, rule-based material identification (algorithm v2).

**XRD** — Scherrer/Bragg calculators + pattern peak table with d-spacing, FWHM, Scherrer sizes,
and **hkl assignment only against explicit references** (never guessed).

**Scientific calculators** — Molarity, dilution, wt%, at%, precursor, fuel:precursor.

**Nanomaterials library** — 12 curated reference pages.

**Android (Capacitor 6)** · **Windows desktop (Tauri 2)** — see docs.

---

## Installation & running (web)

```bash
python3 -m http.server 8080   # open http://localhost:8080
npm start
```

For XLSX support:
```bash
npm run vendor:xlsx   # places js/vendor/xlsx.mjs
```

## Tests

```bash
npm ci
npm test          # 46 core + 20 v0.4.0 tests
npm run test:all  # + UI smoke (jsdom)
```

## Scientific limitations

> Automated interpretations are preliminary. Verify with complementary techniques.

- A single FTIR peak is never definitive proof of a material.
- hkl indices are assigned only from user-selected reference tables — never invented.
- ALS baseline and geometric FWHM are educational approximations.
- Full method: `docs/METHODOLOGY.md`, Data Studio: `docs/DATA_STUDIO.md`.

## Project structure

```
js/core/   pure scientific modules (import, processing, plot, xrd, recipe, ai_context, …)
js/studio.js   Data Studio UI
js/app.js      application shell + routes
src-tauri/     Windows desktop (Tauri)
android/       Capacitor Android
```

## License

**MIT** — see `LICENSE`.
