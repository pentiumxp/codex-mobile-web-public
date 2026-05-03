# PROJECT_CONTEXT

## Project

This workspace owns the standalone Codex Mobile Web app.

- Workspace path: `C:\Users\xuxin\Documents\codex-mobile-web`
- App source root: this repository root
- Public UI: `public/`
- Main server: `server.js`
- Startup script: `start-codex-mobile-web.ps1`
- Optional app-server mux: `codex-app-server-mux.js`
- Current LAN URL: `http://192.168.10.108:8787`

## Runtime State

- Codex desktop state is read from `%USERPROFILE%\.codex`.
- Mobile Web runtime state lives under `%USERPROFILE%\.codex-mobile-web`.
- Access key file: `%USERPROFILE%\.codex-mobile-web\access_key`
- Local Codex executable copy: `%USERPROFILE%\.codex-mobile-web\codex.exe`
- Raw access keys and binaries are local runtime state and must not be committed.

## Architecture

- The web server binds to `CODEX_MOBILE_HOST` / `CODEX_MOBILE_PORT`, default `0.0.0.0:8787`.
- The browser authenticates with the access key, then receives live updates through Server-Sent Events.
- The backend talks to `codex app-server` through JSON-RPC over WebSocket or local JSONL TCP.
- By default the backend starts a loopback `codex app-server --listen ws://127.0.0.1:<port>` child.
- If `CODEX_MOBILE_APP_SERVER_WS`, `CODEX_MOBILE_APP_SERVER_TCP`, or `%USERPROFILE%\.codex\app-server-mux\endpoint.json` is available, the backend can use an external/shared endpoint instead.
- Windows Codex Desktop currently runs its own stdio app-server and is not modified by this project.

## Product Rules

- Mobile rendering is interaction-first.
- Historical command/tool/file-change payloads are hidden.
- Only the latest turn's trailing live operation can render as a compact status card.
- When newer normal content arrives, old operation cards are removed.
- File-change cards show compact file names only, not diffs or full change payloads.
- Context compaction renders as the single Chinese notice `历史上下文已压缩`.
- Thread lists hide archived/deleted/removed sessions and sessions outside Codex Desktop visible workspace roots.
- Weak-network recovery may use `state_5.sqlite` metadata fallback, but should not resurface archived/deleted/old-workspace sessions.

## Safety

- Do not patch the WindowsApps Codex installation.
- Do not replace Codex Desktop's startup command unless explicitly requested and tested through a reversible path.
- Keep `.codex` state read-only except through app-server RPCs.
- Keep raw access keys out of Git and out of `.agent-context`.
