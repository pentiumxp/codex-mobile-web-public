# HANDOFF

Last compacted: 2026-05-31T03:26:40.298Z

This active handoff was automatically compacted before a Codex Mobile continuation.
The previous full handoff was archived and should be opened only when old provenance is explicitly needed.

## Compaction Summary

- Workspace: `C:\Users\xuxin\Documents\codex-mobile-web`
- Original active handoff bytes: `322000`
- Archived full handoff: `C:\Users\xuxin\Documents\codex-mobile-web\.agent-context\archive\context-compaction-20260531_032640\HANDOFF.full.md`
- Preserved recent active context chars: `59878`

## Startup Guidance

- Read `.agent-context/PROJECT_CONTEXT.md` first.
- Read this compact `.agent-context/HANDOFF.md` for current status.
- Do not load the archived full handoff unless the user asks for old provenance or the compact handoff is insufficient.
- Keep future handoff updates concise: current state, changed files, validation, risks, and next steps.
- Do not store raw secrets, tokens, one-time approvals, hidden UI state, long logs, or bulky generated output.

## 2026-06-01 Public PR #42/#43 Merge And Private Sync

- User request:
  - Review open public PRs `pentiumxp/codex-mobile-web-public` #42 and #43.
  - If mergeable, update public README Chinese release notes, run validation and privacy scan, push public, then sync back to private and revalidate.
- Public result:
  - PR #42 `允许预览已知工作区内的本地文件` was merge-committed to public main as `ba7eddbd44df2e75458a1bdc9712d29dd4d69bc8`.
  - PR #43 `修复 worktree 线程在 Mobile 中不可见` was merge-committed to public main as `8540fe0272a5f4103ae95ca3d52f12546a87ca0b`.
  - Follow-up public docs commit `0cc2c98` synced the public `docs/` architecture/module/troubleshooting/complex-path docs for PR #42/#43.
  - GitHub reports both PRs as `MERGED`.
  - Public README now has separate 2026-06-01 Chinese release notes for known-workspace file preview, worktree thread visibility, and public docs synchronization.
- Product behavior:
  - Local file preview roots now include explicit env roots, visible workspace roots, current thread cwd, and enclosing Obsidian vaults when present; it still rejects out-of-root paths, sensitive file types, unsupported binary content, and broad runtime/temp/.codex/upload/diagnostic roots.
  - Markdown file preview preserves source ordered-list numbering.
  - Thread visibility accepts Codex worktree cwd values under `%USERPROFILE%\.codex\worktrees\<id>\<repo>` only when `<repo>` matches a visible workspace basename.
  - Thread list responses merge bounded state DB / session-index fallback rows when app-server omits visible rows, and `thread/turns/list` fallback sorting can use rollout item timestamps.
  - Static browser build/cache advanced to `0.1.11|codex-mobile-shell-v140` / `codex-mobile-shell-v140`.
- Private sync:
  - Synced only product files and public docs from public into private: README, `server.js`, `public/app.js`, `public/sw.js`, focused tests, new `test/thread-visibility.test.js`, and the tracked `docs/` updates.
  - Updated private docs and project context: `docs/ARCHITECTURE.md`, `docs/MODULES.md`, `docs/TROUBLESHOOTING.md`, `docs/COMPLEX_FEATURE_PATHS.md`, `.agent-context/PROJECT_CONTEXT.md`, and this handoff.
  - Did not copy `.agent-context` from public, runtime state, local keys, uploads, or machine-specific diagnostics.
- Validation:
  - Public: focused tests passed 24/24; after code PR merge `npm.cmd test` passed 262/262, `npm.cmd run check` passed, `npm.cmd run check:macos` passed, `git diff --check HEAD~2..HEAD` passed, privacy scan passed, and BOM check passed. After the public docs follow-up, `npm.cmd test` again passed 262/262, `npm.cmd run check` passed, `npm.cmd run check:macos` passed, `git diff --check` passed, privacy scan passed, and BOM check passed.
  - Private after sync: focused tests passed 24/24; `npm.cmd test` passed 262/262; `npm.cmd run check` passed; `npm.cmd run check:macos` passed; `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings; privacy scan passed.
- Activation:
  - Server-side changes require restarting the 8787 Node listener.
  - Static frontend/PWA changes require clients to accept the refresh prompt, hard refresh, or close/reopen to load `codex-mobile-shell-v140`.

## Preserved Recent Handoff Tail

## 2026-05-29 Cross-Thread Task Card Planning Docs And Harness

- User request:
  - Before implementing cross-thread task cards, add dedicated requirement,
    design, and implementation docs plus a related harness.
  - The feature direction is:
    - source thread sends a pending task card to a target thread;
    - target user can approve to inject into message flow, delete, or reply;
    - source user can revoke while pending.
- Added docs:
  - `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`
  - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
  - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
  - `docs/README.md` now links the design doc from the reading guide.
  - `docs/COMPLEX_FEATURE_PATHS.md` now has a dedicated implementation path
    section for cross-thread task cards.
- Added harness:
  - `test/thread-task-card-harness.test.js`
  - This is an executable contract/state-machine harness, not the production
    implementation. It fixes the planned behavior for:
    - bounded create payloads;
    - target approve -> injected message;
    - target delete -> no injection;
    - source revoke while pending;
    - target reply -> reverse-direction controlled card.
- Added context references:
  - `.agent-context/PROJECT_CONTEXT.md`
  - `docs/MODULES.md` test map
- Status:
  - This step adds planning docs and harness only.
  - No cross-thread task-card product routes/UI/storage are implemented yet.

## 2026-05-29 Cross-Thread Task Cards v112

- User request:
  - Move from planning docs/harness into a real first implementation.
- Local implementation:
  - Added `adapters/thread-task-card-service.js`.
    - Normalizes bounded create/reply payloads.
    - Persists card state in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json` by default, or `CODEX_MOBILE_THREAD_TASK_CARD_FILE` when overridden.
    - Enforces source/target thread role checks, idempotency, and state transitions.
    - Approve triggers a real target-thread injection payload instead of a fake static message.
  - `server.js`
    - Instantiates the task-card service.
    - Adds routes:
      - `POST /api/thread-task-cards`
      - `GET /api/thread-task-cards/:id`
      - `POST /api/thread-task-cards/:id/approve`
      - `POST /api/thread-task-cards/:id/delete`
      - `POST /api/thread-task-cards/:id/revoke`
      - `POST /api/thread-task-cards/:id/reply`
    - Thread detail responses now attach bounded `thread.threadTaskCards`.
    - Target-side approve resumes the target thread if needed and injects a real new `turn/start` input into that thread.
  - `public/app.js`
    - Adds `threadTaskCards` render signature support.
    - Renders task cards in a separate stack outside normal turn items.
    - Adds per-card actions for approve, delete, revoke, and reply.
    - Adds a minimal `Send task card` entry in thread detail using prompt-based target/title/body capture.
    - Plugin route-target focus can now land on task-card DOM nodes through `data-task-card`.
  - `public/sw.js` / `public/app.js`
    - Shell cache/build bumped to `codex-mobile-shell-v112` / `0.1.11|codex-mobile-shell-v112`.
  - Tests:
    - Added `test/thread-task-card-service.test.js`
    - Added `test/thread-task-card-route.test.js`
    - Existing `test/thread-task-card-harness.test.js` kept green.
