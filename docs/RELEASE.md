# NanoSami — Release preparation

Status: **v0.2.0 is a local/GitHub release. Nothing has been published to Google Play.**

## Release targets

1. **Local development** — done: `python3 -m http.server 8080`, tests via `npm test`.
2. **GitHub publication** — repository is ready as-is (README, LICENSE, CHANGELOG,
   CONTRIBUTING, tests, sample data). Enable GitHub Pages on the repo root for a
   free web deployment.
3. **Android APK/AAB** — planned path (not yet built):
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init NanoSami com.samiabdullah.nanosami --web-dir .
   npx cap add android
   npx cap sync && npx cap open android   # build APK/AAB in Android Studio
   ```
   Because the app is fully client-side and dependency-free, it wraps without changes.
4. **Google Play** — after the AAB builds and the checklist below is complete.

## App identity

- **Application ID:** `com.samiabdullah.nanosami`
- **Versioning:** semantic — `0.2.0` (versionCode 2); increment versionCode every upload.
- **App icon:** derive from `assets/icon.svg` (teal #0E7C86 tile, white spectrum trace).
  Required exports: 512×512 PNG (Play listing, no alpha), adaptive icon foreground
  432×432 within 108 dp safe zone, monochrome variant. The icon stays brand-focused —
  the creator portrait is never used as the app icon.

## Store listing drafts

**App name:** NanoSami — Nano & Materials Toolkit

**Short description (≤80 chars):**
FTIR analysis, XRD calculators & nanomaterials reference — offline, on-device.

**Full description (draft):**
NanoSami is a scientific toolkit for materials science and nanotechnology students,
researchers and laboratory users.

FTIR: search a curated peak dictionary, import and plot your spectra (absorbance or
transmittance), detect peaks with adjustable sensitivity, and compare peak lists
against reference materials with a fully transparent similarity score.

XRD: calculate crystallite size (Scherrer) and d-spacing (Bragg) with step-by-step
working and honest caveats about instrumental broadening.

Lab calculators: molarity, dilution, weight and atomic percent, precursor and
fuel-ratio calculations — every equation and step shown.

Reference library: curated pages for ZnO, TiO₂, SiO₂, iron oxides, ZnS, CdS,
graphene, graphene oxide, carbon nanotubes, g-C₃N₄ and MXenes.

Private by design: everything runs on your device. Your spectra are never uploaded.

Note: NanoSami provides computational and educational assistance. Automated
interpretations are preliminary and should be verified with complementary
characterization and expert analysis.

**Feature graphic:** 1024×500 PNG — teal background, white spectrum trace motif,
app name + tagline "Analyze. Calculate. Identify."

**Screenshot checklist (phone, min 2, recommended 6):**
- [ ] Home dashboard (light) — [ ] Spectrum analyzer with detected peaks
- [ ] Peak dictionary result — [ ] Material identification with score breakdown
- [ ] Scherrer calculator with steps — [ ] Library page (dark mode)

**Category:** Education (or Tools). **Content rating:** Everyone.
**Data safety form:** no data collected, no data shared, no trackers.

## Pre-publication checklist

- [ ] Build signed AAB; test on ≥2 physical devices
- [ ] Add real screenshots to README
- [ ] Host `docs/PRIVACY_POLICY.md` at a public URL (Play requires a link)
- [ ] Verify offline behavior in the WebView wrapper
- [ ] Accessibility pass (focus order, contrast, TalkBack labels)
