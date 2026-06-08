"use strict";

(function (root, factory) {
  const api = factory(root || {});
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexPluginEmbed = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function (root) {
  const NAVIGATION_TYPE = "codex-mobile.plugin.navigation";
  const BACK_RESULT_TYPE = "codex-mobile.plugin.back_result";
  const REFRESH_REQUIRED_TYPE = "codex-mobile.plugin.refresh_required";
  const BACK_TYPE = "hermes.plugin.back";
  const THEME_VALUES = new Set(["system", "dark", "light"]);
  const FONT_SIZE_VALUES = new Set(["small", "default", "large", "xlarge", "xxlarge"]);

  function stringValue(value) {
    return String(value || "").trim();
  }

  function boundedString(value, maxLength) {
    const text = stringValue(value);
    return text ? text.slice(0, Math.max(0, Number(maxLength) || 0)) : "";
  }

  function normalizedEnum(value, allowedValues) {
    const text = stringValue(value).toLowerCase();
    return allowedValues.has(text) ? text : "";
  }

  function urlFrom(value) {
    try {
      const location = root.location || {};
      return new URL(value || location.href || "/", location.origin || "http://127.0.0.1");
    } catch (_) {
      return null;
    }
  }

  function detect(value) {
    const url = urlFrom(value);
    const params = url ? url.searchParams : new URLSearchParams();
    const routeHint = {
      pluginId: boundedString(params.get("pluginId"), 80),
      route: boundedString(params.get("pluginRoute"), 80),
      itemId: boundedString(params.get("pluginItemId"), 160),
      threadId: boundedString(params.get("pluginThreadId"), 160),
      taskId: boundedString(params.get("pluginTaskId"), 160),
    };
    const appearance = {};
    const theme = normalizedEnum(params.get("pluginTheme") || params.get("theme"), THEME_VALUES);
    const fontSize = normalizedEnum(params.get("pluginFontSize") || params.get("fontSize"), FONT_SIZE_VALUES);
    if (theme) appearance.theme = theme;
    if (fontSize) appearance.fontSize = fontSize;
    return {
      embedded: params.get("embed") === "hermes",
      launchKey: stringValue(params.get("codexPluginLaunch") || params.get("pluginLaunch")),
      workspaceId: stringValue(params.get("workspaceId") || params.get("workspace_id")),
      routeHint,
      appearance,
    };
  }

  function parentOriginFromReferrer(referrer) {
    try {
      return referrer ? new URL(referrer).origin : "";
    } catch (_) {
      return "";
    }
  }

  function routeFromState(state = {}, ui = {}) {
    if (ui.mermaidPreviewOpen) {
      return { kind: "modal", modal: "mermaidPreview", threadId: stringValue(state.currentThreadId) };
    }
    if (ui.filePreviewOpen) {
      return { kind: "modal", modal: "filePreview", threadId: stringValue(state.currentThreadId) };
    }
    if (state.renameThreadId) {
      return { kind: "modal", modal: "renameThread", threadId: stringValue(state.renameThreadId) };
    }
    if (state.threadActionMenuId) {
      return { kind: "modal", modal: "threadActions", threadId: stringValue(state.threadActionMenuId) };
    }
    if (state.subagentPanelOpen) {
      return { kind: "panel", panel: "subagent", threadId: stringValue(state.currentThreadId) };
    }
    if (ui.primaryPage) {
      return {
        kind: "root",
        workspace: stringValue(state.selectedCwd),
        settingsOpen: Boolean(ui.settingsOpen),
      };
    }
    if (ui.settingsOpen) {
      return { kind: "panel", panel: "settings", threadId: stringValue(state.currentThreadId) };
    }
    if (ui.sidebarOpen) {
      return { kind: "drawer", drawer: "threadList", threadId: stringValue(state.currentThreadId) };
    }
    if (state.newThreadDraft) {
      return { kind: "new_thread", workspace: stringValue(state.selectedCwd) };
    }
    if (state.currentThreadId) {
      return { kind: "thread", threadId: stringValue(state.currentThreadId) };
    }
    if (state.selectedCwd) {
      return { kind: "workspace", workspace: stringValue(state.selectedCwd) };
    }
    return { kind: "root" };
  }

  function canGoBack(state = {}, ui = {}) {
    if (ui.primaryPage) return false;
    return Boolean(
      ui.mermaidPreviewOpen
      || ui.filePreviewOpen
      || ui.createWorkspaceOpen
      || ui.updatePanelOpen
      || ui.settingsOpen
      || ui.sidebarOpen
      || state.renameThreadId
      || state.threadActionMenuId
      || state.subagentPanelOpen
      || state.newThreadDraft
      || state.currentThreadId
    );
  }

  function navigationMessage(state = {}, ui = {}) {
    return {
      type: NAVIGATION_TYPE,
      version: 1,
      canGoBack: canGoBack(state, ui),
      route: routeFromState(state, ui),
    };
  }

  function postNavigation(parentWindow, state = {}, options = {}) {
    if (!parentWindow || parentWindow === root) return null;
    const message = navigationMessage(state, options.ui || {});
    parentWindow.postMessage(message, options.targetOrigin || "*");
    return message;
  }

  function backResultMessage(state = {}, options = {}) {
    const message = {
      type: BACK_RESULT_TYPE,
      version: 1,
      handled: Boolean(options.handled),
      route: routeFromState(state, options.ui || {}),
    };
    const reason = stringValue(options.reason);
    if (reason) message.reason = reason;
    return message;
  }

  function postBackResult(parentWindow, state = {}, options = {}) {
    if (!parentWindow || parentWindow === root) return null;
    const message = backResultMessage(state, options);
    parentWindow.postMessage(message, options.targetOrigin || "*");
    return message;
  }

  function refreshRequiredRoute(route = {}) {
    const next = {};
    const name = boundedString(route.name || route.kind || "", 48);
    const threadId = boundedString(route.threadId || "", 160);
    const itemId = boundedString(route.itemId || "", 160);
    const pluginRoute = boundedString(route.pluginRoute || route.route || "", 80);
    const pluginThreadId = boundedString(route.pluginThreadId || threadId || "", 160);
    const pluginTaskId = boundedString(route.pluginTaskId || route.taskId || "", 160);
    const pluginItemId = boundedString(route.pluginItemId || itemId || "", 160);
    if (name) next.name = name;
    if (threadId) next.threadId = threadId;
    if (itemId) next.itemId = itemId;
    if (pluginRoute) next.pluginRoute = pluginRoute;
    if (pluginThreadId) next.pluginThreadId = pluginThreadId;
    if (pluginTaskId) next.pluginTaskId = pluginTaskId;
    if (pluginItemId) next.pluginItemId = pluginItemId;
    return next;
  }

  function refreshRequiredMessage(input = {}) {
    const message = {
      type: REFRESH_REQUIRED_TYPE,
      version: 1,
      reason: boundedString(input.reason || "refresh_required", 80) || "refresh_required",
    };
    const route = refreshRequiredRoute(input.route || {});
    if (Object.keys(route).length > 0) message.route = route;
    return message;
  }

  function postRefreshRequired(parentWindow, input = {}, options = {}) {
    if (!parentWindow || parentWindow === root) return null;
    const message = refreshRequiredMessage(input);
    parentWindow.postMessage(message, options.targetOrigin || "*");
    return message;
  }

  function isBackMessage(event) {
    const data = event && event.data;
    return Boolean(data && data.type === BACK_TYPE && data.version === 1);
  }

  function isInternalUrl(value, origin) {
    const text = stringValue(value);
    if (text.startsWith("/") && !text.startsWith("//")) return true;
    try {
      const baseOrigin = origin || (root.location && root.location.origin) || "";
      const url = new URL(text, baseOrigin || "http://127.0.0.1");
      return !baseOrigin || url.origin === baseOrigin;
    } catch (_) {
      return false;
    }
  }

  return {
    BACK_TYPE,
    BACK_RESULT_TYPE,
    REFRESH_REQUIRED_TYPE,
    NAVIGATION_TYPE,
    backResultMessage,
    canGoBack,
    detect,
    isBackMessage,
    isInternalUrl,
    navigationMessage,
    parentOriginFromReferrer,
    postBackResult,
    postRefreshRequired,
    postNavigation,
    refreshRequiredMessage,
    routeFromState,
  };
}));
