# HANDOFF

Last compacted: 2026-06-22T08:21:02.101Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
- Original active handoff bytes: `530493`
- Archived full handoff: `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web/.agent-context/archive/context-compaction-20260622_082102/HANDOFF.full-before-context-budget.md`
- Preserved recent active context chars: `16808`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Before changing any latest-version, backup, deployment, or runtime-state fact, verify current repo/runtime state or the latest source-thread handoff; archived old sections are provenance only.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## Preserved Recent Handoff Tail

## 2026-06-21 Per-thread Incremental Rollout Enrichment Index

- Status: implemented, validated, committed, and deployed to Mac production.
- Trigger:
  - Large rollout threads still showed projection/enrichment instability. A
    simple server-side tail increase from 32 MiB to 100 MiB was considered, but
    the chosen implementation is a per-thread incremental rollout index so the
    server does not repeatedly rescan a large suffix just to recover historical
    enrichment.
- Server change:
  - Added `adapters/rollout-enrichment-index-service.js`.
  - `server.js` now creates `rolloutEnrichmentIndexService` and uses
    `readRolloutEnrichmentEntries()` for historical item timestamp candidates,
    tool output image projection, and missing turn usage summaries.
  - The index is keyed by normalized rollout real path. It tracks file offset,
    carry text for incomplete JSONL lines, parsed entries, mtime/size, parse
    error counts, reset count, and last update time.
  - If a rollout grows, the service reads only appended bytes. If the file is
    truncated or rotated, the index resets. Old indexes are pruned by
    `RUNTIME_CONTEXT_CACHE_MAX`.
  - `CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES` remains as a legacy fallback
    only if the incremental index read fails. Normal enrichment is no longer
    bounded by the 32/100 MiB tail window.
- Client behavior:
  - No broader client payload is introduced. Thread detail still projects the
    latest client window; server enrichment can now recover older metadata from
    the per-thread index without sending a huge rollout to the browser.
- Tests and docs:
  - `package.json` `npm run check` now syntax-checks the new adapter.
  - `README.md` documents the legacy role of
    `CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES`.
  - Added `test/rollout-enrichment-index-service.test.js`.
  - Updated `test/tool-output-image-projection.test.js` to prove uploaded
    `view_image` suppression works when the source call is outside the ordinary
    rollout tail but available through the index.
  - Updated `test/turn-usage-summary-service.test.js` to assert the server uses
    the incremental enrichment entry path.
- Validation:
  - `node --check server.js && node --check adapters/rollout-enrichment-index-service.js`
  - `node --test test/rollout-enrichment-index-service.test.js test/tool-output-image-projection.test.js test/turn-usage-summary-service.test.js`
  - `git diff --check`
  - `npm run check`
  - `npm test`
  - Home AI required guard:
    `cd /Users/hermes-dev/HermesMobileDev/app && node tests/architecture-code-test-harness-map.test.js`
  - Real rollout smoke on
    `/Users/xuxin/.codex/sessions/2026/06/08/rollout-2026-06-08T21-28-43-019ea76b-d846-7892-bda0-c0fff9cf7581.jsonl`
    at 140,953,084 bytes:
    first read parsed 59,283 entries in 267 ms; second read was a cache hit in
    0 ms with `bytesRead=0` and `parsedLines=0`.
- Known boundary:
  - The index is in-memory. After a listener/server restart, the first access to
    a large rollout still parses the full file once; subsequent reads only parse
    appended bytes.
- Commit/deploy:
  - Private source commit: `0f99474 feat: add rollout enrichment index`.
  - Local public-safe deployment source commit:
    `38ee0a7 feat: sync rollout enrichment deployment`.
  - Private main merged the local public-safe deployment source with
    `e3a64f8 merge: sync public deployment source` so the private branch keeps
    the public-source commit in its ancestry.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260621T110719Z-plugin-codex-mobile-web-rollout-index-38ee0a7.tar.gz`.
  - Deploy path used a direct local equivalent of `scripts/deploy-macos-plugin.ps1`
    because no PowerShell runtime was available in the current Mac process:
    public-safe git archive, blocked-path check, staging checks, target backup,
    target sync preserving runtime directories, target checks, one
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`, then
    loopback smoke.
  - Post-restart smoke:
    `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v366`,
    `shellCacheName=codex-mobile-shell-v366`, `platform=darwin`,
    `authRequired=true`; target file
    `adapters/rollout-enrichment-index-service.js` exists.

