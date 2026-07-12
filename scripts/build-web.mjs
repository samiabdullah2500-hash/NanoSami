import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const p of ['index.html', 'css', 'js', 'data', 'assets', 'sample_data']) {
  if (existsSync(p)) cpSync(p, `www/${p}`, { recursive: true });
}
console.log('www/ built (includes js/vendor for XLSX when present)');
