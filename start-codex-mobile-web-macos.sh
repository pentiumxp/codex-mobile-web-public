#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_ADDRESS="${CODEX_MOBILE_HOST:-0.0.0.0}"
PORT="${CODEX_MOBILE_PORT:-8787}"
CODEX_HOME_VALUE="${CODEX_HOME:-$HOME/.codex}"
CODEX_EXE_VALUE="${CODEX_MOBILE_CODEX_EXE:-}"
NODE_EXE_VALUE="${CODEX_MOBILE_NODE_EXE:-}"

usage() {
  cat <<'EOF'
Usage: ./start-codex-mobile-web-macos.sh [options]

Options:
  --host <address>       Bind address, default 0.0.0.0
  --port <port>          Bind port, default 8787
  --codex <path|name>    Codex CLI executable, default command -v codex
  --node <path|name>     Node executable, default command -v node
  --codex-home <path>    Codex state directory, default $HOME/.codex
  --no-auth              Disable access-key auth for isolated local testing
  -h, --help             Show this help
EOF
}

resolve_command() {
  local value="$1"
  local label="$2"
  if [[ -z "$value" ]]; then
    value="$label"
  fi
  if [[ "$value" != */* ]]; then
    local resolved
    resolved="$(command -v "$value" || true)"
    if [[ -n "$resolved" ]]; then
      printf '%s\n' "$resolved"
      return 0
    fi
    echo "$label command not found on PATH: $value" >&2
    return 1
  fi
  printf '%s\n' "$value"
}

resolve_codex_command() {
  local value="$1"
  if [[ -n "$value" ]]; then
    resolve_command "$value" codex
    return 0
  fi
  local candidate
  for candidate in \
    "/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/Codex.app/Contents/Resources/codex"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  resolve_command "" codex
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host)
      HOST_ADDRESS="${2:?--host requires a value}"
      shift 2
      ;;
    --port)
      PORT="${2:?--port requires a value}"
      shift 2
      ;;
    --codex)
      CODEX_EXE_VALUE="${2:?--codex requires a value}"
      shift 2
      ;;
    --node)
      NODE_EXE_VALUE="${2:?--node requires a value}"
      shift 2
      ;;
    --codex-home)
      CODEX_HOME_VALUE="${2:?--codex-home requires a value}"
      shift 2
      ;;
    --no-auth)
      export CODEX_MOBILE_DISABLE_AUTH=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

NODE_EXE_VALUE="$(resolve_command "$NODE_EXE_VALUE" node)"
CODEX_EXE_VALUE="$(resolve_codex_command "$CODEX_EXE_VALUE")"

if [[ "$NODE_EXE_VALUE" == */* && ! -x "$NODE_EXE_VALUE" ]]; then
  echo "Node executable not found or not executable: $NODE_EXE_VALUE" >&2
  exit 1
fi

if [[ "$CODEX_EXE_VALUE" == */* && ! -x "$CODEX_EXE_VALUE" ]]; then
  echo "Codex executable not found or not executable: $CODEX_EXE_VALUE" >&2
  exit 1
fi

export CODEX_HOME="$CODEX_HOME_VALUE"
export CODEX_MOBILE_HOST="$HOST_ADDRESS"
export CODEX_MOBILE_PORT="$PORT"
export CODEX_MOBILE_CODEX_EXE="$CODEX_EXE_VALUE"

echo "Starting Codex Mobile Web on http://$CODEX_MOBILE_HOST:$CODEX_MOBILE_PORT"
echo "CODEX_HOME=$CODEX_HOME"
echo "Codex exe: $CODEX_MOBILE_CODEX_EXE"
echo "Node exe: $NODE_EXE_VALUE"

exec "$NODE_EXE_VALUE" "$SCRIPT_DIR/server.js"
