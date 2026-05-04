# PROJECT_CONTEXT

## Project

This workspace owns the standalone Codex Mobile Web app.

- Workspace path: `C:\Users\xuxin\Documents\codex-mobile-web`
- App source root: this repository root
- Public UI: `public/`
- Main server: `server.js`
- Startup script: `start-codex-mobile-web.ps1`
- Optional app-server mux: `codex-app-server-mux.js`
- Clean public release repository: `https://github.com/pentiumxp/codex-mobile-web-public`
- Clean public release local path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Current LAN URL: `http://192.168.10.108:8787`

## Runtime State

- Codex desktop state is read from `%USERPROFILE%\.codex`.
- Mobile Web runtime state lives under `%USERPROFILE%\.codex-mobile-web`.
- Access key file: `%USERPROFILE%\.codex-mobile-web\access_key`
- Access key generation: `server.js` first uses `CODEX_MOBILE_KEY`, then `CODEX_MOBILE_KEY_FILE` / default `access_key`; if no key file exists it creates an 18-random-byte `base64url` key and writes it to the runtime key file.
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
- `start-codex-desktop-shared.ps1` is the reversible Desktop launcher for that bridge; it builds the shim exe from `codex-app-server-mux-shim.cs` when needed, sets `CODEX_CLI_PATH` only for the launched Desktop process, and defaults `CODEX_MUX_KEEP_ALIVE=1`.
- With `CODEX_MUX_KEEP_ALIVE=1`, the mux remains alive after Desktop stdio disconnects; a later Desktop launch through the same wrapper attaches back to the existing mux endpoint instead of starting a second real app-server.
- When bridge code changes, normal Desktop restarts may attach back to the old keep-alive mux. Use `start-codex-desktop-shared.ps1 -ForceRestartMux` to stop the mux PID recorded in the endpoint file and start a fresh mux from current files.
- The mux proxies app-server server requests, including command, file-change, and permission approvals, so Mobile Web can display approval controls and answer them through the same shared stream.
- The mux keeps a bounded replay buffer for recent app-server `turn/*`, `item/*`, `thread/*`, and rate-limit notifications. By default this historical notification replay is sent only to Mobile Web clients after `initialize`; Desktop relies on its own durable thread read to avoid old incremental notifications rolling back the foreground UI. Unresolved approval/server requests are replayed to all clients. `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=1` can opt Desktop back into notification replay for diagnostics.
- The mux treats TCP write backpressure as a normal `drain` condition and must not disconnect Desktop/Mobile Web just because one `socket.write()` returns `false`.
- Mobile Web treats a detected mux/shared endpoint as required for that process lifetime. If the shared endpoint disconnects or becomes unavailable, Mobile Web reports the shared app-server error instead of falling back to a managed child and creating a divergent stream.
- `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1` forces the same no-fallback behavior even when Mobile Web starts before any mux endpoint file exists.
- README documents the app-server bridge as implemented and verified on Windows; macOS Desktop bridge support is documented as an implementation plan only and remains unverified until tested on a real Mac.
- When Mobile Web connects to an already-initialized shared app-server through mux, `initialize` may return `Already initialized`; this is valid for the second client and should be treated as a usable shared connection.
- When Mobile Web sends extra input while a turn is already active, the browser posts the active turn id and `server.js` should use app-server `turn/steer` with `expectedTurnId` so Desktop and Mobile stay on the same active turn stream. After a successful `turn/steer`, `server.js` should also emit a deterministic mux-local `mux/userMessage` echo keyed by `clientSubmissionId`, because current app-server builds can accept the steering request without replaying a visible user-message item.
- For new turns and explicit thread resumes, `server.js` should read the thread's latest rollout `turn_context` plus `state_5.sqlite` metadata and forward inherited approval policy, sandbox policy, reasoning summary, and configured verbosity where the app-server protocol supports those fields.
- When the inherited runtime is full access (`danger-full-access` sandbox or root-write permission profile), Mobile Web normalizes missing/`on-request` approval policy to `never` for new turns, because persisted Desktop thread metadata can otherwise represent full filesystem access while still asking for command approval.
- Message submission is idempotent in the Mobile Web server. The browser sends `clientSubmissionId`, and `server.js` deduplicates modern clients by that id only. Content-fingerprint dedupe is retained only for legacy/no-id requests, so intentional repeated short messages are not suppressed.
- Windows Codex Desktop runs its own stdio app-server unless launched through the shared mux path.

## Product Rules

