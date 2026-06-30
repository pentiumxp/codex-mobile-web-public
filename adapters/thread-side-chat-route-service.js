"use strict";

function methodValue(input) {
  return String(input.method || (input.req && input.req.method) || "").toUpperCase();
}

function decodeSegment(value) {
  return decodeURIComponent(String(value || ""));
}

function jsonResponse(sendJson, status, body) {
  if (typeof sendJson === "function") sendJson(status, body);
  return { handled: true, status, body };
}

function errorResponse(sendJson, err) {
  return jsonResponse(sendJson, err && err.statusCode || 500, {
    ok: false,
    error: err && err.message || String(err),
  });
}

async function handleThreadSideChatRoute(input = {}) {
  const url = input.url || null;
  const pathname = String(url && url.pathname || "");
  const method = methodValue(input);
  const readBody = typeof input.readBody === "function" ? input.readBody : async () => ({});
  const sendJson = typeof input.sendJson === "function" ? input.sendJson : null;
  const threadSideChatService = input.threadSideChatService || null;
  const orchestrationService = input.orchestrationService || null;
  if (!threadSideChatService) return { handled: false, reason: "thread-side-chat-service-missing" };

  const root = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat$/);
  if (root && method === "GET") {
    try {
      const threadId = decodeSegment(root[1]);
      return jsonResponse(sendJson, 200, {
        ok: true,
        sideChat: threadSideChatService.get(threadId),
      });
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  if (root && method === "PUT") {
    try {
      const threadId = decodeSegment(root[1]);
      const body = await readBody();
      return jsonResponse(sendJson, 200, {
        ok: true,
        sideChat: await threadSideChatService.updateDraft(threadId, body),
      });
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const draft = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/draft$/);
  if (draft && method === "PUT") {
    try {
      const threadId = decodeSegment(draft[1]);
      const body = await readBody();
      return jsonResponse(sendJson, 200, {
        ok: true,
        sideChat: await threadSideChatService.updateDraft(threadId, body),
      });
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const messages = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/messages$/);
  if (messages && method === "POST") {
    try {
      const threadId = decodeSegment(messages[1]);
      const body = await readBody();
      const result = await threadSideChatService.addMessage(threadId, body);
      if (result && result.message && result.message.role === "user" && !result.duplicate) {
        await threadSideChatService.markAssistantPending(threadId, result.message.id);
        if (orchestrationService && typeof orchestrationService.startAssistantReply === "function") {
          orchestrationService.startAssistantReply(threadId, result.message);
        }
        return jsonResponse(sendJson, 200, Object.assign({ ok: true }, {
          state: threadSideChatService.get(threadId),
          message: result.message,
        }));
      }
      return jsonResponse(sendJson, 200, Object.assign({ ok: true }, result));
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const candidates = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates$/);
  if (candidates && method === "POST") {
    try {
      const threadId = decodeSegment(candidates[1]);
      const body = await readBody();
      return jsonResponse(sendJson, 200, Object.assign({ ok: true }, await threadSideChatService.createCandidate(threadId, body)));
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const queue = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates\/([^/]+)\/queue$/);
  if (queue && method === "POST") {
    try {
      const threadId = decodeSegment(queue[1]);
      const candidateId = decodeSegment(queue[2]);
      const body = await readBody();
      return jsonResponse(sendJson, 200, Object.assign({ ok: true }, await threadSideChatService.queueCandidate(threadId, candidateId, body)));
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const apply = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates\/([^/]+)\/apply$/);
  if (apply && method === "POST") {
    try {
      const threadId = decodeSegment(apply[1]);
      const candidateId = decodeSegment(apply[2]);
      const body = await readBody();
      return jsonResponse(sendJson, 200, Object.assign({ ok: true }, await threadSideChatService.applyCandidate(threadId, candidateId, body)));
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const cancel = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/candidates\/([^/]+)\/cancel$/);
  if (cancel && method === "POST") {
    try {
      const threadId = decodeSegment(cancel[1]);
      const candidateId = decodeSegment(cancel[2]);
      return jsonResponse(sendJson, 200, Object.assign({ ok: true }, await threadSideChatService.cancelCandidate(threadId, candidateId)));
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  const clear = pathname.match(/^\/api\/threads\/([^/]+)\/side-chat\/clear$/);
  if (clear && method === "POST") {
    try {
      const threadId = decodeSegment(clear[1]);
      return jsonResponse(sendJson, 200, {
        ok: true,
        sideChat: await threadSideChatService.clear(threadId),
      });
    } catch (err) {
      return errorResponse(sendJson, err);
    }
  }

  return { handled: false };
}

module.exports = {
  handleThreadSideChatRoute,
};
