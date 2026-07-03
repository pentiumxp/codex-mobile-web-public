#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_LABEL="${CODEX_MOBILE_LAUNCHD_LABEL:-com.hermesmobile.plugin.codex-mobile}"
PLIST_PATH="${CODEX_MOBILE_LAUNCHD_PLIST:-/Library/LaunchDaemons/${SERVICE_LABEL}.plist}"
SUDO_PASSWORD_FILE="${HOMEAI_MAC_SUDO_PASSWORD_FILE:-/Users/xuxin/.homeai-qa/sudo-password}"
PROFILE_ID=""
CODEX_HOME_VALUE=""
DEFAULT_SHELL_MODE=""
PROMPT=0
LIST_HOMES=0
JSON_OUTPUT=0
MAX_WAIT_SECONDS=45
DRY_RUN=0
POSTFLIGHT_JSON="{}"
STALE_MUX_JSON="[]"

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
  --default-shell-mode <m>   Set CODEX_MOBILE_DEFAULT_SHELL to classic or vite-app-preview.
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

bounded_text() {
  printf '%s' "${1:-}" | /usr/bin/tr '\n\r\t' '   ' | /usr/bin/cut -c 1-260
}

json_error() {
  local stage="${1:-unknown}"
  local message="${2:-Codex Mobile host restart failed}"
  local detail="${3:-}"
  local status="${4:-1}"
  if [[ "$JSON_OUTPUT" -eq 1 && -n "${NODE_EXE:-}" && -x "${NODE_EXE:-}" ]]; then
    "$NODE_EXE" -e '
const payload = {
  ok: false,
  stage: process.argv[1],
  error: process.argv[2],
  detail: process.argv[3] || undefined,
  serviceLabel: process.argv[4],
  plistPath: process.argv[5],
  profileId: process.argv[6] || undefined,
  codexHome: process.argv[7] || undefined,
  defaultShellMode: process.argv[8] || undefined,
};
console.log(JSON.stringify(payload, null, 2));
' "$stage" "$(bounded_text "$message")" "$(bounded_text "$detail")" "$SERVICE_LABEL" "$PLIST_PATH" "${SELECTED_PROFILE_ID:-}" "${SELECTED_CODEX_HOME:-}" "$DEFAULT_SHELL_MODE"
  else
    echo "[$stage] $message" >&2
    if [[ -n "$detail" ]]; then
      echo "$(bounded_text "$detail")" >&2
    fi
  fi
  exit "$status"
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
let postflight = {};
let staleMuxes = [];
try { postflight = JSON.parse(process.env.POSTFLIGHT_JSON || "{}"); } catch (_) {}
try { staleMuxes = JSON.parse(process.env.STALE_MUX_JSON || "[]"); } catch (_) {}
const payload = {
  ok: true,
  serviceLabel: process.argv[1],
  plistPath: process.argv[2],
  profileId: process.argv[3],
  codexHome: process.argv[4],
  port: Number(process.argv[5]),
  url: process.argv[6],
  dryRun: process.argv[7] === "1",
  muxEndpointFile: process.argv[8],
  defaultShellMode: process.argv[9] || undefined,
  postflight,
  staleMuxes
};
console.log(JSON.stringify(payload, null, 2));
' "$SERVICE_LABEL" "$PLIST_PATH" "$SELECTED_PROFILE_ID" "$SELECTED_CODEX_HOME" "$PORT" "$READINESS_URL" "$DRY_RUN" "$SELECTED_MUX_ENDPOINT_FILE" "$DEFAULT_SHELL_MODE"
}

profile_store_active_id() {
  "$NODE_EXE" -e '
const fs = require("node:fs");
try {
  const store = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  process.stdout.write(String(store.activeProfileId || ""));
} catch (_) {}
' "$PROFILE_FILE"
}

launchd_env_value() {
  local key="$1"
  /bin/launchctl print "system/${SERVICE_LABEL}" 2>/dev/null \
    | /usr/bin/awk -v key="$key" '$1 == key && $2 == "=>" { print substr($0, index($0, "=>") + 3); exit }' \
    | /usr/bin/sed 's/^ *//; s/ *$//'
}

public_config_active_profile() {
  /usr/bin/curl -fsS "$READINESS_URL" \
    | "$NODE_EXE" -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const config = JSON.parse(input);
    process.stdout.write(String(config.codexProfiles && config.codexProfiles.activeProfileId || ""));
  } catch (_) {}
});
'
}

public_config_default_shell_mode() {
  /usr/bin/curl -fsS "$READINESS_URL" \
    | "$NODE_EXE" -e '
let input = "";
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  try {
    const config = JSON.parse(input);
    process.stdout.write(String(config.defaultShellMode || ""));
  } catch (_) {}
});
'
}

