"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadListLoadPolicy = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function bool(value) {
    return value === true;
  }

  function text(value) {
    return String(value || "").trim();
  }

  function planThreadListLoadRequest(input = {}) {
    const silent = bool(input.silent);
    const selectedCwd = text(input.selectedCwd);
    const search = text(input.search);
    const threadDetailOpening = bool(input.threadDetailOpening);
    const hasLoadedList = Number(input.threadListLoadedAtMs || 0) > 0;
    const deferFallback = input.deferFallback;
    const allowWarmFallbackInitial = deferFallback !== false && !selectedCwd && !search;
    const shouldDeferFallback = deferFallback === true
      || (silent && deferFallback !== false && threadDetailOpening && !selectedCwd && !search);
    const shouldUseWarmFallbackInitial = allowWarmFallbackInitial && (shouldDeferFallback || !hasLoadedList);
    return {
      action: "thread-list-load-request",
      selectedCwd,
      search,
      silent,
      threadDetailOpening,
      shouldDeferFallback,
      shouldUseWarmFallbackInitial,
      params: {
        fallback: shouldDeferFallback ? "defer" : "",
        initial: shouldUseWarmFallbackInitial ? "warm-fallback" : "",
      },
    };
  }

  return {
    planThreadListLoadRequest,
  };
}));
