"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const DEFAULT_THREAD_NAME = "ChatGPT Pro";
const DEFAULT_OUTPUT_DIR_NAME = "chatgpt-pro";
const MAX_PROMPT_CHARS = 120000;
const MAX_CONTEXT_CHARS = 40000;

function compactText(value, maxChars = 4000) {
  const text = String(value || "").trim();
  if (text.length <= maxChars) return text;
  const half = Math.max(1, Math.floor(maxChars / 2));
  return `${text.slice(0, half)}\n\n[truncated ${text.length} chars]\n\n${text.slice(-half)}`;
}

function chatGptProMentionPattern() {
  return /(?:^|\s)@(?:ChatGPT\s+Pro|ChatGPTPro|GPT\s+Pro)\b/i;
}

function isChatGptProRequestText(value) {
  return chatGptProMentionPattern().test(String(value || ""));
}

function stripChatGptProMention(value) {
  return String(value || "").replace(chatGptProMentionPattern(), " ").replace(/\s+/g, " ").trim();
}

function readJsonFile(filePath) {
  if (!filePath) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_) {
    return {};
  }
}

function writeJsonFile(filePath, value) {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function defaultStateFile(runtimeRoot) {
  return path.join(runtimeRoot || process.cwd(), "chatgpt-pro-bridge-state.json");
}

function defaultOutputDir(runtimeRoot) {
  return path.join(runtimeRoot || process.cwd(), "outputs", DEFAULT_OUTPUT_DIR_NAME);
}

function buildChatGptProPrompt(payload = {}) {
  const title = compactText(payload.title || "ChatGPT Pro analysis", 300);
  const request = compactText(payload.prompt || "", MAX_PROMPT_CHARS);
  const sourceSummary = compactText(payload.sourceSummary || payload.source_summary || "", MAX_CONTEXT_CHARS);
  const outputDir = compactText(payload.outputDir || payload.output_dir || "", 500);
  const language = compactText(payload.language || "zh-CN", 40);
  const outputFormat = compactText(payload.outputFormat || payload.output_format || "markdown", 80);
  return [
    "You are the Codex Mobile standalone ChatGPT Pro bridge thread.",
    "",
    "Execution boundary:",
    "- You must use the Chrome plugin / Chrome skill to access the already logged-in ChatGPT page and let ChatGPT Pro perform the requested analysis or generation.",
    "- Do not impersonate ChatGPT Pro output with your ordinary model response.",
    "- If Chrome, the ChatGPT page, or ChatGPT Pro is unavailable, report the failure reason directly. Do not fall back to another model and present it as ChatGPT Pro output.",
    "- Do not read, copy, or expose browser cookies, tokens, passwords, local secret keys, or raw credentials.",
    "- Treat the source context below as bounded context only. Do not request or upload unrelated repository files, private logs, or secrets.",
    outputDir ? `- Write generated Markdown/DOCX/PDF artifacts only under this temporary output directory: ${outputDir}` : "",
    "- Do not create generated files under the source checkout or a repository-level outputs/ directory.",
    "",
    `Title: ${title}`,
    `Output language: ${language}`,
    `Output format: ${outputFormat}`,
    "",
    "User request:",
    request || "(empty request)",
    "",
    sourceSummary ? `Bounded source context:\n${sourceSummary}` : "",
    "",
    "Final answer requirements:",
    "- Answer in Chinese unless the requested artifact explicitly uses another language.",
    "- State whether ChatGPT Pro generation completed.",
    "- If a file was generated, list the absolute file path.",
  ].filter(Boolean).join("\n");
}

function publicJob(job = {}) {
  return {
    id: String(job.id || ""),
    status: String(job.status || "queued"),
    sourceThreadId: String(job.sourceThreadId || ""),
    proThreadId: String(job.proThreadId || ""),
    title: String(job.title || ""),
    message: String(job.message || ""),
    error: String(job.error || ""),
    createdAt: Number(job.createdAt || 0),
    updatedAt: Number(job.updatedAt || 0),
  };
}

function createChatGptProBridgeService(options = {}) {
  const runtimeRoot = options.runtimeRoot || process.cwd();
  const stateFile = options.stateFile || defaultStateFile(runtimeRoot);
  const outputDir = options.outputDir || defaultOutputDir(runtimeRoot);
  const threadName = options.threadName || DEFAULT_THREAD_NAME;
  const now = options.now || (() => Date.now());
  const createThread = options.createThread;
  const startTurn = options.startTurn;
  const updateThreadTitle = options.updateThreadTitle || (async () => false);
  const persistThreadTitle = options.persistThreadTitle || (() => false);
  const rememberThread = options.rememberThread || (() => {});
  const enabled = options.enabled !== false;

  function readState() {
    const state = readJsonFile(stateFile);
    if (!state || typeof state !== "object" || Array.isArray(state)) return {};
    return state;
  }

  function saveState(state) {
    writeJsonFile(stateFile, state && typeof state === "object" ? state : {});
  }

  function ensureEnabled() {
    if (!enabled) {
      const err = new Error("ChatGPT Pro bridge is disabled");
      err.statusCode = 409;
      throw err;
    }
  }

  async function ensureThread(input = {}) {
    const state = readState();
    const existingThreadId = String(state.threadId || "").trim();
    if (existingThreadId) return existingThreadId;
    if (typeof createThread !== "function") throw new Error("chatgpt_pro_create_thread_unavailable");
    const created = await createThread({
      cwd: input.cwd || "",
      title: threadName,
      outputDir,
    });
    const threadId = String(created && (created.threadId || created.id || created.thread && created.thread.id) || "").trim();
    if (!threadId) throw new Error("ChatGPT Pro thread creation failed");
    state.threadId = threadId;
    state.threadName = threadName;
    state.updatedAt = now();
    saveState(state);
    persistThreadTitle(threadId, threadName);
    await updateThreadTitle(threadId, threadName).catch(() => false);
    rememberThread(Object.assign({}, created.thread || {}, {
      id: threadId,
      name: threadName,
      preview: threadName,
      cwd: input.cwd || "",
      status: { type: "notLoaded" },
    }));
    return threadId;
  }

  function rememberJob(job) {
    const state = readState();
    const jobs = Array.isArray(state.jobs) ? state.jobs : [];
    const nextJobs = [job].concat(jobs.filter((item) => String(item && item.id || "") !== job.id)).slice(0, 50);
    state.jobs = nextJobs;
    state.threadId = job.proThreadId || state.threadId || "";
    state.updatedAt = now();
    saveState(state);
    return job;
  }

  async function start(payload = {}) {
    ensureEnabled();
    if (typeof startTurn !== "function") throw new Error("chatgpt_pro_start_turn_unavailable");
    const sourcePrompt = stripChatGptProMention(payload.prompt || payload.text || "");
    const title = compactText(payload.title || sourcePrompt || "ChatGPT Pro analysis", 160);
    const proThreadId = await ensureThread({ cwd: payload.cwd || "" });
    fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
    const prompt = buildChatGptProPrompt({
      title,
      prompt: sourcePrompt,
      sourceSummary: payload.sourceSummary || "",
      outputDir,
      language: payload.language || "zh-CN",
      outputFormat: payload.outputFormat || "markdown",
    });
    const job = {
      id: `chatgpt-pro-${now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`,
      status: "submitted",
      sourceThreadId: String(payload.sourceThreadId || ""),
      proThreadId,
      title,
      message: "ChatGPT Pro analysis submitted to the dedicated thread.",
      createdAt: now(),
      updatedAt: now(),
    };
    try {
      const turn = await startTurn({
        threadId: proThreadId,
        cwd: payload.cwd || "",
        input: [{ type: "text", text: prompt, text_elements: [] }],
      });
      job.turnId = String(turn && (turn.turnId || turn.id || turn.turn && turn.turn.id) || "");
      return { ok: true, job: publicJob(rememberJob(job)), proThreadId, turn };
    } catch (err) {
      job.status = "failed";
      job.error = err.message || String(err);
      rememberJob(job);
      throw err;
    }
  }

  function status() {
    const state = readState();
    return {
      ok: true,
      enabled,
      mode: "standalone",
      threadName,
      threadId: String(state.threadId || ""),
      outputDir,
      jobs: (Array.isArray(state.jobs) ? state.jobs : []).slice(0, 10).map(publicJob),
    };
  }

  return {
    isRequestText: isChatGptProRequestText,
    stripMention: stripChatGptProMention,
    buildPrompt: buildChatGptProPrompt,
    start,
    status,
  };
}

module.exports = {
  DEFAULT_THREAD_NAME,
  buildChatGptProPrompt,
  createChatGptProBridgeService,
  isChatGptProRequestText,
  stripChatGptProMention,
};
