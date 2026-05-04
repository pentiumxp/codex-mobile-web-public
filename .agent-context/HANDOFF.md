# HANDOFF

## 2026-05-03 Migration From Agent Workspace - 17:45 +08:00

- Objective:
  - Move Codex Mobile Web out of `C:\Users\xuxin\Documents\Agent\tools\cli\codex-mobile-web` into standalone workspace `C:\Users\xuxin\Documents\codex-mobile-web`.
- Migrated source files:
  - `server.js`
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `codex-app-server-mux.js`
  - `codex-app-server-mux.cmd`
  - `start-codex-mobile-web.ps1`
  - `README.md`
  - `package.json`, `.gitignore`, `LICENSE`
- Runtime setup:
  - Local runnable Codex binary copied to `%USERPROFILE%\.codex-mobile-web\codex.exe`.
  - Existing access key copied to `%USERPROFILE%\.codex-mobile-web\access_key`.
  - These runtime files are not stored in Git.
  - Old Agent workspace `.webui_secret_key` was removed after matching the runtime access key hash.
- Standalone adjustments:
  - `server.js` uses repository root as `APP_ROOT`, not the old nested `Agent\tools\cli` layout.
  - Default `CODEX_HOME` is `%USERPROFILE%\.codex`.
  - Default access key file is `%USERPROFILE%\.codex-mobile-web\access_key`.
  - Startup script defaults to `0.0.0.0:8787` and prefers `%USERPROFILE%\.codex-mobile-web\codex.exe` when present.
  - Old source directory `C:\Users\xuxin\Documents\Agent\tools\cli\codex-mobile-web` and old logs `C:\Users\xuxin\Documents\Agent\workspace\codex-mobile-web` were removed after validation.
- Latest functional behavior migrated:
  - Hidden thread filtering for archived/deleted/removed sessions and old workspaces.
  - Weak-network safe read retry and state DB fallback.
  - Mobile interaction-first rendering with bounded recent history.
  - Context compaction single-line Chinese notice.
  - Latest-only live command/file-change operation card.
  - File-change cards show compact file names only.
- Validation completed:
  - `node --check server.js`, `node --check codex-app-server-mux.js`, and `node --check public/app.js` passed.
  - Web server restarted from this workspace on `0.0.0.0:8787`.
  - Current wrapper PowerShell PID `51596`, Node PID `2424`, managed app-server child PID `6104`.
  - `/api/status` returned `ready=true`, `transport=managed-ws-child`, `lastError=null`, `codexExe=C:\Users\xuxin\.codex-mobile-web\codex.exe`.
  - LAN `/api/threads?limit=80&archived=false` returned 9 visible threads, 0 hidden/archived/old-workspace matches.
  - Current thread detail validation: 1 latest operational item, 1 context-compaction notice, and `DiffAsFilename=False`.

## Next Checks

- Start from this workspace when needed:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\xuxin\Documents\codex-mobile-web\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787`

## 2026-05-03 GitHub Publish Attempt - 18:05 +08:00

- User requested creating a new remote repository and pushing this workspace.
- Local scope reviewed:
  - Before publish preparation, the repository had no prior commits and no configured remote.
  - Intended initial commit scope is the complete standalone app source plus `.agent-context` durable context.
  - Runtime key and binary locations remain outside the repo under `%USERPROFILE%\.codex-mobile-web`.
  - `.gitignore` excludes `.env*`, `*.key`, `*.pem`, `.webui_secret_key`, logs, and workspace/log directories.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Composer Send/Stop And Model Selectors - 21:18 +08:00

- User-requested adjustment:
  - During an active turn, the composer button should be `Stop` only when the composer is empty.
  - If text or attachments are present during an active turn, the same button should become `Send` and submit the new input.
  - Add model and reasoning effort selectors similar to Codex Desktop.
- Changes:
  - `public/app.js` now makes `Send`/`Stop` depend on both `activeTurnId` and composer content.
  - `public/app.js` now sends `model` and `effort` with message `FormData` only when the user selects non-default values.
  - `public/index.html` adds compact `Model` and `Reasoning` selectors in the composer.
  - `public/styles.css` styles the selectors for the compact composer.
  - `server.js` now exposes model and reasoning effort options via `/api/public-config`.
  - Model options can be overridden with `CODEX_MOBILE_MODEL_OPTIONS`; reasoning options can be overridden with `CODEX_MOBILE_REASONING_EFFORT_OPTIONS`.
  - Defaults are read from `%USERPROFILE%\.codex\config.toml` (`model` and `model_reasoning_effort`) when available.
  - `README.md` and `PROJECT_CONTEXT.md` document the new per-message selector behavior.
- Runtime state after restart:
  - Mobile Web wrapper PID `43952`, Node/listener PID `48832`.
  - Shared mux remains `external-jsonl-tcp`.
- Validation:
  - `npm.cmd run check` passed.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - `/api/public-config` returns default model `gpt-5.5`, default reasoning effort `xhigh`, model options `gpt-5.5,gpt-5.4,gpt-5.4-mini,gpt-5.3-codex,gpt-5.3-codex-spark,gpt-5.2`, and efforts `low,medium,high,xhigh`.

## 2026-05-03 Composer Selector Compact Layout - 21:24 +08:00

- User-requested adjustment:
  - Model and reasoning selectors should not stack vertically.
  - Remove visible `Model` / `Reasoning` prompt text because it wastes space.
  - Avoid duplicate default values in the dropdown lists, such as two `GPT-5.5` or two `XHigh` entries.
- Changes:
  - `public/styles.css` now forces the selector area into two equal side-by-side columns.
  - `public/styles.css` hides the label text visually while keeping the labels for accessibility.
  - `public/app.js` now shows only the selected/default value in the collapsed controls, for example `GPT-5.5` and `XHigh`.
  - `public/app.js` now filters the current default value out of the explicit option list and treats a saved selection equal to the default as the default option.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-03 Mobile Foreground Black-Screen Recovery - 21:30 +08:00

- User-reported issue:
  - Voice input sometimes jumps to another app for permissions, then returns to Mobile Web with a black screen.
- Likely cause:
  - The page only handled `visibilitychange` by firing refresh requests; it did not force the app shell to re-show, re-render existing state, or reconnect SSE when returning from an external permission/input-method screen.
- Changes:
  - `public/app.js` adds `scheduleMobileResume()` / `resumeMobileSession()`.
  - Resume now handles `visibilitychange`, `pageshow`, `focus`, and `orientationchange`.
  - Resume re-shows the app shell, updates composer/layout height, renders cached current state immediately, reconnects SSE if closed, then refreshes status, thread list, and current thread.
  - `public/styles.css` uses `100dvh` for the app shell with a fallback to `100%`, and prevents body-level overflow after mobile viewport changes.
- Validation:
  - `npm.cmd run check` passed.
- Blocker:
  - GitHub CLI is installed, but `gh auth status` reports no authenticated GitHub hosts.
  - The available GitHub connector tools can operate inside existing repositories but do not expose repository creation.
- Local Git state:
  - Initial commit has been prepared locally on branch `main`.
  - No remote is configured because repository creation failed before authentication.
- Resume steps after authentication:
  - Run `gh auth login` in this Windows user session.
  - From `C:\Users\xuxin\Documents\codex-mobile-web`, create the private remote and push with `gh repo create codex-mobile-web --private --source . --remote origin --push`.

## 2026-05-03 GitHub Publish Completed - 18:17 +08:00

- GitHub CLI authenticated as account `pentiumxp`.
- Created private GitHub repository:
  - `https://github.com/pentiumxp/codex-mobile-web`
- Local Git state:
  - Branch: `main`
  - Remote: `origin` -> `https://github.com/pentiumxp/codex-mobile-web.git`
  - Tracking: `main` tracks `origin/main`
- Pushed commits:
  - `6f821a1 Initial Codex Mobile Web app`
- Validation after push:
  - `npm.cmd run check` passed.

## 2026-05-03 Composer Attachment Uploads - 18:17 +08:00

- Objective:
  - Add image and file upload support to the mobile interaction composer.
- Changed files:
  - `server.js`
  - `public/app.js`
  - `public/index.html`
  - `public/styles.css`
  - `README.md`
  - `.gitignore`
  - `.agent-context/PROJECT_CONTEXT.md`
- Runtime behavior:
  - Browser sends composer submissions as multipart `FormData` when attachments are present.
  - Server stores uploaded files under `%USERPROFILE%\.codex-mobile-web\uploads` by default.
  - `CODEX_MOBILE_UPLOAD_DIR` can override upload storage.
  - `CODEX_MOBILE_MAX_UPLOAD_BYTES` controls max total upload bytes per message, default `67108864`.
  - `CODEX_MOBILE_MAX_UPLOAD_FILES` controls max attachments per message, default `12`.
  - Uploaded images are passed to `turn/start` as app-server `localImage` input items.
  - Uploaded non-image files are referenced in the message text by absolute local path.
- Validation:
  - Official `openai/codex` source was checked for app-server v2 `UserInput` shape; `localImage` with `path` is supported, no generic file input exists.
  - `npm.cmd run check` passed.
  - `git diff --check` passed.
  - Temporary no-auth server on `127.0.0.1:8790` returned upload limits from `/api/public-config`.
  - Main server restarted on `0.0.0.0:8787`.
  - `/api/public-config` returns `maxUploadBytes=67108864` and `maxUploadFiles=12`.
  - Authenticated `/api/status` returned `ready=true`, `transport=managed-ws-child`, `lastError=null`.
