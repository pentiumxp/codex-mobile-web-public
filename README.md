# Codex Mobile Web

Codex Mobile Web is a local web client for reading and controlling Codex sessions from a phone or another browser on the same network. It talks to `codex app-server`, reads local Codex state, and exposes a compact mobile UI with message sending, image/file uploads, model/effort selectors, quota display, live operation cards, and turn timing.

This repository does not contain Codex credentials, uploaded files, or a bundled Codex binary. Those are local runtime state on each machine.

## Platform Status

| Platform | Standalone Mobile Web | Desktop live sync through mux | Notes |
| --- | --- | --- | --- |
| Windows | Supported | Supported with the included PowerShell launcher | This is the primary tested platform. |
| macOS | Supported for standalone Mobile Web when `codex` CLI is installed | Launcher scripts included; needs real-Mac verification | macOS Desktop bridge behavior depends on Codex Desktop accepting the shell wrapper through `CODEX_CLI_PATH`. |

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
cd codex-mobile-web-public
npm run check
```

There are no npm package dependencies. `npm run check` only syntax-checks the JavaScript files. On macOS, also run:

```bash
npm run check:macos
```

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

## Windows Background Startup

To start Codex Mobile Web when the Windows user logs in without showing a console window, install the included Scheduled Task:

```powershell
cd C:\path\to\codex-mobile-web
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunNow
```

This is the default mode. It registers a task named `Codex Mobile Web` with an `AtLogOn` trigger under the current Windows user. The task runs `wscript.exe start-codex-mobile-web-hidden.vbs`, which starts PowerShell with `-WindowStyle Hidden`, so it does not create a visible console window.

The task starts after that user logs in and stops when that user signs out. A locked Windows session is fine. Because the task runs as the user, Codex tool calls use the same user profile and can access that user's WSL distributions.

If the installer is launched from another account or a SYSTEM/elevated automation context, pass the target identity and profile explicitly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -UserId "$env:COMPUTERNAME\$env:USERNAME" -UserProfilePath "$env:USERPROFILE" -RunNow
```

`-InteractiveLogon` is still accepted for older install commands, but it is no longer required because user-logon startup is the default.

If you intentionally need startup before any user logs in or survival after sign-out, install the optional `LocalSystem` task from an elevated PowerShell session:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunAsSystem -RunNow
```

`LocalSystem` does not store your Windows password and also uses the hidden launcher, but it cannot start WSL distributions. Use the default user-logon mode when Codex tool calls need WSL access.

The task still uses your normal Codex data paths by passing the installing user's profile path into the launcher:

```text
USERPROFILE=<your Windows user profile>
CODEX_HOME=<your Windows user profile>\.codex
CODEX_MOBILE_RUNTIME_DIR=<your Windows user profile>\.codex-mobile-web
```

The task runs `wscript.exe` against `start-codex-mobile-web-hidden.vbs`, which then starts PowerShell with window style `Hidden` and waits for it. The PowerShell wrapper starts a standalone mux endpoint when shared-stream mode is required, then starts Mobile Web.

```text
wscript.exe start-codex-mobile-web-hidden.vbs
```

By default, the startup task passes `-EnsureStandaloneMux -RequireSharedAppServer`, so Mobile Web connects to a single mux-backed app-server endpoint instead of silently creating a separate managed app-server stream. Codex Desktop can later attach to the existing mux endpoint when it is launched through `start-codex-desktop-shared.ps1`.

If you intentionally want standalone fallback behavior without a required mux endpoint, install with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -AllowManagedFallback -RunNow
```

The windowless launcher appends runtime logs to:

```text
%USERPROFILE%\.codex-mobile-web\codex-mobile-web.startup.log
```

To remove the Windows login startup task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall-codex-mobile-web-startup.ps1
```

## macOS Standalone Start

On macOS, use the included launcher so the `codex` and `node` commands are resolved to real executable paths before the server starts:

```bash
cd /path/to/codex-mobile-web
npm run check
npm run check:macos

