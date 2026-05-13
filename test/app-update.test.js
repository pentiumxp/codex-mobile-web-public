"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");

const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");

test("self-update UI explains supervisor-dependent restart", () => {
  assert.match(appJs, /等待重启…/);
  assert.match(appJs, /服务会退出并等待启动任务或守护脚本拉起/);
  assert.match(appJs, /手动启动的部署需要在服务停止后手动重启/);
  assert.match(appJs, /手动运行 node\/npm start 的部署需要手动重启/);
  assert.match(appJs, /如连接断开且未自动恢复，请在部署机手动重启/);
});

test("README documents manual-start update restart requirement", () => {
  assert.match(readme, /直接手动运行 `node server\.js`、`npm start` 或一次性 shell 命令/);
  assert.match(readme, /自更新会完成文件更新并停止旧服务/);
  assert.match(readme, /需要在部署机重新执行启动命令/);
});
