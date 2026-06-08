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

  function safeMarkdownImageUrl(value) {
    const url = String(value || "").trim();
    if (/^https?:/i.test(url)) return url;
    return safeMarkdownDataImageUrl(url);
  }

  function safeMarkdownDataImageUrl(value) {
    const url = String(value || "").trim();
    if (/^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i.test(url)) {
      return url.replace(/\s+/g, "");
    }
    return "";
  }

  function stripMarkdownLinkTarget(value) {
    const target = String(value || "").trim();
    if (target.startsWith("<") && target.endsWith(">")) return target.slice(1, -1).trim();
    return target;
  }

  function decodeMarkdownLinkTarget(value) {
    const target = stripMarkdownLinkTarget(value);
    if (/^file:\/\//i.test(target)) {
      try {
        return decodeURIComponent(new URL(target).pathname);
      } catch (_) {
        return target.replace(/^file:\/\//i, "");
      }
    }
    try {
      return decodeURIComponent(target);
    } catch (_) {
      return target;
    }
  }

  function isLocalFileTarget(value) {
    const target = stripMarkdownLinkTarget(value);
    return target.startsWith("/")
      || /^file:\/\//i.test(target)
      || /^[A-Za-z]:[\\/]/.test(target)
      || /^\\\\/.test(target);
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

  function renderMarkdownLink(rawLabel, rawUrl) {
    const label = escapeHtml(rawLabel);
    const target = stripMarkdownLinkTarget(rawUrl);
    if (isLocalFileTarget(target)) {
      const filePath = decodeMarkdownLinkTarget(target);
      return `<button class="local-file-preview-link" type="button" data-local-file-path="${escapeHtml(filePath)}" data-local-file-label="${escapeHtml(rawLabel)}" title="预览查看这个文件">${label}</button>`;
    }
    const safeUrl = safeMarkdownUrl(String(target || "").replaceAll("&amp;", "&"));
    if (!safeUrl) return null;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${label}</a>`;
  }

  function renderMarkdownImage(rawLabel, rawUrl) {
    const target = stripMarkdownLinkTarget(rawUrl);
    const safeUrl = safeMarkdownImageUrl(String(target || "").replaceAll("&amp;", "&"));
    if (!safeUrl) return null;
    const label = String(rawLabel || "image").trim() || "image";
    return `<figure class="markdown-image"><img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(label)}" loading="lazy"><figcaption>${escapeHtml(label)}</figcaption></figure>`;
  }

  function normalizeGithubPreviewUrl(value) {
    let parsed;
    try {
      parsed = new URL(String(value || "").trim());
    } catch (_) {
      return "";
    }
    const host = String(parsed.hostname || "").toLowerCase();
    if (host !== "github.com" && host !== "www.github.com") return "";
    if (parsed.protocol !== "https:") return "";
    return parsed.toString();
  }

  function standaloneGithubPreviewUrl(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const markdownLink = /^\[([^\]\n]+)\]\((<[^>\n]+>|[^)\s]+)\)$/.exec(text);
    if (markdownLink) return normalizeGithubPreviewUrl(stripMarkdownLinkTarget(markdownLink[2]));
    if (!/\s/.test(text)) return normalizeGithubPreviewUrl(text.startsWith("www.") ? `https://${text}` : text);
    return "";
  }

  function renderGithubLinkCard(url, fallbackLabel = "") {
    const safeUrl = normalizeGithubPreviewUrl(url);
    if (!safeUrl) return "";
    const fallback = renderMarkdownLink(fallbackLabel || safeUrl, safeUrl) || escapeHtml(fallbackLabel || safeUrl);
    return `<div class="github-link-card-shell" data-github-link-preview-url="${escapeHtml(safeUrl)}">
      <div class="github-link-card-fallback">${fallback}</div>
    </div>`;
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

    text = text.replace(/!\[([^\]\n]*)\]\((<[^>\n]+>|[^)\s]+)\)/g, (match, label, url) => {
      const rendered = renderMarkdownImage(label, url);
      if (!rendered) return match;
      const token = `${tokenPrefix}${placeholders.length}END`;
      placeholders.push(rendered);
      return token;
    });

    text = text.replace(/\[([^\]\n]+)\]\((<[^>\n]+>|[^)\s]+)\)/g, (match, label, url) => {
      const rendered = renderMarkdownLink(label, url);
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

  function orderedListStart(lines, options) {
    const numbers = lines
      .map((line) => /^\s*(\d+)[.)]\s+/.exec(line))
      .filter(Boolean)
      .map((match) => Number(match[1]) || 1);
    const first = numbers[0] || 1;
    if (options && options.orderedListMode === "source") return first;
    return lines.length <= 1 ? first : 1;
  }

  function renderMarkdownList(lines, ordered, options) {
    const tag = ordered ? "ol" : "ul";
    const itemPattern = ordered ? /^\s*(\d+)[.)]\s+(.+)$/ : /^\s*[-*+]\s+(.+)$/;
    const start = ordered ? orderedListStart(lines, options) : 1;
    const items = lines.map((line) => {
      const match = itemPattern.exec(line);
      const text = match ? match[ordered ? 2 : 1] : line.trim();
      return `<li>${renderInlineMarkdown(text)}</li>`;
    });
    const startAttr = ordered && start > 1 ? ` start="${start}"` : "";
    return `<${tag}${startAttr}>${items.join("")}</${tag}>`;
  }

  function codeBlockTableLines(codeText) {
    const lines = String(codeText || "").replace(/\r\n?/g, "\n").split("\n");
    for (let index = 0; index < lines.length - 1; index += 1) {
      if (!lines[index].includes("|") || !isMarkdownTableSeparator(lines[index + 1])) continue;
      const tableLines = [lines[index], lines[index + 1]];
      index += 2;
      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        tableLines.push(lines[index]);
        index += 1;
      }
      return tableLines.length >= 3 ? tableLines : [];
    }
    return [];
  }

  function renderCodeBlock(codeText, lang, options) {
    const langLabel = `<span class="markdown-code-lang">${escapeHtml(lang || "代码")}</span>`;
    let copyButton = "";
    if (options && typeof options.rememberCopyText === "function" && typeof options.copyButtonHtml === "function") {
      copyButton = options.copyButtonHtml(options.rememberCopyText(codeText), options.copyLabel || "复制", "markdown-copy-button");
    }
    const normalizedLang = String(lang || "").trim().toLowerCase();
    const allowTablePreview = Boolean(options && options.fencedTableMode === "preview")
      && (!normalizedLang || normalizedLang === "text" || normalizedLang === "txt" || normalizedLang === "plain" || normalizedLang === "plaintext");
    const tableLines = allowTablePreview ? codeBlockTableLines(codeText) : [];
    if (tableLines.length) {
      return `<div class="markdown-code-table-preview">${renderMarkdownTable(tableLines)}</div>
      <details class="markdown-code-table-source-details">
        <summary>查看源码表格</summary>
        <div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>
      </details>`;
    }
    return `<div class="markdown-code-block"><div class="markdown-code-head">${langLabel}${copyButton}</div><pre><code>${escapeHtml(codeText)}</code></pre></div>`;
  }

  function escapeMermaidQuotedLabel(value) {
    return String(value || "").trim().replace(/"/g, "&quot;");
  }

  function mermaidGeneratedSubgraphId(index) {
    return `codex_mobile_subgraph_${index + 1}`;
  }

  function normalizeMermaidSubgraphLine(line, index) {
    const match = /^(\s*)subgraph\s+(.+?)\s*$/i.exec(String(line || ""));
    if (!match) return line;
    const indent = match[1] || "";
    const body = String(match[2] || "").trim();
    if (!body || /^end$/i.test(body)) return line;
    const bracketMatch = /^([A-Za-z][\w-]*)\s*\[(.*)\]$/.exec(body);
    if (bracketMatch) {
      const label = String(bracketMatch[2] || "").trim();
      if (!label || /^".*"$/.test(label)) return line;
      return `${indent}subgraph ${bracketMatch[1]}["${escapeMermaidQuotedLabel(label)}"]`;
    }
    const idTitleMatch = /^([A-Za-z][\w-]*)\s+(.+)$/.exec(body);
    if (idTitleMatch) {
      const title = String(idTitleMatch[2] || "").trim();
      if (!title || /^".*"$/.test(title)) return line;
      return `${indent}subgraph ${idTitleMatch[1]}["${escapeMermaidQuotedLabel(title)}"]`;
    }
    if (/^[A-Za-z][\w-]*$/.test(body) || /^".*"$/.test(body)) return line;
    return `${indent}subgraph ${mermaidGeneratedSubgraphId(index)}["${escapeMermaidQuotedLabel(body)}"]`;
  }

  function normalizeMermaidSourceForRender(value) {
    const source = String(value || "");
    const withSoftBreaks = source.replace(/\\n/g, "<br/>");
    const firstLine = withSoftBreaks.split(/\r?\n/, 1)[0].trim();
    if (!/^(?:flowchart|graph)\b/i.test(firstLine)) return withSoftBreaks;
    const withQuotedSubgraphs = withSoftBreaks
      .split(/\r?\n/)
      .map((line, index) => normalizeMermaidSubgraphLine(line, index))
      .join("\n");
    return withQuotedSubgraphs
      .replace(/(^|[\s;])([A-Za-z][\w-]*)\[([^\]\n]*)\]/gm, (match, prefix, nodeId, label) => {
        const trimmed = String(label || "").trim();
        if (!trimmed || /^".*"$/.test(trimmed)) return match;
        if (!/[()（）]|<br\/>/.test(trimmed)) return match;
        return `${prefix}${nodeId}["${trimmed.replace(/"/g, "&quot;")}"]`;
      })
      .replace(/\|([^|\n]*[()]+[^|\n]*)\|/g, (match, label) => {
        const normalizedLabel = String(label || "").replace(/\(/g, "（").replace(/\)/g, "）");
        return `|${normalizedLabel}|`;
      });
  }

  function renderMermaidBlock(codeText) {
    return `<div class="markdown-mermaid-block" data-mermaid-block="true">
      <div class="markdown-mermaid-head">
        <span class="markdown-mermaid-label">Mermaid</span>
        <div class="markdown-mermaid-toolbar">
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="zoom-out" aria-label="缩小 Mermaid 图" title="缩小">-</button>
          <button class="markdown-mermaid-tool markdown-mermaid-tool-reset" type="button" data-mermaid-action="reset" aria-label="重置 Mermaid 图缩放" title="重置">100%</button>
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="zoom-in" aria-label="放大 Mermaid 图" title="放大">+</button>
          <button class="markdown-mermaid-tool" type="button" data-mermaid-action="expand" aria-label="放大查看 Mermaid 图" title="放大查看">展开</button>
        </div>
      </div>
      <div class="markdown-mermaid-viewer" data-mermaid-viewer="inline">
        <div class="markdown-mermaid-canvas" data-mermaid-canvas>
          <div class="markdown-mermaid-loading">正在渲染 Mermaid 图...</div>
        </div>
      </div>
      <details class="markdown-mermaid-source-details">
        <summary>查看 Mermaid 源码</summary>
        <pre><code class="language-mermaid">${escapeHtml(codeText)}</code></pre>
      </details>
      <pre class="markdown-mermaid-source" hidden>${escapeHtml(codeText)}</pre>
    </div>`;
  }

  function renderBareDataImage(value) {
    const safeUrl = safeMarkdownDataImageUrl(value);
    if (!safeUrl) return "";
    return `<figure class="markdown-image"><img src="${escapeHtml(safeUrl)}" alt="Generated image" loading="lazy"><figcaption>Generated image</figcaption></figure>`;
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

      const bareDataImage = renderBareDataImage(line.trim());
      if (bareDataImage) {
        blocks.push(bareDataImage);
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
        const codeText = code.join("\n");
        blocks.push(/^mermaid$/i.test(lang) ? renderMermaidBlock(codeText) : renderCodeBlock(codeText, lang, options));
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
        blocks.push(renderMarkdownList(list, false, options));
        continue;
      }

      if (/^\s*\d+[.)]\s+\S/.test(line)) {
        const list = [];
        while (i < lines.length && /^\s*\d+[.)]\s+\S/.test(lines[i])) {
          list.push(lines[i]);
          i += 1;
        }
        blocks.push(renderMarkdownList(list, true, options));
        continue;
      }

      const paragraph = [line.trim()];
      i += 1;
      while (i < lines.length && lines[i].trim() && !isMarkdownBlockStart(lines[i], lines[i + 1] || "")) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      if (paragraph.length === 1) {
        const githubPreviewUrl = standaloneGithubPreviewUrl(paragraph[0]);
        if (githubPreviewUrl) {
          blocks.push(renderGithubLinkCard(githubPreviewUrl));
          continue;
        }
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
    renderMarkdownImage,
    renderAutolinkUrl,
    renderInlineMarkdown,
    safeMarkdownImageUrl,
    standaloneGithubPreviewUrl,
    normalizeMermaidSourceForRender,
    isMarkdownTableSeparator,
    splitMarkdownTableRow,
    isMarkdownBlockStart,
    renderMarkdownTable,
    renderMarkdownList,
    renderMarkdown,
  };
}));
