"use strict";

function wireUi() {
  $("loginForm").addEventListener("submit", (event) => {
    event.preventDefault();
    login($("loginKey").value.trim()).catch((err) => showLogin(err.message));
  });
  const sidebarWorkspaceSelect = $("workspaceSelect");
  const sidebarWorkspaceMenu = $("workspaceSelectMenu");
  if (sidebarWorkspaceSelect && sidebarWorkspaceMenu) {
    const closeSidebarWorkspaceMenu = () => {
      sidebarWorkspaceMenu.hidden = true;
      sidebarWorkspaceMenu.style.removeProperty("--workspace-menu-max-height");
      sidebarWorkspaceSelect.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", onSidebarWorkspaceOutsidePointer);
    };
    const onSidebarWorkspaceOption = (event) => {
      const createOption = event.target.closest("[data-create-workspace]");
      if (createOption) {
        event.preventDefault();
        event.stopPropagation();
        closeSidebarWorkspaceMenu();
        openCreateWorkspaceDialog();
        return;
      }
      const option = event.target.closest("[data-workspace-value]");
      if (!option) return;
      const selectedWorkspace = option.dataset.workspaceValue || "";
      event.preventDefault();
      event.stopPropagation();
      selectWorkspaceShortcut(selectedWorkspace).catch(showError);
      closeSidebarWorkspaceMenu();
    };
    const onSidebarWorkspaceOutsidePointer = (event) => {
      if (!sidebarWorkspaceMenu.hidden && !sidebarWorkspaceMenu.contains(event.target) && !sidebarWorkspaceSelect.contains(event.target)) {
        closeSidebarWorkspaceMenu();
      }
    };
    const openSidebarWorkspaceMenu = () => {
      sidebarWorkspaceMenu.hidden = false;
      fitWorkspaceMenuToViewport(sidebarWorkspaceMenu, sidebarWorkspaceSelect, { avoidComposer: false });
      sidebarWorkspaceSelect.setAttribute("aria-expanded", "true");
      document.addEventListener("pointerdown", onSidebarWorkspaceOutsidePointer);
    };
    const toggleSidebarWorkspaceMenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (sidebarWorkspaceSelect.disabled) return;
      if (sidebarWorkspaceMenu.hidden) {
        openSidebarWorkspaceMenu();
      } else {
        closeSidebarWorkspaceMenu();
      }
    };
    sidebarWorkspaceSelect.addEventListener("pointerdown", toggleSidebarWorkspaceMenu);
    sidebarWorkspaceMenu.addEventListener("click", onSidebarWorkspaceOption);
    closeSidebarWorkspaceMenu();
  }
  const workspaceTokenUsage = $("workspaceTokenUsage");
  if (workspaceTokenUsage) {
    workspaceTokenUsage.addEventListener("click", (event) => {
      const button = event.target && event.target.closest("[data-workspace-token-usage-toggle]");
      if (!button) return;
      openWorkspaceStatsDialog();
    });
  }
  const workspaceStatsClose = $("workspaceStatsClose");
  if (workspaceStatsClose) workspaceStatsClose.addEventListener("click", closeWorkspaceStatsDialog);
  const workspaceStatsDialog = $("workspaceStatsDialog");
  if (workspaceStatsDialog) {
    workspaceStatsDialog.addEventListener("click", (event) => {
      if (event.target === workspaceStatsDialog) closeWorkspaceStatsDialog();
    });
  }
  $("newThreadButton").addEventListener("click", enterNewThreadDraft);
  $("refreshThreads").addEventListener("click", () => loadThreads().catch(showError));
  $("pushNotifications").addEventListener("click", () => handlePushButtonClick().catch(showError));
  if ($("appUpdateStatus")) $("appUpdateStatus").addEventListener("click", openUpdatePanel);
  if ($("publicPrStatus")) $("publicPrStatus").addEventListener("click", () => handlePublicPrStatusClick().catch(showError));
  if ($("updateDialogClose")) $("updateDialogClose").addEventListener("click", closeUpdatePanel);
  if ($("updatePanelContent")) $("updatePanelContent").addEventListener("click", handleUpdatePanelClick);
  if ($("updateDialog")) $("updateDialog").addEventListener("click", (event) => {
    if (event.target === $("updateDialog")) closeUpdatePanel();
  });
  if ($("hardRefreshButton")) $("hardRefreshButton").addEventListener("click", () => handleHardRefreshClick().catch(showError));
  if ($("sharedRestartButton")) $("sharedRestartButton").addEventListener("click", () => handleSharedRestartClick().catch(showError));
  if ($("restartConfirmCancel")) $("restartConfirmCancel").addEventListener("click", () => closeSharedRestartDialog(false));
  if ($("restartConfirmProceed")) $("restartConfirmProceed").addEventListener("click", () => closeSharedRestartDialog(true));
  if ($("restartConfirmDialog")) $("restartConfirmDialog").addEventListener("click", (event) => {
    if (event.target === $("restartConfirmDialog")) closeSharedRestartDialog(false);
  });
  if ($("profileSwitchConfirmCancel")) $("profileSwitchConfirmCancel").addEventListener("click", () => closeCodexProfileSwitchDialog(false));
  if ($("profileSwitchConfirmProceed")) $("profileSwitchConfirmProceed").addEventListener("click", () => closeCodexProfileSwitchDialog(true));
  if ($("profileSwitchConfirmDialog")) $("profileSwitchConfirmDialog").addEventListener("click", (event) => {
    if (event.target === $("profileSwitchConfirmDialog")) closeCodexProfileSwitchDialog(false);
  });
  if ($("threadArchiveConfirmCancel")) $("threadArchiveConfirmCancel").addEventListener("click", () => closeThreadArchiveDialog(false));
  if ($("threadArchiveConfirmProceed")) $("threadArchiveConfirmProceed").addEventListener("click", () => closeThreadArchiveDialog(true));
  if ($("threadArchiveConfirmDialog")) $("threadArchiveConfirmDialog").addEventListener("click", (event) => {
    if (event.target === $("threadArchiveConfirmDialog")) closeThreadArchiveDialog(false);
  });
  if ($("appNativeDialogCancel")) $("appNativeDialogCancel").addEventListener("click", () => closeAppNativeDialog(false));
  if ($("appNativeDialogProceed")) $("appNativeDialogProceed").addEventListener("click", () => closeAppNativeDialog(true));
  if ($("appNativeDialog")) {
    $("appNativeDialog").addEventListener("click", (event) => {
      if (event.target === $("appNativeDialog")) closeAppNativeDialog(false);
    });
    $("appNativeDialog").addEventListener("keydown", handleAppNativeDialogKeydown);
  }
  if ($("goalForm")) $("goalForm").addEventListener("submit", (event) => submitThreadGoalMessage(event).catch(showError));
  if ($("goalObjectiveInput")) $("goalObjectiveInput").addEventListener("keydown", requestGoalDialogSubmitFromEnter);
  if ($("goalTokenBudgetInput")) $("goalTokenBudgetInput").addEventListener("keydown", requestGoalDialogSubmitFromEnter);
  if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("pointerdown", requestGoalDialogSubmitFromButton);
  if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("pointerup", requestGoalDialogSubmitFromButton);
  if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("touchend", requestGoalDialogSubmitFromButton, { passive: false });
  if ($("goalSubmitButton")) $("goalSubmitButton").addEventListener("click", requestGoalDialogSubmitFromButton);
  if ($("goalContinueButton")) $("goalContinueButton").addEventListener("click", (event) => runThreadGoalDialogAction("continue", event).catch(showError));
  if ($("goalPauseButton")) $("goalPauseButton").addEventListener("click", (event) => runThreadGoalDialogAction("pause", event).catch(showError));
  if ($("goalClearButton")) $("goalClearButton").addEventListener("click", (event) => runThreadGoalDialogAction("cancel", event).catch(showError));
  if ($("goalCancelButton")) $("goalCancelButton").addEventListener("click", () => closeThreadGoalDialog(false));
  if ($("goalDialogClose")) $("goalDialogClose").addEventListener("click", () => closeThreadGoalDialog(false));
  if ($("goalDialog")) $("goalDialog").addEventListener("click", (event) => {
    if (event.target === $("goalDialog")) closeThreadGoalDialog(false);
  });
  if ($("themeSettingsToggle")) $("themeSettingsToggle").addEventListener("click", () => {
    loadCodexProfiles().catch(showError);
    setTimeout(() => publishPluginNavigationState({ force: true }), 0);
  });
  const settingsPanel = $("themeSettingsPanel");
  if (settingsPanel) {
    settingsPanel.addEventListener("click", handleFontSizeChoice);
    settingsPanel.addEventListener("click", handleThreadTileModeChoice);
    settingsPanel.addEventListener("click", (event) => handleCodexProfileSettingsClick(event).catch(showError));
    settingsPanel.addEventListener("click", (event) => handleWorkspaceDelegationSettingsClick(event).catch(showError));
  }
  const commandControl = $("composerCommandControl");
  if (commandControl) {
    let lastFastToggleAt = 0;
    let suppressSyntheticFastToggleUntil = 0;
    const handleFastToggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      const eventType = String(event.type || "");
      if ((eventType === "click" || eventType === "touchend") && now < suppressSyntheticFastToggleUntil) return;
      if (now - lastFastToggleAt < 650) return;
      lastFastToggleAt = now;
      if (eventType === "pointerdown") suppressSyntheticFastToggleUntil = now + 2200;
      if (commandControl.disabled) return;
      closeComposerRuntimeMenu();
      setCodexFastCommandEnabled(!codexFastCommandEnabled());
    };
    commandControl.addEventListener("pointerdown", handleFastToggle);
    commandControl.addEventListener("click", handleFastToggle);
    commandControl.addEventListener("touchend", handleFastToggle, { passive: false });
  }
  const runtimeControls = [
    ["composerModelControl", "model"],
    ["composerEffortControl", "effort"],
    ["composerPermissionControl", "permission"],
  ];
  for (const [id, kind] of runtimeControls) {
    const button = $(id);
    if (!button) continue;
    button.dataset.composerRuntime = kind;
    button.addEventListener("pointerdown", (event) => {
      state.lastComposerRuntimePointerAt = Date.now();
      state.lastComposerRuntimePointerKind = kind;
      state.lastComposerRuntimePointerTarget = button;
      handleComposerRuntimeControl(event, kind, button);
    });
    button.addEventListener("click", (event) => {
      const pointerAlreadyHandled = state.lastComposerRuntimePointerTarget === button
        && state.lastComposerRuntimePointerKind === kind
        && Date.now() - state.lastComposerRuntimePointerAt < 1500;
      if (pointerAlreadyHandled) {
        state.lastComposerRuntimePointerAt = 0;
        state.lastComposerRuntimePointerKind = "";
        state.lastComposerRuntimePointerTarget = null;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      handleComposerRuntimeControl(event, kind, button);
    });
  }
  const runtimeMenu = $("composerRuntimeMenu");
  if (runtimeMenu) {
    runtimeMenu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-runtime-kind][data-runtime-value]");
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      applyRuntimeSelection(option.dataset.runtimeKind, option.dataset.runtimeValue);
    });
  }
  const intentMenu = $("composerIntentMenu");
  if (intentMenu) {
    intentMenu.addEventListener("click", (event) => {
      const option = event.target.closest("[data-composer-intent]");
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      selectComposerIntent(option.dataset.composerIntent || "");
    });
  }
  if ($("composerIntentForm")) $("composerIntentForm").addEventListener("submit", (event) => submitComposerIntentDialog(event).catch(showError));
  if ($("composerIntentSaveButton")) $("composerIntentSaveButton").addEventListener("click", saveComposerIntentDialogDraft);
  if ($("composerIntentCancelButton")) $("composerIntentCancelButton").addEventListener("click", () => closeComposerIntentDialog(false));
  if ($("composerIntentDialogClose")) $("composerIntentDialogClose").addEventListener("click", () => closeComposerIntentDialog(false));
  if ($("composerIntentDialog")) $("composerIntentDialog").addEventListener("click", (event) => {
    if (event.target === $("composerIntentDialog")) closeComposerIntentDialog(false);
  });
  const quotaUsage = $("quotaUsage");
  if (quotaUsage) {
    quotaUsage.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleQuotaDetails(quotaUsage);
    });
  }
  document.addEventListener("pointerdown", primeCompletionAudio, { passive: true });
  document.addEventListener("touchend", primeCompletionAudio, { passive: true });
  document.addEventListener("keydown", primeCompletionAudio);
  $("threadSearch").addEventListener("input", () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => loadThreads().catch(showError), 250);
  });
  $("threadList").addEventListener("pointerdown", beginThreadLongPress);
  $("threadList").addEventListener("pointermove", moveThreadLongPressPointer, { passive: true });
  $("threadList").addEventListener("pointerup", cancelThreadLongPress);
  $("threadList").addEventListener("pointercancel", cancelThreadLongPress);
  $("threadList").addEventListener("touchstart", beginThreadLongPressTouch, { passive: true });
  $("threadList").addEventListener("touchmove", moveThreadLongPressTouch, { passive: true });
  $("threadList").addEventListener("touchend", cancelThreadLongPress, { passive: true });
  $("threadList").addEventListener("touchcancel", cancelThreadLongPress, { passive: true });
  $("threadList").addEventListener("contextmenu", handleThreadListContextMenu);
  if ($("threadActionSheet")) $("threadActionSheet").addEventListener("click", handleThreadAction);
  if ($("continuationConfirm")) $("continuationConfirm").addEventListener("click", confirmContinuationDialog);
  if ($("continuationCancel")) $("continuationCancel").addEventListener("click", closeContinuationDialog);
  if ($("continuationDialog")) $("continuationDialog").addEventListener("click", (event) => {
    if (event.target === $("continuationDialog")) closeContinuationDialog();
  });
  if ($("renameForm")) $("renameForm").addEventListener("submit", submitRename);
  if ($("renameCancel")) $("renameCancel").addEventListener("click", closeRenameDialog);
  if ($("renameDialog")) $("renameDialog").addEventListener("click", (event) => {
    if (event.target === $("renameDialog")) closeRenameDialog();
  });
  if ($("createWorkspaceForm")) $("createWorkspaceForm").addEventListener("submit", submitCreateWorkspace);
  if ($("createWorkspaceCancel")) $("createWorkspaceCancel").addEventListener("click", closeCreateWorkspaceDialog);
  if ($("createWorkspaceDialog")) $("createWorkspaceDialog").addEventListener("click", (event) => {
    if (event.target === $("createWorkspaceDialog")) closeCreateWorkspaceDialog();
  });
  document.addEventListener("touchstart", beginSidebarEdgeSwipe, { passive: false });
  document.addEventListener("touchmove", moveSidebarEdgeSwipe, { passive: false });
  document.addEventListener("touchend", finishSidebarEdgeSwipe, { passive: true });
  document.addEventListener("touchcancel", cancelSidebarEdgeSwipe, { passive: true });
  window.addEventListener("popstate", handleAndroidBackToSidebarPopState);
  ensureAndroidBackToSidebarSentinel();
  $("openMenu").addEventListener("click", handleOpenMenuClick);
  window.addEventListener("resize", syncThreadDetailLayoutState);
  window.addEventListener("orientationchange", syncThreadDetailLayoutState);
  $("closeMenu").addEventListener("click", closeSidebarMenu);
  const pageRefreshPrompt = $("pageRefreshPrompt");
  if (pageRefreshPrompt) pageRefreshPrompt.addEventListener("click", refreshPageForNewBuild);
  $("composer").addEventListener("submit", sendMessage);
  const sendButton = $("sendMessage");
  sendButton.addEventListener("pointerdown", handlePluginVoiceInputSendPointerDown);
  sendButton.addEventListener("pointerup", handlePluginVoiceInputSendPointerUp);
  sendButton.addEventListener("pointercancel", handlePluginVoiceInputSendPointerCancel);
  sendButton.addEventListener("contextmenu", (event) => {
    if (!state.pluginVoiceInputPress) return;
    event.preventDefault();
  });
  sendButton.addEventListener("click", handlePluginVoiceInputSendClick);
  sendButton.addEventListener("pointerup", requestComposerSubmitFromButton);
  sendButton.addEventListener("click", requestComposerSubmitFromButton);
  $("interruptTurn").addEventListener("click", interruptActiveTurn);
  if ($("scrollToBottom")) $("scrollToBottom").addEventListener("click", () => {
    clearConversationAutoScrollHold();
    clearSubmittedMessageBottomFollow();
    clearViewportBottomFollow();
    scrollConversationToBottom();
  });
  if ($("scrollToTurnReply")) $("scrollToTurnReply").addEventListener("click", scrollConversationToTurnReply);
  if ($("liveOperationDock")) {
    $("liveOperationDock").addEventListener("click", handleLiveOperationDockClick);
    $("liveOperationDock").addEventListener("touchstart", beginLiveOperationDockGesture, { passive: true });
    $("liveOperationDock").addEventListener("touchend", finishLiveOperationDockGesture, { passive: true });
    $("liveOperationDock").addEventListener("touchcancel", cancelLiveOperationDockGesture, { passive: true });
  }
  $("conversation").addEventListener("pointerdown", rememberConversationScrollIntent, { passive: true });
  $("conversation").addEventListener("touchstart", rememberConversationScrollIntent, { passive: true });
  $("conversation").addEventListener("touchstart", beginSubagentSwipe, { passive: true });
  $("conversation").addEventListener("touchmove", moveSubagentSwipe, { passive: false });
  $("conversation").addEventListener("touchend", finishSubagentSwipe, { passive: true });
  $("conversation").addEventListener("touchcancel", cancelSubagentSwipe, { passive: true });
  $("conversation").addEventListener("wheel", rememberConversationScrollIntent, { passive: true });
  $("conversation").addEventListener("wheel", handleSubagentWheelSwipe, { passive: true });
  $("conversation").addEventListener("toggle", handleUsageSummaryToggle, true);
  $("conversation").addEventListener("toggle", handleThreadTaskCardDetailsToggle, true);
  $("conversation").addEventListener("scroll", () => {
    updateRecentCompletedReplyAnchorFromScroll();
    updateConversationAutoScrollHoldFromScroll();
    updateScrollToBottomButton();
    maybeLoadOlderThreadTurnsFromScroll();
  }, { passive: true });
  $("conversation").addEventListener("click", (event) => {
    const conversationRoot = event.currentTarget || $("conversation");
    const previewImage = threadDetailActionsApi.previewableImageFromTarget(event.target, conversationRoot);
    if (previewImage && openImagePreviewFromImage(previewImage)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const actionPlan = threadDetailActionsApi.resolveThreadDetailClickAction({
      target: event.target,
      root: conversationRoot,
    });
    if (actionPlan.preventDefault) event.preventDefault();
    if (actionPlan.stopPropagation) event.stopPropagation();
    if (actionPlan.action === "copy") {
      const copyButton = actionPlan.button || actionPlan.target;
      event.preventDefault();
      event.stopPropagation();
      handleCopyButtonClick(copyButton).catch(() => {
        copyButton.textContent = "复制失败";
        window.setTimeout(() => {
          copyButton.textContent = copyButton.getAttribute("aria-label") || "复制";
        }, 1200);
      });
      return;
    }
    if (actionPlan.action === "local-file-preview") {
      event.preventDefault();
      event.stopPropagation();
      openLocalFilePreview(actionPlan.link || actionPlan.target, { threadId: actionPlan.threadId }).catch(showError);
      return;
    }
    if (actionPlan.action === "mermaid") {
      event.preventDefault();
      event.stopPropagation();
      handleMermaidAction(actionPlan.button || actionPlan.target);
      return;
    }
    if (actionPlan.action === "github-preview-toggle") {
      event.preventDefault();
      event.stopPropagation();
      toggleGitHubLinkPreview(actionPlan.button || actionPlan.target);
      return;
    }
    if (actionPlan.action === "approval-answer") {
      answerApproval(actionPlan.approvalId, actionPlan.approvalAction, { threadId: actionPlan.threadId }).catch(showError);
      return;
    }
    if (actionPlan.action === "task-card-reply") {
      replyTaskCard(actionPlan.cardId, { threadId: actionPlan.threadId }).catch(showError);
      return;
    }
    if (actionPlan.action === "task-card-mutate") {
      mutateThreadTaskCard(actionPlan.cardId, actionPlan.taskCardAction, {}, { threadId: actionPlan.threadId }).catch(showError);
      return;
    }
    if (actionPlan.action === "task-card-unknown") return;
    if (actionPlan.action === "task-card-draft") {
      if (actionPlan.draftAction === "dismiss") dismissThreadTaskCardDraft(actionPlan.draftKey, { threadId: actionPlan.threadId });
      return;
    }
    if (actionPlan.action === "server-response") {
      const request = state.pendingApprovals.get(actionPlan.requestId !== null && actionPlan.requestId !== undefined ? String(actionPlan.requestId) : "");
      answerServerRequest(actionPlan.requestId, serverRequestPayload(request, actionPlan.responseText || "", actionPlan.questionId || "answer"), { threadId: actionPlan.threadId }).catch(showError);
      return;
    }
    if (actionPlan.action === "server-request-decline") {
      declineServerRequest(actionPlan.requestId, { threadId: actionPlan.threadId }).catch(showError);
    }
  });
  $("conversation").addEventListener("submit", (event) => {
    const form = event.target.closest("[data-server-request-form]");
    if (!form) return;
    event.preventDefault();
    const requestId = form.dataset.serverRequestId;
    const request = state.pendingApprovals.get(requestId !== null && requestId !== undefined ? String(requestId) : "");
    const responseText = new FormData(form).get("responseText") || "";
    answerServerRequest(requestId, serverRequestPayload(request, String(responseText), form.dataset.serverQuestionId || "answer"), { threadId: form.dataset.serverRequestThreadId }).catch(showError);
  });
  $("conversation").addEventListener("error", handleConversationImageError, true);
  $("conversation").addEventListener("load", handleConversationImageLoad, true);
  $("messageInput").addEventListener("input", (event) => {
    autoSizeMessageInput(event.target);
    if (state.sendButtonHint && !state.composerBusy) state.sendButtonHint = "";
    queueComposerIntentMenuUpdate();
    updateComposerControls();
    scheduleCurrentDraftSave();
  });
  $("messageInput").addEventListener("keyup", queueComposerIntentMenuUpdate);
  $("messageInput").addEventListener("focus", queueComposerIntentMenuUpdate);
  $("messageInput").addEventListener("pointerdown", prepareMessageInputForNativeGesture);
  $("messageInput").addEventListener("pointerup", recoverMessageInputKeyboardFromGesture);
  $("messageInput").addEventListener("click", recoverMessageInputKeyboardFromGesture);
  $("messageInput").addEventListener("compositionstart", () => {
    state.composerComposing = true;
  });
  $("messageInput").addEventListener("compositionend", (event) => {
    state.composerComposing = false;
    autoSizeMessageInput(event.target);
    queueComposerIntentMenuUpdate();
    updateComposerControls();
    scheduleCurrentDraftSave();
  });
  $("messageInput").addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.composerIntentMenuOpen) {
      event.preventDefault();
      closeComposerIntentMenu();
      return;
    }
    if (state.composerComposing || event.isComposing) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    if (!composerHasContent() || state.composerBusy) return;
    event.preventDefault();
    $("composer").requestSubmit();
  });
  $("messageInput").addEventListener("paste", (event) => {
    const files = Array.from((event.clipboardData && event.clipboardData.files) || []);
    if (files.length) addAttachmentFiles(files).catch(showError);
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (text) {
      event.preventDefault();
      document.execCommand("insertText", false, text);
    }
  });
  $("attachFiles").addEventListener("click", requestAttachmentPickerFromButton);
  $("attachFiles").addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    requestAttachmentPickerFromButton(event);
  });
  $("fileInput").addEventListener("change", (event) => {
    addAttachmentFiles(event.target.files).catch(showError);
    event.target.value = "";
  });
  $("attachmentList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-attachment]");
    if (button) removeAttachment(button.dataset.removeAttachment);
  });
  if ($("filePreviewClose")) $("filePreviewClose").addEventListener("click", closeFilePreview);
  if ($("filePreviewDialog")) {
    const filePreviewDialog = $("filePreviewDialog");
    filePreviewDialog.addEventListener("touchstart", beginFilePreviewSwipe, { passive: false });
    filePreviewDialog.addEventListener("touchmove", moveFilePreviewSwipe, { passive: false });
    filePreviewDialog.addEventListener("touchend", finishFilePreviewSwipe, { passive: false });
    filePreviewDialog.addEventListener("touchcancel", cancelFilePreviewSwipe, { passive: true });
    filePreviewDialog.addEventListener("click", (event) => {
      if (event.target === $("filePreviewDialog")) {
        closeFilePreview();
        return;
      }
      const previewImage = previewableImageFromEvent(event);
      if (previewImage && openImagePreviewFromImage(previewImage)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const copyButton = event.target.closest("[data-copy-key]");
      if (copyButton) {
        event.preventDefault();
        handleCopyButtonClick(copyButton).catch(() => {
          copyButton.textContent = "复制失败";
        });
        return;
      }
      const localFileLink = event.target.closest("[data-local-file-path]");
      if (localFileLink) {
        event.preventDefault();
        openLocalFilePreview(localFileLink, { threadId: state.filePreviewThreadId }).catch(showError);
        return;
      }
      const mermaidButton = event.target.closest("[data-mermaid-action]");
      if (mermaidButton) {
        event.preventDefault();
        event.stopPropagation();
        handleMermaidAction(mermaidButton);
        return;
      }
      const githubPreviewExpand = event.target.closest("[data-github-link-preview-expand]");
      if (githubPreviewExpand) {
        event.preventDefault();
        event.stopPropagation();
        toggleGitHubLinkPreview(githubPreviewExpand);
      }
    });
  }
  if ($("imagePreviewClose")) $("imagePreviewClose").addEventListener("click", closeImagePreview);
  if ($("imagePreviewDialog")) {
    const imageDialog = $("imagePreviewDialog");
    const imageStage = $("imagePreviewStage");
    if (imageStage) {
      imageStage.addEventListener("touchstart", beginImagePreviewPinch, { passive: false });
      imageStage.addEventListener("touchmove", moveImagePreviewPinch, { passive: false });
      imageStage.addEventListener("touchend", finishImagePreviewPinch, { passive: true });
      imageStage.addEventListener("touchcancel", finishImagePreviewPinch, { passive: true });
    }
    imageDialog.addEventListener("click", (event) => {
      if (event.target === imageDialog) {
        closeImagePreview();
        return;
      }
      const actionButton = event.target.closest("[data-image-preview-action]");
      if (actionButton) {
        event.preventDefault();
        event.stopPropagation();
        handleImagePreviewAction(actionButton);
      }
    });
  }
  if ($("mermaidPreviewClose")) $("mermaidPreviewClose").addEventListener("click", closeMermaidPreview);
  if ($("mermaidPreviewDialog")) {
    const mermaidDialog = $("mermaidPreviewDialog");
    mermaidDialog.addEventListener("click", (event) => {
      if (event.target === mermaidDialog) {
        closeMermaidPreview();
        return;
      }
      const mermaidButton = event.target.closest("[data-mermaid-action]");
      if (mermaidButton) {
        event.preventDefault();
        event.stopPropagation();
        handleMermaidAction(mermaidButton);
      }
    });
  }
  document.addEventListener("touchstart", beginMermaidPinch, { passive: false, capture: true });
  document.addEventListener("touchmove", moveMermaidPinch, { passive: false, capture: true });
  document.addEventListener("touchend", finishMermaidPinch, { passive: true, capture: true });
  document.addEventListener("touchcancel", finishMermaidPinch, { passive: true, capture: true });
  installMermaidThemeObserver();
  $("composer").addEventListener("dragover", (event) => {
    if (!(state.currentThreadId || state.newThreadDraft) || !hasTransferFiles(event)) return;
    event.preventDefault();
    $("composer").classList.add("drag-over");
  });
  $("composer").addEventListener("dragleave", () => $("composer").classList.remove("drag-over"));
  $("composer").addEventListener("drop", (event) => {
    if (!(state.currentThreadId || state.newThreadDraft) || !hasTransferFiles(event)) return;
    event.preventDefault();
    $("composer").classList.remove("drag-over");
    addAttachmentFiles(event.dataTransfer.files).catch(showError);
  });
  updateViewportVars();
  applyPluginAppearancePreference(state.pluginAppearance);
  applyFontSizePreference();
  renderFontSizeControl();
  syncThreadTileToggle();
  installLaunchQueueHandler();
  installPluginWindowingGuards();
  installHermesPluginBackSwipeGuard();
  window.addEventListener("message", (event) => {
    if (handlePluginVoiceInputMessage(event)) return;
    if (handleHermesPluginViewportMessage(event && event.data)) return;
    if (pluginEmbedApi.isBackMessage && pluginEmbedApi.isBackMessage(event)) {
      handlePluginBack(event, { source: "plugin-back-message" });
    }
  });
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
  }
  document.addEventListener("visibilitychange", () => {
    postClientEvent("page_visibility", {
      visibilityState: document.visibilityState,
      currentThreadId: state.currentThreadId || "",
      eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN),
    });
    if (document.visibilityState === "visible") {
      ensureAndroidBackToSidebarSentinel();
      schedulePageRefreshCheck(200, { force: true });
    }
    scheduleMobileResume("visibility");
  });
  window.addEventListener("pageshow", (event) => {
    postClientEvent("page_show", {
      persisted: Boolean(event && event.persisted),
      currentThreadId: state.currentThreadId || "",
    });
    const threadId = applyUrlThreadSelection({ load: true });
    const pluginRouteHint = applyUrlPluginRouteHint({ load: true });
    ensureAndroidBackToSidebarSentinel();
    schedulePageRefreshCheck(200, { force: true });
    scheduleMobileResume("pageshow", threadId || pluginRouteHint ? 240 : 80);
  });
  window.addEventListener("focus", () => {
    const threadId = applyUrlThreadSelection({ load: true });
    const pluginRouteHint = applyUrlPluginRouteHint({ load: true });
    ensureAndroidBackToSidebarSentinel();
    schedulePageRefreshCheck(600);
    scheduleMobileResume("focus", threadId || pluginRouteHint ? 300 : 150);
  });
  window.addEventListener("blur", () => scheduleVisualRecovery("window-blur", 180, { render: false }));
  window.addEventListener("pagehide", saveCurrentDraftNow);
  window.addEventListener("beforeunload", saveCurrentDraftNow);
  document.addEventListener("focusin", () => {
    if (!isHermesKeyboardInputActive()) {
      scheduleVisualRecovery("focusin", 40, { render: false, heavy: false, delays: [40, 180] });
    }
    scheduleVisibleImageFailureScan([0, 80, 240]);
    cleanupExternalMermaidErrorArtifacts();
  });
  document.addEventListener("focusout", () => scheduleVisualRecovery("focusout", 160, { render: false, heavy: false, delays: [160, 420] }));
  window.addEventListener("orientationchange", () => {
    followViewportChangeToBottom("orientation");
    scheduleMobileResume("orientation", 250);
  });
  window.addEventListener("resize", () => {
    updateViewportVars();
    updateComposerHeightVar();
    positionComposerIntentMenu();
    syncThreadTileToggle();
    if (state.threadTileMode && !isThreadTileKeyboardFocusActive()) scheduleRenderCurrentThread();
    if (!isHermesKeyboardInputActive()) {
      followViewportChangeToBottom("resize");
      scheduleViewportBottomFollowScroll();
      scheduleVisualRecovery("resize", 40, { render: false, heavy: false, delays: [40, 180] });
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      updateViewportVars();
      updateComposerHeightVar();
      positionComposerIntentMenu();
      syncThreadTileToggle();
      if (state.threadTileMode && !isThreadTileKeyboardFocusActive()) scheduleRenderCurrentThread();
      if (!isHermesKeyboardInputActive()) {
        followViewportChangeToBottom("visual-viewport-resize");
        scheduleViewportBottomFollowScroll();
        scheduleVisualRecovery("visual-viewport", 40, { render: false, heavy: false, delays: [40, 180, 520] });
      }
    });
    window.visualViewport.addEventListener("scroll", () => {
      updateViewportVars();
      positionComposerIntentMenu();
      if (!isHermesKeyboardInputActive()) {
        followViewportChangeToBottom("visual-viewport-scroll");
        scheduleViewportBottomFollowScroll();
        scheduleVisualRecovery("visual-viewport-scroll", 40, { render: false, heavy: false, delays: [40, 180] });
      }
    });
  }
}

