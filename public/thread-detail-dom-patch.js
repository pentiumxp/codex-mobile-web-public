"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailDomPatch = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  const ELEMENT_NODE = 1;
  const TEXT_NODE = 3;
  const COMMENT_NODE = 8;

  function result(ok, reason, counts = {}) {
    return Object.assign({
      ok: Boolean(ok),
      reason: String(reason || (ok ? "applied" : "unknown")),
      reused: 0,
      patched: 0,
      inserted: 0,
    }, counts);
  }

  function threadDetailPatchResult(ok, reason, counts = {}) {
    const fallback = ok ? "patched" : "unknown";
    const boundedReason = String(reason || fallback).slice(0, 80) || fallback;
    return result(ok, boundedReason, counts);
  }

  function objectOrEmpty(value) {
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  }

  function boundedCount(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue > 0 ? Math.trunc(numberValue) : 0;
  }

  function hasOwn(input, key) {
    return Object.prototype.hasOwnProperty.call(input, key);
  }

  function normalizedStringList(value) {
    return Array.isArray(value) ? value.map((entry) => String(entry || "")).filter(Boolean) : [];
  }

  function visibleTurnOrderMismatch(input = {}) {
    const expected = normalizedStringList(input.expectedTurnIds);
    const rendered = normalizedStringList(input.renderedDomTurnIds || input.domTurnIds);
    if (!expected.length) return false;
    if (expected.length !== rendered.length) return true;
    for (let index = 0; index < expected.length; index += 1) {
      if (expected[index] !== rendered[index]) return true;
    }
    return false;
  }

  function boundedDuration(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : 0;
  }

  function renderKeyForNode(node) {
    return node && node.nodeType === ELEMENT_NODE && typeof node.getAttribute === "function"
      ? node.getAttribute("data-render-key") || ""
      : "";
  }

  function visibleItemRenderKeyForNode(node) {
    if (!node || node.nodeType !== ELEMENT_NODE || typeof node.getAttribute !== "function") return "";
    if (node.getAttribute("data-item") == null) return "";
    return renderKeyForNode(node);
  }

  function canPatchNode(target, source) {
    if (!target || !source || target.nodeType !== source.nodeType) return false;
    if (target.nodeType !== ELEMENT_NODE) return true;
    return target.tagName === source.tagName;
  }

  function syncAttributes(target, source) {
    const sourceNames = new Set(Array.from(source.attributes || []).map((attr) => attr.name));
    for (const attr of Array.from(target.attributes || [])) {
      if (!sourceNames.has(attr.name)) target.removeAttribute(attr.name);
    }
    for (const attr of Array.from(source.attributes || [])) {
      if (target.getAttribute(attr.name) !== attr.value) target.setAttribute(attr.name, attr.value);
    }
  }

  function patchNode(target, source) {
    if (!canPatchNode(target, source)) {
      const replacement = source.cloneNode(true);
      target.replaceWith(replacement);
      return replacement;
    }
    if (target.nodeType === TEXT_NODE || target.nodeType === COMMENT_NODE) {
      if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
      return target;
    }
    syncAttributes(target, source);
    patchChildNodes(target, source);
    return target;
  }

  function patchChildNodes(target, source) {
    const sourceChildren = Array.from(source.childNodes || []);
    const targetChildren = Array.from(target.childNodes || []);
    const keyedTargets = new Map();
    for (const child of targetChildren) {
      const key = renderKeyForNode(child);
      if (key && !keyedTargets.has(key)) keyedTargets.set(key, child);
    }

    const used = new Set();
    let cursor = target.firstChild || null;
    for (const sourceChild of sourceChildren) {
      const key = renderKeyForNode(sourceChild);
      let targetChild = key ? keyedTargets.get(key) : null;
      if (targetChild && used.has(targetChild)) targetChild = null;
      if (!targetChild && cursor && !renderKeyForNode(cursor) && canPatchNode(cursor, sourceChild)) {
        targetChild = cursor;
      }

      if (targetChild) {
        const patched = patchNode(targetChild, sourceChild);
        used.add(patched);
        if (patched !== cursor) target.insertBefore(patched, cursor);
        cursor = patched.nextSibling || null;
        continue;
      }

      const inserted = sourceChild.cloneNode(true);
      target.insertBefore(inserted, cursor);
      used.add(inserted);
    }

    for (const child of Array.from(target.childNodes || [])) {
      if (!used.has(child)) child.remove();
    }
  }

  function normalizeOperation(operation) {
    if (!operation || typeof operation !== "object") return null;
    const type = String(operation.type || "");
    const nextEntry = operation.nextEntry && typeof operation.nextEntry === "object" ? operation.nextEntry : null;
    const key = String(operation.key || (nextEntry && nextEntry.key) || "");
    if (!type || !key || !nextEntry) return null;
    return Object.assign({}, operation, { key, nextEntry, type });
  }

  function normalizeTurnOperation(operation) {
    if (!operation || typeof operation !== "object") return null;
    const type = String(operation.type || "");
    const key = String(operation.key || "");
    if (!type || !key) return null;
    return Object.assign({}, operation, { key, type });
  }

  function callbackOk(value) {
    if (!value) return false;
    if (typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "ok")) return Boolean(value.ok);
    return true;
  }

  function callbackReason(value, fallback) {
    if (value && typeof value === "object" && value.reason) return String(value.reason || fallback);
    return fallback;
  }

  function firstTurnElementFrom(input) {
    if (typeof input.firstTurnElement === "function") return input.firstTurnElement() || null;
    return input.firstTurnElement || null;
  }

  function documentFrom(input = {}) {
    if (input.document && typeof input.document.createElement === "function") return input.document;
    if (typeof document !== "undefined" && document && typeof document.createElement === "function") return document;
    return null;
  }

  function normalizePatchHtmlInput(input, html, options = {}) {
    if (input && typeof input === "object" && typeof input.insertBefore === "function") {
      return Object.assign({}, options || {}, { target: input, html });
    }
    return input && typeof input === "object" ? input : {};
  }

  function patchHtml(input = {}, html, options = {}) {
    const normalized = normalizePatchHtmlInput(input, html, options);
    const target = normalized.target || normalized.root || null;
    if (!target || typeof target.insertBefore !== "function") return result(false, "missing-target");
    const doc = documentFrom(normalized);
    if (!doc) return result(false, "missing-document");
    try {
      const template = doc.createElement("template");
      if (!template) return result(false, "missing-template");
      template.innerHTML = String(normalized.html || "");
      patchChildNodes(target, template.content || { childNodes: [] });
      return result(true, "patched", { patched: 1, target });
    } catch (_) {
      return result(false, "patch-html-failed", { target });
    }
  }

  function planConversationHtmlUpdate(input = {}) {
    const signature = String(input.signature || "");
    const renderedConversationSignature = String(input.renderedConversationSignature || "");
    const renderedConversationPatchShellSignature = String(input.renderedConversationPatchShellSignature || "");
    const patchShellSignature = String(input.patchShellSignature || "");
    const stableSignature = renderedConversationSignature === signature;
    const expectedVisibleTurnCount = Math.max(0, Number(input.expectedVisibleTurnCount || 0));
    const renderedDomTurnCount = Math.max(0, Number(input.renderedDomTurnCount || 0));
    const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
    const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
    const duplicateRenderKeyCount = boundedCount(input.duplicateRenderKeyCount);
    const stableSignatureButMissingTurns = Boolean(
      stableSignature
      && expectedVisibleTurnCount > 0
      && renderedDomTurnCount < expectedVisibleTurnCount
    );
    const stableSignatureButMissingItems = Boolean(
      stableSignature
      && expectedVisibleItemCount > 0
      && hasOwn(input, "renderedDomItemCount")
      && renderedDomItemCount < expectedVisibleItemCount
    );
    const stableSignatureButDuplicateKeys = Boolean(stableSignature && duplicateRenderKeyCount > 0);
    const stableSignatureButTurnOrderMismatch = Boolean(stableSignature && visibleTurnOrderMismatch(input));
    const stableSignatureDomInvalid = stableSignatureButMissingTurns
      || stableSignatureButMissingItems
      || stableSignatureButDuplicateKeys
      || stableSignatureButTurnOrderMismatch;
    let invalidationReason = "signature-changed";
    if (stableSignatureButDuplicateKeys) invalidationReason = "stable-signature-duplicate-render-keys";
    else if (stableSignatureButTurnOrderMismatch) invalidationReason = "stable-signature-turn-order-mismatch";
    else if (stableSignatureButMissingItems) invalidationReason = "stable-signature-dom-item-mismatch";
    else if (stableSignatureButMissingTurns) {
      invalidationReason = renderedDomTurnCount <= 0 ? "stable-signature-dom-empty" : "stable-signature-dom-turn-mismatch";
    }
    const scrollAction = input.stickToBottom ? "scroll-to-bottom" : "update-bottom-button";
    if (stableSignature && !stableSignatureDomInvalid) {
      return {
        action: "hydrate-existing",
        changed: false,
        stableSignature: true,
        reason: "signature-stable",
        signature,
        patchShellSignature,
        updateRenderedConversationSignature: false,
        updatePatchShellSignature: Boolean(patchShellSignature),
        nextRenderedConversationSignature: renderedConversationSignature,
        nextRenderedConversationPatchShellSignature: patchShellSignature || renderedConversationPatchShellSignature,
        hydrateOptions: {
          imageScanDelays: [0, 180],
          skipRichHydration: true,
        },
        scrollAction,
        performance: false,
      };
    }
    return {
      action: stableSignatureDomInvalid || !input.hasExistingChildren ? "set-inner-html" : "patch-html",
      fallbackAction: "set-inner-html",
      changed: true,
      stableSignature,
      reason: invalidationReason,
      signature,
      patchShellSignature,
      updateRenderedConversationSignature: true,
      updatePatchShellSignature: true,
      nextRenderedConversationSignature: signature,
      nextRenderedConversationPatchShellSignature: patchShellSignature,
      hydrateOptions: {},
      scrollAction,
      performance: true,
    };
  }

  function scrollEffectFromAction(scrollAction) {
    if (scrollAction === "scroll-to-bottom") return { type: "schedule-conversation-to-bottom" };
    if (scrollAction === "update-bottom-button") return { type: "schedule-scroll-button-update" };
    return null;
  }

  function planConversationHtmlUpdateEffects(plan = {}) {
    const updatePlan = objectOrEmpty(plan);
    const action = String(updatePlan.action || "");
    const effects = [];
    const scrollEffect = scrollEffectFromAction(updatePlan.scrollAction);
    if (action === "hydrate-existing") {
      if (updatePlan.updatePatchShellSignature) {
        effects.push({
          type: "set-rendered-conversation-patch-shell-signature",
          value: String(updatePlan.nextRenderedConversationPatchShellSignature || ""),
        });
      }
      effects.push({
        type: "hydrate-root",
        hydrateOptions: objectOrEmpty(updatePlan.hydrateOptions),
      });
      if (scrollEffect) effects.push(scrollEffect);
      return {
        effects,
        reason: effects.length ? "hydrate-existing-effects" : "no-update-effects",
      };
    }
    if (action !== "patch-html" && action !== "set-inner-html") {
      return {
        effects: [],
        reason: action ? "unknown-action" : "missing-action",
      };
    }

    effects.push({
      type: "hydrate-root",
      hydrateOptions: objectOrEmpty(updatePlan.hydrateOptions),
    });
    if (updatePlan.updateRenderedConversationSignature) {
      effects.push({
        type: "set-rendered-conversation-signature",
        value: String(updatePlan.nextRenderedConversationSignature || ""),
      });
    }
    if (updatePlan.updatePatchShellSignature) {
      effects.push({
        type: "set-rendered-conversation-patch-shell-signature",
        value: String(updatePlan.nextRenderedConversationPatchShellSignature || ""),
      });
    }
    if (scrollEffect) effects.push(scrollEffect);
    return {
      effects,
      reason: effects.length ? "conversation-update-effects" : "no-update-effects",
    };
  }

  function planConversationHtmlUpdateApplication(input = {}) {
    const updatePlan = objectOrEmpty(input.updatePlan || input.plan);
    const action = String(updatePlan.action || "");
    if (action === "hydrate-existing") {
      return {
        shouldMutateDom: false,
        primaryAction: "hydrate-existing",
        finalAction: "hydrate-existing",
        patchAttempted: false,
        patchApplied: false,
        fallbackApplied: false,
        patchRejectReason: "",
        reason: "hydrate-existing",
      };
    }
    if (action === "set-inner-html") {
      return {
        shouldMutateDom: true,
        primaryAction: "set-inner-html",
        finalAction: "set-inner-html",
        patchAttempted: false,
        patchApplied: false,
        fallbackApplied: false,
        patchRejectReason: "",
        reason: "set-inner-html",
      };
    }
    if (action === "patch-html") {
      const patchResult = objectOrEmpty(input.patchResult);
      const patchApplied = patchResult.ok === true;
      const patchRejectReason = patchApplied ? "" : String(patchResult.reason || "patch-html-failed").slice(0, 80);
      return {
        shouldMutateDom: true,
        primaryAction: "patch-html",
        finalAction: patchApplied ? "patch-html" : "set-inner-html",
        patchAttempted: true,
        patchApplied,
        fallbackApplied: !patchApplied,
        patchRejectReason,
        reason: patchApplied ? "patch-html" : "patch-html-failed",
      };
    }
    return {
      shouldMutateDom: false,
      primaryAction: action,
      finalAction: "",
      patchAttempted: false,
      patchApplied: false,
      fallbackApplied: false,
      patchRejectReason: "",
      reason: action ? "unknown-action" : "missing-action",
    };
  }

  function compactMismatchReason(reason) {
    return String(reason || "unknown")
      .replace(/[^a-z0-9_-]+/gi, "_")
      .replace(/-+/g, "_")
      .slice(0, 80) || "unknown";
  }

  function conversationDomConsistencyReason(input = {}) {
    const expectedVisibleTurnCount = boundedCount(input.expectedVisibleTurnCount);
    const renderedDomTurnCount = boundedCount(input.renderedDomTurnCount);
    const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
    const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
    const duplicateRenderKeyCount = boundedCount(input.duplicateRenderKeyCount);
    if (duplicateRenderKeyCount > 0) return "post-apply-duplicate-render-keys";
    if (visibleTurnOrderMismatch(input)) return "post-apply-turn-order-mismatch";
    if (expectedVisibleItemCount > 0
      && hasOwn(input, "renderedDomItemCount")
      && renderedDomItemCount < expectedVisibleItemCount) {
      return "post-apply-dom-item-mismatch";
    }
    if (expectedVisibleTurnCount > 0 && renderedDomTurnCount < expectedVisibleTurnCount) {
      return renderedDomTurnCount <= 0 ? "post-apply-dom-empty" : "post-apply-dom-turn-mismatch";
    }
    return "";
  }

  function planConversationPostApplyDomConsistency(input = {}) {
    const updatePlan = objectOrEmpty(input.updatePlan);
    const applicationPlan = objectOrEmpty(input.applicationPlan);
    const reason = conversationDomConsistencyReason(input);
    if (!reason) {
      return {
        ok: true,
        shouldFallbackToInnerHtml: false,
        shouldReport: false,
        reason: "dom-consistent",
        diagnosticInput: null,
      };
    }
    const finalAction = String(applicationPlan.finalAction || updatePlan.action || "");
    const expectedVisibleTurnCount = boundedCount(input.expectedVisibleTurnCount);
    const renderedDomTurnCount = boundedCount(input.renderedDomTurnCount);
    const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
    const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
    return {
      ok: false,
      shouldFallbackToInnerHtml: finalAction !== "set-inner-html",
      shouldReport: true,
      reason,
      diagnosticInput: {
        readMode: optionalBoundedString(input, "readMode", 80) || "",
        renderMode: finalAction.slice(0, 40),
        renderPlanReason: String(updatePlan.reason || "").slice(0, 80),
        patchRejectReason: reason,
        previousVisibleItemCount: renderedDomItemCount || renderedDomTurnCount,
        visibleItemCount: expectedVisibleItemCount || expectedVisibleTurnCount,
      },
    };
  }

  function planConversationHtmlPatchFallbackClientEvent(input = {}) {
    const applicationPlan = objectOrEmpty(input.applicationPlan || input.plan);
    if (!applicationPlan.fallbackApplied) {
      return {
        shouldPost: false,
        eventName: "",
        payload: null,
        reason: "no-fallback",
      };
    }
    const updatePlan = objectOrEmpty(input.updatePlan);
    return {
      shouldPost: true,
      eventName: "conversation_patch_html_fallback",
      payload: {
        threadId: String(input.threadId || ""),
        reason: String(applicationPlan.patchRejectReason || applicationPlan.reason || "patch-html-failed").slice(0, 80),
        updateReason: String(updatePlan.reason || "").slice(0, 80),
        expectedVisibleTurnCount: boundedCount(input.expectedVisibleTurnCount),
        renderedDomTurnCount: boundedCount(input.renderedDomTurnCount),
        action: String(applicationPlan.primaryAction || "").slice(0, 40),
        finalAction: String(applicationPlan.finalAction || "").slice(0, 40),
      },
      reason: "patch-html-fallback",
    };
  }

  function optionalBoundedString(input, key, max = 120) {
    if (!hasOwn(input, key) || input[key] === undefined || input[key] === null) return undefined;
    const value = String(input[key] || "").slice(0, max);
    return value || undefined;
  }

  function planConversationDomAuthorityInvalidation(input = {}) {
    const updatePlan = objectOrEmpty(input.updatePlan || input.plan);
    const expectedVisibleTurnCount = boundedCount(input.expectedVisibleTurnCount);
    const renderedDomTurnCount = boundedCount(input.renderedDomTurnCount);
    const expectedVisibleItemCount = boundedCount(input.expectedVisibleItemCount);
    const renderedDomItemCount = boundedCount(input.renderedDomItemCount);
    const duplicateRenderKeyCount = boundedCount(input.duplicateRenderKeyCount);
    const reason = String(updatePlan.reason || "");
    const invalidationReasons = new Set([
      "stable-signature-dom-empty",
      "stable-signature-dom-turn-mismatch",
      "stable-signature-dom-item-mismatch",
      "stable-signature-duplicate-render-keys",
      "stable-signature-turn-order-mismatch",
    ]);
    const shouldInvalidate = Boolean(
      invalidationReasons.has(reason)
      && (expectedVisibleTurnCount > 0 || expectedVisibleItemCount > 0 || duplicateRenderKeyCount > 0)
    );
    if (!shouldInvalidate) {
      return {
        shouldRecordMismatch: false,
        mismatchReason: "",
        mismatchPayload: null,
        shouldPostClientEvent: false,
        clientEventName: "",
        clientEventPayload: null,
        reason: invalidationReasons.has(reason) ? "no-expected-visible-content" : "not-authority-invalidated",
      };
    }
    const mismatchPayload = {
      source: String(input.source || "conversation-update").slice(0, 120),
      action: optionalBoundedString(input, "action", 80),
      routeKind: optionalBoundedString(input, "routeKind", 80),
      threadHash: optionalBoundedString(input, "threadHash", 80),
      renderMode: String(updatePlan.action || "full-render").slice(0, 40),
      currentTurns: hasOwn(input, "currentTurns") ? input.currentTurns : undefined,
      currentVisibleItems: hasOwn(input, "currentVisibleItems") ? input.currentVisibleItems : undefined,
      domCount: renderedDomTurnCount,
      domItemCount: renderedDomItemCount,
      duplicateRenderKeyCount,
      previousCount: boundedCount(input.previousChildCount),
    };
    return {
      shouldRecordMismatch: true,
      mismatchReason: compactMismatchReason(reason),
      mismatchPayload,
      shouldPostClientEvent: true,
      clientEventName: "conversation_dom_authority_invalidated",
      clientEventPayload: {
        threadId: String(input.threadId || ""),
        reason: reason.slice(0, 80),
        expectedVisibleTurnCount,
        renderedDomTurnCount,
        expectedVisibleItemCount,
        renderedDomItemCount,
        duplicateRenderKeyCount,
        action: String(updatePlan.action || "").slice(0, 40),
      },
      reason,
    };
  }

  function planConversationHtmlPerformanceEvent(input = {}) {
    const updatePlan = objectOrEmpty(input.updatePlan);
    const applicationPlan = objectOrEmpty(input.applicationPlan);
    const renderElapsedMs = boundedDuration(input.renderElapsedMs);
    const slowThresholdMs = boundedDuration(input.slowThresholdMs);
    const minIntervalMs = boundedDuration(input.minIntervalMs);
    const force = slowThresholdMs > 0 && renderElapsedMs >= slowThresholdMs;
    return {
      eventName: "conversation_render_ms",
      payload: {
        renderElapsedMs,
        htmlChars: String(input.html || "").length,
        previousChildCount: boundedCount(input.previousChildCount),
        childCount: boundedCount(input.childCount),
        stickToBottom: input.stickToBottom === true,
        threadId: String(input.threadId || ""),
        currentThreadStatus: String(input.currentThreadStatus || ""),
        updateReason: String(updatePlan.reason || "").slice(0, 80),
        domUpdateAction: String(applicationPlan.finalAction || "").slice(0, 40),
        patchFallbackApplied: applicationPlan.fallbackApplied === true,
        patchRejectReason: String(applicationPlan.patchRejectReason || "").slice(0, 80),
      },
      options: {
        key: "conversation_render_ms",
        minIntervalMs: force ? 0 : minIntervalMs,
        force,
      },
      reason: force ? "slow-render" : "normal-render",
    };
  }

  function planLocalConversationDomUpdateCompletionSnapshot(input = {}) {
    const tilePanePatched = Boolean(input.tilePanePatched);
    const scrollAction = input.scrollAction === "scroll-to-bottom" ? "scroll-to-bottom" : "update-bottom-button";
    return {
      tilePanePatched,
      canPatchSingleThread: tilePanePatched ? false : Boolean(input.canPatchSingleThread),
      hasRoot: Boolean(input.hasRoot),
      conversationSignature: tilePanePatched ? "" : String(input.conversationSignature || ""),
      patchShellSignature: tilePanePatched ? "" : String(input.patchShellSignature || ""),
      scrollAction: tilePanePatched ? "none" : scrollAction,
    };
  }

  function planLocalConversationDomUpdateCompletion(input = {}) {
    const snapshot = planLocalConversationDomUpdateCompletionSnapshot(input);
    if (snapshot.tilePanePatched) {
      return {
        action: "tile-pane-complete",
        complete: true,
        reason: "tile-pane-patched",
        hydrateRoot: false,
        updateRenderedConversationSignature: false,
        updatePatchShellSignature: false,
        nextRenderedConversationSignature: "",
        nextRenderedConversationPatchShellSignature: "",
        scrollAction: "none",
      };
    }
    if (!snapshot.canPatchSingleThread) {
      return {
        action: "blocked",
        complete: false,
        reason: "single-thread-unpatchable",
        hydrateRoot: false,
        updateRenderedConversationSignature: false,
        updatePatchShellSignature: false,
        nextRenderedConversationSignature: "",
        nextRenderedConversationPatchShellSignature: "",
        scrollAction: "none",
      };
    }
    return {
      action: "single-thread-complete",
      complete: true,
      reason: "single-thread-patched",
      hydrateRoot: Boolean(input.hasRoot),
      hydrateOptions: {},
      updateRenderedConversationSignature: true,
      updatePatchShellSignature: true,
      nextRenderedConversationSignature: snapshot.conversationSignature,
      nextRenderedConversationPatchShellSignature: snapshot.patchShellSignature,
      scrollAction: snapshot.scrollAction,
    };
  }

  function planLocalConversationDomUpdateCompletionEffects(plan = {}) {
    const completionPlan = objectOrEmpty(plan);
    if (!completionPlan.complete) {
      return {
        effects: [],
        reason: "completion-incomplete",
      };
    }
    const effects = [];
    if (completionPlan.hydrateRoot) {
      effects.push({
        type: "hydrate-root",
        hydrateOptions: objectOrEmpty(completionPlan.hydrateOptions),
      });
    }
    if (completionPlan.updateRenderedConversationSignature) {
      effects.push({
        type: "set-rendered-conversation-signature",
        value: String(completionPlan.nextRenderedConversationSignature || ""),
      });
    }
    if (completionPlan.updatePatchShellSignature) {
      effects.push({
        type: "set-rendered-conversation-patch-shell-signature",
        value: String(completionPlan.nextRenderedConversationPatchShellSignature || ""),
      });
    }
    const scrollEffect = scrollEffectFromAction(completionPlan.scrollAction);
    if (scrollEffect) effects.push(scrollEffect);
    return {
      effects,
      reason: effects.length ? "completion-effects" : "no-completion-effects",
    };
  }

  function planThreadDetailRefreshLocalPatchTransactionEffects(input = {}) {
    return {
      commitEffects: [
        {
          type: "complete-local-conversation-dom-update",
          name: "complete-local-conversation-dom-update",
          completionSnapshot: objectOrEmpty(input.completionSnapshot),
        },
      ],
      afterSuccess: [
        {
          type: "update-live-operation-dock",
          name: "update-live-operation-dock",
        },
        {
          type: "bind-current-thread-actions",
          name: "bind-current-thread-actions",
        },
      ],
      reason: "refresh-local-patch-transaction-effects",
    };
  }

  function createElementFromHtml(input = {}) {
    const html = String(input.html || "");
    if (!html.trim()) return null;
    const doc = documentFrom(input);
    if (!doc) return null;
    let template = null;
    try {
      template = doc.createElement("template");
      if (!template) return null;
      template.innerHTML = html;
      return template.content && template.content.firstElementChild || null;
    } catch (_) {
      return null;
    }
  }

  function createTurnArticleElement(input = {}) {
    const turn = input.turn || null;
    const renderTurnHtml = typeof input.renderTurnHtml === "function" ? input.renderTurnHtml : null;
    if (!turn || !renderTurnHtml) return null;
    let html = "";
    try {
      html = renderTurnHtml(turn, input.previousKeys);
    } catch (_) {
      return null;
    }
    return createElementFromHtml({
      document: input.document,
      html,
    });
  }

  function hydrateRenderedSurface(input = {}) {
    const root = input.root || input.surface || null;
    if (!root) return result(false, "missing-root", { githubHydrated: 0, mermaidHydrated: 0, imageScans: 0 });
    const hydrateGitHubLinks = typeof input.hydrateGitHubLinks === "function" ? input.hydrateGitHubLinks : null;
    const hydrateMermaid = typeof input.hydrateMermaid === "function" ? input.hydrateMermaid : null;
    const scheduleImageScan = typeof input.scheduleImageScan === "function" ? input.scheduleImageScan : null;
    const counts = { githubHydrated: 0, mermaidHydrated: 0, imageScans: 0 };
    if (hydrateGitHubLinks) {
      hydrateGitHubLinks(root);
      counts.githubHydrated += 1;
    }
    if (hydrateMermaid) {
      hydrateMermaid(root);
      counts.mermaidHydrated += 1;
    }
    if (scheduleImageScan) {
      if (hasOwn(input, "imageScanDelays")) scheduleImageScan(root, input.imageScanDelays);
      else scheduleImageScan(root);
      counts.imageScans += 1;
    }
    return result(true, "hydrated", counts);
  }

  function defaultEscapeSelectorAttr(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function findElementByRenderKey(input = {}) {
    const root = input.root || input.conversation || null;
    if (!root || typeof root.querySelector !== "function") return null;
    const key = String(input.key || input.renderKey || input.turnKey || "");
    if (!key) return null;
    const escapeSelectorAttr = typeof input.escapeSelectorAttr === "function"
      ? input.escapeSelectorAttr
      : defaultEscapeSelectorAttr;
    try {
      return root.querySelector(`[data-render-key="${escapeSelectorAttr(key)}"]`) || null;
    } catch (_) {
      return null;
    }
  }

  function findTurnArticleElement(input = {}) {
    return findElementByRenderKey(input);
  }

  function resolveTurnInsertAnchor(input = {}) {
    const turn = input.turn || null;
    if (!turn) return { ok: false, reason: "missing-turn", anchor: null };
    const visibleTurns = Array.isArray(input.visibleTurns) ? input.visibleTurns : [];
    const findTurnElement = typeof input.findTurnElement === "function" ? input.findTurnElement : null;
    if (!findTurnElement) return { ok: false, reason: "missing-find-turn-element", anchor: null };
    const turnIndex = visibleTurns.indexOf(turn);
    for (let index = turnIndex - 1; index >= 0; index -= 1) {
      const previous = findTurnElement(visibleTurns[index], index);
      if (previous) {
        return {
          ok: true,
          reason: "after-previous-turn",
          anchor: previous.nextSibling || null,
        };
      }
    }
    const firstTurn = firstTurnElementFrom(input);
    return {
      ok: true,
      reason: firstTurn ? "before-first-turn" : "append",
      anchor: firstTurn || null,
    };
  }

  function insertTurnArticleElement(input = {}) {
    const conversation = input.conversation;
    if (!conversation || typeof conversation.insertBefore !== "function") {
      return result(false, "missing-conversation");
    }
    const source = input.source || null;
    if (!source) return result(false, "missing-source");
    const anchorPlan = resolveTurnInsertAnchor(input);
    if (!anchorPlan.ok) return result(false, anchorPlan.reason || "insert-anchor-failed");
    conversation.insertBefore(source, anchorPlan.anchor || null);
    return result(true, anchorPlan.reason || "inserted", { inserted: 1 });
  }

  function insertVisibleItemElement(input = {}) {
    const article = input.article || input.root || null;
    if (!article || typeof article.insertBefore !== "function") {
      return result(false, "missing-article");
    }
    const source = input.source || null;
    if (!source) return result(false, "missing-source");
    const entries = Array.isArray(input.entries) ? input.entries : [];
    const visibleIndex = Number.isInteger(input.visibleIndex) ? input.visibleIndex : -1;
    if (visibleIndex < 0 || visibleIndex >= entries.length) return result(false, "invalid-visible-index");
    const keyForEntry = typeof input.keyForEntry === "function" ? input.keyForEntry : null;
    const findElementByKey = typeof input.findElementByKey === "function" ? input.findElementByKey : null;
    if (!keyForEntry || !findElementByKey) return result(false, "missing-key-lookup");

    let anchor = null;
    let foundPrevious = false;
    for (let index = visibleIndex - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      const key = String(keyForEntry(entry, index) || "");
      if (!key) continue;
      const previousNode = findElementByKey(key, entry, index);
      if (!previousNode) continue;
      foundPrevious = true;
      anchor = previousNode.nextSibling || null;
      break;
    }
    if (!foundPrevious) anchor = article.firstChild || null;
    article.insertBefore(source, anchor);
    return result(true, "inserted", {
      inserted: 1,
      target: source,
      anchor,
      anchorMode: foundPrevious ? (anchor ? "after-previous-before-next" : "append-after-previous") : "before-first",
    });
  }

  function applyVisibleItemRefreshDomPatch(input = {}) {
    const patchPlan = input.patchPlan;
    if (!patchPlan || !patchPlan.canPatch || !Array.isArray(patchPlan.operations)) {
      return result(false, "plan-not-patchable");
    }
    const article = input.article;
    if (!article || typeof article.insertBefore !== "function") {
      return result(false, "missing-article");
    }
    const findElementByKey = typeof input.findElementByKey === "function" ? input.findElementByKey : null;
    const renderElement = typeof input.renderElement === "function" ? input.renderElement : null;
    const patchElement = typeof input.patchElement === "function" ? input.patchElement : null;
    if (!findElementByKey) return result(false, "missing-find-element");
    if (!renderElement) return result(false, "missing-render-element");
    if (!patchElement) return result(false, "missing-patch-element");

    let lastPatchedNode = null;
    const counts = { reused: 0, patched: 0, inserted: 0 };
    for (const rawOperation of patchPlan.operations) {
      const operation = normalizeOperation(rawOperation);
      if (!operation) return result(false, "invalid-operation", counts);
      const nextEntry = operation.nextEntry;
      if (operation.type === "reuse" || operation.type === "patch") {
        const existingNode = findElementByKey(operation.key, nextEntry);
        if (!existingNode) return result(false, "missing-existing-node", counts);
        if (operation.type === "reuse") {
          lastPatchedNode = existingNode;
          counts.reused += 1;
          continue;
        }
        const patchedNode = patchElement(existingNode, nextEntry);
        if (!patchedNode) return result(false, "patch-existing-node-failed", counts);
        lastPatchedNode = patchedNode;
        counts.patched += 1;
        continue;
      }
      if (operation.type !== "insert") return result(false, "unknown-operation", counts);
      const source = renderElement(nextEntry);
      if (!source) return result(false, "render-insert-node-failed", counts);
      const anchor = lastPatchedNode ? lastPatchedNode.nextSibling : article.firstChild;
      article.insertBefore(source, anchor || null);
      lastPatchedNode = source;
      counts.inserted += 1;
    }
    const nextKeys = new Set(patchPlan.operations
      .map((operation) => normalizeOperation(operation))
      .filter(Boolean)
      .map((operation) => operation.key));
    for (const child of Array.from(article.childNodes || [])) {
      const key = visibleItemRenderKeyForNode(child);
      if (!key || nextKeys.has(key)) continue;
      if (typeof child.remove === "function") child.remove();
    }
    return result(true, "applied", counts);
  }

  function applyThreadTurnRefreshDomPatch(input = {}) {
    const patchPlan = input.patchPlan;
    if (!patchPlan || !patchPlan.canPatch || !Array.isArray(patchPlan.operations)) {
      return result(false, "turn-patch-plan-not-patchable", { itemPatched: 0, replaced: 0 });
    }
    const findTurnByKey = typeof input.findTurnByKey === "function" ? input.findTurnByKey : null;
    const applyItemPatch = typeof input.applyItemPatch === "function" ? input.applyItemPatch : null;
    const renderTurnElement = typeof input.renderTurnElement === "function" ? input.renderTurnElement : null;
    const insertTurnElement = typeof input.insertTurnElement === "function" ? input.insertTurnElement : null;
    const replaceTurnElement = typeof input.replaceTurnElement === "function" ? input.replaceTurnElement : null;
    if (!findTurnByKey) return result(false, "missing-find-turn", { itemPatched: 0, replaced: 0 });
    if (!applyItemPatch) return result(false, "missing-apply-item-patch", { itemPatched: 0, replaced: 0 });
    if (!renderTurnElement) return result(false, "missing-render-turn", { itemPatched: 0, replaced: 0 });
    if (!insertTurnElement) return result(false, "missing-insert-turn", { itemPatched: 0, replaced: 0 });
    if (!replaceTurnElement) return result(false, "missing-replace-turn", { itemPatched: 0, replaced: 0 });

    const counts = { reused: 0, patched: 0, inserted: 0, itemPatched: 0, replaced: 0 };
    for (const rawOperation of patchPlan.operations) {
      const operation = normalizeTurnOperation(rawOperation);
      if (!operation) return result(false, "invalid-turn-operation", counts);
      const turn = findTurnByKey(operation.key, operation);
      if (!turn) return result(false, "turn-patch-operation-missing-turn", counts);
      if (operation.type === "item-patch") {
        const itemPatchResult = applyItemPatch(turn, operation);
        if (!callbackOk(itemPatchResult)) return result(false, callbackReason(itemPatchResult, "item-patch-failed"), counts);
        counts.itemPatched += 1;
        counts.patched += 1;
        continue;
      }
      if (operation.type !== "insert-turn" && operation.type !== "replace-turn") {
        return result(false, "unknown-turn-patch-operation", counts);
      }
      const source = renderTurnElement(turn, operation);
      if (!source) return result(false, "render-turn-failed", counts);
      if (operation.type === "insert-turn") {
        const insertResult = insertTurnElement(source, turn, operation);
        if (!callbackOk(insertResult)) return result(false, callbackReason(insertResult, "insert-turn-failed"), counts);
        counts.inserted += 1;
        continue;
      }
      const replaceResult = replaceTurnElement(source, turn, operation);
      if (!callbackOk(replaceResult)) return result(false, callbackReason(replaceResult, "replace-turn-failed"), counts);
      counts.replaced += 1;
      counts.patched += 1;
    }
    return result(true, "applied", counts);
  }

  function resultCounts(source = {}) {
    const counts = {};
    for (const key of ["reused", "patched", "inserted", "itemPatched", "replaced"]) {
      if (Number.isFinite(Number(source[key]))) counts[key] = Number(source[key]);
    }
    return counts;
  }

  function normalizeTransactionEffect(effect, index) {
    if (typeof effect === "function") {
      return { name: `effect-${index}`, apply: effect };
    }
    if (effect && typeof effect === "object" && typeof effect.apply === "function") {
      return {
        name: String(effect.name || `effect-${index}`),
        apply: effect.apply,
      };
    }
    return null;
  }

  function applyTransactionEffects(effects, patchResult, counts, countKey) {
    const list = Array.isArray(effects) ? effects : [];
    for (let index = 0; index < list.length; index += 1) {
      const effect = normalizeTransactionEffect(list[index], index);
      if (!effect) return result(false, "invalid-transaction-effect", counts);
      let effectResult = null;
      try {
        effectResult = effect.apply(patchResult);
      } catch (_) {
        return result(false, `${effect.name || "effect"}-threw`, counts);
      }
      if (!callbackOk(effectResult)) {
        return result(false, callbackReason(effectResult, `${effect.name || "effect"}-failed`), counts);
      }
      counts.effectsApplied += 1;
      counts[countKey] = Number(counts[countKey] || 0) + 1;
    }
    return result(true, "effects-applied", counts);
  }

  function applyThreadDetailPatchTransaction(input = {}) {
    const applyPatch = typeof input.applyPatch === "function" ? input.applyPatch : null;
    if (!applyPatch) return result(false, "missing-apply-patch", {
      effectsApplied: 0,
      commitEffectsApplied: 0,
      postCommitEffectsApplied: 0,
    });
    let patchResult = null;
    try {
      patchResult = applyPatch();
    } catch (_) {
      return result(false, "apply-patch-threw", {
        effectsApplied: 0,
        commitEffectsApplied: 0,
        postCommitEffectsApplied: 0,
      });
    }
    const counts = Object.assign({
      effectsApplied: 0,
      commitEffectsApplied: 0,
      postCommitEffectsApplied: 0,
    }, resultCounts(patchResult));
    if (!callbackOk(patchResult)) return result(false, callbackReason(patchResult, "patch-failed"), counts);

    const commitResult = applyTransactionEffects(input.commitEffects, patchResult, counts, "commitEffectsApplied");
    if (!commitResult.ok) return commitResult;
    const postCommitResult = applyTransactionEffects(input.afterSuccess, patchResult, counts, "postCommitEffectsApplied");
    if (!postCommitResult.ok) return postCommitResult;
    return result(true, "transaction-applied", counts);
  }

  function applyLiveTextItemDomPatch(input = {}) {
    const root = input.root || input.conversation || null;
    if (!root || typeof root.querySelector !== "function") return result(false, "missing-root");
    const key = String(input.key || input.renderKey || "");
    if (!key) return result(false, "missing-render-key");
    const renderHtml = typeof input.renderHtml === "function" ? input.renderHtml : null;
    const patchElement = typeof input.patchElement === "function" ? input.patchElement : null;
    if (!renderHtml) return result(false, "missing-render-html");
    if (!patchElement) return result(false, "missing-patch-element");

    const target = findElementByRenderKey({
      root,
      key,
      escapeSelectorAttr: input.escapeSelectorAttr,
    });
    if (!target) return result(false, "missing-live-text-target");

    let html = "";
    try {
      html = renderHtml();
    } catch (_) {
      return result(false, "render-live-text-html-failed");
    }
    const source = createElementFromHtml({
      document: input.document,
      html,
    });
    if (!source) return result(false, "render-live-text-node-failed");

    const patched = patchElement(target, source);
    if (!callbackOk(patched)) return result(false, callbackReason(patched, "patch-live-text-node-failed"));
    const patchedTarget = patched && typeof patched === "object" && patched.target ? patched.target : target;
    return result(true, "patched", { patched: 1, target: patchedTarget });
  }

  return {
    applyLiveTextItemDomPatch,
    applyThreadDetailPatchTransaction,
    applyThreadTurnRefreshDomPatch,
    applyVisibleItemRefreshDomPatch,
    canPatchNode,
    createElementFromHtml,
    createTurnArticleElement,
    findElementByRenderKey,
    findTurnArticleElement,
    hydrateRenderedSurface,
    insertTurnArticleElement,
    insertVisibleItemElement,
    normalizeOperation,
    normalizeTurnOperation,
    patchChildNodes,
    patchHtml,
    patchNode,
    planConversationHtmlUpdate,
    planConversationHtmlUpdateEffects,
    planConversationHtmlUpdateApplication,
    planConversationPostApplyDomConsistency,
    planConversationDomAuthorityInvalidation,
    planConversationHtmlPatchFallbackClientEvent,
    planConversationHtmlPerformanceEvent,
    planLocalConversationDomUpdateCompletionSnapshot,
    planLocalConversationDomUpdateCompletion,
    planLocalConversationDomUpdateCompletionEffects,
    planThreadDetailRefreshLocalPatchTransactionEffects,
    renderKeyForNode,
    resolveTurnInsertAnchor,
    syncAttributes,
    threadDetailPatchResult,
    visibleTurnOrderMismatch,
  };
}));