./start-codex-mobile-web-macos.sh --host 0.0.0.0 --port 8787
```

The launcher defaults to:

- `CODEX_HOME="$HOME/.codex"`
- `CODEX_MOBILE_HOST="0.0.0.0"`
- `CODEX_MOBILE_PORT="8787"`
- `CODEX_MOBILE_CODEX_EXE="$(command -v codex)"`
- `node` from `command -v node`

If you only want access from the Mac itself, bind to loopback:

```bash
./start-codex-mobile-web-macos.sh --host 127.0.0.1 --port 8787
```

If `8787` is already in use, choose another port:

```bash
./start-codex-mobile-web-macos.sh --host 0.0.0.0 --port 8789
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
- Thread lists and thread detail monitor rollout JSONL size. At the default `100MB` threshold, Mobile Web shows a context-size warning and offers a same-workspace continuation action. After user confirmation, the action creates a source-named/date-suffixed continuation thread, sends a detailed bootstrap message, then archives the source thread.
- The continuation bootstrap message explicitly carries source thread metadata, rollout size, inherited runtime settings, recent visible turn summaries, `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md` excerpts, and the private/public GitHub release rules. This avoids relying only on thread-local memory when a large rollout needs to be left behind.
- Thread list rows support a left-swipe action to reveal `压缩续接` for any visible thread, so users can proactively continue before the rollout reaches the warning threshold.
- The left-swipe action stays open after a horizontal swipe until the user taps the card, taps the action, opens another row, or refreshes the list. Mobile browsers can emit a synthetic click after touch gestures, so the UI suppresses that same-gesture click to avoid immediately closing the action.

### Rollout 压缩续接

当线程的 rollout JSONL 达到阈值时，界面按钮显示为“压缩续接”。确认后，Mobile Web 会创建同工作区的新续接线程，并在首条消息中写入足够详细的交接信息：源线程 ID、标题、工作区、rollout 路径和大小、运行权限摘要、最近源线程上下文、工作区 handoff 摘录，以及 GitHub private/public 提交规则。

这个动作不会原地改写或裁剪旧 rollout 文件；它通过“新续接线程 + 旧线程归档”降低后续交互需要读取的历史文件体积。旧线程在续接线程启动成功后才会归档，仍可从归档记录中找回。首条 bootstrap 会要求新线程先读取 `.agent-context/PROJECT_CONTEXT.md` 和 `.agent-context/HANDOFF.md`，并显式确认 private/public/README 规则已经加载，避免漏掉 public README 更新、public 仓库清理、service worker 路径等发布要求。

除超阈值提示外，线程列表中的任意线程都可以向左滑动露出 `压缩续接` 按钮，用于主动开启续接。滑出的按钮使用同一套确认、bootstrap 和归档流程；点线程卡片本身仍用于打开线程。线程行使用独立的卡片层和动作层，避免滑动动作压缩或裁切标题、工作区、状态和 rollout 大小等元信息。

左滑展开后，`压缩续接` 按钮会保持可见，直到用户点击该按钮、点击线程卡片收起、打开另一行，或者刷新线程列表。移动浏览器在触摸滑动后可能补发一次合成点击，前端会吞掉这次同手势点击，避免按钮刚露出就被立即收起。

iOS/PWA 的横滑手势使用 Touch Events 路径处理；如果系统在横滑过程中发出 `touchcancel` / `pointercancel`，前端会根据最后一次横向位移完成展开判定，而不是直接收起按钮。

- The top-right timer shows current turn elapsed time as `鏈疆 HH:MM:SS`.
- The timer is red while a turn is active and muted after completion.
- During an active turn, the timer may append a compact activity label such as `鎬濊€僠, `杈撳嚭`, `鍛戒护`, `鏂囦欢`, `宸ュ叿`, `鎼滅储`, `鍚屾`, or `绛夊緟鎵瑰噯`.
- The timer uses a fixed elapsed-time segment, so activity label length changes do not move the `鏈疆 HH:MM:SS` text.
- After the latest turn finishes, the timer switches to muted styling and shows `宸茬粨鏉焋 instead of any in-progress activity label.
- Live reasoning is not rendered as conversation rows.
- Command/file/tool activity appears as compact operation cards.
- Consecutive command/file operation updates show only the latest operation card unless normal visible content appears between two operations.
- The composer supports per-message model, reasoning effort, and thread permission selectors.
- The composer shows 5-hour and weekly quota remaining when app-server sends rate-limit updates. Rate-limit updates are cached by model, so the visible quota follows the selected/current model instead of the last quota event from another model.
- The send button follows Codex Desktop behavior: empty composer during an active turn shows `Stop`; typed text or attachments switch it back to `Send`.
- The message input uses a `contenteditable` textbox instead of a native `textarea` to reduce the extra iOS browser input accessory toolbar. Enter sends; Shift+Enter inserts a newline.
- The web app avoids programmatic composer focus after send, thread switch, refresh, and mobile foreground recovery. Mobile keyboards should open only after the user explicitly taps the message input.

