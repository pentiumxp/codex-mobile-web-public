"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexApiClient = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function isFormDataBody(body, FormDataCtor) {
    return typeof FormDataCtor === "function" && body instanceof FormDataCtor;
  }

  function createApiClient(options = {}) {
    const fetchRef = options.fetch || (typeof fetch === "function" ? fetch : null);
    const AbortControllerCtor = options.AbortControllerCtor || (typeof AbortController === "function" ? AbortController : null);
    const FormDataCtor = options.FormDataCtor || (typeof FormData === "function" ? FormData : null);
    const getKey = typeof options.getKey === "function" ? options.getKey : () => "";
    const onUnauthorized = typeof options.onUnauthorized === "function" ? options.onUnauthorized : () => {};
    const onResponseError = typeof options.onResponseError === "function" ? options.onResponseError : () => {};

    async function request(path, requestOptions = {}) {
      if (!fetchRef) throw new Error("Fetch is unavailable");
      if (!AbortControllerCtor) throw new Error("AbortController is unavailable");
      const headers = Object.assign({}, requestOptions.headers || {});
      const timeoutMs = requestOptions.timeoutMs || 30000;
      const controller = new AbortControllerCtor();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const externalSignal = requestOptions.signal;
      const abortFromExternal = () => controller.abort();
      if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener("abort", abortFromExternal, { once: true });
      }
      const fetchOptions = Object.assign({}, requestOptions, { headers, signal: controller.signal });
      delete fetchOptions.timeoutMs;
      const key = getKey();
      if (key) headers["X-Codex-Mobile-Key"] = key;
      if (requestOptions.body && !isFormDataBody(requestOptions.body, FormDataCtor) && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }
      try {
        const res = await fetchRef(path, fetchOptions);
        if (!res.ok) {
          let message = `${res.status} ${res.statusText}`;
          let code = "";
          let detail = "";
          try {
            const body = await res.json();
            if (body.error) message = body.error;
            if (body.code) code = String(body.code);
            if (body.detail) detail = String(body.detail);
          } catch (_) {}
          onResponseError({
            status: res.status,
            message,
            code,
            detail,
            path,
          });
          if (res.status === 401) {
            onUnauthorized();
          }
          const err = new Error(message);
          err.status = res.status;
          err.code = code;
          err.detail = detail;
          throw err;
        }
        if (res.status === 204) return null;
        return res.json();
      } catch (err) {
        if (err && err.name === "AbortError") {
          if (timedOut) throw new Error(`Request timed out: ${path}`);
          throw new Error(`Request cancelled: ${path}`);
        }
        throw err;
      } finally {
        clearTimeout(timer);
        if (externalSignal) externalSignal.removeEventListener("abort", abortFromExternal);
      }
    }

    return { request };
  }

  return {
    createApiClient,
    isFormDataBody,
  };
}));
