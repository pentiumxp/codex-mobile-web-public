"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const serverJs = fs.readFileSync(path.join(root, "server.js"), "utf8");
const { uploadPathForId } = require("../server");

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
  assert.match(stylesCss, /\.file-preview-table/);
  assert.match(stylesCss, /\.file-preview-body \.markdown-code-block pre \{[\s\S]*white-space: pre-wrap;/);
  assert.match(stylesCss, /\.file-preview-body \.markdown-body,[\s\S]*\.file-preview-body \.markdown-table-wrap \{[\s\S]*min-width: 0;[\s\S]*max-width: 100%;/);
  assert.match(stylesCss, /\.local-file-preview-link \{[\s\S]*display: inline-block;[\s\S]*overflow-wrap: anywhere;[\s\S]*word-break: break-word;/);
  assert.doesNotMatch(stylesCss, /\.local-file-preview-link span/);
  assert.match(appJs, /data-local-file-path/);
  assert.match(appJs, /file && file\.kind === "markdown"\) return renderMarkdown\(content, \{ orderedListMode: "source" \}\)/);
  assert.match(appJs, /file && file\.kind === "image"/);
  assert.match(appJs, /file && file\.kind === "pdf"/);
  assert.match(appJs, /function renderImageView\(item\)/);
  assert.match(appJs, /function authenticatedApiContentUrl\(value\)/);
  assert.match(appJs, /function imageViewContentUrl\(item\)/);
  assert.match(appJs, /contentUrl \? authenticatedApiContentUrl\(contentUrl\)/);
  assert.match(appJs, /contentUrl: imageSourceSignature\(imageViewContentUrl\(item\)\)/);
  assert.match(appJs, /if \(item\.type === "imageView"\) return renderImageView\(item\)/);
  assert.match(appJs, /if \(item\.type === "imageGeneration"\) return renderImageView\(item\)/);
  assert.match(appJs, /imageView: "Image"/);
  assert.match(appJs, /imageGeneration: "Image"/);
  assert.match(serverJs, /GENERATED_IMAGE_ROOT/);
  assert.match(serverJs, /cacheGeneratedImageForItem/);
  assert.match(serverJs, /cacheGeneratedImageDataUrl/);
  assert.match(serverJs, /readRolloutToolOutputImageItems/);
  assert.match(serverJs, /\/api\/generated-images\/file/);
  assert.match(serverJs, /\/api\/uploads\/file/);
  assert.match(serverJs, /url\.searchParams\.get\("id"\)/);
  assert.match(serverJs, /out\.type === "imageView" \|\| out\.type === "imageGeneration"/);
  assert.match(appJs, /function canRenderImageAttachment\(attachment\)/);
  assert.match(appJs, /imageAttachments[\s\S]*\.filter\(canRenderImageAttachment\)[\s\S]*renderInputImage\(\{ path: attachment\.path \}, attachment, index\)/);
  assert.match(appJs, /FILE_PREVIEW_SWIPE_CLOSE_MIN_PX/);
  assert.match(appJs, /IMAGE_PREVIEW_ZOOM_STEP/);
  assert.match(appJs, /function openImagePreviewFromImage\(image\)/);
  assert.match(appJs, /function applyImagePreviewScale\(scale, options = \{\}\)/);
  assert.match(appJs, /function beginImagePreviewPinch\(event\)/);
  assert.match(appJs, /function moveImagePreviewPinch\(event\)/);
  assert.match(appJs, /imageStage\.addEventListener\("touchstart", beginImagePreviewPinch, \{ passive: false \}\)/);
  assert.match(appJs, /imageStage\.addEventListener\("touchmove", moveImagePreviewPinch, \{ passive: false \}\)/);
  assert.match(appJs, /applyImagePreviewScale\(pinch\.scale \* \(distance \/ pinch\.distance\), anchorOptions\)/);
  assert.match(appJs, /function previewableImageFromEvent\(event\)/);
  assert.match(appJs, /previewableImageFromEvent\(event\)[\s\S]*openImagePreviewFromImage\(previewImage\)/);
  assert.match(appJs, /imagePreviewOpen: imagePreviewOpen\(\)/);
  assert.match(appJs, /function beginFilePreviewSwipe\(event\)/);
  assert.match(appJs, /function moveFilePreviewSwipe\(event\)[\s\S]*event\.stopPropagation\(\)[\s\S]*event\.preventDefault\(\)/);
  assert.match(appJs, /function finishFilePreviewSwipe\(event\)[\s\S]*closeFilePreview\(\)/);
  assert.match(appJs, /filePreviewDialog\.addEventListener\("touchstart", beginFilePreviewSwipe, \{ passive: false \}\)/);
  assert.match(appJs, /renderCsvPreview/);
  assert.match(appJs, /\/api\/files\/preview\?threadId=/);
  assert.match(appJs, /\/api\/files\/preview\/content\?\$\{params\.toString\(\)\}/);
  assert.match(serverJs, /\/api\/files\/preview/);
  assert.match(serverJs, /\/api\/files\/preview\/content/);
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
