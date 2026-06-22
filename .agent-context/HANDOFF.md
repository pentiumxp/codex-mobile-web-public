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

### Follow-up schema correction

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- Evidence from the Home AI source thread:
  - At `2026-06-22T10:28:17Z`, Home AI called
    `codex_mobile.delegate_to_thread` for Moira and the task card was created.
  - The app-server returned `dynamic tool response was invalid`, so the source
    model used the documented fallback script and created a second card for the
    same Moira work.
  - Both cards targeted old Moira thread
    `019ec3c0-86d2-7852-a9ea-e4c703262cdc`, not current visible
    `星盘 06-22` / `019eee78-681b-7db0-b314-aafc85f624cd`.
  - The old Moira rollout did run. Turn
    `019eeedf-bcb3-75a1-a9ee-8920aaa4013a` completed at
    `2026-06-22T10:33:59Z` and deployed Moira `0.2.385`.
- Root cause update:
  - The earlier follow-up changed dynamic tool responses to
    `result.content[{ type:"text" }]`, but the current app-server still treats
    that MCP-style response shape as invalid for dynamic tools.
  - Current evidence from app-server dynamic-tool event naming indicates the
    accepted response is snake_case dynamic-tool output:
    `result.content_items[{ type:"input_text" }]`.
- Patch:
  - `server.js`
    - `dynamicToolTextResponse()` now returns
      `result.content_items[{ type:"input_text" }]`.
  - `test/protocol.test.js`
    - Asserts the snake_case schema and rejects `contentItems`, `inputText`,
      `"content":`, and `"type":"text"`.
  - `test/thread-task-card-route.test.js`
    - Structural guard updated to require `content_items` / `input_text` and
      reject the two previous invalid shapes.
  - Docs:
    - `README.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - Private workspace:
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js`
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
    - `npm run check`
    - `npm test` (`601` tests passed)
    - `git diff --check`
  - Public mirror:
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
    - `npm run check`
    - `git diff --check`
    - Public path scan passed for the five publishable files only.
- Public/private sync:
  - Public commit:
    `f6e7c7b fix: align dynamic tool response schema`.
  - Private main merged `public/main` with:
    `c4d8616 Merge remote-tracking branch 'public/main'`.
  - Private main pushed to origin.
- Production deploy:
  - Source archive: public mirror commit `f6e7c7b`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-f6e7c7b-20260622T104039Z.backup.tar.gz`.
  - Stage syntax checks passed. Focused tests in pure git archive could not run
    because archive excludes `node_modules`; the same tests passed in the public
    mirror and in the production target after sync.
  - Target checks:
    `npm run check`, `npm run check:macos`, and focused dynamic
    task-card/thread-card tests passed in the production target.
  - Production `dynamicToolTextResponse("ok")` returned
    `{"result":{"content_items":[{"type":"input_text","text":"ok"}]}}`.
  - Post-restart smoke:
    `/api/public-config` returned `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v373`,
    `shellCacheName=codex-mobile-shell-v373`, `platform=darwin`,
    and `authRequired=true`.
  - Authenticated `/api/status` returned `ready=true`, `lastError=null`,
    `codexProfileActiveId=default`, and `codexHomeSource=profile-store`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running with
    PID `74321` after restart.
- Operational note:
  - Existing duplicate cards were not removed.
  - The old hidden/not-listable Moira thread completed the delegated work; the
    current visible `星盘 06-22` thread did not receive those Home AI cards.
  - New dynamic delegation calls should no longer report invalid solely because
    of the response schema.

### Strict task-card target resolver

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- Problem addressed:
  - Source-thread direct task-card creation accepted stale target thread ids
    from older rollout state or fallback scripts.
  - If a source model had an old visible-hints snapshot, it could send cards to
    an old hidden/not-current thread for the same cwd.
- Patch:
  - `server.js`
    - Source-thread task-card target resolution now uses the current visible
      non-archived, non-subagent thread list.
    - For a cwd with multiple visible/history candidates, only the latest
      visible canonical thread for that cwd is accepted.
    - Exact ids from stale state, old rollout fallback, hidden threads, archived
      threads, or non-detail-readable threads are rejected instead of falling
      through as raw target ids.
    - Rejections return structured codes:
      `stale_target_thread` (`409`) or `target_thread_not_visible` (`404`),
      with bounded `details.currentTarget` when available.
    - Dynamic tool hints now list only canonical visible targets per cwd.
    - Dynamic-tool and fallback-script error paths preserve `code` and
      `details`, so fallback callers can switch to the current target instead
      of blindly retrying the stale id.
  - `scripts/create-thread-task-card.js`
    - Usage now documents that target ids/titles must be current visible
      targets.
  - Tests:
    - `test/protocol.test.js`
    - `test/thread-task-card-route.test.js`
  - Docs:
    - `README.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `npm run check`
    - `node --test test/protocol.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/new-thread-route.test.js test/codex-mobile-mcp-server.test.js`
    - `git diff --check`
  - Public mirror:
    - `npm run check`
    - Same 61-test focused suite passed.
    - `npm test` passed (`602` tests).
    - `git diff --check`
    - New-change scan confirmed the regression test uses synthetic paths and
      synthetic UUID-like thread ids, not the incident's real local ids/paths.
