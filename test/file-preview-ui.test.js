"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const { readFrontendSources } = require("./frontend-source-helper");

const root = path.resolve(__dirname, "..");
const appJs = readFrontendSources(root);
const mediaPreviewRuntimeJs = fs.readFileSync(path.join(root, "public", "media-preview-runtime.js"), "utf8");
const appAndMediaJs = `${mediaPreviewRuntimeJs}\n${appJs}`;
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const mediaStaticRuntimeServiceJs = fs.readFileSync(path.join(root, "services", "runtime", "media-static-runtime-service.js"), "utf8");
const mediaFileServiceJs = fs.readFileSync(path.join(root, "adapters", "media-file-service.js"), "utf8");
const generatedImageContentServiceJs = fs.readFileSync(path.join(root, "adapters", "generated-image-content-service.js"), "utf8");
const threadDetailCompactionServiceJs = fs.readFileSync(path.join(root, "adapters", "thread-detail-compaction-service.js"), "utf8");
const { uploadPathForId } = require("../server");

function functionBody(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  const signature = source.slice(start);
  const signatureMatch = signature.match(/\)\s*\{/);
  assert.ok(signatureMatch, `${name} should have a function body opener`);
  const braceStart = start + signatureMatch.index + signatureMatch[0].lastIndexOf("{");
  assert.notEqual(braceStart, -1, `${name} should have a body`);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart + 1, index);
    }
  }
  throw new Error(`${name} body not found`);
}

