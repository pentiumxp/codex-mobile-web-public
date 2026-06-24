# Architecture

## Mental Model

Codex Mobile Web is a local authenticated web shell around Codex app-server. It does not replace Codex Desktop; it reads the same local Codex state and, when configured for shared mode, attaches to the same live app-server stream through the mux.

```text
Phone / browser / PWA
        |
        | HTTPS through Tailscale Serve or LAN HTTP
        v
server.js on 8787
        |
        | JSON-RPC over shared JSONL TCP / WebSocket / managed child
        v
codex app-server
        |
        +-- %USERPROFILE%\.codex state, sessions, rollout JSONL

Optional shared stream:

Codex Desktop <-> codex-app-server-mux.js <-> real codex app-server
                         ^
                         |
                 Mobile Web connects through endpoint.json
```

Mac production should use the shared stream even when Codex Desktop is not
running. The Codex Mobile LaunchDaemon sets
`CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1`,
`CODEX_MOBILE_MUX_ENDPOINT_FILE=<CODEX_HOME>/app-server-mux/endpoint.json`, and
`CODEX_MOBILE_PERSIST_OWNED_MUX=1`. If the endpoint is missing, `server.js`
starts a standalone mux with `CODEX_MUX_KEEP_ALIVE=1`, detaches it from the
Listener process, and then connects through the endpoint. Later Listener
deploys or restarts close only the HTTP/SSE process; the mux and real
app-server continue running so active turns can survive.

## Process Boundaries

| Process | Owner | Responsibility |
| --- | --- | --- |
| `server.js` | this repository | HTTP API, auth, static assets, thread summaries/detail compaction, uploads, Web Push, restart/update endpoints, app-server client glue |
| `codex-app-server-mux.js` | this repository | Desktop/Mobile app-server stream sharing, notification replay, approval proxying, mobile-output truncation |
| `codex app-server` | Codex runtime | Durable thread operations, turns, server requests, model/tool execution |
| Browser/PWA | `public/` | Thread list/detail UI, composer, uploads, SSE, PWA cache/update prompt, Push subscription |
| Startup scripts | this repository | Windows/macOS service startup, hidden scheduled task, shared-chain restart |

`server.js` is still the main composition point. New reusable behavior should move into `adapters/`, public helper modules, or focused route/service modules before adding more large blocks to `server.js`.

## Runtime State

Tracked source files live in the repository. Runtime state stays outside Git:

| Path | Meaning |
| --- | --- |
| `%USERPROFILE%\.codex` | Codex Desktop/app-server state, session rollout JSONL, `state_5.sqlite`, shared mux endpoint |
| `%USERPROFILE%\.codex-mobile-web` | Mobile Web access key, uploads, Web Push files, logs, local Codex executable copy, Hermes plugin registration state |
| `%USERPROFILE%\.codex-mobile-web\chatgpt-pro-planner` | Runtime-only ChatGPT Pro planner artifact store. Contains `artifacts.jsonl` and bounded Markdown/JSON artifacts created by the restricted MCP connector; it is not copied to source, public release, `.agent-context`, or Git. |
| `%USERPROFILE%\.codex-mobile-web\workspace-registry.json` | Mobile Web-created workspace folders. This augments Mobile Web visibility and may also sync Desktop global workspace roots when `CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES=1`. |
| `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` | Active Codex profile selection for the single-profile switcher. Contains profile ids, labels, and `CODEX_HOME` paths only; never auth tokens. |
| `%USERPROFILE%\.codex\app-server-mux\endpoint.json` | Shared mux JSONL TCP endpoint used by Mobile Web and Desktop bridge. Current mux endpoint metadata includes the real `codexExe` path and capability flags so launchers can reject a reachable but version-stale mux. |
| `.agent-context/` | Durable local project context, not public release content |

Keep `.codex` read-only except through app-server RPCs. Do not patch rollout files or SQLite state directly unless there is an explicit, risk-reviewed recovery task.

## Request Flows

### Public Config And Login

`GET /api/public-config` exposes auth requirement, version/build ids, runtime option lists, upload limits, rollout warning threshold, quota snapshots, Push support, self-update availability, public PR check availability, and the Hermes plugin endpoint paths. The browser uses this before showing the app shell and also reuses the same quota snapshot when a page-refresh prompt is clicked, so a PWA reload that does not fully recreate the iOS app scene still updates the visible quota chips.

Authentication uses `x-codex-mobile-key`, `Authorization: Bearer`, the existing cookie, or the existing `key` query parameter against the runtime access key file. Do not print the key in logs or chat output.

### Codex Profile Switching

Mobile Web supports a simple single-active-profile switcher for local Codex CLI
auth homes. This is not concurrent provider routing: the Node listener and mux
endpoint use one active profile at a time.

`adapters/codex-profile-service.js` discovers the default `.codex` home plus
`%USERPROFILE%\.codex-homes\current` and `previous` when present. It reads
`auth.json` only to return safe account identity fields such as email/name or a
redacted account id. Profile quota snapshots are persisted and reused only when
the active profile's `sessions/` and `archived_sessions/` directories are
account-scoped under that profile home. Rollout-tail quota uses the same
account-scoped condition. If non-default profiles share thread state through
links to the default `.codex` home, source-less live quota and rollout quota are
both skipped so one account's shared app-server/thread history does not
decorate another account's quota. A shared-profile active home may still display
non-persistent live quota emitted by this listener's own managed child
app-server, because that stream belongs to the selected `CODEX_HOME`. Raw tokens
never leave the service.

The authenticated `POST /api/codex-profiles/active` endpoint persists the
selected profile to `%USERPROFILE%\.codex-mobile-web\codex-profiles.json` and
then delegates to the shared-chain restart service. On Windows, the restart
script and windowless/hidden launcher read that active profile before resolving
the mux endpoint, starting the standalone mux, and starting the Node listener,
so the selected profile auth applies globally after restart. The same launcher
supports a LocalSystem `AtStartup` scheduled task for deployments that must
survive sign-out or start before login; in that mode the task still receives the
target user's profile path and maps `USERPROFILE`, `HOME`, `APPDATA`,
`LOCALAPPDATA`, `TEMP`, and `TMP` back to that profile before resolving Codex
homes, runtime files, Git safe-directory settings, or the installed Codex
binary. For non-default
profiles, the launcher keeps that profile's own `auth.json` and `config.toml`
but links conversation state back to the default `.codex` home:
`state_5.sqlite`, `state_5.sqlite-wal`, `state_5.sqlite-shm`,
`goals_1.sqlite`, `goals_1.sqlite-wal`, `goals_1.sqlite-shm`,
`.codex-global-state.json`, `session_index.jsonl`, `sessions/`, and
`archived_sessions/`. This keeps visible workspaces, conversations, and
thread-goal status continuous after an account switch while the active app-server
uses the selected account's auth file. At server bootstrap, the active profile store takes precedence over
an inherited `CODEX_HOME` so a stale shell environment cannot silently keep the
listener on the previous account after a switch. When Mobile Web starts its own
managed `codex app-server`, the child process is also launched with this resolved
`CODEX_HOME`; it must not inherit a stale LaunchDaemon, shell, or service
environment home. On macOS system LaunchDaemon deployments, the shared-chain
restart command also writes the selected `CODEX_HOME` and derived
`CODEX_MOBILE_MUX_ENDPOINT_FILE` back to the LaunchDaemon plist before
`kickstart`, so the static service environment, active profile store, and
runtime status stay aligned across later restarts. Explicit environment override requires
`CODEX_MOBILE_CODEX_HOME_OVERRIDE=1`, and status snapshots expose
`codexHomeSource` plus `codexHomeEnvIgnored` for diagnostics. The Desktop escape
hatch can be launched through `start-codex-desktop-shared.ps1 -ProfileId
default|current|previous` or a matching `.cmd` wrapper so Desktop and Mobile
share the same profile mux endpoint. Desktop GUI login isolation is not assumed;
the supported sharing boundary is the CLI `CODEX_HOME` plus mux endpoint. Fixed
external endpoint deployments using
`CODEX_MOBILE_MUX_ENDPOINT_FILE`, `CODEX_MOBILE_APP_SERVER_WS`, or
`CODEX_MOBILE_APP_SERVER_TCP` disable switching because the endpoint is no
longer derived from the selected home.

### Workspace List And Creation

`GET /api/workspaces` combines Codex Desktop/app-server visible workspace roots
from `.codex` global state with Mobile Web-created roots from
`adapters/workspace-registry-service.js`. The registry lives under
`%USERPROFILE%\.codex-mobile-web\workspace-registry.json` by default and is
not copied to public release or `.agent-context`.

`POST /api/workspaces` creates or registers one local workspace folder under an
allowed create root, then makes that cwd visible to Mobile Web thread-list and
new-thread routes. It accepts only a simple folder name, rejects path traversal,
absolute paths, Windows reserved names, and invalid path characters. Allowed
roots default to the configured default create root, then fallback user roots.
When `CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT` is unset and the app is
running from a `HermesMobileDev` development checkout, that development root is
used before `%USERPROFILE%\Documents` and `%USERPROFILE%`. Deployments can
override the selectable parent roots with `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS`,
choose which allowed root is selected by default with
`CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT`, and move the registry file with
`CODEX_MOBILE_WORKSPACE_REGISTRY_FILE`.