- Validation:
  - Focused `node --test test\thread-task-card-harness.test.js test\thread-task-card-service.test.js test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 13/13.
  - `npm.cmd test` passed: 223/223.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Server route/service changes require restarting the 8787 Node listener.
  - Static browser behavior changed too; clients need `codex-mobile-shell-v112`.
- Current boundary:
  - The task-card state machine and API are implemented.
  - The browser compose entry is intentionally minimal; target resolution currently depends on exact visible thread title or explicit thread id.
  - There is no live SSE push path for task-card updates yet; browser actions refresh thread detail after each mutation.

## 2026-05-29 `#` Natural-Language Thread Task Cards v113

- User request:
  - Reserve `#` in the composer so the current thread can issue natural-language
    cross-thread task-card commands.
  - Parse them into a task-card draft, then confirm before send.
- Local implementation:
  - Added `adapters/thread-task-card-intent-service.js`.
    - Strips leading `#`.
    - Parses a bounded set of command-like natural-language patterns.
    - Builds draft `title` / `summary` / `body`.
    - Scores target-thread candidates from visible threads/state and refuses to
      auto-select ambiguous matches.
  - `server.js`
    - Instantiates the intent parser service.
    - Adds `POST /api/thread-task-cards/parse`.
    - Uses visible thread metadata from `thread/list` with state-db/session-index fallback.
  - `public/app.js`
    - `#...` at the start of a message now bypasses the normal message-send path.
    - Sends the command to `/api/thread-task-cards/parse`.
    - Shows a browser confirmation dialog for the parsed draft.
    - On confirmation, creates a normal pending task card through the existing task-card API.
    - Bare `#`, missing target/body, attachments, and ambiguous targets fail closed with an error instead of silently sending.
  - `public/app.js` / `public/sw.js`
    - Shell build/cache bumped to `0.1.11|codex-mobile-shell-v113` / `codex-mobile-shell-v113`.
  - Tests:
    - Added `test/thread-task-card-intent-service.test.js`
    - Updated `test/thread-task-card-route.test.js`
    - Updated `test/mobile-viewport.test.js`
- Validation:
  - Focused `node --test test\thread-task-card-intent-service.test.js test\thread-task-card-service.test.js test\thread-task-card-route.test.js test\thread-task-card-harness.test.js test\mobile-viewport.test.js` passed: 16/16.
  - `npm.cmd test` passed: 223/223.
  - `npm.cmd run check` passed.
  - `git diff --check` passed with only existing Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Static browser behavior changed and server route changed.
  - Restart 8787 listener and refresh/reopen clients to load `codex-mobile-shell-v113`.
- Current boundary:
  - This is model-like natural-language command parsing but still bounded and conservative; it is not a free-form agent that can safely infer arbitrary targets.
  - The confirmation step remains mandatory before creating the pending task card.
## 2026-05-29 `#` Task-card Drafts v114

- User correction:
  - The dedicated `/api/thread-task-cards/parse` route and local regex command parser were the wrong architecture.
  - `#` commands should be interpreted by the current Codex thread, with the user approving the resulting draft before any real cross-thread card is created.
- Local implementation:
  - Removed `adapters/thread-task-card-intent-service.js` and the `POST /api/thread-task-cards/parse` route.
  - `public/app.js`
    - `#...` now sends through the normal current-thread message path, but the browser wraps the original command in a bounded draft-request envelope that includes the visible target-thread list and a required XML/JSON response schema.
    - User-message rendering hides that internal envelope and shows only the original `#` command text.
    - Agent/plan messages that return `<codex-mobile-thread-task-card-draft>...</codex-mobile-thread-task-card-draft>` now render as a local approval card instead of raw markdown.
    - Approving that draft creates a real pending task card through the existing task-card API; dismissing it stays local to the browser.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v114` / `codex-mobile-shell-v114`.
  - Tests/docs:
    - Removed `test/thread-task-card-intent-service.test.js`.
    - Updated task-card route tests, conversation render tests, composer draft tests, architecture, modules, troubleshooting, README, project context, and this handoff.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\conversation-render.test.js test\composer-draft.test.js test\thread-task-card-service.test.js test\thread-task-card-harness.test.js` passed: 29/29.
  - `node --check public\app.js` passed.
  - `node --check server.js` passed.
- Status:
  - This supersedes the earlier v113 parse-route path.
  - Server restart and client refresh are still required before `v114` becomes active everywhere.

## 2026-05-30 Task-card Draft Approve Visibility v115

- User report:
  - Clicking `Approve` on a `#`-generated task-card draft looked ineffective.
  - After a long wait the action ended, and the target thread appeared not to receive the pending card.
- Diagnosis:
  - Pending cards were already being persisted successfully in `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json`.
  - The perceived failure was mainly a visibility/UX problem:
    - source-side draft approval used a timestamped idempotency key, so repeated taps created duplicate pending cards;
    - the draft-approval path waited on a source-thread reread after creation, which could feel hung on large threads;
    - thread-list summaries did not expose incoming pending-card counts, so the target thread had no obvious badge;
    - the draft approval UI read `result.id` even though the route returns `{ ok, card }`.
- Local implementation:
  - `adapters/thread-task-card-service.js`
    - Added `pendingCountsForThread()` so thread summaries can expose pending incoming/outgoing counts without relying on bounded detail-card lists.
  - `server.js`
    - Thread-detail enrichment now adds:
      - `pendingTaskCardCount`
      - `pendingIncomingTaskCardCount`
      - `pendingOutgoingTaskCardCount`
    - Thread-list and fallback thread-list responses now also attach those summary counts.
  - `public/app.js`
    - Source-side draft approval now uses stable idempotency key `task-card-draft:<sourceThreadId>:<draftKey>`.
    - Corrected create-response handling to read `result.card.id`.
    - Added local summary/count updates after successful creation.
    - Added immediate target-thread open after successful draft approval instead of waiting for source-thread reread.
    - Thread-list rows now show an incoming `Task N` badge when `pendingIncomingTaskCardCount > 0`.
  - `public/styles.css`
    - Added task-badge styling for thread-list rows.
  - `public/app.js` / `public/sw.js`
    - Shell build/cache bumped to `0.1.11|codex-mobile-shell-v115` / `codex-mobile-shell-v115`.
- Validation:
  - Focused `node --test test\thread-task-card-service.test.js test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 8/8.
  - `node --check public\app.js` passed.
  - `node --check server.js` passed.
  - `git diff --check` passed with only existing Windows LF-to-CRLF working-copy warnings.
- Activation:
  - Server and frontend both changed.
  - Restart the 8787 Node listener.
  - Refresh/reopen clients to load `codex-mobile-shell-v115`.

## 2026-05-30 Task-card Target Focus v116

- Follow-up diagnosis:
  - Target-thread API responses already contained `thread.threadTaskCards`.
  - The remaining visibility bug was that pending cards render above the turn list, while opening a long target thread still followed the normal "show latest content" path and left the browser at the bottom.
- Local implementation:
  - `public/app.js`
    - After source-side `#` draft approval creates a card, Mobile Web now stores a local route-hint target for that exact task-card id.
    - The existing `applyPendingPluginRouteHintFocus()` path then scrolls the target thread directly to the pending task card after the thread loads, instead of leaving the user at the bottom of the long conversation.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v116` / `codex-mobile-shell-v116`.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `node --check public\app.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v116`.

## 2026-05-30 Task-card Bottom Placement v117

- User correction:
  - Cross-thread task cards should live at the bottom of the target thread, not above the historical conversation.
- Local implementation:
  - `public/app.js`
    - Reordered target-thread detail rendering so `threadTaskCards` now render after visible turns and detached approval cards.
    - Kept the exact-card route-hint focus path in place for cases where a specific pending card still needs direct focus.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v117` / `codex-mobile-shell-v117`.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `node --check public\app.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v117`.

