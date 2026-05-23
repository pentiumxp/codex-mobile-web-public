# Codex Mobile Web

Codex Mobile Web is a local web client for reading and controlling Codex sessions from a phone or another browser on the same network. It talks to `codex app-server`, reads local Codex state, and exposes a compact mobile UI with message sending, image/file uploads, model/effort read-only display, quota display, live operation cards, and turn timing.

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
npm ci
npm run check
```

`npm ci` installs the small runtime dependency set used by optional Web Push support. `npm run check` syntax-checks the JavaScript files. On macOS, also run:

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

### Manual Mobile Web Shared-Chain Restart

The daily `Codex Mobile Web Shared Chain Restart` scheduled task is no longer installed by default. The same scoped restart is now exposed as a manual control in the mobile sidebar: the header shows a small `Restart` button next to the version/update pill, and tapping it asks for confirmation before restarting.

The manual restart calls the authenticated `POST /api/restart/shared-chain` endpoint. On Windows, the endpoint launches `restart-codex-mobile-shared-chain.ps1` after the HTTP response has been sent, so the page can show the confirmation result before the current Node listener exits. The script stops only the Codex Mobile Web shared chain: the `Codex Mobile Web` startup task, this workspace's hidden/windowless launchers, this workspace's `server.js`, this workspace's mux process, and `%USERPROFILE%\.codex-mobile-web\codex.exe app-server`. It removes the stale mux endpoint file, starts `Codex Mobile Web` again, and waits for HTTP plus mux readiness.

On macOS, the same endpoint restarts only the current Mobile Web listener through a detached `launchctl submit` command. It keeps Codex Desktop and the shared mux running, so the user can restart the `8789` browser server from the PWA without triggering the macOS `Quit Codex?` confirmation.

This manual restart intentionally does not restart WSL, Codex Desktop, or unrelated local services. Logs are written to `%USERPROFILE%\.codex-mobile-web\shared-chain-restart.log`.

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
- The sidebar menu header includes a compact settings button. The settings panel contains the theme control (`跟随系统` / `深色` / `浅色`) and the font-size control (`小字` / `标准` / `大字` / `特大` / `超大`) using the same segmented-button style.
- Theme and font-size choices are saved in the browser. Theme updates the page theme color metadata; iOS PWA status-bar color changes may require closing and reopening the installed app. The light theme now uses a slightly warmer page background so the daytime view is less cold gray while cards and controls stay crisp. Font size adjusts conversation text, markdown, code/table content, approval details, and the composer input.
- The sidebar header also shows the app version/update pill and a same-size `Restart` button. After login, Mobile Web checks the configured GitHub remote in the background. If the remote branch is ahead, the pill becomes an update action; tapping it asks for confirmation, applies only a clean fast-forward update, then exits the Node listener so the existing startup supervisor can restart it from the updated files. The `Restart` button is separate from Git self-update and asks for confirmation before restarting the local Mobile Web shared chain.
- When a conversation is scrollable and the user is away from the newest messages, a floating down-arrow button appears above the composer. Tapping it jumps directly back to the latest turn; normal rendering still avoids forcing the scroll position while the user is reading older content.
- 中文说明：长对话如果因为恢复、切换线程或手动滚动停在历史消息中间，页面会在输入框上方显示“回到底部”浮动按钮。按钮只在当前线程已加载、内容可滚动且不在底部时出现；点击后立即回到最新 turn。用户阅读历史内容时，普通刷新仍不会强制自动滚到底部。PWA/手机浏览器如果仍显示旧界面，需要刷新一次或等待新的 service worker 缓存 `codex-mobile-shell-v36` 激活。
- On phones and tablet portrait/touch layouts, the sidebar menu is not persistent: the main conversation fills the viewport, and the menu opens only after the user taps the top-left menu button. Wide desktop layouts keep the persistent sidebar. On coarse-pointer landscape tablets with enough room, Mobile Web uses a two-column layout with a persistent sidebar and full conversation pane.
- On coarse-pointer landscape tablets, the composer uses a viewport-contained two-row compact layout: runtime indicators and quota on the first row, then attach/input/send on the second row. The split layout constrains both sidebar and main pane height so the composer stays inside the visible app surface.
- On mobile/touch layouts, swiping right from the left screen edge opens the session list without waiting for a network refresh. If the existing session list is newer than 60 seconds, Mobile Web reuses it immediately; older lists open first and then refresh quietly in the background.
- Thread lists and thread detail monitor rollout JSONL size. At the default `200MB` threshold, Mobile Web shows a context-size warning and offers a same-workspace continuation action. The warning can be skipped for the current thread size, and will reappear if that thread grows again past the stored size. After user confirmation, the action first asks the source thread to write a thread-specific handoff file, creates a source-named/date-suffixed continuation thread, sends a scoped bootstrap message, then archives the source thread.
- The continuation bootstrap message explicitly carries source thread metadata, rollout size, inherited runtime settings, the source-thread-generated handoff file, bounded continuation lineage, recent visible turn summaries, and current-workspace `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` excerpts. It does not inject fixed private/public GitHub release rules; those appear only if the current workspace context or source-thread handoff says they are relevant.
- Thread list rows support a left-swipe action to reveal `归档` for any visible thread. This is a direct archive shortcut and no longer starts rollout continuation from the swipe row.
- The left-swipe action stays open after a horizontal swipe until the user taps the card, taps the action, opens another row, or refreshes the list. Mobile browsers can emit a synthetic click after touch gestures, so the UI suppresses that same-gesture click to avoid immediately closing the action.
- Long-pressing a session row opens a mobile action sheet with rename and continuation actions. The row disables accidental system text selection during the long press, while rename input fields still allow normal text selection and editing.
- Agent replies include a `复制全文` action. Markdown code blocks and command/output detail blocks include smaller copy buttons so users can copy structured text without manually selecting content on iOS.

### Rollout 压缩续接

当线程的 rollout JSONL 达到阈值时，界面按钮显示为“压缩续接”。默认提醒阈值是 `200MB`，可用 `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` 覆盖。详情页提示可以点“跳过”暂时隐藏；隐藏记录按“线程 id + 当前 rollout 大小”保存，因此该线程继续增长后会再次提示。确认“压缩续接”后，Mobile Web 会先在旧线程中启动一个交接整理 turn，要求旧线程把本线程真实的交接重点写入当前工作区的 `.agent-context/thread-handoffs/<id>.md` 文件。该文件必须只总结源线程和当前工作区相关的目标、已完成事项、未完成事项、关键文件、验证结果和风险。

线程详情读取还有一个单独的性能阈值：`CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES`，默认 `32MB`。当 rollout 超过这个值时，Mobile Web 不再先走昂贵的完整 `thread/read`，而是优先使用有数量上限的 `thread/turns/list` 读取最近 turns。这个阈值故意低于 `200MB` 的界面提醒阈值：例如几十 MB 到一百多 MB 的线程可以更快切换进入，但不会提前显示“压缩续接”警告。只有达到 `200MB` 提醒阈值后，界面才提示压缩续接。

旧线程写出交接文件后，Mobile Web 会尽量确认旧线程交接 turn 已完成，然后才创建同工作区的新续接线程，并在首条 bootstrap 消息中带入源线程 ID、标题、工作区、rollout 路径和大小、运行权限摘要、源线程交接文件、续接 lineage、最近源线程上下文，以及当前工作区 `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` 摘录。bootstrap 不再固定注入其他工作区或无关线程的发布/提交规则；只有当前工作区上下文或源线程交接文件明确涉及这些规则时，新线程才应加载它们。前端不会为了发起续接而强制打开源线程，避免源线程过大时先卡在 thread detail 读取；续接任务会通过 job 状态显示当前阶段，手机页面刷新后也会用本地保存的 job id 尝试恢复查询，完成后自动切到新线程。

这个动作不会原地改写或裁剪旧 rollout 文件；它通过“源线程写交接文件 + 新续接线程 + 旧线程归档”降低后续交互需要读取的历史文件体积。旧线程在交接文件生成且续接线程启动成功后才会归档，仍可从归档记录中找回。首条 bootstrap 会要求新线程先读取源线程交接文件，再读取工作区持久上下文，并显式避免确认与当前工作区无关的发布或提交规则。续接成功后，服务端还会把 `newThreadId -> sourceThreadId -> handoffFile` 追加到 `.agent-context/thread-handoffs/index.jsonl`；下一次继续压缩时，bootstrap 会带入最多几层 lineage 摘要，并明确要求 Agent 在历史事实、风险、未完成事项或架构判断不确定时先读取 lineage 指向的 handoff 文件，而不是凭当前上下文猜。

交接文件和 lineage index 都属于本地运行态资料。创建交接目录时，服务端会在 `.agent-context/thread-handoffs/.gitignore` 写入忽略规则，防止这些自动生成的 Markdown/JSONL 资料被误提交。

线程列表中的任意线程都可以向左滑动露出 `归档` 按钮，用于直接归档不再需要显示的会话。这个动作会先弹出确认提示，确认后调用 `/api/threads/<threadId>/archive`，成功后刷新列表；如果归档的是当前打开线程，前端会清空当前详情视图并回到未选中状态。主动压缩续接不再放在线程行左滑动作里，仍保留在超阈值详情提示和长按菜单动作中。

左滑展开后，`归档` 按钮会保持可见，直到用户点击该按钮、点击线程卡片收起、打开另一行，或者刷新线程列表。移动浏览器在触摸滑动后可能补发一次合成点击，前端会吞掉这次同手势点击，避免按钮刚露出就被立即收起。

iOS/PWA 的横滑手势使用 Touch Events 路径处理；如果系统在横滑过程中发出 `touchcancel` / `pointercancel`，前端会根据最后一次横向位移完成展开判定，而不是直接收起按钮。

- The top-right timer shows current turn elapsed time as `本轮 HH:MM:SS`.
- The timer is red while a turn is active and muted after completion.
- During an active turn, the timer may append a compact activity label such as `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, or `等待批准`.
- The timer uses a fixed elapsed-time segment, so activity label length changes do not move the `本轮 HH:MM:SS` text.
- After the latest turn finishes, the timer switches to muted styling and shows `已结束` instead of any in-progress activity label.
- Live reasoning is not rendered as conversation rows.
- Command/file/tool activity appears as compact operation cards.
- Consecutive command/file operation updates show only the latest operation card unless normal visible content appears between two operations.
- The left-swipe Subagent status panel shows Subagents from the current live turn, treating completed/closed spawn-call rows in that live turn as current because the child Agent can still be running after the spawn call closes. Older historical Subagent records are omitted so long-running collaboration sessions do not show hundreds of stale entries.
- Page refresh prompts are gated by a full app-shell preflight. The browser must fetch and populate the target shell cache with the new HTML, CSS, JavaScript modules, manifest, service worker, and icons before the prompt is shown; clicking the prompt repeats that check and reloads only after the target cache is ready.
- The composer shows model, reasoning effort, permission, and quota as four compact runtime cards.
- Model, reasoning effort, and permission can be changed before sending. Existing-thread sends submit the selected values with the next `turn/start`; new-thread first messages submit the selected values when creating and starting the first turn.
- The composer shows 5-hour and weekly quota as separate reset-aware chips when app-server sends rate-limit updates. Rate-limit updates are cached by model key, and mobile quota display follows the currently selected composer model.
- The send button follows Codex Desktop behavior: empty composer during an active turn shows `Stop`; typed text or attachments switch it back to `Send`.
- When message submission is slow or fails, the UI shows an explicit sending/failed state, keeps the text and attachments available for retry, and logs a compact client event to `/api/client-events` for diagnostics. Quota/rate-limit failures are normalized into a model-specific "额度不足，请切换模型后重试" message when the backend error text indicates an exhausted limit.
- Composer drafts are saved in the browser per thread and per new-thread workspace. Text uses `localStorage`, attachments use IndexedDB when available, and the submitted draft is cleared only after a successful send.
- The send button has a guarded click path and a short watchdog. If a tap does not submit or a request stalls, Mobile Web reports the condition without forcing a full session reload, reducing the "假死" feeling during network or app-server delays.
- When a background thread transitions from running to completed/unread, Mobile Web can play a short local completion tone or haptic notification in the open browser session. Web Push remains the cross-device/background notification path.
- The message input uses a `contenteditable` textbox instead of a native `textarea` to reduce the extra iOS browser input accessory toolbar. Enter sends; Shift+Enter inserts a newline.
- The web app avoids programmatic composer focus after send, thread switch, refresh, and mobile foreground recovery. Mobile keyboards should open only after the user explicitly taps the message input.
- 中文说明：重新安装 PWA 后，Web Push 按钮会在初始化时从隐藏状态恢复显示，并根据当前环境显示“启用通知”“发送测试通知”“需要 HTTPS”“不支持”或“通知已阻止”。如果按钮提示需要 HTTPS，请确认手机端通过 HTTPS 地址打开；如果提示已阻止，需要到系统/浏览器站点权限里重新允许通知。

