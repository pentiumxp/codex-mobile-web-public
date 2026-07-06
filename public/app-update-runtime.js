"use strict";

(function attachAppUpdateRuntime(root) {
function createAppUpdateRuntime(deps = {}) {
  const {
    state = {},
    CLIENT_BUILD_ID = "",
    PAGE_REFRESH_CHECK_INTERVAL_MS = 60000,
    PAGE_REFRESH_MIN_CHECK_INTERVAL_MS = 12000,
    PAGE_SHELL_ASSETS = [],
    STORAGE_PUBLIC_PR_PROMPT = "codexMobilePublicPrPromptKey",
    PUBLIC_PR_REVIEW_THREAD_TITLE = "Codex Mobile Public PR",
    buildRefreshPolicy = null,
    $ = () => null,
    api = async () => ({}),
    escapeHtml = (value) => String(value == null ? "" : value),
    normalizeFsPath = (value) => String(value || ""),
    threadMatchesWorkspaceCwd = () => false,
    loadThreads = async () => {},
    loadThread = async () => {},
    setComposerText = () => {},
    scheduleCurrentDraftSave = () => {},
    updateComposerControls = () => {},
    composerHasContent = () => false,
    requestAppAlert = async () => {},
    requestAppConfirmation = async () => false,
    loadWorkspaces = async () => {},
    postClientEvent = () => {},
    saveCurrentDraftNow = () => {},
    syncSidebarWorkspaceSelect = () => {},
    updateWorkspacePath = () => {},
    renderWorkspaceTokenUsage = () => {},
    isMenuOverlayMode = () => false,
    closeSidebarMenu = () => {},
    clearCurrentThreadSelection = () => {},
    restoreDraftForCurrentTarget = () => {},
    renderThreads = () => {},
    renderCurrentThread = () => {},
    showError = () => {},
    isRunningStatus = () => false,
    visibleThreads = (threads) => Array.isArray(threads) ? threads : [],
    threadById = () => null,
    shortPath = (value) => String(value || ""),
    statusText = (status) => String(status && status.type || status || ""),
    saveRestartAutoRecoverThreads = () => {},
    postPerformanceEvent = () => {},
    roundedDurationMs = (startedAt) => Math.max(0, Date.now() - Number(startedAt || Date.now())),
    isHermesEmbedMode = () => false,
    requestHermesPluginRefresh = () => {},
    rememberRateLimitsFromConfig = () => {},
    rememberCodexProfiles = () => {},
    renderCodexProfileSettings = () => {},
    stopCodexProfileSwitchProgressPolling = () => {},
    publishPluginNavigationState = () => {},
    applyFrontendDiagnosticLogPublicConfig = () => null,
  } = deps;

  function appVersionText(status = state.appUpdateStatus) {
    const version = String((status && status.version) || state.appVersion || "").trim();
    const client = clientBuildVersionText();
    return version ? `v${version} · ${client}` : client;
  }
  
  function clientBuildVersionText(buildId = CLIENT_BUILD_ID) {
    const text = String(buildId || "").trim();
    const match = text.match(/\bcodex-mobile-shell-v([0-9]+)(?:-([a-f0-9]{6,}))?\b/i);
    if (match) {
      const buildHash = String(match[2] || "").slice(0, 8);
      return buildHash ? `客户端 v${match[1]} · ${buildHash}` : `客户端 v${match[1]}`;
    }
    return text ? `客户端 ${text}` : "客户端未知";
  }
  
  function renderAppUpdateStatus() {
    const el = $("appUpdateStatus");
    if (!el) return;
    const status = state.appUpdateStatus || {};
    const supported = status.supported !== false;
    const checking = state.appUpdateBusy && !state.appUpdateRestarting;
    const applying = Boolean(status.applying) || state.appUpdateRestarting;
    const blocked = Boolean(status.updateAvailable && !status.canFastForward);
    let label = appVersionText(status);
    let title = `Check for GitHub updates；当前客户端 ${CLIENT_BUILD_ID}`;
    if (state.appUpdateRestarting) {
      label = "等待重启…";
      title = "更新已应用。服务会退出并等待启动任务或守护脚本拉起；手动启动的部署需要在服务停止后手动重启。";
    } else if (applying) {
      label = "更新中…";
      title = "正在拉取更新";
    } else if (checking) {
      label = "检查更新…";
      title = "正在检查 GitHub 更新";
    } else if (status.updateAvailable && status.canFastForward) {
      label = `有更新 ${status.remoteShort || ""}`.trim();
      title = `发现 ${status.remote || "origin"}/${status.branch || "main"} 更新，点击后确认拉取；更新后服务会退出并依赖启动任务或守护脚本重启`;
    } else if (blocked) {
      label = "更新受阻";
      title = status.reason || status.error || "检测到更新，但当前工作区不能安全 fast-forward";
    } else if (status.error) {
      label = "更新检查失败";
      title = status.error;
    } else if (!supported) {
      title = status.reason || "当前安装方式不支持 Git 自动更新";
    } else if (status.localShort) {
      title = `${appVersionText(status)} (${status.localShort})，点击重新检查更新；当前客户端 ${CLIENT_BUILD_ID}`;
    }
    el.textContent = label;
    el.title = title;
    el.classList.toggle("hidden", !state.appVersion && !state.appUpdateStatus);
    el.classList.toggle("available", Boolean(status.updateAvailable && status.canFastForward));
    el.classList.toggle("blocked", blocked || Boolean(status.error));
    el.classList.toggle("checking", checking || applying);
    el.disabled = state.appUpdateBusy || state.appUpdateRestarting;
  }
  
  async function refreshAppUpdateStatus(options = {}) {
    if (!state.key) return null;
    if (state.appUpdateBusy && !options.force) return state.appUpdateStatus;
    state.appUpdateBusy = true;
    if (!options.silent) renderAppUpdateStatus();
    try {
      const params = new URLSearchParams();
      if (options.fetch) params.set("fetch", "1");
      if (options.force) params.set("force", "1");
      const status = await api(`/api/app-update/status${params.toString() ? `?${params.toString()}` : ""}`, {
        timeoutMs: options.fetch ? 25000 : 12000,
      });
      state.appUpdateStatus = status;
      state.appUpdateError = status && status.error ? status.error : "";
      return status;
    } catch (err) {
      state.appUpdateError = err.message || String(err);
      state.appUpdateStatus = Object.assign({}, state.appUpdateStatus || {}, {
        version: state.appVersion,
        error: state.appUpdateError,
      });
      return state.appUpdateStatus;
    } finally {
      state.appUpdateBusy = false;
      renderAppUpdateStatus();
      renderUpdatePanel();
    }
  }
  
  function currentUpdateUsesPublicRelease(status = state.appUpdateStatus) {
    const remoteUrl = String(status && status.remoteUrl || "").toLowerCase();
    const repository = String(state.publicReleaseRepository || state.publicPrRepository || "").toLowerCase();
    if (!remoteUrl || !repository) return false;
    return remoteUrl.includes(`github.com/${repository}`) || remoteUrl.endsWith(`/${repository}.git`) || remoteUrl.endsWith(`/${repository}`);
  }
  
  function updateStatusLine(status) {
    if (!status) return "Not checked";
    if (state.appUpdateRestarting || status.restartScheduled) return "Restart pending";
    if (state.appUpdateBusy || status.checking) return "Checking";
    if (status.applying) return "Updating";
    if (status.error) return `Error: ${status.error}`;
    if (status.supported === false) return status.reason || "Not supported";
    if (status.updateAvailable && status.canFastForward) return `Update available: ${status.remoteShort || status.remoteCommit || ""}`.trim();
    if (status.updateAvailable) return `Update blocked: ${status.reason || "cannot fast-forward"}`;
    return "Up to date";
  }
  
  function publicReleaseStatusLine(status) {
    if (!state.publicReleaseEnabled) return "Public release check disabled";
    if (!status) return "Not checked";
    if (state.publicReleaseBusy || status.checking) return "Checking";
    if (status.error) return `Error: ${status.error}`;
    if (status.supported === false) return status.reason || "Not supported";
    if (status.updateAvailable) return `Public latest: ${status.publicShort || ""}`.trim();
    return "Matches Public latest";
  }
  
  function updateActionButton(action, label, options = {}) {
    const classes = ["update-action-button"];
    if (options.primary) classes.push("primary");
    return `<button type="button" class="${escapeHtml(classes.join(" "))}" data-update-action="${escapeHtml(action)}" ${options.disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
  }
  
  function publicPrHasOpenPullRequests(status) {
    return Boolean(status && status.hasOpenPullRequests);
  }
  
  function renderUpdatePanel() {
    const dialog = $("updateDialog");
    const content = $("updatePanelContent");
    if (!dialog || !content) return;
    dialog.classList.toggle("hidden", !state.updatePanelOpen);
    if (!state.updatePanelOpen) return;
    const current = state.appUpdateStatus || {};
    const release = state.publicReleaseStatus || {};
    const publicCheckout = currentUpdateUsesPublicRelease(current) || Boolean(release.currentCheckoutUsesPublicRelease);
    const canApplyCurrent = Boolean(current.updateAvailable && current.canFastForward && !state.appUpdateBusy && !state.appUpdateRestarting);
    const hasPublicPrs = publicPrHasOpenPullRequests(state.publicPrStatus);
    const publicPrActionLabel = state.publicPrBusy
      ? "Checking PR..."
      : hasPublicPrs
        ? "Review Public PR"
        : "Check PR";
    const currentButtons = [
      updateActionButton("refresh-current", state.appUpdateBusy ? "Checking..." : "Check current", { disabled: state.appUpdateBusy }),
      updateActionButton("apply-current", publicCheckout ? "Update from Public" : "Apply current update", {
        primary: canApplyCurrent,
        disabled: !canApplyCurrent,
      }),
    ].join("");
    const publicButtons = [
      updateActionButton("refresh-public", state.publicReleaseBusy ? "Checking..." : "Check Public", {
        disabled: state.publicReleaseBusy || !state.publicReleaseEnabled,
      }),
      updateActionButton("public-pr", publicPrActionLabel, {
        disabled: state.publicPrBusy || !state.publicPrEnabled,
        primary: hasPublicPrs,
      }),
    ].join("");
    content.innerHTML = `
      <section class="update-card">
        <div class="update-card-title">Current checkout</div>
        <div class="update-row">
          <strong>${escapeHtml(updateStatusLine(current))}</strong>
          <span class="update-row-meta">${escapeHtml(current.remote || "origin")}/${escapeHtml(current.branch || "main")} ${escapeHtml(current.localShort || "")}${current.remoteShort ? ` -> ${escapeHtml(current.remoteShort)}` : ""}</span>
          <span class="update-row-detail">${escapeHtml(current.reason || current.remoteUrl || "Checks the Git remote configured for this running checkout.")}</span>
        </div>
        <div class="update-actions">${currentButtons}</div>
      </section>
      <section class="update-card">
        <div class="update-card-title">Public release</div>
        <div class="update-row">
          <strong>${escapeHtml(publicReleaseStatusLine(release))}</strong>
          <span class="update-row-meta">${escapeHtml(release.repository || state.publicReleaseRepository || "")}/${escapeHtml(release.branch || state.publicReleaseBranch || "main")} ${escapeHtml(release.publicShort || "")}</span>
          <span class="update-row-detail">${escapeHtml(publicCheckout ? "This checkout tracks Public, so the current update button applies Public fast-forward updates." : "This checkout does not track Public; Public latest is shown for reference here.")}</span>
        </div>
        <div class="update-actions">${publicButtons}</div>
      </section>`;
  }
  
  async function refreshPublicReleaseStatus(options = {}) {
    if (!state.key || !state.publicReleaseEnabled) return null;
    if (state.publicReleaseBusy && !options.force) return state.publicReleaseStatus;
    state.publicReleaseBusy = true;
    renderUpdatePanel();
    try {
      const params = new URLSearchParams();
      if (options.force) params.set("force", "1");
      const status = await api(`/api/public-release/status${params.toString() ? `?${params.toString()}` : ""}`, {
        timeoutMs: 18000,
      });
      state.publicReleaseStatus = status;
      return status;
    } catch (err) {
      state.publicReleaseStatus = Object.assign({}, state.publicReleaseStatus || {}, {
        enabled: state.publicReleaseEnabled,
        repository: state.publicReleaseRepository,
        branch: state.publicReleaseBranch,
        error: err.message || String(err),
      });
      return state.publicReleaseStatus;
    } finally {
      state.publicReleaseBusy = false;
      renderUpdatePanel();
    }
  }
  
  function openUpdatePanel() {
    state.updatePanelOpen = true;
    renderUpdatePanel();
    publishPluginNavigationState({ force: true });
    refreshAppUpdateStatus({ fetch: true, force: true, silent: true }).then(renderUpdatePanel).catch(() => renderUpdatePanel());
    refreshPublicReleaseStatus({ force: true }).catch(() => renderUpdatePanel());
  }
  
  function closeUpdatePanel() {
    state.updatePanelOpen = false;
    renderUpdatePanel();
    publishPluginNavigationState({ force: true });
  }
  
  function handleUpdatePanelClick(event) {
    const button = event.target && event.target.closest("[data-update-action]");
    if (!button) return;
    const action = button.dataset.updateAction;
    if (action === "refresh-current") {
      refreshAppUpdateStatus({ fetch: true, force: true, silent: true }).then(renderUpdatePanel).catch(showError);
    } else if (action === "apply-current") {
      handleAppUpdateClick().then(renderUpdatePanel).catch(showError);
    } else if (action === "refresh-public") {
      refreshPublicReleaseStatus({ force: true }).catch(showError);
    } else if (action === "public-pr") {
      handlePublicPrStatusClick().catch(showError);
    }
  }
  
  function scheduleStartupUpdateCheck() {
    if (!state.key) return;
    window.setTimeout(() => {
      refreshAppUpdateStatus({ fetch: true, force: true, silent: true }).catch(() => {});
    }, 900);
  }
  
  function publicPrPromptKey(status) {
    if (!publicPrHasOpenPullRequests(status)) return "";
    const pullRequests = Array.isArray(status.pullRequests) ? status.pullRequests : [];
    const marker = pullRequests
      .map((pr) => `#${pr.number || ""}:${pr.updatedAt || ""}`)
      .filter(Boolean)
      .join("|");
    return `${status.repository || ""}|${status.openPullRequestCount || pullRequests.length}|${marker}`;
  }
  
  function publicPrSummaryText(status) {
    const pullRequests = Array.isArray(status && status.pullRequests) ? status.pullRequests : [];
    if (!pullRequests.length) return "";
    return pullRequests
      .map((pr) => `#${pr.number} ${pr.title || ""}`.trim())
      .join("; ");
  }
  
  function normalizedPublicPrReviewTitle(value) {
    return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  
  function publicPrReviewThreadTitle() {
    return PUBLIC_PR_REVIEW_THREAD_TITLE;
  }
  
  function findPublicPrReviewThread(workspacePath = "") {
    const titleKey = normalizedPublicPrReviewTitle(publicPrReviewThreadTitle());
    const workspace = String(workspacePath || "").trim();
    return state.threads.find((thread) => {
      if (!thread || !thread.id) return false;
      const threadTitle = normalizedPublicPrReviewTitle(thread.name || thread.title || thread.preview || "");
      if (threadTitle !== titleKey) return false;
      return !workspace || threadMatchesWorkspaceCwd(thread.cwd || "", workspace);
    }) || null;
  }
  
  function workspacePathBaseName(value) {
    const text = String(value || "").trim().replace(/[\\/]+$/, "");
    if (!text) return "";
    const parts = text.split(/[\\/]+/).filter(Boolean);
    return parts[parts.length - 1] || "";
  }
  
  function workspacePathIsVisible(value) {
    const key = normalizeFsPath(value);
    if (!key) return false;
    return (state.workspaces || []).some((workspace) => normalizeFsPath(workspace && workspace.cwd) === key);
  }
  
  function visibleWorkspaceWithBaseName(value) {
    const baseName = workspacePathBaseName(value).toLowerCase();
    if (!baseName) return "";
    const match = (state.workspaces || []).find((workspace) => workspace
      && workspace.cwd
      && workspacePathBaseName(workspace.cwd).toLowerCase() === baseName);
    return match ? String(match.cwd || "").trim() : "";
  }
  
  function publicPrReviewWorkspacePath() {
    const appWorkspace = String(state.appWorkspacePath || "").trim();
    if (workspacePathIsVisible(appWorkspace)) return appWorkspace;
    const sameNameWorkspace = visibleWorkspaceWithBaseName(appWorkspace);
    if (sameNameWorkspace) return sameNameWorkspace;
    const selectedWorkspace = String(state.selectedCwd || "").trim();
    if (workspacePathIsVisible(selectedWorkspace)) return selectedWorkspace;
    const currentWorkspace = String((state.currentThread && state.currentThread.cwd) || "").trim();
    if (workspacePathIsVisible(currentWorkspace)) return currentWorkspace;
    return appWorkspace || selectedWorkspace || currentWorkspace;
  }
  
  async function openPublicPrReviewThreadIfAvailable(workspacePath, text) {
    let target = findPublicPrReviewThread(workspacePath);
    if (!target) {
      try {
        await loadThreads({ silent: true });
      } catch (err) {
        postClientEvent("public_pr_reuse_lookup_failed", { message: err.message || String(err) });
      }
      target = findPublicPrReviewThread(workspacePath);
    }
    if (!target || !target.id) return false;
    await loadThread(target.id, { source: "public-pr" });
    setComposerText(text);
    scheduleCurrentDraftSave();
    updateComposerControls();
    return true;
  }
  
  function renderPublicPrStatus() {
    const el = $("publicPrStatus");
    if (!el) return;
    const status = state.publicPrStatus || {};
    const enabled = state.publicPrEnabled && status.enabled !== false;
    const checking = state.publicPrBusy || Boolean(status.checking);
    const hasPrs = publicPrHasOpenPullRequests(status);
    const blocked = Boolean(status.error || status.supported === false);
    let label = "Public PR";
    let title = state.publicPrRepository ? `Check ${state.publicPrRepository} pull requests` : "Check public pull requests";
    if (checking) {
      label = "PR...";
      title = "Checking public pull requests";
    } else if (hasPrs) {
      label = `PR ${status.openPullRequestCount || (status.pullRequests || []).length}`;
      title = `Open public PRs: ${publicPrSummaryText(status) || label}`;
    } else if (status.checkedAt && enabled) {
      label = "No PR";
      title = `No open public PRs in ${status.repository || state.publicPrRepository || "public repo"}`;
    } else if (blocked) {
      label = "PR ?";
      title = status.error || status.reason || "Public PR check is unavailable";
    }
    el.textContent = label;
    el.title = title;
    el.classList.toggle("hidden", !checking && !hasPrs && !blocked);
    el.classList.toggle("available", hasPrs);
    el.classList.toggle("blocked", blocked);
    el.classList.toggle("checking", checking);
    el.disabled = state.publicPrBusy;
  }
  
  async function refreshPublicPrStatus(options = {}) {
    if (!state.key || !state.publicPrEnabled) return null;
    if (state.publicPrBusy && !options.force) return state.publicPrStatus;
    state.publicPrBusy = true;
    if (!options.silent) renderPublicPrStatus();
    try {
      const params = new URLSearchParams();
      if (options.force) params.set("force", "1");
      const status = await api(`/api/public-pull-requests/status${params.toString() ? `?${params.toString()}` : ""}`, {
        timeoutMs: 18000,
      });
      state.publicPrStatus = status;
      state.publicPrError = status && status.error ? status.error : "";
      if (!options.skipPrompt) maybePromptPublicPrMerge(status);
      return status;
    } catch (err) {
      state.publicPrError = err.message || String(err);
      state.publicPrStatus = Object.assign({}, state.publicPrStatus || {}, {
        enabled: state.publicPrEnabled,
        repository: state.publicPrRepository,
        hasOpenPullRequests: false,
        openPullRequestCount: 0,
        pullRequests: [],
        error: state.publicPrError,
      });
      return state.publicPrStatus;
    } finally {
      state.publicPrBusy = false;
      renderPublicPrStatus();
      renderUpdatePanel();
    }
  }
  
  function scheduleStartupPublicPrCheck() {
    if (!state.key || !state.publicPrEnabled) return;
    window.setTimeout(() => {
      refreshPublicPrStatus({ force: true, silent: true }).catch(() => {});
    }, 1600);
  }
  
  function publicPrMergeInstruction(status) {
    const summary = publicPrSummaryText(status);
    const repository = status && status.repository || state.publicPrRepository || "pentiumxp/codex-mobile-web-public";
    return [
      `请检查 public 仓库 ${repository} 的开放 PR${summary ? `：${summary}` : ""}。`,
      "按当前项目规则先评估 PR 是否可合并；如要合并，更新 public README 的中文发布说明，运行验证和隐私扫描，再提交并推送 public。",
      "不要复制 .agent-context、runtime state、本地密钥、上传内容或机器特定诊断。完成 public 后再同步回 private 并重新验证。",
    ].join("\n");
  }
  
  function publicPrMergeConfirmationMessage(status) {
    return [
      `检测到 public 仓库有 ${status.openPullRequestCount || (status.pullRequests || []).length} 个开放 PR。`,
      publicPrSummaryText(status),
      "",
      "是否准备一条合并/发布检查任务？",
    ].filter(Boolean).join("\n");
  }
  
  async function preparePublicPrMergePrompt(status) {
    const text = publicPrMergeInstruction(status);
    if (composerHasContent()) {
      await requestAppAlert("检测到 public 开放 PR，但输入框已有内容。请处理当前草稿后点击 Public PR 按钮。", {
        title: "Public PR",
      });
      return;
    }
    if (!state.workspaces.length) {
      await loadWorkspaces().catch((err) => {
        postClientEvent("public_pr_workspace_lookup_failed", { message: err.message || String(err) });
      });
    }
    const workspacePath = publicPrReviewWorkspacePath();
    if (!workspacePath) {
      setComposerText(text);
      scheduleCurrentDraftSave();
      updateComposerControls();
      return;
    }
    saveCurrentDraftNow();
    state.selectedCwd = workspacePath;
    syncSidebarWorkspaceSelect();
    updateWorkspacePath();
    renderWorkspaceTokenUsage();
    if (await openPublicPrReviewThreadIfAvailable(workspacePath, text)) {
      if (isMenuOverlayMode()) closeSidebarMenu();
      return;
    }
    clearCurrentThreadSelection({ saveDraft: false });
    state.selectedCwd = workspacePath;
    state.newThreadDraft = true;
    state.newThreadTitle = publicPrReviewThreadTitle();
    state.sendButtonHint = "";
    restoreDraftForCurrentTarget();
    state.newThreadTitle = publicPrReviewThreadTitle();
    setComposerText(text);
    syncSidebarWorkspaceSelect();
    updateWorkspacePath();
    renderWorkspaceTokenUsage();
    renderThreads();
    renderCurrentThread();
    updateComposerControls();
    scheduleCurrentDraftSave();
    if (isMenuOverlayMode()) closeSidebarMenu();
  }
  
  function rememberPublicPrPrompt(status) {
    const key = publicPrPromptKey(status);
    if (!key) return;
    state.publicPrPromptedKey = key;
    localStorage.setItem(STORAGE_PUBLIC_PR_PROMPT, key);
  }
  
  function maybePromptPublicPrMerge(status) {
    if (!publicPrHasOpenPullRequests(status)) return;
    const key = publicPrPromptKey(status);
    if (!key || key === state.publicPrPromptedKey) return;
    rememberPublicPrPrompt(status);
    requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
      title: "Public PR",
      confirmLabel: "准备任务",
      cancelLabel: "稍后",
    }).then((confirmed) => {
      if (confirmed) preparePublicPrMergePrompt(status).catch(showError);
    }).catch(showError);
  }
  
  async function handlePublicPrStatusClick() {
    if (state.publicPrBusy) return;
    const status = await refreshPublicPrStatus({ force: true, skipPrompt: true });
    if (!status) return;
    if (status.error && !publicPrHasOpenPullRequests(status)) {
      await requestAppAlert(`public PR 检查失败：${status.error}`, { title: "Public PR" });
      return;
    }
    if (!publicPrHasOpenPullRequests(status)) {
      await requestAppAlert("当前未检测到 public 开放 PR。", { title: "Public PR" });
      return;
    }
    const confirmed = await requestAppConfirmation(publicPrMergeConfirmationMessage(status), {
      title: "Public PR",
      confirmLabel: "准备任务",
      cancelLabel: "稍后",
    });
    rememberPublicPrPrompt(status);
    if (confirmed) await preparePublicPrMergePrompt(status);
  }
  
  async function handleAppUpdateClick() {
    if (state.appUpdateBusy || state.appUpdateRestarting) return;
    let status = state.appUpdateStatus;
    if (!status || (!status.updateAvailable && !status.error)) {
      status = await refreshAppUpdateStatus({ fetch: true, force: true });
    }
    if (!status) return;
    if (status.supported === false) {
      await requestAppAlert(`当前安装方式不支持自动更新：${status.reason || "没有可用的 Git 远程分支"}`, { title: "更新检查" });
      return;
    }
    if (status.error && !status.updateAvailable) {
      await requestAppAlert(`更新检查失败：${status.error}`, { title: "更新检查" });
      return;
    }
    if (!status.updateAvailable) {
      await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
      return;
    }
    if (!status.canFastForward) {
      await requestAppAlert(`检测到更新，但不能自动应用：${status.reason || status.error || "当前工作区不是干净的 fast-forward 状态"}`, { title: "更新检查" });
      return;
    }
    const confirmed = await requestAppConfirmation([
      "发现 GitHub 更新。是否拉取并重启 Mobile Web？",
      "",
      "仅在当前仓库干净、可 fast-forward 时执行；运行时数据和 Access Key 不会被覆盖。",
      "更新完成后当前 Node 服务会退出。只有通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行时才会自动拉起；手动运行 node/npm start 的部署需要手动重启。",
    ].join("\n"), {
      title: "应用更新",
      confirmLabel: "更新并重启",
      cancelLabel: "取消",
    });
    if (!confirmed) return;
    state.appUpdateBusy = true;
    renderAppUpdateStatus();
    try {
      const result = await api("/api/app-update/apply", {
        method: "POST",
        body: "{}",
        timeoutMs: 150000,
      });
      state.appUpdateStatus = result.after || result.status || status;
      if (result.updated) {
        state.appUpdateRestarting = true;
        $("connectionState").textContent = "更新已应用；如连接断开且未自动恢复，请在部署机手动重启";
        renderAppUpdateStatus();
        window.setTimeout(() => window.location.reload(), Math.max(1800, Number(result.restartInMs || 1200) + 900));
      } else {
        await requestAppAlert("当前已经是最新版本。", { title: "更新检查" });
      }
    } catch (err) {
      state.appUpdateError = err.message || String(err);
      state.appUpdateStatus = Object.assign({}, status || {}, {
        error: state.appUpdateError,
      });
      showError(err);
    } finally {
      state.appUpdateBusy = false;
      renderAppUpdateStatus();
      renderUpdatePanel();
    }
  }
  
  function renderSharedRestartButton() {
    const el = $("sharedRestartButton");
    if (!el) return;
    const restarting = state.sharedRestarting;
    el.textContent = restarting ? "Restarting" : "Restart";
    el.title = restarting ? "Mobile Web is restarting" : "Restart Mobile Web shared chain";
    el.disabled = state.sharedRestartBusy || restarting;
    el.classList.toggle("checking", state.sharedRestartBusy || restarting);
  }
  
  function renderHardRefreshButton() {
    const el = $("hardRefreshButton");
    if (!el) return;
    const reloading = state.pageRefreshReloading;
    el.textContent = reloading ? "刷新中" : "硬刷新";
    el.title = reloading
      ? "Refreshing the current PWA page shell"
      : "Fetch current page assets, update the service worker, and reload this PWA page";
    el.disabled = reloading;
    el.classList.toggle("checking", reloading);
  }
  
  function markBootReady() {
    const boot = window.codexMobileBoot;
    if (boot && typeof boot.ready === "function") boot.ready();
  }
  
  function reportShellLoaded(startedAt, details = {}) {
    if (state.shellLoadedReported) return;
    state.shellLoadedReported = true;
    postPerformanceEvent("shell_loaded", Object.assign({
      elapsedMs: roundedDurationMs(startedAt),
      buildId: CLIENT_BUILD_ID,
      hasThreadOpenIntent: Boolean(state.startupThreadOpenPending),
    }, details || {}), { force: true });
  }
  
  function sharedRestartScopeLines() {
    const isMac = state.serverPlatform === "darwin";
    return isMac
      ? [
        "这会短暂断开当前页面连接，并重启这台 Mac 上的 Mobile Web 服务。",
        "不会重启 Codex Desktop、shared mux 或其它本机服务。",
      ]
      : [
        "这会短暂断开当前页面连接，并重启 Mobile Web、shared mux 和本地 app-server。",
        "不会重启 WSL、Codex Desktop 或其它本机服务。",
      ];
  }
  
  function restartRiskThreads(threads) {
    const seen = new Set();
    const result = [];
    for (const thread of threads || []) {
      const id = String(thread && thread.id || "");
      if (!id || seen.has(id) || !isRunningStatus(thread.status)) continue;
      seen.add(id);
      result.push(thread);
    }
    if (state.currentThreadId && state.activeTurnId && !seen.has(String(state.currentThreadId))) {
      const current = state.currentThread || threadById(state.currentThreadId) || { id: state.currentThreadId, name: "Current session", status: { type: "active" } };
      result.unshift(current);
    }
    return result;
  }
  
  async function fetchRestartRiskThreads() {
    const params = new URLSearchParams({ limit: "200", archived: "false" });
    const result = await api(`/api/threads?${params}`, { timeoutMs: 45000 });
    return restartRiskThreads(visibleThreads(result.data || []));
  }
  
  function restartRiskThreadTitle(thread) {
    return String(thread && (thread.name || thread.preview || thread.id) || "Untitled session").trim();
  }
  
  function restartRiskThreadMeta(thread) {
    const parts = [];
    const cwd = shortPath(thread && thread.cwd);
    if (cwd) parts.push(cwd);
    const status = statusText(thread && thread.status);
    if (status) parts.push(status);
    return parts.join(" | ");
  }
  
  function renderSharedRestartDialog() {
    const dialog = $("restartConfirmDialog");
    const subtitle = $("restartConfirmSubtitle");
    const content = $("restartConfirmContent");
    const proceed = $("restartConfirmProceed");
    if (!dialog || !content || !subtitle || !proceed) return;
    dialog.classList.toggle("hidden", !state.sharedRestartDialogOpen);
    if (!state.sharedRestartDialogOpen) {
      content.innerHTML = "";
      return;
    }
    const riskThreads = state.sharedRestartRiskThreads || [];
    const hasRisk = riskThreads.length > 0;
    subtitle.textContent = hasRisk
      ? `${riskThreads.length} running session${riskThreads.length === 1 ? "" : "s"} may be interrupted`
      : "No running sessions were found";
    proceed.textContent = hasRisk ? "仍然重启" : "Restart";
    proceed.classList.toggle("danger", hasRisk);
    const scopeHtml = (state.sharedRestartScopeLines || [])
      .map((line) => `<div class="restart-confirm-line">${escapeHtml(line)}</div>`)
      .join("");
    const riskHtml = hasRisk
      ? `<div class="restart-risk-block">
          <div class="restart-risk-title">Running sessions</div>
          <div class="restart-risk-list">
            ${riskThreads.slice(0, 6).map((thread) => {
              const meta = restartRiskThreadMeta(thread);
              return `<div class="restart-risk-item">
                <div class="restart-risk-item-title">${escapeHtml(restartRiskThreadTitle(thread))}</div>
                ${meta ? `<div class="restart-risk-item-meta">${escapeHtml(meta)}</div>` : ""}
              </div>`;
            }).join("")}
            ${riskThreads.length > 6 ? `<div class="restart-risk-more">另有 ${escapeHtml(String(riskThreads.length - 6))} 个 running session</div>` : ""}
          </div>
        </div>`
      : `<div class="restart-safe-block">当前没有检测到 running session。重启仍会短暂断开本页面连接。</div>`;
    content.innerHTML = `
      <div class="restart-confirm-message">
        ${hasRisk
          ? "重启可能会打断正在通过 Codex Mobile 同步或运行的 session。建议等它们结束后再重启。"
          : "确认重启 Codex Mobile Web？"}
      </div>
      ${riskHtml}
      <div class="restart-confirm-scope">${scopeHtml}</div>
    `;
  }
  
  function closeSharedRestartDialog(confirmed = false) {
    const resolve = state.sharedRestartConfirmResolve;
    state.sharedRestartDialogOpen = false;
    state.sharedRestartRiskThreads = [];
    state.sharedRestartScopeLines = [];
    state.sharedRestartConfirmResolve = null;
    renderSharedRestartDialog();
    if (resolve) resolve(Boolean(confirmed));
  }
  
  function requestSharedRestartConfirmation(riskThreads, scopeLines) {
    if (state.sharedRestartConfirmResolve) closeSharedRestartDialog(false);
    state.sharedRestartRiskThreads = riskThreads || [];
    state.sharedRestartScopeLines = scopeLines || [];
    state.sharedRestartDialogOpen = true;
    renderSharedRestartDialog();
    return new Promise((resolve) => {
      state.sharedRestartConfirmResolve = resolve;
    });
  }
  
  async function handleSharedRestartClick() {
    if (state.sharedRestartBusy || state.sharedRestarting) return;
    state.sharedRestartBusy = true;
    renderSharedRestartButton();
    try {
      const riskThreads = await fetchRestartRiskThreads();
      const confirmed = await requestSharedRestartConfirmation(riskThreads, sharedRestartScopeLines());
      if (!confirmed) return;
      saveRestartAutoRecoverThreads(riskThreads);
      state.appServerWasUnavailable = true;
      const result = await api("/api/restart/shared-chain", {
        method: "POST",
        body: "{}",
        timeoutMs: 12000,
      });
      state.sharedRestarting = true;
      state.sharedRestartBusy = false;
      showReconnectRefreshPrompt("restart");
      const connection = $("connectionState");
      if (connection) connection.textContent = "Restarting";
      renderSharedRestartButton();
    } catch (err) {
      showError(err);
    } finally {
      if (!state.sharedRestarting) {
        state.sharedRestartBusy = false;
        renderSharedRestartButton();
      }
    }
  }
  
  function serverBuildIdFromConfig(config) {
    return String(config && (config.clientBuildId || config.shellCacheName || config.buildId) || "").trim();
  }
  
  function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
    if (buildRefreshPolicy && typeof buildRefreshPolicy.shouldPromptForServerBuildChange === "function") {
      return buildRefreshPolicy.shouldPromptForServerBuildChange(serverBuildId, clientBuildId);
    }
    return Boolean(serverBuildId && clientBuildId && serverBuildId !== clientBuildId);
  }

  function loadedClientBuildId() {
    return String(CLIENT_BUILD_ID || "").trim();
  }

  function serverBuildMatchesLoadedClient(config) {
    const nextBuildId = serverBuildIdFromConfig(config);
    const clientBuildId = loadedClientBuildId();
    return Boolean(nextBuildId && clientBuildId && !shouldPromptForServerBuildChange(nextBuildId, clientBuildId));
  }

  function acceptLoadedClientBuild(config) {
    const clientBuildId = loadedClientBuildId();
    const nextBuildId = serverBuildIdFromConfig(config);
    state.serverBuildId = clientBuildId || nextBuildId || state.serverBuildId;
    state.serverAssetBuildId = String(config && config.buildId || state.serverAssetBuildId || "").trim();
    if (state.pageRefreshReason === "build") {
      state.pageRefreshAvailable = false;
      state.pageRefreshReason = "";
      state.pageRefreshBuildId = "";
      state.pageRefreshPreparedConfig = null;
      renderPageRefreshPrompt();
    }
  }

  function frontendDiagnosticPublicConfigSignature(config) {
    const raw = config && config.frontendDiagnosticLog && typeof config.frontendDiagnosticLog === "object"
      ? config.frontendDiagnosticLog
      : null;
    if (!raw || typeof raw.enabled !== "boolean") return "";
    return JSON.stringify({
      enabled: Boolean(raw.enabled),
      upload: raw.upload !== false,
      scopes: raw.scopes || "submitted_echo",
      maxEntries: raw.maxEntries || 400,
      updatedAt: raw.updatedAt || "",
    });
  }

  function applyRuntimePublicConfig(config, source = "public-config") {
    const signature = frontendDiagnosticPublicConfigSignature(config);
    if (!signature || state.frontendDiagnosticLogPublicConfigSignature === signature) return null;
    state.frontendDiagnosticLogPublicConfigSignature = signature;
    try {
      const status = applyFrontendDiagnosticLogPublicConfig(config) || {};
      postClientEvent("frontend_diagnostic_log_settings_applied", {
        source,
        enabled: Boolean(status.enabled),
        upload: Boolean(status.upload),
        scopes: Array.isArray(status.scopes) ? status.scopes.join(",") : String(status.scopes || ""),
        maxEntries: Number(status.maxEntries || 0),
      });
      return status;
    } catch (err) {
      postClientEvent("frontend_diagnostic_log_settings_apply_failed", {
        source,
        error: err && err.message ? err.message : String(err),
      });
      return null;
    }
  }

  function pageShellAssetUrl(asset, buildId) {
    const url = new URL(asset, window.location.origin);
    url.searchParams.set("shellBuild", buildId || "current");
    url.searchParams.set("shellCheck", String(Date.now()));
    return url.href;
  }
  
  function validatePageShellAsset(asset, text, config) {
    const buildId = serverBuildIdFromConfig(config);
    const shellCacheName = String(config && config.shellCacheName || "").trim();
    if (asset === "/" || asset === "/index.html") {
      return text.includes('href="/styles.css"') && text.includes('src="/app.js"');
    }
    if (asset === "/styles.css") {
      return text.includes(".app") && text.includes(".composer");
    }
    if (asset === "/app.js") {
      return !buildId || text.includes(buildId) || text.includes(shellCacheName);
    }
    if (asset === "/sw.js") {
      return text.includes("shell-asset-manifest.js");
    }
    return true;
  }
  
  async function fetchPageShellAsset(asset, config) {
    const response = await fetch(pageShellAssetUrl(asset, serverBuildIdFromConfig(config)), {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) {
      throw new Error(`page shell asset unavailable: ${asset}`);
    }
    if (asset === "/" || asset.endsWith(".html") || asset.endsWith(".css") || asset.endsWith(".js") || asset.endsWith(".json") || asset.endsWith(".svg")) {
      const text = await response.clone().text();
      if (!validatePageShellAsset(asset, text, config)) {
        throw new Error(`page shell asset stale: ${asset}`);
      }
    }
    return response;
  }
  
  async function preparePageShellAssets(config, options = {}) {
    const populateCache = Boolean(options.populateCache);
    const shellCacheName = String(config && config.shellCacheName || "").trim();
    const cache = populateCache && shellCacheName && "caches" in window
      ? await window.caches.open(shellCacheName)
      : null;
    for (const asset of PAGE_SHELL_ASSETS) {
      const response = await fetchPageShellAsset(asset, config);
      if (cache) await cache.put(asset, response.clone());
    }
  }
  
  async function fetchPageBuildConfig() {
    const response = await fetch(`/api/public-config?buildCheck=${Date.now()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!response.ok) return null;
    const config = await response.json();
    applyRuntimePublicConfig(config, "page-build-check");
    return config;
  }
  
  async function pruneOldShellCaches(expectedCacheName) {
    if (!expectedCacheName || !("caches" in window)) return;
    const keys = await window.caches.keys();
    await Promise.all(keys
      .filter((key) => String(key || "").startsWith("codex-mobile-shell-") && key !== expectedCacheName)
      .map((key) => window.caches.delete(key)));
  }
  
  async function clearAllShellCaches() {
    if (!("caches" in window)) return;
    const keys = await window.caches.keys();
    await Promise.all(keys
      .filter((key) => String(key || "").startsWith("codex-mobile-shell-"))
      .map((key) => window.caches.delete(key)));
  }
  
  async function resetPageShellServiceWorker() {
    if (!("serviceWorker" in navigator)) return null;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)));
    state.serviceWorkerRegistration = null;
    const registration = await navigator.serviceWorker.register("/sw.js");
    if (registration && registration.update) await registration.update().catch(() => {});
    state.serviceWorkerRegistration = registration || null;
    return registration || null;
  }
  
  function pageReloadUrlWithBust() {
    const url = new URL(window.location.href, window.location.origin);
    url.searchParams.set("shellReload", String(Date.now()));
    return url.href;
  }

  function recordPageRefreshFailure(err, phase = "refresh") {
    try {
      postClientEvent("page_refresh_failed", {
        phase,
        reason: String(state.pageRefreshReason || ""),
        currentBuildId: String(state.serverBuildId || CLIENT_BUILD_ID || ""),
        targetBuildId: String(state.pageRefreshBuildId || ""),
        errorName: err && err.name ? String(err.name) : "",
        errorMessage: err && err.message ? String(err.message).slice(0, 180) : String(err || "").slice(0, 180),
      });
    } catch (_) {
      // Best-effort diagnostic only; refresh state must not depend on telemetry.
    }
  }
  
  function initializePageBuildState(config) {
    state.serverBuildId = CLIENT_BUILD_ID || serverBuildIdFromConfig(config);
    state.serverAssetBuildId = String(config && config.buildId || "").trim();
    const currentServerBuildId = serverBuildIdFromConfig(config);
    if (shouldPromptForServerBuildChange(currentServerBuildId, state.serverBuildId)) {
      state.pageRefreshBuildId = currentServerBuildId;
      state.pageRefreshReason = "build";
      state.pageRefreshAvailable = true;
      state.pageRefreshPreparedConfig = config || null;
      if (isHermesEmbedMode()) {
        requestHermesPluginRefresh("server_build_changed", { force: true });
        return;
      }
    }
    renderPageRefreshPrompt();
  }
  
  function renderPageRefreshPrompt() {
    const el = $("pageRefreshPrompt");
    if (!el) return;
    const restarting = state.pageRefreshReason === "restart";
    const reconnecting = state.pageRefreshReason === "reconnect" || restarting;
    el.classList.toggle("hidden", !state.pageRefreshAvailable && !state.pageRefreshReloading);
    el.disabled = state.pageRefreshReloading;
    if (state.pageRefreshReloading) {
      el.textContent = restarting ? "Waiting for service, then refreshing..." : reconnecting ? "Refreshing and reconnecting..." : "Refreshing page...";
    } else {
      el.textContent = restarting ? "Service restarted. Tap to refresh." : reconnecting ? "Connection changed. Tap to refresh." : "New version available. Tap to refresh.";
    }
    el.title = restarting || reconnecting
      ? "Manual refresh only; the page will not reload until this button is tapped."
      : state.pageRefreshBuildId
      ? `Server version is ${state.pageRefreshBuildId}. Tap to refresh manually.`
      : "Server page assets changed. Tap to refresh manually.";
    renderHardRefreshButton();
  }
  
  async function handleHardRefreshClick() {
    if (state.pageRefreshReloading) return;
    state.pageRefreshPreparedConfig = null;
    state.pageRefreshReason = "build";
    state.pageRefreshAvailable = true;
    await refreshPageForNewBuild();
  }
  
  function showReconnectRefreshPrompt(reason = "reconnect") {
    if (state.pageRefreshReloading) return;
    if (isHermesEmbedMode() && reason !== "restart") return;
    state.pageRefreshAvailable = true;
    state.pageRefreshReason = reason === "restart" ? "restart" : "reconnect";
    state.pageRefreshPreparedConfig = null;
    renderPageRefreshPrompt();
  }

  function codexProfileHasQuotaSnapshot(profile) {
    const quota = profile && typeof profile === "object" ? profile.quota : null;
    if (!quota || typeof quota !== "object") return false;
    if (quota.rateLimits && typeof quota.rateLimits === "object") return true;
    const byModel = quota.rateLimitsByModel;
    return Boolean(byModel && typeof byModel === "object" && Object.keys(byModel).length);
  }

  function codexProfileRestartReadyForCompletion() {
    const targetId = String(state.codexProfileSwitchTargetId || "");
    if (!state.codexProfileRestarting || !targetId) return true;
    if (!state.activeCodexProfileId || targetId !== state.activeCodexProfileId) return false;
    const profiles = Array.isArray(state.codexProfiles) ? state.codexProfiles : [];
    const activeProfile = profiles.find((profile) => String(profile && profile.id || "") === targetId);
    if (!activeProfile || !codexProfileHasQuotaSnapshot(activeProfile)) {
      state.codexProfileSwitchStage = "服务已恢复，正在等待目标账号额度刷新...";
      const connection = $("connectionState");
      if (connection) connection.textContent = state.codexProfileSwitchStage;
      renderCodexProfileSettings();
      return false;
    }
    return true;
  }
  
  function finishRestartingUiIfReady() {
    if (!codexProfileRestartReadyForCompletion()) return false;
    const changed = Boolean(state.codexProfileRestarting || state.sharedRestarting || state.codexProfileSwitchTargetId || state.codexProfileSwitchStage);
    stopCodexProfileSwitchProgressPolling();
    state.codexProfileRestarting = false;
    state.codexProfileSwitchTargetId = "";
    state.codexProfileSwitchStage = "";
    state.codexProfileSwitchRequestId = "";
    state.sharedRestarting = false;
    state.sharedRestartBusy = false;
    if (changed) {
      renderCodexProfileSettings();
      renderSharedRestartButton();
    }
    return changed;
  }
  
  function clearReconnectRefreshPrompt() {
    if (!(state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart") || state.pageRefreshReloading) return;
    state.pageRefreshAvailable = false;
    state.pageRefreshReason = "";
    state.pageRefreshPreparedConfig = null;
    finishRestartingUiIfReady();
    renderPageRefreshPrompt();
  }
  
  async function checkPageRefreshAvailability(options = {}) {
    if (state.pageRefreshReloading) return;
    const now = Date.now();
    if (state.pageRefreshBusy) return;
    if (!options.force && now - state.pageRefreshLastCheckAt < PAGE_REFRESH_MIN_CHECK_INTERVAL_MS) return;
    state.pageRefreshBusy = true;
    state.pageRefreshLastCheckAt = now;
    try {
      const config = await fetchPageBuildConfig();
      if (!config) return;
      const nextBuildId = serverBuildIdFromConfig(config);
      const nextAssetBuildId = String(config && config.buildId || "").trim();
      if (!state.serverBuildId) {
        state.serverBuildId = CLIENT_BUILD_ID || nextBuildId;
        state.serverAssetBuildId = nextAssetBuildId;
        return;
      }
      if (serverBuildMatchesLoadedClient(config)) {
        acceptLoadedClientBuild(config);
        return;
      }
      const serverBuildChanged = Boolean(nextBuildId && nextBuildId !== state.serverBuildId);
      const serverBuildNeedsRefresh = serverBuildChanged && shouldPromptForServerBuildChange(nextBuildId, state.serverBuildId);
      const assetsChanged = Boolean(nextAssetBuildId && state.serverAssetBuildId && nextAssetBuildId !== state.serverAssetBuildId);
      if (assetsChanged && !serverBuildNeedsRefresh) {
        state.serverAssetBuildId = nextAssetBuildId;
        return;
      }
      if (serverBuildNeedsRefresh) {
        if (isHermesEmbedMode()) {
          state.pageRefreshBuildId = nextBuildId;
          state.pageRefreshPreparedConfig = config;
          requestHermesPluginRefresh("server_build_changed");
          return;
        }
        state.pageRefreshAvailable = true;
        state.pageRefreshReason = "build";
        state.pageRefreshBuildId = nextBuildId;
        state.pageRefreshPreparedConfig = config;
        renderPageRefreshPrompt();
      }
    } catch (_) {
      // Version checks are best-effort; normal API connection state handles real failures.
    } finally {
      state.pageRefreshBusy = false;
    }
  }
  
  function schedulePageRefreshCheck(delayMs = 0, options = {}) {
    window.setTimeout(() => {
      checkPageRefreshAvailability(options).catch(() => {});
    }, Math.max(0, Number(delayMs || 0)));
  }
  
  function scheduleVisiblePageRefreshCheck(delayMs = 0, options = {}) {
    if (document.visibilityState === "hidden") return;
    schedulePageRefreshCheck(delayMs, options);
  }
  
  function startPageRefreshChecks() {
    if (state.pageRefreshTimer) clearInterval(state.pageRefreshTimer);
    state.pageRefreshTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      checkPageRefreshAvailability({ silent: true }).catch(() => {});
    }, PAGE_REFRESH_CHECK_INTERVAL_MS);
  }
  
  async function waitForPageBuildConfig(timeoutMs = 18000) {
    const startedAt = Date.now();
    let lastError = null;
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const config = await fetchPageBuildConfig();
        if (config) return config;
      } catch (err) {
        lastError = err;
      }
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    throw lastError || new Error("Mobile Web is still unavailable");
  }
  
  async function refreshPageForNewBuild() {
    if (state.pageRefreshReloading) return;
    state.pageRefreshReloading = true;
    renderPageRefreshPrompt();
    saveCurrentDraftNow();
    let config = state.pageRefreshPreparedConfig;
    try {
      const reconnectRefresh = state.pageRefreshReason === "reconnect" || state.pageRefreshReason === "restart";
      const latestConfig = reconnectRefresh
        ? await waitForPageBuildConfig()
        : await fetchPageBuildConfig();
      if (latestConfig) config = latestConfig;
      if (!config) throw new Error("page refresh build config unavailable");
      const nextBuildId = serverBuildIdFromConfig(config);
      const currentBuildId = state.serverBuildId || CLIENT_BUILD_ID || nextBuildId;
      if (serverBuildMatchesLoadedClient(config)) {
        rememberRateLimitsFromConfig(config);
        rememberCodexProfiles(config && config.codexProfiles || null);
        acceptLoadedClientBuild(config);
        const restartFinished = reconnectRefresh ? finishRestartingUiIfReady() : false;
        state.pageRefreshReloading = false;
        state.pageRefreshAvailable = !restartFinished && state.codexProfileRestarting;
        state.pageRefreshReason = state.pageRefreshAvailable ? "restart" : "";
        state.pageRefreshPreparedConfig = null;
        renderPageRefreshPrompt();
        return;
      }
      if (reconnectRefresh && !shouldPromptForServerBuildChange(nextBuildId, currentBuildId)) {
        state.serverBuildId = currentBuildId || nextBuildId;
        state.serverAssetBuildId = String(config && config.buildId || state.serverAssetBuildId || "").trim();
        rememberRateLimitsFromConfig(config);
        rememberCodexProfiles(config && config.codexProfiles || null);
        const restartFinished = finishRestartingUiIfReady();
        state.pageRefreshReloading = false;
        state.pageRefreshAvailable = !restartFinished && state.codexProfileRestarting;
        state.pageRefreshReason = state.pageRefreshAvailable ? "restart" : "";
        state.pageRefreshPreparedConfig = null;
        renderPageRefreshPrompt();
        return;
      }
      rememberRateLimitsFromConfig(config);
      rememberCodexProfiles(config && config.codexProfiles || null);
      await clearAllShellCaches();
      if (config) await preparePageShellAssets(config, { populateCache: true });
      await resetPageShellServiceWorker();
      await pruneOldShellCaches(String(config && config.shellCacheName || "").trim());
      window.location.replace(pageReloadUrlWithBust());
    } catch (err) {
      recordPageRefreshFailure(err, "new-build-refresh");
      state.pageRefreshReloading = false;
      state.pageRefreshPreparedConfig = null;
      if (state.pageRefreshReason !== "reconnect" && state.pageRefreshReason !== "restart") {
        state.pageRefreshAvailable = true;
        state.pageRefreshReason = "build";
      }
      renderPageRefreshPrompt();
    }
  }

  return Object.freeze({
    appVersionText,
    clientBuildVersionText,
    renderAppUpdateStatus,
    refreshAppUpdateStatus,
    currentUpdateUsesPublicRelease,
    updateStatusLine,
    publicReleaseStatusLine,
    updateActionButton,
    publicPrHasOpenPullRequests,
    renderUpdatePanel,
    refreshPublicReleaseStatus,
    openUpdatePanel,
    closeUpdatePanel,
    handleUpdatePanelClick,
    scheduleStartupUpdateCheck,
    publicPrPromptKey,
    publicPrSummaryText,
    normalizedPublicPrReviewTitle,
    publicPrReviewThreadTitle,
    findPublicPrReviewThread,
    workspacePathBaseName,
    workspacePathIsVisible,
    visibleWorkspaceWithBaseName,
    publicPrReviewWorkspacePath,
    openPublicPrReviewThreadIfAvailable,
    renderPublicPrStatus,
    refreshPublicPrStatus,
    scheduleStartupPublicPrCheck,
    publicPrMergeInstruction,
    publicPrMergeConfirmationMessage,
    preparePublicPrMergePrompt,
    rememberPublicPrPrompt,
    maybePromptPublicPrMerge,
    handlePublicPrStatusClick,
    handleAppUpdateClick,
    renderSharedRestartButton,
    renderHardRefreshButton,
    markBootReady,
    reportShellLoaded,
    sharedRestartScopeLines,
    restartRiskThreads,
    fetchRestartRiskThreads,
    restartRiskThreadTitle,
    restartRiskThreadMeta,
    renderSharedRestartDialog,
    closeSharedRestartDialog,
    requestSharedRestartConfirmation,
    handleSharedRestartClick,
    serverBuildIdFromConfig,
    shouldPromptForServerBuildChange,
    pageShellAssetUrl,
    validatePageShellAsset,
    fetchPageShellAsset,
    preparePageShellAssets,
    fetchPageBuildConfig,
    pruneOldShellCaches,
    clearAllShellCaches,
    resetPageShellServiceWorker,
    pageReloadUrlWithBust,
    initializePageBuildState,
    renderPageRefreshPrompt,
    handleHardRefreshClick,
    showReconnectRefreshPrompt,
    finishRestartingUiIfReady,
    clearReconnectRefreshPrompt,
    checkPageRefreshAvailability,
    schedulePageRefreshCheck,
    scheduleVisiblePageRefreshCheck,
    startPageRefreshChecks,
    waitForPageBuildConfig,
    refreshPageForNewBuild,
  });
}

root.CodexAppUpdateRuntime = Object.freeze({
  createAppUpdateRuntime,
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createAppUpdateRuntime };
}
})(typeof window !== "undefined" ? window : globalThis);
