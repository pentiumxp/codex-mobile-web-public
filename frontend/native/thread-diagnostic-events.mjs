const MAX_COUNT = 100000;

  function compactToken(value, fallback = "", maxLength = 80) {
    const raw = String(value || "").trim();
    const safe = raw
      .replace(/[^a-zA-Z0-9_.:-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, maxLength);
    return safe || fallback;
  }

  function boundedCount(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.min(MAX_COUNT, Math.trunc(number));
  }

  function boundedRolloutMb(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return boundedCount(Math.ceil(number / (1024 * 1024)));
  }

  function boundedPayloadKb(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return boundedCount(Math.ceil(number / 1024));
  }

  function projectionDiagnosticContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const out = {
      surface: compactToken(source.surface, "conversation-render", 80),
      action: compactToken(source.action, "render", 80),
    };
    const routeKind = compactToken(source.route_kind || source.routeKind, "", 80);
    const readMode = compactToken(source.read_mode || source.readMode, "", 80);
    const renderMode = compactToken(source.render_mode || source.renderMode, "", 80);
    const threadHash = compactToken(source.thread_hash || source.threadHash, "", 80);
    const turnHash = compactToken(source.turn_hash || source.turnHash, "", 80);
    if (routeKind) out.route_kind = routeKind;
    if (readMode) out.read_mode = readMode;
    if (renderMode) out.render_mode = renderMode;
    if (threadHash) out.thread_hash = threadHash;
    if (turnHash) out.turn_hash = turnHash;
    return out;
  }

  function projectionDiagnosticCounts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const out = {
      dom_count: boundedCount(source.dom_count || source.domCount),
      duplicate_count: boundedCount(source.duplicate_count || source.duplicateCount),
      visible_count: boundedCount(source.visible_count || source.visibleCount),
      turn_count: boundedCount(source.turn_count || source.turnCount),
    };
    const paneCount = boundedCount(source.pane_count || source.paneCount);
    if (paneCount) out.pane_count = paneCount;
    const orderMismatchCount = boundedCount(source.order_mismatch_count || source.orderMismatchCount);
    if (orderMismatchCount) out.order_mismatch_count = orderMismatchCount;
    const latestMismatchCount = boundedCount(source.latest_mismatch_count || source.latestMismatchCount);
    if (latestMismatchCount) out.latest_mismatch_count = latestMismatchCount;
    const missingDomTurnCount = boundedCount(source.missing_dom_turn_count || source.missingDomTurnCount);
    if (missingDomTurnCount) out.missing_dom_turn_count = missingDomTurnCount;
    return out;
  }

  function projectionDiagnosticSnapshot(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      renderedSignature: String(source.renderedSignature || ""),
      currentSignature: String(source.currentSignature || ""),
      context: projectionDiagnosticContext(source.context || {}),
      counts: projectionDiagnosticCounts(source.counts || {}),
    };
  }

  function visibleShapeFrom(deps, thread) {
    if (typeof deps.visibleShape === "function") {
      const shape = deps.visibleShape(thread);
      if (shape && typeof shape === "object") return shape;
    }
    return { visibleTurnCount: 0, visibleItemCount: 0 };
  }

  function domCountsFromShape(domShape = {}) {
    return {
      dom_count: domShape.renderKeyCount || domShape.dom_count || domShape.domCount,
      duplicate_count: domShape.duplicateRenderKeyCount || domShape.duplicate_count || domShape.duplicateCount,
    };
  }

  function conversationProjectionDiagnosticSnapshot(input = {}, deps = {}) {
    const source = input && typeof input === "object" ? input : {};
    const action = compactToken(source.source || source.action, "render", 80);
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    const renderedSignature = String(source.renderedConversationSignature || source.renderedSignature || "");
    const domShape = source.domShape && typeof source.domShape === "object" ? source.domShape : {};
    const baseCounts = domCountsFromShape(domShape);
    const tileMode = source.threadTileMode === true;
    const tileDomActive = source.tileDomActive === true;

    if (tileMode) {
      if (!tileDomActive) return null;
      const layout = source.tileLayout || (typeof deps.tileLayout === "function" ? deps.tileLayout() : null);
      if (!layout || !layout.enabled) return null;
      const ids = Array.isArray(source.tileIds)
        ? source.tileIds
        : (typeof deps.tileCandidateIds === "function" ? deps.tileCandidateIds(layout) : []);
      if (!ids.length) return null;
      const displayLayout = source.tileDisplayLayout || (typeof deps.tileDisplayLayout === "function"
        ? deps.tileDisplayLayout(layout, ids)
        : layout);
      const currentSignature = source.tileSignature || source.currentSignature || (typeof deps.tileRenderSignature === "function"
        ? deps.tileRenderSignature(displayLayout, ids)
        : "");
      const visibleShape = ids.reduce((acc, id) => {
        const thread = typeof deps.tileThreadForId === "function" ? deps.tileThreadForId(id) : null;
        const shape = visibleShapeFrom(deps, thread);
        acc.visibleTurnCount += boundedCount(shape.visibleTurnCount);
        acc.visibleItemCount += boundedCount(shape.visibleItemCount);
        return acc;
      }, { visibleTurnCount: 0, visibleItemCount: 0 });
      return projectionDiagnosticSnapshot({
        renderedSignature,
        currentSignature,
        context: {
          surface: "conversation-render",
          action,
          route_kind: "thread-tile",
          read_mode: "mixed",
          render_mode: renderMode,
        },
        counts: Object.assign({}, baseCounts, {
          visible_count: visibleShape.visibleItemCount,
          turn_count: visibleShape.visibleTurnCount,
          pane_count: ids.length,
        }),
      });
    }

    if (tileDomActive) return null;
    const thread = source.thread || null;
    const visibleShape = visibleShapeFrom(deps, thread);
    const currentSignature = source.currentSignature || (typeof deps.singleSignature === "function"
      ? deps.singleSignature(thread)
      : "");
    return projectionDiagnosticSnapshot({
      renderedSignature,
      currentSignature,
      context: {
        surface: "conversation-render",
        action,
        read_mode: thread && thread.mobileReadMode || "",
        render_mode: renderMode,
      },
      counts: Object.assign({}, baseCounts, {
        visible_count: visibleShape.visibleItemCount,
        turn_count: visibleShape.visibleTurnCount,
      }),
    });
  }

  function turnOrderDiagnosticSnapshot(input = {}, deps = {}) {
    const source = input && typeof input === "object" ? input : {};
    const expectedIds = Array.isArray(source.expectedTurnIds)
      ? source.expectedTurnIds.map((id) => String(id || "")).filter(Boolean)
      : [];
    const domIds = Array.isArray(source.domTurnIds)
      ? source.domTurnIds.map((id) => String(id || "")).filter(Boolean)
      : [];
    if (!expectedIds.length) return null;
    const comparableCount = Math.min(expectedIds.length, domIds.length);
    let orderMismatchCount = Math.abs(expectedIds.length - domIds.length);
    for (let index = 0; index < comparableCount; index += 1) {
      if (expectedIds[index] !== domIds[index]) orderMismatchCount += 1;
    }
    const expectedLatestId = expectedIds[expectedIds.length - 1] || "";
    const domLatestId = domIds[domIds.length - 1] || "";
    const latestMismatch = Boolean(
      expectedLatestId
      && (!domLatestId || expectedLatestId !== domLatestId)
    );
    const turnHash = compactToken(
      source.turnHash || (typeof deps.turnHash === "function" ? deps.turnHash(expectedLatestId) : ""),
      "",
      80,
    );
    return projectionDiagnosticSnapshot({
      context: {
        surface: "conversation-render",
        action: source.source || source.action,
        read_mode: source.readMode || source.read_mode,
        render_mode: source.renderMode || source.render_mode,
        thread_hash: source.threadHash || source.thread_hash,
        turn_hash: turnHash,
      },
      counts: {
        dom_count: domIds.length,
        visible_count: expectedIds.length,
        turn_count: expectedIds.length,
        order_mismatch_count: orderMismatchCount,
        latest_mismatch_count: latestMismatch ? 1 : 0,
        missing_dom_turn_count: !domIds.length ? expectedIds.length : 0,
      },
    });
  }

  function hasRenderSignatureMismatch(snapshot) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    return Boolean(normalized.renderedSignature && normalized.renderedSignature !== normalized.currentSignature);
  }

  function hasDuplicateRenderKeys(snapshot) {
    return projectionDiagnosticSnapshot(snapshot).counts.duplicate_count > 0;
  }

  function hasTurnOrderMismatch(snapshot) {
    const counts = projectionDiagnosticSnapshot(snapshot).counts;
    return counts.order_mismatch_count > 0
      || counts.latest_mismatch_count > 0
      || counts.missing_dom_turn_count > 0;
  }

  function renderSignatureMismatchDiagnosticEvent(snapshot = {}) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    const context = normalized.context;
    const counts = normalized.counts;
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "render_signature_mismatch",
      severity_hint: "H2",
      evidence_confidence: 0.74,
      error_code: "render_signature_mismatch",
      context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "signature-check",
        status: "failed",
        fields: {
          read_mode: context.read_mode || "",
          render_mode: context.render_mode || "",
          dom_count: counts.dom_count,
          visible_count: counts.visible_count,
        },
      }],
    };
  }

  function renderSignatureMismatchDiagnosticSuccess(snapshot = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "render_signature_mismatch",
      error_code: "render_signature_mismatch",
      context: projectionDiagnosticSnapshot(snapshot).context,
    };
  }

  function duplicateRenderKeysDiagnosticEvent(snapshot = {}) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    const counts = normalized.counts;
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "duplicate_render_keys",
      severity_hint: "H2",
      evidence_confidence: 0.78,
      error_code: "duplicate_render_keys",
      context: normalized.context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "render-key-check",
        status: "failed",
        fields: {
          duplicate_count: counts.duplicate_count,
          dom_count: counts.dom_count,
          visible_count: counts.visible_count,
        },
      }],
    };
  }

  function duplicateRenderKeysDiagnosticSuccess(snapshot = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "duplicate_render_keys",
      error_code: "duplicate_render_keys",
      context: projectionDiagnosticSnapshot(snapshot).context,
    };
  }

  function turnOrderMismatchDiagnosticEvent(snapshot = {}) {
    const normalized = projectionDiagnosticSnapshot(snapshot);
    const counts = normalized.counts;
    const context = normalized.context;
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "turn_order_mismatch",
      severity_hint: "H2",
      evidence_confidence: 0.82,
      error_code: "turn_order_mismatch",
      context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "turn-order-check",
        status: "failed",
        fields: {
          read_mode: context.read_mode || "",
          render_mode: context.render_mode || "",
          dom_count: counts.dom_count,
          visible_count: counts.visible_count,
          turn_hash: context.turn_hash || "",
          order_mismatch_count: counts.order_mismatch_count || 0,
          latest_mismatch_count: counts.latest_mismatch_count || 0,
          missing_dom_turn_count: counts.missing_dom_turn_count || 0,
        },
      }],
    };
  }

  function turnOrderMismatchDiagnosticSuccess(snapshot = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "turn_order_mismatch",
      error_code: "turn_order_mismatch",
      context: projectionDiagnosticSnapshot(snapshot).context,
    };
  }

  function conversationProjectionConsistencyEffects(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const snapshot = source.snapshot || null;
    const orderSnapshot = source.orderSnapshot || null;
    const effects = [];
    if (snapshot) {
      const normalized = projectionDiagnosticSnapshot(snapshot);
      const signatureMismatch = hasRenderSignatureMismatch(normalized);
      effects.push({
        type: signatureMismatch ? "diagnostic-failure" : "diagnostic-success",
        diagnostic: signatureMismatch
          ? renderSignatureMismatchDiagnosticEvent(normalized)
          : renderSignatureMismatchDiagnosticSuccess(normalized),
        diagnosticType: "render_signature_mismatch",
        reason: signatureMismatch ? "render-signature-mismatch" : "render-signature-match",
      });
      const duplicateKeys = hasDuplicateRenderKeys(normalized);
      effects.push({
        type: duplicateKeys ? "diagnostic-failure" : "diagnostic-success",
        diagnostic: duplicateKeys
          ? duplicateRenderKeysDiagnosticEvent(normalized)
          : duplicateRenderKeysDiagnosticSuccess(normalized),
        diagnosticType: "duplicate_render_keys",
        reason: duplicateKeys ? "duplicate-render-keys" : "no-duplicate-render-keys",
      });
    }
    if (orderSnapshot) {
      const normalizedOrder = projectionDiagnosticSnapshot(orderSnapshot);
      const turnOrderMismatch = hasTurnOrderMismatch(normalizedOrder);
      effects.push({
        type: turnOrderMismatch ? "diagnostic-failure" : "diagnostic-success",
        diagnostic: turnOrderMismatch
          ? turnOrderMismatchDiagnosticEvent(normalizedOrder)
          : turnOrderMismatchDiagnosticSuccess(normalizedOrder),
        diagnosticType: "turn_order_mismatch",
        reason: turnOrderMismatch ? "turn-order-mismatch" : "turn-order-match",
      });
    }
    return {
      effects,
      reason: effects.length ? "projection-consistency-effects" : "no-snapshot",
    };
  }

  function primaryShellSelectionConflictContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: "conversation-render",
      action: compactToken(source.action, "primary-shell-selection", 80),
      route_kind: compactToken(source.routeKind || source.route_kind, "embedded-primary", 80),
    };
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    if (readMode) context.read_mode = readMode;
    if (renderMode) context.render_mode = renderMode;
    if (sourceKind) context.source_kind = sourceKind;
    if (threadHash) context.thread_hash = threadHash;
    return context;
  }

  function primaryShellSelectionConflictCounts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      visible_count: boundedCount(source.visibleItems || source.visible_count),
      turn_count: boundedCount(source.turns || source.turn_count),
      item_count: boundedCount(source.items || source.item_count),
      dom_count: boundedCount(source.domCount || source.dom_count),
      previous_count: boundedCount(source.previousCount || source.previous_count),
      has_current_thread: source.hasCurrentThread || source.has_current_thread ? 1 : 0,
      has_current_thread_id: source.hasCurrentThreadId || source.has_current_thread_id ? 1 : 0,
      has_thread_load_controller: source.hasThreadLoadController || source.has_thread_load_controller ? 1 : 0,
      startup_thread_open_pending: source.startupThreadOpenPending || source.startup_thread_open_pending ? 1 : 0,
      mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
      recent_detail_age_ms: boundedCount(source.recentDetailAgeMs || source.recent_detail_age_ms),
    };
  }

  function primaryShellSelectionConflictDiagnosticEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = primaryShellSelectionConflictContext(source);
    const counts = primaryShellSelectionConflictCounts(source);
    const reason = compactToken(source.reason, "primary_shell_selection_conflict", 80);
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "primary_shell_selection_conflict",
      severity_hint: "H2",
      evidence_confidence: 0.82,
      error_code: reason,
      context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "primary-shell-selection",
        status: "failed",
        fields: {
          read_mode: context.read_mode || "",
          render_mode: context.render_mode || "",
          source_kind: context.source_kind || "",
          thread_hash: context.thread_hash || "",
          dom_count: counts.dom_count,
          visible_count: counts.visible_count,
          turn_count: counts.turn_count,
          item_count: counts.item_count,
          previous_count: counts.previous_count,
        },
      }],
    };
  }

  function primaryShellSelectionConflictDiagnosticSuccess(input = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "primary_shell_selection_conflict",
      error_code: "primary_shell_selection_conflict",
      context: primaryShellSelectionConflictContext(input),
    };
  }

  function emptyVisibleDetailMismatchContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: "conversation-render",
      action: compactToken(source.action, "single-thread-empty-state", 80),
      route_kind: compactToken(source.routeKind || source.route_kind, "single-thread", 80),
    };
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    if (readMode) context.read_mode = readMode;
    if (renderMode) context.render_mode = renderMode;
    if (sourceKind) context.source_kind = sourceKind;
    if (threadHash) context.thread_hash = threadHash;
    return context;
  }

  function emptyVisibleDetailMismatchCounts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      visible_count: boundedCount(source.visibleItems || source.visible_count),
      turn_count: boundedCount(source.turns || source.turn_count),
      item_count: boundedCount(source.items || source.item_count),
      current_visible_count: boundedCount(source.currentVisibleItems || source.current_visible_count),
      current_turn_count: boundedCount(source.currentTurns || source.current_turn_count),
      dom_count: boundedCount(source.domCount || source.dom_count),
      previous_count: boundedCount(source.previousCount || source.previous_count),
      detail_loaded: source.detailLoaded || source.detail_loaded ? 1 : 0,
      mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
      recent_detail_age_ms: boundedCount(source.recentDetailAgeMs || source.recent_detail_age_ms),
    };
  }

  function emptyVisibleDetailMismatchDiagnosticEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = emptyVisibleDetailMismatchContext(source);
    const counts = emptyVisibleDetailMismatchCounts(source);
    const reason = compactToken(source.reason, "empty_visible_detail_mismatch", 80);
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "empty_visible_detail_mismatch",
      severity_hint: "H2",
      evidence_confidence: 0.84,
      error_code: reason,
      context,
      counts,
      breadcrumbs: [{
        kind: "conversation-render",
        code: "empty-state-contract",
        status: "failed",
        fields: {
          read_mode: context.read_mode || "",
          render_mode: context.render_mode || "",
          source_kind: context.source_kind || "",
          thread_hash: context.thread_hash || "",
          visible_count: counts.visible_count,
          turn_count: counts.turn_count,
          item_count: counts.item_count,
          dom_count: counts.dom_count,
          previous_count: counts.previous_count,
        },
      }],
    };
  }

  function emptyVisibleDetailMismatchDiagnosticSuccess(input = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "empty_visible_detail_mismatch",
      error_code: "empty_visible_detail_mismatch",
      context: emptyVisibleDetailMismatchContext(input),
    };
  }

  function emptyCachedDetailReuseContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: "thread-session",
      action: compactToken(source.action, "thread-open-cache-reuse", 80),
      route_kind: compactToken(source.routeKind || source.route_kind, "single-thread", 80),
    };
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    const sourceKind = compactToken(source.sourceKind || source.source_kind, "", 80);
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    if (readMode) context.read_mode = readMode;
    if (sourceKind) context.source_kind = sourceKind;
    if (threadHash) context.thread_hash = threadHash;
    return context;
  }

  function emptyCachedDetailReuseCounts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    return {
      current_turn_count: boundedCount(source.currentTurns || source.current_turn_count),
      current_visible_count: boundedCount(source.currentVisibleItems || source.current_visible_count),
      item_count: boundedCount(source.items || source.item_count),
      detail_loaded: source.detailLoaded || source.detail_loaded ? 1 : 0,
      reusable_detail: source.reusableDetail || source.reusable_detail ? 1 : 0,
      mobile_loading: source.mobileLoading || source.mobile_loading ? 1 : 0,
      thread_task_card_count: boundedCount(source.threadTaskCardCount || source.thread_task_card_count),
    };
  }

  function emptyCachedDetailReuseBlockedDiagnosticEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = emptyCachedDetailReuseContext(source);
    const counts = emptyCachedDetailReuseCounts(source);
    const reason = compactToken(source.reason, "empty_cached_detail_reuse_blocked", 80);
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "empty_cached_detail_reuse_blocked",
      severity_hint: "H2",
      evidence_confidence: 0.8,
      error_code: reason,
      context,
      counts,
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-open-cache-reuse",
        status: "blocked",
        fields: {
          read_mode: context.read_mode || "",
          source_kind: context.source_kind || "",
          thread_hash: context.thread_hash || "",
          current_turn_count: counts.current_turn_count,
          current_visible_count: counts.current_visible_count,
          item_count: counts.item_count,
          detail_loaded: counts.detail_loaded,
          reusable_detail: counts.reusable_detail,
        },
      }],
    };
  }

  function emptyCachedDetailReuseDiagnosticSuccess(input = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "empty_cached_detail_reuse_blocked",
      error_code: "empty_cached_detail_reuse_blocked",
      context: emptyCachedDetailReuseContext(input),
    };
  }

  function detailPatchRejectedDiagnosticEvent(input = {}) {
    const readMode = compactToken(input.readMode, "", 80);
    const renderMode = compactToken(input.renderMode, "", 80);
    const renderPlanReason = compactToken(input.renderPlanReason, "", 80);
    const patchRejectReason = compactToken(input.patchRejectReason, "unknown", 80);
    const previousCount = boundedCount(input.previousVisibleItemCount);
    const visibleCount = boundedCount(input.visibleItemCount);
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "detail_patch_rejected",
      severity_hint: "H3",
      evidence_confidence: 0.7,
      error_code: "detail_patch_rejected",
      context: {
        surface: "conversation-render",
        action: "thread-detail-refresh",
        read_mode: readMode,
        render_mode: renderMode,
        render_plan_reason: renderPlanReason,
        patch_reject_reason: patchRejectReason,
      },
      counts: {
        previous_count: previousCount,
        visible_count: visibleCount,
      },
      breadcrumbs: [{
        kind: "conversation-render",
        code: "detail-patch",
        status: "rejected",
        fields: {
          read_mode: readMode,
          render_mode: renderMode,
          render_plan_reason: renderPlanReason,
          patch_reject_reason: patchRejectReason,
          visible_count: visibleCount,
        },
      }],
    };
  }

  function threadDetailRefreshFailedDiagnosticEvent(input = {}) {
    const threadHash = compactToken(input.threadHash, "", 80);
    const errorCode = compactToken(input.errorCode, "thread_detail_refresh_failed", 80);
    const durationBucket = compactToken(input.durationBucket, "", 80);
    const statusCode = boundedCount(input.statusCode);
    return {
      category: "thread_session_load_failed",
      diagnostic_type: "thread_detail_refresh_failed",
      severity_hint: "H2",
      evidence_confidence: 0.74,
      error_code: errorCode,
      duration_bucket: durationBucket,
      context: {
        surface: "thread-session",
        action: "thread-detail-refresh",
        thread_hash: threadHash,
      },
      counts: {
        status_code: statusCode,
      },
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-detail-refresh",
        status: "failed",
        duration_bucket: durationBucket,
        fields: {
          status_code: statusCode,
          thread_hash: threadHash,
        },
      }],
    };
  }

  function threadDetailLoadFailedDiagnosticEvent(input = {}) {
    const threadHash = compactToken(input.threadHash, "", 80);
    const errorCode = compactToken(input.errorCode, "thread_detail_load_failed", 80);
    const durationBucket = compactToken(input.durationBucket, "", 80);
    const statusCode = boundedCount(input.statusCode);
    return {
      category: "thread_session_load_failed",
      diagnostic_type: "thread_detail_load_failed",
      severity_hint: "H2",
      evidence_confidence: 0.76,
      error_code: errorCode,
      duration_bucket: durationBucket,
      context: {
        surface: "thread-session",
        action: "thread-detail-load",
        thread_hash: threadHash,
      },
      counts: {
        status_code: statusCode,
      },
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-detail-load",
        status: "failed",
        duration_bucket: durationBucket,
        fields: {
          status_code: statusCode,
          thread_hash: threadHash,
        },
      }],
    };
  }

  function threadDetailSlowPathDiagnosticEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const action = compactToken(source.action, "thread-detail", 80);
    const reason = compactToken(source.reason, "elapsed-slow", 80);
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
    const coldPathOwner = compactToken(source.coldPathOwner || source.cold_path_owner, "", 80);
    const coldPathReason = compactToken(source.coldPathReason || source.cold_path_reason, "", 80);
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    const durationBucket = compactToken(source.durationBucket || source.duration_bucket, "", 80);
    const counts = {
      elapsed_ms: boundedCount(source.elapsedMs || source.elapsed_ms),
      api_elapsed_ms: boundedCount(source.apiElapsedMs || source.api_elapsed_ms),
      render_elapsed_ms: boundedCount(source.renderElapsedMs || source.render_elapsed_ms),
      threshold_ms: boundedCount(source.thresholdMs || source.threshold_ms),
      turn_count: boundedCount(source.turns || source.turn_count),
      visible_count: boundedCount(source.visibleItems || source.visible_count),
      omitted_turns: boundedCount(source.omittedTurns || source.omitted_turns),
    };
    const rolloutMb = boundedRolloutMb(source.rolloutSizeBytes || source.rollout_size_bytes);
    if (rolloutMb) counts.rollout_mb = rolloutMb;
    const context = {
      surface: "thread-session",
      action,
    };
    if (threadHash) context.thread_hash = threadHash;
    if (readMode) context.read_mode = readMode;
    if (renderMode) context.render_mode = renderMode;
    if (performancePhase) context.performance_phase = performancePhase;
    if (coldPathOwner) context.cold_path_owner = coldPathOwner;
    if (coldPathReason) context.cold_path_reason = coldPathReason;
    return {
      category: "thread_session_slow_path",
      diagnostic_type: "thread_detail_slow_path",
      severity_hint: compactToken(source.severityHint || source.severity_hint, "H3", 8),
      evidence_confidence: 0.7,
      error_code: reason,
      duration_bucket: durationBucket,
      context,
      counts,
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-detail-slow-path",
        status: "slow",
        duration_bucket: durationBucket,
        fields: {
          read_mode: readMode,
          render_mode: renderMode,
          performance_phase: performancePhase,
          cold_path_owner: coldPathOwner,
          cold_path_reason: coldPathReason,
          elapsed_ms: counts.elapsed_ms,
          api_elapsed_ms: counts.api_elapsed_ms,
          render_elapsed_ms: counts.render_elapsed_ms,
          threshold_ms: counts.threshold_ms,
          thread_hash: threadHash,
        },
      }],
    };
  }

  function threadDetailSlowPathDiagnosticSuccess(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: "thread-session",
      action: compactToken(source.action, "thread-detail", 80),
    };
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    if (threadHash) context.thread_hash = threadHash;
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    if (readMode) context.read_mode = readMode;
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    if (renderMode) context.render_mode = renderMode;
    return {
      category: "thread_session_slow_path",
      diagnostic_type: "thread_detail_slow_path",
      error_code: "thread_detail_slow_path",
      context,
    };
  }

  function threadListSlowPathDiagnosticEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const action = compactToken(source.action, "thread-list-load", 80);
    const reason = compactToken(source.reason, "elapsed-slow", 80);
    const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
    const coldPathOwner = compactToken(source.coldPathOwner || source.cold_path_owner, "", 80);
    const coldPathReason = compactToken(source.coldPathReason || source.cold_path_reason, "", 80);
    const fallbackCacheDecision = compactToken(source.fallbackCacheDecision || source.fallback_cache_decision, "", 80);
    const fallbackDeferredReason = compactToken(source.fallbackDeferredReason || source.fallback_deferred_reason, "", 80);
    const appServerDeferredReason = compactToken(source.appServerDeferredReason || source.app_server_deferred_reason, "", 80);
    const appServerRequestReason = compactToken(source.appServerRequestReason || source.app_server_request_reason, "", 80);
    const durationBucket = compactToken(source.durationBucket || source.duration_bucket, "", 80);
    const counts = {
      elapsed_ms: boundedCount(source.elapsedMs || source.elapsed_ms),
      api_elapsed_ms: boundedCount(source.apiElapsedMs || source.api_elapsed_ms),
      render_elapsed_ms: boundedCount(source.renderElapsedMs || source.render_elapsed_ms),
      threshold_ms: boundedCount(source.thresholdMs || source.threshold_ms),
      result_count: boundedCount(source.count || source.result_count),
      server_total_ms: boundedCount(source.totalMs || source.total_ms),
      app_server_ms: boundedCount(source.appServerMs || source.app_server_ms),
      app_server_rpc_ms: boundedCount(source.appServerRpcMs || source.app_server_rpc_ms),
      app_server_unattributed_ms: boundedCount(source.appServerUnattributedMs || source.app_server_unattributed_ms),
      fallback_ms: boundedCount(source.fallbackMs || source.fallback_ms),
      merge_ms: boundedCount(source.mergeMs || source.merge_ms),
      summary_merge_ms: boundedCount(source.summaryMergeTotalMs || source.summary_merge_ms),
      fallback_snapshot_age_ms: boundedCount(source.fallbackSourceSnapshotAgeMs || source.fallback_snapshot_age_ms),
      fallback_rollout_stat_count: boundedCount(source.fallbackRolloutFileStatCount || source.fallback_rollout_stat_count),
      fallback_rollout_head_read_count: boundedCount(source.fallbackRolloutHeadReadCount || source.fallback_rollout_head_read_count),
      fallback_rollout_summary_read_count: boundedCount(source.fallbackRolloutSummaryReadCount || source.fallback_rollout_summary_read_count),
      app_server_request_limit: boundedCount(source.appServerRequestLimit || source.app_server_request_limit),
      app_server_response_kb: boundedCount(source.appServerResponsePayloadKb || source.app_server_response_kb)
        || boundedPayloadKb(source.appServerResponsePayloadBytes || source.app_server_response_bytes),
      silent: source.silent || source.is_silent ? 1 : 0,
      has_search: source.hasSearch || source.has_search ? 1 : 0,
      has_workspace: source.hasWorkspace || source.has_workspace ? 1 : 0,
      mobile_fallback: source.mobileFallback || source.mobile_fallback ? 1 : 0,
    };
    const context = {
      surface: "thread-session",
      action,
    };
    if (performancePhase) context.performance_phase = performancePhase;
    if (coldPathOwner) context.cold_path_owner = coldPathOwner;
    if (coldPathReason) context.cold_path_reason = coldPathReason;
    if (fallbackCacheDecision) context.fallback_cache_decision = fallbackCacheDecision;
    if (fallbackDeferredReason) context.fallback_deferred_reason = fallbackDeferredReason;
    if (appServerDeferredReason) context.app_server_deferred_reason = appServerDeferredReason;
    if (appServerRequestReason) context.app_server_request_reason = appServerRequestReason;
    return {
      category: "thread_session_slow_path",
      diagnostic_type: "thread_list_slow_path",
      severity_hint: compactToken(source.severityHint || source.severity_hint, "H3", 8),
      evidence_confidence: 0.7,
      error_code: reason,
      duration_bucket: durationBucket,
      context,
      counts,
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-list-slow-path",
        status: "slow",
        duration_bucket: durationBucket,
        fields: {
          performance_phase: performancePhase,
          cold_path_owner: coldPathOwner,
          cold_path_reason: coldPathReason,
          fallback_cache_decision: fallbackCacheDecision,
          app_server_request_reason: appServerRequestReason,
          elapsed_ms: counts.elapsed_ms,
          api_elapsed_ms: counts.api_elapsed_ms,
          render_elapsed_ms: counts.render_elapsed_ms,
          threshold_ms: counts.threshold_ms,
          result_count: counts.result_count,
        },
      }],
    };
  }

  function threadListSlowPathDiagnosticSuccess(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: "thread-session",
      action: compactToken(source.action, "thread-list-load", 80),
    };
    const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
    if (performancePhase) context.performance_phase = performancePhase;
    return {
      category: "thread_session_slow_path",
      diagnostic_type: "thread_list_slow_path",
      error_code: "thread_list_slow_path",
      context,
    };
  }

  function threadDetailResponseContractDiagnosticContext(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const context = {
      surface: "thread-session",
      action: compactToken(source.action, "thread-detail", 80),
    };
    const threadHash = compactToken(source.threadHash || source.thread_hash, "", 80);
    const readMode = compactToken(source.readMode || source.read_mode, "", 80);
    const renderMode = compactToken(source.renderMode || source.render_mode, "", 80);
    const performancePhase = compactToken(source.performancePhase || source.performance_phase, "", 80);
    const projectionSource = compactToken(source.projectionSource || source.projection_source, "", 80);
    const projectionPartialKind = compactToken(source.projectionPartialKind || source.projection_partial_kind, "", 80);
    if (threadHash) context.thread_hash = threadHash;
    if (readMode) context.read_mode = readMode;
    if (renderMode) context.render_mode = renderMode;
    if (performancePhase) context.performance_phase = performancePhase;
    if (projectionSource) context.projection_source = projectionSource;
    if (projectionPartialKind) context.projection_partial_kind = projectionPartialKind;
    return context;
  }

  function threadDetailResponseContractCounts(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const out = {
      turn_count: boundedCount(source.turns || source.turn_count),
      item_count: boundedCount(source.items || source.item_count),
      visible_count: boundedCount(source.visibleItems || source.visible_count),
      active_turn_count: boundedCount(source.activeTurns || source.active_turn_count),
      completed_turn_count: boundedCount(source.completedTurns || source.completed_turn_count),
      omitted_turns: boundedCount(source.omittedTurns || source.omitted_turns),
      older_cursor: source.olderCursor || source.older_cursor ? 1 : 0,
      newer_cursor: source.newerCursor || source.newer_cursor ? 1 : 0,
      projection_partial: source.projectionPartial || source.projection_partial ? 1 : 0,
      response_budget_applied: source.responseBudgetApplied || source.response_budget_applied ? 1 : 0,
      response_budget_progressive_active: source.responseBudgetProgressiveActiveApplied || source.response_budget_progressive_active ? 1 : 0,
      response_budget_active_turn_count: boundedCount(source.responseBudgetActiveTurnCount || source.response_budget_active_turn_count),
      response_budget_retained_item_count: boundedCount(source.responseBudgetRetainedItemCount || source.response_budget_retained_item_count),
    };
    const rolloutMb = boundedRolloutMb(source.rolloutSizeBytes || source.rollout_size_bytes);
    if (rolloutMb) out.rollout_mb = rolloutMb;
    return out;
  }

  function threadDetailResponseContractDiagnosticEvent(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const reason = compactToken(source.reason, "thread-detail-response-contract", 80);
    const context = threadDetailResponseContractDiagnosticContext(source);
    const counts = threadDetailResponseContractCounts(source);
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "thread_detail_response_contract_mismatch",
      severity_hint: compactToken(source.severityHint || source.severity_hint, "H2", 8),
      evidence_confidence: 0.82,
      error_code: reason,
      duration_bucket: compactToken(source.durationBucket || source.duration_bucket, "", 80),
      context,
      counts,
      breadcrumbs: [{
        kind: "thread-session",
        code: "thread-detail-response-contract",
        status: "failed",
        fields: {
          read_mode: context.read_mode || "",
          render_mode: context.render_mode || "",
          performance_phase: context.performance_phase || "",
          projection_source: context.projection_source || "",
          projection_partial_kind: context.projection_partial_kind || "",
          turn_count: counts.turn_count,
          item_count: counts.item_count,
          visible_count: counts.visible_count,
          active_turn_count: counts.active_turn_count,
          older_cursor: counts.older_cursor,
          newer_cursor: counts.newer_cursor,
          projection_partial: counts.projection_partial,
          response_budget_applied: counts.response_budget_applied,
          response_budget_progressive_active: counts.response_budget_progressive_active,
          response_budget_active_turn_count: counts.response_budget_active_turn_count,
          response_budget_retained_item_count: counts.response_budget_retained_item_count,
          thread_hash: context.thread_hash || "",
        },
      }],
    };
  }

  function threadDetailResponseContractDiagnosticSuccess(input = {}) {
    return {
      category: "conversation_projection_mismatch",
      diagnostic_type: "thread_detail_response_contract_mismatch",
      error_code: "thread_detail_response_contract_mismatch",
      context: threadDetailResponseContractDiagnosticContext(input),
    };
  }

  function threadDetailResponseDiagnosticEffects(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const effects = [];
    const slowPlan = source.slowPlan && typeof source.slowPlan === "object" ? source.slowPlan : null;
    if (slowPlan) {
      const shouldReport = slowPlan.shouldReport === true;
      effects.push({
        type: shouldReport ? "diagnostic-failure" : "diagnostic-success",
        diagnostic: shouldReport
          ? threadDetailSlowPathDiagnosticEvent(slowPlan)
          : threadDetailSlowPathDiagnosticSuccess(source.slowSuccessInput || {}),
        diagnosticType: "thread_detail_slow_path",
        reason: shouldReport ? compactToken(slowPlan.reason, "thread-detail-slow-path", 80) : "thread-detail-slow-path-ok",
      });
    }
    const contractPlan = source.contractPlan && typeof source.contractPlan === "object" ? source.contractPlan : null;
    if (contractPlan) {
      const shouldReport = contractPlan.shouldReport === true;
      effects.push({
        type: shouldReport ? "diagnostic-failure" : "diagnostic-success",
        diagnostic: shouldReport
          ? threadDetailResponseContractDiagnosticEvent(contractPlan)
          : threadDetailResponseContractDiagnosticSuccess(contractPlan),
        diagnosticType: "thread_detail_response_contract_mismatch",
        reason: shouldReport ? compactToken(contractPlan.reason, "thread-detail-response-contract", 80) : "thread-detail-response-contract-ok",
      });
    }
    return {
      effects,
      reason: effects.length ? "thread-detail-response-diagnostic-effects" : "no-diagnostic-plans",
    };
  }


