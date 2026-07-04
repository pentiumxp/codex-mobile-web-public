#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function usage() {
  return [
    "Usage:",
    "  node scripts/record-at-loop-requirements.js --loop <loop-id> --role-slice <role-slice-id> --status completed --body-file <file>",
    "",
    "Options:",
    "  --server <url>        Codex Mobile server. Default: http://127.0.0.1:8787",
    "  --key-file <path>     Access key file. Default: $HOME/.codex-mobile-web/access_key",
    "  --loop <id>           Loop id.",
    "  --role-slice <id>     Requirements role slice id.",
    "  --status <value>      completed or blocked.",
    "  --summary <text>      Optional bounded summary.",
    "  --body-file <path>    Requirements/design packet Markdown file. Use '-' for stdin.",
    "  --help                Show this help.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    server: process.env.CODEX_MOBILE_BASE_URL || "http://127.0.0.1:8787",
    keyFile: process.env.CODEX_MOBILE_KEY_FILE || path.join(os.homedir(), ".codex-mobile-web", "access_key"),
    status: "completed",
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
    } else if (arg === "--loop" || arg === "--loop-id") {
      options.loopId = next();
    } else if (arg === "--role-slice" || arg === "--role-slice-id") {
      options.roleSliceId = next();
    } else if (arg === "--status") {
      options.status = next();
    } else if (arg === "--summary") {
      options.summary = next();
    } else if (arg === "--body-file") {
      options.bodyFile = next();
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return options;
}

function readTextFile(file) {
  const target = String(file || "").trim();
  if (!target) throw new Error("body-file is required");
  if (target === "-") return fs.readFileSync(0, "utf8");
  return fs.readFileSync(target, "utf8");
}

function readAccessKey(file) {
  const inline = String(process.env.CODEX_MOBILE_KEY || process.env.CODEX_MOBILE_ACCESS_KEY || "").trim();
  if (inline) return inline;
  const key = fs.readFileSync(file, "utf8").trim();
  if (!key) throw new Error("access key file is empty");
  return key;
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (!["completed", "blocked"].includes(status)) throw new Error("status_invalid");
  return status;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  const loopId = String(options.loopId || "").trim();
  const roleSliceId = String(options.roleSliceId || "").trim();
  if (!loopId) throw new Error("loop id is required");
  if (!roleSliceId) throw new Error("role slice id is required");
  const status = normalizeStatus(options.status);
  const returnBody = readTextFile(options.bodyFile).trim();
  if (!returnBody) throw new Error("body file is empty");
  const key = readAccessKey(options.keyFile);
  const base = String(options.server || "").replace(/\/+$/, "");
  const response = await fetch(`${base}/api/at-loop/returns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      loopId,
      roleSliceId,
      role: "requirements",
      status,
      summary: String(options.summary || (status === "completed" ? "source requirements complete" : "source requirements blocked")).trim(),
      returnBody,
    }),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (_) {
    data = { ok: false, error: text || `HTTP ${response.status}` };
  }
  const loop = data && data.loop || {};
  const safe = {
    ok: response.ok && data.ok !== false,
    loopId: loop.loopId || loopId,
    status: loop.status || "",
    currentRole: loop.currentRole || "",
    nextRoute: loop.nextRoute || "",
    readyForImplementation: Boolean(loop.sourceRequirementsStatus && loop.sourceRequirementsStatus.readyForImplementation),
    implementationThreadId: loop.implementationThreadId || "",
    auditThreadId: loop.auditThreadId || "",
  };
  if (data && data.error) safe.error = data.error;
  if (data && data.message) safe.message = data.message;
  process.stdout.write(`${JSON.stringify(safe, null, 2)}\n`);
  if (!response.ok || data.ok === false) process.exitCode = 1;
}

main().catch((err) => {
  process.stderr.write(`${err && err.message ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