- Public/private sync:
  - Public commit:
    `19963af fix: reject stale task card targets`.
  - Private main merged `public/main` with:
    `53c003c Merge remote-tracking branch 'public/main'`.
  - Public and private main were pushed.
  - Excluding `.agent-context`, `public/main..main` has no source diff.
- Production deploy:
  - Source archive: public mirror commit `19963af`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-19963af-20260622_190326.backup.tar.gz`.
  - Staging checks passed:
    `npm run check`, `npm run check:macos`, and blocked-path scan.
  - Target checks passed after sync:
    `npm run check`, `npm run check:macos`, and the same 61-test focused
    suite.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    `/api/public-config` returned HTTP `200`, `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v373`, and
    `authRequired=true`.
  - Authenticated `/api/status` returned HTTP `200`.
  - A no-side-effect production POST to the source-thread task-card route with
    a synthetic invisible target returned `404 target_thread_not_visible` with
    details, confirming the deployed guard is active before card persistence.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running after
    restart.
- Operational note:
  - This prevents new wrong-card sends through the source-thread direct path
    used by the dynamic tool and fallback script.
  - It does not delete the three duplicate cards that already existed before
    this deploy.
  - Manual pending-card APIs remain unchanged; the strict resolver applies to
    source-thread direct task-card creation.

### Usage card initial-open backfill

- Status: public-synced, merged back into private main, deployed to Mac
  production, and smoke verified.
- Problem addressed:
  - A completed thread could show no `Usage` card on the first open after the
    browser had been away, then show Usage after leaving and reopening the
    thread.
  - Production/server data for the reported Home AI turn already had
    `turnUsageSummary`; the missing card was caused by the client first-open
    detail path not scheduling the existing bounded Usage backfill when it
    rendered an older projection cache.
- Patch:
  - `public/app.js`
    - `loadThread()` now schedules `scheduleUsageBackfillRefresh()` after the
      first successful detail render, matching the post-completion and detail
      refresh backfill behavior.
    - `CLIENT_BUILD_ID` bumped to
      `0.1.11|codex-mobile-shell-v374`.
  - `public/sw.js`
    - PWA shell cache bumped to `codex-mobile-shell-v374`.
  - Tests:
    - `test/turn-scroll-controls.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
  - Docs:
    - `README.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `node --test test/turn-scroll-controls.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/app-update.test.js`
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`602` tests).
    - `git diff --check`
  - Public mirror:
    - `npm run check`
    - `npm run check:macos`
    - Focused 109-test suite passed.
    - `npm test` passed (`602` tests).
    - `git diff --check`
- Public/private sync:
  - Public commit:
    `16cab26 fix: backfill usage on initial thread load`.
  - Private main merged `public/main` with:
    `f72eaee Merge remote-tracking branch 'public/main'`.
  - Public main was pushed.
  - Excluding `.agent-context`, `public/main..main` has no source diff.
- Production deploy:
  - Source archive: public mirror commit `16cab26`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-16cab26-20260622T113507Z.backup.tar.gz`.
  - The first deploy attempt's blocked-path scan was overbroad and matched
    legitimate `token-usage-stats` source files; no production sync occurred in
    that attempt. A later non-sudo rsync attempt also failed on target file
    permissions before restart. Final sync used sudo rsync with production
    owner/group restored.
  - Staging checks passed:
    `npm run check`, `npm run check:macos`, blocked-path scan, and the focused
    109-test suite.
  - Target checks passed after sync:
    `npm run check`, `npm run check:macos`, and the same focused 109-test
    suite.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    `/api/public-config` returned HTTP `200`, `version=0.1.11`,
    `clientBuildId=0.1.11|codex-mobile-shell-v374`,
    `shellCacheName=codex-mobile-shell-v374`, and `authRequired=true`.
  - Authenticated `/api/status` returned HTTP `200`, `ready=true`,
    `lastError=null`, `codexProfileActiveId=default`, and
    `codexHomeSource=profile-store`.
  - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running after
    restart with a new PID.
