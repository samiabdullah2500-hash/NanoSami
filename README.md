# NanoSami — Materials Science & Nanotechnology Toolkit

**v0.4.0** · **Analyze. Calculate. Identify. Explore Nanomaterials.**

Live web app: `https://samiabdullah2500-hash.github.io/NanoSami/`

NanoSami is an offline-first scientific toolkit for students, researchers and laboratory
users in materials science and nanotechnology. It combines FTIR interpretation tools,
XRD calculators, laboratory calculators and a curated nanomaterials reference library
in a single privacy-friendly application. All processing happens on your device.

Created by **Sami Abdullah Mohammed** (M.Sc. Physics — Nanoscience and Nanotechnology).

---

## Features

**FTIR** — Peak dictionary, spectrum analyzer (CSV/TSV import, prominence peaks, transmittance dips), rule-based material identification (12 references, explainable scores).

**Plotting Studio (new in 0.4)** — Import XLSX/XLS/CSV/TSV/TXT with sheet selection, preview and explicit X/Y column mapping; overlay multiple samples; normalize, smooth (moving average / Savitzky–Golay), baseline-correct, stack, detect and label peaks; export SVG/PNG figures, processed CSV and a reproducible Analysis Recipe (JSON).

**XRD Studio (new in 0.4)** — Full pattern workflow: adjustable peak detection, per-peak FWHM, d-spacing and Scherrer size, plus Miller-index matching against a user-provided reference list or reflections computed from your lattice parameters. Shows observed 2θ, reference 2θ, Δ2θ, (hkl), status and every assumption — never claims phase identification.

**AI assistance (optional, new in 0.4)** — NanoSami computes everything deterministically; the AI layer only explains. Copy a structured, origin-labelled context or open ChatGPT/Claude/Gemini/Grok, or bring your own API key (consent-gated, local-only storage, deletable). Fully functional offline with AI unused. See `docs/AI.md`.

**XRD** — Scherrer crystallite size (with optional instrumental correction) and Bragg d-spacing, with step-by-step working and honest caveats.

**Scientific calculators** — Molarity, dilution, wt%, at%, precursor mass, fuel:precursor ratio. Every equation and step shown.

**Nanomaterials library** — 12 curated pages (ZnO, TiO₂, graphene, MXenes, …).

**Android (Capacitor 6)** — See `docs/ANDROID.md`.

**Windows desktop (Tauri 2)** — True native Windows application: double-click installer → Start Menu icon → app opens. No terminal, no npm, no browser. See `docs/WINDOWS.md` and `docs/DESKTOP.md`.

---

## Windows desktop (end user)

1. Download `NanoSami_*_x64-setup.exe` from [GitHub Releases](https://github.com/samiabdullah2500-hash/NanoSami/releases).
2. Double-click the installer.
3. Launch **NanoSami** from the Start Menu.

The installer is produced automatically by GitHub Actions (`.github/workflows/desktop-windows.yml`) or by building on a Windows machine:

```powershell
npm ci
npm run build:web
npm run desktop:build
```

**Technology choice:** Tauri (not Electron) — smaller binary (~5–15 MB), system WebView2, lower memory, better security. All scientific tools use the same offline web code.

---

## Installation & running (web)

```bash
python3 -m http.server 8080   # open http://localhost:8080
# or: npm start
```

Node.js ≥ 18 only needed for tests and desktop/Android packaging.

## Running the tests

```bash
npm ci
npm test          # 91 unit tests (core + v0.4 studios)
npm run test:all  # + UI smoke tests
```

## Scientific limitations

> Automated interpretations are preliminary. Verify with complementary techniques and expert analysis.

- A single FTIR peak is never definitive proof of a material.
- Similarity scores are **not** probabilities.
- Scherrer size ≠ particle size.
- Full method: `docs/METHODOLOGY.md`. Provenance: `docs/SOURCES.md`.

## Project structure

```
index.html, css/, js/, data/, assets/, sample_data/
scripts/build-web.mjs
capacitor.config.json + android/     # Android
src-tauri/                           # Windows desktop (Tauri 2)
docs/WINDOWS.md, docs/DESKTOP.md, docs/ANDROID.md, …
.github/workflows/                   # CI, Pages, Windows desktop build
```

## Roadmap

- Williamson–Hall analysis, lattice-parameter refinement, multi-phase workflows
- Profile fitting (current FWHM values are numerical half-prominence estimates)
- Further characterization modules on the shared import/plot infrastructure (UV–Vis/Tauc, Raman, PL, TGA/DSC, …)
- Recipe replay (re-apply an exported Analysis Recipe automatically)
- OS-keychain storage for desktop API keys
- Expanded dictionary & reference sets
- Signed Windows releases + portable .exe in Releases

## Security & contributing

`SECURITY.md`, `CONTRIBUTING.md`. License: **MIT**.
