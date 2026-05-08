#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_ADDRESS="${CODEX_MOBILE_HOST:-0.0.0.0}"
PORT="${CODEX_MOBILE_PORT:-8789}"
CODEX_HOME_VALUE="${CODEX_HOME:-$HOME/.codex}"
RUNTIME_ROOT="${CODEX_MOBILE_RUNTIME_DIR:-$HOME/.codex-mobile-web}"
LOG_DIR="${CODEX_MOBILE_LOG_DIR:-$RUNTIME_ROOT/logs}"
PID_DIR="${CODEX_MOBILE_PID_DIR:-$RUNTIME_ROOT}"
FORCE_QUIT=1
PRINT_ONLY=0
FORCE_KILL_NON_MOBILE_HOLDER=1

usage() {
  cat <<'EOF'
Usage: ./start-codex-shared-mobile-macos.sh [options]

Starts Codex Desktop through the shared mux launcher and starts Codex Mobile Web
on a fixed port. This will quit the currently running Codex Desktop app by
default so the mux can be inserted before Desktop starts its app-server.

Options:
  --host <address>       Mobile Web bind address, default 0.0.0.0
  --port <port>          Mobile Web port, default 8789
  --no-force-kill-non-mobile
                        Keep current process on the target port if it is not a
                        Mobile Web process.
  --codex-home <path>    Codex state directory, default $HOME/.codex
  --no-force-quit        Do not quit an already running Codex Desktop
  --print-only           Print what would be used without starting anything
  -h, --help             Show this help
EOF
}

port_is_free() {
  local port="$1"
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

mobile_process_matches() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  [[ -z "$cmd" ]] && return 1

  if [[ "$cmd" == *"$SCRIPT_DIR/server.js"* || "$cmd" == *"start-codex-mobile-web-macos.sh" ]]; then
    return 0
  fi
  return 1
}

release_occupied_port() {
  local port="$1"
  local pids
  pids="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  [[ -z "$pids" ]] && return 0

  local has_foreign=0
  local pid
  for pid in $pids; do
    if mobile_process_matches "$pid"; then
      echo "Port $port occupied by previous Mobile Web process (pid $pid), stopping it now..."
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
      continue
    fi

    if [[ "$FORCE_KILL_NON_MOBILE_HOLDER" -eq 1 ]]; then
      echo "Port $port occupied by non-mobile process (pid $pid), force killing..."
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
      if kill -0 "$pid" >/dev/null 2>&1; then
        kill -9 "$pid" >/dev/null 2>&1 || true
      fi
      continue
    fi
    has_foreign=1
  done

  if [[ "$has_foreign" -eq 1 && "$FORCE_KILL_NON_MOBILE_HOLDER" -eq 0 ]]; then
    echo "Port $port is occupied by a non-Mobile Web process. Use --no-force-kill-non-mobile if you don't want auto-kill."
    return 1
  fi
}

choose_port() {
  if [[ "$PORT" == "auto" ]]; then
    echo "auto mode is disabled for this launcher. Use --port to set a fixed port (default 8789)." >&2
    exit 1
  fi
  release_occupied_port "$PORT" || return 1

  if ! port_is_free "$PORT"; then
    echo "Requested port is still in use after cleanup: $PORT" >&2
    exit 1
  fi
  printf '%s\n' "$PORT"
  return 0
}

stop_previous_mobile_web() {
  local pid_file="$PID_DIR/mobile-web.pid"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" >/dev/null 2>&1; then
    rm -f "$pid_file"
    return 0
  fi

  local command
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$command" == *"server.js"* || "$command" == *"start-codex-mobile-web-macos.sh"* ]]; then
    echo "Stopping previous Mobile Web process: $pid"
    kill "$pid" >/dev/null 2>&1 || true
    sleep 1
  else
    echo "PID file points to a non-Mobile-Web process; leaving it alone: $pid" >&2
  fi
  rm -f "$pid_file"
}

