#!/usr/bin/env bash
# Pre-commit / pre-push guard against leaking the deployed Apps Script
# web app URL into the public repo. Run before any push.

set -euo pipefail

cd "$(dirname "$0")/.."

# Patterns that should never appear in tracked files.
# Match real Apps Script deployment IDs (long base64url strings), not doc
# placeholders like /macros/s/<deploymentId>/exec.
patterns='AKfycb[A-Za-z0-9_-]{20,}|/macros/s/[A-Za-z0-9_-]{20,}/exec'

if git ls-files | xargs grep -lE "$patterns" 2>/dev/null; then
  echo
  echo "ERROR: real-looking deployment URLs found in tracked files (above)." >&2
  echo "Move them to pwa/config.local.js (gitignored) before committing." >&2
  exit 1
fi

echo "OK — no leaked deployment URLs in tracked files."