By default, Mobile-created workspaces stay in the Mobile registry only. Mac
single-runtime deployments that need Codex Desktop and embedded Codex Mobile to
show the same newly created workspaces can set
`CODEX_MOBILE_SYNC_DESKTOP_WORKSPACES=1`. In that mode the workspace registry
service canonicalizes created workspace roots through `realpath` where
available, stores the canonical cwd in the Mobile registry, and adds the same
root to `electron-saved-workspace-roots`, `project-order`, and
`active-workspace-roots` in the default and active-profile
`.codex-global-state.json` files. `CODEX_MOBILE_DESKTOP_GLOBAL_STATE_FILE` may
add one explicit Desktop global-state file. The API response reports only
whether a sync ran and how many global-state files were processed; it must not
return local `.codex` file paths to the browser.

The browser exposes creation from the bottom of the Workspace dropdown list,
not beside the new-thread button. After creation, it selects the new cwd and
opens a new-thread draft for that workspace.

### ChatGPT Pro Planner Connector

The existing `@ChatGPT Pro` bridge remains an outbound Mobile-initiated flow:
Mobile sends a bounded prompt to a dedicated Codex thread that must use Chrome
/ ChatGPT Pro and write generated files only under runtime
`outputs/chatgpt-pro`.

The planner connector is the inbound companion:

```text
ChatGPT Web / MCP client
        |
        | POST /api/chatgpt-pro/mcp
        v
adapters/chatgpt-pro-mcp-service.js
        |
        v
adapters/chatgpt-pro-planner-service.js
        |
        +-- bounded thread/workspace/doc reads
        +-- runtime planner artifacts under chatgpt-pro-planner
        +-- pending cross-thread task cards through task-card service
```

`/api/chatgpt-pro/mcp` is not authenticated by the normal Codex Mobile Access
Key. It requires a separate bearer token from
`CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN` or
`CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE`. The route is intentionally outside
the ordinary browser session because ChatGPT MCP clients are not logged-in
Mobile Web browsers.

The connector exposes planner/reviewer tools only. It can list visible
workspaces, read bounded thread metadata, read allowlisted documentation files
from visible workspaces, create runtime artifacts such as PRDs, reviews, Codex
goals, or task-card drafts, and delegate scoped work through
`delegate_to_codex_thread`. Task-card delegation defaults to `pending`, so the
target Codex thread must approve before any injected turn starts. Direct
delegation is rejected unless the server explicitly enables
`CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS=1`. It cannot write
source files, run shell commands, answer approvals, read arbitrary local paths,
or serve raw rollout logs, uploads, cookies, access keys, or token files.

### Hermes Mobile Plugin Mode

Codex Mobile Web can be mounted into Hermes Mobile as an independent
`embedded_app` plugin. This path is not a worker queue or a Hermes-owned
authentication flow. Hermes must keep a separate Codex Mobile Access Key and
provide it when calling plugin registration or launch routes.

Plugin endpoints:

- `GET /api/v1/hermes/plugin/manifest` returns metadata only and is safe to
  fetch without credentials.
- `POST /api/v1/hermes/plugin/workspaces` registers a Hermes workspace and its
  callback URL.
- `POST /api/v1/hermes/plugin/callbacks` is the callback-registration alias for
  deployments that keep callback setup separate from workspace setup.
- `POST /api/v1/hermes/plugin/origins` registers the Hermes PWA iframe origin
  used for CSP `frame-ancestors`.
- `POST /api/v1/hermes/plugin/launch` returns a short-lived iframe entry path
  with `codexPluginLaunch`, not the long-lived Access Key.
- `POST /api/v1/hermes/plugin/session` exchanges the one-time launch token for
  an in-memory browser plugin session key.
- `POST /api/v1/hermes/plugin/notifications` is a Codex-authenticated backend
  test/delegation route that forwards safe plugin events to Hermes Action
  Inbox. It uses a server-side Hermes key and never accepts or returns that key
  in the iframe session.

The registration state is stored under
`%USERPROFILE%\.codex-mobile-web\hermes-plugin-registration.json` by default,
or `CODEX_MOBILE_HERMES_PLUGIN_REGISTRATION_FILE` when overridden. It stores
workspace id, Hermes callback URL, app origin, and timestamps only. It must not
store Codex Mobile Access Keys, Hermes owner keys, launch tokens, callback
payload bodies, or raw logs. Callback URLs may use either `http` or `https`;
production Hermes PWA deployments should register their HTTPS origin. Codex
serves HTML with `Content-Security-Policy: frame-ancestors 'self' <registered
origins>` and does not hard-code any personal domain. If HTTPS Hermes would
embed an HTTP Codex entry, the manifest reports a mixed-content diagnostic; the
fix is to expose Codex through HTTPS and set `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL`
or `CODEX_MOBILE_PUBLIC_BASE_URL` so the plugin manifest advertises the HTTPS
entry URL instead of the local listener URL. The Windows foreground, windowless,
and scheduled-task startup scripts can persist that deployment setting through
`-HermesPluginBaseUrl` / `-PublicBaseUrl`; the same startup chain can also set
`-HermesPluginFrameOrigins` so a headless/scheduled listener emits the required
CSP frame ancestors immediately after restart. If neither an explicit base URL
nor reverse-proxy `X-Forwarded-Proto: https` / `X-Forwarded-Host` headers are
present, manifest generation correctly falls back to the local request host,
which is suitable only for local HTTP debugging.

`/?embed=hermes` is a real iframe app mode, not just a launch URL. It hides
standalone navigation chrome and login splash, keeps the current iframe DOM
state across visibility/focus changes, exchanges launch tokens without writing
them to `localStorage`, and scrubs one-time launch tokens from the address bar
after session exchange. During startup, embedded mode keeps the app shell behind
a stable loading layer until Workspace/thread-list data and the final primary
page, launch target, or route hint have rendered. This prevents slow networks
from exposing the default `Select a thread` page or transient `Loading threads`
state before the usable iframe page is ready. Internal route changes post:

Hermes may pass bounded host appearance settings during plugin launch. The
manifest advertises `appearance_sync` with supported `theme` values
`system|dark|light` and `fontSize` values
`small|default|large|xlarge|xxlarge`. `POST /api/v1/hermes/plugin/launch`
accepts those values under `appearance`, echoes them through the short-lived
entry path as `pluginTheme` / `pluginFontSize`, and returns the same sanitized
appearance through the browser session exchange. The iframe head script applies
both theme and font size before `styles.css` and `public/app.js` initialize, so
Hermes-hosted plugins do not flash the standalone/default appearance. These
fields are session appearance metadata only; they must not carry tokens, local
paths, raw settings dumps, or private content. If the user changes Codex
Mobile's font size inside the embedded iframe, the iframe updates its scrubbed
URL state and includes the sanitized current appearance in plugin navigation
and refresh-required messages so Hermes can relaunch the plugin with the same
font size instead of falling back to an older host value.

```json
{ "type": "codex-mobile.plugin.navigation", "version": 1, "canGoBack": true, "route": { "kind": "thread", "threadId": "..." } }
```

Home AI voice input is also iframe-contract-only. In `/?embed=hermes`, Codex
Mobile loads `public/plugin-voice-input.js`, answers
`voice_input.capability_query` with the current composer write state, accepts
bounded `voice_input.append_text`, `voice_input.insert_text`, and
`voice_input.replace_draft` messages from the verified parent frame, and
acknowledges with `voice_input.insert_result`. The embedded send button also
supports a Home-AI-only long-press gesture: after the long-press threshold it
posts `voice_input.start_request` to the host, and release posts
`voice_input.stop_request`. A normal short tap still uses the existing Codex
send path. After a draft containing an inserted voice session is successfully
sent, Codex posts `voice_input.commit_result` with the final submitted text so
Home AI can learn correction pairs. The bridge never sends raw audio, Codex
Access Keys, launch tokens, cookies, local paths, prompts, or app-server
runtime state to the iframe parent. Standalone Codex Mobile Web does not enable
this bridge or change its default send-button semantics.

The embedded thread switcher/settings surface is a plugin primary page, not an
overlay drawer. That primary page reports `canGoBack: false`, so Hermes Mobile
can show its own bottom navigation tabs. Thread detail and new-thread composer
routes are secondary pages and report `canGoBack: true` so iOS Hermes Mobile
forwards its right-swipe/back affordance to the iframe. Codex handles that
secondary-page back by returning to the primary thread-switcher/settings page.
Thread detail must publish that secondary-page navigation state immediately
after `currentThreadId` is selected, including while the detail read still shows
its loading shell; otherwise the host can treat an early right-swipe as a
request to leave the plugin.
Because iOS touch gestures that begin inside an iframe may not reach the Hermes
host document reliably, the embedded Codex iframe also owns a left-edge swipe
guard. When its current navigation message would report `canGoBack: true`, that
guard calls the same `hermes.plugin.back` handler locally and returns to the
embedded primary page instead of relying only on the host to forward the back
event.
It must not show the standalone first-launch Workspace page or treat the
thread-switcher/settings surface as an overlay sidebar in Hermes embed mode.
When there is no explicit plugin launch target, URL thread hint, or bounded
Hermes route hint, embedded startup stays on this primary page. It must not
restore the last locally opened thread or auto-enter a recent active thread,
because that hides the host navigation surface and can land the plugin in a
stale Codex thread.
Once a file preview, rename/action dialog, or subagent panel is open, Codex
handles `{ "type": "hermes.plugin.back", "version": 1 }` by closing that
transient layer before page-level back is applied. Hermes must not inspect Codex
DOM or call Codex route functions.
Hermes notification deep-links may also add bounded iframe query hints such as
`pluginId=codex-mobile`, `pluginRoute`, `pluginThreadId`, `pluginTaskId`, and
`pluginItemId`. `public/plugin-embed.js` parses those hints, and
`public/app.js` consumes them only in `/?embed=hermes`: it opens the hinted
thread, focuses the matching approval/item card when still present, and then
scrubs the URL back to the embed root. Missing targets fall back to the normal
embedded primary page plus a bounded in-app diagnostic.
Embedded mode also blocks `window.open`, `target=_blank`, external browser
handoffs, and second-window launches so plugin pages stay in the same iframe.
Embedded mode also disables browser Web Push registration and local completion
alerts. Plugin notifications are delegated by the backend to Hermes Mobile via
the same notification endpoint, but the payload is now two-layered: a short
`title + summary` preview for Web Push / Inbox and an optional bounded
Markdown `detailMessage` for Hermes thread-message storage. The detail message
is built from the completed turn's final assistant receipt plus Usage summary.
`POST /api/hermes-plugins/codex-mobile/notifications` with
`X-Hermes-Web-Key`. The payload must contain a stable `eventId` or `sourceId`,
bounded title/summary fields, one of the allowed item types and priorities, and
small route metadata only. It must not include Access Keys, bearer tokens,
launch tokens, Push endpoints, database paths, upload paths, prompts, model raw
responses, private manifest dumps, or long logs.

