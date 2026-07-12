/* NanoSami — reusable scientific data import wizard (v0.4.0).
 * Flow: choose file (xlsx/xls/csv/tsv/txt) or paste → (Excel: pick sheet) →
 * preview + header confidence → confirm X / Y column mapping → dataset out.
 * Never silently guesses: ambiguous headers must be confirmed by the user.
 */
import { parseDelimitedToGrid, workbookToGrids, analyzeGrid, extractDataset } from '../core/dataio.js';
import { $, esc, loadXLSX, noticeHtml } from './util.js';

let uid = 0;

/**
 * Mount an importer inside `container`.
 * @param {HTMLElement} container
 * @param {{onImport:(payload)=>void, accept?:string, label?:string}} opt
 *   payload = { series, warnings, source, importMap }
 */
export function mountImporter(container, { onImport, label = 'Import data' } = {}) {
  const id = `imp${++uid}`;
  container.innerHTML = `
    <h2>${esc(label)}</h2>
    <p class="footnote">Supported: .xlsx, .xls, .csv, .tsv, .txt (or paste below). Everything is processed on your device — nothing is uploaded.</p>
    <div class="row">
      <div><label for="${id}-file">File</label>
        <input id="${id}-file" type="file" accept=".xlsx,.xls,.csv,.tsv,.txt,.dat,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"></div>
    </div>
    <label for="${id}-paste">…or paste data</label>
    <textarea id="${id}-paste" placeholder="x, sample1, sample2&#10;20, 100, 90&#10;…"></textarea>
    <button class="btn" id="${id}-load">Load</button>
    <div id="${id}-msg" aria-live="polite"></div>
    <div id="${id}-sheet" class="hide" style="margin-top:.6rem"></div>
    <div id="${id}-map" class="hide" style="margin-top:.6rem"></div>`;

  const msg = $(`#${id}-msg`, container);
  const state = { sheets: null, grid: null, analysis: null, source: null };

  function fail(e) { msg.innerHTML = `<div class="notice">${esc(e.message || e)}</div>`; }

  async function loadFile(file) {
    state.source = { fileName: file.name, fileSizeBytes: file.size };
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      msg.innerHTML = '<div class="notice info">Loading Excel reader…</div>';
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const { sheets } = workbookToGrids(XLSX, new Uint8Array(buf));
      state.sheets = sheets;
      msg.innerHTML = '';
      renderSheetPicker();
    } else {
      const text = await file.text();
      useText(text, { delimiter: 'auto' });
    }
  }

  function useText(text, opt) {
    const { grid, delimiter, warnings } = parseDelimitedToGrid(text, opt);
    state.sheets = null;
    state.source = { ...(state.source || {}), delimiter };
    pickGrid(grid, warnings, null);
  }

  function renderSheetPicker() {
    const el = $(`#${id}-sheet`, container);
    el.classList.remove('hide');
    el.innerHTML = `
      <label for="${id}-sheetsel">Sheet (${state.sheets.length} found)</label>
      <select id="${id}-sheetsel">${state.sheets.map((s, i) =>
        `<option value="${i}">${esc(s.name)} — ${s.rows}×${s.cols}</option>`).join('')}</select>`;
    const sel = $(`#${id}-sheetsel`, container);
    const choose = () => {
      const s = state.sheets[+sel.value];
      state.source = { ...state.source, sheet: s.name };
      try { pickGrid(s.grid, [], s.name); } catch (e) { fail(e); $(`#${id}-map`, container).classList.add('hide'); }
    };
    sel.addEventListener('change', choose);
    choose();
  }

  function pickGrid(grid, parseWarnings, sheetName) {
    state.grid = grid;
    state.analysis = analyzeGrid(grid);
    renderMapper(parseWarnings);
  }

  function renderMapper(parseWarnings = []) {
    const a = state.analysis;
    const el = $(`#${id}-map`, container);
    el.classList.remove('hide');
    const numericCols = a.columns.filter((c) => c.numericFraction > 0);
    const defaultX = numericCols[0]?.index ?? 0;
    const preview = state.grid.slice(0, Math.min(8, state.grid.length));
    const nCols = a.columns.length;
    const headerBadge = { certain: 'exact', likely: 'range', ambiguous: 'possible' }[a.headerConfidence] || 'possible';

    el.innerHTML = `
      ${noticeHtml(parseWarnings)}
      ${noticeHtml(a.warnings, a.headerConfidence === 'ambiguous' ? '' : 'info')}
      <div class="footnote">Header detection: <span class="badge ${headerBadge}">${a.headerConfidence}</span>
        ${a.headerRow !== null ? `(row ${a.headerRow + 1})` : '(no header — numeric data from row 1)'} · data starts at row ${a.dataStart + 1}</div>
      <div style="overflow-x:auto"><table><tbody>
        ${preview.map((r, ri) => `<tr${ri === a.headerRow ? ' style="font-weight:600"' : ''}>${
          Array.from({ length: nCols }, (_, c) => `<td>${r[c] === null || r[c] === undefined ? '<span class="footnote">—</span>' : esc(r[c])}</td>`).join('')
        }</tr>`).join('')}
        ${state.grid.length > 8 ? `<tr><td colspan="${nCols}" class="footnote">… ${state.grid.length - 8} more rows</td></tr>` : ''}
      </tbody></table></div>
      <div class="row" style="margin-top:.6rem">
        <div><label for="${id}-x">X column</label>
          <select id="${id}-x">${a.columns.map((c) =>
            `<option value="${c.index}" ${c.index === defaultX ? 'selected' : ''}>${esc(c.name)} (${Math.round(c.numericFraction * 100)}% numeric)</option>`).join('')}</select></div>
        <div><label>Y column(s)</label>
          <div id="${id}-ys">${a.columns.map((c) =>
            `<label style="display:block;font-weight:400"><input type="checkbox" value="${c.index}" ${c.index === (numericCols[1]?.index ?? -1) ? 'checked' : ''}> ${esc(c.name)} (${Math.round(c.numericFraction * 100)}% numeric)</label>`).join('')}</div></div>
      </div>
      <button class="btn" id="${id}-import">Import selected columns</button>`;

    $(`#${id}-import`, container).addEventListener('click', () => {
      try {
        const xColumn = +$(`#${id}-x`, container).value;
        const yColumns = [...el.querySelectorAll(`#${id}-ys input:checked`)].map((i) => +i.value);
        const seriesNames = yColumns.map((yc) => {
          const base = a.columns[yc].name;
          const fn = state.source?.fileName ? state.source.fileName.replace(/\.[^.]+$/, '') : '';
          return base.startsWith('Column ') && fn ? `${fn} c${yc + 1}` : base;
        });
        const { series, warnings } = extractDataset(state.grid, { xColumn, yColumns, dataStart: a.dataStart, seriesNames });
        msg.innerHTML = noticeHtml(warnings, 'info');
        onImport({
          series, warnings,
          source: state.source || { fileName: '(pasted data)' },
          importMap: { xColumn, yColumns, seriesNames, dataStart: a.dataStart, headerRow: a.headerRow, headerConfidence: a.headerConfidence },
        });
      } catch (e) { fail(e); }
    });
  }

  $(`#${id}-load`, container).addEventListener('click', async () => {
    msg.innerHTML = '';
    $(`#${id}-sheet`, container).classList.add('hide');
    $(`#${id}-map`, container).classList.add('hide');
    try {
      const f = $(`#${id}-file`, container).files[0];
      const pasted = $(`#${id}-paste`, container).value.trim();
      if (f) await loadFile(f);
      else if (pasted) { state.source = { fileName: '(pasted data)' }; useText(pasted, { delimiter: 'auto' }); }
      else msg.innerHTML = '<div class="notice">Choose a file or paste data first.</div>';
    } catch (e) { fail(e); }
  });
}