- Current runtime PIDs after restart:
  - Wrapper PowerShell PID `15412`
  - Node PID `20868`
  - Managed app-server child PID `38792`

## 2026-05-03 Live Thread Refresh Diagnosis - 19:14 +08:00

- Objective:
  - Diagnose why the Codex Mobile Web conversation showed user messages but did not show later assistant updates.
- Findings:
  - Backend service on `8787` was alive and `/api/status` returned ready with managed app-server transport.
  - Authenticated thread detail for the active `codex-mobile-web` thread contained the newer assistant items, so the issue was client-side display/recovery, not missing backend data.
  - Browser validation showed reload/login landed on the home shortcuts view instead of automatically opening the active thread.
  - Browser validation also showed that opening the active thread renders the latest assistant content with no frontend console errors.
  - Existing polling stopped permanently after more than 60 stable polls, leaving SSE as the only update path during long-running turns.
- Changes:
  - `public/app.js` now keeps polling long-running active turns at a lower frequency instead of stopping after the stable-poll threshold.
  - `public/app.js` now persists the opened thread id and restores it after reload/login.
  - If there is no persisted thread id, startup opens the newest active thread when available.
  - Switching workspaces clears the persisted current-thread selection to avoid restoring a thread outside the selected workspace.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed.
  - Browser reload of `http://127.0.0.1:8787` automatically reopened the active `Codex webapp` thread and rendered the latest assistant updates.

## 2026-05-03 Desktop/Mobile Shared App-Server Bridge - 19:25 +08:00

- Objective:
  - Make the existing app-server mux bridge operational for Desktop/Mobile live convergence.
- Existing code confirmed:
  - `codex-app-server-mux.js` is the bridge: it accepts a Desktop stdio client, starts one real Codex app-server, and exposes `%USERPROFILE%\.codex\app-server-mux\endpoint.json` for Mobile Web.
  - Desktop currently launches its bundled `codex.exe app-server --analytics-default-enabled` directly unless launched with an override.
  - Mobile Web already detects the mux endpoint file when connecting to app-server.
- Changes:
  - `codex-app-server-mux.js` now passes through CLI arguments supplied by Desktop, falling back to `app-server --analytics-default-enabled` when no args are supplied.
  - Added `start-codex-desktop-shared.ps1`, a reversible launcher that sets `CODEX_CLI_PATH` to `codex-app-server-mux.cmd` only for the launched Desktop process.
  - Added authenticated `POST /api/app-server/reconnect` to let Mobile Web reconnect to a newly available mux endpoint without restarting the whole web server.
  - Updated `README.md` and `PROJECT_CONTEXT.md` with shared-mux setup and limitations.
- Operational notes:
  - To converge live UI state, fully quit Codex Desktop, launch it with `start-codex-desktop-shared.ps1`, then start or reconnect Mobile Web.
  - This bridge does not merge two already-running turns or retroactively inject missed content into an in-progress model call.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `start-codex-desktop-shared.ps1`.
  - `git diff --check` passed.

## 2026-05-03 Desktop Shared Launcher `spawn EINVAL` Fix - 20:10 +08:00

- Problem:
  - Launching Codex Desktop through the new `Codex (MUX)` shortcut showed `spawn EINVAL`.
  - The launcher had set `CODEX_CLI_PATH` to `codex-app-server-mux.cmd`.
  - Codex Desktop uses direct process spawning for `CODEX_CLI_PATH`; on Windows this path must be a real executable, not a batch/cmd wrapper.
- Changes:
  - Added `codex-app-server-mux-shim.cs`.
  - `start-codex-desktop-shared.ps1` now builds generated `codex-app-server-mux.exe` from the shim source when missing or stale.
  - The launcher now sets `CODEX_CLI_PATH` to generated `codex-app-server-mux.exe`.
  - The launcher also sets `CODEX_MUX_SCRIPT_PATH` to `codex-app-server-mux.js`, `CODEX_MUX_CODEX_EXE` to the real Codex CLI, and `CODEX_MUX_NODE_EXE` when `node.exe` is discoverable.
  - `.gitignore` excludes generated `codex-app-server-mux.exe`.
  - `README.md` and `PROJECT_CONTEXT.md` now document the exe shim requirement.
- Validation:
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -PrintOnly` succeeded and generated `codex-app-server-mux.exe`.
  - `.\codex-app-server-mux.exe --mux-shim-version` returned `codex-app-server-mux-shim 1`.
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `start-codex-desktop-shared.ps1`.
  - `git diff --check` passed with only Git line-ending warnings.
- Operational note:
  - Existing Codex Desktop processes must be fully closed before relaunching through `Codex (MUX)`; already-running Desktop processes cannot inherit the corrected `CODEX_CLI_PATH`.

## 2026-05-03 Mobile Web No-Response / Mux Initialize Fix - 20:20 +08:00

- Symptom:
  - User reported that sending from Mobile Web produced no visible reaction and did not sync to this Desktop-side conversation.
- Findings:
  - Port `8787` was initially still running old `server.js` PID `20868`, started before the mux/reconnect changes; `POST /api/app-server/reconnect` returned 404.
  - After restarting Mobile Web, it still fell back to `managed-ws-child`.
  - Direct mux diagnostic showed the real shared app-server returned `Already initialized` for a second `initialize` request because Desktop had already initialized the same app-server.
  - Direct `thread/list` over the mux worked without a second initialize, confirming the shared app-server itself was usable.
- Changes:
  - `server.js` now calls `initialize({ allowAlreadyInitialized: true })` for external/shared endpoints.
  - If external/shared initialize returns `Already initialized`, Mobile Web treats the connection as ready instead of falling back to a managed child.
- Runtime actions:
  - Stopped old Mobile Web wrapper/server/managed child PIDs `15412`, `52580`, `20868`, `27476`.
  - Later stopped restarted managed fallback PIDs `10224`, `31512`, `33288`.
  - Restarted Mobile Web from current workspace on `0.0.0.0:8787`; current wrapper PID `22760`, Node PID `29288`.
  - Current mux PID `11600`, shared real app-server PID `57936`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` now returns `ready=true`, `transport=external-jsonl-tcp`, endpoint source `%USERPROFILE%\.codex\app-server-mux\endpoint.json`, `lastError=null`.
  - `/api/threads/019ded32-ed92-7681-9591-0e4d457c5274` returns the current active thread with latest commentary items.
  - `/api/events` returns SSE status with `external-jsonl-tcp`.
- Operational note:
  - Mobile browser tabs connected before the restart may need a reload if their EventSource did not automatically reconnect after the 8787 process restart.

## 2026-05-03 Mobile Rendering Stability Pass - 20:32 +08:00

- User-reported issues:
  - Live command/file operation cards sometimes disappeared and were replaced by repeating `Reasoning` rows.
  - The lower-left turn timer overlapped final `in progress` / `syncing` turn status text.
  - The timer continued updating after completion instead of settling on a final elapsed value.
  - The top conversation header used too much vertical space by showing thread title, cwd, and status metadata.
- Changes:
  - `public/app.js` now treats reasoning items as non-conversation items everywhere in visible item selection and thread signatures.
  - Reasoning `item/started`, reasoning deltas, and reasoning timer updates no longer remove existing command/file/tool operation items.
  - Live operation visibility ignores later hidden reasoning items, so operation cards remain visible until later normal content arrives.
  - Turn completion checks now prioritize `completedAt`, `durationMs`, or completed/error/interrupted status before treating a turn as live.
  - The lower-left timer now clears its interval when no live turn exists and shows a settled final duration when the latest turn has completion timing.
  - The conversation area gets extra bottom padding while the timer is visible so the timer does not cover `in progress` / `syncing` status text.
  - `public/index.html`/`public/styles.css` now hide the thread title/meta header block and use smaller topbar icon buttons.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` still returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated `public/app.js` and CSS.

## 2026-05-03 Topbar Thread Title And Turn Timer Adjustment - 20:36 +08:00

- User-requested adjustment:
  - Restore the thread name at the top of the conversation.
  - Do not render the turn timer and turn status as separate lines.
  - Move the current-turn timer to the top right if the lower-left placement is problematic.
- Changes:
  - `public/index.html` now places `#turnTimer` inside the topbar, between the thread title and interrupt button.
  - The topbar again shows `#threadTitle`; `#threadMeta` remains hidden, so cwd/status metadata does not take vertical space.
  - `public/app.js` now formats the timer as one line with status: `本轮 HH:MM:SS · <status>`.
  - Latest-turn status is hidden from the conversation body when the topbar timer can show the same status, avoiding duplicated two-line status/timer presentation.
  - `public/styles.css` now styles the timer as a compact top-right pill instead of a lower-left absolute overlay.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` still returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated topbar layout.

## 2026-05-03 Operation Card Restore And Composer Stop Button - 20:43 +08:00

- User-reported issues:
  - After hiding reasoning, command/file operation cards also disappeared.
  - The separate topbar interrupt button did not match Codex Desktop behavior; the composer submit button should become the interrupt button while a turn is active.
- Findings:
  - Current app-server `thread/read` for the active Desktop-backed thread returned only `userMessage` and `agentMessage` items.
  - The raw rollout JSONL still contained operation runtime events such as `exec_command_end`, `patch_apply_end`, `function_call`, and `custom_tool_call`.
  - Status string compatibility also mattered: current turns use `inProgress`, while the live-turn regex only matched `in_progress` and `in-progress`.
- Changes:
  - `server.js` now treats `inProgress` / `inprogress` as a live status.
  - `server.js` now keeps the latest app-server operation item whenever a latest turn is live.
  - If app-server omits operation items, `server.js` reads the thread rollout JSONL tail and synthesizes one compact latest operation card from runtime events.
  - The synthesized card includes only command text or file names; it does not include command output or diffs.
  - `public/app.js` now treats `inProgress` / `inprogress` as running.
  - `public/app.js` preserves latest operation cards while a turn is active and appends the latest operation card after visible non-operation items.
  - The composer submit button now switches between `Send` and `Stop`; `Stop` calls the existing turn interrupt endpoint.
  - `public/styles.css` hides the old topbar interrupt button and styles `#sendMessage.interrupt-mode`.
