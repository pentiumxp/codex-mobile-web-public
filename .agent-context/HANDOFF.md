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

## 2026-05-06 Web Push Thread Switch And Swipe Continuation Fix - 13:52 +08:00

- User-reported issues:
  - Clicking a Web Push notification opened/focused Mobile Web, but the app did not switch to the notification's thread.
  - The thread-list left-swipe `压缩续接` action flashed briefly and then closed instead of staying visible.
- Code changes:
  - `public/service-worker.js` now extracts the target `/?thread=<threadId>` from notification data and posts a `codex-open-thread` message to an already-open Mobile Web window after focusing it. If no window exists, it opens the URL with the thread parameter.
  - `public/app.js` now listens for service-worker `codex-open-thread` messages, stores the target thread id, clears the URL parameter, and directly calls `loadThread()` so an iOS/PWA notification click switches threads without depending on browser navigation.
  - `public/app.js` also re-checks URL thread parameters on `pageshow` and `focus`, covering browser/PWA resume cases where the app is opened with `?thread=...`.
  - `public/app.js` now uses pointer capture for thread-row swipes, no longer cancels the gesture on `pointerleave`, and suppresses the synthetic same-gesture card click for 1.2 seconds so the revealed `压缩续接` button remains open.
- Documentation:
  - `README.md` documents Web Push thread switching and the persistent left-swipe action.
  - `.agent-context/PROJECT_CONTEXT.md` records the service-worker message path and persistent swipe behavior.
- Activation note:
  - Static frontend/service-worker change. Existing PWA/browser sessions may need a refresh so the new `app.js` and updated service worker are installed and activated.

## 2026-05-06 iOS Swipe Continuation Follow-up - 13:59 +08:00

- User-reported issue:
  - The left-swipe `压缩续接` action still flashed and disappeared on the phone.
- Follow-up code change:
  - `public/app.js` now ignores touch-origin Pointer Events and uses explicit `touchstart` / `touchmove` / `touchend` / `touchcancel` handlers for thread-list rows.
  - `touchcancel` now finalizes the gesture from the last horizontal position instead of blindly clearing the row. This covers iOS canceling pointer/touch gestures after the action has already been revealed.
  - The open threshold was lowered to about 28px / 32% of action width so a deliberate short left swipe keeps the `压缩续接` action open.
  - A capture-phase click guard now suppresses the same-gesture synthetic click on the row while still allowing immediate taps on the revealed action button.
- Activation note:
  - Static frontend-only change. Existing PWA/browser sessions need a refresh to load the updated `public/app.js`.

## 2026-05-06 Public Sync After User Test - 14:03 +08:00

- User instruction:
  - After testing the private build, the user explicitly approved public push.
- Public release sync:
  - Synchronized current private `README.md` and `public/app.js` into `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Preserved public release differences: `README.md` uses `https://github.com/pentiumxp/codex-mobile-web-public.git` and `cd codex-mobile-web-public`; `public/app.js` registers `/sw.js`.
  - Updated public `public/sw.js` by keeping its PWA cache shell and adding the Web Push notification-click `codex-open-thread` message path.
  - Public README includes Chinese documentation for Web Push thread switching and iOS/PWA left-swipe `压缩续接` behavior.
- Validation:
  - Public `npm.cmd test` passed.
  - Public `npm.cmd run check` passed.
  - Public `git diff --check` passed with line-ending warnings only.
  - Public tracked-file privacy scan excluding `.gitignore` returned no matches for local user paths, Tailscale host markers, LAN address, Hermes name, or the private GitHub clone URL.
- Published:
  - Public commit `f8ac2de 修复通知线程切换和左滑续接` pushed to `origin/main`.

## 2026-05-06 Web Push Thread Title Binding Fix - 15:02 +08:00

- User-reported issue:
  - A task completed in the `Hermes Web` thread, but the Web Push notification appeared labeled as `Codex Mobile`.
- Diagnosis:
  - `server.js` only remembered observed `turn/started` turn ids in a `Set`.
  - On `turn/completed`, it recomputed thread title and click target from the completion event's params. In the shared mux stream, those completion params can be incomplete or use different thread-id/title fields, so the notification could be labeled from the wrong available thread/title.
- Code change:
  - `server.js` now stores `turn/started` metadata in a `Map` keyed by turn id, including normalized thread id and thread title.
  - `turn/completed` now reuses the started-turn metadata for notification title, dedupe key, tag, and `/?thread=<threadId>` click target.
  - Thread id extraction now accepts `threadId`, `conversationId`, snake_case variants, `thread.id`, and nested `turn.threadId` / `turn.conversationId` variants.
  - Turn-completed notification title is now the thread title, with body `This turn 已结束 · <local time>`, so iOS/PWA notifications show the actual completed thread instead of a generic app title.
- Documentation:
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` document the bound turn metadata and thread-title notification behavior.
- Activation note:
  - `server.js` change requires restarting the 8787 Mobile Web listener. Public sync was not performed; wait for user testing and explicit public approval.

## 2026-05-06 Default User-Logon Startup Simplification - 00:35 +08:00

- User-requested change:
  - Do not make `LocalSystem` the default startup mode. The simpler default should be a Windows user-logon task because WSL access requires the user context.
  - The user-logon task must still be no-window.
- Code/documentation changes:
  - `install-codex-mobile-web-startup.ps1` now defaults to an `AtLogOn` interactive Scheduled Task for the current Windows user. It no longer silently converts missing `-InteractiveLogon` into `-RunAsSystem`.
  - The default task still runs `wscript.exe start-codex-mobile-web-hidden.vbs`, so both user-logon and optional `-RunAsSystem` modes launch without a visible console window.
  - `-RunAsSystem` is now an explicit optional mode only, for cases that need startup before user logon or survival after sign-out and do not need WSL.
  - Added `-UserProfilePath` to the installer so SYSTEM/elevated automation can explicitly target a real Windows user profile when registering the default user-logon task.
  - README now documents the user-logon no-window task as the primary install path and moves `LocalSystem` into an optional caveat.
  - `.agent-context/PROJECT_CONTEXT.md` now records the default no-window user-logon startup rule and the two context-compaction display states.
- Runtime note:
  - No runtime reinstall was needed during this change because the existing `Codex Mobile Web` task was already `LogonType=Interactive`, `RunLevel=Limited`, owned by `GMK\xuxin`.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `install-codex-mobile-web-startup.ps1`.
  - `git diff --check` passed with line-ending warnings only.
  - Current Scheduled Task action was verified as `wscript.exe "...\start-codex-mobile-web-hidden.vbs" ...`, with `LogonType=Interactive`, confirming the user-logon task is still no-window.
- Public release sync:
  - Synchronized public-safe files to `C:\Users\xuxin\Documents\codex-mobile-web-public`: `README.md`, `install-codex-mobile-web-startup.ps1`, `server.js`, `public/app.js`, `public/index.html`, and `public/styles.css`.
  - Preserved the public release differences: `public/app.js` registers `/sw.js`, and README uses `https://github.com/pentiumxp/codex-mobile-web-public.git`.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, PowerShell parser check for the installer, Git Bash macOS shell parser check, `git diff --check`, and the tracked-file privacy scan excluding `.gitignore`.

