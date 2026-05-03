# CPD Tracker — Project Context

This file gives Claude Code everything it needs to work on the CPD Tracker project.

---

## What This Project Is

A Google Apps Script web app that tracks Continuing Professional Development
(CPD) activities. Data is stored in a Google Sheet (bound to the script);
file attachments are stored in Google Drive. A PWA wrapper on GitHub Pages
enables home screen installation on iPhone.

---

## Repository Structure

```
CPDTracker/
├── README.md
├── CLAUDE.md                       ← this file
├── LICENSE                         ← all rights reserved
├── .gitignore
├── .editorconfig
│
├── apps-script/                    backend, clasp root
│   ├── .clasp.json                 (gitignored — contains scriptId)
│   ├── .clasp.json.example
│   ├── appsscript.json             webapp manifest
│   ├── Code.gs                     doGet entry point
│   ├── Auth.gs                     allowlist + getUserInfo
│   ├── Schema.gs                   sheet names, headers, categories, types
│   ├── Entries.gs                  CRUD with audit hooks
│   ├── Attachments.gs              Drive uploads (private)
│   ├── Reports.gs                  getReportData
│   ├── Audit.gs                    append-only audit log
│   └── index.html                  full UI served by doGet
│
├── pwa/                            GitHub Pages
│   ├── index.html                  shell with "Open Tracker" button
│   ├── manifest.json
│   ├── sw.js
│   ├── icon-180.png / 192 / 512
│   ├── config.example.js
│   └── config.local.js             (gitignored — holds the web app URL)
│
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── deploy.md
│   └── monetisation-notes.md
│
└── scripts/
    ├── deploy.sh
    └── check-secrets.sh
```

---

## Deployment

**Apps Script backend** — use clasp from `apps-script/`:

```sh
./scripts/deploy.sh "short description"
```

That runs `clasp push` then `clasp deploy --description "<git short sha>: <message>"`
so each deployment ties back to a commit.

**Web app URL** — held in `pwa/config.local.js` (gitignored). Get it from
the Apps Script editor: Deploy → Manage deployments → Web app URL.

**PWA on GitHub Pages** — repo `jonh-beep/CPDTracker`, Pages serves from
`main` / `/pwa`. Public URL: `https://jonh-beep.github.io/CPDTracker/`.

---

## Google Sheet Structure

**Spreadsheet:** "CPD Tracker Data" (bound to the Apps Script project)
**Sheets:** `CPD_Entries`, `Settings`, `CPD_Audit`

`CPD_Entries` columns (16):

| Col | Field | Notes |
|-----|-------|-------|
| A | ID | `CPD_<timestamp>` |
| B | Date | Date |
| C | Title | Activity name |
| D | Description | Free text |
| E | Category | See list below |
| F | Type | See list below |
| G | Hours | Decimal |
| H | Provider | e.g. PMI, Aon, PASA, Self |
| I | Role | `EPMI` \| `MasterTrust` \| `Both` |
| J | EPMI_Relevant | `Yes` \| `No` |
| K | MasterTrust_Relevant | `Yes` \| `No` |
| L | Links | JSON-stringified array |
| M | Attachments | JSON-stringified array of `{fileId, fileName, viewUrl}` |
| N | Notes | Free text |
| O | Created | Date |
| P | Modified | Date |

`CPD_Audit` columns: `Timestamp | Actor | Action | EntryID | Field | OldValue | NewValue`.
Every create/update/delete writes here. Updates write one row per changed field.

`Settings` rows: `EPMI_Annual_Target_Hours=35`, `MasterTrust_Annual_Target_Hours=15`,
`CPD_Year_Start_Month=11`.

**Categories** (Schema.gs `CATEGORIES`):
Pensions Law & Legislation; Investment & Financial; Governance & Risk;
Administration & Operations; Technology & Cyber; ESG & Responsible Investment;
Member Outcomes & Communications; DC & Master Trust Specific;
Pensions Dashboard; Professional Development; Industry Events & Networking; Other.

**Types** (Schema.gs `TYPES`):
Structured – Course / Webinar; Structured – Conference; Structured – Formal Training;
Unstructured – Reading / Research; Unstructured – Peer Discussion; Unstructured – Industry Group;
On-the-Job Learning; Speaking / Presenting; Other.

---

## Google Drive Structure

- **Attachments folder:** "CPD Tracker Attachments" (My Drive). New uploads
  are PRIVATE / NONE — viewable only by the owner via Drive's normal auth.
- The script project itself lives in the "CPD Tracker" Drive folder.

---

## Two CPD roles

### EPMI
Annual log with structured/unstructured hours; needs category spread and total hours.

### Master Trust Trustee — Aon Master Trust
- **Name:** Jon Hawkins, Trustee Director from 1 July 2025
- **CPD period:** 1 November to 31 October each year
- **Requirements:** attendance at industry events, DC/Master Trust knowledge, TKU evidence
- Annual performance assessment submitted to Trustee Executive with CPD register

---

## Backend functions

| File | Function | Purpose |
|------|----------|---------|
| Code.gs | `doGet(e)` | Serves index.html (asserts allowlist) |
| Auth.gs | `assertAllowedUser_()` | Throws if caller not in `ALLOWED_USERS` |
| Auth.gs | `getUserInfo()` | Returns signed-in user email |
| Schema.gs | `getCategories()` / `getTypes()` | Reference lists for the UI |
| Entries.gs | `getOrCreateSpreadsheet()` | Lazy-create CPD_Entries / Settings / CPD_Audit |
| Entries.gs | `getAllEntries()` | All entries as objects |
| Entries.gs | `getSettings()` | Settings sheet as `{key: value}` |
| Entries.gs | `addEntry(data)` | Append + log create |
| Entries.gs | `updateEntry(id, data)` | Replace row + log per-field update |
| Entries.gs | `deleteEntry(id)` | Log delete then remove row |
| Attachments.gs | `uploadFile({base64, mimeType, name})` | Upload as PRIVATE |
| Attachments.gs | `deleteFile(fileId)` | Trash file |
| Attachments.gs | `lockdownExistingAttachments_()` | One-shot: flip pre-existing files to PRIVATE |
| Reports.gs | `getReportData(role, yearStartDate)` | Filtered + summary by category/type/month |
| Audit.gs | `logCreate_ / logUpdate_ / logDelete_` | Internal audit writers |

Every callable starts with `assertAllowedUser_()`.

---

## Security model

Three layers (see [docs/security.md](docs/security.md) for full detail):

1. **`appsscript.json`** — `executeAs: USER_ACCESSING`, `access: MYSELF`.
2. **`ALLOWED_USERS` allowlist in Auth.gs** — every callable enforces it.
3. **Attachments** — uploaded as `DriveApp.Access.PRIVATE`. The deployed
   web app URL is treated as a secret and lives in `pwa/config.local.js`
   (gitignored), never in the repo.

---

## Code style

- Apps Script runs **V8** (`runtimeVersion: V8` in `appsscript.json`), so
  `const`, `let`, arrow functions, and template literals are fine.
- All `.gs` files in `apps-script/` are concatenated at runtime; declaration
  order across files does not matter.
- `pwa/index.html` is a single self-contained shell, no build step.
- `apps-script/index.html` is the full UI; keep CSS/JS inline.
- Preserve existing function signatures so the frontend's `google.script.run`
  calls keep working.
- British English in comments, labels, and UI copy.

---

## Owner

**Jonny** (`darcybeans@googlemail.com` for Google services;
`jonh-beep` on GitHub).
