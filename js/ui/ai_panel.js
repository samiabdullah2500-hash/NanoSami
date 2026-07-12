/* NanoSami — AI assistance panel (v0.4.0).
 * MODE A: copy structured prompt / open ChatGPT · Claude · Gemini · Grok.
 * MODE B: bring-your-own API key (optional, explicit consent, deletable).
 * The AI never computes results or modifies data — it only explains the
 * deterministic context NanoSami prepares. All AI output is clearly labelled.
 * NanoSami works fully with this panel unused or offline.
 */
import { buildPrompt, buildExternalOpen, buildApiRequest, EXTERNAL_SERVICES, API_PROVIDERS } from '../core/ai_context.js';
import { $, esc } from './util.js';

const LS_KEY = 'nanosami.ai.v1';

function loadCfg() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || null; } catch { return null; }
}
function saveCfg(cfg) { localStorage.setItem(LS_KEY, JSON.stringify(cfg)); }
function deleteCfg() { localStorage.removeItem(LS_KEY); }

let uid = 0;

/**
 * @param {HTMLElement} container
 * @param {() => string} getContext returns the current structured analysis context
 */
export function mountAiPanel(container, getContext) {
  const id = `ai${++uid}`;
  const cfg = loadCfg();
  container.innerHTML = `
    <h2>AI assistance <span class="badge possible">optional</span></h2>
    <p class="footnote">NanoSami computed everything above deterministically. An AI assistant can help
    <em>explain</em> the results — it does not calculate, and it cannot change your data. AI answers can be
    wrong: verify against literature and your supervisor.</p>
    <label for="${id}-q">Your question (optional)</label>
    <textarea id="${id}-q" placeholder='e.g. "Explain these peaks." · "What does the (101) plane mean?" · "Which result should I report in my thesis?"'></textarea>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.4rem 0">
      <button class="btn secondary" id="${id}-copy">Copy structured prompt</button>
      ${EXTERNAL_SERVICES.map((s) => `<button class="btn secondary" data-svc="${s.id}">Ask with ${esc(s.label)}</button>`).join('')}
      <button class="btn secondary" id="${id}-showctx">View context</button>
    </div>
    <div id="${id}-note" class="footnote" aria-live="polite"></div>
    <pre id="${id}-ctx" class="hide mono" style="white-space:pre-wrap;max-height:16rem;overflow:auto"></pre>
    <details style="margin-top:.6rem">
      <summary>Use your own API key (advanced, optional)</summary>
      <div class="notice info">API access is billed separately from ChatGPT/Claude/Gemini chat subscriptions.
      Your key is stored only in this app's local storage on this device — it is never sent to NanoSami's
      website or repository, and you can delete it below at any time. On the shared/public web version,
      prefer a restricted, low-limit key. Requests go directly from your device to the provider.</div>
      <div class="row">
        <div><label for="${id}-prov">Provider</label>
          <select id="${id}-prov">${API_PROVIDERS.map((p) => `<option value="${p.id}" ${cfg?.provider === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></div>
        <div><label for="${id}-model">Model (optional)</label><input id="${id}-model" placeholder="provider default" value="${esc(cfg?.model || '')}"></div>
        <div><label for="${id}-base">Base URL (only for “OpenAI-compatible”)</label><input id="${id}-base" placeholder="https://…/v1" value="${esc(cfg?.baseUrl || '')}"></div>
        <div><label for="${id}-key">API key ${cfg ? '(saved on this device)' : ''}</label><input id="${id}-key" type="password" placeholder="${cfg ? '••••••••  (saved)' : 'paste key'}"></div>
      </div>
      <label style="font-weight:400"><input type="checkbox" id="${id}-consent" ${cfg ? 'checked' : ''}>
        I understand my key is stored locally on this device and API usage may incur costs on my provider account.</label>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;margin:.4rem 0">
        <button class="btn" id="${id}-ask">Ask via API</button>
        <button class="btn secondary" id="${id}-save">Save settings</button>
        <button class="btn secondary" id="${id}-del">Disconnect &amp; delete key</button>
      </div>
      <div id="${id}-apimsg" aria-live="polite"></div>
      <div id="${id}-answer"></div>
    </details>`;

  const note = $(`#${id}-note`, container);
  const q = () => $(`#${id}-q`, container).value;
  const prompt = () => buildPrompt(getContext(), q());

  async function copyPrompt() {
    const p = prompt();
    try { await navigator.clipboard.writeText(p); return true; }
    catch {
      // clipboard can be blocked (e.g. non-secure context) — show for manual copy
      const pre = $(`#${id}-ctx`, container);
      pre.textContent = p; pre.classList.remove('hide');
      return false;
    }
  }

  $(`#${id}-copy`, container).addEventListener('click', async () => {
    note.textContent = (await copyPrompt())
      ? 'Prompt copied — paste it into any AI assistant.'
      : 'Clipboard unavailable — the full prompt is shown below; copy it manually.';
  });
  $(`#${id}-showctx`, container).addEventListener('click', () => {
    const pre = $(`#${id}-ctx`, container);
    pre.textContent = getContext();
    pre.classList.toggle('hide');
  });
  container.querySelectorAll('[data-svc]').forEach((b) => b.addEventListener('click', async () => {
    const p = prompt();
    const copied = await copyPrompt();
    const open = buildExternalOpen(b.dataset.svc, p);
    note.textContent = (copied ? '' : 'Clipboard unavailable — copy the prompt shown below. ') + open.note;
    window.open(open.url, '_blank', 'noopener');
  }));

  const apiMsg = $(`#${id}-apimsg`, container);
  const readCfg = () => ({
    provider: $(`#${id}-prov`, container).value,
    model: $(`#${id}-model`, container).value.trim() || null,
    baseUrl: $(`#${id}-base`, container).value.trim() || null,
  });
  $(`#${id}-save`, container).addEventListener('click', () => {
    if (!$(`#${id}-consent`, container).checked) { apiMsg.innerHTML = '<div class="notice">Please tick the consent box first.</div>'; return; }
    const key = $(`#${id}-key`, container).value.trim() || loadCfg()?.apiKey;
    if (!key) { apiMsg.innerHTML = '<div class="notice">Enter an API key to save.</div>'; return; }
    saveCfg({ ...readCfg(), apiKey: key });
    apiMsg.innerHTML = '<div class="notice info">Saved on this device only.</div>';
  });
  $(`#${id}-del`, container).addEventListener('click', () => {
    deleteCfg();
    $(`#${id}-key`, container).value = '';
    $(`#${id}-consent`, container).checked = false;
    apiMsg.innerHTML = '<div class="notice info">API key deleted from this device.</div>';
  });
  $(`#${id}-ask`, container).addEventListener('click', async () => {
    const saved = loadCfg();
    const key = $(`#${id}-key`, container).value.trim() || saved?.apiKey;
    if (!$(`#${id}-consent`, container).checked) { apiMsg.innerHTML = '<div class="notice">Please tick the consent box first.</div>'; return; }
    if (!key) { apiMsg.innerHTML = '<div class="notice">Enter (or save) an API key first.</div>'; return; }
    if (!navigator.onLine) { apiMsg.innerHTML = '<div class="notice">You appear to be offline — the rest of NanoSami keeps working; AI needs a connection.</div>'; return; }
    let req;
    try { req = buildApiRequest({ ...readCfg(), apiKey: key, prompt: prompt() }); }
    catch (e) { apiMsg.innerHTML = `<div class="notice">${esc(e.message)}</div>`; return; }
    apiMsg.innerHTML = '<div class="notice info">Asking the model…</div>';
    try {
      const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || `Provider returned HTTP ${res.status}.`);
      const text = req.extractText(json) || '(empty response)';
      apiMsg.innerHTML = '';
      $(`#${id}-answer`, container).innerHTML = `
        <div class="notice"><strong>AI-generated explanation — not a verified result.</strong>
        Check every claim against your data and the literature. Nothing below changes your analysis.</div>
        <div class="card" style="white-space:pre-wrap">${esc(text)}</div>`;
    } catch (e) {
      apiMsg.innerHTML = `<div class="notice">Request failed: ${esc(e.message)} (Browser CORS policies can also block some providers on the web version; the desktop app is more permissive.)</div>`;
    }
  });
}