- Runtime state after restart:
  - Mobile Web wrapper PID `6576`, Node PID `33644`.
  - Mux PID `11600`, shared real app-server PID `57936`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - `/api/threads/019ded32-ed92-7681-9591-0e4d457c5274` now includes `commandExecution:1` in the latest in-progress turn.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated composer button behavior and operation-card rendering.

## 2026-05-03 Thread Switch Performance Fix - 21:05 +08:00

- User-reported issue:
  - Switching threads in Mobile Web was slow and could appear stuck; restarting the app and restoring the previous thread was fast.
- Findings:
  - `/api/threads?limit=12&archived=false` returned in about 179 ms.
  - Old `/api/threads/:id` used app-server `thread/read includeTurns:true`; one visible `Hermes` thread took about 7.6 s while most others were under 1 s.
  - Direct `thread/turns/list` for the same slow thread returned in about 0.5-0.6 s.
  - The frontend did not cancel or sequence stale thread-load requests, so rapid switching could leave older slow reads in flight and produce stale UI updates.
- Changes:
  - `server.js` now serves `/api/threads/:id` through fast `thread/turns/list` plus local `state_5.sqlite` thread metadata.
  - `server.js` keeps `thread/read` only as a fallback if the fast turns-list path fails.
  - `server.js` normalizes `\\?\` cwd prefixes from state DB summaries before sending them to the browser.
  - `public/app.js` now assigns a sequence number to each thread switch, aborts the previous thread detail fetch, ignores stale responses, clears old live-poll timers, and renders an immediate lightweight loading state for the selected thread.
- Runtime state after restart:
  - Mobile Web wrapper PID `48976`, Node/listener PID `12888`.
  - Mux remains `external-jsonl-tcp` through `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - After restart, the first 8 visible thread detail reads all used `mobileReadMode=turns-list`.
  - The previously slow `Hermes` detail read dropped from about 7.6 s to about 573 ms.
  - Current active thread detail still includes `commandExecution:1` in the latest turn.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated thread-switch cancellation logic.

## 2026-05-03 Topbar Timer And Live Operation Flicker Adjustment - 21:12 +08:00

- User-requested adjustment:
  - Move the topbar current-turn timer to the far right.
  - Remove the `in progress` / status suffix from the timer text.
  - Reduce flashing when consecutive command/file operation cards update.
- Changes:
  - `public/app.js` now formats the timer as `本轮 HH:MM:SS` for both running and settled turns.
  - `public/app.js` now gives the live operation card a stable render key per turn, so a new command does not trigger a fresh entry animation for the whole card.
  - `public/styles.css` keeps the timer as a fixed-width right-side topbar element and disables entry animation on `.live-operation` cards.
  - `public/styles.css` narrows the mobile timer max width so the title remains usable.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-03 Active-Turn Web Input Desktop Echo Fix - 21:40 +08:00

- User-reported issue:
  - If a message is sent from Mobile Web while a turn is already running, Codex Desktop shows later assistant replies but does not show that user message live.
  - If the same message starts a new turn, Desktop shows it normally.
- Finding:
  - Current thread detail from Mobile Web already contained the mid-turn `userMessage` items, so persistence was intact.
  - The missing part was a Desktop-visible live notification for Web App active-turn input.
- Changes:
  - `public/app.js` now includes `activeTurnId` in composer submissions when a turn is running.
  - `server.js` now emits a mux-local `mux/userMessage` notification after `turn/start` succeeds, but only when connected through a shared mux endpoint that advertises `capabilities.mobileUserMessageEcho=true`.
  - `codex-app-server-mux.js` handles `mux/userMessage` locally and broadcasts it as an `item/completed` `userMessage` notification to mux clients, including Codex Desktop.
  - New mux endpoint files include `capabilities.mobileUserMessageEcho=true`; old running mux processes do not.
  - The mux also tracks `turn/started` / `turn/completed` notifications as a fallback for active turn ids.
- Runtime state after Web restart:
  - Mobile Web wrapper PID `57100`, Node/listener PID `17480`.
  - Mobile Web is ready on `0.0.0.0:8787` and connected to external shared mux endpoint `%USERPROFILE%\.codex\app-server-mux\endpoint.json`.
  - Running mux PID was still `11600` at validation time; its endpoint file had no capabilities block because it was started before this change.
  - To activate Desktop live echo for mid-turn Web input, fully quit Codex Desktop and relaunch through `Codex (MUX)` so the mux endpoint advertises `mobileUserMessageEcho`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Current thread detail used `mobileReadMode=turns-list`; latest in-progress turn `019dedf9-d737-70e1-99df-0057b88c1605` contained 3 `userMessage` items.

## 2026-05-03 No-Op Conversation Refresh Flicker Fix - 22:05 +08:00

- User-reported issue:
  - Codex reply text streams in correctly, but after a paragraph finishes the whole conversation appears to flash every few seconds even when no visible text changes.
  - After the first no-op skip pass, user still saw refresh-like flashes and asked to minimize global refreshes in favor of local refresh.
- Likely cause:
  - Polling and status refreshes could call `renderCurrentThread()` with unchanged visible content.
  - `renderCurrentThread()` replaced the entire `#conversation.innerHTML` each time, rebuilding the DOM even when the rendered text was identical.
  - Even when visible content changed only locally, the old path still replaced the whole conversation DOM.
- Changes:
  - `public/app.js` now tracks `state.renderedConversationSignature`.
  - Added `conversationRenderSignature()` based on visible turns, visible items, operation cards, status lines, omitted-history count, and leaving-operation keys.
  - Added `updateConversationHtml()` so no-op conversation refreshes do not touch the DOM.
  - Added a lightweight keyed DOM patcher (`patchHtml`, `patchNode`, `patchChildNodes`) so changed conversation renders reuse existing turn/item nodes by `data-render-key` and update only changed local text/attributes/children.
  - Thread list rendering now tracks `state.renderedThreadListSignature` and skips rebuilding the sidebar list when thread metadata has not changed.
  - Home shortcut rendering uses the same skip path to avoid unnecessary home DOM rebuilds.
  - Timer/title updates still run even when the conversation DOM is skipped.
- Runtime state after restart:
  - Mobile Web wrapper PID `57184`, Node/listener PID `55308`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Current mux endpoint advertised `capabilities.mobileUserMessageEcho=true` on port `50163`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - Current thread detail still used `mobileReadMode=turns-list`.
- Operational note:
  - Existing Mobile Web browser tabs need a page reload to load this updated `public/app.js`.

## 2026-05-03 Quota, Web Search, And Operation Ordering - 22:24 +08:00

- User-requested adjustments:
  - Show 5-hour and weekly quota remaining percentages to the right of the model/reasoning selectors, with 5-hour remaining before weekly remaining.
  - Render the quota values as a single compact numeric indicator in the same line as model/reasoning, formatted as `<5-hour remaining> | <weekly remaining>`.
  - Render Web Search like a compact Command/tool operation, not as an expanded structured payload.
  - Do not pin command/file operation cards to the bottom; newer normal messages should render below them, and a newer operation should replace older operation cards.
- Changes:
  - `server.js` now stores compact `account/rateLimits/updated` notifications and exposes them through `/api/status` and `/api/public-config`.
  - `public/app.js` selects the 5-hour quota window from the 300-minute `primary` rate-limit window and the weekly quota window from the 10080-minute `secondary` rate-limit window when present, displaying remaining percentages as `100 - usedPercent`.
  - `public/app.js` updates one compact `#quotaUsage` indicator with 5-hour and weekly remaining values separated by `|`.
  - `server.js` and `public/app.js` now classify Web Search payloads and rollout `web_search_*` events as compact `Web Search` operation cards.
  - `public/app.js` now keeps only the latest operation card but renders it in source order inside the turn instead of appending it to the bottom.
  - `public/index.html` and `public/styles.css` add the compact quota indicator next to the existing selectors.
  - `public/styles.css` keeps model, reasoning, and quota controls in one row while keeping model/reasoning selectors readable.
- Service recovery:
  - An interrupted restart left old 8787 process PID `55308` running, so new code was not loaded.
  - Stopped wrapper PID `57184` and child PID `55308`, then restarted with `start-codex-mobile-web.ps1`.
  - Current wrapper PID `49844`, Node/listener PID `50372`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.
  - LAN `/api/public-config` responds at `http://192.168.10.108:8787`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Latest validation showed Mobile Web should display about `86% | 20%` after status/bootstrap.
  - Current thread detail confirmed the latest command operation remains between surrounding agent messages in source order.

