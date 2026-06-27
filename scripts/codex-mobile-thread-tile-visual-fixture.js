"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const threadTileLayout = require("../public/thread-tile-layout.js");
const threadTileState = require("../public/thread-tile-state.js");

const APP_ROOT = path.resolve(__dirname, "..");
const ARTIFACT_ROOT = path.join(os.homedir(), ".homeai-qa", "artifacts");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function usage() {
  return [
    "Usage: node scripts/codex-mobile-thread-tile-visual-fixture.js [options]",
    "",
    "Generates a bounded wide-screen thread-tile fixture screenshot and rect summary.",
    "",
    "Options:",
    "  --width <px>             Viewport width, default 3000.",
    "  --height <px>            Viewport height, default 1500.",
    "  --panes <count>          Visible pane count, default 5.",
    "  --menu-overlay           Use overlay/sidebar layout policy.",
    "  --sidebar-width <px>     Sidebar width for non-overlay desktop layout.",
    "  --font-size <name>       default, large, xlarge, or xxlarge.",
    "  --split <a:b>            Explicit split pair using fixture ids pane-a:pane-b.",
    "  --keyboard               Render the fixture in embedded keyboard-open mode.",
    "  --typed-lines <count>    Simulate typed composer content, default 0.",
    "  --task-card <state>      Render a fake injected task card: none, collapsed, or expanded.",
    "  --json                   Print JSON only.",
  ].join("\n");
}

function parseArgs(argv = process.argv.slice(2)) {
  const out = {
    width: 3000,
    height: 1500,
    panes: 5,
    menuOverlay: false,
    sidebarWidth: 0,
    fontSize: "default",
    splits: [],
    keyboard: false,
    typedLines: 0,
    taskCard: "none",
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => argv[++index] || "";
    if (arg === "--width") out.width = readPositiveInt(next(), out.width);
    else if (arg === "--height") out.height = readPositiveInt(next(), out.height);
    else if (arg === "--panes") out.panes = readPositiveInt(next(), out.panes);
    else if (arg === "--menu-overlay") out.menuOverlay = true;
    else if (arg === "--sidebar-width") out.sidebarWidth = readNonNegativeInt(next(), out.sidebarWidth);
    else if (arg === "--font-size") out.fontSize = normalizeFontSize(next());
    else if (arg === "--split") out.splits.push(readSplitPair(next()));
    else if (arg === "--keyboard") out.keyboard = true;
    else if (arg === "--typed-lines") out.typedLines = readNonNegativeInt(next(), out.typedLines);
    else if (arg === "--task-card") out.taskCard = normalizeTaskCardMode(next());
    else if (arg === "--json") out.json = true;
    else if (arg === "--help" || arg === "-h") out.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  out.panes = Math.max(1, Math.min(12, out.panes));
  out.typedLines = Math.max(0, Math.min(12, out.typedLines));
  out.splits = out.splits.filter(Boolean);
  return out;
}

function readPositiveInt(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readNonNegativeInt(value, fallback) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeFontSize(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["small", "default", "large", "xlarge", "xxlarge"].includes(text) ? text : "default";
}

function normalizeTaskCardMode(value) {
  const text = String(value || "").trim().toLowerCase();
  return ["collapsed", "expanded"].includes(text) ? text : "none";
}

function readSplitPair(value) {
  const parts = String(value || "").split(":").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2 || parts[0] === parts[1]) return null;
  return { anchorId: parts[0], childId: parts[1] };
}

function paneIds(count) {
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(`pane-${String.fromCharCode(97 + index)}`);
  }
  return ids;
}

function buildTileFixtureModel(options = {}) {
  const ids = paneIds(options.panes || 5);
  const layout = threadTileLayout.layoutForViewport({
    enabled: true,
    viewportWidth: options.width,
    viewportHeight: options.height,
    sidebarWidth: options.sidebarWidth,
    coarsePointer: false,
    orientation: options.width >= options.height ? "landscape" : "portrait",
    menuOverlay: options.menuOverlay === true,
    maxPanes: threadTileLayout.DEFAULT_USER_MAX_PANES,
    recommendedMaxPanes: threadTileLayout.DEFAULT_MAX_PANES,
    desiredPaneCount: ids.length,
    verticalChromePx: 110,
  });
  const displayPlan = threadTileState.paneDisplayLayoutPlan({
    layout,
    ids,
    effectivePaneCount: ids.length,
    splitPairs: options.splits || [],
  }, {
    capacityMaxPanes: threadTileLayout.DEFAULT_MAX_PANES,
    maxPanes: threadTileLayout.DEFAULT_USER_MAX_PANES,
    threadTileColumnGroups: threadTileLayout.threadTileColumnGroups,
  });
  return {
    ids,
    layout,
    displayLayout: displayPlan.displayLayout,
    columnGroups: displayPlan.displayLayout.columnGroups,
    expectedSingleRow: layout.enabled && !options.menuOverlay && ids.length <= Number(layout.columns || 1),
    expectedOverflowSplit: ids.length > Number(layout.columns || 1),
  };
}

function htmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPane(id, index, options = {}) {
  const activeClass = index === 0 ? " active" : "";
  const operation = index === 2 ? renderOperationDock(id) : "";
  const taskCard = index === 0 ? renderTaskCardFixture(options.taskCard) : "";
  const timer = index === 1 ? `<div class="thread-tile-pane-state turn-timer visible active">
    <span class="turn-timer-time">本轮 00:01:23</span><span class="turn-timer-detail">运行</span>
  </div>` : "";
  return `<section class="thread-tile-pane${activeClass}" data-thread-tile-pane="${htmlEscape(id)}" data-render-key="thread-tile|${htmlEscape(id)}">
    <header class="thread-tile-pane-header">
      <div class="thread-tile-pane-title-wrap">
        <button class="thread-tile-pane-title-button" type="button" draggable="true" data-thread-tile-drag-handle="${htmlEscape(id)}" data-thread-tile-title="${htmlEscape(id)}" aria-haspopup="listbox" aria-expanded="false">
          <span class="thread-tile-pane-title">${htmlEscape(`Fixture ${index + 1}`)}</span>
        </button>
      </div>
      <div class="thread-tile-pane-state-slot" data-thread-tile-pane-state>${timer}</div>
    </header>
    <div class="thread-tile-pane-body">
      <div class="thread-tile-pane-content">
        <article class="turn thread-tile-turn" data-thread-tile-turn="${htmlEscape(id)}-turn" data-render-key="tile-turn|${htmlEscape(id)}">
          <div class="item assistant" data-item="${htmlEscape(id)}-item" data-render-key="tile-item|${htmlEscape(id)}">
            <div class="item-head"><span>Assistant</span><time class="item-timestamp" datetime="2026-06-27T00:00:00.000Z">00:00</time></div>
            <div class="item-body"><p>Pane ${htmlEscape(String(index + 1))} bounded visual smoke content.</p></div>
          </div>
          ${taskCard}
        </article>
      </div>
    </div>
    ${operation}
    <button class="thread-tile-bottom-button hidden" type="button" data-thread-tile-bottom="${htmlEscape(id)}" aria-label="跳到此线程底部" title="跳到底部" aria-hidden="true" tabindex="-1">↓</button>
  </section>`;
}

function taskCardFixtureText() {
  const lines = [
    "[Cross-thread task card sent by source thread]",
    "",
    "Source workspace: /bounded/fixture/source",
    "Source thread: Fixture Source Thread",
    "Title: Verify split-screen task card presentation",
    "Approval: target approval bypassed by the thread-callable interface.",
    "",
    "## Task",
    "",
    "Validate that a long injected cross-thread card remains folded by default,",
    "shows source and purpose in the visible overview, and keeps expanded content",
    "inside a bounded scroll region without moving the shared composer.",
  ];
  for (let index = 1; index <= 36; index += 1) {
    lines.push(`- bounded fixture line ${index}: synthetic card evidence only.`);
  }
  return lines.join("\n");
}

function renderTaskCardFixture(mode = "none") {
  const normalized = normalizeTaskCardMode(mode);
  if (normalized === "none") return "";
  const text = taskCardFixtureText();
  const openAttr = normalized === "expanded" ? " open" : "";
  return `<section class="item thread-task-card-injected" data-item="fixture-task-card" data-render-key="tile-item|fixture-task-card" data-thread-task-card-item>
    <div class="item-head thread-task-card-message-head">
      <span class="thread-task-card-message-heading">
        <span class="thread-task-card-message-source">来源：Fixture Source Thread</span>
        <span class="thread-task-card-message-purpose">目的：Verify split-screen task card presentation</span>
      </span>
      <span class="item-head-actions"><time class="item-timestamp" datetime="2026-06-27T00:00:00.000Z">00:00</time></span>
    </div>
    <div class="item-body">
      <details class="thread-task-card-message" data-thread-task-card-message${openAttr}>
        <summary><span>完整任务卡</span><small>${text.length.toLocaleString()} chars</small></summary>
        <pre class="thread-task-card-message-body">${htmlEscape(text)}</pre>
      </details>
    </div>
  </section>`;
}

