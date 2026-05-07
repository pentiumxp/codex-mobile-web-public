#!/usr/bin/env node
"use strict";

let buffer = "";
let emittedApproval = false;

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(message) {
  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: { userAgent: "mock-codex-app-server" },
    });
    if (!emittedApproval) {
      emittedApproval = true;
      setTimeout(() => {
        send({
          jsonrpc: "2.0",
          id: 0,
          method: "item/commandExecution/requestApproval",
          params: {
            threadId: "thread-1",
            turnId: "turn-1",
            command: "echo hello",
            reason: "mock approval",
          },
        });
      }, 20);
    }
    return;
  }

  if (message.method === "test/emitNotifications") {
    const count = Math.max(0, Number(message.params && message.params.count || 0));
    for (let i = 0; i < count; i += 1) {
      send({
        jsonrpc: "2.0",
        method: "thread/status/changed",
        params: {
          threadId: "thread-1",
          status: { type: "mock", index: i },
        },
      });
    }
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: { emitted: count },
    });
    return;
  }

  if (message.method === "turn/start") {
    const threadId = message.params && message.params.threadId || "thread-1";
    const turnId = `turn-${Date.now()}`;
    send({
      jsonrpc: "2.0",
      method: "turn/started",
      params: {
        threadId,
        turn: {
          id: turnId,
          status: { type: "running" },
        },
      },
    });
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        threadId,
        turnId,
      },
    });
    return;
  }

  if (Object.prototype.hasOwnProperty.call(message, "id") && !message.method) {
    send({
      jsonrpc: "2.0",
      method: "serverRequest/resolved",
      params: { requestId: message.id },
    });
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    try {
      handle(JSON.parse(line));
    } catch (err) {
      process.stderr.write(`mock parse error: ${err.message}\n`);
    }
  }
});
