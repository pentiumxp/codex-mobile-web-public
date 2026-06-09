# Codex Mobile Web

Codex Mobile Web is a local web client for reading and controlling Codex sessions from a phone or another browser on the same network. It talks to `codex app-server`, reads local Codex state, and exposes a compact mobile UI with message sending, image/file uploads, model/effort read-only display, quota display, live operation cards, and turn timing.

This repository does not contain Codex credentials, uploaded files, or a bundled Codex binary. Those are local runtime state on each machine.

## Project Documentation

Engineering docs are split under [`docs/`](docs/README.md):

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for process boundaries, request flows, runtime state, and invariants.
- [`docs/MODULES.md`](docs/MODULES.md) for module ownership and the test map.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) for live diagnosis of stuck turns, disappearing messages, PWA cache issues, Push, mux drift, uploads, and Hermes Mobile plugin setup.
- [`docs/CONTEXT_STRATEGY.md`](docs/CONTEXT_STRATEGY.md) for model context size, image-upload context policy, and continuation bootstrap bounds.
- [`docs/COMPLEX_FEATURE_PATHS.md`](docs/COMPLEX_FEATURE_PATHS.md) for implementation paths on cross-cutting features.

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

## Hermes Mobile Plugin Mode

Codex Mobile Web can expose itself as an independent Hermes Mobile embedded-app
plugin. It is not a worker queue and does not use shared Hermes owner
authentication. Hermes must provide the normal Codex Mobile Access Key when it
registers or launches the plugin.

Plugin endpoints:

```text
GET  /api/v1/hermes/plugin/manifest
POST /api/v1/hermes/plugin/workspaces
POST /api/v1/hermes/plugin/callbacks
POST /api/v1/hermes/plugin/origins
POST /api/v1/hermes/plugin/launch
POST /api/v1/hermes/plugin/session
POST /api/v1/hermes/plugin/notifications
```

`/api/v1/hermes/plugin/manifest` is metadata-only and returns no secret
material. Registration and launch require the Codex Mobile Access Key through
`Authorization: Bearer <key>` or `X-Codex-Mobile-Key: <key>`.

Workspace registration stores only bounded Hermes metadata under the runtime
directory, normally:

```text
%USERPROFILE%\.codex-mobile-web\hermes-plugin-registration.json
```

The callback URL may be `http` or `https`; production Hermes Mobile deployments
should also register their HTTPS iframe origin through `/origins` so Codex can
emit the correct CSP `frame-ancestors`. The Access Key is never stored in that
registration file. Launch returns a short-lived `codexPluginLaunch` entry path
for the iframe; the browser immediately exchanges it for an in-memory plugin
session and scrubs the one-time URL instead of storing the long-lived Access Key.
Launch may also carry a bounded plugin target such as a workspace `cwd` or a
thread id. After session exchange, the embedded browser should prefer that
target over stale local restore state so Hermes-launched Wardrobe/Codex
workflows land in the intended workspace and keep the correct MCP context.
Launch may also carry bounded host appearance under `appearance.theme` and
`appearance.fontSize`. Supported theme values are `system`, `dark`, and
`light`; supported font-size values are `small`, `default`, `large`, `xlarge`,
and `xxlarge`. Codex copies only those whitelisted values into the short iframe
entry path as `pluginTheme` / `pluginFontSize` and into the plugin session
response as `appearance`. The embedded head script applies them before loading
the stylesheet and main app bundle, so Hermes-hosted plugins do not flash the
standalone/default theme or font size during initialization.
During slow embedded startup, `/?embed=hermes` keeps the iframe behind a stable
`正在加载 Codex...` loading layer until Workspace and thread-list data have loaded
and the final primary page, launch target, or route hint has rendered. This
prevents the host from showing a sequence of intermediate `Select a thread` /
`Loading threads...` screens before the usable plugin page appears.
When Hermes does not provide an explicit launch target or bounded route hint,
`/?embed=hermes` stays on the embedded primary page instead of restoring the
last locally opened thread. This prevents the plugin tab from auto-entering a
stale recent Codex thread and hiding Hermes's own bottom navigation.
If Hermes Mobile is served over HTTPS, the Codex Mobile entry must also be
HTTPS. Set `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or
`CODEX_MOBILE_PUBLIC_BASE_URL` so the manifest advertises that external URL.
On Windows, the included startup scripts accept `-HermesPluginBaseUrl`,
`-PublicBaseUrl`, and `-HermesPluginFrameOrigins`, so a scheduled-task
deployment can persist the HTTPS entry URL and the allowed Hermes iframe
origins instead of relying on a temporary shell environment. Example:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunNow `
  -HermesPluginBaseUrl "https://codex.example.test:8443" `
  -HermesPluginFrameOrigins "https://hermes.example.test"
```

After that, a manifest request with
`?hermesOrigin=https%3A%2F%2Fhermes.example.test` should return an HTTPS
`entry.url` and `program_api.base_url`; launch responses still return only a
relative `entry_path` with a short-lived token.
Plugin-mode notifications are delegated to Hermes Mobile instead of registering
Web Push inside the iframe. When configured, the Codex Mobile backend calls
Hermes `POST /api/hermes-plugins/codex-mobile/notifications` with a server-side
`X-Hermes-Web-Key` and a small Action Inbox payload containing a stable
`eventId`, title, summary, item type, priority, and route metadata. The Hermes
key is read only from `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY`,
`CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE`, or the
`CODEX_MOBILE_HERMES_WEB_KEY` fallbacks; it is never placed in the iframe URL,
frontend JavaScript, manifest, or plugin session. If the delegate is not
configured, standalone Mobile Web keeps its existing local Web Push behavior.
`/?embed=hermes` suppresses browser Push registration and local completion
alerts so Hermes owns both the Inbox record and Web Push delivery.
`/?embed=hermes` runs the same app as an iframe-embedded secondary app, hides
standalone navigation chrome, reports navigation state with
`codex-mobile.plugin.navigation`, and blocks `window.open` / `_blank` handoffs
that would create an external secondary window. Normal thread/workspace routes
report `canGoBack: true` so iOS Hermes Mobile forwards right-swipe/back to the
iframe, and thread detail publishes that state as soon as a thread id is
selected, before the detail read finishes. Codex handles ordinary thread-page
back by returning to its embedded primary page, which contains the thread
switcher and settings controls. That
primary page reports `canGoBack: false`, so Hermes Mobile can show its own
bottom navigation tabs. `hermes.plugin.back` closes modal/edit transient layers
such as file previews, dialogs, and subagent panels before page-level back is
applied.
Hermes notification opens may also include bounded iframe query hints such as
`pluginRoute`, `pluginThreadId`, `pluginTaskId`, and `pluginItemId` with
`pluginId=codex-mobile`. In embedded mode, Codex consumes those hints, opens
the matching thread when it still exists, scrolls the matching task/item card
into view when possible, then scrubs the URL back to the embed root. Missing
targets fall back to the normal embedded primary page plus a small in-app
diagnostic instead of exposing raw task content or leaving stale ids in the
address bar.
When the embedded iframe determines that its current session cannot recover
safely in place, it now asks Hermes to relaunch the plugin by posting
`codex-mobile.plugin.refresh_required` to the confirmed Hermes origin. The
payload is intentionally bounded: `type`, `version`, `reason`, and small route
hints such as `route.name`, `route.threadId`, `route.itemId`, `pluginRoute`,
`pluginThreadId`, `pluginTaskId`, and `pluginItemId`. It must not include the
Access Key, plugin session token, launch token, cookies, local paths, raw
logs, or prompt/tool payloads. Current refresh-required triggers cover
unrecoverable embed auth/session failures and server shell build changes
detected by the embedded iframe.
For Hermes plugin notifications, Codex Mobile now separates the short Push/InBox
preview from the long completed-turn receipt. The delegated notification keeps a
short `title + summary` for Web Push and Inbox preview, while the same backend
payload may also include a bounded Markdown `detailMessage` containing the final
assistant receipt text and Usage summary for Hermes thread-message storage. The
delegated Push/InBox `title` is resolved from the actual Codex thread name or
explicit nested thread title before falling back to preview text, so Hermes
plugin notifications do not show a generic plugin/post label as the thread
name. The backend uses an adapter-owned display-summary cache populated from
app-server `thread/list` and `thread/read` results before the local SQLite
fallback, because older continuation threads can keep a stale bootstrap prompt
as their SQLite title. If a completed-turn notification arrives before the
cache is warm, the server refreshes that thread's app-server summary before
sending the Push/InBox payload. The standalone Web App Push path stays
unchanged.

## Cross-thread Task Cards

Codex Mobile Web now has a first implementation of controlled cross-thread task
cards:

- `POST /api/thread-task-cards`
- `GET /api/thread-task-cards/:id`
- `POST /api/thread-task-cards/:id/approve`
- `POST /api/thread-task-cards/:id/delete`
- `POST /api/thread-task-cards/:id/revoke`
- `POST /api/thread-task-cards/:id/reply`

Behavior:

- A source thread can create pending task cards for one or more target threads.
- The pending card appears outside the target thread's normal message flow.
- The target thread can `Approve`, `Delete`, or `Reply`.
- The source thread can `Revoke` while the card is still pending.
- `Approve` injects the request as a real new target-thread turn, not as a fake
  static message row.
- `Reply` creates a reverse-direction pending card.

The browser currently exposes a minimal `Send task card` entry inside the thread
detail view. It resolves the target by exact visible thread title or explicit
thread id and uses the browser prompt flow for title/body entry. The stable
behavior boundary is the API plus `thread.threadTaskCards` in thread-detail
responses; the compose UX can evolve later without changing the state machine.

The composer reserves a leading non-empty `#` command for natural-language
cross-thread task-card commands. Plain `# ...` commands default to a manual
one-off card request; the legacy `#自由协作` prefix remains accepted and defaults
to autonomous collaboration. Task-card commands do not go through a separate
parse route. Instead, Mobile Web sends a bounded draft request to the current
Codex thread, lets the model interpret the command against the visible thread
list, and immediately creates pending target cards when the returned draft
parses successfully. The source thread does not show a second local `Approve`
step. The create call uses a stable draft-scoped idempotency key, the thread
list shows incoming `Task N` badges on every target thread, and a single-target
draft still switches to that target thread so the pending card is visible
without manual navigation.
Multi-target drafts create one pending card per target and keep the source
thread visible without rendering outgoing cards as local work items. When the
card id is known for a single target, Mobile Web also reuses its existing
route-hint focus path to scroll the target thread directly to that pending card
instead of leaving the user at the bottom of a long conversation. Pending
cross-thread task cards now
render after the visible turn list and approval stack, so they stay at the
bottom of the thread rather than appearing above historical messages. Once a
card is approved, deleted, revoked, or replied, it no longer renders in thread
detail; the injected turn becomes the visible follow-up surface. The current
thread now also removes a settled card immediately after a successful action.
For normal cards, target-side `Approve` remains mandatory. Plain `#` commands
default the draft to `workflowMode:"manual"` unless the user explicitly asks for
autonomous/free collaboration. `#自由协作` defaults the draft to
`workflowMode:"autonomous"` unless the user explicitly asks for a one-off manual
card. The first target-side approval then activates a workflow grant scoped to
that exact `workflowId` and the same two thread ids. Later cards carrying that
workflow id between the same two threads auto-inject as real
target-thread turns without another manual click, including reverse-direction
follow-up cards. A reused workflow id with a different thread pair still stays
pending and requires its own first approval.
Autonomous workflow approval also enables completion auto-return by default:
when the target turn injected by an approved autonomous card completes, Mobile
Web creates a reverse-direction return task card with the completed turn
receipt, reuses the same workflow id, and immediately auto-approves it back into
the source thread. The auto-return is idempotent by original card id plus
completed turn id, so repeated `turn/completed` notifications do not create
duplicate return turns. The return card is terminal: it can auto-inject back to
the source through the existing grant, but its own completion does not create a
second return. Auto-return titles also collapse repeated `Auto return:` prefixes
to a single prefix.
Target-side approval also persists a transient non-pending `approving` state
before calling the external target-thread `turn/start`, so reconnect,
continuation compaction, or thread refresh cannot resurrect the same `Approve`
card while the approved turn is already starting. If the external call fails
before acceptance, the service restores the card to `pending` with a bounded
audit error.
Current browser builds also suppress raw draft XML while the model is still
streaming the bounded draft reply, show a visible pending draft placeholder
during that gap, wait for the injected target-thread turn after target-side
`Approve`, and scroll to that injected turn when it becomes visible. Task-card
drafts and pending task cards now default to a medium card with a collapsed
details section instead of rendering the full body immediately. During
source-side automatic creation, the source thread does not render an interim
`Sending` draft card; only a real creation failure renders a dismissible
diagnostic. Source-thread draft cards also persist their settled `created` /
`dismissed` state in browser storage using a stable turn-and-draft-content key,
and re-check already stored cards for the source turn before auto-sending.
That re-check continues past ordinary assistant or plan messages in long source
threads, so a later valid draft still reaches `/api/thread-task-cards` instead
of being dropped before the task-card store is updated.
Leaving and re-entering the source or target thread therefore must not resurrect
an already created draft or create a duplicate target card from the old bounded
XML response.

Server-side task-card draft materialization now backs up the browser path. On a
fresh `turn/completed` notification, the listener fetches the source thread's
recent turns, scans assistant/plan items for the structured draft XML, resolves
target workspace metadata from the local Codex state, and calls the same
idempotent `createMany()` service path. Thread detail reads run the same
materialization before attaching visible cards, including the large-rollout
`thread/turns/list` mode. This keeps automatic collaboration from depending on
which browser page is open, which workspace filter is active, or whether a PWA
client refreshed at the right moment. Model-generated draft bodies are also
bounded before persistence: the card body limit is 8,000 characters, so a verbose
draft is stored with a head/tail truncation marker instead of failing with
`body_too_long`.

In Hermes embed mode, the sidebar now keeps the version pill, public-PR status,
and restart action visible instead of hiding the whole version-action row.
`压缩续接` still comes from the existing long-press thread menu, but the
confirmation step now uses an in-app dialog instead of `window.confirm`, so the
plugin iframe no longer depends on a host-blocked native confirm popup. When a
public-PR prompt is accepted, Mobile Web now routes that review task into
this workspace's new-thread draft instead of reusing whichever unrelated thread
happens to be open.

When Mobile Web decides the Hermes host must reload the embedded plugin iframe,
the current page now shows an explicit in-app refresh notice immediately before
posting `codex-mobile.plugin.refresh_required`, instead of appearing to reload
for no visible reason. That notice is intentionally bounded: if Hermes does not
replace the iframe immediately, Mobile Web auto-clears the notice after about
10 seconds rather than leaving a stale warning banner on screen.
response instead of waiting for a leave/re-enter refresh cycle. Examples:

```text
# 发给 Finance Review：请核验 5 月结账映射
# 让 Hermes 05-26 处理插件刷新联动
#自由协作 让 Hermes 05-26 配合处理插件刷新联动
```

If the model cannot choose at least one visible target thread, the source thread
shows a bounded failed draft diagnostic instead of auto-sending to the wrong
thread. `#` task-card commands still reject attachments for now.

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

When `-CodexExe` / `CODEX_MOBILE_CODEX_EXE` is not explicit, the Windows
startup scripts prefer the newest installed OpenAI Codex binary under
`%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`, then fall back to this local
runtime binary when it exists:

```text
%USERPROFILE%\.codex-mobile-web\codex.exe
```

If none of those files exists, it falls back to `codex` from `PATH`.

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

The manual restart calls the authenticated `POST /api/restart/shared-chain` endpoint. On Windows, the endpoint launches `restart-codex-mobile-shared-chain.ps1` after the HTTP response has been sent, so the page can show the confirmation result before the current Node listener exits. The script stops only the Codex Mobile Web shared chain: the `Codex Mobile Web` startup task, this workspace's hidden/windowless launchers, this workspace's `server.js`, and the selected profile mux/child process recorded in that profile's endpoint file. It removes the stale mux endpoint file, starts `Codex Mobile Web` again, and waits for HTTP plus mux readiness.

Operational rule: do not treat the restart as successful merely because the old
listener exited or the restart command was dispatched. Success means a new
`8787` listener exists and `/api/public-config` is reachable again. If a manual
or tool-driven restart stops the old listener but never confirms replacement
readiness, Mobile Web should be treated as down, not as "restarting normally."

