"use strict";

const root = typeof globalThis !== "undefined" ? globalThis : window;


function renderAppNativeDialog() {
  const dialog = $("appNativeDialog");
  const title = $("appNativeDialogTitle");
  const message = $("appNativeDialogMessage");
  const input = $("appNativeDialogInput");
  const actions = $("appNativeDialogActions");
  const cancel = $("appNativeDialogCancel");
  const proceed = $("appNativeDialogProceed");
  if (!dialog || !title || !message || !input || !actions || !cancel || !proceed) return;
  const open = Boolean(state.appNativeDialogOpen);
  const promptMode = state.appNativeDialogMode === "prompt";
  const alertMode = state.appNativeDialogMode === "alert";
  dialog.classList.toggle("hidden", !open);
  title.textContent = state.appNativeDialogTitle || "提示";
  message.textContent = state.appNativeDialogMessage || "";
  input.classList.toggle("hidden", !open || !promptMode);
  input.value = promptMode ? state.appNativeDialogValue || "" : "";
  input.placeholder = promptMode ? state.appNativeDialogPlaceholder || "" : "";
  input.rows = Math.max(2, Math.min(10, Number(state.appNativeDialogRows) || 4));
  cancel.hidden = alertMode;
  actions.classList.toggle("single", alertMode);
  cancel.textContent = state.appNativeDialogCancelLabel || "取消";
  proceed.textContent = state.appNativeDialogConfirmLabel || (alertMode ? "知道了" : "确定");
  if (open) {
    window.setTimeout(() => {
      const focusTarget = promptMode ? input : proceed;
      if (focusTarget && typeof focusTarget.focus === "function") {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (_) {
          focusTarget.focus();
        }
      }
    }, 0);
  }
}

function closeAppNativeDialog(confirmed = false) {
  const resolve = state.appNativeDialogResolve;
  const mode = state.appNativeDialogMode;
  const input = $("appNativeDialogInput");
  const value = input ? input.value : state.appNativeDialogValue;
  state.appNativeDialogOpen = false;
  state.appNativeDialogMode = "alert";
  state.appNativeDialogTitle = "提示";
  state.appNativeDialogMessage = "";
  state.appNativeDialogValue = "";
  state.appNativeDialogPlaceholder = "";
  state.appNativeDialogConfirmLabel = "确定";
  state.appNativeDialogCancelLabel = "取消";
  state.appNativeDialogRows = 4;
  state.appNativeDialogResolve = null;
  renderAppNativeDialog();
  if (!resolve) return;
  if (mode === "prompt") {
    resolve(confirmed ? value : null);
    return;
  }
  if (mode === "confirm") {
    resolve(Boolean(confirmed));
    return;
  }
  resolve(undefined);
}

function requestAppNativeDialog(options = {}) {
  if (state.appNativeDialogResolve) closeAppNativeDialog(false);
  const mode = ["alert", "confirm", "prompt"].includes(options.mode) ? options.mode : "alert";
  state.appNativeDialogOpen = true;
  state.appNativeDialogMode = mode;
  state.appNativeDialogTitle = String(options.title || "提示");
  state.appNativeDialogMessage = String(options.message || "");
  state.appNativeDialogValue = String(options.value || "");
  state.appNativeDialogPlaceholder = String(options.placeholder || "");
  state.appNativeDialogConfirmLabel = String(options.confirmLabel || (mode === "alert" ? "知道了" : "确定"));
  state.appNativeDialogCancelLabel = String(options.cancelLabel || "取消");
  state.appNativeDialogRows = Math.max(2, Math.min(10, Number(options.rows) || 4));
  renderAppNativeDialog();
  return new Promise((resolve) => {
    state.appNativeDialogResolve = resolve;
  });
}

function requestAppAlert(message, options = {}) {
  return requestAppNativeDialog(Object.assign({}, options, {
    mode: "alert",
    message,
    title: options.title || "提示",
    confirmLabel: options.confirmLabel || "知道了",
  }));
}

function requestAppConfirmation(message, options = {}) {
  return requestAppNativeDialog(Object.assign({}, options, {
    mode: "confirm",
    message,
    title: options.title || "确认操作",
  }));
}