const api = {
    boundedCount,
    compactToken,
    detailPatchRejectedDiagnosticEvent,
    duplicateRenderKeysDiagnosticEvent,
    duplicateRenderKeysDiagnosticSuccess,
    emptyCachedDetailReuseBlockedDiagnosticEvent,
    emptyCachedDetailReuseDiagnosticSuccess,
    emptyVisibleDetailMismatchDiagnosticEvent,
    emptyVisibleDetailMismatchDiagnosticSuccess,
    hasDuplicateRenderKeys,
    hasRenderSignatureMismatch,
    hasTurnOrderMismatch,
    conversationProjectionDiagnosticSnapshot,
    conversationProjectionConsistencyEffects,
    primaryShellSelectionConflictDiagnosticEvent,
    primaryShellSelectionConflictDiagnosticSuccess,
    projectionDiagnosticContext,
    projectionDiagnosticCounts,
    projectionDiagnosticSnapshot,
    renderSignatureMismatchDiagnosticEvent,
    renderSignatureMismatchDiagnosticSuccess,
    threadDetailResponseContractDiagnosticEvent,
    threadDetailResponseDiagnosticEffects,
    threadDetailResponseContractDiagnosticSuccess,
    threadDetailLoadFailedDiagnosticEvent,
    threadDetailSlowPathDiagnosticEvent,
    threadDetailSlowPathDiagnosticSuccess,
    threadListSlowPathDiagnosticEvent,
    threadListSlowPathDiagnosticSuccess,
    turnOrderDiagnosticSnapshot,
    threadDetailRefreshFailedDiagnosticEvent,
    turnOrderMismatchDiagnosticEvent,
    turnOrderMismatchDiagnosticSuccess,
  };

