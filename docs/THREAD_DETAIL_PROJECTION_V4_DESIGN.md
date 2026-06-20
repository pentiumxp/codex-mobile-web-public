# Thread Detail Projection v4 Design

Status: implemented and default-enabled for the local runtime in v331. The
existing v3 implementation stays in place as an environment fallback through
`CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4=0`. Production can be switched after
focused validation and visual verification; public release still needs the
stricter public-safe test/publish gate before pushing.

## Problem Statement

Thread detail projection has accumulated several independent visibility
preservation paths:

- server compaction and the warm projection index in
  `adapters/thread-detail-projection-service.js`;
- browser merge logic such as `mergeThreadPreservingVisibleItems` plus local
  pending state;
- DOM-level partial patching for operation cards, progress, images, and
  receipts.

Recent failures show that those layers can disagree:

- context compaction `item/started` / `item/completed` notices can be visible in
  the live SSE path, then disappear after a thread-detail projection refresh;
- a submitted user message can render locally, then disappear when the first
  server refresh contains a newer active assistant turn without the matching
  durable user message;
- uploaded images and generated-image cards can move to the wrong turn or flicker
  between pending, failed, and durable shapes;
- leaving and re-entering a thread can make hidden messages appear, which means
  the open-thread live path and the reloaded canonical path are not equivalent.

The failure class is architectural, not only a single missing condition. v4
introduces one canonical visible-message contract while keeping v3 available for
fallback and comparison.

## Goals

1. Make the server projection the canonical source for durable visible thread
   content.
2. Normalize app-server `thread/read`, bounded `thread/turns/list`, rollout
   metadata, and raw notifications through the same visible-item normalizer.
3. Keep local submitted user content visible until it is matched by durable
   server projection or marked failed.
4. Preserve historical/reloaded and currently-open live turns through the same
   ordering, dedupe, and visibility rules.
5. Keep generated images, uploaded images, operation cards, compaction notices,
   receipts, and Usage summaries attached to stable turns and stable visible
   item keys.
6. Limit frontend merge authority. The browser may apply a transient pending
   overlay, but it must not decide that durable or pending user content is
   obsolete merely because a newer real turn exists.
7. Make DOM patching an optimization only. If visible keys, types, or order
   change, render from canonical state instead of preserving stale nodes.
8. Add v4 beside v3. Tests target v4 first; v3 remains available for explicit
   rollback while v4 is exercised in production.

## Non-Goals

- Do not delete `adapters/thread-detail-projection-service.js` during the v4
  introduction.
- Do not broaden local preview roots for uploads, generated images, temporary
  files, `.codex`, `.homeai-qa`, or diagnostics.
- Do not make browser `localStorage` the source of truth for message visibility.
- Do not change Codex app-server or mux protocol semantics unless a later
  implementation phase proves v4 cannot work without a protocol addition.
- Do not move standalone/PWA and Home AI embedded-plugin behavior onto different
  projection contracts.

## Versioning And Coexistence

v4 is the default runtime path as of v331. v3 remains behind an explicit
environment rollback flag for local/development validation and emergency
fallback. Public release is a separate gate and should not happen merely because
production was canaried.

Supported modes:

- default or `CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4=1` for v4;
- `CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4=0` for v3 rollback;
- an authenticated debug query or response flag for a single detail read;
- shadow-only generation that records bounded diffs without changing UI output.

The API should make the active projection version explicit:

```json
{
  "mobileProjectionVersion": "v4",
  "mobileProjectionRevision": 42,
  "mobileVisibleItemKeys": ["turn-1:user-1", "turn-1:receipt-1"],
  "turns": []
}
```

The `turns` shape should stay backward compatible while v4 is rolled out. New
metadata can be additive.

## Canonical Visible Item Contract

Every renderable item in v4 has a stable visible key and enough metadata to
reconcile without text heuristics:

```json
{
  "visibleKey": "turn-id:item-id-or-synthetic-kind",
  "kind": "userMessage",
  "turnId": "turn-id",
  "sourceItemId": "item-id",
  "source": "thread-read|turns-list|notification|rollout|synthetic",
  "order": 120,
  "revision": 7,
  "createdAt": "2026-06-20T00:00:00.000Z"
}
```

Rules:

1. `visibleKey` is stable across thread reads, notification patches, completion
   patches, and pagination.
2. `revision` is monotonic inside the projection so the browser can skip no-op
   paints without comparing raw item bodies.
3. Item order comes from app-server turn/item order first, then rollout event
   timestamps, then deterministic fallback order. Older unscoped images or tool
   outputs must not be appended to the latest turn merely because they lack an
   explicit turn id.
4. Synthetic items use deterministic keys:
   `turnId:contextCompaction`, `turnId:turnUsageSummary`,
   `turnId:operationFallback:<stable-id>`, and similar.
5. Type-only historical markers do not synthesize new status. Method-derived
   `item/started` and `item/completed` context compaction notifications do
   produce visible pending/complete notices.

## Server Pipeline

Implemented modules:

| Module | Role |
| --- | --- |
| `adapters/thread-visible-item-normalizer.js` | Pure conversion from app-server items, notification payloads, rollout metadata, and synthetic diagnostics into v4 visible items. |
| `adapters/thread-detail-projection-v4-service.js` | Projection store, cache signature, patch application, revision tracking, and optional v3/v4 shadow comparison. |
| `adapters/thread-detail-projection-v4-debug-service.js` | Optional future bounded diff summaries for development and incident cassettes. |

