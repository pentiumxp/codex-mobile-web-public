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
| `%USERPROFILE%\.codex\app-server-mux\endpoint.json` | Shared mux JSONL TCP endpoint used by Mobile Web and Desktop bridge |
| `.agent-context/` | Durable local project context, not public release content |

Keep `.codex` read-only except through app-server RPCs. Do not patch rollout files or SQLite state directly unless there is an explicit, risk-reviewed recovery task.

## Request Flows

### Public Config And Login

`GET /api/public-config` exposes auth requirement, version/build ids, runtime option lists, upload limits, rollout warning threshold, quota snapshots, Push support, self-update availability, public PR check availability, and the Hermes plugin endpoint paths. The browser uses this before showing the app shell.

Authentication uses `x-codex-mobile-key`, `Authorization: Bearer`, the existing cookie, or the existing `key` query parameter against the runtime access key file. Do not print the key in logs or chat output.

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
after session exchange. Internal route changes post:

```json
{ "type": "codex-mobile.plugin.navigation", "version": 1, "canGoBack": true, "route": { "kind": "thread", "threadId": "..." } }
```

The embedded thread switcher/settings surface is a plugin primary page, not an
overlay drawer. That primary page reports `canGoBack: false`, so Hermes Mobile
can show its own bottom navigation tabs. Thread detail and new-thread composer
routes are secondary pages and report `canGoBack: true` so iOS Hermes Mobile
forwards its right-swipe/back affordance to the iframe. Codex handles that
secondary-page back by returning to the primary thread-switcher/settings page.
It must not show the standalone first-launch Workspace page or treat the
thread-switcher/settings surface as an overlay sidebar in Hermes embed mode.
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

Thread list reads app-server `thread/list`, then filters archived/deleted/sub-agent/out-of-workspace rows using local visibility rules and SQLite fallback data.

Thread detail has two modes:

- Small rollout: prefer full `thread/read includeTurns:true`.
- Large rollout: skip expensive full reads and prefer bounded `thread/turns/list`, then local summary fallback.

The detail path compacts command/tool/file/search items, enriches item timestamps from rollout events, injects pending steer echoes when needed, and may attach a raw operation fallback only when it belongs to the same latest live turn. A running latest turn keeps at most one operation card so the current command/tool state remains visible. Once a turn has completed, operation cards are removed from the compact mobile detail; the final diagnostic frame should be the synthetic `turnUsageSummary` item when scoped rollout `token_count` data exists. Completed raw fallback is accepted only while the latest turn is still live and the operation has a matching latest turn id; old completed operations must not attach to newer live turns. The usage summary is diagnostic UI only: turn-level token use, cumulative token use, model context-window percentage/risk, and rollout size. Turn-level use is derived from cumulative `total_token_usage` deltas across all valid scoped token events in the turn, so multi-call turns are not reduced to the final model call. The usage row's `in` value displays uncached input when cached input is reported; context-window usage still uses raw input tokens from the final valid event. If app-server emits a final zero/window sentinel token event after valid usage, Mobile Web ignores that sentinel and keeps the latest valid scoped token event.

Thread detail responses may also include `thread.threadTaskCards`. These are
cross-thread collaboration cards that stay outside normal `thread.turns[*].items`
until the target thread explicitly approves them. The browser renders them in a
separate stack before the visible turn list so they do not pollute message flow.
The composer also reserves `#...` at the start of a message as a cross-thread
task-card command path. Those messages do not use a separate parse endpoint.
Instead, `public/app.js` wraps the original `#` command in a bounded request
envelope that includes the visible target-thread list, sends it through the
normal current-thread message path, and expects the model to return exactly one
`<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>`
JSON block. The browser renders that assistant reply as a local approval card
and only then creates a real pending task card through `POST /api/thread-task-cards`.
### Conversation Navigation

The browser owns conversation scroll controls. The return-to-bottom button appears only when the current thread is loaded, scrollable, and away from the newest content.

The upward floating button for the current live or recently completed turn is a summary/receipt jump, not a start-of-answer jump. After a real upward user scroll activates the anchor, clicking the button should scroll to the last `agentMessage` or `plan` item in that turn. If no such final receipt exists, it falls back to the last non-user, non-live-operation item, then to the turn container. If the user has already scrolled upward while the turn is live, `turn/completed` must preserve that activated anchor so the final receipt does not make the button disappear. Visibility is based on the target item's start being above the viewport, not on the whole target item being above the viewport, because final summaries can be tall.

