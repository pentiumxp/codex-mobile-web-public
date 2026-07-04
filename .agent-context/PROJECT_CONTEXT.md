# PROJECT_CONTEXT

Last compacted: 2026-07-04T08:32:24.763Z

This live project context was automatically compacted before a Codex Mobile continuation.
The full previous context was archived and should be read only when this routing index is insufficient.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original project context bytes: `17913`
- Archived full project context: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260704_083224/PROJECT_CONTEXT.full-before-context-budget.md`
- Preserved live excerpt chars: `17912`

## Source Of Truth

1. Current repository files and runtime checks.
2. Latest source-thread handoff under `.agent-context/thread-handoffs/` for explicit continuation threads.
3. This compact `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.
4. Focused docs under `docs/`.
5. Archived full context only when old provenance is explicitly needed.

## Startup Guidance

- Read `.agent-context/HANDOFF.md` after this file.
- Read `docs/README.md`, then the smallest relevant focused doc.
- Keep raw secrets, tokens, one-time approvals, upload contents, full rollout logs, and `.codex` runtime state out of shared context and Git.
- Do not load the archived full project context by default. Load it only when the user asks about older provenance, a missing rule, or a historical decision not present in live docs.

## Preserved Project Context Excerpt

# PROJECT_CONTEXT

Last compacted: 2026-06-30T03:44:00.549Z

This live project context was automatically compacted before a Codex Mobile continuation.
The full previous context was archived and should be read only when this routing index is insufficient.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original project context bytes: `15066`
- Archived full project context: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260630_034400/PROJECT_CONTEXT.full-before-context-budget.md`
- Preserved live excerpt chars: `15065`

## Source Of Truth

1. Current repository files and runtime checks.
2. Latest source-thread handoff under `.agent-context/thread-handoffs/` for explicit continuation threads.
3. This compact `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.
4. Focused docs under `docs/`.
5. Archived full context only when old provenance is explicitly needed.

## Startup Guidance

- Read `.agent-context/HANDOFF.md` after this file.
- Read `docs/README.md`, then the smallest relevant focused doc.
- Keep raw secrets, tokens, one-time approvals, upload contents, full rollout logs, and `.codex` runtime state out of shared context and Git.
- Do not load the archived full project context by default. Load it only when the user asks about older provenance, a missing rule, or a historical decision not present in live docs.

## Preserved Project Context Excerpt

# PROJECT_CONTEXT

Last compacted: 2026-06-22T08:21:02.101Z

This live project context was automatically compacted before a Codex Mobile continuation.
The full previous context was archived and should be read only when this routing index is insufficient.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original project context bytes: `11503`
- Archived full project context: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260622_082102/PROJECT_CONTEXT.full-before-context-budget.md`
- Preserved live excerpt chars: `11502`

## Source Of Truth

1. Current repository files and runtime checks.
2. Latest source-thread handoff under `.agent-context/thread-handoffs/` for explicit continuation threads.
3. This compact `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.
4. Focused docs under `docs/`.
5. Archived full context only when old provenance is explicitly needed.

## Startup Guidance

- Read `.agent-context/HANDOFF.md` after this file.
- Read `docs/README.md`, then the smallest relevant focused doc.
- Keep raw secrets, tokens, one-time approvals, upload contents, full rollout logs, and `.codex` runtime state out of shared context and Git.
- Do not load the archived full project context by default. Load it only when the user asks about older provenance, a missing rule, or a historical decision not present in live docs.

## Release Order Rule

- Future release flow: implement and validate in the local/private workspace, then deploy to Mac production first. Push or sync the public repository only after production/user testing is confirmed.
- Before production/user validation, at most create a local/private commit. Do not push public preemptively.
- If a public push already happened before this rule was recorded, document that fact in `.agent-context/HANDOFF.md` and follow this rule going forward.
- For Codex Mobile Web deploys that touch static client, split frontend
  runtimes, or large architecture boundaries, API/listener `200` is not enough
  for release closure. Run the read-only startup gate after deploy:
  `node scripts/codex-mobile-runtime-self-check-loop.js --server http://127.0.0.1:8787 --gate-mode deploy --browser-mode full --browser-startup-only --skip-api --skip-client-events --json`.
  It must prove the listener, static shell, split runtime assets, and real
  browser startup path are healthy before calling the deploy complete.

