"use strict";

function startCodexMobileApp() {
  if (!window.CodexRuntimeWiringRuntime || typeof window.CodexRuntimeWiringRuntime.createRuntimeWiringRuntime !== "function") {
    throw new Error("CodexRuntimeWiringRuntime script failed to load");
  }
  if (!window.CodexAppShellRuntime || typeof window.CodexAppShellRuntime.createAppShellRuntime !== "function") {
    throw new Error("CodexAppShellRuntime script failed to load");
  }

  window.CodexRuntimeWiringRuntime.createRuntimeWiringRuntime().initialize();
  window.CodexAppShellRuntime.createAppShellRuntime().startCodexMobileAppWithRecovery();
}

function createCodexMobileAppEntry() {
  return {
    startCodexMobileApp,
  };
}

(function exposeCodexMobileAppEntry(root) {
  const appEntryApi = {
    createCodexMobileAppEntry,
    startCodexMobileApp,
  };
  if (typeof module !== "undefined" && module.exports) {
    module.exports = appEntryApi;
  }
  root.CodexMobileAppEntry = appEntryApi;
  const currentScript = root.document && root.document.currentScript;
  const loadedByClassicAppPreview = Boolean(
    currentScript
      && currentScript.dataset
      && currentScript.dataset.codexViteAppPreviewClassicScript === "true"
  );
  const shouldAutoStart = !root.__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__ || loadedByClassicAppPreview;
  if (!(typeof module !== "undefined" && module.exports) && shouldAutoStart) {
    startCodexMobileApp();
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
