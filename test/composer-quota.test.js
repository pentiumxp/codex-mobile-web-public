"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const appJs = fs.readFileSync(path.resolve(__dirname, "..", "public", "app.js"), "utf8");
const indexHtml = fs.readFileSync(path.resolve(__dirname, "..", "public", "index.html"), "utf8");
const stylesCss = fs.readFileSync(path.resolve(__dirname, "..", "public", "styles.css"), "utf8");

test("composer combines model and reasoning into one readonly field", () => {
  assert.match(indexHtml, /id="modelEffortDisplay"/);
  assert.doesNotMatch(indexHtml, /id="modelDisplay"/);
  assert.doesNotMatch(indexHtml, /id="effortDisplay"/);
  assert.match(indexHtml, /class="composer-chip-label">模型/);
  assert.match(appJs, /modelValue\.textContent = `\$\{modelText\} · \$\{effortText\}`;/);
  assert.match(appJs, /modelValue\.dataset\.mobileText = `\$\{compactModelText\} \$\{effortText\} · \$\{permissionText\}`;/);
});

test("composer shows permission as readonly display", () => {
  assert.match(indexHtml, /id="permissionDisplay"/);
  assert.match(indexHtml, /class="composer-chip-label">权限/);
  assert.doesNotMatch(indexHtml, /id="permissionSelect"/);
  assert.doesNotMatch(appJs, /body\.append\("permissionMode"/);
  assert.doesNotMatch(appJs, /setSelectedPermissionModeForCurrentThread/);
});

test("quota chips show separate reset-aware windows with severity colors", () => {
  assert.match(appJs, /quotaChipHtml\("5小时", fiveHour, 60\)/);
  assert.match(appJs, /quotaChipHtml\("周额度", weekly, 1440\)/);
  assert.match(appJs, /function quotaRiskLevel\(windowInfo, nearResetMinutes\)/);
  assert.match(appJs, /quota-chip-compact-label/);
  assert.match(appJs, /quota-chip-reset-prefix/);
  assert.match(stylesCss, /\.quota-ok \.quota-chip-value\s*{[\s\S]*#047857/);
  assert.match(stylesCss, /\.quota-warn \.quota-chip-value\s*{[\s\S]*#b45309/);
  assert.match(stylesCss, /\.quota-danger \.quota-chip-value\s*{[\s\S]*#b91c1c/);
});

test("phone composer controls stay in one compact status row", () => {
  const mobileIndex = stylesCss.indexOf("@media (max-width: 760px)");
  assert.ok(mobileIndex > 0, "missing mobile media query");

  const mobileBody = stylesCss.slice(mobileIndex);
  assert.match(mobileBody, /\.composer-controls\s*{[\s\S]*--composer-control-height:\s*30px;/);
  assert.match(mobileBody, /\.composer-controls\s*{[\s\S]*grid-template-columns:\s*minmax\(106px,\s*1fr\) minmax\(94px,\s*0\.88fr\) minmax\(112px,\s*1\.02fr\);/);
  assert.match(mobileBody, /\.permission-select-wrap\s*{[\s\S]*display:\s*none;/);
  assert.match(mobileBody, /\.quota-chip-reset-prefix\s*{[\s\S]*display:\s*none;/);
});

test("tablet landscape composer controls stay as four cards", () => {
  const tabletIndex = stylesCss.indexOf("@media (pointer: coarse) and (orientation: landscape) and (min-width: 900px) and (min-height: 600px)");
  assert.ok(tabletIndex > 0, "missing tablet landscape media query");

  const tabletBody = stylesCss.slice(tabletIndex, stylesCss.indexOf("@media (max-width: 760px)"));
  assert.match(tabletBody, /grid-template-columns:\s*clamp\(340px,\s*36vw,\s*400px\) minmax\(0,\s*1fr\);/);
  assert.match(tabletBody, /\.composer-controls\s*{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*0\.85fr\) repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
});

test("composer control row uses fixed heights", () => {
  assert.match(stylesCss, /--composer-control-height:\s*44px;/);
  assert.match(stylesCss, /\.composer-select,\s*\n\.composer-readonly-value\s*{[\s\S]*height:\s*var\(--composer-control-height\);/);
  assert.match(stylesCss, /\.quota-chip\s*{[\s\S]*height:\s*var\(--composer-control-height\);/);
  assert.match(stylesCss, /\.quota-chip-reset\s*{[\s\S]*white-space:\s*nowrap;/);
});
