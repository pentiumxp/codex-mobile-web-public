#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_LABEL="${CODEX_MOBILE_LAUNCHD_LABEL:-com.hermesmobile.plugin.codex-mobile}"
PLIST_PATH="${CODEX_MOBILE_LAUNCHD_PLIST:-/Library/LaunchDaemons/${SERVICE_LABEL}.plist}"
SUDO_PASSWORD_FILE="${HOMEAI_MAC_SUDO_PASSWORD_FILE:-/Users/xuxin/.homeai-qa/sudo-password}"
PROFILE_ID=""
CODEX_HOME_VALUE=""
PROMPT=0
LIST_HOMES=0
JSON_OUTPUT=0
MAX_WAIT_SECONDS=45
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: ./restart-codex-mobile-host-macos.sh [options]

Host-callable recovery script for the macOS Codex Mobile Web LaunchDaemon.
It can list configured Codex Homes, choose one, reload the LaunchDaemon plist,
and wait for the 8787 listener to become reachable again.

Options:
  --list-homes              Print configured Codex Home profiles and exit.
  --profile-id <id>         Start with a configured profile id, e.g. default/current/previous.
  --codex-home <path>       Start with an explicit Codex Home path.
  --prompt                  Prompt on stdin/stdout to select a configured profile.
  --label <launchd-label>   LaunchDaemon label, default com.hermesmobile.plugin.codex-mobile.
  --plist <path>            LaunchDaemon plist path.
  --sudo-password-file <p>  Optional local sudo password file. Contents are never printed.
  --max-wait-seconds <n>    HTTP readiness timeout, default 45.
  --json                    Print machine-readable JSON for list/success output.
  --dry-run                 Resolve selection and print the planned action without restarting.
  -h, --help                Show this help.
EOF
}

run_sudo() {
  if [[ "$(/usr/bin/id -u)" -eq 0 ]]; then
    "$@"
    return
  fi
  if [[ -n "$SUDO_PASSWORD_FILE" && -r "$SUDO_PASSWORD_FILE" ]]; then
    /usr/bin/sudo -S "$@" < "$SUDO_PASSWORD_FILE"
  else
    /usr/bin/sudo "$@"
  fi
}

plist_get_env() {
  local key="$1"
  /usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:${key}" "$PLIST_PATH" 2>/dev/null || true
}

plist_get_root() {
  local key="$1"
  /usr/libexec/PlistBuddy -c "Print :${key}" "$PLIST_PATH" 2>/dev/null || true
}

plist_ensure_env_dict() {
  run_sudo /usr/libexec/PlistBuddy -c "Print :EnvironmentVariables" "$PLIST_PATH" >/dev/null 2>&1 \
    || run_sudo /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables dict" "$PLIST_PATH" >/dev/null
}

plist_set_env() {
  local key="$1"
  local value="$2"
  plist_ensure_env_dict
  if run_sudo /usr/libexec/PlistBuddy -c "Print :EnvironmentVariables:${key}" "$PLIST_PATH" >/dev/null 2>&1; then
    run_sudo /usr/libexec/PlistBuddy -c "Set :EnvironmentVariables:${key} ${value}" "$PLIST_PATH" >/dev/null
  else
    run_sudo /usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:${key} string ${value}" "$PLIST_PATH" >/dev/null
  fi
}