## 2026-05-03 Completion Refresh And Composer Layout

- User-reported issues:
  - At the end of a turn, the final streamed summary could finish line-by-line, then the screen could go black briefly before the complete content returned.
  - The Effort selector became too narrow after adding the quota indicator.
  - The quota indicator should stay at the far right of the selector row.
- Likely cause for the black-screen/end-of-turn flash:
  - `turn/completed` and the scheduled follow-up thread refresh both replaced local turn/thread state directly with the incoming payload.
  - If the completion payload or a fast server snapshot had fewer visible `items` than the locally streamed turn, the keyed DOM patcher correctly rendered that shorter state, temporarily removing visible content until a fuller snapshot arrived.
- Changes:
  - `public/app.js` now computes visible item weight and merges completion/thread refresh payloads without letting empty or shorter visible item snapshots overwrite local streamed items.
  - `public/app.js` preserves local in-progress turns if a refresh snapshot omits them.
  - `public/styles.css` gives Model and Effort readable grid tracks and makes the quota indicator a fixed-content right-aligned column.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Loading Thread Regression Fix

- User-reported issue:
  - Mobile Web could enter the app but remain stuck on `Loading thread`.
- Finding:
  - The new visible-item merge path was also used for initial `loadThread()`.
  - The initial placeholder thread carries `mobileLoading: true`; because the server detail payload does not include `mobileLoading`, `Object.assign({}, existingThread, incomingThread)` preserved the placeholder flag after a successful detail read.
  - Result: the thread detail data was loaded, but the UI still rendered the loading state.
- Changes:
  - `public/app.js` now clears placeholder-only `mobileLoading` and `mobileLoadError` flags when merging a real incoming thread payload that does not explicitly contain those fields.
  - `public/app.js` now catches keyed conversation patch failures and falls back to a full `innerHTML` render instead of leaving a stale loading screen.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Image Payload Rendering And Mobile Width Fix

- User-reported issues:
  - A huge image data payload appeared in the conversation after sending screenshots.
  - Image attachments in user messages were shown as paths/text instead of rendered images.
  - The mobile page width overflowed horizontally, clipping the right side of the top timer and `Stop` button.
- Findings:
  - App-server thread data can include image input parts as `{"type":"image","url":"data:image/png;base64,..."}` alongside the text attachment summary.
  - `public/app.js` rendered unknown input parts with `JSON.stringify(part)`, which expanded the full data URL into the conversation.
  - The same raw `content` array was used in visible-content signatures, making render signatures large when image data URLs were present.
  - Mobile composer minimum widths for Model/Effort/quota plus attachment/input/send controls exceeded the phone viewport.
- Changes:
  - `public/app.js` now normalizes input content signatures so data URLs are represented by a short signature, not the full payload.
  - `public/app.js` now renders `image` / `localImage` input parts as bounded thumbnails and skips expanded JSON rendering for image payloads.
  - `public/app.js` parses the text `Uploaded attachments` summary so image paths can be used as thumbnail sources instead of embedding large data URLs.
  - `server.js` adds authenticated `/api/uploads/file?path=<absolute-upload-path>` serving, restricted to the configured upload root.
  - `public/styles.css` adds bounded image/attachment styles and mobile-only composer grid areas so controls no longer force horizontal page overflow.
- Runtime:
  - Mobile Web was restarted after the `server.js` route change.
  - Current wrapper PID `10796`, Node/listener PID `50268`.
  - `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - A known uploaded PNG returned `HTTP 200`, `Content-Type: image/png` through `/api/uploads/file`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Mobile Attachment Picker Fix

- User-reported issue:
  - After the image rendering/mobile width changes, tapping `+` on the mobile composer no longer reliably attached images.
- Likely cause:
  - The old implementation kept `#fileInput` as `display:none` and opened it by calling `.click()` from the visual `+` button.
  - Mobile browsers, especially iOS/Safari contexts, can reject or ignore programmatic clicks on fully hidden file inputs.
- Changes:
  - `public/index.html` now makes `#attachFiles` a real file-picker label containing the `#fileInput`.
  - `public/styles.css` positions the transparent file input over the visible `+` affordance, so tapping the button hits the native file input directly.
  - `public/app.js` updates disabled/ARIA state through class attributes and keeps keyboard activation as a fallback.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Viewport-Based Operation Card Pruning

- User-reported issue:
  - When a new Command/operation card appears, removing the old card immediately can visibly flash, especially if the old card is large and still on screen.
- Change:
  - `public/app.js` now snapshots old operation cards before replacement if the old card is currently inside the conversation viewport.
  - Retained operation cards are reinserted in source order and do not run the short leave animation.
  - Retained cards are pruned after they leave the conversation viewport, with scroll-triggered and timed cleanup plus a 30-second failsafe.
  - `public/styles.css` disables animation for `.retained-operation`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Active Turn Steering And Operation Retention Cap

- User-reported issues:
  - During an active turn, Mobile Web input and live guidance output were not consistently mirrored in Codex Desktop.
  - The top-right turn timer should use red/active styling while a turn is running, then revert to the settled muted styling after completion.
  - The previous viewport-based operation retention could stack multiple old Command cards during consecutive command updates.
- Findings:
  - The active-turn message path was using `turn/start` plus a mux-local synthetic `mux/userMessage` echo.
  - Current app-server supports `turn/steer` with `expectedTurnId`, which is the correct API for sending extra input into an already-running turn.
- Changes:
  - `server.js` now uses `turn/steer` when `activeTurnId` is present, returning immediately on success.
  - The older `mux/userMessage` synthetic echo remains only as a fallback if `turn/steer` is unavailable.
  - `public/app.js` now adds an `active` class to the top-right timer while the latest turn is running and removes it when settled/hidden.
  - `public/styles.css` gives `.turn-timer.active` the red active treatment while preserving the muted settled treatment.
  - `public/app.js` now caps retained old operation cards to one per thread/turn, so consecutive Command/file operation updates do not stack multiple old cards.
- Runtime after restart:
  - Mobile Web wrapper PID `29852`, Node/listener PID `49296`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-03 Image Thumbnail Size And Command Card Rule

- User-reported issues:
  - Uploaded images rendered too large in the conversation; they should appear as thumbnails.
  - Consecutive command updates could still show two Command cards. Desired behavior: only one Command card for consecutive operations; two cards are acceptable only when visible non-operation content appears between the older operation and the newer operation.
- Changes:
  - `public/styles.css` now caps conversation image thumbnails at `min(36vw, 160px)` wide and `120px` high.
  - `public/app.js` now retains an older operation card only if visible non-operation content exists after that operation in the same turn.
  - Consecutive operation updates without intervening visible content replace the current operation card instead of retaining the old card.
  - `PROJECT_CONTEXT.md` documents compact thumbnail rendering and the refined command-card retention rule.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-03 Center Image Thumbnails

- User-reported issue:
  - Single image thumbnails were left-aligned inside the message body, which looked visually unbalanced.
- Changes:
  - `public/styles.css` now centers `.input-image` thumbnails with horizontal auto margins.
  - Image captions are centered under thumbnails.
  - `PROJECT_CONTEXT.md` records that user-message images should render as compact centered thumbnails.

## 2026-05-03 Enlarge Image Thumbnails

- User-requested adjustment:
  - Centered image thumbnails were still too small; enlarge them by about 2x.
- Changes:
  - `public/styles.css` changed conversation image thumbnail caps from `min(36vw, 160px)` / `120px` to `min(72vw, 320px)` / `240px`.
  - `PROJECT_CONTEXT.md` records the current thumbnail size cap.

## 2026-05-03 Cross-Platform README

- User-requested documentation:
  - Write a README that someone can read after cloning, including Windows and Mac usage.
  - Clarify access-key generation and the easiest way for another user to enter/copy it.
- Changes:
  - `README.md` now has a platform support table, Windows standalone startup, macOS standalone startup, authentication flow, upload behavior, interface notes, Windows Desktop mux sync, macOS sync limitations, environment variables, and safety notes.
  - Authentication docs now state the exact key source priority and generation behavior: `CODEX_MOBILE_KEY`, then key file, then an 18-random-byte base64url key generated on first start.
  - README includes clipboard commands: Windows `Set-Clipboard`, macOS `pbcopy`.
  - README includes optional custom-key examples for demos on trusted private networks.
  - `PROJECT_CONTEXT.md` records the durable access-key generation behavior.

## 2026-05-03 Clean Public Release Repository

- User-requested action:
  - Create a clean release repository and remove Agent context from the submitted history.
- Release repo:
  - URL: `https://github.com/pentiumxp/codex-mobile-web-public`
  - Visibility: public
  - Local path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Release construction:
  - Created a new local repository with no inherited Git history.
  - Copied only release files from the private workspace.
  - Excluded `.agent-context/` and `AGENTS.md`.
  - Added `.agent-context/` and `AGENTS.md` to the release `.gitignore`.
  - Updated the release README clone URL to `pentiumxp/codex-mobile-web-public`.
  - Changed release `LICENSE` copyright holder to `Codex Mobile Web contributors`.
- Validation:
  - Release repo has a single root commit: `95a04a9 Initial clean public release`.
  - `git ls-files` in the release repo returns 13 files and no `.agent-context` / `AGENTS.md`.
  - `npm.cmd run check` passed in the release repo.
  - Privacy scan in the release repo found no `xuxin`, `Hermes`, `C:\Users`, `192.168.10.108`, `.webui_secret`, old private repo clone URL, or `AGENTS` matches.

