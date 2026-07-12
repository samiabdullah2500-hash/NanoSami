# Security Policy

## Scope
NanoSami is a fully client-side static application: no server, no accounts,
no network calls during normal use, no data collection. Imported spectra are
processed in the browser and never transmitted.

## Supported versions
Only the latest release on `main` receives fixes.

## Reporting a vulnerability
Please open a GitHub issue for non-sensitive problems. For anything sensitive
(e.g. a way to exfiltrate user data or execute injected code via a crafted
data file), use GitHub's private vulnerability reporting on this repository
("Security" tab → "Report a vulnerability") rather than a public issue.
Reports are best-effort triaged by the maintainer.

## Known non-issues
- The app intentionally has zero runtime dependencies; `jsdom` is a dev-only
  test dependency and never ships to users.
- File imports are parsed as plain text; content is HTML-escaped before display.