On macOS, the same endpoint restarts only the current Mobile Web listener. When
the listener is running under a LaunchAgent, the endpoint cleans older
same-prefix submitted jobs and calls `launchctl kickstart -k` for that existing
service label, preserving the plist-managed environment. If the listener is
running under a system LaunchDaemon, the restart helper does not attempt
user-level `launchctl kickstart system/...`; it kills only the current listener
and lets LaunchDaemon KeepAlive start the replacement. If no service label is
available, it falls back to a one-shot detached `nohup` listener rather than
creating a persistent `launchctl submit` job. It keeps Codex Desktop and the shared mux running, so
the user can restart the `8789` browser server from the PWA without triggering the macOS `Quit Codex?` confirmation.

This manual restart intentionally does not restart WSL, Codex Desktop, or unrelated local services. Logs are written to `%USERPROFILE%\.codex-mobile-web\shared-chain-restart.log`.

The task still uses your normal Codex data paths by passing the installing user's profile path into the launcher:

```text
USERPROFILE=<your Windows user profile>
CODEX_HOME=<active profile home, defaulting to <your Windows user profile>\.codex>
CODEX_MOBILE_RUNTIME_DIR=<your Windows user profile>\.codex-mobile-web
```

The task runs `wscript.exe` against `start-codex-mobile-web-hidden.vbs`, which then starts PowerShell with window style `Hidden` and waits for it. The PowerShell wrapper starts a standalone mux endpoint when shared-stream mode is required, then starts Mobile Web.

```text
wscript.exe start-codex-mobile-web-hidden.vbs
```

The sidebar settings panel can also show local Codex profiles and switch the
single active Mobile Web profile. The profile switcher is deliberately not a
dual-provider mode: one listener still uses one active auth profile and one
mux/app-server chain at a time. The settings panel lists the configured
profiles, shows the safely derived logged-in account label/email and recent
quota snapshot for each profile, and calls the authenticated
`POST /api/codex-profiles/active` endpoint when switching. The endpoint writes
`%USERPROFILE%\.codex-mobile-web\codex-profiles.json` and restarts the Mobile
Web shared chain. The Windows restart script and hidden/windowless launcher
both read the same active profile store before resolving the mux endpoint. For
non-default profiles, the launcher preserves that profile's own `auth.json` and
`config.toml` but links thread/workspace state files such as `state_5.sqlite`,
`.codex-global-state.json`, `session_index.jsonl`, `sessions/`, and
`archived_sessions/` back to the default `%USERPROFILE%\.codex` home, so
switching accounts keeps the same visible workspaces and conversations. Raw
token values from `auth.json` are never returned to the browser.

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

For LaunchAgent or other non-interactive production startup, do not rely on a
login shell PATH. Set absolute executable paths in the plist or wrapper, for
example:

```bash
CODEX_MOBILE_CODEX_EXE="$HOME/.local/bin/codex"
CODEX_MOBILE_NODE_EXE="$HOME/HermesMobile/runtime/node-current/bin/node"
PATH="$HOME/.local/bin:$HOME/HermesMobile/runtime/node-current/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
```

If the UI shows `failed to start codex app-server (spawn codex ENOENT)`,
the Mobile Web process can start Node but cannot find the Codex CLI executable
in its own environment. Fix the launcher/plist environment or start through
`start-codex-mobile-web-macos.sh --codex "$(command -v codex)" --node "$(command -v node)"`.

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

- Supported browser image uploads (`jpeg`, `png`, `webp`) are compressed in the browser before submission. The default target is a maximum 1280px edge and JPEG quality `0.72`, keeping UI screenshots readable while avoiding multi-MB image payloads entering Codex context.
- By default, images are shown in Mobile Web as centered thumbnails but sent to Codex only as local file-path references in text. This keeps the UI visual without making image pixels part of app-server history. The authenticated upload preview route must return browser-renderable image MIME types such as `image/jpeg` for saved upload paths.
- Set `CODEX_MOBILE_IMAGE_CONTEXT_MODE=latest` or `vision` only when the model must inspect the latest uploaded image. Set `CODEX_MOBILE_IMAGE_CONTEXT_MODE=all` only for legacy all-image behavior.
- Turns that include image uploads no longer request app-server extended-history persistence by default. This treats images as temporary visual references and reduces repeated `replacement_history` image retention in later rollout compaction records. Set `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1` only when historical image rehydration is required.
- Image messages render as centered thumbnails in the web UI, including saved `.jpg` / `.jpeg` / `.png` / `.webp` upload paths served through `/api/uploads/file` and Codex-generated Markdown `data:image/png;base64,...` images.
- Non-image files are saved locally and referenced in message text by absolute path so Codex can read them through normal file access.
- Uploaded file contents are local runtime state and must not be committed.

## Interface Notes

- 中文说明：v256 修复线程详情投影模式下看不到 Codex app-server 权限批准卡的问题。线程详情 API 现在会把当前线程相关的 pending `serverRequest` 以压缩后的 public approval payload 一并返回，前端加载线程时会同步到现有 approval 渲染栈；即使 EventSource 时序错过，也能看到“权限需要批准”等卡片并完成批准。PWA shell cache 升级到 `codex-mobile-shell-v256`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v255 调整左滑侧边聊天底部布局。侧聊输入区改为和普通线程 composer 同构的 `+ / 输入框 / Send` 底栏，低频的“存为候选”和“清空”收进 `+` 工具行；最新侧聊回执下方直接附“发送主线程 / 完成后发送 / 存为候选”等动作，避免底部长期显示大块操作按钮。PWA shell cache 升级到 `codex-mobile-shell-v255`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v254 调整左滑侧边聊天布局。侧聊面板改为覆盖当前线程详情的全屏面板；只有当前线程存在 Subagent 状态时才显示上半区，空 Subagent 不再占用空间；侧聊标题、消息、候选、按钮和输入框改为继承当前字体大小设置，特大字体在侧聊里不再退回小字。PWA shell cache 升级到 `codex-mobile-shell-v254`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v253 让左滑侧边聊天从“便签/候选保存”升级为当前线程的私有方案聊天。发送侧聊消息后，服务端会为当前主线程创建或复用一个隐藏 sidecar Codex thread，以当前线程的模型/推理设置和工作目录上下文启动只读回复；回复只写回侧聊 transcript，不会自动进入主线程、不会 `turn/steer` 当前 turn，也不会直接改代码。用户仍需显式点“发送主线程”或“完成后发送”才会把候选指令注入主线程。隐藏 sidecar 线程会从普通线程列表和完成通知中过滤。PWA shell cache 升级到 `codex-mobile-shell-v253`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v253 合并 public PR #58，修复移动端键盘聚焦时 Composer 被 iOS 页面滚动顶到可视区域上方的问题。普通 Mobile/PWA 模式不再把 `window.scrollY` / document scroll 当成键盘 viewport offset；输入框聚焦后若 iOS 自动滚动 document，前端会把 window/body scroll 归零，避免和 `--app-height` 收缩叠加。Hermes embed 场景仍保留 host keyboard、safe area 和 iframe scroll offset 逻辑，不改变宿主下发键盘信息的处理。PWA shell cache 升级到 `codex-mobile-shell-v253`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v252 修复左滑侧边聊天在嵌入插件模式下被键盘遮挡的问题。侧聊面板现在高于主 composer，并在 `keyboard-open` 时按宿主下发的 `--app-height` 收缩为键盘紧凑布局，降低 Subagent 上半区和侧聊 textarea 的最小高度，确保正在输入的侧聊内容保持在键盘上方。PWA shell cache 升级到 `codex-mobile-shell-v252`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v252 合并 public PR #57，优化 Codex Mobile 浅色主题。浅色模式和跟随系统浅色模式的背景、面板、边框、代码块、引用、Usage 摘要、更新状态、按钮和当前线程选中态改为更柔和的低阴影配色，减少移动端长时间阅读时的冷灰和高对比噪声；用户消息、Usage 细分卡片、Fast 开关、Public PR/更新提示等控件在浅色主题下也有更一致的边界和状态色。PWA shell cache 升级到 `codex-mobile-shell-v252`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端样式。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v251 修复图片投影和用户上传图显示问题。历史/投影线程的 `imageView` / `imageGeneration` 会在 receipt-only 压缩模式下保留，不再只剩最新 turn 的 tool-generated 图片；无 turn_id 的 tool output 图片会优先按时间窗口归属到对应 turn。用户上传图如果被 app-server 回放为 `input_image.image_url` 本地 uploads 绝对路径，前端会改走受认证保护的 `/api/uploads/file`，不会把本地路径直接塞进 `<img>`。图片 URL 还会在插件 session key 变化后重渲染，避免旧 auth key 导致破图。PWA shell cache 升级到 `codex-mobile-shell-v251`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v250 同步 public PR #56，增强 GitHub 链接预览卡片。Markdown 中的 GitHub 链接不再自动追加多张完整预览卡，而是在链接附近显示紧凑的 GitHub 预览按钮；用户展开后才请求 `/api/link-previews/github` 并渲染完整卡片，收起后会隐藏卡片，减少移动端长回复里的视觉噪声和网络请求。预览按钮会显示 repo、Issue/PR/commit 摘要，加载失败或不支持时显示安全 fallback 链接；自动链接识别也覆盖括号、引号、冒号等常见前缀后的 GitHub URL。本次 private 反向同步来自 public 发布 `f994783`，没有复制 public 以外的 runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v250 新增当前线程侧边聊天第一版。线程详情左滑面板现在分为上半区 Subagent 状态、下半区侧边聊天；侧聊草稿、消息、候选指令和排队状态全部由服务端按线程保存，不使用浏览器本地存储做持久化。侧聊内容默认不会进入主线程，也不会 steer 正在运行的 turn；用户显式发送候选时才通过新的服务端 apply 路由启动主线程 `turn/start`，选择“完成后发送”时会在当前 turn 完成后幂等地发送一次。PWA shell cache 升级到 `codex-mobile-shell-v250`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v249 修复 Hermes 宿主嵌入模式下移动端 composer 底部安全区在窄屏 media rule 中被覆盖的问题。嵌入态 composer 现在统一使用 `max(12px, var(--host-bottom-safe-area, 0px))`，确保宿主隐藏底部 chrome 时 Codex 仍吃到宿主下发的安全区。PWA shell cache 升级到 `codex-mobile-shell-v249`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v248 合并 public PR #55，优化移动端 Markdown 与 Mermaid 渲染。普通文本/上传摘要里的 fenced Markdown 表格会优先渲染为可横向滚动的表格预览，并保留可展开源码；command output 中检测到的 Markdown 表格也会在原始输出 details 前显示预览，方便在手机上直接阅读结构化结果。Mermaid 规范化会合并 `A[标题]<br/>(补充)` 这类软换行标签，减少移动端图表解析失败；Mermaid 画布、表格和代码块横向滚动区域会阻止误触发子线程侧滑面板。PWA shell cache 保持 `codex-mobile-shell-v247`；已打开的浏览器/PWA 只需普通刷新或等待前端资源刷新后生效。本次 private 反向同步来自 public 发布 `e75ec78`，没有复制 public 以外的 runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v247 修复移动端发送消息后短暂出现两条用户消息的问题。前端 live `item/completed` 阶段会立即把 `mux-user-*`/本地 pending echo 和 app-server durable userMessage 合并；服务端线程详情投影缓存也会折叠同一条用户消息，避免后续轮询或刷新窗口再次带回重复卡片。PWA shell cache 升级到 `codex-mobile-shell-v247`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。
- 中文说明：v246 合并 public PR #53，优化移动端消息定位与 Usage 卡片展示。线程打开、提交新消息、同签名重渲染和 viewport 变化会使用有时限的底部跟随，正在流式输出的最新回复会延长跟随窗口，同时保留用户主动上滑阅读时的暂停逻辑；完成事件不再强制跳到长回执开头，而是保持最新回复可见，并继续提供回到本轮总结的浮动按钮。Usage 卡片改为默认折叠的摘要条，展开后显示 Context Window、thread total、rollout、最近 turn 输入/输出、cached/reasoning 子项以及 workspace context/handoff 文件大小，展开时会自动微调滚动位置避免卡片底部被 composer 遮挡。PWA shell cache 升级到 `codex-mobile-shell-v246`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。本次 public 发布只包含公开源码、README、测试和去除图片元数据后的 PR 展示截图；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。
- 中文说明：v220 收紧 Hermes 插件模式下的 SSE 断线恢复。`/?embed=hermes` 中如果 `/api/events` 短暂断开但 `/api/status` 和普通 JSON API 仍可用，客户端会在后台静默刷新线程列表并按退避节奏重试 EventSource，不再把列表页状态直接打成 `Reconnecting`，也不再用非静默列表加载造成“connected -> reconnecting -> connected”后的可见列表刷新。PWA shell cache 升级到 `codex-mobile-shell-v220`，更新后需要部署静态资源并刷新客户端。
- 中文说明：v219 同步 public PR #49，修复 Mermaid 预览渲染边界。Mermaid 大图的横向滚动范围现在从正常左边界开始，不再因为 flex 居中产生左侧内容裁切；较小图仍会在预览区域内居中显示。前端 Mermaid 规范化也会把未加引号的中文/括号 `subgraph` 标题转换为稳定 id + quoted title，减少 `subgraph 可见层（不是模型上下文原样）` 这类图表解析失败。本次 private 同步来自 public 发布 `09b1646`，没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v219 收口刷新提示和 Public PR 工作线程。页面刷新提示现在只在服务器 `clientBuildId` / `shellCacheName` 表示 app-shell 真正更新时出现；单纯静态资源 `buildId` hash 变化只更新内部记录，不再触发可见提示，避免开发或部署中间态反复弹“New version”。Public PR 提示确认后会优先复用当前 workspace 下标题为 `Codex Mobile Public PR` 的固定工作线程；找不到才创建新线程，并把新线程初始标题固定为该名称，减少每次 PR 检查后都要手动归档一次性线程。PWA shell cache 升级到 `codex-mobile-shell-v219`，更新后需要重启 8787 Node listener 并刷新客户端。

