# v0.4.0 integration notes

## What is on this branch

### Core modules (complete, tested)
- `js/core/import.js` — CSV/TSV/TXT/XLSX table import, preview, column mapping
- `js/core/processing.js` — smooth, baseline ALS-lite, normalize, FWHM, applyChain
- `js/core/plot.js` — multi-dataset canvas plots + PNG export
- `js/core/xrd_advanced.js` — XRD peaks, d-spacing, Scherrer, **hkl only from explicit refs**
- `js/core/recipe.js` — reproducible analysis recipes
- `js/core/ai_context.js` — optional AI context (no passwords, BYO endpoint)

### Tests
- Original 46 core tests (still pass)
- New 20 tests in `tests/test_v040.mjs` (pass)
- Run: `npm test`

### XLSX vendor
```bash
npm run vendor:xlsx   # downloads SheetJS into js/vendor/
```
App works fully for CSV/TSV/TXT without vendor.

### UI integration (studio.js + app.js)
Local development tree contains full `js/studio.js` and enhanced `js/app.js`.
If they are not yet on the remote branch in this PR snapshot, copy from the
packaging workspace or re-apply:

1. Add route `{ hash: '#/studio', label: 'Studio', glyph: '◈' }`
2. `import { renderStudio, studio } from './studio.js'`
3. `pages.studio = () => renderStudio($('#main'))`
4. XRD page: pattern paste + `detectXrdPeaks` / `assignHklFromReference`

See local `js/studio.js` and `js/app.js` in the development checkout.

### Platforms preserved
- Web (GitHub Pages)
- Android (Capacitor)
- Windows (Tauri `src-tauri/`)

### Scientific policy
- hkl never guessed
- AI never replaces deterministic math
- Recipes record version + parameters for reproducibility
