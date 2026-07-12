# NanoSami — Android build guide (Capacitor)

## Status (honest)
The complete Android project is generated, configured and committed under `android/`.
It was **not compiled in the development environment**: the Gradle distribution
(services.gradle.org) and Android SDK (dl.google.com) are unreachable there, and the
build fails at the Gradle wrapper download step. Everything up to compilation is
verified: web assets copied to `android/app/src/main/assets/public/`, plugins
(@capacitor/filesystem, @capacitor/share) synced, app id `com.samiabdullah.nanosami`,
name `NanoSami`, versionName 0.3.0 / versionCode 3, brand launcher icons (regular,
round, adaptive) at all densities. **No APK or AAB exists yet.**

## Why Capacitor (decision)
The app is offline-first static HTML/JS. Capacitor wraps it in a native WebView with
no code rewrite, keeps the web version intact, and provides the two native bridges
this app actually needs: Filesystem + Share for exports (Blob downloads fail silently
in Android WebViews — the app detects the native platform and uses the share sheet
instead; see `download()` in `js/app.js`, covered by smoke tests). The alternative,
a Trusted Web Activity (Bubblewrap), was rejected: it requires a live HTTPS
deployment and Chrome, and gives weaker offline behavior and no native file bridge.

## Build on your machine
Requirements: Android Studio (or SDK cmdline-tools + platform 34 + build-tools),
JDK 17+, Node 18+.

```bash
npm ci
npm run build:web            # regenerates www/ from the source tree
npx cap sync android
cd android
./gradlew assembleDebug      # debug APK: android/app/build/outputs/apk/debug/app-debug.apk
```

Install on a device: `adb install app/build/outputs/apk/debug/app-debug.apk`

### Release APK / AAB (for Google Play)
1. Create a keystore once:
   `keytool -genkey -v -keystore nanosami.keystore -alias nanosami -keyalg RSA -keysize 2048 -validity 10000`
2. Configure signing in `android/app/build.gradle` (or Android Studio → Generate Signed Bundle).
3. `./gradlew bundleRelease` → AAB at `android/app/build/outputs/bundle/release/`

Never commit the keystore or passwords.

## Project identity
- Application ID: `com.samiabdullah.nanosami`
- App name: NanoSami
- versionName: 0.3.0  versionCode: 3
- Min SDK 22, target/compile SDK 34

## Notes
- After changing web assets always re-run `npm run build:web && npx cap sync android`.
- The `android/app/src/main/assets/public/` directory is generated and gitignored;
  do not edit it by hand.
- Launcher icons are brand spectrum motif only (never the creator portrait).
