# Data & Plotting Studio (v0.4.0)

## Purpose

A practical scientific data workspace for nanomaterials researchers and students:
import real tables, map columns, process signals, detect peaks with editable labels,
export figures and **reproducible analysis recipes**.

## Supported imports

| Format | Notes |
|--------|--------|
| CSV / TSV / TXT | Auto delimiter, header detection, multi-column |
| XLSX | Sheet selection via SheetJS (`js/vendor/xlsx.mjs`; run `npm run vendor:xlsx`) |

Workflow: Load → Preview → Map X/Y columns → Dataset in multi-trace plot.

## Processing

- Moving-average smoothing
- ALS-lite baseline approximation (educational; not a full sparse ALS solver)
- Max / min–max normalization
- Y offset

All steps are recorded in recipes.

## Peaks

Prominence-based detection (same core as FTIR). FWHM estimated by half-max
interpolation. Labels are fully editable.

## XRD pattern analysis

- Peak position, intensity, FWHM
- Bragg d-spacing
- Scherrer size with optional instrumental correction
- **hkl assignment only against an explicit reference** (never guessed)
- **Never** invents Miller indices or phase identity

## Recipes

JSON documents capturing app version, input summary, parameters, processing
chain, peaks, and notes.

## AI assistance foundation

- Fully optional; app works offline without AI
- “Build AI context” produces structured Markdown for ChatGPT / Claude / Gemini / Grok
- Optional BYO endpoint via `sessionStorage`: `nanosami_ai_endpoint`, `nanosami_ai_key`, `nanosami_ai_model`
- No chat-service passwords are ever requested
- Context instructs models **not** to invent hkl or phase IDs

## Scientific limitations

- Baseline ALS-lite is an approximation
- FWHM is geometric half-max, not a profile fit
- Reference hkl tables are typical Cu Kα literature positions — verify against ICDD/COD for publication
- Multi-phase quantification is out of scope for v0.4.0
