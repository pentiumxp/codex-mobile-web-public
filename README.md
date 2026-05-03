# Codex Mobile Web

Codex Mobile Web is a local web client for reading and controlling Codex sessions from a phone or another browser on the same network. It talks to `codex app-server`, reads local Codex state, and exposes a compact mobile UI with message sending, image/file uploads, model/effort selectors, quota display, live operation cards, and turn timing.

This repository does not contain Codex credentials, uploaded files, or a bundled Codex binary. Those are local runtime state on each machine.

## Platform Status

| Platform | Standalone Mobile Web | Desktop live sync through mux | Notes |
| --- | --- | --- | --- |
| Windows | Supported | Supported with the included PowerShell launcher | This is the primary tested platform. |
| macOS | Supported for standalone Mobile Web when `codex` CLI is installed | Not yet packaged/tested | The shared Desktop mux launcher is currently Windows-specific. |

Standalone Mobile Web means the browser connects to this local server, and the server starts or connects to a Codex app-server. Desktop live sync means Codex Desktop and Mobile Web attach to the same mux-backed app-server so both UIs see the same active turn stream.

## Requirements

- Node.js `>= 22`
- Git
- Codex CLI installed and authenticated on the same machine
- A local Codex state directory, usually:
  - Windows: `%USERPROFILE%\.codex`
  - macOS: `$HOME/.codex`
- Phone/browser on the same LAN, VPN, or Tailscale route when accessing from another device

Check the runtime:

```bash
node --version
codex --version
```

If Codex CLI is not authenticated, authenticate it first using the normal Codex CLI/Desktop flow for that machine.

## Clone And Validate

```bash
git clone https://github.com/pentiumxp/codex-mobile-web-public.git
cd codex-mobile-web
npm run check
```

There are no npm package dependencies. `npm run check` only syntax-checks the JavaScript files.

## Windows Standalone Start

From PowerShell:

```powershell
cd C:\path\to\codex-mobile-web
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787
```

Open on the Windows machine:

```text
http://127.0.0.1:8787
```

Open from a phone on the same network:

```text
http://<windows-lan-ip>:8787
```

Examples:

```text
http://192.168.1.25:8787
http://100.x.y.z:8787
```

The startup script prefers this local runtime binary when it exists:

```text
%USERPROFILE%\.codex-mobile-web\codex.exe
```

If that file does not exist, it falls back to `codex` from `PATH`.

## macOS Standalone Start

The PowerShell scripts are for Windows. On macOS, start the server directly with environment variables:

```bash
cd /path/to/codex-mobile-web
npm run check

export CODEX_HOME="$HOME/.codex"
export CODEX_MOBILE_HOST="0.0.0.0"
export CODEX_MOBILE_PORT="8787"
export CODEX_MOBILE_CODEX_EXE="codex"

npm start
```

Open on the Mac:

```text
http://127.0.0.1:8787
```

Open from a phone on the same network:

```text
http://<mac-lan-ip>:8787
```

Find the Mac LAN IP with:

```bash
ipconfig getifaddr en0
```

If that returns nothing, check Wi-Fi/Ethernet interfaces:

```bash
ifconfig
```

macOS may ask whether Node.js can accept incoming network connections. Allow it if you want phone access on the LAN. If you only use `http://127.0.0.1:8787` on the Mac itself, LAN firewall access is not required.

## Authentication

By default the server requires an access key.

Key source priority:

1. `CODEX_MOBILE_KEY`
2. `CODEX_MOBILE_KEY_FILE`
3. Default runtime key file:
   - Windows: `%USERPROFILE%\.codex-mobile-web\access_key`
   - macOS: `$HOME/.codex-mobile-web/access_key`

If `CODEX_MOBILE_KEY` is not set and the key file does not exist, the server creates a durable random key on first start. The implementation uses 18 random bytes encoded as `base64url`, then writes the result to the key file with restrictive file permissions where the OS supports them.

Typical generated key shape:

```text
H5X8q6z7Kp1xkY4nQm2AbcDe
```

The key is per machine. Do not reuse another person's key and do not commit it to Git.

### Easiest Login Flow

1. Start the server.
2. Copy the generated access key from the machine running the server.
3. Open `http://<computer-ip>:8787` on the phone/browser.
4. Paste the key into the login page.
5. After a successful login, the browser stores it in localStorage and a one-year cookie, so normal reloads do not ask again.

Read the key:

Windows PowerShell:

```powershell
Get-Content "$env:USERPROFILE\.codex-mobile-web\access_key"
```