- 中文说明：v218 合并 public PR #48，新增移动端 Mermaid 图预览。Markdown 中的 ```mermaid 代码块会渲染为可缩放图表，手机和 iPad 可打开全屏预览、放大/缩小/重置，并保留可展开的 Mermaid 源码；Hermes 嵌入模式也把 Mermaid 预览作为可返回的 modal 状态处理。前端同时增强硬刷新：侧栏提供“硬刷新”按钮，刷新时会清理 `codex-mobile-shell-*` 缓存、重新注册 service worker，并用 cache-bust URL 重新加载页面。PWA shell cache 升级到 `codex-mobile-shell-v218`，Mermaid runtime 以 public-safe 的同源 `public/vendor/mermaid.min.js` lazy-load 方式随仓库发布。本次 public 发布只包含公开源码、文档、测试和 vendored 前端依赖；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v216 同步 public PR #46/#47 到 private。刷新提示现在只比较真实 app-shell build 信息，不再把普通 `version` 当作客户端 build id；`/api/public-config` 每次请求都会读取当前 shell build，避免旧启动快照和磁盘静态资源不一致时反复提示刷新。Composer 左侧 Fast 开关从红绿状态点改为闪电图标按钮，开启态用高亮闪电显示，文案统一为 `Fast mode on/off`。PWA shell cache 升级到 `codex-mobile-shell-v216`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v215 澄清目标弹窗里的 token 口径。目标状态条现在显示 `budget tokens`，表示 Codex app-server 在 `thread_goals.tokens_used` 中维护的目标预算计数，通常接近非 cached input 加输出等预算消耗口径；它不是 rollout 原始 `totalTokens` 总和，也不是完整上下文窗口 token。PWA shell cache 升级到 `codex-mobile-shell-v215`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v214 扩展 `/g` 目标弹窗。当前线程已有未完成目标时，重新输入 `/g` 会显示目标状态和动作区；Continue 会把 paused/blocked 目标恢复为 active，Pause 映射为 app-server 的 blocked 状态，Cancel goal 会通过官方 `thread/goal/clear` 取消目标，Save 继续通过 `thread/goal/set` 修改目标内容或 token budget。PWA shell cache 升级到 `codex-mobile-shell-v214`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v213 server-only 追记修复 Usage 在投影压缩路径中的丢失问题。投影快路径现在会先合并线程摘要中的 rollout path 再进入移动端压缩，确保 target-turn Usage 扫描能找到源 rollout；receipt-only 的旧 turn 压缩也会保留 `turnUsageSummary` 元数据，只去掉旧中间过程。该追记不改变 PWA shell cache，更新后需要重启 8787 Node listener。
- 中文说明：v213 增加完成态 Usage 自愈刷新。当前线程最新成功完成 turn 如果已经结束但本地状态仍没有 `turnUsageSummary`，前端会进行有限次数的详情 backfill refresh，直到 API 合并出 Usage 或达到次数上限；这用于覆盖 completion 后固定刷新时间点仍早于 Usage/投影稳定的情况。`interrupted`、failed、cancelled、active、in-progress turn 不会触发该自愈路径。PWA shell cache 升级到 `codex-mobile-shell-v213`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v212 修复 v211 后发现的 Usage 刷新兜底问题。服务端 target Usage cache 命中时现在也会检查当前返回的 turn id 是否缺 Usage；缺项时不会直接返回旧缓存，而会继续走 rollout 补扫。前端 `turn/completed` 后会安排两次线程详情刷新，避免第一次刷新早于 Usage/投影稳定时停留在“回执已完成但没有 Usage”的画面。PWA shell cache 升级到 `codex-mobile-shell-v212`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v211 修复 v210 后发现的完成态补偿问题。线程详情 Usage 读取现在会用当前返回的 turn id 做定向补扫；当固定 rollout tail 已经被后续输出挤出目标 turn 的 `token_count` 时，服务端会在运行时扫描上限内补读 rollout 并只保留 token 摘要，避免刚完成或最近已完成 turn 的 Usage 卡消失。长回执定位也会在完成后的线程刷新阶段再次检查：如果 `turn/completed` 事件当下只带了短 payload，后续刷新补齐完整最终回执后会自动定位一次到回执开头。PWA shell cache 升级到 `codex-mobile-shell-v211`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v210 修复完成回执后的定位和合并问题。`turn/completed` 现在会保留一个可跳回最终回执开头的锚点，即使用户已经点向下箭头沉底，也不会把这个锚点清掉；向上箭头仍只在回执开头位于视口上方时显示。线程详情动态投影把完成事件当作补丁合并，避免较短的完成 payload 覆盖掉已流式累计的 assistant 回执；同一 turn 的 `Usage` 卡也会合并为一张，避免出现两个内容不同的 Usage 框。`interrupted`、failed、cancelled、active 或其他未完成 turn 即使 rollout 里已有 `token_count`，也不会渲染完成 Usage 卡，避免把未写出最终回执的 turn 误看成“回执消失”。PWA shell cache 升级到 `codex-mobile-shell-v210`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v209 server-only 增加线程详情动态投影索引。服务端会先查 `projection-dynamic` / `projection-cache`，命中时不再等待大 rollout 的完整 `thread/read`；投影由完整详情读取 seed，并在原始 app-server notification 到达时实时追加 `item/started`、`item/completed`、agent/reasoning 文本增量、command/file 输出增量。rollout size/mtime、summary updated/status、turn 窗口和投影策略版本变化会让旧投影失效；miss 时仍回退到现有完整 `thread/read` 路径。该修复不改变 PWA shell cache，更新后需要重启 8787 Node listener。

- 中文说明：v208 server-only 调整线程详情裁剪策略：当前 live turn 会保留全部 compact command/tool/file/search/reasoning 中间过程；如果存在 live turn，它前一个已结束 turn 也会保留这些中间信息，方便刚结束后回查；如果没有 live turn，则最新已结束 turn 保留中间信息。更早的 older-history turn 只保留用户问题和最后一条 assistant/plan 回执，避免旧历史把大量过程重新带回浏览器。该修复不改变 PWA shell cache，更新后需要重启 8787 Node listener。
- 中文说明：v207 server-only 修复 v206 把线程详情主路径切到 bounded `thread/turns/list` 后丢失 command/tool/file/search 中间信息的回归。`/api/threads/:id` 恢复为先用完整 `thread/read` 读取并裁剪到最近 `CODEX_MOBILE_THREAD_TURNS` 个 turn；`thread/turns/list` 只在 `thread/read` 失败或超时时作为 fallback。该修复不改变 PWA shell cache，更新后需要重启 8787 Node listener。
- 中文说明：v206 减少从其他 App 切回后的线程详情重刷。当前线程已经加载且不是运行中、加载中、错误状态，也没有从线程列表看到更新时，前台恢复只做状态、线程列表和 SSE 恢复，不再重新读取整个详情；运行中线程仍会继续通过现有轮询/合并路径刷新。PWA shell cache 升级到 `codex-mobile-shell-v206`。
- 中文说明：v205 修复 Hermes 插件宿主域名切换后 Codex 线程详情右滑退出宿主的问题。嵌入模式发送 `codex-mobile.plugin.navigation` 和 `back_result` 前，会优先使用当前 iframe 的实际 `window.parent.location.origin`；只有无法读取父窗口 origin 时，才回退到 launch session 返回的 `hermes_origin` 或 referrer。这样宿主 HTTPS 域名从旧域名切到新域名后，线程详情仍能把 `canGoBack=true` 发给宿主，右滑返回 Codex 线程列表而不是退出到 Hermes。PWA shell cache 升级到 `codex-mobile-shell-v205`。
- 中文说明：v204 增加 app-shell 刷新策略 harness，并修复部署中间态导致的刷新循环。当前浏览器脚本如果已经是较新的 `codex-mobile-shell-vNNN`，而 8787 listener 的 `/api/public-config` 仍停在旧启动快照，前端会把它识别为需要重启 listener 的中间态，不再反复提示“刷新客户端”。只有服务端 shell 明确更新于当前脚本时，Standalone 才显示手动刷新入口，Hermes embed 才请求宿主刷新。PWA shell cache 升级到 `codex-mobile-shell-v204`。
- 中文说明：v203 改善 Hermes 嵌入模式下的 EventSource 断线恢复。`/api/events` 短暂断开但普通 JSON API 仍可用时，前端会用 `/api/status`、线程列表和当前线程详情进入降级轮询，并按退避节奏重试 SSE；不再反复把顶部活动提示标成“重连”，也不会在 API 健康时弹刷新入口。PWA shell cache 升级到 `codex-mobile-shell-v203`。
- 中文说明：v202 修复 subagent 结束后线程列表残留 UUID-only 线程的问题。服务端 rollout-session fallback 现在会读取 `session_meta.payload.agent_nickname` / `agent_role`，在线程列表最终合并后再次执行归档、subagent 和裸 UUID fallback 过滤；如果一个 Mobile fallback 摘要在 `session_index.jsonl` 补名后仍没有真实标题、且状态不是 live，就不会再显示成点不进去的历史残留线程。该修复是 server-only，不改变前端 PWA shell cache；更新后需要重启 8787 Node listener 才会生效。
- 中文说明：v201 放宽 `/g` 目标 objective 的长度上限。目标对话框输入框、Mobile Web 服务端转发到 `thread/goal/set` 的 objective、以及 `goals_1.sqlite` fallback 公开显示都从原来的短限制提高到 4000 字符，避免粘贴较长目标时被浏览器或服务端截断。PWA shell cache 升级到 `codex-mobile-shell-v201`。
- 中文说明：v200 修正 v199 的长回执仍会先流式刷新到阈值的问题。普通纯聊天回复仍可流式显示；但当前 live turn 里已经出现命令、文件、工具或搜索操作后，后续 `agentMessage` 会被视为最终回执，前端从第一段 delta 起只缓存不重绘，等 `turn/completed` 后一次性渲染完整回执；长回执仍会停在回执开头。PWA shell cache 升级到 `codex-mobile-shell-v200`。
- 中文说明：v199 修复 v198 热更后的运行中线程空白回归。运行中 `agentMessage` 会继续正常显示；只有当最新 live 回复超过长回执阈值后，前端才停止继续逐 token 重绘，保留已显示的前段，等 `turn/completed` 后一次性渲染完整回执并停在回执开头。PWA shell cache 升级到 `codex-mobile-shell-v199`。
- 中文说明：v198 将移动端线程详情首屏从 80 个 turn 调整为最近 10 个 turn；当用户滚动到顶部附近时，客户端会按每页 10 个 turn 自动加载更早历史，并保持当前阅读位置不跳动。最新 live turn 的长最终回执不再逐字流式渲染；完成后一次性显示，如果回执较长，视口停在该回执开头，用户可向下阅读或点向下箭头直接沉底。PWA shell cache 升级到 `codex-mobile-shell-v198`。
- 中文说明：v197 取消 32MB 以上线程详情的默认特殊路径。线程详情现在不再因为
  rollout 大小主动跳过 `thread/read`；客户端进入线程仍保持贴底。只有 `thread/read`
  真实失败时，服务端才会降级到 bounded `thread/turns/list`。PWA shell cache 升级到
  `codex-mobile-shell-v197`。

- 中文说明：v196 曾尝试让大 rollout 线程进入时停在最近历史窗口顶部；该行为已在 v197
  回滚，当前客户端进入线程仍保持贴底。

- 中文说明：Task card composer 命令现在以非空 `#` 开头即可进入单卡发送模式；裸
  `#` 不会触发空卡。`#自由协作` 继续作为兼容入口，并默认请求 autonomous workflow。
  大 rollout 线程详情仍默认快速读取最近 8 个 turn，但会保留 `thread/turns/list`
  游标，手机端可继续加载更早历史；展开后的旧 turn 不会被下一次普通刷新立即丢弃。
  PWA shell cache 升级到 `codex-mobile-shell-v195`。
- 中文说明：Hermes/profile quota v193 修正 Mac LaunchDaemon 场景下的托管
  `codex app-server` 账号继承问题。Mobile Web 现在会把解析后的 active
  `CODEX_HOME` 显式传给子进程，避免 `/api/status.codexHome` 已经是所选
  profile、但额度仍来自旧服务环境账号。Hermes 嵌入模式的
  `server_build_changed` 刷新请求也会按签名去重，避免旧缓存 iframe 对同一
  build mismatch 反复要求宿主刷新。PWA shell cache 升级到
  `codex-mobile-shell-v193`。

- Hermes/profile quota v192 keeps multi-account quota isolated when profile
  homes share thread state. The server no longer hydrates quota from shared
  rollout files, shared-profile homes also ignore source-less live quota
  snapshots, but they can display non-persistent live quota emitted by this
  listener's own managed child app-server. Profile quota cards only persist and
  reuse account-scoped live snapshots, and the browser clears stale local quota
  cache when `/api/public-config` or `/api/status` reports no valid quota
  snapshot. PWA shell cache upgrades to `codex-mobile-shell-v192`.

- Hermes embed v191 adds an iframe-owned left-edge swipe guard for iOS. When a
  Codex thread/detail/new-thread secondary page can go back, the iframe now
  handles that gesture with the same `hermes.plugin.back` path and returns to
  the embedded thread-switcher/settings primary page, even if the host page does
  not receive the initial touch sequence from inside the iframe. PWA shell cache
  upgrades to `codex-mobile-shell-v191`.

- 中文说明：Hermes Mobile 插件里的线程详情页现在会在线程 id 选中后立即发布
  `canGoBack: true`，即使详情内容还在加载中，iOS 右滑也应先回到 Codex
  插件内的线程列表/设置一级页，而不是直接退出到 Hermes Mobile。PWA shell
  缓存升级到 `codex-mobile-shell-v190`。
- Home view shows recent workspaces and recent threads.
- The Workspace dropdown ends with a `Create Workspace` action. It creates or
  registers a simple local folder under an allowed parent, stores only bounded
  metadata in `%USERPROFILE%\.codex-mobile-web\workspace-registry.json`, selects
  the new cwd, and opens a new-thread draft. Configure allowed parents with
  `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS`; do not edit `.codex` global state for
  this path.
- The sidebar menu header includes a compact settings button. The settings panel contains the theme control (`跟随系统` / `深色` / `浅色`) and the font-size control (`小字` / `标准` / `大字` / `特大` / `超大`) using the same segmented-button style.
- Theme and font-size choices are saved in the browser. Theme updates the page theme color metadata; iOS PWA status-bar color changes may require closing and reopening the installed app. The light theme now uses a slightly warmer page background so the daytime view is less cold gray while cards and controls stay crisp. Font size adjusts conversation text, markdown, code/table content, approval details, and the composer input.
- The composer runtime row starts with a tiny persistent Fast status dot before model/reasoning/permission/quota. Green means normal mode; tapping it turns red, briefly shows `Fast on`, and sends a hidden `fastMode` request so the server forwards Codex's `serviceTier: "priority"` Fast tier on the next `turn/start`. It does not change the selected model, reasoning effort, permission mode, or visible message text. `#` cross-thread task-card commands keep their bounded draft-request flow; active-turn steering cannot change the speed tier until the next new turn.
- The shell cache advances to `codex-mobile-shell-v139` for the Fast-dot UI.
- The sidebar header also shows the app version/update pill, a public PR status pill, and a same-size `Restart` button. After login, Mobile Web checks the configured GitHub remote in the background. If the remote branch is ahead, the pill becomes an update action; tapping it asks for confirmation, applies only a clean fast-forward update, then exits the Node listener so the existing startup supervisor can restart it from the updated files. The public PR pill checks the clean public repository for open pull requests and prompts whether to prepare a merge/publish review task; it does not merge or push public by itself. The `Restart` button is separate from Git self-update and opens an in-app confirmation panel before restarting the local Mobile Web shared chain. That panel first reads the recent thread list and shows any running sessions that may be interrupted.
- When a conversation is scrollable and the user is away from the newest messages, a floating down-arrow button appears above the composer. Tapping it jumps directly back to the latest turn; normal rendering still avoids forcing the scroll position while the user is reading older content.
- 中文说明：长对话如果因为恢复、切换线程或手动滚动停在历史消息中间，页面会在输入框上方显示“回到底部”浮动按钮。按钮只在当前线程已加载、内容可滚动且不在底部时出现；点击后立即回到最新 turn。用户阅读历史内容时，普通刷新仍不会强制自动滚到底部。PWA/手机浏览器如果仍显示旧界面，需要刷新一次或等待新的 service worker 缓存 `codex-mobile-shell-v36` 激活。
- On phones and tablet portrait/touch layouts, the sidebar menu is not persistent: the main conversation fills the viewport, and the menu opens only after the user taps the top-left menu button. Wide desktop layouts keep the persistent sidebar. On coarse-pointer landscape tablets with enough room, Mobile Web uses a two-column layout with a persistent sidebar and full conversation pane.
- On coarse-pointer landscape tablets, the composer uses a viewport-contained two-row compact layout: runtime indicators and quota on the first row, then attach/input/send on the second row. The split layout constrains both sidebar and main pane height so the composer stays inside the visible app surface.
- On mobile/touch layouts, swiping right from the left screen edge opens the session list without waiting for a network refresh. If the existing session list is newer than 60 seconds, Mobile Web reuses it immediately; older lists open first and then refresh quietly in the background.
- Thread lists and thread detail monitor rollout JSONL size. The mobile thread-list refresh requests a bounded 40-row page by default so startup, foreground resume, and thread switching do not pay the heavier 60/80-row list path when the visible list is small. Cold startup with a saved current thread sets the opening intent before the first app-shell reveal, then starts the saved-thread detail read in parallel with status/workspace/list refresh so users do not first sit on a transient `Select a thread` empty page. Startup emits bounded `startup_stage` diagnostics through `/api/client-events` so the local log can separate public-config, status, workspace, list, detail, and render delays. Resume events that fire during startup only run visual recovery and skip the full network resume path, avoiding duplicate status/list/detail requests while bootstrap is already opening the thread. At the default `200MB` threshold, Mobile Web shows a context-size warning and offers a same-workspace continuation action. The warning can be skipped for the current thread size, and will reappear if that thread grows again past the stored size. Completed turns can also show a lightweight context/token usage summary parsed from rollout `token_count` events: turn-level token use derived from cumulative token deltas across the scoped turn, cumulative token use, model context-window percentage, risk level, and rollout size. In usage summary rows, `in` displays uncached input (`inputTokens - cachedInputTokens`) when cached input is reported, while the context-window percentage still uses raw input tokens. Separately, Mobile Web persists completed-turn token usage into `%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite` in real time and aggregates it by Workspace for a compact red sidebar `总/周/今` row. Its `统计` button opens a full-screen stats page with per-day and per-project totals, splitting uncached input, cached input, output, and reasoning output because these token classes have different usage/cost meaning. Token stats display in millions rather than ten-thousands. Thread rows intentionally do not show a per-thread "today token" badge; the list stays focused on thread identity, task cards, and rollout size. Project rows normalize known Windows path mojibake against visible Workspace roots, so historical rows with a garbled cwd are merged under the readable Unicode Workspace name after the server restarts. The sidebar version pill opens an Updates panel: the current-checkout section keeps the existing safe fast-forward Git update path, while the Public release section checks the configured public repository's latest commit and only offers the same update action when the running checkout itself tracks that public repository. After user confirmation, the continuation action first asks the source thread to write a thread-specific handoff file, creates a source-named/date-suffixed continuation thread, sends a scoped bootstrap message, then archives the source thread.