function renderOperationDock(id) {
  return `<div class="thread-tile-operation-dock" data-thread-tile-operation-dock="${htmlEscape(id)}" data-mode="compact">
    <div class="live-operation-dock-inner">
      <div class="mobile-operation-stack">
        <button class="mobile-operation-bubble" type="button" data-thread-tile-operation-toggle="${htmlEscape(id)}">
          <span class="mobile-operation-bubble-title">命令</span>
          <span class="mobile-operation-bubble-summary">node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --panes 5</span>
          <span class="mobile-operation-bubble-duration">00:01:23</span>
        </button>
      </div>
    </div>
  </div>`;
}

function composerInputHeightPx(typedLines = 0) {
  const lines = Math.max(1, readNonNegativeInt(typedLines, 0) || 1);
  return Math.max(44, Math.min(160, 22 + (lines * 22)));
}

function composerHeightPx(typedLines = 0) {
  return 92 + Math.max(0, composerInputHeightPx(typedLines) - 44);
}

function typedComposerText(typedLines = 0) {
  const lines = Math.max(0, readNonNegativeInt(typedLines, 0));
  if (!lines) return "";
  const out = [];
  for (let index = 0; index < lines; index += 1) {
    out.push(`fixture composer input line ${index + 1}`);
  }
  return out.join("\n");
}

function renderComposer(options = {}) {
  const typedLines = readNonNegativeInt(options.typedLines, 0);
  const text = typedComposerText(typedLines);
  const inputStyle = typedLines > 0 ? ` style="height:${composerInputHeightPx(typedLines)}px;"` : "";
  return `<form id="composer" class="composer">
    <div class="attachment-picker-cell">
      <button id="attachFiles" class="icon-button composer-icon file-picker" type="button" aria-label="Attach files" disabled><span aria-hidden="true">+</span></button>
    </div>
    <div class="composer-body">
      <div class="composer-controls">
        <button id="composerCommandControl" class="composer-fast-toggle is-fast" type="button" aria-pressed="true" aria-label="Fast tag on for this thread">
          <svg class="composer-fast-icon" aria-hidden="true" viewBox="0 0 16 16" focusable="false"><path d="M9.1 1.25 3.75 8.2h3.1l-.95 6.55 5.35-6.95H8.15z"></path></svg>
        </button>
        <button id="composerModelControl" class="composer-control-card" type="button"><span class="composer-chip-label">模型</span><span class="composer-chip-value">ChatGPT</span></button>
        <button id="composerEffortControl" class="composer-control-card" type="button"><span class="composer-chip-label">推理强度</span><span class="composer-chip-value">X High</span></button>
        <button id="composerPermissionControl" class="composer-control-card" type="button"><span class="composer-chip-label">权限</span><span class="composer-chip-value">Workspace</span></button>
        <button id="quotaUsage" class="composer-control-card quota-usage quota-ok" type="button"><span class="quota-inline"><span class="quota-inline-part"><span class="quota-inline-label">额度</span><span>42%</span></span></span></button>
      </div>
      <div id="messageInput" class="message-input has-target-placeholder" contenteditable="true" role="textbox" data-placeholder="发送到 Fixture 1"${inputStyle}>${htmlEscape(text)}</div>
    </div>
    <button id="sendMessage" type="submit">Send</button>
  </form>`;
}