detect_stale_muxes() {
  "$NODE_EXE" - "$HELPER" "$PROFILE_FILE" "$RUNTIME_DIR" "$TARGET_USER_HOME" "$ACTIVE_CODEX_HOME" "$SELECTED_CODEX_HOME" <<'NODE'
const path = require("node:path");
const fs = require("node:fs");
const helperPath = process.argv[2];
const profileFile = process.argv[3];
const runtimeDir = process.argv[4];
const userHome = process.argv[5];
const activeCodexHome = process.argv[6];
const selectedCodexHome = path.resolve(process.argv[7]);
const { listProfiles } = require(helperPath);

function isAlive(pid) {
  const value = Number(pid || 0);
  if (!Number.isInteger(value) || value <= 0) return false;
  try {
    process.kill(value, 0);
    return true;
  } catch (_) {
    return false;
  }
}

const out = [];
try {
  const profiles = listProfiles({ profileFile, runtimeDir, userHome, activeCodexHome }).profiles || [];
  for (const profile of profiles) {
    const codexHome = profile && profile.codexHome ? path.resolve(profile.codexHome) : "";
    if (!codexHome || codexHome === selectedCodexHome) continue;
    const endpointFile = path.join(codexHome, "app-server-mux", "endpoint.json");
    if (!fs.existsSync(endpointFile)) continue;
    let endpoint = {};
    try {
      endpoint = JSON.parse(fs.readFileSync(endpointFile, "utf8"));
    } catch (_) {}
    const pid = Number(endpoint.pid || 0);
    const childPid = Number(endpoint.childPid || 0);
    out.push({
      profileId: String(profile.id || ""),
      codexHome,
      endpointFile,
      port: Number(endpoint.port || 0) || undefined,
      pid: pid || undefined,
      childPid: childPid || undefined,
      pidAlive: isAlive(pid),
      childPidAlive: isAlive(childPid),
      selectedProfile: false,
      action: "reported_only",
    });
  }
} catch (err) {
  out.push({ error: String(err && err.message || err).slice(0, 220), action: "reported_only" });
}
process.stdout.write(JSON.stringify(out));
NODE
}

validate_preflight_selection() {
  local plist_codex_home
  local plist_mux_endpoint
  local plist_default_shell
  local store_active_id
  plist_codex_home="$(plist_get_env CODEX_HOME)"
  plist_mux_endpoint="$(plist_get_env CODEX_MOBILE_MUX_ENDPOINT_FILE)"
  plist_default_shell="$(plist_get_env CODEX_MOBILE_DEFAULT_SHELL)"
  store_active_id="$(profile_store_active_id)"
  if [[ "$plist_codex_home" != "$SELECTED_CODEX_HOME" ]]; then
    json_error "preflight" "LaunchDaemon plist CODEX_HOME does not match selected profile." "plist=${plist_codex_home}; selected=${SELECTED_CODEX_HOME}" 1
  fi
  if [[ "$plist_mux_endpoint" != "$SELECTED_MUX_ENDPOINT_FILE" ]]; then
    json_error "preflight" "LaunchDaemon plist mux endpoint does not match selected profile." "plist=${plist_mux_endpoint}; selected=${SELECTED_MUX_ENDPOINT_FILE}" 1
  fi
  if [[ "$store_active_id" != "$SELECTED_PROFILE_ID" ]]; then
    json_error "preflight" "Profile store active id does not match selected profile." "store=${store_active_id}; selected=${SELECTED_PROFILE_ID}" 1
  fi
  if [[ -n "$DEFAULT_SHELL_MODE" && "$plist_default_shell" != "$DEFAULT_SHELL_MODE" ]]; then
    json_error "preflight" "LaunchDaemon plist default shell does not match selected mode." "plist=${plist_default_shell}; selected=${DEFAULT_SHELL_MODE}" 1
  fi
}

