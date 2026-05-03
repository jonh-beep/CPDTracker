#!/usr/bin/env bash
# Push Apps Script source and create a versioned deployment that
# traces back to the current git commit.
#
# Usage: ./scripts/deploy.sh "short description of what changed"

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 \"short description\"" >&2
  exit 1
fi

msg="$1"
sha=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
desc="${sha}: ${msg}"

cd "$(dirname "$0")/.."

./scripts/check-secrets.sh

cd apps-script

if [ ! -f .clasp.json ]; then
  echo "apps-script/.clasp.json missing — copy .clasp.json.example and run clasp login" >&2
  exit 1
fi

clasp push
clasp deploy --description "$desc"

echo
echo "Deployed: $desc"
echo "Web app URL: see Apps Script editor → Deploy → Manage deployments"
