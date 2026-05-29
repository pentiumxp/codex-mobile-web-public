# Troubleshooting

Use this document for live production diagnosis before changing code. Prefer bounded metadata, ids, sizes, timestamps, and status fields. Do not print raw access keys, Push endpoints, full prompts, full rollout logs, or uploaded file content.

## Fast Triage

```powershell
$key = (Get-Content -Raw -LiteralPath "$env:USERPROFILE\.codex-mobile-web\access_key").Trim()
$headers = @{ "x-codex-mobile-key" = $key }
Invoke-RestMethod http://127.0.0.1:8787/api/public-config | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:8787/api/status -Headers $headers | ConvertTo-Json -Depth 6
Invoke-RestMethod http://127.0.0.1:8787/api/approvals -Headers $headers | ConvertTo-Json -Depth 6
Get-Content "$env:USERPROFILE\.codex\app-server-mux\endpoint.json" -Raw
```

Interpretation:

| Symptom | First check |
| --- | --- |
| Mobile Web offline | `GET /api/public-config`, 8787 listener PID, startup log |
| Messages not visible in Desktop | `/api/status` endpoint vs `endpoint.json`, Desktop launched through shared launcher |
| Send appears accepted then disappears | active turn id, recent turn history, pending echo, latest rollout growth |
| Thread looks stuck | rollout size/mtime, pending approvals, live command/tool process, latest turn status |
| Old command appears running | latest turn id vs raw operation fallback call id/turn id, app version includes raw-operation fix |
| PWA still shows old UI | `/api/public-config.clientBuildId`, browser shell cache, service worker cache name |
| Push missing | HTTPS/Tailscale access, VAPID files, subscription count, sub-agent suppression |
| Push says turn ended but no final reply appears | rollout `task_complete.last_agent_message`, completion-push no-final-message guard |

## Shared Mux Drift

Evidence of mux drift:

- `%USERPROFILE%\.codex\app-server-mux\endpoint.json` points to one host/port.
- Authenticated `/api/status` shows a different endpoint.
- Desktop and Mobile Web show different live turn streams.

Recovery:

1. Call authenticated `POST /api/app-server/reconnect` when only Mobile Web is stale.
2. If bridge code changed or endpoint process is stale, fully quit Desktop and relaunch once with `start-codex-desktop-shared.ps1 -ForceRestartMux`.
3. Avoid starting an independent managed app-server when shared mode is required; that creates a divergent stream.

## Sent Message Disappears After Re-entering Thread

Common causes:

- Browser submitted a stale `activeTurnId` and app-server accepted/ignored steering against an old marker.
- Latest live turn is genuinely waiting and `turn/steer` has not produced a durable `user_message` yet.
- Browser has not refreshed to the build containing pending steer echo and latest-durable active-state fixes.

Checks:

1. Read thread detail and note latest turn id/status.
2. Compare browser active turn, recent durable turns, and latest rollout mtime.
3. Check `/api/approvals`; pending approvals block cleanup.
4. Confirm server build is on or after the pending steer echo and raw-operation fixes.

Expected current behavior:

- Superseded active turns are stale and should fall through to new turn start.
- Latest durable live turn should be steered, not auto-interrupted.
- Pending steer echo keeps the user message visible during the wait.

## Thread Stuck Or Very Slow

Do not infer from rollout file size alone. Separate:

- Is rollout still growing?
- Is a local command/tool still running?
- Is approval pending?
- Is app-server/mux CPU active?
- Is the latest turn `inProgress` but no event has been written for minutes?

Useful checks:

```powershell
$rollout = "path-from-thread-summary-or-sessions-search.jsonl"
(Get-Item -LiteralPath $rollout).Length
(Get-Item -LiteralPath $rollout).LastWriteTime
Get-Content -LiteralPath $rollout -Tail 40
Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Id,ProcessName,CPU,Path
```

