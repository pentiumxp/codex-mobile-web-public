#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function usage() {
  return [
    "Usage:",
    "  node scripts/return-thread-task-card.js --task-card <id> --thread <target-thread-id> --title <title> --body-file <file>",
    "  node scripts/return-thread-task-card.js --json-file <request.json>",
    "",
    "Options:",
    "  --server <url>             Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>          Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --task-card <id>           Original task-card id being returned.",
    "  --thread <id>              Current target thread id; used as reply actor.",
    "  --status <value>           completed, blocked, redirected, rejected, or partially_completed.",
    "  --title <text>             Return-card title.",
    "  --summary <text>           Optional summary.",
    "  --body <text>              Body markdown. Prefer --body-file for long text.",
    "  --body-file <path>         Body markdown file. Use '-' for stdin.",
    "  --request-id <id>          Stable idempotency seed for retries.",
    "  --idempotency-key <key>    Explicit reply idempotency key.",
    "  --json-file <path>         Read request JSON from file. Use '-' for stdin.",
    "  --help                     Show this help.",
  ].join("\n");
}

function readTextFile(file) {
  const target = String(file || "").trim();
  if (!target) return "";
  if (target === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(target, "utf8");
}

function stableTextHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 24);
}

function parseArgs(argv) {
  const options = {
    server: process.env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    keyFile: process.env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    request: {},
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${arg}`);
      return argv[index];
    };
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--server") {
      options.server = next();
    } else if (arg === "--key-file") {
      options.keyFile = next();
    } else if (arg === "--json-file") {
      options.jsonFile = next();
    } else if (arg === "--task-card" || arg === "--task-card-id") {
      options.taskCardId = next();
    } else if (arg === "--thread" || arg === "--thread-id") {
      options.request.threadId = next();
    } else if (arg === "--status") {
      options.request.status = next();
    } else if (arg === "--title") {
      options.request.title = next();
    } else if (arg === "--summary") {
      options.request.summary = next();
    } else if (arg === "--body") {
      options.request.body = next();
    } else if (arg === "--body-file") {
      options.bodyFile = next();
    } else if (arg === "--request-id") {
      options.request.requestId = next();
    } else if (arg === "--idempotency-key") {
      options.request.idempotencyKey = next();
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

function normalizeStatus(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (!["completed", "blocked", "redirected", "rejected", "partially_completed"].includes(text)) throw new Error("status_invalid");
  return text;
}

function readRequest(options) {
  let request = {};
  if (options.jsonFile) {
    const raw = readTextFile(options.jsonFile).trim();
    request = raw ? JSON.parse(raw) : {};
  }
  request = Object.assign({}, request, options.request);
  const taskCardId = String(options.taskCardId || request.taskCardId || request.cardId || "").trim();
  if (!taskCardId) throw new Error("taskCardId is required");
  if (options.bodyFile) request.body = readTextFile(options.bodyFile).trim();
  const threadId = String(request.threadId || request.actorThreadId || "").trim();
  if (!threadId) throw new Error("threadId is required");
  const status = normalizeStatus(request.status);
  if (status && !String(request.summary || "").trim()) request.summary = status;
  if (status && !/^Return:/i.test(String(request.title || ""))) {
    request.title = `Return: ${request.title || status}`;
  }
  if (!String(request.idempotencyKey || "").trim()) {
    const seed = request.requestId || JSON.stringify({
      taskCardId,
      threadId,
      status,
      title: String(request.title || "").trim(),
      body: String(request.body || request.bodyMarkdown || "").trim(),
    });
    request.idempotencyKey = `task-card-return:${stableTextHash(`${taskCardId}|${threadId}`)}:${stableTextHash(seed)}`;
  }
  request.threadId = threadId;
  request.returnToSource = true;
  request.format = request.format || "markdown";
  if (!request.body && request.bodyMarkdown) request.body = request.bodyMarkdown;
  return { taskCardId, request };
}

function readAccessKey(file) {
  const inline = String(process.env.CODEX_MOBILE_KEY || process.env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(file, "utf8").trim();
  if (!key) throw new Error("access key file is empty");
  return key;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const { taskCardId, request } = readRequest(options);
  const key = readAccessKey(options.keyFile);
  const base = String(options.server || "").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/thread-task-cards/${encodeURIComponent(taskCardId)}/reply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify(request),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { ok: false, error: text || `HTTP ${response.status}` };
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
  if (!response.ok || data.ok === false) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