Copy the key directly to the Windows clipboard:

```powershell
Get-Content "$env:USERPROFILE\.codex-mobile-web\access_key" | Set-Clipboard
```

macOS:

```bash
cat "$HOME/.codex-mobile-web/access_key"
```

Copy the key directly to the macOS clipboard:

```bash
cat "$HOME/.codex-mobile-web/access_key" | pbcopy
```

If the key file does not exist yet, start the server once. It is created during startup.

### Optional Custom Key

For a short demo on a trusted private network, you can choose your own key with `CODEX_MOBILE_KEY`. Use a non-trivial value; do not use a weak shared password on an untrusted network.

Windows:

```powershell
$env:CODEX_MOBILE_KEY = "replace-with-a-random-private-key"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787
```

macOS:

```bash
export CODEX_MOBILE_KEY="replace-with-a-random-private-key"
npm start
```

When `CODEX_MOBILE_KEY` is set, that environment value is used instead of the key file for that server process.

Disable auth only for isolated local testing:

Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -NoAuth
```

macOS:

```bash
CODEX_MOBILE_DISABLE_AUTH=1 npm start
```

Do not expose an unauthenticated server on a public network.

## Uploads

The composer supports images and files.

Default upload directory:

- Windows: `%USERPROFILE%\.codex-mobile-web\uploads`
- macOS: `$HOME/.codex-mobile-web/uploads`

Environment overrides:

```bash
CODEX_MOBILE_UPLOAD_DIR=/path/to/uploads
CODEX_MOBILE_MAX_UPLOAD_BYTES=67108864
CODEX_MOBILE_MAX_UPLOAD_FILES=12
```

Behavior:

- Images are sent to Codex as `localImage` input items.
- Image messages render as centered thumbnails in the web UI.
- Non-image files are saved locally and referenced in message text by absolute path so Codex can read them through normal file access.
- Uploaded file contents are local runtime state and must not be committed.

## Interface Notes

- Home view shows recent workspaces and recent threads.
- The top-right timer shows current turn elapsed time as `本轮 HH:MM:SS`.
- The timer is red while a turn is active and muted after completion.
- Live reasoning is not rendered as conversation rows.
- Command/file/tool activity appears as compact operation cards.
- Consecutive command/file operation updates show only the latest operation card unless normal visible content appears between two operations.
- The composer supports per-message model and reasoning effort selectors.
- The composer shows 5-hour and weekly quota remaining when app-server sends rate-limit updates.
- The send button follows Codex Desktop behavior: empty composer during an active turn shows `Stop`; typed text or attachments switch it back to `Send`.

## App-Server Bridge Design

Desktop live sync depends on making Codex Desktop and Mobile Web talk to the same `codex app-server` process.

The bridge is implemented by `codex-app-server-mux.js`:

1. Codex Desktop is launched with an app-server command override.
2. That override starts the mux process instead of starting `codex app-server` directly.
3. The mux starts the real `codex app-server` as a child process over stdio.
4. Codex Desktop stays connected to the mux over stdio.
5. The mux also opens a loopback JSONL TCP server for Mobile Web.
6. The mux writes an endpoint file under the Codex state directory:

```text
<CODEX_HOME>/app-server-mux/endpoint.json
```

7. Mobile Web detects that endpoint file and connects to the same mux-backed app-server stream.

The mux must keep stdout clean because stdout is the Desktop app-server protocol channel. Diagnostics are written to the mux log file instead.

## Windows Desktop Live Sync

Status: implemented and verified.

Codex Desktop normally starts its own `codex app-server` over stdio. If Mobile Web starts a separate app-server, both clients can read durable `.codex` state, but live UI streams will not fully converge.

For live sync on Windows, use the optional mux launcher:

1. Fully quit Codex Desktop.
2. Start Desktop through the shared launcher:

```powershell
cd C:\path\to\codex-mobile-web
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1
```

3. Start or reconnect Mobile Web.

The launcher sets `CODEX_CLI_PATH` only for the Desktop process it starts. It builds `codex-app-server-mux.exe` from `codex-app-server-mux-shim.cs` when needed, because Windows Codex Desktop expects `CODEX_CLI_PATH` to point to a real `.exe`.

The mux writes its endpoint file here:

```text
%USERPROFILE%\.codex\app-server-mux\endpoint.json
```

Mobile Web auto-detects that endpoint. If Mobile Web was already running before the mux was available, restart Mobile Web or call:

```text
POST /api/app-server/reconnect
```

Do not reconnect while a separate managed-child turn is still running unless you intend to abandon that child connection.

## macOS Desktop Live Sync

Status: design documented, not yet packaged or verified on macOS.

Standalone Mobile Web can run on macOS. The bridge core, `codex-app-server-mux.js`, is Node.js and should be portable. The missing part is a macOS launcher/shim that makes Codex Desktop start the mux as its app-server command.

Current limitations:

- `start-codex-desktop-shared.ps1` is Windows-specific.
- `codex-app-server-mux-shim.cs` builds a Windows `.exe`.
- macOS Codex Desktop launch behavior with `CODEX_CLI_PATH` still needs verification.
- It is not yet verified whether macOS Codex Desktop accepts a shell script as `CODEX_CLI_PATH` or requires a native executable shim.

### macOS Bridge Implementation Plan

A Codex agent implementing macOS Desktop live sync should create and test a macOS equivalent of the Windows launcher.

Required behavior:

- Fully quit Codex Desktop before launch.
- Set `CODEX_HOME="$HOME/.codex"` explicitly.
- Set `CODEX_CLI_PATH` to a real executable wrapper that starts the mux.
- Set `CODEX_MUX_SCRIPT_PATH` to this repo's `codex-app-server-mux.js`.
- Set `CODEX_MUX_CODEX_EXE` to the real `codex` CLI path.
- Optionally set `CODEX_MUX_NODE_EXE` to the real `node` path.
- Launch Codex Desktop from that same environment.
- Do not write anything to stdout before `node codex-app-server-mux.js` takes over, because stdout is the app-server JSONL protocol channel.
- Pass all Desktop-supplied app-server arguments through to the mux wrapper.

Candidate wrapper script:

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT="${CODEX_MUX_SCRIPT_PATH:?CODEX_MUX_SCRIPT_PATH is required}"
NODE_BIN="${CODEX_MUX_NODE_EXE:-node}"

exec "$NODE_BIN" "$SCRIPT" "$@"
```