Interrupt only when evidence shows a stale active turn: no rollout growth, no pending approvals, no running local command/tool, and the turn has not emitted new events for a reasonable window. Do not interrupt a latest live turn merely because the last visible item is a completed operation.

## Old Command Card Shows As Running

This is usually display attribution, not a live process, when:

- The visible command belongs to an older interrupted turn.
- The real `function_call_output` or `exec_command_end` exists later in the rollout.
- `Get-Process` shows no matching tool process.

Current server behavior keeps at most one operation card only while the latest turn is live. Completed turns should not keep command/tool/file/search operation cards below the final reply; when scoped usage exists, the final frame should be the Usage summary. Raw fallback may attach a completed operation only when the latest turn is still live and the rollout event is tied to that same turn id; older completed operations must not attach to a newer live turn. If this regresses, inspect `readLatestRawOperation()` and `compactThread()` in `server.js`, then add coverage in `test/thread-item-timestamp-enrichment.test.js`.

## `rg` Appears Related To A Stall

Verify before blaming `rg`:

```powershell
Get-Command rg
rg --version
Measure-Command { rg -n "pattern" . -g "!node_modules/**" | Out-Null }
Get-Process rg -ErrorAction SilentlyContinue
```

On this machine, `rg.exe` may be available through `%USERPROFILE%\.local\bin\rg.exe`. A stale UI command card can make an already-completed `rg` look running; confirm through rollout output and process state.

## PWA Cache Or Version Mismatch

Check:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config | Select-Object version,clientBuildId,shellCacheName
```

Rules:

- Static browser behavior changes require bumping `CLIENT_BUILD_ID` in `public/app.js` and cache name in `public/sw.js`.
- Server-only behavior fixes do not need a PWA bump, but open clients may need a thread reload.
- If the phone still shows old UI, confirm it loaded the current `clientBuildId` and has accepted the refresh prompt or hard-reopened the PWA.

## File Preview Says Unsupported

If an agent reply shows a local Markdown/text file preview action but clicking it says the type is unsupported, inspect the exact `data-local-file-path` / `/api/files/preview?path=...` target. Codex source links often include location suffixes such as `README.md:12`, `README.md:12:3`, or `README.md#L12`.

Current server behavior strips those location suffixes before extension detection and root validation. The remaining path must still be an absolute local path, stay under the current thread workspace, an enclosing Obsidian vault, or `CODEX_MOBILE_FILE_PREVIEW_ROOTS`, and pass the sensitive-path denylist.

Focused checks:

```powershell
node --test test\file-preview.test.js test\file-preview-ui.test.js test\markdown-render.test.js
```

## Quoted Uploaded Images Stay As Text

If the original user upload renders as a thumbnail but a later Codex/plan reply shows raw `Uploaded attachments:` text, inspect `public/app.js` attachment-summary parsing first.

The parser should recognize LF and CRLF summaries, plus Markdown blockquote-style quoted lines such as `> Uploaded attachments:` and `> - IMG_0001.jpg (...)`. It should also treat raw app-server `input_text` parts as text and `input_image` / `image_url` parts as images, including object-shaped `image_url.url`. The saved upload path must still be under `%USERPROFILE%\.codex-mobile-web\uploads` so `/api/uploads/file?path=...` can serve it to the authenticated browser.

If the DOM contains an `<img>` for the saved upload path but the browser still shows a broken or blank thumbnail, check the upload route response headers. Saved `.jpg`, `.jpeg`, `.webp`, `.gif`, and `.png` files must return image MIME types such as `image/jpeg` rather than `application/octet-stream`.

Focused checks:

```powershell
node --test test\conversation-render.test.js test\mobile-viewport.test.js
```

## ImageView Screenshot Shows Broken Image

If a Codex turn displays an `Image` card for a visual verification screenshot but the thumbnail is broken, distinguish it from uploaded attachments first. Tool-generated screenshots often come from `view_image` / `imageView` paths under `%TEMP%`, not `%USERPROFILE%\.codex-mobile-web\uploads`.