## 2026-05-03 Composer Keyboard Focus Suppression

- User-reported issue:
  - The message input could bring up the mobile input method even when the user did not intend to type.
- Finding:
  - `sendMessage()` called `input.focus()` in `finally`, so every send attempt could programmatically focus the textarea.
- Changes:
  - `public/app.js` now removes the automatic `input.focus()` after send.
  - After a successful send, `public/app.js` clears the textarea and calls `input.blur()` so the mobile keyboard closes instead of being reopened.
  - `PROJECT_CONTEXT.md` records that keyboards/input methods should open only after the user explicitly taps the textarea.

## 2026-05-03 README macOS App-Server Bridge Notes

- User-requested documentation:
  - README should clearly describe the macOS implementation approach for the bridge app-server path.
  - README should explicitly state Windows bridge support is implemented while macOS is not yet verified.
  - The public release README should be enough for another Codex agent to implement and validate macOS support.
- Changes:
  - `README.md` now has an `App-Server Bridge Design` section describing the mux flow shared by Desktop and Mobile Web.
  - Windows Desktop live sync is marked `implemented and verified`.
  - macOS Desktop live sync is marked `design documented, not yet packaged or verified on macOS`.
  - Added a macOS implementation plan covering `CODEX_CLI_PATH`, `CODEX_HOME`, `CODEX_MUX_SCRIPT_PATH`, `CODEX_MUX_CODEX_EXE`, optional `CODEX_MUX_NODE_EXE`, stdout cleanliness, argument passthrough, and fallback native shim requirements.
  - Added a macOS verification checklist for endpoint file, mux log, Mobile Web `external-jsonl-tcp` transport, Desktop-to-Mobile live updates, Mobile-to-Desktop mid-turn sync, and endpoint cleanup.
  - The clean public release repo README was synchronized while preserving the public clone URL and `.agent-context/` ignore note.

## 2026-05-04 Menu Workspace/Thread Loading Fix

- User-reported issue:
  - In the menu/sidebar workspace and thread switcher, the UI could get stuck showing `Loading thread` and the thread list would not repaint.
  - Selecting a workspace again from the workspace select could force the list to recover.
  - The conversation could also appear to shift upward and then downward even when visible content did not materially change.
- Findings:
  - `loadThreads()` directly replaced the thread list DOM with a loading placeholder but did not reset `state.renderedThreadListSignature`.
  - If the refreshed thread data was identical to the previous rendered list, `renderThreads()` skipped repainting and left the loading placeholder on screen.
  - Workspace shortcut and workspace select changes cleared thread state inline instead of using a shared reset path, so pending detail loads, poll timers, and home rendering could be left in inconsistent states.
  - Automatic scroll-to-bottom used smooth scrolling, which can produce visible whole-content motion during frequent live or near-no-op refreshes.
- Changes:
  - Added request sequencing and abort handling for thread-list loads.
  - Loading and error placeholders now update the thread-list render signature, so later successful results repaint even when the data is unchanged.
  - Workspace changes now call a shared current-thread reset helper that aborts pending detail loads, clears poll/refresh timers, clears retained operation cards, resets active turn state, and renders the home view immediately.
  - Opening the mobile menu now refreshes workspaces and threads.
  - Thread detail load failures now render an inline retry state instead of leaving the conversation permanently in `Loading thread`.
  - Composer controls remain disabled while a thread is loading or in a thread-load error state.
  - Automatic bottom scrolling is now immediate and no-op guarded instead of smooth.
- Validation:
  - `npm.cmd run check` passed in the private workspace.
  - `git diff --check` passed with only Git line-ending warnings.
  - The same front-end fix was synchronized to the clean public release workspace, where `npm.cmd run check`, `git diff --check`, and the public privacy scan passed.

## 2026-05-04 Desktop-Owned Mux Lifetime Finding

- Superseded by the keep-alive implementation below, but retained as the diagnosis that led to the fix.
- Current Windows Desktop live-sync mode is Desktop-owned:
  - Codex Desktop launches `codex-app-server-mux.exe` through `CODEX_CLI_PATH`.
  - The shim launches `node codex-app-server-mux.js`.
  - The mux launches the real `codex app-server` child and exposes the JSONL TCP endpoint consumed by Mobile Web.
- The mux is intentionally tied to Desktop stdio unless `CODEX_MUX_STANDALONE=1`:
  - When Desktop closes the mux stdin, `codex-app-server-mux.js` calls shutdown.
  - Shutdown removes the endpoint file, closes TCP, and kills the real app-server child.
- Operational implication:
  - If Mobile Web is actively interacting through `external-jsonl-tcp` and the Desktop app is fully quit, the Mobile Web server process remains running but its shared app-server connection is closed.
  - The active turn stream should be treated as interrupted in this mode.
  - Later Mobile Web requests may reconnect or fall back to its own managed app-server if the shared endpoint is unavailable, but that is a new app-server process, not continuation of the killed Desktop-owned process.
- Durable design note:
  - To allow Desktop to quit without affecting Mobile Web live turns, the bridge would need a daemon-style mux plus a Desktop stdio adapter, or Mobile Web must run standalone without Desktop live-sync.

## 2026-05-04 Shared Stream Strictness And Mux Keep-Alive

- User-requested product rule:
  - Shared live message stream is mandatory for Desktop/Mobile sync.
  - If the shared stream disconnects, Mobile Web should show a connection error rather than silently starting a separate managed app-server with a divergent stream.
  - Prefer keeping the stream process alive after Desktop exits; Desktop restart should reconnect to the same stream where possible.
- Changes:
  - `server.js` now treats detected mux endpoint files as required for the process lifetime.
  - `server.js` adds `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1` to require a shared endpoint even before a mux endpoint file exists.
  - If a shared endpoint is unavailable or closes, `server.js` sets a shared app-server error and does not fall back to a managed child.
  - `/api/status` now includes `sharedRequired`.
  - `public/app.js` shows `Shared` when using a shared endpoint and surfaces shared app-server errors in the connection label.
  - `codex-app-server-mux.js` adds `CODEX_MUX_KEEP_ALIVE=1`.
  - With keep-alive enabled, Desktop stdio disconnect removes only the Desktop client; mux, TCP endpoint, and the real app-server child remain alive.
  - When a new Desktop-launched mux starts while a live endpoint already exists, it acts as a stdio adapter to the existing mux instead of starting another real app-server.
  - The mux caches/replays the first successful `initialize` response so reconnecting Desktop clients can attach to an already-initialized app-server.
  - `start-codex-desktop-shared.ps1` now enables `CODEX_MUX_KEEP_ALIVE=1` by default, with `-NoMuxKeepAlive` as an opt-out.
  - `start-codex-mobile-web.ps1` adds `-RequireSharedAppServer`.
  - README and `PROJECT_CONTEXT.md` document strict shared-stream and keep-alive behavior.
- Validation:
  - `npm.cmd run check` passed.
- Remaining limitation:
  - Desktop UI foreground thread switching is still controlled by Codex Desktop, not by the app-server protocol. Reconnecting Desktop should attach to the same app-server process, but exact foreground route restoration depends on Desktop behavior.
- Runtime confirmation after Desktop restart:
  - `%USERPROFILE%\.codex\app-server-mux\endpoint.json` now points to `jsonl-tcp` port `64924`, mux Node PID `47860`, real app-server child PID `36432`, started at `2026-05-04T01:38:48.447Z`.
  - Codex Desktop process tree includes `Codex.exe` PID `27296` -> `codex-app-server-mux.exe` PID `44428` -> `node.exe` PID `47860` -> `codex.exe app-server` PID `36432`.
  - Mobile Web wrapper PID `49736`, Node PID `46112`.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Mux log shows `replayed cached initialize result`, confirming the cached initialize/reconnect path is active.
- Runtime confirmation after a second Desktop restart:
  - Endpoint remained unchanged: port `64924`, mux Node PID `47860`, child app-server PID `36432`, started at `2026-05-04T01:38:48.447Z`.
  - New Desktop main PID became `51516`.
  - New Desktop-launched adapter process tree is `Codex.exe` PID `51516` -> `codex-app-server-mux.exe` PID `52068` -> `node.exe` PID `55728`.
  - Mux log shows `client disconnected c1 desktop-stdio`, then `attached desktop stdio to existing mux 127.0.0.1:64924 pid=47860`, then `replayed cached initialize result for c3`.
  - Authenticated `/api/status` still returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.

## 2026-05-04 Mobile Approval Control Work - 11:47 +08:00

- User-reported issue:
  - A normal-permission thread can block on command/file/permission approval, and Mobile Web did not show a usable approval notification.
- Findings:
  - The app-server sends approval prompts as server requests with both `method` and `id`, such as `item/commandExecution/requestApproval`, `item/fileChange/requestApproval`, `item/permissions/requestApproval`, plus legacy `execCommandApproval` and `applyPatchApproval`.
  - The previous mux treated all app-server messages with an `id` as responses to client requests. Server requests with ids were logged as `response for unknown request id ...` and dropped.
  - Because dropped server requests are not replayed by the app-server, a turn already blocked behind a dropped approval may need to be interrupted/retried or the shared mux/app-server restarted.
