"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function usage() {
  return [
    "Usage:",
    "  node scripts/repair-terminal-return-task-cards.js --dry-run [--store-file <path>] [--thread-id <id>] [--json]",
    "  node scripts/repair-terminal-return-task-cards.js --apply --store-file <path> [--thread-id <id>] [--json]",
  ].join("\n");
}

function text(value) {
  return String(value || "").trim();
}

function defaultStoreFile(env = process.env) {
  return text(env.CODEX_MOBILE_THREAD_TASK_CARD_FILE)
    || path.join(os.homedir(), ".codex-mobile-web", "thread-task-cards.json");
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    apply: false,
    dryRun: true,
    json: false,
    storeFile: defaultStoreFile(env),
    threadId: "",
    backupDir: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--apply") {
      options.apply = true;
      options.dryRun = false;
    } else if (arg === "--dry-run") {
      options.apply = false;
      options.dryRun = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--store-file") {
      index += 1;
      options.storeFile = text(argv[index]);
    } else if (arg === "--thread-id") {
      index += 1;
      options.threadId = text(argv[index]);
    } else if (arg === "--backup-dir") {
      index += 1;
      options.backupDir = text(argv[index]);
    } else {
      throw new Error(`unknown_arg:${arg}`);
    }
  }
  if (!options.storeFile) throw new Error("store_file_required");
  return options;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function statusText(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return text(value.type || value.status || value.state);
  return text(value);
}

function isLiveStatus(value) {
  return /^(active|running|started|pending|queued|processing|inprogress|in_progress|in-progress)$/i
    .test(statusText(value).replace(/\s+/g, "-"));
}

function isTerminalReturnReceipt(card = {}) {
  const delivery = card && card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card && card.audit && typeof card.audit === "object" ? card.audit : {};
  const terminal = delivery.terminal === true
    || audit.terminal === true
    || delivery.returnToSource === true
    || audit.returnToSource === true
    || delivery.ackPolicy === "none"
    || audit.ackPolicy === "none";
  if (!terminal) return false;
  const noReturn = delivery.requiresReturn === false
    || audit.requiresReturn === false
    || delivery.terminal === true
    || audit.terminal === true;
  if (!noReturn) return false;
  return Boolean(
    text(audit.replyToCardId)
    || text(audit.autoReturnToCardId)
    || delivery.returnToSource === true
    || audit.returnToSource === true,
  );
}

function injectionTurnStatus(card = {}) {
  const result = card.injectionResult && typeof card.injectionResult === "object" ? card.injectionResult : {};
  const turn = result.turn && typeof result.turn === "object" ? result.turn : {};
  return statusText(turn.status || turn.state || result.status);
}

function terminalReturnReceiptNeedsRepair(card = {}, options = {}) {
  if (!isTerminalReturnReceipt(card)) return false;
  const threadId = text(options.threadId);
  if (threadId && text(card.target && card.target.threadId) !== threadId) {
    return false;
  }
  const lease = card.executionLease && typeof card.executionLease === "object" ? card.executionLease : null;
  return Boolean(
    text(card.injectedTurnId)
    || text(card.injectedThreadId)
    || isLiveStatus(injectionTurnStatus(card))
    || (lease && !text(lease.completedAt) && isLiveStatus(lease.status || "active")),
  );
}

function completedReleasedStatus(previousStatus) {
  const previous = statusText(previousStatus);
  const out = previousStatus && typeof previousStatus === "object" ? Object.assign({}, previousStatus) : {};
  out.type = "completed";
  out.mobileTerminalReturnReceiptReleased = true;
  if (previous && !out.previousType) out.previousType = previous;
  return out;
}

function releaseInjectionResult(card) {
  const result = card.injectionResult && typeof card.injectionResult === "object" ? card.injectionResult : null;
  if (!result) return false;
  let changed = false;
  const next = Object.assign({}, result);
  if (next.turn && typeof next.turn === "object" && isLiveStatus(next.turn.status || next.turn.state)) {
    next.turn = Object.assign({}, next.turn, {
      status: completedReleasedStatus(next.turn.status || next.turn.state),
      mobileTerminalReturnReceiptReleased: true,
    });
    changed = true;
  }
  if (isLiveStatus(next.status)) {
    next.status = completedReleasedStatus(next.status);
    changed = true;
  }
  if (changed) card.injectionResult = next;
  return changed;
}

