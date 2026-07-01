var shell_asset_manifest_default = {
	schemaVersion: 2,
	generatedBy: "generate-frontend-shell-manifest",
	shellCacheName: "codex-mobile-shell-v623",
	clientBuildId: "0.1.11|codex-mobile-shell-v623",
	scriptAssets: [
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js"
	],
	entryGroups: [
		{
			"id": "manifest",
			"phase": "startup-manifest",
			"startupCritical": true,
			"chunkTarget": "startup-manifest",
			"assets": ["/shell-asset-manifest.js"]
		},
		{
			"id": "foundation",
			"phase": "startup-prerequisite",
			"startupCritical": true,
			"chunkTarget": "startup-foundation",
			"assets": [
				"/api-client.js",
				"/runtime-settings.js",
				"/draft-store.js",
				"/composer-runtime.js",
				"/markdown-renderer.js",
				"/viewport-metrics.js",
				"/conversation-scroll.js",
				"/image-compressor.js",
				"/plugin-embed.js",
				"/plugin-voice-input.js",
				"/home-ai-diagnostic-reporting.js",
				"/thread-diagnostic-events.js",
				"/frontend-runtime-health.js",
				"/thread-status-hints.js",
				"/thread-performance-metrics.js",
				"/thread-list-load-policy.js",
				"/thread-list-stable-order.js"
			]
		},
		{
			"id": "feature-runtimes",
			"phase": "classic-runtime",
			"startupCritical": false,
			"chunkTarget": "deferred-feature-runtimes",
			"assets": [
				"/thread-list-runtime.js",
				"/client-render-stability-guard.js",
				"/live-operation-dock-state.js",
				"/thread-detail-state.js",
				"/thread-detail-render-plan.js",
				"/thread-detail-merge-state.js",
				"/thread-detail-v4-merge-state.js",
				"/thread-detail-runtime.js",
				"/thread-detail-patch-plan.js",
				"/thread-detail-dom-patch.js",
				"/thread-detail-actions.js",
				"/thread-tile-actions.js",
				"/thread-tile-state.js",
				"/thread-tile-layout.js",
				"/thread-tile-runtime.js",
				"/build-refresh-policy.js",
				"/app-update-runtime.js",
				"/side-chat-runtime.js",
				"/media-preview-runtime.js"
			]
		},
		{
			"id": "bootstrap-state",
			"phase": "startup-critical",
			"startupCritical": true,
			"chunkTarget": "startup-bootstrap",
			"assets": ["/app-bootstrap.js"]
		},
		{
			"id": "shell-services",
			"phase": "classic-runtime",
			"startupCritical": false,
			"chunkTarget": "deferred-shell-services",
			"assets": [
				"/settings-runtime.js",
				"/modal-runtime.js",
				"/navigation-runtime.js",
				"/api-client-runtime.js",
				"/notification-ui-runtime.js",
				"/pane-layout-runtime.js",
				"/task-card-runtime.js",
				"/conversation-render-runtime.js",
				"/event-stream-runtime.js",
				"/composer-bridge-runtime.js"
			]
		},
		{
			"id": "app-entry",
			"phase": "startup-critical",
			"startupCritical": true,
			"chunkTarget": "startup-app-shell",
			"assets": [
				"/runtime-wiring-runtime.js",
				"/app-shell-runtime.js",
				"/app.js"
			]
		}
	],
	linkAssets: [
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css"
	],
	iconAssets: [
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/icons/icon-192.png",
		"/icons/icon-512.png"
	],
	precacheAssets: [
		"/",
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json"
	],
	pageShellAssets: [
		"/",
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json",
		"/sw.js"
	],
	hashAssets: [
		"/index.html",
		"/manifest.json",
		"/icons/icon.svg",
		"/icons/apple-touch-icon.png",
		"/styles.css",
		"/icons/icon-192.png",
		"/icons/icon-512.png",
		"/shell-asset-manifest.js",
		"/api-client.js",
		"/runtime-settings.js",
		"/draft-store.js",
		"/composer-runtime.js",
		"/markdown-renderer.js",
		"/viewport-metrics.js",
		"/conversation-scroll.js",
		"/image-compressor.js",
		"/plugin-embed.js",
		"/plugin-voice-input.js",
		"/home-ai-diagnostic-reporting.js",
		"/thread-diagnostic-events.js",
		"/frontend-runtime-health.js",
		"/thread-status-hints.js",
		"/thread-performance-metrics.js",
		"/thread-list-load-policy.js",
		"/thread-list-stable-order.js",
		"/thread-list-runtime.js",
		"/client-render-stability-guard.js",
		"/live-operation-dock-state.js",
		"/thread-detail-state.js",
		"/thread-detail-render-plan.js",
		"/thread-detail-merge-state.js",
		"/thread-detail-v4-merge-state.js",
		"/thread-detail-runtime.js",
		"/thread-detail-patch-plan.js",
		"/thread-detail-dom-patch.js",
		"/thread-detail-actions.js",
		"/thread-tile-actions.js",
		"/thread-tile-state.js",
		"/thread-tile-layout.js",
		"/thread-tile-runtime.js",
		"/build-refresh-policy.js",
		"/app-update-runtime.js",
		"/side-chat-runtime.js",
		"/media-preview-runtime.js",
		"/app-bootstrap.js",
		"/settings-runtime.js",
		"/modal-runtime.js",
		"/navigation-runtime.js",
		"/api-client-runtime.js",
		"/notification-ui-runtime.js",
		"/pane-layout-runtime.js",
		"/task-card-runtime.js",
		"/conversation-render-runtime.js",
		"/event-stream-runtime.js",
		"/composer-bridge-runtime.js",
		"/runtime-wiring-runtime.js",
		"/app-shell-runtime.js",
		"/app.js",
		"/shell-asset-manifest.json",
		"/sw.js"
	],
	counts: {
		"scriptAssets": 51,
		"entryGroups": 6,
		"linkAssets": 4,
		"iconAssets": 4,
		"precacheAssets": 60,
		"pageShellAssets": 61,
		"hashAssets": 60
	}
};
//#endregion
//#region \0vite/preload-helper.js
var scriptRel = "modulepreload";
var assetsURL = function(dep) {
	return "/" + dep;
};
var seen = {};
var __vitePreload = function preload(baseModule, deps, importerUrl) {
	let promise = Promise.resolve();
	if (deps && deps.length > 0) {
		const links = document.getElementsByTagName("link");
		const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
		const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
		function allSettled(promises) {
			return Promise.all(promises.map((p) => Promise.resolve(p).then((value) => ({
				status: "fulfilled",
				value
			}), (reason) => ({
				status: "rejected",
				reason
			}))));
		}
		function importMetaResolve(specifier) {
			if (import.meta.resolve) return import.meta.resolve(specifier);
			return new URL(specifier, new URL("../../../src/node/plugins/importAnalysisBuild.ts", import.meta.url)).href;
		}
		promise = allSettled(deps.map((dep) => {
			dep = assetsURL(dep, importerUrl);
			dep = importMetaResolve(dep);
			if (dep in seen) return;
			seen[dep] = true;
			const isCss = dep.endsWith(".css");
			for (let i = links.length - 1; i >= 0; i--) {
				const link = links[i];
				if (link.href === dep && (!isCss || link.rel === "stylesheet")) return;
			}
			const link = document.createElement("link");
			link.rel = isCss ? "stylesheet" : scriptRel;
			if (!isCss) link.as = "script";
			link.crossOrigin = "";
			link.href = dep;
			if (cspNonce) link.setAttribute("nonce", cspNonce);
			document.head.appendChild(link);
			if (isCss) return new Promise((res, rej) => {
				link.addEventListener("load", res);
				link.addEventListener("error", () => rej(/* @__PURE__ */ new Error(`Unable to preload CSS for ${dep}`)));
			});
		}));
	}
	function handlePreloadError(err) {
		const e = new Event("vite:preloadError", { cancelable: true });
		e.payload = err;
		window.dispatchEvent(e);
		if (!e.defaultPrevented) throw err;
	}
	return promise.then((res) => {
		for (const item of res || []) {
			if (item.status !== "rejected") continue;
			handlePreloadError(item.reason);
		}
		return baseModule().catch(handlePreloadError);
	});
};
//#endregion
//#region frontend/vite-shell-entry.mjs
function compactEntryGroup(group) {
	return {
		id: group.id,
		phase: group.phase,
		startupCritical: Boolean(group.startupCritical),
		chunkTarget: group.chunkTarget,
		assets: Array.isArray(group.assets) ? group.assets.slice() : []
	};
}
var entryGroups = Array.isArray(shell_asset_manifest_default.entryGroups) ? shell_asset_manifest_default.entryGroups.map(compactEntryGroup) : [];
var entryTopology = {
	shellCacheName: shell_asset_manifest_default.shellCacheName,
	clientBuildId: shell_asset_manifest_default.clientBuildId,
	startupGroups: entryGroups.filter((group) => group.startupCritical),
	deferredGroups: entryGroups.filter((group) => !group.startupCritical)
};
var deferredEntryTopologyPromise = __vitePreload(() => import("./vite-deferred-entry-topology-W6SJaXUJ.js"), []);
globalThis.__CODEX_MOBILE_VITE_SHELL_BUILD_STAGE__ = "entry-topology-v1";
globalThis.__CODEX_MOBILE_VITE_SHELL_ENTRY_TOPOLOGY__ = entryTopology;
globalThis.__CODEX_MOBILE_VITE_DEFERRED_ENTRY_TOPOLOGY__ = deferredEntryTopologyPromise;
//#endregion
export { shell_asset_manifest_default as t };
