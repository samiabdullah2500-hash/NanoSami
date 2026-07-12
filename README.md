# NanoSami — Materials Science & Nanotechnology Toolkit

**v0.3.0** · **Analyze. Calculate. Identify. Explore Nanomaterials.**

Live web app: `https://samiabdullah2500-hash.github.io/NanoSami/`

NanoSami is an offline-first scientific toolkit for students, researchers and laboratory
users in materials science and nanotechnology. It combines FTIR interpretation tools,
XRD calculators, laboratory calculators and a curated nanomaterials reference library
in a single privacy-friendly application. All processing happens on your device.

Created by **Sami Abdullah Mohammed** (M.Sc. Physics — Nanoscience and Nanotechnology).

---

## Features

**FTIR** — Peak dictionary, spectrum analyzer (CSV/TSV import, prominence peaks, transmittance dips), rule-based material identification (12 references, explainable scores).

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
npm test          # 46 core unit tests
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

- Williamson–Hall, lattice parameter, XRD indexing
- Baseline correction / peak fitting
- Expanded dictionary & reference sets
- Signed Windows releases + portable .exe in Releases

## Security & contributing

`SECURITY.md`, `CONTRIBUTING.md`. License: **MIT**.
