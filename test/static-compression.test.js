"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { test } = require("node:test");
const { promisify } = require("node:util");

const {
  clearStaticCompressionCache,
  mimeFor,
  serveStatic,
  staticCompressionCacheStats,
  staticCompressionEncoding,
} = require("../server");
const {
  DEFAULT_SHELL_MODE_CLASSIC,
  DEFAULT_SHELL_MODE_VITE_APP_PREVIEW,
  createStaticFileService,
  normalizeDefaultShellMode,
} = require("../adapters/static-file-service");

const brotliDecompress = promisify(zlib.brotliDecompress);
const gunzip = promisify(zlib.gunzip);
const root = path.resolve(__dirname, "..");

function requestStaticFrom(serve, pathname, acceptEncoding = "") {
  return new Promise((resolve) => {
    const chunks = [];
    const req = {
      url: pathname,
      headers: {
        host: "localhost",
        "accept-encoding": acceptEncoding,
      },
    };
    const res = {
      statusCode: 0,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status;
        this.headers = headers || {};
      },
      end(chunk) {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        resolve({
          statusCode: this.statusCode,
          headers: this.headers,
          body: Buffer.concat(chunks),
        });
      },
    };
    serve(req, res);
  });
}

function requestStatic(pathname, acceptEncoding = "") {
  return requestStaticFrom(serveStatic, pathname, acceptEncoding);
}

test("static assets prefer brotli compression for large text resources", async () => {
  clearStaticCompressionCache();
  const raw = fs.readFileSync(path.join(root, "public", "pane-layout-runtime.js"));
  const response = await requestStatic("/pane-layout-runtime.js", "br, gzip");
  const statsAfterFirst = staticCompressionCacheStats();
  const secondResponse = await requestStatic("/pane-layout-runtime.js", "br, gzip");
  const statsAfterSecond = staticCompressionCacheStats();

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Content-Encoding"], "br");
  assert.equal(response.headers.Vary, "Accept-Encoding");
  assert.equal(response.headers["Content-Type"], "text/javascript; charset=utf-8");
  assert.ok(response.body.length < raw.length, "compressed body should be smaller than raw runtime asset");
  assert.deepEqual(await brotliDecompress(response.body), raw);
  assert.deepEqual(secondResponse.body, response.body);
  assert.equal(statsAfterFirst.entries, 1);
  assert.equal(statsAfterSecond.entries, 1);
  assert.equal(statsAfterSecond.bytes, statsAfterFirst.bytes);
});

test("static assets fall back to gzip when brotli is not accepted", async () => {
  clearStaticCompressionCache();
  const raw = fs.readFileSync(path.join(root, "public", "styles.css"));
  const response = await requestStatic("/styles.css", "gzip");

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Content-Encoding"], "gzip");
  assert.equal(response.headers.Vary, "Accept-Encoding");
  assert.ok(response.body.length < raw.length, "compressed body should be smaller than raw styles.css");
  assert.deepEqual(await gunzip(response.body), raw);
  assert.equal(staticCompressionCacheStats().entries, 1);
});

test("static compression leaves already-compressed images unencoded", async () => {
  const response = await requestStatic("/icons/icon-192.png", "br, gzip");

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Content-Encoding"], undefined);
  assert.equal(response.headers.Vary, undefined);
  assert.equal(response.headers["Content-Type"], "image/png");
  assert.ok(response.body.length > 0);
});

test("static root keeps classic shell unless Vite app-preview is explicitly requested", async () => {
  const classicStatic = createStaticFileService({
    publicRoot: path.join(root, "public"),
    mimeFor,
    defaultShellMode: "classic",
  });
  const classic = await requestStaticFrom(classicStatic.serveStatic, "/");
  const appPreview = await requestStatic("/?codexViteShell=app-preview");
  const classicText = classic.body.toString("utf8");
  const appPreviewText = appPreview.body.toString("utf8");

  assert.equal(classic.statusCode, 200);
  assert.match(classicText, /CODEX_MOBILE_SHELL_SCRIPTS:BEGIN/);
  assert.doesNotMatch(classicText, /data-codex-vite-app-preview="true"/);

  assert.equal(appPreview.statusCode, 200);
  assert.match(appPreviewText, /data-codex-vite-app-preview="true"/);
  assert.match(appPreviewText, /id="codex-vite-app-preview-loader-plan"/);
  assert.doesNotMatch(appPreviewText, /CODEX_MOBILE_SHELL_SCRIPTS:BEGIN/);
});