export {
  boundedCount,
  compactToken,
  detailPatchRejectedDiagnosticEvent,
  duplicateRenderKeysDiagnosticEvent,
  duplicateRenderKeysDiagnosticSuccess,
  emptyCachedDetailReuseBlockedDiagnosticEvent,
  emptyCachedDetailReuseDiagnosticSuccess,
  emptyVisibleDetailMismatchDiagnosticEvent,
  emptyVisibleDetailMismatchDiagnosticSuccess,
  hasDuplicateRenderKeys,
  hasRenderSignatureMismatch,
  hasTurnOrderMismatch,
  conversationProjectionDiagnosticSnapshot,
  conversationProjectionConsistencyEffects,
  primaryShellSelectionConflictDiagnosticEvent,
  primaryShellSelectionConflictDiagnosticSuccess,
  projectionDiagnosticContext,
  projectionDiagnosticCounts,
  projectionDiagnosticSnapshot,
  renderSignatureMismatchDiagnosticEvent,
  renderSignatureMismatchDiagnosticSuccess,
  threadDetailResponseContractDiagnosticEvent,
  threadDetailResponseDiagnosticEffects,
  threadDetailResponseContractDiagnosticSuccess,
  threadDetailLoadFailedDiagnosticEvent,
  threadDetailSlowPathDiagnosticEvent,
  threadDetailSlowPathDiagnosticSuccess,
  threadListSlowPathDiagnosticEvent,
  threadListSlowPathDiagnosticSuccess,
  turnOrderDiagnosticSnapshot,
  threadDetailRefreshFailedDiagnosticEvent,
  turnOrderMismatchDiagnosticEvent,
  turnOrderMismatchDiagnosticSuccess,
};

export default api;
