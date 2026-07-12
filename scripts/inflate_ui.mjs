import { readFileSync, writeFileSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';

for (const name of ['studio.js', 'app.js']) {
  const src = `js/${name}.gz.b64`;
  if (!existsSync(src)) { console.warn('skip missing', src); continue; }
  const b64 = readFileSync(src, 'utf8').trim();
  if (b64 === 'placeholder' || b64.includes('PLACEHOLDER')) {
    console.error(name, 'still a placeholder — re-run packaging push');
    process.exitCode = 1;
    continue;
  }
  const buf = gunzipSync(Buffer.from(b64, 'base64'));
  writeFileSync(`js/${name}`, buf);
  console.log('inflated', name, buf.length, 'bytes');
}
