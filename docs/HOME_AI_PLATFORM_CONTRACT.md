# Home AI Platform Contract Pointer

Last updated: 2026-06-25.
Home AI platform contract version: `20260623-v5`.
Home AI root-cause contract version: `20260623-v3`.
Home AI fallback governance contract version: `20260623-v1`.

## Scope

Codex Mobile Web is an Owner-critical Home AI embedded-app plugin. It owns the
Codex Mobile iframe app, Codex CLI bridge, profile mux integration, thread UI,
and Codex-specific runtime state. This file records only Codex Mobile-local
facts and points back to the canonical Home AI platform contract.

Codex Mobile remains a special insertion for ownership and permission policy:
it is not a normal grantable business plugin. It is nevertheless covered by the
platform contract for deployment, mobile visual evidence, live iOS PWA
debugging, and production validation.

This pointer applies only to the Home AI embedded plugin deployment registered
as `codex-mobile`. It does not govern independent Codex Mobile Web deployments
that are not installed through the Home AI plugin manifest/proxy/launch-token
boundary and do not deploy under the Home AI Mac production plugin root.
Independent deployments may keep their own deploy/debug/test workflow and are
not required to use Home AI AI Operations Control Plane, Mac deploy script, or
iOS visual lane allocator unless they explicitly opt into Home AI embedded
plugin mode.

## Canonical Home AI Docs

Read these current Home AI Mac docs before changing deployment, MCP tools,
mobile visual behavior, fallback behavior, or cross-plugin reference behavior:

- `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/fallback-governance-contract.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/fallback-registry.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/MODULES/ai-operations-control-plane.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/ai-operations-control-plane.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/plugin-workspace-platform-contract.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/plugin-mobile-ui-visual-contract.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/RUNBOOKS/macos-production-access.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/RUNBOOKS/mcp-tool-upgrade-closure.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/RUNBOOKS/macos-ios-simulator-appium.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/reference-memory-graph-v1.md`
- `/Users/hermes-dev/HermesMobileDev/app/docs/IMPLEMENTATION_NOTES/reference-memory-graph-harness-plan.md`

Root-cause and fallback governance are paired contracts. Non-trivial bugfixes
or incidents must identify the owning layer and classify the outcome as
mitigation or closure. New or extended fallback behavior must either be removed
before completion or registered in the central fallback registry; local Codex
Mobile docs should link to that registry instead of copying entries.

## Plugin-Local Facts

| Field | Value |
| --- | --- |
| `plugin_id` | `codex-mobile` |
| `workspace_path_windows` | `C:\Users\xuxin\Documents\codex-mobile-web` |
| `current_branch_snapshot` | `main` with local commits through `f92987e` before this production-evidence update |
| `production_source_path_macos` | `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web` |
| `production_data_root_macos` | `/Users/xuxin/.codex-mobile-web` |
| `windows_dev_base_url` | `http://127.0.0.1:8787` |
| `macos_production_base_url` | `http://127.0.0.1:8787` |
| `launchd_label` | `system/com.hermesmobile.plugin.codex-mobile` |
| `manifest_url` | `http://127.0.0.1:8787/api/v1/hermes/plugin/manifest` |
| `public_config_endpoint` | `GET /api/public-config` |
| `mcp_command` | `none`; Codex Mobile Web is an embedded app bridge, not a Gateway MCP plugin |
| `mcp_schema_endpoint` | `none`; use the plugin manifest and bounded HTTP health/version endpoints |
| `dev_runtime_prerequisites` | Mac DEV must expose Node, npm, and Codex CLI through `/Users/xuxin/Developer/HomeAIDev/bin`; verify `node --version`, `npm --version`, and `codex --version` before classifying bridge/test failures. |
| `deploy_command` | Use the central Home AI Mac deploy script: `npm run --silent deploy:macos -- --plugin codex-mobile-web --source /Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web --restart-label com.hermesmobile.plugin.codex-mobile --health-url http://127.0.0.1:8787/api/public-config --execute --json` |
| `credential_locations` | Codex Mobile access key file and Codex home/runtime paths by reference only. Do not record raw keys, tokens, cookies, launch tokens, account auth files, uploaded content, or rollout logs here. |
| `reference_contract_status` | `none`; Codex Mobile is not currently a cross-plugin business object source through the Home AI Reference Graph |
| `mobile_visual_harness_status` | `appium-simulator`; use Home AI live iOS PWA debugging for embedded UI reproduction and record bounded Appium/Simulator or installed-PWA evidence for final acceptance |
| `ai_ops_control_plane_command` | `cd /Users/hermes-dev/HermesMobileDev/app && node scripts/ai-ops-control-plane.js intake --task "<task>" --json` |
| `ai_ops_required_flow` | `intake -> required-checks -> lane allocate if visual -> evidence append -> production smoke -> handoff` |
| `ai_ops_evidence_ledger` | `$HOME/.homeai-qa/codex-mobile-evidence-ledger.jsonl` |
| `ios_live_debug_available` | `yes`; use Home AI `npm run ios:pwa:debug` for interactive embedded iOS PWA reproduction, with one Simulator/live-debug-port/WDA-port/MJPEG-port lane per concurrent plugin debug session. |
| `ios_visual_harness_command` | `cd /Users/hermes-dev/HermesMobileDev/app && npm run ios:pwa:visual -- --scenario embedded-plugin-shell --plugin-id codex-mobile --debug-url http://127.0.0.1:19073/` |
| `plugin_manifest_actions_status` | `not_applicable_special_plugin`; Codex plugin edition must not declare ordinary user quick actions. |
| `voice_input_contract_status` | `embedded_only`; Codex answers Home AI `voice_input.*` capability/insertion messages and may long-press the embedded send button to request host recording. Standalone Codex Mobile Web keeps its existing send-button behavior and does not own recording or ASR. |
| `ios_keyboard_visual_harness_command` | `cd /Users/hermes-dev/HermesMobileDev/app && npm run ios:pwa:visual -- --scenario embedded-plugin-keyboard-composer --plugin-id codex-mobile --plugin-thread-id <thread-id> --debug-url http://127.0.0.1:19073/` |
| `ios_side_chat_keyboard_visual_harness_command` | `cd /Users/hermes-dev/HermesMobileDev/app && npm run ios:pwa:visual -- --scenario embedded-plugin-side-chat-keyboard --plugin-id codex-mobile --plugin-thread-id <thread-id> --debug-url http://127.0.0.1:19073/` |
| `ios_image_order_visual_smoke_command` | `node scripts/codex-mobile-image-order-visual-smoke.js --debug-url http://127.0.0.1:19073/ --thread-id <thread-id> --target-turn-id <turn-id> --json` |