- 中文说明：线程列表里的运行中刷新提示现在有超时兜底。Mobile Web 仍会在 app-server 列表暂时只返回 `notLoaded` 时保留运行提示，避免真实运行中的线程被普通刷新清掉；但如果同一提示超过固定窗口仍没有运行状态或完成事件，且当前线程也没有 active turn，前端会自动清掉这个本地提示，避免任务已经结束后列表仍一直显示刷新中。PWA shell 缓存升级到 `codex-mobile-shell-v181`，已打开的手机/PWA 需要点页面刷新提示、硬刷新或关闭重开后才能拿到这次前端修正。
- 中文说明：服务端 fallback 线程列表现在会从 rollout 尾部的安全事件类型推断 `active` / `completed`，并用 rollout 文件 mtime 修正 fallback `updatedAt`。这修复了 Hermes/远端正在写同一 rollout、但 app-server 列表行仍是 `notLoaded` 时运行中刷新提示不显示的问题，也能在 `task_complete` 后让旧本地提示立即清掉。这是服务端修正，重启 8787 listener 后旧前端也能读取新的状态。
- 中文说明：iPhone / Hermes embed 的底部 composer 现在改为更接近微信底栏的贴底方式。早期手机 composer 底部只留约 `7px`，后续 iOS 安全区适配改为完整叠加 `safe-area` 后在 Home Indicator / Hermes iframe 机型上抬得过高；本次移动端改用 `clamp()` 限制底部安全区保留量，让底栏背景继续铺满到底，但输入框、发送按钮和模型/推理/权限/额度行不再被大 inset 顶到半空。安卓 `safe-area=0` 时仍停在 8px 下限。PWA shell 缓存升级到 `codex-mobile-shell-v184`，已打开的手机/PWA 需要点页面刷新提示、硬刷新或关闭重开后才能拿到这次 CSS 修正。
- 中文说明：线程手动改名现在也会兜底处理 app-server thread-store 的 `database disk image is malformed`。如果底层 `state_5.sqlite` 写标题失败，但 Mobile fallback `session_index.jsonl` 写入成功，改名接口会返回成功并用 fallback 标题刷新列表；这不会修复 SQLite 本体，只避免 Mobile 端改名被已知坏库阻断。
- 中文说明：线程列表现在即使 app-server / `state_5.sqlite` 已经恢复可读，也会继续合并 `sessions/rollout-*.jsonl` 与 `session_index.jsonl` 的本地摘要。这样 recover 后 SQLite 缺少最近线程行时，带 rollout 的线程仍能回到列表；SQLite 行标题为空、退化成 thread id、或把 `Continuation Bootstrap Index` 当作长标题时，会用 `session_index.jsonl` 里的用户命名恢复显示。归档线程仍按 `archived_sessions`、DB 归档标记和备份 rollout 路径过滤，不会因为一条旧 index 记录重新显示。
- 中文说明：`/g` 目标提交现在会处理“旧 goal 已完成但 app-server 仍把 `thread/goal/set` 写回 completed 行”的情况。Mobile Web 在服务端代理层只读检查当前线程 goal；如果状态是 `complete`，先通过 app-server `thread/goal/clear` 清掉旧目标，再调用 `thread/goal/set` 创建新目标，避免前端收到 success 但没有新 goal turn 启动。这个修正是服务端路径，重启 8787 listener 后生效，不需要 PWA shell 缓存升级。
- 中文说明：`/g` 目标对话框里的 objective 输入框现在和主 composer 一样，按 Enter 会提交目标，Shift+Enter 才保留换行；token budget 输入框按 Enter 也会提交，目标 Send 按钮也走显式 `pointerdown` / `pointerup` / `touchend` / `click` 提交，不再只依赖浏览器默认 form submit。此前 objective 是 textarea，Enter 只会插入换行，在 Hermes Mobile 里看起来像“回车后没有任何反应”。已完成的旧 goal 不再作为新 `/g` 对话框默认内容回填，避免重新开目标时看到上一条已完成目标。PWA shell 缓存升级到 `codex-mobile-shell-v189`。
- 中文说明：`/g` 目标提交成功后，前端会立即把刚输入的 objective 和可选 token budget 显示成线程顶部目标卡。这样即使 app-server 接受 `thread/goal/set` 后立刻开始执行任务、但响应体暂时没有返回完整 goal 对象，用户输入的目标也不会从界面上消失；后续 `thread/goal/updated` 通知或 `goals_1.sqlite` fallback 会覆盖这张本地显示卡。PWA shell 缓存升级到 `codex-mobile-shell-v186`。
- 中文说明：`/g` 目标入口现在直接调用 Mobile 后端的 `POST /api/threads/<threadId>/goal`，由服务端转发到 Codex app-server `thread/goal/set`，不再发送一条普通消息让模型自己尝试创建目标。这个能力要求运行中的 app-server 来自 Codex CLI 0.135.0 或更新版本；Windows 启动脚本在未显式传 `-CodexExe` 时会优先选择 `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` 中最新的安装版，再回退旧的 `%USERPROFILE%\.codex-mobile-web\codex.exe`。mux endpoint 现在会记录真实 `codexExe`，windowless 启动器复用 endpoint 前会校验它是否匹配本次解析出的 Codex binary，避免继续复用旧 0.129 app-server。PWA shell 缓存升级到 `codex-mobile-shell-v185`。
- 中文说明：线程归档现在还会写入 `%USERPROFILE%\.codex-mobile-web\archived-thread-ids.json` 的 Mobile 本地索引，只保存 thread id 和归档时间。这样 state DB recover 或旧 profile 行重新出现在列表时，重新归档也能被 Mobile 自己的列表过滤识别，不需要依赖 app-server 成功改写那条旧 SQLite 记录。
- 中文说明：压缩续接现在会在新线程 bootstrap 写入成功后迁移源线程的未完成 CLI goal。`active` 目标会复制到新线程并保留 active 状态；源线程会尽量冻结为 `blocked`，避免两个线程同时继续同一个目标。`blocked`/旧 `paused` 目标会复制为新线程的 `blocked` 目标，不会自动开始执行。已完成或非可迁移状态的目标不会复制。迁移只复制 objective 和剩余 token budget，不复制旧线程已经消耗的 `tokens_used` / `time_used_seconds`；所有写入仍通过 app-server `thread/goal/set`，不直接写 `goals_1.sqlite`。
- The continuation bootstrap message explicitly carries source thread metadata, rollout size, inherited runtime settings, the source-thread-generated handoff file, bounded continuation lineage, recent visible turn summaries, and current-workspace `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` excerpts. It does not inject fixed private/public GitHub release rules; those appear only if the current workspace context or source-thread handoff says they are relevant.
- Long-pressing a session row opens a mobile action sheet with rename, continuation, and archive actions. Archive asks for confirmation, calls `/api/threads/<threadId>/archive`, and refreshes the list after success. The row disables accidental system text selection during the long press, while rename input fields still allow normal text selection and editing.
- Agent replies include a `复制全文` action. Markdown code blocks and command/output detail blocks include smaller copy buttons so users can copy structured text without manually selecting content on iOS.

### Rollout 压缩续接

当线程的 rollout JSONL 达到阈值时，界面按钮显示为“压缩续接”。默认提醒阈值是 `200MB`，可用 `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` 覆盖。详情页提示可以点“跳过”暂时隐藏；隐藏记录按“线程 id + 当前 rollout 大小”保存，因此该线程继续增长后会再次提示。确认“压缩续接”后，Mobile Web 会先在旧线程中启动一个交接整理 turn，要求旧线程把本线程真实的交接重点写入当前工作区的 `.agent-context/thread-handoffs/<id>.md` 文件。该文件必须只总结源线程和当前工作区相关的目标、已完成事项、未完成事项、关键文件、验证结果和风险。

线程详情读取不再按 rollout 大小主动跳过完整 `thread/read`。即使 rollout 超过 32MB，Mobile Web 也会先向 app-server 请求完整详情并裁剪到最近 `CODEX_MOBILE_THREAD_TURNS` 个 turn；只有 `thread/read` 真实失败时，才降级到有数量上限的 `thread/turns/list` fallback。这样可以保留 `thread/read` 提供的 command/tool/file/search 中间信息。当前 live turn 会保留全部 compact 中间过程；如果存在 live turn，它前一个已结束 turn 也保留中间信息；如果没有 live turn，则最新已结束 turn 保留中间信息。更早的 older-history turn 只保留用户问题和最后一条 assistant/plan 回执。`CODEX_MOBILE_THREAD_TURNS` 控制移动端 compact detail 首屏、fallback、以及 older-turn 分页大小，默认是最近 10 个 turn。`200MB` 的 rollout 阈值只用于界面提醒和压缩续接动作。

跨线程任务卡片 draft 仍要求模型返回可见目标里的精确 `threadId`。如果模型只把目标线程 ID 的后半段抄错，前端只会在可见线程中存在唯一且足够长公共前缀匹配时，把目标恢复为真实线程 ID；无法唯一恢复时仍会把 draft 标为失败，避免把卡片投递到不确定目标。

旧线程写出交接文件后，Mobile Web 会尽量确认旧线程交接 turn 已完成，然后才创建同工作区的新续接线程，并在首条 bootstrap 消息中带入源线程 ID、标题、工作区、rollout 路径和大小、运行权限摘要、源线程交接文件、续接 lineage、最近源线程上下文，以及当前工作区 `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` 摘录。bootstrap 不再固定注入其他工作区或无关线程的发布/提交规则；只有当前工作区上下文或源线程交接文件明确涉及这些规则时，新线程才应加载它们。前端不会为了发起续接而强制打开源线程，避免源线程过大时先卡在 thread detail 读取；续接任务会通过 job 状态显示当前阶段，手机页面刷新后也会用本地保存的 job id 尝试恢复查询，完成后自动切到新线程。

这个动作不会原地改写或裁剪旧 rollout 文件；它通过“源线程写交接文件 + 新续接线程 + 旧线程归档”降低后续交互需要读取的历史文件体积。旧线程在交接文件生成且续接线程启动成功后才会归档，仍可从归档记录中找回。首条 bootstrap 会要求新线程先读取源线程交接文件，再读取工作区持久上下文，并显式避免确认与当前工作区无关的发布或提交规则。续接成功后，服务端还会把 `newThreadId -> sourceThreadId -> handoffFile` 追加到 `.agent-context/thread-handoffs/index.jsonl`；下一次继续压缩时，bootstrap 会带入最多几层 lineage 摘要，并明确要求 Agent 在历史事实、风险、未完成事项或架构判断不确定时先读取 lineage 指向的 handoff 文件，而不是凭当前上下文猜。

如果源线程有未完成 CLI goal，压缩续接会在新线程 bootstrap 写入完成后把目标复制到新线程。复制范围是 objective、状态和剩余 token budget；旧线程的已消耗 token/时间不迁移。`active` 源目标会在复制后尽量冻结为 `blocked`，`blocked`/旧 `paused` 源目标会在新线程保持 `blocked`，已完成或预算/用量限制等非可迁移状态不会复制。迁移结果会出现在 continuation job/result 和 lineage 的布尔诊断字段里，但 lineage 不写入目标正文。

交接文件和 lineage index 都属于本地运行态资料。创建交接目录时，服务端会在 `.agent-context/thread-handoffs/.gitignore` 写入忽略规则，防止这些自动生成的 Markdown/JSONL 资料被误提交。

线程列表中的任意线程都可以通过长按菜单选择 `归档`，用于直接归档不再需要显示的会话。这个动作会先弹出确认提示，确认后调用 `/api/threads/<threadId>/archive`，成功后刷新列表；如果归档的是当前打开线程，前端会清空当前详情视图并回到未选中状态。线程行左滑不再露出归档按钮；主动压缩续接仍保留在超阈值详情提示和长按菜单动作中。

- The top-right timer shows current turn elapsed time as `本轮 HH:MM:SS`.
- The timer is red while a turn is active and muted after completion.
- During an active turn, the timer may append a compact activity label such as `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, or `等待批准`.
- The timer uses a fixed elapsed-time segment, so activity label length changes do not move the `本轮 HH:MM:SS` text.
- After the latest turn finishes, the timer switches to muted styling and shows `已结束` instead of any in-progress activity label.
- Live reasoning is not rendered as conversation rows.
- Command/file/tool activity appears as compact operation cards. The latest-turn operation card uses a four-line visual budget: one metadata row plus up to three clipped detail lines.
- Operation cards are shown only while the latest turn is still running. After a turn completes, command/tool/file/search cards are removed from the compact mobile detail; when usage data exists, the final frame is the Usage summary.
- Consecutive command/file operation updates show only the latest operation card unless normal visible content appears between two operations.
- The left-swipe Subagent status panel shows Subagents from the current live turn, treating completed/closed spawn-call rows in that live turn as current because the child Agent can still be running after the spawn call closes. Older historical Subagent records are omitted so long-running collaboration sessions do not show hundreds of stale entries.
- Page refresh prompts are gated by a server-started build id and a full app-shell preflight. `/api/public-config` reports the shell cache/build snapshot captured when the 8787 listener started, not whatever files happen to be mid-edit on disk. The browser checks for this after startup, foreground/focus recovery, EventSource reconnect/status, and successful thread-list refresh, then fetches and populates the target shell cache with the new HTML, CSS, JavaScript modules, manifest, service worker, and icons before the prompt is shown; clicking the prompt repeats that check, applies the latest `/api/public-config` quota snapshot to the composer immediately, and reloads only after the target cache is ready.
- The composer shows model, reasoning effort, permission, and quota as four compact runtime cards.
- Model, reasoning effort, and permission can be changed before sending. Existing-thread sends submit the selected values with the next `turn/start`; new-thread first messages submit the selected values when creating and starting the first turn. A per-thread runtime selection is saved in the browser draft store even when the composer text is empty, so leaving and reopening the app restores the model/reasoning/permission choice. After a send, Mobile Web clears only text and attachments; it keeps the runtime-only draft so the composer does not immediately fall back to stale thread metadata while the new turn is starting.
- The composer shows 5-hour and weekly quota as separate reset-aware chips from `/api/public-config` / `/api/status` snapshots for the active Mobile Web chain. Source-less `account/rateLimits/updated` notifications are recorded server-side but not broadcast to the browser, and rollout scans are only a cold-start snapshot fallback, so another workspace's quota event does not overwrite the current composer display. On app-server initialize, Mobile Web also calls `account/rateLimits/read` so a fresh listener can show the current account quota before the next quota notification. A managed child app-server started by the same listener may supply live quota for a shared-profile active home, but that snapshot is not persisted as reusable profile quota. Rate-limit snapshots are cached by model key, mobile quota display follows the currently selected composer model, and clicking the page-refresh prompt also refreshes the visible quota snapshot before the browser reloads.
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
- 用户在当前 live turn 或最近完成的最新 turn 中手动向上滚动时，前端会记录本轮回答锚点，然后显示向上浮动按钮。点击后定位到本轮最后一条 `agentMessage`/`plan`，也就是最终回执或总结位置；如果没有这类回执，再回退到本轮最后一个非用户、非 live-operation 项。
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
- 用户真实的触摸、指针或滚轮滚动会立即取消发送跟随和视口跟随；点击上箭头跳回本轮最终回执/总结也会取消视口跟随，避免有意查看上方内容时被再次拉回底部。
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

### 2026-05-23 Public 发布说明（续）

本次 public 热修修正移动端在服务器没有实际更新或重启时，误显示“服务重启中，点击刷新并重连”的问题。版本升到 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v65`。

- 前端不再把普通 `/api/events` SSE 短暂断线直接判断为服务器重启。iOS/PWA 前后台切换、网络抖动或 EventSource 自动重连期间，只会先显示连接状态为 `Reconnecting`。
- 只有手动点击 Restart 后，刷新提示才继续使用“服务重启中，点击刷新并重连”的文案，避免用户误以为服务器正在被更新或重启。
- 如果 SSE 断线后进一步的 `/api/status` 健康检查也失败，页面会显示更准确的“连接中断，点击刷新并重连”，用于真实连接不可恢复的场景。
- 当 SSE 重新打开或 `/api/status` 恢复成功时，页面会自动清除临时重连提示，避免一次短暂断线留下持续可见的刷新入口。
- 已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到 `v65` 前端资源。