async function start() {
  const startStartedAt = nowPerfMs();
  state.appShellStartAttempted = true;
  state.appShellPublicConfigLoaded = false;
  state.appShellPublicConfigFailed = false;
  state.appShellPublicConfigErrorCode = "";
  state.startupInProgress = true;
  wireUi();
  startThreadListRuntimeStallMonitoring();
  installCodexMobileVisualHarnessFacade();
  if (isHermesEmbedMode()) showPluginStartupLoading();
  startRelativeTimeTimer();
  startUiWatchdog();
  state.startupThreadOpenPending = hasStartupThreadOpenIntent();
  if (state.key && state.startupThreadOpenPending) {
    showApp();
    renderCurrentThread();
    postStartupStage("early_opening_rendered", startStartedAt);
  }
  let config;
  try {
    config = await fetchPublicConfigWithRetry(startStartedAt);
    state.appShellPublicConfigLoaded = true;
  } catch (err) {
    state.appShellPublicConfigFailed = true;
    state.appShellPublicConfigErrorCode = String(err && err.message || err || "public_config_failed").slice(0, 160);
    postStartupStage("public_config_failed", startStartedAt, {
      error: err && err.message ? err.message : String(err),
    });
    if (isHermesEmbedMode()) {
      requestHermesPluginRefresh("public_config_failed", { force: true });
      showPluginEmbedRecovering("Codex Mobile is reloading...");
      markBootReady();
    } else {
      showApp();
      showError(err);
      markBootReady();
    }
    state.startupInProgress = false;
    return;
  }
  initializePageBuildState(config);
  startPageRefreshChecks();
  state.appVersion = String(config.version || "");
  state.serverPlatform = String(config.platform || "");
  state.maxUploadBytes = Number(config.maxUploadBytes || state.maxUploadBytes);
  state.maxUploadFiles = Number(config.maxUploadFiles || state.maxUploadFiles);
  state.rolloutWarningThresholdBytes = Number(config.rolloutWarningBytes || state.rolloutWarningThresholdBytes);
  state.modelOptions = normalizeOptionList(config.modelOptions || []);
  state.reasoningEffortOptions = normalizeOptionList(config.reasoningEffortOptions || []);
  state.permissionModeOptions = normalizeOptionList((config.permissionModeOptions || state.permissionModeOptions)
    .map(normalizePermissionModeValue));
  state.defaultModel = String(config.defaultModel || "");
  state.defaultReasoningEffort = String(config.defaultReasoningEffort || "");
  state.defaultPermissionMode = effectiveComposerPermissionMode(config.defaultPermissionMode) || "full";
  state.newThreadModel = state.newThreadModel || state.defaultModel || state.modelOptions[0] || "";
  state.newThreadEffort = state.newThreadEffort || state.defaultReasoningEffort || state.reasoningEffortOptions[0] || "";
  state.newThreadPermissionMode = effectiveComposerPermissionMode(state.newThreadPermissionMode)
    || defaultNewThreadPermissionMode();
  state.pushServerSupported = Boolean(config.push && config.push.supported);
  state.appUpdateStatus = {
    supported: Boolean(config.update && config.update.enabled),
    version: state.appVersion,
    remote: config.update && config.update.remote || "origin",
    branch: config.update && config.update.branch || "main",
  };
  state.publicPrEnabled = Boolean(config.publicPullRequests && config.publicPullRequests.enabled);
  state.publicPrRepository = String(config.publicPullRequests && config.publicPullRequests.repository || "");
  state.publicReleaseEnabled = Boolean(config.publicRelease && config.publicRelease.enabled);
  state.publicReleaseRepository = String(config.publicRelease && config.publicRelease.repository || state.publicPrRepository || "");
  state.publicReleaseBranch = String(config.publicRelease && config.publicRelease.branch || "main");
  state.appWorkspacePath = String(config.workspacePath || state.appWorkspacePath || "").trim();
  state.workspaceCreateEnabled = config.workspaceCreate ? config.workspaceCreate.enabled !== false : true;
  state.workspaceCreateRoot = String(config.workspaceCreate && config.workspaceCreate.defaultRoot || "").trim();
  state.workspaceCreateRoots = normalizeOptionList(config.workspaceCreate && config.workspaceCreate.roots || []);
  rememberWorkspaceDelegationConfig(config.workspaceDelegation || null);
  state.publicPrStatus = {
    enabled: state.publicPrEnabled,
    repository: state.publicPrRepository,
  };
  state.publicReleaseStatus = {
    enabled: state.publicReleaseEnabled,
    repository: state.publicReleaseRepository,
    branch: state.publicReleaseBranch,
  };
  renderAppUpdateStatus();
  renderPublicPrStatus();
  renderUpdatePanel();
  renderSharedRestartButton();
  renderComposerSettings();
  rememberRateLimitsFromConfig(config);
  rememberCodexProfiles(config.codexProfiles || null);
  updatePushButton();
  state.pluginLaunchExchangeGate = {
    embed: isHermesEmbedMode() === true,
    launchSession: state.pluginLaunchSession === true,
    hasKey: Boolean(state.key),
  };
  if (isHermesEmbedMode() && state.pluginLaunchSession) {
    state.pluginLaunchExchangeAttempted = true;
    state.pluginLaunchExchangeCompleted = false;
    state.pluginLaunchExchangeFailed = false;
    state.pluginLaunchExchangeErrorCode = "";
    try {
      await exchangePluginLaunchSession();
      state.pluginLaunchExchangeCompleted = true;
    } catch (err) {
      state.pluginLaunchExchangeFailed = true;
      state.pluginLaunchExchangeErrorCode = String(err && err.message || err || "plugin_launch_exchange_failed").slice(0, 160);
      requestHermesPluginRefresh(pluginRefreshReasonForApiError({
        status: 401,
        message: err && err.message ? err.message : String(err),
        path: "/api/v1/hermes/plugin/session",
      }) || "plugin_launch_invalid", { force: true });
      showPluginEmbedRecovering("Refreshing Codex Mobile plugin launch...");
      markBootReady();
      state.startupInProgress = false;
      return;
    }
  }
  if (config.authRequired && !state.key) {
    if (isHermesEmbedMode()) {
      requestHermesPluginRefresh("plugin_session_missing", { force: true });
      showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
    }
    else showLogin();
    markBootReady();
    state.startupInProgress = false;
    return;
  }
  showApp();
  markBootReady();
  reportShellLoaded(startStartedAt, {
    authRequired: Boolean(config.authRequired),
    hasConfig: true,
  });
  if (state.startupThreadOpenPending) renderCurrentThread();
  postStartupStage("app_shown", startStartedAt);
  await bootstrap().catch((err) => {
    hidePluginStartupLoading();
    showError(err);
    if (/unauthorized|forbidden|session expired|invalid session|invalid launch/i.test(err.message || "")) {
      if (isHermesEmbedMode()) {
        requestHermesPluginRefresh(pluginRefreshReasonForApiError({
          status: /forbidden/i.test(err.message || "") ? 403 : 401,
          message: err && err.message ? err.message : String(err),
          path: "",
        }) || "auth_state_changed", { force: true });
        showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
      }
      else showLogin();
    }
  });
  state.startupInProgress = false;
  postStartupStage("startup_done", startStartedAt);
  resumeRememberedContinuationJob().catch(showError);
}

function startCodexMobileAppWithRecovery() {
  return start().catch((err) => {
    if (typeof state === "object" && state) {
      state.appShellStartupRecoveryErrorCode = String(err && err.message || err || "app_shell_start_failed").slice(0, 160);
    }
    var boot = window.codexMobileBoot;
    if (boot && typeof boot.fail === "function") boot.fail("script-error");
    try {
      showApp();
      showError(err);
    } catch (_) {
      // The inline boot recovery panel is the last-resort UI if app startup failed before wiring.
    }
  });
}

function createAppShellRuntime() {
  return {
    wireUi: typeof wireUi === "function" ? wireUi : null,
    start: typeof start === "function" ? start : null,
    startCodexMobileAppWithRecovery: typeof startCodexMobileAppWithRecovery === "function" ? startCodexMobileAppWithRecovery : null,
  };
}

(function exposeCodexAppShellRuntime(root) {
  const appShellApi = { createAppShellRuntime };
  if (typeof module === "object" && module.exports) {
    module.exports = appShellApi;
  }
  root.CodexAppShellRuntime = appShellApi;
})(typeof globalThis !== "undefined" ? globalThis : window);