json_success() {
  "$NODE_EXE" -e '
const payload = {
  ok: true,
  serviceLabel: process.argv[1],
  plistPath: process.argv[2],
  profileId: process.argv[3],
  codexHome: process.argv[4],
  port: Number(process.argv[5]),
  url: process.argv[6],
  dryRun: process.argv[7] === "1"
};
console.log(JSON.stringify(payload, null, 2));
' "$SERVICE_LABEL" "$PLIST_PATH" "$SELECTED_PROFILE_ID" "$SELECTED_CODEX_HOME" "$PORT" "$READINESS_URL" "$DRY_RUN"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list-homes)
      LIST_HOMES=1
      shift
      ;;
    --profile-id)
      PROFILE_ID="${2:?--profile-id requires a value}"
      shift 2
      ;;
    --codex-home)
      CODEX_HOME_VALUE="${2:?--codex-home requires a value}"
      shift 2
      ;;
    --prompt)
      PROMPT=1
      shift
      ;;
    --label)
      SERVICE_LABEL="${2:?--label requires a value}"
      if [[ -z "${CODEX_MOBILE_LAUNCHD_PLIST:-}" ]]; then
        PLIST_PATH="/Library/LaunchDaemons/${SERVICE_LABEL}.plist"
      fi
      shift 2
      ;;
    --plist)
      PLIST_PATH="${2:?--plist requires a value}"
      shift 2
      ;;
    --sudo-password-file)
      SUDO_PASSWORD_FILE="${2:?--sudo-password-file requires a value}"
      shift 2
      ;;
    --max-wait-seconds)
      MAX_WAIT_SECONDS="${2:?--max-wait-seconds requires a value}"
      shift 2
      ;;
    --json)
      JSON_OUTPUT=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

if [[ ! -f "$PLIST_PATH" ]]; then
  echo "LaunchDaemon plist not found: $PLIST_PATH" >&2
  exit 1
fi

PLIST_RUNTIME_DIR="$(plist_get_env CODEX_MOBILE_RUNTIME_DIR)"
PLIST_PROFILE_FILE="$(plist_get_env CODEX_MOBILE_PROFILE_FILE)"
PLIST_CODEX_HOME="$(plist_get_env CODEX_HOME)"
PLIST_NODE_EXE="$(plist_get_env CODEX_MOBILE_NODE_EXE)"
PLIST_HOST="$(plist_get_env CODEX_MOBILE_HOST)"
PLIST_PORT="$(plist_get_env CODEX_MOBILE_PORT)"
PLIST_USER_NAME="$(plist_get_root UserName)"

TARGET_USER_NAME="${PLIST_USER_NAME:-${USER:-}}"
if [[ -z "$TARGET_USER_NAME" ]]; then
  TARGET_USER_NAME="$(/usr/bin/id -un)"
fi
TARGET_USER_HOME="$(/usr/bin/dscl . -read "/Users/$TARGET_USER_NAME" NFSHomeDirectory 2>/dev/null | /usr/bin/awk '{print $2; exit}')"
TARGET_USER_HOME="${TARGET_USER_HOME:-${HOME:-/Users/$TARGET_USER_NAME}}"
RUNTIME_DIR="${CODEX_MOBILE_RUNTIME_DIR:-${PLIST_RUNTIME_DIR:-$TARGET_USER_HOME/.codex-mobile-web}}"
PROFILE_FILE="${CODEX_MOBILE_PROFILE_FILE:-${PLIST_PROFILE_FILE:-$RUNTIME_DIR/codex-profiles.json}}"
ACTIVE_CODEX_HOME="${CODEX_HOME:-${PLIST_CODEX_HOME:-$TARGET_USER_HOME/.codex}}"
NODE_EXE="${CODEX_MOBILE_NODE_EXE:-${PLIST_NODE_EXE:-}}"
HOST="${CODEX_MOBILE_HOST:-${PLIST_HOST:-127.0.0.1}}"
PORT="${CODEX_MOBILE_PORT:-${PLIST_PORT:-8787}}"

if [[ -z "$NODE_EXE" ]]; then
  NODE_EXE="$(command -v node || true)"
fi
if [[ -z "$NODE_EXE" || ! -x "$NODE_EXE" ]]; then
  echo "Node executable not found. Set CODEX_MOBILE_NODE_EXE or configure it in $PLIST_PATH." >&2
  exit 1
fi

HELPER="$SCRIPT_DIR/scripts/codex-mobile-macos-profile-helper.js"
if [[ ! -f "$HELPER" ]]; then
  echo "Profile helper not found: $HELPER" >&2
  exit 1
