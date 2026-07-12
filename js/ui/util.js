/* NanoSami — shared UI utilities for the v0.4 studios.
 * (app.js keeps its own local copies for the pre-existing pages; these are the
 * canonical versions for new modules.) */

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Platform-aware text download (browser Blob / Capacitor share sheet). */
export async function downloadText(filename, text, type = 'text/plain') {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    try {
      const res = await cap.Plugins.Filesystem.writeFile({
        path: filename, data: text, directory: 'CACHE', encoding: 'utf8',
      });
      await cap.Plugins.Share.share({ title: filename, url: res.uri });
      return;
    } catch (e) { console.warn('Native share failed, falling back', e); }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Platform-aware binary download from a base64 payload (e.g. PNG). */
export async function downloadBase64(filename, base64, mime) {
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
    try {
      // Capacitor Filesystem writes base64 when no encoding is given.
      const res = await cap.Plugins.Filesystem.writeFile({ path: filename, data: base64, directory: 'CACHE' });
      await cap.Plugins.Share.share({ title: filename, url: res.uri });
      return;
    } catch (e) { console.warn('Native share failed, falling back', e); }
  }
  const a = document.createElement('a');
  a.href = `data:${mime};base64,${base64}`;
  a.download = filename;
  a.click();
}

let xlsxPromise = null;
/** Lazily load the vendored SheetJS build only when an Excel file is opened.
 * Keeps the core app zero-dependency at startup and fully offline. */
export function loadXLSX() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxPromise) return xlsxPromise;
  xlsxPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    // relative to index.html
    s.src = 'js/vendor/xlsx.full.min.js';
    s.onload = () => (window.XLSX ? resolve(window.XLSX) : reject(new Error('SheetJS failed to initialize.')));
    s.onerror = () => reject(new Error('Could not load the Excel reader (js/vendor/xlsx.full.min.js).'));
    document.head.appendChild(s);
  });
  return xlsxPromise;
}

export function noticeHtml(msgs, cls = '') {
  return (msgs || []).map((w) => `<div class="notice ${cls}">${esc(w)}</div>`).join('');
}
