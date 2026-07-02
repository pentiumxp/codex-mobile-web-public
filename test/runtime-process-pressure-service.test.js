"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

const service = require("../services/runtime/runtime-process-pressure-service");

test("runtime process pressure classifies production, stale hotfix, app-server, browser, and Spotlight", () => {
  const psText = [
    "33840 1 hermes-host 14.4 3079088 32:15 Ss /runtime/node server.js",
    "26622 1 xuxin 0.2 631248 03-19:12:27 Ss /runtime/node /prod/codex-mobile-web/codex-app-server-mux.js app-server --analytics-default-enabled",
    "26623 26622 xuxin 50.7 3033504 03-19:12:27 R /Users/xuxin/.local/bin/codex app-server --analytics-default-enabled",
    "30001 26623 xuxin 0.0 102400 01-02:10:00 S /runtime/node/lib/node_modules/@colbymchenry/codegraph-darwin-arm64/node --liftoff-only codegraph.js serve --mcp",
    "30002 26623 xuxin 0.0 35088 15:22:34 S /runtime/node scripts/codex-mobile-mcp-server.js --server http://127.0.0.1:8787 --key-file /private/key",
    "30003 26623 xuxin 0.0 29952 15:22:34 S ./Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient mcp",
    "30004 26623 xuxin 0.0 8432 15:22:34 S /Applications/Codex.app/Contents/Resources/cua_node/bin/node_repl",
    "30005 26623 xuxin 0.0 1040 01-03:18:19 S dns-sd -B _http._tcp local.",
    "30006 26623 xuxin 0.0 1200 01-08:16:27 S /bin/zsh -c find /Users -maxdepth 5 -path '*codex-mobile-web*'",
    "78792 26623 xuxin 17.7 1485472 13:58:26 Ss node server.js --key-file /private/key",
    "65827 1 xuxin 0.0 214224 12:20:05 Ss /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --user-data-dir=/tmp/codex-mobile-browser-self-check-IQufw5",
    "325 1 _mds_stores 6.9 1962848 06-16:04:25 Rs /System/Library/CoreServices/mds_stores",
  ].join("\n");
  const lsofText = [
    "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME",
    "node    33840 xuxin  20u  IPv4 0x1      0t0  TCP 127.0.0.1:8787 (LISTEN)",
    "node    78792 xuxin  21u  IPv4 0x2      0t0  TCP 127.0.0.1:8788 (LISTEN)",
    "node    26622 xuxin  22u  IPv4 0x3      0t0  TCP 127.0.0.1:54498 (LISTEN)",
  ].join("\n");
  const cwdByPid = new Map([
    ["33840", "p33840\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n"],
    ["78792", "p78792\nfcwd\nn/Users/hermes-dev/HermesMobileDev/plugins/codex-mobile-web-combined-hotfix\n"],
    ["26622", "p26622\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n"],
    ["26623", "p26623\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n"],
  ]);

  const result = service.collectRuntimeProcessPressure({}, {
    execFileSync(command, args) {
      if (command === "ps") return psText;
      if (command === "lsof" && args.includes("-iTCP")) return lsofText;
      if (command === "lsof" && args.includes("-p")) return cwdByPid.get(args[args.indexOf("-p") + 1]) || "";
      if (command === "launchctl") {
        return [
          "system/com.hermesmobile.plugin.codex-mobile = {",
          "\tactive count = 1",
          "\tstate = running",
          "\tworking directory = /Users/hermes-host/HermesMobile/plugins/codex-mobile-web",
          "\tusername = hermes-host",
          "\tpid = 33840",
          "}",
        ].join("\n");
      }
      return "";
    },
    readFileSync() {
      return JSON.stringify({ pid: 26622, host: "127.0.0.1", port: 54498, protocol: "jsonl-tcp" });
    },
  });

  assert.equal(result.productionServerCount, 1);
  assert.equal(result.blockingIssueCount, 0);
  assert.equal(result.staleHotfixServerCount, 1);
  assert.equal(result.browserSelfCheckProcessCount, 1);
  assert.equal(result.codexAppServerCount, 1);
  assert.equal(result.activeAppServerMuxCount, 1);
  assert.equal(result.activeCodexAppServerCount, 1);
  assert.equal(result.staleAppServerMuxCount, 0);
  assert.equal(result.staleCodexAppServerCount, 0);
  assert.equal(result.appServerChildProcessCount, 7);
  assert.ok(result.appServerChildRssMb > 1600);
  assert.deepEqual(
    result.appServerChildGroups.map((group) => [group.kind, group.count]),
    [
      ["other-child", 1],
      ["codegraph-mcp", 1],
      ["codex-mobile-mcp", 1],
      ["computer-use-mcp", 1],
      ["node-repl", 1],
      ["dns-sd", 1],
      ["shell-command", 1],
    ],
  );
  assert.ok(result.appServerChildGroups.some((group) => group.kind === "dns-sd" && group.maxElapsed === "01-03:18:19"));
  assert.deepEqual(result.activeMuxEndpoint, {
    pid: 26622,
    host: "127.0.0.1",
    port: 54498,
    protocol: "jsonl-tcp",
  });
  assert.ok(result.codexOwnedCpuPercent > 80);
  assert.ok(result.codexOwnedRssMb > 7000);
  assert.ok(result.groups.some((group) => group.kind === "spotlight"));
  assert.doesNotMatch(JSON.stringify(result), /private\/key|Authorization|Bearer/i);
});