### 2026-05-24 Public 发布说明

本次 public 发布优化移动端工具/命令状态卡片和消息时间显示。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v71`。

- 移动端 `Command`、`File Change`、工具和搜索状态卡片改为两行紧凑布局：第一行显示操作类型和状态，状态紧跟在类型后面；第二行显示具体命令、文件列表或工具摘要，并保持单行截断。
- 同一操作目标的状态更新会在同一个卡片里刷新，不再堆出多张重复卡片。命令按可执行程序合并，即使参数或脚本内容变化，也会刷新同一个 `Command` 卡片；文件变更按文件集合合并，工具/搜索按身份或摘要合并。
- 旧的“只保留最新操作卡片 / 临时移除旧卡片”防闪烁路径已移除。现在最新 turn 中不同目标的操作卡片可以按原始顺序出现，但同一目标只保留一个卡片并更新状态。
- 消息卡片时间戳修正为优先使用 item 时间、完成 turn 的显式完成时间，再回退到 turn start。运行中或未完成的 turn 不再使用线程级 `updatedAt`，避免续接线程把创建时刻显示成当前回复时间。
- 已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v71` 的新卡片样式和时间显示逻辑。

### 2026-05-24 Public 发布说明（续）

本次 public 热修继续优化移动端长 turn 完成后的对话渲染稳定性。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v73`。

- 历史上下文压缩提示现在把压缩状态纳入对话渲染签名，并且同一个 turn 内只保留最新的压缩提示。正常顺序应为压缩过程中显示 `历史上下文正在压缩`，完成后显示 `历史上下文已压缩`，避免旧的完成提示和新的进行中提示同时堆叠造成误读。
- Codex 长回复在 live 输出和完成后的渲染路径统一使用 Markdown 渲染，减少 turn 结束时从纯文本节点切换到 Markdown 结构造成的大面积重排和闪动。
- 当最终 app-server 快照用新的 item id 返回同一段 Codex/plan 文本时，前端会保留已有渲染身份，避免长输出结束后整块回复重新动画或重建。
- 修正 final refresh 中同一条 `You` 消息换 id 后被追加到最底部的问题。现在匹配的用户消息会在原位置合并，并消费掉 incoming duplicate，避免 turn 结束后旧用户输入重复出现在底部。
- 新增 `test/conversation-render.test.js` 覆盖上下文压缩提示、长回复完成渲染稳定性，以及用户消息 final refresh 去重。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v73` 的修复。

### 2026-05-24 Public 发布说明（续二）

本次 public 热修继续收紧移动端上下文压缩提示和工具/命令卡片的显示边界。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v76`。

- `历史上下文正在压缩` 不再由 `contextCompaction` 类型或当前 turn 是否 live 推断出来。只有明确 pending/running 状态或明确 pending 文案，并且最新 turn 仍在运行时，才显示正在压缩；只有明确完成/失败/取消/错误状态或明确完成文案时，才显示 `历史上下文已压缩`。没有明确状态的 marker 不再显示提示，旧 pending 文案也不会被本地 merge 带到后续快照。
- 工具/命令/文件操作卡片不再按整个 turn 全局合并。现在只合并相邻且同目标的操作卡，例如同一个命令可执行文件连续刷新时会更新同一个卡片；如果中间已经出现 Codex 输出、用户消息、上下文提示或其他操作卡，后面的同一命令会新建一个较低位置的卡片。
- 最新 turn 底部如果连续出现多个操作卡，只保留最底部最新的一个，避免 Composer 上方堆出多个工具框。被普通输出隔开的较早操作卡仍按原位置保留，便于理解前文操作顺序。
- 测试覆盖同步更新到 `test/collab-agent-render.test.js`、`test/conversation-render.test.js` 和 `test/mobile-viewport.test.js`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v76` 的修复。

### 2026-05-24 Public 发布说明（续三）

本次 public 热修处理三类移动端长会话问题：上下文压缩提示误报、图片上传导致 rollout / replacement history 快速膨胀，以及 app-server `imageView` 在手机端只显示原始 JSON。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v79`。

- 服务端压缩后的移动端数据不再根据父 turn 是否结束来合成 `历史上下文已压缩`。只有明确的 context-compaction item 状态，或明确的 `item/started` / `item/completed` 通知，才会生成移动端压缩提示；type-only marker 不显示提示，避免长输出结束后误插一行“已压缩”。
- 浏览器在上传 `jpeg` / `png` / `webp` 图片前会先尝试本地压缩，默认最长边 1280px、JPEG quality `0.72`。这保留截图可读性，同时减少多 MB 图片直接进入 Codex 上下文。
- 包含图片上传的 turn 默认不再请求 app-server `persistExtendedHistory`，把截图视为当前 turn 的临时视觉参考，降低后续 compaction 反复写入 `replacement_history` 图片内容的概率。需要保留历史图片重放时，可显式设置 `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1`；也可用 `CODEX_MOBILE_PERSIST_EXTENDED_HISTORY=0` 全局关闭 extended-history 请求。
- `imageView` item 现在直接渲染为图片，复用现有的认证文件预览内容接口和当前线程 workspace-root 校验，不再把 `type`、`id`、`path` 等字段作为 JSON 卡片显示。
- 新增 `public/image-compressor.js`、`adapters/message-input-service.js` 以及对应测试，并更新 `test/file-preview-ui.test.js`、`test/conversation-render.test.js`、`test/mobile-viewport.test.js`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v79` 的前端修复。旧 rollout 里已经写入的图片历史不会被本次发布自动重写。

### 2026-05-24 Public 发布说明（续四）

本次 public 热修继续调整移动端操作卡片显示。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v81`。

- 最新 turn 内的 `Command`、`File Change`、工具和搜索操作卡现在全局只保留最新一个，不再只限制 Composer 上方的底部连续区域。即使旧操作卡已经滚到上方，或中间出现过 Codex 输出，后续操作到来时也会隐藏旧操作卡，避免小屏上堆出多张命令框。
- 因为全局只保留一个操作卡，卡片详情区从单行截断改为最多两行显示：第一行仍显示类型和状态，第二、三行显示命令、文件列表或工具摘要，超出两行再裁剪。
- 这次改动只影响最新 turn 的紧凑操作状态展示，不改变历史命令输出隐藏策略、不显示 diffs，也不改变审批卡片和普通消息卡片。
- 测试覆盖同步更新到 `test/collab-agent-render.test.js`、`test/conversation-render.test.js` 和 `test/mobile-viewport.test.js`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v81` 的新操作卡显示。

### 2026-05-24 Public 发布说明（续五）

本次 public 热修修正移动端对话卡片时间戳在同一个 turn 内重复显示的问题。版本保持 `0.1.11`，Public PWA shell 缓存仍为 `codex-mobile-shell-v81`；这次是服务端 thread detail 数据修正，不需要更新静态 app shell。

- 当 app-server 返回的消息、工具或文件操作 item 没有逐条 `startedAt` / `createdAt` / `timestamp` 字段时，Mobile Web 现在会从对应 rollout JSONL 的 `event_msg` / `response_item` 顶层时间补回 `startedAtMs` 和 `startedAt`，再把 thread detail 返回给浏览器。
- 这样同一轮里连续出现的多条 Codex 回执、消息卡片或操作卡片，会显示各自实际发出的时间，而不是全部回退到同一个 turn 完成时间或 turn 开始时间。
- 服务端会对同一条内容同时出现的 `event_msg` 与 `response_item` 时间候选做去重，避免把 app-server 双记录当成两条不同消息；操作卡片和上下文压缩卡片在移动端压缩后也会保留时间字段。
- 已打开的移动端页面通常只需要刷新当前线程详情或重新进入该线程即可看到修正后的时间戳；因为没有改动前端静态资源，不需要等待新的 service worker 缓存版本。
- 新增 `test/thread-item-timestamp-enrichment.test.js` 覆盖逐条消息时间补齐和压缩后操作卡片保留时间字段，配合既有 `test/message-timestamp.test.js` 验证前端 fallback 仍然保留。

### 2026-05-24 Public 发布说明（续六）

本次 public 热修继续稳定移动端对话卡片时间戳。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v82`，用于让已打开的移动端客户端拿到新的前端 fallback 逻辑。

- 服务端从 rollout JSONL 补 item 时间戳时，现在会把消息文本和工具 `call_id` 一起作为匹配依据。`agentMessage` / `userMessage` 优先按文本匹配，操作卡优先按 `call_id` 匹配，避免长 live turn 中 app-server 快照顺序和 rollout 事件顺序不完全一致时把旧消息时间配给新卡片。
- 前端不再把 live `agentMessage`、`plan` 或 live 操作卡缺失 item 时间戳时的 turn start 当作卡片时间显示。缺少真实 item 时间时先隐藏时间戳，等服务端补齐后再显示，避免新卡片刚出现就显示本轮开始时间。
- 这次修复针对长时间运行的 live turn 尤其重要：如果一个 turn 从较早时间开始，但后续持续输出多条回执，新回执应该显示各自发出的时间，而不是全部显示本轮开始时间。
- 已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v82` 后，前端才会停止显示 turn start fallback。
- 新增和更新的测试覆盖文本匹配、工具 `call_id` 匹配、live 消息/操作卡不冒充 turn start，以及 v82 shell cache 检查。

### 2026-05-25 Public 发布说明

本次 public 发布调整线程列表的归档入口。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v83`，用于让已打开的移动端客户端拿到新的线程菜单交互。

- 线程行左滑不再露出 `归档` 按钮，也不再保留专门的 thread-row swipe archive 状态、隐藏按钮或触摸监听。这样线程列表的横向手势负担更低，避免和侧栏边缘手势、页面滚动或其他移动端手势混在一起。
- `归档` 现在整合进线程行长按菜单，和 `重命名`、`压缩续接` 放在同一个 action sheet 里。点击后仍然会先弹出确认，确认后调用既有 `/api/threads/<threadId>/archive`，成功后刷新线程列表；如果归档的是当前打开线程，会清空当前详情视图。
- 主动压缩续接仍保留在长按菜单和超阈值详情提示里；本次只是移动归档入口，没有改变后端归档接口、归档过滤规则或续接归档流程。
- README 的界面说明已同步更新，`test/thread-archive.test.js` 覆盖“长按菜单归档、无左滑归档残留”，`test/mobile-viewport.test.js` 覆盖 v83 shell cache。
- 已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v83` 后，才能看到新的长按菜单归档入口。

### 2026-05-25 Public 发布说明（续）

本次 public 发布继续处理移动端长 turn 的操作状态与消息提交稳定性。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v85`，用于让已打开的移动端客户端拿到新的 active-turn 状态和操作卡显示逻辑。

- 最新 turn 只保留一个全局操作卡的规则保持不变，但操作卡第一行右侧现在会显示该命令、文件变更、工具或搜索操作的已运行时间。运行中的操作会随顶部计时器同步刷新；已完成操作优先使用服务端或 rollout 中已有的完成时间、耗时字段。
- 服务端会从 rollout JSONL 中补齐操作项的逐条时间戳，压缩后的 `Command` / `File Change` / tool / search 卡片也会保留 `startedAtMs` / `startedAt`，让移动端能计算并显示操作耗时。
- 现有线程发送消息时，服务端会先检查浏览器提交的 `activeTurnId` 是否已经被新的 durable turn 取代、是否在最近 turn 列表中缺失并超过短暂宽限期、或是否是 app-server 已返回 stale 错误的旧 active turn。命中这些场景时，Mobile Web 会中断旧 active marker，再走 `thread/resume` + `turn/start`，避免用户消息只作为本地 echo 短暂出现、重新进入线程后消失。
- 对最新 durable live turn 的处理已收紧：即使 rollout 一段时间没有写入，或者最后一个可见 item 是已完成命令、工具、文件、搜索操作或 context-compaction marker，Mobile Web 也不会自动把这个最新 live turn 当作 stale turn 中断。用户在这种情况下发送的引导消息应继续走 `turn/steer`，避免把正常的“补充指令”误变成 `turn_aborted reason=interrupted`。
- 前端 active 状态现在只跟随最新 durable turn。较旧的 `inProgress` turn 如果已经被更新的 durable turn 取代，不再让 composer 保持 `Stop`、不再让顶部 timer 继续显示运行中，也不会再接收新的 `turn/steer` 引导。
- 本次新增 `adapters/active-turn-staleness-service.js` 和 `test/active-turn-staleness-service.test.js`，并更新 `test/new-thread-route.test.js`、`test/conversation-render.test.js`、`test/collab-agent-render.test.js`、`test/message-timestamp.test.js`、`test/thread-item-timestamp-enrichment.test.js` 和 `test/mobile-viewport.test.js`。已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v85` 后，才能看到新的 active-state 和操作耗时显示。

### 2026-05-26 Public 发布说明

本次 public 发布继续收紧图片上下文、压缩续接启动上下文，并修正 reference-only 图片上传后的移动端显示。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v86`，用于让已打开的移动端客户端拿到新的图片缩略图渲染逻辑。

- 图片上传现在默认使用 `CODEX_MOBILE_IMAGE_CONTEXT_MODE=reference`：模型只收到附件摘要和本地文件路径，不再默认收到 app-server `localImage` 输入。这可以避免新上传图片继续进入 app-server 当前历史和 compacted `replacement_history`，从源头降低后续 turn 的上下文/token 成本。
- 如果确实需要模型读取图片像素，可以显式设置 `CODEX_MOBILE_IMAGE_CONTEXT_MODE=latest` 或 `vision`，只发送最新一张图片；`all` 仅用于恢复旧版全部图片行为。`CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1` 仍只控制 extended-history 请求，不会清理当前 app-server 内存或旧 rollout 中已经存在的图片 payload。
- 移动端对话展示与模型上下文策略已经分离：即使模型只收到路径引用，浏览器也会从 `Uploaded attachments` 摘要里识别已保存的本地图片路径，并通过认证上传预览接口渲染居中缩略图。这个规则也适用于 Codex/plan 回复里再次引用同一段附件摘要的情况，并兼容 CRLF 换行、Markdown 引用块以及 app-server 原始 `input_text` / `input_image` / `image_url` content part；用户不再只看到一长串路径，非图片附件仍保持紧凑的文件信息行。
- 压缩续接 bootstrap 改成 file-first 的小摘要策略：新线程仍会拿到源线程 handoff 文件路径、必要的运行设置、最近 turn 摘要和工作区上下文摘录，但默认总量从过去偏大的 inline 上下文收紧到约 `52000` 字符，并限制 source handoff、workspace handoff、lineage 和单条 item 摘要大小。完整事实应回到 `.agent-context/thread-handoffs/<id>.md` 和项目文档读取。
- 新增 `docs/` 项目文档集与 `docs/CONTEXT_STRATEGY.md`，把架构、模块边界、故障排除、复杂功能实现路径、上下文策略和文档更新规则固化下来。后续修改模型输入、图片保留、续接 bootstrap 或 handoff 压缩策略时，需要同步更新对应文档。
- Web Push 完成通知增加 no-final-agent-message 保护：当 app-server 完成事件明确表示没有最终 assistant 回复时，Mobile Web 不再发送普通“turn ended”推送，避免用户收到结束通知但打开线程看不到正常结束回执。
- 本次更新覆盖 `server.js`、`public/app.js`、`public/sw.js`、`adapters/message-input-service.js`、`adapters/push-notification-service.js`、新增 `docs/` 文档和相关测试。已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v86` 后，才能看到图片路径缩略图显示。

### 2026-05-27 Public 发布说明