## Current Update Notes

This section summarizes the current integration behavior for someone cloning or taking over the repository.

### Shared Desktop/Mobile Stream

- Windows Desktop live sync is implemented through `codex-app-server-mux.js` and `start-codex-desktop-shared.ps1`.
- macOS scripts are included and the implementation approach is documented, but Desktop live sync still needs verification on a real Mac/Codex Desktop build.
- When Mobile Web detects a shared mux endpoint, it treats that endpoint as the required app-server for the current process lifetime. If the shared endpoint disconnects, Mobile Web reports the shared-stream error instead of silently starting an independent app-server.
- `-RequireSharedAppServer` / `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1` enforces the same rule even if Mobile Web starts before any mux endpoint exists.
- `CODEX_MUX_KEEP_ALIVE=1` keeps the mux and real app-server alive after Codex Desktop exits, so Mobile Web can continue using the same live stream.
- Starting Desktop again through the shared launcher attaches it to the existing mux endpoint instead of creating a second app-server.

### Mux Replay And Reconnect

- The mux keeps a bounded replay buffer for recent app-server notifications:
  - `turn/*`
  - `item/*`
  - `thread/*`
  - `account/rateLimits/updated`
- On `initialize`, Mobile Web receives unresolved server requests plus buffered notifications, so reconnecting or refreshing the phone browser can catch up within the replay window.
- Pending approval/server requests are replayed to all clients because they can block the active turn.
- Historical notification replay is sent only to clients identified as `codex-mobile-web` by default. Desktop usually loads durable thread history itself; replaying old incremental notifications to Desktop can roll the visible UI back to an earlier partial state.
- Set `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=1` only for diagnostics if you need to see how Desktop behaves with historical notification replay.
- TCP client backpressure is treated as a normal `drain` condition. The mux logs the delay but does not disconnect Desktop or Mobile Web just because one write returned `false`.
- Events missed before the mux replay buffer existed cannot be reconstructed from mux memory. Future offline intervals are covered within the configured buffer size and age.

### Approval Control

- Mobile Web renders app-server approval requests as cards in the current thread.
- Supported approval families include command execution, file change, and permission-profile requests.
- Each pending card exposes:
  - `Allow once`
  - `Allow session`
  - `Deny`
- The approval response goes back through the same shared app-server stream. This avoids creating a separate stream just to answer permissions.
- Approval cards render inside their associated turn when a `turnId` is available. After the request is answered, the large card collapses to a one-line status instead of remaining as a full card at the bottom of the conversation.

### Message Submission And Active Turns