function repairTerminalReturnReceiptCard(card, timestamp) {
  const beforeInjectedTurnId = text(card.injectedTurnId);
  const beforeInjectedThreadId = text(card.injectedThreadId);
  const beforeLease = card.executionLease && typeof card.executionLease === "object" ? card.executionLease : null;
  const releasedInjectionResult = releaseInjectionResult(card);
  delete card.injectedTurnId;
  delete card.injectedThreadId;
  const delivery = card.delivery && typeof card.delivery === "object" ? card.delivery : {};
  const audit = card.audit && typeof card.audit === "object" ? card.audit : {};
  const returnStatus = text(delivery.returnStatus || audit.returnStatus || "completed") || "completed";
  card.delivery = Object.assign({}, delivery, {
    injectOnApprove: false,
    allowReply: false,
    allowRevoke: false,
    autoRunAfterFirstApproval: false,
    autoReturnOnCompletion: false,
    returnToSource: true,
    returnStatus,
    requiresReturn: false,
    terminal: true,
    ackPolicy: "none",
  });
  card.audit = Object.assign({}, audit, {
    terminalReturnReceiptReleasedAt: timestamp,
    terminalReturnReceiptReleaseReason: "terminal_return_receipt_no_active_turn",
    terminalReturnReceiptInjectedTurnCleared: Boolean(beforeInjectedTurnId || beforeInjectedThreadId),
    terminalReturnReceiptInjectionResultReleased: releasedInjectionResult,
    returnToSource: true,
    returnStatus,
    requiresReturn: false,
    terminal: true,
    ackPolicy: "none",
  });
  if (beforeLease) {
    card.executionLease = Object.assign({}, beforeLease, {
      status: "completed",
      resumeRequired: false,
      completedAt: text(beforeLease.completedAt) || timestamp,
      lastProgressAt: timestamp,
      terminalReturnReceiptReleased: true,
      resumeForTurnId: "",
    });
  }
  return {
    id: text(card.id),
    targetThreadId: text(card.target && card.target.threadId),
    sourceThreadId: text(card.source && card.source.threadId),
    clearedInjectedTurnId: Boolean(beforeInjectedTurnId),
    releasedInjectionResult,
    completedExecutionLease: Boolean(beforeLease),
  };
}

function repairStore(inputStore, options = {}) {
  if (!inputStore || typeof inputStore !== "object" || !Array.isArray(inputStore.cards)) {
    throw new Error("task_card_store_invalid_shape");
  }
  const timestamp = text(options.now) || new Date().toISOString();
  const store = clone(inputStore);
  const repaired = [];
  let terminalReturnReceiptCount = 0;
  let ordinaryCandidateCount = 0;
  for (const card of safeArray(store.cards)) {
    if (isTerminalReturnReceipt(card)) terminalReturnReceiptCount += 1;
    else if (text(card.injectedTurnId) || isLiveStatus(injectionTurnStatus(card))) ordinaryCandidateCount += 1;
    if (!terminalReturnReceiptNeedsRepair(card, options)) continue;
    repaired.push(repairTerminalReturnReceiptCard(card, timestamp));
  }
  return {
    store,
    summary: {
      ok: true,
      dryRun: options.apply !== true,
      inspectedCards: store.cards.length,
      terminalReturnReceiptCount,
      ordinaryCandidateCount,
      repairedCount: repaired.length,
      repairedIds: repaired.map((entry) => entry.id).slice(0, 40),
      targetThreadId: text(options.threadId),
      changed: repaired.length > 0,
      repaired,
    },
  };
}

function backupPathForStore(storeFile, backupDir = "", timestamp = new Date().toISOString()) {
  const safeTimestamp = timestamp.replace(/[:.]/g, "").replace(/[-]/g, "").slice(0, 15);
  const dir = backupDir || path.join(path.dirname(storeFile), "backups");
  return path.join(dir, `thread-task-cards-terminal-return-${safeTimestamp}.json`);
}

function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temp, file);
}

function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv, env);
  if (options.help) {
    console.log(usage());
    return { ok: true, help: true };
  }
  const raw = fs.readFileSync(options.storeFile, "utf8");
  const inputStore = JSON.parse(raw);
  const timestamp = new Date().toISOString();
  const { store, summary } = repairStore(inputStore, Object.assign({}, options, { now: timestamp }));
  if (options.apply && summary.changed) {
    const backupFile = backupPathForStore(options.storeFile, options.backupDir, timestamp);
    fs.mkdirSync(path.dirname(backupFile), { recursive: true });
    fs.copyFileSync(options.storeFile, backupFile);
    writeJsonAtomic(options.storeFile, store);
    summary.backupFile = backupFile;
  }
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`${summary.dryRun ? "dry-run" : "applied"} repaired=${summary.repairedCount} terminalReceipts=${summary.terminalReturnReceiptCount} inspected=${summary.inspectedCards}`);
    if (summary.backupFile) console.log(`backup=${summary.backupFile}`);
    if (summary.repairedIds.length) console.log(`sample=${summary.repairedIds.join(",")}`);
  }
  return summary;
}

if (require.main === module) {
  try {
    runCli();
  } catch (err) {
    console.error(err && err.message ? err.message : String(err));
    process.exitCode = 1;
  }
}

module.exports = {
  completedReleasedStatus,
  defaultStoreFile,
  injectionTurnStatus,
  isTerminalReturnReceipt,
  parseArgs,
  repairStore,
  terminalReturnReceiptNeedsRepair,
};
