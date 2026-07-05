export const DEFAULT_OPTIONS = Object.freeze({
  maxEdge: 1280,
  quality: 0.72,
  minBytes: 256 * 1024,
  minSavingsRatio: 0.92,
  outputType: "image/jpeg",
});

const COMPRESSIBLE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

function runtimeRoot() {
  return typeof globalThis !== "undefined" ? globalThis : {};
}

function imageType(file) {
  return String((file && file.type) || "").toLowerCase();
}

export function isCompressibleImageFile(file, options = {}) {
  const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
  return Boolean(file
    && Number(file.size || 0) >= settings.minBytes
    && COMPRESSIBLE_TYPES.has(imageType(file)));
}

export function targetDimensions(width, height, maxEdge = DEFAULT_OPTIONS.maxEdge) {
  const sourceWidth = Math.max(1, Number(width || 0));
  const sourceHeight = Math.max(1, Number(height || 0));
  const edge = Math.max(1, Number(maxEdge || DEFAULT_OPTIONS.maxEdge));
  const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
    scaled: scale < 1,
  };
}

export function compressedImageName(name, outputType = DEFAULT_OPTIONS.outputType) {
  const fallback = "image";
  const base = String(name || fallback)
    .replace(/[\\/]+/g, "_")
    .replace(/\.[^.]*$/, "")
    .trim() || fallback;
  const ext = outputType === "image/webp" ? "webp" : "jpg";
  return `${base}.${ext}`;
}

export function shouldUseCompressedBlob(originalFile, blob, options = {}) {
  const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
  if (!blob || !Number.isFinite(blob.size) || blob.size <= 0) return false;
  const originalSize = Number(originalFile && originalFile.size || 0);
  if (!originalSize) return true;
  return blob.size < Math.max(1, Math.floor(originalSize * settings.minSavingsRatio));
}

function loadImageElement(file, deps) {
  const documentRef = deps.document;
  const urlApi = deps.URL;
  if (!documentRef || !urlApi || typeof documentRef.createElement !== "function") {
    return Promise.reject(new Error("image compression is unavailable"));
  }
  return new Promise((resolve, reject) => {
    const url = urlApi.createObjectURL(file);
    const image = documentRef.createElement("img");
    let settled = false;
    const cleanup = () => {
      try {
        urlApi.revokeObjectURL(url);
      } catch (_) {}
    };
    image.onload = () => {
      if (settled) return;
      settled = true;
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        source: image,
        close: cleanup,
      });
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("image decode failed"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, outputType, quality) {
  return new Promise((resolve) => {
    if (!canvas || typeof canvas.toBlob !== "function") {
      resolve(null);
      return;
    }
    canvas.toBlob((blob) => resolve(blob), outputType, quality);
  });
}

export async function compressImageFile(file, options = {}) {
  const settings = Object.assign({}, DEFAULT_OPTIONS, options || {});
  if (!isCompressibleImageFile(file, settings)) return file;
  const root = runtimeRoot();
  const deps = {
    document: settings.document || root.document,
    URL: settings.URL || root.URL,
    File: settings.File || root.File,
  };
  let image = null;
  try {
    image = await loadImageElement(file, deps);
    const dims = targetDimensions(image.width, image.height, settings.maxEdge);
    const canvas = deps.document.createElement("canvas");
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dims.width, dims.height);
    ctx.drawImage(image.source, 0, 0, dims.width, dims.height);
    const blob = await canvasToBlob(canvas, settings.outputType, settings.quality);
    if (!shouldUseCompressedBlob(file, blob, settings)) return file;
    const name = compressedImageName(file.name, settings.outputType);
    if (typeof deps.File === "function") {
      return new deps.File([blob], name, {
        type: blob.type || settings.outputType,
        lastModified: Number(file.lastModified || Date.now()),
      });
    }
    blob.name = name;
    blob.lastModified = Number(file.lastModified || Date.now());
    return blob;
  } finally {
    if (image && typeof image.close === "function") image.close();
  }
}

export default {
  DEFAULT_OPTIONS,
  compressedImageName,
  compressImageFile,
  isCompressibleImageFile,
  shouldUseCompressedBlob,
  targetDimensions,
};