- Operational note:
  - Existing open clients may still need to accept the refresh prompt or
    hard-reopen the PWA/WebView to load shell v374.
  - In-app Browser verification was attempted but the Browser MCP/Node REPL
    channel returned `sandboxCwd` metadata errors before page navigation; HTTP
    smoke and production target tests are the current verification evidence.

### v375 large-thread cold-cache fallback delay

- Status: diagnosed, public-synced, merged back into private main, deployed to
  Mac production, and smoke verified.
- User report:
  - Music is about 200 MiB and still felt slow even though thread detail should
    read only the latest 10 turns. The user suspected the immediately preceding
    update/restart might have made the issue visible.
- Production evidence:
  - Music thread id: `019ed959-27ce-7312-ba77-226ef9c526c7`.
  - Music rollout path:
    `/Users/xuxin/.codex/sessions/2026/06/18/rollout-2026-06-18T14-09-19-019ed959-27ce-7312-ba77-226ef9c526c7.jsonl`.
  - Pre-patch production detail API returned only 10 turns and about 111 KiB,
    with `mobileReadMode=projection-v4-dynamic`; repeated loopback calls were
    around `309ms`, then `33ms` and `34ms`.
  - Phone logs showed Music first paint after a cold/restart window at about
    `656ms`, later `490ms`, then `143ms`; it still returned 10 turns and
    omitted older turns.
  - The slower overlapping path was thread-list fallback, not Music detail:
    production logs showed `[thread-list] complete` around `2019ms-2341ms`,
    with `fallbackRolloutMs` around `1274ms-1400ms`, and client
    `thread_list_rendered` around `2160ms-3943ms`.
  - The update likely contributed by restarting the listener and clearing
    in-memory projection/fallback caches. The server is in-memory while
    running, but full thread-list fallback still reads disk rollout/session
    metadata after restart.