### Thread List And Detail

Thread list reads app-server `thread/list`, then filters archived/deleted/sub-agent/out-of-workspace rows using local visibility rules and SQLite fallback data. The browser's default thread-list refresh requests a 40-row page; raising this casually can make startup, foreground resume, and thread switching noticeably slower because the server may do more app-server and fallback work before returning even when only a small number of rows are visible. On cold startup, the browser may request `/api/threads?fallback=defer`; the server then returns the app-server list immediately with `mobileDeferredFallback=true`, skips the expensive state DB / rollout fallback scan for that first paint, but still applies the lightweight `session_index.jsonl` display-title hydration so renamed or continuation threads do not flash their initial app-server titles. The browser follows with a delayed and cancellable silent full list refresh, so historical/fallback rows are still merged after the initial usable list is visible; this refresh must wait until no thread detail request is in flight and no list request is already running, because cold rollout fallback may synchronously scan large rollout files. The client treats thread switching, live polling, Usage backfill, and full-detail backfill as detail requests for this gate. The server also tracks active `/api/threads/:id` detail responses; if an ordinary unfiltered list refresh reaches the server while detail is active, it returns a deferred app-server-only list with `mobileDeferredFallback=true` and `fallbackDeferredReason=active-thread-detail` instead of starting the expensive fallback scan. After the first complete fallback pass in a server process, the fallback cache is a process-lifetime baseline by default: it does not expire on a timer and its key does not include `state_5.sqlite`, `session_index.jsonl`, archived-index, or `sessions/` directory fingerprints. New-thread, status, title, and archive events update or remove the matching cached summary incrementally; app-server `thread/list` remains the authoritative live source merged on every request. On cold startup with a saved current thread, the browser sets `startupThreadOpenPending` before the first app-shell reveal and starts the saved-thread detail read in parallel with status/workspace/list refresh; the startup path should not wait for the list response before beginning the known thread detail read. Startup emits bounded `startup_stage` client events so the runtime log can separate public-config, status, workspace, list, detail, and render delays. Codex worktree cwd values under `%USERPROFILE%\.codex\worktrees\<id>\<repo>` are treated as visible when `<repo>` matches a known workspace basename, so temporary Codex worktree sessions do not disappear merely because their cwd differs from the primary workspace path. When app-server omits visible rows, the list merges state DB, live rollout-session, and session-index fallback threads before applying the same cwd/search filters. If a migrated macOS production instance has visible Mac workspace roots but all recovered thread cwd values are Windows paths, the All-workspaces fallback keeps non-archived non-sub-agent history visible instead of filtering the list to zero rows. Duplicate fallback rows are not discarded blindly: display fields can fill missing/stale app-server titles, and the newest `updatedAt` wins so active shared-state threads move in the sidebar after turns. The rollout-session fallback reads the head of `sessions/rollout-*.jsonl` files to recover thread id, cwd, timestamp, sub-agent metadata, and safe display names from `session_index.jsonl`, then reads a bounded tail to infer fallback `active` / `completed` status from safe event types such as `task_started` and `task_complete`. Final list merge re-applies archived/sub-agent filtering and drops non-live Mobile fallback summaries that still have no real display text after session-index hydration; this keeps completed child-agent or orphan rollout rows from appearing as unopenable UUID-only threads. Its fallback `updatedAt` uses the newest of session-index time, rollout head timestamps, and rollout file mtime, so shared-state turns that keep writing rollout data do not stay pinned to an old index timestamp. It exists so a malformed `state_5.sqlite` does not make all old threads disappear after an account/profile switch. The session-index fallback must also skip ids present in `archived_sessions`, profile-specific `archived_sessions`, and `%USERPROFILE%\.codex-mobile-web\archived-thread-ids.json`; the Mobile local index stores only thread ids and archived timestamps so re-archiving a recovered/old-profile row hides it even when app-server cannot mutate the original SQLite row. After an existing-thread message send succeeds, the browser schedules both current-detail refresh and a silent thread-list refresh; otherwise a usable thread can keep an old sidebar timestamp until a manual list reload or foreground resume. Running-thread sidebar/home indicators are driven by both row status and browser-local `runningThreadIds` hints. A list refresh that returns `notLoaded` must not immediately clear a known running hint, but the hint carries a browser-local timestamp and expires after a bounded stale window when the row still has no running or terminal status and the current thread has no active turn. Terminal statuses such as completed, failed, cancelled, error, or interrupted clear it immediately. Current-thread `turn/started` and `turn/completed` notifications also update the matching thread-list row and schedule a list repaint so the running indicator does not depend on a separate `thread/status/changed` notification.

`adapters/thread-list-fallback-cache-service.js` owns the fallback cache policy: key construction from visible workspace roots/projectless thread ids, process-lifetime default retention, optional TTL expiry, cache-hit diagnostics, first-run fallback aggregation, and incremental status/title/archive mutation. State-db, rollout-session, and session-index scanners remain separate providers injected by `server.js`.

Browser thread-status freshness policy lives in `public/thread-status-hints.js`.
It records local viewed times and short submitted-processing hints, and it uses
event timestamps plus mux `mobileReplay` metadata before clearing running
indicators or marking completed rows unread. A replayed old completion must not
clear a newer running hint or create an unread marker simply because the
notification was replayed after reconnect.

Existing-thread send reconciliation treats the mutation response's real `turnId` as authoritative for the temporary submitted-message overlay. After `/api/threads/:id/messages` succeeds, the browser immediately moves any matching `local-turn-<clientSubmissionId>` user item into the returned server turn. That local overlay must not remain visible as a separate turn while the materialized server turn is also visible.

`adapters/thread-detail-summary-service.js` owns the summary resolution phase for `/api/threads/:id`: state DB first, then started-thread cache, rollout-session fallback, and app-server lookup/refresh with bounded timing logs. It applies the local-active overlay before the route checks hidden-thread state or builds projection cache inputs, so immediate post-send detail refreshes do not wash active state back to idle.

Background turn events remain content-scoped, but server-side `turn/started` / `turn/completed` notifications derive lightweight `thread/status/changed` summaries for all clients. Any successful Mobile Web-owned `turn/start` result for a visible user thread must also immediately broadcast an `active` `thread/status/changed` summary, update the local thread-detail projection cache, and record a bounded in-memory active-status overlay for list/detail summary synthesis. The overlay is required because the target thread may be in the background and the app-server/state-db summary can briefly continue to report `idle` even after `turn/start` returned. `/api/threads` and `/api/threads/:id` must apply that overlay after stale-active normalization so an immediate list/detail refresh cannot wash the running state back to idle. The overlay clears on raw `turn/completed`, a later rollout-tail terminal event such as `task_complete`, TTL expiry, or when rollout/detail projection evidence shows another materialized turn has become the real active turn. Local overlay turn ids are not authoritative once contradicted by materialized runtime state: if an empty local active shell coexists with a different unfinished turn that already has running items, server compaction transfers active ownership to the materialized turn and drops the empty shell; if the thread summary is already idle/completed/error-like, empty live shells are pruned from the detail projection. This local-start path covers normal existing-thread sends, source-direct or automatic task-card injection, auto-recover, side-chat apply, continuation source handoff/bootstrap, ChatGPT Pro bridge starts, and new-thread first turns. These summaries update the matching thread-list fallback cache row incrementally, so a silent list refresh does not need a full fallback rebuild to show running or terminal state.