Save it outside `.codex` runtime state, for example:

```bash
cat > ./codex-app-server-mux-macos.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT="${CODEX_MUX_SCRIPT_PATH:?CODEX_MUX_SCRIPT_PATH is required}"
NODE_BIN="${CODEX_MUX_NODE_EXE:-node}"
exec "$NODE_BIN" "$SCRIPT" "$@"
EOF
chmod +x ./codex-app-server-mux-macos.sh
```

Candidate launch command:

```bash
cd /path/to/codex-mobile-web

export CODEX_HOME="$HOME/.codex"
export CODEX_CLI_PATH="$PWD/codex-app-server-mux-macos.sh"
export CODEX_MUX_SCRIPT_PATH="$PWD/codex-app-server-mux.js"
export CODEX_MUX_CODEX_EXE="$(command -v codex)"
export CODEX_MUX_NODE_EXE="$(command -v node)"

# The exact app path may differ. Verify it on the target Mac.
"/Applications/Codex.app/Contents/MacOS/Codex"
```

If Codex Desktop does not inherit environment variables through the chosen launch method, launch the executable directly instead of using Finder. If a shell script fails as `CODEX_CLI_PATH`, build a tiny native macOS executable shim that execs:

```bash
node "$CODEX_MUX_SCRIPT_PATH" "$@"
```

The native shim must preserve stdin/stdout/stderr and pass arguments unchanged.

### macOS Bridge Verification Checklist

After launching Desktop with the candidate wrapper:

1. Confirm the mux endpoint file exists:

```bash
cat "$HOME/.codex/app-server-mux/endpoint.json"
```

Expected shape:

```json
{
  "protocol": "jsonl-tcp",
  "host": "127.0.0.1",
  "port": 12345,
  "pid": 111,
  "childPid": 222,
  "capabilities": {
    "mobileUserMessageEcho": true
  }
}
```

2. Confirm the mux log exists and does not show fatal startup errors:

```bash
tail -100 "$HOME/.codex/app-server-mux/mux.log"
```

3. Start Mobile Web:

```bash
cd /path/to/codex-mobile-web
export CODEX_HOME="$HOME/.codex"
export CODEX_MOBILE_HOST="0.0.0.0"
export CODEX_MOBILE_PORT="8787"
npm start
```

4. Open `/api/status` through the authenticated UI and verify the transport is `external-jsonl-tcp`.

5. Start a test turn from Desktop and watch Mobile Web receive live updates.

6. Send a mid-turn message from Mobile Web and verify Desktop shows the user message and subsequent Codex output in the same active turn.

