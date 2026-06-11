"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const APP_ROOT = path.resolve(__dirname, "..");
const ARTIFACT_ROOT = path.join(os.homedir(), ".homeai-qa", "artifacts");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function usage() {
  return [
    "Usage: node scripts/side-chat-layout-visual-fixture.js [--keyboard] [--json]",
    "",
    "Generates a bounded side-chat layout fixture screenshot and rect summary.",
  ].join("\n");
}

function parseArgs(argv) {
  const out = { keyboard: false, json: false };
  for (const arg of argv) {
    if (arg === "--keyboard") out.keyboard = true;
    else if (arg === "--json") out.json = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fixtureHtml(css, options) {
  const keyboardClass = options.keyboard ? " keyboard-open" : "";
  const appHeight = options.keyboard ? 520 : 844;
  return `<!doctype html>
<html class="embed-hermes${keyboardClass}" style="--app-height:${appHeight}px;--host-bottom-safe-area:0px;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${css}</style>
  <style>
    body { margin: 0; width: 390px; height: ${appHeight}px; overflow: hidden; }
    .subagent-panel { display: block; right: auto; width: 390px; max-width: 390px; }
    .fixture-result { display: none; }
  </style>
</head>
<body>
  <div id="subagentPanel" class="subagent-panel">
    <div class="thread-side-panel no-subagents">
      <section class="side-chat-section" aria-label="侧边聊天">
        <div class="side-chat-header">
          <div>
            <div class="side-chat-heading">侧边聊天</div>
            <div class="side-chat-summary">服务器保存 · 2 条</div>
          </div>
          <button class="side-chat-clear side-chat-header-clear" type="button" aria-label="清空侧聊">清空</button>
          <button class="subagent-window-close side-chat-close" type="button" aria-label="关闭侧边聊天">×</button>
        </div>
        <div class="side-chat-scroll">
          <div class="side-chat-transcript">
            <article class="side-chat-message user">
              <div class="side-chat-message-meta"><span>我</span><time>刚刚</time></div>
              <div class="side-chat-message-text">讨论一下下一步优化的方向。</div>
            </article>
            <article class="side-chat-message assistant">
              <div class="side-chat-message-meta"><span>侧聊</span><time>刚刚</time></div>
              <div class="side-chat-message-text">建议先把侧边聊天做成普通线程同构的对话区，底部复用主 composer，候选动作挂在回执后面。</div>
              <div class="side-chat-message-actions">
                <button type="button">发送主线程</button>
                <button type="button">完成后发送</button>
                <button type="button">存为候选</button>
              </div>
            </article>
          </div>
        </div>
        <form class="side-chat-form" data-side-chat-form>
          <div class="side-chat-composer-row">
            <button class="side-chat-tool-button" type="button" aria-label="侧聊工具">+</button>
            <textarea rows="1" placeholder="整理想法，不进入主线程">继续讨论方案。
补充第二行。
补充第三行。</textarea>
            <button class="side-chat-send" type="submit">Send</button>
          </div>
          <div class="side-chat-tool-row" hidden>
            <button type="button">存为候选</button>
          </div>
        </form>
      </section>
    </div>
  </div>
  <pre id="fixtureResult" class="fixture-result"></pre>
  <script>
    requestAnimationFrame(() => {
      const textarea = document.querySelector(".side-chat-form textarea");
      textarea.style.height = "auto";
      const style = window.getComputedStyle(textarea);
      const maxHeight = Number.parseFloat(style.maxHeight) || 160;
      const minHeight = Number.parseFloat(style.minHeight) || 44;
      const nextHeight = Math.min(maxHeight, Math.max(minHeight, textarea.scrollHeight));
      textarea.style.height = nextHeight + "px";
      textarea.style.overflowY = textarea.scrollHeight > nextHeight + 1 ? "auto" : "hidden";
      const rect = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), bottom: Math.round(r.bottom), width: Math.round(r.width), height: Math.round(r.height) };
      };
      const appSurfaceHeight = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--app-height")) || window.innerHeight;
      const result = {
        viewport: { width: 390, height: window.innerHeight, appSurfaceHeight },
        panel: rect(".subagent-panel"),
        composer: rect(".side-chat-form"),
        composerRow: rect(".side-chat-composer-row"),
        toolButton: rect(".side-chat-tool-button"),
        textarea: rect(".side-chat-form textarea"),
        send: rect(".side-chat-send"),
        clear: rect(".side-chat-header-clear"),
        replyActions: rect(".side-chat-message-actions"),
        panelWithinViewport: rect(".subagent-panel").right <= 390,
        sendWithinViewport: rect(".side-chat-send").right <= 390,
        clearWithinHeader: rect(".side-chat-header-clear").bottom <= rect(".side-chat-header").bottom + 1,
        clearOutsideComposer: rect(".side-chat-header-clear").top < rect(".side-chat-form").top,
        bottomWithinViewport: rect(".side-chat-form").bottom <= appSurfaceHeight,
        sendCompact: rect(".side-chat-send").height <= 48 && rect(".side-chat-send").width <= 88,
        toolCompact: rect(".side-chat-tool-button").height <= 48 && rect(".side-chat-tool-button").width <= 48,
        inputVisible: rect(".side-chat-form textarea").height >= 40 && rect(".side-chat-form textarea").bottom <= appSurfaceHeight,
        inputAutosized: rect(".side-chat-form textarea").height > 58 && rect(".side-chat-form textarea").height <= maxHeight + 1,
      };
      document.getElementById("fixtureResult").textContent = JSON.stringify(result);
    });
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

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`);
  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  const css = fs.readFileSync(path.join(APP_ROOT, "public", "styles.css"), "utf8");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
  const mode = options.keyboard ? "keyboard" : "full";
  const htmlPath = path.join(ARTIFACT_ROOT, `codex-mobile-side-chat-composer-${mode}-${stamp}.html`);
  const screenshotPath = path.join(ARTIFACT_ROOT, `codex-mobile-side-chat-composer-${mode}-${stamp}.png`);
  fs.writeFileSync(htmlPath, fixtureHtml(css, options), "utf8");
  const url = `file://${htmlPath}`;
  const chromeBaseArgs = [
    "--headless=new",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "--hide-scrollbars",
    "--no-first-run",
    "--disable-extensions",
    "--window-size=390," + (options.keyboard ? "520" : "844"),
  ];
  runChrome([...chromeBaseArgs, `--screenshot=${screenshotPath}`, url]);
  const dump = runChrome([...chromeBaseArgs, "--dump-dom", url]);
  const result = Object.assign(extractResult(dump.stdout), {
    mode,
    screenshotPath,
    htmlPath,
  });
  if (!result.panelWithinViewport || !result.sendWithinViewport || !result.clearWithinHeader || !result.clearOutsideComposer || !result.bottomWithinViewport || !result.sendCompact || !result.toolCompact || !result.inputVisible || !result.inputAutosized) {
    const err = new Error("side chat composer layout fixture failed");
    err.result = result;
    throw err;
  }
  if (options.json) console.log(JSON.stringify({ ok: true, result }, null, 2));
  else console.log(`ok ${mode} ${screenshotPath}`);
}

try {
  main();
} catch (err) {
  if (err && err.result) console.error(JSON.stringify({ ok: false, result: err.result }, null, 2));
  else console.error(err && err.stack || err.message || String(err));
  process.exit(1);
}