## 2026-05-06 Mobile Web SSE Reconnect And Stutter Fix - 09:55 +08:00

- User-reported issue:
  - The Web App frequently showed `Shared`, `Reconnecting`, and `Connected` state changes.
  - During these events the mobile client visibly stalled and did not update, so it was not treated as a cosmetic state-label issue only.
- Findings:
  - The 8787 listener and shared app-server were healthy after reboot: `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - `tailscale serve status` still mapped `https://gmk.tail62e8ce.ts.net:8443/` to `http://127.0.0.1:8787`.
  - Local SSE diagnostics showed that Mobile Web was receiving large unrelated app-server notifications from other active shared threads, especially `turn/diff/updated` payloads. The browser had to receive and parse those payloads before client-side thread filtering could ignore them.
  - The old frontend recovery path also amplified transient `EventSource.onerror` events by immediately showing `Reconnecting` and, after 1.5 seconds, reloading status, thread list, and current thread detail.
- Code changes:
  - `server.js` now drops `turn/diff/*` notifications before broadcasting to Mobile Web SSE clients.
  - `/api/events` now records an optional `threadId` query parameter per SSE client.
  - `server.js` filters turn/item notifications to the SSE client's selected thread, while still allowing status, rate-limit, and thread-list-level notifications.
  - `public/app.js` now includes the current thread id in the SSE URL and reconnects SSE when the selected thread changes or clears.
  - `public/app.js` keeps the last real backend connection status so normal thread list/detail refreshes no longer overwrite `Shared` with `Connected`.
  - `public/app.js` delays the visible reconnect notice for 3 seconds and only runs full recovery refreshes after 8 seconds of sustained SSE outage, reducing stutter from short browser/Tailscale long-connection interruptions.
- Activation:
  - Restarted only the 8787 Node listener; the supervisor relaunched it under `GMK\xuxin`.
  - New listener PID after activation: `6088`.
  - Shared mux/app-server were not restarted.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

  - Authenticated `/api/status` returned ready with endpoint port `59136`.
  - Local SSE test with `threadId=019df88b-cc8b-7413-83f4-625b39083dcc` timed out normally after 10 seconds, included status, contained no `turn/diff/*`, and did not include the unrelated Hermes thread id observed before the fix.
- Public release sync:
  - Synchronized `server.js` and `public/app.js` to `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Preserved public `public/app.js` service worker registration on `/sw.js`.
  - Public validation passed: `npm.cmd test`, `npm.cmd run check`, `git diff --check`, and tracked-file privacy scan excluding `.gitignore`.

## 2026-05-06 Public README Release Requirement

- User instruction:
  - Future public-repo commits must include a detailed README update.
  - The README update must include Chinese documentation explaining the user-visible change, usage impact, and any operational notes.
- Follow-up user instruction on 2026-05-06 13:54 +08:00:
  - Do not update the public repo immediately during normal private development.
  - Wait until the user has tested the private build and explicitly instructs a public update before syncing, committing, or pushing `C:\Users\xuxin\Documents\codex-mobile-web-public`.
- Durable context update:
  - `.agent-context/PROJECT_CONTEXT.md` records this as a public release rule.
- Operational implication:
  - Do not treat a public sync as complete when only code files are copied/committed. If public code changes are pushed, update `C:\Users\xuxin\Documents\codex-mobile-web-public\README.md` in the same public commit unless the user explicitly excludes README changes.
  - `git diff --check` passed with only Git line-ending warnings.

## 2026-05-06 Rollout Continuation Bootstrap Detail

- User-requested adjustment:
  - The rollout-size action should be treated as "压缩续接" rather than an ordinary "新线程".
  - The continuation thread must receive enough explicit detail to avoid missing durable GitHub/private/public/README requirements after a thread switch.
- Code behavior:
  - `public/app.js` now labels the over-threshold action as `压缩续接`, updates the warning banner and confirmation prompt, and explains that the source thread summary, recent context, GitHub release rules, and handoff excerpts are written into the first message.
  - `server.js` now builds a detailed bootstrap message before starting the first continuation turn. The message includes source thread id/title/cwd/rollout path/rollout size/status, runtime settings, recent visible source turns from `thread/turns/list`, `.agent-context/PROJECT_CONTEXT.md`, critical `.agent-context/HANDOFF.md` GitHub/release sections, the latest handoff tail, and explicit reminders about public README and privacy-safe public sync.
  - `server.js` now defaults continuation runtime settings from the source thread runtime context, then applies any user-selected permission-mode override.
  - `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` controls the maximum bootstrap message size, default `120000`.
  - `CODEX_MOBILE_CONTINUATION_RECENT_TURNS` controls the number of recent source turns summarized, default `12`, capped at `30`.
- Documentation:
  - `README.md` documents the "Rollout 压缩续接" behavior in Chinese and records the new environment variables.
  - `.agent-context/PROJECT_CONTEXT.md` records that the continuation bootstrap must carry explicit release rules and not rely only on a generic "read handoff" instruction.

## 2026-05-06 Thread Load Timing And Swipe Continuation

- User-reported issue:
  - Opening/loading a thread felt slow in Mobile Web.
  - The user also requested proactive `压缩续接` access through a left-swipe action.
  - Follow-up screenshot showed thread-list rows with the second metadata line clipped/overlapped after the left-swipe change.
- Runtime timing findings:
  - Local/LAN backend checks did not show app-server or 8787 service slowness during this check.
  - `http://127.0.0.1:8787/api/threads?limit=80&archived=false` was about `159ms`.
  - LAN `http://192.168.10.108:8787/api/threads?limit=80&archived=false` was about `65ms`.
  - Current newest thread detail `Codex Mobile 0505` was about `159ms` locally and `147ms` over LAN.
  - The slowest sampled visible detail read was `Hermes 05-05` at about `384ms`.
  - `/api/status` was healthy with `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - `tailscale netcheck` showed the nearest DERP as `sfo` around `150ms`, and `pentium-iphone` appeared active through relay `sfo`; phone-side Tailscale/HTTPS can therefore add visible latency beyond the local/LAN API timings.
- Code changes:
  - `public/app.js` now renders a hidden `压缩续接` action for every thread list row.
  - A left swipe on a thread row reveals that action; tapping the row while an action is open closes it rather than accidentally opening the thread.
  - Re-tapping an already loaded current thread now keeps the existing detail view instead of forcing a fresh "Loading thread" state; explicit refresh remains available through the refresh control.
  - Existing over-threshold current-thread banner still exposes the normal `压缩续接` button.
  - `public/styles.css` adds the swipe-reveal row layout and mobile-friendly action area.
  - The thread list now uses a vertical flex layout and keeps the swipe action layer behind a full-height card layer without clipping the row wrapper, avoiding iOS/PWA text clipping of thread metadata.
- Documentation:
  - `README.md` now documents proactive left-swipe continuation in English and Chinese.
  - `.agent-context/PROJECT_CONTEXT.md` records the left-swipe continuation rule.

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

## 2026-05-04 Late Mux User Echo Duplicate Guard

- User-reported issue:
  - The same Mobile Web `You` message could still appear twice, for example the text `主要是因为刚才Tailscale 没有直连，现在已经好了。`.
- Diagnosis:
  - The authenticated thread history for Hermes thread `019dde72-2de7-7542-b43f-d7fa0d98fb21` contained only one real `userMessage` for that text.
  - The duplicate was therefore a browser-local merge artifact, not a double write into app-server history.
  - Existing frontend logic handled the order `mux-user-*` echo first, real `userMessage` later. It did not handle the reverse order where the real item arrived first and a replayed or delayed `mux-user-*` echo arrived later.
- Code change:
  - `public/app.js` now detects a `mux-user-*` user-message echo that is shadowed by a matching real `userMessage` in the same item list.
  - Late shadowed mux echoes are dropped in `upsertItem`.
  - Thread refresh merges also remove shadowed mux echoes after merging existing and incoming items, covering replay/order variations.
  - The same fix was applied to the clean public release checkout at `C:\Users\xuxin\Documents\codex-mobile-web-public\public\app.js`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test`, `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
- Activation note:
  - This is a static frontend change. Existing browser/mobile tabs need a page refresh to load the fixed `public/app.js`; the Node server does not need to restart.

## 2026-05-05 Web Push Port Correction

- User requested restoring Codex Mobile Web to local port `8787`.
- Runtime state after correction:
  - Codex Mobile Web wrapper PID `60628`, Node PID `16148`.
  - Codex Mobile Web listens on `0.0.0.0:8787`.
  - Hermes Web currently listens on `0.0.0.0:8797` with Node PID `42396`.
  - Tailscale Serve maps `https://gmk.tail62e8ce.ts.net:8443/` to `http://127.0.0.1:8787`.
  - Tailscale Serve root `https://gmk.tail62e8ce.ts.net/` remains mapped to Hermes Web at `http://127.0.0.1:8797`.
