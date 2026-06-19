"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

test("composer exposes Fast bolt, model, reasoning, permission, and quota as compact controls", () => {
  assert.match(indexHtml, /id="composerCommandControl"/);
  assert.match(indexHtml, /class="composer-fast-toggle"/);
  assert.match(indexHtml, /class="composer-fast-icon"/);
  assert.doesNotMatch(indexHtml, /composer-fast-dot/);
  assert.match(indexHtml, /id="composerModelControl"/);
  assert.match(indexHtml, /id="composerEffortControl"/);
  assert.match(indexHtml, /id="composerPermissionControl"/);
  assert.match(indexHtml, /id="quotaUsage"/);
  assert.match(indexHtml, /class="composer-chip-label">模型/);
  assert.match(indexHtml, /class="composer-chip-label">推理强度/);
  assert.match(indexHtml, /class="composer-chip-label">权限/);
  assert.match(appJs, /function openComposerRuntimeMenu\(/);
  assert.match(appJs, /function handleComposerRuntimeControl\(/);
  assert.match(appJs, /function applyRuntimeSelection\(/);
  assert.match(appJs, /setCodexFastCommandEnabled\(!codexFastCommandEnabled\(\)\)/);
  assert.match(appJs, /showComposerFastHint\(state\.codexFastMode\)/);
  assert.match(stylesCss, /\.composer-fast-toggle/);
  assert.match(stylesCss, /\.composer-fast-icon/);
  assert.match(appJs, /body\.append\("fastMode", "1"\)/);
  assert.doesNotMatch(appJs, /\/Fast\\n\\n/);
  assert.match(appJs, /body\.append\("model", selectedComposerModel\(\)\)/);
  assert.match(appJs, /body\.append\("effort", selectedComposerEffort\(\)\)/);
});

test("permission uses the custom runtime picker instead of native select", () => {
  assert.match(indexHtml, /id="composerRuntimeMenu"/);
  assert.ok(
    indexHtml.indexOf('id="composerRuntimeMenu"') > indexHtml.indexOf("</form>"),
    "runtime menu should be a page-level overlay, not a composer-form child",
  );
  assert.ok(
    indexHtml.indexOf('id="quotaDetailPanel"') > indexHtml.indexOf("</form>"),
    "quota detail panel should be a page-level overlay, not a composer-form child",
  );
  assert.match(appJs, /body\.append\("permissionMode", selectedComposerPermissionMode\(\)\)/);
  assert.match(appJs, /defaultPermissionMode/);
  assert.match(appJs, /if \(sandboxType === "dangerfullaccess"\) return "full"/);
  assert.doesNotMatch(indexHtml, /id="permissionSelect"/);
  assert.doesNotMatch(stylesCss, /\.permission-select-wrap/);
});

test("runtime picker has iOS WebView click fallback and bounded diagnostics", () => {
  assert.match(appJs, /button\.addEventListener\("pointerdown"/);
  assert.match(appJs, /button\.addEventListener\("click"/);
  assert.match(appJs, /state\.lastComposerRuntimePointerTarget === button/);
  assert.match(appJs, /Date\.now\(\) - state\.lastComposerRuntimePointerAt < 1500/);
  assert.match(appJs, /state\.lastComposerRuntimePointerTarget = null/);
  assert.match(appJs, /postClientEvent\("composer_runtime_menu_opened"/);
  assert.match(appJs, /postClientEvent\("composer_runtime_control_ignored"/);
  assert.match(appJs, /querySelectorAll\("\[data-runtime-kind\]\[data-runtime-value\]"\)\.length/);
});

test("quota card separates inline summary from detail panel", () => {
  assert.match(indexHtml, /id="quotaDetailPanel"/);
  assert.match(appJs, /function quotaInlineHtml\(/);
  assert.match(appJs, /function renderQuotaDetailPanel\(/);
  assert.match(appJs, /quotaDetailLineHtml\("5小时额度", fiveHour, 60\)/);
  assert.match(appJs, /quotaDetailLineHtml\("周额度", weekly, 1440\)/);
  assert.match(stylesCss, /\.quota-detail-panel/);
  assert.match(stylesCss, /\.quota-detail-track/);
  assert.match(stylesCss, /\.quota-ok \.quota-detail-value/);
  assert.match(stylesCss, /\.quota-warn \.quota-detail-value/);
  assert.match(stylesCss, /\.quota-danger \.quota-detail-value/);
});

test("phone composer controls stay in one compact status row", () => {
  const mobileIndex = stylesCss.indexOf("@media (max-width: 760px)");
  assert.ok(mobileIndex > 0, "missing mobile media query");

  const mobileBody = stylesCss.slice(mobileIndex);
  assert.match(mobileBody, /\.composer-controls\s*{[\s\S]*--composer-control-height:\s*30px;/);
  assert.match(mobileBody, /\.conversation\s*{[\s\S]*padding:\s*14px 12px;/);
  assert.match(mobileBody, /\.composer\s*{[\s\S]*position:\s*relative;[\s\S]*width:\s*100%;/);
  assert.match(mobileBody, /\.composer\s*{[\s\S]*padding:\s*7px 12px clamp\(8px,\s*calc\(env\(safe-area-inset-bottom,\s*0px\) - 88px\),\s*52px\);/);
  assert.doesNotMatch(mobileBody, /\.composer\s*{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*0;/);
  assert.match(mobileBody, /\.composer-controls\s*{[\s\S]*grid-template-columns:\s*28px minmax\(0,\s*0\.96fr\) minmax\(0,\s*0\.78fr\) minmax\(0,\s*0\.84fr\) minmax\(0,\s*1\.06fr\);/);
  assert.match(mobileBody, /\.composer-control-card\s*{[\s\S]*padding:\s*4px 5px;/);
  assert.match(mobileBody, /\.quota-usage\s*{[\s\S]*padding-inline:\s*4px;/);
  assert.match(mobileBody, /\.quota-inline-sep\s*{[\s\S]*display:\s*inline-block;/);
  assert.match(mobileBody, /\.quota-chip-reset-prefix\s*{[\s\S]*display:\s*none;/);
});

test("tablet landscape composer controls stay compact with Fast bolt", () => {
  const tabletIndex = stylesCss.indexOf("@media (pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)");
  assert.ok(tabletIndex > 0, "missing tablet landscape media query");

  const tabletBody = stylesCss.slice(tabletIndex, stylesCss.indexOf("@media (max-width: 760px)"));
  assert.match(tabletBody, /grid-template-columns:\s*clamp\(340px,\s*36vw,\s*400px\) minmax\(0,\s*1fr\);/);
  assert.match(tabletBody, /\.composer-controls\s*{[\s\S]*grid-template-columns:\s*28px minmax\(0,\s*0\.96fr\) minmax\(0,\s*0\.78fr\) minmax\(0,\s*0\.84fr\) minmax\(0,\s*1\.06fr\);/);
});

test("composer control row uses fixed heights", () => {
  assert.match(stylesCss, /--composer-control-height:\s*44px;/);
  assert.match(stylesCss, /\.composer-control-card\s*{[\s\S]*height:\s*var\(--composer-control-height\);/);
  assert.match(stylesCss, /\.composer-runtime-menu/);
  assert.match(stylesCss, /\.quota-detail-panel/);
  assert.match(stylesCss, /\.composer-runtime-menu,[\s\S]*\.quota-detail-panel\s*\{[\s\S]*z-index:\s*130;/);
  assert.match(stylesCss, /max-height:\s*min\(var\(--composer-popup-max-height,\s*45vh\),\s*360px\);/);
  assert.match(appJs, /window\.visualViewport/);
  assert.match(appJs, /--composer-popup-max-height/);
});
