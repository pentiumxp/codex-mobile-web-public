"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
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

const brotliDecompress = promisify(zlib.brotliDecompress);
const gunzip = promisify(zlib.gunzip);
const root = path.resolve(__dirname, "..");

function requestStatic(pathname, acceptEncoding = "") {
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
    serveStatic(req, res);
  });
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
  const classic = await requestStatic("/");
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

test("static compression ignores q=0 encodings and serves svg as text", () => {
  const req = { headers: { "accept-encoding": "br;q=0, gzip;q=0" } };

  assert.equal(staticCompressionEncoding(req, path.join(root, "public", "app.js"), 2048), "");
  assert.equal(mimeFor("icon.svg"), "image/svg+xml; charset=utf-8");
});
