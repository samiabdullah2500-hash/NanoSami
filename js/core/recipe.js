/**
 * NanoSami — Analysis Recipe (v0.4.0).
 * A recipe is an ordered, self-describing JSON record of an analysis:
 * source metadata → import mapping → processing steps → analysis settings →
 * results snapshot. It is designed so the SAME analysis can be reproduced by a
 * human (steps are human-readable) or replayed by future NanoSami versions.
 */

export const RECIPE_SCHEMA_VERSION = 1;

export function createRecipe({ app = 'NanoSami', appVersion, analysisType }) {
  if (!appVersion) throw new Error('appVersion is required.');
  if (!analysisType) throw new Error('analysisType is required.');
  return {
    schema: 'nanosami-analysis-recipe',
    schemaVersion: RECIPE_SCHEMA_VERSION,
    app, appVersion, analysisType,
    created: new Date().toISOString(),
    source: null,        // {fileName,fileSizeBytes,sheet,delimiter,...}
    import: null,        // {headerRow,dataStart,xColumn,yColumns,seriesNames,warnings}
    steps: [],           // [{op, params, description, appliedTo, timestamp}]
    analysis: null,      // technique-specific settings (peak detection, Scherrer, matching...)
    results: null,       // snapshot of key numeric results
    notes: [],
  };
}

export function setSource(recipe, source) { recipe.source = { ...source }; return recipe; }
export function setImport(recipe, imp) { recipe.import = { ...imp }; return recipe; }
export function addStep(recipe, { op, params = {}, description, appliedTo = 'all' }) {
  if (!op || !description) throw new Error('Each step needs an op and a description.');
  recipe.steps.push({ op, params, description, appliedTo, timestamp: new Date().toISOString() });
  return recipe;
}
export function setAnalysis(recipe, analysis) { recipe.analysis = analysis; return recipe; }
export function setResults(recipe, results) { recipe.results = results; return recipe; }

export function serializeRecipe(recipe) {
  validateRecipe(recipe);
  return JSON.stringify(recipe, null, 2);
}

export function validateRecipe(r) {
  const fail = (m) => { throw new Error(`Invalid recipe: ${m}`); };
  if (!r || typeof r !== 'object') fail('not an object');
  if (r.schema !== 'nanosami-analysis-recipe') fail('wrong schema tag');
  if (!Number.isInteger(r.schemaVersion) || r.schemaVersion < 1) fail('bad schemaVersion');
  if (!r.appVersion) fail('missing appVersion');
  if (!r.analysisType) fail('missing analysisType');
  if (!Array.isArray(r.steps)) fail('steps must be an array');
  for (const s of r.steps) if (!s.op || !s.description) fail('every step needs op + description');
  return true;
}

export function parseRecipe(json) {
  let r;
  try { r = JSON.parse(json); } catch { throw new Error('Recipe file is not valid JSON.'); }
  validateRecipe(r);
  return r;
}