7. Quit Desktop and confirm the mux shuts down or cleans up the endpoint file when expected.

Until this checklist passes on a real Mac, macOS Desktop live sync should be treated as unverified.

### Standalone Mux On macOS

A Mac user can still try standalone mux mode for Mobile Web only:

```bash
cd /path/to/codex-mobile-web
export CODEX_HOME="$HOME/.codex"
export CODEX_MUX_STANDALONE=1
node codex-app-server-mux.js
```

Then start Mobile Web in another terminal:

```bash
cd /path/to/codex-mobile-web
export CODEX_HOME="$HOME/.codex"
export CODEX_MOBILE_HOST="0.0.0.0"
export CODEX_MOBILE_PORT="8787"
npm start
```

This can let Mobile Web connect to the mux endpoint, but it does not by itself make Codex Desktop share that mux.

## Useful Environment Variables

| Variable | Purpose |
| --- | --- |
| `CODEX_HOME` | Codex state directory. Defaults to user home `.codex` in `server.js`; set explicitly on macOS for mux usage. |
| `CODEX_MOBILE_HOST` | Web server bind host. Use `0.0.0.0` for phone access. |
| `CODEX_MOBILE_PORT` | Web server port, default `8787`. |
| `CODEX_MOBILE_CODEX_EXE` | Codex CLI executable path/name. |
| `CODEX_MOBILE_KEY` | Inline web access key. |
| `CODEX_MOBILE_KEY_FILE` | Custom access-key file path. |
| `CODEX_MOBILE_DISABLE_AUTH` | Disable auth when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_UPLOAD_DIR` | Upload storage directory. |
| `CODEX_MOBILE_MAX_UPLOAD_BYTES` | Max total upload bytes per message. |
| `CODEX_MOBILE_MAX_UPLOAD_FILES` | Max files per message. |
| `CODEX_MOBILE_THREAD_TURNS` | Number of recent turns returned to the phone, default `12`. |
| `CODEX_MOBILE_MUX_ENDPOINT_FILE` | Custom mux endpoint file path. |
| `CODEX_MOBILE_APP_SERVER_WS` | External app-server WebSocket endpoint. |
| `CODEX_MOBILE_APP_SERVER_TCP` | External app-server JSONL TCP endpoint. |
| `CODEX_CLI_PATH` | Desktop-side override used to make Codex Desktop launch the mux instead of the normal Codex CLI/app-server command. Windows path must be a real `.exe`; macOS behavior is unverified. |
| `CODEX_MUX_SCRIPT_PATH` | Path to `codex-app-server-mux.js` for shim/wrapper launchers. |
| `CODEX_MUX_CODEX_EXE` | Real Codex CLI executable used by the mux to start the real app-server. |
| `CODEX_MUX_NODE_EXE` | Optional explicit Node executable for shim/wrapper launchers. |
| `CODEX_MUX_STANDALONE` | Start mux without attaching stdin/stdout Desktop client when set to `1`, useful for Mobile Web-only mux testing. |
| `CODEX_MUX_ENDPOINT_FILE` | Custom mux endpoint file path. |
| `CODEX_MUX_CODEX_ARGS` | Override real Codex app-server arguments. When unset, Desktop-supplied arguments are passed through, otherwise the mux falls back to `app-server --analytics-default-enabled`. |

## Safety Notes

- Do not commit `.codex`, `.codex-mobile-web`, access keys, uploaded files, logs, or local binaries.
- Do not bind to `0.0.0.0` on an untrusted network unless auth is enabled and the network exposure is intentional.
- Do not expose this server directly to the public internet.
- Do not patch a system Codex Desktop installation. Use reversible launchers or environment variables.
- Treat uploaded files as local runtime data; non-image uploads are referenced by absolute local path.

## For Codex Agents Working In This Repo

When a user asks you to operate this repository after cloning it:

1. Read `README.md` first.
2. Check the platform with `uname -a` on macOS/Linux or `$PSVersionTable` / `Get-ComputerInfo` on Windows.
3. Check Node and Codex:

```bash
node --version
codex --version
```

4. Run:

```bash
npm run check
```

5. Start with the platform-specific command above.
6. If the user asks for Desktop live sync:
   - On Windows, use `start-codex-desktop-shared.ps1` after fully quitting Codex Desktop.
   - On macOS, follow the `macOS Bridge Implementation Plan` above and state that the Desktop bridge is not verified until the checklist passes on a real Mac.

If you create local agent handoff/context files while working on this repo, keep them local. `.agent-context/` is intentionally ignored in the release repository.