Thread goal state is app-server-owned Mobile Web state. Codex app-server 0.135.0 and newer expose `thread/goal/set`, `thread/goal/get`, and `thread/goal/clear` requests plus `thread/goal/updated` and `thread/goal/cleared` notifications. `server.js` calls `thread/goal/set` from `POST /api/threads/:id/goal`, exposes `POST /api/threads/:id/goal/actions` as a thin action wrapper, and still reads `<CODEX_HOME>\goals_1.sqlite` through `adapters/thread-goal-service.js` as a cold-start/list/detail fallback. The browser command `/g` opens a compact dialog and posts the objective/token budget to the Mobile route; it no longer sends a normal chat message asking the model to create the goal. If the current thread already has an unfinished goal, the same dialog shows the goal status and action buttons. Continue leaves an already active goal unchanged, but clears and re-sets blocked goals so they become active again. Pause maps to the app-server `blocked` goal status. Cancel goal calls `thread/goal/clear`. Save still calls `thread/goal/set` to modify the objective or token budget. Goal progress displays app-server `tokens_used` as budget tokens. This is the goal budget counter maintained by Codex, and should not be treated as raw rollout `totalTokens`; in observed current CLI output it tracks a non-cached/budget-consumable token basis rather than full cached input totals. If the set RPC succeeds but the immediate app-server response does not contain a public goal object, the browser renders a local submitted-goal card from the just-entered objective and token budget so the goal remains visible while the new goal turn starts; later `thread/goal/updated` notifications or sqlite fallback data replace that local display state. If the running app-server is older and lacks the goal RPCs, Mobile Web returns a 501 explaining that Codex CLI 0.135.0 or newer is required. Mobile Web must not write `goals_1.sqlite` directly.

Continuation treats unfinished goals as task-level runtime state. After the new continuation thread is created and its bootstrap turn is started, `server.js` reads the source goal through `thread/goal/get` with the sqlite fallback and plans migration through `adapters/thread-goal-service.js`. Only `active`, `blocked`, and legacy `paused` statuses migrate. The new thread receives the same objective and remaining token budget (`tokenBudget - tokensUsed` when positive); spent `tokens_used` and `time_used_seconds` stay on the source thread. `active` goals are copied as active and the source goal is then best-effort frozen to `blocked`; `blocked`/`paused` goals are copied as `blocked`. Completed, budget-limited, usage-limited, missing, or unsupported goals are skipped. Migration writes only through app-server `thread/goal/set`, returns a bounded `sourceGoalMigration` object in the continuation job/result, and stores only boolean/error metadata in lineage; lineage must not include the goal objective text.

On Windows shared-stream startup, `start-codex-mobile-web-windowless.ps1` resolves the intended Codex binary first, then reuses an existing mux endpoint only when that endpoint reports the same `codexExe`. Older endpoints without `codexExe`, or endpoints pointing at the legacy `%USERPROFILE%\.codex-mobile-web\codex.exe`, are treated as stale and replaced before Mobile Web connects.

Thread detail no longer has a rollout-size skip threshold. The route first
checks the Mobile thread-detail projection index maintained by
`adapters/thread-detail-projection-service.js`. That index is seeded by compact
detail reads, updated from raw app-server notifications before browser SSE
compaction, and receives intermediate `item/*` events including agent,
reasoning, command-output, and file-output deltas. `turn/completed` is treated
as a patch over the existing projected turn rather than a full replacement:
missing or shorter `items` in the completion notification must not delete
streamed assistant receipts, and replacement assistant/plan receipts are merged
by stable id or matching text. Synthetic `turnUsageSummary` items remain
one-per-turn, with the newest summary replacing older summaries. Cache
signatures include the rollout size/mtime, summary updated time/status, the
retained turn window, and the projection policy version; stale signatures miss,
while live in-memory projection entries are accepted only when their
notification timestamp is not older than the current summary.
`adapters/thread-detail-projection-input-service.js` owns construction of the
server-side signature input for detail reads; the projection cache service owns
comparison, memory/disk storage, and miss/reseed behavior; and
`adapters/thread-detail-projection-result-service.js` owns projection-hit result
assembly before the route sends the detail response. That result assembly merges
cached projection output with display summary data, session-index title
hydration, state-db runtime fields, live-status normalization, public runtime
settings, and projection read-mode metadata.
`adapters/thread-detail-read-orchestration-service.js` owns the detail read
phase order and timing aggregation for `/api/threads/:id`; `server.js` supplies
the concrete app-server read, compaction, projection seed, fallback, and JSON
transport adapters. Dynamic
in-memory projection entries intentionally relax the full signature check while
a thread is actively changing, but only for a bounded window: if the backing
rollout path/size/mtime, retained turn window, or policy version changes after
the seed and the thread is now resting, or the dynamic entry ages past the soft
threshold without a new notification, the projection read must miss and reseed
from detail. If projection misses, the read coordinator still prefers
full app-server `thread/read includeTurns:true` regardless of rollout file size
because bounded `thread/turns/list` does not reliably preserve the
command/tool/file/search operation items expected in the Mobile detail view.
The server then compacts the mobile detail payload to the latest
`CODEX_MOBILE_THREAD_TURNS` turns (default `10`) when older turns exist and
seeds the projection index for future dynamic/warm reads. The compacted result
exposes `mobileOlderTurnsCursor` for the oldest retained turn. If `thread/read`
fails or times out, Mobile Web falls back to bounded `thread/turns/list`, then
local summary fallback. A `thread/turns/list` response can also carry the
app-server older-history cursor so the browser can page in earlier turns. The
browser loads older turns in 10-turn pages when the user scrolls to the top of
the current detail window and preserves the reading position after prepending
those turns.

The current implementation above is the v3 projection path. The v4 replacement
contract is documented in `docs/THREAD_DETAIL_PROJECTION_V4_DESIGN.md`: it keeps
v3 in place while adding a canonical server-side visible-item projection, a
`clientSubmissionId` pending overlay for browser-local submitted messages, and
stable visible item keys so DOM patching is only a rendering optimization.
Production may switch to v4 after focused service/UI tests and visual
verification pass; public release remains a separate public-safe validation and
publish gate.

The detail path compacts command/tool/file/search items, enriches item timestamps from rollout events, injects pending steer echoes when needed, and may attach a raw operation fallback only when it belongs to the same latest live turn. The current live turn keeps all compact process cards, and the previous ended turn also keeps those intermediate cards so the user can scroll back to inspect a just-finished step. If no live turn exists, the latest ended turn keeps compact process cards. Older-history pages and older turns outside that state-relevant set are receipt-only, retaining user question items, the last assistant/plan receipt item, and any `turnUsageSummary` metadata while omitting older assistant progress updates, process, reasoning, and operation cards. The pure selection rules for operation-retaining turns and receipt-only item indexes live in `adapters/thread-turn-compaction-policy-service.js`; `server.js` composes those rules with rollout, image, Usage, and stale-active enrichment. Completed raw fallback is accepted only while the latest turn is still live and the operation has a matching latest turn id; old completed operations must not attach to newer live turns. If app-server `thread/turns/list` omits the latest completed turn even though the thread summary and rollout `task_complete` point to it, server compaction appends a synthetic completed turn from the rollout completion event before trimming the recent window. The rollout enrichment index treats an EOF carry as visible only when it is a complete parseable JSON object; incomplete final fragments stay invisible, but a valid final `task_complete` line does not require a trailing newline before it can repair first-open detail. If a completed turn lacks an assistant/plan item whose text matches rollout `task_complete.last_agent_message`, detail enrichment inserts a synthetic final receipt before Usage so stale projections that still contain intermediate agent messages cannot cover the real final receipt on first open. Existing matching assistant/plan receipts are never replaced by this fallback, and failed, cancelled, interrupted, active, or otherwise incomplete turns are not backfilled. The usage summary is diagnostic UI only for successfully completed turns: turn-level token use, cumulative token use, model context-window percentage/risk, rollout size, and current workspace `PROJECT_CONTEXT.md` / `HANDOFF.md` sizes. `interrupted`, failed, cancelled, active, or otherwise incomplete turns do not render a Usage card even when their rollout contains `token_count` events, because that would imply a final receipt exists. Turn-level use is derived from cumulative `total_token_usage` deltas across all valid scoped token events in the turn, so multi-call turns are not reduced to the final model call. The usage row's `in` value displays uncached input when cached input is reported; context-window usage still uses raw input tokens from the final valid event. If app-server emits a final zero/window sentinel token event after valid usage, Mobile Web ignores that sentinel and keeps the latest valid scoped token event. Usage collection starts with the bounded rollout tail for speed, but thread detail also passes the currently returned turn ids into the collector. If any target turn is missing from the tail result and the rollout is within the runtime scan limit, the server scans the rollout file and caches only token summaries so recent completed turns do not lose Usage when later output pushes their `token_count` events out of the tail window. If rollout or workspace context sizes cross continuation thresholds, the Usage block may show the same `压缩续接` action used by the top warning.

`HANDOFF.md` has a separate 200KB Usage prompt threshold so recently compacted handoffs near 100KB do not immediately ask for another continuation.

Targeted Usage cache hits must pass the same target-turn missing check as the
tail result. A cache entry that lacks any currently returned target turn id is
not reusable; otherwise one early incomplete cache hit can hide Usage for a
completed turn until the cache expires.

Workspace-level token accounting is a separate persistent ledger. On `turn/completed`, `server.js` resolves the completed turn's scoped usage summary and writes one row to `%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite` through `adapters/token-usage-stats-service.js`. The primary key is `(thread_id, turn_id)`, so repeated notifications or refreshes replace the same turn instead of double-counting. The row stores `cwd`, local day, total/input/cached/output/reasoning tokens, model, and source. `GET /api/threads` decorates the list response with `mobileTokenUsage` aggregated by current Workspace and day, and also includes an all-Workspace project breakdown grouped by `cwd`. The browser uses that for a compact red sidebar `总/周/今` row and a full-screen `统计` page with per-day and per-project detail. Token stats display in millions rather than ten-thousands. Thread list rows do not render per-thread today-token badges; per-thread usage stays in turn detail summaries and the persistent Workspace/project stats surfaces. Detail should display uncached input (`inputTokens - cachedInputTokens`), cached input, output, and reasoning output separately because these token classes are not interchangeable for usage/cost interpretation. This path is intentionally independent of frontend memory and long rollout scans after the completion write, so continuation compaction does not erase project-level usage history. The stats service normalizes known Windows path mojibake before recording new rows and while grouping historical rows. Current visible Workspace roots are passed into the query path as aliases, so a previous mojibake cwd and the real Unicode cwd are shown as one project instead of separate or garbled entries.

