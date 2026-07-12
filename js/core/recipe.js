/**
 * NanoSami — Analysis Recipes for reproducibility.
 * A Recipe records: software version, input description, parameters,
 * processing steps, peak table, references, and notes.
 * Recipes are plain JSON — exportable and re-importable.
 */

export const RECIPE_VERSION = 1;
export const APP_VERSION = '0.4.0';

/**
 * Create an empty recipe scaffold.
 */
export function createRecipe({
  title = 'Untitled analysis',
  kind = 'generic', // 'ftir' | 'xrd' | 'generic'
  input = {},
  parameters = {},
  processing = [],
  peaks = [],
  results = {},
  references = [],
  notes = '',
} = {}) {
  return {
    recipeVersion: RECIPE_VERSION,
    app: `NanoSami ${APP_VERSION}`,
    created: new Date().toISOString(),
    title,
    kind,
    input: {
      filename: input.filename || null,
      nPoints: input.nPoints ?? null,
      xRange: input.xRange || null,
      yColumns: input.yColumns || null,
      mode: input.mode || null,
      sheet: input.sheet || null,
      ...input,
    },
    parameters,
    processing,
    peaks,
    results,
    references,
    notes,
    disclaimer:
      'NanoSami provides computational and educational assistance. Automated interpretations are preliminary and should be verified with complementary techniques and expert analysis.',
  };
}

export function recipeToJSON(recipe, pretty = true) {
  return JSON.stringify(recipe, null, pretty ? 2 : 0);
}

export function recipeFromJSON(text) {
  const r = typeof text === 'string' ? JSON.parse(text) : text;
  if (!r || typeof r !== 'object') throw new Error('Invalid recipe JSON.');
  if (r.recipeVersion == null) throw new Error('Missing recipeVersion — this may not be a NanoSami recipe.');
  return r;
}

/**
 * Human-readable summary for UI / AI context.
 */
export function summarizeRecipe(recipe) {
  const lines = [
    `Title: ${recipe.title}`,
    `Kind: ${recipe.kind}`,
    `App: ${recipe.app}`,
    `Created: ${recipe.created}`,
    `Input: ${recipe.input.filename || 'pasted/unknown'} · ${recipe.input.nPoints ?? '?'} points` +
      (recipe.input.xRange ? ` · X ∈ [${recipe.input.xRange[0]}, ${recipe.input.xRange[1]}]` : ''),
    `Parameters: ${JSON.stringify(recipe.parameters)}`,
    `Processing steps (${(recipe.processing || []).length}):`,
    ...(recipe.processing || []).map((s, i) => `  ${i + 1}. ${s.description || s.op}`),
    `Peaks recorded: ${(recipe.peaks || []).length}`,
    recipe.notes ? `Notes: ${recipe.notes}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}