test("runtime process pressure flags production listener owner mismatch", () => {
  const psText = [
    "33840 1 xuxin 1.0 204800 00:10:00 Ss /runtime/node server.js",
    "33841 1 hermes-host 0.1 204800 00:10:00 S /runtime/node server.js",
  ].join("\n");
  const lsofText = [
    "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME",
    "node    33840 xuxin  20u  IPv4 0x1      0t0  TCP 127.0.0.1:8787 (LISTEN)",
  ].join("\n");
  const cwdByPid = new Map([
    ["33840", "p33840\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n"],
    ["33841", "p33841\nfcwd\nn/Users/hermes-host/HermesMobile/plugins/codex-mobile-web\n"],
  ]);

  const result = service.collectRuntimeProcessPressure({}, {
    execFileSync(command, args) {
      if (command === "ps") return psText;
      if (command === "lsof" && args.includes("-iTCP")) return lsofText;
      if (command === "lsof" && args.includes("-p")) return cwdByPid.get(args[args.indexOf("-p") + 1]) || "";
      if (command === "launchctl") {
        return [
          "system/com.hermesmobile.plugin.codex-mobile = {",
          "\tactive count = 1",
          "\tstate = running",
          "\tworking directory = /Users/hermes-host/HermesMobile/plugins/codex-mobile-web",
          "\tusername = hermes-host",
          "\tpid = 33840",
          "}",
        ].join("\n");
      }
      return "";
    },
    readFileSync() {
      return JSON.stringify({ pid: 0, host: "127.0.0.1", port: 0, protocol: "" });
    },
  });

  assert.equal(result.productionServerCount, 1);
  assert.equal(result.blockingIssueCount, 1);
  assert.equal(result.issues[0].code, "production_listener_owner_mismatch");
  assert.equal(result.issues[0].listenerPid, 33840);
  assert.equal(result.issues[0].listenerUser, "xuxin");
  assert.equal(result.issues[0].expectedUser, "hermes-host");
  assert.doesNotMatch(JSON.stringify(result), /private\/key|Authorization|Bearer/i);
});

test("runtime process pressure command redaction is bounded", () => {
  assert.equal(
    service.redactCommand("node script.js --key-file /Users/me/access_key Authorization: Bearer abc123 access_key=secret"),
    "node script.js --key-file <redacted> Authorization: Bearer <redacted> access_key=<redacted>",
  );
});
