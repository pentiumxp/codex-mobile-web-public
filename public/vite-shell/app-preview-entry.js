const targetEntryImportSpecifier = "./assets/vite-shell-entry-BLG8ylPt.js";
const targetEntryImportUrl = new URL(targetEntryImportSpecifier, import.meta.url);
try {
  const sourceUrl = new URL(import.meta.url);
  sourceUrl.searchParams.forEach((value, key) => {
    if (!targetEntryImportUrl.searchParams.has(key)) targetEntryImportUrl.searchParams.set(key, value);
  });
} catch (_) {}
const targetEntryImportPromise = import(targetEntryImportUrl.href);

globalThis.__CODEX_MOBILE_VITE_STABLE_ENTRY__ = {
  source: "vite-shell-app-preview-stable-entry",
  targetEntryScript: "/vite-shell/assets/vite-shell-entry-BLG8ylPt.js",
  targetEntryImportSpecifier,
  targetEntryImportUrl: targetEntryImportUrl.href,
  targetEntryImportPromise,
  loadedAt: Date.now(),
};
targetEntryImportPromise.catch((err) => {
  globalThis.__CODEX_MOBILE_VITE_STABLE_ENTRY__.error = err && err.message ? err.message : String(err);
  throw err;
});