The sidebar version pill is the entry point for update checks. It opens an Updates panel rather than immediately applying an update. The current-checkout section uses the existing `/api/app-update/status` and `/api/app-update/apply` path, which only fast-forwards the configured `CODEX_MOBILE_UPDATE_REMOTE` / `CODEX_MOBILE_UPDATE_BRANCH` when the checkout is clean, on the expected branch, and not ahead or diverged. The Public release section calls `/api/public-release/status` to read the latest commit from the configured public repository. It is informational for private checkouts; a public-installed checkout can use the same current-checkout fast-forward path when its update remote already points at the public repository. After a successful Windows self-update, the Node listener exits and the hidden windowless supervisor restarts it from the updated files; this remains true for a LocalSystem startup task, provided the launcher keeps the target user profile environment described above instead of falling back to the system profile.

The sidebar `Restart` action is separate from self-update. Before calling `/api/restart/shared-chain`, the browser opens an in-app confirmation dialog, reads a bounded recent `/api/threads?limit=200&archived=false` list, and lists running sessions that may be interrupted. This is advisory only: the user can still proceed, and the actual restart scope remains enforced by `adapters/shared-chain-restart-service.js` plus the platform restart scripts. On Windows system-task deployments, the API restart path starts a short hidden PowerShell bootstrap which registers and starts a separate `SYSTEM` helper task (`Codex Mobile Web Restart Helper`). That helper runs the real restart script outside the current scheduled-task process tree; otherwise a LocalSystem `AtStartup` task can kill its own helper when `Stop-ScheduledTask` runs. On macOS, LaunchAgent-managed listeners are restarted through `launchctl kickstart -k` against the existing GUI service label after same-prefix submitted jobs are cleaned. System LaunchDaemon deployments are not restarted with user-level `launchctl kickstart system/...`; the helper first best-effort repairs the LaunchDaemon stdout/stderr files reported by `launchctl print system/<label>`, then kills only the current listener and relies on LaunchDaemon KeepAlive to start the replacement. The fallback non-service path uses a one-shot detached `nohup` server process and must not create persistent `launchctl submit` jobs.

Thread detail responses may also include `thread.threadTaskCards`. These are
cross-thread collaboration cards that stay outside normal `thread.turns[*].items`
until the target thread explicitly approves them. The browser renders them in a
separate stack after the visible turn list and detached approvals, so they stay
near the active bottom surface without polluting message flow.
The composer reserves leading non-empty `#` commands as the cross-thread
task-card command path. Plain `# ...` defaults to a manual one-off card request;
the legacy `#自由协作` prefix remains accepted and defaults to autonomous
collaboration. Task-card commands do not use a separate parse endpoint. Instead,
`public/app.js` wraps the original command in a bounded request envelope that
includes the visible target-thread list, sends it through the normal
current-thread message path, and expects the model to return exactly one
`<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>`
JSON block. The preferred draft shape uses `targetThreadIds: [...]`; the parser
also accepts the legacy single `targetThreadId` field. The browser suppresses
the raw draft XML, shows a bounded placeholder while generation is in flight,
and automatically creates real pending target cards when a valid draft arrives.
The source thread must not require a local `Approve` step. Creation goes
through `POST /api/thread-task-cards`. That route accepts either a single
`targetThreadId` or multiple `targetThreadIds`, creates one stored card per
target, and returns both the compatibility `card` field and the full `cards`
array.
For Codex-thread/tool initiated delegation, Mobile Web also exposes
`POST /api/threads/:sourceThreadId/task-cards`. This route is not used by the
browser composer. It infers the source thread from the URL, stores the same
auditable task-card object, and only performs source-thread direct approval
when the runtime Settings switch `跨工作区委派` is enabled. With the default
configuration the route creates pending target cards. Passing
`pending:true`, `autoApprove:false`, or `direct:false` keeps pending behavior
even when the switch is enabled.
When that same runtime switch is enabled, Mobile Web injects the Codex
app-server dynamic tool `codex_mobile.delegate_to_thread` into `thread/start`
and `turn/start`. The model can call this tool after it determines that the
current request belongs in another thread/workspace. When the tool is injected,
its description is a mandatory model-visible boundary: cross-workspace
implementation, file edits, command execution, tests, deployments, and other
mutations should create a task card before target-workspace work, not directly
`cd`, inspect, edit, patch, test, deploy, or mutate the target workspace from
the current thread. This dynamic-tool path is fixed to source-thread direct
approval while the switch is enabled; a model-supplied `pending:true` is ignored
for this path so free delegation cannot create target-side Pending cards.
If a guarded local attempt fails with sandbox, permission, cwd, or
approval-policy errors, the server still does not create a card from the log.
The source model must evaluate the failure in context and call the dynamic tool
itself, so the delegated task keeps the originating thread's intent and
evidence.
Server-side handling of `item/tool/call` resolves the source thread from
app-server metadata or the recent turn/thread map, resolves the target by exact
thread id/title/cwd, and then calls the same source-thread task-card helper.
Target parsing, visible-thread filtering, archived/hidden/subagent/sidecar
rejection, same-cwd canonical selection, and public target metadata shaping are
owned by `adapters/thread-task-card-routing-service.js`; `server.js` keeps only
the HTTP/app-server composition wrappers for those rules.
This app-server dynamic-tool path is only for Codex app-server turns. Codex
Mobile also registers a standard `codex_mobile` MCP server into each active or
target Codex Home during startup, workspace creation, and profile switching.
That MCP server is backed by `scripts/codex-mobile-mcp-server.js`, exposes
`list_threads` and `delegate_to_thread`, and uses the same authenticated local
task-card API. The registration writes command/script/server/key-file paths to
`CODEX_HOME/config.toml`; it does not store raw key material. This gives new
Profiles and new Codex Homes the same delegation toolset without manual config
edits.
To keep this from being only a model prompt, the same runtime switch also adds a
dynamic source-write decision layer. For ordinary non-exempt workspaces,
`thread/start`, `thread/resume`, and `turn/start` use a real
`workspace-write` / managed profile plus `approvalPolicy:"on-request"` so direct
tool calls are still constrained by the app-server sandbox. The profile keeps
root read-only, allows writes to the current cwd, temporary directories, and the
current cwd's `.git` metadata, and keeps `.codex` / `.agents` under the cwd
read-only. The workspace-write sandbox policy also lists the current `.git` as
an explicit writable root because the app-server sandbox can otherwise keep git
metadata read-only even when the managed permission profile allows it.
`adapters/workspace-source-write-guard-service.js` auto-allows reads,
MCP calls, network, current-workspace writes, and current-workspace `.git`
approval requests, while auto-denying explicit file changes, patches,
relative-path source writes, `git add` / `git commit`, install/update commands,
or write-like file-system grants that target another known source root. Tool
workspaces remain usable: commands such as local Playwright / Chromium checks,
Home AI visual harnesses, network probes, and diagnostics that write only to
temporary output paths are allowed even when their command cwd is another known
source root. The guard treats JavaScript `=>` as code, not shell redirection, so
inline tool scripts are not rejected merely because they contain arrow
functions.

Cross-workspace discipline is therefore enforced through two layers: the
model-visible `codex_mobile.delegate_to_thread` dynamic tool/MCP/script
fallback, and the server-side sandbox/approval decision layer. Home AI central
control-plane provided tools are allowed through a narrow command allowlist when
the cwd is the Home AI control-plane root and the command is not shell-chained:
AI Ops, platform contract checks, visual harness commands, and `deploy:macos`.
Direct `apply_patch`, `git add`, `git commit`, relative source writes, or
arbitrary write commands against Home AI source remain denied from plugin
workspaces. The guard resolves the source workspace from thread/turn ownership
before looking at command cwd, so changing a command's cwd to Home AI cannot
turn a plugin thread into a Home AI maintenance thread.

