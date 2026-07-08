"use strict";

const { spawn } = require("node:child_process");
const {
  buildPublicPullRequestStatus,
  normalizeRepositorySlug,
  publicPullRequestApiUrl,
} = require("./public-pull-request-service");
const {
  githubPreviewApiUrl,
  normalizeGitHubPreview,
  parseGitHubUrl,
} = require("./github-link-preview-service");

function maskRemoteCredentials(value) {
  return String(value || "").replace(/([a-z][a-z0-9+.-]*:\/\/)([^/@\s]+)@/gi, "$1***@");
}

function safeAppUpdateError(err) {
  return maskRemoteCredentials(String(err && err.message ? err.message : err || "unknown error")).slice(0, 1600);
}

function safeRemoteUrl(value) {
  return maskRemoteCredentials(String(value || "").trim());
}

function compactProcessOutput(value, maxChars = 2400) {
  const text = maskRemoteCredentials(String(value || "").trim());
  if (text.length <= maxChars) return text;
  const head = Math.floor(maxChars * 0.65);
  const tail = maxChars - head - 18;
  return `${text.slice(0, head)}...<truncated>...${text.slice(-tail)}`;
}

function assertSafeGitValue(value, label) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`${label} is empty`);
  if (text.startsWith("-") || /[\0\r\n]/.test(text)) throw new Error(`${label} is not a safe git ref value`);
  return text;
}

function assertSafeGitRemote(value, label = "update remote") {
  const text = assertSafeGitValue(value, label);
  if (!/^[A-Za-z0-9._-]+$/.test(text)) throw new Error(`${label} is not a safe git remote name`);
  return text;
}

function assertSafeGitBranch(value, label = "update branch") {
  const text = assertSafeGitValue(value, label);
  if (
    text.includes("..")
    || text.includes("@{")
    || text.includes("\\")
    || text.includes("//")
    || text.startsWith("/")
    || text.endsWith("/")
    || text.endsWith(".lock")
    || /[~^:?*[\]\s]/.test(text)
    || /(^|\/)\.(\.?)(\/|$)/.test(text)
  ) {
    throw new Error(`${label} is not a safe git branch name`);
  }
  return text;
}

function shortCommit(value) {
  const text = String(value || "").trim();
  return text ? text.slice(0, 7) : "";
}

function publicRepositoryCommitApiUrl(repository, branch) {
  const slug = normalizeRepositorySlug(repository);
  const ref = encodeURIComponent(assertSafeGitBranch(branch, "public release branch"));
  return `https://api.github.com/repos/${slug}/commits/${ref}`;
}