- Code/doc state:
  - `server.js`, `start-codex-mobile-web.ps1`, `start-codex-mobile-web-macos.sh`, `README.md`, and `PROJECT_CONTEXT.md` have been restored to default Codex Mobile Web port `8787`.
  - Web Push work remains in progress in the working tree and is not yet committed.

## 2026-05-05 iOS Dynamic Island Safe Area

- User-reported issue:
  - The top menu bar occupied the iPhone Dynamic Island/status-bar area and the menu button became hard or impossible to tap.
- Changes:
  - `public/index.html` changed `apple-mobile-web-app-status-bar-style` from `black-translucent` to `black`.
  - `public/styles.css` now applies `env(safe-area-inset-top, 0px)` to the top conversation bar.
  - `public/styles.css` also applies the same top safe-area inset to the mobile sidebar, so the menu page header does not start under the status bar.
- Activation note:
  - This is a static frontend change. Existing phone/PWA sessions need a page refresh or app relaunch to load the updated HTML/CSS.

## 2026-05-05 Web Push Apple BadJwtToken Fix

- User-reported issue:
  - Notifications were enabled and a test notification was sent from Mobile Web, but no notification arrived.
- Diagnosis:
  - Runtime subscription existed in `%USERPROFILE%\.codex-mobile-web\web-push-subscriptions.json`.
  - The stored endpoint host was Apple Push (`web.push.apple.com`).
  - Authenticated `POST /api/push/test` initially returned `sent=0`, `failed=1`.
  - Direct diagnostic send showed Apple returned HTTP `403` with reason `BadJwtToken`.
  - The VAPID subject in `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json` was `mailto:codex-mobile-web@localhost`.
  - Reusing the same VAPID key with a non-localhost subject was accepted by Apple with HTTP `201`.
- Changes:
  - `server.js` default Web Push VAPID subject is now `mailto:codex-mobile-web@example.com` instead of a localhost address.
  - `server.js` automatically repairs existing runtime VAPID files whose subject contains `localhost`, while preserving the same public/private key pair.
  - `server.js` now returns sanitized Web Push send failure details from `/api/push/test`.
  - `public/app.js` now reports test-send failure explicitly instead of showing `No push subscription` when a subscription exists but delivery fails.
  - Turn-completed Web Push payloads now use `Codex Mobile Web` as the notification title and body `<thread-title> · This turn 已结束 · <local time>`.
  - Notification click targets include `/?thread=<threadId>`, and the browser now loads that thread directly from the URL even when it is not present in the first rendered thread list.
  - `README.md` documents Web Push setup, iOS Home Screen requirements, local runtime files, and the non-localhost VAPID subject requirement.
- Runtime state after restart:
  - Codex Mobile Web wrapper PID `48188`, Node PID `54184`.
  - Codex Mobile Web listens on `0.0.0.0:8787`.
  - Authenticated `GET /api/status` through `https://gmk.tail62e8ce.ts.net:8443` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Authenticated `GET /api/push/vapid-public-key` returned subject `mailto:codex-mobile-web@example.com`.
  - Authenticated `POST /api/push/test` returned `sent=1`, `failed=0`, `removed=0`.
  - `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json` has been repaired to the non-localhost subject; do not commit or copy the raw key material.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `node --check public/service-worker.js` passed.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Web Push Completion Title Adjustment

- User-reported issue:
  - Automatic turn-completed notifications used the thread name, for example `Hermes`, as the system notification title.
  - Test notifications already used the expected app title.
- Change:
  - `server.js` now uses `Codex Mobile Web` as the title for automatic turn-completed notifications.
  - The thread title remains in the notification body as `<thread-title> · This turn 已结束 · <local time>`.
  - `README.md`, `PROJECT_CONTEXT.md`, and the public release checkout were updated to match this behavior.
- Runtime activation:
  - Mobile Web was restarted on `0.0.0.0:8787`.
  - Current wrapper PID `51516`, Node PID `41324`.
  - Authenticated `/api/status` through `https://gmk.tail62e8ce.ts.net:8443` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
