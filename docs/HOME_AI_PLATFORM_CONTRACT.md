# Home AI Platform Contract Pointer

Last updated: 2026-06-09.
Home AI platform contract version: `20260606-v1`.

## Scope

Codex Mobile Web is an Owner-critical Home AI embedded-app plugin. It owns the
Codex Mobile iframe app, Codex CLI bridge, profile mux integration, thread UI,
and Codex-specific runtime state. This file records only Codex Mobile-local
facts and points back to the canonical Home AI platform contract.

Codex Mobile remains a special insertion for ownership and permission policy:
it is not a normal grantable business plugin. It is nevertheless covered by the
platform contract for deployment, mobile visual evidence, live iOS PWA
debugging, and production validation.

## Canonical Home AI Docs

Read these Home AI docs before changing deployment, MCP tools, mobile visual
behavior, or cross-plugin reference behavior:

- `C:\Users\xuxin\Documents\Agent\docs\PLATFORM_CONTRACTS\plugin-workspace-platform-contract.md`
- `C:\Users\xuxin\Documents\Agent\docs\PLATFORM_CONTRACTS\plugin-mobile-ui-visual-contract.md`
- `C:\Users\xuxin\Documents\Agent\docs\RUNBOOKS\macos-production-access.md`
- `C:\Users\xuxin\Documents\Agent\docs\RUNBOOKS\mcp-tool-upgrade-closure.md`
- `C:\Users\xuxin\Documents\Agent\docs\RUNBOOKS\macos-ios-simulator-appium.md`
- `C:\Users\xuxin\Documents\Agent\docs\IMPLEMENTATION_NOTES\reference-memory-graph-v1.md`
- `C:\Users\xuxin\Documents\Agent\docs\IMPLEMENTATION_NOTES\reference-memory-graph-harness-plan.md`

## Plugin-Local Facts

| Field | Value |
| --- | --- |
| `plugin_id` | `codex-mobile` |
| `workspace_path_windows` | `C:\Users\xuxin\Documents\codex-mobile-web` |
| `current_branch_snapshot` | `main` with local commits through `89cda66` before this production-evidence update |
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
| `ios_live_debug_available` | `yes`; use Home AI `npm run ios:pwa:debug` for interactive embedded iOS PWA reproduction, with one Simulator/live-debug-port/WDA-port/MJPEG-port lane per concurrent plugin debug session. |
| `ios_visual_harness_command` | `cd /Users/hermes-dev/HermesMobileDev/app && npm run ios:pwa:visual -- --scenario embedded-plugin-shell --plugin-id codex-mobile --debug-url http://127.0.0.1:19073/` |

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

2026-06-09 Mac production deployment:

- Production source path:
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`.
- LaunchDaemon: `system/com.hermesmobile.plugin.codex-mobile`.
- Loopback production URL: `http://127.0.0.1:8787`.
- Current verified shell after Public PR workspace routing deployment:
  `0.1.11|codex-mobile-shell-v228`.
- Backup path:
  `/Users/hermes-host/HermesMobile/backups/deploy/20260609T011046Z-plugin-codex-mobile-web-codex-mobile-public-pr-workspace-v228`.
- Production smoke confirmed `/api/public-config` reports
  `clientBuildId=0.1.11|codex-mobile-shell-v228` and
  `shellCacheName=codex-mobile-shell-v228`.
- Plugin manifest returns `plugin_id=codex-mobile`, `kind=embedded_app`, and
  does not return raw Codex Mobile Access Keys.
- Public PR smoke confirmed open PR `#53`, production `workspacePath`
  `/Users/hermes-host/HermesMobile/plugins/codex-mobile-web`, and resolved
  review workspace `/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web`
  for new-thread review tasks.
- Generated-image endpoint remains protected: no auth returns `401`, Access
  Key returns `200 image/png`, and a short-lived plugin session cookie can
  still authorize `/api/generated-images/file` when the query string contains a
  stale plugin-session token.
- Uploaded-image endpoint remains protected: no auth returns `401`, Access Key
  returns `200 image/jpeg`, and a short-lived plugin session cookie can still
  authorize `/api/uploads/file` when the query string contains a stale token.
- Live iOS PWA debug evidence for direct Codex plugin launch confirmed
  `data-font-size=xlarge`, opened thread
  `019ea76b-d846-7892-bda0-c0fff9cf7581`, rendered one uploaded image
  `IMG_5882.jpg` with natural size `591x1280`, and `failedUploadCount=0`.
  Screenshot artifact:
  `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v227-upload-image-1781040000.png`.
- Prior live iOS PWA debug evidence for generated images confirmed
  `CLIENT_BUILD_ID=0.1.11|codex-mobile-shell-v226`,
  `data-font-size=xlarge`, opened thread
  `019ea77e-4e36-7820-adf4-9bf0272965b8`, rendered one `view_image output`
  image with natural size `942x2048`, and `failedCount=0`. Screenshot artifact:
  `/Users/xuxin/.homeai-qa/artifacts/codex-mobile-v226-media-font-1780937849769.png`.

## Open Gaps

- Add a Codex-specific final acceptance harness that records bounded artifacts
  from the Home AI live iOS PWA debug server for embedded keyboard, gesture,
  and cache/PWA regressions.
- Keep Codex Mobile's Owner-only permission policy separate from normal
  workspace-grantable business plugin visibility.
