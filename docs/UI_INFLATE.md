# Inflating UI sources (v0.4.0)

After clone:

```bash
node scripts/inflate_ui.mjs   # writes js/studio.js and js/app.js from *.gz.b64
npm run vendor:xlsx           # optional XLSX support
npm test
npm start
```

Core science modules are plain source (not compressed). Only the large UI shells use gzip+base64 transport for reliable GitHub API commits.
