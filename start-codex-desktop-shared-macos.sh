#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CODEX_APP_PATH="${CODEX_DESKTOP_APP_PATH:-}"
CODEX_DESKTOP_EXE="${CODEX_DESKTOP_EXE:-}"
CODEX_HOME_VALUE="${CODEX_HOME:-$HOME/.codex}"
REAL_CODEX_EXE="${CODEX_MUX_CODEX_EXE:-}"
NODE_EXE_VALUE="${CODEX_MUX_NODE_EXE:-}"
MUX_WRAPPER="${CODEX_CLI_PATH:-$SCRIPT_DIR/codex-app-server-mux-macos.sh}"
OPEN_BIN="${CODEX_DESKTOP_OPEN_BIN:-/usr/bin/open}"
LAUNCHCTL_BIN="${CODEX_DESKTOP_LAUNCHCTL_BIN:-/bin/launchctl}"
CODEX_APP_NAME=""
PRINT_ONLY=0
FORCE_QUIT=0
PERSIST_LAUNCH_ENV=1
CLEAR_LAUNCH_ENV=0

usage() {
  cat <<'EOF'
Usage: ./start-codex-desktop-shared-macos.sh [options]

Options:
  --app <path>           Desktop app path, default /Applications/ChatGPT.app
                         with /Applications/Codex.app fallback
  --desktop-exe <path>   Codex executable path inside the app bundle
  --codex <path|name>    Real Codex CLI executable, default command -v codex
  --node <path|name>     Node executable for the mux wrapper, default command -v node
  --codex-home <path>    Codex state directory, default $HOME/.codex
  --mux-wrapper <path>   Executable wrapper, default ./codex-app-server-mux-macos.sh
  --force-quit           Ask the running Codex app to quit before relaunching
  --no-persist-launch-env
                         Inject the shared environment only into this launch
  --clear-launch-env     Remove the persisted shared environment and exit
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

resolve_codex_command() {
  local value="$1"
  if [[ -n "$value" ]]; then
    resolve_command "$value" codex
    return 0
  fi
  local candidate
  for candidate in \
    "$CODEX_APP_PATH/Contents/Resources/codex" \
    "/Applications/ChatGPT.app/Contents/Resources/codex" \
    "/Applications/Codex.app/Contents/Resources/codex"; do
    if [[ -x "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  resolve_command "" codex
}

strip_app_suffix() {
  local name="$1"
  name="${name%.app}"
  printf '%s\n' "$name"
}

default_app_path() {
  if [[ -d "/Applications/ChatGPT.app" ]]; then
    printf '%s\n' "/Applications/ChatGPT.app"
    return 0
  fi
  if [[ -d "/Applications/Codex.app" ]]; then
    printf '%s\n' "/Applications/Codex.app"
    return 0
  fi
  printf '%s\n' "/Applications/ChatGPT.app"
}

read_info_plist_value() {
  local app_path="$1"
  local key="$2"
  local plist="$app_path/Contents/Info.plist"
  if [[ ! -f "$plist" || ! -x "/usr/libexec/PlistBuddy" ]]; then
    return 0
  fi
  /usr/libexec/PlistBuddy -c "Print :$key" "$plist" 2>/dev/null || true
}

bundle_base_name() {
  local app_path="$1"
  strip_app_suffix "$(basename "$app_path")"
}

resolve_desktop_executable() {
  local app_path="$1"
  local executable_name
  executable_name="$(read_info_plist_value "$app_path" "CFBundleExecutable")"
  if [[ -z "$executable_name" ]]; then
    executable_name="$(bundle_base_name "$app_path")"
  fi
  printf '%s\n' "$app_path/Contents/MacOS/$executable_name"
}

resolve_app_name() {
  local app_path="$1"
  local name
  name="$(read_info_plist_value "$app_path" "CFBundleName")"
  if [[ -z "$name" ]]; then
    name="$(read_info_plist_value "$app_path" "CFBundleDisplayName")"
  fi
  if [[ -z "$name" ]]; then
    name="$(bundle_base_name "$app_path")"
  fi
  printf '%s\n' "$name"
}

escape_pgrep_pattern() {
  printf '%s\n' "$1" | sed 's/[][(){}.^$?*+|\\]/\\&/g'
}

codex_is_running() {
  local pattern
  pattern="$(escape_pgrep_pattern "$CODEX_DESKTOP_EXE")"
  pgrep -f "$pattern" >/dev/null 2>&1
}

shared_launch_environment_names() {
  printf '%s\n' \
    CODEX_HOME \
    CODEX_CLI_PATH \
    CODEX_MUX_SCRIPT_PATH \
    CODEX_MUX_CODEX_EXE \
    CODEX_MUX_NODE_EXE \
    CODEX_MUX_KEEP_ALIVE
}

persist_launch_environment() {
  local name
  while IFS= read -r name; do
    "$LAUNCHCTL_BIN" setenv "$name" "${!name}"
  done < <(shared_launch_environment_names)
}

clear_launch_environment() {
  local name
  while IFS= read -r name; do
    "$LAUNCHCTL_BIN" unsetenv "$name"
  done < <(shared_launch_environment_names)
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
    --no-persist-launch-env)
      PERSIST_LAUNCH_ENV=0
      shift
      ;;
    --clear-launch-env)
      CLEAR_LAUNCH_ENV=1
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

if [[ "$CLEAR_LAUNCH_ENV" -eq 1 && "$PRINT_ONLY" -eq 1 ]]; then
  echo "--clear-launch-env and --print-only are mutually exclusive" >&2
  exit 2
fi

if [[ "$CLEAR_LAUNCH_ENV" -eq 1 ]]; then
  if [[ ! -x "$LAUNCHCTL_BIN" ]]; then
    echo "launchctl not found or not executable: $LAUNCHCTL_BIN" >&2
    exit 1
  fi
  clear_launch_environment
  echo "Cleared persisted Codex shared environment for the current macOS login session."
  exit 0
fi

if [[ -z "$CODEX_APP_PATH" ]]; then
  CODEX_APP_PATH="$(default_app_path)"
fi

if [[ -z "$CODEX_DESKTOP_EXE" ]]; then
  CODEX_DESKTOP_EXE="$(resolve_desktop_executable "$CODEX_APP_PATH")"
fi
CODEX_APP_NAME="$(resolve_app_name "$CODEX_APP_PATH")"

NODE_EXE_VALUE="$(resolve_command "$NODE_EXE_VALUE" node)"
REAL_CODEX_EXE="$(resolve_codex_command "$REAL_CODEX_EXE")"
MUX_WRAPPER="$(resolve_command "$MUX_WRAPPER" codex-app-server-mux-macos.sh)"

for executable in "$CODEX_DESKTOP_EXE" "$MUX_WRAPPER" "$NODE_EXE_VALUE" "$REAL_CODEX_EXE"; do
  if [[ "$executable" == */* && ! -x "$executable" ]]; then
    echo "Executable not found or not executable: $executable" >&2
    exit 1
  fi
done

if [[ "$PRINT_ONLY" -eq 0 ]]; then
  for executable in "$OPEN_BIN"; do
    if [[ ! -x "$executable" ]]; then
      echo "Executable not found or not executable: $executable" >&2
      exit 1
    fi
  done
  if [[ "$PERSIST_LAUNCH_ENV" -eq 1 && ! -x "$LAUNCHCTL_BIN" ]]; then
    echo "launchctl not found or not executable: $LAUNCHCTL_BIN" >&2
    exit 1
  fi
fi

if [[ "$FORCE_QUIT" -eq 1 ]]; then
  osascript - "$CODEX_APP_NAME" >/dev/null 2>&1 <<'APPLESCRIPT' || true
on run argv
  tell application (item 1 of argv) to quit
end run
APPLESCRIPT
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
export CODEX_MUX_KEEP_ALIVE=1

echo "Codex Desktop shared app-server launch environment:"
echo "  Desktop app: $CODEX_APP_PATH"
echo "  Desktop app name: $CODEX_APP_NAME"
echo "  Desktop executable: $CODEX_DESKTOP_EXE"
echo "  CODEX_CLI_PATH=$CODEX_CLI_PATH"
echo "  CODEX_MUX_SCRIPT_PATH=$CODEX_MUX_SCRIPT_PATH"
echo "  CODEX_MUX_CODEX_EXE=$CODEX_MUX_CODEX_EXE"
echo "  CODEX_MUX_NODE_EXE=$CODEX_MUX_NODE_EXE"
echo "  CODEX_MUX_KEEP_ALIVE=$CODEX_MUX_KEEP_ALIVE"
echo "  CODEX_HOME=$CODEX_HOME"
if [[ "$PERSIST_LAUNCH_ENV" -eq 1 ]]; then
  echo "  LaunchServices environment: persist for the current login session"
else
  echo "  LaunchServices environment: this launch only"
fi
echo "  Endpoint file: $CODEX_HOME/app-server-mux/endpoint.json"

if [[ "$PRINT_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ "$PERSIST_LAUNCH_ENV" -eq 1 ]]; then
  persist_launch_environment
fi

exec "$OPEN_BIN" -n \
  --env "CODEX_HOME=$CODEX_HOME" \
  --env "CODEX_CLI_PATH=$CODEX_CLI_PATH" \
  --env "CODEX_MUX_SCRIPT_PATH=$CODEX_MUX_SCRIPT_PATH" \
  --env "CODEX_MUX_CODEX_EXE=$CODEX_MUX_CODEX_EXE" \
  --env "CODEX_MUX_NODE_EXE=$CODEX_MUX_NODE_EXE" \
  --env "CODEX_MUX_KEEP_ALIVE=$CODEX_MUX_KEEP_ALIVE" \
  "$CODEX_APP_PATH"
