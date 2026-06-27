"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const APP_ROOT = path.resolve(__dirname, "..");
const ARTIFACT_ROOT = path.join(os.homedir(), ".homeai-qa", "artifacts");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function usage() {
  return [
    "Usage: node scripts/codex-mobile-long-turn-viewport-fixture.js [options]",
    "",
    "Generates a bounded mobile long-turn fixture screenshot and rect summary.",
    "",
    "Options:",
    "  --width <px>           Viewport width, default 390.",
    "  --height <px>          Viewport height, default 844.",
    "  --font-size <name>     small, default, large, xlarge, or xxlarge.",
    "  --paragraphs <count>   Synthetic final-receipt paragraphs, default 34.",
    "  --json                 Print JSON only.",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    width: 390,
    height: 844,
    fontSize: "default",
    paragraphs: 34,
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || "";
    if (arg === "--width") out.width = readPositiveInt(next(), out.width);
    else if (arg === "--height") out.height = readPositiveInt(next(), out.height);
    else if (arg === "--font-size") out.fontSize = normalizeFontSize(next());
    else if (arg === "--paragraphs") out.paragraphs = readPositiveInt(next(), out.paragraphs);
    else if (arg === "--json") out.json = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  out.width = Math.max(320, Math.min(1024, out.width));
  out.height = Math.max(560, Math.min(1600, out.height));
  out.paragraphs = Math.max(12, Math.min(90, out.paragraphs));
  return out;
}

function readPositiveInt(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeFontSize(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["small", "default", "large", "xlarge", "xxlarge"].includes(text) ? text : "default";
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stableTextHash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function safeArtifactResult(filePath) {
  const bytes = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  return {
    pathHash: stableTextHash(filePath),
    bytes,
  };
}

function syntheticParagraphs(count) {
  const rows = [];
  for (let index = 1; index <= count; index += 1) {
    rows.push(`<p>Fixture receipt paragraph ${index}: bounded synthetic response content for viewport anchoring and scroll behavior.</p>`);
  }
  return rows.join("\n");
}

function renderUsageSummary() {
  return `<details class="turn-usage-summary risk-normal">
    <summary class="turn-usage-bar">
      <span class="turn-usage-pills">
        <span class="turn-usage-pill context"><span class="turn-usage-pill-label">ctx</span><strong>24%</strong></span>
        <span class="turn-usage-pill thread"><span class="turn-usage-pill-label">thr</span><strong>18k</strong></span>
        <span class="turn-usage-pill rollout"><span class="turn-usage-pill-label">rollout</span><strong>12MB</strong></span>
        <span class="turn-usage-pill status status-normal"><strong>normal</strong></span>
      </span>
    </summary>
  </details>`;
}

function renderComposer() {
  return `<form id="composer" class="composer">
    <div class="attachment-picker-cell">
      <button id="attachFiles" class="icon-button composer-icon file-picker" type="button" aria-label="Attach files"><span aria-hidden="true">+</span></button>
    </div>
    <div class="composer-body">
      <div class="composer-controls">
        <button id="composerCommandControl" class="composer-fast-toggle" type="button" aria-pressed="false" aria-label="Fast tag off"></button>
        <button id="composerModelControl" class="composer-control-card" type="button"><span class="composer-chip-label">model</span><span class="composer-chip-value">--</span></button>
        <button id="composerEffortControl" class="composer-control-card" type="button"><span class="composer-chip-label">effort</span><span class="composer-chip-value">--</span></button>
        <button id="composerPermissionControl" class="composer-control-card" type="button"><span class="composer-chip-label">permission</span><span class="composer-chip-value">--</span></button>
        <button id="quotaUsage" class="composer-control-card quota-usage unknown" type="button">-- | --</button>
      </div>
      <div id="attachmentList" class="attachment-list hidden"></div>
      <div id="messageInput" class="message-input" contenteditable="true" role="textbox" aria-multiline="true" data-placeholder="Message Codex"></div>
    </div>
    <button id="sendMessage" type="submit">Send</button>
  </form>`;
}

function fixtureHtml(css, options = {}) {
  const width = readPositiveInt(options.width, 390);
  const height = readPositiveInt(options.height, 844);
  const fontSize = normalizeFontSize(options.fontSize);
  const paragraphs = Math.max(12, Math.min(90, readPositiveInt(options.paragraphs, 34)));
  return `<!doctype html>
<html class="embed-hermes" data-theme="dark" data-font-size="${htmlEscape(fontSize)}" style="--app-height:${height}px;--app-top:0px;--host-top-safe-area:0px;--host-bottom-safe-area:0px;--composer-height:126px;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${css}</style>
  <style>
    body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    .fixture-result { display: none; }
    .sidebar { display: none; }
    .app { grid-template-columns: minmax(0, 1fr); width: ${width}px; height: ${height}px; }
    .main { width: ${width}px; height: ${height}px; }
    .fixture-long-marker { display: none; }
  </style>
</head>
<body>
  <div class="app">
    <main class="main">
      <header class="topbar">
        <div class="thread-title-wrap">
          <div id="threadTitle" class="thread-title">Fixture Thread</div>
          <div id="threadMeta" class="thread-meta"></div>
        </div>
      </header>
      <section id="conversation" class="conversation">
        <article class="turn" data-turn="fixture-turn-final" data-render-key="turn|fixture-turn-final">
          <section class="item userMessage" data-item="fixture-user" data-render-key="item|fixture-user">
            <div class="item-head"><span>You</span></div>
            <div class="item-body"><p>Fixture request.</p></div>
          </section>
          <section class="item agentMessage" data-item="fixture-final-receipt" data-render-key="item|fixture-final-receipt">
            <div class="item-head"><span>Codex</span></div>
            <div class="item-body">
              <span class="fixture-long-marker">long final receipt marker</span>
              ${syntheticParagraphs(paragraphs)}
            </div>
          </section>
          <section class="item turnUsageSummary" data-item="fixture-usage" data-render-key="item|fixture-usage">
            <div class="item-body">${renderUsageSummary()}</div>
          </section>
        </article>
      </section>
      <section id="liveOperationDock" class="live-operation-dock" hidden></section>
      <button id="scrollToBottom" class="scroll-bottom-button" type="button" aria-label="back to bottom" aria-hidden="false">&#8595;</button>
      <button id="scrollToTurnReply" class="scroll-bottom-button scroll-turn-reply-button hidden" type="button" aria-label="back to final receipt" aria-hidden="true">&#8593;</button>
      ${renderComposer()}
    </main>
  </div>
  <pre id="fixtureResult" class="fixture-result"></pre>
  <script>
    function rect(selectorOrNode) {
      const node = typeof selectorOrNode === "string" ? document.querySelector(selectorOrNode) : selectorOrNode;
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
    }
    function center(r) {
      return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null;
    }
    function visible(node) {
      if (!node) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.visibility !== "hidden" && node.getClientRects().length > 0;
    }
    function overlaps(a, b) {
      return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    function scrollNodeIntoConversationView(node, margin) {
      const conversation = document.getElementById("conversation");
      const viewport = conversation.getBoundingClientRect();
      const targetRect = node.getBoundingClientRect();
      const next = conversation.scrollTop + targetRect.top - viewport.top - margin;
      conversation.scrollTop = Math.max(0, Math.min(next, Math.max(0, conversation.scrollHeight - conversation.clientHeight)));
    }
    function writeResult() {
      const conversation = document.getElementById("conversation");
      const composer = document.getElementById("composer");
      const receipt = document.querySelector(".item.agentMessage");
      const usage = document.querySelector(".item.turnUsageSummary");
      const bottomButton = document.getElementById("scrollToBottom");
      const replyButton = document.getElementById("scrollToTurnReply");
      const initialBottomVisible = visible(bottomButton);
      const initialReplyVisible = visible(replyButton);
      const initialBottomRect = rect(bottomButton);
      bottomButton.classList.add("hidden");
      replyButton.classList.remove("hidden");
      const toggledBottomVisible = visible(bottomButton);
      const toggledReplyVisible = visible(replyButton);
      const replyRect = rect(replyButton);
      const conversationRectBefore = rect(conversation);
      const composerRectBefore = rect(composer);
      scrollNodeIntoConversationView(receipt, 12);
      const receiptStartScrollTop = Math.round(conversation.scrollTop);
      const receiptStartRect = rect(receipt);
      const usageAfterReceiptStartRect = rect(usage);
      conversation.scrollTop = Math.max(0, conversation.scrollHeight - conversation.clientHeight);
      const bottomScrollTop = Math.round(conversation.scrollTop);
      const usageBottomRect = rect(usage);
      const receiptBottomRect = rect(receipt);
      const conversationRect = rect(conversation);
      const composerRect = rect(composer);
      const bottomCenter = center(initialBottomRect);
      const replyCenter = center(replyRect);
      const buttonCentersAligned = Boolean(bottomCenter && replyCenter
        && Math.abs(bottomCenter.x - replyCenter.x) <= 1
        && Math.abs(bottomCenter.y - replyCenter.y) <= 1);
      const buttonSizesAligned = Boolean(initialBottomRect && replyRect
        && Math.abs(initialBottomRect.width - replyRect.width) <= 1
        && Math.abs(initialBottomRect.height - replyRect.height) <= 1);
      const buttonsAboveComposer = Boolean(initialBottomRect && replyRect && composerRect
        && initialBottomRect.bottom <= composerRect.top - 4
        && replyRect.bottom <= composerRect.top - 4);
      const receiptStartAligned = Boolean(receiptStartRect && conversationRect
        && receiptStartRect.top >= conversationRect.top + 4
        && receiptStartRect.top <= conversationRect.top + 28);
      const usageVisibleAtBottom = Boolean(usageBottomRect && conversationRect
        && usageBottomRect.top >= conversationRect.top
        && usageBottomRect.bottom <= conversationRect.bottom + 1);
      const receiptStartBand = receiptStartRect
        ? { left: receiptStartRect.left, right: receiptStartRect.right, top: receiptStartRect.top, bottom: Math.min(receiptStartRect.bottom, receiptStartRect.top + 48) }
        : null;
      const receiptStartBandVisible = Boolean(receiptStartBand && conversationRect
        && receiptStartBand.top >= conversationRect.top + 4
        && receiptStartBand.top < Math.min(conversationRect.bottom, composerRect ? composerRect.top : conversationRect.bottom) - 24);
      const result = {
        viewport: { width: ${width}, height: ${height} },
        fixture: { paragraphs: ${paragraphs}, fontSize: ${JSON.stringify(fontSize)} },
        rects: {
          conversationBefore: conversationRectBefore,
          composerBefore: composerRectBefore,
          conversation: conversationRect,
          composer: composerRect,
          initialBottomButton: initialBottomRect,
          replyButton: replyRect,
          receiptStart: receiptStartRect,
          receiptBottom: receiptBottomRect,
          usageAfterReceiptStart: usageAfterReceiptStartRect,
          usageBottom: usageBottomRect,
        },
        scroll: {
          scrollHeight: conversation.scrollHeight,
          clientHeight: conversation.clientHeight,
          receiptStartScrollTop,
          bottomScrollTop,
        },
        initialBottomVisible,
        initialReplyVisible,
        toggledBottomVisible,
        toggledReplyVisible,
        jumpButtonsMutuallyExclusive: Boolean(initialBottomVisible && !initialReplyVisible && !toggledBottomVisible && toggledReplyVisible),
        jumpButtonsShareSlot: Boolean(buttonCentersAligned && buttonSizesAligned),
        buttonsAboveComposer,
        longReceiptScrollable: conversation.scrollHeight > conversation.clientHeight + 128,
        composerBelowConversation: Boolean(composerRect && conversationRect && composerRect.top >= conversationRect.bottom - 1),
        receiptStartAligned,
        receiptStartBandVisible,
        receiptStartBandNoComposerOverlap: !overlaps(receiptStartBand, composerRect),
        usageBelowReceipt: Boolean(usageAfterReceiptStartRect && receiptStartRect && usageAfterReceiptStartRect.top >= receiptStartRect.top),
        usageVisibleAtBottom,
        usageNoComposerOverlap: !overlaps(usageBottomRect, composerRect),
      };
      result.ok = Boolean(result.longReceiptScrollable
        && result.composerBelowConversation
        && result.jumpButtonsMutuallyExclusive
        && result.jumpButtonsShareSlot
        && result.buttonsAboveComposer
        && result.receiptStartAligned
        && result.receiptStartBandVisible
        && result.receiptStartBandNoComposerOverlap
        && result.usageBelowReceipt
        && result.usageVisibleAtBottom
        && result.usageNoComposerOverlap);
      document.getElementById("fixtureResult").textContent = JSON.stringify(result);
    }
    writeResult();
  </script>
</body>
</html>`;
}

function runChrome(args) {
  const result = spawnSync(CHROME, args, { encoding: "utf8", timeout: 30000 });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Chrome exited ${result.status}: ${String(result.stderr || result.stdout || "").slice(0, 4000)}`);
  }
  return result;
}

function extractResult(dumpDom) {
  const match = String(dumpDom || "").match(/<pre id="fixtureResult" class="fixture-result">([^<]+)<\/pre>/);
  if (!match) throw new Error("fixture result missing from Chrome dump");
  return JSON.parse(match[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&"));
}

function run(options = parseArgs()) {
  if (options.help) {
    console.log(usage());
    return null;
  }
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const css = fs.readFileSync(path.join(APP_ROOT, "public", "styles.css"), "utf8");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const nonce = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const htmlPath = path.join(ARTIFACT_ROOT, `codex-mobile-long-turn-${options.width}x${options.height}-${stamp}-${nonce}.html`);
  const screenshotPath = path.join(ARTIFACT_ROOT, `codex-mobile-long-turn-${options.width}x${options.height}-${stamp}-${nonce}.png`);
  fs.writeFileSync(htmlPath, fixtureHtml(css, options), "utf8");
  const url = `file://${htmlPath}`;
  const chromeBaseArgs = [
    "--headless=new",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-extensions",
    `--window-size=${options.width},${options.height}`,
  ];
  runChrome([...chromeBaseArgs, `--screenshot=${screenshotPath}`, url]);
  const dump = runChrome([...chromeBaseArgs, "--dump-dom", url]);
  const result = Object.assign(extractResult(dump.stdout), {
    screenshot: safeArtifactResult(screenshotPath),
    html: safeArtifactResult(htmlPath),
  });
  if (!result.ok) {
    const err = new Error("long-turn viewport fixture failed");
    err.result = result;
    throw err;
  }
  return result;
}

if (require.main === module) {
  try {
    const options = parseArgs();
    const result = run(options);
    if (result) {
      if (options.json) console.log(JSON.stringify({ ok: true, result }, null, 2));
      else console.log(`ok long-turn viewport ${result.viewport.width}x${result.viewport.height} screenshot=${result.screenshot.pathHash}`);
    }
  } catch (err) {
    if (err && err.result) console.error(JSON.stringify({ ok: false, result: err.result }, null, 2));
    else console.error(err && err.stack || err.message || String(err));
    process.exit(1);
  }
}

module.exports = {
  extractResult,
  fixtureHtml,
  parseArgs,
  safeArtifactResult,
  stableTextHash,
  syntheticParagraphs,
  usage,
  run,
};
