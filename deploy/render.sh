#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${1:-$SCRIPT_DIR/config.env}"

if [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Config not found: $CONFIG_PATH" >&2
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "envsubst not found. Install gettext-base (Ubuntu/Debian) or gettext (macOS)." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$CONFIG_PATH"
set +a

OUT_DIR="$SCRIPT_DIR/out"
mkdir -p "$OUT_DIR"

VARS='${APP_NAME} ${APP_USER} ${APP_DIR} ${DOMAIN} ${DOMAIN_WWW} ${API_DOMAIN} ${BACKEND_HOST} ${BACKEND_PORT} ${BACKEND_APP} ${GUNICORN_WORKERS} ${VENV_DIR} ${BACKEND_DIR} ${FRONTEND_DIST} ${BACKEND_STATIC} ${CERTBOT_ROOT} ${CERTBOT_LIVE_DIR} ${SYSTEMD_ENV_FILE} ${VITE_API_URL} ${TELEGRAM_BOT_TOKEN} ${TELEGRAM_ADMIN_CHAT_ID} ${TELEGRAM_ADMIN_CHAT_IDS}'

render() {
  local template="$1"
  local output="$2"
  envsubst "$VARS" < "$template" > "$output"
}

render "$SCRIPT_DIR/nginx.conf.template" "$OUT_DIR/nginx.conf"
render "$SCRIPT_DIR/rooneyform.service.template" "$OUT_DIR/${APP_NAME}.service"
render "$SCRIPT_DIR/rooneyform.env.template" "$OUT_DIR/${APP_NAME}.env"
render "$SCRIPT_DIR/frontend.env.production.template" "$OUT_DIR/frontend.env.production"

echo "Rendered files to $OUT_DIR"
