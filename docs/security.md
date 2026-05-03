# Security

The threat model is "single user, internet-exposed entry point, public source repo".
Three layers protect the data.

## Layer 1 — Apps Script web app deployment

`apps-script/appsscript.json`:

```json
"webapp": {
  "executeAs": "USER_ACCESSING",
  "access": "MYSELF"
}
```

- `access: MYSELF` — only the deploying Google account (`darcybeans@googlemail.com`)
  can invoke the web app URL. Anonymous and other-account requests get Google's
  own access-denied page before any code runs.
- `executeAs: USER_ACCESSING` — the script runs in the caller's identity, so
  `Session.getActiveUser().getEmail()` reliably returns who actually called.

If you ever change `access` to anything wider, the next layer still holds.

## Layer 2 — Allowlist in code

`apps-script/Auth.gs` defines `ALLOWED_USERS` and `assertAllowedUser_()`.
Every callable function (`doGet`, `getAllEntries`, `addEntry`, `updateEntry`,
`deleteEntry`, `getSettings`, `getReportData`, `uploadFile`, `deleteFile`,
`getCategories`, `getTypes`, `getUserInfo`) starts with `assertAllowedUser_()`.

Adding a user later: append their email to `ALLOWED_USERS`, push, deploy.
Don't widen `access` in `appsscript.json` without thinking through whether
multi-user really means single-tenant or multi-tenant — see
[monetisation-notes.md](monetisation-notes.md).

## Layer 3 — Private attachments

`apps-script/Attachments.gs#uploadFile` sets each new file to
`DriveApp.Access.PRIVATE` and `Permission.NONE`. The owner's normal Drive
auth controls who can open the viewer URL.

Pre-existing attachments uploaded under the old code may have
`ANYONE_WITH_LINK` permission. Run `lockdownExistingAttachments_()` once
from the Apps Script editor after the first deploy of this code to
revoke those grants.

## Secrets out of the public repo

`jonh-beep/CPDTracker` is public. Anything committed is permanently
visible (git history retains it even after deletion). Do not commit:

- The deployed web app URL (`https://script.google.com/macros/s/...`).
  Lives in `pwa/config.local.js` (gitignored). The shell loads it client-side.
- The Apps Script `scriptId` (in `apps-script/.clasp.json`, gitignored).
  Not directly executable by others, but treat as private hygiene.
- Any personal CPD data or attachments. The repo holds *code*, not entries —
  entries live only in the bound Google Sheet.

`scripts/check-secrets.sh` greps tracked files for the AKfycb / `/macros/s/`
patterns and exits non-zero if anything is found. `scripts/deploy.sh`
runs it before pushing.

### Old leaked URL

The old `darcybeans/CPDTracker` repo (still public, unmaintained) contains
the previous deployment URL. After cutting the new deployment from the
refactored code, archive the old deployment in the Apps Script editor:
Deploy → Manage deployments → old deployment → archive. The leaked URL
then 404s and is no longer a concern.

## Audit trail

`apps-script/Audit.gs` writes to a `CPD_Audit` sheet on every mutation.
Updates emit one row per changed field. Deletes preserve the full row
contents in `OldValue` so nothing silently disappears from the register.