- Patch:
  - `public/app.js`
    - Added a cancellable `threadListDeferredFallbackTimer`.
    - Replaced the previous unconditional `800ms` full list fallback follow-up
      with `THREAD_LIST_DEFERRED_FALLBACK_DELAY_MS=8000`.
    - If a thread detail or another list request is active, the fallback now
      retries after `2500ms` instead of competing with first paint.
    - Any non-deferred list load clears the queued fallback timer.
    - `CLIENT_BUILD_ID` bumped to
      `0.1.11|codex-mobile-shell-v375`.
  - `public/sw.js`
    - PWA shell cache bumped to `codex-mobile-shell-v375`.
  - Tests:
    - `test/mobile-viewport.test.js`
    - `test/thread-goal-service.test.js`
    - `test/thread-task-card-route.test.js`
  - Docs:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 138-test suite passed:
      `test/mobile-viewport.test.js`, `test/app-update.test.js`,
      `test/thread-visibility.test.js`, `test/thread-goal-service.test.js`,
      `test/thread-task-card-route.test.js`, `test/conversation-render.test.js`,
      `test/turn-scroll-controls.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`602` tests).
    - `git diff --check`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version, but no stale edited files were reported.
  - Public mirror:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 138-test suite passed.
    - `npm test` passed (`602` tests).
    - `git diff --check`
  - Staging archive from public commit:
    - Blocked-path scan was clean for `.agent-context`, runtime data/logs,
      uploads, env files, access-key, private-key, and secret patterns. The
      scan intentionally did not block legitimate token-usage source filenames.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 138-test suite passed.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 138-test suite passed.
- Public/private sync:
  - Public commit:
    `e53036c fix: delay full thread-list fallback`.
  - Public main was pushed to
    `git@github.com:pentiumxp/codex-mobile-web-public.git`.
  - Private main merged `public/main` with:
    `c32db44 Merge remote-tracking branch 'public/main'`.
- Production deploy:
  - Source archive: public mirror commit `e53036c`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-e53036c-20260622T114509Z.backup.tar.gz`.
  - Sync used sudo `rsync` and preserved `data/`, `logs/`, `node_modules/`,
    `uploads/`, `.git/`, `.agent-context/`, and `AGENTS.md`; target ownership
    was restored to `hermes-host:staff`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v375` and
      `shellCacheName=codex-mobile-shell-v375`.
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `25816`, `runs=11`, and last exit code `0`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`.
    - Authenticated Music recent detail calls returned HTTP `200`, about
      `83275` bytes, `10` turns, `mobileReadMode=projection-v4-cache`,
      `status=idle`, `mobileOmittedTurnCount=234`,
      `rolloutSizeBytes=218711473`, and an older cursor. Timings were
      `297ms`, `30ms`, and `28ms`.
    - Served `app.js` contains shell v375, `8000ms` fallback delay,
      `2500ms` retry, mobile-loading retry guard, and non-defer timer clearing.
- Operational note:
  - This does not remove the full fallback scan. It makes the scan delayed and
    cancellable so it does not normally compete with thread first paint.
  - Existing open clients may need to accept the refresh prompt or reopen the
    WebView/PWA to run v375 client code.

### Local turn-start active status broadcast

- Status: diagnosed, public-synced before the new release-order rule was
  recorded, merged back into private main, deployed to Mac production, and
  smoke verified.
- User report:
  - A turn could already be started, but the thread list was not notified and
    did not show the thread as started.
  - The same symptom applied to automatic/source-direct task cards sent from
    other threads.
- Root cause:
  - The server already derived `thread/status/changed` from raw app-server
    `turn/started` notifications.
  - Several Mobile Web-owned local `turn/start` success paths did not
    immediately broadcast the active summary. They relied on later raw
    notifications or full list refreshes, which could leave background or
    target threads appearing idle for too long.
