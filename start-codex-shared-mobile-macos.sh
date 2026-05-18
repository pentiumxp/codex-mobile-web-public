#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_ADDRESS="${CODEX_MOBILE_HOST:-0.0.0.0}"
PORT="${CODEX_MOBILE_PORT:-auto}"
START_PORT="${CODEX_MOBILE_START_PORT:-8789}"
END_PORT="${CODEX_MOBILE_END_PORT:-8899}"
RESERVED_PORTS="${CODEX_MOBILE_RESERVED_PORTS-8797}"
CODEX_HOME_VALUE="${CODEX_HOME:-$HOME/.codex}"
CODEX_EXE_VALUE="${CODEX_MOBILE_CODEX_EXE:-${CODEX_MUX_CODEX_EXE:-}}"
NODE_EXE_VALUE="${CODEX_MOBILE_NODE_EXE:-${CODEX_MUX_NODE_EXE:-}}"
RUNTIME_ROOT="${CODEX_MOBILE_RUNTIME_DIR:-$HOME/.codex-mobile-web}"
LOG_DIR="${CODEX_MOBILE_LOG_DIR:-$RUNTIME_ROOT/logs}"
PID_DIR="${CODEX_MOBILE_PID_DIR:-$RUNTIME_ROOT}"
RESTART_DESKTOP=0
FORCE_QUIT=1
PRINT_ONLY=0

usage() {
  cat <<'EOF'
Usage: ./start-codex-shared-mobile-macos.sh [options]

Starts or restarts Codex Mobile Web on an available port. By default this
reuses the existing shared mux endpoint and does not quit Codex Desktop.

Use --restart-desktop only when the Desktop shared mux injection itself needs
to be refreshed. That mode may show a Codex quit confirmation dialog on the Mac.

Options:
  --host <address>       Mobile Web bind address, default 0.0.0.0
  --port <port|auto>     Mobile Web port, default auto
  --start-port <port>    First auto port, default 8789
  --end-port <port>      Last auto port, default 8899
  --reserved-ports <csv> Ports auto mode must skip, default 8797
  --no-reserved-ports    Let auto mode consider every port in the range
  --codex-home <path>    Codex state directory, default $HOME/.codex
  --codex <path|name>    Codex CLI executable, default command -v codex
  --node <path|name>     Node executable, default command -v node
  --restart-desktop      Restart Codex Desktop through the shared mux launcher
  --force-quit           Alias for --restart-desktop; quit Codex Desktop first
  --no-force-quit        With --restart-desktop, do not ask Codex Desktop to quit
  --print-only           Print what would be used without starting anything
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

port_is_reserved() {
  local port="$1"
  local item
  local old_ifs="$IFS"
  IFS=','
  for item in $RESERVED_PORTS; do
    item="${item//[[:space:]]/}"
    if [[ -n "$item" && "$item" == "$port" ]]; then
      IFS="$old_ifs"
      return 0
    fi
  done
  IFS="$old_ifs"
  return 1
}

port_is_free() {
  local port="$1"
  if port_is_reserved "$port"; then
    return 1
  fi
  ! lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

choose_port() {
  if [[ "$PORT" != "auto" ]]; then
    if port_is_reserved "$PORT"; then
      echo "Requested port is reserved: $PORT (CODEX_MOBILE_RESERVED_PORTS=$RESERVED_PORTS)" >&2
      exit 1
    fi
    if ! port_is_free "$PORT"; then
      echo "Requested port is already in use: $PORT" >&2
      exit 1
    fi
    printf '%s\n' "$PORT"
    return 0
  fi

  local port
  for port in $(seq "$START_PORT" "$END_PORT"); do
    if port_is_free "$port"; then
      printf '%s\n' "$port"
      return 0
    fi
  done

  echo "No free port found from $START_PORT to $END_PORT" >&2
  exit 1
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
    --start-port)
      START_PORT="${2:?--start-port requires a value}"
      shift 2
      ;;
    --end-port)
      END_PORT="${2:?--end-port requires a value}"
      shift 2
      ;;
    --reserved-ports)
      if [[ $# -lt 2 || "$2" == --* ]]; then
        echo "--reserved-ports requires a comma-separated value. Use --no-reserved-ports to clear the list." >&2
        exit 2
      fi
      RESERVED_PORTS="$2"
      shift 2
      ;;
    --no-reserved-ports)
      RESERVED_PORTS=""
      shift
      ;;
    --codex-home)
      CODEX_HOME_VALUE="${2:?--codex-home requires a value}"
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
    --restart-desktop)
      RESTART_DESKTOP=1
      FORCE_QUIT=1
      shift
      ;;
    --force-quit)
      RESTART_DESKTOP=1
      FORCE_QUIT=1
      shift
      ;;
    --no-force-quit)
      FORCE_QUIT=0
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