## Codex Mobile Reliability Rule

- Codex Mobile is a primary coding tool. Problems in Codex Mobile itself must be solved at the root cause and architecture boundary before release.
- Do not add fallback layers that merely mask projection, synchronization, state ownership, routing, or runtime-contract defects while leaving the underlying inconsistency in place.
- Any temporary diagnostic workaround must be explicitly scoped, documented, and removed or replaced by the architectural fix before production/public release.

## Home AI Root-Cause And Fallback Governance Contracts

- For plugin bugfix, deploy, MCP, schema, provisioning, and platform-boundary work, follow the central Home AI root-cause architecture contract at `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`.
- For any new or extended fallback behavior, follow `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/fallback-governance-contract.md` and register active mitigation in `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/fallback-registry.md`.
- Treat those Home AI files as canonical contracts and reference them directly; do not copy the full contracts or registry into this plugin workspace.
- Before non-trivial fixes, identify the symptom, failing layer, owning workspace, violated invariant, root cause or strongest hypothesis, mitigation versus closure classification, and closure validation. Fallbacks must be bounded, observable, temporary, validated, owner-assigned, and either removed or centrally registered.

## Preserved Project Context Excerpt

# PROJECT_CONTEXT

Last compacted: 2026-06-08T13:27:43.304Z

This live project context was automatically compacted before a Codex Mobile continuation.
The full previous context was archived and should be read only when this routing index is insufficient.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original project context bytes: `9409`
- Archived full project context: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260608_132743/PROJECT_CONTEXT.full-before-context-budget.md`
- Preserved live excerpt chars: `9408`

## Source Of Truth

1. Current repository files and runtime checks.
2. Latest source-thread handoff under `.agent-context/thread-handoffs/` for explicit continuation threads.
3. This compact `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.
4. Focused docs under `docs/`.
5. Archived full context only when old provenance is explicitly needed.

## Startup Guidance

- Read `.agent-context/HANDOFF.md` after this file.
- Read `docs/README.md`, then the smallest relevant focused doc.
- Keep raw secrets, tokens, one-time approvals, upload contents, full rollout logs, and `.codex` runtime state out of shared context and Git.
- Do not load the archived full project context by default. Load it only when the user asks about older provenance, a missing rule, or a historical decision not present in live docs.

## Public / Private Repository Rule

- `public/main` is the canonical public source history for publishable files.
- The local/private `main` branch should be derived back from `public/main`,
  then add private-only tracked context such as `.agent-context/*`.
- Do not publish by creating a separate equivalent public commit from private
  and leaving local/private `main` diverged from `public/main`.
- After public publishing, verify `git merge-base --is-ancestor public/main main`
  succeeds and `git diff --stat public/main..main -- ':!.agent-context'` is
  empty unless there is intentional private-only non-context material.

## Preserved Project Context Excerpt

# PROJECT_CONTEXT

Last compacted: 2026-06-03T07:41:47.778Z

This live project context was automatically compacted before a Codex Mobile continuation.
The full previous context was archived and should be read only when this routing index is insufficient.

## Compaction Summary

- Workspace: `C:\Users\xuxin\Documents\codex-mobile-web`
- Original project context bytes: `77214`
- Archived full project context: `C:\Users\xuxin\Documents\codex-mobile-web\.agent-context\archive\context-compaction-20260603_074147\PROJECT_CONTEXT.full-before-context-budget.md`
- Preserved live excerpt chars: `7943`

## Source Of Truth

