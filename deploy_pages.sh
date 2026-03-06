#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_DIR="$PROJECT_ROOT/website"
PROJECT_NAME="${1:-matthias-homepage}"
DEPLOY_BRANCH="${2:-production}"

if [[ ! -d "$SITE_DIR" ]]; then
  echo "Website-Verzeichnis nicht gefunden: $SITE_DIR"
  exit 1
fi

WRANGLER=()
if command -v wrangler >/dev/null 2>&1; then
  WRANGLER=(wrangler)
elif command -v npx >/dev/null 2>&1; then
  WRANGLER=(npx --yes wrangler@4)
else
  echo "Weder 'wrangler' noch 'npx' gefunden."
  echo "Installiere z.B. mit:"
  echo "  brew install node"
  echo "oder"
  echo "  npm install -g wrangler"
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "CLOUDFLARE_API_TOKEN fehlt."
  echo "Beispiel: export CLOUDFLARE_API_TOKEN='dein-token'"
  exit 1
fi

if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
  echo "CLOUDFLARE_ACCOUNT_ID fehlt."
  echo "Beispiel: export CLOUDFLARE_ACCOUNT_ID='deine-account-id'"
  exit 1
fi

echo "Wrangler: ${WRANGLER[*]}"
echo "Pruefe Cloudflare Pages Projekt: $PROJECT_NAME"
PROJECT_EXISTS=0
set +e
LIST_OUTPUT="$(${WRANGLER[@]} pages project list --json 2>/dev/null)"
LIST_EXIT=$?
set -e

if [[ "$LIST_EXIT" -eq 0 ]] && printf '%s' "$LIST_OUTPUT" | grep -q "\"name\"[[:space:]]*:[[:space:]]*\"${PROJECT_NAME}\""; then
  PROJECT_EXISTS=1
fi

if [[ "$PROJECT_EXISTS" -eq 1 ]]; then
  echo "Projekt '$PROJECT_NAME' bereits vorhanden."
else
  echo "Projekt '$PROJECT_NAME' nicht gefunden (oder nicht auslesbar). Versuche Erstellung ..."
  set +e
  CREATE_OUTPUT="$(${WRANGLER[@]} pages project create "$PROJECT_NAME" --production-branch production 2>&1)"
  CREATE_EXIT=$?
  set -e
  if [[ "$CREATE_EXIT" -eq 0 ]]; then
    echo "Projekt '$PROJECT_NAME' erstellt."
  elif printf '%s' "$CREATE_OUTPUT" | grep -qiE "already exists|code:[[:space:]]*8000002"; then
    echo "Projekt '$PROJECT_NAME' existiert bereits. Fahre mit Deploy fort."
  else
    printf '%s\n' "$CREATE_OUTPUT"
    exit "$CREATE_EXIT"
  fi
fi

echo "Deploye Website aus: $SITE_DIR"
# Wrangler v4 erkennt `functions/` automatisch relativ zum CWD.
(
  cd "$SITE_DIR"
  ${WRANGLER[@]} pages deploy . \
    --project-name "$PROJECT_NAME" \
    --branch "$DEPLOY_BRANCH" \
    --commit-dirty=true
)

echo
echo "Deploy abgeschlossen."
echo "Hinweis: Bei Browser-Caching ggf. hart neu laden (Shift+Reload)."
echo "Naechster Schritt im Cloudflare Dashboard:"
echo "1) Workers & Pages -> $PROJECT_NAME -> Custom domains"
echo "2) Domain verbinden: matthias.icu"
echo "3) Optional: www.matthias.icu"
