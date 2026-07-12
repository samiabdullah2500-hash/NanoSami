/**
 * NanoSami — universal scientific data import.
 * Pure functions. Supports CSV / TSV / TXT / XLSX with preview and column mapping.
 * Never uploads data; all parsing is local.
 */

export function detectDelimiter(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((l) => {
    const t = l.trim();
    return t && !t.startsWith('#') && !t.startsWith('//');
  }).slice(0, 20);
  if (!lines.length) return ',';
  const scores = { '\t': 0, ',': 0, ';': 0, ' ': 0 };
  for (const line of lines) {
    if (line.includes('\t')) scores['\t'] += (line.match(/\t/g) || []).length;
    if (line.includes(',')) scores[','] += (line.match(/,/g) || []).length;
    if (line.includes(';')) scores[';'] += (line.match(/;/g) || []).length;
  }
  let best = ',';
  let max = -1;
  for (const [d, s] of Object.entries(scores)) {
    if (s > max) { max = s; best = d; }
  }
  if (max < lines.length) return /\s+/;
  return best;
}

export function parseTextTable(text, { delimiter = 'auto', hasHeader = 'auto' } = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('The file or pasted text is empty.');
  }
  const warnings = [];
  const delim = delimiter === 'auto' ? detectDelimiter(text) : delimiter;
  const lines = text.split(/\r\n|\r|\n/);
  const rawRows = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('//')) continue;
    let cells;
    if (delim instanceof RegExp) {
      cells = t.split(delim).map((c) => c.trim()).filter((c, i, a) => c !== '' || i === 0 || i === a.length - 1);
    } else {
      cells = t.split(delim).map((c) => c.trim());
    }
    if (cells.length) rawRows.push(cells);
  }
  if (!rawRows.length) throw new Error('No data rows found after removing comments and blank lines.');

  const ncols = Math.max(...rawRows.map((r) => r.length));
  if (ncols < 1) throw new Error('No columns detected.');
  const normalized = rawRows.map((r) => {
    const out = r.slice();
    while (out.length < ncols) out.push('');
    return out;
  });

  let headers = null;
  let dataStart = 0;
  const firstIsHeader = (() => {
    if (hasHeader === true) return true;
    if (hasHeader === false) return false;
    const first = normalized[0];
    let nonNum = 0;
    for (let i = 0; i < Math.min(4, first.length); i++) {
      const v = Number(String(first[i]).replace(/[,']/g, ''));
      if (first[i] !== '' && !Number.isFinite(v)) nonNum++;
    }
    return nonNum >= 1;
  })();

  if (firstIsHeader) {
    headers = normalized[0].map((h, i) => h || `Column ${i + 1}`);
    dataStart = 1;
    warnings.push('First row treated as header.');
  } else {
    headers = Array.from({ length: ncols }, (_, i) => `Column ${i + 1}`);
    warnings.push('No header detected — using Column 1, Column 2, …');
  }

  const rows = normalized.slice(dataStart);
  if (rows.length < 2) warnings.push('Very few data rows — analysis may be unreliable.');
  return { headers, rows, delimiter: String(delim), warnings, columnCount: ncols, rowCount: rows.length };
}

export function mapColumns(table, { xCol = 0, yCols = [1], skipInvalid = true } = {}) {
  const warnings = [];
  if (!table || !table.rows) throw new Error('No table to map.');
  const ncols = table.columnCount || table.headers.length;
  if (xCol < 0 || xCol >= ncols) throw new Error(`X column index ${xCol} is out of range (0–${ncols - 1}).`);
  for (const yc of yCols) {
    if (yc < 0 || yc >= ncols) throw new Error(`Y column index ${yc} is out of range (0–${ncols - 1}).`);
    if (yc === xCol) throw new Error('X and Y columns must be different.');
  }
  if (!yCols.length) throw new Error('Select at least one Y column.');

  const x = [];
  const series = yCols.map((yc) => ({
    name: table.headers[yc] || `Y${yc + 1}`,
    y: [],
    colIndex: yc,
  }));
  let dropped = 0;

  for (const row of table.rows) {
    const xv = Number(String(row[xCol]).replace(/[,']/g, ''));
    if (!Number.isFinite(xv)) {
      if (skipInvalid) { dropped++; continue; }
      throw new Error(`Non-numeric X value: "${row[xCol]}"`);
    }
    const ys = [];
    let ok = true;
    for (const yc of yCols) {
      const yv = Number(String(row[yc]).replace(/[,']/g, ''));
      if (!Number.isFinite(yv)) {
        if (skipInvalid) { ok = false; break; }
        throw new Error(`Non-numeric Y value: "${row[yc]}"`);
      }
      ys.push(yv);
    }
    if (!ok) { dropped++; continue; }
    x.push(xv);
    ys.forEach((yv, i) => series[i].y.push(yv));
  }

  if (x.length < 2) throw new Error('Fewer than 2 valid numeric rows after column mapping.');
  if (dropped) warnings.push(`Dropped ${dropped} row(s) with non-numeric values.`);

  const order = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
  const xs = order.map((i) => x[i]);
  for (const s of series) s.y = order.map((i) => s.y[i]);

  const ux = [], useries = series.map((s) => ({ name: s.name, colIndex: s.colIndex, y: [] }));
  for (let i = 0; i < xs.length; i++) {
    if (ux.length && xs[i] === ux[ux.length - 1]) {
      for (let k = 0; k < useries.length; k++) {
        const n = useries[k].y.length;
        useries[k].y[n - 1] = (useries[k].y[n - 1] + series[k].y[i]) / 2;
      }
    } else {
      ux.push(xs[i]);
      series.forEach((s, k) => useries[k].y.push(s.y[i]));
    }
  }

  return { x: ux, series: useries, warnings, dropped, nPoints: ux.length };
}

export function guessMapping(headers) {
  const lower = headers.map((h) => String(h).toLowerCase());
  let xCol = 0;
  const yCols = [];
  const xHints = [/wave\s*number|wavenumber|cm-?1|cm⁻¹|2\s*theta|2θ|theta|°|deg|q\s*\(|energy|eV|wavelength|nm|μm|um\b/i];
  const yHints = [/abs|trans|intens|counts?|cps|signal|y\b|a\.?u\.?|arb|norm|%t|reflect/i];
  for (let i = 0; i < lower.length; i++) {
    if (xHints.some((re) => re.test(lower[i]))) { xCol = i; break; }
  }
  for (let i = 0; i < lower.length; i++) {
    if (i === xCol) continue;
    if (yHints.some((re) => re.test(lower[i])) || yCols.length === 0) yCols.push(i);
  }
  if (!yCols.length && lower.length > 1) yCols.push(xCol === 0 ? 1 : 0);
  return { xCol, yCols: yCols.slice(0, 8) };
}

export function previewTable(table, n = 12) {
  return {
    headers: table.headers,
    rows: table.rows.slice(0, n),
    totalRows: table.rowCount,
    columnCount: table.columnCount,
  };
}

export function parseXlsxBuffer(buffer, XLSX, { sheet } = {}) {
  if (!XLSX || !XLSX.read) throw new Error('XLSX library is not loaded.');
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, dense: false });
  const names = wb.SheetNames;
  if (!names.length) throw new Error('The workbook contains no sheets.');
  let sheetName = names[0];
  if (typeof sheet === 'number') sheetName = names[sheet] || names[0];
  else if (typeof sheet === 'string' && names.includes(sheet)) sheetName = sheet;
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (!aoa.length) throw new Error(`Sheet "${sheetName}" is empty.`);
  const headers = aoa[0].map((c, i) => (c === '' || c == null ? `Column ${i + 1}` : String(c)));
  const maxCol = Math.max(headers.length, ...aoa.map((r) => r.length));
  while (headers.length < maxCol) headers.push(`Column ${headers.length + 1}`);
  const rows = aoa.slice(1).map((r) => {
    const out = [];
    for (let i = 0; i < maxCol; i++) out.push(r[i] == null ? '' : String(r[i]));
    return out;
  }).filter((r) => r.some((c) => c !== ''));
  return {
    headers, rows, columnCount: maxCol, rowCount: rows.length,
    warnings: [`Loaded sheet "${sheetName}" (${rows.length} data rows, ${maxCol} columns).`],
    sheetNames: names, activeSheet: sheetName, delimiter: 'xlsx',
  };
}

export function createDatasetId() {
  return `ds_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