- Validation:
  - Private checkout: `npm.cmd run check`, `npm.cmd run check:macos`, and `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd run check`, `npm.cmd run check:macos`, `npm.cmd test`, and `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Windows Hidden Startup Task

- User requested making the Codex Mobile Web listener run with no visible window and start with Windows.
- Added scripts:
  - `start-codex-mobile-web-hidden.vbs` launches PowerShell through `WScript.Shell.Run(..., 0, True)` so the Windows startup path does not create a visible console window while the Scheduled Task remains running.
  - `start-codex-mobile-web-windowless.ps1` runs the existing `start-codex-mobile-web.ps1` path and appends logs to `%USERPROFILE%\.codex-mobile-web\codex-mobile-web.startup.log`.
  - `install-codex-mobile-web-startup.ps1` registers a per-user Scheduled Task named `Codex Mobile Web` that starts at Windows logon with `wscript.exe start-codex-mobile-web-hidden.vbs`.
  - `uninstall-codex-mobile-web-startup.ps1` removes the Scheduled Task and can stop it first with `-StopRunning`.
- The startup task defaults to `-RequireSharedAppServer`, matching the project rule that Mobile Web should not silently create a divergent managed app-server stream when the shared mux is expected.
- README and PROJECT_CONTEXT document the hidden startup behavior and reinstall/remove commands.
- Runtime activation:
  - Registered Scheduled Task `Codex Mobile Web` for the current Windows user.
  - Current task state is `Running`; Task Scheduler result `267009` means the long-running task is active.
  - Current hidden launcher PowerShell PID `36100`; Node listener PID `8124`.
  - `0.0.0.0:8787` is listening from PID `8124`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - PowerShell parser checks passed for the three startup scripts.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Windows Startup Survive Sign-Out Fix

- User reported that the hidden startup task stopped when the current Windows user signed out, then came back after the user logged in again.
- Root cause:
  - The first task was an interactive `AtLogOn` task with `LogonType=Interactive`.
  - Windows terminates processes in that interactive user session on sign-out, so the Mobile Web listener could not survive sign-out.
- Changes:
  - `install-codex-mobile-web-startup.ps1 -RunAsSystem` now creates an `AtStartup` trigger running as `LocalSystem`.
  - Running as `LocalSystem` requires elevated PowerShell, but does not store the Windows user password and is not tied to the visible desktop session.
  - `-InteractiveLogon` is available only for the older sign-in-bound behavior.
  - `start-codex-mobile-web-windowless.ps1` gained `-UserProfilePath` to force the background task to use the real user profile paths for `%USERPROFILE%`, `CODEX_HOME`, and `CODEX_MOBILE_RUNTIME_DIR`.
  - `start-codex-mobile-web-windowless.ps1` gained `-EnsureStandaloneMux`; when shared-stream mode is required, it starts `codex-app-server-mux.js` with `CODEX_MUX_STANDALONE=1` and `CODEX_MUX_KEEP_ALIVE=1` if no live mux endpoint exists.
  - The default installed task passes `-EnsureStandaloneMux -RequireSharedAppServer`, so Mobile Web keeps one mux-backed app-server stream and does not silently fall back to a divergent managed child.
- Operational implication:
  - The background task can keep Mobile Web and the mux endpoint alive after sign-out.
  - Codex Desktop should still be launched through `start-codex-desktop-shared.ps1` when the user logs back in, so Desktop attaches to the existing mux endpoint instead of starting its own independent app-server.
- Runtime activation:
  - Elevated install through UAC completed successfully.
  - Scheduled Task `Codex Mobile Web` is now `AtStartup`, `UserId=SYSTEM`, `LogonType=ServiceAccount`, `RunLevel=Highest`.
  - Current task action is `wscript.exe start-codex-mobile-web-hidden.vbs -HostAddress 0.0.0.0 -Port 8787 -UserProfilePath C:\Users\xuxin -EnsureStandaloneMux -RequireSharedAppServer`.
  - Current task state is `Running`; `0.0.0.0:8787` is listening from Node PID `40348`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Current limitation:
  - During this active Desktop turn, the background task reused the already-running Desktop-owned mux endpoint (`endpoint.json` PID `14328`) to avoid interrupting the current Desktop session.
  - A full immediate ownership switch to a SYSTEM-owned standalone mux requires stopping the existing mux endpoint and restarting Mobile Web, which will disconnect the current Desktop app-server stream. The safer time to do that is after the current turn ends or after a Windows reboot, where no Desktop-owned mux exists yet.

## 2026-05-05 Thread Detail 404 After SYSTEM Task Switch

- User reported that after switching/restarting the background task, opening a thread failed with `Thread is archived, deleted, or outside visible workspace`.
- Diagnosis:
  - `/api/threads?limit=...` still returned visible threads with correct `cwd`.
  - `/api/threads/{id}` returned 404 for known visible thread ids.
  - Under the SYSTEM task environment, `readStateDbThread()` could fail to get the per-thread summary from local `state_5.sqlite` via `sqlite3`.
  - The detail route then built a thread from `thread/turns/list` without `cwd`, and the visible-workspace filter treated the thread as outside visible workspaces.
- Fix:
  - `server.js` now falls back to app-server `thread/list` when local `readStateDbThread(threadId)` returns no summary.
  - The fallback recovers the thread summary/cwd before applying `isHiddenThread()`.
- Runtime activation:
  - Elevated restart stopped the SYSTEM-owned 8787 listener and restarted the Scheduled Task.
  - New listener PID is `38552` on `0.0.0.0:8787`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, `lastError=null`.
  - Direct detail reads for `019ded32-ed92-7681-9591-0e4d457c5274`, `019dde72-2de7-7542-b43f-d7fa0d98fb21`, and `019de2ad-421d-7fe2-883b-a6c7cbb8742b` now all return successfully with their expected cwd.
- Validation:
  - `node --check server.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Model-Specific Quota Display

- User-reported issue:
  - The composer quota indicator showed `100% | 100%` even though the selected/default model remained `GPT-5.5`.
- Diagnosis:
  - Authenticated `/api/status` showed `rateLimits.limitName = GPT-5.3-Codex-Spark` with zero usage.
  - `server.js` only kept one global `latestRateLimits`, so a quota event from another model could overwrite the quota shown next to the current model selector.
- Code change:
  - `server.js` now records rate-limit updates in `rateLimitsByModel`, keyed by normalized model/limit id, while still exposing the latest event for compatibility.
  - `public/app.js` now merges `rateLimitsByModel` from config/status/SSE updates and renders quota for the current selected/default model.
  - Spark quota events no longer overwrite the displayed quota for `GPT-5.5`; if no quota event has been observed for the current model, the UI shows unknown quota instead of a false `100% | 100%`.
- Activation note:
  - `server.js` changes require restarting the Codex Mobile Web listener.

## 2026-05-05 Composer Thread Permission Selector

- User-requested change:
  - Show and allow setting the current thread permission in the composer, positioned after reasoning effort and before quota.