### 2026-05-10 Public 发布说明

本次 public 发布同步了最近一批移动端体验和 PWA 稳定性修正，重点是让公开仓库部署者在重新安装 PWA、启用推送和浅色主题使用时获得与当前私有验证版本一致的行为。

- PWA 安装仍保持全屏 `standalone` 模式，并在 manifest 中加入稳定 `id: "/"`、`display_override` 和 `launch_handler` 偏好。支持该能力的浏览器会更倾向于聚焦或导航已有客户端，降低重复打开独立 PWA 窗口的概率；不支持的浏览器会忽略该字段。
- 入口恢复提示保持关闭状态。进入网页/PWA 时不会显示 `Codex / 正在恢复界面 / 继续进入` 之类的覆盖提示，避免正常刷新时被旧页面提示打断。
- Web Push 通知点击逻辑调整为：优先聚焦已有 Mobile Web 窗口；如果必须新开窗口，则先打开 `/`，再通过 service worker 消息把目标线程 id 交给前端切换。这样可以减少 `/?thread=...` 被移动端 PWA 当作新启动目标的机会。
- 重新安装 PWA 后，通知按钮会显式移除初始 `hidden` 状态。按钮不再因为干净安装的 HTML 初始 class 而消失，用户可以继续看到当前通知能力状态并重新注册 Web Push。
- 浅色主题主背景从偏冷灰调整为更暖的浅色底色，并同步早期 `theme-color`，减少进入浅色模式时顶部颜色和页面背景不一致的闪动。
- Public 包版本升到 `0.1.2`，便于已经部署的实例通过更新提示和版本号确认这次发布已经生效。
- Public service worker 缓存升级到 `codex-mobile-shell-v14`。已安装到主屏幕的旧 PWA 可能需要关闭后重新打开，或等待 service worker 激活后再刷新一次，才能完全拿到新的 HTML、CSS、JS 和推送点击逻辑。

