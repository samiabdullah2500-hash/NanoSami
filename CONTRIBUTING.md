# Contributing to NanoSami

Thank you for helping improve NanoSami.

## Ground rules
1. **Scientific integrity first.** Never add fabricated values, references or DOIs.
   If a value varies strongly with phase/size/synthesis, say so in the entry.
   If reliable data are unavailable, mark the field as requiring verification.
2. **Keep calculations transparent.** New calculators must display their equation,
   variables and steps, and validate inputs with clear error messages.
3. **Zero runtime dependencies.** Core logic goes in `js/core/` as pure ES modules
   so it is testable in Node and usable in the browser unchanged.

## Adding data
- FTIR dictionary: append an object to `data/ftir_peaks.js` following the schema
  in the file header.
- Reference materials: append to `data/materials_ftir.js`; mark truly characteristic
  peaks `essential: true` (double weight in scoring).
- Library pages: append to `data/nanomaterials.js`.

## Development
```bash
python3 -m http.server 8080    # run the app
node tests/run_tests.mjs       # run tests — must pass before a PR
```
Add tests for any new calculation or parser behavior, including invalid input.
