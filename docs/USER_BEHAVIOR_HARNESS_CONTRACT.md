# User Behavior Harness Contract

Codex Mobile is a primary user-facing coding surface. User-visible regressions
must be closed with real workflow Harness evidence, not only code inspection,
logs, or unit tests. This document maps common symptoms to the required local
and central Harness commands.

The canonical escalation rule is the Home AI root-cause contract:
`/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`.
This file is the Codex Mobile local matrix for that rule.

## Completion Rule

For any user-visible state synchronization bug that has already reproduced after
a prior repair, `completed` requires failing-then-passing Harness evidence on the
owning entry surface. If the Harness is missing or cannot enter the owning
surface, return `blocked_missing_repro_harness` or `partially_completed` with the
exact missing Harness path.

Accepted evidence must stay metadata-only: counts, hashes, thread ids that are
already non-secret, pending/durable item counts, visible DOM row counts, status
codes, client build id, and timing buckets. Do not include raw messages, cookies,
access keys, launch tokens, endpoint bodies, private screenshots, database rows,
or long logs.

## Required Matrix

| Symptom or change class | Required Harness | Required entry surface | Blocking rule |
| --- | --- | --- | --- |
| Submitted user message duplicates, disappears, reorders, or remains as a stale bottom echo | `node scripts/codex-mobile-submitted-message-harness.js --thread-id <id> --service-workers both --entry-surface app-preview --json` | At least one controlled submit thread and every reported high-repro real thread; include reopen verification | Any duplicate visible user card, missing durable item, missing visible item after settle, duplicate durable item, unexpected POST count, or reopen mismatch blocks completion |
| Submitted-message or composer path changed broadly | `npm run check:user-behavior -- --submitted-thread-id <id> --quota-thread-id <id> --runtime-submit-thread-id <id> --json` | App-preview real browser, service-worker `block` and `allow`; add custom embedded URL when the report came from Home AI iframe | Any child Harness failure blocks completion |
| Quota chip/popup, quota bridge, or composer control click behavior | `node scripts/codex-mobile-quota-popup-harness.js --thread-id <id> --service-workers both --click-count 2 --click-interval-ms 80 --json` | App-preview real browser; custom embedded entry when the report came from Home AI iframe | Missing bridge functions, missing button, collapsed panel, off-screen/hidden panel, or missing quota labels blocks completion |
| Thread detail projection, render downgrade, missing latest-turn user/assistant/usage/task-card rows | `node scripts/codex-mobile-runtime-self-check-loop.js --server http://127.0.0.1:8787 --gate-mode deploy --browser-mode full --json` plus `node scripts/codex-mobile-thread-self-check.js --server http://127.0.0.1:8787 --thread-id <id> --json` | Production or development origin matching the reported client; use settled-window rerun when restart just occurred | H1/H2 actionable/reportable gate issues block completion unless explicitly classified as advisory by a focused contract test |
| Startup, Vite native ESM, app-preview, embed/session launch, plugin proxy boot | `node scripts/codex-mobile-runtime-self-check-loop.js --server http://127.0.0.1:8787 --gate-mode deploy --browser-mode full --browser-startup-only --json` and Home AI `npm run visual:central -- --surface embedded-plugin --plugin-id codex-mobile --scenario embedded-plugin-shell --execute --json` | Direct 8787 and Home AI embedded iframe path | Direct-only success does not close an embedded bug; embedded plugin failures block completion |
| PWA cache/version/update prompt, static shell, service worker, installed PWA difference | `node scripts/codex-mobile-pwa-shell-refresh-smoke.js --json` plus production `/api/public-config` build readback; for Home AI embedded/PWA reports also use Home AI `ios:pwa:visual` | Installed PWA or Home AI iOS PWA debug lane when that is the reported surface | Stale loaded build, failed refresh prompt, old service worker shell, or missing expected build label blocks completion |
| Image/media card order, upload/generated-image preview, visual projection replay | `node scripts/codex-mobile-image-order-visual-smoke.js ... --json`, `node scripts/codex-mobile-media-render-visual-smoke.js ... --json`, or `node scripts/codex-mobile-projection-replay-visual-smoke.js ... --json` | Real thread and same entry surface as the report | Broken image/media route, wrong order, missing DOM card, or unsafe/raw path evidence blocks completion |
| Embedded keyboard, side-chat input, host/plugin viewport, gesture, or mobile layout | Home AI `npm run ios:pwa:visual -- --scenario embedded-plugin-keyboard-composer --plugin-id codex-mobile --plugin-thread-id <id> --debug-url http://127.0.0.1:19073/ --json` or side-chat equivalent | Home AI iOS PWA live debug lane | Browser desktop evidence is supplemental only; iOS/PWA visual failure blocks completion |

