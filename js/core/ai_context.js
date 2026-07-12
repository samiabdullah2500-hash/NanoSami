/**
 * NanoSami — AI assistance foundation.
 * AI explains and assists; never replaces deterministic calculations.
 * Fully optional. No chat-service passwords. BYO endpoint via sessionStorage.
 */

import { APP_VERSION } from './recipe.js';

export function buildAnalysisContext({
  kind = 'generic',
  datasetSummary = null,
  peaks = [],
  parameters = {},
  processing = [],
  results = {},
  recipe = null,
  userQuestion = '',
} = {}) {
  return {
    role: 'nanosami_analysis_context',
    app: `NanoSami ${APP_VERSION}`,
    generated: new Date().toISOString(),
    kind,
    scientific_disclaimer:
      'All numerical results below were computed deterministically by NanoSami. ' +
      'Please explain them, suggest next experimental steps, or critique assumptions. ' +
      'Do not invent peak assignments, hkl indices, or phase identities that are not already present. ' +
      'If data are insufficient, say so.',
    dataset: datasetSummary,
    parameters,
    processing,
    peaks: (peaks || []).slice(0, 100),
    results,
    recipe_summary: recipe
      ? { title: recipe.title, kind: recipe.kind, nPeaks: (recipe.peaks || []).length, processing: recipe.processing }
      : null,
    user_question: userQuestion || null,
    instructions_for_model:
      'You are assisting a materials science researcher. Be precise, cite typical literature ranges when suggesting interpretations, and clearly separate fact (from the context) from suggestion. Prefer SI units and standard crystallographic notation.',
  };
}

export function contextToMarkdown(ctx) {
  const lines = [
    `# NanoSami analysis context`, ``,
    `**App:** ${ctx.app}  `, `**Generated:** ${ctx.generated}  `, `**Kind:** ${ctx.kind}`, ``,
    `> ${ctx.scientific_disclaimer}`, ``,
    `## Dataset`, '```json', JSON.stringify(ctx.dataset, null, 2), '```', ``,
    `## Parameters`, '```json', JSON.stringify(ctx.parameters, null, 2), '```', ``,
    `## Processing`, '```json', JSON.stringify(ctx.processing, null, 2), '```', ``,
    `## Peaks (up to 100)`, '```json', JSON.stringify(ctx.peaks, null, 2), '```', ``,
    `## Results`, '```json', JSON.stringify(ctx.results, null, 2), '```',
  ];
  if (ctx.user_question) lines.push('', '## User question', ctx.user_question);
  lines.push('', '## Instructions for the model', ctx.instructions_for_model);
  return lines.join('\n');
}

export async function optionalAIComplete(contextMarkdown, { systemPrompt } = {}) {
  const endpoint = sessionStorage.getItem('nanosami_ai_endpoint');
  if (!endpoint) {
    return {
      ok: false,
      mode: 'copy_only',
      message:
        'No AI endpoint configured. Copy the analysis context and paste it into ChatGPT, Claude, Gemini, or Grok. ' +
        'To enable optional in-app calls, set sessionStorage nanosami_ai_endpoint (and optionally nanosami_ai_key, nanosami_ai_model).',
      context: contextMarkdown,
    };
  }
  const key = sessionStorage.getItem('nanosami_ai_key') || '';
  const model = sessionStorage.getItem('nanosami_ai_model') || 'gpt-4o-mini';
  const headers = { 'Content-Type': 'application/json' };
  if (key) headers.Authorization = `Bearer ${key}`;
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt || 'You assist with materials science data analysis. Be precise and do not invent crystallographic assignments.' },
      { role: 'user', content: contextMarkdown },
    ],
    temperature: 0.2,
  };
  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body) });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) return { ok: false, mode: 'error', status: res.status, data, context: contextMarkdown };
    const reply =
      data?.choices?.[0]?.message?.content ||
      data?.content?.[0]?.text ||
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.raw || JSON.stringify(data);
    return { ok: true, mode: 'endpoint', reply, raw: data };
  } catch (e) {
    return { ok: false, mode: 'error', message: String(e.message || e), context: contextMarkdown };
  }
}