- Code change:
  - `server.js` now exposes `permissionModeOptions` and attaches sanitized current-thread `runtimeSettings.permissionMode` to thread detail responses.
  - Runtime-setting lookup now reuses the app-server thread summary when local SQLite is unavailable under the SYSTEM startup task, and scans large rollout files backward for the latest `turn_context` instead of relying on a small tail read.
  - `server.js` accepts `permissionMode` on message/resume requests and maps it to app-server runtime settings:
    - `full` / `完全访问权限` -> `sandboxPolicy: dangerFullAccess` plus `approvalPolicy: never`
    - `default` / `默认权限` -> `sandboxPolicy: workspaceWrite` plus `approvalPolicy: on-request`
    - `auto` / `自动审查` -> `sandboxPolicy: workspaceWrite` plus `approvalPolicy: on-request`
    - `custom` / `自定义 (config.toml)` -> local `%USERPROFILE%\.codex\config.toml` sandbox/approval settings when present
  - `public/index.html`, `public/styles.css`, and `public/app.js` add a compact permission selector between effort and quota using the same visible option names as Codex Desktop.
  - Permission overrides are stored per thread in browser local storage and are sent only when different from the displayed current thread default.
- Activation note:
  - `server.js` changes require restarting the Codex Mobile Web listener; existing browser/PWA sessions need a refresh for the new selector markup and script.

## 2026-05-05 Composer Four-Control Row

- User-requested change:
  - Shrink the model and reasoning controls so model, reasoning, permission, and quota all fit on one row.
- Code change:
  - `public/styles.css` now uses a four-column mobile composer grid for the controls row.
  - Model and reasoning columns, select padding, and quota padding were tightened so the four boxes remain on one line on phone-width layouts.
- Follow-up change:
  - Permission options were renamed from the earlier `Full` / `Work` / `Read` prototype to the Codex Desktop labels `默认权限` / `自动审查` / `完全访问权限` / `自定义 (config.toml)`.
- Activation note:
  - Static CSS change only; existing browser/PWA sessions need a refresh.

## 2026-05-05 User Message Duplicate Render Guard

- User-reported issue:
  - Mobile Web frequently displayed the same `You` message twice in the conversation.
- Diagnosis:
  - Authenticated `/api/threads/019ded32-ed92-7681-9591-0e4d457c5274` showed only one durable app-server `userMessage` for the duplicated visible text.
  - The duplicate was therefore a browser-side merge artifact, not a double write into app-server history.
  - Existing frontend merge logic only dropped matching `mux-user-*` synthetic user-message echoes. A live ordinary `userMessage` and a later thread snapshot `userMessage` with identical visible content but a different id could both be retained.
- Code change:
  - `public/app.js` now compares ordinary `userMessage` items by normalized visible text and upload paths, not only by id.
  - During thread refresh merges, a local user-message item is dropped when the incoming snapshot has a matching user-message item in the same turn.
  - During live upsert, a matching existing user-message item is replaced only when the new item is at least as specific; otherwise the less complete duplicate is ignored.
  - Image-only versus text-plus-image duplicates are treated as the same visible input when their upload paths overlap.
- Validation:
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with line-ending warnings only.
- Activation note:
  - Static frontend change only. Existing browser/PWA sessions need a page refresh so the updated `public/app.js` can clean the currently duplicated local cards on the next thread refresh.

## 2026-05-05 Hermes Thread Slowness Diagnosis

