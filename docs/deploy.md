# Deploy

Two surfaces, two pipelines.

## Apps Script backend (clasp)

First time on a new machine:

```sh
npm i -g @google/clasp
clasp login                       # opens browser; sign in as darcybeans

cd apps-script
cp .clasp.json.example .clasp.json
clasp pull                        # sanity check — local should match deployed
```

Day-to-day:

```sh
./scripts/deploy.sh "what changed in this push"
```

That runs `scripts/check-secrets.sh`, `clasp push`, then
`clasp deploy --description "<git short sha>: <message>"`. Each deployment
shows up in the Apps Script editor with the commit it came from.

The deployed web app URL is **stable per deployment ID** — you create new
deployment IDs only when you want a fresh URL (e.g. to retire a leaked one).
Updating the existing deployment keeps the same URL, so the PWA shell
doesn't need re-configuring.

To update the existing deployment instead of creating a new one:

```sh
cd apps-script
clasp deployments                 # list, copy the deploymentId
clasp deploy --deploymentId <id> --description "<sha>: <message>"
```

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