## Fixed Entrypoints

### User Behavior Bundle

`check:user-behavior` is the fixed local bundle for submitted-message, quota, and
runtime full behavior checks:

```sh
npm run check:user-behavior -- \
  --submitted-thread-id controlled:<thread-id> \
  --submitted-thread-id reported:<thread-id> \
  --quota-thread-id <thread-id> \
  --runtime-submit-thread-id <thread-id> \
  --json
```

The script fails closed when required targets are missing. Use environment
variables for production/deploy lanes:

```sh
CODEX_MOBILE_USER_BEHAVIOR_SUBMITTED_THREADS=controlled:<id>,reported:<id>
CODEX_MOBILE_USER_BEHAVIOR_QUOTA_THREAD_ID=<id>
CODEX_MOBILE_USER_BEHAVIOR_RUNTIME_SUBMIT_THREAD_ID=<id>
CODEX_MOBILE_USER_BEHAVIOR_EXPECT_BUILD_HASH=<hash>
```

### Runtime Repair Cards

Submitted-message duplicate/disappearing issues can be too intermittent for a
later visual smoke to catch. When the runtime client reports bounded
`submitted_message_dom_duplicate` or `submitted_message_dom_missing` evidence
through `/api/client-events`, the server may create an autonomous repair card to
the Codex Mobile Worker lane. This is an incident intake path, not completion
evidence.

The card body must remain metadata-only and include:

- source thread id;
- issue code and diagnostic type;
- client build id or shell hash when available;
- service-worker/entry-surface Harness command for the same source thread;
- duplicate/missing DOM counters and timing buckets only.

Default routing is `targetRole=plugin_worker`. Runtime operators can override or
disable the path without source edits:

```sh
CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_THREAD_ID=<exact-worker-thread-id>
CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_ROLE=plugin_worker
CODEX_MOBILE_USER_BEHAVIOR_REPAIR_TARGET_WORKSPACE=<optional-cwd>
CODEX_MOBILE_USER_BEHAVIOR_REPAIR_DEDUPE_WINDOW_MS=3600000
CODEX_MOBILE_USER_BEHAVIOR_REPAIR_CARDS=off
```

Cards are deduped per source thread, issue code, client build, and time window.
Completion still follows the matrix above: the Worker must return failing-then-
passing submitted-message Harness evidence or a bounded partial/blocked
classification.

### Central-Compatible Visual Evidence

Home AI central visual broker discovers Codex Mobile local evidence through:

```sh
npm run visual:central-compatible -- \
  --scenario embedded-plugin-shell \
  --plugin-id codex-mobile \
  --base-url http://127.0.0.1:8797 \
  --json
```

The local evidence is supplemental for embedded plugin signoff. Final embedded
plugin closure still requires Home AI central visual evidence when the reported
surface is the Home AI iframe or iOS/PWA shell.

## Return Classification

- `completed`: all required Harnesses for the symptom class passed on the owning
  surface and focused tests passed.
- `partially_completed`: source or deploy work is synced, but any required
  Harness is failing, missing, or only ran on a non-owning surface.
- `blocked_missing_repro_harness`: no existing Harness can enter the owning
  surface and the bug cannot be closed by code/log/unit evidence under the
  central root-cause contract.
