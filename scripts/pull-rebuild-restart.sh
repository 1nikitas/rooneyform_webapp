#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

BRANCH="${BRANCH:-main}"

log() {
  printf "\n[%s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

have() { command -v "$1" >/dev/null 2>&1; }

sudo_if_needed() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    if have sudo; then
      sudo "$@"
    else
      "$@"
    fi
  fi
}

log "Pull latest changes (branch=${BRANCH})"
OLD_REV="$(git rev-parse --verify HEAD)"
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"
NEW_REV="$(git rev-parse --verify HEAD)"

if [[ "${OLD_REV}" == "${NEW_REV}" ]]; then
  log "No new commits. Continuing with rebuild/restart anyway."
else
  log "Updated ${OLD_REV:0:8} -> ${NEW_REV:0:8}"
fi

if [[ -f "deploy/config.env" ]]; then
  log "Load deploy/config.env"
  set -a
  # shellcheck disable=SC1091
  source "deploy/config.env"
  set +a
fi

if [[ -f "deploy/render.sh" ]]; then
  log "Render deploy configs"
  bash "deploy/render.sh"
fi

PYTHON_BIN="${PYTHON_BIN:-}"
if [[ -z "${PYTHON_BIN}" ]]; then
  for candidate in python3.12 python3.11 python3.10 python3; do
    if have "${candidate}"; then
      PYTHON_BIN="${candidate}"
      break
    fi
  done
fi

if [[ -z "${PYTHON_BIN}" ]]; then
  echo "Python not found (tried python3.12/python3.11/python3.10/python3)." >&2
  exit 1
fi

VENV_DIR="${VENV_DIR:-${ROOT_DIR}/venv}"

log "Backend deps (venv=${VENV_DIR})"
if [[ ! -d "${VENV_DIR}" ]]; then
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi
"${VENV_DIR}/bin/pip" install -r backend/requirements.txt

log "Frontend deps"
if [[ -f "frontend/package-lock.json" ]]; then
  npm --prefix frontend ci
else
  npm --prefix frontend install
fi

if [[ -f "deploy/out/frontend.env.production" ]]; then
  log "Install frontend env (.env.production)"
  cp "deploy/out/frontend.env.production" "frontend/.env.production"
fi

log "Frontend build"
npm --prefix frontend run build

APP_NAME="${APP_NAME:-rooneyform}"

if have systemctl; then
  log "Restart backend service (${APP_NAME}.service)"
  sudo_if_needed systemctl restart "${APP_NAME}.service"

  if have nginx; then
    log "Reload nginx"
    sudo_if_needed nginx -t
    sudo_if_needed systemctl reload nginx
  fi
else
  log "systemctl not found: skipping service restart (build complete)"
fi

log "Done"
