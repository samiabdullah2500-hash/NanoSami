/* Copies only the web application into www/ for Capacitor packaging.
 * Keeps the repo root (docs, tests, android project) out of the app bundle. */
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const p of ['index.html', 'css', 'js', 'data', 'assets', 'sample_data']) {
  cpSync(p, `www/${p}`, { recursive: true });
}
console.log('www/ built');