## 2026-06-21 Thread Open Latency Diagnosis And v367 Deploy

- Status: diagnosed, patched, committed, and deployed to Mac production as
  `codex-mobile-shell-v367`.
- User report:
  - Opening a thread felt slower after the per-thread rollout enrichment index
    deployment. The user also noted the current device might be on 5G, not home
    Wi-Fi.
- Production evidence:
  - Local loopback `/api/threads/<threadId>` timing after restart showed cold
    calls can be slower, then hot calls become fast:
    - `codex mobile`: `2.635s`, then `0.499s`, `0.503s`.
    - `Music`: `0.359s`, then `0.096s`, `0.093s`.
    - `Home AI 06-18`: `1.031s`, then `0.187s`, `0.111s`.
  - Local loopback thread list timings showed the bigger contention source:
    `/api/threads?limit=40&archived=false` was `2.458s` cold and
    `0.602s` / `0.494s` hot, while
    `/api/threads?limit=40&archived=false&fallback=defer` was
    `0.226s`, `0.187s`, `0.169s`.
  - Runtime logs showed full thread-list fallback repeatedly taking around
    `2.2s-2.6s`, with `fallbackRolloutMs` around `1.2s-1.4s`, while thread
    detail projection hits were usually `80ms-260ms`. Client first-paint events
    on iPhone still reported `2s-3.4s` when these operations overlapped.
- Root cause assessment:
  - Network/5G latency can amplify the visible delay, but origin-side work is
    also significant.
  - The per-thread enrichment index is not the only cost. The slower visible
    path is often an overlapping silent thread-list full fallback refresh that
    scans state DB / recent rollout files while the thread detail first paint is
    also loading.
  - `THREAD_LIST_FALLBACK_CACHE_TTL_MS` was only `5000`, so active use could
    miss cache frequently.
- Patch:
  - `server.js`: default `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS`
    changed from `5000` to `30000`.
  - `public/app.js`: silent thread-list refreshes that happen while a thread
    detail is still opening now request `fallback=defer`, avoiding the expensive
    fallback scan on the critical first-paint path. The startup deferred-list
    follow-up still explicitly runs a full fallback refresh with
    `deferFallback:false`.
  - `README.md`: documented
    `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` and the silent refresh
    defer behavior.
  - `test/mobile-viewport.test.js`: updated static assertions for the new
    defer behavior.
  - `public/app.js` and `public/sw.js`: client shell cache advanced to
    `codex-mobile-shell-v367`.
- Validation:
  - `node --test test/mobile-viewport.test.js test/thread-visibility.test.js`
  - `node --check server.js && node --check public/app.js`
  - `git diff --check`
  - `npm run check`
  - `node --test test/mobile-viewport.test.js test/thread-visibility.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js`
    in both source/public mirror and production target.
- Commit/deploy:
  - Private source commit:
    `f345e5a fix: defer list fallback during thread open`.
  - Local public-safe deployment source commit:
    `079e51f release: publish v367 thread load fix`.
  - Private main merged the local public-safe deployment source with
    `merge: sync public v367 deployment source`.
  - Production target:
    `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup:
    `/Users/hermes-host/HermesMobile/backups/deploy/20260621T111936Z-plugin-codex-mobile-web-v367-thread-load-079e51f.tar.gz`.
  - Production smoke after one
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`:
    `/api/public-config` returned `clientBuildId=0.1.11|codex-mobile-shell-v367`
    and `shellCacheName=codex-mobile-shell-v367`.
  - Post-deploy loopback timing:
    `fallback=defer` list calls were about `0.206s`, `0.213s`, `0.360s`;
    full list remained `2.399s` cold and `0.445s` / `0.421s` hot. This confirms
    the fix reduces contention during thread first paint; it does not remove
    the full fallback scan path.

