"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const adapter = require("../adapters/media-static-runtime-service");
const service = require("../services/runtime/media-static-runtime-service");

test("media/static runtime adapter re-exports canonical runtime service", () => {
  assert.equal(adapter.createMediaStaticRuntimeService, service.createMediaStaticRuntimeService);
});

test("media/static runtime composition wires media, generated images, static files, and preview response", () => {
  const calls = [];
  const runtime = service.createMediaStaticRuntimeService({
    env: {},
    path: require("node:path"),
    runtimeRoot: "/runtime",
    userHome: "/home",
    codexHome: "/codex",
    defaultCodexHome: "/default-codex",
    publicRoot: "/public",
    defaultShellMode: "vite-app-preview",
    readBody: async () => ({}),
    readRawBody: async () => Buffer.alloc(0),
    readGlobalState: () => ({ ok: true }),
    visibleWorkspaceRoots: () => ["/repo"],
    normalizeFsPath: (value) => String(value || ""),
    readStateDbThread: () => null,
    readStartedThread: () => null,
    rolloutPathForThread: () => "",
    getUrl: () => new URL("http://127.0.0.1/"),
    frameAncestorsHeader: () => "'self'",
    sendJson: (res, status, body) => calls.push({ res, status, body }),
    mediaFileServiceFactory: (options) => {
      calls.push({ type: "media", options });
      return {
        imageExtensions: new Set([".png"]),
        filePreviewImageContentTypes: new Map([[".png", "image/png"]]),
        filePreviewMediaMaxBytes: 123,
        uploadRoot: "/runtime/uploads",
        generatedImageRoot: "/runtime/generated",
        generatedImageContentUrl: (id) => `/generated/${id}`,
        hasDeniedPreviewPathSegment: () => false,
        mimeFor: () => "text/plain",
        isPathInside: (root, filePath) => String(filePath).startsWith(root),
        serveFilePreviewContent: (req, res, requestedPath, allowedRoots, sendJson) => {
          sendJson(200, { requestedPath, allowedRoots });
          return "served";
        },
        readMessageBody: () => "body",
        buildTurnInput: () => [],
      };
    },
    generatedImageContentServiceFactory: (options) => {
      calls.push({ type: "generated", options });
      return {
        attachGeneratedImageContent: (item) => item,
      };
    },
    staticFileServiceFactory: (options) => {
      calls.push({ type: "static", options });
      return {
        serveStatic: () => {},
        clearStaticCompressionCache: () => {},
        staticCompressionCacheStats: () => ({}),
        staticCompressionEncoding: () => "",
      };
    },
  });

  assert.equal(runtime.UPLOAD_ROOT, "/runtime/uploads");
  assert.equal(runtime.GENERATED_IMAGE_ROOT, "/runtime/generated");
  assert.equal(runtime.isCodexMobileUploadFilePath("/runtime/uploads/a.png"), true);
  assert.equal(runtime.isCodexMobileUploadFilePath("/else/a.png"), false);
  assert.equal(runtime.serveFilePreviewContent({}, "res", "/file.png", ["/repo"]), "served");
  assert.deepEqual(calls.at(-1), {
    res: "res",
    status: 200,
    body: { requestedPath: "/file.png", allowedRoots: ["/repo"] },
  });
  assert.equal(calls.find((entry) => entry.type === "generated").options.generatedImageRoot, "/runtime/generated");
  assert.equal(calls.find((entry) => entry.type === "static").options.publicRoot, "/public");
  assert.equal(calls.find((entry) => entry.type === "static").options.defaultShellMode, "vite-app-preview");
});

test("media/static runtime reads default shell mode from env for static service", () => {
  let staticOptions = null;
  service.createMediaStaticRuntimeService({
    env: { CODEX_MOBILE_DEFAULT_SHELL: "app-preview" },
    path: require("node:path"),
    runtimeRoot: "/runtime",
    userHome: "/home",
    codexHome: "/codex",
    defaultCodexHome: "/default-codex",
    publicRoot: "/public",
    readBody: async () => ({}),
    readRawBody: async () => Buffer.alloc(0),
    readGlobalState: () => ({}),
    visibleWorkspaceRoots: () => [],
    normalizeFsPath: (value) => String(value || ""),
    readStateDbThread: () => null,
    readStartedThread: () => null,
    rolloutPathForThread: () => "",
    getUrl: () => new URL("http://127.0.0.1/"),
    frameAncestorsHeader: () => "'self'",
    sendJson: () => {},
    mediaFileServiceFactory: () => ({
      imageExtensions: new Set(),
      filePreviewImageContentTypes: new Map(),
      filePreviewMediaMaxBytes: 1,
      uploadRoot: "/runtime/uploads",
      generatedImageRoot: "/runtime/generated",
      generatedImageContentUrl: () => "",
      hasDeniedPreviewPathSegment: () => false,
      mimeFor: () => "text/plain",
      isPathInside: () => false,
      serveFilePreviewContent: () => {},
    }),
    generatedImageContentServiceFactory: () => ({}),
    staticFileServiceFactory: (options) => {
      staticOptions = options;
      return {
        serveStatic: () => {},
        clearStaticCompressionCache: () => {},
        staticCompressionCacheStats: () => ({}),
        staticCompressionEncoding: () => "",
      };
    },
  });

  assert.equal(staticOptions.defaultShellMode, "app-preview");
});
