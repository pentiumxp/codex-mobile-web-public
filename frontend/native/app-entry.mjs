"use strict";

function rootObject() {
  return typeof globalThis !== "undefined" ? globalThis : window;
}

export function startCodexMobileApp() {
  const root = rootObject();
  if (!root.CodexRuntimeWiringRuntime || typeof root.CodexRuntimeWiringRuntime.createRuntimeWiringRuntime !== "function") {
    throw new Error("CodexRuntimeWiringRuntime script failed to load");
  }
  if (!root.CodexAppShellRuntime || typeof root.CodexAppShellRuntime.createAppShellRuntime !== "function") {
    throw new Error("CodexAppShellRuntime script failed to load");
  }

  root.CodexRuntimeWiringRuntime.createRuntimeWiringRuntime().initialize();
  return root.CodexAppShellRuntime.createAppShellRuntime().startCodexMobileAppWithRecovery();
}

export function createCodexMobileAppEntry() {
  return {
    startCodexMobileApp,
  };
}

const appEntryApi = {
  createCodexMobileAppEntry,
  startCodexMobileApp,
};

const root = rootObject();
root.CodexMobileAppEntry = appEntryApi;

const currentScript = root.document && root.document.currentScript;
const loadedByClassicAppPreview = Boolean(
  currentScript
    && currentScript.dataset
    && currentScript.dataset.codexViteAppPreviewClassicScript === "true"
);
const viteShellPreviewPage = Boolean(
  root.document
    && typeof root.document.getElementById === "function"
    && root.document.getElementById("codex-vite-shell-preview")
);
const shouldAutoStart = (!root.__CODEX_MOBILE_VITE_APP_PREVIEW_PAGE__ && !viteShellPreviewPage)
  || loadedByClassicAppPreview;

if (shouldAutoStart) {
  startCodexMobileApp();
}

export default appEntryApi;