function requestAppTextInput(message, value = "", options = {}) {
  return requestAppNativeDialog(Object.assign({}, options, {
    mode: "prompt",
    message,
    value,
    title: options.title || "输入内容",
  }));
}

function handleAppNativeDialogKeydown(event) {
  if (!state.appNativeDialogOpen) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeAppNativeDialog(false);
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    closeAppNativeDialog(true);
  }
}

function renderCodexProfileSwitchDialog() {
  const dialog = $("profileSwitchConfirmDialog");
  const subtitle = $("profileSwitchConfirmSubtitle");
  if (!dialog || !subtitle) return;
  dialog.classList.toggle("hidden", !state.profileSwitchConfirmOpen);
  subtitle.textContent = state.profileSwitchConfirmOpen
    ? `目标账号：${state.profileSwitchConfirmLabel || state.profileSwitchConfirmTargetId || "--"}`
    : "";
}

function closeCodexProfileSwitchDialog(confirmed = false) {
  const resolve = state.profileSwitchConfirmResolve;
  state.profileSwitchConfirmOpen = false;
  state.profileSwitchConfirmTargetId = "";
  state.profileSwitchConfirmLabel = "";
  state.profileSwitchConfirmResolve = null;
  renderCodexProfileSwitchDialog();
  if (resolve) resolve(Boolean(confirmed));
}

function requestCodexProfileSwitchConfirmation(profileId, label) {
  if (state.profileSwitchConfirmResolve) closeCodexProfileSwitchDialog(false);
  state.profileSwitchConfirmOpen = true;
  state.profileSwitchConfirmTargetId = String(profileId || "");
  state.profileSwitchConfirmLabel = String(label || profileId || "");
  renderCodexProfileSwitchDialog();
  return new Promise((resolve) => {
    state.profileSwitchConfirmResolve = resolve;
  });
}

function codexProfileSwitchStageLabel(stageId, fallback = "") {
  const id = String(stageId || "");
  const stage = CODEX_PROFILE_SWITCH_STAGES.find((item) => item.id === id);
  return stage ? stage.label : String(fallback || id || "");
}

function formatCodexProfileSwitchProgress(progress = {}) {
  const input = progress && typeof progress === "object" ? progress : {};
  const fallback = codexProfileSwitchStageLabel(input.stage, "正在切换 Profile");
  const message = String(input.message || fallback || "").trim();
  const stepIndex = Number(input.stepIndex || 0);
  const stepCount = Number(input.stepCount || 0);
  if (message && stepIndex > 0 && stepCount > 0) return `${stepIndex}/${stepCount} ${message}`;
  return message || "正在切换 Profile...";
}

function setCodexProfileSwitchStage(progress) {
  const text = typeof progress === "string"
    ? progress
    : formatCodexProfileSwitchProgress(progress);
  state.codexProfileSwitchStage = text;
  const connection = $("connectionState");
  if (connection) connection.textContent = text;
  renderCodexProfileSettings();
}

function clearCodexProfileSwitchStageTimers() {
  for (const timer of state.codexProfileSwitchStageTimers || []) {
    window.clearTimeout(timer);
  }
  state.codexProfileSwitchStageTimers = [];
}

function stopCodexProfileSwitchProgressPolling() {
  clearCodexProfileSwitchStageTimers();
  if (state.codexProfileSwitchProgressTimer) {
    window.clearTimeout(state.codexProfileSwitchProgressTimer);
    state.codexProfileSwitchProgressTimer = null;
  }
}

function startCodexProfileSwitchProgressPolling(requestId) {
  const id = String(requestId || "").trim();
  stopCodexProfileSwitchProgressPolling();
  if (!id) return;
  const poll = async () => {
    if (!state.codexProfileSwitchBusy || state.codexProfileSwitchRequestId !== id) return;
    try {
      const result = await api(`/api/codex-profiles/switch-progress?requestId=${encodeURIComponent(id)}`, {
        timeoutMs: 5000,
      });
      if (result && result.progress) {
        setCodexProfileSwitchStage(result.progress);
        const status = String(result.progress.status || "");
        if (status === "failed" || status === "restarting" || status === "complete") return;
      }
    } catch (_) {
      // The progress endpoint can briefly be unavailable before the request is registered or during restart.
    }
    if (state.codexProfileSwitchBusy && state.codexProfileSwitchRequestId === id) {
      state.codexProfileSwitchProgressTimer = window.setTimeout(poll, 700);
    }
  };
  state.codexProfileSwitchProgressTimer = window.setTimeout(poll, 250);
}