validate_postflight_selection() {
  local public_active
  local public_default_shell
  local launchd_codex_home
  local launchd_mux_endpoint
  local launchd_default_shell
  public_active="$(public_config_active_profile || true)"
  public_default_shell="$(public_config_default_shell_mode || true)"
  launchd_codex_home="$(launchd_env_value CODEX_HOME)"
  launchd_mux_endpoint="$(launchd_env_value CODEX_MOBILE_MUX_ENDPOINT_FILE)"
  launchd_default_shell="$(launchd_env_value CODEX_MOBILE_DEFAULT_SHELL)"
  if [[ "$public_active" != "$SELECTED_PROFILE_ID" ]]; then
    json_error "postflight" "Public config active profile does not match selected profile." "public=${public_active}; selected=${SELECTED_PROFILE_ID}" 1
  fi
  if [[ "$launchd_codex_home" != "$SELECTED_CODEX_HOME" ]]; then
    json_error "postflight" "Running LaunchDaemon CODEX_HOME does not match selected profile." "launchd=${launchd_codex_home}; selected=${SELECTED_CODEX_HOME}" 1
  fi
  if [[ "$launchd_mux_endpoint" != "$SELECTED_MUX_ENDPOINT_FILE" ]]; then
    json_error "postflight" "Running LaunchDaemon mux endpoint does not match selected profile." "launchd=${launchd_mux_endpoint}; selected=${SELECTED_MUX_ENDPOINT_FILE}" 1
  fi
  if [[ -n "$DEFAULT_SHELL_MODE" && "$public_default_shell" != "$DEFAULT_SHELL_MODE" ]]; then
    json_error "postflight" "Public config default shell does not match selected mode." "public=${public_default_shell}; selected=${DEFAULT_SHELL_MODE}" 1
  fi
  if [[ -n "$DEFAULT_SHELL_MODE" && "$launchd_default_shell" != "$DEFAULT_SHELL_MODE" ]]; then
    json_error "postflight" "Running LaunchDaemon default shell does not match selected mode." "launchd=${launchd_default_shell}; selected=${DEFAULT_SHELL_MODE}" 1
  fi
  POSTFLIGHT_JSON="$("$NODE_EXE" -e '
const payload = {
  activeProfileId: process.argv[1],
  codexHome: process.argv[2],
  muxEndpointFile: process.argv[3],
  defaultShellMode: process.argv[4] || undefined,
  matched: true,
};
process.stdout.write(JSON.stringify(payload));
' "$public_active" "$launchd_codex_home" "$launchd_mux_endpoint" "$public_default_shell")"
}

bootstrap_service_with_retry() {
  local output
  local status
  if output="$(run_sudo /bin/launchctl bootstrap system "$PLIST_PATH" 2>&1)"; then
    return 0
  fi
  status=$?
  if [[ "$status" -eq 5 ]]; then
    sleep 1
    if ! run_sudo /bin/launchctl print "system/${SERVICE_LABEL}" >/dev/null 2>&1; then
      local retry_output
      if retry_output="$(run_sudo /bin/launchctl bootstrap system "$PLIST_PATH" 2>&1)"; then
        return 0
      fi
      status=$?
      output="${output}; retry: ${retry_output}"
    fi
  fi
  json_error "bootstrap" "LaunchDaemon bootstrap failed." "exit=${status}; ${output}" 1
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
    --default-shell-mode)
      case "${2:?--default-shell-mode requires a value}" in
        classic|classic-script|classic-script-fallback)
          DEFAULT_SHELL_MODE="classic"
          ;;
        vite-app-preview|app-preview)
          DEFAULT_SHELL_MODE="vite-app-preview"
          ;;
        *)
          echo "Unsupported default shell mode: $2" >&2
          exit 2
          ;;
      esac
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
SELECTED_MUX_ENDPOINT_FILE="${SELECTED_CODEX_HOME}/app-server-mux/endpoint.json"

READINESS_URL="http://127.0.0.1:${PORT}/api/public-config"

if [[ "$DRY_RUN" -eq 1 ]]; then
  if [[ "$JSON_OUTPUT" -eq 1 ]]; then
    json_success
  else
    echo "Would restart $SERVICE_LABEL with CODEX_HOME=$SELECTED_CODEX_HOME"
    if [[ -n "$DEFAULT_SHELL_MODE" ]]; then
      echo "Would set CODEX_MOBILE_DEFAULT_SHELL=$DEFAULT_SHELL_MODE"
    fi
  fi
  exit 0
fi

plist_set_env CODEX_HOME "$SELECTED_CODEX_HOME"
plist_set_env CODEX_MOBILE_MUX_ENDPOINT_FILE "$SELECTED_MUX_ENDPOINT_FILE"
plist_set_env CODEX_MOBILE_PROFILE_FILE "$PROFILE_FILE"
plist_set_env CODEX_MOBILE_RUNTIME_DIR "$RUNTIME_DIR"
plist_set_env CODEX_MOBILE_PORT "$PORT"
plist_set_env CODEX_MOBILE_HOST "$HOST"
if [[ -n "$DEFAULT_SHELL_MODE" ]]; then
  plist_set_env CODEX_MOBILE_DEFAULT_SHELL "$DEFAULT_SHELL_MODE"
fi

run_sudo /bin/chmod 644 "$PLIST_PATH"
run_sudo /usr/sbin/chown root:wheel "$PLIST_PATH"

validate_preflight_selection

run_sudo /bin/launchctl bootout "system/${SERVICE_LABEL}" >/dev/null 2>&1 || true
bootstrap_service_with_retry
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

validate_postflight_selection
STALE_MUX_JSON="$(detect_stale_muxes || printf '[]')"

if [[ "$JSON_OUTPUT" -eq 1 ]]; then
  json_success
else
  echo "Codex Mobile Web restored."
  echo "  Service: $SERVICE_LABEL"
  echo "  Profile: $SELECTED_PROFILE_ID ($SELECTED_PROFILE_LABEL)"
  echo "  Codex Home: $SELECTED_CODEX_HOME"
  echo "  URL: $READINESS_URL"
fi