## 2026-05-30 Hide Settled Task Cards v118

- User correction:
  - Once a cross-thread task card is approved, the card itself should get out of the way. Keeping a large approved card at the bottom can still obscure the newly injected turn.
- Local implementation:
  - `public/app.js`
    - `threadTaskCardsForThread()` now renders only `pending` cards in thread detail.
    - `approved`, `deleted`, `revoked`, and `replied` cards remain in runtime audit/state but no longer render in the conversation UI.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v118` / `codex-mobile-shell-v118`.
- Validation:
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
  - `node --check public\app.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v118`.

## 2026-05-30 Immediate Current-Thread Task Card Settlement v120

- User correction:
  - After target-side `Approve`, the current thread should remove the pending task card immediately.
  - Waiting until leave/re-enter to hide the card is too slow and makes it look like the action did not finish.
- Local implementation:
  - `public/app.js`
    - `incrementPendingIncomingTaskCardCount()` and `incrementPendingOutgoingTaskCardCount()` now also update the active `state.currentThread` counts when the current thread is the affected thread.
    - Added `settleCurrentThreadTaskCard(cardId, nextStatus, nextCard)` to mark the active current-thread card as settled locally and re-render immediately.
    - `mutateThreadTaskCard()` now calls that local settlement path as soon as approve/delete/revoke/reply returns successfully, before the follow-up `loadThread()` refresh finishes.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v120` / `codex-mobile-shell-v120`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js` passed: 5/5.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v120`.

## 2026-05-30 Foreground Current-Thread Silent Refresh v121

- User report:
  - Returning to Mobile Web from another app could show `Loading thread...` again for the already open current thread.
- Local implementation:
  - `public/app.js`
    - `resumeMobileSession()` now keeps an already open current thread rendered, silently refreshes the thread list, and schedules a lightweight current-thread refresh instead of blocking on a same-thread reload path.
    - `applyUrlThreadSelection()` now avoids re-opening the current thread through `loadThread()` when a URL hint already matches the active thread; it schedules a lightweight refresh instead.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v121` / `codex-mobile-shell-v121`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v121`.

## 2026-05-30 Startup Thread Opening Stabilization v122

- User report:
  - First load when opening directly into a thread still flashed the Workspace/recent-thread home screen before the target thread appeared.
- Local implementation:
  - `public/app.js`
    - `bootstrap()` now marks a startup thread-open-pending state when startup already knows a direct thread target from a saved thread id, URL `thread` hint, or Hermes plugin route-hint thread id.
    - While that state is pending, the first `loadThreads()` call stays silent and the main panel renders a stable `Opening thread...` placeholder instead of the Workspace/recent-thread home view.
    - The pending state clears as soon as the real thread opens or startup falls back to the normal home/new-thread path.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v122` / `codex-mobile-shell-v122`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v122`.

## 2026-05-30 Hermes Embed Recovering State v123

- User report:
  - Hermes plugin startup could still flash a red `Codex` auth/session error panel, then succeed after one more refresh.
- Local implementation:
  - `public/app.js`
    - Added `showPluginEmbedRecovering()` for embed-mode launch/session/auth failures that already request a Hermes-side iframe refresh.
    - `onUnauthorized`, launch-session exchange failure, missing plugin session, and bootstrap unauthorized-session recovery now keep the iframe in a neutral recovering state instead of showing the red plugin auth/login panel first.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v123` / `codex-mobile-shell-v123`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\mobile-viewport.test.js test\thread-task-card-route.test.js test\hermes-plugin-route.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v123`.

## 2026-05-30 Task-card Draft/Approve Feedback Stabilization v124

- User report:
  - Before the formal cross-thread draft card appeared, the conversation could briefly show raw XML/code from the bounded draft schema.
  - `#` draft generation had no visible in-thread progress state while the current turn was still producing the draft.
  - Target-side `Approve` could look hung even after the backend had started injection, because the current thread reused the same-thread `loadThread()` cache path and did not immediately show the injected turn.
  - Pending task cards and draft cards were too large because the full body rendered immediately.
- Local implementation:
  - `public/app.js`
    - Added pending draft placeholders for `#` command turns while the current live turn is still generating a draft.
    - Suppresses raw `<codex-mobile-thread-task-card-draft>...</...>` streaming text until a valid draft block is ready.
    - Changed `refreshCurrentThreadAfterTaskCard()` to use `refreshCurrentThread()` instead of same-thread `loadThread()`.
    - Added `waitForCurrentThreadTurn()` so target-side `Approve` briefly polls for the returned injected `turnId` and then focuses that turn directly once it becomes visible.
    - Pending task-card drafts and pending task cards now render as medium cards with a visible summary line and collapsed details/body.
  - `public/styles.css`
    - Added collapsed task-card detail styling via `.approval-summary-line` and `.approval-details`.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v124` / `codex-mobile-shell-v124`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js test\mobile-viewport.test.js test\conversation-render.test.js` passed: 21/21.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v124`.

## 2026-05-30 Hermes Embed Action Visibility And PR Routing v125

- User report:
  - In Hermes embed mode, the version pill plus `Restart` / `Public PR` controls disappeared from the sidebar header.
  - Thread-level actions such as `压缩续接` were unreliable because the embed experience still depended on long-press only.
  - Accepting the public-PR prompt could prepare the merge-review task inside an unrelated currently open Hermes/Agent thread instead of the Codex Mobile Web workspace.
- Local implementation:
  - `public/styles.css`
    - Hermes embed now hides only `.main .version-actions`, leaving the sidebar header version-action row visible.
    - Added `.thread-card-menu-button` styling for an explicit thread action button in embed thread rows.
  - `public/app.js`
    - Embed thread rows now render a direct `⋯` action button that opens the existing action sheet without relying only on long-press timing.
    - Added `handleThreadMenuButtonClick()`.
    - `preparePublicPrMergePrompt()` now clears the current thread selection, opens a new-thread draft for `state.appWorkspacePath`, and places the review task text there instead of reusing the currently open thread.
    - Client startup now stores `config.workspacePath` from `/api/public-config` in `state.appWorkspacePath`.
  - `server.js`
    - `/api/public-config` now includes `workspacePath: APP_ROOT` so the browser can route public-PR review tasks back into this workspace.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v125` / `codex-mobile-shell-v125`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\app-update.test.js test\manual-restart-ui.test.js test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed: 13/13.
- Activation:
  - Frontend and server changed.
  - Restart the 8787 Node listener, then refresh/reopen clients to load `codex-mobile-shell-v125`.

## 2026-05-30 Hermes Embed Continuation Dialog Fix v126

- User correction:
  - The real embed bug was not missing access to the thread action sheet itself.
  - Long-press was already enough to open the menu, but choosing `压缩续接` did not show the confirmation popup inside the Hermes plugin iframe.