- User reported the Hermes Codex thread felt extremely slow, with simple operations taking 10-20 minutes.
- Runtime checks:
  - Codex Mobile Web `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Current mux endpoint is `%USERPROFILE%\.codex\app-server-mux\endpoint.json`, TCP `127.0.0.1:49695`, mux PID `12128`, real app-server PID `11732`.
  - Current listener on `0.0.0.0:8787` is Node PID `13412`.
  - A local trivial PowerShell command completed in about 40ms under the SYSTEM task context, so the machine's shell execution was not generally stuck.
  - A 3-second CPU sample showed app-server PID `11732` using under 1 CPU-second and mux/server Node processes using much less, so there was no obvious CPU saturation.
- Hermes-specific findings:
  - Hermes thread `019dde72-2de7-7542-b43f-d7fa0d98fb21` is named `Hermes`, cwd `C:\Users\xuxin\Documents\Agent`, status `active`.
  - Its rollout JSONL file is about 505.5 MB and still being written, making thread load, history scanning, and replay substantially heavier than normal threads.
  - Recent Hermes turns include long completed durations, including about 26 minutes and 43 minutes, and the latest turn `019df84f-f9f0-7572-a8fc-7c1558704d6f` was still `inProgress` during diagnosis.
  - mux log showed repeated tool/command errors in the Hermes workspace, several `apply_patch verification failed` entries, command/path-not-found errors, and TCP client backpressure events such as drains after 866ms and 5179ms.
  - Earlier app-server log entries also showed ChatGPT/Codex websocket/model refresh failures around 10:02-10:16, but no current evidence of 8787 service failure during this check.
- Interpretation:
  - The current evidence points to a heavy/stale active Hermes thread plus large persisted history and failed tool-output volume, not a port conflict or a generally frozen local shell.
  - Git commands under the SYSTEM task can report dubious ownership for user-owned repos such as `C:\Users\xuxin\Documents\Agent`; this can add failures/noise when the app-server runs as SYSTEM.
- Operational recommendation:
  - Prefer starting a fresh Hermes thread from a compact handoff/summary for new work, leaving the 505 MB thread as archive/reference.
  - Avoid broad recursive searches or raw diff/output dumps in the old Hermes thread.
  - If keeping the old thread live, clear or interrupt only stale old `inProgress` turns after confirming the current active turn should not be interrupted.

## 2026-05-05 Hermes Stale Turns And Slowness Fix

- User confirmed the new Hermes turn had ended and asked to terminate the two old turns first.
- Runtime action:
  - Interrupted old Hermes thread `019dde72-2de7-7542-b43f-d7fa0d98fb21` turns:
    - `019df779-1a1d-7632-857e-5981474d3f32`
    - `019df84f-f9f0-7572-a8fc-7c1558704d6f`
  - Verification immediately after interruption showed both old turns as `interrupted` and the Hermes thread as `idle`.
  - User then started a new Hermes thread; this avoids continuing live work inside the old ~505 MB rollout.
- Code changes:
  - `start-codex-mobile-web-windowless.ps1` is now a restart supervisor for the 8787 listener. If `server.js` exits, the wrapper waits briefly and restarts the listener while reusing the existing mux endpoint.
  - `start-codex-mobile-web.ps1` and the windowless wrapper no longer treat Node stderr as a terminating PowerShell error. This fixes ordinary `clientError: read ECONNRESET` events causing the listener to exit.
  - `server.js` now ignores expected HTTP `ECONNRESET` client errors, keeps process-level `uncaughtException` / `unhandledRejection` logging, and guards JSON error responses when the client is already closed.
  - `server.js` caches latest rollout `turn_context` scan results briefly by rollout path/size/mtime, reducing repeated scans over very large rollout files.
  - `codex-app-server-mux.js` now drops Mobile Web command/file output delta notifications and reasoning deltas, truncates very large payload strings for Mobile Web, and stores compacted notifications in the replay buffer to reduce backpressure and heavy replay.
  - SYSTEM startup now injects process-local Git `safe.directory` entries for the user's Documents tree and Codex runtime dirs, reducing `dubious ownership` failures from SYSTEM-owned app-server tool runs.
- Runtime state after activation:
  - 8787 listener was replaced without killing the shared mux/app-server.
  - Current Codex Mobile Web listener PID after restart: `15900`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Current mux endpoint still points to existing mux PID `12128`, real app-server PID `11732`, TCP `127.0.0.1:49695`.
- Activation note:
  - `server.js` and startup wrapper changes are active on the current 8787 listener.
  - The mux payload compaction code will take effect after the mux itself is restarted. It was intentionally not restarted during the active Codex turn because restarting mux/app-server would disconnect the current shared stream.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser checks passed for `start-codex-mobile-web.ps1` and `start-codex-mobile-web-windowless.ps1`.
  - macOS shell parser check passed with `C:\Program Files\Git\bin\bash.exe -n ...`; the default SYSTEM `bash` command points to the WindowsApps WSL stub and cannot execute here.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Rollout Size Monitor And New Thread Action

- User-requested change:
  - Monitor each thread's rollout JSONL size.
  - Warn when a rollout reaches about `100MB`.
  - Provide a direct action to create and switch to a new thread in the same workspace.
- Code changes:
  - `server.js` now exposes `CODEX_MOBILE_ROLLOUT_WARNING_BYTES`, default `104857600` (`100MB`), through `/api/public-config`.
  - `server.js` annotates thread list/detail responses with rollout size metadata when the rollout file path is available.
  - `server.js` adds authenticated `POST /api/threads` to start a new app-server thread for a visible workspace through `thread/start`.
  - New threads started from Mobile Web include discovered `AGENTS.md` files as start-thread developer instructions, so the workspace context protocol remains available in the new thread.
  - `public/app.js` shows rollout size badges in the thread list and recent-thread home shortcuts.
  - `public/app.js` shows a current-thread warning banner when the rollout reaches the configured threshold, with a `新线程` button that starts and switches to the new thread.
  - `public/styles.css` adds compact badge and warning-banner styling with a mobile single-column layout.
  - `README.md` and `PROJECT_CONTEXT.md` document the threshold and behavior.
- Activation note:
  - Codex Mobile Web listener was restarted after the change without restarting mux/app-server.
  - Previous listener PID `15900`; new listener PID `38160`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - `/api/public-config` returned `rolloutWarningBytes=104857600`.
  - Authenticated `/api/threads?limit=80&archived=false` returned 10 visible threads, all with rollout size metadata; 2 were over threshold, largest visible rollout about `242.1MB`.
  - Existing browser/PWA sessions need a refresh to load the updated `public/app.js` and CSS.
- Validation:
  - `npm.cmd run check` passed.
  - macOS shell parser check passed with `C:\Program Files\Git\bin\bash.exe -n ...`; `npm.cmd run check:macos` still fails in this SYSTEM environment because `bash` resolves to the WindowsApps WSL stub.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 Rollout Warning List Button Fix

- User reported:
  - Threads over `100MB` were visibly red in the sidebar thread list, but no `新线程` button was visible.
- Cause:
  - The first implementation put the `新线程` action only in the opened thread's conversation banner.
  - The red visual indicator most visible to the user is the sidebar thread list item.
- Code change:
  - `public/app.js` now renders over-threshold sidebar entries as a wrapper containing the main thread-open button plus a separate `新线程` action button.
  - The list action creates a new thread from that row's workspace and switches to the new thread.
  - `public/styles.css` now gives over-threshold list rows a two-column layout with a compact right-side action button.
- Activation note:
  - Static frontend change only. Existing browser/PWA sessions need a refresh.
- Validation:
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 New Thread Bootstrap And Naming Fix

- User reported:
  - A newly created thread could be unmaterialized, causing `includeTurns is unavailable before first user message`.
  - New thread naming should not look random.
- Code changes:
  - `server.js` now materializes Mobile Web-created threads immediately by sending a fixed first user message that asks the agent to read `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`, acknowledge that durable context is loaded, and wait for the next step without editing files.
  - `server.js` now names these new threads deterministically from the source thread title and uses the app-server protocol method `thread/name/set` with `{ threadId, name }`, with legacy title-update attempts kept as fallbacks.
  - `server.js` sets the title both before and after the bootstrap `turn/start`, so a newly materialized thread keeps the source-based name instead of a generated/random-looking fallback.
  - `server.js` keeps a short in-memory summary for just-started threads and returns a valid empty thread object for unmaterialized thread detail reads, rather than surfacing an app-server materialization error to the browser.
  - `public/app.js` sends `sourceThreadId` and `sourceThreadTitle` when creating a new thread from an over-threshold thread list row or current-thread banner.
- Follow-up change:
  - The new-thread action now shows a browser confirmation prompt before proceeding.
  - If confirmed, `public/app.js` sends `archiveSourceThread: true`.
  - `server.js` archives the source thread with app-server `thread/archive` only after the new thread has been created and the fixed bootstrap turn has started.
  - `public/app.js` removes archived source threads from the visible list and handles `thread/archived` notifications.
  - If source archival fails, the response still returns the new thread so the browser can switch to it, and Mobile Web displays the archive failure in the connection status.
- Activation note:
  - Mobile Web listener was restarted after the server-side change without restarting mux/app-server.
  - Previous listener PID `46616`; new listener PID `4476`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Existing browser/PWA sessions need a refresh for static frontend changes.
- Validation:
  - `node --check server.js` passed.
  - `node --check public/app.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-05 New Thread Title Shortening

- User-requested change:
  - New thread names should not include `续`.
  - New thread names should include the date only, not time.
- Code change:
  - `server.js` now formats Mobile Web-created thread names as `<source thread title> MM-DD`.
  - `shortThreadTitle()` strips either old `<title> 续 MM-DD HH:mm` suffixes or new `<title> MM-DD` suffixes before appending the current date, so repeated thread rollover does not accumulate date suffixes.
- Activation note:
  - Mobile Web listener was restarted after the server-side change without restarting mux/app-server.
  - Previous listener PID `4476`; new listener PID `11048`.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - `node --check server.js` passed.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.
- Follow-up runtime action:
  - Renamed existing old-format thread `019df8b5-0028-7d90-ab9b-18d3f7898e01` from `衣橱1 续 05-05 23:15` to `衣橱1 05-05` using app-server `thread/name/set`.
  - Verification through `/api/threads?limit=200&archived=false` showed the new title and no remaining visible/archived old-format titles matching `续 MM-DD HH:mm`.
  - Note: when issuing direct app-server rename requests from PowerShell, avoid embedding non-ASCII title literals through a pipeline; use UTF-8-safe input or Unicode code points to avoid `??` replacement.

## 2026-05-05 Private/Public Commit Preparation

- User reminder:
  - Before push, check handoff for private/public release requirements and README handling.