## 2026-06-22 Codex Mobile MCP Toolset Registration

- Status: implemented, deployed to Mac production, and smoke-tested through the
  Android thread.
- User requirement:
  - Codex Mobile cross-workspace delegation must be available as a real Codex
    toolset, not only a model-instruction fallback.
  - Registration must be dynamic and per Profile/Codex Home. If a new Profile
    or Codex Home lacks the toolset, Mobile Web should register it as part of a
    fixed flow.
- Patch:
  - Added `adapters/codex-mobile-mcp-config-service.js`.
    - Registers or repairs `[mcp_servers.codex_mobile]` in each target
      `CODEX_HOME/config.toml`.
    - Stores only command, script path, server URL, and key-file path. It does
      not store raw keys.
    - Writes tool-level `approval_mode = "approve"` for both tools so Codex's
      MCP elicitation layer does not add an extra approval dialog.
  - Added `scripts/codex-mobile-mcp-server.js`.
    - Stdio MCP server named `codex_mobile`.
    - Exposes `list_threads` and `delegate_to_thread`.
    - Calls the authenticated local Codex Mobile HTTP APIs and reads the access
      key from env or the configured key file.
    - Tool list includes MCP annotations: `list_threads` is read-only;
      `delegate_to_thread` is non-destructive but state-changing, with final
      source-direct approval still gated by Mobile Web runtime settings.
  - Updated `server.js`.
    - `syncCodexMobileMcpToolset()` registers a single Codex Home.
    - `syncKnownCodexMobileMcpToolsets()` enumerates all known Profiles and
      registers every existing Codex Home.
    - Registration now runs on startup, `/api/public-config`, `/api/codex-profiles`,
      workspace creation, and target Profile switch before preflight.
  - Updated docs: `README.md`,
    `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`, `docs/ARCHITECTURE.md`,
    and `docs/MODULES.md`.
- Validation:
  - `node --check scripts/codex-mobile-mcp-server.js`
  - `node --check adapters/codex-mobile-mcp-config-service.js`
  - `node --test test/codex-mobile-mcp-server.test.js test/manual-restart-ui.test.js`
  - `npm run check`
  - `git diff --check`
  - Central checks:
    `node tests/plugin-workspace-platform-contract-check.test.js`,
    `node tests/plugin-capability-activation-service.test.js`,
    `node tests/hermes-plugin-service.test.js`,
    `node tests/hermes-plugin-authorization-service.test.js`.
- Production deploys:
  - `codex-mobile-mcp-known-profile-registration`
  - `codex-mobile-mcp-auto-approval-registration`
  - `codex-mobile-mcp-approve-tool-registration`
  - All deploys used the Mac production plugin deploy harness and passed
    health, LaunchDaemon, and auth-profile audit validation.
- Production readback:
  - `/api/status`: `ready=true`, transport `external-jsonl-tcp`,
    persistent owned mux enabled, active Codex Home
    `/Users/xuxin/.codex-homes/previous`.
  - After `/api/public-config`, all known Profiles had
    `[mcp_servers.codex_mobile]`:
    `/Users/xuxin/.codex`, `/Users/xuxin/.codex-homes/current`,
    `/Users/xuxin/.codex-homes/previous`.
  - Each `codex_mobile` section had two `approval_mode = "approve"` tool
    entries.
- Runtime reload:
  - Restarting only the 8787 listener did not reload MCP approval config because
    persistent Mobile-owned mux/app-server stayed alive.
  - A controlled mux/app-server reload was performed by terminating the
    Mobile-owned mux parent and letting the listener recreate it.
  - Final active chain:
    listener PID `14345`, mux PID `24765`, app-server PID `24766`, endpoint
    port `59607`, `/api/status` ready.
