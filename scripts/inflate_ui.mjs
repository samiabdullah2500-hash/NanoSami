import { readFileSync, writeFileSync, existsSync } from 'fs';
import { gunzipSync } from 'zlib';

for (const name of ['studio.js', 'app.js']) {
  const src = `js/${name}.gz.b64`;
  if (!existsSync(src)) {
    console.warn('skip missing', src);
    continue;
  }
  const b64 = readFileSync(src, 'utf8').trim();
  const buf = gunzipSync(Buffer.from(b64, 'base64'));
  writeFileSync(`js/${name}`, buf);
  console.log('inflated', name, buf.length, 'bytes');
}
