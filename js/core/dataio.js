/**
 * NanoSami — universal scientific data import (v0.4.0).
 *
 * Design: every source format (CSV / TSV / TXT / XLSX / XLS) is first reduced
 * to a GRID — an array of rows, each row an array of raw cell values
 * (string | number | null). All downstream logic (header detection, column
 * mapping, dataset extraction) operates on grids only, so it is identical for
 * every file type and fully unit-testable in Node without any Excel library.
 *
 * Honesty rules:
 * - Header detection returns a confidence flag; when structure is ambiguous
 *   the caller MUST ask the user instead of silently guessing.
 * - Invalid/missing cells are never silently dropped inside a series; they are
 *   counted and reported, and rows are excluded pairwise (x with its y).
 */

/** Split one line of delimited text into raw cells. */
function splitLine(line, delim) {
  if (delim === 'whitespace') return line.trim().split(/\s+/);
  // Minimal quoted-field support for CSV/TSV/semicolon.
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/** Detect the most likely delimiter of a text file. Returns ',' ';' '\t' or 'whitespace'. */
export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => l.trim() && !l.trim().startsWith('#') && !l.trim().startsWith('//')).slice(0, 30);
  if (!lines.length) return ',';
  const cands = [',', ';', '\t'];
  let best = null, bestScore = -1;
  for (const d of cands) {
    const counts = lines.map((l) => splitLine(l, d).length);
    const mode = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)];
    if (mode < 2) continue;
    const consistent = counts.filter((c) => c === mode).length / counts.length;
    const score = consistent * mode;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  if (best) return best;
  // fall back to whitespace if lines split into ≥2 numeric-looking columns
  const wsCols = splitLine(lines[0], 'whitespace').length;
  return wsCols >= 2 ? 'whitespace' : ',';
}

/** Coerce a raw cell to number | string | null. Handles decimal commas ("3,14")
 *  only when the delimiter is not ','. */
function coerceCell(raw, { decimalComma = false } = {}) {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim();
  if (s === '' || /^(na|n\/a|nan|null|-|—)$/i.test(s)) return null;
  if (decimalComma && /^-?\d+,\d+([eE][+-]?\d+)?$/.test(s)) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : String(raw).trim();
}

/**
 * Parse delimited text into a grid.
 * @returns {{grid: any[][], delimiter: string, warnings: string[]}}
 */
export function parseDelimitedToGrid(text, { delimiter = 'auto' } = {}) {
  if (typeof text !== 'string' || text.trim() === '') throw new Error('The file or pasted text is empty.');
  const warnings = [];
  const delim = delimiter === 'auto' ? detectDelimiter(text) : delimiter;
  const decimalComma = delim !== ',' && /(^|[\s;\t])-?\d+,\d+([\s;\t]|$)/m.test(text);
  if (decimalComma) warnings.push('Decimal commas detected (e.g. "3,14") — interpreted as decimal points.');
  const grid = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    const t = line.trim();
    if (t === '' || t.startsWith('#') || t.startsWith('//')) continue;
    grid.push(splitLine(line, delim).map((c) => coerceCell(c, { decimalComma })));
  }
  if (!grid.length) throw new Error('No data rows found.');
  return { grid, delimiter: delim === '\t' ? 'tab' : delim, warnings };
}

/**
 * Convert a SheetJS workbook object into sheet descriptors + grids.
 * The XLSX library object is injected (browser: vendored script; Node: require)
 * so this module itself stays dependency-free.
 * @param {object} XLSX injected SheetJS namespace
 * @param {ArrayBuffer|Uint8Array} data raw file bytes
 * @returns {{sheets: {name:string, grid:any[][], rows:number, cols:number}[]}}
 */
export function workbookToGrids(XLSX, data) {
  const wb = XLSX.read(data, { type: data instanceof ArrayBuffer ? 'array' : 'array', cellDates: false });
  const sheets = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    const grid = aoa.map((row) => row.map((c) => coerceCell(c)));
    // drop fully-empty trailing rows
    while (grid.length && grid[grid.length - 1].every((c) => c === null)) grid.pop();
    const cols = grid.reduce((m, r) => Math.max(m, r.length), 0);
    sheets.push({ name, grid, rows: grid.length, cols });
  }
  if (!sheets.length) throw new Error('The workbook contains no sheets.');
  return { sheets };
}

/**
 * Analyze a grid: locate the data block, detect a header row, list columns.
 * Never guesses silently — `headerConfidence` is 'certain' | 'likely' | 'ambiguous'.
 * @returns {{
 *   headerRow: number|null, headerConfidence: string, dataStart: number,
 *   columns: {index:number, name:string, numericCount:number, totalCount:number, numericFraction:number, sample:any[]}[],
 *   warnings: string[]
 * }}
 */
