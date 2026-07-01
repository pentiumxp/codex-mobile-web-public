// Vite stage-1 entrypoint.
//
// The production shell still loads the existing ordered runtime files directly.
// This entry lets Vite produce a stable manifest and asset graph without
// changing the runtime's global factory compatibility contract.
globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "asset-graph-v1";