- The browser sends a `clientSubmissionId` with each message submission.
- For modern clients that send `clientSubmissionId`, the server deduplicates only by that id. This prevents an intentional repeated short message, such as `continue`, from being incorrectly suppressed as duplicate content.
- For older clients that do not send `clientSubmissionId`, the server falls back to a content fingerprint from thread id, active turn id, cwd, model, effort, message text, and attachment metadata.
- If the same request id, or the same legacy content fingerprint, is repeated within `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS`, the server returns the original in-flight/completed result and does not call `turn/start` or `turn/steer` again.
- During an active turn, Mobile Web posts the active turn id. The server uses app-server `turn/steer` when available so Desktop and Mobile stay on the same active stream.
- After a successful active-turn `turn/steer`, the server also sends a deterministic mux-local `mux/userMessage` echo keyed by `clientSubmissionId`. This makes the user's mid-turn input visible in Mobile Web even when the app-server accepts the steering request without replaying a user-message item.
- The browser preserves `mux-user-*` user-message echo items during thread refresh merges, because these synthetic visible inputs may not exist in the durable thread snapshot returned by app-server.
- For new turns, Mobile Web reads the thread's last rollout `turn_context` plus `state_5.sqlite` metadata and forwards the inherited approval policy, sandbox policy, reasoning summary, and configured verbosity where the app-server protocol supports it. This keeps Mobile Web turns aligned with the thread permissions that Desktop is using.
- Full-access threads are normalized for Mobile Web new turns: if the inherited sandbox is `danger-full-access`, or the permission profile grants root write access, Mobile Web sends `approvalPolicy: "never"` when the persisted approval mode is missing or still `on-request`. This matches the user-facing "full access" expectation and avoids redundant command approval cards on new turns.
- The composer permission selector displays the current thread permission after the reasoning selector and before quota, using the same option names as Codex Desktop: `默认权限`, `自动审查`, `完全访问权限`, and `自定义 (config.toml)`. `完全访问权限` sends `dangerFullAccess` plus `approvalPolicy: "never"`; `默认权限` and `自动审查` use workspace-write with approval prompts; `自定义 (config.toml)` applies the local `sandbox_mode` / approval setting from `%USERPROFILE%\.codex\config.toml` when present.
- The older mux-local `mux/userMessage` echo is still retained as a fallback for app-server builds that do not support `turn/steer`.

### Mobile UI Stability

- Conversation rendering uses a lightweight keyed DOM patcher so status polls and no-op refreshes do not replace the whole conversation.
- Live reasoning deltas update the timer activity label but do not create visible conversation rows.
- Mobile foreground recovery handles `visibilitychange`, `pageshow`, `focus`, `orientationchange`, `visualViewport` changes, and window resize.
- On iOS, returning from input-method or permission screens can leave a stale/blank composited viewport. The app maintains a JS-driven `--app-height` and runs several lightweight visual recovery passes after resume.
- Uploaded image messages render as centered thumbnails, not full-width raw images or data URLs.
- Non-image uploads are stored locally and referenced by absolute path in the message text.

### Which Restart Is Needed After Changes

Use this table after pulling updates:

| Changed area | Required action |
| --- | --- |
| `public/index.html`, `public/app.js`, `public/styles.css` only | Refresh the browser tab. The Node server serves these files from disk. |
| `server.js` | Restart Mobile Web. |
| `codex-app-server-mux.js` | Fully quit Desktop and launch once with the force-restart mux option. |
| `start-codex-desktop-shared.ps1` or shim files | Fully quit Desktop, then relaunch through the updated shared launcher. |
| Windows startup scripts | Re-run `install-codex-mobile-web-startup.ps1` so the Scheduled Task points at the current launcher. |
| macOS `.sh` launcher files | Rerun `npm run check:macos`, then relaunch through the updated script. |

Windows mux replacement:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ForceRestartMux
```

Mobile Web restart on Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787 -RequireSharedAppServer
```

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

When `CODEX_MUX_KEEP_ALIVE=1`, the mux keeps the real app-server and TCP endpoint alive after the Desktop stdio client disconnects. A later Desktop launch through the same wrapper connects back to the existing mux instead of starting a second app-server.

The mux also proxies app-server requests such as command, file-change, and permission approvals. This allows Mobile Web to display approval cards and answer `Allow once`, `Allow session`, or `Deny` without creating a separate app-server stream.

The mux keeps a bounded notification replay buffer. Mobile Web receives buffered `turn/*`, `item/*`, `thread/*`, and rate-limit notifications after reconnecting, while Desktop notification replay is disabled by default to avoid rolling back Desktop's already-loaded durable thread view. Unresolved approval/server requests are replayed to both Desktop and Mobile Web.

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

By default, the launcher sets `CODEX_MUX_KEEP_ALIVE=1`. If Desktop is fully quit, the mux and real app-server should remain alive so Mobile Web can continue using the same stream. Starting Desktop again through the launcher attaches the new Desktop stdio session to the existing mux.

Because keep-alive deliberately preserves the mux process, normal Desktop restarts do not reload changed mux code. After updating the bridge code, fully quit Desktop and start it once with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ForceRestartMux
```

This stops the mux PID recorded in the endpoint file before launching Desktop, so the next Desktop session creates a fresh mux from the current files.

The mux writes its endpoint file here:

```text
%USERPROFILE%\.codex\app-server-mux\endpoint.json
```

Mobile Web auto-detects that endpoint. If Mobile Web was already running before the mux was available, restart Mobile Web or call:

```text
POST /api/app-server/reconnect
```

For strict shared-stream operation, start Mobile Web with managed fallback disabled:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787 -RequireSharedAppServer
```