### 2026-05-11 Public 发布说明

本次 public 发布合入了 iPad 横屏双栏布局优化。它只改变较宽触控横屏设备上的菜单呈现方式，不改变手机、窄屏、iPad 竖屏和桌面端的主要交互。

- iPad 或类似触控平板在横屏、宽度至少约 `900px` 且高度至少约 `600px` 时，会显示左侧常驻 session/sidebar 和右侧对话区。这样横屏使用时可以直接切换线程，不需要每次点左上角菜单。
- 手机、窄屏窗口和 iPad 竖屏仍然使用抽屉式侧栏；主对话区继续占满屏幕，左边缘右滑和左上角菜单按钮仍按原逻辑打开 session 列表。
- 前端 JavaScript 的“是否抽屉模式”判断与 CSS 断点保持一致，避免横屏平板上 CSS 已经显示双栏、JS 仍按抽屉状态处理的错位。
- 横屏双栏模式下隐藏移动端菜单按钮，减少顶部栏上的重复入口；桌面宽屏的常驻侧栏行为不受影响。
- Public service worker 缓存升级到 `codex-mobile-shell-v15`。已经安装到主屏幕或浏览器缓存中的旧版本可能需要刷新一次，或等待新的 service worker 激活后，才能拿到这次布局 CSS 和前端 JS。

### 2026-05-11 Public 发布说明（续）

本次 public 继续合入剩余移动端改动（PR #14、#15、#16、#17、#19），重点覆盖线程创建入口、移动端交互反馈、线程切换诊断和模型/推理只读策略。

- 新增移动端侧栏“新建对话”入口：可先选 workspace，再发送首条消息创建新会话；workspace 下拉在手机端使用可滚动自定义列表，避免被底部输入区遮挡。
- 运行中追加输入增加“引导”反馈：当当前 turn 正在运行且输入框有内容时，发送按钮显示为“引导”，并提供“引导中/已送达/失败/完成”状态提示，降低误判为卡顿的概率。
- 增加线程切换与恢复诊断事件：记录 `thread_switch_*`、`mobile_resume_slow`、`mobile_resume_error` 等客户端事件，便于和服务端日志对齐分析卡顿位置。
- 手机端 Model/Reasoning 改为只读展示：从当前线程或默认运行时读取显示值，不再在手机端提供可编辑下拉，也不再在消息发送、压缩续接、新建对话首条消息中提交 `model/effort` 字段。
- mux 与 server 增加同步健康日志和日志裁剪，降低长时间运行后的日志膨胀风险并提高排障可见性。
- 本批前端资源较多，public service worker 缓存升级到 `codex-mobile-shell-v16`。已安装 PWA 或命中旧缓存的浏览器需要刷新一次或等待 service worker 激活后再验证最新界面。

### 2026-05-11 Public 发布说明（续二）

本次 public 继续合入 PR #21、#22、#23，重点是 iPad 横屏输入区稳定性、线程切换卡顿优化，以及桌面端错过通知后的补发能力。

- iPad 横屏（粗指针 + landscape）下，Composer 改为两行紧凑布局：第一行展示运行时控制与额度，第二行展示附件/输入框/发送，避免分屏宽度下控件挤压或遮挡。
- 新增横屏输入时的键盘避让逻辑：基于 `visualViewport` 计算键盘占用高度，在平板横屏聚焦输入框时抬升 Composer，减少键盘覆盖输入区的问题。
- 线程切换与刷新链路增加中止控制：切换线程会终止旧的 detail refresh/poll 请求，避免慢请求回写覆盖当前线程，降低“切线程后还在等上一线程返回”的卡顿感。
- 轮询节奏改为分级退避：短时间稳定后自动放慢刷新频率，减少无效请求和前端负担，同时保持活跃线程的及时更新。
- mux 重放策略更新：桌面端现在默认也参与历史通知重放；同时 replay buffer 改为缓存完整通知，再按客户端类型做发送时裁剪，避免桌面端重连后缺失关键 turn/item 事件。
- 新增回归测试：`test/tablet-layout.test.js`、`test/mobile-polling.test.js`、`test/protocol.test.js`，分别覆盖平板横屏布局、切线程中止逻辑、桌面端重放补发行为。
- public service worker 缓存升级到 `codex-mobile-shell-v17`。已安装 PWA 的设备可能需要刷新一次或等待新 service worker 激活后再验证以上改动。

### 2026-05-11 Public 发布说明（续三）

本次 public 合入 PR #18，并按当前指令以 PR 的交互为准：线程列表左滑动作从“压缩续接”改为“归档”。这会覆盖上一版在线程行左滑里提供主动续接的行为。

- 线程列表行左滑后显示 `归档` 按钮。点击后先确认，确认才会调用后端归档接口，避免误触直接隐藏会话。
- 新增 `POST /api/threads/<threadId>/archive`。后端优先通过 app-server `thread/archive` 执行归档；如果线程已经归档、找不到或本地状态已经显示隐藏，会把这类情况视为幂等成功。
- 线程列表过滤增强：服务端会读取 `state_5.sqlite` 中的 archived 状态、`archived_sessions` 目录、以及 `.jsonl.bak/.backup/.old` 这类备份 rollout 路径，把已归档或备份会话从可见列表里排除。
- 前端同步隐藏 `.jsonl.bak/.backup/.old` 备份 rollout，减少弱网络或本地状态回退时重新显示备份会话的概率。
- 保留超阈值详情页里的“压缩续接”流程，也保留长按菜单里的续接入口；本次只改变线程行左滑动作。
- 新增 `test/thread-archive.test.js`，覆盖左滑归档选择器、后端归档路由、以及合并后只保留一个 `mergeThreadStateFromStateDb` 的静态回归检查。
- public service worker 缓存升级到 `codex-mobile-shell-v18`。已安装 PWA 的设备需要刷新或等待新 service worker 激活后，才能看到左滑按钮文案和行为变化。

### 2026-05-11 Public 发布说明（续四）

本次 public 合入 PR #24 和 PR #25。PR #25 已包含 PR #24 的提交，因此以 PR #25 为主合并；PR #24 的 iPad 横屏 Composer 溢出修复也包含在本次提交中。

- iPad 横屏双栏布局再次收紧：左侧栏宽度改为 `clamp(340px, 36vw, 400px)`，主区和侧栏都设置 `min-height: 0` / `max-height: 100%`，避免分屏或横屏时 Composer 溢出可视区域。
- 移除上一版基于 `visualViewport` 的 Composer 键盘抬升逻辑，改为通过稳定的网格高度和容器约束控制布局；这减少了横屏输入时由 transform 引起的额外位移风险。
- Composer 顶部控制区改为固定高度 chip/card 布局：Model 和 Reasoning 合并为一个只读字段，Permission 改为只读字段；手机端不再提交 `permissionMode`，避免移动端运行权限和桌面端线程设置不一致。
- 额度显示从 `5小时 | 周额度` 的单行文本改为两个独立 quota chip，显示剩余额度和短格式重置时间，并根据剩余比例显示正常、警告、危险三种颜色。
- 手机窄屏下隐藏单独的 Permission chip，把模型、推理和权限压缩到一个状态 chip 内；两个额度 chip 保持同一行显示，减少 Composer 控件换行和挤压。
- 新增 `test/composer-quota.test.js`，并更新 `test/tablet-layout.test.js`，覆盖 Composer chip、quota chip、手机布局、平板横屏布局和固定高度控制。
- public service worker 缓存升级到 `codex-mobile-shell-v34`。已安装 PWA 的设备需要刷新或等待新 service worker 激活后，才能拿到新的 Composer CSS/JS。