- Requirements re-confirmed from prior handoff:
  - Private repo `origin` is `https://github.com/pentiumxp/codex-mobile-web.git`.
  - Clean public release repo is `https://github.com/pentiumxp/codex-mobile-web-public`, local path `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public release must not copy `.agent-context/` or `AGENTS.md`.
  - Public README must use the public clone URL and preserve public/PWA conventions.
- Follow-up code/release fixes:
  - Restored test-friendly `server.js` behavior from the public release line: when `server.js` is required as a module it no longer starts the HTTP listener, and it exports `approvalResponsePayload` / `publicServerRequest` for protocol tests.
  - Synchronized release files from private to public for `README.md`, `codex-app-server-mux.js`, `public/app.js`, `public/styles.css`, `server.js`, `start-codex-mobile-web-windowless.ps1`, and `start-codex-mobile-web.ps1`.
  - Preserved the public checkout's PWA service worker path by keeping `public/app.js` registration on `/sw.js`.
  - Fixed the public README clone command to use `https://github.com/pentiumxp/codex-mobile-web-public.git` and `cd codex-mobile-web-public`.
- Public release commit:
  - Local public commit `a77c9f3 优化大线程切换与后台稳定性` is prepared and ahead of public `origin/main`.
- Validation:
  - Private checkout: `npm.cmd run check` passed, `git diff --check` passed with line-ending warnings only.
  - Public checkout: `npm.cmd test` passed, `npm.cmd run check` passed, Git Bash `bash -n ...` macOS shell syntax check passed, `git diff --check` passed with line-ending warnings only.
  - Public privacy scan passed for tracked files excluding `.gitignore`; no `xuxin`, `Hermes`, `C:\Users`, `192.168.10.108`, `gmk.tail`, `tail62e8ce`, or private GitHub clone URL matches.

## 2026-05-05 Non-Actionable Tool Request Approval Card Fix - 23:46 +08:00

- User-reported issue:
  - Mobile Web showed a bottom `Tool request` card with method `item/tool/call`, status `Waiting`, and no clickable approval controls.
- Diagnosis:
  - `/api/approvals` showed the pending request with `actionable=false`.
  - Generated app-server TypeScript protocol identifies `item/tool/call` as `DynamicToolCallParams` with a `DynamicToolCallResponse`, not an Allow/Deny approval request.
  - Mobile Web had been tracking this server request in the same pending-approval stack as command/file/permission approval requests, producing a misleading waiting card.
- Code change:
  - `server.js` no longer includes `item/tool/call` in `SERVER_REQUEST_METHODS`, so dynamic tool calls are not exposed through `/api/approvals` or the approval SSE path.
  - `server.js` filters pending server requests by the current supported approval/input methods before returning `/api/approvals` or initial SSE approval state.
  - `public/app.js` ignores `item/tool/call` if an old server or existing browser session still receives it, and uses `等待输入` rather than `等待批准` for other non-actionable visible server requests.
- Activation note:
  - Restarted only the Mobile Web 8787 Node listener to load the server-side change.
  - Previous listener PID `11048`; new listener PID `10276`.
  - Shared mux/app-server were not restarted.
  - Authenticated `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Authenticated `/api/approvals` returned zero pending approval requests after restart.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-06 Workspace Selector Mobile Layout Fix - 00:03 +08:00

- User-reported issue:
  - In the mobile sidebar, the `Workspace` select text was vertically clipped.
  - The sidebar also showed a duplicate `All workspaces` row below the select.
- Code change:
  - `public/index.html` now starts `#workspacePath` hidden.
  - `public/app.js` hides `#workspacePath` when all workspaces are selected and only shows it for a concrete workspace path.
  - `public/styles.css` gives the workspace select a fixed `46px` height, matching line height, `16px` font size, and extra right padding for the native picker indicator.
- Activation note:
  - Static frontend change only. Existing browser/PWA sessions need a refresh.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-06 User-Mode Startup And WSL Access - 00:19 +08:00

- User-requested change:
  - Switch Codex Mobile Web away from `LocalSystem` so Codex tool calls can use WSL.
- Findings:
  - Commands launched from the existing SYSTEM app-server returned `WSL_E_LOCAL_SYSTEM_NOT_SUPPORTED`.
  - A temporary `GMK\xuxin` interactive Scheduled Task successfully ran `wsl.exe --exec /bin/sh -lc 'whoami; uname -a'`, returning Linux `GMK ... WSL2` with exit code 0.
- Code/documentation changes:
  - `install-codex-mobile-web-startup.ps1` now accepts `-UserId`, so a SYSTEM/elevated process can explicitly register the interactive task for `GMK\xuxin` instead of accidentally using the executing SYSTEM identity.
  - `README.md` documents that `LocalSystem` cannot start WSL and shows the `-InteractiveLogon -UserId "$env:COMPUTERNAME\$env:USERNAME"` install form.
  - `.agent-context/PROJECT_CONTEXT.md` records the current user-mode startup requirement and WSL limitation of LocalSystem.
- Runtime changes:
  - Re-registered the `Codex Mobile Web` Scheduled Task as `GMK\xuxin`, `LogonType=Interactive`, `RunLevel=Limited`.
  - Stopped the old SYSTEM 8787 listener/supervisor.
  - Started the 8787 listener under `GMK\xuxin`; listener PID observed as `2568`, parent PowerShell PID `45220`, both owned by `GMK\xuxin`.
  - Started a new user-owned standalone mux by temporary interactive task. New mux PID `48432`, child app-server PID `8732`, both owned by `GMK\xuxin`.
  - The endpoint file `%USERPROFILE%\.codex\app-server-mux\endpoint.json` now points to user-owned mux port `62616`.
  - Called authenticated `POST /api/app-server/reconnect`; `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, endpoint port `62616`, and `lastError=null`.
- Operational note:
  - The old SYSTEM mux/app-server can remain only for already-connected Desktop/current sessions. It is no longer the endpoint file target. Later Mobile Web reconnects and later Desktop shared launches should attach to the user-owned endpoint.
  - The current Codex thread that performed this migration may still execute local shell tools under the old SYSTEM app-server until that old session is restarted; new Mobile Web turns should use the user-owned app-server.
- Validation:
  - `npm.cmd run check` passed.
  - PowerShell parser check passed for `install-codex-mobile-web-startup.ps1`.
  - `git diff --check` passed with line-ending warnings only.
  - Final status check showed Scheduled Task `LogonType=Interactive`, `/api/status` ready on endpoint port `62616`, mux owner `GMK\xuxin`, and child app-server owner `GMK\xuxin`.

## 2026-05-06 Context Compaction State Text - 00:25 +08:00

- User-reported issue:
  - Mobile Web displayed `历史上下文已压缩` for both in-progress historical context compaction and completed compaction.
- Code change:
  - `server.js` now emits `mobileCompactionStatus` and `mobileNotice` for context-compaction items:
    - `item/started` and live turns -> `历史上下文正在压缩`
    - `item/completed` and completed turns -> `历史上下文已压缩`
  - `public/app.js` now computes context-compaction text from item status plus the containing turn live/completed state, so stale live notices settle to `已压缩` after turn completion.
- Activation note:
  - Restarted only the 8787 Mobile Web Node listener to load the `server.js` change.
  - Previous listener PID `2568`; new listener PID `46060`, owned by `GMK\xuxin`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, endpoint port `62616`, and `lastError=null`.
  - Existing browser/PWA sessions need a refresh for the updated frontend script.
- Validation:
  - `npm.cmd run check` passed.

## 2026-05-06 Public Web Push Title Binding Release - 15:20 +08:00

- User instruction:
  - After testing the private build, the user explicitly approved pushing the public repository.
- Public sync:
  - Synchronized the private Web Push thread-title binding fix into `C:\Users\xuxin\Documents\codex-mobile-web-public`.
  - Public files changed: `server.js` and `README.md`.
  - Preserved public release differences: the public README uses `https://github.com/pentiumxp/codex-mobile-web-public.git` and `cd codex-mobile-web-public`; the public PWA keeps its existing `/sw.js` service-worker convention.
  - Public README includes the required Chinese explanation of the Web Push behavior change: turn-completed notifications bind metadata captured at `turn/started`, use the completed thread title, and open `/?thread=<threadId>` so one thread's completion is not labeled as another thread.
