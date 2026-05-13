"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexMarkdownRenderer = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function isMarkdownTableSeparator(line) {
    const cells = String(line || "").trim().replace(/^\||\|$/g, "").split("|");
    return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
  }

  function splitMarkdownTableRow(line) {
    return String(line || "")
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim());
  }

  function isMarkdownBlockStart(line, nextLine = "") {
    return /^```/.test(line)
      || /^(#{1,6})\s+\S/.test(line)
      || /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)
      || /^>\s?/.test(line)
      || /^\s*[-*+]\s+\S/.test(line)
      || /^\s*\d+[.)]\s+\S/.test(line)
      || (line.includes("|") && isMarkdownTableSeparator(nextLine));
  }

  function safeMarkdownUrl(value) {
    const url = String(value || "").trim();
    if (/^(https?:|mailto:)/i.test(url)) return url;
    return "";
  }

  function autolinkUrlParts(rawUrl) {
    let href = String(rawUrl || "");
    let suffix = "";
    while (/[.,;:!?]$/.test(href)) {
      suffix = href.slice(-1) + suffix;
      href = href.slice(0, -1);
    }
    while (href.endsWith(")") && href.split("(").length <= href.split(")").length) {
      suffix = ")" + suffix;
      href = href.slice(0, -1);
    }
    return { href, suffix };
  }

  function renderMarkdownLink(label, rawUrl) {
    const safeUrl = safeMarkdownUrl(String(rawUrl || "").replaceAll("&amp;", "&"));
    if (!safeUrl) return null;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  }

  function renderAutolinkUrl(rawUrl) {
    const parts = autolinkUrlParts(rawUrl);
    const href = parts.href.startsWith("www.") ? `https://${parts.href}` : parts.href;
    const safeUrl = safeMarkdownUrl(href.replaceAll("&amp;", "&"));
    if (!safeUrl) return rawUrl;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${parts.href}</a>${parts.suffix}`;
  }

  function renderInlineMarkdown(value) {
    const placeholders = [];
    const tokenPrefix = "MDTOKEN";
    let text = String(value || "").replace(/`([^`\n]+)`/g, (_match, code) => {
      const token = `${tokenPrefix}${placeholders.length}END`;
      placeholders.push(`<code>${escapeHtml(code)}</code>`);
      return token;
    });

    text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (match, label, url) => {
      const rendered = renderMarkdownLink(escapeHtml(label), url);
      if (!rendered) return match;
      const token = `${tokenPrefix}${placeholders.length}END`;
      placeholders.push(rendered);
      return token;
    });
    text = escapeHtml(text);
    text = text.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<]+)/gi, (_match, prefix, url) => `${prefix}${renderAutolinkUrl(url)}`);
    text = text
      .replace(/\*\*([^*\n][^*\n]*?)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n][^_\n]*?)__/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])\*([^*\n][^*\n]*?)\*/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\n][^_\n]*?)_/g, "$1<em>$2</em>");

    placeholders.forEach((html, index) => {
      text = text.replaceAll(`${tokenPrefix}${index}END`, html);
    });
    return text;
  }

  function renderMarkdownTable(lines) {
    const header = splitMarkdownTableRow(lines[0]);
    const rows = lines.slice(2).map(splitMarkdownTableRow);
    return `<div class="markdown-table-wrap"><table>
    <thead><tr>${header.map((cell) => `<th>${renderInlineMarkdown(cell)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${header.map((_cell, index) => `<td>${renderInlineMarkdown(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
  }

  function renderMarkdownList(lines, ordered) {
    const tag = ordered ? "ol" : "ul";
    const itemPattern = ordered ? /^\s*(\d+)[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
    let start = 1;
    const items = lines.map((line) => {
      const match = itemPattern.exec(line);
      if (ordered && match) start = Number(match[1]) || start;
      const text = match ? match[ordered ? 2 : 1] : line.trim();
      return `<li>${renderInlineMarkdown(text)}</li>`;
    });
    const startAttr = ordered && start > 1 ? ` start="${start}"` : "";
    return `<${tag}${startAttr}>${items.join("")}</${tag}>`;
  }

  function renderCodeBlock(codeText, lang, options) {
    const langLabel = `<span class="markdown-code-lang">${escapeHtml(lang || "代码")}</span>`;
    let copyButton = "";
    if (options && typeof options.rememberCopyText === "function" && typeof options.copyButtonHtml === "function") {
      copyButton = options.copyButtonHtml(options.rememberCopyText(codeText), options.copyLabel || "复制", "markdown-copy-button");
    }
    return `<div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>`;
  }

  function renderMarkdown(value, options = {}) {
    const source = String(value || "");
    if (!source.trim()) return "";
    const lines = source.replace(/\r\n?/g, "\n").split("\n");
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i += 1;
        continue;
      }

      const fence = /^```([A-Za-z0-9_.+-]*)\s*$/.exec(line);
      if (fence) {
        const lang = fence[1] || "";
        const code = [];
        i += 1;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) {
          code.push(lines[i]);
          i += 1;
        }
        if (i < lines.length) i += 1;
        blocks.push(renderCodeBlock(code.join("\n"), lang, options));
        continue;
      }

      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        const level = Math.min(6, heading[1].length + 1);
        blocks.push(`<h${level}>${renderInlineMarkdown(heading[2].trim())}</h${level}>`);
        i += 1;
        continue;
      }

      if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        blocks.push("<hr>");
        i += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^>\s?/, ""));
          i += 1;
        }
        blocks.push(`<blockquote>${renderMarkdown(quote.join("\n"), options)}</blockquote>`);
        continue;
      }

      if (line.includes("|") && isMarkdownTableSeparator(lines[i + 1])) {
        const tableLines = [line, lines[i + 1]];
        i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
          tableLines.push(lines[i]);
          i += 1;
        }
        blocks.push(renderMarkdownTable(tableLines));
        continue;
      }

      if (/^\s*[-*+]\s+\S/.test(line)) {
        const list = [];
        while (i < lines.length && /^\s*[-*+]\s+\S/.test(lines[i])) {
          list.push(lines[i]);
          i += 1;
        }
        blocks.push(renderMarkdownList(list, false));
        continue;
      }

      if (/^\s*\d+[.)]\s+\S/.test(line)) {
        const list = [];
        while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
          list.push(lines[i]);
          i += 1;
        }
        blocks.push(renderMarkdownList(list, true));
        continue;
      }

      const paragraph = [line.trim()];
      i += 1;
      while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines[i], lines[i + 1] || "")) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br>")}</p>`);
    }

    return `<div class="markdown-body">${blocks.join("")}</div>`;
  }

  return {
    escapeHtml,
    safeMarkdownUrl,
    autolinkUrlParts,
    renderMarkdownLink,
    renderAutolinkUrl,
    renderInlineMarkdown,
    isMarkdownTableSeparator,
    splitMarkdownTableRow,
    isMarkdownBlockStart,
    renderMarkdownTable,
    renderMarkdownList,
    renderMarkdown,
  };
}));
