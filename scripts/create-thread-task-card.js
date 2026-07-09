#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function usage() {
  return [
    "Usage:",
    "  node scripts/create-thread-task-card.js --source-thread <id> --target-thread <id> --title <title> --body-file <file>",
    "  node scripts/create-thread-task-card.js --json-file <request.json>",
    "",
    "Options:",
    "  --server <url>             Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>          Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --source-thread <id>       Source thread id; used in /api/threads/:id/task-cards",
    "  --target-thread <id>       Current visible target thread id or exact title. Repeat or comma-separate for multiple targets.",
    "  --target-threads <ids>     Comma-separated current visible target thread ids or exact titles.",
    "  --reply-to-thread <id>     Optional terminal-return target thread id for multi-hop supplements.",
    "  --reply-to-workspace <cwd> Optional workspace/cwd for --reply-to-thread.",
    "  --reply-to-title <title>   Optional display title for --reply-to-thread.",
    "  --reply-to-card <id>       Optional originating task-card id this supplement is related to.",
    "  --title <text>             Task-card title.",
    "  --summary <text>           Optional summary.",
    "  --body <text>              Body markdown. Prefer --body-file for long text.",
    "  --body-file <path>         Body markdown file. Use '-' for stdin.",
    "  --secret-ref <sec_...>     Home AI short-lived secretRef for current-task sensitive context; never pass plaintext secrets here.",
    "  --request-id <id>          Stable idempotency seed for retries.",
    "  --idempotency-key <key>    Explicit task-card idempotency key.",
    "  --workflow-mode <mode>     manual or autonomous.",
    "  --workflow-id <id>         Optional workflow id.",
    "  --reasoning-effort <value> Optional target turn reasoning effort: low, medium, high, or xhigh.",
    "  --card-kind <value>        Optional bounded task-card kind, e.g. plugin_deployment.",
    "  --plugin-id <id>           Optional Home AI plugin id for deployment lane routing.",
    "  --category <value>         Optional bounded task-card category.",
    "  --pending                  Create a normal pending card instead of requesting source-thread direct approval.",
    "  --auto-approve <bool>      Request direct auto-approval on the thread-callable route.",
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

function parseBoolean(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text || ["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  throw new Error(`invalid boolean: ${value}`);
}

function splitTargets(value) {
  return String(value || "")
    .split(/[,\n;，；]+/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pushTargets(targets, value) {
  for (const target of splitTargets(value)) {
    if (!targets.includes(target)) targets.push(target);
  }
}

function parseArgs(argv) {
  const options = {
    server: process.env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    keyFile: process.env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    request: {},
    targets: [],
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
    } else if (arg === "--source-thread") {
      options.sourceThreadId = next();
    } else if (arg === "--target-thread") {
      pushTargets(options.targets, next());
    } else if (arg === "--target-threads") {
      pushTargets(options.targets, next());
    } else if (arg === "--reply-to-thread" || arg === "--reply-to-thread-id") {
      options.request.replyToThreadId = next();
    } else if (arg === "--reply-to-workspace" || arg === "--reply-to-workspace-id") {
      options.request.replyToWorkspaceId = next();
    } else if (arg === "--reply-to-title" || arg === "--reply-to-thread-title") {
      options.request.replyToThreadTitle = next();
    } else if (arg === "--reply-to-card" || arg === "--reply-to-card-id") {
      options.request.replyToCardId = next();
    } else if (arg === "--title") {
      options.request.title = next();
    } else if (arg === "--summary") {
      options.request.summary = next();
    } else if (arg === "--body") {
      options.request.body = next();
    } else if (arg === "--body-file") {
      options.bodyFile = next();
    } else if (arg === "--secret-ref" || arg === "--secret-ref-id") {
      if (!Array.isArray(options.request.secretRefs)) options.request.secretRefs = [];
      options.request.secretRefs.push(next());
    } else if (arg === "--request-id") {
      options.request.requestId = next();
    } else if (arg === "--idempotency-key") {
      options.request.idempotencyKey = next();
    } else if (arg === "--workflow-mode") {
      options.request.workflowMode = next();
    } else if (arg === "--workflow-id") {
      options.request.workflowId = next();
    } else if (arg === "--reasoning-effort" || arg === "--reasoning_effort") {
      options.request.reasoningEffort = next();
    } else if (arg === "--card-kind" || arg === "--card_kind" || arg === "--task-card-kind") {
      options.request.cardKind = next();
    } else if (arg === "--plugin-id" || arg === "--plugin_id") {
      options.request.pluginId = next();
    } else if (arg === "--category") {
      options.request.category = next();
    } else if (arg === "--pending") {
      options.request.pending = true;
      options.request.autoApprove = false;
    } else if (arg === "--auto-approve") {
      options.request.autoApprove = parseBoolean(next());
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

function readRequest(options) {
  let request = {};
  if (options.jsonFile) {
    const raw = readTextFile(options.jsonFile).trim();
    request = raw ? JSON.parse(raw) : {};
  }
  request = Object.assign({}, request, options.request);
  if (options.sourceThreadId) request.sourceThreadId = options.sourceThreadId;
  if (options.targets.length) request.targetThreadIds = options.targets;
  if (options.bodyFile) request.body = readTextFile(options.bodyFile).trim();
  return request;
}

function readAccessKey(file) {
  const inline = String(process.env.CODEX_MOBILE_KEY || process.env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(file, "utf8").trim();
  if (!key) throw new Error("access key file is empty");
  return key;
}

function sourceThreadIdFromRequest(request) {
  const id = String(request.sourceThreadId || request.threadId || "").trim();
  if (!id) throw new Error("sourceThreadId is required");
  return id;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const request = readRequest(options);
  const sourceThreadId = sourceThreadIdFromRequest(request);
  delete request.threadId;
  const key = readAccessKey(options.keyFile);
  const base = String(options.server || "").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/threads/${encodeURIComponent(sourceThreadId)}/task-cards`, {
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