In this mode, if the shared mux endpoint is unavailable, Mobile Web reports the error instead of starting a separate app-server and creating a divergent stream.

## macOS Desktop Live Sync

Status: launcher scripts are included, but full Desktop live-sync verification still needs to pass on a real Mac/Codex Desktop build.

Standalone Mobile Web can run on macOS. The bridge core, `codex-app-server-mux.js`, is Node.js and portable. The macOS launcher uses `CODEX_CLI_PATH` to make Codex Desktop start `codex-app-server-mux-macos.sh`, which then execs the Node mux without writing anything to the app-server protocol stdout.

Current limitations:

- `start-codex-desktop-shared.ps1` is Windows-specific.
- `codex-app-server-mux-shim.cs` builds a Windows `.exe`.
- macOS shell-wrapper launch is implemented, but should be treated as unverified until the checklist below passes.
- If a future Codex Desktop build rejects a shell script as `CODEX_CLI_PATH`, add a tiny native macOS executable shim that execs the same mux command.

### macOS Bridge Start

For the easiest path, use the one-command launcher. It quits and relaunches Codex Desktop through the mux, starts Mobile Web in the background, and picks the first free port from `8789` through `8899`:

```bash
cd /path/to/codex-mobile-web
./start-codex-shared-mobile-macos.sh
```

The script prints the local URL, phone URL, access key file, and log paths. To force a specific port:

```bash
./start-codex-shared-mobile-macos.sh --port 8789
```

The manual steps below are useful when diagnosing the Desktop bridge.

1. Fully quit Codex Desktop.
2. Validate the launcher environment:

```bash
cd /path/to/codex-mobile-web
npm run check
npm run check:macos
./start-codex-desktop-shared-macos.sh --print-only
```

3. Start Codex Desktop through the shared launcher:

```bash
./start-codex-desktop-shared-macos.sh
```

If Codex is still running, the launcher exits instead of attaching to the wrong process. You can ask it to quit Codex first:

```bash
./start-codex-desktop-shared-macos.sh --force-quit
```

4. Start Mobile Web in another terminal:

```bash
./start-codex-mobile-web-macos.sh --host 0.0.0.0 --port 8787
```

Useful launcher overrides:

- `--app /Applications/Codex.app`
- `--desktop-exe /Applications/Codex.app/Contents/MacOS/Codex`
- `--codex "$(command -v codex)"`
- `--node "$(command -v node)"`
- `--codex-home "$HOME/.codex"`
- `--mux-wrapper "$PWD/codex-app-server-mux-macos.sh"`

The launcher sets:

- `CODEX_HOME`
- `CODEX_CLI_PATH`
- `CODEX_MUX_SCRIPT_PATH`
- `CODEX_MUX_CODEX_EXE`
- `CODEX_MUX_NODE_EXE`
- `CODEX_MUX_KEEP_ALIVE=1`

It launches `/Applications/Codex.app/Contents/MacOS/Codex` directly so the environment is inherited.

### macOS Bridge Verification Checklist

