"use strict";

const {
  cacheGeneratedImageDataUrl,
  cacheGeneratedImageForItem,
  imageViewSourcePath,
} = require("./generated-image-cache-service");

function createGeneratedImageContentService(dependencies = {}) {
  const path = dependencies.path || require("node:path");
  const generatedImageRoot = dependencies.generatedImageRoot;
  const filePreviewMediaMaxBytes = dependencies.filePreviewMediaMaxBytes;
  const filePreviewImageContentTypes = dependencies.filePreviewImageContentTypes;
  const generatedImageContentUrl = dependencies.generatedImageContentUrl;
  const hasDeniedPreviewPathSegment = dependencies.hasDeniedPreviewPathSegment;

  function imageViewInlineDataUrl(item) {
    if (!item || typeof item !== "object") return "";
    const candidates = [
      item.url,
      item.imageUrl,
      item.image_url,
      item.arguments && (item.arguments.url || item.arguments.imageUrl || item.arguments.image_url),
      item.result && (item.result.url || item.result.imageUrl || item.result.image_url),
    ];
    for (const candidate of candidates) {
      const value = candidate && typeof candidate === "object"
        ? candidate.url || candidate.uri || candidate.href
        : candidate;
      if (typeof value === "string" && /^data:image\//i.test(value.trim())) return value.trim();
    }
    return "";
  }

  const GENERATED_IMAGE_SOURCE_FIELD_KEYS = [
    "path",
    "filePath",
    "file_path",
    "imagePath",
    "image_path",
    "savedPath",
    "saved_path",
    "sourcePath",
    "source_path",
    "url",
    "imageUrl",
    "image_url",
  ];

  function imageViewSourceFieldValue(value) {
    if (value && typeof value === "object") return String(value.url || value.uri || value.href || "").trim();
    return String(value || "").trim();
  }

  function isBrowserApiImageUrl(value) {
    return /^\/api\/(?:generated-images\/file|uploads\/file|files\/preview\/content)(?:[?#]|$)/.test(String(value || "").trim());
  }

  function isAbsoluteLocalImageSource(value) {
    const text = String(value || "").trim();
    return Boolean(text && (
      path.isAbsolute(text)
      || /^[A-Za-z]:[\\/]/.test(text)
      || /^\\\\/.test(text)
    ));
  }

  function isImageFileNameLike(value) {
    return /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff|webp)(?:[?#].*)?$/i.test(String(value || "").trim());
  }

  function isUnsafeGeneratedImageSourceValue(value) {
    const text = imageViewSourceFieldValue(value);
    if (!text || isBrowserApiImageUrl(text)) return false;
    if (/^data:image\//i.test(text)) return true;
    if (/^file:\/\//i.test(text)) return true;
    if (/^(?:https?:|blob:)/i.test(text)) return false;
    if (isAbsoluteLocalImageSource(text)) return true;
    return isImageFileNameLike(text);
  }

  function generatedImageSourceDisplayName(item) {
    const explicit = item && (item.fileName || item.file_name || item.label || item.caption || item.id);
    const source = imageViewSourcePath(item) || imageViewSourceFieldValue(item && (item.url || item.imageUrl || item.image_url));
    const basename = path.basename(String(source || explicit || "image"));
    return basename || "image";
  }

  function removeUnsafeGeneratedImageSources(item) {
    if (!item || typeof item !== "object") return item;
    const targets = [item];
    if (item.arguments && typeof item.arguments === "object") targets.push(item.arguments);
    if (item.result && typeof item.result === "object") targets.push(item.result);
    for (const target of targets) {
      for (const key of GENERATED_IMAGE_SOURCE_FIELD_KEYS) {
        if (Object.prototype.hasOwnProperty.call(target, key) && isUnsafeGeneratedImageSourceValue(target[key])) delete target[key];
      }
    }
    return item;
  }

  function generatedImageHasUnsafeSource(item) {
    if (!item || typeof item !== "object") return false;
    const targets = [item];
    if (item.arguments && typeof item.arguments === "object") targets.push(item.arguments);
    if (item.result && typeof item.result === "object") targets.push(item.result);
    return targets.some((target) => GENERATED_IMAGE_SOURCE_FIELD_KEYS.some((key) => (
      Object.prototype.hasOwnProperty.call(target, key) && isUnsafeGeneratedImageSourceValue(target[key])
    )));
  }

  function markGeneratedImageUnavailable(item) {
    if (!item || typeof item !== "object") return item;
    const fileName = generatedImageSourceDisplayName(item);
    delete item.contentUrl;
    delete item.content_url;
    removeUnsafeGeneratedImageSources(item);
    if (!item.fileName && !item.file_name) item.fileName = fileName;
    item.generatedImage = {
      fileName,
      unavailable: true,
      reason: "source_unavailable",
    };
    return item;
  }

  function applyGeneratedImageCacheResult(item, cached) {
    if (!item || !cached) return item;
    item.contentUrl = generatedImageContentUrl(cached.cacheId);
    if (!item.fileName && !item.file_name) item.fileName = cached.fileName;
    item.generatedImage = {
      fileName: cached.fileName,
      contentType: cached.contentType,
      sizeBytes: cached.sizeBytes,
    };
    removeUnsafeGeneratedImageSources(item);
    return item;
  }

  function attachGeneratedImageContent(item, options = {}) {
    if (!item || (item.type !== "imageView" && item.type !== "imageGeneration")) return item;
    if (item.contentUrl || item.content_url) return item;
    const dataUrl = imageViewInlineDataUrl(item);
    if (dataUrl) {
      const cachedDataUrl = cacheGeneratedImageDataUrl(dataUrl, {
        cacheRoot: generatedImageRoot,
        threadId: options.threadId || "",
        maxBytes: filePreviewMediaMaxBytes,
        contentTypes: filePreviewImageContentTypes,
      });
      if (!cachedDataUrl) return markGeneratedImageUnavailable(item);
      return applyGeneratedImageCacheResult(item, cachedDataUrl);
    }
    const hasUnsafeSource = generatedImageHasUnsafeSource(item);
    const sourcePath = imageViewSourcePath(item);
    const cached = cacheGeneratedImageForItem(item, {
      cacheRoot: generatedImageRoot,
      threadId: options.threadId || "",
      maxBytes: filePreviewMediaMaxBytes,
      contentTypes: filePreviewImageContentTypes,
      isDeniedPath: hasDeniedPreviewPathSegment,
    });
    if (!cached) {
      if (sourcePath || hasUnsafeSource) return markGeneratedImageUnavailable(item);
      return item;
    }
    return applyGeneratedImageCacheResult(item, cached);
  }

  return {
    attachGeneratedImageContent,
    generatedImageHasUnsafeSource,
    imageViewInlineDataUrl,
    markGeneratedImageUnavailable,
    removeUnsafeGeneratedImageSources,
  };
}

module.exports = {
  createGeneratedImageContentService,
};