- Local implementation:
  - `public/app.js`
    - Replaced the `window.confirm(...)` continuation confirmation path with an in-app `#continuationDialog` flow.
    - Added `openContinuationDialog()`, `closeContinuationDialog()`, and `continuationDialogOpen()` so `压缩续接` can confirm entirely inside the iframe.
    - Hermes plugin back handling now closes the continuation dialog before falling through to other navigation layers.
    - Removed the earlier experimental embed-only thread-row menu button path and went back to the original long-press action-sheet trigger.
  - `public/index.html`
    - Added the continuation confirmation dialog markup.
  - `public/styles.css`
    - Added continuation-dialog styling and removed the temporary `.thread-card-menu-button` styling.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v126` / `codex-mobile-shell-v126`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\app-update.test.js test\manual-restart-ui.test.js test\mobile-viewport.test.js test\thread-task-card-route.test.js` passed: 13/13.
- Activation:
  - Static frontend change only for the continuation dialog itself.
  - The earlier v125 `/api/public-config.workspacePath` server fix still requires the 8787 Node listener restart if it has not been restarted yet.
  - Refresh/reopen clients to load `codex-mobile-shell-v126`.

## 2026-05-30 Restart Readiness Harness

- User report:
  - A restart attempt stopped the old `8787` listener, but Mobile Web did not come back immediately and the browser became unusable until a later Desktop-side recovery.
- Local follow-up:
  - Added a focused harness for `restart-codex-mobile-shared-chain.ps1` so future edits keep the correct success definition:
    - wait for both HTTP readiness and mux endpoint readiness;
    - only log `Shared-chain restart finished.` after `Wait-Ready`;
    - timeout if replacement readiness never arrives.
  - Updated README, troubleshooting, and project context to state the operational rule:
    - "old listener exited" does not count as restart success;
    - success requires a new `8787` listener plus reachable `/api/public-config`.

## 2026-05-30 Hermes Plugin Refresh Notice Emphasis v128

- User feedback:
  - The new in-app "Refreshing plugin page..." notice was visible, but its color blended in too much with ordinary history notes.
- Local implementation:
  - `public/styles.css`
    - Added a stronger warning-like `plugin-refresh-pending` visual treatment with higher-contrast text/background/border.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v128` / `codex-mobile-shell-v128`.
- Validation:
  - Focused `node --test test\hermes-plugin-route.test.js test\mobile-viewport.test.js` passed as part of the current frontend regression set.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v128`.

## 2026-05-30 Draft Persistence And Timed Refresh Notice v129

- User report:
  - In the source thread, a `#`-generated cross-thread draft card could disappear immediately after `Approve`, but then reappear after leaving and re-entering the thread.
  - Hermes plugin refresh notices should explain an automatic host-driven refresh, but should not remain visible indefinitely.
- Local implementation:
  - `public/app.js`
    - Added durable browser storage for settled source draft-card state under `codexMobileThreadTaskCardDraftStates`.
    - `setThreadTaskCardDraftState()` now persists durable states through `saveThreadTaskCardDraftStates()`.
    - `renderTurnThreadTaskCardDraft()` now suppresses source draft cards whose stored state is already `created` or `dismissed`, preventing old draft XML from recreating visible source cards after thread re-entry.
    - Added `clearPluginRefreshPendingNotice()` plus a 10-second timeout in `requestHermesPluginRefresh()` so the Hermes embed refresh notice auto-clears when the host refresh does not immediately replace the page.
    - Recovering states such as `showPluginEmbedRecovering()` now clear any pending refresh notice first.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v129` / `codex-mobile-shell-v129`.
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\hermes-plugin-route.test.js test\mobile-viewport.test.js test\thread-task-card-route.test.js test\conversation-render.test.js` passed.
- Activation:
  - Static frontend change only.
  - Refresh/reopen clients to load `codex-mobile-shell-v129`.

## 2026-05-30 Public PR #41 Merge And Safe-Area Sync v130

- User request:
  - Push the current public update first, then merge public PR `#41` (`修复 PWA 底部输入栏安全区遮挡`).
- Public repository:
  - Public-safe current private changes were synced to `C:\Users\xuxin\Documents\codex-mobile-web-public`, validated, committed, and pushed as `2e1c63a 发布 Hermes 插件续接确认修复、跨线程卡片持久化与刷新提示收口`.
  - PR `#41` could not be merged by GitHub directly because `main` had moved and the PR had conflicts against the newer Hermes/task-card/frontend work.
  - The PR head was fetched locally as `pr-41`, merged into public `main` with manual conflict resolution, and pushed as merge commit `0d89f28 Merge pull request #41 from franksong2702/fix-pwa-composer-safe-area`.
  - The resolved merge preserved current Hermes/task-card functionality and also kept the PR's PWA bottom safe-area composer padding fix.
- Private follow-up:
  - Synced the merged product files back into the private workspace to avoid drift:
    - `public/app.js`
    - `public/sw.js`
    - `public/styles.css`
    - `README.md`
    - `test/composer-quota.test.js`
    - `test/mobile-viewport.test.js`
    - `test/thread-task-card-route.test.js`
  - Static shell build/cache is now `0.1.11|codex-mobile-shell-v130` / `codex-mobile-shell-v130`.
- Validation:
  - Public focused tests for app-update, Hermes plugin route, manual restart UI, mobile viewport, thread-task-card route, and composer quota passed.
  - Public `npm.cmd test`, `npm.cmd run check`, and `git diff --check` passed before the merge commit was pushed.
  - GitHub now reports PR `#41` as `MERGED` with merge commit `0d89f28a4cd317829823d96deeaeda1eb62e31b2`.

## 2026-05-30 Mobile Workspace Creation v131

- User request:
  - Add a create-workspace feature, but place the entry at the bottom of the
    Workspace dropdown list instead of beside the new-thread button.
- Local implementation:
  - Added `adapters/workspace-registry-service.js`.
    - Creates or registers a simple local workspace folder under allowed parent
      roots.
    - Rejects absolute paths, path traversal, slash/backslash names, invalid
      Windows filename characters, and reserved Windows device names.
    - Stores only bounded metadata in
      `%USERPROFILE%\.codex-mobile-web\workspace-registry.json` by default.
    - Uses `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS` for allowed parent roots and
      `CODEX_MOBILE_WORKSPACE_REGISTRY_FILE` for registry-file override.
  - `server.js`
    - `GET /api/workspaces` now merges Codex-visible roots with Mobile
      Web-created registry roots.
    - `POST /api/workspaces` creates/registers a workspace through the adapter.
    - `visibleWorkspaceRoots()` includes registry roots so new-thread
      visibility checks accept Mobile Web-created cwd values without editing
      `.codex` global state.
    - `/api/public-config` exposes safe `workspaceCreate` diagnostics.
  - `public/app.js`, `public/index.html`, `public/styles.css`
    - Workspace dropdown appends a bottom `Create Workspace` action.
    - Creation opens a small dialog, then selects the created cwd and opens a
      new-thread draft.
    - The new-thread button placement is unchanged; no extra button was added
      beside it.
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v131` / `codex-mobile-shell-v131`.
  - Documentation updated in README, Architecture, Modules, Troubleshooting,
    Complex Feature Paths, and this handoff.
- Validation:
  - `node --check adapters\workspace-registry-service.js`, `node --check
    server.js`, `node --check public\app.js`, and `node --check public\sw.js`
    passed.
  - Focused `node --test test\workspace-registry-service.test.js
    test\new-thread-route.test.js test\mobile-viewport.test.js
    test\new-thread-ui.test.js test\thread-task-card-route.test.js` passed:
    22/22.
  - Hidden-window rerun after Windows process recovery:
    - focused tests passed: 22/22;
    - `npm.cmd run check` passed;
    - `git diff --check` passed with only Windows LF-to-CRLF working-copy warnings;
    - `npm.cmd test` passed: 233/233;
    - `npm.cmd run check:macos` passed.
- Status:
  - Local changes are uncommitted.

## 2026-05-31 Composer Fast Dot Toggle v139

- User request:
  - Add a Codex Fast switch, not a Spark-model switch or reasoning-effort change.
  - Place it in the runtime row before model/reasoning/permission/quota while
    keeping the footprint minimal.
- Local fix:
  - `public/index.html`
    - Added `composerCommandControl` before `composerModelControl` as a tiny
      Fast status dot instead of a full-width command card.
  - `public/app.js`
    - Added persistent `codexMobileCodexFastMode` browser state.
    - The dot toggles directly: green is normal mode, red is Fast mode.
    - Toggling briefly shows `Fast on` / `Fast off` in the connection status
      area and updates the button title / `aria-label`.
    - When Fast is enabled, normal existing-thread and new-thread message
      submissions include hidden `fastMode=1` instead of adding visible `/Fast`
      text.
  - `server.js`
    - Maps requested `fastMode` to Codex `serviceTier: "priority"` on the next
      `turn/start`, matching the Fast service tier exposed in
      `%USERPROFILE%\.codex\models_cache.json`.
    - The Fast toggle does not change model, reasoning effort, permission mode,
      quota grouping, or Spark model selection.
    - `#` cross-thread task-card commands keep their bounded draft-request flow
      and active-turn steering waits until the next new turn for the speed tier.
  - `public/styles.css`
    - Composer runtime row now uses a left-aligned 18px Fast dot column before
      model, reasoning, permission, and quota.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v139` / `codex-mobile-shell-v139`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/MODULES.md`