Live and final receipt rendering must respect reading position. Once recent manual scroll intent moves the conversation away from the bottom, Mobile Web creates a current-turn auto-scroll hold even if a programmatic bottom-scroll window is active. While that hold is active, render-time stick-to-bottom, submitted-message follow, and viewport follow should not scroll down. The hold clears when the conversation returns to bottom or the user explicitly taps the down-arrow button.

### Message Submission

New-thread and explicit-resume sends use `thread/start` after applying runtime settings. Existing-thread sends include the browser active turn id:

1. Preflight stale active-turn state with recent turn history, pending items, pending requests, and rollout silence.
2. If the active id is stale or superseded, interrupt that stale marker and fall through to `thread/resume` + `turn/start`.
3. If the latest durable turn is live, steer with `turn/steer`.
4. Preserve visible user input through deterministic `mux-user-*` echoes and pending steer echo injection until app-server durable history catches up.

The latest durable live turn must not be auto-interrupted only because it is quiet or ended with a completed operation/context marker. User guidance during a real latest live turn should steer that turn.

Cross-thread task-card approval is a separate path. Approval does not attempt to
append a fake static message to the target thread. Instead, after target-side
approval, Mobile Web resumes the target thread if needed and injects the card
payload as a real new `turn/start` user input. Delete and revoke are state
transitions only and must not create target-thread messages.
Source-side draft approval is also intentionally lightweight: once a `#`-draft
approval creates the pending card, the browser does not block on re-reading the
source thread before showing success. It updates local draft state, refreshes
thread summaries in the background, and immediately opens the target thread so
the pending card is visible where it was delivered. Cross-thread task cards now
render below the visible turns and detached approval stack, keeping them at the
bottom of the thread rather than above historical conversation content. Only
`pending` task cards render in thread detail; once a card reaches `approved`,
`deleted`, `revoked`, or `replied`, the browser stops rendering that card and
the injected turn or later reply becomes the user-visible surface.
The current `#` task-card path is still bounded and conservative, but the
interpretation now lives in the model turn rather than a browser/server regex
parser. The browser provides only the visible thread list and required response
schema. If the model does not return one valid visible `targetThreadId`, Mobile
Web does not auto-create a pending card.

The browser connects to `/api/events` with the current thread id. `server.js` filters app-server notifications to the current thread where possible, forwards status/rate-limit/thread-level notifications, and drops large diff notifications that the UI does not render.

The mux keeps a replay buffer for recent app-server notifications and unresolved server requests. Mobile Web declares a bounded replay limit to avoid replaying very large historical streams.

### Web Push Completion Notifications

Turn-ended Web Push notifications are driven by app-server `turn/completed` notifications after Mobile Web has observed the matching `turn/started` event. They must fail closed for unknown thread ids and sub-agent child threads.

If the completion payload explicitly says the turn has no final assistant message, Mobile Web must not send a normal "turn ended" Push notification. That shape means the runtime ended the turn without a final reply, so treating it as a normal completed turn is misleading.

When the Hermes plugin notification delegate is configured, turn-completed
events are sent to Hermes Action Inbox/Web Push instead of Mobile Web's direct
Web Push subscription list. If the delegate is not configured, standalone
Mobile Web keeps the existing local Web Push path. The iframe plugin mode never
registers its own Push subscription.

### Approvals And Server Requests

The mux proxies app-server server requests, including command approvals, file-change approvals, legacy exec/apply-patch approvals, permission-profile requests, request-user-input, and MCP elicitation. Mobile Web renders them in-turn when a turn id is known and answers through the same stream.

### Uploads And Images

Browser-side image compression happens before upload when supported. Uploaded attachments are summarized as local file paths in the text input.

Image uploads are reference-only by default: Mobile Web does not send app-server `localImage` input parts unless `CODEX_MOBILE_IMAGE_CONTEXT_MODE` explicitly opts into `latest`/`vision` or legacy `all`. This is separate from extended-history persistence. Reference-only mode prevents new uploads from becoming `input_image` payloads in app-server current history and compacted `replacement_history` snapshots.

