# Monetisation notes

Out of scope for now. Captured here so today's decisions don't quietly
foreclose tomorrow's options.

## What stops this becoming multi-user as it stands

- **Bound script + single sheet.** Every user would write into the same
  `CPD Tracker Data` spreadsheet. Per-user isolation requires either a
  sheet per user (creates expensive Drive sprawl) or a real database.
- **Single allowlist.** `Auth.gs#ALLOWED_USERS` is one-dimensional; no
  notion of tenancy or roles.
- **No accounts model.** "User" today means "Google account". To accept
  paying customers you need email/password or OAuth-against-something
  with subscription state attached.
- **No billing.** Stripe / Paddle / etc. integration absent.
- **Apps Script quotas.** 6-min per execution, 90-min per day per user
  for triggers. Fine for one user, hostile to many.
- **No backend isolation.** A buggy update could blow away all entries
  with no per-tenant blast-radius.

## What this plan deliberately does keep open

- Entry IDs are opaque strings (not row numbers) — survive migration.
- Dates are ISO strings over the wire — survive migration.
- The frontend talks to the backend through a single adapter
  (`google.script.run.<fn>` — replaceable with `fetch`). UI doesn't know
  it's talking to Apps Script.
- Audit log captures every mutation — gives a defensible export path.

## Rough migration target if monetising

- **Frontend:** lift `apps-script/index.html` into a real PWA build
  (Vite + plain TS is enough; SvelteKit/Next overkill for this UI).
  Replace `google.script.run.foo()` with `fetch('/api/foo')`.
- **Backend:** Supabase or Cloudflare Workers + D1. Postgres schema is
  literally the `CPD_Entries` columns plus a `user_id` foreign key.
- **Auth:** Supabase Auth (email magic link) or Auth0.
- **Billing:** Stripe Checkout + customer portal. One product,
  monthly/annual, free trial period.
- **Attachments:** S3-compatible bucket (Supabase Storage or R2),
  signed URLs for downloads.
- **Domain:** something memorable; HTTPS via the host.

Until any of that, the value-add for a paying user has to be greater than
"a Google Sheet plus a form" — i.e. the report formats, deadline tracking,
or regulatory templates need to be the product, not the storage.