test("mobile file preview UI is wired from markdown link to preview API", () => {
  assert.match(indexHtml, /id="filePreviewDialog"/);
  assert.match(indexHtml, /id="filePreviewBody"/);
  assert.match(indexHtml, /id="imagePreviewDialog"/);
  assert.match(indexHtml, /id="imagePreviewImage"/);
  assert.match(indexHtml, /data-image-preview-action="zoom-in"/);
  assert.match(indexHtml, /data-image-preview-action="zoom-out"/);
  assert.match(indexHtml, /data-image-preview-action="reset"/);
  assert.match(stylesCss, /\.local-file-preview-link/);
  assert.match(stylesCss, /\.file-preview-panel/);
  assert.match(stylesCss, /width: min\(980px, calc\(100vw - 36px\)\)/);
  assert.match(stylesCss, /\.file-preview-body \{[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: auto;/);
  assert.match(stylesCss, /\.file-preview-image/);
  assert.match(stylesCss, /\.image-preview-dialog/);
  assert.match(stylesCss, /\.image-preview-stage \{[\s\S]*overflow: auto;[\s\S]*touch-action: pan-x pan-y;/);
  assert.match(stylesCss, /\.image-preview-image \{[\s\S]*width: calc\(100% \* var\(--image-preview-scale, 1\)\);[\s\S]*max-width: none;/);
  assert.match(stylesCss, /\.input-image img,[\s\S]*\.markdown-image img \{[\s\S]*aspect-ratio: 9 \/ 16;[\s\S]*object-fit: contain;[\s\S]*cursor: zoom-in;/);
  assert.match(stylesCss, /\.image-view img \{[\s\S]*aspect-ratio: 16 \/ 10;[\s\S]*object-fit: contain;[\s\S]*cursor: zoom-in;/);
  assert.match(stylesCss, /\.attachment-thumb \{[\s\S]*cursor: zoom-in;/);
  assert.match(stylesCss, /\.image-view/);
  assert.match(stylesCss, /\.file-preview-html-frame/);
  assert.match(stylesCss, /\.file-preview-html\.is-fullscreen/);
  assert.match(stylesCss, /height: min\(66vh, 760px\)/);
  assert.match(stylesCss, /html\.file-preview-html-fullscreen-open/);
  assert.match(stylesCss, /\.file-preview-table/);
  assert.match(stylesCss, /\.file-preview-body \.markdown-code-block pre \{[\s\S]*white-space: pre-wrap;/);
  assert.match(stylesCss, /\.file-preview-body \.markdown-body,[\s\S]*\.file-preview-body \.markdown-table-wrap \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(stylesCss, /\.local-file-preview-link \{[\s\S]*display: inline-block;[\s\S]*overflow-wrap: anywhere;[\s\S]*word-break: break-word;/);
  assert.doesNotMatch(stylesCss, /\.local-file-preview-link span/);
  assert.match(appAndMediaJs, /data-local-file-path/);
  assert.match(appAndMediaJs, /file && file\.kind === "markdown"\) return renderMarkdown\(content, \{ orderedListMode: "source" \}\)/);
  assert.match(appAndMediaJs, /file && file\.kind === "image"/);
  assert.match(appAndMediaJs, /file && file\.kind === "pdf"/);
  assert.match(appAndMediaJs, /file && file\.kind === "html"/);
  assert.match(appAndMediaJs, /sandbox="allow-scripts"/);
  assert.match(appAndMediaJs, /data-file-preview-html-view="render"/);
  assert.match(appAndMediaJs, /data-file-preview-html-fullscreen/);
  assert.match(appAndMediaJs, /function handleFilePreviewHtmlViewClick\(button\)/);
  assert.match(appAndMediaJs, /function handleFilePreviewHtmlFullscreenClick\(button\)/);
  assert.match(appJs, /handleFilePreviewHtmlViewClick\(htmlPreviewButton\)/);
  assert.match(appJs, /handleFilePreviewHtmlFullscreenClick\(htmlFullscreenButton\)/);
  assert.match(appJs, /closeFilePreviewHtmlFullscreen\(\)/);
  assert.match(appAndMediaJs, /function renderImageView\(item\)/);
  assert.match(appAndMediaJs, /function authenticatedApiContentUrl\(value\)/);
  assert.match(appAndMediaJs, /function imageViewContentUrl\(item\)/);
  assert.match(appAndMediaJs, /function safeImageViewApiUrl\(value\)/);
  assert.match(appAndMediaJs, /contentUrl\s*\?\s*safeImageViewApiUrl\(contentUrl\)/);
  assert.match(appJs, /imageViewContentUrl\(item\),[\s\S]*imageViewUrl\(item\),[\s\S]*\.filter\(Boolean\)\.map\(imageSourceSignature\)\.join\("\|"\)/);
  assert.match(appAndMediaJs, /if \(item\.type === "imageView"\) return renderImageView\(item\)/);
  assert.match(appAndMediaJs, /if \(item\.type === "imageGeneration"\) return renderImageView\(item\)/);
  assert.match(appJs, /imageView: "Image"/);
  assert.match(appJs, /imageGeneration: "Image"/);
  assert.match(serverJs, /createMediaStaticRuntimeService/);
  assert.match(mediaStaticRuntimeServiceJs, /GENERATED_IMAGE_ROOT/);
  assert.match(generatedImageContentServiceJs, /cacheGeneratedImageForItem/);
  assert.match(generatedImageContentServiceJs, /cacheGeneratedImageDataUrl/);
  assert.match(serverJs, /readRolloutToolOutputImageItems/);
  assert.match(mediaFileServiceJs, /\/api\/generated-images\/file/);
  assert.match(mediaFileServiceJs, /\/api\/uploads\/file/);
  assert.match(mediaFileServiceJs, /url\.searchParams\.get\("id"\)/);
  assert.match(generatedImageContentServiceJs, /item\.type !== "imageView" && item\.type !== "imageGeneration"/);
  assert.match(threadDetailCompactionServiceJs, /out\.type === "imageView" \|\| out\.type === "imageGeneration"/);
  assert.match(appAndMediaJs, /function canRenderImageAttachment\(attachment\)/);
  assert.match(appAndMediaJs, /imageAttachments[\s\S]*\.filter\(canRenderImageAttachment\)[\s\S]*renderInputImage\(\{ path: attachment\.path \}, attachment, index\)/);
  assert.match(appAndMediaJs, /FILE_PREVIEW_SWIPE_CLOSE_MIN_PX/);
  assert.match(appAndMediaJs, /IMAGE_PREVIEW_ZOOM_STEP/);
  assert.match(appAndMediaJs, /function openImagePreviewFromImage\(image\)/);
  assert.match(appAndMediaJs, /function applyImagePreviewScale\(scale, options = \{\}\)/);
  assert.match(appAndMediaJs, /function beginImagePreviewPinch\(event\)/);
  assert.match(appAndMediaJs, /function moveImagePreviewPinch\(event\)/);
  assert.match(appJs, /imageStage\.addEventListener\("touchstart", beginImagePreviewPinch, \{ passive: false \}\)/);
  assert.match(appJs, /imageStage\.addEventListener\("touchmove", moveImagePreviewPinch, \{ passive: false \}\)/);
  assert.match(appAndMediaJs, /applyImagePreviewScale\(pinch\.scale \* \(distance \/ pinch\.distance\), anchorOptions\)/);
  assert.match(appAndMediaJs, /function previewableImageFromEvent\(event\)/);
  assert.match(appJs, /previewableImageFromEvent\(event\)[\s\S]*openImagePreviewFromImage\(previewImage\)/);
  assert.match(appAndMediaJs, /imagePreviewOpen: imagePreviewOpen\(\)/);
  assert.match(appAndMediaJs, /function beginFilePreviewSwipe\(event\)/);
  assert.match(appAndMediaJs, /function moveFilePreviewSwipe\(event\)[\s\S]*event\.stopPropagation\(\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(appAndMediaJs, /function finishFilePreviewSwipe\(event\)[\s\S]*closeFilePreview\(\)/);
  assert.match(appJs, /filePreviewDialog\.addEventListener\("touchstart", beginFilePreviewSwipe, \{ passive: false \}\)/);
  assert.match(appAndMediaJs, /renderCsvPreview/);
  assert.match(appAndMediaJs, /\/api\/files\/preview\?threadId=/);
  assert.match(appAndMediaJs, /\/api\/files\/preview\/content\?\$\{params\.toString\(\)\}/);
  assert.match(mediaFileServiceJs, /\/api\/files\/preview/);
  assert.match(mediaFileServiceJs, /\/api\/files\/preview\/content/);
  assert.match(mediaFileServiceJs, /if \(isHtmlFilePreview\(filePath\)\) return "html"/);
  assert.match(mediaFileServiceJs, /"Content-Security-Policy"/);
  assert.match(mediaFileServiceJs, /sandbox allow-scripts/);
});

test("file preview requests use owning thread context instead of global current thread", () => {
  const localContentBody = functionBody(mediaPreviewRuntimeJs, "localFilePreviewContentUrl");
  assert.match(localContentBody, /options\.threadId \|\| renderContextThreadId\(\)/);
  assert.doesNotMatch(localContentBody, /threadId:\s*state\.currentThreadId/);

  const openBody = functionBody(mediaPreviewRuntimeJs, "openLocalFilePreview");
  assert.match(openBody, /const threadId = localFilePreviewThreadIdFromLink\(link, options\);/);
  assert.match(openBody, /state\.filePreviewThreadId = threadId;/);
  assert.match(openBody, /\/api\/files\/preview\?threadId=\$\{encodeURIComponent\(threadId\)\}/);
  assert.doesNotMatch(openBody, /encodeURIComponent\(state\.currentThreadId/);

  const wireBody = functionBody(appJs, "wireUi");
  assert.match(wireBody, /openLocalFilePreview\(actionPlan\.link \|\| actionPlan\.target, \{ threadId: actionPlan\.threadId \}\)/);
  assert.match(wireBody, /openLocalFilePreview\(localFileLink, \{ threadId: state\.filePreviewThreadId \}\)/);
});

test("upload image ids resolve only inside the upload root", () => {
  const uploadRoot = path.join(root, ".tmp-upload-root");
  assert.equal(
    uploadPathForId(uploadRoot, "2026-06-23/thread-id/homeai-upload.jpg"),
    path.join(uploadRoot, "2026-06-23", "thread-id", "homeai-upload.jpg"),
  );
  assert.throws(() => uploadPathForId(uploadRoot, "../secret.jpg"), /Invalid upload id/);
  assert.throws(() => uploadPathForId(uploadRoot, "2026-06-23/../secret.jpg"), /Invalid upload id/);
  assert.throws(() => uploadPathForId(uploadRoot, "C:/Users/xuxin/.codex-mobile-web/uploads/a.jpg"), /Invalid upload id/);
});