NODE_EXE_VALUE="$(resolve_command "$NODE_EXE_VALUE" node)"
CODEX_EXE_VALUE="$(resolve_command "$CODEX_EXE_VALUE" codex)"

for executable in "$NODE_EXE_VALUE" "$CODEX_EXE_VALUE"; do
  if [[ "$executable" == */* && ! -x "$executable" ]]; then
    echo "Executable not found or not executable: $executable" >&2
    exit 1
  fi
done

mkdir -p "$LOG_DIR" "$PID_DIR"

DESKTOP_LOG="$LOG_DIR/codex-desktop-shared.log"
MOBILE_LOG="$LOG_DIR/mobile-web.log"
DESKTOP_PID_FILE="$PID_DIR/codex-desktop-shared.pid"
MOBILE_PID_FILE="$PID_DIR/mobile-web.pid"
ENDPOINT_FILE="$CODEX_HOME_VALUE/app-server-mux/endpoint.json"
ACCESS_KEY_FILE="$RUNTIME_ROOT/access_key"
if [[ -f "$ENDPOINT_FILE" ]]; then
  MUX_ENDPOINT_STATUS="found"
else
  MUX_ENDPOINT_STATUS="missing"
fi

if [[ "$PRINT_ONLY" -eq 0 ]]; then
  stop_previous_mobile_web
fi

CHOSEN_PORT="$(choose_port)"

echo "Codex shared mobile launch plan:"
echo "  Codex home: $CODEX_HOME_VALUE"
echo "  Mobile Web: http://$HOST_ADDRESS:$CHOSEN_PORT"
echo "  Desktop restart: $([[ "$RESTART_DESKTOP" -eq 1 ]] && echo yes || echo no)"
echo "  Reserved ports: ${RESERVED_PORTS:-none}"
echo "  Mux endpoint: $ENDPOINT_FILE"
echo "  Mux endpoint status: $MUX_ENDPOINT_STATUS"
echo "  Codex exe: $CODEX_EXE_VALUE"
echo "  Node exe: $NODE_EXE_VALUE"
echo "  Mobile Web log: $MOBILE_LOG"
if [[ "$RESTART_DESKTOP" -eq 1 ]]; then
  echo "  Desktop log: $DESKTOP_LOG"
  if [[ "$FORCE_QUIT" -eq 1 ]]; then
    echo "  Note: Codex Desktop may ask for quit confirmation on the Mac."
  fi
else
  echo "  Desktop: unchanged; existing shared mux endpoint will be reused if available."
fi

if [[ "$PRINT_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ "$RESTART_DESKTOP" -eq 1 ]]; then
  desktop_args=(--codex-home "$CODEX_HOME_VALUE" --codex "$CODEX_EXE_VALUE" --node "$NODE_EXE_VALUE")
  if [[ "$FORCE_QUIT" -eq 1 ]]; then
    desktop_args+=(--force-quit)
  fi

  echo "Starting Codex Desktop through shared mux..."
  (
    cd "$SCRIPT_DIR"
    ./start-codex-desktop-shared-macos.sh "${desktop_args[@]}"
  ) >"$DESKTOP_LOG" 2>&1 &
  echo $! > "$DESKTOP_PID_FILE"
else
  echo "Leaving Codex Desktop running; Mobile Web will reconnect to the existing shared mux when available."
fi

echo "Starting Mobile Web on port $CHOSEN_PORT..."
CODEX_HOME="$CODEX_HOME_VALUE" CODEX_MOBILE_RUNTIME_DIR="$RUNTIME_ROOT" \
  "$SCRIPT_DIR/start-codex-mobile-web-macos.sh" \
    --host "$HOST_ADDRESS" \
    --port "$CHOSEN_PORT" \
    --codex "$CODEX_EXE_VALUE" \
    --node "$NODE_EXE_VALUE" \
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