- Patch:
  - `server.js`
    - Added `notifyLocalTurnStarted(threadId, result, meta)` to update thread
      detail projection and broadcast `thread/status/changed` with
      `status.type=active` immediately after local `turn/start` success.
    - Wired the helper into message submit, new-thread first turn,
      continuation handoff/bootstrap, source-direct and automatic task-card
      execution, task-card approval execution, auto-turn recovery,
      ChatGPT Pro bridge starts, and main-thread side-chat candidate apply.
    - Kept raw app-server notification handling unchanged; duplicate active
      summaries are idempotent.
  - `test/thread-task-card-route.test.js`
    - Updated the task-card path assertion to use the unified helper.
    - Added coverage that verifies local turn-start success updates projection
      and broadcasts active status for all wired sources.
  - Docs:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 153-test suite passed:
      `test/thread-task-card-route.test.js`,
      `test/thread-task-card-service.test.js`,
      `test/new-thread-route.test.js`, `test/thread-visibility.test.js`,
      `test/conversation-render.test.js`, and
      `test/mobile-viewport.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`603` tests).
    - `git diff --check`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version, but no stale edited files were reported.
  - Public mirror:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed.
    - `npm test` passed (`603` tests).
    - `git diff --check`
  - Staging archive from public commit:
    - Blocked-path scan was clean for `.agent-context`, runtime data/logs,
      uploads, env files, access-key, private-key, and secret patterns.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 153-test suite passed.
- Public/private sync:
  - Public commit:
    `55f5d30998ec1d1a7886cf293e78804e28dedaa8 fix: broadcast local turn starts`.
  - Public main was pushed to
    `git@github.com:pentiumxp/codex-mobile-web-public.git` before the user
    recorded the new rule that future work must deploy and test before pushing
    public.
  - Private main merged `public/main` with:
    `39a34266990e93c4dd11376186c1c18f2e772aad Merge remote-tracking branch 'public/main'`.
- Production deploy:
  - Source archive: public mirror commit `55f5d30`.
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-55f5d30-20260622T132508Z.backup.tar.gz`.
  - Sync used sudo `rsync` and preserved `data/`, `logs/`, `node_modules/`,
    `uploads/`, `.git/`, `.agent-context/`, and `AGENTS.md`; target ownership
    was restored to `hermes-host:staff`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - `/api/public-config` returned
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `60923`, `runs=12`, and last exit code `0`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`, and
      `lastError=null`.
    - Production `server.js` contains `notifyLocalTurnStarted` and the expected
      source wiring for task cards, message submit, auto-recovery, and active
      status broadcast.
- Operational notes:
  - This is a server-only fix; there is no PWA cache bump and existing clients
    do not need a shell refresh for the broadcast behavior.
  - No real production test turn was started during smoke verification, to
    avoid mutating a live thread.
  - Future release order is now: local/private implementation and validation,
    deploy to Mac production, user/production test confirmation, then public
    push. Before that confirmation, at most create a local/private commit.

### Local active-status overlay for turn-start regression

- Status: implemented in private workspace, deployed to Mac production, smoke
  verified, not pushed to public.
- User report:
  - After the prior local turn-start broadcast fix, Home AI became worse:
    exiting to the thread list did not show the started/running marker, and
    entering the thread then returning no longer refreshed the marker.
- Production evidence before fix:
  - Home AI thread id:
    `019eed86-2002-7cc2-b0b7-937eb5355f36`.
  - A user send created turn
    `019eef85-b5b3-7741-81c0-ce061bc324af`.
  - Rollout showed `task_started` at `2026-06-22T13:29:37.972Z` and
    `task_complete` at `2026-06-22T13:29:57.183Z`.
  - During that active window, `/api/threads/:id` and thread-list refreshes
    could still log/return `status=idle` from `state-db+app-server`, so the
    broadcast-only fix was being overwritten by later summary synthesis.
- Root cause:
  - `notifyLocalTurnStarted()` broadcast `thread/status/changed active` and
    updated detail projection, but `/api/threads` and `/api/threads/:id`
    had no server-side queryable active state to merge after state-db/app-server
    summaries.
  - A list/detail refresh could immediately recompute and cache an idle row,
    erasing the browser's running marker.
- Patch:
  - `server.js`
    - Added bounded in-memory `localActiveThreadStatuses`.
    - `notifyLocalTurnStarted()` records an active overlay after local
      `turn/start` success.
    - Raw `turn/started` notifications also record the overlay; raw
      `turn/completed` clears it.
    - List/detail summary synthesis applies the overlay after stale-active
      normalization through `normalizeThreadSummaryLiveStatus()` and
      `applyLocalActiveThreadStatusToSummary()`.
    - The overlay clears when a later rollout-tail terminal event such as
      `task_complete` is seen, or when its TTL expires.
  - Tests:
    - `test/thread-visibility.test.js`
      - Added behavior coverage that local active overlay keeps rows active
        over immediate app-server idle summaries.
      - Added behavior coverage that a later rollout terminal event clears the
        overlay.
    - `test/thread-task-card-route.test.js`
      - Added structural coverage for active overlay wiring.
  - Docs:
    - `README.md`
    - `docs/ARCHITECTURE.md`
    - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 155-test suite passed:
      `test/thread-visibility.test.js`,
      `test/thread-task-card-route.test.js`,
      `test/thread-task-card-service.test.js`, `test/new-thread-route.test.js`,
      `test/conversation-render.test.js`, and
      `test/mobile-viewport.test.js`.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`605` tests).
    - `git diff --check`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version.
  - Staging:
    - Source staged from the private working tree, not the public mirror:
      `/tmp/codex-mobile-web-stage-local-active.mgSn4Q`.
    - Blocked-path scan was clean for `.agent-context`, runtime data/logs,
      uploads, env files, access-key, private-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Focused 155-test suite passed with `NODE_PATH` pointed at the local
      workspace `node_modules`; the clean staging source intentionally omits
      `node_modules`, while production preserves the target dependency tree.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 155-test suite passed.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-local-active-20260622T134437Z.backup.tar.gz`.
  - Sync used sudo `rsync` from private staging and preserved `data/`, `logs/`,
    `node_modules/`, `uploads/`, `.git/`, `.agent-context/`, and `AGENTS.md`;
    target ownership was restored to `hermes-host:staff`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `87711`, `runs=13`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200`, `ready=true`,
      `lastError=null`, `transport=external-jsonl-tcp`,
      `codexProfileActiveId=default`, and `codexHomeSource=profile-store`.
    - Production `server.js` contains the active overlay map, remember/apply
      helpers, notification update hook, list/detail overlay hooks, and
      rollout-terminal clearing logic.
    - A later user Home AI send created turn
      `019eef94-4e55-7e11-877e-e8eb1f1c2288`; production logs showed
      `summary_ready status=active` during the active window after local
      `turn/start`. The rollout then showed `task_complete` at
      `2026-06-22T13:45:44.957Z`, after which `/api/threads` and
      `/api/threads/:id` correctly returned `idle` with no
      `mobileLocalActiveStatus`.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.

## 2026-06-22 - Final receipt fallback v2 deployed

- User-observed correction:
  - The first response could briefly show the final receipt, then a follow-up
    detail refresh/projection result removed it. Re-entering the same thread
    made it stable.
- Root cause:
  - The first fallback only checked whether the completed turn had any
    assistant/plan item.
  - Stale projection results can contain intermediate `agentMessage` progress
    items while still lacking the real rollout
    `task_complete.last_agent_message`; that made the server skip the fallback.
- Change:
  - `server.js` now treats rollout `last_agent_message` as the text identity of
    the final receipt.
  - Completed/successful turns receive a synthetic final `agentMessage` when
    they do not already contain an assistant/plan item with matching final
    text, even if they contain intermediate `agentMessage` items.
  - Matching existing receipts are not duplicated or replaced.
  - Failed, cancelled, interrupted, running, active, progress, pending, and
    unknown turns still do not receive this fallback.
  - The raw thread-read branch now also runs the same final-receipt enrichment
    before returning.
  - `/api/threads/:id/turns` compacted turns-list responses now receive the
    same enrichment when a rollout-backed summary is available.
- Tests:
  - Added coverage in `test/thread-item-timestamp-enrichment.test.js` for a
    completed turn that has only an intermediate `agentMessage`; the rollout
    final receipt must still be appended.
  - Updated existing-receipt coverage to assert that matching final text is not
    duplicated, while failed turns are still skipped.
- Docs:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - `npm run check`
    - `npm run check:macos`
    - Focused 114-test suite passed:
      `test/thread-item-timestamp-enrichment.test.js`,
      `test/thread-detail-projection-service.test.js`,
      `test/thread-detail-projection-v4-service.test.js`,
      `test/conversation-render.test.js`, and
      `test/turn-usage-summary-service.test.js`.
    - `npm test` passed (`608` tests).
    - `git diff --check`
  - Staging:
    - Source staged from the private working tree:
      `/tmp/codex-mobile-web-stage-final-receipt-v2.hrgPqq`.
    - Blocked-path scan was clean for runtime/private paths including `.git`,
      `.agent-context`, `.codegraph`, `node_modules`, `data`, `logs`,
      `uploads`, env files, access-key, private-key, and secret patterns.
    - `npm run check`
    - `npm run check:macos`
    - Same focused 114-test suite passed with `NODE_PATH` pointed at the
      private workspace `node_modules`.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 114-test suite passed with `NODE_PATH` pointed at the
      production dependency tree.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-final-receipt-v2-20260622T143732Z.backup.tar.gz`.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `63072`, `runs=16`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200` and `ready=true`.
    - Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` recent detail
      returned `projection-v4-cache`, 10 turns, latest completed turn with
      agent receipt count `19`, last agent text length `479`, usage count `1`,
      and synthetic final receipt count `0` because the stable projection
      already contains the normal final receipt.
    - Production `server.js` contains `normalizeFinalReceiptText`,
      `turnHasMatchingAssistantReceipt`, raw-read enrichment, and turns-list
      enrichment hooks.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.

