# Architecture

## Components

```
iPhone Safari ──install→ pwa/ on GitHub Pages
                              │
                              │ "Open Tracker" link
                              ▼
                     Apps Script web app (doGet)
                              │
                              │ google.script.run
                              ▼
                  Apps Script backend (Code.gs etc.)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       CPD_Entries     CPD Tracker        CPD_Audit
       sheet           Attachments        sheet
                       Drive folder
```

The PWA shell is *just* a launcher. The full UI lives inside the Apps
Script project as `index.html`, served by `doGet`. This is so the
authentication boundary stays at Google's edge — the PWA itself has
no API access.

## Data model

See [CLAUDE.md](../CLAUDE.md) for the column-by-column sheet layout.
Key invariants:

- Entry IDs are `CPD_<unix-millis>` strings — opaque to callers, survive a
  database migration intact.
- Dates are stored as Sheets dates internally and serialised to ISO
  `yyyy-MM-dd` over the wire by `getAllEntries`.
- Free-text fields (`Notes`, `Description`) are unbounded — keep an eye
  on row size if you ever paste in essays.
- `Links` and `Attachments` are JSON-stringified arrays. Reads parse them
  back; writes always re-stringify. If you change shape, write a one-shot
  migration in `Entries.gs` rather than dual-read logic.

## Migration seams

The plan keeps the door open to swapping Sheets for a hosted backend
(Supabase / Postgres) without rewriting the UI. To preserve that:

- **All data access goes through `apps-script/Entries.gs`.** The frontend
  never touches `SpreadsheetApp` directly.
- **The frontend talks to the backend via `google.script.run` calls only.**
  Adapter swap = replace `google.script.run.foo()` with `fetch('/api/foo')`.
- **Use UUID-style IDs and ISO dates** everywhere user-facing.

If/when migration happens:

1. Stand up the new backend with the same function signatures (`getAllEntries`,
   `addEntry`, etc.) behind an HTTPS API.
2. Write a one-shot exporter: `getAllEntries()` → POST to new API.
3. In the frontend, swap the adapter layer (one file).
4. Repoint the PWA at the new URL.

The audit sheet is the source of truth for "did the migration drop anything"
— every entry that ever existed should be reconstructible from it.