1. Current repository files and runtime checks.
2. Latest source-thread handoff under `.agent-context/thread-handoffs/` for explicit continuation threads.
3. This compact `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.
4. Focused docs under `docs/`.
5. Archived full context only when old provenance is explicitly needed.

## Startup Guidance

- Read `.agent-context/HANDOFF.md` after this file.
- Read `docs/README.md`, then the smallest relevant focused doc.
- Keep raw secrets, tokens, one-time approvals, upload contents, full rollout logs, and `.codex` runtime state out of shared context and Git.
- Do not load the archived full project context by default. Load it only when the user asks about older provenance, a missing rule, or a historical decision not present in live docs.

## Preserved Project Context Excerpt

# PROJECT_CONTEXT

## Project

This workspace owns the standalone Codex Mobile Web app.

- Workspace path: `C:\Users\xuxin\Documents\codex-mobile-web`
- App source root: this repository root
- Public UI: `public/`
- Main server: `server.js`
- Startup script: `start-codex-mobile-web.ps1`
- Windows hidden startup scripts: `start-codex-mobile-web-hidden.vbs`, `start-codex-mobile-web-windowless.ps1`, `install-codex-mobile-web-startup.ps1`, `uninstall-codex-mobile-web-startup.ps1`
- Optio

...(archived middle omitted; read the archive path above when older details are needed)...

## Hermes Mobile Plugin

- Current Hermes integration is an independent embedded-app plugin. Do not diagnose it through any worker queue, collaboration queue, or polling worker path.
- Codex Mobile Web is now exposed as an independent Hermes Mobile `embedded_app` plugin through:
  - `GET /api/v1/hermes/plugin/manifest`
  - `POST /api/v1/hermes/plugin/workspaces`
  - `POST /api/v1/hermes/plugin/callbacks`
  - `POST /api/v1/hermes/plugin/origins`
  - `POST /api/v1/hermes/plugin/launch`
  - `POST /api/v1/hermes/plugin/session`
  - `POST /api/v1/hermes/plugin/notifications`
- Plugin registration and launch require the Codex Mobile Access Key (`Authorization: Bearer <key>` or `X-Codex-Mobile-Key`). Hermes owner auth is not a substitute.
- The manifest is metadata-only and must not expose Access Keys, launch tokens, callback secrets, local secret/config paths, DB paths, upload paths, or private content dumps.
- Hermes callback URLs and iframe origins may be HTTPS domains. Registration state is stored under `%USERPROFILE%\.codex-mobile-web\hermes-plugin-registration.json` by default, or `CODEX_MOBILE_HERMES_PLUGIN_REGISTRATION_FILE` when overridden. It stores workspace id, callback URL, app origin, label, and timestamps only.
- Hermes iframe origins come from `POST /api/v1/hermes/plugin/origins` or `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS`; Codex uses them for CSP `frame-ancestors` and must not hard-code a personal Hermes domain.
- If Codex Mobile is externally served through HTTPS, set `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or `CODEX_MOBILE_PUBLIC_BASE_URL` so the manifest advertises the HTTPS plugin entry URL. On Windows, prefer persisting this through `install-codex-mobile-web-startup.ps1 -HermesPluginBaseUrl <https-codex-origin>` so the hidden scheduled task does not regress to `http://127.0.0.1:8787` after restart.
- HTTPS Hermes cannot embed an HTTP Codex entry. The manifest should report this as a mixed-content diagnostic; fix deployment URL/TLS config rather than weakening browser security.
- Launch returns a short-lived `codexPluginLaunch` iframe entry path. The browser exchanges it through `/api/v1/hermes/plugin/session`, scrubs the one-time URL, and keeps only an in-memory plugin session. The long-lived Access Key must not be placed in the iframe URL, stored in `localStorage`, or stored in plugin registration state.
- Launch/session can carry bounded appearance sync metadata. `adapters/hermes-plugin-service.js` accepts `appearance.theme` and `appearance.fontSize`, keeps only whitelisted values, copies them to `pluginTheme` / `pluginFontSize` in the short `entry_path`, and returns the same sanitized `appearance` object from `/session`. The manifest advertises this through `appearance_sync`; frontend tests should cover the no-flash early application path.
- `/?embed=hermes` hides standalone chrome/login splash, preserves iframe state across visibility/focus changes without forced reload checks, posts `{ type: "codex-mobile.plugin.navigation", version: 1, canGoBack, route }`, handles `{ type: "hermes.plugin.back", version: 1 }` through iframe-owned navigation/transient layers, and blocks `window.open`, `target=_blank`, external browser handoffs, and second-window launches. The embedded thread-switcher/settings surface is the plugin primary page and reports `canGoBack=false`, so Hermes Mobile can show its bottom navigation tabs. Thread detail and new-thread composer routes are secondary pages and report `canGoBack=true`; Codex handles secondary-page back by returning to the primary thread-switcher/settings page, not by showing the standalone first-launch Workspace page or opening an iframe sidebar drawer. On startup, embed mode only opens an explicit launch target, URL thread hint, or bounded Hermes route hint; otherwise it stays on the primary page rather than restoring the local recent thread. Hermes must consume the postMessage contract and must not inspect Codex DOM or call internal Codex route functions.
- Hermes notification opens may include bounded iframe query hints such as `pluginId=codex-mobile`, `pluginRoute`, `pluginThreadId`, `pluginTaskId`, and `pluginItemId`. In `/?embed=hermes`, Codex consumes those hints inside the iframe, opens the matching thread when available, focuses the matching approval/item card when still present, scrubs the URL back to the embed root, and falls back to the normal embedded primary page with a bounded in-app diagnostic if the target is missing.
- Plugin notifications use a backend-only Hermes Action Inbox delegate. `adapters/hermes-notification-delegate-service.js` sends safe events to Hermes `POST /api/hermes-plugins/codex-mobile/notifications` with a server-side `X-Hermes-Web-Key`; the iframe, manifest, launch URL, and plugin session must never receive that key. Configure it with `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL`, `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY`, `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE`, or the `CODEX_MOBILE_HERMES_WEB_KEY` / `CODEX_MOBILE_HERMES_WEB_KEY_FILE` fallbacks. Payloads require stable `eventId` or `sourceId`, bounded summary fields, allowed item type/priority, and small route metadata only.
- Completed-turn Hermes plugin notifications are now split into two layers: short preview `title + summary` for Web Push / Inbox preview, and an optional bounded Markdown `detailMessage` containing the final assistant receipt plus Usage summary for Hermes thread-message storage. Standalone Mobile Web Push stays on the old short-preview format.
- Cross-thread collaboration planning now has dedicated docs at `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`, `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`, and `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`. The intended design is a pending task-card surface outside normal message flow; only explicit target-side approval may inject a real target-thread message.
- In `/?embed=hermes`, Codex Mobile disables browser Push registration and local completion alerts. When the Hermes notification delegate is configured, turn-completed notifications go to Hermes Inbox/Web Push; when it is not configured, standalone Mobile Web keeps the existing local Web Push fallback.

