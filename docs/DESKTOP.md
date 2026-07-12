# NanoSami Desktop Applications

## Platforms

| Platform | Technology | Status | End-user deliverable |
|----------|------------|--------|----------------------|
| Web | Static HTML/JS | Production | GitHub Pages |
| Android | Capacitor 6 | Source ready | Build APK/AAB with Android SDK |
| **Windows** | **Tauri 2** | **Source + CI ready** | **NSIS `.exe` installer + MSI** |

## Why Tauri for Windows (not Electron)

- Much smaller final binary (~5–15 MB vs 100+ MB).
- Uses system WebView2 already on Windows 10/11.
- Lower memory use — better for laboratory PCs.
- Stronger security model (Rust shell, no Node at runtime).
- All scientific tools work identically (same web code).

## End-user experience (Windows)

1. Download `NanoSami_0.3.0_x64-setup.exe` from GitHub Releases.
2. Double-click installer → Start Menu entry.
3. Launch “NanoSami” → window opens immediately.

## Building

See **docs/WINDOWS.md**. Short path on Windows:

```powershell
npm ci
npm run build:web
npm run desktop:build
```

## CI

`.github/workflows/desktop-windows.yml` builds installers on tags and manual dispatch.

## Layout

```
src-tauri/                 Tauri 2 project
docs/WINDOWS.md            Windows build guide
docs/DESKTOP.md            This overview
.github/workflows/desktop-windows.yml
```

Web and Android trees remain fully independent.