## Required Local Validation

Run the smallest focused set for the changed surface:

```bash
npm run check
npm test
npm run check:macos
```

For embedded UI, keyboard, gesture, PWA cache, or mobile layout changes, use
the Home AI live debug server during the reproduce/fix loop:

```bash
cd /Users/hermes-dev/HermesMobileDev/app
npm run ios:pwa:debug
```

Default live debug UI:

```text
http://127.0.0.1:19073/
```

For Codex thread-detail composer, input-method, keyboard, or input-obstruction
changes, the final development visual check must use a real Codex thread id:

```bash
cd /Users/hermes-dev/HermesMobileDev/app
npm run ios:pwa:visual -- \
  --scenario embedded-plugin-keyboard-composer \
  --plugin-id codex-mobile \
  --plugin-thread-id <thread-id> \
  --debug-url http://127.0.0.1:19073/
```

For Codex left-swipe side-chat textarea keyboard/input-obstruction changes, use
the side-chat target scenario with a real Codex thread id:

```bash
cd /Users/hermes-dev/HermesMobileDev/app
npm run ios:pwa:visual -- \
  --scenario embedded-plugin-side-chat-keyboard \
  --plugin-id codex-mobile \
  --plugin-thread-id <thread-id> \
  --debug-url http://127.0.0.1:19073/
```

The keyboard scenario records host keyboard metrics, iframe bounds, plugin
keyboard viewport receipt, and the focused input clearance above the keyboard.
When the local Appium/Safari lane cannot display the iOS software keyboard for
iframe `contenteditable` controls, the harness injects the canonical
`hermes.plugin.viewport` keyboard payload and marks `keyboard.simulated=true`;
that remains a required development layout gate before deploy.
Do not deploy keyboard or composer layout changes from this workspace until the
development visual check passes or the blocker is explicitly recorded.

For Codex thread-detail rendering regressions that are not keyboard-specific,
first run the central Home AI live debug server and the checked
`embedded-plugin-shell` harness when the lane is healthy. When the regression is
inside the Codex iframe's business DOM, such as generated/uploaded image card
ordering, add the plugin-specific visual smoke on the same live-debug lane with
a real thread id and bounded screenshot artifact:

```bash
node scripts/codex-mobile-image-order-visual-smoke.js \
  --debug-url http://127.0.0.1:19073/ \
  --thread-id <thread-id> \
  --target-turn-id <turn-id> \
  --json
```

If the checked harness reports `webview_context_missing`, `Unexpected EOF`,
`socket hang up`, or `appium_timeout`, classify it as visual toolchain
infrastructure first and follow the central recovery order: verify Appium
`4723`, WDA `8101`, and live debug `19073`; start Appium with the central
script if needed; reset the live debug Appium session once with
`type=connect` and `resetSession=true`; only then restart WDA or the Simulator
lane if the WebView attach layer is still broken.

