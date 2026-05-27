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

## Per-Turn Context Diagnostics

Thread detail may attach a synthetic `turnUsageSummary` item to completed turns when the rollout tail contains app-server `token_count` events. The summary reports latest-turn token usage, cumulative token usage, model context-window usage percentage, risk level, and rollout JSONL size.

When a token event includes `cachedInputTokens`, the UI displays `in` as uncached input (`inputTokens - cachedInputTokens`) and shows cached input separately. Model context-window usage and risk still use the raw input-token count because cached input still occupies the prompt window.

Some app-server turns can emit a final zero/window sentinel after valid usage events: `last_token_usage` is all zero, `total_token_usage` component fields are zero, and `total_token_usage.total_tokens` equals `model_context_window`. This is not real usage and must be ignored so the latest valid scoped token event remains visible.

This is diagnostic display only. It must not change model input construction, continuation bootstrap content, app-server history, or rollout files. If a turn has no scoped `token_count` event, Mobile Web should omit the summary rather than guessing.

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