### 2026-05-12 Public 发布说明

本次 public 调整 macOS 一键 shared launcher 的自动端口选择逻辑，避免 Codex Mobile Web 在未显式指定端口时落到常见的相邻服务端口 `8797`。在同一台机器上同时部署多个本地 Agent Web 服务时，每个服务必须使用不同监听端口，外层 Tailscale Serve / 反向代理也必须指向对应服务的实际端口。

- `start-codex-shared-mobile-macos.sh` 新增默认保留端口列表，默认值为 `8797`。自动端口模式仍从 `8789` 到 `8899` 里选择第一个可用端口，但会跳过保留端口。
- 新增 `CODEX_MOBILE_RESERVED_PORTS` 环境变量、`--reserved-ports <csv>` 参数和 `--no-reserved-ports` 开关。部署者可以按实际环境增加保留端口，例如 `CODEX_MOBILE_RESERVED_PORTS=8797,8787`；如果确实要允许所有端口参与自动选择，可以显式关闭保留列表。
- 如果用户显式传入 `--port 8797`，脚本会直接报错说明该端口被保留，而不是继续启动到可能与其他服务混淆的目标端口。
- Windows 默认启动脚本和 Node 服务默认端口仍是 `8787`。本次只改变 macOS 一键 shared launcher 的自动端口选择策略，不改变已有手动指定端口的部署方式。
- 部署后需要同时检查两层端口：本地监听端口用 `lsof` / `netstat` / `Get-NetTCPConnection` 确认；Tailscale Serve 或其他反向代理的 target 必须指向 Codex 的实际端口，例如 `127.0.0.1:8787` 或脚本打印出的自动端口。

本次 public 同步还加入了移动端禁用页面缩放的行为，避免 iOS/PWA 或移动浏览器因为双击、捏合手势把整个应用页面放大，导致 Composer、顶部栏和线程内容错位。阅读尺寸应通过应用内字体大小设置调整，而不是依赖浏览器页面缩放。

- `public/index.html` 的 viewport 锁定为 `minimum-scale=1`、`maximum-scale=1`、`user-scalable=no`，并保留 `viewport-fit=cover` 以继续适配 iOS 安全区。
- 页面最早期脚本会拦截 WebKit 的 `gesturestart` / `gesturechange` / `gestureend`、`dblclick` 和短时间双击 `touchend`，用于覆盖 iOS Home Screen / Safari 中 viewport 规则不完全生效的情况。
- `public/styles.css` 在根页面上设置 `touch-action: pan-x pan-y`，保留正常上下滚动、左右滑菜单/线程手势，但不允许浏览器把手势解释成页面缩放。
- `public/sw.js` 的 PWA shell cache 升级到 `codex-mobile-shell-v35`。已经安装到主屏幕或命中旧缓存的客户端需要刷新一次、关闭重开，或等待新的 service worker 激活后，才能拿到禁用缩放的 HTML/CSS/JS。
- 新增 `test/mobile-viewport.test.js`，覆盖 viewport 锁定、早期手势拦截、根 touch-action 以及 service worker cache 版本，避免后续 public/private 同步时丢失这类移动端约束。
- Public 包版本升到 `0.1.3`，方便已经部署的实例通过版本号和更新提示确认本次端口保留与禁用页面缩放发布已经生效。

本次 public 追加澄清自更新完成后的重启行为。实际更新流程已经能完成 fast-forward 并退出旧 Node 服务；如果部署方式没有外部监督进程，页面会断开连接并停在“已更新但服务未重新启动”的状态，需要在部署机手动执行原来的启动命令。

- 自更新可用提示不再简单写成“点击后拉取并重启”，而是说明更新后服务会退出，并依赖 Windows 启动任务、windowless supervisor 或 macOS shared launcher 拉起。
- 点击更新前的确认框增加手动部署说明：`node server.js`、`npm start` 或一次性 shell 启动没有自动重启能力，更新成功后需要人工重启。
- 更新已应用后的版本 pill 文案从“重启中…”调整为“等待重启…”，避免误导用户以为当前 Node 进程自己还在完成重启。
- 连接状态会在更新成功后提示“如连接断开且未自动恢复，请在部署机手动重启”，对应用户在另一台部署机上观察到的实际现象。
- 新增 `test/app-update.test.js`，覆盖前端提示和 README 中关于 supervisor/manual restart 的说明，避免后续同步时退回含糊文案。
- Public 包版本升到 `0.1.4`，便于已部署实例通过版本号确认本次自更新提示修正已生效。

### 2026-05-14 Public 发布说明

本次 public 发布同步两项移动端显示修复，重点是让公开部署在手机大字体和协作 Agent 场景下保持可读、可操作。

- 新增 `collabAgentToolCall` 的专门渲染。过去这类协作 Agent 调用会按未知项目直接展开完整 JSON，手机屏幕上会出现很长的工具调用结构；现在会显示为紧凑的“协作 Agent”卡片，优先展示工具名、状态、Agent、线程和任务摘要。
- 原始 JSON 没有丢弃。需要排查时，可以展开卡片里的“原始 JSON”详情并复制完整内容；正常阅读时默认折叠，避免阻断对话流。
- 手机端 Composer 的额度卡片做了轻量布局修正。四个运行时卡片仍保持接近等宽，只给右侧额度卡片增加少量宽度，并压缩额度内部间距，解决大字体下周额度百分号被截断的问题。
- 额度详情面板和现有 5 小时 / 周额度数据来源不变；本次只调整窄屏摘要显示，不改变后端限额解析、模型限额分组或发送逻辑。
- Public service worker 缓存升级到 `codex-mobile-shell-v42`。已经安装到主屏幕的 PWA 可能需要刷新、关闭重开，或等待新 service worker 激活后，才能拿到新的 CSS/JS。
- Public 包版本升级到 `0.1.5`，便于部署者通过版本号和自更新提示确认本次前端显示修复已经生效。

### 2026-05-14 Public 发布说明（续）

本次 public 发布继续同步移动端对话阅读体验修复，重点处理长 turn 结束后难以回到回复内容、以及 live 输出期间用户手动滚动会被自动贴底覆盖的问题。

- 新增“回到本轮回复”的向上浮动按钮。它只在当前线程最近一轮刚完成、页面已经在底部附近、且本轮最后一条 Codex 回复位于可视区上方时出现；点击后会定位到本轮最后一条 `agentMessage`，方便从底部回到总结/回复内容。
- 保留原有“回到底部”的向下按钮。不在底部时仍显示向下按钮；用户点击后会回到底部，并恢复当前 turn 的自动贴底行为。
- live 输出期间新增手动滚动识别。用户在对话区 touch、pointer 或滚轮滚动后，如果当前 turn 仍在输出，后续增量不会继续强制滚到底部；这能保留用户正在查看的回执位置。用户自己回到底部或点击向下按钮后，自动贴底恢复。
- 手机端额度摘要继续保留 5 小时额度和周额度之间的紧凑分割点，并维持上一版的窄屏宽度修正，避免大字体下周额度百分号被截断。
- Public service worker 缓存升级到 `codex-mobile-shell-v43`。已经安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新的 service worker 激活后，才能拿到新的滚动控制脚本和样式。
- Public 包版本升级到 `0.1.6`，便于部署者通过版本号和自更新提示确认本次移动端滚动行为修复已经生效。