print_launch_plan() {
  echo "Codex shared mobile launch plan:"
  echo "  Codex home: $CODEX_HOME_VALUE"
  echo "  Mobile Web: http://$HOST_ADDRESS:$CHOSEN_PORT"
  echo "  Mux endpoint: $ENDPOINT_FILE"
  echo "  Desktop log: $DESKTOP_LOG"
  echo "  Mobile Web log: $MOBILE_LOG"
}

lan_ip() {
  ipconfig getifaddr en0 2>/dev/null \
    || ipconfig getifaddr en1 2>/dev/null \
    || true
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
    --codex-home)
      CODEX_HOME_VALUE="${2:?--codex-home requires a value}"
      shift 2
      ;;
    --no-force-quit)
      FORCE_QUIT=0
      shift
      ;;
    --print-only)
      PRINT_ONLY=1
      shift
      ;;
    --no-force-kill-non-mobile)
      FORCE_KILL_NON_MOBILE_HOLDER=0
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

stop_previous_mobile_web
CHOSEN_PORT="$(choose_port)"
mkdir -p "$LOG_DIR" "$PID_DIR"

DESKTOP_LOG="$LOG_DIR/codex-desktop-shared.log"
MOBILE_LOG="$LOG_DIR/mobile-web.log"
DESKTOP_PID_FILE="$PID_DIR/codex-desktop-shared.pid"
MOBILE_PID_FILE="$PID_DIR/mobile-web.pid"
ENDPOINT_FILE="$CODEX_HOME_VALUE/app-server-mux/endpoint.json"
ACCESS_KEY_FILE="$RUNTIME_ROOT/access_key"

print_launch_plan

if [[ "$PRINT_ONLY" -eq 1 ]]; then
  exit 0
fi

desktop_args=(--codex-home "$CODEX_HOME_VALUE")
if [[ "$FORCE_QUIT" -eq 1 ]]; then
  desktop_args+=(--force-quit)
fi

echo "Starting Codex Desktop through shared mux..."
(
  cd "$SCRIPT_DIR"
  ./start-codex-desktop-shared-macos.sh "${desktop_args[@]}"
) >"$DESKTOP_LOG" 2>&1 &
echo $! > "$DESKTOP_PID_FILE"

echo "Starting Mobile Web on port $CHOSEN_PORT..."
CODEX_HOME="$CODEX_HOME_VALUE" CODEX_MOBILE_RUNTIME_DIR="$RUNTIME_ROOT" \
  "$SCRIPT_DIR/start-codex-mobile-web-macos.sh" \
    --host "$HOST_ADDRESS" \
    --port "$CHOSEN_PORT" \
    --codex-home "$CODEX_HOME_VALUE" \
  >"$MOBILE_LOG" 2>&1 &
echo $! > "$MOBILE_PID_FILE"

sleep 2

LOCAL_URL="http://127.0.0.1:$CHOSEN_PORT"
LAN_IP="$(lan_ip)"
LAN_URL=""
if [[ "$HOST_ADDRESS" != "127.0.0.1" && -n "$LAN_IP" ]]; then
  LAN_URL="http://$LAN_IP:$CHOSEN_PORT"
fi

echo
echo "Started."
echo "  Local URL: $LOCAL_URL"
if [[ -n "$LAN_URL" ]]; then
  echo "  Phone URL: $LAN_URL"
else
  echo "  Phone URL: use http://<this-mac-ip>:$CHOSEN_PORT"
fi
echo "  Access key file: $ACCESS_KEY_FILE"
if [[ -f "$ACCESS_KEY_FILE" ]]; then
  echo "  Access key: $(cat "$ACCESS_KEY_FILE")"
else
  echo "  Access key: not created yet; wait a few seconds and run: cat \"$ACCESS_KEY_FILE\""
fi
echo
echo "Check shared mux:"
echo "  cat \"$ENDPOINT_FILE\""
echo "  tail -100 \"$CODEX_HOME_VALUE/app-server-mux/mux.log\""
echo
echo "Stop Mobile Web launched by this script:"
echo "  kill \"$(cat "$MOBILE_PID_FILE")\""
