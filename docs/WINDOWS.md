# NanoSami — Windows desktop (Tauri)

## Why Tauri (decision)

| Criterion | Electron | Tauri (chosen) |
|-----------|----------|----------------|
| Binary size | ~100–150 MB | ~5–15 MB |
| Runtime | Bundled Chromium | System WebView2 (Windows 10/11) |
| Memory | High | Low |
| Security model | Node + Chromium | Rust shell + system webview |
| Offline scientific app fit | Works, heavy | Ideal |
| File import / canvas / ES modules | Works | Works (same web code) |
| Installer | NSIS / Squirrel | NSIS + MSI (built-in) |

Tauri was chosen because NanoSami is a pure static offline web app. There is no need for Node.js at runtime, no heavy Chromium payload, and WebView2 is already present on modern Windows. All FTIR, XRD, plotting, identification, calculators and exports continue to use the identical browser code.

## End-user experience

1. Download `NanoSami_0.3.0_x64-setup.exe` (or the MSI) from GitHub Releases.
2. Double-click → standard Windows installer.
3. Start Menu / Desktop shortcut “NanoSami”.
4. Double-click → application window opens immediately. No terminal, no npm, no browser.

## Build on Windows (developer machine)

**Requirements**
- Windows 10/11 x64
- Node.js 18+
- Rust (rustup) with `stable-x86_64-pc-windows-msvc`
- WebView2 Runtime (pre-installed on Win10 1803+ / Win11)
- Visual Studio Build Tools (C++ workload) for the MSVC linker

```powershell
git clone https://github.com/samiabdullah2500-hash/NanoSami.git
cd NanoSami
npm ci
rustup target add x86_64-pc-windows-msvc

npm run build:web
npm run desktop:build
```

Outputs (under `src-tauri/target/release/bundle/`):
- `nsis/NanoSami_0.3.0_x64-setup.exe` — installer (recommended)
- `msi/NanoSami_0.3.0_x64_en-US.msi` — MSI
- `../nanosami.exe` — portable executable

## GitHub Actions

`.github/workflows/desktop-windows.yml` builds Windows artifacts on tags `v*` and on manual dispatch, then attaches them to the GitHub Release.

## Icons

After cloning, regenerate brand icons from the official mark:

```powershell
npx tauri icon assets/playstore_icon_512.png
```

This overwrites `src-tauri/icons/` with proper .ico / .png / .icns sets.

## File import / export

Browser `<input type="file">` and Blob downloads work inside the Tauri webview. No extra native plugins are required for current functionality.

## Limitations of the packaging environment used for this repository work

The Linux container used for repository maintenance **cannot produce a Windows PE binary**:
- Host Rust is 1.75 (too old for some Tauri 2 transitive crates / edition2024).
- No `x86_64-pc-windows-msvc` target / Windows SDK / MSVC linker.
- Cross-compilation is therefore not performed here.

Real installers are produced by the Windows GitHub Actions runner or on a Windows developer machine.