After launching Desktop with the shared launcher:

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
    "mobileUserMessageEcho": true,
    "serverRequestProxy": true,
    "notificationReplay": true
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
export CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1
npm start
```

4. Open `/api/status` through the authenticated UI and verify the transport is `external-jsonl-tcp`.

5. Start a test turn from Desktop and watch Mobile Web receive live updates.

6. Send a mid-turn message from Mobile Web and verify Desktop shows the user message and subsequent Codex output in the same active turn.

7. Quit Desktop and confirm the mux/app-server remain alive when `CODEX_MUX_KEEP_ALIVE=1`.

8. Relaunch Desktop through the wrapper and verify it reconnects to the existing mux endpoint rather than starting a second app-server.

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

## Web Push Notifications

Web Push is optional. It is intended for phone notifications when a Codex turn finishes.

This project does not provide a shared push gateway, a hosted HTTPS endpoint, or checked-in certificates. Each user runs Mobile Web on their own machine, exposes that local server through HTTPS, and lets the server generate its own local VAPID key pair.

Requirements:

- Open Mobile Web through HTTPS. iOS Safari/PWA push does not work on plain LAN HTTP.
- On iOS, add the HTTPS Mobile Web page to the Home Screen and open it from the Home Screen icon before enabling notifications.
- Allow notifications in iOS when prompted.
- Keep the Web Push runtime files local under `%USERPROFILE%\.codex-mobile-web`; do not commit them.
- No Apple Developer account is required for standards-based Web Push. Apple Push is contacted through the browser's Web Push subscription endpoint.
- No public HTTP registration step is required. The only public-facing requirement is that the phone opens Mobile Web from a valid HTTPS origin.

Current Windows/Tailscale example:

```powershell
tailscale serve --https=8443 http://127.0.0.1:8787
```

Then open:

```text
https://<tailscale-host>.ts.net:8443/
```

After login, use the `Enable notifications` button in the Mobile Web menu/top controls. After the subscription is created, the same button becomes `Send test notification`.

Notification behavior:

- Test notification title: `Codex Mobile Web`.
- Turn-completed notification title: `Codex Mobile Web`.
- Turn-completed notification body: `<thread-title> · This turn 已结束 · <local time>`.
- Clicking a notification opens Mobile Web and switches to the relevant thread when the thread id is available. The service worker sends a `codex-open-thread` message to an already-open Mobile Web window, so an installed iOS/PWA session does not have to rely on a full browser navigation to change threads.
- 中文说明：通知 payload 会带 `/?thread=<threadId>`。如果 Mobile Web 已经打开，service worker 会聚焦现有窗口并把目标线程 ID 发给前端，前端收到后直接保存当前线程并调用线程详情加载接口；如果没有现有窗口，则打开带线程参数的新窗口。这样点击 Web Push 后应进入对应线程，而不是只回到上一次停留的线程。

VAPID details:

- VAPID keys are generated automatically and stored in `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json`.
- Subscriptions are stored in `%USERPROFILE%\.codex-mobile-web\web-push-subscriptions.json`.
- `CODEX_MOBILE_PUSH_SUBJECT` can override the VAPID subject.
- Do not use a `localhost` VAPID subject for Apple Push. Apple can reject it with `BadJwtToken`; the default subject is a non-localhost contact URI.
- The generated VAPID private key and browser subscription endpoints are local runtime state. They must not be committed to a public repository, pasted into issues, or copied into shared handoff files.

## Useful Environment Variables

| Variable | Purpose |
| --- | --- |
| `CODEX_HOME` | Codex state directory. Defaults to user home `.codex` in `server.js` and `codex-app-server-mux.js`. |
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
| `CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES` | Tail bytes read from a thread rollout to recover inherited turn runtime settings, default `4194304`. |
| `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` | Rollout JSONL size threshold for UI warnings and the continuation action, default `104857600` (`100MB`). |
| `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` | Max characters in the rollout continuation bootstrap message, default `120000`. |
| `CODEX_MOBILE_CONTINUATION_RECENT_TURNS` | Recent source turns summarized into the continuation bootstrap, default `12`, capped at `30`. |
| `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS` | Time window for treating repeated message submissions as the same request, default `90000`. Requests with `clientSubmissionId` are deduped by id; legacy requests without it fall back to content fingerprinting. |
| `CODEX_MOBILE_MESSAGE_DEDUPE_MAX` | Maximum number of recent message submissions kept in the dedupe cache, default `300`. |
| `CODEX_MOBILE_PUSH_SUBJECT` | VAPID subject used for Web Push. Must be a non-localhost contact URI, for example `mailto:name@example.com` or an HTTPS URL. |
| `CODEX_MOBILE_PUSH_TTL_SECONDS` | Web Push TTL in seconds, default `3600`. |
| `CODEX_MOBILE_PUSH_VAPID_FILE` | Custom runtime path for Web Push VAPID keys. |
| `CODEX_MOBILE_PUSH_SUBSCRIPTIONS_FILE` | Custom runtime path for stored Web Push subscriptions. |
| `CODEX_MOBILE_MUX_ENDPOINT_FILE` | Custom mux endpoint file path. |
| `CODEX_MOBILE_APP_SERVER_WS` | External app-server WebSocket endpoint. |
| `CODEX_MOBILE_APP_SERVER_TCP` | External app-server JSONL TCP endpoint. |
| `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER` | When `1`, Mobile Web must connect to an external/shared app-server endpoint and must not fall back to a managed child. |
| `CODEX_CLI_PATH` | Desktop-side override used to make Codex Desktop launch the mux instead of the normal Codex CLI/app-server command. Windows path must be a real `.exe`; macOS behavior is unverified. |
| `CODEX_MUX_SCRIPT_PATH` | Path to `codex-app-server-mux.js` for shim/wrapper launchers. |
| `CODEX_MUX_CODEX_EXE` | Real Codex CLI executable used by the mux to start the real app-server. |
| `CODEX_MUX_NODE_EXE` | Optional explicit Node executable for shim/wrapper launchers. |
| `CODEX_MUX_STANDALONE` | Start mux without attaching stdin/stdout Desktop client when set to `1`, useful for Mobile Web-only mux testing. |
| `CODEX_MUX_KEEP_ALIVE` | Keep mux and real app-server alive after Desktop stdio disconnects; Desktop relaunches can attach back to the existing mux. |
| `CODEX_MUX_ENDPOINT_FILE` | Custom mux endpoint file path. |
| `CODEX_MUX_CODEX_ARGS` | Override real Codex app-server arguments. When unset, Desktop-supplied arguments are passed through, otherwise the mux falls back to `app-server --analytics-default-enabled`. |
| `CODEX_MUX_REPLAY_BUFFER_LIMIT` | Maximum buffered app-server notifications for Mobile Web reconnect replay, default `1200`. |
| `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS` | Maximum replay-buffer age in milliseconds, default `1800000` (30 minutes). |
| `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS` | When set to `1`, also replay historical notifications to Desktop clients. Keep disabled unless diagnosing Desktop reconnect behavior. |

`start-codex-desktop-shared.ps1 -ForceRestartMux` is a launcher option, not an environment variable. It is intended for bridge updates where an existing keep-alive mux must be replaced.

## Troubleshooting

### Mobile Web Shows `Loading thread`

1. Confirm the web server is reachable.
2. Confirm `/api/status` reports `ready=true`.
3. If strict shared-stream mode is enabled, check that the mux endpoint file exists:

```text
%USERPROFILE%\.codex\app-server-mux\endpoint.json
```

4. If the endpoint points to an old mux after code changes, fully quit Desktop and use `-ForceRestartMux`.
5. If only one browser tab is stale after a frontend update, refresh that tab. Static files are read from disk and do not require a Node restart.

### Desktop Does Not See Mobile Web Messages

- Desktop must be launched through the shared launcher. A normal Desktop launch starts its own stdio app-server and will not share the same live stream.
- Mobile Web status should show an external/shared transport such as `external-jsonl-tcp`.
- If Desktop was offline while Mobile Web continued, future reconnect replay depends on the mux replay buffer. Events older than `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS` or beyond `CODEX_MUX_REPLAY_BUFFER_LIMIT` may not replay from mux memory.
- If Desktop loads complete history and then visually rolls back, leave `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS` unset. Desktop notification replay is off by default for that reason.

### Approval Cards Do Not Appear

- Approval cards require the shared mux path because approvals are server requests on the app-server stream.
- Confirm the endpoint capabilities include `serverRequestProxy: true`.
- If Mobile Web is connected to a managed child app-server instead of mux, approvals for the Desktop stream will not appear in Mobile Web.

### iOS Returns To A Blank Or Black Page

- Refresh the page first to ensure the latest frontend files are loaded.
- The app runs multiple foreground recovery passes after `visibilitychange`, `pageshow`, and `focus`, but iOS browser compositing can still be device/browser-version dependent.
- If the page is visually blank but the server is alive, switch away and back once; then check whether the issue reproduces after a full page refresh.

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
   - On macOS, use `start-codex-desktop-shared-macos.sh` and state that the Desktop bridge is not verified until the checklist passes on a real Mac.

Record durable setup facts in `.agent-context/HANDOFF.md` if this repo is being modified.