function remoteUrlLooksLikeRepository(remoteUrl, repository) {
  const slug = normalizeRepositorySlug(repository).toLowerCase();
  const text = safeRemoteUrl(remoteUrl).toLowerCase().replace(/\.git(?:[#?].*)?$/i, "");
  if (!text) return false;
  return text.includes(`github.com/${slug}`) || text.endsWith(`/${slug}`) || text.endsWith(`:${slug}`);
}

function makeStatusError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizePositiveNumber(value, fallback, min = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(min, numeric) : fallback;
}

function defaultNow() {
  return Date.now();
}

function createAppMaintenanceService(options = {}) {
  const appRoot = String(options.appRoot || process.cwd());
  const appVersion = String(options.appVersion || "");
  const appUpdateRemote = String(options.appUpdateRemote || "origin");
  const appUpdateBranch = String(options.appUpdateBranch || "main");
  const appUpdateDisabled = Boolean(options.appUpdateDisabled);
  const appUpdateCheckTimeoutMs = normalizePositiveNumber(options.appUpdateCheckTimeoutMs, 15000, 1000);
  const appUpdateApplyTimeoutMs = normalizePositiveNumber(options.appUpdateApplyTimeoutMs, 120000, 5000);
  const appUpdateRestartDelayMs = normalizePositiveNumber(options.appUpdateRestartDelayMs, 1200, 500);
  const appUpdateCacheMs = normalizePositiveNumber(options.appUpdateCacheMs, 900000, 30000);
  const publicPrCheckDisabled = Boolean(options.publicPrCheckDisabled);
  const publicPrRepository = normalizeRepositorySlug(options.publicPrRepository || "pentiumxp/codex-mobile-web-public");
  const publicPrCheckTimeoutMs = normalizePositiveNumber(options.publicPrCheckTimeoutMs, 12000, 1000);
  const publicPrCheckCacheMs = normalizePositiveNumber(options.publicPrCheckCacheMs, 900000, 30000);
  const githubLinkPreviewTimeoutMs = normalizePositiveNumber(options.githubLinkPreviewTimeoutMs, 12000, 1000);
  const githubLinkPreviewCacheMs = normalizePositiveNumber(options.githubLinkPreviewCacheMs, 900000, 30000);
  const publicReleaseCheckDisabled = Boolean(options.publicReleaseCheckDisabled);
  const publicReleaseRepository = normalizeRepositorySlug(options.publicReleaseRepository || publicPrRepository);
  const publicReleaseBranch = String(options.publicReleaseBranch || "main");
  const publicReleaseCheckCacheMs = normalizePositiveNumber(options.publicReleaseCheckCacheMs, 900000, 30000);
  const fetchImpl = typeof options.fetch === "function" ? options.fetch : globalThis.fetch;
  const hasCurrentPublicBuildConfigProvider = typeof options.currentPublicBuildConfig === "function";
  const currentPublicBuildConfig = hasCurrentPublicBuildConfigProvider
    ? options.currentPublicBuildConfig
    : null;
  const runGitImpl = typeof options.runGit === "function" ? options.runGit : null;
  const spawnImpl = typeof options.spawn === "function" ? options.spawn : spawn;
  const setTimeoutImpl = typeof options.setTimeout === "function" ? options.setTimeout : setTimeout;
  const clearTimeoutImpl = typeof options.clearTimeout === "function" ? options.clearTimeout : clearTimeout;
  const now = typeof options.now === "function" ? options.now : defaultNow;
  const logger = options.logger || console;
  const shutdown = typeof options.shutdown === "function" ? options.shutdown : () => {};

  let appUpdateStatus = null;
  let appUpdateCheckInFlight = null;
  let appUpdateApplying = false;
  let appUpdateRestartScheduled = false;
  let publicPullRequestStatus = null;
  let publicPullRequestCheckInFlight = null;
  const githubLinkPreviewCache = new Map();
  let publicReleaseStatus = null;
  let publicReleaseCheckInFlight = null;

  function checkedAtIso() {
    return new Date(now()).toISOString();
  }

  function appUpdateRemoteRef(remote = appUpdateRemote, branch = appUpdateBranch) {
    return `${assertSafeGitRemote(remote)}/${assertSafeGitBranch(branch)}`;
  }

  function appUpdateTrackingRef(remote = appUpdateRemote, branch = appUpdateBranch) {
    return `refs/remotes/${assertSafeGitRemote(remote)}/${assertSafeGitBranch(branch)}`;
  }

  function appUpdateFetchRefspec(remote = appUpdateRemote, branch = appUpdateBranch) {
    return `+refs/heads/${assertSafeGitBranch(branch)}:${appUpdateTrackingRef(remote, branch)}`;
  }

  async function runGit(args, runOptions = {}) {
    if (runGitImpl) return runGitImpl(args, runOptions);
    const timeoutMs = normalizePositiveNumber(runOptions.timeoutMs, appUpdateCheckTimeoutMs, 1000);
    return new Promise((resolve, reject) => {
      const child = spawnImpl("git", args, {
        cwd: appRoot,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let settled = false;
      let timedOut = false;
      const append = (current, chunk) => {
        const next = current + String(chunk || "");
        return next.length > 256000 ? next.slice(0, 256000) : next;
      };
      const finish = (fn, value) => {
        if (settled) return;
        settled = true;
        clearTimeoutImpl(timer);
        fn(value);
      };
      const timer = setTimeoutImpl(() => {
        timedOut = true;
        try {
          child.kill();
        } catch (_) {}
      }, timeoutMs);
      if (timer && typeof timer.unref === "function") timer.unref();
      child.stdout.on("data", (chunk) => {
        stdout = append(stdout, chunk);
      });
      child.stderr.on("data", (chunk) => {
        stderr = append(stderr, chunk);
      });
      child.on("error", (err) => {
        finish(reject, err);
      });
      child.on("close", (code, signal) => {
        if (code === 0 && !timedOut) {
          finish(resolve, {
            stdout,
            stderr,
            code,
            signal,
          });
          return;
        }
        const command = ["git", ...args].join(" ");
        const details = compactProcessOutput(stderr || stdout || signal || "");
        const err = new Error(timedOut
          ? `${command} timed out after ${timeoutMs}ms`
          : `${command} failed with exit code ${code ?? signal}${details ? `: ${details}` : ""}`);
        err.code = code;
        err.signal = signal;
        err.stdout = stdout;
        err.stderr = stderr;
        err.timedOut = timedOut;
        finish(reject, err);
      });
    });
  }

  async function tryGit(args, runOptions = {}) {
    try {
      return await runGit(args, runOptions);
    } catch (err) {
      return { error: err, stdout: err.stdout || "", stderr: err.stderr || "", code: err.code };
    }
  }

  function unsupportedAppUpdateStatus(reason, extra = {}) {
    return Object.assign({
      supported: false,
      enabled: !appUpdateDisabled,
      version: appVersion,
      checking: false,
      applying: appUpdateApplying,
      updateAvailable: false,
      canFastForward: false,
      checkedAt: checkedAtIso(),
      reason,
    }, extra);
  }

  function publicAppUpdateStatus(status, overrides = {}) {
    const value = status || unsupportedAppUpdateStatus("not checked");
    const publicValue = Object.assign({}, value);
    delete publicValue.checkedAtMs;
    const currentBuild = currentAppUpdateBuildIdentity();
    const currentBuildIssueCodes = Array.isArray(currentBuild.issueCodes) ? currentBuild.issueCodes.slice() : [];
    return Object.assign({}, publicValue, {
      version: appVersion,
      clientBuildId: currentBuild.clientBuildId,
      shellCacheName: currentBuild.shellCacheName,
      classicShellCacheName: currentBuild.classicShellCacheName,
      currentBuild,
      currentBuildIssueCodes,
      checking: Boolean(appUpdateCheckInFlight),
      applying: appUpdateApplying,
      restartScheduled: appUpdateRestartScheduled,
    }, overrides);
  }

  function currentAppUpdateBuildIdentity() {
    let config = {};
    const issueCodes = [];
    if (!hasCurrentPublicBuildConfigProvider) {
      issueCodes.push("app_update_current_build_provider_missing");
    } else {
      try {
        config = currentPublicBuildConfig() || {};
      } catch (_) {
        issueCodes.push("app_update_current_build_provider_error");
        config = {};
      }
    }
    const clientBuildId = String(config.clientBuildId || "").trim();
    const shellCacheName = String(config.shellCacheName || "").trim();
    const classicShellCacheName = String(config.classicShellCacheName || "").trim();
    if (!clientBuildId || !shellCacheName) {
      issueCodes.push("app_update_current_build_identity_empty");
    }
    return {
      buildId: String(config.buildId || "").trim(),
      clientBuildId,
      shellCacheName,
      classicShellCacheName,
      identity: clientBuildId || shellCacheName || String(config.buildId || "").trim(),
      ok: Boolean(clientBuildId && shellCacheName),
      issueCodes,
    };
  }

  async function readAppUpdateStatus(readOptions = {}) {
    const checkedAt = checkedAtIso();
    if (appUpdateDisabled) {
      return unsupportedAppUpdateStatus("disabled", { checkedAt });
    }
    let remote;
    let branch;
    try {
      remote = assertSafeGitRemote(appUpdateRemote);
      branch = assertSafeGitBranch(appUpdateBranch);
    } catch (err) {
      return unsupportedAppUpdateStatus(err.message, { checkedAt, error: safeAppUpdateError(err) });
    }

    const inside = await tryGit(["rev-parse", "--is-inside-work-tree"], { timeoutMs: appUpdateCheckTimeoutMs });
    if (inside.error || inside.stdout.trim() !== "true") {
      return unsupportedAppUpdateStatus("not a git worktree", {
        checkedAt,
        error: inside.error ? safeAppUpdateError(inside.error) : "",
      });
    }

    const base = {
      supported: true,
      enabled: true,
      version: appVersion,
      repository: appRoot,
      remote,
      branch,
      checkedAt,
      checking: false,
      applying: appUpdateApplying,
    };

    try {
      const currentBranch = (await runGit(["branch", "--show-current"], { timeoutMs: appUpdateCheckTimeoutMs })).stdout.trim();
      const remoteUrl = await tryGit(["remote", "get-url", remote], { timeoutMs: appUpdateCheckTimeoutMs });
      if (remoteUrl.error) {
        return Object.assign(base, {
          supported: false,
          reason: `remote ${remote} not configured`,
          error: safeAppUpdateError(remoteUrl.error),
          updateAvailable: false,
          canFastForward: false,
        });
      }

      if (readOptions.fetch) {
        await runGit(["fetch", "--quiet", "--prune", remote, appUpdateFetchRefspec(remote, branch)], { timeoutMs: appUpdateCheckTimeoutMs });
      }

      const remoteRef = appUpdateRemoteRef(remote, branch);
      const localCommit = (await runGit(["rev-parse", "HEAD"], { timeoutMs: appUpdateCheckTimeoutMs })).stdout.trim();
      const remoteCommit = (await runGit(["rev-parse", "--verify", `${remoteRef}^{commit}`], { timeoutMs: appUpdateCheckTimeoutMs })).stdout.trim();
      const dirtyOutput = (await runGit(["status", "--porcelain", "--untracked-files=all"], { timeoutMs: appUpdateCheckTimeoutMs })).stdout.trim();
      const counts = (await runGit(["rev-list", "--left-right", "--count", `HEAD...${remoteRef}`], { timeoutMs: appUpdateCheckTimeoutMs }))
        .stdout
        .trim()
        .split(/\s+/)
        .map((part) => Number(part));
      const ahead = Number.isFinite(counts[0]) ? counts[0] : 0;
      const behind = Number.isFinite(counts[1]) ? counts[1] : 0;
      const dirty = Boolean(dirtyOutput);
      const branchMismatch = currentBranch !== branch;
      const diverged = ahead > 0 && behind > 0;
      const updateAvailable = behind > 0;
      const canFastForward = updateAvailable && !dirty && !diverged && ahead === 0 && !branchMismatch;
      let state = "up-to-date";
      let reason = "";
      if (branchMismatch) {
        state = "blocked";
        reason = currentBranch
          ? `current branch is ${currentBranch}, expected ${branch}`
          : `current checkout is detached, expected branch ${branch}`;
      } else if (dirty) {
        state = "blocked";
        reason = "working tree has local changes";
      } else if (diverged || ahead > 0) {
        state = "blocked";
        reason = "local branch has commits that are not on the remote branch";
      } else if (updateAvailable) {
        state = "update-available";
        reason = "remote branch is ahead";
      }

      return Object.assign(base, {
        state,
        reason,
        currentBranch,
        remoteUrl: safeRemoteUrl(remoteUrl.stdout),
        remoteRef,
        localCommit,
        remoteCommit,
        localShort: shortCommit(localCommit),
        remoteShort: shortCommit(remoteCommit),
        ahead,
        behind,
        dirty,
        dirtyCount: dirtyOutput ? dirtyOutput.split(/\r?\n/).filter(Boolean).length : 0,
        branchMismatch,
        diverged,
        updateAvailable,
        canFastForward,
      });
    } catch (err) {
      return Object.assign(base, {
        state: "error",
        error: safeAppUpdateError(err),
        updateAvailable: false,
        canFastForward: false,
      });
    }
  }

  async function refreshAppUpdateStatus(refreshOptions = {}) {
    const currentTime = now();
    if (!refreshOptions.force && !refreshOptions.fetch && appUpdateStatus && appUpdateStatus.checkedAtMs && currentTime - appUpdateStatus.checkedAtMs < appUpdateCacheMs) {
      return publicAppUpdateStatus(appUpdateStatus);
    }
    if (appUpdateCheckInFlight) return appUpdateCheckInFlight;
    appUpdateCheckInFlight = readAppUpdateStatus(refreshOptions)
      .then((status) => {
        appUpdateStatus = Object.assign({}, status, { checkedAtMs: now() });
        return publicAppUpdateStatus(appUpdateStatus, { checking: false });
      })
      .finally(() => {
        appUpdateCheckInFlight = null;
      });
    return appUpdateCheckInFlight;
  }

  function publicPullRequestError(err) {
    return String(err && err.message || err || "").replace(/\s+/g, " ").slice(0, 240);
  }

  async function fetchJsonWithTimeout(url, fetchOptions = {}) {
    if (typeof fetchImpl !== "function") throw new Error("fetch is unavailable in this Node runtime");
    const timeoutMs = normalizePositiveNumber(fetchOptions.timeoutMs, publicPrCheckTimeoutMs, 1000);
    const errorLabel = String(fetchOptions.errorLabel || "GitHub request");
    const controller = new AbortController();
    const timer = setTimeoutImpl(() => controller.abort(), timeoutMs);
    if (timer && typeof timer.unref === "function") timer.unref();
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "codex-mobile-web",
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`${errorLabel} failed with HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      clearTimeoutImpl(timer);
    }
  }

  function githubLinkPreviewError(err) {
    return String(err && err.message || err || "").replace(/\s+/g, " ").slice(0, 240);
  }

  function unsupportedGitHubLinkPreview(url, reason, extra = {}) {
    return Object.assign({
      supported: false,
      provider: "github",
      url: String(url || ""),
      checkedAt: checkedAtIso(),
      reason: String(reason || "unsupported"),
      preview: null,
    }, extra);
  }

  function githubLinkPreviewForClient(status) {
    const value = Object.assign({}, status || unsupportedGitHubLinkPreview("", "not checked"));
    delete value.checkedAtMs;
    delete value.promise;
    return value;
  }

  async function readGitHubLinkPreview(url) {
    const target = parseGitHubUrl(url);
    if (!target) return unsupportedGitHubLinkPreview(url, "unsupported GitHub URL");
    try {
      const payload = await fetchJsonWithTimeout(githubPreviewApiUrl(target), {
        timeoutMs: githubLinkPreviewTimeoutMs,
        errorLabel: "GitHub link preview",
      });
      const preview = normalizeGitHubPreview(target, payload);
      if (!preview) return unsupportedGitHubLinkPreview(target.canonicalUrl, "unsupported GitHub resource");
      return {
        supported: true,
        provider: "github",
        url: target.canonicalUrl,
        checkedAt: checkedAtIso(),
        preview,
      };
    } catch (err) {
      return unsupportedGitHubLinkPreview(target.canonicalUrl, githubLinkPreviewError(err), {
        supported: true,
        error: githubLinkPreviewError(err),
      });
    }
  }

  async function refreshGitHubLinkPreview(url, refreshOptions = {}) {
    const target = parseGitHubUrl(url);
    if (!target) return githubLinkPreviewForClient(unsupportedGitHubLinkPreview(url, "unsupported GitHub URL"));
    const cacheKey = target.canonicalUrl;
    const currentTime = now();
    const cached = githubLinkPreviewCache.get(cacheKey);
    if (!refreshOptions.force && cached && !cached.promise && cached.checkedAtMs && currentTime - cached.checkedAtMs < githubLinkPreviewCacheMs) {
      return githubLinkPreviewForClient(cached);
    }
    if (cached && cached.promise) return cached.promise;
    const promise = readGitHubLinkPreview(cacheKey)
      .then((status) => {
        const next = Object.assign({}, status, { checkedAtMs: now() });
        githubLinkPreviewCache.set(cacheKey, next);
        return githubLinkPreviewForClient(next);
      })
      .finally(() => {
        const current = githubLinkPreviewCache.get(cacheKey);
        if (current && current.promise === promise) githubLinkPreviewCache.delete(cacheKey);
      });
    githubLinkPreviewCache.set(cacheKey, { promise, checkedAtMs: currentTime });
    return promise;
  }

  function unsupportedPublicPullRequestStatus(reason, extra = {}) {
    return Object.assign({
      supported: false,
      enabled: !publicPrCheckDisabled,
      repository: publicPrRepository,
      checkedAt: checkedAtIso(),
      openPullRequestCount: 0,
      hasOpenPullRequests: false,
      pullRequests: [],
      reason,
    }, extra);
  }

  function unsupportedPublicReleaseStatus(reason, extra = {}) {
    return Object.assign({
      supported: false,
      enabled: !publicReleaseCheckDisabled,
      repository: publicReleaseRepository,
      branch: publicReleaseBranch,
      checkedAt: checkedAtIso(),
      updateAvailable: false,
      canUpdateThroughCurrentCheckout: false,
      currentCheckoutUsesPublicRelease: false,
      reason,
    }, extra);
  }

  function publicPullRequestStatusForClient(status, overrides = {}) {
    const value = status || unsupportedPublicPullRequestStatus("not checked");
    const publicValue = Object.assign({}, value);
    delete publicValue.checkedAtMs;
    return Object.assign({}, publicValue, {
      checking: Boolean(publicPullRequestCheckInFlight),
    }, overrides);
  }

  async function readPublicPullRequestStatus() {
    if (publicPrCheckDisabled) {
      return unsupportedPublicPullRequestStatus("disabled");
    }
    try {
      const pullRequests = await fetchJsonWithTimeout(publicPullRequestApiUrl(publicPrRepository), {
        timeoutMs: publicPrCheckTimeoutMs,
      });
      return buildPublicPullRequestStatus({
        repository: publicPrRepository,
        pullRequests,
        checkedAt: checkedAtIso(),
      });
    } catch (err) {
      return unsupportedPublicPullRequestStatus(publicPullRequestError(err), {
        supported: true,
        error: publicPullRequestError(err),
      });
    }
  }

  async function refreshPublicPullRequestStatus(refreshOptions = {}) {
    const currentTime = now();
    if (!refreshOptions.force && publicPullRequestStatus && publicPullRequestStatus.checkedAtMs
      && currentTime - publicPullRequestStatus.checkedAtMs < publicPrCheckCacheMs) {
      return publicPullRequestStatusForClient(publicPullRequestStatus);
    }
    if (publicPullRequestCheckInFlight) return publicPullRequestCheckInFlight;
    publicPullRequestCheckInFlight = readPublicPullRequestStatus()
      .then((status) => {
        publicPullRequestStatus = Object.assign({}, status, { checkedAtMs: now() });
        return publicPullRequestStatusForClient(publicPullRequestStatus, { checking: false });
      })
      .finally(() => {
        publicPullRequestCheckInFlight = null;
      });
    return publicPullRequestCheckInFlight;
  }

  function publicReleaseStatusForClient(status, overrides = {}) {
    const value = status || unsupportedPublicReleaseStatus("not checked");
    const publicValue = Object.assign({}, value);
    delete publicValue.checkedAtMs;
    return Object.assign({}, publicValue, {
      checking: Boolean(publicReleaseCheckInFlight),
    }, overrides);
  }

  async function readPublicReleaseStatus() {
    if (publicReleaseCheckDisabled) {
      return unsupportedPublicReleaseStatus("disabled");
    }
    let branch;
    try {
      branch = assertSafeGitBranch(publicReleaseBranch, "public release branch");
    } catch (err) {
      return unsupportedPublicReleaseStatus(err.message, { error: safeAppUpdateError(err) });
    }
    try {
      const commit = await fetchJsonWithTimeout(publicRepositoryCommitApiUrl(publicReleaseRepository, branch), {
        timeoutMs: publicPrCheckTimeoutMs,
      });
      const publicCommit = String(commit && commit.sha || "").trim();
      const local = await tryGit(["rev-parse", "HEAD"], { timeoutMs: appUpdateCheckTimeoutMs });
      const localCommit = local.error ? "" : local.stdout.trim();
      const remoteUrl = await tryGit(["remote", "get-url", appUpdateRemote], { timeoutMs: appUpdateCheckTimeoutMs });
      const currentRemoteUrl = remoteUrl.error ? "" : safeRemoteUrl(remoteUrl.stdout);
      const currentCheckoutUsesPublicRelease = remoteUrlLooksLikeRepository(currentRemoteUrl, publicReleaseRepository);
      return {
        supported: true,
        enabled: true,
        repository: publicReleaseRepository,
        branch,
        checkedAt: checkedAtIso(),
        localCommit,
        localShort: shortCommit(localCommit),
        publicCommit,
        publicShort: shortCommit(publicCommit),
        publicHtmlUrl: String(commit && commit.html_url || ""),
        publicCommittedAt: String(commit && commit.commit && commit.commit.committer && commit.commit.committer.date || ""),
        publicMessage: String(commit && commit.commit && commit.commit.message || "").split(/\r?\n/)[0].slice(0, 240),
        currentRemote: appUpdateRemote,
        currentRemoteUrl,
        currentCheckoutUsesPublicRelease,
        updateAvailable: Boolean(localCommit && publicCommit && localCommit !== publicCommit),
        canUpdateThroughCurrentCheckout: currentCheckoutUsesPublicRelease,
        reason: currentCheckoutUsesPublicRelease
          ? "current checkout tracks public release"
          : "current checkout does not track the public release repository",
      };
    } catch (err) {
      return unsupportedPublicReleaseStatus(publicPullRequestError(err), {
        supported: true,
        error: publicPullRequestError(err),
      });
    }
  }

  async function refreshPublicReleaseStatus(refreshOptions = {}) {
    const currentTime = now();
    if (!refreshOptions.force && publicReleaseStatus && publicReleaseStatus.checkedAtMs
      && currentTime - publicReleaseStatus.checkedAtMs < publicReleaseCheckCacheMs) {
      return publicReleaseStatusForClient(publicReleaseStatus);
    }
    if (publicReleaseCheckInFlight) return publicReleaseCheckInFlight;
    publicReleaseCheckInFlight = readPublicReleaseStatus()
      .then((status) => {
        publicReleaseStatus = Object.assign({}, status, { checkedAtMs: now() });
        return publicReleaseStatusForClient(publicReleaseStatus, { checking: false });
      })
      .finally(() => {
        publicReleaseCheckInFlight = null;
      });
    return publicReleaseCheckInFlight;
  }

  async function applyAppUpdate() {
    if (appUpdateApplying) throw makeStatusError(409, "App update is already in progress");
    appUpdateApplying = true;
    try {
      const before = await refreshAppUpdateStatus({ fetch: true, force: true });
      if (!before.supported) throw makeStatusError(400, before.reason || before.error || "App update is not supported for this checkout");
      if (before.error) throw makeStatusError(502, before.error);
      if (before.branchMismatch) throw makeStatusError(409, before.reason || "Current branch does not match update branch");
      if (before.dirty) throw makeStatusError(409, "Working tree has local changes; commit or discard them before updating");
      if (before.diverged || Number(before.ahead || 0) > 0) {
        throw makeStatusError(409, "Local branch is ahead or diverged; automatic fast-forward update was refused");
      }
      if (!before.updateAvailable) {
        return { ok: true, updated: false, status: before };
      }
      if (!before.canFastForward) {
        throw makeStatusError(409, before.reason || "Remote update cannot be applied as a clean fast-forward");
      }
      await runGit(["merge", "--ff-only", before.remoteRef || appUpdateRemoteRef(before.remote, before.branch)], { timeoutMs: appUpdateApplyTimeoutMs });
      const after = await refreshAppUpdateStatus({ force: true });
      return {
        ok: true,
        updated: true,
        restartInMs: appUpdateRestartDelayMs,
        before,
        after,
      };
    } finally {
      appUpdateApplying = false;
    }
  }

  function scheduleAppRestart(reason) {
    if (appUpdateRestartScheduled) return;
    appUpdateRestartScheduled = true;
    logger.log(`[app-update] restart scheduled: ${reason || "update applied"}`);
    const timer = setTimeoutImpl(() => {
      shutdown();
    }, appUpdateRestartDelayMs);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  function scheduleStartupAppUpdateCheck() {
    if (appUpdateDisabled) return;
    const timer = setTimeoutImpl(() => {
      refreshAppUpdateStatus({ fetch: true, force: true }).catch((err) => {
        logger.error(`[app-update] startup check failed: ${safeAppUpdateError(err)}`);
      });
    }, 1500);
    if (timer && typeof timer.unref === "function") timer.unref();
  }

  return {
    applyAppUpdate,
    refreshAppUpdateStatus,
    refreshGitHubLinkPreview,
    refreshPublicPullRequestStatus,
    refreshPublicReleaseStatus,
    safeAppUpdateError,
    scheduleAppRestart,
    scheduleStartupAppUpdateCheck,
  };
}

module.exports = {
  assertSafeGitBranch,
  assertSafeGitRemote,
  assertSafeGitValue,
  createAppMaintenanceService,
  maskRemoteCredentials,
  publicRepositoryCommitApiUrl,
  remoteUrlLooksLikeRepository,
  safeAppUpdateError,
  safeRemoteUrl,
  shortCommit,
};