For WDA MJPEG stream mode, allocate unique ports per Simulator lane:

```bash
npm run ios:pwa:debug -- \
  --stream wda-mjpeg \
  --wda-local-port 8101 \
  --mjpeg-server-port 9100
```

From the Home AI main workspace, run the cross-workspace platform contract
checker after changing this pointer or any Codex Mobile deployment/mobile
contract:

```bash
node scripts/plugin-workspace-platform-contract-check.js --plugin codex-mobile --json
```

## Required Production Validation

Use the Home AI Mac access and deployment runbooks. Do not print passwords,
Access Keys, launch tokens, cookies, Codex auth files, full prompts, uploaded
payloads, rollout contents, or long logs.

Minimum closure for Codex Mobile production changes:

1. verify Mac launchd `system/com.hermesmobile.plugin.codex-mobile` is running;
2. verify Mac loopback `/api/public-config` reports the expected
   `clientBuildId` and `shellCacheName`;
3. verify Mac loopback plugin manifest returns `plugin_id=codex-mobile`;
4. for embedded UI, keyboard, gesture, or PWA shell changes, reproduce through
   Home AI `npm run ios:pwa:debug` during iteration and record bounded final
   Simulator/Appium or installed-PWA evidence;
5. for account/quota/profile changes, perform bounded authenticated status
   smokes without printing raw keys or auth material;
6. for production deploys, record the backup path and health/version result.

## Latest Production Evidence

2026-06-25 Mac production deployment:

- Production source path:
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- LaunchDaemon: `system/com.hermesmobile.plugin.codex-mobile`.
- Loopback production URL: `http://127.0.0.1:8787`.
- Current verified shell after tile-pane header contrast and Composer target
  placeholder contrast polish:
  `0.1.11|codex-mobile-shell-v436`.
- Source ref deployed for code change:
  `09848ed6803a` with clean source worktree at deploy time.
- Backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260625T050430Z-plugin-codex-mobile-web-manual`.
- Production smoke confirmed `/api/public-config` reports
  `clientBuildId=0.1.11|codex-mobile-shell-v436`,
  `shellCacheName=codex-mobile-shell-v436`, `version=0.1.11`,
  `authRequired=true`, production `workspacePath` above, and build id
  `c44493ef6e205801`.
- Source/production short SHA-256 samples matched after deploy:
  `public/app.js` `0f5ae98a53661df7`,
  `public/sw.js` `a7af74d782319f20`,
  `public/styles.css` `b32020a96c2b5acd`, and
  `README.md` `62ee088dedd11d18`.
- Validation before deploy:
  `npm test` passed (`777` tests), focused tile/composer/mobile/goal/task-card
  tests passed (`34` tests), `npm run check` passed, and `git diff --check`
  passed.
- Deployment validation also ran the central production file-hash, LaunchDaemon,
  public-config, and non-strict auth-profile audit checks. The auth-profile
  audit remained non-blocking with zero blocking issues.
- The earlier 2026-06-25 `codex-mobile-shell-v434` tile-mode Composer
  placeholder evidence is historical after the v435 thread-detail merge
  deployment.
- The earlier 2026-06-25 `codex-mobile-shell-v435` thread-detail merge evidence
  is historical after the v436 tile-pane contrast deployment.
- The earlier 2026-06-25 `codex-mobile-shell-v430` large-session detail-shape
  diagnostics evidence is historical after the v431 tile local split-pane
  deployment.
- The earlier 2026-06-25 `codex-mobile-shell-v429` live-to-completed weak
  projection merge evidence is historical after the v431 tile local split-pane
  deployment.
- The earlier 2026-06-25 `codex-mobile-shell-v428` tile-mode composer
  intent-menu and Movie server operation-projection evidence is historical after
  the v429 live-to-completed weak projection merge deployment.
- The earlier 2026-06-25 `codex-mobile-shell-v427` manual tile-width and
  task-card protocol evidence is historical after the v428 tile-mode composer
  intent-menu deployment.
- The earlier 2026-06-24 `codex-mobile-shell-v426` wide tile-column and
  `codex-mobile-shell-v425` route-hint / tile-pane evidence is historical.
- The older 2026-06-09 `codex-mobile-shell-v251` image-rendering evidence is
  historical only and must not be treated as the latest production shell.

## Open Gaps

- Add a Codex-specific final acceptance harness that records bounded artifacts
  from the Home AI live iOS PWA debug server for embedded keyboard, gesture,
  and cache/PWA regressions.
- Keep Codex Mobile's Owner-only permission policy separate from normal
  workspace-grantable business plugin visibility.
