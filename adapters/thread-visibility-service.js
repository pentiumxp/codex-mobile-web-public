"use strict";

const fs = require("fs");
const path = require("path");

function createThreadVisibilityService(options = {}) {
  const {
    archivedSessionsDir,
    codexHome,
    defaultCodexHome,
    fallbackDisplayText,
    getCodex,
    getMutationRpcTimeoutMs,
    isThreadListLiveStatus,
    isThreadListUnknownStatus,
    mobileArchiveIndexService,
    normalizeThreadId,
    readGlobalState,
    readSessionIndexEntries,
    readStartedThread,
    readStateDbThread,
    readThreadSummaryFromAppServer,
    removeThreadFromThreadListFallbackCache,
    rolloutStatsAnnotator,
    runSqliteJson,
    sqlString,
    stateDb,
    statusText,
    threadSideChatService,
    timestampToMs,
    userHome,
    workspaceRegistryService,
    rowToFallbackThread,
  } = options;
  const ARCHIVED_SESSIONS_DIR = archivedSessionsDir;
  const CODEX_HOME = codexHome;
  const DEFAULT_CODEX_HOME = defaultCodexHome;
  const STATE_DB = stateDb;
  const USER_HOME = userHome;
  const annotateThreadRolloutStats = typeof rolloutStatsAnnotator === "function"
    ? rolloutStatsAnnotator
    : (thread) => thread;

  function codexClient() {
    return typeof getCodex === "function" ? getCodex() : options.codex;
  }

  function mutationRpcTimeoutMs() {
    return typeof getMutationRpcTimeoutMs === "function"
      ? getMutationRpcTimeoutMs()
      : options.mutationRpcTimeoutMs;
  }

  function normalizeFsPath(value) {
    return String(value || "")
      .replace(/^\\\\\?\\/, "")
      .replace(/[\\/]+/g, "\\")
      .replace(/\\+$/, "")
      .toLowerCase();
  }

  function visibleWorkspaceRoots(globalState = readGlobalState()) {
    const roots = new Set();
    for (const key of ["active-workspace-roots", "electron-saved-workspace-roots", "project-order"]) {
      const values = globalState[key];
      if (!Array.isArray(values)) continue;
      for (const value of values) {
        if (typeof value === "string" && value.trim()) roots.add(value);
      }
    }
    for (const workspace of workspaceRegistryService.list()) {
      if (workspace && workspace.cwd) roots.add(workspace.cwd);
    }
    return roots;
  }

  function visibleWorkspaceKeys(globalState = readGlobalState()) {
    return new Set([...visibleWorkspaceRoots(globalState)].map(normalizeFsPath).filter(Boolean));
  }

  function visibleWorkspaceNames(globalState = readGlobalState()) {
    return new Set([...visibleWorkspaceRoots(globalState)]
      .map((root) => path.basename(path.resolve(root)))
      .filter(Boolean));
  }

  function visibleProjectlessThreadIds(globalState = readGlobalState()) {
    const ids = globalState["projectless-thread-ids"];
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string" && id) : []);
  }

  function visibilityFromGlobalState(globalState = readGlobalState()) {
    return {
      workspaceKeys: visibleWorkspaceKeys(globalState),
      workspaceNames: visibleWorkspaceNames(globalState),
      projectlessThreadIds: visibleProjectlessThreadIds(globalState),
    };
  }

  function codexWorktreeRepoName(cwd) {
    const value = String(cwd || "").trim();
    if (!value) return "";
    const homes = [CODEX_HOME, DEFAULT_CODEX_HOME].filter(Boolean);
    for (const home of homes) {
      const relative = path.relative(path.join(home, "worktrees"), path.resolve(value));
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) continue;
      const parts = relative.split(path.sep).filter(Boolean);
      if (parts.length >= 2) return parts[1];
    }
    return "";
  }

  function threadWorkspaceVisible(cwd, visibility = null) {
    const view = visibility || visibilityFromGlobalState();
    const cwdKey = normalizeFsPath(cwd);
    if (cwdKey && view.workspaceKeys && view.workspaceKeys.has(cwdKey)) return true;
    const worktreeRepo = codexWorktreeRepoName(cwd);
    return Boolean(worktreeRepo && view.workspaceNames && view.workspaceNames.has(worktreeRepo));
  }

  function threadProjectlessVisible(thread, visibility = null) {
    const view = visibility || visibilityFromGlobalState();
    const id = String(thread && thread.id || "").trim();
    return Boolean(id && view.projectlessThreadIds && view.projectlessThreadIds.has(id));
  }

  function anyThreadMatchesVisibleWorkspace(threads, visibility = null) {
    const view = visibility || visibilityFromGlobalState();
    if (!view.workspaceKeys || view.workspaceKeys.size <= 0) return false;
    for (const thread of Array.isArray(threads) ? threads : []) {
      if (!thread || typeof thread !== "object" || shouldHideThreadListSummary(thread)) continue;
      const cwd = String(thread.cwd || "").trim();
      if (cwd && threadWorkspaceVisible(cwd, view)) return true;
      if (threadProjectlessVisible(thread, view)) return true;
    }
    return false;
  }

  function threadMatchesWorkspaceCwd(threadCwd, selectedCwd) {
    const selected = String(selectedCwd || "").trim();
    if (!selected) return true;
    if (normalizeFsPath(threadCwd) === normalizeFsPath(selected)) return true;
    const worktreeRepo = codexWorktreeRepoName(threadCwd);
    return Boolean(worktreeRepo && worktreeRepo === path.basename(path.resolve(selected)));
  }

  function isBackupRolloutPath(value) {
    return /\.jsonl\.(bak|backup|old)(?:\b|[-_.])/i.test(String(value || ""));
  }

  function isSubagentThreadSummary(thread) {
    return Boolean(thread && (
      thread.isSpawnedChildThread
      || String(thread.agentNickname || thread.agent_nickname || "").trim()
      || String(thread.agentRole || thread.agent_role || "").trim()
    ));
  }

  function isSideChatSidecarThreadSummary(thread) {
    return Boolean(thread && threadSideChatService.isSidecarThreadId(thread.id || thread.threadId));
  }

  function threadSummaryHasDisplayText(thread) {
    if (!thread || typeof thread !== "object") return false;
    const id = String(thread.id || "").trim();
    for (const value of [thread.name, thread.title, thread.preview, thread.first_user_message]) {
      const text = String(value || "").trim();
      if (text && !isRecoverableThreadListTitle(text, id)) return true;
    }
    return false;
  }

  function isResidualFallbackThreadSummary(thread) {
    if (!thread || typeof thread !== "object" || !thread.mobileFallback) return false;
    const id = normalizeThreadId(thread.id);
    if (!id || threadSummaryHasDisplayText(thread)) return false;
    return !isThreadListLiveStatus(thread.status);
  }

  function isUnmaterializedThreadListPlaceholder(thread) {
    if (!thread || typeof thread !== "object") return false;
    const id = normalizeThreadId(thread.id);
    if (!id) return false;
    if (!isThreadListUnknownStatus(thread.status)) return false;
    if (threadSummaryHasDisplayText(thread)) return false;
    if (String(thread.cwd || "").trim()) return false;
    if (Array.isArray(thread.turns) && thread.turns.length) return false;
    const display = String(thread.name || thread.title || thread.preview || "").trim();
    return !display || isRecoverableThreadListTitle(display, id);
  }

  function shouldHideThreadListSummary(thread, archivedIds = null) {
    if (threadHasArchiveSignal(thread, archivedIds)) return true;
    if (isSubagentThreadSummary(thread)) return true;
    if (isSideChatSidecarThreadSummary(thread)) return true;
    return isResidualFallbackThreadSummary(thread) || isUnmaterializedThreadListPlaceholder(thread);
  }

  function archivedSessionDirectories() {
    const dirs = new Set([ARCHIVED_SESSIONS_DIR]);
    dirs.add(path.join(DEFAULT_CODEX_HOME, "archived_sessions"));
    const homesRoot = path.join(USER_HOME, ".codex-homes");
    try {
      for (const entry of fs.readdirSync(homesRoot, { withFileTypes: true })) {
        if (!entry || !entry.isDirectory()) continue;
        dirs.add(path.join(homesRoot, entry.name, "archived_sessions"));
      }
    } catch (_) {
      // Older installs may not have profile-specific homes.
    }
    return [...dirs];
  }

  function addArchivedSessionIdsFromDir(ids, dir) {
    try {
      for (const name of fs.readdirSync(dir)) {
        const match = String(name || "").match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
        const id = normalizeThreadId(match && match[1]);
        if (id) ids.add(id);
      }
    } catch (_) {
      // Missing archived_sessions directories are normal for fresh profiles.
    }
  }

  function archivedSessionThreadIds() {
    const ids = mobileArchiveIndexService.threadIds();
    for (const dir of archivedSessionDirectories()) {
      addArchivedSessionIdsFromDir(ids, dir);
    }
    return ids;
  }

  function threadHasArchiveSignal(thread, archivedIds = null) {
    if (!thread || typeof thread !== "object") return false;
    const id = normalizeThreadId(thread.id);
    const status = statusText(thread.status).toLowerCase();
    const location = String(thread.path || thread.rolloutPath || thread.rollout_path || "").toLowerCase();
    const archivedThreadIds = archivedIds && typeof archivedIds.has === "function" ? archivedIds : archivedSessionThreadIds();
    return Boolean(thread.archived || thread.archivedAt || thread.archived_at || thread.isArchived)
      || Boolean(thread.deleted || thread.deletedAt || thread.deleted_at || thread.isDeleted || thread.removed || thread.removedAt)
      || Boolean(id && archivedThreadIds.has(id))
      || /archived|deleted|removed/.test(status)
      || /[/\\](archived|deleted|trash|removed)[_-]?sessions[/\\]/.test(location)
      || isBackupRolloutPath(location);
  }

  function rememberMobileArchivedThreadId(threadId) {
    try {
      const remembered = mobileArchiveIndexService.remember(threadId);
      if (remembered) removeThreadFromThreadListFallbackCache(threadId);
      return remembered;
    } catch (err) {
      console.warn(`Failed to update Mobile archived thread index: ${err.message || String(err)}`);
      return false;
    }
  }

  function archivedResultWithMobileIndex(result, threadId) {
    if (result && typeof result === "object" && result.archived === false) return result;
    const mobileArchived = rememberMobileArchivedThreadId(threadId);
    const out = result && typeof result === "object" ? Object.assign({}, result) : { archived: true };
    if (!Object.prototype.hasOwnProperty.call(out, "archived")) out.archived = true;
    if (mobileArchived) out.mobileArchived = true;
    return out;
  }

  function alreadyArchivedResult(source, threadId, shouldRemember = true) {
    const out = { archived: true, alreadyArchived: true };
    if (source) out.source = source;
    if (shouldRemember && rememberMobileArchivedThreadId(threadId)) out.mobileArchived = true;
    return out;
  }

  function mobileArchivedFallbackResult(source, threadId, err) {
    const mobileArchived = rememberMobileArchivedThreadId(threadId);
    return {
      archived: Boolean(mobileArchived),
      source: source || "mobile-index-fallback",
      mobileArchived,
      archiveError: err ? String(err.message || err) : "",
    };
  }

  function isThreadIdArchivedLocally(threadId) {
    const id = normalizeThreadId(threadId);
    return Boolean(id && archivedSessionThreadIds().has(id));
  }

  function isHiddenThread(thread, visibility = null, options = {}) {
    if (!thread || typeof thread !== "object") return true;
    const view = visibility || visibilityFromGlobalState();
    if (shouldHideThreadListSummary(thread, options.archivedIds)) return true;
    if (threadProjectlessVisible(thread, view)) return false;
    if (view.workspaceKeys && view.workspaceKeys.size > 0) {
      const cwd = String(thread.cwd || "").trim();
      if (cwd) return !threadWorkspaceVisible(cwd, view);
      return true;
    }
    return false;
  }

  function filterThreadListByCwd(result, cwd) {
    if (!cwd || !result || typeof result !== "object") return result;
    const out = Object.assign({}, result);
    if (Array.isArray(out.data)) out.data = out.data.filter((thread) => threadMatchesWorkspaceCwd(thread && thread.cwd, cwd));
    if (Array.isArray(out.threads)) out.threads = out.threads.filter((thread) => threadMatchesWorkspaceCwd(thread && thread.cwd, cwd));
    return out;
  }

  function isThreadIdLikeTitle(value, threadId = "") {
    const text = String(value || "").trim();
    const id = String(threadId || "").trim();
    if (!text) return true;
    if (id && text === id) return true;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text);
  }

  function isRecoverableThreadListTitle(value, threadId = "") {
    const text = String(value || "").trim();
    return isThreadIdLikeTitle(text, threadId)
      || /^#\s*Continuation Bootstrap Index\b/i.test(text)
      || /This thread is a same-workspace continuation created by Codex Mobile Web/i.test(text);
  }

  function sessionIndexDisplayName(entry) {
    return fallbackDisplayText(entry && (entry.thread_name || entry.name || entry.title), 120);
  }

  function applySessionIndexTitleToThread(thread, entry) {
    if (!thread || typeof thread !== "object") return thread;
    const id = String(thread.id || "").trim();
    const name = sessionIndexDisplayName(entry);
    if (!id || !name) return thread;
    const next = Object.assign({}, thread, {
      name,
      preview: name,
    });
    const updatedAt = entry && (entry.updated_at || entry.updatedAt);
    if (updatedAt && timestampToMs(updatedAt) >= timestampToMs(next.updatedAt || next.updated_at)) {
      next.updatedAt = Math.floor(timestampToMs(updatedAt) / 1000);
    }
    return next;
  }

  function hydrateThreadListTitlesFromSessionIndex(threads, indexEntries = readSessionIndexEntries()) {
    if (!Array.isArray(threads) || !threads.length || !indexEntries || typeof indexEntries.get !== "function") {
      return threads;
    }
    return threads.map((thread) => {
      if (!thread || typeof thread !== "object") return thread;
      const id = String(thread.id || "").trim();
      if (!id) return thread;
      const entry = indexEntries.get(id);
      return applySessionIndexTitleToThread(thread, entry);
    });
  }

  function hydrateThreadListResultTitlesFromSessionIndex(result, indexEntries = readSessionIndexEntries()) {
    if (!result || typeof result !== "object") return result;
    const out = Object.assign({}, result);
    if (Array.isArray(out.data)) out.data = hydrateThreadListTitlesFromSessionIndex(out.data, indexEntries);
    if (Array.isArray(out.threads)) out.threads = hydrateThreadListTitlesFromSessionIndex(out.threads, indexEntries);
    return out;
  }

  function filterVisibleThreads(result, globalState = readGlobalState(), options = {}) {
    const visibility = visibilityFromGlobalState(globalState);
    const archivedIds = options.archivedIds && typeof options.archivedIds.has === "function"
      ? options.archivedIds
      : archivedSessionThreadIds();
    const annotateRolloutStats = (thread) => annotateThreadRolloutStats(thread, {
      rolloutStatsForPath: options.rolloutStatsForPath,
    });
    if (!result || typeof result !== "object") return result;
    const out = Object.assign({}, result);
    if (Array.isArray(out.data)) {
      const merged = mergeThreadStateFromStateDb(out.data, { archivedIds });
      const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(merged, visibility);
      out.data = merged
        .filter((thread) => !(shouldFilterByWorkspace ? isHiddenThread(thread, visibility, { archivedIds }) : shouldHideThreadListSummary(thread, archivedIds)))
        .map(annotateRolloutStats);
    }
    if (Array.isArray(out.threads)) {
      const merged = mergeThreadStateFromStateDb(out.threads, { archivedIds });
      const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(merged, visibility);
      out.threads = merged
        .filter((thread) => !(shouldFilterByWorkspace ? isHiddenThread(thread, visibility, { archivedIds }) : shouldHideThreadListSummary(thread, archivedIds)))
        .map(annotateRolloutStats);
    }
    return out;
  }

  function mergeThreadStateFromStateDb(threads, options = {}) {
    if (!Array.isArray(threads) || !threads.length || !fs.existsSync(STATE_DB)) return threads;
    const ids = Array.from(new Set(threads.map((thread) => String(thread && thread.id || "").trim()).filter(Boolean)));
    if (!ids.length) return threads;
    const inClause = ids.map((id) => sqlString(id)).join(", ");
    const query = [
      "select id,title,first_user_message,cwd,updated_at,archived,archived_at,rollout_path,model,reasoning_effort,agent_nickname,agent_role,",
      "exists(select 1 from thread_spawn_edges where child_thread_id=threads.id) as is_spawned_child",
      "from threads",
      `where id in (${inClause});`,
    ].join(" ");
    try {
      const result = runSqliteJson(STATE_DB, query, { timeoutMs: 5000, maxBuffer: 1024 * 1024, userHome: USER_HOME });
      if (!result.ok) return threads;
      const rows = result.rows;
      if (!Array.isArray(rows) || !rows.length) return threads;
      const stateById = new Map();
      const archivedIds = options.archivedIds && typeof options.archivedIds.has === "function"
        ? options.archivedIds
        : archivedSessionThreadIds();
      for (const row of rows) {
        const id = String(row && row.id || "").trim();
        if (!id) continue;
        stateById.set(id, {
          name: row.title || null,
          preview: row.first_user_message || null,
          cwd: typeof row.cwd === "string" ? row.cwd.replace(/^\\\\\?\\/, "") : null,
          updatedAt: Number(row.updated_at || 0),
          archived: Boolean(Number(row.archived || 0))
            || archivedIds.has(id)
            || /[/\\]archived_sessions[/\\]/i.test(String(row.rollout_path || ""))
            || isBackupRolloutPath(row.rollout_path),
          archivedAt: row.archived_at || null,
          model: row.model || null,
          effort: row.reasoning_effort || null,
          agentNickname: row.agent_nickname || null,
          agentRole: row.agent_role || null,
          isSpawnedChildThread: Boolean(Number(row.is_spawned_child || 0)),
        });
      }
      return threads.map((thread) => {
        if (!thread || typeof thread !== "object") return thread;
        const state = stateById.get(String(thread.id || "").trim());
        if (!state) return thread;
        const next = Object.assign({}, thread);
        if (state.name) next.name = state.name;
        if (state.preview && (!next.preview || String(next.preview) === String(thread.id || ""))) next.preview = state.preview;
        if (state.cwd) next.cwd = state.cwd;
        if (state.updatedAt && timestampToMs(state.updatedAt) >= timestampToMs(thread.updatedAt)) next.updatedAt = state.updatedAt;
        if (state.model) next.model = state.model;
        if (state.effort) next.effort = state.effort;
        if (state.agentNickname) next.agentNickname = state.agentNickname;
        if (state.agentRole) next.agentRole = state.agentRole;
        if (state.isSpawnedChildThread) next.isSpawnedChildThread = true;
        if (state.archived) {
          next.archived = true;
          next.archivedAt = state.archivedAt || thread.archivedAt || thread.archived_at || null;
        }
        return next;
      });
    } catch (_) {
      return threads;
    }
  }

  async function archiveVisibleThread(threadId, visibility) {
    if (!threadId) return { archived: false };
    const summary = readStateDbThread(threadId)
      || readStartedThread(threadId)
      || await readThreadSummaryFromAppServer(codexClient(), threadId).catch(() => null);
    if (summary && isHiddenThread(summary, visibility)) {
      throw new Error("Source thread is archived, deleted, or outside visible workspaces");
    }
    const result = await codexClient().request("thread/archive", { threadId }, { timeoutMs: mutationRpcTimeoutMs(), retry: false });
    return archivedResultWithMobileIndex(result, threadId);
  }

  function isThreadArchiveNoOpError(err) {
    const message = String((err && err.message) || "").toLowerCase();
    const code = String((err && err.code) || "").toLowerCase();
    return /already|archived|not found|notexisting|不存在|已归档|does not exist|no such/.test(message)
      || /thread_not_found|thread-not-found|not_found|not-found/.test(code);
  }

  async function archiveThreadId(threadId, visibility = visibilityFromGlobalState()) {
    if (!threadId) return { archived: false };
    if (isThreadIdArchivedLocally(threadId)) return alreadyArchivedResult("mobile-index", threadId, false);
    const summary = readStateDbThread(threadId) || readStartedThread(threadId);
    if (summary && isHiddenThread(summary, visibility)) {
      return alreadyArchivedResult("state-db", threadId);
    }
    try {
      const result = await codexClient().request("thread/archive", { threadId }, {
        timeoutMs: mutationRpcTimeoutMs(),
        retry: false,
      });
      return archivedResultWithMobileIndex(result, threadId);
    } catch (err) {
      const rechecked = readStateDbThread(threadId) || readStartedThread(threadId);
      if (rechecked && isHiddenThread(rechecked, visibility)) {
        return alreadyArchivedResult("state-db", threadId);
      }
      if (isThreadArchiveNoOpError(err)) {
        return alreadyArchivedResult("", threadId);
      }
      throw err;
    }
  }

  function filterFallbackThreads(threads, filters = {}) {
    const globalState = filters.globalState || readGlobalState();
    const visibility = visibilityFromGlobalState(globalState);
    const archivedIds = filters.archivedIds && typeof filters.archivedIds.has === "function"
      ? filters.archivedIds
      : archivedSessionThreadIds();
    const cwdFilter = String(filters.cwd || "").trim();
    const search = String(filters.searchTerm || "").trim().toLowerCase();
    const shouldFilterByWorkspace = anyThreadMatchesVisibleWorkspace(threads, visibility);
    return threads
      .filter((thread) => {
        if (shouldHideThreadListSummary(thread, archivedIds)) return false;
        if (!shouldFilterByWorkspace) return true;
        if (threadProjectlessVisible(thread, visibility)) return true;
        const cwd = String(thread && thread.cwd || "").trim();
        if (cwd) return threadWorkspaceVisible(cwd, visibility);
        return false;
      })
      .filter((thread) => threadMatchesWorkspaceCwd(thread && thread.cwd, cwdFilter))
      .filter((thread) => {
        if (!search) return true;
        return [thread.name, thread.preview, thread.cwd, thread.id]
          .some((value) => String(value || "").toLowerCase().includes(search));
      });
  }

  function readStateDbFallback(limit = 80, filters = {}) {
    if (!fs.existsSync(STATE_DB)) return [];
    const rowLimit = Math.max(limit * 5, 200);
    const query = [
      "select id,title,first_user_message,cwd,rollout_path,archived,archived_at,updated_at,model,reasoning_effort,sandbox_policy,approval_mode,agent_nickname,agent_role,",
      "exists(select 1 from thread_spawn_edges where child_thread_id=threads.id) as is_spawned_child",
      "from threads",
      "order by updated_at desc",
      `limit ${Math.min(1000, rowLimit)};`,
    ].join(" ");
    try {
      const result = runSqliteJson(STATE_DB, query, { timeoutMs: 5000, maxBuffer: 5 * 1024 * 1024, userHome: USER_HOME });
      if (!result.ok) return [];
      const rows = result.rows;
      return filterFallbackThreads(rows.map(rowToFallbackThread), filters).slice(0, limit);
    } catch (_) {
      return [];
    }
  }


  return {
    normalizeFsPath,
    visibleWorkspaceRoots,
    visibleWorkspaceKeys,
    visibleWorkspaceNames,
    visibleProjectlessThreadIds,
    visibilityFromGlobalState,
    codexWorktreeRepoName,
    threadWorkspaceVisible,
    threadProjectlessVisible,
    anyThreadMatchesVisibleWorkspace,
    threadMatchesWorkspaceCwd,
    isBackupRolloutPath,
    isSubagentThreadSummary,
    isSideChatSidecarThreadSummary,
    threadSummaryHasDisplayText,
    isResidualFallbackThreadSummary,
    isUnmaterializedThreadListPlaceholder,
    shouldHideThreadListSummary,
    archivedSessionDirectories,
    addArchivedSessionIdsFromDir,
    archivedSessionThreadIds,
    threadHasArchiveSignal,
    rememberMobileArchivedThreadId,
    archivedResultWithMobileIndex,
    alreadyArchivedResult,
    mobileArchivedFallbackResult,
    isThreadIdArchivedLocally,
    isHiddenThread,
    filterThreadListByCwd,
    isThreadIdLikeTitle,
    isRecoverableThreadListTitle,
    sessionIndexDisplayName,
    applySessionIndexTitleToThread,
    hydrateThreadListTitlesFromSessionIndex,
    hydrateThreadListResultTitlesFromSessionIndex,
    filterVisibleThreads,
    mergeThreadStateFromStateDb,
    archiveVisibleThread,
    isThreadArchiveNoOpError,
    archiveThreadId,
    filterFallbackThreads,
    readStateDbFallback,
  };
}

module.exports = {
  createThreadVisibilityService,
};