async function performCodexProfileSwitch(profileId) {
  const requestId = createSubmissionId();
  let switchAccepted = false;
  state.codexProfileSwitchBusy = true;
  state.codexProfileSwitchTargetId = profileId;
  state.codexProfileSwitchRequestId = requestId;
  clearStoredRateLimits();
  setCodexProfileSwitchStage({
    stage: "profile_lookup",
    message: "正在读取目标 Profile...",
    stepIndex: 1,
    stepCount: 10,
  });
  startCodexProfileSwitchProgressPolling(requestId);
  try {
    const result = await api("/api/codex-profiles/active", {
      method: "POST",
      body: JSON.stringify({ profileId, requestId }),
      timeoutMs: 90000,
    });
    stopCodexProfileSwitchProgressPolling();
    setCodexProfileSwitchStage(result && result.progress ? result.progress : {
      stage: "waiting_for_restart",
      message: "切换已写入，正在等待服务恢复...",
      stepIndex: 10,
      stepCount: 10,
    });
    state.codexProfileRestarting = true;
    switchAccepted = true;
    showReconnectRefreshPrompt("restart");
  } catch (err) {
    stopCodexProfileSwitchProgressPolling();
    let showedProgress = false;
    try {
      const progressResult = await api(`/api/codex-profiles/switch-progress?requestId=${encodeURIComponent(requestId)}`, {
        timeoutMs: 5000,
      });
      if (progressResult && progressResult.progress) {
        setCodexProfileSwitchStage(progressResult.progress);
        showedProgress = true;
      }
    } catch (_) {}
    if (err && err.progress) {
      setCodexProfileSwitchStage(err.progress);
      showedProgress = true;
    }
    if (!showedProgress) {
      setCodexProfileSwitchStage(`切换失败：${err.message || "Codex profile switch failed"}`);
    }
    const connection = $("connectionState");
    if (connection) connection.textContent = state.codexProfileSwitchStage || err.message || "Codex profile switch failed";
    showError(err);
  } finally {
    state.codexProfileSwitchBusy = false;
    if (!state.codexProfileRestarting && switchAccepted) {
      state.codexProfileSwitchTargetId = "";
      state.codexProfileSwitchStage = "";
      state.codexProfileSwitchRequestId = "";
    }
    renderCodexProfileSettings();
  }
}


function createModalRuntime() {
  return {
    requestAppNativeDialog: typeof requestAppNativeDialog === "function" ? requestAppNativeDialog : null,
    requestAppAlert: typeof requestAppAlert === "function" ? requestAppAlert : null,
    requestAppConfirmation: typeof requestAppConfirmation === "function" ? requestAppConfirmation : null,
    requestAppTextInput: typeof requestAppTextInput === "function" ? requestAppTextInput : null,
    requestCodexProfileSwitchConfirmation: typeof requestCodexProfileSwitchConfirmation === "function" ? requestCodexProfileSwitchConfirmation : null,
  };
}

const modalRuntimeApi = Object.freeze({ createModalRuntime });

Object.assign(root, {
  renderAppNativeDialog,
  closeAppNativeDialog,
  requestAppNativeDialog,
  requestAppAlert,
  requestAppConfirmation,
  requestAppTextInput,
  handleAppNativeDialogKeydown,
  renderCodexProfileSwitchDialog,
  closeCodexProfileSwitchDialog,
  requestCodexProfileSwitchConfirmation,
  codexProfileSwitchStageLabel,
  formatCodexProfileSwitchProgress,
  setCodexProfileSwitchStage,
  clearCodexProfileSwitchStageTimers,
  stopCodexProfileSwitchProgressPolling,
  startCodexProfileSwitchProgressPolling,
  performCodexProfileSwitch,
});
root.CodexModalRuntime = modalRuntimeApi;

export {
  createModalRuntime,
};

export default modalRuntimeApi;