- Final smoke:
  - Sent a direct diagnostic card to Android:
    `ttc_4135a9e8eb6568c404`,
    target turn `019eed27-fd7b-76c0-a0fb-84db43849b78`.
  - Android confirmed `mcp__codex_mobile.list_threads` is visible.
  - `list_threads` with limit 3 returned directly, without
    `mcpServer/elicitation/request` and without waiting for MCP approval.
- Important boundary:
  - Running app-server processes do not appear to hot-reload MCP approval
    config. If the config is changed again, reload the Mobile-owned mux/app-server
    once before testing tool approval behavior.

## 2026-06-22 Workspace Delegation Source Write Guard Hardening

- Status: implemented locally and validated; deployment/commit may follow this
  handoff entry.
- User issue:
  - With `跨工作区委派` enabled, the Music workspace thread was still able to
    modify, commit, and deploy Home AI source files, then send a task card after
    the fact.
  - Official Home AI-provided tools should remain callable, but direct
    cross-workspace source edits must be blocked.
- Root cause:
  - The previous compatibility runtime defaulted delegated plugin turns to
    `danger-full-access` plus an approval proxy. Direct tools such as
    `apply_patch` or shell commands do not necessarily raise app-server approval
    requests, so the proxy could not block them.
  - Server approval classification also treated explicit command `params.cwd`
    as the source workspace before resolving the source thread/turn cwd. A
    plugin thread could therefore set command cwd to Home AI and make Home AI
    appear to be the current workspace for guard decisions.
- Patch:
  - `server.js`
    - Default workspace-delegation runtime now uses real
      `workspace-write` / managed profile plus `approvalPolicy:"on-request"`.
    - Old `danger-full-access` approval-proxy-only behavior is only available
      through explicit `CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY=1`.
    - App-server approval guard remains active in real sandbox mode.
    - Source cwd resolution now prefers thread/turn ownership; command cwd is
      only a fallback when no source thread cwd is known.
  - `adapters/workspace-source-write-guard-service.js`
    - Adds a narrow Home AI official-tool allowlist:
      `scripts/ai-ops-control-plane.js`,
      `scripts/deploy-macos-production.js`,
      `scripts/plugin-workspace-platform-contract-check.js`,
      `tests/architecture-code-test-harness-map.test.js`,
      `npm run deploy:macos`, and `npm run ios:pwa:visual`.
    - Shell-chained commands are not trusted.
    - Direct `apply_patch`, file-change approvals, `git add/commit`, write-like
      commands, and write-like file-system grants against another source root
      are denied.
  - Tests/docs updated:
    - `test/workspace-source-write-guard-service.test.js`
    - `test/new-thread-route.test.js`
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
- Validation:
  - `node --test test/workspace-source-write-guard-service.test.js test/new-thread-route.test.js test/thread-task-card-route.test.js test/protocol.test.js test/codex-profile-service.test.js`
  - `npm run check`
  - `git diff --check`
  - Center architecture harness:
    `cd /Users/hermes-dev/HermesMobileDev/app && node tests/architecture-code-test-harness-map.test.js`
  - Evidence ledger:
    `/Users/xuxin/.homeai-qa/codex-mobile-web-evidence-ledger.jsonl`
    record `evidence-435833f2-c22f-4550-8564-cbf91e890093`.
- Operational note:
  - Existing active turns keep the sandbox they were started with. New
    thread/start, thread/resume, and turn/start requests pick up the hardened
    runtime.

### Follow-up smoke finding

- A source-direct test card was sent to idle `Note`
  (`019ea7f4-223e-7c12-a389-4efb75df8ec5`), target turn
  `019eee26-7f24-7bb3-87ec-76f5efad22c1`.
- Result before the follow-up patch:
  - Foreign Home AI source write was denied and left no test file.
  - Home AI AI Ops intake command was allowed.
  - Current workspace `.git` write still failed under the ordinary sandbox and
    only succeeded after escalation.
- Follow-up patch:
  - `workspaceDelegationWriteGuardSandboxPolicy()` now explicitly adds each
    current writable root's `.git` directory to `sandboxPolicy.writableRoots`,
    because the app-server sandbox can reject git metadata writes before the
    managed permission profile is consulted.
  - Added `test/new-thread-route.test.js` guard assertions for explicit `.git`
    writable roots.