### 2026-05-14 Public 发布说明（续二）

本次 public 发布调整“回到本轮回复”的触发逻辑。上一版按钮会根据最近完成的 turn 自动出现，后台线程刚完成后切换进去也可能出现；这与实际阅读动作不完全一致。本版改为只在用户主动向上滚动当前对话区后出现，表示用户明确想从底部回看本轮回答内容。

- “回到本轮回复”按钮不再因为线程刚完成、线程未读或切换到后台完成线程而自动显示。进入线程后如果没有手动向上滚动，页面只保留正常的底部阅读状态。
- 用户在当前 live turn 或最近完成的最新 turn 中手动向上滚动时，前端会记录本轮回答锚点，然后显示向上浮动按钮。点击后定位到本轮第一条 `agentMessage`，也就是本次回答的起始位置；如果没有 `agentMessage`，再回退到本轮第一个非用户、非 live-operation 项。
- 按钮仍然限制在近期上下文内：当前正在输出的 turn 可以触发；已完成 turn 只在现有 10 分钟窗口内触发，避免很久以前的旧会话随便上滑也出现本轮跳转提示。
- “回到底部”向下按钮和“回到本轮回复”向上按钮现在可以同时存在。向上按钮在样式上向左错开，避免两个浮动按钮重叠；点击向下按钮会清掉本轮回复跳转状态。
- live 输出期间的手动滚动暂停自动贴底行为继续保留。本次只是调整向上跳转按钮的显示条件和跳转目标，不改变发送、线程读取、额度显示或后端 app-server/mux 行为。
- Public service worker 缓存升级到 `codex-mobile-shell-v44`。已经安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新的 service worker 激活后，才能拿到新的滚动按钮脚本和样式。
- Public 包版本升级到 `0.1.7`，便于部署者通过版本号和自更新提示确认本次滚动按钮逻辑修正已经生效。

### 2026-05-14 Public 发布说明（续三）

本次 public 发布集成两个公开 PR：`#31 刷新线程详情标题来源` 和 `#32 隐藏不可用的推送入口`。目标是减少移动端列表/详情显示滞后，并降低普通 HTTP 局域网部署时的通知入口噪音。

- 线程详情读取现在会在已有 `state_5.sqlite` 或刚创建线程缓存摘要时，再尝试从 app-server 的 `thread/list` display summary 刷新标题、preview、cwd、updatedAt 和 status。这样移动端详情页更容易显示 app-server 当前标题，而不是停留在本地旧摘要。
- 这次刷新只合并展示字段，不覆盖 model、reasoning、sandbox、approval 等运行时字段。运行时继承和发送参数仍以本地状态/线程上下文为准，避免标题刷新影响后续 turn 的模型、推理等级或权限设置。
- 菜单里的 Web Push 通知按钮在不可用场景下会直接隐藏：包括服务端未启用 Push、当前页面不是安全上下文、或浏览器本身不支持 Push。普通局域网 HTTP 使用时不再显示一整行 `HTTPS required` 之类的提示。
- HTTPS 且浏览器支持 Push 时，通知入口仍保留原有行为：可以启用通知、发送测试通知，或在系统权限拒绝时显示被阻止状态。
- 新增 `test/thread-title-source.test.js`，覆盖详情页展示字段刷新和运行时字段不混合；`test/mobile-viewport.test.js` 增加不可用 Push 入口隐藏的静态回归测试。
- Public service worker 缓存升级到 `codex-mobile-shell-v45`。已经安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新的 service worker 激活后，才能拿到本次前端显示变化。
- Public 包版本升级到 `0.1.8`，便于部署者通过版本号和自更新提示确认本次 PR 集成已经生效。

### 2026-05-16 Public 发布说明

本次 public 发布同步近期移动端会话体验修正，并把 Web Push 的 Sub Agent 完成通知过滤改成更保守的服务端判定。

- 页面资源更新提示现在必须先确认新版本 app shell 资源已经完整写入目标 `codex-mobile-shell-*` 缓存，点击刷新时也会再次预检。这样可以避免只刷新了版本号、但 JS/CSS 仍来自旧缓存时出现未套样式的页面。
- 当 Mobile Web 因 8789 重启短暂断线时，页面会复用同一个刷新提示显示“服务重启中，点击刷新并重连”。点击后会等待 `/api/public-config` 恢复、预热最新 PWA shell cache、更新 service worker，再刷新页面重新连接，用户不需要退出 PWA 再打开。
- Public PWA shell 缓存升到 `codex-mobile-shell-v62`，确保本次刷新重连逻辑不会和旧 app shell 混用。
- 移动端输入栏回到正常底部布局流。无键盘时不再用 `visualViewport.height` 覆盖 `--app-height`，手机 composer 不再使用固定定位，从而减少 iOS/PWA 下输入栏悬空和底部留白。
- 侧边栏版本号旁新增同尺寸 `Restart` 按钮。点击后先确认，再调用 `POST /api/restart/shared-chain` 手动重启 Mobile Web shared chain；该动作只重启 Mobile Web、shared mux 和本地 app-server，不重启 WSL、Codex Desktop 或其它本机服务。原每日 `Codex Mobile Web Shared Chain Restart` 计划任务已取消。
- 当前线程的 Sub Agent 面板保持“当前进行中”视角。左滑打开后只看当前 live turn 相关的协作 Agent 状态，不再扫描历史完成记录，避免长协作会话里出现大量旧 Agent。
- Web Push 完成通知现在要求 `turn/completed` 能解析到已知主线程 id，并且该线程不能是 `thread_spawn_edges` child，也不能带 `agent_nickname` / `agent_role`。解析不到线程、SQLite 查询失败、查到未知 UUID/turn id，都会跳过通知，避免 Sub Agent 完成以 UUID 标题推到 iOS 通知中心。
- 后端 SQLite 读取改用 `adapters/sqlite-cli.js`，会优先使用 `CODEX_MOBILE_SQLITE3_EXE`，并覆盖常见 WinGet/Platform Tools `sqlite3.exe` 路径，减少隐藏启动环境 PATH 不一致导致的 Sub Agent 判定漏查。
- Public 版本升到 `0.1.9`，PWA shell 缓存升到 `codex-mobile-shell-v60`。已安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新 service worker 激活后，才能拿到本次前端和缓存策略变更。

### 2026-05-18 Public 发布说明

本次 public 发布修正 iPhone 和 iPad 竖屏下偶发的半屏显示问题。现象是对话区和 Composer 只占据屏幕上半部分，下面留下大块空白，通常出现在 iOS/PWA 键盘、前后台或竖屏恢复之后。

- 前端新增 `public/viewport-metrics.js`，把 `visualViewport` / layout viewport / 输入焦点的判定独立出来，并补充单元测试覆盖 stale half-height viewport。
- `--app-height` 现在只有在 `input`、`textarea` 或 `contenteditable` 真正持有键盘时，才会使用缩小后的 `visualViewport` 高度。
- 如果 iOS/PWA 在键盘关闭后仍回报半屏 `visualViewport`，页面会回退到完整 layout viewport，避免 app 网格固定在上半屏。
- 页面刷新预检、service worker app shell 缓存和服务端 build hash 都已包含 `viewport-metrics.js`，确保刷新提示只有在新资源完整可用后才触发。
- Public PWA shell 缓存升到 `codex-mobile-shell-v61`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到本次竖屏高度修正。

