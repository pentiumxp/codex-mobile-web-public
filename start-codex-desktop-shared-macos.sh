#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_APP_PATH="${CODEX_DESKTOP_APP_PATH:-/Applications/Codex.app}"
CODEX_DESKTOP_EXE="${CODEX_DESKTOP_EXE:-}"
CODEX_HOME_VALUE="${CODEX_HOME:-$HOME/.codex}"
REAL_CODEX_EXE="${CODEX_MUX_CODEX_EXE:-}"
NODE_EXE_VALUE="${CODEX_MUX_NODE_EXE:-}"
MUX_WRAPPER="${CODEX_CLI_PATH:-$SCRIPT_DIR/codex-app-server-mux-macos.sh}"
PRINT_ONLY=0
FORCE_QUIT=0

usage() {
  cat <<'EOF'
Usage: ./start-codex-desktop-shared-macos.sh [options]

Options:
  --app <path>           Codex.app path, default /Applications/Codex.app
  --desktop-exe <path>   Codex executable path inside the app bundle
  --codex <path|name>    Real Codex CLI executable, default command -v codex
  --node <path|name>     Node executable for the mux wrapper, default command -v node
  --codex-home <path>    Codex state directory, default $HOME/.codex
  --mux-wrapper <path>   Executable wrapper, default ./codex-app-server-mux-macos.sh
  --force-quit           Ask the running Codex app to quit before relaunching
  --print-only           Print the launch environment without starting Codex
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

codex_is_running() {
  pgrep -f "/Contents/MacOS/Codex" >/dev/null 2>&1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)
      CODEX_APP_PATH="${2:?--app requires a value}"
      shift 2
      ;;
    --desktop-exe)
      CODEX_DESKTOP_EXE="${2:?--desktop-exe requires a value}"
      shift 2
      ;;
    --codex)
      REAL_CODEX_EXE="${2:?--codex requires a value}"
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
    --mux-wrapper)
      MUX_WRAPPER="${2:?--mux-wrapper requires a value}"
      shift 2
      ;;
    --force-quit)
      FORCE_QUIT=1
      shift
      ;;
    --print-only)
      PRINT_ONLY=1
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

if [[ -z "$CODEX_DESKTOP_EXE" ]]; then
  CODEX_DESKTOP_EXE="$CODEX_APP_PATH/Contents/MacOS/Codex"
fi

NODE_EXE_VALUE="$(resolve_command "$NODE_EXE_VALUE" node)"
REAL_CODEX_EXE="$(resolve_command "$REAL_CODEX_EXE" codex)"
MUX_WRAPPER="$(resolve_command "$MUX_WRAPPER" codex-app-server-mux-macos.sh)"

for executable in "$CODEX_DESKTOP_EXE" "$MUX_WRAPPER" "$NODE_EXE_VALUE" "$REAL_CODEX_EXE"; do
  if [[ "$executable" == */* && ! -x "$executable" ]]; then
    echo "Executable not found or not executable: $executable" >&2
    exit 1
  fi
done

if [[ "$FORCE_QUIT" -eq 1 ]]; then
  osascript -e 'tell application "Codex" to quit' >/dev/null 2>&1 || true
  for _ in {1..30}; do
    codex_is_running || break
    sleep 1
  done
fi

if [[ "$PRINT_ONLY" -eq 0 ]] && codex_is_running; then
  echo "Codex is already running. Quit it first, or rerun with --force-quit." >&2
  exit 1
fi

export CODEX_HOME="$CODEX_HOME_VALUE"
export CODEX_CLI_PATH="$MUX_WRAPPER"
export CODEX_MUX_SCRIPT_PATH="$SCRIPT_DIR/codex-app-server-mux.js"
export CODEX_MUX_CODEX_EXE="$REAL_CODEX_EXE"
export CODEX_MUX_NODE_EXE="$NODE_EXE_VALUE"

echo "Codex Desktop shared app-server launch environment:"
echo "  CODEX_CLI_PATH=$CODEX_CLI_PATH"
echo "  CODEX_MUX_SCRIPT_PATH=$CODEX_MUX_SCRIPT_PATH"
echo "  CODEX_MUX_CODEX_EXE=$CODEX_MUX_CODEX_EXE"
echo "  CODEX_MUX_NODE_EXE=$CODEX_MUX_NODE_EXE"
echo "  CODEX_HOME=$CODEX_HOME"
echo "  Endpoint file: $CODEX_HOME/app-server-mux/endpoint.json"

if [[ "$PRINT_ONLY" -eq 1 ]]; then
  exit 0
fi

exec /usr/bin/open -n \
  --env "CODEX_HOME=$CODEX_HOME" \
  --env "CODEX_CLI_PATH=$CODEX_CLI_PATH" \
  --env "CODEX_MUX_SCRIPT_PATH=$CODEX_MUX_SCRIPT_PATH" \
  --env "CODEX_MUX_CODEX_EXE=$CODEX_MUX_CODEX_EXE" \
  --env "CODEX_MUX_NODE_EXE=$CODEX_MUX_NODE_EXE" \
  "$CODEX_APP_PATH"