- Validation:
  - Public `npm.cmd test` passed.
  - Public `npm.cmd run check` passed.
  - Public `git diff --check` passed with line-ending warnings only.
  - Public tracked-file privacy scan excluding `.gitignore` returned no matches for local user paths, Tailscale host markers, LAN address, Hermes name, or the private GitHub clone URL.
- Published:
  - Public commit `82660e0 修复 Web Push 线程标题绑定` pushed to `origin/main`.
  - Private implementation commit was `1a927ab 修复 Web Push 线程标题绑定`.

## 2026-05-07 Source-Thread Handoff Continuation Fix - 06:09 +08:00

- User-reported issue:
  - Rollout "压缩续接" bootstrap was still partly template-driven and could inject Codex Mobile Web-specific private/public/README release rules into unrelated workspaces such as Hermes Web.
  - Continuation should require the old/source thread to summarize its own handoff points and write a file, instead of relying only on fixed prewritten bootstrap text.
- Code changes:
  - `POST /api/threads` now first starts a source-thread handoff turn when `sourceThreadId` is provided.
  - The source-thread handoff turn must write `.agent-context/thread-handoffs/<id>.md` in the current workspace, summarizing only source-thread/current-workspace facts: goals, completed work, pending work, key files/commands, validation, risks, and next-thread advice.
  - Mobile Web waits for that handoff file before starting the new continuation thread. Default wait is `CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS=240000`; default minimum accepted file size is `CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS=400`.
  - The continuation bootstrap now includes the source-thread-generated handoff file as the highest-priority handoff source, plus source metadata, limited recent source-turn summaries, and current-workspace `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` excerpts.
  - Removed the old hard-coded "must carry GitHub / public release rules" bootstrap section and the special handoff-section extractor for public/private release keywords.
  - Frontend confirmation text now states that the old thread writes the handoff file first and that unrelated fixed commit rules are not injected. The continuation request timeout is now `300000ms`.
- Documentation:
  - `README.md` documents the source-thread handoff file workflow and the new continuation handoff timeout/min-size environment variables.
  - `.agent-context/PROJECT_CONTEXT.md` records that fixed private/public/README/GitHub rules must not be hard-coded into every continuation.
- Activation:
  - Restarted only the 8787 Node listener. Previous listener PID `40692`; new listener PID `53376`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
  - Shared mux/app-server were not restarted.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-07 Continuation Source Thread Visibility Fix - 06:20 +08:00

- User-reported issue:
  - After tapping `压缩续接`, Mobile Web returned to the home screen or kept the source thread visible without showing any source-thread handoff turn.
  - A Control4 continuation attempt showed the source thread still unchanged: no 2026-05-07 handoff turn, no handoff file under `C:\Users\xuxin\SynologyDrive\Codex\智能\.agent-context\thread-handoffs`, and no new Control4 continuation thread.
- Diagnosis:
  - The previous server implementation started the source-thread handoff turn directly with `turn/start` but did not first `thread/resume` the source thread. For older/notLoaded threads, that can fail to materialize a visible turn in the source thread.
  - The frontend success path still jumped to the new continuation thread, and `thread/archived` could clear the current source-thread detail view back to the home screen.
- Code changes:
  - `createSourceContinuationHandoff()` now resumes the source thread with inherited runtime settings before starting the handoff turn.
  - The frontend switches to the source thread before starting continuation and no longer automatically loads the new continuation thread when the request completes.
  - During a continuation, a `thread/archived` event for the source thread marks the current source detail as archived instead of clearing it.
  - After completion, Mobile Web stays on the source thread so the user can inspect the handoff generation turn/result.
- Operational note:
  - The failed Control4 attempt left only an empty `thread-handoffs` directory; no handoff file and no new Control4 continuation thread were created. Retrying after the listener restart should use the fixed flow.
- Activation:
  - Restarted only the 8787 Node listener after confirming the Control4 attempt had no active handoff file or new continuation thread.
  - New listener PID `52296`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-07 Continuation Switch-To-New-Thread Fix - 06:35 +08:00

- User-reported issue:
  - After the source thread's handoff turn finished, Mobile Web still stayed on the archived source thread. The expected behavior is to show the source thread while the handoff turn runs, then switch to the new continuation thread after the continuation is created.
- Code changes:
  - Frontend success flow now loads the new continuation thread after `/api/threads` returns the new thread id.
  - The source-thread archive guard remains in place so an archive event cannot clear the source view before the new thread switch happens.
  - Server-side continuation now waits briefly for the source handoff turn to report a completed status after the handoff file is written, controlled by `CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS` (default `60000`).
  - The API response includes `sourceHandoff.turnCompletion` for diagnostics.
- Documentation:
  - `README.md` and `.agent-context/PROJECT_CONTEXT.md` now describe the two-stage UX: show source thread during handoff, then switch to the new continuation thread.
- Activation:
  - Restarted only the 8787 Node listener; new listener PID `8076`.
  - `/api/status` returned `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`, and `lastError=null`.
- Validation:
  - `npm.cmd run check` passed.
  - `git diff --check` passed with line-ending warnings only.

## 2026-05-07 Public Commit Detail Rule - 06:45 +08:00

- User instruction:
  - For future public-repo commits, the commit message must include detailed information about what changed since the previous public commit.
  - A public commit message must not be only a one-line title; it should name the concrete changed areas, behavior/documentation impact, and validation or operational notes when relevant.
- Durable context:
  - Added this as a public commit-message rule in `.agent-context/PROJECT_CONTEXT.md`.