### 2026-05-19 Public 发布说明

本次 public 发布修正移动端对话区在两类场景下离开底部的问题：发送消息后新内容偶尔停在会话中段，以及横屏后再切回竖屏时本来位于最新内容的会话没有保持在底部。

- 前端新增 `public/conversation-scroll.js`，把“是否接近底部”、发送后的底部跟随、视口变化后的底部跟随拆成可测试的小模块；`public/app.js` 只负责接入当前线程状态和 DOM 滚动。
- 当前线程发送消息成功发起后，会进入短时间的同线程底部跟随窗口。后续用户消息、turn start、首段输出或键盘/Composer 高度变化触发重绘时，页面会继续回到底部，避免停在会话中段。
- `orientationchange`、窗口 `resize`、`visualViewport.resize` 和 `visualViewport.scroll` 也会触发短时间底部跟随，但只在当前线程当前或最近确实位于底部时生效；如果用户已经手动滚动查看历史内容，则不会强制拉回底部。
- 用户真实的触摸、指针或滚轮滚动会立即取消发送跟随和视口跟随；点击上箭头跳回回答开头也会取消视口跟随，避免有意查看上方内容时被再次拉回底部。
- Public PWA shell 缓存升到 `codex-mobile-shell-v63`，版本仍为 `0.1.9`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到本次滚动保持修正。

### 2026-05-18 Mobile 文件预览说明

- Agent 回复里的本地文件引用，例如 `[PROJECT_STATUS.md](</Users/.../PROJECT_STATUS.md>)` 或图片/PDF 路径，现在会显示成带“预览文件”提示的可点击控件。
- 移动端点击后不会尝试打开 iPad/手机本地路径，而是通过 Mac 上的 Mobile Web server 只读读取文件，并在当前页面里展示预览。
- 预览支持 Markdown、常见文本/代码/配置文件、JSON、YAML、CSV、图片和 PDF；JSON 会格式化，CSV 会用表格展示，Markdown 会按 Markdown 渲染。
- 预览限制读取大小，并拒绝敏感文件名或安全目录；图片/PDF 走只读内容流，不把二进制内容塞进 JSON。
- 预览范围限制在当前 thread workspace、该 workspace 所在 Obsidian vault，或显式配置的 `CODEX_MOBILE_FILE_PREVIEW_ROOTS`。
- Public PWA shell 缓存升到 `codex-mobile-shell-v63`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到本次文件预览入口。

### 2026-05-23 Public 发布说明

本次 public 发布合并 PR #33/#34/#35/#37/#38/#39/#40，并加入续接前的工作区 handoff 自动压缩，版本升到 `0.1.10`，Public PWA shell 缓存升到 `codex-mobile-shell-v64`。

- 移动端消息卡片现在可显示时间戳，便于在长对话和多设备切换时确认消息顺序。
- Markdown 有序列表渲染同时覆盖起始编号和续号场景：普通聊天列表默认按连续列表显示，源码/预览模式可保留原始起始编号。
- Agent 回复里的本地文件引用可在移动端页内预览，支持 Markdown、文本/代码、JSON、YAML、CSV、图片和 PDF，并限制预览根目录、敏感文件名和读取大小。
- PWA 更新提示增加刷新并重连入口，配合 app shell 资源检查，避免更新后仍停留在旧前端或旧连接状态。
- macOS 手动重启路径补充到共享链重启服务，保持和 Windows 手动重启入口一致的接口语义。
- mux 不再让子 mux 覆盖可用的共享 endpoint，降低 Desktop/Mobile 被切到不同 app-server 流的风险。
- Mobile 发起的新 turn 用户消息不会在 Desktop 重复显示，Desktop 仍能看到 Mobile 发起消息，但会避免本地 echo 与真实历史项叠加。
- 压缩续接开始前，Mobile Web 会检查目标工作区 `.agent-context/HANDOFF.md`；超过默认 `300KB` 时先归档完整文件到 `.agent-context/archive/context-compaction-<timestamp>/HANDOFF.full.md`，再把活跃 handoff 改写为短摘要，避免新续接线程再次继承多 MB 历史 handoff。
- 已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到 `v64` 前端资源。

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
- Historical notification replay is now enabled for both Mobile Web and Desktop by default. Use `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=0` if you need to disable Desktop replay for diagnostics.
- Replay buffer entries are stored as full notifications and are compacted only when a mobile client is actually sent the message. This keeps Desktop reconnect replay fidelity while preserving Mobile payload controls.
- TCP client backpressure is treated as a normal `drain` condition. The mux logs the delay but does not disconnect Desktop or Mobile Web just because one write returned `false`.
- Events missed before the mux replay buffer existed cannot be reconstructed from mux memory. Future offline intervals are covered within the configured buffer size and age.

### Approval Control

- Mobile Web renders app-server approval requests as cards in the current thread.
- Supported approval families include command execution, file change, and permission-profile requests.
- Each pending card exposes:
  - `允许一次`
  - `本会话允许`
  - `拒绝`
- The approval response goes back through the same shared app-server stream. This avoids creating a separate stream just to answer permissions.
- Approval cards render inside their associated turn when a `turnId` is available. After the request is answered, the large card collapses to a one-line status instead of remaining as a full card at the bottom of the conversation.

### Message Submission And Active Turns

- The browser sends a `clientSubmissionId` with each message submission.
- For modern clients that send `clientSubmissionId`, the server deduplicates only by that id. This prevents an intentional repeated short message, such as `continue`, from being incorrectly suppressed as duplicate content.
- For older clients that do not send `clientSubmissionId`, the server falls back to a content fingerprint from thread id, active turn id, cwd, model, effort, message text, and attachment metadata.
- If the same request id, or the same legacy content fingerprint, is repeated within `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS`, the server returns the original in-flight/completed result and does not call `turn/start` or `turn/steer` again.
- During an active turn, Mobile Web posts the active turn id. The server uses app-server `turn/steer` when available so Desktop and Mobile stay on the same active stream.
- After a successful active-turn `turn/steer`, the server also sends a deterministic mux-local `mux/userMessage` echo keyed by `clientSubmissionId`. This makes the user's mid-turn input visible in Mobile Web even when the app-server accepts the steering request without replaying a user-message item.
- Message submission now writes compact server-side `[message-submit]` diagnostics for received, empty, completed, and failed submissions. These logs include ids and counts, not raw message text.
- The browser can post compact `[client-event]` diagnostics such as UI stalls, send stalls, send-button no-submit cases, and send failures. These events are best-effort and are used only for local operational diagnosis.
- The browser preserves `mux-user-*` user-message echo items during thread refresh merges, because these synthetic visible inputs may not exist in the durable thread snapshot returned by app-server.
- For new turns, Mobile Web reads the thread's last rollout `turn_context` plus `state_5.sqlite` metadata and forwards the inherited approval policy, sandbox policy, reasoning summary, and configured verbosity where the app-server protocol supports it. This keeps Mobile Web turns aligned with the thread permissions that Desktop is using.
- Full-access threads are normalized for Mobile Web new turns: if the inherited sandbox is `danger-full-access`, or the permission profile grants root write access, Mobile Web sends `approvalPolicy: "never"` when the persisted approval mode is missing or still `on-request`. This matches the user-facing "full access" expectation and avoids redundant command approval cards on new turns.
- The composer permission chip displays the current thread/default permission as read-only status after model/reasoning. Mobile Web does not send a mobile-selected `permissionMode`; it follows the current thread runtime settings and the local `%USERPROFILE%\.codex\config.toml` defaults that the server resolves.
- The older mux-local `mux/userMessage` echo is still retained as a fallback for app-server builds that do not support `turn/steer`.