- Validation/status:
  - `node --check public\app.js` and `node --check public\sw.js` passed.
  - Focused `node --test test\composer-quota.test.js
    test\mobile-viewport.test.js test\tablet-layout.test.js
    test\new-thread-route.test.js` passed: 19/19.
  - Focused `node --test test\thread-task-card-route.test.js
    test\composer-quota.test.js test\mobile-viewport.test.js
    test\tablet-layout.test.js test\new-thread-route.test.js` passed: 22/22.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restart was attempted after validation but was interrupted by the next user
    request. Last observed 8787 listener before the v139 restart was PID
    `29792`, still serving the pre-bump runtime.
  - The last authenticated `/api/status` check before the v139 restart attempt
    was healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Static frontend/PWA change requires restarting/reloading the Mobile Web
    listener and clients refreshing/reopening to load v139
    after deployment.

## 2026-05-31 Public Sync v139

- User request:
  - Push the current private product state to the clean public repository.
- Public repository:
  - Path: `C:\Users\xuxin\Documents\codex-mobile-web-public`
  - Commit pushed: `d66cc63 发布 Hermes 外观同步、跨线程卡片修复与 Fast 圆点`
  - Remote branch: `origin/main`
- Scope:
  - Synchronized public-safe product, docs, scripts, and tests from private
    through v139.
  - Excluded `.agent-context`, `AGENTS.md`, runtime state, uploads, keys, and
    machine-local diagnostics.
  - Added a detailed Chinese public README release note covering Hermes
    appearance sync, notification title resolution, task-card re-entry /
    source Sending fixes, autonomous workflows, workspace registry, and the
    Fast dot service-tier toggle.
- Public validation:
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` / staged check passed with only Windows LF-to-CRLF
    working-copy warnings.
  - BOM check had no output.
  - Staged privacy scan found no raw secrets.
- Status:
  - Public repository is clean and aligned with `origin/main`.
  - Private repository product code remains clean; this handoff entry is the
    only follow-up private context update.

## 2026-05-31 Hermes Plugin HTTPS Manifest Runtime Fix

- User report:
  - The Hermes embedded Codex plugin eventually opened, but its settings page
    showed an update-settings check failure.
- Diagnosis:
  - `/api/public-config` was reachable and returned
    `0.1.11|codex-mobile-shell-v131`.
  - Authenticated `/api/status` was healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Authenticated `/api/app-update/status?force=1` did not fail; it returned
    `state=blocked`, `reason=working tree has local changes`, `dirty=true`.
    That is expected while v131 local changes are uncommitted.
  - The Hermes plugin manifest for
    `hermesOrigin=https://hermes-xuxin.synology.me:8445` still returned
    `entry.url=http://127.0.0.1:8787/?embed=hermes` and
    `program_api.base_url=http://127.0.0.1:8787`, because the running
    windowless supervisor had been started without `-HermesPluginBaseUrl` or
    `-PublicBaseUrl`.
  - The `Codex Mobile Web` scheduled task was updated, but the old windowless
    supervisor kept running with stale arguments until its specific process tree
    was stopped.
- Runtime fix:
  - Updated the `Codex Mobile Web` Scheduled Task arguments to include:
    - `-HermesPluginBaseUrl "https://gmk.tail62e8ce.ts.net:8443"`;
    - `-PublicBaseUrl "https://gmk.tail62e8ce.ts.net:8443"`;
    - `-HermesPluginFrameOrigins "https://hermes-xuxin.synology.me:8445"`;
    - existing Hermes notification delegate base URL and key-file parameters.
  - Stopped only the verified stale Mobile Web process tree for this workspace:
    the old `server.js` listener, its `start-codex-mobile-web-windowless.ps1`
    parent, and the hidden VBS launcher parent.
  - Started the updated `Codex Mobile Web` scheduled task.
- Verification:
  - New 8787 listener PID `21640` is parented by
    `start-codex-mobile-web-windowless.ps1` with the new
    `-HermesPluginBaseUrl`, `-PublicBaseUrl`, and `-HermesPluginFrameOrigins`
    arguments.
  - Manifest now returns:
    - `entry.url=https://gmk.tail62e8ce.ts.net:8443/?embed=hermes`;
    - `program_api.base_url=https://gmk.tail62e8ce.ts.net:8443`;
    - `frame_ancestors='self' https://hermes-xuxin.synology.me:8445`;
    - empty mixed-content diagnostics.
  - Authenticated `/api/status` remains healthy.
- Status:
  - This was an operational scheduled-task/runtime fix plus context update.
  - No code was changed for this fix, and nothing was committed or pushed.

## 2026-05-31 Thread Task Card Route Error-Code Closure

- User request:
  - Confirm the cross-thread task-card implementation was not affected by the
    recent runtime/startup rollback work, then close the small issue found and
    commit/push.
- Diagnosis:
  - CodeGraph and direct inspection confirmed the card implementation still
    exists:
    - `adapters/thread-task-card-service.js`;
    - `/api/thread-task-cards*` routes in `server.js`;
    - `thread.threadTaskCards` detail enrichment;
    - frontend `#` draft path, pending-card rendering, and approve/focus logic.
  - Focused harness passed for card creation, target approval injection, delete,
    revoke, reply, route exposure, thread-detail enrichment, frontend signatures,
    and XML-suppression.
  - A no-side-effect runtime probe for a missing card reached the route but
    returned a generic 500. The service already throws `statusCode=404`; the
    route was letting that escape to the top-level 500 handler.
- Local fix:
  - `server.js`
    - Wrapped all thread-task-card routes (`create`, `get`, `approve`, `delete`,
      `revoke`, `reply`) in route-local error handlers that preserve
      `err.statusCode || 500`.
    - Missing-card reads now return `404 task_card_not_found`; wrong-thread and
      settled-card actions can return their existing `403` / `409` service codes.
  - `test/thread-task-card-route.test.js`
    - Added a static harness assertion that the route block preserves service
      status codes for all six task-card routes.
  - `docs/TROUBLESHOOTING.md`
    - Documented expected `404` / `403` / `409` task-card API diagnostics.
