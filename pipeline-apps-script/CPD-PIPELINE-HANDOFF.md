# CPD Agenda Pipeline — Claude Code deployment handoff

This is a self-contained runbook for **Claude Code**, run inside the
`CPDTracker` repository. It deploys the standalone Apps Script web app
that the CPD Agenda Processing Pipeline depends on.

The companion **Cowork** session produced the source files in this
folder and will finish the setup (scheduled task, first run) once you
report back the two values at the end of this document.

---

## What this is

A new, **standalone** Apps Script web app (project name: *CPD Agenda
Pipeline*). It is deliberately **separate** from the existing bound
CPDTracker project in `../apps-script/` — do **not** modify anything in
`../apps-script/`. The existing app stays locked to `access: MYSELF`.

The new web app exposes a `doPost` endpoint that the Cowork scheduled
task calls with extracted CPD-agenda data. It writes rows into the
`CPD_Entries` tab of the **existing** "CPD Tracker Data" spreadsheet
(`1AorzzNZUecforf_X1LHApbRx2LmKDDOHFC3qTjJz1hE`), and handles all Drive
file moves and the failure-alert email itself.

Source files in this folder (`pipeline-apps-script/`):

| File | Purpose |
|------|---------|
| `appsscript.json` | manifest — web app `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS` |
| `Config.gs` | constants, column map, taxonomy, helpers |
| `Code.gs` | `doGet` health check + `doPost` router |
| `Ingest.gs` | validation, dedup, row write/merge |
| `Files.gs` | Drive moves, sidecars, `manifest.json`, `run-log.md`, `_audit` |
| `Notify.gs` | consolidated failure email |
| `Setup.gs` | one-time `setup()` provisioning |
| `.clasp.json.example` | template — real `.clasp.json` is created by `clasp create` |

---

## Prerequisites

1. `clasp` installed (`npm i -g @google/clasp`) and logged in as
   **darcybeans@googlemail.com** — the account that owns the
   "CPD Tracker Data" spreadsheet. Verify with `clasp login --status`.
2. The Apps Script user setting *"Google Apps Script API"* is ON
   (https://script.google.com/home/usersettings) — needed for `clasp push`.
3. Work entirely inside `pipeline-apps-script/`. Do not touch
   `../apps-script/`.

---

## Steps

### 1. Create the standalone project

```sh
cd pipeline-apps-script
clasp create --type standalone --title "CPD Agenda Pipeline"
```

This writes a real `.clasp.json` (with the new `scriptId`) into this
folder. If `clasp create` overwrites `appsscript.json` with a default,
restore the repo version before pushing:

```sh
git checkout -- appsscript.json
```

`appsscript.json` MUST contain the `webapp` block (`executeAs:
USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`) and the three `oauthScopes`.

Add the new clasp config to `.gitignore` (it is environment-specific):

```sh
grep -qx 'pipeline-apps-script/.clasp.json' ../.gitignore || \
  echo 'pipeline-apps-script/.clasp.json' >> ../.gitignore
```

### 2. Push the code

```sh
clasp push -f
```

All six `.gs` files plus `appsscript.json` upload to the new project.

### 3. Authorise and run `setup()`  *(needs one human click)*

The first run must be authorised by a human — OAuth consent for the
Drive / Sheets / Mail scopes cannot be automated.

```sh
clasp open-script
```

In the Apps Script editor: choose the **`setup`** function in the
toolbar, click **Run**, and approve the consent screen (it will list
Drive, Sheets and Gmail-send access — expected).

`setup()` is idempotent. It will:

- generate the shared secret and store it in Script Properties;
- create `/CPD-Inbox/` and `inbox`, `processed`, `failed`, `logs` in
  the owner's My Drive;
- seed `logs/manifest.json` and `logs/run-log.md`;
- append columns **O–R** (`Last_Updated`, `Source_Hash`,
  `Logical_Key`, `Revisions`) to `CPD_Entries`;
- create the `_audit` tab.

Open **Execution log** (View → Logs). It prints, in plain text:

```
SHARED_SECRET=........................................
SPREADSHEET_ID=1AorzzNZUecforf_X1LHApbRx2LmKDDOHFC3qTjJz1hE
FOLDER_ROOT_ID=...
FOLDER_INBOX_ID=...
FOLDER_PROCESSED_ID=...
FOLDER_FAILED_ID=...
FOLDER_LOGS_ID=...
```

Copy this block. If you ever need it again, run `showConfig()`.

### 4. Deploy as a web app

In the editor: **Deploy → New deployment → Web app**, with
**Execute as: Me (darcybeans@googlemail.com)** and **Who has access:
Anyone**. Click **Deploy** and copy the **Web app URL** (ends `/exec`).

(Equivalent CLI: `clasp deploy --description "cpd agenda pipeline v1"`.
The web app URL is `https://script.google.com/macros/s/<deploymentId>/exec`.
The editor is recommended because it shows the URL directly.)

### 5. Smoke-test the live endpoint

An Apps Script POST returns a 302 to `script.googleusercontent.com`,
which plain `curl` mishandles (it re-issues the redirect as GET and
gets HTTP 405). Use Node's `fetch`, which follows the redirect
correctly. Python `requests` and Apps Script's `UrlFetchApp` also work.

Health check (no secret needed):

```sh
node -e "fetch('<WEB_APP_URL>').then(r=>r.text()).then(console.log)"
# expect: {"status":"ok","service":"cpd-agenda-pipeline","time":"..."}
```

Authenticated ping (replace both placeholders):

```sh
node -e "fetch('<WEB_APP_URL>',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:'<SHARED_SECRET>',action:'ping'})}).then(r=>r.text()).then(console.log)"
# expect: {"status":"ok","action":"ping","time":"..."}
```

A wrong token must return `{"status":"error","reason":"unauthorised"}`.

> Note: Apps Script web apps always return HTTP **200** for the final
> response; the real outcome is in the JSON `status` field.

---

## Report back to the Cowork session

When deployment succeeds, give the Cowork session these **two values**:

1. **Web app URL** — the `/exec` URL from step 4.
2. **SHARED_SECRET** — from the step 3 execution log.

Treat both as secrets. The Cowork session will write them into the
gitignored `.claude-md` context file and finish the build (scheduled
task + first run). Nothing else is required from Claude Code.

---

## If something fails

- **`clasp push` 403 / API disabled** — turn on the Apps Script API at
  https://script.google.com/home/usersettings, wait a minute, retry.
- **`setup()` throws `missing_sheet: CPD_Entries`** — clasp is logged in
  as the wrong Google account; it must be darcybeans@googlemail.com.
- **The health check returns an HTML login page** — the deployment's
  access is not *Anyone*; redeploy with *Who has access: Anyone*.
- **Re-running is safe** — `setup()` never duplicates folders, columns
  or tabs, and never overwrites existing log files.