The older `danger-full-access` approval-proxy-only mode is available only as an
explicit emergency fallback with
`CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY=1`; setting
`CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD=1` keeps the real
sandbox path even if the compatibility flag is present. Trusted maintenance
source workspaces are still exempt from narrowing when they are the source
thread cwd: the Codex Mobile source workspace itself, the Home AI central
control-plane workspace that owns deployment scripts, and any cwd explicitly listed in
`CODEX_MOBILE_WORKSPACE_DELEGATION_GUARD_EXEMPT_CWDS`. Operators can disable
the guard in an emergency with
`CODEX_MOBILE_WORKSPACE_DELEGATION_WRITE_GUARD=0` or
`CODEX_MOBILE_WORKSPACE_DELEGATION_DISABLE_WRITE_GUARD=1`. Already-running
turns keep the sandbox they were started with.
The ChatGPT Pro MCP `delegate_to_codex_thread` tool uses the same server helper
but passes `pending:true` by default, because ChatGPT-originated cards must keep
target-thread approval unless `mode:"direct"` is requested and the dedicated MCP
direct-delegation environment gate is enabled.
Server-side draft materialization backs up the browser path. On fresh
`turn/completed`, `server.js` fetches a bounded recent-turn window, scans
assistant/plan items for the same structured draft XML, resolves source/target
workspace metadata from local Codex state, truncates overlong draft bodies to
the 8,000-character card limit, and calls the same idempotent `createMany()`
path. Thread detail reads also run materialization before attaching
`thread.threadTaskCards`, including fallback `thread/turns/list` reads, so
automatic collaboration does not depend on which browser client is open.
When the browser later resolves the queued draft key for automatic creation, it
must keep scanning past ordinary assistant or plan messages until it finds the
matching draft block. Long source threads often contain many earlier
non-draft messages, and those must not prevent the later draft from reaching
the task-card API.
Plain `#` draft commands default `workflowMode` to `manual` unless the command
explicitly asks for autonomous/free collaboration. The legacy `#自由协作` draft
path defaults `workflowMode` to `autonomous` unless the command explicitly asks
for a one-off manual card. The first target-side approval activates a workflow
grant scoped to the workflow id and the same two participating thread ids;
ordinary cards remain manual. Completion auto-return is part of the default
autonomous contract: for an approved autonomous card, the server observes
completion of the injected target turn and creates one
reverse-direction auto-return card with the final receipt. That return card
reuses the same workflow id and auto-injects back into the source thread through
the active grant.
### Thread Detail Performance Diagnostics

Thread detail reads expose bounded timing metadata under
`thread.mobileDiagnostics.threadDetailTimings`. This diagnostic payload is for
root-cause performance analysis only; it must not copy user messages, prompts,
tool output, upload paths, provider payloads, or rollout bodies. The stable
fields include `requestMode`, `readMode`, `phase`, `summarySource`, `totalMs`,
`summaryMs`, `projectionMs`, `turnsListInitialMs`, `threadReadMs`,
`rawThreadReadMs`, `turnsListFallbackMs`, `prepareResponseMs`,
`returnedTurns`, `omittedTurns`, and `rolloutSizeBytes`.

The browser forwards those fields through `/api/client-events` as
`thread_detail_first_paint.serverTimings`, `thread_refresh_ms.serverTimings`,
and `thread_detail_full_ready.serverTimings`, plus a compact
`performancePhase`. Thread-list events similarly report `serverTimings` and a
phase for fallback cache hits versus cold fallback rebuilds. This is an
evidence path, not a content strategy: large-session first paint must still
return the current authoritative detail/projection state rather than showing an
intentionally incomplete page and relying on a second refresh to hide the
missing data.

### Conversation Navigation

The browser owns conversation scroll controls. The return-to-bottom button appears only when the current thread is loaded, scrollable, and away from the newest content.

The upward floating button for the current live or recently completed turn is a summary/receipt jump, not a start-of-answer jump. It shares the same floating slot as the return-to-bottom button and must not appear at the same time; return-to-bottom wins when both predicates are true. A real upward user scroll can activate the anchor while a turn is live, and `turn/completed` also creates a completion anchor so a user who has already reached the bottom can still jump back to the beginning of the final receipt. Clicking the button should scroll to the last `agentMessage` or `plan` item in that turn. If no such final receipt exists, it falls back to the last non-user, non-live-operation, non-Usage item, then to the turn container. Tapping the down-arrow to skip to the bottom must not clear the completion anchor; the anchor clears on a new turn, expiry, thread change, or after the user taps the upward receipt-jump button. Visibility is based on the target item's start being above the viewport, not on the whole target item being above the viewport, because final summaries can be tall.

Mobile operation bubbles are live-turn controls. The compact bubble may stay visible for the 500ms minimum dwell while the turn is still live, and the recall dot may reopen the current live turn's latest command/file/tool/search sheet. Once the turn completes and the final receipt/Usage surface is shown, the old operation bubble or recall dot must not remain as a command entry.

Live and final receipt rendering must respect reading position. Once recent manual scroll intent moves the conversation away from the bottom, Mobile Web creates a current-turn auto-scroll hold even if a programmatic bottom-scroll window is active. While that hold is active, render-time stick-to-bottom, submitted-message follow, and viewport follow should not scroll down. The hold clears when the conversation returns to bottom or the user explicitly taps the down-arrow button. Plain live chat replies may continue streaming, but a latest live `agentMessage` in a turn that already has command/file/tool/search operation items is treated as a final receipt: the client stores deltas without repainting the card, then renders the receipt once on `turn/completed`. If the final receipt is long, the completion render scrolls to the start of that receipt instead of the bottom so the user can read downward or tap the down-arrow to skip it. If `turn/completed` arrives with a short completion payload and the full deferred receipt is only restored by the follow-up thread refresh, the completion anchor remains pending and the refresh render performs the same one-time receipt-start positioning.

Completion schedules two post-completion detail refreshes. The second refresh is
a bounded UI consistency pass for Usage and projection state that can settle
after the immediate `turn/completed` notification.

If the current thread's latest successful completed turn is still missing
`turnUsageSummary` after a refresh, the browser starts a bounded Usage backfill
refresh loop. The loop stops when Usage appears, the thread changes, the page is
hidden, or the attempt cap is reached. Interrupted, failed, cancelled, active,
and in-progress turns never start this Usage backfill path.

### Message Submission

New-thread and explicit-resume sends use `thread/start` after applying runtime settings. Existing-thread sends include the browser active turn id:

1. Preflight stale active-turn state with recent turn history, pending items, pending requests, and rollout silence.
2. If the active id is stale or superseded, interrupt that stale marker and fall through to `thread/resume` + `turn/start`.
3. If the latest durable turn is live, steer with `turn/steer`.
4. Preserve visible user input through deterministic `mux-user-*` echoes and pending steer echo injection until app-server durable history catches up.

Mutation RPCs are not retried generically. If the app-server stream drops during
a Listener or mux restart, Mobile Web treats recovery as a separate user-visible
continuation path: once the browser observes app-server status move from
unavailable to ready, it may call `POST /api/threads/:id/auto-recover` for the
current known running thread. The server first inspects `thread/turns/list` and
tries `turn/steer` against a still-live turn; if the original turn is no longer
steerable, it resumes the thread and starts a new turn with a bounded
continuation prompt. A thread-level cooldown prevents reconnect flapping from
creating repeated continuation turns.

Browser-selected model, reasoning effort, permission mode, and the Fast tag are
persisted in the browser draft store by thread/workspace key even when the
composer text is empty. Reopening the app or switching away and back should
restore that runtime selection for the current target only; Fast is not a global
browser flag. In wide-screen tile mode, the existing Composer runtime row is
not duplicated per pane; it follows the selected active pane exactly like the
shared Composer target. Switching the active pane saves the previous pane's
runtime draft, restores the new pane's thread-keyed draft, and clears stale
pending runtime overrides when the new pane has no draft so controls fall back
to that thread's own metadata. Quota remains a global display in the reused
toolbar, not pane-local state. Once an existing-thread non-steering send
succeeds, Mobile Web clears only text and attachments, then writes the
runtime-only draft back under the thread key. New-thread send captures selected
runtime values before creation and writes them back under the newly created
thread key. In tile mode, Composer focus and keyboard visualViewport changes
are not tile layout changes: the pane grid uses the pre-keyboard viewport and
Composer-height baseline while a keyboard-editable input is focused, and
visualViewport resize does not trigger a full thread render for the tile board.
Home AI embedded tile mode also suppresses whole-app `--app-top` translation
while the keyboard is open so the shared Composer can adapt without moving the
entire pane grid. The display mode and tile pane slot order are server-side
runtime settings under `settings.json` `threadDisplay`, exposed through
`GET/POST /api/settings/thread-display`; `localStorage` is only a legacy
migration/cache mirror. Pane slots are stable thread id positions: normal
thread-list recent sorting can fill empty slots but must not reorder existing
slots. A manual pane title-menu switch replaces only that slot and persists the
new ordered pane id list.

Tile-mode pane refreshes are local by default. The browser keeps per-pane
detail cache, operation bubble state, and scroll-bottom hold state keyed by
thread id. Pane selection, title switch menus, background recent-detail refresh,
and operation bubble changes should patch the affected pane only when pane ids
and column layout are unchanged. A pane follows new content to the bottom unless
the user has explicitly scrolled away from the bottom; in that case Mobile Web
preserves distance from bottom until the user scrolls back down.

The latest durable live turn must not be auto-interrupted only because it is quiet or ended with a completed operation/context marker. User guidance during a real latest live turn should steer that turn.

