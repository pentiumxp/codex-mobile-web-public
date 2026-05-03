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
- Uploaded attachment storage: `%USERPROFILE%\.codex-mobile-web\uploads`
- Raw access keys and binaries are local runtime state and must not be committed.
- Uploaded attachment contents are local runtime state and must not be committed.

## Architecture

- The web server binds to `CODEX_MOBILE_HOST` / `CODEX_MOBILE_PORT`, default `0.0.0.0:8787`.
- The browser authenticates with the access key, then receives live updates through Server-Sent Events.
- The composer can upload attachments through multipart form posts.
- The backend talks to `codex app-server` through JSON-RPC over WebSocket or local JSONL TCP.
- By default the backend starts a loopback `codex app-server --listen ws://127.0.0.1:<port>` child.
- If `CODEX_MOBILE_APP_SERVER_WS`, `CODEX_MOBILE_APP_SERVER_TCP`, or `%USERPROFILE%\.codex\app-server-mux\endpoint.json` is available, the backend can use an external/shared endpoint instead.
- `codex-app-server-mux.js` can act as the shared bridge: Desktop launches generated `codex-app-server-mux.exe` via `CODEX_CLI_PATH`, the shim starts `node codex-app-server-mux.js`, the mux starts the real app-server over stdio, and Mobile Web connects to the mux endpoint file.
- `start-codex-desktop-shared.ps1` is the reversible Desktop launcher for that bridge; it builds the shim exe from `codex-app-server-mux-shim.cs` when needed and sets `CODEX_CLI_PATH` only for the launched Desktop process.
- When Mobile Web connects to an already-initialized shared app-server through mux, `initialize` may return `Already initialized`; this is valid for the second client and should be treated as a usable shared connection.
- When Mobile Web sends extra input while a turn is already active, the browser posts the active turn id and `server.js` can emit a mux-local `mux/userMessage` notification. `codex-app-server-mux.js` converts that into an `item/completed` `userMessage` broadcast so Codex Desktop can render the user's mid-turn Web App input live. `server.js` only sends this extension when the mux endpoint advertises `capabilities.mobileUserMessageEcho=true`, so old running mux processes must be restarted before the fix activates.
- Windows Codex Desktop runs its own stdio app-server unless launched through the shared mux path.

## Product Rules

- Mobile rendering is interaction-first.
- Historical command/tool/file-change payloads are hidden.
- Only the latest turn's latest live operation can render as a compact status card.
- If app-server `thread/read` omits operation items, Mobile Web may synthesize one compact latest operation card from the thread rollout JSONL tail (`exec_command_end`, `patch_apply_end`, `function_call`, `custom_tool_call`, or Web Search events), without command output or diffs.
- Live operation cards stay in source order within the turn; newer normal content renders below them, and when a newer operation arrives older operation cards are removed.
- File-change cards show compact file names only, not diffs or full change payloads.
- Web Search items are rendered as compact live operation cards like command/tool calls, not expanded structured payloads.
- Reasoning items are not rendered in the conversation and reasoning deltas must not remove or replace live command/file/tool operation cards.
- Conversation rendering uses a visible-content signature and a lightweight keyed DOM patcher to avoid replacing the whole conversation when polling/status refreshes only change local text, item status, or operation cards; this prevents no-op and broad refresh flicker.
- Turn completion and thread refresh merges must not replace locally streamed visible turn items with an empty or shorter server snapshot; preserve local visible items until an equal or fuller snapshot arrives.
- Uploaded images are sent as app-server `localImage` input items.
- Uploaded non-image files are saved locally and referenced in message text by absolute path.
- Uploaded files under `%USERPROFILE%\.codex-mobile-web\uploads` can be served back to the authenticated browser through `/api/uploads/file?path=<absolute-upload-path>`; the server must only allow paths inside the upload root.
- User message rendering must show image input parts as bounded thumbnails and must never stringify full data-URL image payloads into the conversation.
- The composer exposes compact side-by-side per-message model and reasoning effort selectors; blank/default values follow the current thread or `%USERPROFILE%\.codex\config.toml`.
- The composer shows 5-hour and weekly quota remaining as one compact right-aligned numeric indicator next to the model/reasoning selectors after app-server emits `account/rateLimits/updated`; it displays `<5-hour remaining> | <weekly remaining>` from the matching 300-minute and 10080-minute windows.
- The model, reasoning, and quota controls should stay on one line while keeping the model/reasoning selectors readable; the quota column must not starve the reasoning selector width.
- When no thread is selected, the main pane lists recent workspaces and recent threads as shortcuts.
- Thread detail reads prefer app-server `thread/turns/list` plus local `state_5.sqlite` metadata instead of `thread/read includeTurns:true`, because large historical rollouts can make `thread/read` several seconds slower.
- Thread switching in the browser uses request sequencing and cancels the previous detail fetch so stale slow responses cannot overwrite the current selection.
- Mobile foreground recovery uses `visibilitychange`, `pageshow`, `focus`, and `orientationchange` to re-show the app shell, reconnect SSE if needed, and refresh current thread state after returning from external permission/input-method screens.
- Turns show a top-right elapsed timer formatted as `本轮 HH:MM:SS`; it updates while running and keeps the status label out of the timer.
- Live reasoning does not render as a conversation row; the top-right turn timer provides the in-progress time signal.
- The top conversation bar is intentionally compact: it shows the thread title, but not cwd or thread status metadata.
- The composer submit button follows Desktop behavior: during an active turn, an empty composer shows `Stop`; if text or attachments are present it switches back to `Send` for the new input.
- The composer attachment button should be a real file-picker label/input on mobile; do not rely only on calling `.click()` on a fully hidden file input.
- Message entry, smooth scroll-to-bottom, and live operation removal use short motion transitions.
- Context compaction renders as the single Chinese notice `历史上下文已压缩`.
- Thread lists hide archived/deleted/removed sessions and sessions outside Codex Desktop visible workspace roots.
- Weak-network recovery may use `state_5.sqlite` metadata fallback, but should not resurface archived/deleted/old-workspace sessions.

## Safety

- Do not patch the WindowsApps Codex installation.
- Do not replace Codex Desktop's startup command unless explicitly requested and tested through a reversible path.
- Prefer the reversible `start-codex-desktop-shared.ps1` launcher over persistent system environment changes for Desktop/Web live sync.
- Keep `.codex` state read-only except through app-server RPCs.
- Keep raw access keys out of Git and out of `.agent-context`.
