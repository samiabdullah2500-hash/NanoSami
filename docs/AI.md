# NanoSami AI Assistance layer (v0.4.0)

The AI layer is **optional** and **explanatory only**. NanoSami's deterministic
engines (`js/core/*`) perform all data processing, peak detection and
calculations. The AI never computes results and can never modify experimental
data. NanoSami remains fully functional with the AI panel unused, disabled, or
offline (verified by tests in `tests/run_tests_v04.mjs`).

## What the assistant can help with

- Understanding how to use NanoSami and what each control does.
- Explaining scientific terminology, equations and assumptions.
- Cautiously interpreting the current results ("Explain these peaks", "What
  does the (101) plane mean?", "Which result should I report in my thesis?").
- Suggesting sensible next analysis steps.
- Preparing well-structured questions for external AI tools.

## Structured context

Each analysis page can generate a structured, human-readable context
(`buildAnalysisContext` in `js/core/ai_context.js`) containing:

- analysis type, sample name, app version, units;
- **Settings (user-selected)** — wavelength, K, detection parameters, …;
- **Assumptions** — e.g. the Miller-matching reference and its caveats;
- **Tables (NanoSami-calculated)** — the current peak/result table;
- **Known limitations** — e.g. "FWHM values are half-prominence numerical
  estimates, not profile fits."

Every block is labelled by origin so measured data, NanoSami-calculated
results, user assumptions and AI interpretation cannot be confused. The
wrapped prompt explicitly instructs the assistant to distinguish data from
interpretation, state uncertainty honestly, and not invent reference values.

## MODE A — external chat services

Buttons: **Copy structured prompt**, **Ask with ChatGPT / Claude / Gemini /
Grok**. NanoSami copies the prompt to the clipboard and opens the service in a
new tab. Where a public URL prefill parameter exists it is attempted, but the
prompt is always copied first because prefill support is not an official
integration and can change at any time. NanoSami never asks for, sees, or
stores account passwords for any of these services.

## MODE B — bring your own API key (advanced)

Supported providers: Anthropic and OpenAI natively, plus a generic
"OpenAI-compatible" base-URL option (`API_PROVIDERS` in `js/core/ai_context.js`)
that reaches any service exposing that API shape — Google Gemini and xAI Grok
both publish OpenAI-compatible endpoints.

Safeguards:

- Explicit consent checkbox is required before saving or sending anything.
- The UI states clearly that **API billing is separate** from chat
  subscriptions.
- The key is kept only in the app's local storage on the user's device
  (`localStorage` on web/desktop WebView; app-private WebView storage on
  Android). It is **never** committed to Git, never sent to NanoSami's GitHub
  Pages origin, and never included in exports or recipes.
- Requests go directly from the device to the chosen provider over HTTPS.
- A **Disconnect & delete key** button removes the credential at any time.

### Platform honesty

`localStorage` is not hardware-backed secure storage. On the public web build
this is an accepted, clearly-communicated trade-off: the UI recommends using a
restricted, low-limit key there. The Tauri desktop and Capacitor Android
builds keep the same mechanism inside an app-private WebView profile, which
isolates the key from other websites; migrating desktop storage to the OS
keychain (Tauri stronghold/keyring plugin) is on the roadmap. Some providers'
CORS policies may block direct browser calls on the web version; the desktop
app is more permissive. NanoSami does not pretend otherwise — the error
message says so.

## Scientific-integrity rules

- All AI answers are rendered inside a clearly labelled
  "**AI-generated explanation — not a verified result**" block.
- The AI has no write access to datasets, settings or results; any processing
  idea it suggests must be applied manually by the user through the normal UI.
- AI output must never be presented as material/phase identification;
  the context itself states that (hkl) assignments are reference matches only.