### Mobile UI Stability

- Conversation rendering uses a lightweight keyed DOM patcher so status polls and no-op refreshes do not replace the whole conversation.
- Live reasoning deltas update the timer activity label but do not create visible conversation rows.
- Mobile foreground recovery handles `visibilitychange`, `pageshow`, `focus`, `orientationchange`, `visualViewport` changes, and window resize.
- On iOS, returning from input-method or permission screens can leave a stale/blank composited viewport. The app maintains a JS-driven `--app-height` and runs several lightweight visual recovery passes after resume.
- Uploaded image messages render as centered thumbnails, not full-width raw images or data URLs.
- Non-image uploads are stored locally and referenced by absolute path in the message text.

### Mobile Session List And Copy Actions

- Theme preference is stored in `localStorage` as `codexMobileTheme`, with accepted values `system`, `dark`, and `light`. The early inline script applies the theme before the app bundle loads, reducing flash between dark and light modes.
- Font-size preference is stored in `localStorage` as `codexMobileFontSize`, with accepted values `small`, `default`, `large`, `xlarge`, and `xxlarge`. It lives in the same settings panel as theme selection instead of a separate sidebar-header dropdown, so display settings share one consistent mobile control surface.
- The session list can be opened through the menu button or a left-edge right-swipe gesture on overlay layouts. Opening the list is intentionally fast: existing list data is rendered immediately, and Mobile Web only performs a silent background refresh when the cached list is older than 60 seconds.
- Thread rows now support a long-press action sheet. Rename calls `PATCH /api/threads/<threadId>/name` with a max 120-character name; the server tries several app-server thread-title methods and returns `501` if the connected app-server does not support renaming.
- The long-press and swipe handlers avoid iOS text-selection side effects on thread cards by disabling selection on action rows and preserving text selection only inside editable rename controls.
- Copy buttons use the browser Clipboard API on secure contexts and fall back to a hidden textarea plus `execCommand("copy")` where needed. The copied text is kept only in memory for the current render cycle and is not persisted.

### Self Update

- On server startup, Mobile Web schedules a background `git fetch` against `CODEX_MOBILE_UPDATE_REMOTE` / `CODEX_MOBILE_UPDATE_BRANCH`, defaulting to `origin/main`.
- The browser also checks update status after login and displays it in the sidebar version pill. The pill stays passive when the checkout is current or when Git metadata is unavailable.
- Clicking an available update asks for confirmation and then runs a fast-forward-only update. It refuses to run when the current branch is not the configured branch, the working tree is dirty, or the local branch is ahead/diverged.
- After a successful fast-forward, the server sends the HTTP response and exits after a short delay. The normal Windows hidden startup wrapper supervises the listener and starts it again from the updated files.
- Manual starts such as `node server.js`, `npm start`, or a one-shot shell command do not include a supervisor. Those deployments apply the update, exit the old Node process, and then require the operator to manually restart the same service command.
- The update action only changes tracked repository files. Runtime state such as `%USERPROFILE%\.codex-mobile-web\access_key`, uploads, VAPID keys, and subscriptions remain outside the repository and are not overwritten.

中文说明：

- 本 public 版本把自更新能力放到侧边栏版本位置。登录后会后台检查当前仓库的 `origin/main` 是否有新提交；有可安全更新的提交时，版本 pill 会显示更新提示。
- 点击更新提示后会先弹出确认框。确认后只执行 fast-forward 更新，不会执行 reset、强制覆盖或合并冲突处理。
- 如果本地 public 部署目录有未提交改动、当前分支不是 `main`、本地提交领先远端或与远端分叉，自动更新会拒绝执行并提示原因。这样可以避免覆盖部署者自己的本地修改。
- 更新成功后，Node 服务会在返回响应后退出；Windows 隐藏启动 supervisor 会重新拉起服务。手动启动场景下，如果没有 supervisor，需要用户按原启动命令重新启动。
- 需要自动拉起的部署，应通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行。直接手动运行 `node server.js`、`npm start` 或一次性 shell 命令时，自更新会完成文件更新并停止旧服务，但不会凭空创建新的 Node 进程；这时需要在部署机重新执行启动命令。
- 本次 public 发布把 `package.json` 版本升到 `0.1.1`，高于当前 private 工作区的 `0.1.0`，便于用旧 public clone 测试“发现更新 -> 拉取 -> 重启 -> 版本升高”的完整链路。
- 本次 public PWA shell cache 同步升到 `codex-mobile-shell-v12`，安装到主屏幕的浏览器在 service worker 激活后会重新加载新的 HTML、CSS 和 JavaScript 资源。

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

In the default `auto` publish mode, a secondary `app-server --listen stdio://` mux will not overwrite an already reachable shared endpoint. This keeps short-lived agent/tool app-server sessions from stealing Mobile Web away from the Desktop-backed mux endpoint.

When `CODEX_MUX_KEEP_ALIVE=1`, the mux keeps the real app-server and TCP endpoint alive after the Desktop stdio client disconnects. A later Desktop launch through the same wrapper connects back to the existing mux instead of starting a second app-server.

The mux also proxies app-server requests such as command, file-change, and permission approvals. This allows Mobile Web to display approval cards and answer `允许一次`, `本会话允许`, or `拒绝` without creating a separate app-server stream.

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

For the easiest path, use the one-command launcher. It quits and relaunches Codex Desktop through the mux, starts Mobile Web in the background, and picks the first free non-reserved port from `8789` through `8899`. Port `8797` is reserved by default so it will not be selected automatically when another local Agent web service uses that port:

```bash
cd /path/to/codex-mobile-web
./start-codex-shared-mobile-macos.sh
```

The script prints the local URL, phone URL, access key file, and log paths. To force a specific port:

```bash
./start-codex-shared-mobile-macos.sh --port 8789
```

To adjust the reserved-port list:

```bash
CODEX_MOBILE_RESERVED_PORTS=8797,8787 ./start-codex-shared-mobile-macos.sh
./start-codex-shared-mobile-macos.sh --reserved-ports 8797,8787
```

If you intentionally want auto mode to consider every port in the range, disable the reserved list:

```bash
./start-codex-shared-mobile-macos.sh --no-reserved-ports
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
- Turn-completed notification title: `<thread-title>`.
- Turn-completed notification body: `This turn 已结束 · <local time>`.
- Turn-completed notifications bind `turn/started` metadata by turn id, then reuse that thread id and title on `turn/completed`. This avoids a completion notification from one shared-thread stream being labeled with another thread's title.
- Turn-completed Web Push and the normal thread list skip Sub Agent child threads recorded in `state_5.sqlite` `thread_spawn_edges` or marked with thread `agent_nickname` / `agent_role`. The parent/main thread completion can still notify, but individual Sub Agent completions do not create separate phone notifications or regular session rows.
- Clicking a notification opens Mobile Web and switches to the relevant thread when the thread id is available. The service worker sends a `codex-open-thread` message to an already-open Mobile Web window, so an installed iOS/PWA session does not have to rely on a full browser navigation to change threads.
- 中文说明：通知 payload 会带目标线程 ID。 如果 Mobile Web 已经打开，service worker 会聚焦现有窗口并把目标线程 ID 发给前端，前端收到后直接保存当前线程并调用线程详情加载接口；如果没有现有窗口，则先打开 `/`，再把目标线程 ID 通过消息传给新窗口。这样点击 Web Push 后应进入对应线程，同时减少移动端 PWA 把 `/?thread=...` 当成另一个启动窗口的机会。
- 中文说明：任务完成通知的标题直接使用完成任务所在的线程名，正文只显示完成状态和本地时间。服务端会在 `turn/started` 时记录 turn id 对应的线程 id 和标题，在 `turn/completed` 时复用这份绑定，避免一个线程的完成事件被标成另一个线程。

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
| `CODEX_MOBILE_RESERVED_PORTS` | Comma-separated ports skipped by `start-codex-shared-mobile-macos.sh` auto mode, default `8797`. Use this when other local Agent web apps reserve fixed ports. |
| `CODEX_MOBILE_CODEX_EXE` | Codex CLI executable path/name. |
| `CODEX_MOBILE_DISABLE_UPDATE_CHECK` | Disable startup/browser Git update checks when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_UPDATE_REMOTE` | Git remote used by the self-update check, default `origin`. |
| `CODEX_MOBILE_UPDATE_BRANCH` | Git branch used by the self-update check, default `main`. |
| `CODEX_MOBILE_UPDATE_CHECK_TIMEOUT_MS` | Timeout for update-check Git commands, default `15000`. |
| `CODEX_MOBILE_UPDATE_APPLY_TIMEOUT_MS` | Timeout for the fast-forward update command, default `120000`. |
| `CODEX_MOBILE_KEY` | Inline web access key. |
| `CODEX_MOBILE_KEY_FILE` | Custom access-key file path. |
| `CODEX_MOBILE_DISABLE_AUTH` | Disable auth when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_UPLOAD_DIR` | Upload storage directory. |
| `CODEX_MOBILE_MAX_UPLOAD_BYTES` | Max total upload bytes per message. |
| `CODEX_MOBILE_MAX_UPLOAD_FILES` | Max files per message. |
| `CODEX_MOBILE_SQLITE3_EXE` | Optional absolute path to `sqlite3.exe` for reading Codex `state_5.sqlite`. When unset, Mobile Web also checks common user-local Platform Tools / WinGet install paths before falling back to `sqlite3` on `PATH`. |
| `CODEX_MOBILE_THREAD_TURNS` | Number of recent turns returned to the phone when Mobile Web falls back to `thread/turns/list`, default `12`. |
| `CODEX_MOBILE_FULL_THREAD_TURNS` | Number of turns returned after normal-size sessions are fully read with `thread/read`, default `80`, capped at `200`. |
| `CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES` | Tail bytes read from a thread rollout to recover inherited turn runtime settings, default `4194304`. |
| `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` | Rollout JSONL size threshold for UI warnings and the continuation action, default `209715200` (`200MB`). |
| `CODEX_MOBILE_THREAD_DETAIL_ROLLOUT_MAX_BYTES` | Rollout JSONL size threshold where Mobile Web skips expensive full `thread/read` detail RPCs and uses bounded `thread/turns/list` first, default `33554432` (`32MB`). This is intentionally lower than the `200MB` warning threshold so large sessions can still open quickly without showing a warning. |
| `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` | Max characters in the rollout continuation bootstrap message, default `120000`. |
| `CODEX_MOBILE_CONTINUATION_RECENT_TURNS` | Recent source turns summarized into the continuation bootstrap, default `12`, capped at `30`. |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS` | How long Mobile Web waits for the source thread to write its continuation handoff file before creating the new thread, default `240000`. |
| `CODEX_MOBILE_CONTINUATION_LATE_HANDOFF_TIMEOUT_MS` | Extra background wait when the first handoff wait expires but the source thread may still be writing, default `600000`. |
| `CODEX_MOBILE_CONTINUATION_REUSE_HANDOFF_MS` | How long a recent source-thread handoff file may be reused when retrying continuation, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS` | Minimum source handoff file length accepted as complete, default `400`. |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS` | Extra wait for the source handoff turn to report a completed status after the handoff file is written, default `60000`. |
| `CODEX_MOBILE_CONTINUATION_JOB_TTL_MS` | How long finished continuation jobs stay queryable for the mobile UI, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_CONTINUATION_JOB_MAX` | Maximum continuation jobs retained in memory, default `50`. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_DEPTH` | Maximum previous continuation links included in a new bootstrap, default `2`, capped at `5`. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS` | Maximum characters used for lineage instructions and handoff excerpts inside a bootstrap, default `30000`. |
| `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES` | Size threshold for automatically compacting workspace `.agent-context/HANDOFF.md` before rollout continuation, default `307200` (`300KB`). |
| `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS` | Approximate number of recent handoff characters preserved in the compact active handoff after archival, default `60000`. |
| `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS` | Time window for treating repeated message submissions as the same request, default `90000`. Requests with `clientSubmissionId` are deduped by id; legacy requests without it fall back to content fingerprinting. |
| `CODEX_MOBILE_MESSAGE_DEDUPE_MAX` | Maximum number of recent message submissions kept in the dedupe cache, default `300`. |
| `CODEX_MOBILE_MUX_REPLAY_NOTIFICATION_LIMIT` | Maximum buffered mux notifications requested by Mobile Web on reconnect, default `200`; unresolved approval/server requests are still replayed separately. |
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
| `CODEX_MUX_PUBLISH_ENDPOINT` | Controls whether this mux writes the shared endpoint file. Default `auto` lets primary/Desktop muxes publish but prevents secondary `--listen stdio://` muxes from overwriting a reachable endpoint. Set `1` or `0` for diagnostics. |
| `CODEX_MUX_CODEX_ARGS` | Override real Codex app-server arguments. When unset, Desktop-supplied arguments are passed through, otherwise the mux falls back to `app-server --analytics-default-enabled`. |
| `CODEX_MUX_REPLAY_BUFFER_LIMIT` | Maximum buffered app-server notifications for Mobile Web reconnect replay, default `1200`. |
| `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS` | Maximum replay-buffer age in milliseconds, default `1800000` (30 minutes). |
| `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS` | Controls Desktop historical notification replay. Default is enabled (`1`); set to `0` to disable Desktop replay during reconnect diagnostics. |

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
- If Desktop loads complete history and then visually rolls back, temporarily set `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=0` and compare behavior with Desktop replay disabled.

### Approval Cards Do Not Appear

- Approval cards require the shared mux path because approvals are server requests on the app-server stream.
- Confirm the endpoint capabilities include `serverRequestProxy: true`.
- If Mobile Web is connected to a managed child app-server instead of mux, approvals for the Desktop stream will not appear in Mobile Web.

### iOS Returns To A Blank Or Black Page

- Refresh the page first to ensure the latest frontend files are loaded.
- Current public builds keep full-screen Home Screen `standalone` mode because that is the intended mobile experience. The manifest includes a stable app id and launch-handler hints, but iOS/WebKit can still create separate PWA scenes in some system-return paths.
- Entry recovery overlays are not shown. If iOS creates a separate black PWA scene, switch back to the original working scene or close the black scene from the app switcher; the page does not try to refresh the already-good original scene as a workaround.
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