- Required post-deploy validation:
  - Send another source-direct test card to an idle thread and confirm ordinary
    `.git` temp write succeeds without escalation, foreign source write is
    denied, and Home AI official tool invocation still works.

## 2026-06-22 Dynamic Delegation Duplicate Task Cards

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- User issue:
  - The 星盘 06-22 source thread delegated a Moira/Home AI task and ended up
    creating three task cards for the same work.
  - The visible thread transcript showed two
    `codex_mobile.delegate_to_thread` attempts returning "dynamic tool response
    was invalid", followed by the documented fallback script path.
- Evidence:
  - Task-card store contained three approved cards for the same semantic task:
    two from the app-server dynamic tool path and one from the fallback script.
  - The 星盘 rollout recorded both dynamic tool calls as
    `function_call_output` text `"dynamic tool response was invalid"`, even
    though the cards had already been created.
- Root cause:
  - `dynamicToolTextResponse()` returned
    `result.contentItems[{ type:"inputText" }]`, which the current Codex
    app-server treated as an invalid dynamic tool response.
  - The dynamic tool body also copied `params.callId` into `requestId`; because
    call ids change on every retry, the existing task-card idempotency key could
    not collapse identical retry calls.
- Patch:
  - `server.js`
    - Dynamic tool responses now use `result.content[{ type:"text" }]`.
    - Dynamic tool requests no longer use volatile `callId` as the default
      request id.
    - Task-card idempotency now uses explicit `requestId` when supplied,
      otherwise source/target/title/body/workflow semantics. It no longer uses
      `sourceTurnId` / `turnId` as the request id seed.
  - `test/protocol.test.js`
    - Added a schema assertion for dynamic tool text responses and a guard
      against `contentItems` / `inputText`.
  - `test/thread-task-card-route.test.js`
    - Added structural guards for dynamic tool response schema and semantic
      retry idempotency.
  - Docs:
    - `README.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - `node --test test/protocol.test.js test/thread-task-card-route.test.js`
  - `node --test test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
  - `npm run check`
  - `git diff --check`
  - `npm test` (`601` tests passed)
- Public/private sync:
  - Public commit:
    `4e243b6 fix: publish dynamic task card tool response`.
  - Private main merged `public/main` with:
    `c54a257 merge: sync public dynamic task card response`.
  - Public release included only publishable source/docs/tests:
    `README.md`, `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`,
    `server.js`, `test/protocol.test.js`, and
    `test/thread-task-card-route.test.js`.
  - Public path scan rejected `.agent-context`, runtime state, uploads, logs,
    local keys, auth files, and secret-like paths.
- Production deploy:
  - Source archive: public mirror commit `4e243b6`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-4e243b6-20260622T100719Z.backup.tar.gz`.
  - Deployment used the local equivalent of `scripts/deploy-macos-plugin.ps1`
    because `pwsh` was not available in the current Mac shell: git archive,
    blocked-path check, staging checks, target backup, rsync preserving runtime
    dirs, target checks, `launchctl kickstart -k
    system/com.hermesmobile.plugin.codex-mobile`, then loopback smoke.
  - Target checks:
    `npm run check`, `npm run check:macos`, and focused dynamic
    task-card/thread-card tests passed in the production target.
  - Post-restart smoke:
    `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v373`,
    `shellCacheName=codex-mobile-shell-v373`, `platform=darwin`,
    and `authRequired=true`.
  - Authenticated `/api/status` returned `ready=true`,
    `lastError=null`, and active profile `default`.
  - Production `dynamicToolTextResponse("ok")` returned
    `{"result":{"content":[{"type":"text","text":"ok"}]}}`.
  - Production `server.js` matched the public mirror copy after deploy, and
    LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` was running with
    a new PID.
- Operational note:
  - Existing already-approved duplicate cards/messages were not removed.
  - Existing active turns that already loaded old runtime instructions are not
    retroactively changed; new start/resume/turn requests use the deployed
    response schema and semantic retry idempotency.
