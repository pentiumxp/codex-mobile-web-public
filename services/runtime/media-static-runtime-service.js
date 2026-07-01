"use strict";

const { createMediaFileService } = require("../../adapters/media-file-service");
const { createGeneratedImageContentService } = require("../../adapters/generated-image-content-service");
const { createStaticFileService } = require("../../adapters/static-file-service");

function createMediaStaticRuntimeService(dependencies = {}) {
  const mediaFactory = dependencies.mediaFileServiceFactory || createMediaFileService;
  const generatedImageFactory = dependencies.generatedImageContentServiceFactory || createGeneratedImageContentService;
  const staticFactory = dependencies.staticFileServiceFactory || createStaticFileService;

  const mediaFileService = mediaFactory({
    env: dependencies.env || process.env,
    runtimeRoot: dependencies.runtimeRoot,
    userHome: dependencies.userHome,
    codexHome: dependencies.codexHome,
    defaultCodexHome: dependencies.defaultCodexHome,
    readBody: dependencies.readBody,
    readRawBody: dependencies.readRawBody,
    readGlobalState: (...args) => dependencies.readGlobalState(...args),
    visibleWorkspaceRoots: dependencies.visibleWorkspaceRoots,
    normalizeFsPath: dependencies.normalizeFsPath,
    readStateDbThread: (...args) => dependencies.readStateDbThread(...args),
    readStartedThread: (...args) => dependencies.readStartedThread(...args),
    rolloutPathForThread: dependencies.rolloutPathForThread,
  });

  const IMAGE_EXTENSIONS = mediaFileService.imageExtensions;
  const FILE_PREVIEW_IMAGE_CONTENT_TYPES = mediaFileService.filePreviewImageContentTypes;
  const FILE_PREVIEW_MEDIA_MAX_BYTES = mediaFileService.filePreviewMediaMaxBytes;
  const UPLOAD_ROOT = mediaFileService.uploadRoot;
  const GENERATED_IMAGE_ROOT = mediaFileService.generatedImageRoot;

  const generatedImageContentService = generatedImageFactory({
    path: dependencies.path,
    generatedImageRoot: GENERATED_IMAGE_ROOT,
    filePreviewMediaMaxBytes: FILE_PREVIEW_MEDIA_MAX_BYTES,
    filePreviewImageContentTypes: FILE_PREVIEW_IMAGE_CONTENT_TYPES,
    generatedImageContentUrl: mediaFileService.generatedImageContentUrl,
    hasDeniedPreviewPathSegment: mediaFileService.hasDeniedPreviewPathSegment,
  });

  const staticFileService = staticFactory({
    publicRoot: dependencies.publicRoot,
    mimeFor: mediaFileService.mimeFor,
    getUrl: dependencies.getUrl,
    frameAncestorsHeader: dependencies.frameAncestorsHeader,
  });

  function serveFilePreviewContent(req, res, requestedPath, allowedRoots) {
    return mediaFileService.serveFilePreviewContent(
      req,
      res,
      requestedPath,
      allowedRoots,
      (status, body) => dependencies.sendJson(res, status, body),
    );
  }

  return Object.assign({}, mediaFileService, generatedImageContentService, staticFileService, {
    mediaFileService,
    generatedImageContentService,
    staticFileService,
    IMAGE_EXTENSIONS,
    FILE_PREVIEW_IMAGE_CONTENT_TYPES,
    FILE_PREVIEW_MEDIA_MAX_BYTES,
    UPLOAD_ROOT,
    GENERATED_IMAGE_ROOT,
    isCodexMobileUploadFilePath: (filePath) => mediaFileService.isPathInside(UPLOAD_ROOT, filePath),
    serveFilePreviewContent,
  });
}

module.exports = {
  createMediaStaticRuntimeService,
};