- Status:
  - Validation:
    - `node --check server.js` passed.
    - Focused `node --test test\thread-task-card-harness.test.js
      test\thread-task-card-service.test.js test\thread-task-card-route.test.js
      test\conversation-render.test.js test\mobile-viewport.test.js` passed:
      31/31.
    - `npm.cmd test` passed: 234/234.
    - `npm.cmd run check` passed.
    - `npm.cmd run check:macos` passed.
    - `git diff --check` passed with only Windows LF-to-CRLF warnings.
  - Deployment:
    - Restarted the verified stale Mobile Web process tree and started the
      `Codex Mobile Web` scheduled task.
    - New 8787 listener PID is `29796`.
    - Runtime missing-card probe now returns HTTP `404` instead of generic `500`.
  - Commit/push are the next required steps in this turn.

## 2026-05-31 Multi-Target Task Cards And Embed Primary Startup v132

- User request:
  - Let cross-thread task cards target multiple threads.
  - In Hermes plugin mode, do not automatically enter the most recent/restored
    Codex thread.
- Local implementation:
  - `adapters/thread-task-card-service.js`
    - Added `createMany()` and multi-target normalization.
    - A batch request expands to one stored pending card per unique target
      thread, with target-specific idempotency keys.
    - The existing single-target `create()` path remains compatible.
  - `server.js`
    - `POST /api/thread-task-cards` now accepts either `targetThreadId` or
      `targetThreadIds`.
    - The response keeps `card` for old callers and adds `cards` for the full
      batch result.
  - `public/app.js`
    - `#` draft prompts now ask the model for `targetThreadIds`.
    - Draft parsing still accepts legacy `targetThreadId`.
    - Source-side draft approval creates all target cards in one request.
    - Single-target drafts still open the target thread directly; multi-target
      drafts stay on the source thread and update outgoing/incoming card counts.
    - The manual `Send task card` prompt accepts comma/semicolon/newline
      separated target names or ids.
    - Hermes `?embed=hermes` startup ignores locally saved recent thread restore
      when there is no explicit launch target, URL thread hint, or Hermes route
      hint, so the plugin opens on the embedded primary thread-switcher/settings
      page.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to `0.1.11|codex-mobile-shell-v132` /
      `codex-mobile-shell-v132`.
  - Documentation updated:
    - README, Architecture, Modules, Complex Feature Paths, Cross-Thread design
      and implementation docs, Project Context, and this handoff.
- Validation:
  - `node --check adapters\thread-task-card-service.js`, `node --check server.js`,
    `node --check public\app.js`, and `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-route.test.js test\conversation-render.test.js
    test\mobile-viewport.test.js test\plugin-embed.test.js` passed: 33/33.
  - `npm.cmd test` passed: 235/235.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Deployment:
  - Restarted the 8787 Node listener: old PID `29796`, new PID `50680`.
  - `/api/public-config` now returns
    `clientBuildId=0.1.11|codex-mobile-shell-v132` and
    `shellCacheName=codex-mobile-shell-v132`.
  - Authenticated `/api/status` remains healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes are uncommitted.
  - Static frontend/PWA changes require clients to refresh/reopen to load v132.

## 2026-05-31 Hermes Plugin Appearance Sync v133

- User request:
  - When Hermes opens embedded plugins, pass the current tone/theme and font
    settings into the plugin and make the plugin apply them before initializing,
    so the iframe does not flash the wrong appearance.
  - After Codex implementation, send cross-thread task cards to the Hermes/Codex,
    Finance, and Wardrobe-related threads for host/plugin cooperation.
- Local implementation:
  - `adapters/hermes-plugin-service.js`
    - Added a metadata-only `appearance_sync` manifest contract.
    - `POST /api/v1/hermes/plugin/launch` now accepts bounded
      `appearance.theme` (`system`, `dark`, `light`) and
      `appearance.fontSize` (`small`, `default`, `large`, `xlarge`,
      `xxlarge`).
    - The short `entry_path` carries only safe `pluginTheme` /
      `pluginFontSize` query params, and `/session` returns the same sanitized
      `appearance` object.
  - `public/plugin-embed.js`
    - Parses bounded appearance query params alongside launch and route hints.
  - `public/index.html`
    - Applies plugin theme and font size before `styles.css` and `public/app.js`
      load, reusing local preferences only when Hermes provides no appearance.
  - `public/app.js`
    - Applies session appearance after launch-token exchange, preserves safe
      appearance params when scrubbing the launch token, and keeps standalone
      `localStorage` preferences unchanged outside embed mode.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v133` / `codex-mobile-shell-v133`.
  - Documentation updated:
    - README, Architecture, Modules, Complex Feature Paths, Project Context,
      and this handoff.
- Validation/status:
  - `node --check adapters\hermes-plugin-service.js`,
    `node --check public\plugin-embed.js`, `node --check public\app.js`, and
    `node --check public\sw.js` passed.
  - Focused `node --test test\hermes-plugin-service.test.js
    test\hermes-plugin-route.test.js test\plugin-embed.test.js
    test\mobile-viewport.test.js` passed: 25/25.
  - `npm.cmd test` passed: 237/237.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - Deployment:
    - The first `/api/restart/shared-chain` request returned accepted but did
      not change the 8787 listener PID, so the service was restarted through the
      Windows scheduled task path with explicit old-PID verification.
    - Old listener PID `50680` was stopped; new listener PID `47248` is serving
      `clientBuildId=0.1.11|codex-mobile-shell-v133` and
      `shellCacheName=codex-mobile-shell-v133`.
    - Authenticated `/api/status` is healthy:
      `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
      `lastError=null`.
    - Manifest probe for Hermes HTTPS origin returns the HTTPS Codex entry,
      `appearance_sync`, registered frame ancestor, and no mixed-content
      diagnostics.
    - Launch/session probe with `appearance.theme=light` and
      `appearance.fontSize=xlarge` returned safe `pluginTheme` /
      `pluginFontSize` in `entry_path` and sanitized session `appearance`
      without leaking the injected test field.
  - Cross-thread cards:
    - A first PowerShell-sent Chinese JSON request created mojibake task-card
      content. Two pending cards were revoked. The Wardrobe card had already
      been approved into turn `019e7b62-f45c-78f1-81f3-05b49d7c14ed`, so that
      bad turn was interrupted and left in `interrupted` state.
    - Replacement ASCII/UTF-8-safe pending cards were created:
      `ttc_4ea4082609d6e8fa1d` for Hermes 05-26,
      `ttc_c720ba1fe6eb724c97` for Finance, and
      `ttc_cb2fdc78f4ca2b3098` for Wardrobe.
  - Local changes are uncommitted.
  - Static frontend/PWA changes require clients to refresh/reopen or receive a
    Hermes plugin refresh to load v133.

## 2026-05-31 Thread Task Card Sending Harness Hardening

- User request:
  - Solidify the cross-thread task-card sending flow with harness coverage after
    a manual PowerShell-sent Chinese JSON request created duplicate/mojibake
    cards.
  - Also send the appearance-sync coordination card to the Finance thread.