- Changes:
  - `codex-app-server-mux.js` now distinguishes app-server server requests (`id` + `method`) from responses (`id` without `method`), broadcasts server requests to clients, and forwards the first client response back to the real app-server.
  - The mux endpoint capability now includes `serverRequestProxy: true` when the new mux code is running.
  - `server.js` now stores pending server requests, exposes authenticated `GET /api/approvals`, accepts `POST /api/approvals/<requestId>` decisions, and sends JSON-RPC responses back through the shared app-server stream.
  - `public/app.js` renders pending approval cards in the current thread with `Allow once`, `Allow session`, and `Deny` actions.
  - `public/styles.css` adds compact approval-card styling.
  - `start-codex-desktop-shared.ps1` adds `-ForceRestartMux`, which stops the mux PID recorded in `%USERPROFILE%\.codex\app-server-mux\endpoint.json` before launching Desktop. This is needed after bridge-code changes because normal Desktop restarts attach to the old keep-alive mux.
  - `.gitignore` now ignores local `data/` logs and `*.log.err`, because server restarts can leave runtime log files in the workspace.
  - README and `PROJECT_CONTEXT.md` document approval proxying and the forced mux restart workflow.
- Validation:
  - `npm.cmd run check` passed.
  - `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -PrintOnly` passed.
  - `git diff --check` passed with only Git line-ending warnings.