Cross-thread task-card approval is a separate path. Approval does not attempt to
append a fake static message to the target thread. Instead, after target-side
approval, Mobile Web resumes the target thread if needed and injects the card
payload as a real new `turn/start` user input. Delete and revoke are state
transitions only and must not create target-thread messages. Target-side
approval first persists a transient non-pending `approving` state before the
external `turn/start` call, preventing reconnect, refresh, or continuation
compaction from rendering a duplicate actionable `Approve` card while the
approved turn is already starting. If the external call fails before
acceptance, the card is restored to `pending` with a bounded audit error.
For autonomous workflow follow-ups, the service uses the same approval path
without a human click only when an active workflow grant matches both the
workflow id and the unordered source/target thread pair. A matching id with a
different thread pair remains pending and does not auto-inject. Completion
auto-return is driven by app-server `turn/completed`: `server.js` calls
`threadTaskCardService.maybeAutoReplyCompletedTurn()` for completed turns, and
the service matches `injectedTurnId` / target thread id to an approved
autonomous card. The auto-return idempotency key is based on the original card
id plus completed turn id, so replayed completion notifications do not create
duplicate return turns.
Source-side draft creation is also intentionally lightweight: once a valid
Task-card command drafts create pending cards, the browser does not block on re-reading
the source thread before settling local state. It updates local draft state and
refreshes thread summaries in the background, and it does not render an interim
source-side `Sending` draft card during automatic creation. Single-target drafts
still open the target thread so the pending card is visible where it was
delivered; multi-target drafts stay on the source thread without rendering
outgoing cards as local work items. Cross-thread task cards now render below the
visible turns
and detached approval stack, keeping them at the bottom of the target thread
rather than above historical conversation content. Only `pending` cards whose
`threadRole` is `target` render in thread detail; source-side outgoing pending
cards remain store/audit state and badge/count state only. Once a card reaches
`approved`, `deleted`, `revoked`, or `replied`, the browser stops rendering that
card and the injected turn or later reply becomes the user-visible surface.
Source-side task-card draft settlement uses a stable key derived from the turn
id and draft content, not the app-server item id. On thread re-entry, the
browser also checks existing stored cards from the same source turn before
auto-sending a draft again, so item-id drift after refresh/compaction cannot
recreate a card.
If the draft contains a target id that is not an exact visible thread id, the
browser can recover it only when exactly one visible target has a sufficiently
long common id prefix. This covers model-copy errors where the target id prefix
is right but the suffix is corrupted, while still failing closed for ambiguous
or invented targets.
The current `#` task-card path is still bounded and conservative, but
the interpretation now lives in the model turn rather than a browser/server
regex parser. The browser provides only the visible thread list and required
response schema. If the model does not return one valid visible
`targetThreadId`, Mobile Web does not auto-create a pending card.

The browser connects to `/api/events` with the current thread id. `server.js` filters app-server notifications to the current thread where possible, forwards status and thread-level notifications, and drops large diff notifications that the UI does not render. Background turn bodies are not broadcast to unrelated thread clients; only derived `thread/status/changed` summaries are broadcast for thread-list status accuracy. In Hermes embed mode, EventSource is treated as the preferred live channel, not the only recovery path: if `/api/events` errors but normal API calls still work, the browser refreshes `/api/status`, the thread list, and the current thread through ordinary requests, enters a bounded polling fallback, and retries EventSource with backoff. The embed fallback keeps thread-list refreshes silent and does not set the visible connection chip to `Reconnecting` while JSON API recovery is healthy. This avoids repeated visible reconnect/refresh prompts when iOS WebKit or a reverse proxy temporarily interrupts the long SSE stream while the JSON API is healthy. Source-less `account/rateLimits/updated` notifications are recorded server-side but not broadcast to browsers because they can come from another workspace in a shared mux stream. Browser quota display is refreshed from active `/api/public-config` and `/api/status` snapshots; the server reads `account/rateLimits/read` after app-server initialize and then accepts later quota notifications from the same trusted source. Rollout-scanned quota data is kept only as an account-scoped cold-start fallback and does not overwrite live app-server quota. For shared-profile homes, only live quota from this listener's own managed child app-server or from the active profile home's mux endpoint can be exposed, and it is not persisted as reusable profile quota. When the server explicitly reports no valid quota snapshot, the browser clears its local quota cache instead of keeping a stale previous-account value.

The mux keeps a replay buffer for recent app-server notifications and unresolved server requests. Mobile Web declares a bounded replay limit to avoid replaying very large historical streams.

### Web Push Completion Notifications

Turn-ended Web Push notifications are driven by app-server `turn/completed` notifications after Mobile Web has observed the matching `turn/started` event. They must fail closed for unknown thread ids and sub-agent child threads.

Standalone Web Push completion payloads must carry the stable Codex thread id
both at the top level and in `notification.data.threadId`, along with a same
origin deep-link URL such as `/?thread=<thread-id>`. The service worker click
handler focuses an existing app shell and posts the target id, or opens the
deep-link URL directly for cold-start/PWA launch so startup thread selection can
load the matching thread without relying on a late `postMessage`.

If the completion payload explicitly says the turn has no final assistant message, Mobile Web must not send a normal "turn ended" Push notification. That shape means the runtime ended the turn without a final reply, so treating it as a normal completed turn is misleading. Thread detail projection should expose this as a bounded `turnDiagnostic` item with code `runtime_completed_without_response`; it must not fabricate an `agentMessage`, and receipt-only compaction must retain the diagnostic so the turn does not appear to silently vanish.

Client-side incident reporting should reuse the authenticated Mobile Web server rather than opening a separate unauthenticated listener. Frontend diagnostics may POST bounded fields such as build id, thread id, turn id, read mode, status, render/scroll state, event source, item counts, and timing buckets. They must not include access keys, cookies, raw prompts, message bodies, image contents, full logs, or provider payloads. Any task-card closure built from these diagnostics should be deduplicated, rate-limited, and reference a diagnostic package id instead of embedding private evidence directly.

When the Hermes plugin notification delegate is configured, turn-completed
events are sent to Hermes Action Inbox/Web Push instead of Mobile Web's direct
Web Push subscription list. If the delegate is not configured, standalone
Mobile Web keeps the existing local Web Push path. The iframe plugin mode never
registers its own Push subscription. Delegated plugin notifications must use
the actual Codex thread name as the payload title: explicit `threadTitle`,
`thread.name` / `thread.title`, and nested `turn.thread.name` /
`turn.thread.title` win over stale started-turn labels, route/plugin names, or
preview text. Persisted thread `name` is preferred over `preview`; preview is
only a fallback when no real thread name is available.
`adapters/push-notification-service.js` owns the bounded in-memory cache of
app-server `thread/list` and `thread/read` display summaries, and `server.js`
checks that display cache before the local SQLite fallback. This prevents old continuation threads whose
`state_5.sqlite` title still contains the bootstrap prompt from producing a
wrong external notification title. If the cache is empty when a completed-turn
event arrives, the notification path performs a bounded app-server summary
refresh before sending the Hermes delegate payload or standalone Web Push.

### Approvals And Server Requests

The mux proxies app-server server requests, including command approvals, file-change approvals, legacy exec/apply-patch approvals, permission-profile requests, request-user-input, and MCP elicitation. Mobile Web renders them in-turn when a turn id is known and answers through the same stream.

### Uploads And Images

Browser-side image compression happens before upload when supported. Uploaded attachments are summarized as local file paths in the text input.

Image uploads are reference-only by default: Mobile Web does not send app-server `localImage` input parts unless `CODEX_MOBILE_IMAGE_CONTEXT_MODE` explicitly opts into `latest`/`vision` or legacy `all`. This is separate from extended-history persistence. Reference-only mode prevents new uploads from becoming `input_image` payloads in app-server current history and compacted `replacement_history` snapshots.

The browser display remains visual: conversation messages parse uploaded image summaries and render saved image paths as centered thumbnails through the authenticated upload preview route. That route must return real image MIME types such as `image/jpeg`, `image/webp`, or `image/png` for saved upload paths so browser `<img>` elements render consistently. This applies to the original user upload and to later Codex/plan replies that quote the same `Uploaded attachments:` block, including CRLF line endings, Markdown blockquote-style quoted summaries, and raw app-server `input_text` / `input_image` / `image_url` content parts. If an app-server image part puts a local Mobile Web upload path in `image_url` instead of `path`, the browser still treats it as local runtime data and renders it through `/api/uploads/file` rather than using the raw filesystem path as an image URL. Browser image `src` values for Mobile Web uploads should use `/api/uploads/file?id=<upload-root-relative-id>` when the path is under the default runtime upload root, so embedded pages do not expose local absolute paths as media URL parameters; the legacy `path` parameter remains a server-side compatibility fallback. Assistant Markdown may also render generated bitmap data URLs such as `data:image/png;base64,...` as bounded images; SVG data images stay blocked. In Hermes/Home AI embed mode, protected upload and generated-image elements may start with the browser-visible same-origin API URL and keep `data-protected-image-src`; when the page itself is served under `/api/hermes-plugins/<plugin-id>/proxy/`, that URL must also stay under the same plugin proxy prefix, not the Home AI host root `/api`. Scheduled scans must not proactively replace still-loading direct images with page-local `data:image/...` or `blob:` URLs. If a protected image actually fails, recovery may fetch with the current in-memory session key; embedded/iOS recovery should retry a cache-busted browser-visible same-origin file URL before falling back to page-local data/blob URLs. This display path must not be used as a reason to re-enable model `localImage` input by default.

By default, Mobile Web also does not request app-server extended-history persistence for image-upload turns. This reduces repeated historical payload retention for future uploads but cannot remove old images already retained in app-server memory or historical rollout records.

Uploaded files stay under the Mobile Web runtime upload root. Authenticated preview routes must only serve paths under allowed roots. Allowed local-file preview roots include explicit `CODEX_MOBILE_FILE_PREVIEW_ROOTS`, known visible workspace roots, the current thread cwd, Codex skill directories such as `$CODEX_HOME/skills`, `$HOME/.codex/skills`, and `$HOME/.agents/skills`, and an enclosing Obsidian vault when present. The preview route must not add arbitrary runtime, upload, temp, whole `.codex`, or machine-diagnostic directories. Local-file preview targets may include Codex-style source locations such as `README.md:12`, `README.md:12:3`, or `README.md#L12`; the server strips those location suffixes before extension and root checks so the actual Markdown/text file is previewed. Local preview links render as the linked path text only and must wrap long paths. Markdown preview uses source ordered-list numbering. The preview panel should avoid horizontal dragging by using viewport-bounded width plus wrapped Markdown code/table content. While a preview dialog is open, right-swipe gestures close the preview and must not propagate to the underlying conversation/sidebar navigation.