function fixtureHtml(css, options = {}) {
  const model = buildTileFixtureModel(options);
  const columns = Math.max(1, Number(model.displayLayout.columns || model.columnGroups.length || 1));
  const groups = model.columnGroups.length ? model.columnGroups : model.ids.map((id) => [id]);
  const height = readPositiveInt(options.height, 1500);
  const width = readPositiveInt(options.width, 3000);
  const fontSize = normalizeFontSize(options.fontSize);
  const keyboardClass = options.keyboard ? " keyboard-open" : "";
  const typedLines = readNonNegativeInt(options.typedLines, 0);
  const taskCardMode = normalizeTaskCardMode(options.taskCard);
  const expectedComposerHeight = composerHeightPx(typedLines);
  return `<!doctype html>
<html class="embed-hermes thread-tile-open${keyboardClass}" data-theme="dark" data-font-size="${htmlEscape(fontSize)}" style="--app-height:${height}px;--app-top:0px;--host-top-safe-area:0px;--host-bottom-safe-area:0px;--composer-height:${expectedComposerHeight}px;">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>${css}</style>
  <style>
    body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    .fixture-result { display: none; }
    .sidebar { display: none; }
    .main { width: ${width}px; height: ${height}px; }
  </style>
</head>
<body>
  <div class="app">
    <main class="main thread-tile-main">
      <header class="topbar"></header>
      <section id="conversation" class="conversation thread-tile-mode" style="--thread-tile-columns:${columns};">
        <div class="thread-tile-board" data-thread-tile-board data-render-key="thread-tile-board">
          ${groups.map((group, index) => `<div class="thread-tile-column" data-thread-tile-column="${htmlEscape(String(index))}" style="--thread-tile-column-rows:${htmlEscape(String(Math.max(1, group.length)))}">
            ${group.map((id) => renderPane(id, model.ids.indexOf(id), options)).join("")}
          </div>`).join("")}
        </div>
      </section>
      <section id="liveOperationDock" class="live-operation-dock" hidden></section>
      ${renderComposer(options)}
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
    function overlaps(a, b) {
      return a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    function writeResult() {
      const panes = Array.from(document.querySelectorAll(".thread-tile-pane")).map((node) => ({ id: node.getAttribute("data-thread-tile-pane") || "", rect: rect(node) }));
      const columns = Array.from(document.querySelectorAll(".thread-tile-column")).map((node) => ({
        rect: rect(node),
        paneCount: node.querySelectorAll(".thread-tile-pane").length,
        rows: Number(getComputedStyle(node).getPropertyValue("--thread-tile-column-rows")) || 1,
      }));
      const conversation = rect("#conversation");
      const board = rect(".thread-tile-board");
      const composer = rect("#composer");
      const app = document.querySelector(".app");
      const appRect = rect(app);
      const input = document.querySelector("#messageInput");
      const inputRect = rect(input);
      const dock = rect(".thread-tile-operation-dock");
      const bubble = rect(".mobile-operation-bubble");
      const durationNode = document.querySelector(".mobile-operation-bubble-duration");
      const duration = rect(durationNode);
      const taskCard = document.querySelector("[data-thread-task-card-message]");
      const taskCardPane = taskCard ? taskCard.closest(".thread-tile-pane") : null;
      const taskCardSummary = taskCard ? taskCard.querySelector("summary") : null;
      const taskCardBody = taskCard ? taskCard.querySelector(".thread-task-card-message-body") : null;
      const taskCardRect = rect(taskCard);
      const taskCardPaneRect = rect(taskCardPane);
      const taskCardSummaryRect = rect(taskCardSummary);
      const taskCardBodyRect = rect(taskCardBody);
      const appTransform = app ? getComputedStyle(app).transform : "";
      const appTransformStable = !app || appTransform === "none" || appTransform === "matrix(1, 0, 0, 1, 0, 0)";
      const inputText = input ? (input.textContent || "") : "";
      const typedLines = ${typedLines};
      const hiddenBottomButtons = Array.from(document.querySelectorAll(".thread-tile-bottom-button"))
        .every((node) => getComputedStyle(node).display === "none" || node.getClientRects().length === 0);
      const paneOverlaps = [];
      for (let i = 0; i < panes.length; i += 1) {
        for (let j = i + 1; j < panes.length; j += 1) {
          if (overlaps(panes[i].rect, panes[j].rect)) paneOverlaps.push([panes[i].id, panes[j].id]);
        }
      }
      const allPanesInside = panes.every((pane) => pane.rect && conversation && pane.rect.left >= conversation.left - 1 && pane.rect.right <= conversation.right + 1 && pane.rect.top >= conversation.top - 1 && pane.rect.bottom <= conversation.bottom + 1);
      const nonSplitColumnsFullHeight = columns.filter((column) => column.paneCount === 1).every((column) => board && Math.abs(column.rect.height - board.height) <= 2);
      const durationVisible = !durationNode || (duration && bubble && duration.right <= bubble.right + 1 && durationNode.scrollWidth <= durationNode.clientWidth + 1);
      const operationDockOverlay = !dock || (conversation && bubble && dock.bottom <= conversation.bottom + 1 && bubble.bottom <= conversation.bottom + 1);
      const inputInsideComposer = Boolean(inputRect && composer && inputRect.left >= composer.left - 1 && inputRect.right <= composer.right + 1 && inputRect.top >= composer.top - 1 && inputRect.bottom <= composer.bottom + 1);
      const typedInputStable = !typedLines || (inputText.includes("fixture composer input line 1") && inputRect && inputRect.height >= 44 && inputInsideComposer);
      const taskCardMode = ${JSON.stringify(taskCardMode)};
      const taskCardPresent = taskCardMode !== "none";
      const taskCardInsidePane = !taskCardPresent || Boolean(taskCardRect && taskCardPaneRect
        && taskCardRect.left >= taskCardPaneRect.left - 1
        && taskCardRect.right <= taskCardPaneRect.right + 1
        && taskCardRect.top >= taskCardPaneRect.top - 1
        && taskCardRect.bottom <= taskCardPaneRect.bottom + 1);
      const taskCardSummaryVisible = !taskCardPresent || Boolean(taskCardSummaryRect && taskCardSummaryRect.height >= 36 && taskCardSummaryRect.width >= 160);
      const taskCardBodyScrollBounded = taskCardMode !== "expanded" || Boolean(taskCardBody && taskCardBodyRect
        && taskCardBodyRect.height <= 422
        && taskCardBody.scrollHeight > taskCardBody.clientHeight);
      const taskCardNoComposerOverlap = !taskCardPresent || !overlaps(taskCardRect, composer);
      const result = {
        viewport: { width: ${width}, height: ${height} },
        model: ${JSON.stringify({
          layout: model.layout,
          displayLayout: {
            columns: model.displayLayout.columns,
            rows: model.displayLayout.rows,
            visiblePanes: model.displayLayout.visiblePanes,
            columnGroups: model.displayLayout.columnGroups,
          },
          expectedSingleRow: model.expectedSingleRow,
          expectedOverflowSplit: model.expectedOverflowSplit,
          keyboard: Boolean(options.keyboard),
          typedLines,
          taskCardMode,
          expectedComposerHeight,
        })},
        rects: { app: appRect, conversation, board, composer, input: inputRect, dock, bubble, duration, taskCard: taskCardRect, taskCardSummary: taskCardSummaryRect, taskCardBody: taskCardBodyRect },
        paneCount: panes.length,
        columnCount: columns.length,
        splitColumnCount: columns.filter((column) => column.paneCount > 1).length,
        maxColumnPaneCount: Math.max(0, ...columns.map((column) => column.paneCount)),
        allPanesInside,
        boardInsideConversation: Boolean(board && conversation && board.left >= conversation.left - 1 && board.right <= conversation.right + 1 && board.top >= conversation.top - 1 && board.bottom <= conversation.bottom + 1),
        composerBelowConversation: Boolean(composer && conversation && composer.top >= conversation.bottom - 1),
        hiddenBottomButtons,
        noPaneOverlap: paneOverlaps.length === 0,
        paneOverlaps,
        nonSplitColumnsFullHeight,
        durationVisible,
        operationDockOverlay,
        appTransform,
        appTransformStable,
        inputInsideComposer,
        typedInputStable,
        taskCardPresent,
        taskCardInsidePane,
        taskCardSummaryVisible,
        taskCardBodyScrollBounded,
        taskCardNoComposerOverlap,
      };
      result.ok = Boolean(result.paneCount === ${model.ids.length}
        && result.columnCount === result.model.displayLayout.columns
        && result.allPanesInside
        && result.boardInsideConversation
        && result.composerBelowConversation
        && result.hiddenBottomButtons
        && result.noPaneOverlap
        && result.nonSplitColumnsFullHeight
        && result.durationVisible
        && result.operationDockOverlay
        && result.appTransformStable
        && result.inputInsideComposer
        && result.typedInputStable
        && result.taskCardInsidePane
        && result.taskCardSummaryVisible
        && result.taskCardBodyScrollBounded
        && result.taskCardNoComposerOverlap
        && (!result.model.expectedSingleRow || result.splitColumnCount === 0)
        && (!result.model.expectedOverflowSplit || result.splitColumnCount >= 1));
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
  const mode = options.menuOverlay ? "overlay" : "wide";
  const nonce = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  const htmlPath = path.join(ARTIFACT_ROOT, `codex-mobile-thread-tile-${options.panes}pane-${mode}-${stamp}-${nonce}.html`);
  const screenshotPath = path.join(ARTIFACT_ROOT, `codex-mobile-thread-tile-${options.panes}pane-${mode}-${stamp}-${nonce}.png`);
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
    screenshotPath,
    htmlPath,
  });
  if (!result.ok) {
    const err = new Error("thread tile visual fixture failed");
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
      else console.log(`ok ${result.paneCount} panes ${result.screenshotPath}`);
    }
  } catch (err) {
    if (err && err.result) console.error(JSON.stringify({ ok: false, result: err.result }, null, 2));
    else console.error(err && err.stack || err.message || String(err));
    process.exit(1);
  }
}

module.exports = {
  buildTileFixtureModel,
  composerHeightPx,
  composerInputHeightPx,
  extractResult,
  fixtureHtml,
  parseArgs,
  run,
  typedComposerText,
  taskCardFixtureText,
};