本次 public 发布同步 v93-v98 的移动端阅读、诊断和上传图片显示修正。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v98`；已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，才能拿到新的前端资源。服务端上传 MIME 修正需要重启 8787 Node listener 后生效。

- 当前 turn 的向上浮动箭头现在定位到本轮最终回执/总结位置，而不是本轮第一条 assistant 回复。目标优先选择本轮最后一条 `agentMessage` 或 `plan`，没有最终回执时才回退到最后一个非用户、非 live-operation 项。
- 如果用户已经在 live 输出期间向上滚动，`turn/completed` 不会覆盖这个已激活的当前 turn 锚点；最终总结很长时，只要目标起点在可视区上方，向上箭头就可以显示并跳回总结开头。
- 最终回执刷新期间，页面不再在用户阅读时持续强制滚到底部。用户最近的手动滚动如果让对话区离开底部，会建立当前 turn 阅读保持状态；render-time stick-to-bottom、发送后底部跟随和 viewport 跟随都会暂停，直到用户回到底部或点击向下箭头。
- 最新 turn 的命令/工具/文件/搜索操作卡从三行视觉预算改为四行：一行类型/状态元信息，加上最多三行详情。这样长命令、文件列表或工具摘要在手机上更容易读，同时仍避免操作卡无限变高。
- 完成的 turn 可以显示 `Context and token usage` 诊断卡。该卡来自 rollout `token_count` 事件，展示本轮 token、累计 token、context window 使用比例/风险和 rollout 大小；没有 scoped token 事件时不会猜测生成。诊断卡不会成为向上箭头的最终回执目标。
- Usage 诊断卡的本轮 token 不再只取同一 turn 最后一个 `token_count.last_token_usage`。服务端会按连续 `total_token_usage` 差值累计本 turn 内多次模型调用，并对重复的相同累计事件计 0；最终 context window 百分比仍取本 turn 最后一个有效事件。
- Usage 诊断卡里 `in` 的显示口径调整为未缓存输入量：当上游提供 `cachedInputTokens` 时，`in` 显示 `inputTokens - cachedInputTokens`，同时继续单独显示 `cached`。context window 百分比和风险仍按 raw input/context token 计算，因为 cached input 仍占用模型上下文窗口。
- 侧栏新增 prompt-only 的 Public PR 检查。浏览器会检查配置的 public 仓库是否有开放 PR；发现 PR 时只提示是否准备合并/发布评审任务，不会自动 merge、sync、commit 或 push。
- 上传图片缩略图显示继续保持 reference-only 模型上下文策略：模型默认只收到附件摘要和本地路径，不默认收到图片像素。浏览器仍会从 `Uploaded attachments:` 摘要渲染居中缩略图，包括用户消息、Codex/plan 引用摘要、CRLF、Markdown blockquote，以及 app-server 原始 `input_text` / `input_image` / `image_url` content part。
- 上传文件预览接口现在为 `.jpg`、`.jpeg`、`.webp`、`.gif`、`.png` 等保存的图片路径返回真实图片 MIME，例如 `image/jpeg`，避免浏览器尤其是 iOS/Safari 因 `application/octet-stream` 而不显示 `<img>` 缩略图。
- 本次同步新增 `adapters/turn-usage-summary-service.js` 和 `adapters/public-pull-request-service.js`，并更新 `server.js`、`public/app.js`、`public/styles.css`、`public/sw.js`、文档与相关测试。部署者更新后应运行测试/check，并重启服务端 listener 以加载上传 MIME 与 public PR/usage summary 路由。

### 2026-05-27 Public 发布说明（续）

本次 public 发布继续同步移动端线程详情的服务端修复。版本仍为 `0.1.11`，不改变前端 PWA shell 缓存；更新后需要重启 8787 Node listener，让服务端加载新的 thread detail 压缩和 Usage 解析逻辑。

- Usage 诊断卡会忽略 app-server 在部分 turn 结束前输出的零值/window 哨兵 `token_count`。如果同一 turn 前面已经有有效 token 用量，Mobile Web 会保留最新有效值；如果只有哨兵事件，则不生成 Usage 卡，避免显示 `0/258400` 这类误导性用量。
- 最新 turn 只有在仍处于运行状态时才保留最新一个命令/工具/文件/搜索操作卡。turn 完成后，紧凑移动端详情不再在最终回执下面保留命令框；如果有 Usage 数据，最后一个诊断框应是 Usage summary。
- 从 rollout tail 补回已完成操作卡时，服务端只在最新 turn 仍然 live 且操作能确认属于同一 turn 时补回，避免把旧 turn 的已完成命令误贴到新的 live turn。
- 本次同步更新 `server.js`、`adapters/turn-usage-summary-service.js`、`test/turn-usage-summary-service.test.js`、`test/thread-item-timestamp-enrichment.test.js` 和相关文档；无需前端刷新提示或 service worker cache bump。

### 2026-05-27 本地更新说明

本次本地更新把操作卡显示规则收紧为 live-only，并将 PWA shell 缓存升到 `codex-mobile-shell-v99`。

- 最新 turn 仍在运行时，移动端继续显示最新一个命令/工具/文件/搜索操作卡，用于判断当前正在执行或刚执行过的操作。
- turn 完成后，移动端不再在最终回执下面保留命令框；如果有 Usage 数据，最后一个诊断框应是 Usage summary。
- 这同时在服务端 thread detail 压缩和前端 `visibleItemsForTurn()` 上生效，避免 completed turn 的本地 live merge 残留操作卡继续显示。

### 2026-05-28 本地更新说明

本次本地更新修复 Codex 自己做视觉核验时生成的 `imageView` 截图卡片显示问题，并将 PWA shell 缓存升到 `codex-mobile-shell-v100`。

- `view_image` / `imageView` 截图可能来自 `%TEMP%` 下的工具生成文件；Codex `imageGeneration` 效果图可能保存为 `%USERPROFILE%\.codex\generated_images\...\*.png`。这些文件不属于用户上传，也不在当前 workspace 文件预览根内。旧前端会把它们当普通 JSON 或本地预览路径显示，导致手机端 `Image` / `imageGeneration` 卡只显示原始 JSON 或破图。
- 服务端现在会在压缩 `imageView` 或带 `savedPath` 的 `imageGeneration` 项时，把符合图片类型和大小限制的源文件复制到 Mobile Web 运行目录的 `generated-images` 缓存，再给前端一个受认证保护的 `/api/generated-images/file` URL。
- 前端 `renderImageView()` 优先使用服务端附带的 `contentUrl`，并在需要时补上认证 key；`imageGeneration` 也复用该渲染路径。只有没有缓存 URL 时才回退到旧的本地文件预览路径。
- 这个修复不会把 `%TEMP%` 加进通用文件预览根，也不会放宽 Markdown/本地文件预览的 workspace-root 校验。若源临时截图在 Mobile Web 首次看到之前已经被删除，历史卡片仍无法仅凭路径恢复。

### 2026-05-28 Public 发布说明

本次 public 发布包含 v99/v100 两组移动端可见修正：完成 turn 不再保留命令框，以及 Codex 自己生成的视觉核验截图可以在 `Image` 卡中稳定显示。版本保持 `0.1.11`，PWA shell 缓存升到 `codex-mobile-shell-v100`。

- 最新 turn 仍在运行时，移动端继续显示最新一个 `Command` / `File Change` / tool / search 操作卡；turn 完成后，紧凑详情不再把命令框留在最终回执下面。如果 rollout 中有 scoped `token_count` 数据，最后的诊断框应是 Usage summary。
- 这条规则同时在服务端 thread detail 压缩和前端 `visibleItemsForTurn()` 中执行，避免刷新或重新进入线程后把已结束 turn 的旧操作卡误当成仍在运行。
- `view_image` / `imageView` 视觉核验截图可能来自工具临时目录，而不是用户上传目录或当前 workspace；Codex `imageGeneration` 效果图也可能保存到 `.codex\generated_images`。服务端现在会把符合图片类型和大小限制的 `imageView` / `imageGeneration.savedPath` 源文件复制到运行目录的 `generated-images` 缓存，并通过受认证保护的 `/api/generated-images/file` URL 给浏览器渲染。
- 前端 `renderImageView()` 优先使用服务端返回的 `contentUrl`，并为同源 `/api/` 图片地址补认证 key；没有缓存 URL 时才回退到原来的本地文件预览路径。
- 该修复不把 `%TEMP%` 加入通用文件预览根，也不放宽 Markdown/本地文件预览的 workspace-root 校验。若源临时截图在 Mobile Web 首次读取前已被删除，历史卡片仍无法仅靠路径恢复。
- 新增 `adapters/generated-image-cache-service.js` 和 `test/generated-image-cache-service.test.js`，并把新 adapter 纳入 `npm run check`。发布前 public PR 检查无开放 PR。

### 2026-05-28 Public 发布说明（Usage 本轮统计修正）

本次 public 发布修正完成回执里 `Usage` 诊断卡的本轮 token 统计口径。版本保持 `0.1.11`，不改变 PWA shell 缓存；更新后需要重启 8787 Node listener，让服务端加载新的 rollout `token_count` 解析逻辑。

- `last turn` 行不再只取同一 turn 最后一个有效 `token_count.last_token_usage`。长 turn 如果包含多次模型调用、工具后续总结或多段推理，前面几次调用也会进入本轮统计。
- 服务端现在按连续 `total_token_usage` 的差值累计本 turn 内所有有效 scoped token 事件；重复的相同累计事件贡献 0，避免 app-server 重放相同 token 事件时重复计数。
- context window 使用比例和风险仍取本 turn 最后一个有效事件，因为它描述的是最终上下文窗口占用，不是所有模型调用输入的简单求和。
- 零值/window 哨兵过滤继续保留：如果 app-server 在 turn 结束前输出 `last_token_usage=0` 且 `total_tokens` 等于窗口大小的哨兵事件，Mobile Web 会忽略它。
- 本次同步更新 `adapters/turn-usage-summary-service.js`、`test/turn-usage-summary-service.test.js`、README、架构/上下文策略/故障排除/复杂路径文档。发布前 public PR 检查无开放 PR。

### 2026-05-29 Public 发布说明（Hermes Mobile 插件嵌入）

本次 public 发布同步 Codex Mobile Web 的 Hermes Mobile 独立嵌入插件能力，以及 v104-v108 的 iframe 内导航修正。版本保持 `0.1.11`，PWA shell 缓存升到 `codex-mobile-shell-v108`；已安装到主屏幕或被 service worker 缓存的客户端需要点击刷新提示、硬刷新或关闭重开后，才能拿到新的嵌入页面和手势行为。

- Codex Mobile 现在可以作为 Hermes Mobile 的独立 `embedded_app` 插件注册。插件接口位于 `/api/v1/hermes/plugin/...`，包含 manifest、workspace/callback/origin 注册、launch 和 session 交换；注册和 launch 仍使用 Codex Mobile 自己的 Access Key，不复用 Hermes owner auth。
- Manifest 只返回插件元数据、entry URL、launch/session/origin endpoint、owner binding、frame embedding 和 navigation contract，不返回长期 Access Key、launch token secret、本地 secret path、DB path、上传内容或私有状态 dump。
- Launch 只返回短期相对 `entry_path`，浏览器在 `/?embed=hermes` 中把一次性 `codexPluginLaunch` 换成内存态 plugin session 并清理 URL。长期 Access Key 不写入 iframe URL、`localStorage` 或插件注册状态。
- HTTPS Hermes PWA 需要 HTTPS Codex entry。部署者应设置 `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` 或 `CODEX_MOBILE_PUBLIC_BASE_URL`；Windows 启动脚本和安装脚本新增 `-HermesPluginBaseUrl`、`-PublicBaseUrl`、`-HermesPluginFrameOrigins`，可把外部 HTTPS Codex 地址和 Hermes iframe origin 持久化到隐藏启动任务。
- `POST /api/v1/hermes/plugin/origins` 和 `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS` 用于注册 Hermes PWA origin，并写入 HTML CSP `frame-ancestors`。HTTPS Hermes 请求如果只能得到 HTTP Codex entry，manifest 会返回 mixed-content 诊断，而不是尝试绕过浏览器安全策略。
- `/?embed=hermes` 隐藏独立 Web App 的重复 chrome/login splash，保持 iframe 内状态，不在 visibility/focus 变化时强制 reload，并阻止 `window.open`、`target=_blank` 和外部二级窗口 handoff。
- Codex iframe 通过 `codex-mobile.plugin.navigation` 向 Hermes 上报 route 与 `canGoBack`。Hermes 通过 `hermes.plugin.back` 请求 iframe 先处理文件预览、编辑弹窗、action sheet、subagent 面板等内部 transient 层；Hermes 不需要检查 Codex DOM 或调用 Codex 内部 route 函数。
- v108 将 Codex 的线程切换器和设置区域改为 Hermes 插件一级主页面，不再是侧边栏抽屉。该主页面上报 `canGoBack=false`，让 Hermes Mobile 可以显示自己的底部导航；线程详情和新线程输入页是二级页面，back 会回到 Codex 插件主页面，而不是首次进入 Web App 时的 Workspace 列表。
- 本次同步更新 `server.js`、`adapters/hermes-plugin-service.js`、Windows 启动脚本、`public/app.js`、`public/plugin-embed.js`、`public/styles.css`、`public/sw.js`、`public/index.html`、README、架构/模块/故障排除/复杂路径文档以及 Hermes plugin 相关测试。服务端 route/CSP/session/startup 变更需要重启 8787 Node listener；静态 PWA 行为需要客户端加载 `codex-mobile-shell-v108`。

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
- Existing-thread submission preflights the submitted `activeTurnId` before steering. Superseded or missing stale active ids fall through to `thread/resume` + `turn/start`, while the latest durable live turn is not auto-interrupted only because it is quiet or because its last visible item is a completed operation or context-compaction marker.
- The browser active-turn UI follows only the latest durable turn. Older `inProgress` turns that have been superseded do not keep the composer in `Stop`, keep the top timer active, or receive new steering input.
- Message submission now writes compact server-side `[message-submit]` diagnostics for received, empty, completed, and failed submissions. These logs include ids and counts, not raw message text.
- The browser can post compact `[client-event]` diagnostics such as UI stalls, send stalls, send-button no-submit cases, and send failures. These events are best-effort and are used only for local operational diagnosis.
- The browser preserves `mux-user-*` user-message echo items during thread refresh merges, because these synthetic visible inputs may not exist in the durable thread snapshot returned by app-server.
- For new turns, Mobile Web reads the thread's last rollout `turn_context` plus `state_5.sqlite` metadata and forwards the inherited model, reasoning effort, approval policy, sandbox policy, reasoning summary, and configured verbosity where the app-server protocol supports it. This keeps Mobile Web turns aligned with the thread runtime settings that Desktop is using. Per-thread model/reasoning/permission choices are stored as browser-local runtime-only draft state even without typed text, so they survive reloads and remain visible after Send while app-server thread metadata catches up.
- Full-access threads are normalized for Mobile Web new turns: if the inherited sandbox is `danger-full-access`, or the permission profile grants root write access, Mobile Web sends `approvalPolicy: "never"` when the persisted approval mode is missing or still `on-request`. This matches the user-facing "full access" expectation and avoids redundant command approval cards on new turns.
- The composer permission chip displays the current thread/default permission as read-only status after model/reasoning. Mobile Web does not send a mobile-selected `permissionMode`; it follows the current thread runtime settings and the local `%USERPROFILE%\.codex\config.toml` defaults that the server resolves.
- The older mux-local `mux/userMessage` echo is still retained as a fallback for app-server builds that do not support `turn/steer`.

### Mobile UI Stability

- Conversation rendering uses a lightweight keyed DOM patcher so status polls and no-op refreshes do not replace the whole conversation.
- Live reasoning deltas update the timer activity label but do not create visible conversation rows.
- The upward floating button for the current turn targets the final receipt/summary position, using the last `agentMessage` or `plan` in that turn before falling back to the last non-user, non-live-operation item. If the user already scrolled upward during live output, that activated jump state must survive `turn/completed`; the button should also appear when the target item's start is above the viewport, even if a long summary still extends into view.
- Live/final output must not keep forcing the conversation downward while the user is reading. A recent manual scroll that moves the conversation away from bottom establishes a current-turn reading hold even if programmatic bottom-scroll was active; render-time stick-to-bottom, submitted-message follow, and viewport follow must all stop until the user returns to bottom or taps the down arrow.
- Mobile foreground recovery handles `visibilitychange`, `pageshow`, `focus`, `orientationchange`, `visualViewport` changes, and window resize.
- On iOS, returning from input-method or permission screens can leave a stale/blank composited viewport. The app maintains a JS-driven `--app-height` and runs several lightweight visual recovery passes after resume.
- When the current thread is already open, foreground recovery should preserve the current screen and refresh it silently instead of re-entering `loadThread()` for the same thread. Returning from another app should not flash `Loading thread...` merely to refresh the current thread.
- On first load, if Mobile Web already knows it should open a specific thread, startup should keep the main panel in a stable thread-opening state instead of briefly rendering the Workspace/recent-thread home screen and then replacing it with the target thread.
- In Hermes embed mode, slow startup should show one stable loading layer until the primary plugin page or explicit launch target has finished rendering, instead of exposing intermediate `Select a thread` or `Loading threads...` screens.
- In Hermes embed mode, if startup detects an invalid/expired launch or session and already asks Hermes to relaunch the iframe, the page should stay in a neutral plugin-recovering state instead of flashing the red Codex login/auth error panel first.
- Uploaded image messages render as centered thumbnails, not full-width raw images or data URLs.
- Non-image uploads are stored locally and referenced by absolute path in the message text.

### Mobile Session List And Copy Actions

- Theme preference is stored in `localStorage` as `codexMobileTheme`, with accepted values `system`, `dark`, and `light`. The early inline script applies the theme before the app bundle loads, reducing flash between dark and light modes.
- Font-size preference is stored in `localStorage` as `codexMobileFontSize`, with accepted values `small`, `default`, `large`, `xlarge`, and `xxlarge`. It lives in the same settings panel as theme selection instead of a separate sidebar-header dropdown, so display settings share one consistent mobile control surface.
- The session list can be opened through the menu button or a left-edge right-swipe gesture on overlay layouts. Opening the list is intentionally fast: existing list data is rendered immediately, and Mobile Web only performs a silent background refresh when the cached list is older than 60 seconds.
- Thread rows now support a long-press action sheet with rename, continuation, and archive actions. Rename calls `PATCH /api/threads/<threadId>/name` with a max 120-character name; archive calls `POST /api/threads/<threadId>/archive` after confirmation.
- The long-press handler avoids iOS text-selection side effects on thread cards while preserving text selection inside editable rename controls.
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

## 2026-05-28 Local Hermes Mobile Plugin Mode v101

This local update adds an independent Hermes Mobile embedded-app plugin surface.
It exposes the metadata manifest, workspace registration, callback registration,
and launch-token endpoints under `/api/v1/hermes/plugin/...`. Registration and
launch require the Codex Mobile Access Key through `Authorization: Bearer` or
`X-Codex-Mobile-Key`; the Hermes callback URL may be an HTTPS domain and is
stored only in runtime state. The manifest can be pinned to an external HTTPS
base URL with `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or
`CODEX_MOBILE_PUBLIC_BASE_URL`. The browser app shell cache advances to
`codex-mobile-shell-v101` so iframe launch URLs can use short-lived
`codexPluginLaunch` tokens without writing the long-lived Access Key to
`localStorage`.

