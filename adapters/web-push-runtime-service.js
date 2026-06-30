"use strict";

const webPushDefault = require("web-push");

function createWebPushRuntimeService(dependencies = {}) {
  const webPush = dependencies.webPush || webPushDefault;
  const readJsonFile = typeof dependencies.readJsonFile === "function" ? dependencies.readJsonFile : () => null;
  const writeRuntimeJson = typeof dependencies.writeRuntimeJson === "function" ? dependencies.writeRuntimeJson : () => {};
  const vapidFile = String(dependencies.vapidFile || "");
  const subscriptionsFile = String(dependencies.subscriptionsFile || "");
  const defaultSubject = String(dependencies.defaultSubject || "mailto:codex-mobile-web@example.com");
  const configuredSubject = String(dependencies.subject || "");
  const subjectConfigured = Boolean(dependencies.subjectConfigured);
  const ttlSeconds = Math.max(30, Number(dependencies.ttlSeconds || 3600));
  const stateDb = String(dependencies.stateDb || "");
  const userHome = String(dependencies.userHome || "");
  const fs = dependencies.fs || require("node:fs");
  const runSqliteJson = typeof dependencies.runSqliteJson === "function" ? dependencies.runSqliteJson : () => ({ ok: false, rows: [] });
  const sqlString = typeof dependencies.sqlString === "function" ? dependencies.sqlString : (value) => `'${String(value || "").replace(/'/g, "''")}'`;
  const isSidecarThreadId = typeof dependencies.isSidecarThreadId === "function" ? dependencies.isSidecarThreadId : () => false;
  const shouldTrackTurnForWebPush = typeof dependencies.shouldTrackTurnForWebPush === "function" ? dependencies.shouldTrackTurnForWebPush : () => ({ track: true, reason: "" });
  const completedTurnHasNoFinalAgentMessage = typeof dependencies.completedTurnHasNoFinalAgentMessage === "function" ? dependencies.completedTurnHasNoFinalAgentMessage : () => false;
  const resolveThreadTitleForNotification = typeof dependencies.resolveThreadTitleForNotification === "function" ? dependencies.resolveThreadTitleForNotification : () => "Codex Mobile Web";
  const threadDisplaySummaryCache = dependencies.threadDisplaySummaryCache && typeof dependencies.threadDisplaySummaryCache.read === "function"
    ? dependencies.threadDisplaySummaryCache
    : { read: () => null };
  const readStateDbThread = typeof dependencies.readStateDbThread === "function" ? dependencies.readStateDbThread : () => null;
  const readStartedThread = typeof dependencies.readStartedThread === "function" ? dependencies.readStartedThread : () => null;
  const readThreadSummaryFromAppServer = typeof dependencies.readThreadSummaryFromAppServer === "function" ? dependencies.readThreadSummaryFromAppServer : async () => null;
  const buildTurnCompletionDetailMessage = typeof dependencies.buildTurnCompletionDetailMessage === "function" ? dependencies.buildTurnCompletionDetailMessage : () => "";
  const turnCompletionUsageSummary = typeof dependencies.turnCompletionUsageSummary === "function" ? dependencies.turnCompletionUsageSummary : () => null;
  const hermesNotificationDelegateService = dependencies.hermesNotificationDelegateService || {
    isConfiguredForWorkspace: () => false,
    send: async () => null,
  };
  const pushTurnId = typeof dependencies.pushTurnId === "function" ? dependencies.pushTurnId : () => "";
  const pushThreadId = typeof dependencies.pushThreadId === "function" ? dependencies.pushThreadId : () => "";
  const isOldTurnEvent = typeof dependencies.isOldTurnEvent === "function" ? dependencies.isOldTurnEvent : () => false;
  const turnTimestampMs = typeof dependencies.turnTimestampMs === "function" ? dependencies.turnTimestampMs : () => 0;
  const shortIdentifier = typeof dependencies.shortIdentifier === "function" ? dependencies.shortIdentifier : (value) => String(value || "");
  const logger = dependencies.logger || console;

  let pushVapidKeys = null;
  let pushSubscriptionsCache = null;
  const pushObservedTurns = new Map();
  const pushSentTurns = new Map();
  const pushThreadClassCache = new Map();

  function normalizePushSubject(value) {
    const subject = String(value || "").trim();
    return subject || defaultSubject;
  }

  function isLocalhostPushSubject(value) {
    const subject = String(value || "");
    if (/\blocalhost\b|127\.0\.0\.1|\[::1\]/i.test(subject)) return true;
    try {
      const url = new URL(subject);
      return url.hostname === "localhost"
        || url.hostname === "127.0.0.1"
        || url.hostname === "::1"
        || url.hostname.endsWith(".localhost");
    } catch (_) {
      return false;
    }
  }

  function pushSubject() {
    return normalizePushSubject(configuredSubject || defaultSubject);
  }

  function storedPushSubject(existingSubject) {
    const existing = normalizePushSubject(existingSubject);
    if (subjectConfigured) return pushSubject();
    return isLocalhostPushSubject(existing) ? pushSubject() : existing;
  }

  function loadVapidKeys() {
    if (pushVapidKeys) return pushVapidKeys;
    const existing = readJsonFile(vapidFile, null);
    if (existing && existing.publicKey && existing.privateKey) {
      const subject = storedPushSubject(existing.subject);
      pushVapidKeys = {
        publicKey: String(existing.publicKey),
        privateKey: String(existing.privateKey),
        subject,
      };
      if (subject !== existing.subject) {
        writeRuntimeJson(vapidFile, Object.assign({}, existing, {
          subject,
          updatedAt: new Date().toISOString(),
        }));
      }
    } else {
      const generated = webPush.generateVAPIDKeys();
      pushVapidKeys = {
        publicKey: generated.publicKey,
        privateKey: generated.privateKey,
        subject: pushSubject(),
        createdAt: new Date().toISOString(),
      };
      writeRuntimeJson(vapidFile, pushVapidKeys);
    }
    webPush.setVapidDetails(pushVapidKeys.subject || pushSubject(), pushVapidKeys.publicKey, pushVapidKeys.privateKey);
    return pushVapidKeys;
  }

  function loadSubscriptions() {
    if (pushSubscriptionsCache) return pushSubscriptionsCache;
    const raw = readJsonFile(subscriptionsFile, []);
    pushSubscriptionsCache = Array.isArray(raw) ? raw.filter((entry) => entry && entry.endpoint) : [];
    return pushSubscriptionsCache;
  }

  function saveSubscriptions(subscriptions = loadSubscriptions()) {
    pushSubscriptionsCache = subscriptions.filter((entry) => entry && entry.endpoint);
    writeRuntimeJson(subscriptionsFile, pushSubscriptionsCache);
  }

  function normalizeSubscription(value) {
    const sub = value && value.subscription ? value.subscription : value;
    if (!sub || typeof sub !== "object") throw new Error("Push subscription is required");
    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      throw new Error("Push subscription is incomplete");
    }
    return {
      endpoint: String(sub.endpoint),
      expirationTime: sub.expirationTime || null,
      keys: {
        p256dh: String(sub.keys.p256dh),
        auth: String(sub.keys.auth),
      },
    };
  }

  function publicStatus() {
    return {
      supported: true,
      subscriptionCount: loadSubscriptions().length,
    };
  }

  function pruneSentTurns(now = Date.now()) {
    const maxAgeMs = 24 * 60 * 60 * 1000;
    for (const [key, sentAt] of pushSentTurns) {
      if (now - sentAt > maxAgeMs) pushSentTurns.delete(key);
    }
  }

  function pruneThreadClassCache(now = Date.now()) {
    for (const [threadId, entry] of pushThreadClassCache) {
      const maxAgeMs = entry && entry.value === "unknown" ? 5000 : 24 * 60 * 60 * 1000;
      if (!entry || now - Number(entry.cachedAt || 0) > maxAgeMs) pushThreadClassCache.delete(threadId);
    }
    while (pushThreadClassCache.size > 2000) {
      const firstKey = pushThreadClassCache.keys().next().value;
      if (!firstKey) break;
      pushThreadClassCache.delete(firstKey);
    }
  }

  function classifyThreadId(threadId) {
    const id = String(threadId || "").trim();
    if (isSidecarThreadId(id)) return "subagent";
    if (!id || !fs.existsSync(stateDb)) return "unknown";
    const now = Date.now();
    const cached = pushThreadClassCache.get(id);
    if (cached) {
      const maxAgeMs = cached.value === "unknown" ? 5000 : 24 * 60 * 60 * 1000;
      if (now - Number(cached.cachedAt || 0) <= maxAgeMs) return cached.value;
    }
    const query = [
      "select",
      "exists(select 1 from threads where id=t.id) as known,",
      "exists(select 1 from thread_spawn_edges where child_thread_id=t.id) as is_child,",
      "exists(select 1 from threads where id=t.id and (coalesce(agent_nickname,'') <> '' or coalesce(agent_role,'') <> '')) as has_agent_metadata",
      `from (select ${sqlString(id)} as id) t;`,
    ].join(" ");
    let value = "unknown";
    try {
      const result = runSqliteJson(stateDb, query, { timeoutMs: 3000, maxBuffer: 1024 * 1024, userHome });
      const row = result.ok && Array.isArray(result.rows) ? result.rows[0] : null;
      if (row && (Number(row.is_child || 0) || Number(row.has_agent_metadata || 0))) value = "subagent";
      else if (row && Number(row.known || 0)) value = "main";
    } catch (_) {
      value = "unknown";
    }
    pushThreadClassCache.set(id, { value, cachedAt: now });
    pruneThreadClassCache(now);
    return value;
  }

  function pruneObservedTurns(now = Date.now()) {
    const maxAgeMs = 24 * 60 * 60 * 1000;
    for (const [turnId, meta] of pushObservedTurns) {
      if (!meta || now - Number(meta.observedAt || 0) > maxAgeMs) pushObservedTurns.delete(turnId);
    }
    while (pushObservedTurns.size > 1000) {
      const firstKey = pushObservedTurns.keys().next().value;
      if (!firstKey) break;
      pushObservedTurns.delete(firstKey);
    }
  }

  function notificationUrlForThread(threadId) {
    const id = String(threadId || "");
    return id ? `/?thread=${encodeURIComponent(id)}` : "/";
  }

  function pushTimestamp(ms = Date.now()) {
    const time = Number.isFinite(ms) && ms > 0 ? ms : Date.now();
    try {
      return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(time)).replace(/\//g, "-");
    } catch (_) {
      return new Date(time).toISOString();
    }
  }

  function pushThreadSummary(threadId) {
    const id = String(threadId || "");
    return id ? (threadDisplaySummaryCache.read(id) || readStateDbThread(id) || readStartedThread(id) || null) : null;
  }

  function pushThreadTitle(params, threadId = "", existingTitle = "") {
    const id = String(threadId || pushThreadId(params) || "");
    const summary = pushThreadSummary(id);
    return resolveThreadTitleForNotification({
      params,
      threadId: id,
      existingTitle,
      summary,
      fallbackTitle: shortIdentifier(id) || "Codex Mobile Web",
    });
  }

  function lastString(...values) {
    for (const value of values) {
      const text = String(value || "").trim();
      if (text) return text;
    }
    return "";
  }

  function pushThreadAgentMetadataFromParams(params) {
    const nickname = lastString(
      params && params.agentNickname,
      params && params.agent_nickname,
      params && params.thread && params.thread.agentNickname,
      params && params.thread && params.thread.agent_nickname,
      params && params.turn && params.turn.agentNickname,
      params && params.turn && params.turn.agent_nickname,
    );
    const role = lastString(
      params && params.agentRole,
      params && params.agent_role,
      params && params.thread && params.thread.agentRole,
      params && params.thread && params.thread.agent_role,
      params && params.turn && params.turn.agentRole,
      params && params.turn && params.turn.agent_role,
    );
    return {
      agentNickname: nickname,
      agentRole: role,
    };
  }

  function pushTurnMeta(params, existing = null) {
    const turnId = pushTurnId(params);
    const existingThreadId = String((existing && existing.threadId) || "");
    const paramsThreadId = pushThreadId(params);
    const threadId = existingThreadId || paramsThreadId;
    const existingTitle = existingThreadId && existingThreadId === threadId
      ? String((existing && existing.threadTitle) || "")
      : "";
    const agentMetadata = pushThreadAgentMetadataFromParams(params);
    return {
      turnId,
      threadId,
      threadTitle: pushThreadTitle(params, threadId, existingTitle),
      agentNickname: (existing && existing.agentNickname) || agentMetadata.agentNickname,
      agentRole: (existing && existing.agentRole) || agentMetadata.agentRole,
      observedAt: (existing && existing.observedAt) || Date.now(),
      startedAt: (existing && existing.startedAt) || turnTimestampMs(params, "startedAt") || turnTimestampMs(params, "createdAt") || 0,
      completedAt: turnTimestampMs(params, "completedAt") || turnTimestampMs(params, "updatedAt") || 0,
    };
  }

  function logDecision(event, decision, meta) {
    if (decision && decision.track && !decision.reason) return;
    const reason = String((decision && decision.reason) || "tracked");
    logger.log(`[web push] ${event} ${reason} turn=${shortIdentifier(meta && meta.turnId)} thread=${shortIdentifier(meta && meta.threadId)}`);
  }

  function failureDetails(err) {
    const statusCode = Number(err && err.statusCode) || null;
    const body = String((err && err.body) || "").trim();
    let reason = "";
    if (body) {
      try {
        const parsed = JSON.parse(body);
        reason = String(parsed.reason || parsed.error || parsed.message || "").trim();
      } catch (_) {
        reason = body.slice(0, 160);
      }
    }
    return {
      statusCode,
      reason: reason || String((err && err.message) || err || "Web Push send failed"),
    };
  }

  async function sendWebPushToAll(payload) {
    loadVapidKeys();
    const subscriptions = loadSubscriptions();
    if (!subscriptions.length) return { sent: 0, failed: 0, removed: 0 };
    let sent = 0;
    let failed = 0;
    let lastError = null;
    const dead = new Set();
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(subscription, JSON.stringify(payload), {
          TTL: ttlSeconds,
          urgency: "normal",
        });
        sent += 1;
      } catch (err) {
        failed += 1;
        lastError = failureDetails(err);
        const statusCode = Number(err && err.statusCode);
        if (statusCode === 404 || statusCode === 410) dead.add(subscription.endpoint);
        else logger.error(`[web push] send failed: ${lastError.statusCode || ""} ${lastError.reason}`);
      }
    }));
    if (dead.size) {
      const kept = subscriptions.filter((subscription) => !dead.has(subscription.endpoint));
      saveSubscriptions(kept);
    }
    return Object.assign({ sent, failed, removed: dead.size }, lastError ? { lastError } : {});
  }

  function delegateTurnCompletedNotification(meta, turnId, completedAt, threadTitle, params = null) {
    const workspaceId = "owner";
    if (!hermesNotificationDelegateService.isConfiguredForWorkspace(workspaceId)) return false;
    const threadId = String(meta && meta.threadId || "");
    const detailMessage = buildTurnCompletionDetailMessage({
      threadTitle,
      completedAt,
      turnId,
      params,
      turnUsageSummary: turnCompletionUsageSummary(threadId, turnId),
      maxChars: 12_000,
    });
    hermesNotificationDelegateService.send({
      workspaceId,
      eventId: `codex-mobile:turn-completed:${threadId || "unknown"}:${turnId}`,
      title: threadTitle || shortIdentifier(threadId || turnId) || "Codex Mobile Web",
      summary: `This turn 已结束 · ${pushTimestamp(completedAt)}`,
      itemType: "info",
      priority: "normal",
      route: {
        name: "thread",
        tab: "codex",
        itemId: threadId || turnId,
        threadId: threadId || "",
        taskId: turnId,
      },
      openMode: "plugin",
      detailMessage,
    }).catch((err) => {
      logger.error(`[hermes plugin notifications] turn completed delegation failed: ${err.message || String(err)}`);
    });
    return true;
  }

  async function resolveCompletedPushThreadTitle(meta, params) {
    const threadId = String(meta && meta.threadId || pushThreadId(params) || "");
    if (threadId && !threadDisplaySummaryCache.read(threadId)) {
      try {
        await readThreadSummaryFromAppServer(threadId);
      } catch (err) {
        logger.error(`[web push] thread title app-server refresh failed: ${err.message || String(err)}`);
      }
    }
    return pushThreadTitle(params, threadId, meta && meta.threadTitle);
  }

  function sendTurnCompletedPush(meta, turnId, completedAt, params) {
    resolveCompletedPushThreadTitle(meta, params).then((threadTitle) => {
      if (delegateTurnCompletedNotification(meta, turnId, completedAt, threadTitle, params)) return;
      const threadMark = shortIdentifier(meta.threadId || turnId);
      const payload = {
        threadId: meta.threadId || "",
        turnId,
        title: threadTitle || threadMark || "Codex Mobile Web",
        body: `This turn 已结束 · ${pushTimestamp(completedAt)}`,
        tag: `codex-turn-${meta.threadId || turnId}`,
        data: {
          url: notificationUrlForThread(meta.threadId),
          threadId: meta.threadId || "",
          turnId,
          threadTitle,
          completedAt,
        },
      };
      sendWebPushToAll(payload).catch((err) => {
        logger.error(`[web push] turn completed send failed: ${err.message || String(err)}`);
      });
    }).catch((err) => {
      logger.error(`[web push] turn completed notification failed: ${err.message || String(err)}`);
    });
  }

  function maybeSendTurnCompletedPush(method, params) {
    if (method === "turn/started") {
      const id = pushTurnId(params);
      if (isOldTurnEvent(params, ["startedAt", "createdAt"])) return;
      pruneObservedTurns();
      if (id) {
        const meta = pushTurnMeta(params);
        const decision = shouldTrackTurnForWebPush(meta, {
          allowMissingThreadId: true,
          classifyThread: classifyThreadId,
        });
        logDecision("turn/started", decision, meta);
        if (decision.track) pushObservedTurns.set(id, meta);
        else pushObservedTurns.delete(id);
      }
      return;
    }
    if (method !== "turn/completed") return;
    const turnId = pushTurnId(params);
    if (!turnId || !pushObservedTurns.has(turnId)) return;
    if (isOldTurnEvent(params, ["completedAt", "updatedAt"])) return;
    const meta = pushTurnMeta(params, pushObservedTurns.get(turnId));
    pushObservedTurns.delete(turnId);
    if (completedTurnHasNoFinalAgentMessage(params)) {
      logDecision("turn/completed", { track: false, reason: "no-final-agent-message" }, meta);
      return;
    }
    const decision = shouldTrackTurnForWebPush(meta, {
      classifyThread: classifyThreadId,
    });
    if (!decision.track) {
      logDecision("turn/completed", decision, meta);
      return;
    }
    pruneObservedTurns();
    pruneSentTurns();
    const key = `${meta.threadId || ""}:${turnId}`;
    if (pushSentTurns.has(key)) return;
    pushSentTurns.set(key, Date.now());
    const completedAt = meta.completedAt || Date.now();
    sendTurnCompletedPush(meta, turnId, completedAt, params);
  }

  async function handleRoute(input = {}) {
    const url = input.url;
    const method = String(input.method || "");
    if (!url || typeof input.sendJson !== "function") return { handled: false };
    const sendJson = input.sendJson;
    const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
    const req = input.req || {};
    if (url.pathname === "/api/push/vapid-public-key" && method === "GET") {
      const keys = loadVapidKeys();
      sendJson(200, { publicKey: keys.publicKey, subject: keys.subject || pushSubject() });
      return { handled: true };
    }
    if (url.pathname === "/api/push/subscribe" && method === "POST") {
      const body = await readBody();
      const subscription = normalizeSubscription(body);
      const subscriptions = loadSubscriptions();
      const next = subscriptions.filter((entry) => entry.endpoint !== subscription.endpoint);
      next.push(Object.assign({}, subscription, {
        createdAt: subscriptions.some((entry) => entry.endpoint === subscription.endpoint)
          ? subscriptions.find((entry) => entry.endpoint === subscription.endpoint).createdAt || new Date().toISOString()
          : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userAgent: String(req.headers && req.headers["user-agent"] || ""),
      }));
      saveSubscriptions(next);
      sendJson(200, { ok: true, subscriptionCount: next.length });
      return { handled: true };
    }
    if (url.pathname === "/api/push/unsubscribe" && method === "POST") {
      const body = await readBody();
      const endpoint = String(body.endpoint || (body.subscription && body.subscription.endpoint) || "");
      if (!endpoint) {
        sendJson(400, { error: "Push subscription endpoint is required" });
        return { handled: true };
      }
      const next = loadSubscriptions().filter((entry) => entry.endpoint !== endpoint);
      saveSubscriptions(next);
      sendJson(200, { ok: true, subscriptionCount: next.length });
      return { handled: true };
    }
    if (url.pathname === "/api/push/test" && method === "POST") {
      const result = await sendWebPushToAll({
        title: "Codex Mobile Web",
        body: "Test notification",
        data: { url: "/" },
      });
      sendJson(200, Object.assign({ ok: true }, result));
      return { handled: true };
    }
    return { handled: false };
  }

  return {
    classifyThreadId,
    handleRoute,
    loadVapidKeys,
    maybeSendTurnCompletedPush,
    normalizePushSubject,
    normalizeSubscription,
    publicStatus,
    sendWebPushToAll,
  };
}

module.exports = {
  createWebPushRuntimeService,
};