App-server `imageView` items and completed `imageGeneration` items with a `savedPath` can point at generated screenshots/images outside the current workspace, such as `%TEMP%` files or `%USERPROFILE%\.codex\generated_images` PNGs. Some Codex tool screenshots also appear only in rollout `function_call_output` / `custom_tool_call_output` payloads as image parts, including `input_image` data URLs from `view_image`. Mobile Web must not add arbitrary temp or `.codex` directories to file-preview roots. Instead, when the server compacts one of these items or rollout tool-output image parts and the referenced source is an allowed small image, it copies the image into `%USERPROFILE%\.codex-mobile-web\generated-images` (or `CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR`) and attaches an authenticated `/api/generated-images/file` content URL. Receipt-only turn compaction keeps these visual items, and unscoped rollout tool-output images use timestamp windows to attach to the matching turn instead of defaulting to the latest turn. When the same turn already contains a user upload summary, `view_image` / tool-output echoes for that same uploaded file are suppressed because the user message already renders the upload thumbnail; this avoids duplicate system `Image` cards for uploads while preserving real generated screenshots and tool images that are not upload echoes. Suppressed upload echoes are represented in the server projection by turn-level `mobileSuppressedVisualReceiptKeys` containing only bounded item id, tool call id, or basename keys, not upload absolute paths. The browser's V4 projection merge treats those keys as the authoritative tombstone for old local visual receipts; it must not infer suppression from upload summaries on its own. The browser prefers that generated-image URL over raw local-file preview paths, so live and reloaded turns can render Codex's own visual-check screenshots and generated effect images without relaxing workspace preview security. Hermes plugin sessions also set a short-lived HttpOnly `codex_mobile_plugin_session` cookie for browser media loads, while the browser continues to refresh same-origin API image URLs with the current in-memory session key as a fallback for iframe cookie restrictions. Server authorization accepts any valid candidate token from headers, query parameters, or bounded Codex Mobile cookies, so a stale image URL query token cannot mask a current plugin session cookie.

### Rollout Continuation

The preferred continuation endpoint is `POST /api/thread-continuations`. It creates a background job, compacts oversized live workspace context when needed, asks the source thread to write a handoff file, creates the new thread, sends a scoped bootstrap index, and returns the new thread id for browser switching. Workspace context compaction archives full `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md` originals under `.agent-context/archive/context-compaction-<timestamp>/`, rewrites the live files into short routing/current-state documents, and records a manifest/report so older provenance remains available on demand.

Continuation bootstraps must include enough references for a fresh thread without injecting unrelated private thread rules or old thread bodies. Runtime settings inheritance should come from current rollout `turn_context` and SQLite/app-server metadata where supported.

The bootstrap message is a reference-only index by default. It lists the generated source handoff file, workspace context files, docs entrypoint, lineage index, source-thread metadata, and runtime settings. It does not inline source handoff excerpts, recent source-turn summaries, workspace context excerpts, or lineage handoff excerpts. The generated source handoff file under `.agent-context/thread-handoffs/` remains the high-priority fact source, but large handoffs and workspace context files should be loaded through bounded head/tail reads plus targeted search before full reads are used.

Before writing full archived context in a Git workspace, the compaction service creates `.agent-context/archive/.gitignore` so archive payloads stay out of commits. If the archive path still is not ignored, compaction must skip instead of writing full context into a committable path. A compact active handoff is current-state only: agents must not infer latest version or deployment transitions from archived old `Latest Product State` sections. Before updating a latest-version, backup, deployment, or runtime-state fact, verify the current value from the latest source-thread handoff, current repo/static version strings, or runtime smoke.

### PWA Shell Cache And Build Id

`public/sw.js` owns the app-shell cache. Static frontend changes that affect browser behavior must bump both:

- `CLIENT_BUILD_ID` in `public/app.js`
- `SHELL_CACHE_NAME` in `public/sw.js`

`GET /api/public-config` reads the current app-shell build metadata on each
request. It must not freeze `buildId`, `clientBuildId`, or `shellCacheName` at
Node startup, because a deploy can update static files while the old listener is
still alive. The browser compares only real app-shell build fields
(`clientBuildId`, `shellCacheName`, `buildId`), not the ordinary app `version`.

Refresh is manual in standalone mode. The browser may check for a new
server-started build after startup, foreground/focus recovery, EventSource
reconnect/status, and successful thread-list refresh, but those checks only show
`#pageRefreshPrompt`; they do not prewarm shell caches or reload the page.
Restart flows also show the same button instead of scheduling a timed reload.
Only a user click on `#pageRefreshPrompt` runs the refresh path: save drafts,
fetch the latest `/api/public-config`, apply quota snapshots, prepare the target
shell assets, prune old shell caches, and call `window.location.reload()`. This
keeps version changes explicit and makes the visible button the standalone reload
trigger. In Hermes embed mode, the iframe may ask the host for refresh when the
client shell build changes, but the request is signature-deduped so an old cached
iframe cannot repeatedly force host reloads for the same build mismatch. Build
checks compare the direction of `codex-mobile-shell-vNNN`: a server shell newer
than the loaded client may prompt/ask the host to refresh, while a loaded client
newer than `/api/public-config` is treated as a deployment middle state and must
not create a refresh loop.
Server-only asset build drift is recorded silently so returning through the host
bottom tabs does not flash through an old/default iframe page. Asset-only
`buildId` changes must not show the visible "New version" prompt; only a newer
comparable app-shell identity (`clientBuildId` / `shellCacheName`) should ask
the user or Hermes host to refresh. Server-only fixes do not need a shell bump,
but open clients may need a normal detail refresh.

### Public PR Prompt

The public PR check is prompt-only. `server.js` checks the configured public GitHub repository for open pull requests through the unauthenticated public API, caches the result briefly, and exposes it through authenticated `/api/public-pull-requests/status`. The browser can prompt whether to prepare a merge/publish review task, but it must not merge, sync, commit, or push the public repository without an explicit user request. Accepted prompts target a visible review workspace: use `/api/public-config.workspacePath` when it is visible to Codex Desktop, otherwise use a visible workspace with the same basename so Mac production deployments under `/Users/hermes-host/.../plugins/codex-mobile-web` can route review tasks to the real source checkout under `/Users/hermes-dev/.../plugins/codex-mobile-web`. The browser first reuses a visible same-workspace thread titled `Codex Mobile Public PR`. If no such thread exists, the new-thread draft carries that title and `/api/threads/new-message` persists it through app-server rename plus the Mobile session-index fallback after creation.

### GitHub Link Previews

GitHub preview metadata is available through authenticated `GET /api/link-previews/github?url=...`. The server accepts only HTTPS `github.com` / `www.github.com` repository, issue, pull request, and commit URLs, canonicalizes them through `adapters/github-link-preview-service.js`, and fetches only the corresponding `api.github.com` REST endpoint. It must not fetch arbitrary user-supplied URLs, read local files, attach the Codex Mobile Access Key to GitHub requests, or persist preview payloads outside the in-memory cache. GitHub API failures return a bounded unsupported/error payload instead of blocking conversation rendering.

## Invariants

- Shared-stream mode must not silently fall back to a managed app-server child.
- A Codex Home owns one shared mux endpoint. Codex Desktop, Codex Mobile Web,
  and any Home-specific shortcut using the same `CODEX_HOME` must attach to the
  same `app-server-mux/endpoint.json` information stream instead of creating
  independent per-client streams. Reliability fixes should change mux process
  lifetime, not split mux ownership by client surface.
- Mac production shared-stream mode uses a persistent Mobile-owned mux when
  Desktop is closed; Listener shutdown must not kill that mux.
- Mux endpoint drift must be detected before using a stale live socket.
- Windows background helpers started by Mobile Web or the Desktop shared bridge
  must be windowless. Use `-WindowStyle Hidden` for PowerShell/Start-Process
  helpers, wrap user-facing Desktop shortcuts through `wscript.exe`, compile the
  Desktop `CODEX_CLI_PATH` shim as `/target:winexe`, and use
  `CREATE_NO_WINDOW` / hidden startup flags for shim-spawned Node/mux/app-server
  children. Mobile-owned real `codex app-server` children must clear
  Desktop-bridge-only `CODEX_CLI_PATH` and `CODEX_MUX_*` environment variables
  before spawning the CLI, otherwise CLI tool subprocesses can loop back through
  the bridge shim and reopen a console. The Desktop GUI itself is the only
  normal visible process launched by the Desktop shared shortcut.
- Mobile UI should compact live latest-turn operations and avoid rendering full command outputs, full diffs, or reasoning rows. The latest live-turn operation card uses a compact four-line visual budget: one metadata row plus up to three clipped detail lines. Completed turns should not keep operation cards below the final reply; the Usage summary is the final diagnostic frame when available.
- User-visible mobile input should not disappear on refresh while steering is pending.
- Old operation cards must not be attached to newer live turns.
- PWA and service worker changes require explicit build/cache bumps.
- Public sync requires explicit user approval and README Chinese release notes.
