"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root) {
    root.CodexThreadDetailState = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : null, function () {
  function defaultVisibleWeight(item) {
    return item ? JSON.stringify(item).length : 0;
  }

  function createThreadDetailStatePolicy(options = {}) {
    const itemVisibleWeight = typeof options.itemVisibleWeight === "function"
      ? options.itemVisibleWeight
      : defaultVisibleWeight;
    const isContextCompactionItem = typeof options.isContextCompactionItem === "function"
      ? options.isContextCompactionItem
      : () => false;
    const isOperationalItem = typeof options.isOperationalItem === "function"
      ? options.isOperationalItem
      : () => false;
    const isAssistantReceiptLikeItem = typeof options.isAssistantReceiptLikeItem === "function"
      ? options.isAssistantReceiptLikeItem
      : () => false;
    const isTurnComplete = typeof options.isTurnComplete === "function"
      ? options.isTurnComplete
      : () => false;
    const isReasoningItem = typeof options.isReasoningItem === "function"
      ? options.isReasoningItem
      : () => false;
    const visualReceiptMatchesSuppressionKeys = typeof options.visualReceiptMatchesSuppressionKeys === "function"
      ? options.visualReceiptMatchesSuppressionKeys
      : () => false;

    function completedIncomingTurnHasAuthoritativeReceipt(incomingTurn) {
      if (!incomingTurn || !isTurnComplete(incomingTurn) || !Array.isArray(incomingTurn.items)) return false;
      return incomingTurn.items.some((item) => isAssistantReceiptLikeItem(item));
    }

    function shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn = null) {
      return isAssistantReceiptLikeItem(item)
        && completedIncomingTurnHasAuthoritativeReceipt(incomingTurn);
    }

    function shouldPreserveLocalOnlyItem(item, preserveLocalVisible = false, suppressedVisualReceiptKeys = null, incomingTurn = null) {
      if (!item || itemVisibleWeight(item) <= 0) return false;
      if (visualReceiptMatchesSuppressionKeys(item, suppressedVisualReceiptKeys)) return false;
      if (shouldDropLocalOnlyReceiptForIncomingTurn(item, incomingTurn)) return false;
      if (item.type === "userMessage" && /^mux-user-/.test(String(item.id || ""))) return true;
      return preserveLocalVisible && !isReasoningItem(item);
    }

    function mergeItemPreservingVisibleFields(existingItem, incomingItem) {
      if (!existingItem || !incomingItem) return incomingItem || existingItem;
      const existingWeight = itemVisibleWeight(existingItem);
      const incomingWeight = itemVisibleWeight(incomingItem);
      if (existingWeight <= incomingWeight) return incomingItem;
      const merged = Object.assign({}, existingItem, incomingItem);
      if (typeof existingItem.text === "string") merged.text = existingItem.text;
      if (Array.isArray(existingItem.content)) merged.content = existingItem.content;
      if (Array.isArray(existingItem.summary)) merged.summary = existingItem.summary;
      if (isContextCompactionItem(existingItem) || isContextCompactionItem(incomingItem)) {
        if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileNotice")) delete merged.mobileNotice;
        if (!Object.prototype.hasOwnProperty.call(incomingItem, "mobileCompactionStatus")) delete merged.mobileCompactionStatus;
      } else if (existingItem.mobileNotice) {
        merged.mobileNotice = existingItem.mobileNotice;
      }
      if (isOperationalItem(existingItem)) {
        if (existingItem.command) merged.command = existingItem.command;
        if (Array.isArray(existingItem.fileNames)) merged.fileNames = existingItem.fileNames;
        if (existingItem.tool) merged.tool = existingItem.tool;
        if (existingItem.server) merged.server = existingItem.server;
        if (existingItem.namespace) merged.namespace = existingItem.namespace;
      }
      return merged;
    }

    return {
      completedIncomingTurnHasAuthoritativeReceipt,
      mergeItemPreservingVisibleFields,
      shouldDropLocalOnlyReceiptForIncomingTurn,
      shouldPreserveLocalOnlyItem,
    };
  }

  return {
    createThreadDetailStatePolicy,
  };
}));
