# Changelog

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
