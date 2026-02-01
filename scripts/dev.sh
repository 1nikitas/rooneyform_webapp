#!/usr/bin/env bash

set -euo pipefail

MODE="${1:-local}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
HOST="0.0.0.0"

pids=()
ngrok_logs=()

cleanup() {
    for pid in "${pids[@]}"; do
        if [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null; then
            kill "${pid}" 2>/dev/null || true
        fi
    done
}

trap cleanup EXIT INT TERM

start_backend() {
    local uvicorn_bin="${BACKEND_DIR}/venv/bin/uvicorn"
    if [[ ! -x "${uvicorn_bin}" ]]; then
        echo "uvicorn not found at ${uvicorn_bin}. Activate venv and install deps." >&2
        exit 1
    fi
    (
        cd "${BACKEND_DIR}"
        "${uvicorn_bin}" main:app --reload --host "${HOST}" --port "${BACKEND_PORT}"
    ) &
    local pid=$!
    pids+=("${pid}")
    echo "${pid}"
}

start_frontend() {
    local api_url="$1"
    (
        cd "${FRONTEND_DIR}"
        VITE_API_URL="${api_url}" npm run dev -- --host "${HOST}" --port "${FRONTEND_PORT}"
    ) &
    local pid=$!
    pids+=("${pid}")
    echo "${pid}"
}

start_ngrok() {
    local port="$1"
    local name="$2"
    if ! command -v ngrok >/dev/null 2>&1; then
        echo "ngrok is required for ngrok mode. Install it first." >&2
        exit 1
    fi

    local log_file
    log_file="$(mktemp -t "ngrok-${name}.log")"
    ngrok_logs+=("${log_file}")

    ngrok http "${port}" --log=stdout --log-format=json > "${log_file}" &
    local pid=$!
    pids+=("${pid}")

    local url=""
    for _ in {1..40}; do
        if [[ -f "${log_file}" ]]; then
            url="$(grep -m1 -oE '\"url\":\"https://[^"]+' "${log_file}" | head -n1 | cut -d'"' -f4)"
            if [[ -n "${url}" ]]; then
                break
            fi
        fi
        sleep 0.25
    done

    if [[ -z "${url}" ]]; then
        echo "Failed to detect ngrok URL for ${name}. Check ${log_file}." >&2
        exit 1
    fi

    echo "${url}"
}

echo "RooneyForm dev helper | mode=${MODE}"

backend_pid=""
frontend_pid=""
backend_public=""
frontend_public=""

case "${MODE}" in
    local)
        backend_pid="$(start_backend)"
        frontend_pid="$(start_frontend "http://localhost:${BACKEND_PORT}")"
        echo "Backend running at http://localhost:${BACKEND_PORT} (pid ${backend_pid})"
        echo "Frontend running at http://localhost:${FRONTEND_PORT} (pid ${frontend_pid})"
        ;;
    ngrok)
        backend_pid="$(start_backend)"
        backend_public="$(start_ngrok "${BACKEND_PORT}" "backend")"
        frontend_pid="$(start_frontend "${backend_public}")"
        frontend_public="$(start_ngrok "${FRONTEND_PORT}" "frontend")"

        echo "Backend local http://localhost:${BACKEND_PORT} (pid ${backend_pid})"
        echo "Backend ngrok ${backend_public}"
        echo "Frontend local http://localhost:${FRONTEND_PORT} (pid ${frontend_pid})"
        echo "Frontend ngrok ${frontend_public}"
        ;;
    *)
        echo "Usage: $0 [local|ngrok]" >&2
        exit 1
        ;;
esac

if [[ "${MODE}" == "ngrok" ]]; then
    printf "\nngrok logs stored in:\n"
    for log in "${ngrok_logs[@]}"; do
        echo " - ${log}"
    done
fi

echo "Press Ctrl+C to stop (children will be terminated)."
wait