- Mobile rendering is interaction-first.
- Historical command/tool/file-change payloads are hidden.
- Only the latest turn's latest live operation can render as a compact status card.
- If app-server `thread/read` omits operation items, Mobile Web may synthesize one compact latest operation card from the thread rollout JSONL tail (`exec_command_end`, `patch_apply_end`, `function_call`, `custom_tool_call`, or Web Search events), without command output or diffs.
- Live operation cards stay in source order within the turn; newer normal content renders below them. Consecutive operation updates should show only the latest operation card. At most one older visible operation card may be retained only when visible non-operation content has arrived after it, so a later operation can appear in the newer content segment without stacking consecutive command/file cards.
- File-change cards show compact file names only, not diffs or full change payloads.
- Web Search items are rendered as compact live operation cards like command/tool calls, not expanded structured payloads.
- Reasoning items are not rendered in the conversation and reasoning deltas must not remove or replace live command/file/tool operation cards.
- Conversation rendering uses a visible-content signature and a lightweight keyed DOM patcher to avoid replacing the whole conversation when polling/status refreshes only change local text, item status, or operation cards; this prevents no-op and broad refresh flicker.
- Thread refresh merges preserve synthetic `mux-user-*` user-message echo items when the app-server historical snapshot does not contain them, because active-turn `turn/steer` input can otherwise disappear from the visible stream after a refresh.
- Turn completion and thread refresh merges must not replace locally streamed visible turn items with an empty or shorter server snapshot; preserve local visible items until an equal or fuller snapshot arrives.
- Uploaded images are sent as app-server `localImage` input items.
- Uploaded non-image files are saved locally and referenced in message text by absolute path.
- Uploaded files under `%USERPROFILE%\.codex-mobile-web\uploads` can be served back to the authenticated browser through `/api/uploads/file?path=<absolute-upload-path>`; the server must only allow paths inside the upload root.
- User message rendering must show image input parts as centered thumbnails, not full-width inline previews, and must never stringify full data-URL image payloads into the conversation. Current thumbnail cap is about `min(72vw, 320px)` wide and `240px` high.
- The composer exposes compact side-by-side per-message model and reasoning effort selectors; blank/default values follow the current thread or `%USERPROFILE%\.codex\config.toml`.
- The composer shows 5-hour and weekly quota remaining as one compact right-aligned numeric indicator next to the model/reasoning selectors after app-server emits `account/rateLimits/updated`; it displays `<5-hour remaining> | <weekly remaining>` from the matching 300-minute and 10080-minute windows.
- The model, reasoning, and quota controls should stay on one line while keeping the model/reasoning selectors readable; the quota column must not starve the reasoning selector width.
- When no thread is selected, the main pane lists recent workspaces and recent threads as shortcuts.
- Thread detail reads prefer app-server `thread/turns/list` plus local `state_5.sqlite` metadata instead of `thread/read includeTurns:true`, because large historical rollouts can make `thread/read` several seconds slower.
- Thread switching in the browser uses request sequencing and cancels the previous detail fetch so stale slow responses cannot overwrite the current selection.
- Thread-list refreshes also use request sequencing and cancel older list requests; loading placeholders must reset the thread-list render signature so an unchanged result can still repaint over the placeholder.
- Workspace changes clear the current thread through the shared selection reset path, abort pending thread detail loads, and render the home/workspace shortcut view before the new list returns.
- Mobile foreground recovery uses `visibilitychange`, `pageshow`, `focus`, and `orientationchange` to re-show the app shell, reconnect SSE if needed, and refresh current thread state after returning from external permission/input-method screens.
- Mobile foreground visual recovery also maintains a JS-driven `--app-height` from `visualViewport` / `innerHeight` and forces several lightweight repaints after resume; this is needed because iOS can return from input-method/permission apps with a stale or blank composited viewport.
- Turns show a top-right elapsed timer formatted as `本轮 HH:MM:SS`; it updates while running, uses the active/red treatment during an in-progress turn, reverts to the settled muted treatment after completion, and keeps the status label out of the timer.
- During an active turn, the top-right timer may append one compact activity label such as `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, or `等待批准`. These labels come from live app-server events and must update only the timer text, not insert reasoning rows or force full conversation rerenders.
- Live reasoning does not render as a conversation row; the top-right turn timer provides the in-progress time signal.
- The top-right timer layout keeps the elapsed time segment fixed so activity label length changes do not move the `本轮 HH:MM:SS` text.
- After the latest turn ends, the top-right timer shows the final elapsed time with `已结束` instead of retaining any in-progress activity label.
- The top conversation bar is intentionally compact: it shows the thread title, but not cwd or thread status metadata.
- The composer submit button follows Desktop behavior: during an active turn, an empty composer shows `Stop`; if text or attachments are present it switches back to `Send` for the new input.
- App-server approval requests render as pending approval cards in the current thread and support `Allow once`, `Allow session`, and `Deny` for command, file-change, legacy exec/apply-patch, and permission-profile requests.
- Approval requests with a `turnId` render inside that turn instead of as a persistent bottom stack. Once answered/resolved, they collapse to a one-line in-turn status.
- The composer must not programmatically focus the message input after send, thread switch, refresh, or mobile foreground recovery; mobile keyboards/input methods should open only after the user explicitly taps the message input.
- The message composer uses a `contenteditable` textbox instead of a native `textarea` to reduce iOS browser input accessory toolbar space. Enter sends the message; Shift+Enter inserts a line break.
- The composer attachment button should be a real file-picker label/input on mobile; do not rely only on calling `.click()` on a fully hidden file input.
- Message entry and live operation removal use short motion transitions.
- Automatic scroll-to-bottom uses immediate scroll positioning rather than smooth scrolling, to avoid visible whole-conversation up/down motion during no-op or near-no-op refreshes.
- Context compaction renders as the single Chinese notice `历史上下文已压缩`.
- Thread lists hide archived/deleted/removed sessions and sessions outside Codex Desktop visible workspace roots.
- Weak-network recovery may use `state_5.sqlite` metadata fallback, but should not resurface archived/deleted/old-workspace sessions.

## Safety

- Do not patch the WindowsApps Codex installation.
- Do not replace Codex Desktop's startup command unless explicitly requested and tested through a reversible path.
- Prefer the reversible `start-codex-desktop-shared.ps1` launcher over persistent system environment changes for Desktop/Web live sync.
- Keep `.codex` state read-only except through app-server RPCs.
- Keep raw access keys out of Git and out of `.agent-context`.