Current behavior should cache small imageView source files into `%USERPROFILE%\.codex-mobile-web\generated-images` and serve them through `/api/generated-images/file`. Do not fix this by adding `%TEMP%` to `CODEX_MOBILE_FILE_PREVIEW_ROOTS`; that would broaden local file preview access beyond the current thread workspace. If the source temp file was already deleted before Mobile Web saw the item, the historical card cannot be recovered from the path alone.

Focused checks:

```powershell
node --test test\generated-image-cache-service.test.js test\file-preview-ui.test.js test\mobile-viewport.test.js
```

## Usage Card Shows Zero Tokens

If a completed-turn `Usage` card shows `0` for context window and token usage even though the turn clearly used the model, inspect the rollout `token_count` events for that turn.

Known app-server behavior can emit a final sentinel-shaped `token_count` immediately before `task_complete`:

- `last_token_usage` fields are all `0`.
- `total_token_usage.input_tokens`, `cached_input_tokens`, `output_tokens`, and `reasoning_output_tokens` are all `0`.
- `total_token_usage.total_tokens` equals `model_context_window`.

That event is not real usage. Mobile Web should ignore it and preserve the latest prior valid `token_count` for the same turn. If no valid token event exists, omit the `Usage` card instead of displaying a guessed zero summary.

## Usage Card Last Turn Looks Too Small

If the `Usage` card's `last turn` row looks like it only counted the final answer segment, inspect all scoped rollout `token_count` events for that turn. Multi-call turns can emit many valid token events before `task_complete`; a final event's `last_token_usage` is only the final model call, not the whole turn.

Mobile Web should compute the displayed turn-level usage from cumulative `total_token_usage` deltas across valid scoped events, while using the final valid event only for context-window percentage/risk. Duplicate token events with the same cumulative totals should add zero, and zero/window sentinel events should still be ignored.

## Web Push

Checks:

- Page is opened through HTTPS, not plain LAN HTTP.
- `/api/public-config.push.supported` is true and `subscriptionCount` is nonzero.
- VAPID subject is not localhost.
- Target thread is not a sub-agent child thread.

Notification clicks should focus/open the app shell and pass the thread id through service worker messaging. Avoid direct `/?thread=...` launches on iOS when they risk separate PWA scenes.

If a Push says a turn ended but the thread has no final assistant reply, inspect the rollout `task_complete` payload for that turn. A normal completed turn should have `last_agent_message`; if it is explicitly null or empty, the app-server/runtime ended the turn without a final response. Current Mobile Web suppresses normal completion Push in that explicit no-final-message case.

## Image Upload Context Growth

Large rollout growth after image upload often comes from repeated `compacted.replacement_history` snapshots with `input_image` payloads.

Current mitigations:

- `public/image-compressor.js` compresses browser images before upload.
- `adapters/message-input-service.js` keeps image uploads reference-only by default, so new uploads are sent as path text rather than app-server `localImage` parts.
- `adapters/message-input-service.js` avoids requesting extended-history persistence for image-upload turns by default.

Check current mode:

```powershell
Invoke-RestMethod http://127.0.0.1:8787/api/public-config | Select-Object imageContextMode
```

Modes:

- `reference` is the default and sends no image pixels to the model.
- `latest` / `vision` sends only the latest uploaded image as a `localImage` part.
- `all` restores legacy all-image behavior and should be treated as high-risk for large context growth.

Limitations:

- Existing app-server in-memory thread state may still hold prior images.
- Old rollout records are not rewritten.
- Extended-history flags do not purge app-server current history; use a fresh continuation after switching to reference-only mode if the thread is already polluted.

## Continuation Issues

If a continuation thread starts with wrong runtime settings:

1. Inspect source rollout `turn_context` for model/effort/sandbox/approval.
2. Inspect `state_5.sqlite` thread metadata when available.
3. Inspect `threadRuntimeSettings()` and `applyStartThreadRuntimeSettings()` in `server.js`.

