#!/usr/bin/env bash
# Deploy CPDTracker — bumps APP_VERSION in index.html, pushes to Apps Script,
# and updates the existing deployment (keeps the same web app URL).
#
# Usage:
#   ./scripts/deploy.sh <version_number> "short description of what changed"
#
# Example:
#   ./scripts/deploy.sh 17 "add export to CSV"
#
# Prerequisites:
#   - apps-script/.clasp.json present (gitignored — copy from .clasp.json.example)
#   - apps-script/.deployment-id.local present (gitignored — copy from .deployment-id.example)
#   - clasp installed globally: npm i -g @google/clasp
#   - logged in: clasp login

set -euo pipefail

# ---- argument validation ----
if [ $# -lt 2 ]; then
  echo "usage: $0 <version_number> \"short description\"" >&2
  echo "  e.g. $0 17 \"add CSV export\"" >&2
  exit 1
fi

version_num="$1"
msg="$2"

# ---- paths ----
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
index_html="${repo_root}/apps-script/index.html"
deployment_id_file="${repo_root}/apps-script/.deployment-id.local"

# ---- check deployment ID file ----
if [ ! -f "$deployment_id_file" ]; then
  echo "ERROR: apps-script/.deployment-id.local not found." >&2
  echo "       Copy apps-script/.deployment-id.example and paste your deployment ID." >&2
  exit 1
fi

deployment_id="$(cat "$deployment_id_file" | tr -d '[:space:]')"

if [ -z "$deployment_id" ] || [ "$deployment_id" = "YOUR_DEPLOYMENT_ID_HERE" ]; then
  echo "ERROR: apps-script/.deployment-id.local contains a placeholder, not a real ID." >&2
  exit 1
fi

# ---- bump APP_VERSION in index.html ----
deploy_date="$(date '+%d %b %Y')"
version_str="v${version_num} · ${deploy_date}"

# macOS-compatible in-place sed
sed -i '' "s/const APP_VERSION = '[^']*';/const APP_VERSION = '${version_str}';/" "$index_html"

echo "✓ APP_VERSION set to '${version_str}'"

# ---- secrets check ----
"${repo_root}/scripts/check-secrets.sh"

# ---- clasp push + deploy ----
cd "${repo_root}/apps-script"

if [ ! -f .clasp.json ]; then
  echo "ERROR: apps-script/.clasp.json missing." >&2
  echo "       Copy .clasp.json.example, fill in scriptId, and run clasp login." >&2
  exit 1
fi

clasp push --force
sha=$(git -C "${repo_root}" rev-parse --short HEAD 2>/dev/null || echo "no-git")
clasp deploy --deploymentId "$deployment_id" --description "${sha}: ${msg}"

echo
echo "✓ Deployed as ${version_str}"
echo "  Description: ${sha}: ${msg}"
echo
echo "Next steps:"
echo "  git add apps-script/index.html"
echo "  git commit -m \"${version_str}: ${msg}\""
echo "  git push origin main"
