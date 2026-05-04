#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${CODEX_MUX_SCRIPT_PATH:-$SCRIPT_DIR/codex-app-server-mux.js}"
NODE_BIN="${CODEX_MUX_NODE_EXE:-node}"

exec "$NODE_BIN" "$SCRIPT" "$@"
