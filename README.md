# CPD Tracker

Personal Continuing Professional Development tracker for two trustee roles
(EPMI; Aon Master Trust). Google Apps Script backend on a bound Google Sheet,
plus a small PWA shell hosted on GitHub Pages so it installs on the iPhone
home screen.

For project context, schema, and conventions see [CLAUDE.md](CLAUDE.md).
For the threat model and security checklist see [docs/security.md](docs/security.md).

## Quickstart

One-time setup on a new machine:

```sh
npm i -g @google/clasp
clasp login

cd apps-script
cp .clasp.json.example .clasp.json
clasp pull        # confirm local matches deployed
```

Then for the PWA shell:

```sh
cp pwa/config.example.js pwa/config.local.js
# edit pwa/config.local.js — paste the deployed web app URL
```

## Day-to-day

Edit Apps Script code under `apps-script/`, push and deploy:

```sh
./scripts/deploy.sh "what changed"
```

Edit the PWA shell under `pwa/`, commit and push to `main` —
GitHub Pages serves it from `/pwa`.

Before any commit, run the secrets guard:

```sh
./scripts/check-secrets.sh
```

## Layout

```
apps-script/   backend (clasp root) — see split below
pwa/           PWA shell served by GitHub Pages
docs/          architecture, security, deploy notes
scripts/       deploy + secrets-check helpers
```

Apps Script files (concatenated at runtime by Google):
- `Code.gs` — `doGet` entry point
- `Auth.gs` — single-user allowlist
- `Schema.gs` — sheet names, headers, categories, types
- `Entries.gs` — CRUD with audit hooks
- `Attachments.gs` — Drive uploads (private)
- `Reports.gs` — filtered views
- `Audit.gs` — append-only log of every mutation
- `index.html` — full UI served by `doGet`