- Local implementation:
  - `adapters/thread-task-card-service.js`
    - Added a readable visible-text guard for task-card `title`, `summary`, and
      `body`.
    - The service now rejects likely encoding-damaged card text before
      persistence, including replacement characters, typical UTF-8/Latin-1
      mojibake markers, and high-density repeated `?` clusters such as
      `?? Hermes ?????? v133`.
    - Oversized optional source-thread title metadata is truncated to its
      existing 200-character bound instead of failing otherwise valid card
      creation. Visible card title/summary/body bounds still reject over-limit
      content.
  - Harness/tests:
    - `test/thread-task-card-harness.test.js` now asserts encoding-damaged
      visible card text is rejected.
    - `test/thread-task-card-service.test.js` now covers UTF-8 card text
      preservation, stable idempotency, bad-text rejection before store writes,
      replacement-character rejection, oversized source-title metadata bounding,
      and reply bad-text rejection without settling the original card.
  - Documentation updated:
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - Focused `node --test test\thread-task-card-harness.test.js
    test\thread-task-card-service.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js` passed: 34/34.
  - `npm.cmd test` passed: 243/243.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime verification:
  - Restarted the 8787 Node listener after the service change: old PID `60804`,
    new PID `57788`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `lastError=null`.
  - Runtime bad-card probe returned HTTP `400` with
    `task_card_text_encoding_damaged:title` and did not persist the probe card.
- Finance card:
  - Sent a replacement safe ASCII task card to Finance thread
    `019e6e22-e3d3-7e60-bcc2-027d40895193`.
  - New card id: `ttc_fccaf8f25a9438d02e`.
  - Status after runtime verification: `pending`.
- Status:
  - Local changes remain uncommitted.
  - No public repository sync was performed.

## 2026-05-31 Source-Side Task Card Auto-Send v134

- User report:
  - A feature had regressed: when sending a cross-thread card from the source
    thread, the source thread should not require a local approval step. The
    target thread is where `Approve` belongs.
- Diagnosis:
  - `public/app.js` still rendered the parsed `#` command draft as a
    source-side `Cross-thread task card draft` approval card with
    `data-task-card-draft-action="approve"`.
  - `.agent-context/PROJECT_CONTEXT.md` and README still described the older
    source-side approval behavior, so the current code and docs both reflected
    the stale rule.
- Local fix:
  - `public/app.js`
    - A valid parsed `#` draft now queues automatic pending-card creation via
      `queueThreadTaskCardDraftCreation()` / `createThreadTaskCardDraft()`.
    - The shipped source-side draft UI no longer includes
      `data-task-card-draft-action="approve"` and no longer references
      `approveThreadTaskCardDraft`.
    - While the automatic create request is in progress, the source turn shows
      only a short `Sending cross-thread task card...` placeholder.
    - If the model draft is incomplete or names missing target threads, the
      source thread shows a bounded failed diagnostic that can be dismissed.
    - Target-side pending cards still keep `Approve`; only target approval
      injects a real target-thread turn.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v134` / `codex-mobile-shell-v134`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
    - `docs/MODULES.md`
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - `npm.cmd test` passed: 243/243.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
- Status:
  - Local changes remain uncommitted.
  - Static frontend/PWA change requires clients to refresh/reopen or receive a
    Hermes plugin refresh to load v134.

## 2026-05-31 Target Task Card Approve Compaction Race Fix

- User report:
  - A target-thread cross-thread task card was approved and began executing,
    but a continuation compaction happened during that window. After compaction,
    the same actionable `Approve` card appeared again even though the injected
    target turn was already running.
- Diagnosis:
  - `adapters/thread-task-card-service.js` previously called the external
    target-thread `turn/start` path while the card still had `status=pending`,
    and only persisted `approved` after that external call returned.
  - Any thread refresh, reconnect, or continuation compaction during that
    in-flight window could re-read the task-card store and render a duplicate
    pending approval card.
- Local fix:
  - `approve()` now persists a transient non-pending `approving` state before
    calling the external injected-turn path.
  - `approving` cards do not count as pending and are not actionable in thread
    detail, so refresh/compaction cannot resurrect a second `Approve` button.
  - If external execution fails before acceptance, the service restores the
    card to `pending` with a bounded `approvalError` audit field so the target
    can retry.
  - Documentation updated in README, Architecture, Modules, Cross-Thread design
    and implementation docs, Project Context, and this handoff.
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js` passed: 37/37.
  - `npm.cmd test` passed: 246/246.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime verification:
  - Restarted the 8787 Node listener by stopping old PID `57788`; the existing
    hidden windowless launcher restarted it as PID `49964`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v134` and
    `shellCacheName=codex-mobile-shell-v134`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
- Status:
  - Local changes remain uncommitted.
  - This is server-side service behavior; no static shell cache bump was
    required.

## 2026-05-31 Hermes Plugin Notification Thread Title Fix

- User report:
  - Web Push / Hermes plugin delegated notifications did not show the correct
    Codex thread name; the posted notification title could use a wrong generic
    plugin/post label.
  - Follow-up screenshot showed the top external notification title as the
    old continuation bootstrap prompt (`# 压缩续接启动上下文...`) instead of
    `Codex Mobile 05-26`.
- Diagnosis:
  - The local `state_5.sqlite` row for the current thread still carried the
    old bootstrap prompt as `title` / `first_user_message`.
  - The first resolver fix was insufficient because completed-turn events may
    not carry an explicit thread name, and `pushThreadSummary()` still checked
    SQLite before any app-server display summary.
- Local fix:
  - `adapters/push-notification-service.js`
    - Added `resolveThreadTitleForNotification()`.
    - Completed-turn notification title resolution now prefers explicit
      app-server thread names/titles, including nested `turn.thread.name` and
      `turn.thread.title`, before stale started-turn labels or preview text.
    - Persisted thread `name` wins over persisted `preview`; preview remains
      only a fallback.
    - Owns the bounded app-server display-summary cache used by notification
      title resolution before the local SQLite fallback.
  - `server.js`
    - Uses the new resolver for both direct Web Push and Hermes plugin
      delegated notifications.
    - Instantiates the adapter-owned display cache and populates it from
      successful app-server `thread/list` and `thread/read` display summaries.
    - `pushThreadSummary()` now checks this app-server display cache before
      the local SQLite fallback so stale continuation bootstrap titles do not
      win over the name the Mobile Web UI is already showing.
    - Completed-turn notification sending refreshes the app-server summary
      before delivery when the display cache is empty, so a freshly restarted
      server is not forced back to the stale SQLite title.
  - Documentation updated:
    - README
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `.agent-context/PROJECT_CONTEXT.md`
    - this handoff.
- Validation:
  - `node --check adapters\push-notification-service.js` passed.
  - `node --check server.js` passed.
  - Focused `node --test test\push-notification-service.test.js
    test\hermes-notification-delegate-service.test.js
    test\hermes-plugin-route.test.js` passed: 28/28.
  - `npm.cmd test` passed: 252/252.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Deployment/runtime verification:
  - Restarted the 8787 Node listener through the Windows scheduled-task
    configuration, then stopped the old child Node PID `65488` and relaunched
    with the same hidden scheduled-task parameters. Final listener PID after
    the service-boundary follow-up: `82632`.
  - `/api/public-config` still returns
    `clientBuildId=0.1.11|codex-mobile-shell-v134` and
    `shellCacheName=codex-mobile-shell-v134`; Hermes notification delegate is
    configured and `imageContextMode=reference`.
  - Authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Authenticated `/api/threads?limit=200` finds current thread
    `019e63ea-b64f-7e93-a92f-4c1dd9a79326` with display `name=Codex Mobile
    05-26` while its preview still starts with the old continuation bootstrap,
    confirming the display-summary source needed for Push titles.
