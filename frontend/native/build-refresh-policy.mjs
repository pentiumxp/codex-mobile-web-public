function normalizeBuildId(value) {
  return String(value || "").trim();
}

export function shellSequenceFromBuildId(value) {
  const match = normalizeBuildId(value).match(/\bcodex-mobile-shell-v([0-9]+)\b/);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function classifyServerBuildChange(serverBuildId, clientBuildId) {
  const server = normalizeBuildId(serverBuildId);
  const client = normalizeBuildId(clientBuildId);
  if (!server || !client || server === client) return "same";

  const serverSeq = shellSequenceFromBuildId(server);
  const clientSeq = shellSequenceFromBuildId(client);
  if (serverSeq !== null && clientSeq !== null) {
    if (serverSeq > clientSeq) return "server-newer";
    if (serverSeq < clientSeq) return "client-newer";
  }

  return "changed";
}

export function shouldPromptForServerBuildChange(serverBuildId, clientBuildId) {
  const direction = classifyServerBuildChange(serverBuildId, clientBuildId);
  return direction === "server-newer" || direction === "changed";
}

export default {
  shellSequenceFromBuildId,
  classifyServerBuildChange,
  shouldPromptForServerBuildChange,
};
