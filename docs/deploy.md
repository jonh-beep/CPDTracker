# Deploy

Two surfaces, two pipelines.

## Apps Script backend (clasp)

### First time on a new machine

```sh
npm i -g @google/clasp
clasp login                       # opens browser; sign in as darcybeans

cd apps-script
cp .clasp.json.example .clasp.json              # fill in scriptId
cp .deployment-id.example .deployment-id.local  # paste the deploymentId
```

The `deploymentId` is the long `AKfycb…` string from the existing web app
URL (everything between `/s/` and `/exec`). Never commit it — it is the
effective address of the app and is gitignored via `*.local`.

### Day-to-day deploy

```sh
./scripts/deploy.sh <version_number> "what changed"
```

**Example:**
```sh
./scripts/deploy.sh 17 "add CSV export"
```

The script automatically:
1. Sets `APP_VERSION = 'v17 · 24 May 2026'` in `apps-script/index.html`
2. Runs `scripts/check-secrets.sh` (aborts if secrets found)
3. `clasp push --force`
4. `clasp deploy --deploymentId <id> --description "<sha>: <message>"`
5. Prints the `git commit` and `git push` commands to run next

The deployed web app URL stays **constant** — the same `deploymentId` is
updated in place, so the PWA shell doesn't need re-configuring and the
iPhone home-screen shortcut keeps working.

The version badge (`v17 · 24 May 2026`) appears at the bottom of the
dashboard so you can confirm the new version is live as soon as you open
the app.

### Choosing a version number

Simple increment — check the last deployed version by looking at the
`APP_VERSION` constant at the top of `apps-script/index.html`, or just
open the app and check the dashboard footer.

## PWA shell (GitHub Pages)

One-time:

1. `gh repo create jonh-beep/CPDTracker --public --source=. --remote=origin`
2. Push `main`.
3. Repo Settings → Pages → Build from a branch → branch `main`, folder `/pwa`.
4. Wait for the green tick. Live URL: `https://jonh-beep.github.io/CPDTracker/`.
5. Locally: `cp pwa/config.example.js pwa/config.local.js`, paste the web app
   URL, **don't commit it** — `.gitignore` already excludes it.

The shell is *only* served by Pages — `config.local.js` lives in the deployed
copy at GitHub but is supplied separately. To set the URL the shell uses in
production, you have two options:

- **Personal-only**: load `config.local.js` from a separate hosting that only
  you can serve (e.g. a private gist via a userscript). Heavyweight.
- **Public-but-locked**: commit a `pwa/config.local.js` with the web app URL
  *only after* you have confirmed Layer 1 + Layer 2 (see security.md) hold —
  the URL leaking just means anyone can attempt to call it; the access lock
  rejects them. This is the pragmatic path.

If you go with the second option, remove `pwa/config.local.js` from
`.gitignore` and commit it. `scripts/check-secrets.sh` will then need its
exclude list updated.

## Retiring an old deployment

When the previous web app URL has been leaked (e.g. via the old
`darcybeans/CPDTracker` repo):

1. `clasp deployments` — find the old deploymentId.
2. `clasp undeploy <id>` — the URL now 404s.
3. Verify by hitting the old URL in a browser.

Always cut the new deployment *before* undeploying the old one, so you don't
strand the iPhone home-screen shortcut.