- Status:
  - This entry is included in the local private commit for the notification
    title fix and service-boundary cleanup; use `git log -1 --oneline` for the
    final commit hash.
  - Public repository was not synced or pushed.
  - This is server-side notification behavior; no static shell cache bump is
    required.

## 2026-05-31 Cross-Thread Autonomous Workflow v135

- User request:
  - Cross-thread task-card collaboration should support a special workflow in
    which only the first card requires human approval. After that approval, the
    cooperating threads can send cards back and forth inside the same workflow
    without another manual approval click.
- Local fix:
  - `adapters/thread-task-card-service.js`
    - Store now preserves an optional `workflows` array alongside `cards`.
    - Create/reply normalization accepts `workflowMode` and `workflowId`.
    - Ordinary cards remain manual.
    - `workflowMode="autonomous"` creates an autonomous workflow card with a
      bounded workflow id. If no id is supplied, the service derives a stable
      id from source thread, target thread, and idempotency key.
    - The first target-side approval executes normally, then activates a
      workflow grant scoped to the workflow id plus the unordered pair of the
      source and target thread ids.
    - Later pending cards with the same workflow id and same two thread ids use
      the same approval/injection path automatically. A reused workflow id with
      a different thread pair stays pending and needs its own first approval.
    - Automatic execution still persists `approving` before external
      `turn/start`; if injection fails before acceptance, the card is restored
      to `pending` with a bounded audit error.
  - `public/app.js`
    - `#` draft schema now lets the model return
      `workflowMode:"manual|autonomous"` and optional `workflowId`.
    - Draft rules tell the model to use autonomous mode only when the command
      explicitly asks for automatic/no-further-approval collaboration.
    - First autonomous target cards label the action as `Approve workflow` and
      show workflow id/status in details.
    - Source-side pending counters only increment for returned cards that are
      still `pending`, so auto-approved follow-up cards do not create stale
      task badges.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v135` / `codex-mobile-shell-v135`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/TROUBLESHOOTING.md`
    - `docs/COMPLEX_FEATURE_PATHS.md`
    - `docs/CROSS_THREAD_TASK_CARDS_REQUIREMENTS.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - `node --check adapters\thread-task-card-service.js` passed.
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    44/44.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source, test, docs, README, and context files had no
    output.
- Status:
  - Local changes are uncommitted.
  - Restarted the 8787 Node listener after the service/frontend change:
    old PID `82632`, new PID `88428`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v135`,
    `shellCacheName=codex-mobile-shell-v135`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - This is both server-side task-card behavior and static frontend/PWA
    behavior. Open clients need the refresh prompt, hard refresh, close/reopen,
    or the Hermes plugin refresh path to load v135.
  - Public repository was not synced or pushed.

## 2026-05-31 Task Card Re-entry Resurrection Fix v136

- User report:
  - After a source thread sent a cross-thread task card, the source thread still
    retained task-card UI.
  - The target thread could also show the task card again after leaving and
    re-entering, even though this class of issue had previously been fixed.
- Diagnosis:
  - The source-side draft settled key depended on `turn.id + item.id`.
  - App-server refresh/compaction can change the visible assistant item id for
    the same draft XML, so the browser missed the stored `created` state and
    could auto-send the same draft again.
  - Source outgoing pending cards were also still eligible for thread-detail
    rendering, which made the source thread retain a local card after send.
- Local fix:
  - `public/app.js`
    - Source draft keys now use `turn.id` plus a hash of the normalized draft
      content and targets, not the volatile app-server item id.
    - On render, a pending source draft checks existing stored cards from the
      same source turn and marks itself `created` before auto-sending again.
    - Thread detail now renders only target-side `pending` cards; source
      outgoing pending cards stay in store/count state but do not render as
      local work items.
    - Immediate settlement count updates now use the actual service roles
      `target` and `source`, not stale `incoming` / `outgoing` names.
    - Persisted draft-state records now keep bounded `cardIds` as well as the
      first `cardId`.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v136` / `codex-mobile-shell-v136`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation:
  - `node --check public\app.js` passed.
  - `node --check public\sw.js` passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    44/44.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
- Status:
  - Local changes are uncommitted.
  - Restarted the 8787 Node listener after the static/frontend change:
    old PID `25504`, new PID `49812`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v136`,
    `shellCacheName=codex-mobile-shell-v136`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Static frontend/PWA change requires clients to refresh/reopen or receive a
    Hermes plugin refresh to load v136.

## 2026-05-31 Source Task Card Auto-Send UI Regression v137

- User report:
  - After the v136 source-side auto-send change, a newly sent cross-thread card
    showed a source-thread `Cross-thread task card draft` card with status
    `Sending` and text `Sending cross-thread task card...`.
  - The behavior reproduced when sending to another target thread, so it was a
    regression in the source-thread auto-send UI rather than an old cached card
    or a specific target-thread failure.
- Diagnosis:
  - `public/app.js` parsed a valid assistant draft, queued
    `/api/thread-task-cards`, changed the local draft state to `creating`, and
    rendered that `creating` state as a visible source-side `Sending` draft
    card.
  - Runtime checks showed no persisted task card for the source screenshot
    thread, confirming the visible card was browser-local draft state rather
    than a real server-side pending card.
- Local fix:
  - `public/app.js`
    - Source-side `creating` state is now silent in the conversation. A valid
      draft still queues automatic card creation, but no interim `Sending`
      source draft card is rendered.
    - Real creation failures still render a bounded dismissible diagnostic.
    - The creation path now guards duplicate active create attempts and returns
      a bounded failure if the server returns no created cards.
    - Failure rendering uses the same stable turn-and-draft-content key as the
      auto-send path instead of falling back to volatile app-server item ids.
  - `public/app.js` / `public/sw.js`
    - Static shell build/cache bumped to
      `0.1.11|codex-mobile-shell-v137` / `codex-mobile-shell-v137`.
  - Documentation updated:
    - README
    - `.agent-context/PROJECT_CONTEXT.md`
    - `docs/ARCHITECTURE.md`
    - `docs/MODULES.md`
    - `docs/CROSS_THREAD_TASK_CARDS_DESIGN.md`
    - `docs/CROSS_THREAD_TASK_CARDS_IMPLEMENTATION.md`
- Validation/status:
  - Focused `node --check public\app.js` and `node --check public\sw.js`
    passed.
  - Focused `node --test test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    23/23.
  - Focused `node --test test\thread-task-card-service.test.js
    test\thread-task-card-harness.test.js test\thread-task-card-route.test.js
    test\conversation-render.test.js test\mobile-viewport.test.js` passed:
    44/44.
  - `npm.cmd test` passed: 255/255.
  - `npm.cmd run check` passed.
  - `npm.cmd run check:macos` passed.
  - `git diff --check` passed with only Windows LF-to-CRLF working-copy
    warnings.
  - BOM check for touched source/test/docs/context files had no output.
  - Restarted the 8787 Node listener after the static/frontend change:
    old PID `49812`, new PID `49176`.
  - Post-restart `/api/public-config` returns
    `clientBuildId=0.1.11|codex-mobile-shell-v137`,
    `shellCacheName=codex-mobile-shell-v137`, and
    `imageContextMode=reference`.
  - Post-restart authenticated `/api/status` is healthy:
    `ready=true`, `transport=external-jsonl-tcp`, `sharedRequired=true`,
    `lastError=null`.
  - Local changes are uncommitted.
