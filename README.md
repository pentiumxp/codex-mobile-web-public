# Codex Mobile Web

Local mobile web client for Codex Desktop state and live app-server control.

## Start

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\xuxin\Documents\codex-mobile-web\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787
```

Open from the machine:

```text
http://127.0.0.1:8787
```

Open from phone on the same LAN or Tailscale route:

```text
http://192.168.10.108:8787
```

## Authentication

By default the server requires the access key from `CODEX_MOBILE_KEY`, or from `%USERPROFILE%\.codex-mobile-web\access_key` if the env var is not set.
After a successful login, the browser keeps the key in localStorage and in a one-year cookie, so normal reloads should not ask again.

The access key is runtime state and must not be committed to Git.

Disable auth only for isolated testing:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -NoAuth
```

## Uploads

The composer supports attaching images and files.

- Uploaded files are stored under `%USERPROFILE%\.codex-mobile-web\uploads` by default.
- Override the upload directory with `CODEX_MOBILE_UPLOAD_DIR`.
- Override total upload size per message with `CODEX_MOBILE_MAX_UPLOAD_BYTES`, default `67108864`.
- Override attachment count per message with `CODEX_MOBILE_MAX_UPLOAD_FILES`, default `12`.
- Images are sent to Codex as `localImage` input items.
- Non-image files are referenced in the message text by absolute local path so Codex can read them through normal file access.

Uploaded file contents are runtime state and must not be committed to Git.

## Architecture

- Public web server binds to `CODEX_MOBILE_HOST` / `CODEX_MOBILE_PORT`.
- Backend first looks for an optional shared app-server endpoint at `CODEX_MOBILE_MUX_ENDPOINT_FILE`.
- If no shared endpoint is available, backend starts `codex app-server` on `127.0.0.1` with a random port.
- The startup script prefers `%USERPROFILE%\.codex-mobile-web\codex.exe` when present, then falls back to `codex`.
- Backend talks to Codex through JSON-RPC over WebSocket or local JSONL TCP.
- Browser receives live updates through Server-Sent Events.
- No npm dependencies are required.

## Optional App-Server Multiplexer

The multiplexer is an opt-in local proxy. It starts one real `codex app-server` over stdio and exposes a loopback-only JSONL TCP endpoint for the mobile web backend.

Start it standalone:

```powershell
$env:CODEX_MUX_STANDALONE = "1"
node C:\Users\xuxin\Documents\codex-mobile-web\codex-app-server-mux.js
```

Then start the web server normally. It will auto-detect:

```text
C:\Users\xuxin\.codex\app-server-mux\endpoint.json
```

This does not modify Codex Desktop. Desktop sharing would require the desktop app to launch the mux as its app-server command, which should only be tested with a reversible config or shortcut. Do not patch the WindowsApps install directory or replace the bundled Codex binary.

## Mobile Output Limits

Raw command/tool output can be very large. The mobile UI intentionally shows bounded previews:

- only the latest `CODEX_MOBILE_THREAD_TURNS` turns are returned to the phone, default `12`
- command, tool, and file-change items are removed from the mobile conversation payload
- the current running command/tool/file operation may appear as one temporary status row with command/file names only
- live reasoning is shown as a timer row instead of streaming reasoning text
- command output deltas are not forwarded to the browser

The original Codex rollout history remains in `C:\Users\xuxin\.codex\sessions\...`; these limits only protect the phone view.

## Desktop App Sync Limitation

The Windows Codex desktop app runs its own `codex app-server` over `stdio://` unless explicitly configured otherwise. The standalone mobile web server and standalone mux do not change that desktop launch path. Both use the same `.codex` durable state, but an already-open desktop Codex window may not live-update to show mobile-started turns until the desktop app is deliberately moved to the shared mux path.