export function analyzeGrid(grid) {
  if (!Array.isArray(grid) || !grid.length) throw new Error('Empty grid.');
  const warnings = [];
  const isNumRow = (row) => {
    const cells = row.filter((c) => c !== null);
    if (cells.length < 1) return false;
    return cells.filter((c) => typeof c === 'number').length / cells.length >= 0.8 && cells.some((c) => typeof c === 'number');
  };
  // First row (within the first 10) from which numeric rows dominate.
  let dataStart = -1;
  for (let i = 0; i < Math.min(grid.length, 25); i++) {
    if (isNumRow(grid[i])) { dataStart = i; break; }
  }
  if (dataStart === -1) throw new Error('No numeric data rows found in this sheet/file.');

  let headerRow = null, headerConfidence = 'certain';
  if (dataStart > 0) {
    const cand = grid[dataStart - 1];
    const textCells = cand.filter((c) => typeof c === 'string' && c !== '').length;
    const numCells = cand.filter((c) => typeof c === 'number').length;
    if (textCells >= 1 && numCells === 0 && !isNumRow(cand)) {
      headerRow = dataStart - 1;
      headerConfidence = textCells >= Math.min(2, cand.filter((c) => c !== null).length) ? 'certain' : 'likely';
      if (dataStart - 1 > 0) warnings.push(`${dataStart - 1} leading row(s) before the header were skipped (metadata/comments).`);
    } else if (textCells >= 1 && numCells > 0) {
      headerRow = dataStart - 1;
      headerConfidence = 'ambiguous';
      warnings.push('The row above the data mixes text and numbers — please confirm the header row before importing.');
    } else {
      headerConfidence = 'ambiguous';
      warnings.push('Rows before the data block do not look like a simple header — please confirm the header row.');
    }
  } else {
    headerRow = null; // pure numeric file, no header
  }

  const nCols = grid.reduce((m, r) => Math.max(m, r.length), 0);
  const dataRows = grid.slice(dataStart);
  const columns = [];
  for (let c = 0; c < nCols; c++) {
    let numericCount = 0, totalCount = 0;
    const sample = [];
    for (const r of dataRows) {
      const v = r[c] ?? null;
      if (v !== null) { totalCount++; if (typeof v === 'number') numericCount++; }
      if (sample.length < 5 && v !== null) sample.push(v);
    }
    const headerName = headerRow !== null ? grid[headerRow][c] : null;
    columns.push({
      index: c,
      name: headerName !== null && headerName !== undefined && String(headerName).trim() !== '' ? String(headerName) : `Column ${c + 1}`,
      numericCount, totalCount,
      numericFraction: totalCount ? numericCount / totalCount : 0,
      sample,
    });
  }
  return { headerRow, headerConfidence, dataStart, columns, warnings };
}

/**
 * Extract a dataset from a grid given explicit user (or confirmed) column mapping.
 * Rows where x or a given y is missing/invalid are excluded from that series
 * (pairwise), and counts are reported — nothing is imputed.
 * @param {any[][]} grid
 * @param {{xColumn:number, yColumns:number[], dataStart:number, seriesNames?:string[]}} map
 * @returns {{x:number[], series:{name:string, x:number[], y:number[], dropped:number}[], warnings:string[]}}
 */
export function extractDataset(grid, { xColumn, yColumns, dataStart = 0, seriesNames = [] }) {
  if (!Number.isInteger(xColumn) || xColumn < 0) throw new Error('Select an X column.');
  if (!Array.isArray(yColumns) || !yColumns.length) throw new Error('Select at least one Y column.');
  if (yColumns.includes(xColumn)) throw new Error('X and Y columns must be different.');
  const warnings = [];
  const series = yColumns.map((yc, i) => ({
    name: seriesNames[i] || `Series ${i + 1}`, x: [], y: [], dropped: 0, column: yc,
  }));
  let badX = 0;
  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r];
    const xv = row?.[xColumn];
    if (typeof xv !== 'number') { badX++; continue; }
    for (const s of series) {
      const yv = row[s.column];
      if (typeof yv === 'number') { s.x.push(xv); s.y.push(yv); }
      else s.dropped++;
    }
  }
  if (badX) warnings.push(`${badX} row(s) skipped: missing or non-numeric X value.`);
  for (const s of series) {
    if (s.dropped) warnings.push(`Series "${s.name}": ${s.dropped} row(s) skipped (missing/non-numeric Y).`);
    if (s.x.length < 2) throw new Error(`Series "${s.name}" has fewer than 2 valid points — check the column mapping.`);
    // sort by x ascending, average duplicate x
    const idx = s.x.map((_, i) => i).sort((a, b) => s.x[a] - s.x[b]);
    const xs = [], ys = [];
    for (const i of idx) {
      if (xs.length && s.x[i] === xs[xs.length - 1]) ys[ys.length - 1] = (ys[ys.length - 1] + s.y[i]) / 2;
      else { xs.push(s.x[i]); ys.push(s.y[i]); }
    }
    s.x = xs; s.y = ys;
    delete s.column;
  }
  return { series, warnings };
}