test("default shell mode is fail-closed unless app-preview is explicit", () => {
  assert.equal(normalizeDefaultShellMode(""), DEFAULT_SHELL_MODE_CLASSIC);
  assert.equal(normalizeDefaultShellMode("classic-script-fallback"), DEFAULT_SHELL_MODE_CLASSIC);
  assert.equal(normalizeDefaultShellMode("unexpected"), DEFAULT_SHELL_MODE_CLASSIC);
  assert.equal(normalizeDefaultShellMode("app-preview"), DEFAULT_SHELL_MODE_VITE_APP_PREVIEW);
  assert.equal(normalizeDefaultShellMode("vite-app-preview"), DEFAULT_SHELL_MODE_VITE_APP_PREVIEW);
});

test("static root can be switched to Vite app-preview with explicit default shell mode", async () => {
  const appPreviewStatic = createStaticFileService({
    publicRoot: path.join(root, "public"),
    mimeFor,
    defaultShellMode: "vite-app-preview",
  });
  const invalidStatic = createStaticFileService({
    publicRoot: path.join(root, "public"),
    mimeFor,
    defaultShellMode: "rollout-next",
  });
  const appPreview = await requestStaticFrom(appPreviewStatic.serveStatic, "/");
  const invalidFallback = await requestStaticFrom(invalidStatic.serveStatic, "/");
  const appPreviewText = appPreview.body.toString("utf8");
  const invalidFallbackText = invalidFallback.body.toString("utf8");

  assert.equal(appPreview.statusCode, 200);
  assert.match(appPreviewText, /data-codex-vite-app-preview="true"/);
  assert.match(appPreviewText, /id="codex-vite-app-preview-loader-plan"/);
  assert.doesNotMatch(appPreviewText, /CODEX_MOBILE_SHELL_SCRIPTS:BEGIN/);

  assert.equal(invalidFallback.statusCode, 200);
  assert.match(invalidFallbackText, /CODEX_MOBILE_SHELL_SCRIPTS:BEGIN/);
  assert.doesNotMatch(invalidFallbackText, /data-codex-vite-app-preview="true"/);
});

test("stale Vite hashed shell entry falls back to the stable app-preview entry", async () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-static-vite-entry-"));
  try {
    const stableEntry = "import \"/vite-shell/assets/vite-shell-entry-current.js\";\n";
    fs.mkdirSync(path.join(tempRoot, "vite-shell"), { recursive: true });
    fs.writeFileSync(path.join(tempRoot, "vite-shell", "app-preview-entry.js"), stableEntry);
    const staticService = createStaticFileService({
      publicRoot: tempRoot,
      mimeFor,
      defaultShellMode: "vite-app-preview",
    });
    const staleEntry = await requestStaticFrom(
      staticService.serveStatic,
      "/vite-shell/assets/vite-shell-entry-old.js"
    );
    const unrelatedMissing = await requestStaticFrom(
      staticService.serveStatic,
      "/vite-shell/assets/vite-entry-group-old.js"
    );

    assert.equal(staleEntry.statusCode, 200);
    assert.equal(staleEntry.headers["Content-Type"], "text/javascript; charset=utf-8");
    assert.equal(staleEntry.body.toString("utf8"), stableEntry);
    assert.equal(unrelatedMissing.statusCode, 404);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("static compression ignores q=0 encodings and serves svg as text", () => {
  const req = { headers: { "accept-encoding": "br;q=0, gzip;q=0" } };

  assert.equal(staticCompressionEncoding(req, path.join(root, "public", "app.js"), 2048), "");
  assert.equal(mimeFor("icon.svg"), "image/svg+xml; charset=utf-8");
});
