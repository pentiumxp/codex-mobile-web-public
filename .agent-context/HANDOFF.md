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
