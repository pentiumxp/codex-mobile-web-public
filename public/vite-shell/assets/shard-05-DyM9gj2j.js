import { i as __toESM, r as __commonJSMin } from "./vite-shell-entry-CrwTmlx5.js";
//#endregion
//#region \0virtual:codex-mobile-esm-compatibility/shard/shard-05
var import_app_shell_runtime = /* @__PURE__ */ __toESM((/* @__PURE__ */ __commonJSMin(((exports, module) => {
	function toggleQuotaDetailsFromRuntime(anchor) {
		const root = typeof globalThis !== "undefined" ? globalThis : window;
		const bridgeApi = root && root.CodexComposerBridgeRuntime;
		if (bridgeApi && typeof bridgeApi.createComposerBridgeRuntime === "function") {
			const bridge = bridgeApi.createComposerBridgeRuntime();
			if (bridge && typeof bridge.toggleQuotaDetails === "function") {
				bridge.toggleQuotaDetails(anchor);
				return true;
			}
		}
		if (root && typeof root.toggleQuotaDetails === "function") {
			root.toggleQuotaDetails(anchor);
			return true;
		}
		return false;
	}
	function appShellStartupErrorCode(err) {
		return String(err && err.message || err || "app_shell_start_failed").slice(0, 160);
	}
	function isRecoverablePluginStartupError(err) {
		const message = appShellStartupErrorCode(err);
		return /unauthorized|forbidden|session expired|invalid session|invalid launch|plugin_launch|public_config_failed|failed to fetch|network/i.test(message);
	}
	function recordViteAppPreviewStartFailure(err) {
		const root = typeof globalThis !== "undefined" ? globalThis : window;
		const status = root && root.__CODEX_MOBILE_VITE_APP_PREVIEW__;
		if (!status || typeof status !== "object") return false;
		status.appStartOk = false;
		status.appStartPending = false;
		status.appStartErrorCode = appShellStartupErrorCode(err);
		status.appStartCompletedAt = Date.now();
		return true;
	}
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
				if (event.target.closest("[data-create-workspace]")) {
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
				if (!sidebarWorkspaceMenu.hidden && !sidebarWorkspaceMenu.contains(event.target) && !sidebarWorkspaceSelect.contains(event.target)) closeSidebarWorkspaceMenu();
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
				if (sidebarWorkspaceMenu.hidden) openSidebarWorkspaceMenu();
				else closeSidebarWorkspaceMenu();
			};
			sidebarWorkspaceSelect.addEventListener("pointerdown", toggleSidebarWorkspaceMenu);
			sidebarWorkspaceMenu.addEventListener("click", onSidebarWorkspaceOption);
			closeSidebarWorkspaceMenu();
		}
		const workspaceTokenUsage = $("workspaceTokenUsage");
		if (workspaceTokenUsage) workspaceTokenUsage.addEventListener("click", (event) => {
			if (!(event.target && event.target.closest("[data-workspace-token-usage-toggle]"))) return;
			openWorkspaceStatsDialog();
		});
		const workspaceStatsClose = $("workspaceStatsClose");
		if (workspaceStatsClose) workspaceStatsClose.addEventListener("click", closeWorkspaceStatsDialog);
		const workspaceStatsDialog = $("workspaceStatsDialog");
		if (workspaceStatsDialog) workspaceStatsDialog.addEventListener("click", (event) => {
			if (event.target === workspaceStatsDialog) closeWorkspaceStatsDialog();
		});
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
		for (const [id, kind] of [
			["composerModelControl", "model"],
			["composerEffortControl", "effort"],
			["composerPermissionControl", "permission"]
		]) {
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
				if (state.lastComposerRuntimePointerTarget === button && state.lastComposerRuntimePointerKind === kind && Date.now() - state.lastComposerRuntimePointerAt < 1500) {
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
		if (runtimeMenu) runtimeMenu.addEventListener("click", (event) => {
			const option = event.target.closest("[data-runtime-kind][data-runtime-value]");
			if (!option) return;
			event.preventDefault();
			event.stopPropagation();
			applyRuntimeSelection(option.dataset.runtimeKind, option.dataset.runtimeValue);
		});
		const intentMenu = $("composerIntentMenu");
		if (intentMenu) {
			let lastComposerIntentOptionAt = 0;
			let suppressSyntheticComposerIntentOptionUntil = 0;
			const handleComposerIntentOption = (event) => {
				const option = event.target.closest("[data-composer-intent]");
				if (!option) return;
				event.preventDefault();
				event.stopPropagation();
				const now = Date.now();
				const eventType = String(event.type || "");
				if ((eventType === "click" || eventType === "touchend") && now < suppressSyntheticComposerIntentOptionUntil) return;
				if (now - lastComposerIntentOptionAt < 650) return;
				lastComposerIntentOptionAt = now;
				if (eventType === "pointerdown") suppressSyntheticComposerIntentOptionUntil = now + 2200;
				selectComposerIntent(option.dataset.composerIntent || "", {
					openDialog: true,
					source: eventType
				});
			};
			intentMenu.addEventListener("pointerdown", handleComposerIntentOption);
			intentMenu.addEventListener("touchend", handleComposerIntentOption, { passive: false });
			intentMenu.addEventListener("click", handleComposerIntentOption);
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
			let lastQuotaToggleAt = 0;
			let suppressSyntheticQuotaToggleUntil = 0;
			const handleQuotaToggle = (event) => {
				event.preventDefault();
				event.stopPropagation();
				const now = Date.now();
				const eventType = String(event.type || "");
				if ((eventType === "click" || eventType === "touchend") && now < suppressSyntheticQuotaToggleUntil) return;
				if (now - lastQuotaToggleAt < 650) return;
				if (!toggleQuotaDetailsFromRuntime(quotaUsage)) {
					if (eventType !== "pointerdown") showError(/* @__PURE__ */ new Error("quota_details_runtime_unavailable"));
					return;
				}
				lastQuotaToggleAt = now;
				if (eventType === "pointerdown") suppressSyntheticQuotaToggleUntil = now + 2200;
			};
			quotaUsage.addEventListener("pointerdown", handleQuotaToggle);
			quotaUsage.addEventListener("click", handleQuotaToggle);
			quotaUsage.addEventListener("touchend", handleQuotaToggle, { passive: false });
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
				root: conversationRoot
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
				const request = state.pendingApprovals.get(actionPlan.requestId !== null && actionPlan.requestId !== void 0 ? String(actionPlan.requestId) : "");
				answerServerRequest(actionPlan.requestId, serverRequestPayload(request, actionPlan.responseText || "", actionPlan.questionId || "answer"), { threadId: actionPlan.threadId }).catch(showError);
				return;
			}
			if (actionPlan.action === "server-request-decline") declineServerRequest(actionPlan.requestId, { threadId: actionPlan.threadId }).catch(showError);
		});
		$("conversation").addEventListener("submit", (event) => {
			const form = event.target.closest("[data-server-request-form]");
			if (!form) return;
			event.preventDefault();
			const requestId = form.dataset.serverRequestId;
			const request = state.pendingApprovals.get(requestId !== null && requestId !== void 0 ? String(requestId) : "");
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
			const files = Array.from(event.clipboardData && event.clipboardData.files || []);
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
		document.addEventListener("touchstart", beginMermaidPinch, {
			passive: false,
			capture: true
		});
		document.addEventListener("touchmove", moveMermaidPinch, {
			passive: false,
			capture: true
		});
		document.addEventListener("touchend", finishMermaidPinch, {
			passive: true,
			capture: true
		});
		document.addEventListener("touchcancel", finishMermaidPinch, {
			passive: true,
			capture: true
		});
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
			if (pluginEmbedApi.isBackMessage && pluginEmbedApi.isBackMessage(event)) handlePluginBack(event, { source: "plugin-back-message" });
		});
		if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
		document.addEventListener("visibilitychange", () => {
			postClientEvent("page_visibility", {
				visibilityState: document.visibilityState,
				currentThreadId: state.currentThreadId || "",
				eventOpen: Boolean(state.events && state.events.readyState === EventSource.OPEN)
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
				currentThreadId: state.currentThreadId || ""
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
			if (!isHermesKeyboardInputActive()) scheduleVisualRecovery("focusin", 40, {
				render: false,
				heavy: false,
				delays: [40, 180]
			});
			scheduleVisibleImageFailureScan([
				0,
				80,
				240
			]);
			cleanupExternalMermaidErrorArtifacts();
		});
		document.addEventListener("focusout", () => scheduleVisualRecovery("focusout", 160, {
			render: false,
			heavy: false,
			delays: [160, 420]
		}));
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
				scheduleVisualRecovery("resize", 40, {
					render: false,
					heavy: false,
					delays: [40, 180]
				});
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
					scheduleVisualRecovery("visual-viewport", 40, {
						render: false,
						heavy: false,
						delays: [
							40,
							180,
							520
						]
					});
				}
			});
			window.visualViewport.addEventListener("scroll", () => {
				updateViewportVars();
				positionComposerIntentMenu();
				if (!isHermesKeyboardInputActive()) {
					followViewportChangeToBottom("visual-viewport-scroll");
					scheduleViewportBottomFollowScroll();
					scheduleVisualRecovery("visual-viewport-scroll", 40, {
						render: false,
						heavy: false,
						delays: [40, 180]
					});
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
			postStartupStage("public_config_failed", startStartedAt, { error: err && err.message ? err.message : String(err) });
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
		state.permissionModeOptions = normalizeOptionList((config.permissionModeOptions || state.permissionModeOptions).map(normalizePermissionModeValue));
		state.defaultModel = String(config.defaultModel || "");
		state.defaultReasoningEffort = String(config.defaultReasoningEffort || "");
		state.defaultPermissionMode = effectiveComposerPermissionMode(config.defaultPermissionMode) || "full";
		state.newThreadModel = state.newThreadModel || state.defaultModel || state.modelOptions[0] || "";
		state.newThreadEffort = state.newThreadEffort || state.defaultReasoningEffort || state.reasoningEffortOptions[0] || "";
		state.newThreadPermissionMode = effectiveComposerPermissionMode(state.newThreadPermissionMode) || defaultNewThreadPermissionMode();
		state.pushServerSupported = Boolean(config.push && config.push.supported);
		state.appUpdateStatus = {
			supported: Boolean(config.update && config.update.enabled),
			version: state.appVersion,
			remote: config.update && config.update.remote || "origin",
			branch: config.update && config.update.branch || "main"
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
			repository: state.publicPrRepository
		};
		state.publicReleaseStatus = {
			enabled: state.publicReleaseEnabled,
			repository: state.publicReleaseRepository,
			branch: state.publicReleaseBranch
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
			hasKey: Boolean(state.key)
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
					path: "/api/v1/hermes/plugin/session"
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
			} else showLogin();
			markBootReady();
			state.startupInProgress = false;
			return;
		}
		showApp();
		markBootReady();
		reportShellLoaded(startStartedAt, {
			authRequired: Boolean(config.authRequired),
			hasConfig: true
		});
		if (state.startupThreadOpenPending) renderCurrentThread();
		postStartupStage("app_shown", startStartedAt);
		await bootstrap().catch((err) => {
			hidePluginStartupLoading();
			showError(err);
			if (/unauthorized|forbidden|session expired|invalid session|invalid launch/i.test(err.message || "")) if (isHermesEmbedMode()) {
				requestHermesPluginRefresh(pluginRefreshReasonForApiError({
					status: /forbidden/i.test(err.message || "") ? 403 : 401,
					message: err && err.message ? err.message : String(err),
					path: ""
				}) || "auth_state_changed", { force: true });
				showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
			} else showLogin();
		});
		state.startupInProgress = false;
		postStartupStage("startup_done", startStartedAt);
		resumeRememberedContinuationJob().catch(showError);
	}
	function startCodexMobileAppWithRecovery() {
		return start().catch((err) => {
			if (typeof state === "object" && state) {
				state.appShellStartupRecoveryErrorCode = appShellStartupErrorCode(err);
				state.startupInProgress = false;
			}
			if (isHermesEmbedMode() && isRecoverablePluginStartupError(err)) {
				requestHermesPluginRefresh(pluginRefreshReasonForApiError({
					status: /forbidden/i.test(err && err.message || "") ? 403 : 401,
					message: err && err.message ? err.message : String(err),
					path: ""
				}) || "plugin_startup_recoverable", { force: true });
				showPluginEmbedRecovering("Refreshing Codex Mobile plugin session...");
				markBootReady();
				return;
			}
			const isViteAppPreview = recordViteAppPreviewStartFailure(err);
			var boot = window.codexMobileBoot;
			if (boot && typeof boot.fail === "function") boot.fail("app-start-error");
			try {
				showApp();
				showError(err);
			} catch (_) {}
			if (isViteAppPreview) throw err;
		});
	}
	function createAppShellRuntime() {
		return {
			wireUi: typeof wireUi === "function" ? wireUi : null,
			start: typeof start === "function" ? start : null,
			startCodexMobileAppWithRecovery: typeof startCodexMobileAppWithRecovery === "function" ? startCodexMobileAppWithRecovery : null
		};
	}
	(function exposeCodexAppShellRuntime(root) {
		const appShellApi = { createAppShellRuntime };
		if (typeof module === "object" && module.exports) module.exports = appShellApi;
		root.CodexAppShellRuntime = appShellApi;
	})(typeof globalThis !== "undefined" ? globalThis : window);
})))());
var moduleDefinitions = [{
	"id": "app-shell-runtime",
	"source": "public/app-shell-runtime.js",
	"globalName": "CodexAppShellRuntime",
	"expectedFunctions": ["createAppShellRuntime"],
	"assetPath": "/app-shell-runtime.js",
	"classicLoaderExcluded": true,
	"bytes": 45895
}];
var moduleApis = { "app-shell-runtime": import_app_shell_runtime.default };
function functionReady(api, name) {
	return Boolean(api && typeof api[name] === "function");
}
function publishClassicGlobal(definition, api) {
	const globalName = String(definition && definition.globalName || "");
	if (!globalName || !api || typeof api !== "object" || typeof globalThis === "undefined") return false;
	globalThis[globalName] = api;
	return globalThis[globalName] === api;
}
function sampleModule(id, api) {
	if (id === "build-refresh-policy") {
		const classification = functionReady(api, "classifyServerBuildChange") ? api.classifyServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : "";
		const prompt = functionReady(api, "shouldPromptForServerBuildChange") ? api.shouldPromptForServerBuildChange("0.1.11|codex-mobile-shell-v626", "0.1.11|codex-mobile-shell-v625") : false;
		return {
			ok: classification === "server-newer" && prompt === true,
			classification,
			prompt
		};
	}
	if (id === "runtime-settings") {
		const normalizedOptions = functionReady(api, "normalizeOptionList") ? api.normalizeOptionList([
			"",
			"gpt-5.5",
			" gpt-5.5 ",
			"gpt-5.4"
		]) : [];
		const modelLabel = functionReady(api, "labelForModel") ? api.labelForModel("gpt-5.3-codex-spark") : "";
		const compactModelLabel = functionReady(api, "compactLabelForModel") ? api.compactLabelForModel("gpt-5.3-codex-spark") : "";
		const effortLabel = functionReady(api, "labelForEffort") ? api.labelForEffort("xhigh") : "";
		const permissionLabel = functionReady(api, "labelForPermissionMode") ? api.labelForPermissionMode("full") : "";
		const permissionTitle = functionReady(api, "titleForPermissionMode") ? api.titleForPermissionMode("custom") : "";
		const permissionAlias = functionReady(api, "normalizePermissionModeValue") ? api.normalizePermissionModeValue("full-access") : "";
		const selectedModel = functionReady(api, "selectedNewThreadModel") ? api.selectedNewThreadModel({
			selected: "",
			defaultValue: "gpt-5.5",
			options: ["gpt-5.4"]
		}) : "";
		const selectedEffort = functionReady(api, "selectedNewThreadEffort") ? api.selectedNewThreadEffort({
			selected: " high ",
			defaultValue: "medium",
			options: ["low"]
		}) : "";
		const selectedPermission = functionReady(api, "selectedNewThreadPermission") ? api.selectedNewThreadPermission({
			selected: "workspace-write",
			defaultValue: "full",
			options: ["auto"]
		}) : "";
		return {
			ok: Array.isArray(normalizedOptions) && normalizedOptions.join(",") === "gpt-5.5,gpt-5.4" && modelLabel === "GPT-5.3 Codex Spark" && compactModelLabel === "5.3 Spark" && effortLabel === "XHigh" && permissionLabel === "完全访问权限" && permissionTitle === "自定义 (config.toml)" && permissionAlias === "full" && selectedModel === "gpt-5.5" && selectedEffort === "high" && selectedPermission === "auto",
			normalizedOptions,
			modelLabel,
			compactModelLabel,
			effortLabel,
			permissionLabel,
			permissionTitle,
			permissionAlias,
			selectedModel,
			selectedEffort,
			selectedPermission
		};
	}
	if (id === "viewport-metrics") {
		const editable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "text"
		}) : false;
		const checkboxEditable = functionReady(api, "isKeyboardEditable") ? api.isKeyboardEditable({
			tagName: "INPUT",
			type: "checkbox"
		}) : true;
		const measurement = functionReady(api, "measureViewport") ? api.measureViewport({
			visualHeight: 520,
			visualOffsetTop: 16,
			innerHeight: 1024,
			clientHeight: 1024,
			activeElement: { tagName: "TEXTAREA" }
		}) : {};
		const stableChanged = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 94) : false;
		const stableNoise = functionReady(api, "stablePixelChanged") ? api.stablePixelChanged(92, 93) : true;
		const cssPixel = functionReady(api, "cssPixel") ? api.cssPixel(92.6) : 0;
		return {
			ok: editable === true && checkboxEditable === false && measurement.keyboardShrunk === true && measurement.height === 520 && measurement.top === 16 && stableChanged === true && stableNoise === false && cssPixel === 93,
			editable,
			checkboxEditable,
			keyboardShrunk: Boolean(measurement.keyboardShrunk),
			height: Number(measurement.height) || 0,
			top: Number(measurement.top) || 0,
			stableChanged,
			stableNoise,
			cssPixel
		};
	}
	if (id === "conversation-scroll") {
		const nearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 725,
			clientHeight: 980
		}) : false;
		const notNearBottom = functionReady(api, "isNearBottom") ? api.isNearBottom({
			scrollHeight: 1800,
			scrollTop: 640,
			clientHeight: 980
		}) : true;
		const submittedFollow = functionReady(api, "createSubmittedMessageFollow") ? api.createSubmittedMessageFollow("thread-a", {
			clientSubmissionId: "submit-1",
			nowMs: 1e3,
			ttlMs: 5e3
		}) : null;
		const submittedActive = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-a",
			nowMs: 5999
		}) : false;
		const submittedWrongThread = functionReady(api, "shouldFollowSubmittedMessage") ? api.shouldFollowSubmittedMessage(submittedFollow, {
			threadId: "thread-b",
			nowMs: 2e3
		}) : true;
		const viewportFollow = functionReady(api, "createViewportFollow") ? api.createViewportFollow("thread-a", {
			reason: "orientation",
			nowMs: 1e3,
			ttlMs: 3e3
		}) : null;
		const viewportActive = functionReady(api, "shouldFollowViewport") ? api.shouldFollowViewport(viewportFollow, {
			threadId: "thread-a",
			nowMs: 3999
		}) : false;
		const lease = functionReady(api, "planBottomFollowLeaseEvaluation") ? api.planBottomFollowLeaseEvaluation({
			leaseActive: true,
			hasLease: true
		}) : {};
		const schedule = functionReady(api, "planBottomFollowScrollSchedule") ? api.planBottomFollowScrollSchedule() : {};
		const refresh = functionReady(api, "planAutomaticConversationRefresh") ? api.planAutomaticConversationRefresh({
			hasThread: true,
			nearBottom: false,
			userReadingCurrentTurn: true
		}) : {};
		const fullRender = functionReady(api, "planFullRenderScroll") ? api.planFullRenderScroll({ submittedMessageFollow: true }) : {};
		return {
			ok: nearBottom === true && notNearBottom === false && submittedFollow && submittedFollow.untilMs === 6e3 && submittedActive === true && submittedWrongThread === false && viewportFollow && viewportFollow.untilMs === 4e3 && viewportActive === true && lease.reason === "lease-active" && Array.isArray(schedule.delaysMs) && schedule.delaysMs.join(",") === "0,80,240,600,1200" && refresh.allowRefresh === false && refresh.reason === "user-reading-current-turn" && fullRender.stickToBottom === true && fullRender.reason === "submitted-message-follow",
			nearBottom,
			submittedActive,
			viewportActive,
			leaseReason: String(lease.reason || ""),
			scheduleDelays: Array.isArray(schedule.delaysMs) ? schedule.delaysMs : [],
			refreshReason: String(refresh.reason || ""),
			fullRenderReason: String(fullRender.reason || "")
		};
	}
	if (id === "thread-performance-metrics") {
		const listPhase = functionReady(api, "classifyThreadListPhase") ? api.classifyThreadListPhase({
			fallbackCacheDecision: "expired-rebuild",
			fallbackMs: 25
		}) : "";
		const detailPhase = functionReady(api, "classifyThreadDetailPhase") ? api.classifyThreadDetailPhase({
			readDecision: "projection-hit",
			projectionSource: "dynamic"
		}) : "";
		const clientTimings = functionReady(api, "threadDetailClientTimings") ? api.threadDetailClientTimings({
			elapsedMs: 26.4,
			renderElapsedMs: 7.2,
			detailRenderMode: "patch"
		}) : {};
		const detailFields = functionReady(api, "threadDetailEventFields") ? api.threadDetailEventFields({
			mobileDiagnostics: { threadDetailTimings: {
				phase: "warm-projection-cache",
				totalMs: 8
			} },
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const shape = functionReady(api, "threadDetailShape") ? api.threadDetailShape({
			mobileOmittedTurnCount: 2,
			turns: [{
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}, {
				status: "running",
				items: [{
					type: "agentMessage",
					text: "reply"
				}]
			}]
		}) : {};
		const slow = functionReady(api, "planThreadDetailSlowPathDiagnostic") ? api.planThreadDetailSlowPathDiagnostic({
			elapsedMs: 1600,
			apiElapsedMs: 1550,
			renderElapsedMs: 20,
			performancePhase: "cold-turns-list-initial"
		}, {
			action: "thread-detail-load",
			threadHash: "thread_hash",
			durationBucket: "1_3s"
		}) : {};
		return {
			ok: listPhase === "cold-fallback-expired-rebuild" && detailPhase === "warm-projection-dynamic" && clientTimings.elapsedMs === 26 && clientTimings.renderElapsedMs === 7 && clientTimings.detailRenderMode === "patch" && detailFields.performancePhase === "warm-projection-cache" && shape.turns === 2 && shape.visibleItems === 2 && shape.omittedTurns === 2 && shape.completedTurns === 1 && shape.activeTurns === 1 && slow.shouldReport === true && slow.reason === "api-slow",
			listPhase,
			detailPhase,
			elapsedMs: Number(clientTimings.elapsedMs) || 0,
			detailPerformancePhase: String(detailFields.performancePhase || ""),
			visibleItems: Number(shape.visibleItems) || 0,
			slowReason: String(slow.reason || "")
		};
	}
	if (id === "thread-detail-state") {
		const loadedThread = {
			id: "thread-a",
			title: "Thread A",
			status: "completed",
			mobileDetailLoaded: true,
			mobileLoading: false,
			turns: [{
				id: "turn-a",
				status: "completed",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}],
			mobileProjection: { source: "sample" }
		};
		const summary = functionReady(api, "threadListSummaryFromDetailThread") ? api.threadListSummaryFromDetailThread(loadedThread) : {};
		const loaded = functionReady(api, "threadHasLoadedDetailState") ? api.threadHasLoadedDetailState(loadedThread) : false;
		const reusable = functionReady(api, "threadHasReusableLoadedDetailState") ? api.threadHasReusableLoadedDetailState(loadedThread) : false;
		const visualBaseline = functionReady(api, "threadHasVisualBaselineLoadedDetailState") ? api.threadHasVisualBaselineLoadedDetailState(Object.assign({}, loadedThread, { status: "active" })) : false;
		const cacheReuse = functionReady(api, "planThreadOpenCacheReuse") ? api.planThreadOpenCacheReuse({
			currentThread: loadedThread,
			threadId: "thread-a"
		}) : {};
		return {
			ok: summary && summary.id === "thread-a" && !Object.prototype.hasOwnProperty.call(summary, "turns") && !Object.prototype.hasOwnProperty.call(summary, "mobileProjection") && loaded === true && reusable === true && visualBaseline === true && cacheReuse && typeof cacheReuse === "object",
			summaryId: String(summary && summary.id || ""),
			summaryHasTurns: Object.prototype.hasOwnProperty.call(summary || {}, "turns"),
			loaded,
			reusable,
			visualBaseline,
			cacheReuseReason: String(cacheReuse.reason || "")
		};
	}
	if (id === "thread-detail-render-plan") {
		const backfill = functionReady(api, "planThreadDetailHistoryAutoBackfill") ? api.planThreadDetailHistoryAutoBackfill({
			hasOlder: true,
			thread: {
				mobileOlderTurnsCursor: "cursor-a",
				turns: [{ items: [{
					type: "assistantMessage",
					text: "[Cross-thread task card sent by source thread]"
				}] }]
			}
		}) : {};
		const request = functionReady(api, "planThreadDetailRefreshRequest") ? api.planThreadDetailRefreshRequest({
			threadId: "thread-a",
			threadLoadSeq: 7,
			options: { source: "auto-refresh" }
		}) : {};
		const postUpdate = functionReady(api, "planSingleThreadShellPostUpdateEffects") ? api.planSingleThreadShellPostUpdateEffects({
			bindCurrentThreadActions: true,
			updateTickTimer: true,
			publishPluginNavigationState: true,
			reason: "sample"
		}) : {};
		const normalizedSignature = functionReady(api, "normalizeSignature") ? api.normalizeSignature(42) : "";
		const effects = Array.isArray(postUpdate.effects) ? postUpdate.effects : [];
		return {
			ok: normalizedSignature === "42" && backfill.shouldLoad === true && backfill.reason === "sparse-conversation-context" && request.shouldRefresh === true && request.threadId === "thread-a" && request.requestedMode === "recent" && request.query && request.query.mode === "recent" && effects.map((entry) => String(entry && entry.type || "")).join(",") === "bind-current-thread-actions,update-tick-timer,publish-plugin-navigation-state",
			normalizedSignature,
			backfillReason: String(backfill.reason || ""),
			refreshReason: String(request.reason || ""),
			effectTypes: effects.map((entry) => String(entry && entry.type || ""))
		};
	}
	if (id === "thread-detail-dom-patch") {
		const patch = functionReady(api, "threadDetailPatchResult") ? api.threadDetailPatchResult(true, "patched", { patched: 2 }) : {};
		const mismatch = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "c"]
		}) : false;
		const match = functionReady(api, "visibleTurnOrderMismatch") ? api.visibleTurnOrderMismatch({
			expectedTurnIds: ["a", "b"],
			renderedDomTurnIds: ["a", "b"]
		}) : true;
		const operation = functionReady(api, "normalizeOperation") ? api.normalizeOperation({
			type: "insert",
			key: "turn-a",
			nextEntry: {
				key: "turn-a",
				html: "<article></article>"
			}
		}) : null;
		const htmlUpdate = functionReady(api, "planConversationHtmlUpdate") ? api.planConversationHtmlUpdate({
			html: "<article data-turn-id=\"a\"></article>",
			previousHtml: "<article data-turn-id=\"a\"></article>",
			conversationSignature: "sig-a",
			previousConversationSignature: "sig-a"
		}) : {};
		return {
			ok: patch.ok === true && patch.reason === "patched" && patch.patched === 2 && mismatch === true && match === false && operation && operation.key === "turn-a" && htmlUpdate.action === "hydrate-existing" && htmlUpdate.reason === "signature-stable",
			patchReason: String(patch.reason || ""),
			patched: Number(patch.patched) || 0,
			mismatch,
			match,
			operationKey: String(operation && operation.key || ""),
			htmlAction: String(htmlUpdate.action || "")
		};
	}
	if (id === "draft-store") {
		const memory = /* @__PURE__ */ new Map();
		const store = functionReady(api, "createDraftStore") ? api.createDraftStore({
			storage: {
				getItem(key) {
					return memory.has(key) ? memory.get(key) : null;
				},
				setItem(key, value) {
					memory.set(key, String(value));
				},
				removeItem(key) {
					memory.delete(key);
				}
			},
			maxDrafts: 2
		}) : null;
		if (store && typeof store.writeMap === "function") {
			store.writeMap({
				old: {
					text: "old",
					updatedAt: 1
				},
				newest: {
					text: "newest",
					updatedAt: 3
				},
				middle: {
					text: "middle",
					updatedAt: 2
				}
			});
			store.setTargetKey("new:/repo");
		}
		const draftKeys = store && typeof store.readMap === "function" ? Object.keys(store.readMap()) : [];
		const threadKey = store && typeof store.keyForThread === "function" ? store.keyForThread(" abc ") : "";
		const newThreadKey = store && typeof store.keyForNewThread === "function" ? store.keyForNewThread("C:/Users/xuefu/project/") : "";
		const targetKey = store && typeof store.getTargetKey === "function" ? store.getTargetKey() : "";
		const parsed = functionReady(api, "parseDraftMap") ? api.parseDraftMap("{\"a\":{\"text\":\"draft\"}}") : {};
		const hasContent = functionReady(api, "draftHasContent") ? api.draftHasContent({ permissionMode: "full" }) : false;
		const meta = functionReady(api, "normalizeAttachmentMeta") ? api.normalizeAttachmentMeta({
			id: 7,
			file: {
				name: "screenshot.png",
				type: "image/png",
				size: 42,
				lastModified: 123
			}
		}) : null;
		const attachmentKey = functionReady(api, "attachmentStorageKey") ? api.attachmentStorageKey("new:/a b", "x/y") : "";
		const normalizedPath = functionReady(api, "defaultNormalizeFsPath") ? api.defaultNormalizeFsPath("C:/Users/xuefu/project/") : "";
		return {
			ok: threadKey === "thread:abc" && newThreadKey === "new:c:\\users\\xuefu\\project" && targetKey === "new:/repo" && draftKeys.join(",") === "newest,middle" && parsed && parsed.a && parsed.a.text === "draft" && hasContent === true && meta && meta.id === "7" && meta.size === 42 && attachmentKey === "new%3A%2Fa%20b|x%2Fy" && normalizedPath === "c:\\users\\xuefu\\project",
			threadKey,
			newThreadKey,
			targetKey,
			draftKeys,
			hasContent,
			attachmentKey,
			normalizedPath
		};
	}
	if (id === "image-compressor") {
		const compressible = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 300 * 1024
		}) : false;
		const smallImage = functionReady(api, "isCompressibleImageFile") ? api.isCompressibleImageFile({
			type: "image/png",
			size: 12 * 1024
		}) : true;
		const dims = functionReady(api, "targetDimensions") ? api.targetDimensions(3e3, 1500, 1200) : {};
		const name = functionReady(api, "compressedImageName") ? api.compressedImageName("folder/screen.png", "image/webp") : "";
		const useful = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 800 }) : false;
		const marginal = functionReady(api, "shouldUseCompressedBlob") ? api.shouldUseCompressedBlob({ size: 1e3 }, { size: 930 }) : true;
		return {
			ok: compressible === true && smallImage === false && dims.width === 1200 && dims.height === 600 && dims.scaled === true && name === "folder_screen.webp" && useful === true && marginal === false,
			compressible,
			smallImage,
			width: Number(dims.width) || 0,
			height: Number(dims.height) || 0,
			scaled: Boolean(dims.scaled),
			name,
			useful,
			marginal
		};
	}
	if (id === "plugin-voice-input") {
		const capability = functionReady(api, "capabilityStateMessage") ? api.capabilityStateMessage({
			writable: true,
			threadId: "thread-a",
			draftId: "draft-a",
			actions: [
				"append",
				"replace",
				"submit"
			],
			maxChars: 100
		}) : {};
		const start = functionReady(api, "startRequestMessage") ? api.startRequestMessage({
			requestId: "req-1",
			voiceSessionId: "voice-1",
			capability
		}) : {};
		const insert = functionReady(api, "insertResultMessage") ? api.insertResultMessage({
			ok: false,
			action: "append_text",
			code: "composer_not_writable",
			composerId: "thread-composer"
		}) : {};
		const error = functionReady(api, "errorMessage") ? api.errorMessage({
			code: "voice_error",
			error: "Voice failed"
		}) : {};
		const action = functionReady(api, "normalizeAction") ? api.normalizeAction("append") : "";
		const actionFromType = functionReady(api, "actionFromMessageType") ? api.actionFromMessageType("voice_input.replace_draft") : "";
		const text = functionReady(api, "textFromMessage") ? api.textFromMessage({ text: "  hello\xA0world  " }, 20) : "";
		const voiceMessage = functionReady(api, "isVoiceInputMessage") ? api.isVoiceInputMessage({ type: "voice_input.append_text" }) : false;
		return {
			ok: capability.type === "voice_input.capability_state" && capability.writable === true && Array.isArray(capability.actions) && capability.actions.join(",") === "append_text,replace_draft" && start.type === "voice_input.start_request" && start.requestId === "req-1" && insert.ok === false && insert.code === "composer_not_writable" && error.code === "voice_error" && action === "append_text" && actionFromType === "replace_draft" && text === "hello world" && voiceMessage === true,
			capabilityType: String(capability.type || ""),
			actions: Array.isArray(capability.actions) ? capability.actions : [],
			startType: String(start.type || ""),
			insertCode: String(insert.code || ""),
			errorCode: String(error.code || ""),
			action,
			actionFromType,
			text,
			voiceMessage
		};
	}
	if (id === "api-client") {
		function FakeFormData() {}
		const formData = new FakeFormData();
		const isFormData = functionReady(api, "isFormDataBody") ? api.isFormDataBody(formData, FakeFormData) : false;
		const jsonBody = functionReady(api, "isFormDataBody") ? api.isFormDataBody({ ok: true }, FakeFormData) : true;
		const client = functionReady(api, "createApiClient") ? api.createApiClient({
			fetch: () => Promise.resolve({
				ok: true,
				status: 204
			}),
			AbortControllerCtor: AbortController,
			FormDataCtor: FakeFormData,
			getKey: () => ""
		}) : null;
		return {
			ok: isFormData === true && jsonBody === false && client && typeof client.request === "function",
			isFormData,
			jsonBody,
			requestReady: Boolean(client && typeof client.request === "function")
		};
	}
	if (id === "markdown-renderer") {
		const escaped = functionReady(api, "escapeHtml") ? api.escapeHtml("<tag>&\"") : "";
		const safeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("https://example.com") : "";
		const unsafeUrl = functionReady(api, "safeMarkdownUrl") ? api.safeMarkdownUrl("javascript:alert(1)") : "unsafe";
		const inline = functionReady(api, "renderInlineMarkdown") ? api.renderInlineMarkdown("**bold** <https://example.com>, `code`") : "";
		const block = functionReady(api, "renderMarkdown") ? api.renderMarkdown("# Title\n\n- item\n- **bold**") : "";
		const tableSeparator = functionReady(api, "isMarkdownTableSeparator") ? api.isMarkdownTableSeparator("|---|:---:|") : false;
		const row = functionReady(api, "splitMarkdownTableRow") ? api.splitMarkdownTableRow("| A | B |") : [];
		const list = functionReady(api, "renderMarkdownList") ? api.renderMarkdownList(["1. one", "2. two"], true) : "";
		const table = functionReady(api, "renderMarkdownTable") ? api.renderMarkdownTable([
			"A | B",
			"---|---",
			"1 | 2"
		]) : "";
		return {
			ok: escaped === "&lt;tag&gt;&amp;&quot;" && safeUrl === "https://example.com" && unsafeUrl === "" && inline.includes("<strong>bold</strong>") && inline.includes("<code>code</code>") && block.includes("<h2>Title</h2>") && tableSeparator === true && Array.isArray(row) && row.join(",") === "A,B" && list.includes("<ol>") && table.includes("<table>"),
			escaped,
			safeUrl,
			unsafeUrl,
			row,
			inlineHasStrong: inline.includes("<strong>bold</strong>"),
			blockHasHeading: block.includes("<h2>Title</h2>"),
			listHasOl: list.includes("<ol>"),
			tableHasTable: table.includes("<table>")
		};
	}
	if (id === "plugin-embed") {
		const detected = functionReady(api, "detect") ? api.detect("http://127.0.0.1/?embed=hermes&pluginId=codex-mobile&pluginRoute=thread&pluginThreadId=t1&pluginTheme=dark&pluginFontSize=large") : {};
		const navigation = functionReady(api, "navigationMessage") ? api.navigationMessage({ currentThreadId: "t1" }, {}) : {};
		const openPlan = functionReady(api, "routeHintOpenPlan") ? api.routeHintOpenPlan({
			pluginId: "codex-mobile",
			threadId: "t1",
			itemId: "i1"
		}) : {};
		const selectors = functionReady(api, "routeHintTargetSelectors") ? api.routeHintTargetSelectors({ itemId: "i1" }) : [];
		const scrubbed = functionReady(api, "scrubRouteHintPath") ? api.scrubRouteHintPath("http://127.0.0.1/thread?pluginId=codex-mobile&pluginThreadId=t1", {
			workspaceId: "ws1",
			appearance: { theme: "dark" }
		}) : "";
		const external = functionReady(api, "externalLinkMessage") ? api.externalLinkMessage({ href: "https://example.com/a" }) : {};
		const refresh = functionReady(api, "refreshRequiredMessage") ? api.refreshRequiredMessage({
			reason: "version_changed",
			route: {
				kind: "thread",
				threadId: "t1"
			},
			appearance: { theme: "light" }
		}) : {};
		return {
			ok: detected.embedded === true && detected.routeHint && detected.routeHint.threadId === "t1" && detected.appearance && detected.appearance.theme === "dark" && navigation.type === "codex-mobile.plugin.navigation" && navigation.canGoBack === true && openPlan.action === "openThread" && Array.isArray(selectors) && selectors[0] === "[data-approval-card=\"i1\"]" && scrubbed === "/thread?embed=hermes&workspaceId=ws1&pluginTheme=dark" && external.type === "codex-mobile.plugin.external_link" && refresh.type === "codex-mobile.plugin.refresh_required",
			embedded: Boolean(detected.embedded),
			routeThreadId: String(detected.routeHint && detected.routeHint.threadId || ""),
			navigationType: String(navigation.type || ""),
			canGoBack: Boolean(navigation.canGoBack),
			openAction: String(openPlan.action || ""),
			firstSelector: String(selectors[0] || ""),
			scrubbed,
			externalType: String(external.type || ""),
			refreshType: String(refresh.type || "")
		};
	}
	if (id === "frontend-runtime-health") {
		const token = functionReady(api, "compactToken") ? api.compactToken(" Home AI / Thread Detail ", "fallback", 20) : "";
		const missingEffects = functionReady(api, "submittedMessageDomProbeEffects") ? api.submittedMessageDomProbeEffects({
			elapsedMs: 300,
			currentThreadMatch: true,
			hasThreadSubmission: true,
			domHasSubmission: false,
			threadHash: "abc"
		}) : {};
		const stallEffects = functionReady(api, "threadListInteractionStallEffects") ? api.threadListInteractionStallEffects({
			threadListVisible: true,
			threadListMonitorable: true,
			maxRafDelayMs: 640,
			minDelayMs: 500
		}) : {};
		const monitor = functionReady(api, "createMonitor") ? api.createMonitor({ now: () => 1e3 }) : null;
		const monitorResult = monitor && typeof monitor.recordRender === "function" ? monitor.recordRender({
			fullRender: false,
			fallbackApplied: false,
			previousCount: 2,
			domCount: 2,
			visibleCount: 2,
			duplicateCount: 0
		}) : {};
		const dropEvent = functionReady(api, "domDropEvent") ? api.domDropEvent({
			previousCount: 3,
			domCount: 1,
			visibleCount: 3
		}) : {};
		const success = functionReady(api, "runtimeSuccess") ? api.runtimeSuccess({
			diagnosticType: "render_dom_drop",
			errorCode: "render_dom_drop"
		}) : {};
		return {
			ok: token === "Home_AI_Thread_Detai" && missingEffects.reason === "submitted-message-dom-missing" && Array.isArray(missingEffects.effects) && missingEffects.effects[0] && missingEffects.effects[0].type === "diagnostic-failure" && stallEffects.reason === "thread-list-interaction-stall" && monitorResult.renderCount === 1 && Array.isArray(monitorResult.effects) && monitorResult.effects.length === 2 && dropEvent.diagnostic_type === "render_dom_drop" && success.error_code === "render_dom_drop",
			token,
			missingReason: String(missingEffects.reason || ""),
			stallReason: String(stallEffects.reason || ""),
			monitorRenderCount: Number(monitorResult.renderCount) || 0,
			dropDiagnosticType: String(dropEvent.diagnostic_type || ""),
			successErrorCode: String(success.error_code || "")
		};
	}
	if (id === "home-ai-diagnostic-reporting") {
		const token = functionReady(api, "boundedToken") ? api.boundedToken(" Home AI / Codex Mobile ", "fallback", 16) : "";
		const duration = functionReady(api, "durationBucket") ? api.durationBucket(4200) : "";
		const hash = functionReady(api, "hashIdentifier") ? api.hashIdentifier("thread-title", "t") : "";
		const sanitized = functionReady(api, "sanitizeInput") ? api.sanitizeInput({
			diagnostic_type: "render_lag",
			error_code: "lag",
			counts: {
				ok_count: 3,
				raw_body: 4
			},
			context: {
				thread_hash: "abc",
				title: "unsafe"
			}
		}) : {};
		const reporter = functionReady(api, "createDiagnosticReporter") ? api.createDiagnosticReporter({
			threshold: 2,
			throttleMs: 0,
			now: () => 1e3
		}) : null;
		const first = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const second = reporter && typeof reporter.recordFailure === "function" ? reporter.recordFailure({
			diagnostic_type: "render_lag",
			error_code: "lag"
		}) : {};
		const post = functionReady(api, "postReportToHomeAi") ? api.postReportToHomeAi({
			embedded: false,
			report: second.report
		}) : {};
		const textHash = functionReady(api, "stableTextHash") ? api.stableTextHash("diagnostic") : "";
		return {
			ok: token === "Home_AI_Codex_Mo" && duration === "3_10s" && /^t_/.test(hash) && sanitized.category === "codex_runtime_failure" && sanitized.counts && sanitized.counts.ok_count === 3 && !Object.prototype.hasOwnProperty.call(sanitized.counts || {}, "raw_body") && first.eligible === false && second.eligible === true && post.reason === "not_embedded" && textHash.length > 0,
			token,
			duration,
			hashPrefix: String(hash || "").slice(0, 2),
			sanitizedCategory: String(sanitized.category || ""),
			secondEligible: Boolean(second.eligible),
			postReason: String(post.reason || ""),
			textHash
		};
	}
	if (id === "thread-diagnostic-events") {
		const snapshot = functionReady(api, "conversationProjectionDiagnosticSnapshot") ? api.conversationProjectionDiagnosticSnapshot({
			renderedConversationSignature: "old",
			currentSignature: "new",
			domShape: {
				renderKeyCount: 1,
				duplicateRenderKeyCount: 1
			},
			thread: { mobileReadMode: "thread-read" }
		}, { visibleShape: () => ({
			visibleTurnCount: 2,
			visibleItemCount: 3
		}) }) : {};
		const order = functionReady(api, "turnOrderDiagnosticSnapshot") ? api.turnOrderDiagnosticSnapshot({
			expectedTurnIds: ["a", "b"],
			domTurnIds: ["a"],
			threadHash: "thread"
		}) : {};
		const effects = functionReady(api, "conversationProjectionConsistencyEffects") ? api.conversationProjectionConsistencyEffects({
			snapshot,
			orderSnapshot: order
		}) : {};
		const renderEvent = functionReady(api, "renderSignatureMismatchDiagnosticEvent") ? api.renderSignatureMismatchDiagnosticEvent(snapshot) : {};
		const responseEffects = functionReady(api, "threadDetailResponseDiagnosticEffects") ? api.threadDetailResponseDiagnosticEffects({ contractPlan: {
			shouldReport: true,
			reason: "contract",
			turns: 2,
			items: 3,
			visibleItems: 3,
			readMode: "thread-read"
		} }) : {};
		const normalized = functionReady(api, "projectionDiagnosticSnapshot") ? api.projectionDiagnosticSnapshot(snapshot) : {};
		const count = functionReady(api, "boundedCount") ? api.boundedCount(100001) : 0;
		const token = functionReady(api, "compactToken") ? api.compactToken(" Detail / Render ", "fallback", 20) : "";
		return {
			ok: snapshot.renderedSignature === "old" && normalized.counts && normalized.counts.visible_count === 3 && order.counts && order.counts.latest_mismatch_count === 1 && Array.isArray(effects.effects) && effects.effects.length === 3 && renderEvent.diagnostic_type === "render_signature_mismatch" && Array.isArray(responseEffects.effects) && responseEffects.effects[0] && responseEffects.effects[0].type === "diagnostic-failure" && count === 1e5 && token === "Detail_Render",
			renderedSignature: String(snapshot.renderedSignature || ""),
			visibleCount: Number(normalized.counts && normalized.counts.visible_count) || 0,
			latestMismatch: Number(order.counts && order.counts.latest_mismatch_count) || 0,
			effectCount: Array.isArray(effects.effects) ? effects.effects.length : 0,
			renderDiagnosticType: String(renderEvent.diagnostic_type || ""),
			responseEffectCount: Array.isArray(responseEffects.effects) ? responseEffects.effects.length : 0,
			count,
			token
		};
	}
	if (id === "thread-tile-layout") {
		const layout = functionReady(api, "layoutForViewport") ? api.layoutForViewport({
			enabled: true,
			viewportWidth: 1500,
			viewportHeight: 900,
			sidebarWidth: 0,
			coarsePointer: true,
			orientation: "landscape",
			menuOverlay: true
		}) : null;
		const ids = functionReady(api, "selectThreadTileIds") ? api.selectThreadTileIds({
			currentThreadId: "thread-2",
			pinnedThreadIds: ["thread-3", "thread-2"],
			threadIds: [
				"thread-1",
				"thread-3",
				"thread-4"
			],
			maxPanes: 3
		}) : [];
		const pinnedIds = functionReady(api, "selectPinnedThreadTileIds") ? api.selectPinnedThreadTileIds({
			currentThreadId: "thread-current",
			pinnedThreadIds: [
				"thread-1",
				"thread-2",
				"thread-3"
			],
			threadIds: ["thread-current", "thread-4"],
			maxPanes: 3
		}) : [];
		const pairs = functionReady(api, "normalizeSplitPairs") ? api.normalizeSplitPairs([{
			anchorId: "b",
			childId: "e"
		}, {
			anchorId: "b",
			childId: "c"
		}], [
			"a",
			"b",
			"c",
			"d",
			"e"
		]) : [];
		const groups = functionReady(api, "threadTileColumnGroups") ? api.threadTileColumnGroups({
			ids: [
				"a",
				"b",
				"c",
				"d",
				"e"
			],
			columns: 4,
			splitPairs: [{
				anchorId: "b",
				childId: "e"
			}]
		}) : [];
		return {
			ok: !!layout && layout.enabled === true && layout.columns === 4 && ids.join(",") === "thread-2,thread-3,thread-1" && pinnedIds.join(",") === "thread-1,thread-2,thread-current" && pairs.length === 1 && pairs[0].anchorId === "b" && pairs[0].childId === "e" && JSON.stringify(groups) === JSON.stringify([
				["a"],
				["b", "e"],
				["c"],
				["d"]
			]),
			layout,
			ids,
			pinnedIds,
			pairs,
			groups
		};
	}
	if (id === "thread-tile-actions") {
		const paneA = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const paneB = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-pane" ? "thread-b" : "";
			},
			closest() {
				return null;
			}
		};
		const title = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-title" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const handle = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-drag-handle" ? "thread-a" : "";
			},
			closest(selector) {
				return selector === "[data-thread-tile-pane]" ? paneA : null;
			}
		};
		const bottom = {
			disabled: false,
			getAttribute(name) {
				return name === "data-thread-tile-bottom" ? "thread-a" : "";
			},
			closest() {
				return null;
			}
		};
		const root = { contains(node) {
			return node === paneA || node === paneB || node === title || node === handle || node === bottom;
		} };
		const titleTarget = { closest(selector) {
			return selector === "[data-thread-tile-title]" ? title : selector === "[data-thread-tile-pane]" ? paneA : null;
		} };
		const bottomTarget = { closest(selector) {
			return selector === "[data-thread-tile-bottom]" ? bottom : null;
		} };
		const handleTarget = { closest(selector) {
			return selector === "[data-thread-tile-drag-handle]" ? handle : null;
		} };
		const paneBTarget = { closest(selector) {
			return selector === "[data-thread-tile-pane]" ? paneB : null;
		} };
		const pointer = functionReady(api, "resolveThreadTilePointerAction") ? api.resolveThreadTilePointerAction({
			root,
			target: titleTarget
		}) : {};
		const click = functionReady(api, "resolveThreadTileClickAction") ? api.resolveThreadTileClickAction({
			root,
			target: bottomTarget
		}) : {};
		const dragStart = functionReady(api, "resolveThreadTileDragStartAction") ? api.resolveThreadTileDragStartAction({
			root,
			target: handleTarget
		}) : {};
		const drop = functionReady(api, "resolveThreadTileDropAction") ? api.resolveThreadTileDropAction({
			root,
			target: paneBTarget,
			draggingId: "thread-a"
		}) : {};
		return {
			ok: pointer.action === "select-pane" && pointer.paneId === "thread-a" && click.action === "scroll-pane-bottom" && click.preventDefault === true && dragStart.action === "drag-start" && dragStart.paneId === "thread-a" && drop.action === "drop-pane" && drop.draggingId === "thread-a" && drop.targetId === "thread-b",
			pointerAction: String(pointer.action || ""),
			clickAction: String(click.action || ""),
			dragStartAction: String(dragStart.action || ""),
			dropAction: String(drop.action || "")
		};
	}
	if (id === "thread-tile-state") {
		const candidate = functionReady(api, "candidatePaneIdsPlan") ? api.candidatePaneIdsPlan({
			defaultIds: ["thread-a", "thread-b"],
			visibleIds: ["thread-a", "thread-b"],
			pinnedIds: ["thread-b"],
			currentThreadId: "thread-a",
			maxPanes: 2
		}) : {};
		const paneCount = functionReady(api, "normalizePaneCount") ? api.normalizePaneCount("3", { maxPanes: 12 }) : 0;
		const refreshDelay = functionReady(api, "refreshDelayMs") ? api.refreshDelayMs({
			visible: true,
			active: true
		}) : 0;
		const loadSuccess = functionReady(api, "detailLoadSuccessEffectsPlan") ? api.detailLoadSuccessEffectsPlan({
			threadId: "thread-a",
			hasThread: true,
			nowMs: 1234
		}) : {};
		const selected = functionReady(api, "effectiveSelectedThreadId") ? api.effectiveSelectedThreadId({
			ids: ["thread-a", "thread-b"],
			selectedThreadId: "thread-a",
			currentThreadId: "thread-b"
		}) : "";
		return {
			ok: candidate.action === "candidate-pane-ids" && candidate.ids && candidate.ids.join(",") === "thread-b,thread-a" && paneCount === 3 && refreshDelay === 500 && loadSuccess.reason === "thread-loaded" && loadSuccess.loadedAtMs === 1234 && selected === "thread-a",
			candidateIds: Array.isArray(candidate.ids) ? candidate.ids : [],
			paneCount,
			refreshDelay,
			loadSuccessReason: String(loadSuccess.reason || ""),
			selected
		};
	}
	if (id === "thread-tile-runtime") {
		const statePolicy = globalThis.CodexThreadTileState || {};
		const layoutPolicy = globalThis.CodexThreadTileLayout || {};
		const actionsApi = globalThis.CodexThreadTileActions || {};
		const runtime = functionReady(api, "createThreadTileRuntime") ? api.createThreadTileRuntime({
			state: {
				threadTileMode: true,
				threadTilePaneCount: "3",
				threadTilePinnedThreadIds: [
					"thread-b",
					"thread-a",
					"thread-b"
				],
				threadTileSplitPairs: [{
					anchorId: "thread-a",
					childId: "thread-c"
				}],
				threads: [
					{
						id: "thread-a",
						status: "running"
					},
					{
						id: "thread-b",
						status: "idle"
					},
					{
						id: "thread-c",
						status: "idle"
					}
				],
				currentThreadId: "thread-b",
				threadDisplaySettingsLoaded: true,
				threadTileViewportBaseline: null,
				threadTileComposerHeightBaselinePx: 0,
				composerHeightPx: 0
			},
			document: {
				documentElement: {
					clientWidth: 1400,
					clientHeight: 900
				},
				activeElement: null
			},
			window: {
				innerWidth: 1400,
				innerHeight: 900,
				visualViewport: {
					width: 1320,
					height: 820
				},
				matchMedia: () => ({ matches: false })
			},
			threadTileStatePolicy: statePolicy,
			threadTileLayoutPolicy: layoutPolicy,
			threadTileActionsApi: actionsApi,
			THREAD_TILE_USER_MAX_PANES: 6,
			THREAD_TILE_REFRESH_INTERVAL_MS: 5e3,
			THREAD_TILE_REFRESH_MIN_INTERVAL_MS: 500,
			STORAGE_THREAD_DISPLAY_MODE: "codex.threadDisplayMode",
			STORAGE_LEGACY_THREAD_TILE_MODE: "codex.legacyThreadTileMode",
			$: () => null,
			isKeyboardEditableElement: () => false,
			splitPaneSidebarVisible: () => false,
			isMenuOverlayMode: () => false,
			visibleThreads: (threads) => Array.isArray(threads) ? threads : [],
			isRunningStatus: (status) => status === "running" || status === "in_progress"
		}) : {};
		const viewport = runtime && typeof runtime.viewportPixelSize === "function" ? runtime.viewportPixelSize({ preferLayoutViewport: true }) : {};
		const paneCount = runtime && typeof runtime.normalizeThreadTilePaneCount === "function" ? runtime.normalizeThreadTilePaneCount("3", 1) : 0;
		const pinnedIds = runtime && typeof runtime.normalizeThreadTilePinnedIds === "function" ? runtime.normalizeThreadTilePinnedIds([
			"thread-b",
			"thread-a",
			"thread-b"
		]) : [];
		const idsEqual = runtime && typeof runtime.threadTileIdsEqual === "function" ? runtime.threadTileIdsEqual(["thread-a", "thread-b"], ["thread-a", "thread-b"]) : false;
		const payload = runtime && typeof runtime.threadDisplaySettingsPayload === "function" ? runtime.threadDisplaySettingsPayload() : {};
		const layout = runtime && typeof runtime.threadTileLayout === "function" ? runtime.threadTileLayout({ enabled: true }) : {};
		const status = runtime && typeof runtime.threadTileLayoutStatusText === "function" ? runtime.threadTileLayoutStatusText(layout) : "";
		return {
			ok: runtime && typeof runtime === "object" && viewport.width === 1400 && viewport.height === 900 && paneCount === 3 && pinnedIds.join(",") === "thread-b,thread-a" && idsEqual === true && payload.displayMode === "tile" && payload.paneCount === 3 && layout.enabled === true && status === "当前视口：平铺 3/3 窗",
			factoryType: typeof api.createThreadTileRuntime,
			viewportWidth: Number(viewport.width) || 0,
			viewportHeight: Number(viewport.height) || 0,
			paneCount,
			pinnedIds,
			idsEqual,
			displayMode: String(payload.displayMode || ""),
			layoutColumns: Number(layout.columns) || 0,
			status
		};
	}
	if (id === "app-update-runtime") {
		const runtime = functionReady(api, "createAppUpdateRuntime") ? api.createAppUpdateRuntime({
			CLIENT_BUILD_ID: "0.1.11|codex-mobile-shell-v625-a5a3d596240d",
			state: {
				appVersion: "0.1.11",
				publicReleaseEnabled: true
			},
			PAGE_SHELL_ASSETS: ["/app.js", "/sw.js"],
			escapeHtml: (value) => String(value == null ? "" : value),
			buildRefreshPolicy: { shouldPromptForServerBuildChange: () => true }
		}) : null;
		const client = runtime && typeof runtime.clientBuildVersionText === "function" ? runtime.clientBuildVersionText() : "";
		const version = runtime && typeof runtime.appVersionText === "function" ? runtime.appVersionText({ version: "0.1.11" }) : "";
		const updateLine = runtime && typeof runtime.updateStatusLine === "function" ? runtime.updateStatusLine({
			updateAvailable: true,
			canFastForward: true,
			remoteShort: "abc123"
		}) : "";
		const publicLine = runtime && typeof runtime.publicReleaseStatusLine === "function" ? runtime.publicReleaseStatusLine({
			updateAvailable: true,
			publicShort: "def456"
		}) : "";
		const serverBuild = runtime && typeof runtime.serverBuildIdFromConfig === "function" ? runtime.serverBuildIdFromConfig({
			clientBuildId: "client-a",
			shellCacheName: "cache-a"
		}) : "";
		return {
			ok: runtime && typeof runtime.refreshPageForNewBuild === "function" && client === "客户端 v625" && version === "v0.1.11 · 客户端 v625" && updateLine === "Update available: abc123" && publicLine === "Public latest: def456" && serverBuild === "client-a",
			client,
			version,
			updateLine,
			publicLine,
			serverBuild,
			refreshReady: Boolean(runtime && typeof runtime.refreshPageForNewBuild === "function")
		};
	}
	if (id === "modal-runtime") {
		const runtime = functionReady(api, "createModalRuntime") ? api.createModalRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.requestAppNativeDialog === "function" && typeof runtime.requestAppAlert === "function" && typeof runtime.requestAppConfirmation === "function" && typeof runtime.requestAppTextInput === "function" && typeof runtime.requestCodexProfileSwitchConfirmation === "function" && typeof globalThis.handleAppNativeDialogKeydown === "function" && typeof globalThis.closeAppNativeDialog === "function" && typeof globalThis.performCodexProfileSwitch === "function",
			factoryType: typeof api.createModalRuntime,
			nativeDialogType: typeof (runtime && runtime.requestAppNativeDialog),
			alertType: typeof (runtime && runtime.requestAppAlert),
			confirmationType: typeof (runtime && runtime.requestAppConfirmation),
			textInputType: typeof (runtime && runtime.requestAppTextInput),
			profileSwitchType: typeof (runtime && runtime.requestCodexProfileSwitchConfirmation),
			keydownType: typeof globalThis.handleAppNativeDialogKeydown,
			closeType: typeof globalThis.closeAppNativeDialog,
			switchType: typeof globalThis.performCodexProfileSwitch
		};
	}
	if (id === "navigation-runtime") {
		const runtime = functionReady(api, "createNavigationRuntime") ? api.createNavigationRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.updateConnectionState === "function" && typeof runtime.restoreConnectionState === "function" && typeof runtime.markActivity === "function" && typeof runtime.composerTargetPlan === "function" && typeof runtime.visibleTurnsForConversation === "function" && typeof runtime.conversationRenderSignature === "function" && typeof runtime.updateTurnTimer === "function" && typeof globalThis.updateConnectionState === "function" && typeof globalThis.composerTargetPlan === "function" && typeof globalThis.visibleTurnsForConversation === "function",
			factoryType: typeof api.createNavigationRuntime,
			updateType: typeof (runtime && runtime.updateConnectionState),
			restoreType: typeof (runtime && runtime.restoreConnectionState),
			activityType: typeof (runtime && runtime.markActivity),
			composerPlanType: typeof (runtime && runtime.composerTargetPlan),
			visibleTurnsType: typeof (runtime && runtime.visibleTurnsForConversation),
			signatureType: typeof (runtime && runtime.conversationRenderSignature),
			timerType: typeof (runtime && runtime.updateTurnTimer),
			globalUpdateType: typeof globalThis.updateConnectionState,
			globalComposerPlanType: typeof globalThis.composerTargetPlan,
			globalVisibleTurnsType: typeof globalThis.visibleTurnsForConversation
		};
	}
	if (id === "runtime-wiring-runtime") {
		const runtime = functionReady(api, "createRuntimeWiringRuntime") ? api.createRuntimeWiringRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.initialize === "function",
			factoryType: typeof api.createRuntimeWiringRuntime,
			initializeType: typeof (runtime && runtime.initialize),
			globalType: typeof globalThis.CodexRuntimeWiringRuntime
		};
	}
	if (id === "app-shell-runtime") {
		const runtime = functionReady(api, "createAppShellRuntime") ? api.createAppShellRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.wireUi === "function" && typeof runtime.start === "function" && typeof runtime.startCodexMobileAppWithRecovery === "function",
			factoryType: typeof api.createAppShellRuntime,
			wireUiType: typeof (runtime && runtime.wireUi),
			startType: typeof (runtime && runtime.start),
			recoveryType: typeof (runtime && runtime.startCodexMobileAppWithRecovery),
			globalType: typeof globalThis.CodexAppShellRuntime
		};
	}
	if (id === "pane-layout-runtime") {
		const runtime = functionReady(api, "createPaneLayoutRuntime") ? api.createPaneLayoutRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderCurrentThread === "function" && typeof runtime.updateConversationHtml === "function" && typeof runtime.patchCurrentThreadDetailFromRefresh === "function" && typeof runtime.syncThreadTileToggle === "function" && typeof runtime.setThreadTileMode === "function" && typeof runtime.renderHome === "function" && typeof runtime.loadThread === "function" && typeof runtime.loadThreads === "function" && typeof runtime.enterNewThreadDraft === "function" && typeof runtime.handleThreadCardClick === "function" && typeof runtime.showHermesPluginPrimaryPage === "function" && typeof runtime.returnToThreadListFromDetail === "function" && typeof globalThis.loadThread === "function" && typeof globalThis.loadThreads === "function" && typeof globalThis.renderCurrentThread === "function",
			factoryType: typeof api.createPaneLayoutRuntime,
			renderType: typeof (runtime && runtime.renderCurrentThread),
			updateHtmlType: typeof (runtime && runtime.updateConversationHtml),
			patchType: typeof (runtime && runtime.patchCurrentThreadDetailFromRefresh),
			tileToggleType: typeof (runtime && runtime.syncThreadTileToggle),
			tileModeType: typeof (runtime && runtime.setThreadTileMode),
			homeType: typeof (runtime && runtime.renderHome),
			loadThreadType: typeof (runtime && runtime.loadThread),
			loadThreadsType: typeof (runtime && runtime.loadThreads),
			newThreadType: typeof (runtime && runtime.enterNewThreadDraft),
			cardClickType: typeof (runtime && runtime.handleThreadCardClick),
			pluginPrimaryType: typeof (runtime && runtime.showHermesPluginPrimaryPage),
			returnType: typeof (runtime && runtime.returnToThreadListFromDetail),
			globalLoadThreadType: typeof globalThis.loadThread,
			globalLoadThreadsType: typeof globalThis.loadThreads,
			globalRenderType: typeof globalThis.renderCurrentThread
		};
	}
	if (id === "thread-list-runtime") {
		const runtime = functionReady(api, "createThreadListRuntime") ? api.createThreadListRuntime({}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreads === "function" && typeof runtime.loadThreads === "function",
			factoryType: typeof api.createThreadListRuntime,
			renderThreadsType: typeof (runtime && runtime.renderThreads),
			loadThreadsType: typeof (runtime && runtime.loadThreads)
		};
	}
	if (id === "side-chat-runtime") {
		const state = {
			currentThreadId: "thread-a",
			currentThread: { id: "thread-a" },
			threadSideChats: /* @__PURE__ */ new Map(),
			nowMs: Date.parse("2026-07-02T00:00:00Z")
		};
		const runtime = functionReady(api, "createSideChatRuntime") ? api.createSideChatRuntime({
			state,
			api: async () => ({ sideChat: null }),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			statusText: (status) => String(status || ""),
			formatTime: () => "now",
			truncateMiddle: (value) => String(value || "")
		}) : {};
		const normalized = runtime && typeof runtime.normalizeSideChatState === "function" ? runtime.normalizeSideChatState({
			messages: [{
				role: "assistant",
				text: "hi"
			}],
			sidecar: { status: "pending" }
		}, "thread-a") : {};
		if (runtime && typeof runtime.setSideChatState === "function") runtime.setSideChatState("thread-a", normalized);
		const path = runtime && typeof runtime.sideChatApiPath === "function" ? runtime.sideChatApiPath("thread-a", "/draft") : "";
		const status = runtime && typeof runtime.sideChatStatusLabel === "function" ? runtime.sideChatStatusLabel("queued") : "";
		const queue = runtime && typeof runtime.sideChatQueueSummary === "function" ? runtime.sideChatQueueSummary({
			status: "queued",
			mode: "autoSendWhenIdle"
		}) : "";
		const pending = runtime && typeof runtime.sideChatReplyPending === "function" ? runtime.sideChatReplyPending("thread-a") : false;
		const subagentKind = runtime && typeof runtime.subagentStatusKind === "function" ? runtime.subagentStatusKind("running") : "";
		const subagentLabel = runtime && typeof runtime.subagentStatusLabel === "function" ? runtime.subagentStatusLabel("running") : "";
		const panel = runtime && typeof runtime.renderSideChatPanel === "function" ? runtime.renderSideChatPanel() : "";
		return {
			ok: runtime && typeof runtime === "object" && normalized.threadId === "thread-a" && Array.isArray(normalized.messages) && normalized.messages.length === 1 && path === "/api/threads/thread-a/side-chat/draft" && status === "已排队" && queue === "已排队 · 完成后自动发送" && pending === true && subagentKind === "running" && subagentLabel === "运行中" && String(panel || "").includes("side-chat-section"),
			factoryType: typeof api.createSideChatRuntime,
			normalizedThreadId: String(normalized.threadId || ""),
			messageCount: Array.isArray(normalized.messages) ? normalized.messages.length : 0,
			path,
			status,
			queue,
			pending,
			subagentKind,
			subagentLabel,
			panelReady: String(panel || "").includes("side-chat-section")
		};
	}
	if (id === "media-preview-runtime") {
		const element = {
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerText: id === "messageInput" ? "hello" : "",
			innerHTML: ""
		};
		const document = {
			documentElement: {
				getAttribute: () => "light",
				setAttribute: () => {}
			},
			head: element,
			createElement: () => Object.assign({}, element),
			getElementById: () => Object.assign({}, element),
			querySelector: () => null,
			querySelectorAll: () => []
		};
		const runtime = functionReady(api, "createMediaPreviewRuntime") ? api.createMediaPreviewRuntime({
			state: {
				key: "sample-key",
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" }
			},
			document,
			window: {
				location: {
					origin: "http://127.0.0.1:8787",
					pathname: "/"
				},
				CodexMarkdownRenderer: {
					renderMarkdown: (value) => `<p>${String(value == null ? "" : value)}</p>`,
					normalizeMermaidSourceForRender: (value) => String(value || "")
				},
				matchMedia: () => ({ matches: true }),
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {}
			},
			$: () => Object.assign({}, element),
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			normalizeFsPath: (value) => String(value || ""),
			shortPath: (value) => String(value || "").split("/").pop() || "",
			compactStructuredForSignature: (value) => JSON.stringify(value),
			visibleThreadTaskCardCommandText: (value) => String(value || ""),
			rememberCopyText: (value) => String(value || ""),
			copyButtonHtml: () => "<button></button>",
			stableTextHash: (value) => `hash:${String(value || "").length}`,
			renderContextThreadId: () => "thread-a",
			publishPluginNavigationState: () => {},
			postPerformanceEvent: () => {},
			roundedDurationMs: () => 1,
			nowPerfMs: () => 1,
			isHermesEmbedMode: () => false,
			isIosWebKitBrowser: () => false,
			requestHermesPluginRefresh: () => {},
			primaryTouch: (event) => event && event.touches && event.touches[0] || null
		}) : {};
		const githubUrl = runtime && typeof runtime.normalizeGithubPreviewUrl === "function" ? runtime.normalizeGithubPreviewUrl("https://github.com/openai/codex/pull/7") : "";
		const jsonPreview = runtime && typeof runtime.renderFilePreviewContent === "function" ? runtime.renderFilePreviewContent({
			kind: "json",
			content: "{\"ok\":true}"
		}) : "";
		return {
			ok: runtime && typeof runtime === "object" && githubUrl === "https://github.com/openai/codex/pull/7" && String(jsonPreview || "").includes("file-preview-text") && typeof runtime.renderMarkdownWithAttachmentSummary === "function" && typeof runtime.openImagePreviewFromImage === "function" && typeof runtime.renderImageView === "function" && typeof runtime.scheduleVisibleImageFailureScan === "function",
			factoryType: typeof api.createMediaPreviewRuntime,
			githubUrl,
			jsonPreviewReady: String(jsonPreview || "").includes("file-preview-text"),
			markdownType: typeof (runtime && runtime.renderMarkdownWithAttachmentSummary),
			imagePreviewType: typeof (runtime && runtime.openImagePreviewFromImage),
			imageViewType: typeof (runtime && runtime.renderImageView),
			scanType: typeof (runtime && runtime.scheduleVisibleImageFailureScan)
		};
	}
	if (id === "composer-runtime") {
		const elements = /* @__PURE__ */ new Map();
		const element = (id = "") => ({
			id,
			value: id === "messageInput" ? "hello" : "",
			files: [],
			classList: {
				contains: () => false,
				add: () => {},
				remove: () => {},
				toggle: () => {}
			},
			dataset: {},
			style: {
				setProperty: () => {},
				removeProperty: () => {}
			},
			getBoundingClientRect: () => ({
				width: 120,
				height: 32,
				left: 0,
				top: 0,
				right: 120,
				bottom: 32
			}),
			focus: () => {},
			blur: () => {},
			select: () => {},
			setSelectionRange: () => {},
			querySelector: () => null,
			querySelectorAll: () => [],
			closest: () => null,
			addEventListener: () => {},
			removeEventListener: () => {},
			appendChild: () => {},
			setAttribute: () => {},
			getAttribute: () => "",
			removeAttribute: () => {},
			textContent: "",
			innerHTML: ""
		});
		function getElement(id) {
			if (!elements.has(id)) elements.set(id, element(id));
			return elements.get(id);
		}
		const runtime = functionReady(api, "createComposerRuntime") ? api.createComposerRuntime({
			state: {
				threads: [],
				pendingAttachments: [],
				composerRuntimeSelection: {},
				codexProfiles: [],
				currentThreadId: "thread-a",
				currentThread: { id: "thread-a" },
				newThreadDraft: false
			},
			document: {
				documentElement: { style: {
					setProperty: () => {},
					removeProperty: () => {}
				} },
				activeElement: null,
				addEventListener: () => {},
				removeEventListener: () => {},
				createElement: () => element(),
				getElementById: getElement,
				querySelector: () => null,
				querySelectorAll: () => []
			},
			window: {
				setTimeout: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				clearTimeout: () => {},
				requestAnimationFrame: (callback) => {
					if (typeof callback === "function") callback();
					return 1;
				},
				crypto: { randomUUID: () => "sample-uuid" },
				visualViewport: {
					width: 390,
					height: 700
				},
				innerWidth: 390,
				innerHeight: 700
			},
			$: getElement,
			api: async () => ({}),
			escapeHtml: (value) => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
			viewportMetrics: {
				cssPixel: (value) => Math.round(Number(value) || 0),
				stablePixelChanged: (left, right) => Math.abs((Number(left) || 0) - (Number(right) || 0)) >= 2
			},
			normalizeOptionList: (values) => Array.isArray(values) ? values.filter(Boolean).map((value) => String(value).trim()) : [],
			labelForModel: (value) => `Model ${String(value || "")}`.trim(),
			labelForEffort: (value) => `Effort ${String(value || "")}`.trim(),
			labelForPermissionMode: (value) => `Permission ${String(value || "")}`.trim(),
			defaultNewThreadModel: () => "gpt-5.5",
			defaultNewThreadEffort: () => "medium",
			defaultNewThreadPermissionMode: () => "auto",
			effectiveComposerPermissionMode: (value) => String(value || "").trim() || "auto",
			newThreadSelectedModel: () => "",
			newThreadSelectedEffort: () => "",
			newThreadSelectedPermissionMode: () => "",
			currentComposerThreadId: () => "thread-a",
			composerTargetThread: () => ({
				id: "thread-a",
				model: "gpt-5.5",
				effort: "medium",
				runtimeSettings: { permissionMode: "auto" }
			}),
			selectedQuotaModel: () => "gpt-5.5",
			threadDisplayName: () => "Thread A",
			isThreadTileComposerContext: () => false,
			isAndroidBrowser: () => false,
			isHermesEmbedMode: () => false,
			isKeyboardEditableElement: () => false,
			threadTileStatePolicy: { composerTargetPlaceholderPlan: () => ({ text: "Send to Thread A" }) },
			imageCompressor: {},
			homeAiDiagnosticReportingApi: {}
		}) : {};
		const model = runtime && typeof runtime.effectiveDefaultModel === "function" ? runtime.effectiveDefaultModel() : "";
		const effort = runtime && typeof runtime.effectiveDefaultEffort === "function" ? runtime.effectiveDefaultEffort() : "";
		const permission = runtime && typeof runtime.effectiveDefaultPermissionMode === "function" ? runtime.effectiveDefaultPermissionMode() : "";
		const label = runtime && typeof runtime.runtimeOptionLabel === "function" ? runtime.runtimeOptionLabel("model", "gpt-5.5") : "";
		const placeholder = runtime && typeof runtime.composerPlaceholderText === "function" ? runtime.composerPlaceholderText() : "";
		return {
			ok: runtime && typeof runtime === "object" && model === "gpt-5.5" && effort === "medium" && permission === "auto" && label === "Model gpt-5.5" && placeholder === "Send to Thread A" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.interruptActiveTurn === "function",
			factoryType: typeof api.createComposerRuntime,
			model,
			effort,
			permission,
			label,
			placeholder,
			sendType: typeof (runtime && runtime.sendMessage),
			newThreadType: typeof (runtime && runtime.sendNewThreadMessage),
			interruptType: typeof (runtime && runtime.interruptActiveTurn)
		};
	}
	if (id === "composer-bridge-runtime") {
		const runtime = functionReady(api, "createComposerBridgeRuntime") ? api.createComposerBridgeRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.sendMessage === "function" && typeof runtime.sendNewThreadMessage === "function" && typeof runtime.answerServerRequest === "function" && typeof runtime.answerApproval === "function" && typeof runtime.declineServerRequest === "function" && typeof runtime.mutateThreadTaskCard === "function" && typeof runtime.replyTaskCard === "function" && typeof runtime.queueThreadTaskCardDraftCreation === "function" && typeof runtime.createThreadTaskCardDraft === "function" && typeof globalThis.sendMessage === "function" && typeof globalThis.answerApproval === "function" && typeof globalThis.mutateThreadTaskCard === "function" && typeof globalThis.queueThreadTaskCardDraftCreation === "function",
			factoryType: typeof api.createComposerBridgeRuntime,
			sendType: typeof (runtime && runtime.sendMessage),
			answerType: typeof (runtime && runtime.answerServerRequest),
			approvalType: typeof (runtime && runtime.answerApproval),
			mutateType: typeof (runtime && runtime.mutateThreadTaskCard),
			replyType: typeof (runtime && runtime.replyTaskCard),
			draftType: typeof (runtime && runtime.createThreadTaskCardDraft),
			globalSendType: typeof globalThis.sendMessage,
			globalApprovalType: typeof globalThis.answerApproval,
			globalMutateType: typeof globalThis.mutateThreadTaskCard,
			globalDraftQueueType: typeof globalThis.queueThreadTaskCardDraftCreation
		};
	}
	if (id === "api-client-runtime") {
		const runtime = functionReady(api, "createApiClientRuntime") ? api.createApiClientRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.api === "function" && typeof runtime.postClientEvent === "function" && typeof runtime.postPerformanceEvent === "function" && typeof runtime.recordHomeAiDiagnosticFailure === "function" && typeof runtime.recordHomeAiDiagnosticSuccess === "function" && typeof runtime.scheduleSubmittedMessageDomProbe === "function" && typeof runtime.checkConversationProjectionConsistency === "function" && typeof runtime.handlePushButtonClick === "function" && typeof globalThis.api === "function" && typeof globalThis.postClientEvent === "function" && typeof globalThis.diagnosticThreadHash === "function" && typeof globalThis.recordHomeAiDiagnosticFailure === "function" && typeof globalThis.scheduleSubmittedMessageDomProbe === "function" && typeof globalThis.checkConversationProjectionConsistency === "function" && typeof globalThis.handlePushButtonClick === "function",
			factoryType: typeof api.createApiClientRuntime,
			apiType: typeof (runtime && runtime.api),
			clientEventType: typeof (runtime && runtime.postClientEvent),
			performanceType: typeof (runtime && runtime.postPerformanceEvent),
			diagnosticFailureType: typeof (runtime && runtime.recordHomeAiDiagnosticFailure),
			diagnosticSuccessType: typeof (runtime && runtime.recordHomeAiDiagnosticSuccess),
			submittedProbeType: typeof (runtime && runtime.scheduleSubmittedMessageDomProbe),
			projectionCheckType: typeof (runtime && runtime.checkConversationProjectionConsistency),
			pushType: typeof (runtime && runtime.handlePushButtonClick),
			globalApiType: typeof globalThis.api,
			globalClientEventType: typeof globalThis.postClientEvent,
			globalThreadHashType: typeof globalThis.diagnosticThreadHash,
			globalSubmittedProbeType: typeof globalThis.scheduleSubmittedMessageDomProbe,
			globalProjectionCheckType: typeof globalThis.checkConversationProjectionConsistency,
			globalPushType: typeof globalThis.handlePushButtonClick
		};
	}
	if (id === "thread-list-load-policy") {
		const plan = functionReady(api, "planThreadListLoadRequest") ? api.planThreadListLoadRequest({
			silent: true,
			threadDetailOpening: true,
			deferFallback: true
		}) : {};
		return {
			ok: plan && plan.action === "thread-list-load-request" && plan.shouldLoad === false && plan.skipReason === "detail-in-flight" && plan.retryDelayMs === 700,
			action: String(plan && plan.action || ""),
			shouldLoad: Boolean(plan && plan.shouldLoad),
			skipReason: String(plan && plan.skipReason || ""),
			retryDelayMs: Number(plan && plan.retryDelayMs) || 0
		};
	}
	if (id === "thread-list-stable-order") {
		const scopeKey = functionReady(api, "threadListOrderScopeKey") ? api.threadListOrderScopeKey({
			selectedCwd: "/tmp/project",
			search: "Home"
		}) : "";
		const plan = functionReady(api, "planThreadListStableOrder") ? api.planThreadListStableOrder({
			threads: [
				{ id: "b" },
				{ id: "a" },
				{ id: "c" }
			],
			previousState: {
				scopeKey,
				holdUntilMs: 2e3,
				order: ["a", "b"]
			},
			scopeKey,
			nowMs: 1e3,
			holdMs: 5e3
		}) : {};
		const order = Array.isArray(plan.order) ? plan.order : [];
		return {
			ok: scopeKey === JSON.stringify({
				cwd: "/tmp/project",
				search: "home"
			}) && plan.held === true && order.join(",") === "a,b,c",
			scopeKey,
			held: Boolean(plan.held),
			order
		};
	}
	if (id === "thread-status-hints") {
		const running = functionReady(api, "isRunningStatus") ? api.isRunningStatus("in_progress") : false;
		const unread = functionReady(api, "shouldMarkThreadUnread") ? api.shouldMarkThreadUnread({
			threadId: "target-thread",
			currentThreadId: "other-thread",
			status: "completed",
			thread: { turns: [{
				status: "completed",
				completedAtMs: 2e3
			}] },
			viewedAtMs: 1e3
		}) : false;
		const expire = functionReady(api, "shouldExpireRunningThreadHint") ? api.shouldExpireRunningThreadHint({
			threadId: "target-thread",
			isRunningHinted: true,
			status: "idle",
			runningHintedAtMs: 0,
			runningHintStaleMs: 1e3,
			nowMs: 5e3,
			thread: {}
		}) : false;
		return {
			ok: running === true && unread === true && expire === true,
			running,
			unread,
			expire
		};
	}
	if (id === "thread-detail-patch-plan") {
		const surface = functionReady(api, "planThreadDetailDomPatchSurface") ? api.planThreadDetailDomPatchSurface({
			threadId: "thread-a",
			conversationPresent: true
		}) : {};
		const visiblePatch = functionReady(api, "planVisibleItemRefreshPatch") ? api.planVisibleItemRefreshPatch([{
			key: "a",
			signature: "1"
		}], [{
			key: "a",
			signature: "1"
		}, {
			key: "b",
			signature: "2"
		}]) : {};
		const turnPatch = functionReady(api, "planThreadDetailRefreshDomPatch") ? api.planThreadDetailRefreshDomPatch([{
			key: "turn-a",
			hasPreviousTurn: true,
			itemPatchable: true,
			articlePresent: true
		}]) : {};
		const visibleOperations = Array.isArray(visiblePatch.operations) ? visiblePatch.operations : [];
		const turnOperations = Array.isArray(turnPatch.operations) ? turnPatch.operations : [];
		return {
			ok: surface.canPatch === true && surface.reason === "single-thread-surface" && visiblePatch.canPatch === true && visibleOperations.map((entry) => entry.type).join(",") === "reuse,insert" && turnPatch.canPatch === true && turnOperations.length === 1 && turnOperations[0].type === "item-patch",
			surfaceReason: String(surface.reason || ""),
			visibleOperationCount: visibleOperations.length,
			turnOperationType: String(turnOperations[0] && turnOperations[0].type || "")
		};
	}
	if (id === "thread-detail-actions") {
		const node = (dataset) => ({
			dataset,
			closest(selector) {
				if (selector === "[data-thread-tile-pane]") return { dataset: { threadTilePane: "thread-pane" } };
				return null;
			}
		});
		const copyNode = node({ copyKey: "copy-1" });
		const approvalNode = node({
			approvalId: "ap-1",
			approvalThreadId: "thread-ap",
			approvalAction: "allow_once"
		});
		const responseNode = node({
			serverRequestId: "req-1",
			serverRequestThreadId: "thread-req",
			serverResponseText: "yes",
			serverQuestionId: "answer"
		});
		const rich = functionReady(api, "resolveRichContentClickAction") ? api.resolveRichContentClickAction({ target: { closest(selector) {
			return selector === "[data-copy-key]" ? copyNode : null;
		} } }) : {};
		const approval = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-approval-action]" ? approvalNode : null;
		} } }) : {};
		const response = functionReady(api, "resolveThreadDetailClickAction") ? api.resolveThreadDetailClickAction({ target: { closest(selector) {
			return selector === "[data-server-response-text]" ? responseNode : null;
		} } }) : {};
		const contextThreadId = functionReady(api, "contextThreadIdFromNode") ? api.contextThreadIdFromNode(copyNode) : "";
		return {
			ok: rich.action === "copy" && rich.preventDefault === true && rich.stopPropagation === true && approval.action === "approval-answer" && approval.approvalAction === "allow_once" && approval.threadId === "thread-ap" && response.action === "server-response" && response.responseText === "yes" && contextThreadId === "thread-pane",
			richAction: String(rich.action || ""),
			approvalAction: String(approval.action || ""),
			approvalValue: String(approval.approvalAction || ""),
			responseAction: String(response.action || ""),
			contextThreadId
		};
	}
	if (id === "thread-detail-merge-state") {
		const policy = functionReady(api, "createThreadDetailMergePolicy") ? api.createThreadDetailMergePolicy({
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => String(left && left.id || "").localeCompare(String(right && right.id || ""))) : [],
			turnVisibleWeight: (turn) => JSON.stringify(turn && turn.items || []).length,
			mergeItemsPreservingLocalVisible: (existingItems, incomingItems, preserveLocalVisible) => preserveLocalVisible ? existingItems : incomingItems
		}) : {};
		const merged = policy && typeof policy.mergeThreadPreservingVisibleItems === "function" ? policy.mergeThreadPreservingVisibleItems({
			id: "thread-a",
			turns: [{
				id: "b",
				items: [{
					type: "assistantMessage",
					text: "full receipt"
				}]
			}]
		}, {
			id: "thread-a",
			turns: [{
				id: "b",
				items: []
			}, {
				id: "a",
				items: [{
					type: "userMessage",
					text: "hello"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		const preserved = turns.find((turn) => turn && turn.id === "b");
		return {
			ok: turns.map((turn) => String(turn && turn.id || "")).join(",") === "a,b" && Array.isArray(preserved && preserved.items) && preserved.items.length === 1 && preserved.items[0].text === "full receipt",
			turnOrder: turns.map((turn) => String(turn && turn.id || "")),
			preservedItemCount: Array.isArray(preserved && preserved.items) ? preserved.items.length : 0
		};
	}
	if (id === "thread-detail-v4-merge-state") {
		const policy = functionReady(api, "createThreadDetailV4MergePolicy") ? api.createThreadDetailV4MergePolicy({
			normalizeThreadVisibleUserMessages: (thread) => thread,
			turnVisibleWeight: (turn) => Array.isArray(turn && turn.items) ? turn.items.length : 0,
			isOptimisticUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isRecentlySubmittedUserMessage: (item) => Boolean(item && item.mobilePendingSubmission),
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			userMessagesCanShadow: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /running|active|inprogress|in_progress/i.test(String(status && status.type || status || "")),
			isIncompleteInterruptedTurn: () => false,
			turnHasActiveLiveItems: () => false,
			turnOrderMs: (turn) => Number(turn && turn.startedAtMs) || 0,
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns.slice().sort((left, right) => (Number(left && left.startedAtMs) || 0) - (Number(right && right.startedAtMs) || 0)) : [],
			maxVisibleTurnsForThread: () => 5
		}) : {};
		const merged = policy && typeof policy.mergeV4ProjectionThread === "function" ? policy.mergeV4ProjectionThread({
			id: "thread-a",
			mobileProjectionRevision: 3,
			turns: [{
				id: "active",
				startedAtMs: 100,
				status: "running",
				items: [{
					type: "agentMessage",
					text: "streaming"
				}]
			}]
		}, {
			id: "thread-a",
			mobileProjectionRevision: 2,
			turns: [{
				id: "new",
				startedAtMs: 50,
				status: "completed",
				items: [{
					type: "userMessage",
					text: "prompt"
				}]
			}]
		}) : {};
		const turns = Array.isArray(merged && merged.turns) ? merged.turns : [];
		return {
			ok: typeof policy.mergeV4ProjectionThread === "function" && typeof policy.v4ProjectionRevisionValue === "function" && policy.v4ProjectionRevisionValue(merged) === 3 && turns.map((turn) => String(turn && turn.id || "")).join(",") === "new,active",
			revision: policy && typeof policy.v4ProjectionRevisionValue === "function" ? policy.v4ProjectionRevisionValue(merged) : 0,
			turnOrder: turns.map((turn) => String(turn && turn.id || ""))
		};
	}
	if (id === "thread-detail-runtime") {
		const statePolicy = {
			completedIncomingTurnHasAuthoritativeReceipt: () => false,
			shouldDropLocalOnlyReceiptForIncomingTurn: () => false,
			shouldPreserveLocalOnlyItem: () => false,
			shouldPreserveExistingTurnVisibleItems: () => false
		};
		const runtime = functionReady(api, "createThreadDetailRuntime") ? api.createThreadDetailRuntime({
			threadDetailStateApi: {
				createThreadDetailStatePolicy: () => statePolicy,
				threadListSummaryFromDetailThread: () => ({}),
				planThreadOpenCacheReuse: () => ({ action: "skip" }),
				threadHasReusableLoadedDetailState: () => false
			},
			threadDetailMergeStateApi: { createThreadDetailMergePolicy: () => ({ mergeThreadPreservingVisibleItems: (existingThread, incomingThread) => incomingThread || existingThread }) },
			threadDetailV4MergeStateApi: { createThreadDetailV4MergePolicy: () => ({
				isV4ProjectionThread: () => false,
				mergeV4ProjectionThread: (existingThread, incomingThread) => incomingThread || existingThread
			}) },
			statusText: (status) => String(status && status.type || status || ""),
			isLiveTurn: (turn) => /active|running/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isLatestTurn: (turn, thread) => Array.isArray(thread && thread.turns) && thread.turns.at(-1) === turn,
			isReasoningItem: (item) => String(item && item.type || "") === "reasoning",
			isOperationalItem: (item) => String(item && item.type || "") === "commandExecution",
			isContextCompactionItem: () => false,
			isTurnComplete: (turn) => /completed|failed|cancel|interrupted/i.test(String(turn && (turn.status && turn.status.type || turn.status) || "")),
			isRunningStatus: (status) => /active|running|queued|processing/i.test(String(status && status.type || status || "")),
			sortTurnsForDisplay: (turns) => Array.isArray(turns) ? turns : []
		}) : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.visibleItemsForTurn === "function" && typeof runtime.mergeThreadPreservingVisibleItems === "function" && typeof runtime.normalizeThreadVisibleUserMessages === "function" && typeof runtime.threadUserMessageEntries === "function" && typeof runtime.turnOrderMs === "function" && typeof runtime.turnIsSupersededBy === "function" && typeof globalThis.CodexThreadDetailRuntime === "object" && typeof globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime === "function",
			factoryType: typeof api.createThreadDetailRuntime,
			visibleItemsType: typeof (runtime && runtime.visibleItemsForTurn),
			mergeType: typeof (runtime && runtime.mergeThreadPreservingVisibleItems),
			normalizeType: typeof (runtime && runtime.normalizeThreadVisibleUserMessages),
			turnOrderType: typeof (runtime && runtime.turnOrderMs),
			globalFactoryType: typeof (globalThis.CodexThreadDetailRuntime && globalThis.CodexThreadDetailRuntime.createThreadDetailRuntime)
		};
	}
	if (id === "task-card-runtime") {
		const runtime = functionReady(api, "createTaskCardRuntime") ? api.createTaskCardRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderThreadTaskCard === "function" && typeof runtime.renderThreadTaskCards === "function" && typeof runtime.createThreadTaskCardFromCurrent === "function" && typeof runtime.renderApprovalRequest === "function" && typeof globalThis.CodexTaskCardRuntime === "object" && typeof globalThis.CodexTaskCardRuntime.createTaskCardRuntime === "function" && typeof globalThis.threadTaskCardCommandText === "function" && typeof globalThis.renderThreadTaskCards === "function" && typeof globalThis.renderApprovalRequest === "function",
			factoryType: typeof api.createTaskCardRuntime,
			renderType: typeof (runtime && runtime.renderThreadTaskCard),
			renderListType: typeof (runtime && runtime.renderThreadTaskCards),
			createType: typeof (runtime && runtime.createThreadTaskCardFromCurrent),
			approvalType: typeof (runtime && runtime.renderApprovalRequest),
			globalCommandType: typeof globalThis.threadTaskCardCommandText,
			globalRenderType: typeof globalThis.renderThreadTaskCards
		};
	}
	if (id === "settings-runtime") {
		const runtime = functionReady(api, "createSettingsRuntime") ? api.createSettingsRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderFontSizeControl === "function" && typeof runtime.renderQuotaUsage === "function" && typeof runtime.renderCodexProfileSettings === "function" && typeof runtime.renderWorkspaceDelegationSettings === "function" && typeof runtime.rememberRateLimitsFromConfig === "function" && typeof runtime.rememberCodexProfiles === "function" && typeof globalThis.CodexSettingsRuntime === "object" && typeof globalThis.CodexSettingsRuntime.createSettingsRuntime === "function",
			factoryType: typeof api.createSettingsRuntime,
			fontSizeType: typeof (runtime && runtime.renderFontSizeControl),
			quotaType: typeof (runtime && runtime.renderQuotaUsage),
			profileType: typeof (runtime && runtime.renderCodexProfileSettings),
			workspaceDelegationType: typeof (runtime && runtime.renderWorkspaceDelegationSettings),
			rateLimitsType: typeof (runtime && runtime.rememberRateLimitsFromConfig),
			profilesType: typeof (runtime && runtime.rememberCodexProfiles),
			globalFactoryType: typeof (globalThis.CodexSettingsRuntime && globalThis.CodexSettingsRuntime.createSettingsRuntime)
		};
	}
	if (id === "app-entry") {
		const runtime = functionReady(api, "createCodexMobileAppEntry") ? api.createCodexMobileAppEntry() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.startCodexMobileApp === "function" && typeof api.startCodexMobileApp === "function" && typeof globalThis.CodexMobileAppEntry === "object" && typeof globalThis.CodexMobileAppEntry.createCodexMobileAppEntry === "function" && typeof globalThis.CodexMobileAppEntry.startCodexMobileApp === "function",
			factoryType: typeof api.createCodexMobileAppEntry,
			startType: typeof api.startCodexMobileApp,
			runtimeStartType: typeof (runtime && runtime.startCodexMobileApp),
			globalFactoryType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.createCodexMobileAppEntry),
			globalStartType: typeof (globalThis.CodexMobileAppEntry && globalThis.CodexMobileAppEntry.startCodexMobileApp)
		};
	}
	if (id === "notification-ui-runtime") {
		const runtime = functionReady(api, "createNotificationUiRuntime") ? api.createNotificationUiRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.showApp === "function" && typeof runtime.showLogin === "function" && typeof runtime.bootstrap === "function" && typeof runtime.requestHermesPluginRefresh === "function" && typeof runtime.handlePluginVoiceInputMessage === "function" && typeof globalThis.CodexNotificationUiRuntime === "object" && typeof globalThis.CodexNotificationUiRuntime.createNotificationUiRuntime === "function" && typeof globalThis.showApp === "function" && typeof globalThis.showLogin === "function" && typeof globalThis.bootstrap === "function" && typeof globalThis.sortTurnsForDisplay === "function",
			factoryType: typeof api.createNotificationUiRuntime,
			showAppType: typeof (runtime && runtime.showApp),
			showLoginType: typeof (runtime && runtime.showLogin),
			bootstrapType: typeof (runtime && runtime.bootstrap),
			refreshType: typeof (runtime && runtime.requestHermesPluginRefresh),
			globalBootstrapType: typeof globalThis.bootstrap,
			globalSortType: typeof globalThis.sortTurnsForDisplay
		};
	}
	if (id === "conversation-render-runtime") {
		const runtime = functionReady(api, "createConversationRenderRuntime") ? api.createConversationRenderRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.renderTurn === "function" && typeof runtime.renderItem === "function" && typeof runtime.renderItemBody === "function" && typeof runtime.renderUserMessageBody === "function" && typeof runtime.renderLiveOperationDock === "function" && typeof runtime.ensureTurn === "function" && typeof runtime.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.CodexConversationRenderRuntime === "object" && typeof globalThis.CodexConversationRenderRuntime.createConversationRenderRuntime === "function" && typeof globalThis.renderTurn === "function" && typeof globalThis.renderItem === "function" && typeof globalThis.renderLiveOperationDock === "function" && typeof globalThis.ensureTurn === "function" && typeof globalThis.shouldDeferLiveFinalReceipt === "function" && typeof globalThis.imageUrlValue === "function" && typeof globalThis.renderMarkdownWithAttachmentSummary === "function" && typeof globalThis.renderFilePreviewContent === "function" && typeof globalThis.closeImagePreview === "function",
			factoryType: typeof api.createConversationRenderRuntime,
			renderTurnType: typeof (runtime && runtime.renderTurn),
			renderItemType: typeof (runtime && runtime.renderItem),
			liveDockType: typeof (runtime && runtime.renderLiveOperationDock),
			ensureTurnType: typeof (runtime && runtime.ensureTurn),
			globalRenderType: typeof globalThis.renderTurn,
			globalEnsureTurnType: typeof globalThis.ensureTurn,
			globalImageUrlType: typeof globalThis.imageUrlValue
		};
	}
	if (id === "event-stream-runtime") {
		const runtime = functionReady(api, "createEventStreamRuntime") ? api.createEventStreamRuntime() : {};
		return {
			ok: runtime && typeof runtime === "object" && typeof runtime.connectEvents === "function" && typeof runtime.applyNotification === "function" && typeof runtime.resumeMobileSession === "function" && typeof runtime.scrollConversationToBottom === "function" && typeof runtime.updateScrollToBottomButton === "function" && typeof globalThis.CodexEventStreamRuntime === "object" && typeof globalThis.CodexEventStreamRuntime.createEventStreamRuntime === "function" && typeof globalThis.upsertItem === "function" && typeof globalThis.connectEvents === "function" && typeof globalThis.ensureEventConnection === "function" && typeof globalThis.resumeMobileSession === "function" && typeof globalThis.followThreadOpenToBottom === "function" && typeof globalThis.scheduleBottomFollowScroll === "function" && typeof globalThis.updateScrollToBottomButton === "function",
			factoryType: typeof api.createEventStreamRuntime,
			connectType: typeof (runtime && runtime.connectEvents),
			notificationType: typeof (runtime && runtime.applyNotification),
			resumeType: typeof (runtime && runtime.resumeMobileSession),
			scrollType: typeof (runtime && runtime.scrollConversationToBottom),
			globalConnectType: typeof globalThis.connectEvents,
			globalFollowType: typeof globalThis.followThreadOpenToBottom
		};
	}
	if (id === "client-render-stability-guard") {
		const sourceTurn = {
			id: "local-turn-secret",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret",
				mobilePendingSubmission: true
			}]
		};
		const targetTurn = {
			id: "server-turn-a",
			items: [{
				type: "userMessage",
				clientSubmissionId: "submission-secret"
			}]
		};
		const sourceKey = functionReady(api, "markSubmittedTurn") ? api.markSubmittedTurn(sourceTurn, "submission-secret") : "";
		const transferredKey = functionReady(api, "transferSubmittedTurnIdentity") ? api.transferSubmittedTurnIdentity(sourceTurn, targetTurn, "submission-secret") : "";
		const sourceIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(sourceTurn) : "";
		const targetIdentity = functionReady(api, "stableTurnIdentity") ? api.stableTurnIdentity(targetTurn) : "";
		return {
			ok: Boolean(sourceKey) && sourceKey === transferredKey && sourceIdentity === sourceKey && targetIdentity === sourceKey && !String(sourceKey).includes("submission-secret"),
			sourceKey: String(sourceKey || ""),
			transferredKey: String(transferredKey || ""),
			sourceIdentity: String(sourceIdentity || ""),
			targetIdentity: String(targetIdentity || "")
		};
	}
	if (id === "live-operation-dock-state") {
		const card = functionReady(api, "operationCardContentPlan") ? api.operationCardContentPlan({
			itemId: "op-a",
			type: "tool",
			status: "running",
			title: "Run",
			detail: "working",
			durationText: "1s"
		}) : {};
		const preserve = functionReady(api, "compactBubblePreservation") ? api.compactBubblePreservation({
			nextHtml: "",
			liveTurnActive: true,
			visibleUntilMs: 2e3,
			nowMs: 1e3,
			savedThreadId: "thread-a",
			currentThreadId: "thread-a",
			savedHtml: "<div class=\"mobile-operation-bubble\"></div>",
			dockHasBubble: false
		}) : {};
		const recall = functionReady(api, "shouldShowRecall") ? api.shouldShowRecall({
			isMobile: true,
			hasCurrentThread: true,
			newThreadDraft: false,
			liveTurnActive: true,
			recallThreadId: "thread-a",
			currentThreadId: "thread-a",
			recallHtml: "<div class=\"mobile-operation-sheet\"></div>"
		}) : false;
		const classTokens = Array.isArray(card.classTokens) ? card.classTokens : [];
		return {
			ok: card.detail === "working" && classTokens.includes("live-operation") && preserve.preserve === true && preserve.patchSavedHtml === true && recall === true,
			detail: String(card.detail || ""),
			preserve: Boolean(preserve.preserve),
			recall
		};
	}
	return { ok: false };
}
function codexMobileViteEsmCompatibility() {
	const modules = moduleDefinitions.map((definition) => {
		const api = moduleApis[definition.id] && typeof moduleApis[definition.id] === "object" ? moduleApis[definition.id] : {};
		const expectedFunctions = Array.isArray(definition.expectedFunctions) ? definition.expectedFunctions : [];
		const exportedFunctions = expectedFunctions.filter((name) => functionReady(api, name));
		const sample = sampleModule(definition.id, api);
		const globalPublished = publishClassicGlobal(definition, api);
		return {
			id: definition.id,
			source: definition.source,
			assetPath: definition.assetPath,
			globalName: definition.globalName,
			classicLoaderExcluded: definition.classicLoaderExcluded === true,
			expectedFunctions: expectedFunctions.slice(),
			exportedFunctions,
			sample,
			globalPublished,
			ready: exportedFunctions.length === expectedFunctions.length && sample.ok === true && (definition.classicLoaderExcluded !== true || globalPublished === true)
		};
	});
	return {
		schemaVersion: 1,
		owner: "vite-shell-entry",
		moduleCount: modules.length,
		readyCount: modules.filter((entry) => entry.ready === true).length,
		modules
	};
}
var codexMobileViteEsmCompatibilityModules = moduleDefinitions;
//#endregion
export { codexMobileViteEsmCompatibility, codexMobileViteEsmCompatibility as default, codexMobileViteEsmCompatibilityModules };