## 2026-05-29 Local Hermes Mobile Embedded Plugin Contract v102

This local update completes the embedded iframe contract for the Hermes Mobile
plugin. The shell cache advances to `codex-mobile-shell-v102`.

- The manifest now includes `origin_registration`, `plugin_session`,
  `frame_embedding`, launch/session, and navigation contract metadata while
  still omitting raw Access Keys, token material, local secret paths, DB paths,
  uploads, and private content.
- Hermes can register a generic HTTPS iframe origin through
  `POST /api/v1/hermes/plugin/origins`; Codex serves HTML with CSP
  `frame-ancestors 'self' <registered origins>`. The manifest reports a clear
  diagnostic when an HTTPS Hermes origin would embed an HTTP Codex entry.
- `POST /api/v1/hermes/plugin/launch` returns only a short-lived `entry_path`.
  The iframe exchanges `codexPluginLaunch` through
  `/api/v1/hermes/plugin/session`, then removes the one-time token from the URL
  and keeps the plugin session in memory.
- `/?embed=hermes` hides standalone chrome, preserves iframe state across
  visibility/focus changes without forcing reload checks, posts
  `codex-mobile.plugin.navigation`, keeps normal thread/workspace routes
  `canGoBack=true` so iOS Hermes forwards right-swipe/back to Codex, and handles
  `hermes.plugin.back` by opening or closing iframe-owned navigation layers.
- Embedded mode blocks `window.open`, `target=_blank`, and external-link
  browser handoffs so Hermes Mobile does not need to inspect Codex DOM or call
  Codex route internals.

## 2026-05-29 Local Hermes Plugin Gesture-State v104

- Normal thread/workspace/new-thread routes now report `canGoBack=false` in
  `codex-mobile.plugin.navigation`, so Hermes keeps its own right-swipe/settings
  behavior instead of forwarding a back action into Codex and showing the
  initial Workspace list.
- Codex still handles `hermes.plugin.back` for iframe-owned transient layers
  such as file previews, dialogs, embedded drawers, and panels.
- The shell cache advances to `codex-mobile-shell-v104`.

## 2026-05-29 Local Hermes Plugin Sidebar Gesture v105

- Restored the standalone Mobile Web left-edge right-swipe behavior inside
  `/?embed=hermes`: swiping from a normal thread page opens Codex's overlay
  sidebar/settings surface instead of doing nothing.
- The plugin still does not clear the current thread/workspace to return to the
  initial Workspace page. `hermes.plugin.back` is only used to close iframe-owned
  transient layers such as the sidebar, settings panel, previews, dialogs, and
  subagent panels.
- The shell cache advances to `codex-mobile-shell-v105`.

## 2026-05-29 Local Hermes Plugin Back-To-Sidebar v106

- Normal thread/workspace/new-thread routes now report `canGoBack=true` in
  `codex-mobile.plugin.navigation`, so iOS Hermes Mobile forwards the right-swipe
  affordance into the iframe.
- On a normal Codex thread page, `hermes.plugin.back` opens Codex's overlay
  sidebar with the thread switcher and settings button. It does not clear the
  current thread into the first-launch Workspace page.
- If the sidebar, settings panel, preview, dialog, or subagent panel is already
  open, `hermes.plugin.back` closes that transient layer.
- iOS Hermes Mobile PWA verification confirmed this behavior: right-swipe from
  a Codex thread opens the Codex sidebar/thread switcher with the settings
  button, and does not return to the first-launch Workspace page.
- The shell cache advances to `codex-mobile-shell-v106`.

## 2026-05-29 Local Hermes Plugin Host-Back Result v107

- Codex now declares and emits `codex-mobile.plugin.back_result` for embedded
  back handling. Modal/edit surfaces still return `handled:true` after Codex
  closes them inside the iframe.
- When the Codex sidebar or settings surface is already open and Hermes sends
  `hermes.plugin.back`, Codex leaves that surface open and posts
  `handled:false` with a bounded route. Hermes should treat that as a request to
  handle the back action at the host level and return to its own navigation/tab
  surface, instead of the iframe closing back to the Codex thread page.
- The shell cache advances to `codex-mobile-shell-v107`.

## 2026-05-29 Local Hermes Plugin Primary Page v108

- In `/?embed=hermes`, the Codex thread switcher/settings surface is now the
  plugin's primary page, not a sidebar drawer. The primary page occupies the
  iframe as normal content and reports `canGoBack=false`, allowing Hermes
  Mobile's bottom tabs to remain visible.
- Codex thread detail and new-thread composer pages are secondary pages. When
  Hermes sends `hermes.plugin.back` from a thread page, Codex clears the thread
  detail and returns to the primary thread-switcher/settings page instead of
  opening or closing an overlay drawer.
- The local left-edge sidebar drawer gesture is disabled inside the Hermes
  iframe because page-level navigation is owned by the plugin primary/secondary
  route contract.
- The shell cache advances to `codex-mobile-shell-v108`.

## 2026-05-29 Local Hermes Plugin Notification Delegation v109

- Codex Mobile plugin notifications now use Hermes Mobile as the notification
  owner. The backend delegates safe, summary-only events to
  `POST /api/hermes-plugins/codex-mobile/notifications` with a server-side
  `X-Hermes-Web-Key`; the iframe does not register Web Push or receive the
  Hermes key.
- The manifest advertises the notification delegation contract and the local
  protected test path `/api/v1/hermes/plugin/notifications`, while still
  omitting Access Keys, launch tokens, Push endpoints, private file paths,
  prompts, model responses, and long logs.
- Turn-completed notifications are delegated to Hermes Action Inbox/Web Push
  when the Hermes notification delegate is configured. Standalone Mobile Web
  continues to use the existing local Web Push fallback when it is not
  configured.
- The shell cache advances to `codex-mobile-shell-v109`.

### 2026-05-30 Public 发布说明

本次 public 同步把 Hermes 插件嵌入体验、跨线程待办卡片体验和前台恢复稳定性一起推进到
`codex-mobile-shell-v130`。

- Hermes 插件嵌入态：
  - 线程长按菜单里的 `压缩续接` 不再依赖浏览器原生 `window.confirm()`，改为 iframe 内应用弹框，避免 Hermes 插件环境里“菜单能点但确认框不弹”的问题。
  - 左侧主区首次直进线程时，不再先明显闪回 Workspace / Recent 主页；会保持稳定的 `Opening thread...` 过渡态。
  - 从其他 App 切回当前线程时，不再优先走同线程 `Loading thread...` 重载，而是静默刷新当前屏。
  - Hermes 插件启动或 session/auth 失效但已请求宿主刷新时，不再先闪红色 `Codex` 错误框，而是显示中性的恢复态。
  - 当 Codex 需要 Hermes 宿主刷新插件页时，会先在 iframe 内显示显式的 `Refreshing plugin page...` 提示，并在约 10 秒后自动清除，避免长期停留成误导性横幅。
  - 合并 PR #41 后，PWA 底部输入栏进一步补上了 `safe-area-inset-bottom` 保护，减少底部安全区遮挡。
- Public PR / Restart：
  - 插件嵌入态保留版本号、`Restart` 和 `Public PR` 可见性，不再把整条版本操作区一起隐藏。
  - 接受 Public PR 提示后，草稿任务会回到 Codex Mobile Web 当前工作区的新线程草稿，而不是误投到当前打开的 Hermes 线程。
  - shared-chain 重启脚本新增 harness，固定“旧 8787 listener 退出不算成功；必须等到新的 HTTP 与 mux readiness 都恢复”这一规则。
- 跨线程待办卡片：
  - `#` 开头的跨线程请求在 draft 生成期会显示占位卡，不再短暂暴露原始 XML draft 片段。
  - draft / pending task card 默认改为中型卡片，正文折叠，需要时再展开。
  - 目标线程 `Approve` 后会等待并定位到真正注入出来的新 turn，而不是只看到卡片状态变化。
  - 原线程中的 draft 卡在 `Approve` 或 `Dismiss` 后会把 settled 状态持久化到浏览器存储，重新进入线程时不会从旧 XML 响应里“复活”。
- 测试与验证：
  - 同步更新了 `app-update`、Hermes plugin route、manual restart、mobile viewport、thread-task-card route 和 shared-chain restart script 相关测试。
  - 发布前通过 focused Node tests、`npm test`、`npm run check`、`npm run check:macos` 和 `git diff --check`。

## 2026-05-31 Local Hermes Plugin Appearance Sync v133

- Hermes plugin manifest now advertises a bounded `appearance_sync` contract:
  launch may pass `appearance.theme` (`system|dark|light`) and
  `appearance.fontSize` (`small|default|large|xlarge|xxlarge`).
- Plugin launch copies only those safe values into the short relative iframe
  entry path as `pluginTheme` / `pluginFontSize`; the browser session exchange
  returns the same sanitized `appearance` object. Long-lived Access Keys,
  session tokens, local paths, raw settings dumps, and private content are not
  included in that appearance payload.
- The embedded HTML head script applies host theme and font size before
  `styles.css` and `public/app.js` load, then `public/app.js` keeps the session
  appearance after token scrubbing. This avoids flashing the standalone/default
  theme or font size while Hermes initializes the iframe.
- The shell cache advances to `codex-mobile-shell-v133`.

## 2026-05-31 Local Cross-Thread Task Card Auto-Send v134

- Natural-language cross-thread card commands now auto-send after the model
  returns a valid bounded draft. The v134 build reserved only the exact
  `#自由协作` prefix for this flow; ordinary `#...` text remained a normal
  message. The source thread no longer asks for a second local `Approve`; only
  the target thread's pending card keeps `Approve` for injecting a real
  target-thread turn.
- The task-card service rejects likely encoding-damaged visible card text before
  persistence, so PowerShell/encoding-damaged `?? ?????` payloads cannot create
  unreadable pending cards.
- The shell cache advances to `codex-mobile-shell-v134`.

## 2026-05-31 Local Cross-Thread Autonomous Workflow v135

- `#自由协作` task-card drafts may now explicitly request
  `workflowMode:"autonomous"` for cooperating-thread workflows that should
  continue after one human approval.
- The v135 build still routed this flow only through `#自由协作`
  prefix; v194 supersedes that by making plain non-empty `# ...` the manual
  task-card command path.
- Ordinary cards still require target-side `Approve`. For autonomous workflows,
  the first target approval activates a workflow grant scoped to the workflow id
  and the same two thread ids. Later cards with that same workflow id between
  the same pair auto-inject as real target-thread turns; unrelated pairs still
  remain pending.
- The shell cache advances to `codex-mobile-shell-v135`.

### 2026-05-31 Public 发布说明（Hermes 外观同步、跨线程卡片修复与 Fast 圆点）

本次 public 同步把 private 中已验证的 v133-v139 产品改动发布到公开仓库。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v139`。部署后需要让 8787 Node listener 重新加载服务端文件；已安装到主屏幕或被 service worker 缓存的移动端客户端需要接受刷新提示、硬刷新或关闭重开，才能拿到新的静态界面。

- Hermes 插件嵌入：launch/session 支持安全的 `appearance.theme` 与 `appearance.fontSize` 同步，iframe 会在主样式和主脚本加载前应用主题/字号，减少嵌入态从默认主题闪到 Hermes 主题的视觉跳变。
- Hermes 通知标题：完成通知优先使用 app-server 线程显示名和嵌套 thread title，再回退到本地 SQLite；这避免旧续接线程把 bootstrap 提示误当作 Web Push / Hermes Inbox 标题。
- 跨线程任务卡片：`#` 自然语言卡片命令继续由当前 Codex 线程生成 bounded draft，但 source 线程不再显示二次 `Approve` 或临时 `Sending` 卡片；已创建或已 dismiss 的 draft 用稳定的 turn+draft 内容 key 持久化，重新进入线程不会因为 app-server item id 改变而复活。
- 目标线程卡片：thread detail 只渲染 target-side `pending` 卡片；source outgoing、`approved`、`deleted`、`revoked`、`replied` 和 transient `approving` 状态仍保留在运行态审计中，但不再作为可操作卡片堵在会话底部。`Approve` 在调用外部 `turn/start` 前先落盘为 `approving`，避免刷新、重连或压缩续接窗口里重新出现第二个可点的 `Approve`。
- 跨线程自主 workflow：draft 可以显式请求 `workflowMode:"autonomous"`。同一个 workflow id 和同一对 source/target 线程在首次人工批准后可继续自动注入后续卡片；复用到其他线程对时仍回到 pending，需要单独批准。
- 运行栏 Fast 圆点：模型前新增一个极小的持久化状态点，绿色表示普通模式，点击变红表示下一次新 `turn/start` 使用 Codex Fast 服务层。前端只提交隐藏 `fastMode` 字段，服务端映射为 `serviceTier: "priority"`；不会把可见 `/Fast` 文本插入用户消息，也不会改变模型、推理等级或权限设置。active-turn steering 不能改变已经开始的 turn 的速度层级。
- 发布同步还包含 workspace registry 服务、共享链重启安装脚本、多账号 CLI 文档、相关 README/docs 更新和覆盖测试。发布前 private 验证通过 `npm test` 255/255、`npm run check`、`npm run check:macos`、`git diff --check`；public 发布前应在 public 工作区重新运行同等检查。

### 2026-06-01 Public 发布说明（已知工作区本地文件预览）

本次 public 合入 PR #42，修复移动端无法预览已知 workspace 内本地文件的问题。版本仍为 `0.1.11`，不改变 PWA shell cache；更新后需要重启 8787 Node listener 以加载新的服务端文件预览根策略。

- 文件预览允许读取已知 workspace root 内的文件，也允许读取当前线程 cwd 内的文件；Markdown 预览继续按源文本列表编号渲染，避免预览内容把原始编号重新从 1 开始排。
- 安全边界没有放宽到任意磁盘目录：预览仍只解析显式允许根目录内的路径，并继续拒绝根目录外路径、敏感文件类型和不支持的二进制内容。
- 本次 public 同步没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

### 2026-06-01 Public 发布说明（worktree 线程可见性）

本次 public 合入 PR #43，修复 Codex worktree 中产生的线程在 Mobile Web 线程列表里不可见的问题。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v140`；更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开，才能拿到新的前端过滤逻辑。