## 2026-06-22 - First-open final receipt fallback deployed

- User clarification:
  - The observed first-open problem is missing the final agent receipt, not
    primarily missing Usage. Usage was a symptom in earlier descriptions.
- Change:
  - `server.js` now reads bounded rollout completion events
    `task_complete` / `task_completed` and caches their
    `last_agent_message` payloads by rollout fingerprint.
  - During compact thread detail projection, completed/successful turns that
    have no existing assistant/plan receipt get a synthetic `agentMessage`
    from that rollout final receipt before `turnUsageSummary` is attached.
  - Existing app-server receipts are not overwritten.
  - Failed, cancelled, interrupted, running, active, progress, pending, and
    unknown turns do not get synthetic final receipts.
  - The synthetic receipt intentionally has no timestamp fields so ordering
    remains user message, final receipt, then Usage.
- Tests:
  - Added coverage in `test/thread-item-timestamp-enrichment.test.js` for:
    - completed turn missing app-server receipt is backfilled from rollout
      `task_complete`;
    - existing receipts are preserved and failed turns are not backfilled.
- Docs:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TROUBLESHOOTING.md`
- Validation:
  - Private workspace:
    - Focused 113-test suite passed:
      `test/thread-item-timestamp-enrichment.test.js`,
      `test/thread-detail-projection-service.test.js`,
      `test/thread-detail-projection-v4-service.test.js`,
      `test/conversation-render.test.js`, and
      `test/turn-usage-summary-service.test.js`.
    - `node --check server.js`
    - `git diff --check`
    - `codegraph sync`
    - `codegraph status` was up to date; it warned the index was built by an
      earlier engine version.
    - `npm run check`
    - `npm run check:macos`
    - `npm test` passed (`607` tests).
  - Staging:
    - Source staged from the private working tree, not the public mirror:
      `/tmp/codex-mobile-web-stage-final-receipt.Gq2ba3`.
    - Blocked-path scan was clean for exact runtime/private paths including
      `.git`, `.agent-context`, `.codegraph`, `node_modules`, `data`, `logs`,
      `uploads`, env files, access-key, private-key, and secret path patterns.
    - `npm run check`
    - `npm run check:macos`
    - Focused 113-test suite passed with `NODE_PATH` pointed at the private
      workspace `node_modules`; staging intentionally omits `node_modules`.
  - Production target after sync:
    - `npm run check`
    - `npm run check:macos`
    - Same focused 113-test suite passed with `NODE_PATH` pointed at the
      production dependency tree.
- Production deploy:
  - Target: `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
  - Backup retained at:
    `/tmp/codex-mobile-web-deploy-final-receipt-20260622T142901Z.backup.tar.gz`.
  - Sync used sudo `rsync` from private staging and preserved `data/`, `logs/`,
    `node_modules/`, `uploads/`, `.git/`, `.agent-context`, env files, and
    machine-specific runtime state.
  - Restart:
    `launchctl kickstart -k system/com.hermesmobile.plugin.codex-mobile`.
  - Post-restart smoke:
    - LaunchDaemon `system/com.hermesmobile.plugin.codex-mobile` is running
      with PID `43931`, `runs=15`, and last exit code `0`.
    - `/api/public-config` returned HTTP `200`,
      `clientBuildId=0.1.11|codex-mobile-shell-v375`,
      `shellCacheName=codex-mobile-shell-v375`, and `authRequired=true`.
    - Authenticated `/api/status` returned HTTP `200` and `ready=true`.
    - Production `server.js` contains the rollout final-receipt cache,
      scanner, compact-thread attachment hook, and synthetic receipt marker.
    - Home AI thread `019eed86-2002-7cc2-b0b7-937eb5355f36` recent detail
      returned 10 turns; the latest completed turn had item types
      `userMessage`, `agentMessage`, and `turnUsageSummary`. It did not need a
      synthetic final receipt because the normal app-server receipt was already
      present.
- Operational notes:
  - This is server-only; no PWA cache bump.
  - This has not been pushed to public. Follow the release-order rule: wait for
    production/user confirmation before any public sync/push.