The browser display remains visual: conversation messages parse uploaded image summaries and render saved image paths as centered thumbnails through the authenticated upload preview route. That route must return real image MIME types such as `image/jpeg`, `image/webp`, or `image/png` for saved upload paths so browser `<img>` elements render consistently. This applies to the original user upload and to later Codex/plan replies that quote the same `Uploaded attachments:` block, including CRLF line endings, Markdown blockquote-style quoted summaries, and raw app-server `input_text` / `input_image` / `image_url` content parts. This display path must not be used as a reason to re-enable model `localImage` input by default.

By default, Mobile Web also does not request app-server extended-history persistence for image-upload turns. This reduces repeated historical payload retention for future uploads but cannot remove old images already retained in app-server memory or historical rollout records.

Uploaded files stay under the Mobile Web runtime upload root. Authenticated preview routes must only serve paths under allowed roots. Local-file preview targets may include Codex-style source locations such as `README.md:12`, `README.md:12:3`, or `README.md#L12`; the server strips those location suffixes before extension and root checks so the actual Markdown/text file is previewed. Local preview links render as the linked path text only and must wrap long paths. The preview panel should avoid horizontal dragging by using viewport-bounded width plus wrapped Markdown code/table content. While a preview dialog is open, right-swipe gestures close the preview and must not propagate to the underlying conversation/sidebar navigation.

App-server `imageView` items can point at tool-generated screenshots outside the current workspace, such as `%TEMP%` files created for visual verification. Mobile Web must not add arbitrary temp directories to file-preview roots. Instead, when the server compacts an `imageView` item and the referenced source is an allowed small image, it copies the image into `%USERPROFILE%\.codex-mobile-web\generated-images` (or `CODEX_MOBILE_GENERATED_IMAGE_CACHE_DIR`) and attaches an authenticated `/api/generated-images/file` content URL. The browser prefers that generated-image URL over raw local-file preview paths, so live and reloaded turns can render Codex's own visual-check screenshots without relaxing workspace preview security.

### Rollout Continuation

The preferred continuation endpoint is `POST /api/thread-continuations`. It creates a background job, compacts an oversized workspace handoff if needed, asks the source thread to write a handoff file, creates the new thread, sends a scoped bootstrap message, and returns the new thread id for browser switching.

Continuation bootstraps must include enough context for a fresh thread without injecting unrelated private thread rules. Runtime settings inheritance should come from current rollout `turn_context` and SQLite/app-server metadata where supported.

The bootstrap message is an index plus bounded excerpts. The generated source handoff file under `.agent-context/thread-handoffs/` remains the high-priority full fact source, and the new thread is instructed to read that file instead of relying on a full inline paste.

### PWA Shell Cache And Build Id

`public/sw.js` owns the app-shell cache. Static frontend changes that affect browser behavior must bump both:

- `CLIENT_BUILD_ID` in `public/app.js`
- `SHELL_CACHE_NAME` in `public/sw.js`

The refresh prompt should only reload after the target shell cache is populated. Server-only fixes do not need a shell bump, but open clients may need a normal detail refresh.

### Public PR Prompt

The public PR check is prompt-only. `server.js` checks the configured public GitHub repository for open pull requests through the unauthenticated public API, caches the result briefly, and exposes it through authenticated `/api/public-pull-requests/status`. The browser can prompt whether to prepare a merge/publish review task, but it must not merge, sync, commit, or push the public repository without an explicit user request.

## Invariants

- Shared-stream mode must not silently fall back to a managed app-server child.
- Mux endpoint drift must be detected before using a stale live socket.
- Mobile UI should compact live latest-turn operations and avoid rendering full command outputs, full diffs, or reasoning rows. The latest live-turn operation card uses a compact four-line visual budget: one metadata row plus up to three clipped detail lines. Completed turns should not keep operation cards below the final reply; the Usage summary is the final diagnostic frame when available.
- User-visible mobile input should not disappear on refresh while steering is pending.
- Old operation cards must not be attached to newer live turns.
- PWA and service worker changes require explicit build/cache bumps.
- Public sync requires explicit user approval and README Chinese release notes.
