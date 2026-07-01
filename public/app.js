"use strict";

if (!window.CodexRuntimeWiringRuntime || typeof window.CodexRuntimeWiringRuntime.createRuntimeWiringRuntime !== "function") {
  throw new Error("CodexRuntimeWiringRuntime script failed to load");
}
if (!window.CodexAppShellRuntime || typeof window.CodexAppShellRuntime.createAppShellRuntime !== "function") {
  throw new Error("CodexAppShellRuntime script failed to load");
}

window.CodexRuntimeWiringRuntime.createRuntimeWiringRuntime().initialize();
window.CodexAppShellRuntime.createAppShellRuntime().startCodexMobileAppWithRecovery();