fi

helper_base_args=(
  "--profile-file" "$PROFILE_FILE"
  "--runtime-dir" "$RUNTIME_DIR"
  "--user-home" "$TARGET_USER_HOME"
  "--active-codex-home" "$ACTIVE_CODEX_HOME"
)

if [[ "$LIST_HOMES" -eq 1 ]]; then
  if [[ "$JSON_OUTPUT" -eq 1 ]]; then
    "$NODE_EXE" "$HELPER" list "${helper_base_args[@]}" --format json
  else
    "$NODE_EXE" "$HELPER" list "${helper_base_args[@]}" --format tsv
  fi
  exit 0
fi

if [[ "$PROMPT" -eq 1 && -z "$PROFILE_ID" && -z "$CODEX_HOME_VALUE" ]]; then
  echo "Available Codex Homes:"
  "$NODE_EXE" "$HELPER" list "${helper_base_args[@]}" --format tsv \
    | /usr/bin/awk -F '\t' '{ printf "  [%d] %s%s - %s (%s) %s\n", NR, $1, ($2=="active" ? " *" : ""), $4, $3, $6 }'
  printf "Select Codex profile id: "
  read -r PROFILE_ID
fi

select_args=(select "${helper_base_args[@]}" --format shell)
if [[ -n "$PROFILE_ID" ]]; then
  select_args+=(--profile-id "$PROFILE_ID")
fi
if [[ -n "$CODEX_HOME_VALUE" ]]; then
  select_args+=(--codex-home "$CODEX_HOME_VALUE")
fi
if [[ "$DRY_RUN" -eq 1 ]]; then
  select_args+=(--no-write)
fi
eval "$("$NODE_EXE" "$HELPER" "${select_args[@]}")"

READINESS_URL="http://127.0.0.1:${PORT}/api/public-config"

if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ "$JSON_OUTPUT" -eq 1 ]]; then
    json_success
  else
    echo "Would restart $SERVICE_LABEL with CODEX_HOME=$SELECTED_CODEX_HOME"
  fi
  exit 0
fi

plist_set_env CODEX_HOME "$SELECTED_CODEX_HOME"
plist_set_env CODEX_MOBILE_PROFILE_FILE "$PROFILE_FILE"
plist_set_env CODEX_MOBILE_RUNTIME_DIR "$RUNTIME_DIR"
plist_set_env CODEX_MOBILE_PORT "$PORT"
plist_set_env CODEX_MOBILE_HOST "$HOST"

run_sudo /bin/chmod 644 "$PLIST_PATH"
run_sudo /usr/sbin/chown root:wheel "$PLIST_PATH"

run_sudo /bin/launchctl bootout "system/${SERVICE_LABEL}" >/dev/null 2>&1 || true
run_sudo /bin/launchctl bootstrap system "$PLIST_PATH"
run_sudo /bin/launchctl kickstart -k "system/${SERVICE_LABEL}" >/dev/null 2>&1 || true

deadline=$((SECONDS + MAX_WAIT_SECONDS))
until /usr/bin/curl -fsS "$READINESS_URL" >/dev/null 2>&1; do
  if [[ "$SECONDS" -ge "$deadline" ]]; then
    echo "Codex Mobile Web did not become ready at $READINESS_URL within ${MAX_WAIT_SECONDS}s." >&2
    run_sudo /bin/launchctl print "system/${SERVICE_LABEL}" >&2 || true
    exit 1
  fi
  sleep 1
done

if [[ "$JSON_OUTPUT" -eq 1 ]]; then
  json_success
else
  echo "Codex Mobile Web restored."
  echo "  Service: $SERVICE_LABEL"
  echo "  Profile: $SELECTED_PROFILE_ID ($SELECTED_PROFILE_LABEL)"
  echo "  Codex Home: $SELECTED_CODEX_HOME"
  echo "  URL: $READINESS_URL"
fi
