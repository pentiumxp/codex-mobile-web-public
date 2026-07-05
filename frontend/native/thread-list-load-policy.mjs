function bool(value) {
  return value === true;
}

function text(value) {
  return String(value || "").trim();
}

export function planThreadListLoadRequest(input = {}) {
  const silent = bool(input.silent);
  const selectedCwd = text(input.selectedCwd);
  const search = text(input.search);
  const threadDetailOpening = bool(input.threadDetailOpening);
  const documentHidden = bool(input.documentHidden);
  const allowDuringDetail = bool(input.allowDuringDetail);
  const allowHidden = bool(input.allowHidden);
  const hasLoadedList = Number(input.threadListLoadedAtMs || 0) > 0;
  const deferFallback = input.deferFallback;
  const suppressHiddenSilent = silent && documentHidden && !allowHidden;
  const suppressDetailSilent = silent && threadDetailOpening && !allowDuringDetail;
  const allowWarmFallbackInitial = deferFallback !== false && !selectedCwd && !search;
  const shouldDeferFallback = deferFallback === true
    || (silent && deferFallback !== false && threadDetailOpening && !selectedCwd && !search);
  const shouldUseWarmFallbackInitial = allowWarmFallbackInitial && (shouldDeferFallback || !hasLoadedList);
  const shouldLoad = !suppressHiddenSilent && !suppressDetailSilent;
  return {
    action: "thread-list-load-request",
    selectedCwd,
    search,
    silent,
    threadDetailOpening,
    documentHidden,
    shouldLoad,
    skipReason: suppressHiddenSilent
      ? "hidden-silent"
      : suppressDetailSilent
        ? "detail-in-flight"
        : "",
    retryDelayMs: suppressDetailSilent ? 700 : 0,
    shouldDeferFallback,
    shouldUseWarmFallbackInitial,
    params: {
      fallback: shouldDeferFallback ? "defer" : "",
      initial: shouldUseWarmFallbackInitial ? "warm-fallback" : "",
    },
  };
}

export default {
  planThreadListLoadRequest,
};
