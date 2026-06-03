# Context And Continuation Strategy

Use this document when changing model input construction, image uploads, extended history, rollout continuation, handoff generation, or any feature that can materially change prompt size.

## Goals

- Keep durable project facts in files, not in oversized model history.
- Prevent uploaded images from silently becoming permanent `replacement_history` payload.
- Keep continuation bootstraps small enough that a fresh thread starts from references and focused excerpts instead of inheriting the old thread body.
- Preserve a clear escape hatch for tasks that intentionally need image pixels.

## Model Input Policy

Text sent by the user remains the primary model input. Uploaded files are always summarized in text as local file references:

```text
Uploaded attachments:
- IMG_0001.jpg (image, image/jpeg, 121.1 KB): C:\...\uploads\...\IMG_0001.jpg
```

Default image behavior is reference-only:

- `CODEX_MOBILE_IMAGE_CONTEXT_MODE` unset, empty, `reference`, `path`, `file`, `none`, `0`, or `off` sends no `localImage` parts.
- `CODEX_MOBILE_IMAGE_CONTEXT_MODE=latest` or `vision` sends only the latest uploaded image as a `localImage` part.
- `CODEX_MOBILE_IMAGE_CONTEXT_MODE=all` restores the legacy all-images behavior.

Reference-only is the production default because app-server current history can keep `input_image` payloads inside compacted `replacement_history` snapshots even when Mobile Web does not request extended-history persistence.

## UI Display Policy

Model context policy and user-visible rendering are separate:

- The model receives the attachment summary and local file path in text.
- The Mobile Web conversation should render uploaded image references as centered thumbnails when the saved upload path is available, including when Codex quotes the same `Uploaded attachments:` summary in a later reply. The parser must tolerate CRLF line endings, Markdown blockquote-style quoted summaries, and raw app-server `input_text` / `input_image` / `image_url` content parts.
- The thumbnail uses the authenticated upload/file preview route and must not require sending `localImage` parts to app-server.
- If only a non-durable browser-local filename is available, keep the compact attachment row instead of rendering a broken image.

This keeps uploads understandable for the user while preserving the reference-only default for model context.

## Extended History Policy

`adapters/message-input-service.js` owns the upload-aware policy:

- `CODEX_MOBILE_PERSIST_EXTENDED_HISTORY=0` disables Mobile Web's extended-history persistence request globally.
- `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1` allows image-upload turns to request extended-history persistence.
- By default, image-upload turns do not request extended-history persistence.

This policy reduces app-server history persistence requests. It does not purge image payloads already present in an app-server in-memory thread, old rollout records, or compacted `replacement_history` snapshots.

## Continuation Bootstrap Policy

Continuation has two artifacts:

- The source handoff file under `.agent-context/thread-handoffs/`, which is the high-priority fact source for the next thread.
- The bootstrap message sent to the new Codex thread, which should be a small index and excerpt, not a full copy of all context.

Default bootstrap limits are intentionally conservative:

| Environment variable | Default | Purpose |
| --- | ---: | --- |
| `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` | `52000` | Final bootstrap message hard cap. |
| `CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS` | `12000` | Source handoff excerpt included inline. |
| `CODEX_MOBILE_CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS` | `18000` | Project context excerpt cap. |
| `CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS` | `18000` | Workspace handoff tail cap. |
| `CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS` | `1200` | Per visible item summary cap. |
| `CODEX_MOBILE_CONTINUATION_TURN_SUMMARY_ITEMS` | `4` | Non-user items kept per recent turn. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS` | `12000` | Prior continuation lineage cap. |

The bootstrap must list the full handoff file path and instruct the new thread to read it first. Do not raise bootstrap limits to work around a missing documentation update; put durable facts into `.agent-context` or `docs/`.

## Workspace Context Compaction Policy

Continuation now compacts the workspace's live durable context before source
handoff generation when the configured thresholds are exceeded. This is separate
from shrinking the new-thread bootstrap: if `.agent-context/PROJECT_CONTEXT.md` or
`.agent-context/HANDOFF.md` stays large, every later continuation can keep
reloading the same oversized live context even when the bootstrap excerpt is
bounded.

The implemented MVP handles only:

- `.agent-context/PROJECT_CONTEXT.md`
- `.agent-context/HANDOFF.md`

Do not include `AGENTS.md` in the first automated rewrite. `AGENTS.md` is a
startup instruction file and may be loaded before the app can present a
workspace-maintenance prompt. It can be diagnosed and reported, but its content
should be manually edited into a short routing index unless the user explicitly
approves an `AGENTS.md` rewrite.

Default thresholds:

| File class | Suggest | Strong candidate |
| --- | ---: | ---: |
| Live project context or handoff | `> 50 KB` | `> 100 KB` |
| Combined `.agent-context` live pair | `> 100 KB` | `> 200 KB` |

The continuation route uses the strong thresholds by default:

- `CODEX_MOBILE_CONTINUATION_CONTEXT_FILE_COMPACT_BYTES`, default `100 KB`.
- `CODEX_MOBILE_CONTINUATION_CONTEXT_PAIR_COMPACT_BYTES`, default `200 KB`.
- `CODEX_MOBILE_CONTINUATION_CONTEXT_COMPACT_PRESERVE_CHARS`, default
  `18,000`.

Planned modes:

- `disabled`: report only.
- `suggest-only`: show a continuation warning and offer a workspace context
  compaction action.
- `auto-compact-above-threshold`: perform compaction only for ignored
  `.agent-context` files that exceed the strong threshold and pass the safety
  checks below.

Safety requirements:

1. Archive before rewrite under
   `.agent-context/archive/context-compaction-<timestamp>/`.
2. Copy the full original files to names such as
   `PROJECT_CONTEXT.full-before-context-budget.md` and
   `HANDOFF.full-before-context-budget.md`.
3. Confirm the archive path is under the current workspace's `.agent-context`
   tree and is ignored by Git before writing. If the workspace is a Git
   checkout and the archive path is not ignored, skip compaction and report
   `archive-not-ignored` rather than writing full historical context.
4. Do not archive, print, or rewrite raw access keys, VAPID private keys,
   subscription endpoints, uploaded file contents, full rollout logs, or
   `.codex` runtime state.
5. Do not create `.agent-context` in a workspace that does not already use it;
   in that case, report suggestions only.
6. Do not touch product code as part of this action.

The compacted live files should become short routing documents:

- `PROJECT_CONTEXT.md`: durable rules, source-of-truth order, public/private
  release rules, safety boundaries, docs entrypoints, current product anchors,
  and archive-loading criteria.
- `HANDOFF.md`: current repo/runtime state, latest production version, latest
  validation snapshot, current unfinished work, next steps, and archive/source
  handoff pointers.

Historical release logs, old risk lists, long diagnosis trails, and stale
deployment records should move to the archive and be loaded only when the new
task explicitly needs that history.

Every compaction report should include:

- before/after bytes and lines for each file;
- total reduction percentage;
- archive file paths;
- rewritten live file paths;
- Git ignore/tracked status for the live and archive paths;
- whether any file was skipped and why.

The current route performs the compaction inline when thresholds are exceeded
and the workspace already has `.agent-context`. Future UI can expose
`suggest-only` before the continuation starts: show the workspace context budget
warning next to rollout/bootstrap size, then let the user run compaction before
creating the next thread.

## Per-Turn Context Diagnostics

Thread detail may attach a synthetic `turnUsageSummary` item to completed turns when the rollout tail contains app-server `token_count` events. The summary reports turn-level token usage, cumulative token usage, model context-window usage percentage, risk level, rollout JSONL size, and current workspace context file sizes for `.agent-context/PROJECT_CONTEXT.md` and `.agent-context/HANDOFF.md`.

Turn-level token usage must account for all valid scoped `token_count` events in the completed turn, not only the final event's `last_token_usage`. Mobile Web derives this value from consecutive cumulative `total_token_usage` deltas, treats duplicate identical cumulative events as zero additional usage, and falls back to the event's `last_token_usage` only when no reliable cumulative baseline exists. The context-window percentage and risk remain a final valid-event snapshot because they describe the prompt window at the end of the turn, not the sum of all model calls.

When a token event includes `cachedInputTokens`, the UI displays `in` as uncached input (`inputTokens - cachedInputTokens`) and shows cached input separately. Model context-window usage and risk still use the raw input-token count because cached input still occupies the prompt window.

Some app-server turns can emit a final zero/window sentinel after valid usage events: `last_token_usage` is all zero, `total_token_usage` component fields are zero, and `total_token_usage.total_tokens` equals `model_context_window`. This is not real usage and must be ignored so the latest valid scoped token event remains the final context snapshot.

This is diagnostic display only. It must not change model input construction, continuation bootstrap content, app-server history, or rollout files. If a turn has no scoped `token_count` event, Mobile Web should omit the summary rather than guessing.

When workspace context or rollout size crosses the configured continuation
thresholds, the completed-turn Usage block may show a compact `压缩续接` action
beside the risk badge. This uses the same continuation path as the top rollout
warning and should not create a separate compaction mechanism.

## Recovery For Existing Oversized Threads

These changes only affect future submissions and continuations after the 8787 listener is restarted.

If a thread already has image payloads in `replacement_history`:

1. Do not expect `CODEX_MOBILE_IMAGE_CONTEXT_MODE=reference` to shrink that existing thread.
2. Create a fresh continuation after this strategy is active.
3. Make sure the continuation handoff records file paths and outcomes, not embedded image data.
4. Avoid sending new image pixels unless the task explicitly needs vision.

Do not edit `.codex` rollout files or SQLite state directly unless the user explicitly asks for a risk-reviewed runtime-state repair.

## Documentation Rule

Any change that affects model input size, image retention, continuation prompt construction, handoff compaction, or token/context diagnostics must update this document plus the smallest relevant docs in `docs/README.md`, `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, or `docs/COMPLEX_FEATURE_PATHS.md`.