Known finding: if reasoning effort is not explicitly passed, continuation can fall back to Codex config defaults such as `xhigh` even when the source thread used `medium`.

If a continuation starts with unexpectedly high input tokens, inspect the bootstrap size and source handoff handling:

- Bootstrap should be bounded by `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` default `52000`.
- Source handoff should be listed by file path with a small excerpt, not pasted in full.
- Workspace handoff and prior lineage excerpts should stay bounded.
- Durable project facts should move to `.agent-context` and `docs/`, not into a larger bootstrap prompt.

## Hermes Mobile Plugin Checks

Codex Mobile Web's Hermes integration is an independent embedded-app plugin.
Do not diagnose it through a worker queue or collaboration queue.

For plugin setup:

1. Check the manifest:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/manifest | ConvertTo-Json -Depth 6
   ```

2. Register the Hermes callback URL with the Codex Mobile Access Key. The
   callback may be an HTTPS domain:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/workspaces `
     -Method Post `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" } `
     -ContentType "application/json" `
     -Body '{"workspace_id":"owner","hermes_callback_url":"https://hermes.example.test/api/plugins/codex-mobile/callback"}'
   ```

3. Register the Hermes PWA iframe origin for CSP `frame-ancestors`. Use the
   deployment's real HTTPS origin; do not hard-code a personal domain in source:

   ```powershell
   Invoke-RestMethod http://127.0.0.1:8787/api/v1/hermes/plugin/origins `
     -Method Post `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" } `
     -ContentType "application/json" `
     -Body '{"workspace_id":"owner","hermes_origin":"https://hermes.example.test"}'
   ```

4. Confirm the registration without printing the Access Key:

   ```powershell
   Invoke-RestMethod "http://127.0.0.1:8787/api/v1/hermes/plugin/registration?workspaceId=owner" `
     -Headers @{ Authorization = "Bearer <codex-mobile-access-key>" }
   ```

5. Test launch through `POST /api/v1/hermes/plugin/launch`. The response should
   contain a short-lived `entry_path` with `codexPluginLaunch`; it must not
   contain the long-lived Access Key. In the browser iframe, the app exchanges
   this launch token through `/api/v1/hermes/plugin/session`, removes the
   one-time token from the URL, and keeps only an in-memory plugin session.

6. For a Windows scheduled-task deployment, persist the external HTTPS Codex
   URL and the Hermes iframe origin in the task arguments rather than only in
   the current shell:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunNow `
     -HermesPluginBaseUrl "https://codex.example.test:8443" `
     -HermesPluginFrameOrigins "https://hermes.example.test"
   ```

If Hermes Mobile is served over HTTPS, the plugin entry URL must also be HTTPS
or the browser may block the embedded frame as mixed content. The fix is a
deployment URL/TLS configuration change, not a Codex Access Key change. Set
`CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or `CODEX_MOBILE_PUBLIC_BASE_URL` to the
external HTTPS Codex Mobile URL when the Node listener itself only sees local
HTTP. If the manifest still returns `http://127.0.0.1:8787/?embed=hermes` for a
HTTPS Hermes origin, check the current Node process environment or the
scheduled-task action arguments; the registered Hermes origin only controls
`frame-ancestors`, not the Codex entry/base URL.

If the iframe opens a standalone login panel after a valid launch, check:

- the launch token was exchanged before its TTL expired;
- the Node listener has not restarted and lost in-memory launch/session tokens;
- the iframe URL has `embed=hermes` and no stale `codexPluginLaunch` after the
  first successful exchange;
- `/api/v1/hermes/plugin/session` is included in `/api/public-config.hermesPlugin`.

If the Hermes back button does nothing, inspect browser `postMessage` traffic.
Codex expects `{ type: "hermes.plugin.back", version: 1 }` and responds with
`codex-mobile.plugin.navigation`. Hermes should use those messages only; it
must not inspect Codex DOM or call internal Codex route functions.