- Current runtime state:
  - Mobile Web server was restarted with new `server.js`; current 8787 listener is Node PID `53012`.
  - Authenticated `GET /api/approvals` now returns `200` with an empty `data` array.
  - Authenticated `/api/status` returns `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - The old keep-alive mux has been replaced through `start-codex-desktop-shared.ps1 -ForceRestartMux`.
  - Current endpoint is port `62570`, mux Node PID `12780`, real app-server child PID `44104`, started `2026-05-04T03:57:34.646Z`.
  - Current mux endpoint capabilities are `{ mobileUserMessageEcho: true, serverRequestProxy: true }`, so approval server-request proxying is active.
  - Mobile Web was explicitly reconnected to this endpoint; authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, endpoint port `62570`, and `serverRequestProxy=true`.
  - Authenticated `/api/approvals` currently returns an empty `data` array.
  - Any approval prompt dropped by the old mux before the replacement cannot be replayed by app-server; that specific blocked operation should be retried if still needed.

## 2026-05-04 Public PR #1 Pulled Locally

- User reported a new GitHub pull request had been merged.
- Private repository `pentiumxp/codex-mobile-web` had no new remote commits after `git fetch origin --prune`; `main` remained at `aecf3c2`.
- The merged PR was in the clean public release repository `pentiumxp/codex-mobile-web-public`:
  - PR #1: `增加 macOS 共享启动支持并优化手机端消息显示`
  - Author: `franksong2702`
  - Merge commit: `73ff0bd`
- Local public release path `C:\Users\xuxin\Documents\codex-mobile-web-public` was fast-forwarded to `73ff0bd`.
- Public PR changed:
  - macOS launch scripts: `codex-app-server-mux-macos.sh`, `start-codex-desktop-shared-macos.sh`, `start-codex-mobile-web-macos.sh`, `start-codex-shared-mobile-macos.sh`
  - macOS README instructions
  - mobile Markdown rendering styles/logic
  - small server/mux memory-pressure and path-resolution fixes
- Validation in the public release repo:
  - `npm.cmd run check` passed.
- Not yet integrated into the private source workspace:
  - The private workspace currently has uncommitted local changes in overlapping files, including `server.js`, `public/app.js`, `public/styles.css`, `codex-app-server-mux.js`, and `README.md`.
  - Do not blindly copy or merge the public PR into the private workspace without reconciling it with the newer private approval-proxy and shared-stream changes.

## 2026-05-04 Private/Public Merge And Push Preparation

- User asked to push current private modifications and also merge the public PR.
- Process used:
  - Removed unused `web-push` dependency and untracked `package-lock.json`; the dependency was from earlier Web Push investigation and had no implementation references.
  - Committed private approval/shared-stream work first as `eb33384 Add shared approval controls`.
  - Added the local public release repo as remote `public` and fetched `public/main`.
  - Cherry-picked the four non-merge commits from public PR #1 into the private repository to preserve Frank Song's authorship and avoid unrelated-history merge noise:
    - `572f936` from public `5f39aa7`: macOS launcher and app-server path fixes
    - `1c73332` from public `858af2e`: macOS one-command shared/mobile launcher
    - `ea05c4c` from public `4c2cdb5`: mobile Markdown rendering
    - `eb5cb50` from public `59414eb`: lower live long-message memory pressure
  - Resolved the README conflict by keeping private Windows approval/keep-alive docs and adding the public macOS launcher instructions.
  - Added `.gitattributes` in `9c6969c` to force `*.sh` files to LF so `npm run check:macos` works from Windows checkouts.
- Validation after integration:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed under available Windows bash after LF normalization.
  - `git diff --check` passed.
- Before pushing, ensure the clean public release repository is synchronized from the private source without copying `.agent-context/` or `AGENTS.md`.

## 2026-05-04 Mux Reconnect History Replay Fix

- User-reported issue:
  - After replacing mux, if Codex Desktop exits and then reopens, the shared stream still receives new messages, but Desktop does not backfill messages emitted while Desktop was offline.
- Runtime finding:
  - The current mux endpoint stayed alive at port `62570` with mux PID `12780` and app-server PID `44104`.
  - Mobile Web remained connected and healthy (`transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`).
  - Desktop reconnects were visible in mux log as `attached desktop stdio to existing mux 127.0.0.1:62570`, so the stream was connected; only offline event replay was missing.
- Root cause:
  - Keep-alive mux only cached and replayed the `initialize` result for reconnecting clients.
  - App-server notifications emitted while Desktop stdio was disconnected were broadcast to currently connected clients but not stored for later replay.
- Code change:
  - `codex-app-server-mux.js` now keeps a bounded replay buffer for recent `turn/*`, `item/*`, `thread/*`, and `account/rateLimits/updated` notifications.
  - On client `initialize`, mux replays unresolved server requests and buffered notifications to the reconnecting client.
  - Synthetic `mux/userMessage` notifications are also cached for replay.
  - New mux endpoint capability includes `notificationReplay: true`.
  - Replay controls:
    - `CODEX_MUX_REPLAY_BUFFER_LIMIT`, default `1200`
    - `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS`, default `1800000` (30 minutes)
- Validation:
  - `node --check codex-app-server-mux.js` passed.
  - `npm.cmd run check` passed.
- Operational note:
  - The fix only applies after starting a new mux process from the updated file.
  - Events missed before the replay buffer existed cannot be reconstructed from mux memory; future offline intervals after replacement should replay within the buffer limit/age.
- Runtime activation:
  - User approved immediate mux replacement.
  - `start-codex-desktop-shared.ps1 -ForceRestartMux` returned `aborted` from the tool layer, but the replacement completed.
  - New endpoint file points to port `58264`, mux Node PID `28708`, real app-server child PID `50760`, started `2026-05-04T04:28:54.284Z`.
  - Endpoint capabilities are `{ mobileUserMessageEcho: true, serverRequestProxy: true, notificationReplay: true }`.
  - Mobile Web was explicitly reconnected to port `58264`; authenticated `/api/status` reported `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Mux log confirmed replay path is active: `replayed 288 buffered message(s) to c3 after cached initialize`.

## 2026-05-04 Mobile Foreground Black-Screen Follow-Up

- User confirmed the input-method/external-app return path could still produce a black screen.
- Likely cause:
  - The previous resume path refreshed data once, but iOS can return from an input-method permission/app switch with a stale visual viewport height or blank composited layer.
  - A single resume render can run before `visualViewport.height` / `innerHeight` stabilizes.
- Changes:
  - `public/app.js` now maintains `--app-height` from `visualViewport.height`, `window.innerHeight`, or document client height.
  - `public/styles.css` uses `height: var(--app-height)` for `.app` instead of direct `100dvh`.
  - Foreground resume now runs visual-only recovery passes at multiple short delays, re-shows the app shell, re-renders cached content, updates composer height, and forces a lightweight repaint before doing the network refresh.
  - `visualViewport` resize/scroll and window resize update the viewport height variable without focusing the textarea.
- Validation:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - Existing browser tabs need a page refresh to load the updated `public/app.js` and CSS before this fix can affect the black-screen path.

## 2026-05-04 Desktop Reconnect Replay Rollback Fix

- User-reported issue:
  - After Desktop restart, the current thread initially displayed complete history, then a refresh rolled the visible UI back to an earlier partial point.
  - New turns still streamed to Desktop, which indicates the live connection itself was still attached.
- Likely cause:
  - The new mux notification replay sent historical `turn/*` and `item/*` incremental notifications to Desktop after cached `initialize`.
  - Desktop had already loaded durable thread history, so replaying older incremental UI events could overwrite or roll back the foreground view.
- Code change:
  - `codex-app-server-mux.js` now records each client's `initialize.params.clientInfo`.
  - Historical notification replay is sent only to clients identified as `codex-mobile-web` by default.
  - Pending approval/server requests are still replayed to all clients.
  - `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=1` can opt Desktop back into historical notification replay for diagnostics.
- Validation:
  - `node --check codex-app-server-mux.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - This code change needs a fresh mux process before it affects Desktop reconnect behavior.
- Runtime activation:
  - A forced mux restart was requested; the tool reported `aborted`, but the restart completed.
  - Current endpoint file points to port `49686`, mux Node PID `11168`, real app-server child PID `54496`, started `2026-05-04T04:44:08.760Z`.
  - Mux log shows Desktop initialized with `name=Codex Desktop` and Mobile Web initialized with `name=codex-mobile-web`.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, endpoint port `49686`.

## 2026-05-04 Duplicate Message Submission Guard

- User-reported issue:
  - A message could appear to submit twice, and long-running/stale turns increasingly required manual Stop.
- Runtime cleanup:
  - Found and stopped an old server process from `C:\Users\xuxin\Documents\Agent\tools\cli\codex-mobile-web` and its independent app-server child.
  - Current Mobile Web status remained healthy afterward: `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Code change:
  - `public/app.js` now adds a `clientSubmissionId` to each composer message submission.
  - `server.js` keeps a short bounded message-submission dedupe map.
  - Server dedupe checks both `clientSubmissionId` and a content fingerprint made from thread id, active turn id, cwd, model, effort, message text, and attachment metadata.
  - If the same submission arrives again within `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS` (default 90 seconds), the server returns the original in-flight/completed result and does not call app-server `turn/start` or `turn/steer` again.
  - Duplicate uploaded files saved by the repeated request are unlinked if they are under the configured upload root.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - The server-side dedupe fix needs the Mobile Web Node server to be restarted before it affects live submissions.

## 2026-05-04 Stale Running Turn Diagnosis

- User-reported issue:
  - Desktop/Mobile interaction increasingly appears stuck and often requires pressing Stop.
  - The same user message could appear twice before the dedupe guard was added.
- Current evidence:
  - Mobile Web `/api/status` remains healthy: `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, mux port `49686`.
  - Thread `019ded32-ed92-7681-9591-0e4d457c5274` contains stale turn `019df149-500f-74b3-a038-849c5d2cfda7` still reported by app-server as `inProgress` with no `completedAt` / `durationMs`.
  - Later turns in the same thread already exist, including completed turns, so the stale in-progress turn is not the actual latest user intent.
  - Mux/app-server log repeatedly shows `thread/resume overrides ignored for running thread 019ded32-ed92-7681-9591-0e4d457c5274`, which is consistent with app-server treating the thread as still running and causing follow-up submissions/resumes to behave abnormally.
  - A long-lived PowerShell child under the app-server is the normal Rust command-safety PowerShell AST parser, not necessarily the stuck user command.
- Recommended next action:
  - Use the app-server `turn/interrupt` API once for stale turn `019df149-500f-74b3-a038-849c5d2cfda7`.
  - After interrupt, re-read only that turn's status and verify it is no longer `inProgress`.
  - Avoid broad `.codex` scans and avoid full mux replacement unless interrupt fails.

## 2026-05-04 iOS Composer Toolbar Mitigation And Activity Feedback - 14:02 +08:00

- User-reported issue:
  - On iOS, focusing the composer showed an extra browser/input accessory row above the keyboard, taking significant vertical space.
  - During long active turns, the UI could feel stuck when no command/file card or text delta was visibly changing.
- Code changes:
  - `public/index.html` replaces the native composer `textarea` with a `contenteditable` textbox.
  - `public/app.js` adds contenteditable-specific helpers for text read/write, enabled state, autosizing, paste handling, and Enter-to-send / Shift+Enter newline behavior.
  - `public/styles.css` moves the composer input styling to `.message-input`.
  - The active turn timer can now append a compact activity label from live app-server events: `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, `等待批准`, etc.
  - Activity labels update only the timer text; they do not reintroduce reasoning rows and do not force full conversation rerenders.
- Validation:
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Operational note:
  - No Node server restart is required for these static frontend changes.
  - Existing browser tabs must refresh the page to load the new `index.html`, `app.js`, and `styles.css`.
  - The `contenteditable` mitigation can reduce the iOS native textarea accessory row, but iOS/browser-owned IME UI cannot be completely controlled from page CSS.

## 2026-05-04 Stable Turn Timer Activity Label Layout

- User-reported issue:
  - The new activity label in the top-right turn timer made the elapsed time text shift horizontally when labels such as `思考` and `等待批准` had different lengths.
- Code changes:
  - `public/app.js` now renders timer content as separate `.turn-timer-time` and `.turn-timer-detail` spans instead of one variable-length text node.
  - `public/styles.css` gives the timer a fixed responsive width, keeps the elapsed time span fixed, and ellipsizes only the activity label.
- Validation:
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
- Operational note:
  - No Node server restart is required because this only changes static frontend files.

## 2026-05-04 README Update Before Private Push

- User requested commit and push, with README update notes made more detailed.
- README changes:
  - Expanded interface notes for activity labels, fixed timer layout, contenteditable composer, and no programmatic composer focus.
  - Added `Current Update Notes` covering shared Desktop/Mobile stream behavior, mux replay, approval controls, duplicate message submission handling, active-turn steering, and mobile UI recovery.
  - Added a restart/refresh matrix for frontend files, `server.js`, mux changes, shared launcher changes, and macOS scripts.
  - Documented `notificationReplay` in the mux endpoint capability example.
  - Added environment variables for message dedupe and mux replay buffer controls.
  - Added troubleshooting notes for `Loading thread`, Desktop/Mobile stream mismatch, missing approval cards, and iOS blank/black page recovery.
- Validation before commit:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Scope:
  - Push target is the private `origin` remote: `https://github.com/pentiumxp/codex-mobile-web.git`.
  - The local `public` remote points to the clean public release directory and is not pushed by this step.

## 2026-05-04 Settled Timer Label

- User requested that right-side timer activity labels such as `同步` should not remain semantically active after the turn has ended.
- Change:
  - `public/app.js` now renders the settled/final timer detail as `已结束` when the latest turn has a final duration.
  - `README.md` and `PROJECT_CONTEXT.md` document the settled timer label behavior.
- Validation pending:
  - Run normal checks before commit and push.

## 2026-05-04 Runtime Inheritance And Mux Backpressure Fix

- User paused remote GitHub push; local commit/amend is allowed, but do not run `git push` until explicitly requested again.
- User-reported issues:
  - Desktop showed `Codex app-server websocket closed (code=1)` and stopped refreshing.
  - Mobile Web mid-turn messages sent through `turn/steer` could disappear from the sender's visible conversation.
  - Mobile Web turns did not inherit Desktop/thread permissions and output-detail settings closely enough, causing approval prompts even when Desktop was effectively running with high permissions.
- Findings:
  - Mux log showed `dropping slow tcp client ...`; the mux treated one `socket.write()` backpressure signal as a dead client and closed it.
  - Current app-server `turn/steer` returns a turn id but may not emit a visible user-message item.
  - Thread runtime permissions are available from the latest rollout `turn_context` and `state_5.sqlite` thread metadata; the current thread has `sandbox_policy={"type":"danger-full-access"}` plus a root-write/network-enabled permission profile.
- Changes:
  - `codex-app-server-mux.js` now logs TCP backpressure and waits for `drain` instead of closing the client.
  - `codex-app-server-mux.js` now uses deterministic synthetic user-message ids when `clientSubmissionId` is present.
  - `server.js` now reads the latest rollout `turn_context` and state DB metadata for thread runtime settings.
  - `server.js` forwards inherited approval policy, sandbox policy, reasoning summary, and config verbosity where supported during `thread/resume` / `turn/start`.
  - `server.js` sends a mux-local user-message echo after successful active-turn `turn/steer`.
  - `README.md` and `PROJECT_CONTEXT.md` document runtime inheritance and the backpressure behavior.
- Validation:
  - `node --check server.js` passed.
  - `node --check codex-app-server-mux.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation notes:
  - `server.js` changes require restarting Mobile Web.
  - `codex-app-server-mux.js` changes require replacing the keep-alive mux, normally through `start-codex-desktop-shared.ps1 -ForceRestartMux` after Desktop is closed or ready to reconnect.

## 2026-05-04 Runtime Fix Activation Confirmed

- User restarted Codex Desktop after the mux backpressure fix.
- Confirmed mux endpoint file now points to a fresh shared endpoint:
  - Protocol: `jsonl-tcp`
  - Endpoint: `127.0.0.1:51838`
  - Mux PID: `32948`
  - Real app-server child PID: `24208`
  - Capabilities: `mobileUserMessageEcho=true`, `serverRequestProxy=true`, `notificationReplay=true`
- Confirmed active connections:
  - Mobile Web Node PID `46604` is listening on `0.0.0.0:8787`.
  - Desktop adapter PID `44640` is connected to mux port `51838`.
  - Mobile Web PID `46604` is connected to mux port `51838`.
- Authenticated `/api/status` confirms:
  - `ready=true`
  - `transport=external-jsonl-tcp`
  - `sharedRequired=true`
  - `lastError=null`
  - endpoint port `51838`
- Mux log after the fresh endpoint start no longer shows new `dropping slow tcp client` entries; the old entries were before the 07:32 mux restart.
- Remaining observed app-server warnings are upstream/runtime warnings, not Mobile Web transport failures:
  - ChatGPT backend plugin/event requests returning `403 Forbidden`.
  - Obsidian MCP resource/list template methods not found.
  - `thread/resume` overrides ignored for an already running thread; inherited runtime settings are still applied on the next `turn/start` path.
- Remote push remains paused by user instruction; local branch is ahead of `origin/main`.

## 2026-05-04 Visible External Input Regression Fix

- User-reported issue:
  - Inputs sent from Mobile Web during an active turn were no longer visible in the message stream.
  - The regression appeared after adding duplicate-submission protection.
- Root causes:
  - `server.js` deduplicated modern submissions by both `clientSubmissionId` and content fingerprint. This could suppress intentional repeated short messages inside the dedupe window.
  - Synthetic mux-local `mux-user-*` user-message echo items are live stream artifacts; app-server historical thread snapshots may not include them. A later thread refresh could therefore replace the visible item list and drop the user's mid-turn input.
- Changes:
  - `server.js` now deduplicates requests with `clientSubmissionId` by that id only.
  - Content-fingerprint dedupe remains only for legacy/no-id requests.
  - `public/app.js` thread refresh merges now preserve local-only `mux-user-*` user-message items.
  - `public/app.js` also preserves richer visible fields for existing items when an incoming snapshot is shorter for the same item id.
  - `README.md` and `PROJECT_CONTEXT.md` document the revised dedupe and merge behavior.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation notes:
  - `server.js` changes require restarting Mobile Web.
  - `public/app.js` changes require refreshing existing browser/mobile tabs to load the new frontend bundle.

## 2026-05-04 Full Access Approval Normalization

- User-reported issue:
  - Mobile Web still showed many command approval cards even though the thread was expected to be in full-access mode.
- Findings:
  - Current thread `019ded32-ed92-7681-9591-0e4d457c5274` has `sandbox_policy={"type":"danger-full-access"}` in `state_5.sqlite`.
  - The same thread and latest rollout `turn_context` still store `approval_policy="on-request"`.
  - Therefore the sandbox/file permissions were being inherited, but approval policy still allowed command approval prompts.
- Change:
  - `server.js` now treats inherited full access as authoritative for Mobile Web new turns.
  - If sandbox policy is `dangerFullAccess`, or the permission profile grants root write access, and approval policy is missing or `on-request`, Mobile Web sends `approvalPolicy: "never"` on `turn/start`.
  - This applies only to new turns. Existing active turns keep their already-started runtime settings; `turn/steer` cannot change approval policy mid-turn.
- Documentation:
  - `README.md` and `PROJECT_CONTEXT.md` document this full-access approval normalization.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Runtime activation:
  - Mobile Web restarted after the change.
  - Current Mobile Web Node PID `56684` listens on `0.0.0.0:8787`.
  - Authenticated `/api/status` reports `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`, endpoint port `51838`.
  - Existing active turns keep their original approval policy; the full-access normalization applies to subsequent `turn/start` calls.

## 2026-05-04 Approval Card Placement And Settled Compact State

- User-reported issue:
  - Command approval cards remained as large cards at the bottom of the conversation after approval, occupying too much space.
- Changes:
  - `public/app.js` now associates approval requests with their `params.turnId` when available.
  - Approval cards for visible turns render inside the matching turn instead of in the bottom fallback stack.
  - Only active waiting approvals without a visible turn remain in the bottom fallback stack.
  - Answered/resolved approvals render as a compact one-line in-turn status.
  - `public/styles.css` adds compact approval row styling and in-turn approval spacing.
  - `README.md` and `PROJECT_CONTEXT.md` document the behavior.
- Validation:
  - `node --check public/app.js` passed.
  - `node --check server.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This approval placement change is frontend/CSS only; existing browser tabs need a page refresh to load it.

## 2026-05-04 Public Repository PR Merge Sequence

- User requested checking the latest public GitHub repository and merging PRs in order starting from PR #6.
- Public repository:
  - `https://github.com/pentiumxp/codex-mobile-web-public`
  - Local path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
- Merged and pushed public PRs:
  - PR #6 `增加协议级回归测试` -> merge commit `f2dbf90bc0f352b21ff86f5deba7052e830beb97`
  - PR #7 `完善手机端 server request 处理` -> merge commit `f3608e744628879a97fa564cabb2ad9369f0c655`
  - PR #8 `增加 PWA 主屏幕支持` -> merge commit `ffa2792eabbf33cd12af56090d7c07e80a48a725`
- PR #6 local finding:
  - Its new `npm test` initially failed on Windows because the test tried to spawn `mock-codex-app-server.js` directly, which raised `spawn EFTYPE`.
  - The merge commit fixed the test to launch the mock through `process.execPath` and pass the mock script via `CODEX_MUX_CODEX_ARGS`, making the test cross-platform.
- PR #7 merge details:
  - Three-way merge after PR #6 preserved the new CI/test files.
  - Actual changed files were `public/app.js`, `public/styles.css`, and `server.js`.
- PR #8 merge details:
  - Resolved `package.json` conflict by keeping `npm test` from PR #6 and adding `public/sw.js` to `npm run check`.
  - Added PWA manifest, icons, and service worker static shell caching.
- Validation completed after each merge as applicable:
  - `npm.cmd test`
  - `npm.cmd run check`
  - `npm.cmd run check:macos`
  - `git diff --check`
  - For PR #8, also checked `manifest.json` parsing and PNG icon dimensions `192x192`, `512x512`, and `180x180`.
- Final public repository state:
  - `main` is synchronized with `origin/main`.
  - No open PRs remained after merging #6, #7, and #8.

## 2026-05-04 Live Agent Text Disappearing During Stream

- User-reported issue:
  - During live agent output, text appeared line by line, then the whole current paragraph/section could disappear briefly and reappear a few seconds later.
- Diagnosis:
  - The running Mobile Web process was confirmed to use private workspace `C:\Users\xuxin\Documents\codex-mobile-web\server.js`, not the public release checkout.
  - Public PR merging did not directly change the running code.
  - Two frontend merge paths could still cause the observed symptom:
    - `item/completed` / `item/started` upserts replaced an existing streamed item with the incoming item object, even if the incoming object had less visible text.
    - Thread refresh merges preserved synthetic `mux-user-*` user messages, but did not preserve local-only visible assistant/operation items when the app-server snapshot was shorter than the local streamed state.
- Code change:
  - `public/app.js` now uses `mergeItemPreservingVisibleFields()` when upserting an existing item, so short completion/status events cannot erase already-streamed text.
  - `public/app.js` now preserves local-only visible non-reasoning items when an incoming turn snapshot has lower visible weight than the existing local turn.
  - The same frontend fix was also applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public\public\app.js`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js`; the Node server does not need to restart.

## 2026-05-04 Image Upload Duplicate And Base64 Rendering Fix

- User-reported issue:
  - Uploading an image could show the submitted user message twice.
  - One copy could render a large base64/data-url-like payload as garbled text before the attachment path.
- Diagnosis:
  - The affected Hermes thread item contained a normal text attachment summary with the local upload path, plus a second app-server-snapshot part shaped like `{ truncated: true, totalChars, preview: "{\"type\":\"image\",\"url\":\"data:image/png;base64,...` }`.
  - `public/app.js` did not recognize that truncated snapshot part as an image, so it rendered the compacted JSON preview as ordinary text.
  - During active-turn image input, Mobile Web can first show a synthetic `mux-user-*` echo, then later receive the real app-server `userMessage` with a different item id; previous merge logic preserved both.
- Code change:
  - `public/app.js` now recognizes truncated data-image preview payloads as image input parts, preventing the base64 JSON preview from rendering as text.
  - When a matching attachment summary exists, the image renders from the local upload path as a thumbnail.
  - `public/app.js` now compares synthetic `mux-user-*` user messages with incoming real `userMessage` items by normalized text and upload paths.
  - Matching synthetic echoes are dropped during thread refresh merges and when a real `userMessage` is upserted, preventing duplicate display.
  - The same fix was applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public\public\app.js`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js`.

## 2026-05-04 Input Method Black-Screen Recovery And Assistant Duplicate Guard

- User-reported issues:
  - Switching to the Doubao input method and letting it switch back could still leave the mobile Web UI black until the app was minimized and reopened.
  - Assistant/Codex output cards were frequently duplicated in the UI, while the fetched thread history did not contain duplicate agent messages.
- Diagnosis:
  - Existing foreground recovery relied mostly on `visibilitychange`, `pageshow`, `window focus`, `orientationchange`, and `visualViewport` resize/scroll.
  - Some input-method return paths do not reliably fire page-level focus/visibility events, so the composited viewport can stay stale or black.
  - Assistant duplicate display was caused by the local merge guard preserving a streamed local `agentMessage` while a later server snapshot supplied the same text under a different item id.
- Code change:
  - `public/app.js` now has a visual-only recovery pulse separate from network refresh.
  - Visual recovery is scheduled from `window blur`, `focusin`, `focusout`, `resize`, and `visualViewport` resize/scroll.
  - Heavy visual recovery updates `--app-height`, re-shows the app shell, applies a short compositing transform, and uses delayed repeated repaint pulses without forcing API refreshes.
  - `focusin`, `focusout`, `resize`, and `visualViewport` recovery are lightweight and do not transform the scroll container.
  - Touch/pointer start recovery was deliberately not used because it can cancel normal iOS scrolling when the user starts dragging the conversation.
  - `public/styles.css` adds stronger temporary compositing/repaint styles for `visual-recovering` and `resume-repaint`.
  - `public/app.js` now deduplicates local streamed `agentMessage` / `plan` items against incoming real items when the incoming text is the same or a longer continuation of the local text.
  - The same frontend/CSS changes were also applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend/CSS change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js` and `public/styles.css`; the Node server does not need to restart.