## Safety

- Do not patch the WindowsApps Codex installation.
- Do not replace Codex Desktop's startup command unless explicitly requested and tested through a reversible path.
- Prefer the reversible `start-codex-desktop-shared.ps1` launcher over persistent system environment changes for Desktop/Web live sync.
- Keep `.codex` state read-only except through app-server RPCs.
- Keep raw access keys out of Git and out of `.agent-context`.

## Vite App-Preview Migration Boundary

- Do not treat app-preview zero classic loader as a valid target until the large
  classic runtime files have explicit module contracts.
- Current classic runtime files still share script-global lexical state. Loading
  them as Vite modules can isolate state into module scope and break cross-file
  initialization, including thread-detail startup.
- The safe migration path is to exclude only proven independent ESM-owned
  modules from the app-preview classic loader and keep the remaining classic
  scripts in original manifest order.
- As of the 2026-07-02 dev validation, the stable app-preview ESM exclusion set
  was 13 modules; `app-bootstrap.js` must still run through the classic loader
  even if it remains visible in the Vite build graph.
## HANES Context Loading

- Use .agent-context/HANES_CONTEXT_LOADING.md for cross-workspace context loading discipline. Keep startup context short; load detailed skills, docs, handoffs, archives, and harness matrices only when the current task crosses that risk boundary.
## Workspace Bootstrap Read First

- Use .agent-context/WORKSPACE_BOOTSTRAP_READ_FIRST.md for cross-workspace startup discipline. Confirm the intended workspace, read bounded .agent-context/PROJECT_CONTEXT.md and .agent-context/HANDOFF.md before substantive work, honor continuation read-only mode, and combine this with .agent-context/HANES_CONTEXT_LOADING.md to avoid loading full historical context unless needed.