- Mobile Web 现在把 `%USERPROFILE%\.codex\worktrees\<id>\<repo>` 形式的 cwd 映射回已知 workspace 的仓库名。线程列表、选中 workspace 后的过滤、服务端 fallback 线程补全和前端隐藏规则都会接受同名仓库 worktree。
- 服务端 `thread/list` 读取后会合并 state DB / session index fallback 线程，避免 app-server 列表遗漏 worktree 线程时 Mobile 端仍然空缺。
- `thread/turns/list` fallback 会结合 rollout item 时间戳排序 turns，避免只有随机 turn id 或缺少标准 started/completed 时间字段时把最近内容排错。
- 新增 `test/thread-visibility.test.js` 覆盖 worktree 可见性、无关 worktree 隐藏、归档线程隐藏、fallback 合并和 turn 时间排序。本次 public 同步仍不复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

### 2026-06-01 Public 文档同步说明

本次 public 追加同步 `docs/` 项目文档，确保公开仓库中的架构、模块、排障和复杂路径说明与 PR #42/#43 的实际行为一致。该提交只更新公开文档和 README，不包含 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- `docs/ARCHITECTURE.md` 记录 worktree cwd 可见性、state DB/session-index fallback 合并，以及本地文件预览允许根的安全边界。
- `docs/MODULES.md` 增加 thread visibility/worktree filtering 测试映射，并明确 `server.js` 负责线程可见性过滤和本地文件预览根组合。
- `docs/TROUBLESHOOTING.md` 增加 worktree 线程缺失排查步骤，并澄清文件预览不要通过加入宽泛根目录来修复。
- `docs/COMPLEX_FEATURE_PATHS.md` 增加 Thread Visibility And Worktree Filtering 实现路径，要求同一套 cwd 匹配同时作用于服务端和前端过滤。

### 2026-06-01 Public 发布说明（跨线程任务卡片 draft 自动创建修复）

本次修复 `#` 跨线程任务卡片在长源线程里可能只生成 draft、但没有真正写入任务卡 store 的问题。PWA shell cache 升到 `codex-mobile-shell-v141`；更新后需要让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开。

- 诊断结果：Hermes 源线程已返回有效 `<codex-mobile-thread-task-card-draft>`，目标是衣橱线程，但 `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json` 没有新的 2026-06-01 记录，衣橱线程 pending 计数也为 0。
- 根因：前端按 draft key 回查当前线程时，遇到第一个普通 assistant/plan 消息就提前停止扫描；长线程中真正的 draft 往往在后面，导致 `/api/thread-task-cards` 创建请求没有发出。
- 修复后：回查逻辑会跳过非 draft 消息并继续扫描，找到后面的有效 draft 后再执行自动创建。新增测试防止再次把 `continue` 退回成提前 `return null`。

### 2026-06-01 Public 发布说明（线程加载、任务卡片、Token 统计和更新面板）

本次 public 发布同步 private 中已经验证的 v154-v157 改动。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v157`。部署后需要重启 8787 Node listener；已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开，才能拿到新的更新面板和前端行为。

- 长 rollout 线程详情不再因为超过 32MB 默认改用最近 8 个 turn 的 `thread/turns/list` 首屏；详情仍先走完整 `thread/read`，只有读取失败时才使用 bounded fallback。
- 跨线程任务卡片 draft 现在可以在目标 id 后半段被模型写坏、但前缀能唯一匹配可见线程时，恢复为真实目标线程 id，避免源线程停在 failed draft。
- Workspace Token 统计补齐历史 Windows 路径乱码归并。已经写入 SQLite 的 `财务`、`男装衣橱`、`系统工具` 乱码 cwd 会在查询时合并到正确 Unicode Workspace，不再在统计页显示为单独乱码项目；新增 harness 覆盖已经持久化的坏 cwd 行。
- 侧栏版本号现在打开 Updates 面板。Current checkout 继续使用原有安全 fast-forward 自更新路径；Public release 区域会检查 `pentiumxp/codex-mobile-web-public/main` 最新提交。只有当前安装本身就是 public checkout 时，才会通过同一个 fast-forward 路径应用 public 更新；private checkout 只显示 public 最新状态，避免把 public 发布树覆盖到私有开发树。

### 2026-06-03 Public PR 同步说明（归档 fallback 过滤与 Restart 风险提示 v166）

本次 private 同步 public PR #44 和 PR #45 的产品改动，并在当前 private v165 基础上把 PWA shell cache 升到 `codex-mobile-shell-v166`。服务端 session-index fallback 列表现在会再次排除已归档线程，避免 app-server 主列表遗漏线程时把已归档的 projectless session 重新显示出来；更新后需要重启 8787 Node listener 才会加载新的 `server.js`。前端手动 `Restart` 从浏览器原生确认框改为自定义确认面板，点击时会先读取最近线程列表并列出 running session 风险，提示重启可能中断正在通过 Codex Mobile 同步或运行的任务。已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能看到新的保护面板。

### 2026-06-04 本地更新说明（CLI 目标 `/g` 入口 v180）

本次更新在 v179 目标状态显示的基础上，增加一个不占界面的 `/g` composer 命令。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v180`；更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开。

- 在已有线程的 composer 中输入 `/g` 并发送，会打开目标填写对话框；填写 objective 和可选 token budget 后，当前构建通过 `/api/threads/:id/goal` 转发到 app-server `thread/goal/set`。
- `/g` 不再发送普通 Codex 消息，也不再依赖模型自己调用目标工具；目标创建要求运行中的 Codex app-server 支持 0.135.0 级别的 goal RPC。
- Mobile Web 仍不直接写 `goals_1.sqlite`。目标创建、状态变更和完成语义继续由 Codex app-server / CLI 运行时处理。

### 2026-06-04 本地更新说明（CLI 目标状态显示 v179）

本次更新让 Mobile Web 能显示 Codex CLI/Desktop 已支持的线程目标状态。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v179`；更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开，才能同时拿到服务端目标读取和前端目标卡片。

- 服务端新增 `adapters/thread-goal-service.js`，只读读取当前 `<CODEX_HOME>\goals_1.sqlite` 的 `thread_goals`，把 `budget_limited` 等 sqlite 状态规范化成前端可显示的公开状态，并给 `/api/threads` 列表和 `/api/threads/:id` 详情附加 `thread.goal`。
- 前端处理 app-server `thread/goal/updated` 和 `thread/goal/cleared` 通知；列表行显示紧凑 Goal/Paused/Budget/Done 徽标，线程详情顶部显示目标文本和预算/用时摘要。
- 0.135.0 级别的 app-server 协议提供 `thread/goal/set`、`thread/goal/get`、`thread/goal/clear`，但 Mobile Web 仍不直接写 `goals_1.sqlite`；旧 app-server 如果缺少 set RPC，会返回 unsupported-version 错误。

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

When Mobile Web's profile switcher is in use, launch Desktop with the matching
profile so Desktop and Mobile attach to the same mux endpoint:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ProfileId default
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ProfileId current
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ProfileId previous
```

The repository also includes `start-codex-desktop-default.cmd`,
`start-codex-desktop-current.cmd`, and `start-codex-desktop-previous.cmd`.
These wrappers pass `-ForceRestartMux` so the Desktop escape hatch starts from
the selected profile's current bridge files. Use `-CodexHome <path>` only for a
custom CLI home. Desktop's GUI ChatGPT login may still be global to the
installed app package; the reliable sharing boundary is the selected
`CODEX_HOME` plus its `<CODEX_HOME>\app-server-mux\endpoint.json`.

3. Start or reconnect Mobile Web.

The launcher sets `CODEX_CLI_PATH` only for the Desktop process it starts. It builds `codex-app-server-mux.exe` from `codex-app-server-mux-shim.cs` when needed, because Windows Codex Desktop expects `CODEX_CLI_PATH` to point to a real `.exe`.

The shared Desktop shortcut may open the Codex Desktop GUI, but every helper it
starts must stay windowless. Desktop shortcuts should target
`start-codex-desktop-shared-hidden.vbs` through `wscript.exe`, not the `.cmd`
profile wrappers. The default generated shim is `codex-app-server-mux-win.exe`
so older running `codex-app-server-mux.exe` processes do not block rebuilds. The
mux shim itself is compiled as `/target:winexe` and then launches its Node child
with `CREATE_NO_WINDOW` and hidden startup flags; Mobile Web startup/restart
helpers use hidden PowerShell/`Start-Process` paths for background mux/app-server
work. Mobile-owned app-server startup also clears Desktop-bridge-only
`CODEX_CLI_PATH` and `CODEX_MUX_*` variables before starting the real Codex CLI
child, so tool subprocesses do not loop back through a Desktop shim when Desktop
is not running.

By default, the launcher sets `CODEX_MUX_KEEP_ALIVE=1`. If Desktop is fully quit, the mux and real app-server should remain alive so Mobile Web can continue using the same stream. Starting Desktop again through the launcher attaches the new Desktop stdio session to the existing mux.

Because keep-alive deliberately preserves the mux process, normal Desktop restarts do not reload changed mux code. After updating the bridge code, fully quit Desktop and start it once with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ForceRestartMux
```

This stops the mux PID recorded in the endpoint file before launching Desktop, so the next Desktop session creates a fresh mux from the current files.

The mux writes its endpoint file here:

```text
<CODEX_HOME>\app-server-mux\endpoint.json
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
export CODEX_MOBILE_CODEX_EXE="$(command -v codex)"
export CODEX_MOBILE_NODE_EXE="$(command -v node)"
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
export CODEX_MOBILE_CODEX_EXE="$(command -v codex)"
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
| `CODEX_MOBILE_NODE_EXE` | macOS Mobile Web launcher Node executable path/name. |
| `CODEX_MOBILE_DISABLE_UPDATE_CHECK` | Disable startup/browser Git update checks when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_UPDATE_REMOTE` | Git remote used by the self-update check, default `origin`. |
| `CODEX_MOBILE_UPDATE_BRANCH` | Git branch used by the self-update check, default `main`. |
| `CODEX_MOBILE_UPDATE_CHECK_TIMEOUT_MS` | Timeout for update-check Git commands, default `15000`. |
| `CODEX_MOBILE_UPDATE_APPLY_TIMEOUT_MS` | Timeout for the fast-forward update command, default `120000`. |
| `CODEX_MOBILE_DISABLE_PUBLIC_PR_CHECK` | Disable the public-repository open-PR prompt when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_PUBLIC_PR_REPOSITORY` | GitHub `owner/repo` slug checked for open public pull requests, default `pentiumxp/codex-mobile-web-public`. |
| `CODEX_MOBILE_PUBLIC_PR_CHECK_TIMEOUT_MS` | Timeout for the unauthenticated GitHub public PR check, default `12000`. |
| `CODEX_MOBILE_PUBLIC_PR_CHECK_CACHE_MS` | In-memory cache window for public PR status checks, default `900000` (`15 minutes`). |
| `CODEX_MOBILE_KEY` | Inline web access key. |
| `CODEX_MOBILE_KEY_FILE` | Custom access-key file path. |
| `CODEX_MOBILE_DISABLE_AUTH` | Disable auth when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` | External HTTPS base URL advertised by the Hermes plugin manifest for `entry.url` and `program_api.base_url`. Prefer the Windows `-HermesPluginBaseUrl` startup parameter for scheduled deployments. |
| `CODEX_MOBILE_PUBLIC_BASE_URL` | General external base URL fallback used when `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` is not set. |
| `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS` | Semicolon/newline-separated Hermes iframe origins added to plugin CSP `frame-ancestors` at process start. Runtime `/api/v1/hermes/plugin/origins` registration can also add origins. |
| `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL` | Hermes Mobile base URL used by the backend notification delegate. When unset, Codex derives the Hermes origin from the registered workspace callback URL or app origin. |
| `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY` | Server-side Hermes Web/Owner access key used only for backend notification delegation. Do not expose it to the iframe or manifest. |
| `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE` | Server-side file containing the Hermes notification delegation key. Prefer this over inline keys for deployments. |
| `CODEX_MOBILE_HERMES_WEB_KEY` | Fallback inline Hermes key for plugin backend calls when the notification-specific key is unset. |
| `CODEX_MOBILE_HERMES_WEB_KEY_FILE` | Fallback Hermes key file for plugin backend calls when the notification-specific key file is unset. |
| `CODEX_MOBILE_UPLOAD_DIR` | Upload storage directory. |
| `CODEX_MOBILE_MAX_UPLOAD_BYTES` | Max total upload bytes per message. |
| `CODEX_MOBILE_MAX_UPLOAD_FILES` | Max files per message. |
| `CODEX_MOBILE_IMAGE_CONTEXT_MODE` | Image model-context mode. Default `reference` sends images as path text only while still showing thumbnails in the UI. `latest` / `vision` sends only the latest uploaded image as `localImage`; `all` restores legacy all-image behavior. |
| `CODEX_MOBILE_SQLITE3_EXE` | Optional absolute path to `sqlite3.exe` for reading Codex `state_5.sqlite`. When unset, Mobile Web also checks common user-local Platform Tools / WinGet install paths before falling back to `sqlite3` on `PATH`. |
| `CODEX_MOBILE_THREAD_TURNS` | Number of recent turns kept in the compact mobile detail window and requested per older-history page, default `10`. Normal detail reads still prefer `thread/read`; the current live turn plus the previous ended turn, or the latest ended turn when no live turn exists, retain compact process items while older-history pages are receipt-only. |
| `CODEX_MOBILE_FULL_THREAD_TURNS` | Number of turns kept after full `thread/read` before mobile compaction, default `10`, capped at `200`. Keep this aligned with `CODEX_MOBILE_THREAD_TURNS` unless diagnosing payload size behavior. |
| `CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES` | Tail bytes read from a thread rollout to recover inherited turn runtime settings, default `4194304`. |
| `CODEX_MOBILE_ROLLOUT_ACTIVE_STATUS_WINDOW_MS` | Recent-activity window used when rollout-session fallback infers an `active` thread-list status from bounded rollout-tail events, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` | Rollout JSONL size threshold for UI warnings and the continuation action, default `209715200` (`200MB`). |
| `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` | Max characters in the rollout continuation bootstrap message, default `52000`. |
| `CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS` | Max source handoff excerpt characters included inline in a continuation bootstrap, default `12000`. |
| `CODEX_MOBILE_CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS` | Max project context characters included inline in a continuation bootstrap, default `18000`. |
| `CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS` | Max workspace handoff tail characters included inline in a continuation bootstrap, default `18000`. |
| `CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS` | Max characters per visible source-turn item summary in a continuation bootstrap, default `1200`. |
| `CODEX_MOBILE_CONTINUATION_TURN_SUMMARY_ITEMS` | Max non-user visible items kept per recent source turn in a continuation bootstrap, default `4`. |
| `CODEX_MOBILE_CONTINUATION_RECENT_TURNS` | Recent source turns summarized into the continuation bootstrap, default `12`, capped at `30`. |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS` | How long Mobile Web waits for the source thread to write its continuation handoff file before creating the new thread, default `240000`. |
| `CODEX_MOBILE_CONTINUATION_LATE_HANDOFF_TIMEOUT_MS` | Extra background wait when the first handoff wait expires but the source thread may still be writing, default `600000`. |
| `CODEX_MOBILE_CONTINUATION_REUSE_HANDOFF_MS` | How long a recent source-thread handoff file may be reused when retrying continuation, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS` | Minimum source handoff file length accepted as complete, default `400`. |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS` | Extra wait for the source handoff turn to report a completed status after the handoff file is written, default `60000`. |
| `CODEX_MOBILE_CONTINUATION_JOB_TTL_MS` | How long finished continuation jobs stay queryable for the mobile UI, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_CONTINUATION_JOB_MAX` | Maximum continuation jobs retained in memory, default `50`. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_DEPTH` | Maximum previous continuation links included in a new bootstrap, default `2`, capped at `5`. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS` | Maximum characters used for lineage instructions and handoff excerpts inside a bootstrap, default `12000`. |
| `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES` | Size threshold for automatically compacting workspace `.agent-context/HANDOFF.md` before rollout continuation, default `307200` (`300KB`). |
| `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS` | Approximate number of recent handoff characters preserved in the compact active handoff after archival, default `60000`. |
| `CODEX_MOBILE_PERSIST_EXTENDED_HISTORY` | Controls whether Mobile Web asks app-server to persist extended history on thread start/resume, default enabled. Set to `0` to disable for all Mobile Web turns. |
| `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY` | Controls whether turns with image uploads may still persist extended history, default disabled. Leave unset so images behave as temporary visual references after the current turn. |
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