The pipeline:

1. Full or compact `thread/read` result enters the v4 normalizer.
2. Bounded `thread/turns/list` result enters the same normalizer. It can be a
   fallback or an older-history page, but its visible items follow the same key
   and ordering rules.
3. Raw app-server notifications enter the same normalizer before patching the
   v4 projection. Live SSE compaction must not be the only place that knows how
   to display a context compaction item.
4. `turn/completed` is an item-preserving patch. Missing or shorter completion
   item arrays cannot delete streamed receipts, user messages, operation cards,
   images, or Usage summaries unless the patch carries an explicit tombstone or
   replacement rule.
5. Generated and uploaded images normalize into stable image-view items. Local
   paths are converted only through existing authenticated upload,
   generated-image, or file-preview routes. v4 must not add broad preview roots.
6. Usage summaries remain synthetic diagnostic items. They are omitted when the
   turn has no valid scoped token event.
7. Projection cache signatures include source rollout size/mtime, summary
   status/update time, retained window policy, v4 policy version, and schema
   version. A stale signature misses instead of returning mixed-policy data.

## Browser Pipeline

The browser consumes canonical projection first, then applies only transient
client state:

1. Render the server v4 projection as the durable thread model.
2. Apply a pending overlay keyed by `clientSubmissionId` after canonical
   projection. Pending user messages and image previews remain visible until:
   - the server projection contains the same `clientSubmissionId`;
   - or a durable user message matches the same submitted text and attachment
     identity under bounded fallback rules;
   - or the send fails and the overlay item becomes a visible failure state.
3. Do not remove a pending user item solely because a newer active assistant turn
   exists.
4. `mergeThreadPreservingVisibleItems` is bypassed for v4 or reduced to a
   compatibility wrapper that cannot delete pending overlay items.
5. DOM patching is allowed only when the visible key sequence and item kinds are
   unchanged. Otherwise the conversation renders from canonical state.
6. Scroll preservation should use visible keys and element anchors, not broad
   thread-object equality.

## Shadow Comparison

Before broad runtime cutover, v4 should be able to run in shadow mode:

```text
thread/read response
  -> v3 projection returned to UI
  -> v4 projection generated in memory
  -> bounded diff summary logged or attached to debug response
```

The diff must be bounded and privacy-preserving:

- projection version and revision;
- visible item counts by kind;
- first differing visible key;
- whether context compaction, user messages, images, receipts, operation cards,
  and Usage summaries are present;
- no raw prompts, full model outputs, access keys, upload file content, or local
  private paths.

## Test Plan

New tests should target v4 rather than adding more v3 behavior branches:

| Test | Coverage |
| --- | --- |
| `test/thread-visible-item-normalizer.test.js` | Pure item normalization for user messages, context compaction notices, images, operation cards, receipts, and Usage summaries. |
| `test/thread-detail-projection-v4-service.test.js` | Cache signature, notification patching, completion patching, revision tracking, older-history windows, and shadow diff summaries. |
| `test/thread-detail-projection-v4-ui.test.js` or focused additions to `test/conversation-render.test.js` | Pending overlay, stable visible-key rendering, no disappearing submitted messages, no stale DOM patch when keys/order change. |

Required scenarios:

1. `item/started` context compaction produces a visible pending notice and
   survives a projection refresh.
2. `item/completed` context compaction replaces or updates the pending notice
   with a visible completed notice.
3. A local pending user message remains visible when the first server refresh
   has a newer active turn but no durable user message.
4. The pending user message is removed only when a durable matching user message
   appears or a failure state is recorded.
5. A second user guidance submitted while the thread is live remains visible in
   the already-open thread view.
6. `turn/completed` cannot delete streamed receipts, operation cards, images, or
   Usage summaries unless an explicit v4 replacement rule says so.
7. Uploaded image previews keep a stable visible item through pending,
   authenticated-upload, durable projection, reload, and older-history paging.
8. Historical generated/tool images stay attached to the correct source turn and
   never collect at the bottom/latest turn.
9. Shadow comparison can report a v3/v4 difference without changing the UI path.

## Migration Plan

1. Phase 0: land this design and documentation map updates only. Done.
2. Phase 1: implement the pure normalizer and v4 service with tests. Done in
   v331.
3. Phase 2: enable v4 as the local default with `CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4=0`
   rollback. Done in v331.
4. Phase 3: run focused service/UI tests and visual checks before production
   restart.
5. Phase 4: switch/canary production after those checks pass. Keep v3 fallback
   available and record enough bounded evidence to diagnose regressions without
   raw prompts or private paths.
6. Phase 5: push public only after the public-safe worktree/test gate passes.
   Public should receive the already-validated v4 behavior, not an unverified
   experiment.
7. Phase 6: after no meaningful v3/v4 visibility diffs remain, plan v3 removal
   in a separate change.

## Acceptance Criteria For v4 Cutover

- In an already-open thread, a sent user message is visible immediately and does
  not disappear during later projection refreshes.
- Context compaction pending/completed notices render in both live and reloaded
  thread detail.
- User-uploaded images and Codex-generated images keep stable placement and
  authenticated renderability across pending, durable, reload, and pagination
  states.
- Recent receipts, operation cards, and Usage summaries survive completion
  patches.
- Re-entering a thread does not reveal messages that should already have been
  visible in the open view.
- No new file-preview roots or raw private paths are exposed.
- Focused v4 tests pass, existing v3 tests still pass, and shadow diffs are
  bounded enough for handoff or incident cassette use.
