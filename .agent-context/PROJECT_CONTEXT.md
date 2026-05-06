# PROJECT_CONTEXT

## Project

This workspace owns the standalone Codex Mobile Web app.

- Workspace path: `C:\Users\xuxin\Documents\codex-mobile-web`
- App source root: this repository root
- Public UI: `public/`
- Main server: `server.js`
- Startup script: `start-codex-mobile-web.ps1`
- Windows hidden startup scripts: `start-codex-mobile-web-hidden.vbs`, `start-codex-mobile-web-windowless.ps1`, `install-codex-mobile-web-startup.ps1`, `uninstall-codex-mobile-web-startup.ps1`
- Optional app-server mux: `codex-app-server-mux.js`
- Clean public release repository: `https://github.com/pentiumxp/codex-mobile-web-public`
- Clean public release local path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Public release rule: every public-repo commit must include a detailed README update, especially a Chinese explanation of the user-visible change, usage impact, and operational notes. Public sync is incomplete if code changes are pushed without updating the public README's Chinese documentation.
- Public commit-message rule: public-repo commit messages must be detailed and must explain what changed since the previous public commit. Do not use only a one-line title for public commits; include concrete changed areas, behavior/documentation impact, and validation or operational notes when relevant.
- Public release timing rule: do not update, sync, commit, or push `C:\Users\xuxin\Documents\codex-mobile-web-public` until the user has tested the private build and explicitly instructs a public update.
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
- Current Windows startup mode is an interactive-logon Scheduled Task named `Codex Mobile Web` running as `GMK\xuxin` (`LogonType=Interactive`, `RunLevel=Limited`). This is required when Codex tool calls need WSL access, because WSL returns `WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED` from `LocalSystem`.
- `install-codex-mobile-web-startup.ps1 -RunNow` now defaults to a no-window user-logon task. It runs through `wscript.exe start-codex-mobile-web-hidden.vbs`, so the user-mode task does not show a console window. Use `-UserId <domain\user> -UserProfilePath C:\Users\<user>` when installing from another account or SYSTEM/elevated automation context.
- `-RunAsSystem` remains available only as an explicit optional mode for startup before user logon or survival after sign-out, but that mode cannot launch WSL distributions.
- The windowless startup wrapper is a small supervisor: if the 8787 Node listener exits, it waits briefly and restarts it while reusing the existing mux endpoint. It sets `HOME`, `HOMEDRIVE`, `HOMEPATH`, `CODEX_HOME`, and `CODEX_MOBILE_RUNTIME_DIR` for the target Windows user profile. Under the optional SYSTEM task it also injects process-local Git `safe.directory` entries for the user's Documents tree and Codex runtime dirs so user-owned repos do not fail with dubious ownership inside Codex tool runs.
- The Windows startup task defaults to `-EnsureStandaloneMux -RequireSharedAppServer`, preserving the single shared app-server stream while avoiding a silent managed app-server fallback. It starts a standalone mux endpoint when no live mux endpoint exists, and Codex Desktop can later attach to that endpoint through `start-codex-desktop-shared.ps1`. Use `-AllowManagedFallback` only for intentional standalone Mobile Web operation.
- Current Tailscale HTTPS mapping is `https://gmk.tail62e8ce.ts.net:8443/ -> http://127.0.0.1:8787`.
- The browser authenticates with the access key, then receives live updates through Server-Sent Events.
- Web Push support stores VAPID keys in `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json` and subscriptions in `%USERPROFILE%\.codex-mobile-web\web-push-subscriptions.json`; neither file should be committed or copied into shared context. The browser must access Codex Mobile Web through HTTPS, currently Tailscale Serve `https://gmk.tail62e8ce.ts.net:8443/`, to subscribe. The VAPID subject must be a non-localhost contact URI; Apple Push rejects localhost subjects with `BadJwtToken`.
- Web Push turn-completed notifications use the completed thread title as the notification title and include `This turn 已结束 · <local time>` in the body. They bind `turn/started` metadata by turn id and reuse that thread id/title on `turn/completed`, then include a `/?thread=<threadId>` target URL. Notification clicks should focus/open Mobile Web and load that thread directly, even if it is not present in the first rendered thread list. The service worker also posts a `codex-open-thread` message to already-open Mobile Web windows so iOS/PWA notification clicks do not depend on full browser navigation.
- The composer can upload attachments through multipart form posts.
- The backend talks to `codex app-server` through JSON-RPC over WebSocket or local JSONL TCP.
- By default the backend starts a loopback `codex app-server --listen ws://127.0.0.1:<port>` child.
- If `CODEX_MOBILE_APP_SERVER_WS`, `CODEX_MOBILE_APP_SERVER_TCP`, or `%USERPROFILE%\.codex\app-server-mux\endpoint.json` is available, the backend can use an external/shared endpoint instead.
- `codex-app-server-mux.js` can act as the shared bridge: Desktop launches generated `codex-app-server-mux.exe` via `CODEX_CLI_PATH`, the shim starts `node codex-app-server-mux.js`, the mux starts the real app-server over stdio, and Mobile Web connects to the mux endpoint file.
- `start-codex-desktop-shared.ps1` is the reversible Desktop launcher for that bridge; it builds the shim exe from `codex-app-server-mux-shim.cs` when needed, sets `CODEX_CLI_PATH` only for the launched Desktop process, and defaults `CODEX_MUX_KEEP_ALIVE=1`.
- With `CODEX_MUX_KEEP_ALIVE=1`, the mux remains alive after Desktop stdio disconnects; a later Desktop launch through the same wrapper attaches back to the existing mux endpoint instead of starting a second real app-server.
- Current app-server mux endpoint was moved to user mode on 2026-05-06: endpoint file `%USERPROFILE%\.codex\app-server-mux\endpoint.json` points to a mux and child `codex.exe app-server` owned by `GMK\xuxin`. Old already-connected SYSTEM app-server processes may remain until their existing Desktop/session clients exit, but new Mobile Web connections and later Desktop shared launches should use the user-owned endpoint.
- When bridge code changes, normal Desktop restarts may attach back to the old keep-alive mux. Use `start-codex-desktop-shared.ps1 -ForceRestartMux` to stop the mux PID recorded in the endpoint file and start a fresh mux from current files.
- The mux proxies app-server server requests, including command, file-change, and permission approvals, so Mobile Web can display approval controls and answer them through the same shared stream.
- The mux keeps a bounded replay buffer for recent app-server `turn/*`, `item/*`, `thread/*`, and rate-limit notifications. By default this historical notification replay is sent only to Mobile Web clients after `initialize`; Desktop relies on its own durable thread read to avoid old incremental notifications rolling back the foreground UI. Unresolved approval/server requests are replayed to all clients. `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=1` can opt Desktop back into notification replay for diagnostics.
- For Mobile Web clients, the mux drops live command/file output deltas and reasoning text deltas, truncates very large string payloads, and stores the compacted notification in replay buffer. Desktop clients still receive live raw notifications; only replay is intentionally compacted by default.
- Mobile Web SSE clients pass their current `threadId` to `/api/events`. The server filters turn/item notifications to that thread, while still allowing status, rate-limit, and thread-list-level notifications through. The server also drops `turn/diff/*` notifications entirely because the mobile UI does not render diffs and large diff payloads can stall the browser before client-side thread filtering runs.
- The mux treats TCP write backpressure as a normal `drain` condition and must not disconnect Desktop/Mobile Web just because one `socket.write()` returns `false`.
- Mobile Web treats a detected mux/shared endpoint as required for that process lifetime. If the shared endpoint disconnects or becomes unavailable, Mobile Web reports the shared app-server error instead of falling back to a managed child and creating a divergent stream.
- `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1` forces the same no-fallback behavior even when Mobile Web starts before any mux endpoint file exists.
- README documents the app-server bridge as implemented and verified on Windows; macOS Desktop bridge support is documented as an implementation plan only and remains unverified until tested on a real Mac.
- When Mobile Web connects to an already-initialized shared app-server through mux, `initialize` may return `Already initialized`; this is valid for the second client and should be treated as a usable shared connection.
- When Mobile Web sends extra input while a turn is already active, the browser posts the active turn id and `server.js` should use app-server `turn/steer` with `expectedTurnId` so Desktop and Mobile stay on the same active turn stream. After a successful `turn/steer`, `server.js` should also emit a deterministic mux-local `mux/userMessage` echo keyed by `clientSubmissionId`, because current app-server builds can accept the steering request without replaying a visible user-message item.
- For new turns and explicit thread resumes, `server.js` should read the thread's latest rollout `turn_context` plus `state_5.sqlite` metadata and forward inherited approval policy, sandbox policy, reasoning summary, and configured verbosity where the app-server protocol supports those fields.
- When local SQLite metadata is unavailable under the optional SYSTEM startup task, runtime-setting lookup should reuse app-server thread summaries and scan large rollout files backward for the latest `turn_context`; large command/output lines can push the relevant context far beyond a small tail read.
- Runtime-setting lookup caches large rollout `turn_context` scan results briefly, keyed by rollout path, size, and mtime, to avoid repeated multi-hundred-MB backward scans during rapid refresh/send paths.
- Thread summaries and detail responses include rollout JSONL size metadata when the rollout file is available. The default warning threshold is `CODEX_MOBILE_ROLLOUT_WARNING_BYTES=104857600` (`100MB`).
- `POST /api/threads` is the rollout "压缩续接" action. With a source thread id, it first starts a source-thread handoff turn that must write `.agent-context/thread-handoffs/<id>.md` in the current workspace, waits for that file, waits briefly for the source turn to report completion, then starts the same-workspace continuation thread through `thread/start`, includes discovered `AGENTS.md` instructions as start-thread developer instructions, names the continuation from the source thread title plus a local `MM-DD` date suffix, sends a scoped bootstrap message, optionally archives the source thread after bootstrap succeeds, and returns the new thread id so the browser can switch directly.
- The rollout continuation bootstrap must carry enough detail for a fresh thread without injecting rules from unrelated threads: source thread id/title/cwd/rollout path/rollout size/status, inherited runtime settings, the source-thread-generated handoff file, recent visible source-turn summaries, `.agent-context/PROJECT_CONTEXT.md` excerpts, and `.agent-context/HANDOFF.md` latest tail. Fixed private/public/README/GitHub release reminders must not be hard-coded into every continuation; they should appear only when the current workspace context or the source-thread handoff explicitly says they are relevant.
- The browser should switch to the source thread before starting rollout continuation so the user can see the source-thread handoff turn while it runs. After the source handoff is written and the continuation thread is created, the browser should switch to the new continuation thread. A `thread/archived` event for the source thread during continuation must not clear the current detail view back to the home screen before that switch happens.
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
- If a real `userMessage` and a matching synthetic `mux-user-*` echo are both present, the real item wins and the mux echo must be dropped. This covers delayed mux notification replay after the real app-server item has already reached the browser.
- Thread refresh merges also treat matching ordinary `userMessage` items with different ids as the same visible input when they are in the same turn. This covers the case where a live local item and the later app-server snapshot have identical text or overlapping upload paths, preventing duplicate `You` cards in the browser while the durable app-server history still contains only one item.
- Turn completion and thread refresh merges must not replace locally streamed visible turn items with an empty or shorter server snapshot; preserve local visible items until an equal or fuller snapshot arrives.
- Uploaded images are sent as app-server `localImage` input items.
- Uploaded non-image files are saved locally and referenced in message text by absolute path.
- Uploaded files under `%USERPROFILE%\.codex-mobile-web\uploads` can be served back to the authenticated browser through `/api/uploads/file?path=<absolute-upload-path>`; the server must only allow paths inside the upload root.
- User message rendering must show image input parts as centered thumbnails, not full-width inline previews, and must never stringify full data-URL image payloads into the conversation. Current thumbnail cap is about `min(72vw, 320px)` wide and `240px` high.
- The composer exposes compact side-by-side per-message model, reasoning effort, and thread permission selectors; blank/default model and effort values follow the current thread or `%USERPROFILE%\.codex\config.toml`, while blank/default permission follows the current thread runtime settings.
- The composer permission selector sits after reasoning and before quota. It uses the same visible option names as Codex Desktop: `默认权限`, `自动审查`, `完全访问权限`, and `自定义 (config.toml)`. `完全访问权限` maps to full-access/no-approval; `默认权限` and `自动审查` map to workspace-write with approval prompts; `自定义 (config.toml)` applies the local config sandbox/approval setting when present.
- The composer shows 5-hour and weekly quota remaining as one compact right-aligned numeric indicator next to the model/reasoning selectors after app-server emits `account/rateLimits/updated`; it displays `<5-hour remaining> | <weekly remaining>` from the matching 300-minute and 10080-minute windows. Rate-limit updates are cached by model/limit id, and the UI should display the current selected/default model's quota instead of the most recent quota event from another model.
- The model, reasoning, permission, and quota controls should stay on one line while keeping the model/reasoning selectors readable; the quota column must not starve the reasoning selector width.
- When no thread is selected, the main pane lists recent workspaces and recent threads as shortcuts.
- Threads whose rollout JSONL reaches the configured warning threshold show a compact size warning in the thread list/home shortcuts and a current-thread banner with a same-workspace "压缩续接" action. The action must ask for confirmation because the confirmed flow creates a detailed continuation thread and archives the source thread after the new thread is materialized.
- Thread list rows also support proactive rollout continuation before the warning threshold: swipe a visible thread row left to reveal the same `压缩续接` action. The revealed action should remain open after the swipe until the user taps the card/action, opens another row, or the list refreshes. Touch devices use explicit touch handlers rather than relying only on Pointer Events, because iOS can emit `pointercancel` during horizontal row gestures.
- Thread detail reads prefer app-server `thread/turns/list` plus local `state_5.sqlite` metadata instead of `thread/read includeTurns:true`, because large historical rollouts can make `thread/read` several seconds slower.
- When Mobile Web runs under the optional Windows `LocalSystem` startup task, local `sqlite3` command discovery may differ from the interactive user environment. If `readStateDbThread()` cannot read a per-thread summary, the detail route must fall back to app-server `thread/list` to recover the thread `cwd` before applying visible-workspace filtering.
- Thread switching in the browser uses request sequencing and cancels the previous detail fetch so stale slow responses cannot overwrite the current selection.
- Thread-list refreshes also use request sequencing and cancel older list requests; loading placeholders must reset the thread-list render signature so an unchanged result can still repaint over the placeholder.
- Workspace changes clear the current thread through the shared selection reset path, abort pending thread detail loads, and render the home/workspace shortcut view before the new list returns.
- Mobile foreground recovery uses `visibilitychange`, `pageshow`, `focus`, and `orientationchange` to re-show the app shell, reconnect SSE if needed, and refresh current thread state after returning from external permission/input-method screens.
- Mobile foreground visual recovery also maintains a JS-driven `--app-height` from `visualViewport` / `innerHeight` and forces several lightweight repaints after resume; this is needed because iOS can return from input-method/permission apps with a stale or blank composited viewport. Input-method-specific returns that may not fire page-level focus/visibility events are covered by visual-only recovery pulses from `focusin`, `focusout`, `resize`, and `visualViewport` changes. Touch/pointer start must not trigger heavy repaint because it can cancel normal iOS scrolling.
- Turns show a top-right elapsed timer formatted as `本轮 HH:MM:SS`; it updates while running, uses the active/red treatment during an in-progress turn, reverts to the settled muted treatment after completion, and keeps the status label out of the timer.
- During an active turn, the top-right timer may append one compact activity label such as `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, or `等待批准`. These labels come from live app-server events and must update only the timer text, not insert reasoning rows or force full conversation rerenders.
- Live reasoning does not render as a conversation row; the top-right turn timer provides the in-progress time signal.
- The top-right timer layout keeps the elapsed time segment fixed so activity label length changes do not move the `本轮 HH:MM:SS` text.
- After the latest turn ends, the top-right timer shows the final elapsed time with `已结束` instead of retaining any in-progress activity label.
- The top conversation bar is intentionally compact: it shows the thread title, but not cwd or thread status metadata.
- On iOS standalone/PWA, the top conversation bar and mobile sidebar must respect `safe-area-inset-top` so the menu button and timer do not sit under the Dynamic Island/status bar. The PWA status bar style should not be `black-translucent`.
- The composer submit button follows Desktop behavior: during an active turn, an empty composer shows `Stop`; if text or attachments are present it switches back to `Send` for the new input.
- App-server approval requests render as pending approval cards in the current thread and support `Allow once`, `Allow session`, and `Deny` for command, file-change, legacy exec/apply-patch, and permission-profile requests.
- Approval requests with a `turnId` render inside that turn instead of as a persistent bottom stack. Once answered/resolved, they collapse to a one-line in-turn status.
- The composer must not programmatically focus the message input after send, thread switch, refresh, or mobile foreground recovery; mobile keyboards/input methods should open only after the user explicitly taps the message input.
- The message composer uses a `contenteditable` textbox instead of a native `textarea` to reduce iOS browser input accessory toolbar space. Enter sends the message; Shift+Enter inserts a line break.
- The composer attachment button should be a real file-picker label/input on mobile; do not rely only on calling `.click()` on a fully hidden file input.
- Message entry and live operation removal use short motion transitions.
- Automatic scroll-to-bottom uses immediate scroll positioning rather than smooth scrolling, to avoid visible whole-conversation up/down motion during no-op or near-no-op refreshes.
- Context compaction renders as `历史上下文正在压缩` while in progress and `历史上下文已压缩` after completion.
- Thread lists hide archived/deleted/removed sessions and sessions outside Codex Desktop visible workspace roots.
- Weak-network recovery may use `state_5.sqlite` metadata fallback, but should not resurface archived/deleted/old-workspace sessions.

## Safety

- Do not patch the WindowsApps Codex installation.
- Do not replace Codex Desktop's startup command unless explicitly requested and tested through a reversible path.
- Prefer the reversible `start-codex-desktop-shared.ps1` launcher over persistent system environment changes for Desktop/Web live sync.
- Keep `.codex` state read-only except through app-server RPCs.
- Keep raw access keys out of Git and out of `.agent-context`.
