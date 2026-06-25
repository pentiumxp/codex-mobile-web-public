# Codex Mobile Web

## 中文总览

Codex Mobile Web 是一个面向手机、平板和嵌入式 Home AI 插件场景的
Codex 本地 Web 客户端。它通过本机的 Codex app-server 读取和控制
Codex 线程，支持移动端查看线程、发送消息、上传图片和文件、观察实时
命令/工具状态、跨线程任务卡协作、Home AI embedded iframe 运行、
Web Push/Action Inbox 通知，以及与 Codex Desktop 共享 app-server
mux 的实时同步。

这个仓库的近期工作重点不是增加单点功能，而是修复长期演进后暴露出的
架构问题：线程详情投影、线程列表内存缓存、跨线程任务卡、移动端
Composer/operation 状态、Home AI 插件嵌入和 public 发布流程都已经变成
核心路径。当前版本按 Home AI 的 root-cause-first 规则处理这些问题：
先定位失败层和状态所有权，再把可复用策略抽到服务或纯前端 helper，
避免用前端二次刷新、去重兜底或静默 fallback 掩盖根因。

## 2026-06-26 v452 Turn DOM Patch Executor

v452 接续 v451，继续 Phase A。v451 已经把 visible-item patch plan 的
`reuse` / `patch` / `insert` 执行循环推进到 `public/thread-detail-dom-patch.js`，
但 `patchCurrentThreadDetailFromRefresh` 仍然自己遍历 turn-level operations：
`item-patch`、`insert-turn`、`replace-turn`、render failure 和 missing article
都还在 `public/app.js` 里判断。

本次把 turn-level DOM patch 执行也推进到 `public/thread-detail-dom-patch.js`：

- 新增 `applyThreadTurnRefreshDomPatch`，按 turn patch plan 顺序执行
  `item-patch`、`insert-turn`、`replace-turn`。
- `public/app.js` 只注入 turn lookup、item patch、turn render、turn insert、
  turn replace 回调，不再拥有 turn operation loop。
- 保留现有 reject reason 语义：missing turn、item patch failure、render failure、
  insert failure、replace missing article 和 unknown operation 仍以 bounded reason
  退出，不做静默兜底。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v452`。

`test/thread-detail-dom-patch.test.js` 新增 turn-level 成功路径和失败 reason 覆盖；
现有 `conversation-render` wiring tests 确认 `patchCurrentThreadDetailFromRefresh`
已经调用 helper，不再遍历 `turnPatchPlan.operations`。

## 2026-06-26 v451 Visible Item DOM Patch Executor

v451 接续 v450，继续 Phase A。v449 已经把 refresh turn-level DOM patch action
收束到 `thread-detail-patch-plan`，v450 把 local patch 完成后的滚动策略收束到
`conversation-scroll`，但 visible-item patch plan 的执行循环仍留在 `public/app.js`：
它同时解释 `reuse` / `patch` / `insert` 操作、查找 DOM 节点、渲染新节点、执行
`patchNode` 和 `insertBefore`。

本次把 visible-item DOM patch 执行推进到 `public/thread-detail-dom-patch.js`：

- 新增 `applyVisibleItemRefreshDomPatch`，按 plan 顺序执行 `reuse`、`patch`、
  `insert`，并返回 bounded failure reason。
- `public/app.js` 只注入节点查找、HTML 渲染和 patch 回调，不再拥有 operation loop。
- 失败仍然保持可解释：helper 返回 reason，外层 refresh patch 失败后继续交给既有
  full render 路径；没有增加去重、隐藏消息或强制刷新兜底。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v451`。

新增 `test/thread-detail-dom-patch.test.js` 覆盖 reuse/patch/insert 顺序、开头插入、
缺失节点、渲染失败、patch 失败、未知操作和 invalid operation；现有
`conversation-render` / shell wiring tests 同步确认 `app.js` 使用新 helper。

## 2026-06-25 任务卡 Return/Ack 终止协议

本次修复跨线程任务卡的 return-card acknowledgement loop。根因是
`return_to_source`、`/reply returnToSource:true` 和 autonomous auto-return 生成的
反向卡虽然语义上是回执，但仍然像普通工作卡一样暴露 reply 能力，并且在注入
文本里可能继续出现 `Return required`。模型或目标线程按提示继续回卡时，就会
形成“回执的回执还要回执”的链式循环。

现在普通 work card 明确写入 `requiresReturn:true`；return/ack/no-op receipt card
明确写入 `terminal:true`、`requiresReturn:false`、`ackPolicy:"none"`，并关闭
`allowReply` 和 `autoReturnOnCompletion`。终止卡注入到源线程时只显示 terminal
return policy，不再出现 `Return required`；如果再次对终止卡调用 `/reply`，服务
层会返回 `task_card_terminal_no_return_required`。`codex_mobile.return_to_source`
的 MCP 返回值也会带上 `terminal/requiresReturn/ackPolicy`，便于源线程判断闭环
状态。

新增和强化 `test/thread-task-card-service.test.js`、`test/thread-task-card-route.test.js`
和 `test/codex-mobile-mcp-server.test.js` 覆盖普通工作卡仍要求一次 return、显式
`returnToSource:true` 是终止卡、auto-return receipt 不触发二次 auto-return、以及
Music-style repair -> receipt -> ack 链在第一张 terminal return 后停止。

## 2026-06-26 v450 Local Patch Scroll Completion Policy

v450 接续 v449，继续 Phase A。v449 已经把 refresh turn-level DOM patch action
收束到 `thread-detail-patch-plan`，但 local DOM patch 完成后是否沉底仍由
`completeLocalConversationDomUpdate` 在 `public/app.js` 里内联判断。

本次把这块滚动策略推进到 `public/conversation-scroll.js`：

- 新增 `planLocalPatchScrollCompletion`，明确 local patch 后的动作是
  `scroll-to-bottom` 还是 `update-button`。
- 规则保持不变：用户正在阅读当前轮或存在 auto-scroll hold 时不强制沉底；
  只有 near-bottom、submitted-message follow、viewport follow 之一成立时才沉底。
- `public/app.js` 只读取 scroll plan 并执行滚动或更新按钮。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v450`。

Focused tests 覆盖 near-bottom、submitted follow、viewport follow、用户阅读当前轮、
auto-scroll hold 和非跟随状态，并确认 app wiring 不再内联完整滚动条件。

## 2026-06-26 v449 Refresh DOM Patch Application Plan

v449 接续 v448，是 Phase A 的第二块。v448 已经把 refresh 最终动作收束到
`thread-detail-render-plan`，但 single-thread 的 DOM patch 仍在
`patchCurrentThreadDetailFromRefresh` 中逐个 turn 临时判断：item-only patch、
insert turn、replace turn、render failure 和未知操作都混在 `app.js` 循环里。

本次把 turn-level patch 应用计划推进到 `public/thread-detail-patch-plan.js`：

- 新增 `planThreadDetailRefreshDomPatch`，产出 `item-patch`、`insert-turn`、
  `replace-turn` 三类明确操作。
- `public/app.js` 只负责按 plan 查找 DOM、渲染 turn、执行 patch/insert。
- 如果 plan 或 DOM 状态无法解释当前形态，局部 patch 会带 reject reason 失败，
  交给现有 full render 路径，而不是删除节点或静默兜底。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v449`。

Focused tests 覆盖 turn patch plan 的三类操作和 invalid-entry 拒绝，并确认
`patchCurrentThreadDetailFromRefresh` 已使用 helper 计划，而不是在应用循环中
重新决定 turn 操作。

## 2026-06-26 v448 Refresh Render Outcome 服务化

v448 是下一阶段系统级架构优化的 Phase A 第一块，不是新的视觉兜底。
近期 v445-v447 已经把手机单窗口可见性、patch-shell 签名和 refresh 诊断收拢，
但 `refreshCurrentThread` 仍直接决定 metadata-only、single-thread patch、
tile-pane patch 和 full render 的最终动作。这个判断散在 `public/app.js` 中，
容易在平铺/单窗口 surface 切换时让局部 patch 结果又落回 full render。

本次把 refresh 最终动作推进到 `public/thread-detail-render-plan.js`：

- `finalizeThreadDetailRenderPlan` 现在返回明确的 `renderAction` 和
  `projectionConsistencyPhase`。
- `tilePanePatchedDetail` 成为终态：tile pane 已经 patch 成功时，不再继续走
  single-thread full render。
- `thread_refresh_ms` 增加 `refreshRenderAction` 和 `tilePanePatchedDetail`，
  线上能区分 metadata update、single patch、tile patch 和 full render。
- `public/app.js` 只按 outcome 执行动作，减少刷新策略散落。

新增/更新 focused tests 覆盖 tile pane patch 是终态、metadata-only tile patch 不
触发 full render、performance 事件保留 refresh action，以及 app wiring 使用
render outcome。PWA shell cache 升级到 `codex-mobile-shell-v448`。

## 2026-06-25 v447 Live Refresh Patch 签名修正与诊断增强

v447 接续 v446。用户继续报告 Composer 输入时偶尔造成全屏刷新；生产
`thread_refresh_ms` 事件也显示，v446 部署后仍有大量 iPhone live-poll 走
`detailRenderMode=full-render`，而服务端读路径已经是
`projection-v4-dynamic/cache`，`threadReadMs=0`。这说明剩余问题主要在前端
render/patch 判定，不是大 session 服务器全量读取。

本次修正 v446 中的一个具体签名边界错误：`refreshCurrentThread` 在 merge 后才
取 `previousPatchShellSignature`，实际拿到的是下一版 thread 的结构签名，而不是
当前已渲染 DOM 对应的旧 thread 签名。这样会让部分本来可以局部 patch 的刷新
被判成不可 patch，回退到整段 conversation full render。

现在 render plan 使用 `previousThread` 的 patch-shell 签名；同时
`thread_refresh_ms` 增加 `clientBuildId`、`renderPlanReason` 和
`patchRejectReason`。如果线上仍然出现 full-render，日志可以区分是旧客户端、
`rendered-signature-stale`、`patch-shell-changed`、DOM surface 不可 patch，还是
具体插入/完成 DOM 更新失败。这个诊断只记录 bounded reason code 和 build id，
不记录消息正文、任务卡正文、上传内容或私有路径。PWA shell cache 升级到
`codex-mobile-shell-v447`。

## 2026-06-25 v446 结构签名 Patch Gate 与 Composer 闪动抑制

v446 接续 v445 的手机单窗口修复。生产日志证明 v445 后新内容已经进入
render 输入，`conversation_render_ms` 的 `htmlChars` 持续增长；但 live-poll 仍
频繁走 `detailRenderMode=full-render`。用户在 Composer 输入时如果刚好遇到
后台 live-poll full-render，就会看到输入区和正文一起抖动，表现成“打字偶尔
触发全屏刷新”。

根因是 `refreshCurrentThread` 的 patch gate 只看完整
`conversationRenderSignature`。完整签名包含 `mobileProjectionRevision` 和
`mobileVisibleItemKeys` 等投影元数据，这些字段在活动 turn 中会频繁变化；即使
DOM 结构和可见 turn shell 仍可安全局部 patch，也会被判成
`rendered-signature-stale`，退到整段 conversation render。

v446 将“是否需要更新内容”和“是否可以局部 patch”拆开：

- `conversationRenderSignature` 继续作为完整内容签名。
- 新增 `renderedConversationPatchShellSignature`，记录可局部 patch 的结构签名。
- `thread-detail-render-plan` 在完整签名 stale 但结构签名仍匹配时允许走 patch，
  避免仅因 projection 元数据变化而整段替换 DOM。
- 单线程 render 会写入结构签名；home、新建线程、平铺和插件恢复页会清空该签名，
  防止跨 surface 误 patch。

新增/更新测试覆盖 `patch-shell-stable` 行为、客户端结构签名写入、以及
`patchCurrentThreadDetailFromRefresh` 在完整签名不一致但结构签名匹配时仍可安全
尝试局部 patch。

## 2026-06-25 v445 手机单窗口长 Turn 可见性修正

v445 修复非平铺手机单窗口里“右上角运行状态持续更新，但正文停在旧长回执，
新内容完全看不到”的事故。v444 只修复了平铺 pane 边界；用户确认复现发生在
手机单窗口后，重新查生产日志发现手机端 detail refresh 一直成功，`htmlChars`
持续增长，但长 turn 进入 full render 路径后 `stickToBottom` 从 `true` 变成
`false`。这说明新内容已经进入 DOM 生成路径，但提交后的底部跟随在长时间
full render 中断掉，用户视口停留在旧回执位置。

这版同时修两条根因边界：

- 服务端 projection result 增加本地 active turn 一致性检查：如果 summary 中有
  Mobile Web 刚启动的 `activeTurnId` / `mobileLocalActiveStatus.turnId`，但缓存
  projection 里没有该 turn，则拒绝这份旧 projection，转入 `turns-list-initial`
  或后续真实读取，避免旧动态缓存覆盖刚发出的新 turn。
- 前端 `renderCurrentThread` 在 full render 路径也会续命提交后的 bottom follow：
  只要当前线程的最新 live turn 已经有非用户可见进展，就像 live delta patch 一样
  延长跟随窗口。用户如果手动上滑阅读，原有 `touchstart` / `wheel` 逻辑仍会清掉
  follow，不会被强行拉回底部。

新增 `test/thread-detail-projection-result-service.test.js` 覆盖缺少本地 active turn
的旧 projection 必须返回 `null`；强化 `test/turn-scroll-controls.test.js` 覆盖
full render 也会续命提交后的底部跟随。PWA shell cache 升级到
`codex-mobile-shell-v445`。

## 2026-06-25 v444 平铺视图当前线程可见性修正

v444 修复 v443 后仍复现的平铺模式刷新问题。生产诊断显示页面已经加载
`codex-mobile-shell-v443`，但连续上报
`conversation_projection_mismatch / detail_patch_rejected`，surface 为
`thread-tile`。同时服务端 detail 中当前 active turn 已经有新的
`agentMessage`，说明问题不在模型输出或服务端投影，而在平铺视图的 pane
选择和 patch 边界。

根因是固定 pane 已经占满时，`threadTileCandidateIds` 可能把
`currentThreadId` 挤出平铺候选列表。这样运行状态和 composer 仍绑定当前线程，
但 DOM 中没有对应 pane，detail refresh 无法 patch 当前 pane，随后又误入
单线程 patch 路径并反复全量刷新旧内容。v444 将“当前线程必须在平铺 pane
中可见”固化到 `public/thread-tile-layout.js` 的选择策略里；满员时保留前面
pane 的位置，替换最后一个 pane 为当前线程。同时 tile surface 下 pane patch
失败时不再尝试单线程 DOM patch，避免 `detail_patch_rejected` 循环。PWA
shell cache 升级到 `codex-mobile-shell-v444`。

## 2026-06-25 v443 Live 输出可见性修正

v443 修复 active turn 中“命令/文件操作持续更新，但新的 Codex 回执文本不可见”的
前端渲染缺陷。生产 detail 已能读到当前 active turn 的 `agentMessage`、`commandExecution`
和 `fileChange`，说明服务端 projection 已经有文本；问题在浏览器 live delta 渲染。

根因是 `item/agentMessage/delta` 走了 `defer-final-receipt` 路径，而该路径只要 live turn
里存在 command/file operation，就把所有 live `agentMessage` 渲染延迟掉。这样 operation
bubble 会继续计时和刷新，但 assistant 文本不会进入当前 DOM，刷新时还可能反复重绘旧的长
回执。

现在 live `agentMessage` delta 一律触发正常 DOM patch/render。operation bubble 仍然只负责
命令/文件操作状态，不再拥有或阻断 assistant 文本可见性。新增
`test/conversation-render.test.js` 覆盖：即使 active turn 里有 command operation，agent
delta 也必须可见渲染。PWA shell cache 升级到 `codex-mobile-shell-v443`。

## 2026-06-25 v442 前端 DOM Patch Surface 边界

v442 继续收敛 `public/app.js` 的线程详情 DOM patch 所有权。v441 已经把平铺模式
的本地 patch 改为刷新当前 tile pane，但“是否允许执行 tile pane patch、是否允许
执行单窗口 DOM patch”的判断仍散在 `app.js` 多个函数里。转场或状态不一致时，
后续维护仍可能让单窗口 patch 路径误写平铺 DOM 的 signature。

现在 `public/thread-detail-patch-plan.js` 新增 `planThreadDetailDomPatchSurface`：
纯策略层只会返回 `thread-tile-pane`、`single-thread` 或 blocked reason。`app.js`
通过 `threadDetailDomPatchSurface` / `canPatchSingleThreadConversationDom` 执行该
决策：tile mode 只允许 pane patch；单窗口 DOM patch 只有在当前 surface 明确是
single-thread 时才允许执行；tile 转场或 surface mismatch 直接拒绝局部 patch，交给
完整 render 接管。这样把“平铺状态不能落入单窗口 patch”变成可测试边界，而不是
散落在各个 DOM 操作函数里的局部条件。

新增 `test/thread-detail-patch-plan.test.js` 覆盖 tile pane、single-thread 和转场
blocked 决策；`test/conversation-render.test.js` 覆盖 `app.js` 必须通过该策略层
执行 tile/single patch。PWA shell cache 升级到 `codex-mobile-shell-v442`。

## 2026-06-25 大 session cold-open 决策证据修正

本次是 server-only 的大 session 首屏路径优化，不升级 PWA shell cache。目标是
继续收敛 cold open：大 rollout 首屏应该命中 disk-backed projection 或
`turns-list-large`，`threadReadMs=0`；只有小线程或 bounded turns-list 失败时才
允许进入 full `thread/read`。

之前 `turns-list-large` 判断绑定在 projection input 上：只有能从 rollout path/stat
构造 projection input 时，才会根据 rollout size 决定是否先走 bounded
`thread/turns/list`。这会让某些重启后或 summary-only 的冷开场景虽然已经知道
rollout 很大，却因为 projection input 暂时不可用而误入 full `thread/read`。

现在 large-read 决策归到 `thread-detail-read-orchestration-service` 的可诊断
边界：server 先看 projection stats，没有则看 summary/rollout size。只要 size
达到 `CODEX_MOBILE_THREAD_DETAIL_TURNS_LIST_FIRST_BYTES`，就使用
`turns-list-large`，并在 `mobileDiagnostics.threadDetailTimings` 里记录
`largeReadProtected`、`largeReadRolloutSizeBytes`、`largeReadThresholdBytes`、
`largeReadSource` 和 `largeReadReason`。这让后续重启冷开、活跃写入中冷开、
静态大线程冷开三类证据都能直接判断是否误入 full `thread/read`，且不记录正文、
prompt、附件或原始私密内容。

新增 `test/thread-detail-read-orchestration-service.test.js` 覆盖 projection input
不可用但 summary 已判定为大 rollout 时必须走 `turns-list-large`，以及小 summary
仍走 full `thread/read` 的边界。

## 2026-06-25 v441 平铺本地 Patch 签名边界修正

v441 修复 v440 后继续出现的 `conversation_projection_mismatch`。新的 Home AI
诊断 payload 显示问题发生在平铺模式的 `refresh-metadata` 分支：4 个 pane，
`route_kind=thread-tile`，`render_mode=metadata-only`。这说明诊断已经不再混比
tile-board 和单线程签名，但某些本地刷新路径仍会把
`state.renderedConversationSignature` 写成单线程签名，而当前 DOM 实际还是
thread-tile board。

根因是 `refreshCurrentThread` 和 SSE 本地增量 patch 仍沿用单窗口假设：
metadata-only refresh 只更新单窗口 header/global operation dock；本地 item patch
结束时统一写 `conversationRenderSignature(state.currentThread)`。在平铺 DOM 下，
这些路径应该更新当前 pane，并保持全局签名为 `threadTileRenderSignature`。

现在新增 `patchCurrentThreadTilePaneFromState` 作为平铺本地 patch 边界。平铺 DOM
下的 current-thread refresh、operation dock、本地 item 插入/替换、live text
patch 和 detail refresh patch 都会刷新当前 tile pane，并由 `patchThreadTilePane`
写回 tile-board 签名；单窗口路径仍保持原有单线程 DOM patch 行为。

新增 `test/conversation-render.test.js` 覆盖平铺本地 patch 不变量和
metadata-only tile refresh 不变量。PWA shell cache 升级到
`codex-mobile-shell-v441`。

## 2026-06-25 v440 平铺模式诊断签名修正

v440 修复 v439 诊断上报通道发现的 `conversation_projection_mismatch` 误报。
根因是平铺模式下 `state.renderedConversationSignature` 保存的是整个
thread-tile board 的签名，但诊断检查仍按单线程
`conversationRenderSignature(state.currentThread)` 重新计算当前签名。用户在宽屏
平铺模式下反复进入线程、刷新详情或增量 patch 时，两个签名体系天然不同，连续
三次后就会被错误上报为 render signature mismatch。

现在 `conversationProjectionDiagnosticSnapshot` 会先识别当前 DOM 渲染表面：
单窗口只比较单线程签名；平铺模式只比较 `threadTileRenderSignature`；如果正在
单窗口/平铺转场且 DOM class 与状态不一致，则跳过本次诊断。这样不会屏蔽真正的
DOM duplicate key 或真实投影不一致，只是避免把平铺全局签名和单线程签名混比。

新增 `test/conversation-render.test.js` 覆盖平铺签名、平铺转场跳过、单窗口签名
三条路径。PWA shell cache 升级到 `codex-mobile-shell-v440`。

## 2026-06-25 v439 Home AI 诊断上报通道

v439 接入 Home AI 平台级 diagnostic remediation loop。Codex Mobile 不直接自动
发修复卡，也不把私密正文、prompt、任务卡正文、附件内容、原始 thread/turn/task id
或 token/path/url 交给 Home AI；它只在嵌入式插件模式下，把连续出现的用户可见
失败整理成 `homeai.diagnostic.report` 元数据事件，交给 Home AI 负责 case 去重、
Owner 通知和 Owner 手动触发修复卡。

新增 `public/home-ai-diagnostic-reporting.js` 作为纯策略模块，负责阈值计数、
成功清计数、节流、payload 清洗和 `postMessage` 安全失败。默认同一隐私安全签名
连续 3 次失败才上报，5 分钟内同签名只报一次；成功路径会清掉相同 surface/action
的失败计数。

首批接入面：

- 任务卡 workflow：手动创建、草案请求、草案物化、approve/reply/delete/revoke
  可见失败。
- 线程/session：线程列表加载失败、线程详情加载/refresh 失败、Home AI
  route-hint thread/task/item 目标不可用。
- 媒体与投影显示：图片加载失败、conversation render signature mismatch、
  DOM `data-render-key` 重复，以及 detail patch 被拒绝后转 full render 的重复
  诊断。

本地 `/api/client-events` 仍保留 Codex Mobile 自身排查所需的客户端事件；发给
Home AI 的自动诊断只包含 build/cache id、surface/action、状态码、计数、
duration bucket、source kind、read/render mode 和 short hash。新增
`test/home-ai-diagnostic-reporting.test.js` 覆盖阈值、去重、success clear、隐私
字段清洗和非嵌入/父窗口异常时安全失败。PWA shell cache 升级到
`codex-mobile-shell-v439`。

## 2026-06-25 v438 线程详情可见项 Patch 计划拆分

v438 继续第二阶段前端状态边界优化，把 live/detail refresh 中“能否只做可见项
增量 patch、每个可见项应复用/替换/插入”的纯判断从 `public/app.js` 拆到
`public/thread-detail-patch-plan.js`。`app.js` 现在只消费 patch plan，并继续负责
DOM 查询、HTML 渲染、节点替换和插入。

这个拆分不改变服务端投影、不改变线程详情协议，也不引入前端二次刷新或去重
兜底。目标是把曾经导致“中间内容短暂消失、回执替换时抖动、usage/图片追加
时整轮重绘”的 shape 判断变成可单独测试的纯策略，后续再继续拆 DOM patch
application。

新增 `test/thread-detail-patch-plan.test.js` 覆盖保持原有顺序追加 usage、同 key
签名变化触发 patch、以及重排/删除/非法 entry 拒绝增量 patch。PWA shell cache
升级到 `codex-mobile-shell-v438`。

## 2026-06-25 v437 平铺标题菜单与 Composer 目标提示范围

v437 是平铺模式交互回归修正。平铺窗口页眉里的线程名点击现在会直接打开
线程切换列表；之前的 click handler 错误使用 `event.detail` 作为门禁，导致
正常鼠标/触摸点击不会触发菜单，只能选中 pane。

Composer 的 `发送到：线程名` placeholder 也收紧为只在“实际已经渲染为平铺
视图”时显示。判断条件不再只看设置态 `threadTileMode`，还要求当前
conversation DOM 处于 `.thread-tile-mode` 并且存在 active pane。单窗口、Home、
新线程草稿和视口回落到单线程时都保持默认 `Message Codex`。

PWA shell cache 升级到 `codex-mobile-shell-v437`。

## 2026-06-25 v436 平铺页眉与 Composer 目标提示对比度

v436 是平铺模式的视觉清晰度修正，不改变平铺窗口数量、active pane 选择、
Composer 发送目标或线程刷新逻辑。

每个平铺窗口的页眉改用更深一层的专用背景色，active 窗口页眉带轻微状态
强调，窗口多时更容易分辨 pane 边界。共享 Composer 仍然通过输入框
placeholder 显示当前发送目标；当 placeholder 是 `发送到：线程名` 时，会使用
更明显的目标提示颜色和稍高字重。普通单线程 `Message Codex` placeholder 不受
影响。

PWA shell cache 升级到 `codex-mobile-shell-v436`。

## 2026-06-25 v435 线程详情合并编排拆分

v435 继续第二阶段前端状态边界优化，把 `public/app.js` 中 thread/turn 级
详情合并编排抽到新的纯 helper：`public/thread-detail-merge-state.js`。
`app.js` 现在只负责把运行时 active turn id 和现有 item 级合并函数传给
helper；是否保留 live 本地可见项、是否保留展开历史、是否清理过期
`mobileLoading` / `mobileLoadError` / `mobileReadWarning`、以及 v4 projection
线程是否委托给 v4 合并路径，都由新 helper 的可测试策略负责。

这个拆分不改变线程详情投影协议，也不增加前端去重兜底。目标是把
live/detail 刷新过程中最容易导致“中间内容短暂消失、完成回执替换、展开历史
丢失”的合并规则从入口文件里拿出来，后续可以继续拆 DOM patch 和 pane-local
状态而不继续膨胀 `public/app.js`。

新增 `test/thread-detail-merge-state.test.js` 覆盖无 incoming items、incoming
可见项减少、live-to-completed 保留、加载状态清理、active 本地 turn 保留、
展开历史保留、初始提交 echo 清理和 v4 projection 委托。PWA shell cache
升级到 `codex-mobile-shell-v435`。

## 2026-06-25 v434 平铺模式 Composer 目标改为输入框提示

v434 修正 v433 的显示方式：不再在 Composer 上方增加独立目标条，因为那会
占用平铺模式本来就紧张的纵向空间。平铺模式下如果 Composer 绑定到某个
active pane，空输入框的 placeholder 会从默认 `Message Codex` 改为
`发送到：线程名`；用户开始输入后提示自然消失。

这个提示仍然使用 `currentComposerThreadId()` / `composerTargetThread()`，与
真实发送、task-card 草稿、Stop/引导按钮同源。单线程模式保持
`Message Codex`，新线程草稿保持 `输入第一条消息`。PWA shell cache 升级到
`codex-mobile-shell-v434`。

## 2026-06-25 v433 平铺模式 Composer 发送目标提示

v433 在平铺模式下给共享 Composer 增加一行紧凑目标提示：
`发送到 · 当前线程名`。平铺模式下 Composer 的实际发送目标仍然由当前
active pane 决定；这次不改变发送路径，只把当前目标直接显示出来，减少用户
忘记选中窗口或误以为正在给另一个 pane 发消息的风险。

提示使用现有 `currentComposerThreadId()` / `composerTargetThread()` 目标来源，
因此与真正发送、task-card 草稿、Stop/引导按钮使用同一套 active pane 绑定。
单线程模式和新线程草稿不显示这行提示。PWA shell cache 升级到
`codex-mobile-shell-v433`。

## 2026-06-25 v432 线程详情刷新渲染计划拆分

v432 继续第二阶段前端状态边界优化，不改变服务端投影、线程读取策略或
分屏 UI。`refreshCurrentThread` 里“本次刷新应该 metadata-only、局部 patch
还是 full render”的判断已抽到新的纯 helper：
`public/thread-detail-render-plan.js`。

这个 helper 明确了局部 patch 的前提：浏览器当前 DOM 的
`renderedConversationSignature` 必须仍等于刷新前的 conversation signature。
如果 DOM 签名已经陈旧，即使前后数据签名发生变化，也直接走 full render，
避免在不可靠 DOM 基线上做局部替换，减少刷新过程中短暂内容丢失或画面颤动
的风险。实际 DOM patch、全量 render、metadata 更新仍由 `public/app.js`
编排。

新增 `test/thread-detail-render-plan.test.js` 覆盖稳定签名、可 patch 签名、
陈旧 DOM 签名和显式禁用 patch 四种情况。PWA shell cache 升级到
`codex-mobile-shell-v432`。当前为本地优化切片，是否部署/推 Public 仍按
“先本地验证，再按需部署，生产确认后再 Public”的发布顺序执行。

## 2026-06-25 v431 平铺窗口局部分屏与页眉拖动

v431 改进宽屏平铺模式在窗口数超过可用列数时的布局。之前如果桌面当前只能
放 4 列，第 5 个窗口会整体换到第二行，形成“上面 4 个、下面 1 个”的整行
等高布局，导致下面空出 3 列，所有窗口都损失纵向空间。

当前规则改为列内局部分屏：例如 5 个窗口、4 个可用列时，前三列仍然占满
整个纵向高度，只有第 4 列被拆成上下两个窗口。6 个窗口时，会优先让最后几列
各自上下分屏，而不是让整行一起变矮。

同时，平铺窗口页眉现在可拖动：

- 拖到目标窗口中间区域，会和目标窗口组成上下分屏；
- 拖到目标窗口左侧边缘，会移动到目标窗口前面；
- 拖到目标窗口右侧边缘，会移动到目标窗口后面。

拖动产生的窗口顺序和上下分屏关系会写入现有的服务端
`threadDisplay` 设置，随设备共享。PWA shell cache 升级到
`codex-mobile-shell-v431`。

## 2026-06-25 v430 大 session 诊断与前端状态边界优化

v430 是架构优化的下一步，不改变线程详情读取策略本身，而是把可观测性和
前端状态所有权继续收敛：

- `thread_detail_first_paint`、`thread_refresh_ms` 和 full backfill 性能事件
  新增 `detailShape`，只上报 turn/item/image/operation/receipt/usage 等计数
  和 completed/active turn 数量，不包含消息正文、图片内容、路径、命令正文或
  provider payload。这样后续排查大 session 首屏慢或弱刷新时，可以判断是
  服务端 read path 慢、客户端 render/merge 慢，还是 detail 形态突然退化。
- live-to-completed 时“同一 turn 的本地可见项是否保留”的判断从 `public/app.js`
  移到 `public/thread-detail-state.js`。`app.js` 继续负责 DOM 和事件编排，
  但该状态决策现在有独立单测，避免后续刷新/投影修复继续堆在大文件内部。

PWA shell cache 升级到 `codex-mobile-shell-v430`。这不是大 session 冷启动的
最终性能修复；它先补齐后续优化需要的证据口径，并继续拆前端状态边界。

## 2026-06-25 v429 Live-to-completed 刷新弱投影修复

v429 修复 Movie 新线程在运行中偶发退回弱显示状态的问题：页面先正常显示
图片、命令和中间过程，随后一次刷新会短暂变成只剩用户需求和最终回执，
后续新回执或下一次增强投影又把过程刷回来。

根因在前端合并策略。服务端最终 detail 已经可以返回完整 active turn，但
浏览器同时会收到较弱的 completed patch：这类 patch 有最终回执和 Usage，
但可能暂时没有图片、命令和 rollout-derived operation items。旧逻辑在
incoming turn 变成 completed 时关闭了 live-turn 本地可见项保留；如果最终
回执文本很长，权重比较会误认为 incoming 更完整，从而删除已有图片/操作项。

当前规则：同一个 turn 从 live/active 过渡到 completed 时，completed
回执仍然替换本地临时回执，但图片、命令、文件操作等非回执可见项会被保留，
直到服务端增强投影给出等价或更完整的权威项。新增回归测试覆盖“小图片/小
操作 + 长 final receipt”的场景。PWA shell cache 升级到
`codex-mobile-shell-v429`。

## 2026-06-25 Movie 新线程过程项投影修复

本次 server-only 修复针对新建 Movie 工作区线程里“只能看到用户消息和最后
系统回执，看不到中间过程”的问题。实测 Movie rollout 中存在
`function_call`、`patch_apply_end`、`agent_message` 等中间事件，但
`/api/threads/:id` 返回的 `projection-v4-dynamic` 详情里，completed turn
只剩 `userMessage`、`agentMessage` 和 `turnUsageSummary`。

根因是服务端 compaction 只把 rollout raw operations 合并进当前 live turn。
对于策略上允许展示操作详情的 completed turn，虽然
`operationDetailTurnIndexes()` 会选中它们，实际 items 里却没有从 rollout
补回的 command/file operation，所以最终被压成 receipt-only。

当前实现把 `mergeRecentRawOperationsIntoLiveTurn()` 收敛为通用
`mergeRecentRawOperationsIntoTurn()`，并在 `compactThread()` 中对
`operationDetailTurnIndexes()` 选中的 turn 先合并 rollout raw operations，
再执行 compact/filter。这样仍然只展开策略允许的少数 turn，不会把所有历史
turn 全部展开，也不会改变 PWA shell cache。

## 2026-06-25 v428 平铺模式 @ 目标菜单可见性修复

v428 修复平铺窗口下在 Composer 输入 `@` 时目标任务/任务卡片菜单看不到的
问题。根因是 `@` 菜单虽然已经是页面级 fixed overlay，但仍使用自己单独的
`bottom` / `width` 计算；在平铺、键盘、宽屏和 embedded 组合布局下，这套
计算可能把菜单定位到可视区域之外。

当前实现把 `@` 菜单改为复用 Composer 模型/推理强度/权限菜单已有的
`fitComposerPopupToAnchor()` 视口内定位逻辑，并统一使用
`--composer-popup-*` CSS 变量。这样 `@` 菜单仍锚定共享 Composer 输入框，
但会按当前 visual viewport 夹紧在可见区域内。PWA shell cache 升级到
`codex-mobile-shell-v428`。

## 2026-06-24 任务卡手动回执工具链修复

本次修复针对 Home AI 审计/修复闭环中发现的问题：目标实现线程完成任务卡
后，如果当前 Codex surface 没有可见的回卡工具，只能在本线程 `final`
里写结果，源线程不会收到真实的 return task card。

根因不是前端显示，而是 task-card 工具链缺了目标侧闭环：

- 服务层原先只允许 `pending` 卡 `reply`，但真实实现卡在审批/源线程直投后
  会变成 `approved`，目标线程完成工作时已无法对原卡回执。
- 注入到目标线程的任务卡消息没有稳定暴露原始 `Task card id`。
- `codex_mobile` MCP / app-server dynamic tool 只有 `delegate_to_thread`，
  没有“把收到的卡回给来源线程”的 `return_to_source`。

当前规则：

- 目标线程可以对 `pending` 或 `approved` 的原始任务卡创建回执卡。
- 目标线程本地 `final` 不算源线程回卡；`completed`、`blocked`、
  `redirected` 必须通过真实 return card 关闭。
- app-server dynamic tool 新增 `codex_mobile.return_to_source`，不依赖
  `跨工作区委派` 开关，因为它关闭的是已收到的任务卡。
- MCP stdio 工具集新增 `return_to_source`，并自动写入
  `[mcp_servers.codex_mobile.tools.return_to_source] approval_mode = "approve"`。
- 新增 `scripts/return-thread-task-card.js` 作为目标侧脚本 fallback，调用
  `/api/thread-task-cards/:id/reply`，并生成稳定 `task-card-return:*`
  幂等键。
- 审批注入消息现在包含 `Task card id: ...` 和手动回执要求，避免模型把
  普通 final 当作 Home AI 已收到的回卡。

## 2026-06-24 v425 route-hint 覆盖与手动平铺上限

本次 v425 处理两类产品现实问题：

- Home AI embedded notification/task-card deep link 不再只靠 `app.js` 的
  source-string 测试兜住。`public/plugin-embed.js` 现在拥有 route hint 的
  归一化、打开计划、目标聚焦计划、DOM selector 顺序和 URL scrub 规则；
  `public/app.js` 只消费这个计划并执行页面状态切换。`test/plugin-embed.test.js`
  增加可执行覆盖，验证线程直达、任务卡/条目目标聚焦、目标缺失回到 embedded
  primary page、以及清理 `pluginRoute/pluginThreadId/pluginTaskId/pluginItemId`
  等 URL 参数。
- 平铺模式下，设备宽度给出的 `maxPanes` 只作为自动/推荐容量，不再限制用户
  手动新增窗口。`threadDisplay.paneCount=0` 仍按当前线程、运行线程和视口容量
  自动决定窗口数；用户点 pane 标题菜单里的 `新增窗口` 时，手动窗口数按
  bounded user pane ceiling 保存，超过推荐列容量时自动换行显示。这样宽桌面可以
  继续增加到 6 个甚至更多窗口，而窄设备仍保持自动模式的保守显示。

PWA shell cache 升级到 `codex-mobile-shell-v425`。

## 2026-06-25 v427 手动平铺宽度校准

v426 修掉了桌面最大 4 列的硬上限，但实际电脑端仍可能在第 5 个窗口换行。
根因是 layout helper 仍用自动模式的 420 CSS px 最小 pane 宽度计算列数；
在 macOS 高分屏缩放下，浏览器使用的是 `Looks like` 的 CSS 工作区宽度，
不是显示器物理像素。以 6K/高分屏当前 `2560 x 1440` CSS 工作区和侧栏约
520px 为例，自动 420px 宽度只能得到 4 列。

v427 把“用户手动设置的 pane 数”传入 `public/thread-tile-layout.js`：

- `paneCount=0` 的自动模式仍使用 420px 阅读宽度，保持保守。
- 用户手动新增到 5/6 个窗口时，按当前可用 CSS 宽度反推手动 pane 宽度，
  但不低于 300px 的安全下限。
- 当前 2560 CSS 宽、侧栏 520px 的桌面场景，手动 5 个 pane 计算为 5 列，
  手动 6 个 pane 计算为 6 列；再超过物理可容纳列数才换行。

PWA shell cache 升级到 `codex-mobile-shell-v427`。

## 2026-06-25 任务卡返回审批与深度审计推理强度

本次修正两个任务卡协议缺口：

- `codex_mobile.return_to_source` 和 `scripts/return-thread-task-card.js`
  创建的返回源线程卡，不再作为普通 `pending` 反向卡等待源线程再点审批。
  服务层会把这类回卡标记为 `returnToSource`，按源线程直批注入，并记录
  `returnStatus`；同一个 `task-card-return:*` 幂等键重试时，旧版本已经创建出的
  pending 回卡也会走同一路径直批。
- `delegate_to_thread`、`POST /api/threads/:sourceThreadId/task-cards` 和
  `scripts/create-thread-task-card.js` 支持 `reasoningEffort` /
  `reasoning_effort`，取值为 `low`、`medium`、`high`、`xhigh`。任务卡注入文本会
  显示 `Requested reasoning effort: ...`，审批启动目标 turn 时会用该值覆盖目标
  线程继承的推理强度，并把请求/实际 runtime 写入 `injectionRuntime`。

这次是协议和服务端/script 修正；前端静态资源仍沿用 v427。

## 2026-06-24 v426 宽屏平铺列数修正

v425 只放开了手动窗口数量，但 `public/thread-tile-layout.js` 里仍有
`maximumColumns = 4` 的物理列数硬上限，导致第 5 个 pane 在足够宽的屏幕上
也会换到第二行，损失纵向空间。

v426 继续拆清楚三个概念：

- 自动推荐容量：控制 `paneCount=0` 时默认显示几个窗口，仍保持保守。
- 物理列容量：由实际可用宽度和最小 pane 宽度决定；桌面宽屏可以排 5/6 列。
- 用户安全上限：防止设置被写成无限 pane，但不再把桌面宽屏硬卡在 4 列。

因此，用户手动新增到 5 或 6 个窗口时，只要屏幕实际宽度足够，平铺会继续保持
单行；只有超过物理可容纳列数时才换行。v427 进一步修正了手动 pane 数需要
反推最小 pane 宽度的细节。PWA shell cache 升级到 `codex-mobile-shell-v426`。

## 2026-06-24 公开发布说明（v424 平铺窗口管理与架构重构）

本次 public 发布是在 Mac production 已先部署并通过用户验证后的同步。
发布内容覆盖最近几轮生产修复和第一阶段架构重构，核心目标是让
Codex Mobile 在大线程、任务卡协作和移动端实时状态下更稳定、更可解释。

### 1. 第一阶段架构重构

早期 Codex Mobile Web 的需求比较简单，很多逻辑集中在 `server.js` 和
`public/app.js`。随着投影缓存、任务卡、Home AI 插件模式、MCP 工具集、
线程列表内存缓存和移动端状态同步持续加入，入口文件已经承担了过多状态
规则。第一阶段重构先处理后端最容易反复出问题的边界：

- `adapters/thread-task-card-routing-service.js`：跨线程任务卡目标解析、
  exact thread id/title、同 workspace 多线程投递、归档/隐藏/sidecar/
  subagent 拒绝规则。
- `adapters/thread-turn-compaction-policy-service.js`：线程详情中哪些 turn
  保留完整 operation、哪些只保留 receipt/Usage 的服务端压缩策略。
- `adapters/thread-completion-diagnostic-service.js`：runtime 明确 completed
  但没有最终 assistant 回复时，生成可见 `turnDiagnostic` 诊断，而不是伪造
  assistant 回执。
- `adapters/thread-detail-projection-input-service.js`：projection cache
  输入签名，包括 rollout path/size/mtime、summary 状态和 retained-turn
  window。
- `adapters/thread-detail-projection-result-service.js`：projection cache hit
  后如何合并 summary、标题、runtime model/effort、read mode 和公开元数据。
- `adapters/thread-list-fallback-cache-service.js`：线程列表 fallback cache
  的进程内 baseline、TTL 诊断开关和增量 status/title/archive update。
- `adapters/thread-detail-summary-service.js`：详情 summary lookup 顺序，
  保持 state DB -> started-cache -> rollout-session -> app-server 的可解释
  顺序。

这轮重构不是“大爆炸重写”。`server.js` 仍是 HTTP 路由和 app-server
编排入口，`public/app.js` 仍然很大；但高风险策略已经开始服务化，并有
聚焦测试覆盖。后续重构会继续按问题热区推进，而不是一次性改完整个系统。

### 2. 吸收式合并 PR #78

PR #78 的价值点是：线程列表上的 running/unread 状态不能只看最后一次
刷新结果，还要考虑用户是否已经查看线程、Mobile 端提交后的短期处理中
状态、以及 mux replay 事件的时间顺序。这个方向是正确的。

本次没有原样合并 PR #78，而是按当前架构吸收其有效设计：

- 新增 `public/thread-status-hints.js`，把线程 running/unread/viewed/
  submitted-processing/mux replay freshness 规则做成纯前端策略模块。
- `public/app.js` 记录 `codexMobileThreadViewedAtById`，进入线程后更新
  viewed 时间，避免已读线程继续显示错误未读点。
- 发送消息后保留短期 submitted-processing 状态，防止 app-server 或
  replay 事件还没追上时线程列表不显示“已启动/处理中”。
- `codex-app-server-mux.js` 给 Mobile notification replay 增加
  `mobileReplay`、`mobileReplayReceivedAtMs`、`mobileReplaySeq`，客户端
  可以识别断线重放的旧 completion，避免旧事件清掉新的 running 状态。

这属于“吸收式合并”：保留 PR #78 中对状态 freshness 的正确洞察，但把
实现融入本仓库已有的状态所有权和测试体系，而不是直接复制 PR 代码。

### 3. 为什么没有合并 PR #78 的大 session 首屏 deferred enrichment

PR #78 里另一个方向是大 session 首屏先返回不完整 detail，再通过后续
enrichment 或二次刷新补齐。这个方案短期可能让首屏看起来更快，但它把
用户可见页面变成“两阶段事实”：第一阶段先缺一部分内容，第二阶段再替换
或补齐。对 Codex Mobile 当前的问题形态来说，这会重新引入我们刚修过的
抖动、回执替换、Usage 迟到、任务卡淹没和图片投影不一致等风险。

所以本次明确不合并这一部分。大 session 首屏慢应该继续归属到服务端
projection/cache/cold-path 体系内解决，而不是由前端接受一个临时不完整
页面再靠刷新补齐。当前策略是：

- 线程列表 fallback cache 只在服务冷启动/重启后建立 baseline，后续靠
  增量事件同步，不再普通刷新反复全量重扫。
- 详情 projection cache 的 input/result/summary 边界已经拆出，可以精确
  测量慢在 rollout 扫描、projection seed、app-server read 还是 DOM patch。
  生产采样显示 Home AI/Codex Mobile 大线程在服务进程存活期间能走
  dynamic projection warm path，但服务重启后磁盘 cache 可能因为旧
  rollout size/mtime 签名失效而掉回 full `thread/read`。本轮修正会把
  完整、非 partial 的 dynamic projection 以节流方式落盘，并在落盘前刷新
  rollout stat 签名；通知-only 的 partial 壳仍然不能作为有效详情缓存。
  对仍在增长的大 rollout，如果重启后 projection miss，服务端会先用
  `thread/turns/list` 读取当前 retained window 并 seed projection，只有这个
  有界读取失败时才回 full `thread/read`。
- 本次同步新增 `adapters/thread-detail-read-orchestration-service.js`，
  把 `/api/threads/:id` 的 summary、projection hit、recent turns-list、
  full `thread/read`、turns-list fallback 和 summary fallback 顺序从
  `server.js` route 中抽成可测试 coordinator。它保持 full `thread/read`
  优先契约，不用 PR #78 的 deferred incomplete detail 方案。
- 首屏优化必须保持“返回内容就是当前权威内容”的不变量。允许局部骨架和
  bounded loading 状态，但不允许用缺失最终回执、缺 Usage、缺任务卡详情
  的页面作为正常完成态。

### 4. 最近用户可见修复

- v424：平铺模式下，从外层线程列表主动进入一个当前不可见的线程时，会用该线程替换
  最后一个可见 pane，并保存新的服务器端 slot 顺序；普通 recent 排序和后台刷新仍不能
  重排已固定 pane。
- v423：平铺窗口增减移入线程名菜单。点击 pane 标题打开线程列表后，菜单顶部提供
  `关闭窗口` 和 `新增窗口`；不再在平铺画面右上角放浮动 `− / +` 控件，避免遮挡内容。
- v422：平铺模式增加动态窗口数。设备宽度只决定最大容量，实际显示窗口数由
  `threadDisplay.paneCount`、当前/运行线程数和菜单中的窗口操作共同决定；两个窗口会使用
  两列显示，不再在四列设备上被自动塞满到四个窄窗口。
- v421：修正平铺状态和线程状态刷新。平铺开关、pane 槽位顺序和选中 pane
  改为服务器 runtime `threadDisplay` 设置，Home AI/PWA 刷新和多设备打开不再丢失；
  线程列表 recent 排序只能补空位，不能重排已固定 pane。平板横屏按宽度可显示到
  4 栏。后台 `turn/completed` 派生的线程状态通知带完成事件时间，避免外层列表在
  详情已结束后仍显示刷新。平铺命令气泡时间槽和 Composer runtime 工具栏大字体
  溢出也收窄到稳定布局。
- v420：修正手机端右下浮动控件的状态归属。`回到底部` 和 `回到本轮总结`
  复用同一个浮动槽位且互斥显示，`回到底部` 优先；operation bubble/recall
  只在当前 turn 仍是 live 时可见，turn 完成并显示最终回执后不再保留命令入口。
- v404：统一手机端右下浮动控件尺寸和对齐。向下/向上滚动按钮与
  operation recall 点都使用 36px 控件、同一右边距和固定垂直间距，避免同时
  出现时一大一小、边缘不齐。
- v403：移动端 operation bubble 消失后，右下角保留同线程最近一次
  command/file/tool/search 的小圆点入口。它不占 conversation 布局，不覆盖回执；
  点击后展开最近 operation 详情 sheet，再次点击或下拉可收起。
- v402：修正移动端 operation bubble 仍然闪一下的问题。现在同一线程的
  最后一个真实 command/file/tool/search 气泡会至少停留 500ms；到期只刷新
  dock，不再调用整线程 `renderCurrentThread()`，减少 Composer 和上方消息区
  联动闪动。
- v401：吸收 PR #78 的线程状态 freshness 设计，修复断线 replay 或提交后
  短窗口导致线程列表不显示运行状态、未读点错误的问题。
- v400：修正任务卡来源线程标题，避免续接 bootstrap 文本被当作来源线程名；
  同时自动接受 CodeGraph 只读 MCP elicitation，减少无意义授权弹窗。
- v399/v398：跨线程任务卡不再按普通 `You` 消息显示，长卡片默认折叠，只在
  头部展示来源线程、目标和摘要，避免长任务卡把回执和 Usage 淹没。
- 同 workspace 多线程任务卡投递已修正：exact `targetThreadId` 是线程身份；
  只要目标未归档、未隐藏、非 sidecar/subagent，就允许同 cwd 投递。归档目标
  会显式拒绝。

### 5. 后续计划

后续目标分四层推进：

1. **大 session 性能闭环**：第一步已经把 thread detail read orchestration
   服务化；第二步已定位并修正 dynamic projection 不持久化导致重启后冷读
   大 rollout 的问题；第三步把大 rollout projection miss 的首读改成服务端
   bounded turns-list 当前窗口优先，避免 full `thread/read` 成为常态冷路径。
   后续继续采集重启/冷开和 warm cache 的分层耗时证据，分别测量 thread list
   fallback、thread detail summary、projection seed/cache、rollout enrichment、
   app-server read 和前端 DOM patch。只有确认慢点后才做下一轮结构优化。
2. **继续拆 `public/app.js`**：优先拆 thread detail merge、conversation patch、
   composer/viewport、operation dock/bubble、task-card UI 这几块，把状态机变成
   可测试 helper，而不是继续堆在单个入口文件里。
3. **补强持久化失败处理**：任务卡 store 和其他 workflow-critical store 不能在
   corrupt/unreadable 时静默当空状态；需要 fail-closed 或 bounded diagnostic，
   并保留可恢复证据。
4. **增强真实 UI 覆盖**：补 DOM/browser/视觉 smoke，覆盖移动端闪动、图片上传与
   generated image 渲染、PWA shell refresh、任务卡展开折叠和 Home AI embedded
   proxy-safe URL。

发布顺序保持不变：先本地/private workspace 实现和验证，再部署 Mac production，
用户确认后才同步 public。public 发布不包含 `.agent-context`、runtime state、
本地密钥、上传内容、日志、访问 key 或机器特定诊断。

### 6. v427/v426/v425/v424/v423/v422/v421/v420/v419/v418/v417/v416/v415/v414/v413/v412/v411/v410/v409/v408 重构进展

本轮包含一个 server-only 架构补充：thread detail read orchestration 已抽到
`adapters/thread-detail-read-orchestration-service.js`。随后新增 v421-v427 前端/服务端状态修正，
PWA shell cache 升级到 `codex-mobile-shell-v427`。

v427 修正 v426 后在 6K/高分屏桌面上第 5 个 pane 仍换行的问题：

- 自动模式继续使用 420px pane 宽度，避免默认塞太多窗口。
- 手动模式把 `threadDisplay.paneCount` 传入 layout policy，按当前 CSS
  可用宽度和用户目标 pane 数反推手动 pane 宽度；以 `2560 x 1440`
  CSS 工作区和 520px 侧栏为例，手动 5 个 pane 会稳定得到 5 列。

v426 修正 v425 手动 pane 数放开后的宽屏换行问题：

- `public/thread-tile-layout.js` 不再把桌面物理列数硬卡在 4；桌面按实际可用宽度
  和 user pane ceiling 计算列数，tablet 横屏仍保持保守 4 列。
- `public/app.js` 传入 user max 作为物理容量，同时保留 recommended max 作为
  自动模式容量，避免手动第 5 个 pane 在宽屏上被迫换行。

v425 修正 route-hint 测试边界和平铺手动窗口上限：

- Hermes notification/task-card route hint 的打开、聚焦、缺失回退和 URL scrub
  计划抽到 `public/plugin-embed.js`，并由可执行测试覆盖，不再只靠 `app.js`
  字符串存在性判断。
- 平铺手动窗口数使用独立 user pane ceiling；视口推荐容量继续控制自动模式，
  但不再阻止用户在宽桌面上继续新增窗口。

v424 修正外层线程列表进入与固定 pane 的关系：

- 平铺模式保存窗口后，如果外层线程列表主动打开了一个当前不可见的线程，浏览器会把
  最后一个可见 pane slot 替换为该线程。
- 这个替换被视为用户显式选择，会写入服务器 runtime `threadDisplay.paneThreadIds`；
  后续刷新、多设备打开和 Home AI/PWA 更新会保留这个新槽位顺序。
- 普通线程列表 recent 排序、后台状态刷新和 tile detail 刷新仍只能补空位，不能自动
  重排既有 pane。
- PWA shell cache 升级到 `codex-mobile-shell-v424`。

v423 调整平铺窗口数入口：

- 取消平铺 board 右上角的浮动 `− / +` 控件，避免遮挡 pane 内容。
- 点击 pane 线程名打开线程列表时，菜单顶部显示 `关闭窗口`、当前窗口数和 `新增窗口`。
- `关闭窗口` 针对当前 pane：减少可见 pane 数并从当前 slot 顺序中移除该线程；`新增窗口`
  仍按已保存 slot 和最近线程补入下一个候选线程。
- PWA shell cache 升级到 `codex-mobile-shell-v423`。

v422 修正平铺窗口数的状态模型：

- `threadDisplay` 新增 `paneCount`。`0` 表示自动：按当前线程、运行线程和设备容量保守显示；
  正整数表示用户手动窗口数。
- 平铺窗口数进入可持久化状态。减少窗口只减少当前显示数量，不删除 pane slot；
  增加窗口会从已保存 slot 和最近线程里补入下一个候选线程。
- 渲染列数跟随实际窗口数，而不是设备最大容量。四列设备显示两个窗口时使用两列，
  保留更宽阅读空间；用户手动加到三/四个窗口时再切到三/四列。
- PWA shell cache 升级到 `codex-mobile-shell-v422`。

v421 修正平铺持久化、pane 稳定性和外层线程状态刷新：

- `单线程` / `平铺` 显示模式、pane thread id 顺序和 selected pane 改为服务器
  runtime `settings.json` 的 `threadDisplay` 字段，通过
  `/api/settings/thread-display` 读写；浏览器 localStorage 只保留旧设置迁移和镜像。
- pane 槽位一旦确定就按 thread id 固定。普通线程列表 recent 排序、后台列表刷新和
  状态刷新只能填补空位，不能移动既有 pane；只有用户在线程名菜单里切换某个 pane
  时才替换该槽位并保存。
- 每台设备按当前宽度从同一服务器槽位列表里显示前 N 个 pane。iPad 可显示两/三栏，
  更宽的 Android 平板横屏可显示四栏。
- 后台 `turn/completed` 派生的 `thread/status/changed` 会携带 completion
  `eventAtMs`，让 PR #78 吸收后的 freshness 策略能清掉真实完成线程的外层 running
  hint，同时 replay completion 仍不会伪造新鲜时间。
- 平铺 operation bubble 的耗时槽加宽并限制字体，Composer runtime 工具栏在大字体
  设置下对 label/value 使用受控字号、`min-width: 0` 和 ellipsis，避免溢出卡片。
- PWA shell cache 升级到 `codex-mobile-shell-v421`。

v420 修正手机端右下浮动控件的归属和互斥规则：

- `回到底部` 和 `回到本轮总结` 不再是两个可并存的横向按钮；它们复用同一右下浮动槽位，`回到底部` 条件满足时优先显示，避免截图中两个箭头同时出现。
- `回到本轮总结` 的功能保留，仍然跳到当前 live/recent completed turn 的最终 `agentMessage`/`plan` 位置；它只在不需要 `回到底部` 且目标起点已经在 viewport 上方时出现。
- operation bubble 的 500ms 最小可见和 recall dot 都只在当前 turn 仍是 live 时有效；turn 完成并进入最终回执/Usage 后不再保留旧 command/file/tool/search 入口。
- PWA shell cache 升级到 `codex-mobile-shell-v420`。

v419 修正 v418 上线后平铺模式点 Composer 时整体界面短暂下沉并整板重绘的问题：

- tile 模式打开时，根节点会标记 `thread-tile-open`；Home AI embed 键盘打开期间不再把整个 `.app` 按 `--app-top` 向下平移，避免平铺视图整体下沉。
- `threadTileLayout()` 在 Composer/键盘焦点期间复用进入键盘前的 viewport 和 Composer 高度基线，不把 `visualViewport.height` 的键盘收缩误判成 pane 列/行布局变化。
- window/visualViewport resize 在 tile + 输入焦点期间只更新 viewport/composer CSS 变量和菜单位置，不再触发 `renderCurrentThread()` 整板重绘；普通 resize、orientation 和键盘关闭后的刷新仍保持原路径。
- PWA shell cache 升级到 `codex-mobile-shell-v419`。

v418 修正 v417 平铺模式里线程名菜单和共享 Composer runtime 工具栏的交互闭环：

- 点击 pane 线程名后，菜单打开状态进入 tile render signature，并且 title pointer 事件直接触发 pane 级 patch，不再依赖整板重绘；可见结果是线程切换列表会立即出现。
- tile pane 选中态、线程名菜单、后台 recent-detail 刷新和 operation bubble 更新优先走对应 pane 的局部 patch，保留该 pane 自己的 scroll 位置，避免整块平铺画面一起抖动。
- 每个 pane 记录用户是否主动离开底部；如果没有上滑阅读，新内容、后台刷新和 operation 更新会像手机单窗口一样自动沉底。只有用户已经离开底部时才保留距底部位置。
- operation bubble 的右侧耗时固定保留 `HH:MM:SS` 的 tabular 宽度，长命令只能压缩中间 summary，不能遮挡秒数。
- 平铺模式不新增设置入口；继续复用现有 Composer runtime row。用户点哪个 pane，Fast、模型、推理强度、权限控件就绑定哪个 pane 的线程 draft/metadata；额度仍保留在同一全局工具栏位置显示，不做 pane-local 额度。
- 切换 active pane 时会先保存上一个 pane 的 runtime draft，再恢复新 pane 的 thread-keyed draft；如果新 pane 没有 draft，就清掉上一个 pane 的 pending overrides，回到新线程自己的记录值，避免 Fast/推理/权限串线。
- PWA shell cache 升级到 `codex-mobile-shell-v418`，已部署 Mac production，未推 public。

v417 修正 v416 上线后的平铺细节回归：

- pane 页眉的“本轮”状态不再自造文案，改为复用单窗口 `turn-timer` 的同源状态结构：`本轮 + 时间 + 思考/输出/运行/已结束`。
- 点击 pane 线程名打开线程切换列表时，pane 的 pointerdown 选中逻辑不再提前重渲染吞掉 click；线程名菜单可正常打开，选择后只替换当前 pane。
- 平铺模式顶部重新尊重系统/宿主安全区，避免顶到系统通知栏。
- 触屏宽屏上的命令状态改为真正浮层冒泡，不再为命令框保留底部独立行；pane 内 operation bubble 也不再用额外底部 padding 预留空间。
- PWA shell cache 升级到 `codex-mobile-shell-v417`。

v416 继续压缩平铺 pane 的纵向占用，并补上 pane 内线程切换：

- tile 模式下全局 topbar 不再显示 `平铺视图` 或线程计数；主内容区贴近顶部，只保留少量边距。
- pane header 去掉路径、更新时间和 `打开` 按钮，改为“可点击线程名 + 本轮状态胶囊”。点击线程名会在当前 pane 内打开线程列表，当前 pane/可见 pane/运行中线程优先，选择后只替换这个 pane 的线程 slot，不进入单线程页。
- tile turn 不再渲染每个 turn 底部的 Active/Completed 状态行，避免占用阅读空间。
- 每个 pane 的 `↓` 按钮默认隐藏，只有用户上滑离开底部且该 pane 可滚动时才出现，行为向单窗口底部按钮靠拢。
- PWA shell cache 升级到 `codex-mobile-shell-v416`。

v415 继续把平铺 pane 推向“缩小版手机单线程窗口”：

- tile 模式新增 active pane。用户触碰/聚焦某个 pane 后，底部共享 Composer 的发送、
  草稿、Stop/引导状态、普通消息、任务卡命令和 ChatGPT Pro source thread 都绑定到该
  pane；不会因为选中 pane 而重排平铺顺序。
- tile 模式清空全局 live operation dock，避免 iPad 上出现跨全屏的一条命令框。每个 pane
  自己渲染手机态 operation bubble/sheet，并保留 500ms 最小可见语义；展开/收起状态按
  pane id 独立保存。
- 全局页眉不再显示第一个线程标题，改为 `平铺视图`；每个 pane header 显示自己的标题、
  路径/更新时间和 `本轮` 状态。tile 模式下全局 turn timer 隐藏，pane header 状态随 tick
  更新。
- 仍未完成完整 pane-local Composer：底部 Composer 视觉仍共享，但逻辑目标跟随 active
  pane。下一阶段再拆每个 pane 内独立输入、附件、语音、审批和 interrupt runtime。

v414 修正平铺 pane 的阅读位置和刷新语义：

- 每个 tile pane 渲染后默认定位到底部；如果用户已经在某个 pane 里手动上滑，
  后续刷新会保留该 pane 距离底部的位置，不强行打断阅读。
- 每个 pane 右下角新增独立的 `↓` 按钮，直接回到该线程底部。pane 内容增加
  `thread-tile-pane-content` 外层，短内容也按底部对齐，整体更接近“单线程页面缩小后
  同时显示”的感觉。
- 非当前线程 pane 不再是一次性 recent-detail 缓存：tile 模式记录当前可见 pane ids，
  对非当前 pane 做受控后台刷新，并在相关 thread/turn/item 通知到达时触发受节流的
  recent-detail 追新。当前 active thread 继续走原有 SSE/live poll。
- pane 内独立输入、命令框和操作气泡当时仍记录为下一阶段真正分屏 runtime 目标。

v413 修正 v412 后 iPad Pro 11 横屏仍完全不平铺的问题：

- 根因不在 `public/thread-tile-layout.js` 的纯策略阈值，而在浏览器调用层传入的
  sidebar 宽度。Home AI embed 线程详情页里，`.sidebar` 由 embed CSS 强制为
  fixed/offscreen overlay；但 iPad 横屏又会命中 tablet split media，导致
  `isMenuOverlayMode()` 返回 false。v412 因此把 offscreen 的 `100vw` sidebar 当成
  真实左侧分栏扣掉，传给策略的可用宽度接近 0，最终返回 `insufficient-width`。
- `threadTileLayout()` 现在只在 `splitPaneSidebarVisible()` 证明 sidebar 实际占布局空间
  时才扣 sidebar 宽度；fixed/offscreen/sidebar overlay 不再参与可用宽度计算。
- PWA shell cache 升级到 `codex-mobile-shell-v413`。

v412 修正“设置里已选择平铺，但 iPad Pro 11 横屏仍不触发”的策略边界：

- v411 的显式设置只表示用户允许平铺；真正是否进入平铺仍由
  `public/thread-tile-layout.js` 按当前 iframe 可视宽高、方向和 sidebar 状态判断。
  Home AI 嵌入态下，iPad 横屏的 CSS viewport 可能低于原来的 900px 阈值，导致
  用户已经选了 `平铺` 但仍保持单线程。
- `public/thread-tile-layout.js` 把 tablet 横屏入口阈值调整为 760px，并把 tablet
  pane 最小宽度调整为 260px；820px 级嵌入横屏和 iPad Pro 11 横屏 sidebar split
  后都按 3 栏目标计算。设置菜单的状态行会显示当前视口是 `平铺 N 栏`、宽度不足、
  竖屏单线程，还是普通单线程。
- 这仍是过渡形态：当前 tile panes 是只读 recent-detail 窗格，composer、审批、
  interrupt 和 operation dock 仍只绑定当前 active thread。长期方向应升级成用户
  可管理的分屏：用户添加/关闭 pane、拖拽 pane 宽度、决定显示几个线程；系统只做
  性能上限和移动端可用性保护。

本地 v411 将平铺入口从 topbar 移入设置菜单：

- 设置菜单新增“显示”选择：`单线程` / `平铺`。默认没有持久化值时是单线程。
- 平铺偏好改用 `codexMobileThreadDisplayMode=tile`；旧的
  `codexMobileThreadTileMode` 会在新设置写入时清理，避免 v409 临时按钮状态影响新默认。
- topbar 的 `▦` 平铺按钮移除，避免入口分散；宽屏/iPad 横屏选择“平铺”后仍按
  `public/thread-tile-layout.js` 的能力策略渲染，不满足宽屏条件时保持单线程。

本地 v410 修正 v409 平铺入口在 iPad/Home AI 嵌入视口下可能被隐藏的问题：

- 平铺可用性不再依赖 sidebar split 的 `min-height: 600px` 和严格
  `pointer: coarse` 组合。Home AI 嵌入模式下，iPad 横屏 iframe 的可视高度可能被
  宿主 top/bottom UI 压到 600px 以下，iPadOS 也可能把 pointer 报成非 coarse；这两
  种情况下仍应按横屏阅读宽度显示平铺入口。
- `public/thread-tile-layout.js` 现在把横屏、900px 以上宽度、480px 以上高度作为
  平铺入口的主要条件，并允许 overlay sidebar 模式下使用全宽阅读区。
- 手机和 iPad 竖屏仍保持单线程；iPad/桌面宽屏的底部 command dock 仍保留一整条，
  phone-only operation bubble 不扩展到 iPad。

本地 v409 继续按上面的四层目标推进：

- 宽屏线程阅读区新增只读多线程平铺：新增 `public/thread-tile-layout.js`
  承担 viewport/sidebar/orientation 到 columns/rows/maxPanes 的纯策略。手机和
  iPad 竖屏保持单线程；iPad 横屏按可用宽度至少给 2 栏，1366px 级横屏允许 3 栏；
  桌面宽屏最多 4 列、2 行，并通过 `DEFAULT_MAX_PANES` 控制最大并发 detail 读取数。
- `public/app.js` 只保留 DOM 编排：平铺 pane 使用 recent thread detail 只读渲染，
  不复用完整 `renderTurn()`，避免把审批、草稿、composer 和当前线程运行态复制到
  每个窗格。点击 pane 里的“打开”才切换为当前线程；composer、interrupt、operation
  bubble/dock 仍只绑定当前 active thread。
- 新增 `test/thread-tile-layout.test.js` 和 `test/thread-tile-layout-ui.test.js`
  覆盖 desktop 多 pane、iPad 横/竖屏、current-thread 优先选择、shell policy 注入、
  只读 tile rendering 和 CSS shell。PWA shell cache 升级到
  `codex-mobile-shell-v409`。

本地 v408 继续按上面的四层目标推进，但不执行第五步部署/发布：

- 大 session 性能证据：线程详情响应现在附加
  `mobileDiagnostics.threadDetailTimings`，包含 `summaryMs`、
  `projectionMs`、`turnsListInitialMs`、`threadReadMs`、
  `prepareResponseMs`、`readMode` 和 `phase`。前端
  `thread_detail_first_paint`、`thread_refresh_ms`、
  `thread_detail_full_ready`、`thread_list_rendered` 事件会带
  `serverTimings` 和 `performancePhase`，用于区分 cold thread-read、
  turns-list、warm projection cache 和 thread-list fallback cache。
- `public/app.js` 继续拆边界：新增 `public/live-operation-dock-state.js`
  承担 mobile operation bubble 的 500ms 最小滞留、expanded pinned sheet、
  recall dot 是否显示等纯状态规则；`app.js` 只保留 DOM 查询、patch 和事件绑定。
- 线程详情 item 合并的可见字段保留规则提取到
  `public/thread-detail-state.js`；`app.js` 只创建 policy 并委托
  `mergeItemPreservingVisibleFields`，不再内联 context compaction notice
  清理和 operation 字段保留规则。
- completed incoming turn 是否已有权威回执、local-only live receipt 是否应丢弃、
  以及 local-only item 是否应保留的规则也进入 `public/thread-detail-state.js`。
  这样 `app.js` 只负责按 incoming 顺序合并数组和 DOM patch，不继续拥有这些
  状态判定。
- 可见文本 item 的 render identity 判断、completed receipt 较长可见文本保留、
  以及既有 id / startedAtMs 保留规则也进入 `public/thread-detail-state.js`。
  `app.js` 继续只保留 `visibleTextItemsCanShareRenderIdentity` 和
  `mergeVisibleTextItemPreservingRenderIdentity` 的委托 wrapper，数组合并编排仍留在
  `app.js`，避免一次性移动 DOM patch 和 live merge 编排。
- 线程列表/详情性能字段提取放入 `public/thread-performance-metrics.js`，
  避免在 `app.js` 中继续散落 readMode/fallback cache 分类逻辑。
- task-card store fail-closed 已在当前代码中确认：missing store 仍是首启空状态，
  malformed JSON、wrong shape、unreadable store 都会 fail closed，不再静默当空。
- runtime 明确完成但没有最终回复的 turn 现在不会在详情里静默消失，也不会被伪造成
  assistant 回执。服务端从 rollout `task_complete` / `task_completed` 识别空
  `last_agent_message`，给该 completed turn 附加 bounded `turnDiagnostic`
  / `runtime_completed_without_response`；receipt-only 压缩会保留该诊断，前端以
  诊断卡渲染。后续前端 incident 上报应复用已鉴权 Mobile Web 服务端，仅提交
  build id、thread/turn id、read mode、状态、计数和耗时桶等 bounded 字段，再由
  去重/限流后的任务卡闭环，不另开未鉴权监听端口。
- 覆盖补强：新增 `test/thread-detail-performance-service.test.js`、
  `test/thread-performance-metrics.test.js`、`test/live-operation-dock-state.test.js`、
  `test/thread-detail-state.test.js`；
  既有 `conversation-render` 覆盖上传图、generated image、protected image recovery、
  任务卡折叠和 V4 merge，`collab-agent-render`/`mobile-viewport` 覆盖 operation dock
  与 PWA shell 静态资产。

## 近期逐版本记录

- 中文说明：v427（本次修复）修正 v426 后 6K/高分屏桌面第 5 个平铺窗口仍换行的问题。布局按浏览器 CSS 工作区宽度计算；自动模式仍用 420px 阅读宽度，手动模式按用户目标 pane 数反推宽度并保留 300px 安全下限。PWA shell cache 升级到 `codex-mobile-shell-v427`。
- 中文说明：v426（已被 v427 修正手动宽度细节）修正 v425 之后第 5 个平铺窗口在足够宽屏幕上仍被迫换行的问题。桌面物理列数不再硬卡 4 列，而是按实际宽度和 user pane ceiling 计算；自动模式仍用 recommended max，tablet 横屏仍保持 4 列上限。PWA shell cache 升级到 `codex-mobile-shell-v426`。
- 中文说明：v425（已被 v426 修正列数细节）把 Home AI embedded notification/task-card route hint 的打开、聚焦、缺失回退和 URL scrub 策略抽到 `public/plugin-embed.js` 并加可执行测试；平铺手动窗口数不再被设备推荐容量卡在 4，用户新增窗口可达到 bounded user pane ceiling。PWA shell cache 升级到 `codex-mobile-shell-v425`。
- 中文说明：v424（已部署 Mac production，已同步 public）修正平铺固定 pane 遮挡偶发活跃线程的问题。平铺模式下，如果用户从外层线程列表主动进入一个当前不可见的线程，最后一个可见 pane 会被该线程替换，并保存到服务器 runtime `threadDisplay.paneThreadIds`；普通 recent 排序和后台刷新仍不能重排已固定 pane。PWA shell cache 升级到 `codex-mobile-shell-v424`。
- 中文说明：v423（已并入 v424 Mac production，已同步 public）把平铺窗口增减入口移入 pane 线程名菜单。点击线程名打开列表后，顶部显示 `关闭窗口`、窗口数和 `新增窗口`；右上浮动 `− / +` 控件移除，避免遮挡 pane 内容。PWA shell cache 升级到 `codex-mobile-shell-v423`。
- 中文说明：v422（已部署 Mac production，已同步 public）修正平铺窗口数。设备宽度决定最大容量，`threadDisplay.paneCount` 和窗口增减控件决定当前显示几个窗口；自动模式下不会因为设备可放 4 个就强制塞满 4 个，两个活动窗口会以两列宽 pane 显示。PWA shell cache 升级到 `codex-mobile-shell-v422`。
- 中文说明：v421（已部署 Mac production，已同步 public）修正平铺显示设置和 pane 位置持久化。`单线程` / `平铺`、pane thread id 顺序和 selected pane 写入服务器 runtime `threadDisplay`，多设备和 Home AI/PWA 刷新后保持一致；线程列表 recent 排序只能补空位，不能重排已固定 pane，用户在线程名菜单切换 pane 才会保存新槽位。tablet 横屏按宽度最多可显示 4 栏。后台 completion 状态通知补 completion `eventAtMs`，避免详情已结束但外层列表仍显示刷新。平铺命令气泡耗时和 Composer runtime 工具栏大字体溢出也收窄。PWA shell cache 升级到 `codex-mobile-shell-v421`。
- 中文说明：v420（已部署 Mac production，已同步 public）修正手机端右下浮动控件状态。`回到底部` 和 `回到本轮总结` 复用同一个右下槽位并互斥显示，`回到底部` 优先；operation bubble/recall 只在当前 turn live 时保留，turn 完成后不再显示旧命令入口。PWA shell cache 升级到 `codex-mobile-shell-v420`。
- 中文说明：v419（已部署 Mac production，未推 public）修正平铺模式点 Composer 后整体界面下沉并整板重绘的问题。tile 打开时根节点标记 `thread-tile-open`，embed 键盘打开期间 `.app` 不再跟随 `--app-top` 平移；tile layout 在输入焦点期间复用键盘前的 viewport/composer 高度基线，visualViewport 键盘收缩不再改变 pane 列/行或触发 tile 退出；window/visualViewport resize 在 tile + 输入焦点期间不再调用整线程 `renderCurrentThread()`。PWA shell cache 升级到 `codex-mobile-shell-v419`。
- 中文说明：v418（已部署 Mac production，未推 public）修正平铺模式线程名菜单、共享 Composer runtime 工具栏、pane 新内容沉底和命令气泡秒数遮挡。线程名菜单打开状态进入 tile render signature，title pointer 直接 pane-local patch，避免“点了没列表”；tile pane 选中、菜单、后台 detail 刷新和 operation bubble 更新优先局部 patch 对应 pane，未主动上滑时新内容自动沉底，抑制整屏抖动。平铺模式不新增设置入口，继续复用现有 Fast/模型/推理强度/权限/额度工具栏；用户点哪个 pane，Fast/模型/推理/权限就跟随哪个 pane 的 thread-keyed draft/metadata，额度仍是全局显示。operation bubble 耗时固定保留 `HH:MM:SS` 宽度，长命令不再遮挡秒数。PWA shell cache 升级到 `codex-mobile-shell-v418`。
- 中文说明：v417（已部署 Mac production，未推 public）修正 v416 平铺细节：pane header 的本轮状态复用单窗口 `turn-timer` 结构，显示 `本轮 + 时间 + 思考/输出/运行/已结束`；线程名点击不会被 pane pointerdown 重渲染吞掉，能正常打开线程切换列表；平铺顶部尊重系统/宿主安全区；触屏宽屏命令状态使用浮层冒泡，不再占底部独立行。PWA shell cache 升级到 `codex-mobile-shell-v417`。
- 中文说明：v416（已部署 Mac production，未推 public）压缩平铺模式顶部和 pane 内冗余状态。tile 全局 topbar 不再显示 `平铺视图`，pane header 去掉路径/更新时间/打开按钮，改为可点击线程名和紧凑本轮状态胶囊；点击线程名可在当前 pane 内打开线程列表并替换该 pane 的线程 slot。tile turn 底部不再显示 Active/Completed 状态行；每个 pane 的 `↓` 只在上滑离开底部时显示。PWA shell cache 升级到 `codex-mobile-shell-v416`。
- 中文说明：v415（已部署 Mac production，未推 public）把平铺模式的交互目标从“只读 recent-detail 窗格”推进到 active pane。用户触碰/聚焦哪个 pane，底部共享 Composer 就向哪个线程发送；草稿 key、Stop/引导状态、普通消息、任务卡命令、ChatGPT Pro source thread、本地 optimistic 回显和失败回执都按 active pane 的 thread id 归属。tile 模式清空全局 live operation dock，每个 pane 内复用手机态 operation bubble/sheet，展开状态按 pane 独立保存，并保留 500ms 最小可见语义。全局页眉不再显示第一个线程，pane header 自己显示标题、路径/更新时间和本轮状态。PWA shell cache 升级到 `codex-mobile-shell-v415`。
- 中文说明：v414（已部署 Mac production，未推 public）修正平铺 pane 默认停在顶部、缺少直接向下箭头、非当前 pane 不实时追新的问题。tile pane 渲染后默认落到底部，短内容也底部对齐；每个 pane 有独立 `↓` 底部按钮；用户手动上滑后刷新会保留距底部位置。非当前 pane 改为受控后台 recent-detail 刷新，并在相关通知到达时触发受节流追新。pane 内独立输入、命令框和 operation bubble/dock 记录为下一阶段真正分屏 runtime：每个 pane 都应是独立手机单线程窗口，不混入当前只读 tile 热修。PWA shell cache 升级到 `codex-mobile-shell-v414`。
- 中文说明：v413（已部署 Mac production，未推 public）修正 v412 后 iPad Pro 11 / Home AI embed 横屏仍完全不平铺的问题。根因是 embed 线程详情页的 sidebar 实际是 fixed/offscreen overlay，但 iPad 横屏命中 tablet split media 后 `isMenuOverlayMode()` 返回 false，调用层把 offscreen `100vw` sidebar 当成真实分栏宽度扣掉，导致可用宽度接近 0。`threadTileLayout()` 现在只在 `splitPaneSidebarVisible()` 证明 sidebar 实际占布局空间时才扣 sidebar 宽度。PWA shell cache 升级到 `codex-mobile-shell-v413`。
- 中文说明：v412（已部署 Mac production，未推 public）修正 iPad Pro 11 / Home AI 嵌入横屏已选择 `平铺` 但仍显示单线程的问题。`public/thread-tile-layout.js` 将 tablet 横屏入口阈值降到 760px，tablet pane 最小宽度降到 260px，覆盖 820px 级嵌入横屏和 iPad Pro 11 横屏 sidebar split 后 3 栏目标；设置菜单新增当前视口状态说明。长期方向已记录为用户可添加、关闭、拖拽宽度的分屏阅读，而不是继续扩大自动平铺判断。PWA shell cache 升级到 `codex-mobile-shell-v412`。
- 中文说明：v411（已部署 Mac production，未推 public）将平铺功能入口移到设置菜单的“显示”选择里。默认不平铺；只有用户选择 `平铺` 后才持久化 `codexMobileThreadDisplayMode=tile`。旧的 `codexMobileThreadTileMode` 会在新设置写入时清理，topbar 的 `▦` 临时按钮移除。PWA shell cache 升级到 `codex-mobile-shell-v411`。
- 中文说明：v410（已部署 Mac production，未推 public）修正 iPad/Home AI 嵌入视口下平铺入口可能不显示的问题。v409 把入口和 iPad 横屏判断间接绑到了 sidebar split 的 `min-height: 600px` 以及 `pointer: coarse`；在 Home AI iframe 高度被宿主 UI 压缩或 iPadOS 报成非 coarse pointer 时，按钮会被隐藏。`public/thread-tile-layout.js` 现在按横屏、900px 以上宽度、480px 以上高度和 overlay/full-width 可用性判断平铺入口，iPad 竖屏仍保持单线程。PWA shell cache 升级到 `codex-mobile-shell-v410`。
- 中文说明：v409（已部署 Mac production，未推 public）新增宽屏线程阅读平铺。`public/thread-tile-layout.js` 拥有 viewport/sidebar/orientation 到 columns/rows/maxPanes 的纯策略；手机和 iPad 竖屏保持单线程，iPad 横屏至少 2 栏、宽横屏允许 3 栏，桌面宽屏最多 4 列/2 行并受最大 pane 数限制。`public/app.js` 只做只读 pane DOM 编排，composer、interrupt 和 operation dock 仍绑定当前线程，点击 pane 内“打开”才切换当前线程。PWA shell cache 升级到 `codex-mobile-shell-v409`。
- 中文说明：v408（本地已验证，未部署，未推 public）继续第二阶段前端状态边界拆分。`visibleTextItemsCanShareRenderIdentity` 和 `mergeVisibleTextItemPreservingRenderIdentity` 的规则已并入 `public/thread-detail-state.js`，覆盖可见文本 render identity、completed receipt 较长文本保留、既有 id / startedAtMs 保留，以及身份不匹配时回落到普通 visible-field merge。`public/app.js` 继续只保留委托 wrapper。PWA shell cache 升级到 `codex-mobile-shell-v408`。
- 中文说明：v407（已部署 Mac production，未推 public）继续第二阶段前端状态边界拆分。`completedIncomingTurnHasAuthoritativeReceipt`、`shouldDropLocalOnlyReceiptForIncomingTurn` 和 `shouldPreserveLocalOnlyItem` 的规则已并入 `public/thread-detail-state.js`，覆盖 completed incoming turn 权威回执、local-only live receipt 丢弃、mux user echo 保留、reasoning local-only item 拒绝和 visual receipt suppression。`public/app.js` 继续只保留委托 wrapper。PWA shell cache 升级到 `codex-mobile-shell-v407`。
- 中文说明：v406（本地待部署，未推 public）开始第二阶段前端状态边界拆分。线程详情 item 合并的强可见内容保留、context compaction notice 去旧状态、operation 字段保留等规则移动到 `public/thread-detail-state.js`，`public/app.js` 只保留委托 wrapper。新增 `test/thread-detail-state.test.js`，并把新静态脚本接入 HTML、service worker、server build-id 资产列表和 `npm run check`。PWA shell cache 升级到 `codex-mobile-shell-v406`。
- 中文说明：本地补充 runtime 空完成 turn 诊断（未部署，未推 public）。实测 Home AI 某 turn 的 rollout 只有 `task_started` / `task_complete`，且 `last_agent_message` 明确为空；生产详情因此显示 completed 但无正文、无 Usage。当前源码改为在这种形态下附加 `turnDiagnostic` / `runtime_completed_without_response`，不伪造 `agentMessage`，也不把它当普通完成 Push；前端渲染为可见诊断卡。前端自动 incident 闭环的方向已固化为复用已鉴权服务端、bounded 字段、诊断包 id、去重限流后再发任务卡。
- 中文说明：v405（本地待部署，未推 public）新增大 session 首屏/刷新分层性能诊断。线程详情响应带 bounded `mobileDiagnostics.threadDetailTimings`，前端性能事件带 `serverTimings` 与 `performancePhase`，用于直接区分 cold `thread/read`、turns-list、warm projection cache、thread-list fallback cache 和 DOM render 成本。移动端 operation bubble 的 500ms 最小滞留、pinned sheet 和 recall dot 状态规则拆到 `public/live-operation-dock-state.js`；性能字段提取拆到 `public/thread-performance-metrics.js`。PWA shell cache 升级到 `codex-mobile-shell-v405`。
- 中文说明：v404 统一移动端右下浮动控件的视觉栈。`回到底部` / `回到本轮总结` 按钮和 operation recall 点现在都使用 36px 尺寸、同一右边距和固定 6px 垂直间距；recall 点仍在滚动按钮下方，避免两个圆同时出现时一大一小、没有对齐。PWA shell cache 升级到 `codex-mobile-shell-v404`。
- 中文说明：v403 在移动端 operation bubble 的 500ms 最小停留之后，继续保留一个同线程最近 operation 的常驻小圆点入口。它位于右下角滚动箭头附近但更低、更小，不参与消息流布局；点击圆点会重新打开最近 command/file/tool/search 的不透明详情 sheet，避免短操作结束后完全没有可点入口。PWA shell cache 升级到 `codex-mobile-shell-v403`。
- 中文说明：v402 修正移动端 operation bubble 仍会闪一下的问题。v399 的 500ms 保护只在 DOM 上已经存在气泡时生效；短命令如果在同一轮刷新里先结束，后续状态可能在气泡落 DOM 前把 dock 清空。现在 dock 状态会保存同一线程最后一个 mobile bubble HTML 和最短可见截止时间，短操作结束后仍保持至少 500ms；到期刷新只更新 dock，不再调用整线程 `renderCurrentThread()`，减少 Composer 附近和上方消息区的联动闪动。PWA shell cache 升级到 `codex-mobile-shell-v402`。
- 中文说明：v401 吸收 PR #78 中可取的线程状态 freshness 设计，但按当前架构重写为独立 `thread-status-hints` 策略模块。移动端线程列表现在记录已读时间、短期提交处理中状态和 mux replay 时间戳，避免断线重放的旧 completion 把正在运行提示清掉或制造错误未读点；本次不引入大 session deferred enrichment，避免用二次刷新掩盖服务端缓存/投影根因。PWA shell cache 升级到 `codex-mobile-shell-v401`。
- 中文说明：v400 修正跨线程任务卡的来源线程标题，并收窄处理 CodeGraph 只读 MCP 授权。任务卡创建和注入时不再接受 `# Continuation Bootstrap Index` 这类续接 bootstrap 文本作为来源线程名，而是优先使用真实显示标题、Mobile session index 标题或 thread id；新注入正文同时包含 `Source thread id`，避免标题异常时只剩不可恢复文本。CodeGraph MCP 的只读 `codegraph_search/explore/node/callers` elicitation 会在服务端自动接受，不再显示给用户；其他 MCP server 或未知工具仍需显式处理。PWA shell cache 升级到 `codex-mobile-shell-v400`。
- 中文说明：v399 调整跨线程任务卡注入消息的手机端显示语义。注入卡不再按普通用户消息显示 `You`，而是使用独立任务卡外观；卡片头部显示来源线程和任务目的，完整任务卡正文仍可展开查看。移动端 operation bubble 增加 500ms 最小可见时间，避免短命令只闪一下。PWA shell cache 升级到 `codex-mobile-shell-v399`。
- 中文说明：v398 将注入到目标线程的跨线程任务卡用户消息改为默认折叠。长任务卡只在消息流里显示来源线程、任务目的和长度摘要，点击可展开，展开内容在卡片内部滚动并可再次收起，避免任务卡正文把后续回执和 Usage 淹没。PWA shell cache 升级到 `codex-mobile-shell-v398`。
- 中文说明：v397 修正手机端 operation bubble 展开详情不稳定的问题。用户点开气泡后，详情 sheet 会进入 pinned 状态，即使当前 command/file/tool operation 很快完成、后续刷新只剩 reasoning/status，也会保留最后一条 operation 详情，直到用户下拉或再次收起；展开 sheet/card 改为不透明 panel 背景，避免底下对话内容透出影响阅读。PWA shell cache 升级到 `codex-mobile-shell-v397`。
- 中文说明：v396 修复移动端发送用户消息后，思考过程中同一条用户消息可能出现两张相同卡片的问题。服务端 mux-local `userMessage` echo 和 pending steer echo 现在携带 `clientSubmissionId`；前端线程合并会用提交 id、本地 `local-user-*` id、确定性 `mux-user-*` id 后缀和内容签名收敛同一次提交，只保留优先级更高的 mux/durable 用户消息，同时保留用户后来真正重复发送的同文消息。PWA shell cache 升级到 `codex-mobile-shell-v396`。
- 中文说明：server-only 修正同一工作区多个正常线程之间无法发任务卡的问题。`/api/threads/:sourceThreadId/task-cards` 现在把精确 `targetThreadId` / `targetThreadTitle` 视为线程身份，只要目标存在且未归档、未删除、非隐藏/子代理，就允许同 cwd 投递；不会再因为另一个同 cwd 线程更新时间更新而拒绝或改投。`targetCwd` / `targetWorkspace` 仍是模糊 workspace 目标，才会选择该 workspace 的当前可见线程。传入源线程自身会返回 `target_thread_self`，归档目标返回 `target_thread_archived`；本次不改变 PWA shell cache。
- 中文说明：v395 将手机端底部 Command dock 改为悬浮 operation bubble。手机窄屏不再为纯 reasoning 或命令状态常驻占用一行纵向空间；只有真实 command/file/tool/search 正在运行时才在 composer 上方显示一个不参与布局的气泡，内容只保留操作类型、短摘要和运行时长。点击或上滑气泡会展开当前操作详情 sheet，可查看完整命令和参数。桌面和 iPad 宽屏继续保留原一行 Command dock。PWA shell cache 升级到 `codex-mobile-shell-v395`。

- 中文说明：server-only 跟进修正 v394 后 Mac 上 Command 详情仍为空的问题。实测 `/api/threads/:id?mode=recent` 返回的 `commandExecution.command` 本身为空，失败层不是前端 dock 渲染，而是服务端 raw-operation fallback 只解析 rollout `function_call.arguments.command`，没有解析 Mac `exec_command` 常见的 `arguments.cmd`。现在服务端投影同时支持 `command`、`cmd`、`shellCommand`、`shell_command`，且支持 `arguments` 为对象或 JSON 字符串；本次不改变 PWA shell cache。

- 中文说明：v394 调整 v393 的底部 dock 语义，并修复 Mac 上 Command 详情为空。底部 dock 仍会在 active turn 全程保留一行高度，避免 reasoning ↔ command/tool 阶段切换导致 composer 上方布局跳动；但 reasoning-only 阶段的 synthetic 占位行只显示 `Command` 空状态，不再显示 `思考`，避免和右上角 turn 状态重复。Command 详情提取现在同时支持 `item.command` 和 Mac/新协议常见的 `item.arguments` JSON 里的 `command`/`cmd`/`shellCommand` 字段；真实 command/tool/file 操作仍优先显示在 dock。compact dock 高度从 54px 降到 40px，内部卡片从 44px 降到 32px，只保留一行文字和少量边距。PWA shell cache 升级到 `codex-mobile-shell-v394`。

- 中文说明：v393 恢复 active turn 期间底部状态行恒定。v392 后底部 live operation dock 只在最新 live turn 存在 active command/tool/search 项时渲染；当 turn 处于 reasoning-only “思考”阶段时 dock 会消失，进入命令阶段再出现，导致 composer 上方高度变化并可能造成剩余画面颤动。现在 latest live turn 没有 active operational item 时也会渲染 synthetic `liveTurnStatus` 行，显示 `思考`/`运行` 等 live activity label；真正的 command/tool 到来时仍优先显示对应操作项。PWA shell cache 升级到 `codex-mobile-shell-v393`。

- 中文说明：v392 继续修正完成回执出现后的画面闪烁。v391 已处理同一 turn 内较短完成回执接管旧 receipt 节点，但 post-completion refresh 仍会因为 `mobileProjectionRevision` / `mobileVisibleItemKeys` 变化而绕过局部 patch，退回较大的 conversation/article patch。现在 refresh patch 判断改用只包含外壳可见因素的 `conversationPatchShellSignature`，并允许 latest turn 在完成态追加 Usage 或更新 receipt 时保留已有 item key 做局部 patch；只有删除、重排或外壳结构变化才回退完整渲染。PWA shell cache 升级到 `codex-mobile-shell-v392`。

- 中文说明：v391 修正完成回执替换造成的短暂画面颤动。v390 会在 completed 服务端投影带回最终 `agentMessage` 和 `Usage` 后丢弃本地 active 阶段的 local-only 回执；但如果服务端最终回执是实时回执的较短前缀，旧逻辑会先移除较长本地回执再插入较短服务端回执，导致同一位置高度瞬间少一行。现在 completed incoming turn 的权威回执会在同类型、同前缀且重合度足够时接管已有可见回执节点，沿用旧 id 和较完整文本，同时保留 Usage 归并，避免 DOM 节点重建和高度缩短。PWA shell cache 升级到 `codex-mobile-shell-v391`。

- 中文说明：v390 修正同一页面内 active turn 结束后可能短暂保留两条 Codex 回执的问题。失败层是前端 V4 thread detail 合并：为避免 live refresh 变轻，旧逻辑会保留本地-only 可见项；当 completed 服务端投影已经带回最终 `agentMessage` 和 `Usage` 时，本地 active 阶段的旧 receipt 仍可能留在页面里，形成一条无 Usage、一条有 Usage。现在 completed incoming turn 已有服务端 receipt 时，前端不再保留同 turn 的本地-only `agentMessage`/`plan`；本地 operation 卡仍可按既有规则保留。PWA shell cache 升级到 `codex-mobile-shell-v390`。

- 中文说明：v389 修正 v388 后仍可见的两个投影状态归并回归。第一，已有线程发送消息时，浏览器会先插入本地 `local-turn` optimistic overlay；现在 `/api/threads/:id/messages` 成功返回真实 `turnId` 后，会立即把该 overlay 归并到真实 turn，不再等下一次详情刷新，因此同一条用户消息不会在本地 turn 和服务端 turn 中同时显示。第二，服务端压缩 turn 时会给已抑制的“用户上传图 view_image 回执”写入 `mobileSuppressedVisualReceiptKeys`；V4 详情 refresh 合并只按这个服务端投影标记移除旧本地 visual receipt，不再由客户端按上传摘要自行猜测。普通系统生成图和视觉核验输出仍可保留。PWA shell cache 升级到 `codex-mobile-shell-v389`。

- 中文说明：v388 修正两类 Home AI embedded 回归。第一，插件模式下压缩续接新线程的启动索引缺少中心平台契约要求；现在从 embedded/plugin iframe 触发续接时，前端会把 `pluginMode=hermes` 传给续接任务，服务端只在该模式下给新线程 bootstrap 追加 `Home AI Central Contract` 区块，要求先完整读取 `/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/plugin-workspace-platform-contract.md` 并按中心契约工作。第二，用户上传图片已在用户消息里正常显示时，后续 `view_image`/工具 matcher 对同一上传图生成的系统图片回执不再投影，避免出现一张重复且无法加载的 `Image` 卡；普通系统生成图和无用户上传对应的视觉核验图仍保留。PWA shell cache 升级到 `codex-mobile-shell-v388`。

- 中文说明：v387 修正 Home AI embedded/proxy 页面中上传摘要和 generated-image 图片卡仍使用根 `/api/...` 作为动态 `<img src>` 的问题。实测坏图文件通过 Codex 服务 `8787/api/uploads/file?id=...` 返回 `200 image/jpeg`，但同一根路径落到 Home AI host `8797/api/uploads/file` 返回 `401`，导致 iOS/PWA 中永久坏图。现在当前页面路径处于 `/api/hermes-plugins/<plugin-id>/proxy/` 时，动态图片内容 URL 会生成到同插件 proxy 前缀下；直接打开 `8787` 的独立模式不变。PWA shell cache 升级到 `codex-mobile-shell-v387`。

- 中文说明：v385 修正普通发送后右上角反馈可能过早显示“已结束”的问题。生产日志显示提交 RPC 已成功创建 active turn，详情接口也返回线程级 `active`，但在 app-server/detail 投影短暂只暴露旧 completed turn 行的窗口里，旧前端只按最新 turn 行决定是否继续 live poll 和是否显示运行态；这会让客户端停止刷新并把计时器落到 completed turn 的“已结束”。现在新增线程级 active runtime 判定：只要当前线程状态仍是非 stale 的 `active/running/...`，前端会继续 poll，并在没有可用 live turn 行时把右上角保持为运行反馈，不再提前显示结束。PWA shell cache 升级到 `codex-mobile-shell-v385`。

- 中文说明：v383 修正 Music 等大线程 active turn 底部 Command 框一直显示 completed 的问题。生产数据里 Music 最新 turn 仍是 active，但该 turn 内 39 个 command/file operation 都已经 completed，没有任何 running/pending operation；旧前端 `currentLiveOperationEntry()` 仍然选择“最新 live turn 的最后一个 operation”，不看 operation 是否已完成，于是底部 live dock 会永久固定在一个 completed 卡片上，真正的 Command 框状态不可用。现在新增统一的 `isActiveOperationalItem()` 判定，dock、turn activity label、live turn active item 判断都只把未完成的 command/file/tool/search operation 当作 live operation；同一 active turn 如果只有 completed operation，底部 dock 会隐藏，而不是显示 stale completed。新增回归测试覆盖“running operation 后面有 completed item 时仍选 running”和“只有 completed operation 时返回空”的路径。PWA shell cache 升级到 `codex-mobile-shell-v383`。

- 中文说明：v382 修正 live turn 详情打开时的双路读取竞态。症状是用户刚发送“推送 public”等消息后，Codex 回执在首屏或 SSE 增量里短暂出现，随后被后到的 `thread-read` / `turns-list-initial` / full backfill 结果覆盖并消失；服务端详情接口仍能读到该回执，所以失败层不是写入或投影丢数据，而是前端同一 turn 的 item 合并规则。旧逻辑用整个 turn 的可见内容总权重判断是否保留本地已显示项，后到的回填如果带着更多旧命令输出但缺少刚出现的 assistant receipt，就可能把已经显示过的回执删掉。现在同一未完成 live turn 的可见项合并改为单调：后到结果可以更新已有项、补充新项、按 incoming 顺序校正已有项，但不能删除已经显示过且未被同 ID/同文本/用户消息去重规则替代的非 reasoning 可见项；completed turn 仍按服务端最终结果收敛。新增回归测试覆盖“回执已显示，后到 thread-read 有更多旧内容但缺回执”的路径。PWA shell cache 升级到 `codex-mobile-shell-v382`。

- 中文说明：v381 修正 live SSE 增量和 detail/projection refresh 合并时的 item 顺序所有权。症状是运行中 turn 的初始 `You` 消息可能被错误显示在较新的 Codex 回执下面，并随着新回执或后台 refresh 反复消失/出现；失败层是前端 `mergeItemsPreservingLocalVisible()` 把本地增量数组顺序当成权威，保留了 SSE 先 append 到 turn 尾部的 userMessage 位置。现在 refresh/projection 的 incoming item 顺序是权威顺序，本地只保留真正没有进入 refresh 的 pending/local-only item，并按已有锚点插回；已有更完整的本地 agent 文本仍可保留，但不能改变服务端权威 user/agent 顺序。旧的 `hasMatchingIncomingVisibleItem()` 路径已删除，避免继续留下“先遍历 existingItems”的兜底后遗症。PWA shell cache 升级到 `codex-mobile-shell-v381`。

## 2026-06-23 public 发布说明：线程详情、线程列表和完成回执一致性修复

本次 public 发布对应 Mac 生产环境已先行部署并完成 smoke 验证后的代码同步。修复目标不是给 Music 等大线程再加一层前端兜底，而是把线程详情、线程列表、rollout enrichment、active overlay 和投影缓存的状态所有权收敛到同一套服务端不变量：真实 app-server / rollout 已经物化的 turn 优先于本地临时 overlay；已完成线程的最终回执和 Usage 由 bounded rollout completion 作为补齐证据；线程列表 fallback 不能在详情首屏期间抢占大 rollout 扫描。

本次公开发布包含以下主要变更：

- 详情首屏和线程列表 fallback 的竞争被收紧到 v380。前端现在把线程切换、live poll、Usage backfill 和 full backfill 都视为详情忙碌窗口；服务端同时跟踪正在读取的 `/api/threads/:id` 详情请求。普通 `/api/threads` 列表刷新如果在详情请求期间到达，会返回 `mobileDeferredFallback=true` 和 `fallbackDeferredReason=active-thread-detail`，跳过同步 state DB / rollout fallback 扫描。这样 Music 这类 200MB 级 rollout 线程在冷启动或重启后不会被后台列表冷扫阻塞首屏详情。这个部分包含前端资源更新，PWA shell cache 升级到 `codex-mobile-shell-v380`。
- 线程列表 fallback cache 改成进程内 baseline 加增量同步。默认不再按 30 秒 TTL 失效，也不再因为 `state_5.sqlite`、`session_index.jsonl`、归档索引或 `sessions/` 目录 mtime/size 变化就整体换 cache key 重扫。服务重启后的首次完整 fallback 读取会建立 baseline；之后通过 turn、status、title、archive、new-thread 事件对单条 summary 做 upsert/remove/status update。`CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS=0` 表示不过期，只保留为显式诊断覆盖。
- 本地 `turn/start` active overlay 和真实物化 turn 的所有权重新定义。Mobile Web 自己提交消息后，本地 overlay 只在 app-server / rollout 还没有物化真实 turn 时暂时拥有 `activeTurnId`。一旦详情投影或 rollout 证据显示另一个未完成且有运行中 item 的真实 turn，服务端会把 active 所有权转移到该物化 turn，并删除空的本地 active shell。线程已回到 idle/completed/failed/cancelled/interrupted/error 等静止态时，列表和详情投影里残留的空 live shell 也会被剪掉。
- 已完成线程的最终回执和 Usage 由服务端统一补齐。若 `thread/turns/list` 没有返回 summary `updatedAt` 对应的最新 completed turn，但 rollout `task_complete` / `task_completed` 已经证明它存在，服务端会在 recent/detail 响应里追加这个 completed turn，再附加最终 agent receipt 和 `turnUsageSummary`。这覆盖“第一次进入已完成线程时正文缺最终回执或 Usage，退出再进才出现”的根因路径。
- rollout enrichment index 现在会读取文件末尾没有尾随换行但已经完整可解析的 JSONL 最后一行。正在写入中的半截 JSON 仍不可见，不会被当成完成事件；等后续换行落盘后也不会重复计入。这样刚完成的 turn 不再因为最后一行缺换行而在首次详情读取时缺失 `task_complete.last_agent_message`。
- recent/detail 排序修正了 `rollout-*` fallback 行和有真实时间戳 turn 的顺序。只有没有时间戳的 `rollout-*` fallback 行会被视为比有时间戳的 turn 更旧，避免旧 fallback 行排到最新 completed turn 后面；普通没有时间戳的 live turn 仍允许排在 completed 历史之后，保证正在运行的 turn 可见。
- 线程详情 `projection-v4-dynamic` 的缓存软失效规则被固化。动态投影仍可用于活跃线程的增量快路径；但当 backing signature 的 rollout path/size/mtime/maxTurns/policy 变化且线程已经静止，或动态投影超过短阈值仍没收到新事件时，会返回 miss 并触发详情 reseed，避免 completed 线程长期沿用漏片段的旧 dynamic projection。
- Home AI 平台边界文档已明确引用中央 root-cause architecture contract：`/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`。本仓库只保留直接引用，不复制合同全文；后续插件 bugfix、部署、MCP、schema、provisioning 和平台边界工作都要先明确症状、失败层、归属 workspace、被破坏的不变量、根因或最强假设，以及关闭验证。

发布和验证边界：

- 本次先部署到 Mac production，再由用户确认当前版本可推 public，随后才同步 public 仓库。
- 本地完整测试已通过：`npm test` 共 `624/624` 通过；同时通过 `npm run check`、`npm run check:macos` 和 `git diff --check`。
- 生产目标同步后通过 `npm run check`、`npm run check:macos`，并用生产依赖跑过 160 个 focused tests。
- Music 线程 smoke 验证显示：recent detail 返回 `idle`，没有 `activeTurnId`，10 个 turns 中最新 turn 是 rollout `task_complete` 对应 completed turn，包含 `userMessage`、`agentMessage` 和 `turnUsageSummary`，没有空 turn；线程列表返回 Music `idle`，warm list fallback cache 命中。
- public 发布只包含公开源码、README、docs 和测试；不会复制 `.agent-context`、runtime state、本地密钥、上传内容、完整 rollout、访问 key、launch token、私有日志或机器特定诊断。

- 中文说明：Home AI 插件 bugfix、部署、MCP、schema、provisioning 和平台边界工作遵循中央 root-cause architecture contract：`/Users/hermes-dev/HermesMobileDev/app/docs/PLATFORM_CONTRACTS/root-cause-architecture-contract.md`。本仓库只引用该权威文件，不复制全文；非平凡修复前应明确症状、失败层、归属 workspace、被破坏的不变量、根因或最强假设，以及关闭验证。
- 中文说明：server-only 修正本地 `turn/start` active overlay 和真实物化 turn 分叉时的状态所有权。Mobile Web 自己发起消息后，`message-submit` overlay 只在 app-server/rollout 尚未物化真实 turn 时拥有 activeTurnId；如果详情投影里出现另一个已有运行 item 的未完成 turn，服务端会把 active 所有权转移到该物化 turn 并删除空的本地 active shell；如果线程已回到 idle/completed 等静止态，旧投影里残留的空 inProgress shell 也会被删除。若 app-server `thread/turns/list` 漏掉 summary updatedAt 对应的最新 `task_complete` turn，服务端会从 rollout completion 事件补入 completed turn，再接上最终回执和 Usage；rollout JSONL 最后一行即使没有尾随换行，只要是完整可解析 JSON，也会进入 enrichment index，避免刚完成后首次打开仍缺最新回执。这样避免 Music 这类线程出现右上角有输出/命令/思考但正文和最终回执锚在空 turn 上，或完成后首屏缺最新回执的状态分裂。本次不改变 PWA shell cache。
- 中文说明：server-only 固化线程详情 `projection-v4-dynamic` 的软失效规则。动态投影仍允许活跃线程在 rollout 文件变化时短时间走增量快路径；但如果 backing signature 的 rollout path/size/mtime/maxTurns/policy 变化后线程已进入 idle/completed/failed/cancelled/interrupted/error 等静止态，或动态投影超过短阈值仍未收到新事件，就返回 miss 并触发详情读取/reseed。这样保留 live 性能，同时避免事件流漏片段后 completed 线程长期沿用旧 dynamic projection。本次不改变 PWA shell cache。
- 中文说明：server-only 修正线程列表 fallback cache 的生命周期。默认不再每 30 秒过期，也不再因为 `state_5.sqlite`、`session_index.jsonl`、归档索引或 `sessions/` 目录 mtime/size 变化而换 cache key 重扫；服务冷启动/重新部署/重启后的首次完整 fallback 读取会建立进程内 baseline，后续普通列表刷新复用 baseline，并通过 turn/status/title/archive/new-thread 事件对单条 summary 做增量 upsert/remove/status update。`CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` 现在默认 `0` 表示不过期，仅作为显式诊断覆盖。本次不改变 PWA shell cache。
- 中文说明：v380 继续收紧大线程首屏期间的线程列表 fallback。前端现在把线程切换、live poll、Usage backfill 和 full backfill 的详情请求都视为“详情忙”，不会主动启动完整列表 fallback；服务端也跟踪活跃 `/api/threads/:id` 详情请求，若普通列表刷新在详情请求进行中到达，会返回 `mobileDeferredFallback=true` 并标记 `fallbackDeferredReason=active-thread-detail`，跳过同步 state DB / rollout fallback 扫描。这样 Music 这类 240MB rollout 线程不会因为后台列表冷扫阻塞详情 refresh；历史/fallback 线程仍由后续可取消补拉合并回来。PWA shell cache 升级到 `codex-mobile-shell-v380`。
- 中文说明：v379 修正 Home AI/Hermes 嵌入态 iOS/PWA 中 `Image` 卡片偶发坏图的问题。上传图和生成图在嵌入态继续使用同源 `/api/uploads/file` / `/api/generated-images/file` 作为浏览器 `<img src>`，但定时扫描不再把尚未失败的直接图片主动转换成 `data:image/...` 或 `blob:`。出错恢复仍会 fetch 探测；嵌入态和 iOS 恢复时改为 cache-busted 同源文件 URL，避免在 DOM 中塞入大 base64。上传图浏览器 `src` 也改为 `/api/uploads/file?id=...` 的运行时相对 id，不再把本地绝对路径放进图片 `src` 参数。PWA shell cache 升级到 `codex-mobile-shell-v379`。
- 中文说明：v378 修正 Hermes/Home AI 嵌入态下历史上传图片偶发不显示的问题。嵌入模式仍先用同源 `/api/uploads/file` / `/api/generated-images/file` 直接作为 `<img src>`，但现在也保留 `data-protected-image-src` 并允许定时图片扫描主动用当前会话 key `fetch` 后替换为本页 `data:image/...` 或 `blob:` URL。这样当前本地预览可继续显示，重新进入 roon 等历史线程时若 WebView、代理或 cookie/query 图片加载链路不稳定，也会走同一受保护图片恢复路径。PWA shell cache 升级到 `codex-mobile-shell-v378`。
- 中文说明：server-only 修正 `跨工作区委派` 写保护误伤工具工作区的问题。源码写保护现在只防止修改其他已知源码根：`apply_patch`、文件变更、相对路径写入、`git add/commit`、安装/构建类源码写命令和写类文件系统授权仍会被拒绝；但外部工具 workspace 中的 Playwright/Chromium、Home AI 视觉核验、只读/网络/MCP 命令，以及把截图或诊断输出写到 `/tmp` / `/private/tmp` 的工具命令可以继续使用。同步修正 JavaScript `=>` 被误判成 shell 重定向的问题。本次不改变 PWA shell cache。
- 中文说明：v377 将 Composer 的 Fast 从全局浏览器开关改为线程持久化标签。点击 Fast 只影响当前线程；切换到其他线程会读取该线程自己的 Fast 标签，新建对话时开启 Fast 会在创建成功后迁移到新线程。旧的全局 `codexMobileCodexFastMode` 不再恢复 Fast，触摸事件也会压住合成 click/touchend，避免取消后又被第二次事件打开。PWA shell cache 升级到 `codex-mobile-shell-v377`。
- 中文说明：v376 修正嵌入态/移动端前台恢复后，已完成线程沿用内存里的旧详情而不拉取最终回执的问题。`resumeMobileSession()` 现在只在启动阶段跳过网络恢复；已有当前线程恢复可见时会始终触发一次轻量 detail refresh，运行中线程仍用 250ms 合并刷新，completed/idle 线程直接读取最新详情，避免最终回执或 Usage 已在服务端存在但第一次进入仍看不到。PWA shell cache 升级到 `codex-mobile-shell-v376`。
- 中文说明：server-only 修正已完成线程首次打开最终回执先出现又被较旧投影覆盖、退出再进才稳定的问题。线程详情压缩/投影/raw/turns-list 路径现在会从同一 bounded rollout enrichment 数据里读取 `task_complete.last_agent_message`；如果 completed turn 里已有中间 `agentMessage` 但没有匹配 rollout 最终文本的 `agentMessage`/`plan`，就补一个 synthetic 最终回执，再继续附加已有 Usage 摘要。已有匹配回执不会被覆盖，失败/取消/中断/运行中 turn 不补。本次不改变 PWA shell cache。
- 中文说明：server-only 二次修正后台 turn 已经启动但线程列表/详情摘要又被 `idle` 覆盖的问题。Mobile Web 自己发起的 `turn/start` 成功返回后，现在会记录 bounded 服务端 active overlay，并把它统一应用到 `/api/threads` 和 `/api/threads/:id` 的状态合成；后续 state-db/app-server 暂时返回 `idle` 时不会洗掉运行标志。overlay 会在收到 `turn/completed`、rollout 尾部出现 `task_complete`，或 TTL 到期时清理。仍会广播轻量 `thread/status/changed active`，覆盖普通消息、source-direct/自动任务卡注入、auto-recover、side-chat apply、continuation handoff/bootstrap 和新线程首 turn。本次不改变 PWA shell cache。
- 中文说明：v375 缓解大线程打开期间的后台列表补拉卡顿。线程列表首屏仍可用 `fallback=defer` 快速返回，但完整 fallback rollout 扫描不再 800ms 后立即启动；前端现在把它作为可取消、可推迟的后台任务，等待线程详情首屏稳定、没有列表请求在跑、且没有 workspace/search 过滤时再补拉。这样 Music 这类 200MB rollout 线程在服务重启后不会因为后台列表恢复马上扫大文件而拖慢首屏。PWA shell cache 升级到 `codex-mobile-shell-v375`。
- 中文说明：v374 修正首次打开已完成线程时 Usage 卡片可能缺失、退出再进才出现的问题。线程详情首屏如果命中较旧投影缓存，且最新 completed turn 已有最终回执但还没有 Usage，前端现在会立即启动已有的 bounded Usage backfill 刷新；后台刷新拿到 `turnUsageSummary` 后会在当前页面补出 Usage，不再依赖重新进入线程。PWA shell cache 升级到 `codex-mobile-shell-v374`。
- 中文说明：历史说明：曾经为防止动态工具或 fallback 脚本把任务卡发到旧线程/隐藏线程，source-thread 任务卡目标校验把同一 cwd/workspace 收敛到最新可见 canonical 线程。该规则已被后续同工作区多线程修正收窄；当前规则是 exact `targetThreadId` / `targetThreadTitle` 按线程身份投递，归档/删除/隐藏/子代理目标仍会被拒绝。
- 中文说明：server-only 修正 `codex_mobile.delegate_to_thread` 动态工具响应仍被 app-server 判为无效的问题。mux 真实错误显示当前 app-server 需要 `result.success` 和 camelCase `result.contentItems[{ type:"inputText" }]`，不是 `content_items/input_text`；错误响应会返回 `success:false`。任务卡幂等 seed 继续使用显式 requestId 或 source/target/title/body/workflow 语义字段，避免模型重试重复发卡。本次不改变 PWA shell cache。
- 中文说明：server-only 修正 `跨工作区委派` 写保护没有覆盖直接工具调用的问题。开启后，普通插件线程默认使用真实 `workspace-write`/managed profile 和 `approvalPolicy:on-request`，并把当前 `.git` 同时加入 sandbox writable roots，确保当前工作区源码、当前 `.git`、读取、MCP 和网络继续可用；如果 app-server 对当前 `.git` 或普通读写发出审批，Mobile Web 会自动允许；如果尝试 `apply_patch`、文件变更、写类 shell 或写类文件系统授权到其他已知源码根，会自动拒绝。Home AI 中央控制平面提供的 AI Ops、平台检查、视觉核验和 `deploy:macos` 脚本被识别为官方工具命令，可以从插件线程调用；但直接修改、提交 Home AI 源码仍会被拦截。旧的 `danger-full-access` approval-proxy-only 兼容模式仅在显式设置 `CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY=1` 时启用。本次不改变 PWA shell cache。
- 中文说明：v373 修正 Profile 切换到目标账号时，额度接口临时失败会让切换进度消失并停住的问题。目标 app-server 初始化成功后，`account/rateLimits/read` 的网络/服务端临时失败会降级为警告继续切换，只有明确的 401/token 失效才阻止切换；失败响应会把 requestId/progress 带回前端，Profile 行会保留“切换失败：原因”和失败阶段，不再几秒后清空。PWA shell cache 升级到 `codex-mobile-shell-v373`。
- 中文说明：v372 修正 Profile 切换过程只有“预检中”而缺少后续状态的问题。前端会为每次切换生成 requestId，并轮询服务端真实阶段，逐步显示读取目标 Profile、同步工作区信任、注册 Codex Mobile 工具、启动/连接目标 app-server、初始化会话、读取额度、写入 active Profile、安排重启和等待服务恢复。macOS 宿主恢复脚本也补齐 `CODEX_MOBILE_MUX_ENDPOINT_FILE` 同步、bootstrap code 5 重试、preflight/postflight 一致性检查和非选中 profile stale mux 报告。PWA shell cache 升级到 `codex-mobile-shell-v372`。
- 中文说明：server-only 增加 Codex 线程自己的 `codex_mobile` MCP toolset。服务端启动、读取 Profile 列表、工作区创建和 Profile 切换时会自动检查所有已知/目标 `CODEX_HOME/config.toml`，没有 `[mcp_servers.codex_mobile]` 或配置指向旧脚本时就注册/修正 `scripts/codex-mobile-mcp-server.js`；该工具集提供 `list_threads` 和 `delegate_to_thread`，后者复用现有任务卡 API 发 source-direct 卡。注册器同时写入两个工具的 `approval_mode = "approve"`，避免只读列表和受运行时开关约束的发卡工具被 Codex MCP 权限层重复弹窗。配置只保存脚本路径、server URL 和 key-file 路径，不保存 raw key。本次不改变 PWA shell cache。
- 中文说明：server-only 给 `跨工作区委派` 增加 bounded 诊断日志。开启后 `thread/start` / `turn/start` / `thread/resume` 出站 RPC 会记录是否带有 `codex_mobile.delegate_to_thread`、动态工具数量、fallback 指令是否存在，以及 sandbox/approval 概要；`item/tool/call` 回调会记录工具名、target 引用数量、是否有 body 和 outcome。日志不记录用户正文、完整 developer instructions、访问 key 或完整任务卡内容，用于区分“没有注入”“app-server 没暴露”和“模型未调用/调用失败”。本次不改变 PWA shell cache。
- 中文说明：v370 修正线程详情页活跃回执被较旧 V4 投影快照覆盖的问题。客户端现在会对 V4 refresh 做单调合并：同一 turn 保留更完整的可见回执，旧 revision 不再把当前 live turn 覆盖成历史内容，同时 durable 用户消息仍会清理本地 pending echo。PWA shell cache 升级到 `codex-mobile-shell-v370`。
- 中文说明：server-only 给 `跨工作区委派` 增加模型可见脚本 fallback。开启后 `thread/start` / `turn/start` 除了注入 `codex_mobile.delegate_to_thread`，还会在开发者指令里写明：如果动态工具不可见或不可发现，源线程必须运行 `scripts/create-thread-task-card.js` 创建任务卡；`multi_agent_v1.*` 不是 Codex Mobile 任务卡 API，不能替代跨工作区发卡。本次不改变 PWA shell cache。
- 中文说明：server-only 明确 `跨工作区委派` 的失败后恢复边界。开启后模型如果已经误尝试目标工作区写入/命令/部署并遇到 sandbox、permission denied、operation not permitted、cwd 或 approval-policy 失败，动态工具说明会要求源线程模型结合当前上下文自行决定并调用 `codex_mobile.delegate_to_thread`；服务端不会从失败日志后台代发任务卡，避免丢失原线程上下文和意图。本次不改变 PWA shell cache。
- 中文说明：历史说明：曾给 `跨工作区委派` 的运行时写入守卫增加受控维护豁免。当时普通插件线程会被收敛到当前 cwd 的 `workspace-write` / `approvalPolicy=never`；该默认实现后来因为会误伤当前工作区 `.git` 写入，短暂被“默认全权限 + 动态源码写保护”取代。当前默认已回到真实 sandbox，但改为 `approvalPolicy:on-request`，由 Mobile Web 自动允许当前工作区 `.git` 许可并拒绝外部源码写入。
- 中文说明：历史说明：曾给 `跨工作区委派` 增加基于 approval proxy 的动态源码写保护。该版本只能拦截 app-server 审批请求，拦不住 `danger-full-access` 下的直接 `apply_patch` / shell 工具调用；当前版本改为默认真实 sandbox，approval proxy 只负责自动决策当前 `.git`、官方工具和外部源码写入审批。
- 中文说明：server-only 收紧 `跨工作区委派` 的模型可见工具说明和审批语义。开关开启后，`codex_mobile.delegate_to_thread` 的描述明确要求：如果用户请求的实现、文件修改、命令、测试、部署或其他状态变更属于另一个工作区/线程，模型必须先调用该工具创建任务卡，不得在当前线程里直接 `cd`、读写、打补丁、运行命令或部署目标工作区。该动态工具路径固定创建 source-direct 卡，不允许模型把自由委派卡发成 Pending；Pending 仍保留给手动/API/MCP 等显式审批路径。仍保持“由模型判断是否跨工作区”，不恢复本地关键词/路径启发式预检。本次不改变 PWA shell cache。
- 中文说明：v369 修正 Android 折叠屏/嵌入态线程详情右上角运行状态框计时被裁剪的问题。`turn-timer` 不再用固定宽度压缩内部内容，计时段 `本轮 00:00:00` 改为不可收缩并保留完整显示，活动状态文字（思考/命令/输入等）在剩余空间内省略，避免秒个位被遮挡。PWA shell cache 升级到 `codex-mobile-shell-v369`。
- 中文说明：v368 修正 Android APK/WebView 下 Composer 首次点击偶发不弹系统输入法、第二次点击后键盘虽出现但文字不上屏的问题。Codex Composer 仍使用 `contenteditable`，但 Android 上不再在 `pointerup/click` 后程序化 blur/refocus 抢 IME；如果发现输入框已假聚焦但键盘未打开，会在下一次 `pointerdown` 用户手势开始时先释放旧焦点，再交给 WebView 原生 tap 建立 editor connection。同时收窄 disabled 状态下保留 `contenteditable=true` 的条件，避免留下可编辑但 `aria-disabled/tabIndex` 冲突的混合状态。PWA shell cache 升级到 `codex-mobile-shell-v368`。
- 中文说明：server-only 修复运行中线程投影回执被裁剪的问题。当最后一个 live turn 只是空壳，而前一个正在产出内容的 turn 尚未标记 completed 时，服务端会把这个有可见内容的 turn 也作为详细 turn 保留，避免只显示最后一条 assistant 回执、前面的中间回执被刷新掉。本次不改变 PWA shell cache。
- 中文说明：v367 缓解进入线程时首屏加载变慢的问题。线程详情正在打开时，后台静默线程列表刷新会临时使用 `fallback=defer`，不再和详情首屏同时抢 state DB / rollout fallback 扫描；线程列表 fallback cache 默认从 5 秒延长到 30 秒，减少活跃使用中反复冷扫 rollout 的概率。启动后的完整列表补拉仍保留，历史/fallback 线程不会因此丢失。PWA shell cache 升级到 `codex-mobile-shell-v367`。
- 中文说明：server-only 给已开启 `跨工作区委派` 的 Codex 线程注入 app-server dynamic tool `codex_mobile.delegate_to_thread`。模型在判断当前请求需要另一个工作区/线程处理时，可以显式调用这个工具，服务端复用 `/api/threads/:sourceThreadId/task-cards` 创建任务卡；开关关闭时完全不注入。该 dynamic tool 本身不是 MCP；后续版本另行补充了标准 `codex_mobile` MCP toolset。本次不改变 PWA shell cache。
- 中文说明：v366 把跨工作区模型/工具委派开关补到设置面板里。入口是左侧菜单齿轮 -> `跨工作区委派`，默认关闭；切换会写入运行时 `settings.json` 并立即生效，无需修改环境变量或重启。关闭时 `/api/threads/:sourceThreadId/task-cards` 只创建 pending 任务卡；开启后模型/工具显式发卡才允许源线程直批并启动目标线程。普通发送前本地关键词/目录名预检仍保持关闭。PWA shell cache 升级到 `codex-mobile-shell-v366`。
- 中文说明：v365 为跨工作区模型/工具委派增加服务端开关，默认关闭。只有设置 `CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION=1`（或兼容别名 `CODEX_MOBILE_WORKSPACE_DELEGATION_ENABLED=1`）后，`/api/threads/:sourceThreadId/task-cards` 才会执行源线程直批并启动目标线程；默认关闭时同一路径只创建 pending 任务卡，需要目标线程审批。普通发送前本地关键词/目录名预检仍保持关闭。PWA shell cache 升级到 `codex-mobile-shell-v365`。
- 中文说明：v364 禁用 v363 普通发送前的本地跨工作区启发式委派。`/api/threads/:sourceThreadId/workspace-delegation` 保留为兼容接口但只返回禁用/未委派状态，不会再根据目录名、线程标题或关键词自动发卡；跨工作区任务必须由模型输出结构化任务卡，或由线程/工具显式调用 `/api/threads/:sourceThreadId/task-cards` / `scripts/create-thread-task-card.js`。PWA shell cache 升级到 `codex-mobile-shell-v364`。
- 中文说明：v363 曾新增跨工作区自动委派策略，普通发送前会用本地规则判断目标线程并自动发卡；该行为已被 v364 禁用，保留为历史说明。
- 中文说明：server-only 增加 macOS 宿主恢复脚本 `restart-codex-mobile-host-macos.sh`。宿主在检测到 Codex Mobile Web 8787 Listener 未启动时，可以先用 `--list-homes --json` 读取已配置 Codex Home，再用 `--profile-id <id>` 或 `--codex-home <path>` 选择目标 Home，脚本会同步 `codex-profiles.json` 与 LaunchDaemon plist 的 `CODEX_HOME`，重新 bootstrap `com.hermesmobile.plugin.codex-mobile`，并等待 `/api/public-config` 恢复。同时修正 Web 内手动 Restart 在 macOS system LaunchDaemon 下错误使用 GUI launchctl 域的问题。本次不改变 PWA shell cache。
- 中文说明：v362 修正 Android APK/WebView 壳里 Composer 首次点按偶发不弹系统输入法、再次点按后键盘出现但文本不上屏的问题。Composer 现在不再在 `pointerdown` 阶段提前 blur 打断原生输入激活；只在后续 `pointerup/click` 用户手势里检测到“已聚焦但键盘未打开”的 stale focus 时，才允许 Android 做一次受控 blur/refocus 恢复。PWA shell cache 升级到 `codex-mobile-shell-v362`。
- 中文说明：v361 修正 v360 在 Android APK/WebView 壳里仍可能点加号无反应的问题。附件入口改为视觉按钮和原生 `input[type=file]` 覆盖在同一个 52px 触控单元内，触屏直接命中浏览器原生文件输入控件；按钮保留键盘 fallback。PWA shell cache 升级到 `codex-mobile-shell-v361`。
- 中文说明：v360 修正 Android APK/WebView Composer 左侧加号附件按钮命中不稳定的问题。加号现在是明确的 52px 按钮单元，图标子元素不再接管事件；文件选择器只从浏览器认可的 `click` / 键盘确认事件打开，不再在 `pointerdown` 里抢先触发后节流掉后续点击。PWA shell cache 升级到 `codex-mobile-shell-v360`。
- 中文说明：v359 修正 Android WebView Composer 首次点击未弹键盘后的恢复路径。如果输入框已经假聚焦但键盘仍未出现，下一次真实点击会先释放旧焦点，再交给浏览器原生点击重新建立 IME editor connection；不会再程序化 blur/refocus 抢焦点。PWA shell cache 升级到 `codex-mobile-shell-v359`。
- 中文说明：v358 收窄侧边聊天/Subagent 面板的左滑呼出手势。现在只有从对话区域右侧边缘附近开始左滑才会打开侧边面板，页面中部横向滑动或触控板横滑不会误触；关闭按钮、侧聊加载和服务器保存逻辑保持不变。PWA shell cache 升级到 `codex-mobile-shell-v358`。
- 中文说明：v357 修复 Android APK/WebView 壳里 Composer 左侧加号无法选中的问题。附件入口从 `label + input[type=file]` 改为真实 `button` 显式触发隐藏文件输入，并补齐 `pointerup` / `click` / `touchend` 去重路径，避免 Android WebView 对 label 激活文件选择器兼容不稳定。PWA shell cache 升级到 `codex-mobile-shell-v357`。
- 中文说明：v356 修复 Android Composer 进入线程后首次点击偶发不弹输入法、第二次点击键盘弹出但中文无法上屏的问题。Android 上不再用 blur/refocus 恢复键盘；已进入线程或新线程草稿时，即使线程仍在加载或发送中，也保持底层 contenteditable editor 不被拆掉，只用 aria/class/tabIndex 和发送状态表达禁用，避免破坏 WebView/Chrome 的 IME editor connection。PWA shell cache 升级到 `codex-mobile-shell-v356`。
- 中文说明：v355 修复 Android Composer 第二次点击后键盘弹出但中文输入无法上屏的问题。Android 上不再用 blur/refocus 恢复键盘，避免破坏 WebView/Chrome 的 IME editor connection；点击开始前只确保 Composer 已经是可编辑状态，并让浏览器原生点击流程自己打开键盘。PWA shell cache 升级到 `codex-mobile-shell-v355`。
- 中文说明：v354 修复 Composer 运行时选择被线程刷新打回默认的问题。当前线程没有文字草稿时，详情重载不再清空已经选择的 Model / 推理等级 / 权限；Fast 开关也会进入 Composer draft 内容判定，避免仅打开 Fast 但未输入文字时被当作空草稿丢弃。PWA shell cache 升级到 `codex-mobile-shell-v354`。
- 中文说明：v353 修复 Android/WebView Composer 首次点击未弹出系统输入法后焦点锁死的问题。输入框点击开始时不再程序化抢焦点，而是先让浏览器原生点击流程打开键盘；如果第二次点击发现 Composer 已聚焦但键盘仍未打开，才在该用户手势内 blur/refocus 恢复输入法。PWA shell cache 升级到 `codex-mobile-shell-v353`。
- 中文说明：v352 修复三处移动端工作流问题：Public PR 检查会忽略 GitHub draft PR，只有 ready/open PR 才提示合并；Mac 生产运行路径不在开发 checkout 时，新建 Workspace 仍会优先使用存在的 `/Users/hermes-dev/HermesMobileDev` 开发根；Android/嵌入态 Composer 点击和 Home AI 语音输入插入会先恢复可编辑状态并稳定聚焦到 Composer。PWA shell cache 升级到 `codex-mobile-shell-v352`。
- 中文说明：v351 修正 Home AI 嵌入态左右分屏下线程详情返回箭头的判定来源。嵌入态不再用 Codex Mobile 自己的线程列表 sidebar 判断，而是使用 Home AI 发送的 `hermes.plugin.viewport` 里的 iframe/host rect：只有 iframe 明确处在宿主右侧分屏区域时才显示返回箭头；独立版和 Codex 自身分屏行为保持原规则。PWA shell cache 升级到 `codex-mobile-shell-v351`。
- 中文说明：v350 缓解 Android WebView/Chrome 使用豆包等中文输入法时 Composer 看似有焦点但不上字的问题。主输入框仍保持 `contenteditable`，但 disabled 状态更新改为幂等，输入法组词期间不再反复重写 `contentEditable`，并且 composing 状态下 Enter 不触发发送，避免第三方 IME 的 editor connection 被打断。PWA shell cache 升级到 `codex-mobile-shell-v350`。
- 中文说明：v349 修复 v348 在真实浏览器/WebView 中宽屏线程详情返回箭头仍可能不显示的问题。分屏判定现在使用左侧线程列表的实际尺寸、position、visibility 和 identity transform 共同判断，并给返回按钮添加显式 `split-return-visible` 状态；只有实际存在 Codex Mobile 左侧分屏时才显示返回箭头，没有左分屏时仍保持隐藏。PWA shell cache 升级到 `codex-mobile-shell-v349`。
- 中文说明：v348 修正 v347 在无插件左分屏时也显示返回箭头的问题。返回箭头只在实际检测到 Codex Mobile 自己的左侧线程列表为分屏可见时显示；Home AI 嵌入态没有插件左分屏时继续隐藏左上角按钮。PWA shell cache 升级到 `codex-mobile-shell-v348`。
- 中文说明：v347 修复 Home AI 嵌入态线程详情左上角返回箭头被旧 `embed-hermes #openMenu` 隐藏规则压掉的问题。线程详情态会覆盖该隐藏规则并显示返回箭头；主页面仍隐藏该按钮。PWA shell cache 升级到 `codex-mobile-shell-v347`。
- 中文说明：v346 修复宽屏或横屏分屏下线程详情无法回到线程列表的问题。当左侧线程列表和右侧线程详情同时显示时，左上角会恢复返回箭头，点击后回到线程列表视图；手机窄屏仍保持原来的菜单按钮行为。PWA shell cache 升级到 `codex-mobile-shell-v346`。
Codex Mobile Web is a local web client for reading and controlling Codex sessions from a phone or another browser on the same network. It talks to `codex app-server`, reads local Codex state, and exposes a compact mobile UI with message sending, image/file uploads, model/effort read-only display, quota display, live operation cards, and turn timing.

This repository does not contain Codex credentials, uploaded files, or a bundled Codex binary. Those are local runtime state on each machine.

- 中文说明：v345 修复 Home AI 嵌入态 Codex 系统/助手图片输出仍停留白占位图的问题。嵌入 Home AI 时，上传图、生成图和文件预览图都通过已鉴权的同源代理 URL 直接渲染，不再只对用户上传图绕过透明占位图 hydration；独立访问仍保留受保护图片 hydration 兜底。PWA shell cache 升级到 `codex-mobile-shell-v345`。
- 中文说明：v344 继续修正移动端左下角 Fast 按钮难点中的问题。Fast 按钮真实触控区从 28px 扩到 40px/42px，并补齐 pointer、click、touchend 三路去重兜底；Composer 控件区域继续优先于侧栏边缘手势，避免 Android WebView 和 iPhone 只能点到角落的问题。PWA shell cache 升级到 `codex-mobile-shell-v344`。
- 中文说明：v343 修正移动端左下角 Fast 按钮难点中的问题。左侧边栏边缘滑动在 Composer 底部区域不再启动，Android 侧边栏手势起点也从 84px 收窄到 44px，避免 Fast 按钮和 Composer 控件被侧栏手势抢占；正文和列表左缘仍可用手势打开侧栏。PWA shell cache 升级到 `codex-mobile-shell-v343`。
- 中文说明：v342 修正 Mobile 新建 Workspace 的默认父目录。未显式配置时，Mac 开发/生产仓库会优先使用当前仓库所在的 `HermesMobileDev` 开发根，不再默认落到用户 `Documents`；也可以用 `CODEX_MOBILE_WORKSPACE_DEFAULT_CREATE_ROOT` 指定默认父目录，用 `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS` 限定可选父目录。创建对话框会在有多个允许父目录时显示选择框。PWA shell cache 升级到 `codex-mobile-shell-v342`。
- 中文说明：v341 收窄自动续接，避免普通 reconnect/resume、前后台切换或短暂 app-server 状态抖动时自动向 running 线程注入“继续当前任务”用户消息。现在自动续接只使用手动 Restart 前保存的 running sessions 风险列表；未经过 Restart 保护流程的普通连接恢复只刷新页面状态，不再主动发继续提示。PWA shell cache 升级到 `codex-mobile-shell-v341`。
- 中文说明：v337 修复 Home AI 嵌入态 Codex 用户上传图片在白占位图和真实图之间反复闪烁的问题。嵌入 Home AI 时，上传图片通过已鉴权的同源代理 URL 直接渲染，不再先输出透明占位图再异步 hydration；独立 iOS/WebKit 访问仍保留原来的受保护图片 hydration 兜底。PWA shell cache 升级到 `codex-mobile-shell-v337`。
- 中文说明：v336 恢复线程详情默认 V4 投影，并关闭 v333-v335 临时图片诊断客户端日志。受保护图片的占位图加 hydration 显示机制保留，但不再向 `/api/client-events` 上报 `image_*` / `image_hydrate_*` 事件。PWA shell cache 升级到 `codex-mobile-shell-v336`。
- 中文说明：v335 继续修复 iOS/WebKit 上传图片发送后无反应、重进后只看到“图片无法加载”的问题。上传/生成/文件预览这类受保护图片不再把 `/api/uploads/file?...key=...` 直接放进 `<img src>`；前端先渲染本页透明占位图，把真实地址放在 `data-protected-image-src`，随后用当前会话鉴权 fetch 转成 `data:image/...` 或 `blob:` 再显示，避免 Safari 直接处理带鉴权 query 的图片 URL。客户端诊断事件也改为优先 `fetch keepalive` 上报，减少 iOS 上 `sendBeacon` 丢 JSON 日志的问题。PWA shell cache 升级到 `codex-mobile-shell-v335`。
- 中文说明：raw thread 读取模式已恢复为显式诊断开关。默认线程详情重新走 V4 投影；只有设置 `CODEX_MOBILE_THREAD_DETAIL_RAW_ALL=1`、`true`、`yes` 或 `on` 时才绕过 V4/V3，直接读取完整 `thread/read` 原始 turns。
- 中文说明：v334 主动修复 iOS/WebKit 上传图片黑框。对受保护的上传/生成/文件预览图片，客户端在渲染后会主动用当前会话鉴权 fetch 图片并转成本页 `data:image/...` 或 `blob:` URL 再赋给 `<img>`，而不是等 Safari 对 `/api/uploads/file?...key=...` 触发 `error` 后才恢复；这样可以绕开 iPhone 上带鉴权 query 图片加载后变黑或无法显示的问题。诊断日志继续记录 `image_hydrate_*` bounded 事件。PWA shell cache 升级到 `codex-mobile-shell-v334`。
- 中文说明：v333 增加移动端上传图片渲染诊断日志。客户端会通过 `/api/client-events` 上报 `image_load`、`image_error`、`image_recovery_start`、`image_recovery_response`、`image_recovery_apply` 等 bounded 事件，记录客户端壳版本、readMode、图片来源类型、source hash、naturalWidth/naturalHeight、恢复 HTTP 状态等；不会记录 Access Key、完整本地路径或图片内容。PWA shell cache 升级到 `codex-mobile-shell-v333`。
- 中文说明：v332 修复 raw thread 诊断模式在移动端无法打开的问题。服务端仍然直接读取原始 `thread/read`，不走 V4/V3 投影；前端在 `thread-read-raw` 模式下限制首屏 turn 数和单 turn 可见 item 数，保留用户消息、图片、Usage、上下文压缩提示和尾部少量文本，避免一次渲染数千个原始内部 item 导致页面卡死。PWA shell cache 升级到 `codex-mobile-shell-v332`。
- 中文说明：v331 启用线程详情投影 v4。服务端新增 `thread-visible-item-normalizer` 和 `thread-detail-projection-v4-service`，把用户消息、图片、回执、Usage 和历史上下文压缩提示统一成带稳定 `mobileVisibleKey` 的可见项；前端在 v4 刷新时只叠加当前会话的 pending 用户消息，直到服务端 durable 消息匹配或发送失败，避免发送内容和回执在已打开线程里被刷新吞掉。旧 v3 投影仍可通过 `CODEX_MOBILE_THREAD_DETAIL_PROJECTION_V4=0` 回退。PWA shell cache 升级到 `codex-mobile-shell-v331`。
- 中文说明：v330 继续修复 iPhone/iOS WebKit 上传图片恢复后显示黑框或原生破图 icon 的问题。v329 已经把受保护图片从 `/api/uploads/file` 拉回本页 `blob:`，但 iPhone 上仍可能无法绘制该 blob JPEG；现在图片恢复优先把探测成功的 image blob 转成 `data:image/...` URL，并在 `<img>` 上保留原始 `data-protected-image-src`，即使恢复后的 data/blob 再次失败，也能回到原始受保护上传地址重新探测。没有 FileReader 或图片过大时仍回退到 blob/cache-buster。PWA shell cache 升级到 `codex-mobile-shell-v330`。
- 中文说明：v329 针对 iPhone/iOS WebKit 下用户上传图片在回复追加后长期停留“图片无法加载”的问题做二次修复。受保护的 `/api/uploads/file`、`/api/generated-images/file` 和 `/api/files/preview/content` 图片如果触发 `error` 或被扫描到零尺寸，会先用当前会话 key 拉取真实图片；拉取成功后优先转成本页 `blob:` URL 给 `<img>` 渲染，避免 iOS 对带鉴权 query 的图片重载不稳定。没有 blob 能力时仍保留 v328 的 cache-buster 重试兜底；上传/生成图片默认改为 eager 加载，扫描器不再把受保护图片直接切到失败占位。PWA shell cache 升级到 `codex-mobile-shell-v329`。
- 中文说明：v328 修复 live 回复追加时上传图片被临时 `error` 事件误切到“图片无法加载”的问题。受保护的 `/api/uploads/file`、`/api/generated-images/file` 和 `/api/files/preview/content` 图片现在收到浏览器 `error` 后会先用当前会话 key 探测真实地址；探测 200 时清除失败态并带 cache-buster 重试图片 src，只有探测失败或 401/403 才显示失败占位或请求宿主刷新。探测期间只隐藏浏览器破图 icon，不显示“图片无法加载”。PWA shell cache 升级到 `codex-mobile-shell-v328`。
- 中文说明：v327 修复运行中发送图片时本地 pending echo 可能残留破图的问题。发送图片时本地乐观消息只知道原始文件名和 `blob:` 预览，服务端持久消息会保存为 `.codex-mobile-web/uploads/...-原始文件名`；此前服务器 pending echo 比较要求完整内容一致，可能无法识别“文件名”和“持久上传路径”属于同一张图，导致 live 会话里继续显示本地破图框，刷新重进后才正常。现在 pending echo 会按附件摘要、上传路径和文件名后缀匹配，同名持久上传消息出现后会移除本地 echo，并保留受保护的 `/api/uploads/file` 图片显示。PWA shell cache 升级到 `codex-mobile-shell-v327`；该修复包含服务器逻辑，更新后需要重启 8787 listener。
- 中文说明：v326 修复平板/移动浏览器上历史上传图片被误判为“图片无法加载”的问题。此前前端失败扫描会把 `complete=true` 且 `naturalWidth=0` 的图片主动标记为失败；部分 Android 平板或移动浏览器会对还没进入视口的 `loading="lazy"` 图片呈现这个状态，导致实际可访问的上传图在滚动回来前已经被隐藏。现在只有真实 `error` 事件或非 lazy 破图才会标失败，lazy 图片未加载时会清理旧误判失败态。PWA shell cache 升级到 `codex-mobile-shell-v326`。
- 中文说明：v325 在 v324 的上传图片回显和 Music 状态框修复基础上，给会话里的上传图片、Markdown 图片和工具生成图片卡增加稳定的默认显示比例。历史图片在 lazy-load 前不再只占一行 caption 高度，加载完成后仍用 `object-fit: contain` 等比显示，减少滚动到底部时因上方旧图补加载造成的页面抖动。PWA shell cache 升级到 `codex-mobile-shell-v325`。
- 中文说明：v324 修复两个前端投影问题。第一，上传图片在运行中页面里可能被重复显示：v323 已经让 superseded live turn 中的图片用户消息保留下来，但当前浏览器会话里较晚的 optimistic/pending 图片 echo 仍可能被局部刷新保留，导致同一张图一会消失、一会又以用户消息出现在底部；现在当前端发现 durable 用户图片消息和较晚 optimistic 图片 echo 指向同一张上传图时，会清掉该 echo，普通文字重复消息仍保持原保护规则。第二，像 Music 这种最新 active turn 为空 `itemsView=notLoaded` 的线程，正文仍不渲染空 turn，但右上角运行状态框和 Stop 会把这个空 active tail 当作运行候选显示。PWA shell cache 升级到 `codex-mobile-shell-v324`。
- 中文说明：v323 修复 superseded live turn 中纯图片用户消息被投影剪裁的问题。此前为避免旧 steering 用户气泡反复出现在底部，服务端和前端都会隐藏 superseded/live 里的部分 `userMessage`；现在带 `Uploaded attachments` 图片摘要、上传路径或 `input_image` 的用户消息会保留并渲染成上传图片缩略图，普通旧文字 steering 仍继续隐藏。PWA shell cache 升级到 `codex-mobile-shell-v323`，该服务端投影修复需要重启 8787 listener 后生效。
- 中文说明：v322 增加上传图片显示失败后的前端自恢复。线程图片如果曾被浏览器 error 事件标记为“图片无法加载”，后续真实上传地址或新鉴权地址加载成功时会在 `load` 事件和失败扫描中移除失败状态，避免局部 patch 复用 DOM 后继续显示旧的失败占位。PWA shell cache 升级到 `codex-mobile-shell-v322`。
- 中文说明：v321 修复 v320 发送图片后本地预览仍可能在 5-6 秒后变成“图片无法加载”的问题。发送成功清空 Composer 附件时不再立即 revoke 仍被本地 pending 消息气泡引用的 `blob:` 预览，而是延迟释放；删除/替换未发送附件仍立即释放。这样在服务端 durable 投影接管前，本地图片预览不会被提前破坏。PWA shell cache 升级到 `codex-mobile-shell-v321`。
- 中文说明：v320 修复 v319 发送图片后“瞬间能看到预览，几秒后又变成图片无法加载”的问题。前端本地 pending 消息中的 `blob:` 预览现在会在服务端 durable 用户消息回来时被真实上传路径内容替换，避免发送成功后继续渲染已撤销的本地 object URL；上传图片仍通过受保护的 `/api/uploads/file` 鉴权地址显示。PWA shell cache 升级到 `codex-mobile-shell-v320`。
- 中文说明：v319 修复 v318 现有线程发送图片后本地 pending 气泡只显示文件名、不能立即预览的问题。本地 pending 用户消息现在会把浏览器 `blob:` 图片预览作为临时 `input_image` 一起渲染，服务端 durable 消息回来后再切换为受保护的 `/api/uploads/file` 地址。同时 live-poll/detail refresh 对最新 live turn 的已有回执优先只 patch 变化的 item，避免每隔几秒 patch 整个 turn article 导致回执区和 Composer 出现可见颤抖。PWA shell cache 升级到 `codex-mobile-shell-v319`。
- 中文说明：v318 修复已有线程发送新消息后出现长时间空窗的问题。提交后前端会立即插入本地 pending 用户消息和本地 active turn；如果线程详情仍在加载，页面会保留已可见内容并显示“正在加载最新线程状态...”，不会空白停在 Loading；右上角运行状态也会在缺少具体操作名时显示“运行”。PWA shell cache 升级到 `codex-mobile-shell-v318`，已打开的客户端需要接受刷新提示、硬刷新或关闭重开后才能拿到这次前端修复。
- 中文说明：v317 继续修复线程中间输出像整屏刷新。SSE 事件和轮询刷新都会先尝试局部更新：新增可见 item 优先在当前 turn 内插入，已有 item 继续局部 patch；command、file、tool 等 operational item 不再触发 conversation 重绘，只更新底部 Command dock。运行中 rollout 文件大小增长也不再单独触发 conversation 重绘。只有去重、顺序变化、item 删除、历史窗口或审批/任务卡等结构性变化才回退到整段详情渲染。PWA shell cache 升级到 `codex-mobile-shell-v317`。
- 中文说明：v316 修正 context-only stale active turn 对会话列表状态的污染。若 rollout 最新 turn 只有 `<environment_context>` / `turn_context` 且没有真实用户消息、助手输出或工具活动，超过短暂静默阈值后后端会把它降级为 idle 并标记 `mobileStaleActiveTurn`；前端清除 running spinner 时不会产生 unread dot。该修复已随 v317 public shell 一并发布。
- 中文说明：v316 缓解线程中间输出时的页面颤动。已有可见 item 的状态更新优先局部 patch 单个卡片，live-poll 如果合并后对话可见签名没有变化就跳过详情区重绘，只更新时间器/头部/滚动按钮；compact Command dock 固定为稳定高度，避免命令状态更新反复挤压 conversation 区域。PWA shell cache 升级到 `codex-mobile-shell-v316`。
- 中文说明：v315 修复已有会话发送新消息后线程列表 running spinner 仍需等待 `turn/started` 事件、detail refresh 或下一次列表刷新才出现的问题。普通发送路径现在会在本地提交后立即把当前会话和列表行标记为 active；如果发送失败，再恢复发送前状态。PWA shell cache 升级到 `codex-mobile-shell-v315`。
- 中文说明：server-only 修复 Home AI 审计卡/跨线程任务卡启动后台线程后，线程列表运行标志可能滞后的问题。任务卡批准并注入目标 turn 后，服务端会立即广播轻量 `thread/status/changed` active 摘要；收到后台 `turn/started` / `turn/completed` 时也会派生线程级状态摘要并清理线程列表 fallback cache。后台 turn 的正文、工具输出和 diff 仍只发给当前订阅线程。本次不改变 PWA shell cache，更新后需要重启 Node listener 才会生效。
- 中文说明：server-only 合并 public PR #75，避免用户上传图片被 agent 图卡重复展示。服务端读取 rollout tool output 图片时，会识别 `view_image` 调用指向 Codex Mobile 上传目录的文件，并跳过这类输出生成的 agent `imageView` 卡片；上传图片仍保留在用户消息的附件缩略图里，非上传目录的工具输出图片仍可生成 agent 图卡。同时 compacted 结构化文本中的内联 `data:image/...` 会被 bounded 占位符替换，避免把大段图片 data URL 写入线程响应。本次不改变 PWA shell cache，更新后需要重启 Node listener 才会生效。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。
- 中文说明：v314 修复打开已在运行的会话详情后，线程列表行可能继续显示旧状态、需要等下一次列表刷新才出现 running spinner 的问题。详情读取、cached open、live poll 和 full backfill 现在会立即把当前会话摘要同步回列表行。PWA shell cache 升级到 `codex-mobile-shell-v314`。
- 中文说明：v313 修复进入长线程时历史 `mobileSupersededLive` 壳 turn 里的旧用户消息反复出现在底部、并挤掉最近回执的问题。前端不再渲染 superseded live turn 中的旧 `userMessage`；服务端投影和 thread compact 会在截断前剪掉纯旧用户消息/Reasoning/Usage/命令壳，只保留带助手回执、图片或上下文提示的 superseded turn，并移除其中旧用户提问。PWA shell cache 升级到 `codex-mobile-shell-v313`。
- 中文说明：server-only 扩展 ChatGPT Pro MCP Connector，新增 `delegate_to_codex_thread` 工具，让 ChatGPT Pro 可以通过跨线程任务卡把工作交给 Codex 线程。默认模式是 `pending`，目标线程仍需要审批；`direct` 直发只在服务端显式设置 `CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS=1` 后可用。本次不改变 PWA shell cache。
- 中文说明：v312 修复 iOS 原生壳/PWA 下 Public PR、自动 PR 提示、更新检查、侧聊清空、任务卡片创建/回复等对话框可能不弹出的问题。前端剩余用户可触发的 `alert` / `confirm` / `prompt` 原生弹窗统一替换为页面内底部弹框，Profile 切换和归档确认也不再按模式回退到浏览器原生确认框。PWA shell cache 升级到 `codex-mobile-shell-v312`。
- 中文说明：server-only 合并 public PR #73，防止线程列表 stale 状态覆盖已知状态。线程列表合并和显示摘要缓存现在会保留已知 `completed` / `idle` / `live` 等有效状态，不会被较新的 `notLoaded` / unknown 行覆盖；当基础行仍是 unknown 时，仍可用 fallback 或缓存中的已知状态补齐。这样 app-server/thread-list、rollout fallback 与缓存摘要交错刷新时，不会把已结束或已知运行状态误退回 stale。本次不改变 PWA shell cache，更新后需要重启 Node listener 才会生效。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。
- 中文说明：v311 修复模型、推理强度和权限运行时菜单在 iOS PWA/WebView 下可能点不开的问题。运行时菜单和额度详情浮层现在与 `@` 意图菜单一样位于页面级 DOM，不再作为 Composer 表单控制行的子元素；触摸 `pointerdown` 后的合成 `click` 只会按同一按钮吞掉一次，避免同一次点击先打开又关闭菜单。PWA shell cache 升级到 `codex-mobile-shell-v311`。
- 中文说明：v310 在导航菜单现有版本按钮里直接显示当前客户端壳版本，例如 `v0.1.11 · 客户端 v310`。这个值来自浏览器实际加载的 `CLIENT_BUILD_ID`，用于区分服务端已更新但 PWA/WebView 仍停留在旧前端壳的情况；按钮仍保留原来的更新检查入口。PWA shell cache 升级到 `codex-mobile-shell-v310`。
- 中文说明：v309 修复 Reset 后 Composer 运行设置控件回退的问题。新线程和旧草稿的权限默认值现在优先使用服务端按 `config.toml` 推导的 `defaultPermissionMode`，当前 full-access 配置会显示并提交“完全访问权限”；在默认 full 的环境里，旧草稿里的 `custom` 会折算为 `full`。模型、推理和权限控件增加 click 兜底和受限菜单诊断事件，弹层按按钮与 `visualViewport` 定位，避免 iOS WebView/键盘状态下菜单不可见。PWA shell cache 升级到 `codex-mobile-shell-v309`。
- 中文说明：server-only 修复 Mobile 创建的 workspace 在切换 Codex Profile 后可能丢失 trusted project 的问题。服务启动、创建 workspace、切换目标 profile 前都会把 Mobile registry 里的工作区同步到目标 `config.toml` 的 `[projects."<cwd>"] trust_level = "trusted"`；同时修正 profile switch preflight 的 `CODEX_HOME` 覆盖顺序，确保预检真正使用目标 profile。本次不改变 PWA shell cache。
- 中文说明：v308 修复 completed 回执底部出现空白状态块的问题。当前端收到 `mobileSupersededLive` 的历史 live 空壳 turn 且其中只剩 `turnUsageSummary` 时，不再渲染 usage-only 的空回执区块；正常包含用户/助手正文的 completed turn 仍保留 usage summary。PWA shell cache 升级到 `codex-mobile-shell-v308`。
- 中文说明：v307 修正线程列表“正在工作/已停止”状态不同步。本地 running hint 现在会在列表拿到 `idle`、`completed`、`failed`、`cancelled`、`interrupted`、`stopped` 等已停止状态时立即清理，状态图标也不会再让旧 running hint 覆盖已停止行。PWA shell cache 升级到 `codex-mobile-shell-v307`。
- 中文说明：v306 缓解线程信息流和 Composer 输入时的细微抖动。视口、宿主安全区和 Composer 高度 CSS 变量现在会忽略 1px 级别的测量噪声，Composer 输入框自动增高不再在每次输入时先重置为 `auto` 再回写高度，从而减少 live 状态刷新和打字时的页面几像素跳动。PWA shell cache 升级到 `codex-mobile-shell-v306`。
- 中文说明：server-only 增加 ChatGPT Pro MCP Connector 首版。`POST /api/chatgpt-pro/mcp` 使用独立 bearer token，token 只从 `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN` 或 `CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE` 读取；工具只允许读取 bounded 线程/工作区/文档上下文，并把 PRD、review、goal、task-card draft 等产物写入 runtime root 的 `chatgpt-pro-planner`，不写源码、不执行 shell、不启动 Codex turn。本次不改变 PWA shell cache。
- 中文说明：v305 继续修复 `@` 意图菜单在 iOS/WebView 内不可见的问题。菜单 DOM 移到页面级 overlay，不再作为 Composer 子元素参与输入区布局；定位锚点改为 `#messageInput`，用 fixed 浮层贴在输入框上方并按输入框宽度限制，避免被 `.main` / Composer 容器的 overflow 或键盘候选栏裁剪。Send 分支也改用归一化后的裸 `@` 判断。PWA shell cache 升级到 `codex-mobile-shell-v305`。
- 中文说明：v304 修复 iOS/WebView 键盘下裸 `@` 不弹意图菜单的问题。`@` 触发现在会忽略输入法可能插入的零宽字符，并在 input/keyup/focus/compositionend 后异步复查；意图菜单也改为贴在 Composer 上方的绝对定位，不再依赖 visualViewport/fixed bottom 计算，避免被系统键盘或候选栏压到不可见区域。PWA shell cache 升级到 `codex-mobile-shell-v304`。
- 中文说明：v303 统一 Composer 的 `@` 意图入口。输入裸 `@` 会弹出可选菜单，选择 `@目标任务`、`@任务卡片`、`@自由协作` 或 `@ChatGPT Pro` 后只把标签放入 Composer；用户再按 Send/回车时，目标任务打开原 Goal 对话框，任务卡片/自由协作/ChatGPT Pro 打开带大 textarea 和保存草稿按钮的专用输入框。旧路径 `/g`、`#`、`#自由协作`、以及 `@ChatGPT Pro ...` 直接带正文发送仍保持兼容。PWA shell cache 升级到 `codex-mobile-shell-v303`。
- 中文说明：v302 增加独立版 `@ChatGPT Pro` 分析入口。Composer 文本包含 `@ChatGPT Pro` 时，Codex Mobile 不把这条内容发进当前工作线程，而是创建或复用专用 `ChatGPT Pro` 线程，并注入要求使用 Chrome/ChatGPT Pro 网页生成分析的 bounded prompt；输出目录固定在 runtime root 的 `outputs/chatgpt-pro`，不写入源码仓库。附件不会通过该入口转发，避免无意上传文件。PWA shell cache 升级到 `codex-mobile-shell-v302`。
- 中文说明：v301 修复 Profile 切换成功后顶部 `Service restarted. Tap to refresh.` 提示不消失的问题。重启/重连提示现在会在事件流或 `/api/status` 确认服务恢复后清理；如果用户手动点击提示且服务端 shell build 没有变化，会直接关闭提示和 Profile 的“重启中”状态，只有检测到真实新 build 时才继续执行 shell 刷新。PWA shell cache 升级到 `codex-mobile-shell-v301`。
- 中文说明：v300 修复 Home AI/iOS 嵌入态可能长期停留在旧 Codex Mobile shell 的问题。启动时如果 iframe 内旧客户端发现服务端 `clientBuildId` 已更新，会立即向宿主发送 `refresh_required`，请求宿主刷新插件页，而不是只在 iframe 内显示刷新提示或等待后续周期检查。PWA shell cache 升级到 `codex-mobile-shell-v300`。
- 中文说明：v299 修正 v297 冷启动快速列表带来的线程名短暂回退问题。`fallback=defer` 首屏仍跳过昂贵的 state DB / rollout fallback 扫描，但会先用 `session_index.jsonl` 做轻量标题水合，让压缩续接线程和手动改名线程在首屏直接显示正式名称，不再先闪最初标题再过一两秒刷新回来。PWA shell cache 升级到 `codex-mobile-shell-v299`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v298 修正 Home AI/iOS 原生壳内 Codex 归档确认和压缩续接后的旧线程隐藏。手动归档在 Hermes embedded WebView 中改用 iframe 内确认框，不再依赖不稳定的原生 `window.confirm()`；压缩续接成功后如果底层 app-server `thread/archive` RPC 失败，服务端会把源线程写入 Mobile 本地归档索引，让旧线程仍从 Codex Mobile 列表隐藏。PWA shell cache 升级到 `codex-mobile-shell-v298`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v297 优化 Codex Mobile 冷启动线程列表首屏速度。启动阶段首个线程列表请求会带 `fallback=defer`，服务端先返回 app-server 的快速列表并标记 `mobileDeferredFallback`，避免同步扫描 rollout/state DB fallback 把首屏拖到 1-2 秒；前端随后静默补拉一次完整列表，继续保留历史线程/fallback 合并能力。PWA shell cache 升级到 `codex-mobile-shell-v297`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v296 降低独立 Codex Mobile 和嵌入态页面恢复时的视觉抖动风险。移动端 resume/focus/pageshow 不再连续多次触发 heavy repaint，普通 focus/resize/visualViewport 只做轻量视口更新；必要的 heavy repaint 会节流，并保留 `--app-top`，避免恢复刷新覆盖键盘/嵌入态位移。PWA shell cache 升级到 `codex-mobile-shell-v296`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v295 修正 Home AI 原生壳内 Codex 线程详情顶部页眉不可见的问题。Home AI 宿主仍保持 iframe 顶部为 0，Codex 只消费宿主 `hermes.plugin.viewport` 下发的 `hostTopSafeArea` / `safeAreaTop`，把它用于嵌入态线程详情 `topbar` 的内部 padding；线程列表页不额外下移，keyboard/composer 底部避让沿用 v294。PWA shell cache 升级到 `codex-mobile-shell-v295`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v294 修正 Home AI 原生壳内键盘弹出后 composer 底部避让失效的问题。嵌入态键盘打开时不再把 composer padding 固定压成 8px/10px，而是继续使用宿主通过 `hermes.plugin.viewport` 下发的 `--host-bottom-safe-area`，避免 WKWebView 键盘覆盖输入框；standalone/PWA 的非嵌入态键盘规则不变。PWA shell cache 升级到 `codex-mobile-shell-v294`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v293 修正 Home AI 原生壳内 Codex 插件页眉重复 safe-area 的问题。嵌入态 `topbar` 不再在 iframe 内部二次叠加系统顶部安全区，避免原生 WKWebView 壳里线程标题下移并留下过大的顶部空白；standalone/PWA 的普通 composer 和全局键盘布局规则保持不变。PWA shell cache 升级到 `codex-mobile-shell-v293`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v292 是 v291 之后的恢复版 shell。此前一次嵌入态 WebView viewport 热修复曾以相同 v291 shell 发布，可能导致部分 standalone/PWA 或 APP 壳客户端缓存到异常前端，表现为底部 composer 输入区不可达。v292 保持回滚后的正常 composer 布局，不重新引入该 viewport 改动，只推进 PWA shell cache 到 `codex-mobile-shell-v292`，用于让已打开或已缓存的浏览器/PWA 明确刷新到恢复版。

- 中文说明：Windows Desktop profile 快捷入口改为通过 `start-codex-desktop-shared-hidden.vbs` 和 `wscript.exe` 启动共享 mux，不再直接从 `.cmd` 常驻前台运行 `powershell.exe`。这会减少 Windows 上切换 default/current/previous Desktop profile 时出现的 PowerShell 控制台窗口；Mobile Web 计划任务入口仍继续使用隐藏 VBS/windowless launcher，普通 `start-codex-mobile-web.ps1` 保留为手工前台诊断入口。本次不改变 PWA shell cache。

- 中文说明：v289 修正 Public PR 提示的陈旧状态。点击 PR 入口前会强制刷新 GitHub 开放 PR 状态，避免 15 分钟缓存导致“已合并 PR”仍继续生成合并任务；刷新失败时不再保留旧的可执行 PR 列表；没有开放 PR 时顶部 PR 提示会隐藏，更新面板里的按钮只作为重新检查入口显示为 `Check PR`，检测到开放 PR 后才显示 `Review Public PR`。PWA shell cache 升级到 `codex-mobile-shell-v289`，更新后需要重启 Node listener；已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v290 修正新建对话第一条用户消息短暂重复显示的问题。Mobile Web 在新线程首轮会先保留本地 optimistic 用户消息；如果随后线程详情或事件流带回同一条 durable 用户消息但 turn id 不一致，前端现在会识别这是新线程首条提交的 echo，并丢弃本地重复 turn，避免“还没开始处理就出现两条 You”。PWA shell cache 升级到 `codex-mobile-shell-v290`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新的前端合并逻辑。

- 中文说明：v291 优化当前线程后台刷新路径。线程打开首屏之后，live poll、usage backfill、重连恢复等普通刷新默认走 `mode=recent`，避免频繁读取完整线程详情；turn 完成后的第二次低频刷新仍保留 full detail，用来补齐 usage、projection cache 和完整线程字段。前端新增 `thread_refresh_ms` 性能事件，记录刷新来源、requested/read mode、API 耗时和渲染耗时，便于后续继续量化当前 session 刷新体验。PWA shell cache 升级到 `codex-mobile-shell-v291`，更新后需要已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：server-only 合并 public PR #70，缓存线程列表 fallback 聚合结果。`/api/threads` 在 app-server 列表可用或失败回退时都会记录 bounded 耗时诊断，并把 state DB、rollout sessions 与 `session_index.jsonl` 合并出的 fallback 列表按可见 workspace/projectless 范围、搜索词和源文件 fingerprint 短暂缓存，减少移动端频繁刷新线程列表时重复扫描本地状态文件。启动新线程、改名和本地归档会清空该缓存；本次不改变 PWA shell cache，更新后需要重启 Node listener 才会生效。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v288 增加移动端加载与渲染性能诊断事件，并为静态文本资源开启带缓存的 `br` / `gzip` 压缩。前端会通过现有 `/api/client-events` 上报 `shell_loaded`、`thread_list_rendered`、`thread_detail_first_paint`、`thread_detail_full_ready`、`conversation_render_ms`、`mermaid_hydrate_ms` 和 `github_cards_hydrate_ms`，用于后续量化首屏、线程列表、线程详情、Markdown/Mermaid/GitHub 卡片渲染耗时。线程详情首屏先读取最近 turns，再后台补完整 `thread/read`。服务端会按浏览器 `Accept-Encoding` 压缩 JS/CSS/HTML/JSON/SVG 等文本资源，压缩结果按文件路径、大小、mtime 和编码缓存；图片仍原样返回。PWA shell cache 升级到 `codex-mobile-shell-v288`，更新后需要重启 Node listener；已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端诊断逻辑。

- 中文说明：v287 修正移动端用户消息去重边界。服务端 pending steer echo、线程详情 projection cache 和前端可见线程归一化现在只会在同 turn 或更晚 turn 出现匹配的真实 durable 用户消息时移除 synthetic/mux/local echo，避免用户后续重复发送同一句话时被旧历史消息提前压掉。PWA shell cache 升级到 `codex-mobile-shell-v287`，更新后需要重启 Node listener；已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新的前端归一化逻辑。

## Project Documentation

Engineering docs are split under [`docs/`](docs/README.md):

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for process boundaries, request flows, runtime state, and invariants.
- [`docs/MODULES.md`](docs/MODULES.md) for module ownership and the test map.
- [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) for live diagnosis of stuck turns, disappearing messages, PWA cache issues, Push, mux drift, uploads, and Hermes Mobile plugin setup.
- [`docs/CONTEXT_STRATEGY.md`](docs/CONTEXT_STRATEGY.md) for model context size, image-upload context policy, and continuation bootstrap bounds.
- [`docs/COMPLEX_FEATURE_PATHS.md`](docs/COMPLEX_FEATURE_PATHS.md) for implementation paths on cross-cutting features.

## Platform Status

| Platform | Standalone Mobile Web | Desktop live sync through mux | Notes |
| --- | --- | --- | --- |
| Windows | Supported | Supported with the included PowerShell launcher | This is the primary tested platform. |
| macOS | Supported for standalone Mobile Web when `codex` CLI is installed | Launcher scripts included; needs real-Mac verification | macOS Desktop bridge behavior depends on Codex Desktop accepting the shell wrapper through `CODEX_CLI_PATH`. |

Standalone Mobile Web means the browser connects to this local server, and the server starts or connects to a Codex app-server. Desktop live sync means Codex Desktop and Mobile Web attach to the same mux-backed app-server so both UIs see the same active turn stream.

## Requirements

- Node.js `>= 22`
- Git
- Codex CLI installed and authenticated on the same machine
- A local Codex state directory, usually:
  - Windows: `%USERPROFILE%\.codex`
  - macOS: `$HOME/.codex`
- Phone/browser on the same LAN, VPN, or Tailscale route when accessing from another device

Check the runtime:

```bash
node --version
codex --version
```

If Codex CLI is not authenticated, authenticate it first using the normal Codex CLI/Desktop flow for that machine.

## ChatGPT Pro MCP Connector

Codex Mobile Web exposes a restricted ChatGPT Pro MCP Connector for planner and
review workflows:

```text
POST /api/chatgpt-pro/mcp
```

This connector uses a separate runtime-only bearer token. It does not reuse the
normal Codex Mobile Access Key.

```bash
export CODEX_MOBILE_CHATGPT_PRO_MCP_TOKEN_FILE="$HOME/.codex-mobile-web/chatgpt-pro-mcp-token.txt"
```

The token file should be readable only by the local service user and must not be
committed, printed in logs, copied into `.agent-context`, or shared through a
thread.

The connector supports planner/reviewer tools only:

- `codex_mobile_status`
- `list_visible_workspaces`
- `read_thread_context`
- `read_allowed_repo_file`
- `create_planner_artifact`
- `prepare_codex_goal`
- `create_task_card_draft`
- `delegate_to_codex_thread`
- `list_planner_artifacts`
- `read_planner_artifact`

Allowed file reads are bounded to visible workspace documentation such as
`README.md`, `AGENTS.md`, `docs/**`, and the two shared context pointers
`.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md`. Planner
artifacts are written only under the runtime root, normally:

```text
$HOME/.codex-mobile-web/chatgpt-pro-planner/
```

`delegate_to_codex_thread` creates normal cross-thread task cards through the
server-side task-card service. Its default mode is `pending`, so the target
Codex thread still shows the card and must approve it before any turn is
injected. `mode:"draft"` only stores a runtime draft artifact. `mode:"direct"`
is rejected unless the server is explicitly started with:

```bash
export CODEX_MOBILE_CHATGPT_PRO_MCP_ALLOW_DIRECT_TASK_CARDS=1
```

The planner connector cannot write source files, run shell commands, answer
approvals, read arbitrary local paths, or expose raw rollout logs, uploads,
browser cookies, access keys, or token files. It can only start Codex work
through `delegate_to_codex_thread`, and that path defaults to target approval.

## Hermes Mobile Plugin Mode

Codex Mobile Web can expose itself as an independent Hermes Mobile embedded-app
plugin. It is not a worker queue and does not use shared Hermes owner
authentication. Hermes must provide the normal Codex Mobile Access Key when it
registers or launches the plugin.

Plugin endpoints:

```text
GET  /api/v1/hermes/plugin/manifest
POST /api/v1/hermes/plugin/workspaces
POST /api/v1/hermes/plugin/callbacks
POST /api/v1/hermes/plugin/origins
POST /api/v1/hermes/plugin/launch
POST /api/v1/hermes/plugin/session
POST /api/v1/hermes/plugin/notifications
```

`/api/v1/hermes/plugin/manifest` is metadata-only and returns no secret
material. Registration and launch require the Codex Mobile Access Key through
`Authorization: Bearer <key>` or `X-Codex-Mobile-Key: <key>`.

Workspace registration stores only bounded Hermes metadata under the runtime
directory, normally:

```text
%USERPROFILE%\.codex-mobile-web\hermes-plugin-registration.json
```

The callback URL may be `http` or `https`; production Hermes Mobile deployments
should also register their HTTPS iframe origin through `/origins` so Codex can
emit the correct CSP `frame-ancestors`. The Access Key is never stored in that
registration file. Launch returns a short-lived `codexPluginLaunch` entry path
for the iframe; the browser immediately exchanges it for an in-memory plugin
session and scrubs the one-time URL instead of storing the long-lived Access Key.
Launch may also carry a bounded plugin target such as a workspace `cwd` or a
thread id. After session exchange, the embedded browser should prefer that
target over stale local restore state so Hermes-launched Wardrobe/Codex
workflows land in the intended workspace and keep the correct MCP context.
Launch may also carry bounded host appearance under `appearance.theme` and
`appearance.fontSize`. Supported theme values are `system`, `dark`, and
`light`; supported font-size values are `small`, `default`, `large`, `xlarge`,
and `xxlarge`. Codex copies only those whitelisted values into the short iframe
entry path as `pluginTheme` / `pluginFontSize` and into the plugin session
response as `appearance`. The embedded head script applies them before loading
the stylesheet and main app bundle, so Hermes-hosted plugins do not flash the
standalone/default theme or font size during initialization.
During slow embedded startup, `/?embed=hermes` keeps the iframe behind a stable
`正在加载 Codex...` loading layer until Workspace and thread-list data have loaded
and the final primary page, launch target, or route hint has rendered. This
prevents the host from showing a sequence of intermediate `Select a thread` /
`Loading threads...` screens before the usable plugin page appears.
When Hermes does not provide an explicit launch target or bounded route hint,
`/?embed=hermes` stays on the embedded primary page instead of restoring the
last locally opened thread. This prevents the plugin tab from auto-entering a
stale recent Codex thread and hiding Hermes's own bottom navigation.
If Hermes Mobile is served over HTTPS, the Codex Mobile entry must also be
HTTPS. Set `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or
`CODEX_MOBILE_PUBLIC_BASE_URL` so the manifest advertises that external URL.
On Windows, the included startup scripts accept `-HermesPluginBaseUrl`,
`-PublicBaseUrl`, and `-HermesPluginFrameOrigins`, so a scheduled-task
deployment can persist the HTTPS entry URL and the allowed Hermes iframe
origins instead of relying on a temporary shell environment. Example:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunNow `
  -HermesPluginBaseUrl "https://codex.example.test:8443" `
  -HermesPluginFrameOrigins "https://hermes.example.test"
```

After that, a manifest request with
`?hermesOrigin=https%3A%2F%2Fhermes.example.test` should return an HTTPS
`entry.url` and `program_api.base_url`; launch responses still return only a
relative `entry_path` with a short-lived token.
Plugin-mode notifications are delegated to Hermes Mobile instead of registering
Web Push inside the iframe. When configured, the Codex Mobile backend calls
Hermes `POST /api/hermes-plugins/codex-mobile/notifications` with a server-side
`X-Hermes-Web-Key` and a small Action Inbox payload containing a stable
`eventId`, title, summary, item type, priority, and route metadata. The Hermes
key is read only from `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY`,
`CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE`, or the
`CODEX_MOBILE_HERMES_WEB_KEY` fallbacks; it is never placed in the iframe URL,
frontend JavaScript, manifest, or plugin session. If the delegate is not
configured, standalone Mobile Web keeps its existing local Web Push behavior.
`/?embed=hermes` suppresses browser Push registration and local completion
alerts so Hermes owns both the Inbox record and Web Push delivery.
`/?embed=hermes` runs the same app as an iframe-embedded secondary app, hides
standalone navigation chrome, reports navigation state with
`codex-mobile.plugin.navigation`, and blocks `window.open` / `_blank` handoffs
that would create an external secondary window. Normal thread/workspace routes
report `canGoBack: true` so iOS Hermes Mobile forwards right-swipe/back to the
iframe, and thread detail publishes that state as soon as a thread id is
selected, before the detail read finishes. Codex handles ordinary thread-page
back by returning to its embedded primary page, which contains the thread
switcher and settings controls. That
primary page reports `canGoBack: false`, so Hermes Mobile can show its own
bottom navigation tabs. `hermes.plugin.back` closes modal/edit transient layers
such as file previews, dialogs, and subagent panels before page-level back is
applied.
In Hermes embedded mode only, Codex Mobile can participate in Home AI host
voice input. The iframe declares whether its composer is writable, accepts
bounded `voice_input.append_text` / `voice_input.replace_draft` messages from
the Home AI parent, and reports `voice_input.commit_result` after a voice
inserted draft is successfully sent. Long-pressing the embedded send button
delegates recording to the Home AI host; a normal short tap still sends through
the existing Codex Mobile path. Standalone Codex Mobile Web is not changed by
this integration.
Hermes notification opens may also include bounded iframe query hints such as
`pluginRoute`, `pluginThreadId`, `pluginTaskId`, and `pluginItemId` with
`pluginId=codex-mobile`. In embedded mode, Codex consumes those hints, opens
the matching thread when it still exists, scrolls the matching task/item card
into view when possible, then scrubs the URL back to the embed root. Missing
targets fall back to the normal embedded primary page plus a small in-app
diagnostic instead of exposing raw task content or leaving stale ids in the
address bar.
When the embedded iframe determines that its current session cannot recover
safely in place, it now asks Hermes to relaunch the plugin by posting
`codex-mobile.plugin.refresh_required` to the confirmed Hermes origin. The
payload is intentionally bounded: `type`, `version`, `reason`, and small route
hints such as `route.name`, `route.threadId`, `route.itemId`, `pluginRoute`,
`pluginThreadId`, `pluginTaskId`, and `pluginItemId`. It must not include the
Access Key, plugin session token, launch token, cookies, local paths, raw
logs, or prompt/tool payloads. Current refresh-required triggers cover
unrecoverable embed auth/session failures and server shell build changes
detected by the embedded iframe.
For Hermes plugin notifications, Codex Mobile now separates the short Push/InBox
preview from the long completed-turn receipt. The delegated notification keeps a
short `title + summary` for Web Push and Inbox preview, while the same backend
payload may also include a bounded Markdown `detailMessage` containing the final
assistant receipt text and Usage summary for Hermes thread-message storage. The
delegated Push/InBox `title` is resolved from the actual Codex thread name or
explicit nested thread title before falling back to preview text, so Hermes
plugin notifications do not show a generic plugin/post label as the thread
name. The backend uses an adapter-owned display-summary cache populated from
app-server `thread/list` and `thread/read` results before the local SQLite
fallback, because older continuation threads can keep a stale bootstrap prompt
as their SQLite title. If a completed-turn notification arrives before the
cache is warm, the server refreshes that thread's app-server summary before
sending the Push/InBox payload. The standalone Web App Push path stays
unchanged.

## Cross-thread Task Cards

Codex Mobile Web now has a first implementation of controlled cross-thread task
cards:

- `POST /api/thread-task-cards`
- `POST /api/threads/:sourceThreadId/task-cards`
- `GET /api/thread-task-cards/:id`
- `POST /api/thread-task-cards/:id/approve`
- `POST /api/thread-task-cards/:id/delete`
- `POST /api/thread-task-cards/:id/revoke`
- `POST /api/thread-task-cards/:id/reply`

Behavior:

- A source thread can create pending task cards for one or more target threads.
- The pending card appears outside the target thread's normal message flow.
- The target thread can `Approve`, `Delete`, or `Reply`.
- The source thread can `Revoke` while the card is still pending.
- `Approve` injects the request as a real new target-thread turn, not as a fake
  static message row.
- `Reply` creates a reverse-direction pending card. Target-side reply is valid
  while the original card is still `pending` or after it has been approved and
  injected into the target implementation thread.
- A plain target-thread final answer is never treated as a source-thread return
  card. Manual task cards must close by creating a real reverse card through
  `POST /api/thread-task-cards/:id/reply`, `codex_mobile.return_to_source`, or
  `scripts/return-thread-task-card.js`.
- Return cards created through `codex_mobile.return_to_source`,
  `scripts/return-thread-task-card.js`, or `/reply` with `returnToSource:true`
  are source-direct approved into the original source thread. They do not require
  a second source-thread `Approve`.
- Source-thread task-card creation may include `reasoningEffort` /
  `reasoning_effort` with `low`, `medium`, `high`, or `xhigh`. The injected
  target message exposes the requested value, and the target turn runtime uses it
  instead of silently inheriting a lower thread default.

`POST /api/threads/:sourceThreadId/task-cards` is the thread-callable
delegation path. It is intended for a Codex thread/tool to hand scoped work to
another thread without cross-workspace editing. It stores the same task-card
object for audit. Source-thread direct approval is disabled by default and is
controlled from the Settings panel under `跨工作区委派`. The runtime setting is
stored in `settings.json`; `CODEX_MOBILE_ALLOW_WORKSPACE_DELEGATION=1` remains
only a startup/default fallback. With the default configuration it creates a
normal pending target card. Passing `pending:true` or `autoApprove:false` also
forces pending behavior even when the switch is on.

When the same runtime switch is enabled, Codex Mobile also injects the
app-server dynamic tool `codex_mobile.delegate_to_thread` into `thread/start`
and `turn/start`. This is the model-visible path for ordinary Codex turns: the
model decides whether a request needs another workspace/thread, calls the tool
with an exact target thread id/title or exact target cwd, and the server creates
the task card through the same source-thread route. Exact thread ids/titles are
thread identity, so multiple normal threads may share one cwd; archived,
deleted, hidden, subagent, or non-detail-readable targets are still rejected.
`targetCwd` / `targetWorkspace` remain fuzzy workspace targets and choose a
current visible thread for that workspace. The dynamic tool response is
serialized as app-server dynamic-tool output, `result.content_items` with an
`input_text` item, not MCP `content` text. Source-thread task-card creation only
accepts deliverable target threads and rejects self-cards explicitly.
The same start/turn runtime guidance also includes a local script fallback for
agents that do not see the dynamic tool. App-server dynamic tools may not appear
in deferred discovery surfaces such as `tool_search`, so that absence is not
treated as an injection failure. If no direct callable
`codex_mobile.delegate_to_thread` tool surface is visible, the agent should use
`scripts/create-thread-task-card.js` against
`/api/threads/:sourceThreadId/task-cards` as the first-class fallback path.
`multi_agent_v1.*` tools are not task-card APIs and should not be used as a
substitute for cross-workspace file-change delegation.

All task-card injected target turns also receive the app-server dynamic tool
`codex_mobile.return_to_source` and a script fallback instruction for
`scripts/return-thread-task-card.js`. The injected task-card message includes
`Task card id: ...`; the target model must use that id when returning
`completed`, `blocked`, or `redirected` to the source. This return path is
separate from the workspace-delegation switch because it closes an already
received card rather than creating new cross-workspace work. It calls the same
`/api/thread-task-cards/:id/reply` route, so the source thread can distinguish
real return cards from local target replies.
`completed`, `blocked`, `redirected`, and `partially_completed` are accepted
bounded return statuses.

Codex Mobile also registers a standard Codex MCP toolset named `codex_mobile`.
On server startup, Profile list reads, workspace creation, and Profile switch,
Mobile Web checks every known or target `CODEX_HOME/config.toml`; if
`[mcp_servers.codex_mobile]` is missing or stale, it adds or repairs a stdio
wrapper for `scripts/codex-mobile-mcp-server.js`. The wrapper exposes
`list_threads`, `delegate_to_thread`, and `return_to_source`, uses the same
authenticated local task-card API, and stores only command/script/server/key-file
paths in `config.toml`, never raw key material. It also writes tool-level
`approval_mode = "approve"` entries for all three tools, so Codex does not add a
second MCP approval prompt around the Mobile Web runtime delegation/return gate.
This MCP toolset is for Codex threads. The ChatGPT Pro MCP connector under
`/api/chatgpt-pro/mcp` remains a separate external-client integration.

The same switch keeps ordinary execution usable but adds a real source-write
boundary. For non-exempt workspaces, Mobile Web sends new `thread/start`,
`thread/resume`, and `turn/start` requests with `workspace-write` / managed
profile plus `approvalPolicy:"on-request"`. The profile allows the current cwd,
temporary directories, and current-workspace `.git`; app-server approval
requests are then auto-answered by
`adapters/workspace-source-write-guard-service.js`. Reads, MCP calls, network,
current-workspace writes, current `.git` writes, and narrow Home AI provided
tool commands are allowed; direct `apply_patch`, file changes, `git add/commit`,
write-like commands, or write-like file-system grants into another known source
root are denied so the source model can delegate through a task card. The guard
uses thread/turn ownership to identify the source workspace before considering a
command cwd, so setting a command cwd to Home AI does not bypass plugin
workspace boundaries. Operators
can temporarily return to the old full-access approval-proxy-only mode with
`CODEX_MOBILE_WORKSPACE_DELEGATION_APPROVAL_PROXY_ONLY=1`, but that mode cannot
block direct tool writes that do not raise approval requests.

Local thread-callable wrapper:

```bash
node scripts/create-thread-task-card.js \
  --source-thread <source-thread-id> \
  --target-thread <target-thread-id-or-exact-title> \
  --title "<title>" \
  --reasoning-effort xhigh \
  --body-file <markdown-file>
```

The script reads the Codex Mobile access key from env or
`$HOME/.codex-mobile-web/access_key` and does not print key material.
Use `--reasoning-effort xhigh` for deep audit cards that must not run under a
target thread's lower default effort.

Target-side return wrapper:

```bash
node scripts/return-thread-task-card.js \
  --task-card <task-card-id> \
  --thread <target-thread-id> \
  --status completed \
  --title "<return title>" \
  --body-file <markdown-file>
```

The script calls only `/api/thread-task-cards/:id/reply`, always sets
`returnToSource:true`, uses a stable return idempotency key when none is
supplied, and prints bounded JSON without key material.

The browser currently exposes a minimal `Send task card` entry inside the thread
detail view. It resolves the target by exact visible thread title or explicit
thread id and uses the browser prompt flow for title/body entry. The stable
behavior boundary is the API plus `thread.threadTaskCards` in thread-detail
responses; the compose UX can evolve later without changing the state machine.

The composer reserves a leading non-empty `#` command for natural-language
cross-thread task-card commands. Plain `# ...` commands default to a manual
one-off card request; the legacy `#自由协作` prefix remains accepted and defaults
to autonomous collaboration. Task-card commands do not go through a separate
parse route. Instead, Mobile Web sends a bounded draft request to the current
Codex thread, lets the model interpret the command against the visible thread
list, and immediately creates pending target cards when the returned draft
parses successfully. The source thread does not show a second local `Approve`
step. The create call uses a stable draft-scoped idempotency key, the thread
list shows incoming `Task N` badges on every target thread, and a single-target
draft still switches to that target thread so the pending card is visible
without manual navigation.
Multi-target drafts create one pending card per target and keep the source
thread visible without rendering outgoing cards as local work items. When the
card id is known for a single target, Mobile Web also reuses its existing
route-hint focus path to scroll the target thread directly to that pending card
instead of leaving the user at the bottom of a long conversation. Pending
cross-thread task cards now
render after the visible turn list and approval stack, so they stay at the
bottom of the thread rather than appearing above historical messages. Once a
card is approved, deleted, revoked, or replied, it no longer renders in thread
detail; the injected turn becomes the visible follow-up surface. The current
thread now also removes a settled card immediately after a successful action.
For normal cards, target-side `Approve` remains mandatory. Plain `#` commands
default the draft to `workflowMode:"manual"` unless the user explicitly asks for
autonomous/free collaboration. `#自由协作` defaults the draft to
`workflowMode:"autonomous"` unless the user explicitly asks for a one-off manual
card. The first target-side approval then activates a workflow grant scoped to
that exact `workflowId` and the same two thread ids. Later cards carrying that
workflow id between the same two threads auto-inject as real
target-thread turns without another manual click, including reverse-direction
follow-up cards. A reused workflow id with a different thread pair still stays
pending and requires its own first approval.
Autonomous workflow approval also enables completion auto-return by default:
when the target turn injected by an approved autonomous card completes, Mobile
Web creates a reverse-direction return task card with the completed turn
receipt, reuses the same workflow id, and immediately auto-approves it back into
the source thread. The auto-return is idempotent by original card id plus
completed turn id, so repeated `turn/completed` notifications do not create
duplicate return turns. The return card is terminal: it can auto-inject back to
the source through the existing grant, but its own completion does not create a
second return. Auto-return titles also collapse repeated `Auto return:` prefixes
to a single prefix.
Target-side approval also persists a transient non-pending `approving` state
before calling the external target-thread `turn/start`, so reconnect,
continuation compaction, or thread refresh cannot resurrect the same `Approve`
card while the approved turn is already starting. If the external call fails
before acceptance, the service restores the card to `pending` with a bounded
audit error.
Current browser builds also suppress raw draft XML while the model is still
streaming the bounded draft reply, show a visible pending draft placeholder
during that gap, wait for the injected target-thread turn after target-side
`Approve`, and scroll to that injected turn when it becomes visible. Task-card
drafts and pending task cards now default to a medium card with a collapsed
details section instead of rendering the full body immediately. During
source-side automatic creation, the source thread does not render an interim
`Sending` draft card; only a real creation failure renders a dismissible
diagnostic. Source-thread draft cards also persist their settled `created` /
`dismissed` state in browser storage using a stable turn-and-draft-content key,
and re-check already stored cards for the source turn before auto-sending.
That re-check continues past ordinary assistant or plan messages in long source
threads, so a later valid draft still reaches `/api/thread-task-cards` instead
of being dropped before the task-card store is updated.
Leaving and re-entering the source or target thread therefore must not resurrect
an already created draft or create a duplicate target card from the old bounded
XML response.

Server-side task-card draft materialization now backs up the browser path. On a
fresh `turn/completed` notification, the listener fetches the source thread's
recent turns, scans assistant/plan items for the structured draft XML, resolves
target workspace metadata from the local Codex state, and calls the same
idempotent `createMany()` service path. Thread detail reads run the same
materialization before attaching visible cards, including the large-rollout
`thread/turns/list` mode. This keeps automatic collaboration from depending on
which browser page is open, which workspace filter is active, or whether a PWA
client refreshed at the right moment. Model-generated draft bodies are also
bounded before persistence: the card body limit is 8,000 characters, so a verbose
draft is stored with a head/tail truncation marker instead of failing with
`body_too_long`.

In Hermes embed mode, the sidebar now keeps the version pill, public-PR status,
and restart action visible instead of hiding the whole version-action row.
`压缩续接` still comes from the existing long-press thread menu, but the
confirmation step now uses an in-app dialog instead of `window.confirm`, so the
plugin iframe no longer depends on a host-blocked native confirm popup. When a
public-PR prompt is accepted, Mobile Web now routes that review task into
this workspace's new-thread draft instead of reusing whichever unrelated thread
happens to be open.

When Mobile Web decides the Hermes host must reload the embedded plugin iframe,
the current page now shows an explicit in-app refresh notice immediately before
posting `codex-mobile.plugin.refresh_required`, instead of appearing to reload
for no visible reason. That notice is intentionally bounded: if Hermes does not
replace the iframe immediately, Mobile Web auto-clears the notice after about
10 seconds rather than leaving a stale warning banner on screen.
response instead of waiting for a leave/re-enter refresh cycle. Examples:

```text
# 发给 Finance Review：请核验 5 月结账映射
# 让 Hermes 05-26 处理插件刷新联动
#自由协作 让 Hermes 05-26 配合处理插件刷新联动
```

If the model cannot choose at least one visible target thread, the source thread
shows a bounded failed draft diagnostic instead of auto-sending to the wrong
thread. `#` task-card commands still reject attachments for now.

## Clone And Validate

```bash
git clone https://github.com/pentiumxp/codex-mobile-web-public.git
cd codex-mobile-web-public
npm ci
npm run check
```

`npm ci` installs the small runtime dependency set used by optional Web Push support. `npm run check` syntax-checks the JavaScript files. On macOS, also run:

```bash
npm run check:macos
```

## Windows Standalone Start

From PowerShell:

```powershell
cd C:\path\to\codex-mobile-web
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787
```

Open on the Windows machine:

```text
http://127.0.0.1:8787
```

Open from a phone on the same network:

```text
http://<windows-lan-ip>:8787
```

Examples:

```text
http://192.168.1.25:8787
http://100.x.y.z:8787
```

When `-CodexExe` / `CODEX_MOBILE_CODEX_EXE` is not explicit, the Windows
startup scripts prefer the newest installed OpenAI Codex binary under
`%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`, then fall back to this local
runtime binary when it exists:

```text
%USERPROFILE%\.codex-mobile-web\codex.exe
```

If none of those files exists, it falls back to `codex` from `PATH`.

## Windows Background Startup

To start Codex Mobile Web when the Windows user logs in without showing a console window, install the included Scheduled Task:

```powershell
cd C:\path\to\codex-mobile-web
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunNow
```

This is the default mode. It registers a task named `Codex Mobile Web` with an `AtLogOn` trigger under the current Windows user. The task runs `wscript.exe start-codex-mobile-web-hidden.vbs`, which starts PowerShell with `-WindowStyle Hidden`, so it does not create a visible console window.

The task starts after that user logs in and stops when that user signs out. A locked Windows session is fine. Because the task runs as the user, Codex tool calls use the same user profile and can access that user's WSL distributions.

If the installer is launched from another account or a SYSTEM/elevated automation context, pass the target identity and profile explicitly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -UserId "$env:COMPUTERNAME\$env:USERNAME" -UserProfilePath "$env:USERPROFILE" -RunNow
```

`-InteractiveLogon` is still accepted for older install commands, but it is no longer required because user-logon startup is the default.

If you intentionally need startup before any user logs in or survival after sign-out, install the optional `LocalSystem` task from an elevated PowerShell session:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -RunAsSystem -RunNow
```

`LocalSystem` does not store your Windows password and also uses the hidden launcher, but it cannot start WSL distributions. Use the default user-logon mode when Codex tool calls need WSL access. The system task still receives `-UserProfilePath <target-user-profile>` and the windowless launcher maps `USERPROFILE`, `HOME`, `APPDATA`, `LOCALAPPDATA`, `TEMP`, and `TMP` back to that target profile before resolving Codex state or the installed `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe`. This keeps multi-account Codex homes, access-key storage, runtime logs, and self-update Git safe-directory settings anchored to the intended Windows user even though the process identity is LocalSystem.

When migrating an already-running login task to `-RunAsSystem`, install from an elevated PowerShell session and restart the shared chain so the old user-logon process exits and the replacement instance starts from the new system task. Avoid running a second listener on the same port.

### Manual Mobile Web Shared-Chain Restart

The daily `Codex Mobile Web Shared Chain Restart` scheduled task is no longer installed by default. The same scoped restart is now exposed as a manual control in the mobile sidebar: the header shows a small `Restart` button next to the version/update pill, and tapping it asks for confirmation before restarting.

The manual restart calls the authenticated `POST /api/restart/shared-chain` endpoint. On Windows system-task deployments, the endpoint launches a short hidden PowerShell bootstrap that registers and starts a separate `SYSTEM` helper task (`Codex Mobile Web Restart Helper`). The helper task runs the real `restart-codex-mobile-shared-chain.ps1` outside the current scheduled-task process tree, so a LocalSystem `AtStartup` task does not kill its own restart helper when the helper stops the task. The page can show the confirmation result before the current Node listener exits. The script stops only the Codex Mobile Web shared chain: the `Codex Mobile Web` startup task, this workspace's hidden/windowless launchers, this workspace's `server.js`, and the selected profile mux/child process recorded in that profile's endpoint file. It removes the stale mux endpoint file, starts `Codex Mobile Web` again, and waits for HTTP plus mux readiness.

Operational rule: do not treat the restart as successful merely because the old
listener exited or the restart command was dispatched. Success means a new
`8787` listener exists and `/api/public-config` is reachable again. If a manual
or tool-driven restart stops the old listener but never confirms replacement
readiness, Mobile Web should be treated as down, not as "restarting normally."

On macOS, the same endpoint restarts only the current Mobile Web listener. When
the listener is running under a LaunchAgent, the endpoint cleans older
same-prefix submitted jobs and calls `launchctl kickstart -k` for that existing
service label, preserving the plist-managed environment. If the listener is
running under a system LaunchDaemon, the restart helper does not attempt
user-level `launchctl kickstart system/...`; it kills only the current listener
and lets LaunchDaemon KeepAlive start the replacement. Before doing that, it
best-effort repairs the LaunchDaemon stdout/stderr files reported by
`launchctl print system/<label>` so missing or wrong-owned log files do not
make launchd fail with `EX_CONFIG` before Node starts. If no service label is
available, it falls back to a one-shot detached `nohup` listener rather than
creating a persistent `launchctl submit` job. It keeps Codex Desktop and the shared mux running, so
the user can restart the `8789` browser server from the PWA without triggering the macOS `Quit Codex?` confirmation.

This manual restart intentionally does not restart WSL, Codex Desktop, or unrelated local services. Logs are written to `%USERPROFILE%\.codex-mobile-web\shared-chain-restart.log`.

The task still uses your normal Codex data paths by passing the installing user's profile path into the launcher:

```text
USERPROFILE=<your Windows user profile>
APPDATA=<your Windows user profile>\AppData\Roaming
LOCALAPPDATA=<your Windows user profile>\AppData\Local
CODEX_HOME=<active profile home, defaulting to <your Windows user profile>\.codex>
CODEX_MOBILE_RUNTIME_DIR=<your Windows user profile>\.codex-mobile-web
```

The task runs `wscript.exe` against `start-codex-mobile-web-hidden.vbs`, which then starts PowerShell with window style `Hidden` and waits for it. The PowerShell wrapper starts a standalone mux endpoint when shared-stream mode is required, then starts Mobile Web.

```text
wscript.exe start-codex-mobile-web-hidden.vbs
```

The sidebar settings panel can also show local Codex profiles and switch the
single active Mobile Web profile. The profile switcher is deliberately not a
dual-provider mode: one listener still uses one active auth profile and one
mux/app-server chain at a time. The settings panel lists the configured
profiles, shows the safely derived logged-in account label/email and recent
quota snapshot for each profile, and calls the authenticated
`POST /api/codex-profiles/active` endpoint when switching. The endpoint writes
`%USERPROFILE%\.codex-mobile-web\codex-profiles.json` and restarts the Mobile
Web shared chain. The Windows restart script and hidden/windowless launcher
both read the same active profile store before resolving the mux endpoint. For
non-default profiles, the launcher preserves that profile's own `auth.json` and
`config.toml` but links thread/workspace state files such as `state_5.sqlite`,
`.codex-global-state.json`, `session_index.jsonl`, `sessions/`, and
`archived_sessions/` back to the default `%USERPROFILE%\.codex` home, so
switching accounts keeps the same visible workspaces and conversations. Raw
token values from `auth.json` are never returned to the browser.

By default, the startup task passes `-EnsureStandaloneMux -RequireSharedAppServer`, so Mobile Web connects to a single mux-backed app-server endpoint instead of silently creating a separate managed app-server stream. Codex Desktop can later attach to the existing mux endpoint when it is launched through `start-codex-desktop-shared.ps1`.

If you intentionally want standalone fallback behavior without a required mux endpoint, install with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install-codex-mobile-web-startup.ps1 -AllowManagedFallback -RunNow
```

The windowless launcher appends runtime logs to:

```text
%USERPROFILE%\.codex-mobile-web\codex-mobile-web.startup.log
```

To remove the Windows login startup task:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\uninstall-codex-mobile-web-startup.ps1
```

## macOS Standalone Start

On macOS, use the included launcher so the `codex` and `node` commands are resolved to real executable paths before the server starts:

```bash
cd /path/to/codex-mobile-web
npm run check
npm run check:macos

./start-codex-mobile-web-macos.sh --host 0.0.0.0 --port 8787
```

The launcher defaults to:

- `CODEX_HOME="$HOME/.codex"`
- `CODEX_MOBILE_HOST="0.0.0.0"`
- `CODEX_MOBILE_PORT="8787"`
- `CODEX_MOBILE_CODEX_EXE="$(command -v codex)"`
- `node` from `command -v node`

For LaunchAgent or other non-interactive production startup, do not rely on a
login shell PATH. Set absolute executable paths in the plist or wrapper, for
example:

```bash
CODEX_MOBILE_CODEX_EXE="$HOME/.local/bin/codex"
CODEX_MOBILE_NODE_EXE="$HOME/HermesMobile/runtime/node-current/bin/node"
PATH="$HOME/.local/bin:$HOME/HermesMobile/runtime/node-current/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"
```

If the UI shows `failed to start codex app-server (spawn codex ENOENT)`,
the Mobile Web process can start Node but cannot find the Codex CLI executable
in its own environment. Fix the launcher/plist environment or start through
`start-codex-mobile-web-macos.sh --codex "$(command -v codex)" --node "$(command -v node)"`.

If you only want access from the Mac itself, bind to loopback:

```bash
./start-codex-mobile-web-macos.sh --host 127.0.0.1 --port 8787
```

If `8787` is already in use, choose another port:

```bash
./start-codex-mobile-web-macos.sh --host 0.0.0.0 --port 8789
```

Open on the Mac:

```text
http://127.0.0.1:8787
```

Open from a phone on the same network:

```text
http://<mac-lan-ip>:8787
```

Find the Mac LAN IP with:

```bash
ipconfig getifaddr en0
```

If that returns nothing, check Wi-Fi/Ethernet interfaces:

```bash
ifconfig
```

macOS may ask whether Node.js can accept incoming network connections. Allow it if you want phone access on the LAN. If you only use `http://127.0.0.1:8787` on the Mac itself, LAN firewall access is not required.

## Authentication

By default the server requires an access key.

Key source priority:

1. `CODEX_MOBILE_KEY`
2. `CODEX_MOBILE_KEY_FILE`
3. Default runtime key file:
   - Windows: `%USERPROFILE%\.codex-mobile-web\access_key`
   - macOS: `$HOME/.codex-mobile-web/access_key`

If `CODEX_MOBILE_KEY` is not set and the key file does not exist, the server creates a durable random key on first start. The implementation uses 18 random bytes encoded as `base64url`, then writes the result to the key file with restrictive file permissions where the OS supports them.

Typical generated key shape:

```text
H5X8q6z7Kp1xkY4nQm2AbcDe
```

The key is per machine. Do not reuse another person's key and do not commit it to Git.

### Easiest Login Flow

1. Start the server.
2. Copy the generated access key from the machine running the server.
3. Open `http://<computer-ip>:8787` on the phone/browser.
4. Paste the key into the login page.
5. After a successful login, the browser stores it in localStorage and a one-year cookie, so normal reloads do not ask again.

Read the key:

Windows PowerShell:

```powershell
Get-Content "$env:USERPROFILE\.codex-mobile-web\access_key"
```

Copy the key directly to the Windows clipboard:

```powershell
Get-Content "$env:USERPROFILE\.codex-mobile-web\access_key" | Set-Clipboard
```

macOS:

```bash
cat "$HOME/.codex-mobile-web/access_key"
```

Copy the key directly to the macOS clipboard:

```bash
cat "$HOME/.codex-mobile-web/access_key" | pbcopy
```

If the key file does not exist yet, start the server once. It is created during startup.

### Optional Custom Key

For a short demo on a trusted private network, you can choose your own key with `CODEX_MOBILE_KEY`. Use a non-trivial value; do not use a weak shared password on an untrusted network.

Windows:

```powershell
$env:CODEX_MOBILE_KEY = "replace-with-a-random-private-key"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787
```

macOS:

```bash
export CODEX_MOBILE_KEY="replace-with-a-random-private-key"
npm start
```

When `CODEX_MOBILE_KEY` is set, that environment value is used instead of the key file for that server process.

Disable auth only for isolated local testing:

Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -NoAuth
```

macOS:

```bash
CODEX_MOBILE_DISABLE_AUTH=1 npm start
```

Do not expose an unauthenticated server on a public network.

## Uploads

The composer supports images and files.

Default upload directory:

- Windows: `%USERPROFILE%\.codex-mobile-web\uploads`
- macOS: `$HOME/.codex-mobile-web/uploads`

Environment overrides:

```bash
CODEX_MOBILE_UPLOAD_DIR=/path/to/uploads
CODEX_MOBILE_MAX_UPLOAD_BYTES=67108864
CODEX_MOBILE_MAX_UPLOAD_FILES=12
```

Behavior:

- Supported browser image uploads (`jpeg`, `png`, `webp`) are compressed in the browser before submission. The default target is a maximum 1280px edge and JPEG quality `0.72`, keeping UI screenshots readable while avoiding multi-MB image payloads entering Codex context.
- By default, images are shown in Mobile Web as centered thumbnails but sent to Codex only as local file-path references in text. This keeps the UI visual without making image pixels part of app-server history. The authenticated upload preview route must return browser-renderable image MIME types such as `image/jpeg` for saved upload paths.
- Set `CODEX_MOBILE_IMAGE_CONTEXT_MODE=latest` or `vision` only when the model must inspect the latest uploaded image. Set `CODEX_MOBILE_IMAGE_CONTEXT_MODE=all` only for legacy all-image behavior.
- Turns that include image uploads no longer request app-server extended-history persistence by default. This treats images as temporary visual references and reduces repeated `replacement_history` image retention in later rollout compaction records. Set `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1` only when historical image rehydration is required.
- Image messages render as centered thumbnails in the web UI, including saved `.jpg` / `.jpeg` / `.png` / `.webp` upload paths served through `/api/uploads/file` and Codex-generated Markdown `data:image/png;base64,...` images.
- Non-image files are saved locally and referenced in message text by absolute path so Codex can read them through normal file access.
- Uploaded file contents are local runtime state and must not be committed.

## Interface Notes

- 中文说明：v286 修复 Markdown angle autolink 渲染，并增加图片与 Mermaid 预览缩放。Markdown 渲染器现在会在 HTML 转义前识别 `<https://...>` 和 `<mailto:...>` 这种标准 autolink 语法，避免它们被显示成纯文本；聊天内上传图片、Markdown 图片、生成图片、文件预览图片以及 Mermaid 图可以打开预览层，通过按钮或手机/iPad 双指捏合放大缩小，缩放时尽量保持手指中心位置。PWA shell cache 升级到 `codex-mobile-shell-v286`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v285 增加会话图片全屏预览和手动缩放。聊天内上传图片、Markdown 图片、生成图片以及文件预览里的图片现在可以点击打开独立预览层；预览层提供放大、缩小、重置按钮，并支持手机/iPad 双指捏合缩放，放大后可横向/纵向拖动查看细节。PWA shell cache 升级到 `codex-mobile-shell-v285`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v284 允许新建对话时不指定 Workspace。Mobile 新建页现在提供“不指定 Workspace”选项，发送首条消息时按 Codex App 的项目外聊天语义调用 `thread/start`，不向 app-server 传空 cwd；创建成功后会把新 thread id 登记到现有 `projectless-thread-ids`，让后续列表/详情复用已有项目外线程可见性逻辑。有 Workspace 的新建对话仍保留原有可见 workspace 校验。PWA shell cache 升级到 `codex-mobile-shell-v284`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v283 修正压缩续接线程名回退到旧首条消息的问题。Mobile Web 现在把 `session_index.jsonl` 中已有的显示标题作为线程列表、线程详情和下一次压缩续接 source title 的恢复来源，避免手动命名过的线程在进入详情或再次续接时被 app-server 返回的旧第一条用户消息覆盖；索引时间只在比线程行更新时用于推进列表排序。压缩续接确认框和请求体也统一使用当前显示标题。PWA shell cache 升级到 `codex-mobile-shell-v283`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v282 修正 Home AI 嵌入态 Codex 语音输入不实时跳字的问题。Codex 插件协议新增 `voice_input.provisional_text`，录音过程中按同一个 `voiceSessionId` 替换上一段临时草稿，松手后再恢复 base draft 并插入最终转写文本，避免重复追加。Host/插件侧也把 composer 暂不可写降级为静默忽略，不再频繁弹出“当前输入框不可写”。PWA shell cache 升级到 `codex-mobile-shell-v282`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v281 修正 v280 自动续接只覆盖当前打开线程的问题。导航栏 Restart 确认前列出的 running session 会保存为一次性恢复队列；Listener/app-server 恢复 ready 后，前端会逐个调用 `/api/threads/:id/auto-recover`，让 Home AI、星盘等后台运行线程也能自动续接。普通 SSE 抖动仍不会触发自动续接，恢复队列只保存线程 id/cwd/status 等元数据，不保存消息内容。PWA shell cache 升级到 `codex-mobile-shell-v281`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端逻辑。

- 中文说明：v280 增加 Listener/app-server 断线后的当前线程自动续接。移动端在 EventSource 或恢复流程检测到 app-server 从不可用回到 ready 后，如果当前线程仍有 active turn 或运行提示，会调用服务端 `/auto-recover`：优先对仍 live 的 turn 发送一次短“继续当前任务”引导；如果原 turn 已不可续接，则 `thread/resume` 后开一个新的继续 turn。该路径带线程级冷却，避免重连抖动重复开 turn；普通 `turn/start` / `turn/steer` 仍不做通用 RPC 自动重试，防止重复提交。PWA shell cache 升级到 `codex-mobile-shell-v280`，更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开。

- 中文说明：v279 修正 v278 后 active turn Stop 长按语音可以录音但转写回写被判定为“当前输入框不可写”的问题。Codex 嵌入态现在把“普通 composer 可写”和“当前 active turn 可接收引导文本”拆成独立判断；即使输入框在 Stop 状态下被临时标记为不可编辑，Home AI 语音转写结果仍可写入 composer，并切换为“引导”发送。PWA shell cache 升级到 `codex-mobile-shell-v279`，该修复是静态前端资源变更，不要求重启 Codex listener。

- 中文说明：v278 修正 Home AI 嵌入态 Codex active turn 的 Stop 长按语音入口。嵌入态正在运行时，Stop 按钮不再把可见文字直接放进按钮 DOM，而是使用不可选中的视觉代理；长按会先阻止 iOS 文本选择和后续 click，再交给 Home AI 语音录入，轻点仍可中断当前 turn。Standalone Codex Mobile 行为保持不变。PWA shell cache 升级到 `codex-mobile-shell-v278`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：server-only 合并 public PR #64 并收窄本地文件预览授权。文件预览现在在处理当前请求的 `path` 时优先做定向匹配，避免为大型 rollout 全量枚举所有本地路径导致卡死；只会授权 Workspace/root 内文件，或确实出现在当前线程文本中的单个本地文件，不会因为 URL 参数携带绝对路径就读取任意本机文件。未引用文件、敏感路径段、非支持扩展名和上传/runtime/private 文件仍按原规则拒绝。本次不改变 PWA shell cache，public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v275 增加 PWA 白屏自恢复页。`index.html` 内联一个不依赖 `app.js`、外部 CSS 或 service worker 的启动兜底面板；如果页面脚本启动失败或 4.5 秒后仍没有显示主界面，用户会看到“清理缓存并重载”按钮。该按钮会删除 `codex-mobile-shell-*` cache、注销当前 service worker，并带 cache-bust 参数重新加载，覆盖 PWA shell 资源错配和 iOS 重开后仍复用坏缓存的场景。正常启动后 `app.js` 会关闭该恢复页。PWA shell cache 升级到 `codex-mobile-shell-v275`。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：server-only 合并 public PR #62，允许被记录为 `projectless-thread-ids` 的项目外线程在 app-server 后续报告临时工作区 cwd 时继续显示。这样通过临时插件工作区或项目外上下文产生的线程，不会因为携带临时 cwd 而被当前 Workspace 过滤隐藏；未登记的临时 cwd 线程、归档线程和子 agent 线程仍按原规则隐藏。本次不改变 PWA shell cache，public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v274 public CI 追补只修正测试 harness，不改变运行时代码。Public CI 使用全量 `npm test`，这次把遗漏的账号切换 UI 断言和 shell cache 断言同步到 v274，覆盖 `预检中...`、`重启中...`、`失败` 等行内状态，以及 `codex-mobile-shell-v274`。本次 public 发布仍只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v274 修正 Codex 账号切换和认证失败反馈。账号切换会先预检目标 `CODEX_HOME`，临时 app-server WebSocket 连接会在预检窗口内重试，避免服务还没开始监听就误判失败；设置面板的目标账号行会显示 `预检中...`、`重启中...` 或 `失败`，前端等待窗口放宽到 90 秒。发送消息时如果 Codex 账号 token 失效，服务端会返回稳定 `codex_account_auth_invalid`，前端会把失败原因显示在该次用户消息下面的回执里，而不是只写到右上角状态框。PWA shell cache 升级到 `codex-mobile-shell-v274`。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v273 修正长时间 Home AI 线程里空 `inProgress` turn 导致的假运行状态。前端现在会跳过没有任何 item 的 active tail，把 Stop/引导/侧聊排队/运行框状态绑定到最新有内容的 turn；线程已 idle 时 Composer 不再误显示 Stop。live turn 的用户消息过滤也改为按时间语义处理：turn 开头的正式输入保留显示，中途引导只在后续已有 Codex 文本回应时保留，未回应的尾部历史 durable userMessage 继续隐藏，避免进入线程时看到旧输入卡在底部。PWA shell cache 升级到 `codex-mobile-shell-v273`。

- 中文说明：v272 修正 v271 后续场景：当服务端 durable userMessage 回投影没有保留 `clientSubmissionId` 时，本机会话刚发送的消息会在模型开始回复后被误判成历史用户消息并隐藏。前端现在会在同线程内按最近提交的消息内容签名兜底匹配，继续隐藏进入长时间运行线程时已有的旧用户提问，同时保留当前刚提交的用户气泡。PWA shell cache 升级到 `codex-mobile-shell-v272`。

- 中文说明：v271 修正发送大段内容后，消息先显示、随后在 live turn 出现模型中间信息时消失的问题。前端现在会记录本机会话刚提交的 `clientSubmissionId`，durable userMessage 回放匹配到当前提交时不会被“隐藏历史用户气泡”的规则过滤；该规则仍会隐藏进入长时间运行线程时已经存在的旧用户提问。PWA shell cache 升级到 `codex-mobile-shell-v271`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v270 调整左滑侧边聊天 composer。底部输入行回到和普通线程 composer 一致的 `+ / 输入框 / Send` 结构，清空按钮移到侧聊标题栏右侧；侧聊 textarea 会像主线程输入框一样随换行自动增高，并在键盘紧凑态遵守最大高度，避免清空按钮挤占输入空间。PWA shell cache 升级到 `codex-mobile-shell-v270`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v269 修正进入长时间运行线程时重复看到旧用户提问气泡的问题。当前 live turn 已经有 assistant/reasoning/Command 等执行进展后，前端不再把 rollout 中早已存在的 durable userMessage 重新渲染成主消息卡；只有刚刚本地提交、尚未确认的 pending/optimistic 输入会短暂显示。完成后的历史 turn 仍保留真实用户输入。PWA shell cache 升级到 `codex-mobile-shell-v269`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：server-only 合并 public PR #61，增加 Windows 系统启动支持。`install-codex-mobile-web-startup.ps1 -RunAsSystem -UserProfilePath <profile>` 可把 `Codex Mobile Web` 注册为 `SYSTEM` 启动任务，在用户未登录时也能启动 8787 listener；windowless launcher 会把 `USERPROFILE`、`HOME`、`APPDATA`、`LOCALAPPDATA`、`TEMP` 和 `TMP` 映射回目标用户 profile，避免 Codex home、runtime、mux 和 Codex CLI 路径漂到 `systemprofile`。系统任务下的 `/api/restart/shared-chain` 会先同步创建并启动短生命周期 `SYSTEM` helper task，再由 helper 执行真实 shared-chain 重启，避免主任务停止时杀掉自己的重启 helper；普通 user-logon/手动 Windows 启动仍使用原有 hidden PowerShell restart 路径，不要求注册 `SYSTEM` helper。该修复不复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断，本次不改变 PWA shell cache。

- 中文说明：server-only 合并 public PR #59，允许预览当前会话明确引用过的本地文件。文件预览仍要求认证、绝对路径、受支持扩展、敏感文件/目录 denylist 和大小限制；不在当前 workspace/Obsidian vault/显式 roots/Codex skills roots 下的文件，只有当它的精确路径出现在当前 thread rollout 文本中时才会被授权预览，且不会因此开放同目录 sibling 文件、整个 `.codex` 状态目录、runtime state、上传目录、本地密钥或机器诊断目录。本次不改变 PWA shell cache。

- 中文说明：v267 修正移动端偶发进入 Codex 白屏或恢复时卡在 Loading 的防护缺口。启动阶段 `/api/public-config` 增加 timeout、重试和最终恢复提示；移动端 `pageshow/focus` 恢复时遇到 iOS/Chrome 常见 transient `Load failed` 不再打断整个页面，而是记录 bounded client event 并延迟重试；线程切换 Loading 超过阈值会记录 `thread_switch_stall` 便于后续定位。PWA shell cache 升级到 `codex-mobile-shell-v267`。

- 中文说明：v266 修正右上角本轮运行框过度显示“思考”的问题。当当前 live turn 中同时存在未完成 reasoning 和未完成 Command/File/Tool/WebSearch 时，运行框优先显示最新未完成操作状态；只有没有未完成操作时才显示“思考”。PWA shell cache 升级到 `codex-mobile-shell-v266`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v265 修正侧边聊天空内容时 composer 顶在上方的问题。侧聊 section 明确占满侧边面板高度，空 transcript/candidate 区域保留可伸展 scroll 区，composer 固定落在面板底部。PWA shell cache 升级到 `codex-mobile-shell-v265`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v264 修正部分线程右上角本轮运行框仍停在“同步 0”的问题。live turn 判定不再只依赖 turn.status；当最新 turn 内存在未完成 reasoning 或 Command/File/Tool item 时，也按 live turn 处理，并从 turn 或 active item 的 startedAt 时间回退计算计时。PWA shell cache 升级到 `codex-mobile-shell-v264`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v263 修正右上角本轮运行框的活动状态优先级。线程刷新/轮询产生的“同步”不再覆盖当前 live turn 中真实的“思考 / 命令 / 文件 / 工具 / 输出”状态；运行框会优先从当前未完成 reasoning 或 operational item 推导显示内容。PWA shell cache 升级到 `codex-mobile-shell-v263`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v262 简化线程页 live Command/File/Tool 命令框的高度控制。命令框默认保持一行折叠态，只显示向上箭头用于展开；展开后按钮变为向下箭头，用于收回一行。移除“1行 / 3行 / 展开”的文字按钮和默认三行状态。PWA shell cache 升级到 `codex-mobile-shell-v262`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v261 修正线程页 live Command/File/Tool 命令框的固定区域和高度控制。命令框作为 conversation 和 composer 之间的不透明独立布局区域，不覆盖消息正文；默认显示三行（状态行 + 两行 detail），可切到一行 compact 状态，也可展开查看更多 detail，支持按钮切换和上下滑手势。PWA shell cache 升级到 `codex-mobile-shell-v261`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v259 完善侧边聊天和线程命令框。侧聊面板打开和刷新后默认贴到底部；清空按钮固定放在下方输入行；存为候选和排队成功后会显示可操作提示，并提供“打开候选/打开队列”入口定位到对应候选。线程页 live Command/File/Tool 命令框继续保持全屏唯一、只显示最新一个，并固定在 composer 上方，两行截断显示。PWA shell cache 升级到 `codex-mobile-shell-v259`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v258 调整运行态 Command/File/Tool 工具框为底部固定 dock。最新 live operation 不再插入正文流里随消息往上跑，而是固定在 conversation 底部显示；detail 区域从约三行缩到约两行，减少阅读遮挡和中间状态抖动。PWA shell cache 升级到 `codex-mobile-shell-v258`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v257 稳定中间命令/文件/工具状态卡和流式消息渲染。运行中的 `.live-operation` 命令卡始终保留约三行 detail 区域，避免 Command/File/Tool 状态条随内容有无上下跳动，并取消该运行态卡片新增时的入场动画，减少中间状态刷新时整屏闪动；运行中 assistant 文本 delta 会优先局部 patch 当前消息卡。PWA shell cache 升级到 `codex-mobile-shell-v257`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v256 修复线程详情投影模式下看不到 Codex app-server 权限批准卡的问题。线程详情 API 现在会把当前线程相关的 pending `serverRequest` 以压缩后的 public approval payload 一并返回，前端加载线程时会同步到现有 approval 渲染栈；即使 EventSource 时序错过，也能看到“权限需要批准”等卡片并完成批准。PWA shell cache 升级到 `codex-mobile-shell-v256`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。

- 中文说明：v255 调整左滑侧边聊天底部布局。侧聊输入区改为和普通线程 composer 同构的 `+ / 输入框 / Send` 底栏，低频的“存为候选”和“清空”收进 `+` 工具行；最新侧聊回执下方直接附“发送主线程 / 完成后发送 / 存为候选”等动作，避免底部长期显示大块操作按钮。PWA shell cache 升级到 `codex-mobile-shell-v255`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v254 调整左滑侧边聊天布局。侧聊面板改为覆盖当前线程详情的全屏面板；只有当前线程存在 Subagent 状态时才显示上半区，空 Subagent 不再占用空间；侧聊标题、消息、候选、按钮和输入框改为继承当前字体大小设置，特大字体在侧聊里不再退回小字。PWA shell cache 升级到 `codex-mobile-shell-v254`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v253 让左滑侧边聊天从“便签/候选保存”升级为当前线程的私有方案聊天。发送侧聊消息后，服务端会为当前主线程创建或复用一个隐藏 sidecar Codex thread，以当前线程的模型/推理设置和工作目录上下文启动只读回复；回复只写回侧聊 transcript，不会自动进入主线程、不会 `turn/steer` 当前 turn，也不会直接改代码。用户仍需显式点“发送主线程”或“完成后发送”才会把候选指令注入主线程。隐藏 sidecar 线程会从普通线程列表和完成通知中过滤。PWA shell cache 升级到 `codex-mobile-shell-v253`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v253 合并 public PR #58，修复移动端键盘聚焦时 Composer 被 iOS 页面滚动顶到可视区域上方的问题。普通 Mobile/PWA 模式不再把 `window.scrollY` / document scroll 当成键盘 viewport offset；输入框聚焦后若 iOS 自动滚动 document，前端会把 window/body scroll 归零，避免和 `--app-height` 收缩叠加。Hermes embed 场景仍保留 host keyboard、safe area 和 iframe scroll offset 逻辑，不改变宿主下发键盘信息的处理。PWA shell cache 升级到 `codex-mobile-shell-v253`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端资源。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v252 修复左滑侧边聊天在嵌入插件模式下被键盘遮挡的问题。侧聊面板现在高于主 composer，并在 `keyboard-open` 时按宿主下发的 `--app-height` 收缩为键盘紧凑布局，降低 Subagent 上半区和侧聊 textarea 的最小高度，确保正在输入的侧聊内容保持在键盘上方。PWA shell cache 升级到 `codex-mobile-shell-v252`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v252 合并 public PR #57，优化 Codex Mobile 浅色主题。浅色模式和跟随系统浅色模式的背景、面板、边框、代码块、引用、Usage 摘要、更新状态、按钮和当前线程选中态改为更柔和的低阴影配色，减少移动端长时间阅读时的冷灰和高对比噪声；用户消息、Usage 细分卡片、Fast 开关、Public PR/更新提示等控件在浅色主题下也有更一致的边界和状态色。PWA shell cache 升级到 `codex-mobile-shell-v252`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新前端样式。本次 public 发布只包含公开源码、README 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v251 修复图片投影和用户上传图显示问题。历史/投影线程的 `imageView` / `imageGeneration` 会在 receipt-only 压缩模式下保留，不再只剩最新 turn 的 tool-generated 图片；无 turn_id 的 tool output 图片会优先按时间窗口归属到对应 turn。用户上传图如果被 app-server 回放为 `input_image.image_url` 本地 uploads 绝对路径，前端会改走受认证保护的 `/api/uploads/file`，不会把本地路径直接塞进 `<img>`。图片 URL 还会在插件 session key 变化后重渲染，避免旧 auth key 导致破图。PWA shell cache 升级到 `codex-mobile-shell-v251`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v250 同步 public PR #56，增强 GitHub 链接预览卡片。Markdown 中的 GitHub 链接不再自动追加多张完整预览卡，而是在链接附近显示紧凑的 GitHub 预览按钮；用户展开后才请求 `/api/link-previews/github` 并渲染完整卡片，收起后会隐藏卡片，减少移动端长回复里的视觉噪声和网络请求。预览按钮会显示 repo、Issue/PR/commit 摘要，加载失败或不支持时显示安全 fallback 链接；自动链接识别也覆盖括号、引号、冒号等常见前缀后的 GitHub URL。本次 private 反向同步来自 public 发布 `f994783`，没有复制 public 以外的 runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v250 新增当前线程侧边聊天第一版。线程详情左滑面板现在分为上半区 Subagent 状态、下半区侧边聊天；侧聊草稿、消息、候选指令和排队状态全部由服务端按线程保存，不使用浏览器本地存储做持久化。侧聊内容默认不会进入主线程，也不会 steer 正在运行的 turn；用户显式发送候选时才通过新的服务端 apply 路由启动主线程 `turn/start`，选择“完成后发送”时会在当前 turn 完成后幂等地发送一次。PWA shell cache 升级到 `codex-mobile-shell-v250`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v249 修复 Hermes 宿主嵌入模式下移动端 composer 底部安全区在窄屏 media rule 中被覆盖的问题。嵌入态 composer 现在统一使用 `max(12px, var(--host-bottom-safe-area, 0px))`，确保宿主隐藏底部 chrome 时 Codex 仍吃到宿主下发的安全区。PWA shell cache 升级到 `codex-mobile-shell-v249`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。

- 中文说明：v248 合并 public PR #55，优化移动端 Markdown 与 Mermaid 渲染。普通文本/上传摘要里的 fenced Markdown 表格会优先渲染为可横向滚动的表格预览，并保留可展开源码；command output 中检测到的 Markdown 表格也会在原始输出 details 前显示预览，方便在手机上直接阅读结构化结果。Mermaid 规范化会合并 `A[标题]<br/>(补充)` 这类软换行标签，减少移动端图表解析失败；Mermaid 画布、表格和代码块横向滚动区域会阻止误触发子线程侧滑面板。PWA shell cache 保持 `codex-mobile-shell-v247`；已打开的浏览器/PWA 只需普通刷新或等待前端资源刷新后生效。本次 private 反向同步来自 public 发布 `e75ec78`，没有复制 public 以外的 runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v247 修复移动端发送消息后短暂出现两条用户消息的问题。前端 live `item/completed` 阶段会立即把 `mux-user-*`/本地 pending echo 和 app-server durable userMessage 合并；服务端线程详情投影缓存也会折叠同一条用户消息，避免后续轮询或刷新窗口再次带回重复卡片。PWA shell cache 升级到 `codex-mobile-shell-v247`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。
- 中文说明：v246 合并 public PR #53，优化移动端消息定位与 Usage 卡片展示。线程打开、提交新消息、同签名重渲染和 viewport 变化会使用有时限的底部跟随，正在流式输出的最新回复会延长跟随窗口，同时保留用户主动上滑阅读时的暂停逻辑；完成事件不再强制跳到长回执开头，而是保持最新回复可见，并继续提供回到本轮总结的浮动按钮。Usage 卡片改为默认折叠的摘要条，展开后显示 Context Window、thread total、rollout、最近 turn 输入/输出、cached/reasoning 子项以及 workspace context/handoff 文件大小，展开时会自动微调滚动位置避免卡片底部被 composer 遮挡。PWA shell cache 升级到 `codex-mobile-shell-v246`，已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新资源。本次 public 发布只包含公开源码、README、测试和去除图片元数据后的 PR 展示截图；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。
- 中文说明：v220 收紧 Hermes 插件模式下的 SSE 断线恢复。`/?embed=hermes` 中如果 `/api/events` 短暂断开但 `/api/status` 和普通 JSON API 仍可用，客户端会在后台静默刷新线程列表并按退避节奏重试 EventSource，不再把列表页状态直接打成 `Reconnecting`，也不再用非静默列表加载造成“connected -> reconnecting -> connected”后的可见列表刷新。PWA shell cache 升级到 `codex-mobile-shell-v220`，更新后需要部署静态资源并刷新客户端。
- 中文说明：v219 同步 public PR #49，修复 Mermaid 预览渲染边界。Mermaid 大图的横向滚动范围现在从正常左边界开始，不再因为 flex 居中产生左侧内容裁切；较小图仍会在预览区域内居中显示。前端 Mermaid 规范化也会把未加引号的中文/括号 `subgraph` 标题转换为稳定 id + quoted title，减少 `subgraph 可见层（不是模型上下文原样）` 这类图表解析失败。本次 private 同步来自 public 发布 `09b1646`，没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v219 收口刷新提示和 Public PR 工作线程。页面刷新提示现在只在服务器 `clientBuildId` / `shellCacheName` 表示 app-shell 真正更新时出现；单纯静态资源 `buildId` hash 变化只更新内部记录，不再触发可见提示，避免开发或部署中间态反复弹“New version”。Public PR 提示确认后会优先复用当前 workspace 下标题为 `Codex Mobile Public PR` 的固定工作线程；找不到才创建新线程，并把新线程初始标题固定为该名称，减少每次 PR 检查后都要手动归档一次性线程。PWA shell cache 升级到 `codex-mobile-shell-v219`，更新后需要重启 8787 Node listener 并刷新客户端。

- 中文说明：v218 合并 public PR #48，新增移动端 Mermaid 图预览。Markdown 中的 ```mermaid 代码块会渲染为可缩放图表，手机和 iPad 可打开全屏预览、放大/缩小/重置，并保留可展开的 Mermaid 源码；Hermes 嵌入模式也把 Mermaid 预览作为可返回的 modal 状态处理。前端同时增强硬刷新：侧栏提供“硬刷新”按钮，刷新时会清理 `codex-mobile-shell-*` 缓存、重新注册 service worker，并用 cache-bust URL 重新加载页面。PWA shell cache 升级到 `codex-mobile-shell-v218`，Mermaid runtime 以 public-safe 的同源 `public/vendor/mermaid.min.js` lazy-load 方式随仓库发布。本次 public 发布只包含公开源码、文档、测试和 vendored 前端依赖；没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- 中文说明：v216 同步 public PR #46/#47 到 private。刷新提示现在只比较真实 app-shell build 信息，不再把普通 `version` 当作客户端 build id；`/api/public-config` 每次请求都会读取当前 shell build，避免旧启动快照和磁盘静态资源不一致时反复提示刷新。Composer 左侧 Fast 开关从红绿状态点改为闪电图标按钮，开启态用高亮闪电显示，文案统一为 `Fast mode on/off`。PWA shell cache 升级到 `codex-mobile-shell-v216`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v215 澄清目标弹窗里的 token 口径。目标状态条现在显示 `budget tokens`，表示 Codex app-server 在 `thread_goals.tokens_used` 中维护的目标预算计数，通常接近非 cached input 加输出等预算消耗口径；它不是 rollout 原始 `totalTokens` 总和，也不是完整上下文窗口 token。PWA shell cache 升级到 `codex-mobile-shell-v215`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v214 扩展 `/g` 目标弹窗。当前线程已有未完成目标时，重新输入 `/g` 会显示目标状态和动作区；Continue 会把 paused/blocked 目标恢复为 active，Pause 映射为 app-server 的 blocked 状态，Cancel goal 会通过官方 `thread/goal/clear` 取消目标，Save 继续通过 `thread/goal/set` 修改目标内容或 token budget。PWA shell cache 升级到 `codex-mobile-shell-v214`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v213 server-only 追记修复 Usage 在投影压缩路径中的丢失问题。投影快路径现在会先合并线程摘要中的 rollout path 再进入移动端压缩，确保 target-turn Usage 扫描能找到源 rollout；receipt-only 的旧 turn 压缩也会保留 `turnUsageSummary` 元数据，只去掉旧中间过程。该追记不改变 PWA shell cache，更新后需要重启 8787 Node listener。
- 中文说明：v213 增加完成态 Usage 自愈刷新。当前线程最新成功完成 turn 如果已经结束但本地状态仍没有 `turnUsageSummary`，前端会进行有限次数的详情 backfill refresh，直到 API 合并出 Usage 或达到次数上限；这用于覆盖 completion 后固定刷新时间点仍早于 Usage/投影稳定的情况。`interrupted`、failed、cancelled、active、in-progress turn 不会触发该自愈路径。PWA shell cache 升级到 `codex-mobile-shell-v213`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v212 修复 v211 后发现的 Usage 刷新兜底问题。服务端 target Usage cache 命中时现在也会检查当前返回的 turn id 是否缺 Usage；缺项时不会直接返回旧缓存，而会继续走 rollout 补扫。前端 `turn/completed` 后会安排两次线程详情刷新，避免第一次刷新早于 Usage/投影稳定时停留在“回执已完成但没有 Usage”的画面。PWA shell cache 升级到 `codex-mobile-shell-v212`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v211 修复 v210 后发现的完成态补偿问题。线程详情 Usage 读取现在会用当前返回的 turn id 做定向补扫；当固定 rollout tail 已经被后续输出挤出目标 turn 的 `token_count` 时，服务端会在运行时扫描上限内补读 rollout 并只保留 token 摘要，避免刚完成或最近已完成 turn 的 Usage 卡消失。长回执定位也会在完成后的线程刷新阶段再次检查：如果 `turn/completed` 事件当下只带了短 payload，后续刷新补齐完整最终回执后会自动定位一次到回执开头。PWA shell cache 升级到 `codex-mobile-shell-v211`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v210 修复完成回执后的定位和合并问题。`turn/completed` 现在会保留一个可跳回最终回执开头的锚点，即使用户已经点向下箭头沉底，也不会把这个锚点清掉；向上箭头仍只在回执开头位于视口上方时显示。线程详情动态投影把完成事件当作补丁合并，避免较短的完成 payload 覆盖掉已流式累计的 assistant 回执；同一 turn 的 `Usage` 卡也会合并为一张，避免出现两个内容不同的 Usage 框。`interrupted`、failed、cancelled、active 或其他未完成 turn 即使 rollout 里已有 `token_count`，也不会渲染完成 Usage 卡，避免把未写出最终回执的 turn 误看成“回执消失”。PWA shell cache 升级到 `codex-mobile-shell-v210`，更新后需要重启 8787 Node listener 并刷新客户端。
- 中文说明：v209 server-only 增加线程详情动态投影索引。服务端会先查 `projection-dynamic` / `projection-cache`，命中时不再等待大 rollout 的完整 `thread/read`；投影由完整详情读取 seed，并在原始 app-server notification 到达时实时追加 `item/started`、`item/completed`、agent/reasoning 文本增量、command/file 输出增量。rollout size/mtime、summary updated/status、turn 窗口和投影策略版本变化会让旧投影失效；miss 时仍回退到现有完整 `thread/read` 路径。该修复不改变 PWA shell cache，更新后需要重启 8787 Node listener。

- 中文说明：v208 server-only 调整线程详情裁剪策略：当前 live turn 会保留全部 compact command/tool/file/search/reasoning 中间过程；如果存在 live turn，它前一个已结束 turn 也会保留这些中间信息，方便刚结束后回查；如果没有 live turn，则最新已结束 turn 保留中间信息。更早的 older-history turn 只保留用户问题和最后一条 assistant/plan 回执，避免旧历史把大量过程重新带回浏览器。该修复不改变 PWA shell cache，更新后需要重启 8787 Node listener。
- 中文说明：v207 server-only 修复 v206 把线程详情主路径切到 bounded `thread/turns/list` 后丢失 command/tool/file/search 中间信息的回归。`/api/threads/:id` 恢复为先用完整 `thread/read` 读取并裁剪到最近 `CODEX_MOBILE_THREAD_TURNS` 个 turn；`thread/turns/list` 只在 `thread/read` 失败或超时时作为 fallback。该修复不改变 PWA shell cache，更新后需要重启 8787 Node listener。
- 中文说明：v206 减少从其他 App 切回后的线程详情重刷。当前线程已经加载且不是运行中、加载中、错误状态，也没有从线程列表看到更新时，前台恢复只做状态、线程列表和 SSE 恢复，不再重新读取整个详情；运行中线程仍会继续通过现有轮询/合并路径刷新。PWA shell cache 升级到 `codex-mobile-shell-v206`。
- 中文说明：v205 修复 Hermes 插件宿主域名切换后 Codex 线程详情右滑退出宿主的问题。嵌入模式发送 `codex-mobile.plugin.navigation` 和 `back_result` 前，会优先使用当前 iframe 的实际 `window.parent.location.origin`；只有无法读取父窗口 origin 时，才回退到 launch session 返回的 `hermes_origin` 或 referrer。这样宿主 HTTPS 域名从旧域名切到新域名后，线程详情仍能把 `canGoBack=true` 发给宿主，右滑返回 Codex 线程列表而不是退出到 Hermes。PWA shell cache 升级到 `codex-mobile-shell-v205`。
- 中文说明：v204 增加 app-shell 刷新策略 harness，并修复部署中间态导致的刷新循环。当前浏览器脚本如果已经是较新的 `codex-mobile-shell-vNNN`，而 8787 listener 的 `/api/public-config` 仍停在旧启动快照，前端会把它识别为需要重启 listener 的中间态，不再反复提示“刷新客户端”。只有服务端 shell 明确更新于当前脚本时，Standalone 才显示手动刷新入口，Hermes embed 才请求宿主刷新。PWA shell cache 升级到 `codex-mobile-shell-v204`。
- 中文说明：v203 改善 Hermes 嵌入模式下的 EventSource 断线恢复。`/api/events` 短暂断开但普通 JSON API 仍可用时，前端会用 `/api/status`、线程列表和当前线程详情进入降级轮询，并按退避节奏重试 SSE；不再反复把顶部活动提示标成“重连”，也不会在 API 健康时弹刷新入口。PWA shell cache 升级到 `codex-mobile-shell-v203`。
- 中文说明：v202 修复 subagent 结束后线程列表残留 UUID-only 线程的问题。服务端 rollout-session fallback 现在会读取 `session_meta.payload.agent_nickname` / `agent_role`，在线程列表最终合并后再次执行归档、subagent 和裸 UUID fallback 过滤；如果一个 Mobile fallback 摘要在 `session_index.jsonl` 补名后仍没有真实标题、且状态不是 live，就不会再显示成点不进去的历史残留线程。该修复是 server-only，不改变前端 PWA shell cache；更新后需要重启 8787 Node listener 才会生效。
- 中文说明：v201 放宽 `/g` 目标 objective 的长度上限。目标对话框输入框、Mobile Web 服务端转发到 `thread/goal/set` 的 objective、以及 `goals_1.sqlite` fallback 公开显示都从原来的短限制提高到 4000 字符，避免粘贴较长目标时被浏览器或服务端截断。PWA shell cache 升级到 `codex-mobile-shell-v201`。
- 中文说明：v200 修正 v199 的长回执仍会先流式刷新到阈值的问题。普通纯聊天回复仍可流式显示；但当前 live turn 里已经出现命令、文件、工具或搜索操作后，后续 `agentMessage` 会被视为最终回执，前端从第一段 delta 起只缓存不重绘，等 `turn/completed` 后一次性渲染完整回执；长回执仍会停在回执开头。PWA shell cache 升级到 `codex-mobile-shell-v200`。
- 中文说明：v199 修复 v198 热更后的运行中线程空白回归。运行中 `agentMessage` 会继续正常显示；只有当最新 live 回复超过长回执阈值后，前端才停止继续逐 token 重绘，保留已显示的前段，等 `turn/completed` 后一次性渲染完整回执并停在回执开头。PWA shell cache 升级到 `codex-mobile-shell-v199`。
- 中文说明：v198 将移动端线程详情首屏从 80 个 turn 调整为最近 10 个 turn；当用户滚动到顶部附近时，客户端会按每页 10 个 turn 自动加载更早历史，并保持当前阅读位置不跳动。最新 live turn 的长最终回执不再逐字流式渲染；完成后一次性显示，如果回执较长，视口停在该回执开头，用户可向下阅读或点向下箭头直接沉底。PWA shell cache 升级到 `codex-mobile-shell-v198`。
- 中文说明：v197 取消 32MB 以上线程详情的默认特殊路径。线程详情现在不再因为
  rollout 大小主动跳过 `thread/read`；客户端进入线程仍保持贴底。只有 `thread/read`
  真实失败时，服务端才会降级到 bounded `thread/turns/list`。PWA shell cache 升级到
  `codex-mobile-shell-v197`。

- 中文说明：v196 曾尝试让大 rollout 线程进入时停在最近历史窗口顶部；该行为已在 v197
  回滚，当前客户端进入线程仍保持贴底。

- 中文说明：Task card composer 命令现在以非空 `#` 开头即可进入单卡发送模式；裸
  `#` 不会触发空卡。`#自由协作` 继续作为兼容入口，并默认请求 autonomous workflow。
  大 rollout 线程详情仍默认快速读取最近 8 个 turn，但会保留 `thread/turns/list`
  游标，手机端可继续加载更早历史；展开后的旧 turn 不会被下一次普通刷新立即丢弃。
  PWA shell cache 升级到 `codex-mobile-shell-v195`。
- 中文说明：Hermes/profile quota v193 修正 Mac LaunchDaemon 场景下的托管
  `codex app-server` 账号继承问题。Mobile Web 现在会把解析后的 active
  `CODEX_HOME` 显式传给子进程，避免 `/api/status.codexHome` 已经是所选
  profile、但额度仍来自旧服务环境账号。Hermes 嵌入模式的
  `server_build_changed` 刷新请求也会按签名去重，避免旧缓存 iframe 对同一
  build mismatch 反复要求宿主刷新。PWA shell cache 升级到
  `codex-mobile-shell-v193`。

- Hermes/profile quota v192 keeps multi-account quota isolated when profile
  homes share thread state. The server no longer hydrates quota from shared
  rollout files, shared-profile homes also ignore source-less live quota
  snapshots, but they can display non-persistent live quota emitted by this
  listener's own managed child app-server. Profile quota cards only persist and
  reuse account-scoped live snapshots, and the browser clears stale local quota
  cache when `/api/public-config` or `/api/status` reports no valid quota
  snapshot. PWA shell cache upgrades to `codex-mobile-shell-v192`.

- Hermes embed v191 adds an iframe-owned left-edge swipe guard for iOS. When a
  Codex thread/detail/new-thread secondary page can go back, the iframe now
  handles that gesture with the same `hermes.plugin.back` path and returns to
  the embedded thread-switcher/settings primary page, even if the host page does
  not receive the initial touch sequence from inside the iframe. PWA shell cache
  upgrades to `codex-mobile-shell-v191`.

- 中文说明：Hermes Mobile 插件里的线程详情页现在会在线程 id 选中后立即发布
  `canGoBack: true`，即使详情内容还在加载中，iOS 右滑也应先回到 Codex
  插件内的线程列表/设置一级页，而不是直接退出到 Hermes Mobile。PWA shell
  缓存升级到 `codex-mobile-shell-v190`。
- Home view shows recent workspaces and recent threads.
- The Workspace dropdown ends with a `Create Workspace` action. It creates or
  registers a simple local folder under an allowed parent, stores only bounded
  metadata in `%USERPROFILE%\.codex-mobile-web\workspace-registry.json`, selects
  the new cwd, and opens a new-thread draft. Configure allowed parents with
  `CODEX_MOBILE_WORKSPACE_CREATE_ROOTS`; do not edit `.codex` global state for
  this path.
- The sidebar menu header includes a compact settings button. The settings panel contains the theme control (`跟随系统` / `深色` / `浅色`) and the font-size control (`小字` / `标准` / `大字` / `特大` / `超大`) using the same segmented-button style.
- Theme and font-size choices are saved in the browser. Theme updates the page theme color metadata; iOS PWA status-bar color changes may require closing and reopening the installed app. The light theme now uses a slightly warmer page background so the daytime view is less cold gray while cards and controls stay crisp. Font size adjusts conversation text, markdown, code/table content, approval details, and the composer input.
- The composer runtime row starts with a tiny persistent Fast status dot before model/reasoning/permission/quota. Green means normal mode; tapping it turns red, briefly shows `Fast on`, and saves Fast as a thread-local tag in the browser draft store. When that thread starts the next new turn, the browser sends a hidden `fastMode` request so the server forwards Codex's `serviceTier: "priority"` Fast tier. It does not change the selected model, reasoning effort, permission mode, or visible message text, and it does not apply globally to other threads. `#` cross-thread task-card commands keep their bounded draft-request flow; active-turn steering cannot change the speed tier until the next new turn.
- The shell cache advances to `codex-mobile-shell-v139` for the Fast-dot UI.
- The sidebar header also shows the app version/update pill, a public PR status pill, and a same-size `Restart` button. After login, Mobile Web checks the configured GitHub remote in the background. If the remote branch is ahead, the pill becomes an update action; tapping it asks for confirmation, applies only a clean fast-forward update, then exits the Node listener so the existing startup supervisor can restart it from the updated files. The public PR pill checks the clean public repository for open pull requests and prompts whether to prepare a merge/publish review task; it does not merge or push public by itself. The `Restart` button is separate from Git self-update and opens an in-app confirmation panel before restarting the local Mobile Web shared chain. That panel first reads the recent thread list and shows any running sessions that may be interrupted.
- When a conversation is scrollable and the user is away from the newest messages, a floating down-arrow button appears above the composer. Tapping it jumps directly back to the latest turn; normal rendering still avoids forcing the scroll position while the user is reading older content.
- 中文说明：长对话如果因为恢复、切换线程或手动滚动停在历史消息中间，页面会在输入框上方显示“回到底部”浮动按钮。按钮只在当前线程已加载、内容可滚动且不在底部时出现；点击后立即回到最新 turn。用户阅读历史内容时，普通刷新仍不会强制自动滚到底部。PWA/手机浏览器如果仍显示旧界面，需要刷新一次或等待新的 service worker 缓存 `codex-mobile-shell-v36` 激活。
- On phones and tablet portrait/touch layouts, the sidebar menu is not persistent: the main conversation fills the viewport, and the menu opens only after the user taps the top-left menu button. Wide desktop layouts keep the persistent sidebar. On coarse-pointer landscape tablets with enough room, Mobile Web uses a two-column layout with a persistent sidebar and full conversation pane.
- On coarse-pointer landscape tablets, the composer uses a viewport-contained two-row compact layout: runtime indicators and quota on the first row, then attach/input/send on the second row. The split layout constrains both sidebar and main pane height so the composer stays inside the visible app surface.
- On mobile/touch layouts, swiping right from the left screen edge opens the session list without waiting for a network refresh. If the existing session list is newer than 60 seconds, Mobile Web reuses it immediately; older lists open first and then refresh quietly in the background.
- Thread lists and thread detail monitor rollout JSONL size. The mobile thread-list refresh requests a bounded 40-row page by default so startup, foreground resume, and thread switching do not pay the heavier 60/80-row list path when the visible list is small. Cold startup with a saved current thread sets the opening intent before the first app-shell reveal, then starts the saved-thread detail read in parallel with status/workspace/list refresh so users do not first sit on a transient `Select a thread` empty page. Startup emits bounded `startup_stage` diagnostics through `/api/client-events` so the local log can separate public-config, status, workspace, list, detail, and render delays. Resume events that fire during startup only run visual recovery and skip the full network resume path, avoiding duplicate status/list/detail requests while bootstrap is already opening the thread. At the default `200MB` threshold, Mobile Web shows a context-size warning and offers a same-workspace continuation action. The warning can be skipped for the current thread size, and will reappear if that thread grows again past the stored size. Completed turns can also show a lightweight context/token usage summary parsed from rollout `token_count` events: turn-level token use derived from cumulative token deltas across the scoped turn, cumulative token use, model context-window percentage, risk level, and rollout size. In usage summary rows, `in` displays uncached input (`inputTokens - cachedInputTokens`) when cached input is reported, while the context-window percentage still uses raw input tokens. Separately, Mobile Web persists completed-turn token usage into `%USERPROFILE%\.codex-mobile-web\token-usage-stats.sqlite` in real time and aggregates it by Workspace for a compact red sidebar `总/周/今` row. Its `统计` button opens a full-screen stats page with per-day and per-project totals, splitting uncached input, cached input, output, and reasoning output because these token classes have different usage/cost meaning. Token stats display in millions rather than ten-thousands. Thread rows intentionally do not show a per-thread "today token" badge; the list stays focused on thread identity, task cards, and rollout size. Project rows normalize known Windows path mojibake against visible Workspace roots, so historical rows with a garbled cwd are merged under the readable Unicode Workspace name after the server restarts. The sidebar version pill opens an Updates panel: the current-checkout section keeps the existing safe fast-forward Git update path, while the Public release section checks the configured public repository's latest commit and only offers the same update action when the running checkout itself tracks that public repository. After user confirmation, the continuation action first asks the source thread to write a thread-specific handoff file, creates a source-named/date-suffixed continuation thread, sends a scoped bootstrap message, then archives the source thread.

- 中文说明：线程列表里的运行中刷新提示现在有超时兜底。Mobile Web 仍会在 app-server 列表暂时只返回 `notLoaded` 时保留运行提示，避免真实运行中的线程被普通刷新清掉；但如果同一提示超过固定窗口仍没有运行状态或完成事件，且当前线程也没有 active turn，前端会自动清掉这个本地提示，避免任务已经结束后列表仍一直显示刷新中。PWA shell 缓存升级到 `codex-mobile-shell-v181`，已打开的手机/PWA 需要点页面刷新提示、硬刷新或关闭重开后才能拿到这次前端修正。
- 中文说明：服务端 fallback 线程列表现在会从 rollout 尾部的安全事件类型推断 `active` / `completed`，并用 rollout 文件 mtime 修正 fallback `updatedAt`。这修复了 Hermes/远端正在写同一 rollout、但 app-server 列表行仍是 `notLoaded` 时运行中刷新提示不显示的问题，也能在 `task_complete` 后让旧本地提示立即清掉。这是服务端修正，重启 8787 listener 后旧前端也能读取新的状态。
- 中文说明：iPhone / Hermes embed 的底部 composer 现在改为更接近微信底栏的贴底方式。早期手机 composer 底部只留约 `7px`，后续 iOS 安全区适配改为完整叠加 `safe-area` 后在 Home Indicator / Hermes iframe 机型上抬得过高；本次移动端改用 `clamp()` 限制底部安全区保留量，让底栏背景继续铺满到底，但输入框、发送按钮和模型/推理/权限/额度行不再被大 inset 顶到半空。安卓 `safe-area=0` 时仍停在 8px 下限。PWA shell 缓存升级到 `codex-mobile-shell-v184`，已打开的手机/PWA 需要点页面刷新提示、硬刷新或关闭重开后才能拿到这次 CSS 修正。
- 中文说明：线程手动改名现在也会兜底处理 app-server thread-store 的 `database disk image is malformed`。如果底层 `state_5.sqlite` 写标题失败，但 Mobile fallback `session_index.jsonl` 写入成功，改名接口会返回成功并用 fallback 标题刷新列表；这不会修复 SQLite 本体，只避免 Mobile 端改名被已知坏库阻断。
- 中文说明：线程列表现在即使 app-server / `state_5.sqlite` 已经恢复可读，也会继续合并 `sessions/rollout-*.jsonl` 与 `session_index.jsonl` 的本地摘要。这样 recover 后 SQLite 缺少最近线程行时，带 rollout 的线程仍能回到列表；SQLite 行标题为空、退化成 thread id、或把 `Continuation Bootstrap Index` 当作长标题时，会用 `session_index.jsonl` 里的用户命名恢复显示。归档线程仍按 `archived_sessions`、DB 归档标记和备份 rollout 路径过滤，不会因为一条旧 index 记录重新显示。
- 中文说明：`/g` 目标提交现在会处理“旧 goal 已完成但 app-server 仍把 `thread/goal/set` 写回 completed 行”的情况。Mobile Web 在服务端代理层只读检查当前线程 goal；如果状态是 `complete`，先通过 app-server `thread/goal/clear` 清掉旧目标，再调用 `thread/goal/set` 创建新目标，避免前端收到 success 但没有新 goal turn 启动。这个修正是服务端路径，重启 8787 listener 后生效，不需要 PWA shell 缓存升级。
- 中文说明：`/g` 目标对话框里的 objective 输入框现在和主 composer 一样，按 Enter 会提交目标，Shift+Enter 才保留换行；token budget 输入框按 Enter 也会提交，目标 Send 按钮也走显式 `pointerdown` / `pointerup` / `touchend` / `click` 提交，不再只依赖浏览器默认 form submit。此前 objective 是 textarea，Enter 只会插入换行，在 Hermes Mobile 里看起来像“回车后没有任何反应”。已完成的旧 goal 不再作为新 `/g` 对话框默认内容回填，避免重新开目标时看到上一条已完成目标。PWA shell 缓存升级到 `codex-mobile-shell-v189`。
- 中文说明：`/g` 目标提交成功后，前端会立即把刚输入的 objective 和可选 token budget 显示成线程顶部目标卡。这样即使 app-server 接受 `thread/goal/set` 后立刻开始执行任务、但响应体暂时没有返回完整 goal 对象，用户输入的目标也不会从界面上消失；后续 `thread/goal/updated` 通知或 `goals_1.sqlite` fallback 会覆盖这张本地显示卡。PWA shell 缓存升级到 `codex-mobile-shell-v186`。
- 中文说明：`/g` 目标入口现在直接调用 Mobile 后端的 `POST /api/threads/<threadId>/goal`，由服务端转发到 Codex app-server `thread/goal/set`，不再发送一条普通消息让模型自己尝试创建目标。这个能力要求运行中的 app-server 来自 Codex CLI 0.135.0 或更新版本；Windows 启动脚本在未显式传 `-CodexExe` 时会优先选择 `%LOCALAPPDATA%\OpenAI\Codex\bin\*\codex.exe` 中最新的安装版，再回退旧的 `%USERPROFILE%\.codex-mobile-web\codex.exe`。mux endpoint 现在会记录真实 `codexExe`，windowless 启动器复用 endpoint 前会校验它是否匹配本次解析出的 Codex binary，避免继续复用旧 0.129 app-server。PWA shell 缓存升级到 `codex-mobile-shell-v185`。
- 中文说明：线程归档现在还会写入 `%USERPROFILE%\.codex-mobile-web\archived-thread-ids.json` 的 Mobile 本地索引，只保存 thread id 和归档时间。这样 state DB recover 或旧 profile 行重新出现在列表时，重新归档也能被 Mobile 自己的列表过滤识别，不需要依赖 app-server 成功改写那条旧 SQLite 记录。
- 中文说明：压缩续接现在会在新线程 bootstrap 写入成功后迁移源线程的未完成 CLI goal。`active` 目标会复制到新线程并保留 active 状态；源线程会尽量冻结为 `blocked`，避免两个线程同时继续同一个目标。`blocked`/旧 `paused` 目标会复制为新线程的 `blocked` 目标，不会自动开始执行。已完成或非可迁移状态的目标不会复制。迁移只复制 objective 和剩余 token budget，不复制旧线程已经消耗的 `tokens_used` / `time_used_seconds`；所有写入仍通过 app-server `thread/goal/set`，不直接写 `goals_1.sqlite`。
- The continuation bootstrap message explicitly carries source thread metadata, rollout size, inherited runtime settings, the source-thread-generated handoff file, bounded continuation lineage, recent visible turn summaries, and current-workspace `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` excerpts. It does not inject fixed private/public GitHub release rules; those appear only if the current workspace context or source-thread handoff says they are relevant.
- Long-pressing a session row opens a mobile action sheet with rename, continuation, and archive actions. Archive asks for confirmation, calls `/api/threads/<threadId>/archive`, and refreshes the list after success. The row disables accidental system text selection during the long press, while rename input fields still allow normal text selection and editing.
- Agent replies include a `复制全文` action. Markdown code blocks and command/output detail blocks include smaller copy buttons so users can copy structured text without manually selecting content on iOS.

### Rollout 压缩续接

当线程的 rollout JSONL 达到阈值时，界面按钮显示为“压缩续接”。默认提醒阈值是 `200MB`，可用 `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` 覆盖。详情页提示可以点“跳过”暂时隐藏；隐藏记录按“线程 id + 当前 rollout 大小”保存，因此该线程继续增长后会再次提示。确认“压缩续接”后，Mobile Web 会先在旧线程中启动一个交接整理 turn，要求旧线程把本线程真实的交接重点写入当前工作区的 `.agent-context/thread-handoffs/<id>.md` 文件。该文件必须只总结源线程和当前工作区相关的目标、已完成事项、未完成事项、关键文件、验证结果和风险。

线程详情读取不再按 rollout 大小主动跳过完整 `thread/read`。即使 rollout 超过 32MB，Mobile Web 也会先向 app-server 请求完整详情并裁剪到最近 `CODEX_MOBILE_THREAD_TURNS` 个 turn；只有 `thread/read` 真实失败时，才降级到有数量上限的 `thread/turns/list` fallback。这样可以保留 `thread/read` 提供的 command/tool/file/search 中间信息。当前 live turn 会保留全部 compact 中间过程；如果存在 live turn，它前一个已结束 turn 也保留中间信息；如果没有 live turn，则最新已结束 turn 保留中间信息。更早的 older-history turn 只保留用户问题和最后一条 assistant/plan 回执。`CODEX_MOBILE_THREAD_TURNS` 控制移动端 compact detail 首屏、fallback、以及 older-turn 分页大小，默认是最近 10 个 turn。`200MB` 的 rollout 阈值只用于界面提醒和压缩续接动作。

跨线程任务卡片 draft 仍要求模型返回可见目标里的精确 `threadId`。如果模型只把目标线程 ID 的后半段抄错，前端只会在可见线程中存在唯一且足够长公共前缀匹配时，把目标恢复为真实线程 ID；无法唯一恢复时仍会把 draft 标为失败，避免把卡片投递到不确定目标。

旧线程写出交接文件后，Mobile Web 会尽量确认旧线程交接 turn 已完成，然后才创建同工作区的新续接线程，并在首条 bootstrap 消息中带入源线程 ID、标题、工作区、rollout 路径和大小、运行权限摘要、源线程交接文件、续接 lineage、最近源线程上下文，以及当前工作区 `.agent-context/PROJECT_CONTEXT.md` / `.agent-context/HANDOFF.md` 摘录。bootstrap 不再固定注入其他工作区或无关线程的发布/提交规则；只有当前工作区上下文或源线程交接文件明确涉及这些规则时，新线程才应加载它们。前端不会为了发起续接而强制打开源线程，避免源线程过大时先卡在 thread detail 读取；续接任务会通过 job 状态显示当前阶段，手机页面刷新后也会用本地保存的 job id 尝试恢复查询，完成后自动切到新线程。

这个动作不会原地改写或裁剪旧 rollout 文件；它通过“源线程写交接文件 + 新续接线程 + 旧线程归档”降低后续交互需要读取的历史文件体积。旧线程在交接文件生成且续接线程启动成功后才会归档，仍可从归档记录中找回。首条 bootstrap 会要求新线程先读取源线程交接文件，再读取工作区持久上下文，并显式避免确认与当前工作区无关的发布或提交规则。续接成功后，服务端还会把 `newThreadId -> sourceThreadId -> handoffFile` 追加到 `.agent-context/thread-handoffs/index.jsonl`；下一次继续压缩时，bootstrap 会带入最多几层 lineage 摘要，并明确要求 Agent 在历史事实、风险、未完成事项或架构判断不确定时先读取 lineage 指向的 handoff 文件，而不是凭当前上下文猜。

如果源线程有未完成 CLI goal，压缩续接会在新线程 bootstrap 写入完成后把目标复制到新线程。复制范围是 objective、状态和剩余 token budget；旧线程的已消耗 token/时间不迁移。`active` 源目标会在复制后尽量冻结为 `blocked`，`blocked`/旧 `paused` 源目标会在新线程保持 `blocked`，已完成或预算/用量限制等非可迁移状态不会复制。迁移结果会出现在 continuation job/result 和 lineage 的布尔诊断字段里，但 lineage 不写入目标正文。

交接文件和 lineage index 都属于本地运行态资料。创建交接目录时，服务端会在 `.agent-context/thread-handoffs/.gitignore` 写入忽略规则，防止这些自动生成的 Markdown/JSONL 资料被误提交。

线程列表中的任意线程都可以通过长按菜单选择 `归档`，用于直接归档不再需要显示的会话。这个动作会先弹出确认提示，确认后调用 `/api/threads/<threadId>/archive`，成功后刷新列表；如果归档的是当前打开线程，前端会清空当前详情视图并回到未选中状态。线程行左滑不再露出归档按钮；主动压缩续接仍保留在超阈值详情提示和长按菜单动作中。

- The top-right timer shows current turn elapsed time as `本轮 HH:MM:SS`.
- The timer is red while a turn is active and muted after completion.
- During an active turn, the timer may append a compact activity label such as `思考`, `输出`, `命令`, `文件`, `工具`, `搜索`, `同步`, or `等待批准`.
- The timer uses a fixed elapsed-time segment, so activity label length changes do not move the `本轮 HH:MM:SS` text.
- After the latest turn finishes, the timer switches to muted styling and shows `已结束` instead of any in-progress activity label.
- Live reasoning is not rendered as conversation rows.
- Command/file/tool activity appears as compact operation cards. The latest-turn operation card uses a four-line visual budget: one metadata row plus up to three clipped detail lines.
- Operation cards are shown only while the latest turn is still running. After a turn completes, command/tool/file/search cards are removed from the compact mobile detail; when usage data exists, the final frame is the Usage summary.
- Consecutive command/file operation updates show only the latest operation card unless normal visible content appears between two operations.
- The left-swipe Subagent status panel shows Subagents from the current live turn, treating completed/closed spawn-call rows in that live turn as current because the child Agent can still be running after the spawn call closes. Older historical Subagent records are omitted so long-running collaboration sessions do not show hundreds of stale entries.
- Page refresh prompts are gated by a server-started build id and a full app-shell preflight. `/api/public-config` reports the shell cache/build snapshot captured when the 8787 listener started, not whatever files happen to be mid-edit on disk. The browser checks for this after startup, foreground/focus recovery, EventSource reconnect/status, and successful thread-list refresh, then fetches and populates the target shell cache with the new HTML, CSS, JavaScript modules, manifest, service worker, and icons before the prompt is shown; clicking the prompt repeats that check, applies the latest `/api/public-config` quota snapshot to the composer immediately, and reloads only after the target cache is ready.
- The composer shows model, reasoning effort, permission, and quota as four compact runtime cards.
- Model, reasoning effort, permission, and the Fast tag can be changed before sending. Existing-thread sends submit the selected values with the next `turn/start`; new-thread first messages submit the selected values when creating and starting the first turn. A per-thread runtime selection is saved in the browser draft store even when the composer text is empty, so leaving and reopening the app restores the model/reasoning/permission/Fast choice for that thread. After a send, Mobile Web clears only text and attachments; it keeps the runtime-only draft so the composer does not immediately fall back to stale thread metadata while the new turn is starting.
- The composer shows 5-hour and weekly quota as separate reset-aware chips from `/api/public-config` / `/api/status` snapshots for the active Mobile Web chain. Source-less `account/rateLimits/updated` notifications are recorded server-side but not broadcast to the browser, and rollout scans are only a cold-start snapshot fallback, so another workspace's quota event does not overwrite the current composer display. On app-server initialize, Mobile Web also calls `account/rateLimits/read` so a fresh listener can show the current account quota before the next quota notification. A managed child app-server started by the same listener may supply live quota for a shared-profile active home, but that snapshot is not persisted as reusable profile quota. Rate-limit snapshots are cached by model key, mobile quota display follows the currently selected composer model, and clicking the page-refresh prompt also refreshes the visible quota snapshot before the browser reloads.
- The send button follows Codex Desktop behavior: empty composer during an active turn shows `Stop`; typed text or attachments switch it back to `Send`.
- When message submission is slow or fails, the UI shows an explicit sending/failed state, keeps the text and attachments available for retry, and logs a compact client event to `/api/client-events` for diagnostics. Quota/rate-limit failures are normalized into a model-specific "额度不足，请切换模型后重试" message when the backend error text indicates an exhausted limit.
- Composer drafts are saved in the browser per thread and per new-thread workspace. Text uses `localStorage`, attachments use IndexedDB when available, and the submitted draft is cleared only after a successful send.
- The send button has a guarded click path and a short watchdog. If a tap does not submit or a request stalls, Mobile Web reports the condition without forcing a full session reload, reducing the "假死" feeling during network or app-server delays.
- When a background thread transitions from running to completed/unread, Mobile Web can play a short local completion tone or haptic notification in the open browser session. Web Push remains the cross-device/background notification path.
- The message input uses a `contenteditable` textbox instead of a native `textarea` to reduce the extra iOS browser input accessory toolbar. Enter sends; Shift+Enter inserts a newline.
- The web app avoids programmatic composer focus after send, thread switch, refresh, and mobile foreground recovery. Mobile keyboards should open only after the user explicitly taps the message input.
- 中文说明：重新安装 PWA 后，Web Push 按钮会在初始化时从隐藏状态恢复显示，并根据当前环境显示“启用通知”“发送测试通知”“需要 HTTPS”“不支持”或“通知已阻止”。如果按钮提示需要 HTTPS，请确认手机端通过 HTTPS 地址打开；如果提示已阻止，需要到系统/浏览器站点权限里重新允许通知。

### 2026-05-10 Public 发布说明

本次 public 发布同步了最近一批移动端体验和 PWA 稳定性修正，重点是让公开仓库部署者在重新安装 PWA、启用推送和浅色主题使用时获得与当前私有验证版本一致的行为。

- PWA 安装仍保持全屏 `standalone` 模式，并在 manifest 中加入稳定 `id: "/"`、`display_override` 和 `launch_handler` 偏好。支持该能力的浏览器会更倾向于聚焦或导航已有客户端，降低重复打开独立 PWA 窗口的概率；不支持的浏览器会忽略该字段。
- 入口恢复提示保持关闭状态。进入网页/PWA 时不会显示 `Codex / 正在恢复界面 / 继续进入` 之类的覆盖提示，避免正常刷新时被旧页面提示打断。
- Web Push 通知点击逻辑调整为：优先聚焦已有 Mobile Web 窗口；如果必须新开窗口，则先打开 `/`，再通过 service worker 消息把目标线程 id 交给前端切换。这样可以减少 `/?thread=...` 被移动端 PWA 当作新启动目标的机会。
- 重新安装 PWA 后，通知按钮会显式移除初始 `hidden` 状态。按钮不再因为干净安装的 HTML 初始 class 而消失，用户可以继续看到当前通知能力状态并重新注册 Web Push。
- 浅色主题主背景从偏冷灰调整为更暖的浅色底色，并同步早期 `theme-color`，减少进入浅色模式时顶部颜色和页面背景不一致的闪动。
- Public 包版本升到 `0.1.2`，便于已经部署的实例通过更新提示和版本号确认这次发布已经生效。
- Public service worker 缓存升级到 `codex-mobile-shell-v14`。已安装到主屏幕的旧 PWA 可能需要关闭后重新打开，或等待 service worker 激活后再刷新一次，才能完全拿到新的 HTML、CSS、JS 和推送点击逻辑。

### 2026-05-11 Public 发布说明

本次 public 发布合入了 iPad 横屏双栏布局优化。它只改变较宽触控横屏设备上的菜单呈现方式，不改变手机、窄屏、iPad 竖屏和桌面端的主要交互。

- iPad 或类似触控平板在横屏、宽度至少约 `900px` 且高度至少约 `600px` 时，会显示左侧常驻 session/sidebar 和右侧对话区。这样横屏使用时可以直接切换线程，不需要每次点左上角菜单。
- 手机、窄屏窗口和 iPad 竖屏仍然使用抽屉式侧栏；主对话区继续占满屏幕，左边缘右滑和左上角菜单按钮仍按原逻辑打开 session 列表。
- 前端 JavaScript 的“是否抽屉模式”判断与 CSS 断点保持一致，避免横屏平板上 CSS 已经显示双栏、JS 仍按抽屉状态处理的错位。
- 横屏双栏模式下隐藏移动端菜单按钮，减少顶部栏上的重复入口；桌面宽屏的常驻侧栏行为不受影响。
- Public service worker 缓存升级到 `codex-mobile-shell-v15`。已经安装到主屏幕或浏览器缓存中的旧版本可能需要刷新一次，或等待新的 service worker 激活后，才能拿到这次布局 CSS 和前端 JS。

### 2026-05-11 Public 发布说明（续）

本次 public 继续合入剩余移动端改动（PR #14、#15、#16、#17、#19），重点覆盖线程创建入口、移动端交互反馈、线程切换诊断和模型/推理只读策略。

- 新增移动端侧栏“新建对话”入口：可先选 workspace，再发送首条消息创建新会话；workspace 下拉在手机端使用可滚动自定义列表，避免被底部输入区遮挡。
- 运行中追加输入增加“引导”反馈：当当前 turn 正在运行且输入框有内容时，发送按钮显示为“引导”，并提供“引导中/已送达/失败/完成”状态提示，降低误判为卡顿的概率。
- 增加线程切换与恢复诊断事件：记录 `thread_switch_*`、`mobile_resume_slow`、`mobile_resume_error` 等客户端事件，便于和服务端日志对齐分析卡顿位置。
- 手机端 Model/Reasoning 改为只读展示：从当前线程或默认运行时读取显示值，不再在手机端提供可编辑下拉，也不再在消息发送、压缩续接、新建对话首条消息中提交 `model/effort` 字段。
- mux 与 server 增加同步健康日志和日志裁剪，降低长时间运行后的日志膨胀风险并提高排障可见性。
- 本批前端资源较多，public service worker 缓存升级到 `codex-mobile-shell-v16`。已安装 PWA 或命中旧缓存的浏览器需要刷新一次或等待 service worker 激活后再验证最新界面。

### 2026-05-11 Public 发布说明（续二）

本次 public 继续合入 PR #21、#22、#23，重点是 iPad 横屏输入区稳定性、线程切换卡顿优化，以及桌面端错过通知后的补发能力。

- iPad 横屏（粗指针 + landscape）下，Composer 改为两行紧凑布局：第一行展示运行时控制与额度，第二行展示附件/输入框/发送，避免分屏宽度下控件挤压或遮挡。
- 新增横屏输入时的键盘避让逻辑：基于 `visualViewport` 计算键盘占用高度，在平板横屏聚焦输入框时抬升 Composer，减少键盘覆盖输入区的问题。
- 线程切换与刷新链路增加中止控制：切换线程会终止旧的 detail refresh/poll 请求，避免慢请求回写覆盖当前线程，降低“切线程后还在等上一线程返回”的卡顿感。
- 轮询节奏改为分级退避：短时间稳定后自动放慢刷新频率，减少无效请求和前端负担，同时保持活跃线程的及时更新。
- mux 重放策略更新：桌面端现在默认也参与历史通知重放；同时 replay buffer 改为缓存完整通知，再按客户端类型做发送时裁剪，避免桌面端重连后缺失关键 turn/item 事件。
- 新增回归测试：`test/tablet-layout.test.js`、`test/mobile-polling.test.js`、`test/protocol.test.js`，分别覆盖平板横屏布局、切线程中止逻辑、桌面端重放补发行为。
- public service worker 缓存升级到 `codex-mobile-shell-v17`。已安装 PWA 的设备可能需要刷新一次或等待新 service worker 激活后再验证以上改动。

### 2026-05-11 Public 发布说明（续三）

本次 public 合入 PR #18，并按当前指令以 PR 的交互为准：线程列表左滑动作从“压缩续接”改为“归档”。这会覆盖上一版在线程行左滑里提供主动续接的行为。

- 线程列表行左滑后显示 `归档` 按钮。点击后先确认，确认才会调用后端归档接口，避免误触直接隐藏会话。
- 新增 `POST /api/threads/<threadId>/archive`。后端优先通过 app-server `thread/archive` 执行归档；如果线程已经归档、找不到或本地状态已经显示隐藏，会把这类情况视为幂等成功。
- 线程列表过滤增强：服务端会读取 `state_5.sqlite` 中的 archived 状态、`archived_sessions` 目录、以及 `.jsonl.bak/.backup/.old` 这类备份 rollout 路径，把已归档或备份会话从可见列表里排除。
- 前端同步隐藏 `.jsonl.bak/.backup/.old` 备份 rollout，减少弱网络或本地状态回退时重新显示备份会话的概率。
- 保留超阈值详情页里的“压缩续接”流程，也保留长按菜单里的续接入口；本次只改变线程行左滑动作。
- 新增 `test/thread-archive.test.js`，覆盖左滑归档选择器、后端归档路由、以及合并后只保留一个 `mergeThreadStateFromStateDb` 的静态回归检查。
- public service worker 缓存升级到 `codex-mobile-shell-v18`。已安装 PWA 的设备需要刷新或等待新 service worker 激活后，才能看到左滑按钮文案和行为变化。

### 2026-05-11 Public 发布说明（续四）

本次 public 合入 PR #24 和 PR #25。PR #25 已包含 PR #24 的提交，因此以 PR #25 为主合并；PR #24 的 iPad 横屏 Composer 溢出修复也包含在本次提交中。

- iPad 横屏双栏布局再次收紧：左侧栏宽度改为 `clamp(340px, 36vw, 400px)`，主区和侧栏都设置 `min-height: 0` / `max-height: 100%`，避免分屏或横屏时 Composer 溢出可视区域。
- 移除上一版基于 `visualViewport` 的 Composer 键盘抬升逻辑，改为通过稳定的网格高度和容器约束控制布局；这减少了横屏输入时由 transform 引起的额外位移风险。
- Composer 顶部控制区改为固定高度 chip/card 布局：Model 和 Reasoning 合并为一个只读字段，Permission 改为只读字段；手机端不再提交 `permissionMode`，避免移动端运行权限和桌面端线程设置不一致。
- 额度显示从 `5小时 | 周额度` 的单行文本改为两个独立 quota chip，显示剩余额度和短格式重置时间，并根据剩余比例显示正常、警告、危险三种颜色。
- 手机窄屏下隐藏单独的 Permission chip，把模型、推理和权限压缩到一个状态 chip 内；两个额度 chip 保持同一行显示，减少 Composer 控件换行和挤压。
- 新增 `test/composer-quota.test.js`，并更新 `test/tablet-layout.test.js`，覆盖 Composer chip、quota chip、手机布局、平板横屏布局和固定高度控制。
- public service worker 缓存升级到 `codex-mobile-shell-v34`。已安装 PWA 的设备需要刷新或等待新 service worker 激活后，才能拿到新的 Composer CSS/JS。

### 2026-05-12 Public 发布说明

本次 public 调整 macOS 一键 shared launcher 的自动端口选择逻辑，避免 Codex Mobile Web 在未显式指定端口时落到常见的相邻服务端口 `8797`。在同一台机器上同时部署多个本地 Agent Web 服务时，每个服务必须使用不同监听端口，外层 Tailscale Serve / 反向代理也必须指向对应服务的实际端口。

- `start-codex-shared-mobile-macos.sh` 新增默认保留端口列表，默认值为 `8797`。自动端口模式仍从 `8789` 到 `8899` 里选择第一个可用端口，但会跳过保留端口。
- 新增 `CODEX_MOBILE_RESERVED_PORTS` 环境变量、`--reserved-ports <csv>` 参数和 `--no-reserved-ports` 开关。部署者可以按实际环境增加保留端口，例如 `CODEX_MOBILE_RESERVED_PORTS=8797,8787`；如果确实要允许所有端口参与自动选择，可以显式关闭保留列表。
- 如果用户显式传入 `--port 8797`，脚本会直接报错说明该端口被保留，而不是继续启动到可能与其他服务混淆的目标端口。
- Windows 默认启动脚本和 Node 服务默认端口仍是 `8787`。本次只改变 macOS 一键 shared launcher 的自动端口选择策略，不改变已有手动指定端口的部署方式。
- 部署后需要同时检查两层端口：本地监听端口用 `lsof` / `netstat` / `Get-NetTCPConnection` 确认；Tailscale Serve 或其他反向代理的 target 必须指向 Codex 的实际端口，例如 `127.0.0.1:8787` 或脚本打印出的自动端口。

本次 public 同步还加入了移动端禁用页面缩放的行为，避免 iOS/PWA 或移动浏览器因为双击、捏合手势把整个应用页面放大，导致 Composer、顶部栏和线程内容错位。阅读尺寸应通过应用内字体大小设置调整，而不是依赖浏览器页面缩放。

- `public/index.html` 的 viewport 锁定为 `minimum-scale=1`、`maximum-scale=1`、`user-scalable=no`，并保留 `viewport-fit=cover` 以继续适配 iOS 安全区。
- 页面最早期脚本会拦截 WebKit 的 `gesturestart` / `gesturechange` / `gestureend`、`dblclick` 和短时间双击 `touchend`，用于覆盖 iOS Home Screen / Safari 中 viewport 规则不完全生效的情况。
- `public/styles.css` 在根页面上设置 `touch-action: pan-x pan-y`，保留正常上下滚动、左右滑菜单/线程手势，但不允许浏览器把手势解释成页面缩放。
- `public/sw.js` 的 PWA shell cache 升级到 `codex-mobile-shell-v35`。已经安装到主屏幕或命中旧缓存的客户端需要刷新一次、关闭重开，或等待新的 service worker 激活后，才能拿到禁用缩放的 HTML/CSS/JS。
- 新增 `test/mobile-viewport.test.js`，覆盖 viewport 锁定、早期手势拦截、根 touch-action 以及 service worker cache 版本，避免后续 public/private 同步时丢失这类移动端约束。
- Public 包版本升到 `0.1.3`，方便已经部署的实例通过版本号和更新提示确认本次端口保留与禁用页面缩放发布已经生效。

本次 public 追加澄清自更新完成后的重启行为。实际更新流程已经能完成 fast-forward 并退出旧 Node 服务；如果部署方式没有外部监督进程，页面会断开连接并停在“已更新但服务未重新启动”的状态，需要在部署机手动执行原来的启动命令。

- 自更新可用提示不再简单写成“点击后拉取并重启”，而是说明更新后服务会退出，并依赖 Windows 启动任务、windowless supervisor 或 macOS shared launcher 拉起。
- 点击更新前的确认框增加手动部署说明：`node server.js`、`npm start` 或一次性 shell 启动没有自动重启能力，更新成功后需要人工重启。
- 更新已应用后的版本 pill 文案从“重启中…”调整为“等待重启…”，避免误导用户以为当前 Node 进程自己还在完成重启。
- 连接状态会在更新成功后提示“如连接断开且未自动恢复，请在部署机手动重启”，对应用户在另一台部署机上观察到的实际现象。
- 新增 `test/app-update.test.js`，覆盖前端提示和 README 中关于 supervisor/manual restart 的说明，避免后续同步时退回含糊文案。
- Public 包版本升到 `0.1.4`，便于已部署实例通过版本号确认本次自更新提示修正已生效。

### 2026-05-14 Public 发布说明

本次 public 发布同步两项移动端显示修复，重点是让公开部署在手机大字体和协作 Agent 场景下保持可读、可操作。

- 新增 `collabAgentToolCall` 的专门渲染。过去这类协作 Agent 调用会按未知项目直接展开完整 JSON，手机屏幕上会出现很长的工具调用结构；现在会显示为紧凑的“协作 Agent”卡片，优先展示工具名、状态、Agent、线程和任务摘要。
- 原始 JSON 没有丢弃。需要排查时，可以展开卡片里的“原始 JSON”详情并复制完整内容；正常阅读时默认折叠，避免阻断对话流。
- 手机端 Composer 的额度卡片做了轻量布局修正。四个运行时卡片仍保持接近等宽，只给右侧额度卡片增加少量宽度，并压缩额度内部间距，解决大字体下周额度百分号被截断的问题。
- 额度详情面板和现有 5 小时 / 周额度数据来源不变；本次只调整窄屏摘要显示，不改变后端限额解析、模型限额分组或发送逻辑。
- Public service worker 缓存升级到 `codex-mobile-shell-v42`。已经安装到主屏幕的 PWA 可能需要刷新、关闭重开，或等待新 service worker 激活后，才能拿到新的 CSS/JS。
- Public 包版本升级到 `0.1.5`，便于部署者通过版本号和自更新提示确认本次前端显示修复已经生效。

### 2026-05-14 Public 发布说明（续）

本次 public 发布继续同步移动端对话阅读体验修复，重点处理长 turn 结束后难以回到回复内容、以及 live 输出期间用户手动滚动会被自动贴底覆盖的问题。

- 新增“回到本轮回复”的向上浮动按钮。它只在当前线程最近一轮刚完成、页面已经在底部附近、且本轮最后一条 Codex 回复位于可视区上方时出现；点击后会定位到本轮最后一条 `agentMessage`，方便从底部回到总结/回复内容。
- 保留原有“回到底部”的向下按钮。不在底部时仍显示向下按钮；用户点击后会回到底部，并恢复当前 turn 的自动贴底行为。
- live 输出期间新增手动滚动识别。用户在对话区 touch、pointer 或滚轮滚动后，如果当前 turn 仍在输出，后续增量不会继续强制滚到底部；这能保留用户正在查看的回执位置。用户自己回到底部或点击向下按钮后，自动贴底恢复。
- 手机端额度摘要继续保留 5 小时额度和周额度之间的紧凑分割点，并维持上一版的窄屏宽度修正，避免大字体下周额度百分号被截断。
- Public service worker 缓存升级到 `codex-mobile-shell-v43`。已经安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新的 service worker 激活后，才能拿到新的滚动控制脚本和样式。
- Public 包版本升级到 `0.1.6`，便于部署者通过版本号和自更新提示确认本次移动端滚动行为修复已经生效。

### 2026-05-14 Public 发布说明（续二）

本次 public 发布调整“回到本轮回复”的触发逻辑。上一版按钮会根据最近完成的 turn 自动出现，后台线程刚完成后切换进去也可能出现；这与实际阅读动作不完全一致。本版改为只在用户主动向上滚动当前对话区后出现，表示用户明确想从底部回看本轮回答内容。

- “回到本轮回复”按钮不再因为线程刚完成、线程未读或切换到后台完成线程而自动显示。进入线程后如果没有手动向上滚动，页面只保留正常的底部阅读状态。
- 用户在当前 live turn 或最近完成的最新 turn 中手动向上滚动时，前端会记录本轮回答锚点，然后显示向上浮动按钮。点击后定位到本轮最后一条 `agentMessage`/`plan`，也就是最终回执或总结位置；如果没有这类回执，再回退到本轮最后一个非用户、非 live-operation 项。
- 按钮仍然限制在近期上下文内：当前正在输出的 turn 可以触发；已完成 turn 只在现有 10 分钟窗口内触发，避免很久以前的旧会话随便上滑也出现本轮跳转提示。
- “回到底部”向下按钮和“回到本轮回复”向上按钮现在可以同时存在。向上按钮在样式上向左错开，避免两个浮动按钮重叠；点击向下按钮会清掉本轮回复跳转状态。
- live 输出期间的手动滚动暂停自动贴底行为继续保留。本次只是调整向上跳转按钮的显示条件和跳转目标，不改变发送、线程读取、额度显示或后端 app-server/mux 行为。
- Public service worker 缓存升级到 `codex-mobile-shell-v44`。已经安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新的 service worker 激活后，才能拿到新的滚动按钮脚本和样式。
- Public 包版本升级到 `0.1.7`，便于部署者通过版本号和自更新提示确认本次滚动按钮逻辑修正已经生效。

### 2026-05-14 Public 发布说明（续三）

本次 public 发布集成两个公开 PR：`#31 刷新线程详情标题来源` 和 `#32 隐藏不可用的推送入口`。目标是减少移动端列表/详情显示滞后，并降低普通 HTTP 局域网部署时的通知入口噪音。

- 线程详情读取现在会在已有 `state_5.sqlite` 或刚创建线程缓存摘要时，再尝试从 app-server 的 `thread/list` display summary 刷新标题、preview、cwd、updatedAt 和 status。这样移动端详情页更容易显示 app-server 当前标题，而不是停留在本地旧摘要。
- 这次刷新只合并展示字段，不覆盖 model、reasoning、sandbox、approval 等运行时字段。运行时继承和发送参数仍以本地状态/线程上下文为准，避免标题刷新影响后续 turn 的模型、推理等级或权限设置。
- 菜单里的 Web Push 通知按钮在不可用场景下会直接隐藏：包括服务端未启用 Push、当前页面不是安全上下文、或浏览器本身不支持 Push。普通局域网 HTTP 使用时不再显示一整行 `HTTPS required` 之类的提示。
- HTTPS 且浏览器支持 Push 时，通知入口仍保留原有行为：可以启用通知、发送测试通知，或在系统权限拒绝时显示被阻止状态。
- 新增 `test/thread-title-source.test.js`，覆盖详情页展示字段刷新和运行时字段不混合；`test/mobile-viewport.test.js` 增加不可用 Push 入口隐藏的静态回归测试。
- Public service worker 缓存升级到 `codex-mobile-shell-v45`。已经安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新的 service worker 激活后，才能拿到本次前端显示变化。
- Public 包版本升级到 `0.1.8`，便于部署者通过版本号和自更新提示确认本次 PR 集成已经生效。

### 2026-05-16 Public 发布说明

本次 public 发布同步近期移动端会话体验修正，并把 Web Push 的 Sub Agent 完成通知过滤改成更保守的服务端判定。

- 页面资源更新提示现在必须先确认新版本 app shell 资源已经完整写入目标 `codex-mobile-shell-*` 缓存，点击刷新时也会再次预检。这样可以避免只刷新了版本号、但 JS/CSS 仍来自旧缓存时出现未套样式的页面。
- 当 Mobile Web 因 8789 重启短暂断线时，页面会复用同一个刷新提示显示“服务重启中，点击刷新并重连”。点击后会等待 `/api/public-config` 恢复、预热最新 PWA shell cache、更新 service worker，再刷新页面重新连接，用户不需要退出 PWA 再打开。
- Public PWA shell 缓存升到 `codex-mobile-shell-v62`，确保本次刷新重连逻辑不会和旧 app shell 混用。
- 移动端输入栏回到正常底部布局流。无键盘时不再用 `visualViewport.height` 覆盖 `--app-height`，手机 composer 不再使用固定定位，从而减少 iOS/PWA 下输入栏悬空和底部留白。
- 侧边栏版本号旁新增同尺寸 `Restart` 按钮。点击后先确认，再调用 `POST /api/restart/shared-chain` 手动重启 Mobile Web shared chain；该动作只重启 Mobile Web、shared mux 和本地 app-server，不重启 WSL、Codex Desktop 或其它本机服务。原每日 `Codex Mobile Web Shared Chain Restart` 计划任务已取消。
- 当前线程的 Sub Agent 面板保持“当前进行中”视角。左滑打开后只看当前 live turn 相关的协作 Agent 状态，不再扫描历史完成记录，避免长协作会话里出现大量旧 Agent。
- Web Push 完成通知现在要求 `turn/completed` 能解析到已知主线程 id，并且该线程不能是 `thread_spawn_edges` child，也不能带 `agent_nickname` / `agent_role`。解析不到线程、SQLite 查询失败、查到未知 UUID/turn id，都会跳过通知，避免 Sub Agent 完成以 UUID 标题推到 iOS 通知中心。
- 后端 SQLite 读取改用 `adapters/sqlite-cli.js`，会优先使用 `CODEX_MOBILE_SQLITE3_EXE`，并覆盖常见 WinGet/Platform Tools `sqlite3.exe` 路径，减少隐藏启动环境 PATH 不一致导致的 Sub Agent 判定漏查。
- Public 版本升到 `0.1.9`，PWA shell 缓存升到 `codex-mobile-shell-v60`。已安装到主屏幕的 PWA 需要刷新、关闭重开，或等待新 service worker 激活后，才能拿到本次前端和缓存策略变更。

### 2026-05-18 Public 发布说明

本次 public 发布修正 iPhone 和 iPad 竖屏下偶发的半屏显示问题。现象是对话区和 Composer 只占据屏幕上半部分，下面留下大块空白，通常出现在 iOS/PWA 键盘、前后台或竖屏恢复之后。

- 前端新增 `public/viewport-metrics.js`，把 `visualViewport` / layout viewport / 输入焦点的判定独立出来，并补充单元测试覆盖 stale half-height viewport。
- `--app-height` 现在只有在 `input`、`textarea` 或 `contenteditable` 真正持有键盘时，才会使用缩小后的 `visualViewport` 高度。
- 如果 iOS/PWA 在键盘关闭后仍回报半屏 `visualViewport`，页面会回退到完整 layout viewport，避免 app 网格固定在上半屏。
- 页面刷新预检、service worker app shell 缓存和服务端 build hash 都已包含 `viewport-metrics.js`，确保刷新提示只有在新资源完整可用后才触发。
- Public PWA shell 缓存升到 `codex-mobile-shell-v61`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到本次竖屏高度修正。

### 2026-05-19 Public 发布说明

本次 public 发布修正移动端对话区在两类场景下离开底部的问题：发送消息后新内容偶尔停在会话中段，以及横屏后再切回竖屏时本来位于最新内容的会话没有保持在底部。

- 前端新增 `public/conversation-scroll.js`，把“是否接近底部”、发送后的底部跟随、视口变化后的底部跟随拆成可测试的小模块；`public/app.js` 只负责接入当前线程状态和 DOM 滚动。
- 当前线程发送消息成功发起后，会进入短时间的同线程底部跟随窗口。后续用户消息、turn start、首段输出或键盘/Composer 高度变化触发重绘时，页面会继续回到底部，避免停在会话中段。
- `orientationchange`、窗口 `resize`、`visualViewport.resize` 和 `visualViewport.scroll` 也会触发短时间底部跟随，但只在当前线程当前或最近确实位于底部时生效；如果用户已经手动滚动查看历史内容，则不会强制拉回底部。
- 用户真实的触摸、指针或滚轮滚动会立即取消发送跟随和视口跟随；点击上箭头跳回本轮最终回执/总结也会取消视口跟随，避免有意查看上方内容时被再次拉回底部。
- Public PWA shell 缓存升到 `codex-mobile-shell-v63`，版本仍为 `0.1.9`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到本次滚动保持修正。

### 2026-05-18 Mobile 文件预览说明

- Agent 回复里的本地文件引用，例如 `[PROJECT_STATUS.md](</Users/.../PROJECT_STATUS.md>)` 或图片/PDF 路径，现在会显示成带“预览文件”提示的可点击控件。
- 移动端点击后不会尝试打开 iPad/手机本地路径，而是通过 Mac 上的 Mobile Web server 只读读取文件，并在当前页面里展示预览。
- 预览支持 Markdown、常见文本/代码/配置文件、JSON、YAML、CSV、图片和 PDF；JSON 会格式化，CSV 会用表格展示，Markdown 会按 Markdown 渲染。
- 预览限制读取大小，并拒绝敏感文件名或安全目录；图片/PDF 走只读内容流，不把二进制内容塞进 JSON。
- 预览范围限制在当前 thread workspace、该 workspace 所在 Obsidian vault、Codex skill 目录（如 `$CODEX_HOME/skills`、`$HOME/.codex/skills`、`$HOME/.agents/skills`），或显式配置的 `CODEX_MOBILE_FILE_PREVIEW_ROOTS`；不会放开整个 `.codex` 状态目录。
- Public PWA shell 缓存升到 `codex-mobile-shell-v63`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到本次文件预览入口。

### 2026-05-23 Public 发布说明

本次 public 发布合并 PR #33/#34/#35/#37/#38/#39/#40，并加入续接前的工作区 handoff 自动压缩，版本升到 `0.1.10`，Public PWA shell 缓存升到 `codex-mobile-shell-v64`。

- 移动端消息卡片现在可显示时间戳，便于在长对话和多设备切换时确认消息顺序。
- Markdown 有序列表渲染同时覆盖起始编号和续号场景：普通聊天列表默认按连续列表显示，源码/预览模式可保留原始起始编号。
- Agent 回复里的本地文件引用可在移动端页内预览，支持 Markdown、文本/代码、JSON、YAML、CSV、图片和 PDF，并限制预览根目录、敏感文件名和读取大小。
- PWA 更新提示增加刷新并重连入口，配合 app shell 资源检查，避免更新后仍停留在旧前端或旧连接状态。
- macOS 手动重启路径补充到共享链重启服务，保持和 Windows 手动重启入口一致的接口语义。
- mux 不再让子 mux 覆盖可用的共享 endpoint，降低 Desktop/Mobile 被切到不同 app-server 流的风险。
- Mobile 发起的新 turn 用户消息不会在 Desktop 重复显示，Desktop 仍能看到 Mobile 发起消息，但会避免本地 echo 与真实历史项叠加。
- 压缩续接开始前，Mobile Web 会检查目标工作区 `.agent-context/HANDOFF.md`；超过默认 `300KB` 时先归档完整文件到 `.agent-context/archive/context-compaction-<timestamp>/HANDOFF.full.md`，再把活跃 handoff 改写为短摘要，避免新续接线程再次继承多 MB 历史 handoff。
- 已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到 `v64` 前端资源。

### 2026-05-23 Public 发布说明（续）

本次 public 热修修正移动端在服务器没有实际更新或重启时，误显示“服务重启中，点击刷新并重连”的问题。版本升到 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v65`。

- 前端不再把普通 `/api/events` SSE 短暂断线直接判断为服务器重启。iOS/PWA 前后台切换、网络抖动或 EventSource 自动重连期间，只会先显示连接状态为 `Reconnecting`。
- 只有手动点击 Restart 后，刷新提示才继续使用“服务重启中，点击刷新并重连”的文案，避免用户误以为服务器正在被更新或重启。
- 如果 SSE 断线后进一步的 `/api/status` 健康检查也失败，页面会显示更准确的“连接中断，点击刷新并重连”，用于真实连接不可恢复的场景。
- 当 SSE 重新打开或 `/api/status` 恢复成功时，页面会自动清除临时重连提示，避免一次短暂断线留下持续可见的刷新入口。
- 已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新的 service worker 激活后，才能拿到 `v65` 前端资源。

### 2026-05-24 Public 发布说明

本次 public 发布优化移动端工具/命令状态卡片和消息时间显示。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v71`。

- 移动端 `Command`、`File Change`、工具和搜索状态卡片改为两行紧凑布局：第一行显示操作类型和状态，状态紧跟在类型后面；第二行显示具体命令、文件列表或工具摘要，并保持单行截断。
- 同一操作目标的状态更新会在同一个卡片里刷新，不再堆出多张重复卡片。命令按可执行程序合并，即使参数或脚本内容变化，也会刷新同一个 `Command` 卡片；文件变更按文件集合合并，工具/搜索按身份或摘要合并。
- 旧的“只保留最新操作卡片 / 临时移除旧卡片”防闪烁路径已移除。现在最新 turn 中不同目标的操作卡片可以按原始顺序出现，但同一目标只保留一个卡片并更新状态。
- 消息卡片时间戳修正为优先使用 item 时间、完成 turn 的显式完成时间，再回退到 turn start。运行中或未完成的 turn 不再使用线程级 `updatedAt`，避免续接线程把创建时刻显示成当前回复时间。
- 已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v71` 的新卡片样式和时间显示逻辑。

### 2026-05-24 Public 发布说明（续）

本次 public 热修继续优化移动端长 turn 完成后的对话渲染稳定性。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v73`。

- 历史上下文压缩提示现在把压缩状态纳入对话渲染签名，并且同一个 turn 内只保留最新的压缩提示。正常顺序应为压缩过程中显示 `历史上下文正在压缩`，完成后显示 `历史上下文已压缩`，避免旧的完成提示和新的进行中提示同时堆叠造成误读。
- Codex 长回复在 live 输出和完成后的渲染路径统一使用 Markdown 渲染，减少 turn 结束时从纯文本节点切换到 Markdown 结构造成的大面积重排和闪动。
- 当最终 app-server 快照用新的 item id 返回同一段 Codex/plan 文本时，前端会保留已有渲染身份，避免长输出结束后整块回复重新动画或重建。
- 修正 final refresh 中同一条 `You` 消息换 id 后被追加到最底部的问题。现在匹配的用户消息会在原位置合并，并消费掉 incoming duplicate，避免 turn 结束后旧用户输入重复出现在底部。
- 新增 `test/conversation-render.test.js` 覆盖上下文压缩提示、长回复完成渲染稳定性，以及用户消息 final refresh 去重。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v73` 的修复。

### 2026-05-24 Public 发布说明（续二）

本次 public 热修继续收紧移动端上下文压缩提示和工具/命令卡片的显示边界。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v76`。

- `历史上下文正在压缩` 不再由 `contextCompaction` 类型或当前 turn 是否 live 推断出来。只有明确 pending/running 状态或明确 pending 文案，并且最新 turn 仍在运行时，才显示正在压缩；只有明确完成/失败/取消/错误状态或明确完成文案时，才显示 `历史上下文已压缩`。没有明确状态的 marker 不再显示提示，旧 pending 文案也不会被本地 merge 带到后续快照。
- 工具/命令/文件操作卡片不再按整个 turn 全局合并。现在只合并相邻且同目标的操作卡，例如同一个命令可执行文件连续刷新时会更新同一个卡片；如果中间已经出现 Codex 输出、用户消息、上下文提示或其他操作卡，后面的同一命令会新建一个较低位置的卡片。
- 最新 turn 底部如果连续出现多个操作卡，只保留最底部最新的一个，避免 Composer 上方堆出多个工具框。被普通输出隔开的较早操作卡仍按原位置保留，便于理解前文操作顺序。
- 测试覆盖同步更新到 `test/collab-agent-render.test.js`、`test/conversation-render.test.js` 和 `test/mobile-viewport.test.js`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v76` 的修复。

### 2026-05-24 Public 发布说明（续三）

本次 public 热修处理三类移动端长会话问题：上下文压缩提示误报、图片上传导致 rollout / replacement history 快速膨胀，以及 app-server `imageView` 在手机端只显示原始 JSON。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v79`。

- 服务端压缩后的移动端数据不再根据父 turn 是否结束来合成 `历史上下文已压缩`。只有明确的 context-compaction item 状态，或明确的 `item/started` / `item/completed` 通知，才会生成移动端压缩提示；type-only marker 不显示提示，避免长输出结束后误插一行“已压缩”。
- 浏览器在上传 `jpeg` / `png` / `webp` 图片前会先尝试本地压缩，默认最长边 1280px、JPEG quality `0.72`。这保留截图可读性，同时减少多 MB 图片直接进入 Codex 上下文。
- 包含图片上传的 turn 默认不再请求 app-server `persistExtendedHistory`，把截图视为当前 turn 的临时视觉参考，降低后续 compaction 反复写入 `replacement_history` 图片内容的概率。需要保留历史图片重放时，可显式设置 `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1`；也可用 `CODEX_MOBILE_PERSIST_EXTENDED_HISTORY=0` 全局关闭 extended-history 请求。
- `imageView` item 现在直接渲染为图片，复用现有的认证文件预览内容接口和当前线程 workspace-root 校验，不再把 `type`、`id`、`path` 等字段作为 JSON 卡片显示。
- 新增 `public/image-compressor.js`、`adapters/message-input-service.js` 以及对应测试，并更新 `test/file-preview-ui.test.js`、`test/conversation-render.test.js`、`test/mobile-viewport.test.js`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v79` 的前端修复。旧 rollout 里已经写入的图片历史不会被本次发布自动重写。

### 2026-05-24 Public 发布说明（续四）

本次 public 热修继续调整移动端操作卡片显示。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v81`。

- 最新 turn 内的 `Command`、`File Change`、工具和搜索操作卡现在全局只保留最新一个，不再只限制 Composer 上方的底部连续区域。即使旧操作卡已经滚到上方，或中间出现过 Codex 输出，后续操作到来时也会隐藏旧操作卡，避免小屏上堆出多张命令框。
- 因为全局只保留一个操作卡，卡片详情区从单行截断改为最多两行显示：第一行仍显示类型和状态，第二、三行显示命令、文件列表或工具摘要，超出两行再裁剪。
- 这次改动只影响最新 turn 的紧凑操作状态展示，不改变历史命令输出隐藏策略、不显示 diffs，也不改变审批卡片和普通消息卡片。
- 测试覆盖同步更新到 `test/collab-agent-render.test.js`、`test/conversation-render.test.js` 和 `test/mobile-viewport.test.js`。已安装到主屏幕的 PWA 需要点页面刷新提示、关闭重开，或等待新 service worker 激活后，才能拿到 `codex-mobile-shell-v81` 的新操作卡显示。

### 2026-05-24 Public 发布说明（续五）

本次 public 热修修正移动端对话卡片时间戳在同一个 turn 内重复显示的问题。版本保持 `0.1.11`，Public PWA shell 缓存仍为 `codex-mobile-shell-v81`；这次是服务端 thread detail 数据修正，不需要更新静态 app shell。

- 当 app-server 返回的消息、工具或文件操作 item 没有逐条 `startedAt` / `createdAt` / `timestamp` 字段时，Mobile Web 现在会从对应 rollout JSONL 的 `event_msg` / `response_item` 顶层时间补回 `startedAtMs` 和 `startedAt`，再把 thread detail 返回给浏览器。
- 这样同一轮里连续出现的多条 Codex 回执、消息卡片或操作卡片，会显示各自实际发出的时间，而不是全部回退到同一个 turn 完成时间或 turn 开始时间。
- 服务端会对同一条内容同时出现的 `event_msg` 与 `response_item` 时间候选做去重，避免把 app-server 双记录当成两条不同消息；操作卡片和上下文压缩卡片在移动端压缩后也会保留时间字段。
- 已打开的移动端页面通常只需要刷新当前线程详情或重新进入该线程即可看到修正后的时间戳；因为没有改动前端静态资源，不需要等待新的 service worker 缓存版本。
- 新增 `test/thread-item-timestamp-enrichment.test.js` 覆盖逐条消息时间补齐和压缩后操作卡片保留时间字段，配合既有 `test/message-timestamp.test.js` 验证前端 fallback 仍然保留。

### 2026-05-24 Public 发布说明（续六）

本次 public 热修继续稳定移动端对话卡片时间戳。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v82`，用于让已打开的移动端客户端拿到新的前端 fallback 逻辑。

- 服务端从 rollout JSONL 补 item 时间戳时，现在会把消息文本和工具 `call_id` 一起作为匹配依据。`agentMessage` / `userMessage` 优先按文本匹配，操作卡优先按 `call_id` 匹配，避免长 live turn 中 app-server 快照顺序和 rollout 事件顺序不完全一致时把旧消息时间配给新卡片。
- 前端不再把 live `agentMessage`、`plan` 或 live 操作卡缺失 item 时间戳时的 turn start 当作卡片时间显示。缺少真实 item 时间时先隐藏时间戳，等服务端补齐后再显示，避免新卡片刚出现就显示本轮开始时间。
- 这次修复针对长时间运行的 live turn 尤其重要：如果一个 turn 从较早时间开始，但后续持续输出多条回执，新回执应该显示各自发出的时间，而不是全部显示本轮开始时间。
- 已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v82` 后，前端才会停止显示 turn start fallback。
- 新增和更新的测试覆盖文本匹配、工具 `call_id` 匹配、live 消息/操作卡不冒充 turn start，以及 v82 shell cache 检查。

### 2026-05-25 Public 发布说明

本次 public 发布调整线程列表的归档入口。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v83`，用于让已打开的移动端客户端拿到新的线程菜单交互。

- 线程行左滑不再露出 `归档` 按钮，也不再保留专门的 thread-row swipe archive 状态、隐藏按钮或触摸监听。这样线程列表的横向手势负担更低，避免和侧栏边缘手势、页面滚动或其他移动端手势混在一起。
- `归档` 现在整合进线程行长按菜单，和 `重命名`、`压缩续接` 放在同一个 action sheet 里。点击后仍然会先弹出确认，确认后调用既有 `/api/threads/<threadId>/archive`，成功后刷新线程列表；如果归档的是当前打开线程，会清空当前详情视图。
- 主动压缩续接仍保留在长按菜单和超阈值详情提示里；本次只是移动归档入口，没有改变后端归档接口、归档过滤规则或续接归档流程。
- README 的界面说明已同步更新，`test/thread-archive.test.js` 覆盖“长按菜单归档、无左滑归档残留”，`test/mobile-viewport.test.js` 覆盖 v83 shell cache。
- 已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v83` 后，才能看到新的长按菜单归档入口。

### 2026-05-25 Public 发布说明（续）

本次 public 发布继续处理移动端长 turn 的操作状态与消息提交稳定性。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v85`，用于让已打开的移动端客户端拿到新的 active-turn 状态和操作卡显示逻辑。

- 最新 turn 只保留一个全局操作卡的规则保持不变，但操作卡第一行右侧现在会显示该命令、文件变更、工具或搜索操作的已运行时间。运行中的操作会随顶部计时器同步刷新；已完成操作优先使用服务端或 rollout 中已有的完成时间、耗时字段。
- 服务端会从 rollout JSONL 中补齐操作项的逐条时间戳，压缩后的 `Command` / `File Change` / tool / search 卡片也会保留 `startedAtMs` / `startedAt`，让移动端能计算并显示操作耗时。
- 现有线程发送消息时，服务端会先检查浏览器提交的 `activeTurnId` 是否已经被新的 durable turn 取代、是否在最近 turn 列表中缺失并超过短暂宽限期、或是否是 app-server 已返回 stale 错误的旧 active turn。命中这些场景时，Mobile Web 会中断旧 active marker，再走 `thread/resume` + `turn/start`，避免用户消息只作为本地 echo 短暂出现、重新进入线程后消失。
- 对最新 durable live turn 的处理已收紧：即使 rollout 一段时间没有写入，或者最后一个可见 item 是已完成命令、工具、文件、搜索操作或 context-compaction marker，Mobile Web 也不会自动把这个最新 live turn 当作 stale turn 中断。用户在这种情况下发送的引导消息应继续走 `turn/steer`，避免把正常的“补充指令”误变成 `turn_aborted reason=interrupted`。
- 前端 active 状态现在只跟随最新 durable turn。较旧的 `inProgress` turn 如果已经被更新的 durable turn 取代，不再让 composer 保持 `Stop`、不再让顶部 timer 继续显示运行中，也不会再接收新的 `turn/steer` 引导。
- 本次新增 `adapters/active-turn-staleness-service.js` 和 `test/active-turn-staleness-service.test.js`，并更新 `test/new-thread-route.test.js`、`test/conversation-render.test.js`、`test/collab-agent-render.test.js`、`test/message-timestamp.test.js`、`test/thread-item-timestamp-enrichment.test.js` 和 `test/mobile-viewport.test.js`。已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v85` 后，才能看到新的 active-state 和操作耗时显示。

### 2026-05-26 Public 发布说明

本次 public 发布继续收紧图片上下文、压缩续接启动上下文，并修正 reference-only 图片上传后的移动端显示。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v86`，用于让已打开的移动端客户端拿到新的图片缩略图渲染逻辑。

- 图片上传现在默认使用 `CODEX_MOBILE_IMAGE_CONTEXT_MODE=reference`：模型只收到附件摘要和本地文件路径，不再默认收到 app-server `localImage` 输入。这可以避免新上传图片继续进入 app-server 当前历史和 compacted `replacement_history`，从源头降低后续 turn 的上下文/token 成本。
- 如果确实需要模型读取图片像素，可以显式设置 `CODEX_MOBILE_IMAGE_CONTEXT_MODE=latest` 或 `vision`，只发送最新一张图片；`all` 仅用于恢复旧版全部图片行为。`CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY=1` 仍只控制 extended-history 请求，不会清理当前 app-server 内存或旧 rollout 中已经存在的图片 payload。
- 移动端对话展示与模型上下文策略已经分离：即使模型只收到路径引用，浏览器也会从 `Uploaded attachments` 摘要里识别已保存的本地图片路径，并通过认证上传预览接口渲染居中缩略图。这个规则也适用于 Codex/plan 回复里再次引用同一段附件摘要的情况，并兼容 CRLF 换行、Markdown 引用块以及 app-server 原始 `input_text` / `input_image` / `image_url` content part；用户不再只看到一长串路径，非图片附件仍保持紧凑的文件信息行。
- 压缩续接 bootstrap 改成 file-first 的小摘要策略：新线程仍会拿到源线程 handoff 文件路径、必要的运行设置、最近 turn 摘要和工作区上下文摘录，但默认总量从过去偏大的 inline 上下文收紧到约 `52000` 字符，并限制 source handoff、workspace handoff、lineage 和单条 item 摘要大小。完整事实应回到 `.agent-context/thread-handoffs/<id>.md` 和项目文档读取。
- 新增 `docs/` 项目文档集与 `docs/CONTEXT_STRATEGY.md`，把架构、模块边界、故障排除、复杂功能实现路径、上下文策略和文档更新规则固化下来。后续修改模型输入、图片保留、续接 bootstrap 或 handoff 压缩策略时，需要同步更新对应文档。
- Web Push 完成通知增加 no-final-agent-message 保护：当 app-server 完成事件明确表示没有最终 assistant 回复时，Mobile Web 不再发送普通“turn ended”推送，避免用户收到结束通知但打开线程看不到正常结束回执。
- 本次更新覆盖 `server.js`、`public/app.js`、`public/sw.js`、`adapters/message-input-service.js`、`adapters/push-notification-service.js`、新增 `docs/` 文档和相关测试。已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，拿到 `codex-mobile-shell-v86` 后，才能看到图片路径缩略图显示。

### 2026-05-27 Public 发布说明

本次 public 发布同步 v93-v98 的移动端阅读、诊断和上传图片显示修正。版本保持 `0.1.11`，Public PWA shell 缓存升到 `codex-mobile-shell-v98`；已打开到主屏幕的 PWA 需要点击页面刷新提示、硬刷新或关闭重开，才能拿到新的前端资源。服务端上传 MIME 修正需要重启 8787 Node listener 后生效。

- 当前 turn 的向上浮动箭头现在定位到本轮最终回执/总结位置，而不是本轮第一条 assistant 回复。目标优先选择本轮最后一条 `agentMessage` 或 `plan`，没有最终回执时才回退到最后一个非用户、非 live-operation 项。
- 如果用户已经在 live 输出期间向上滚动，`turn/completed` 不会覆盖这个已激活的当前 turn 锚点；最终总结很长时，只要目标起点在可视区上方，向上箭头就可以显示并跳回总结开头。
- 最终回执刷新期间，页面不再在用户阅读时持续强制滚到底部。用户最近的手动滚动如果让对话区离开底部，会建立当前 turn 阅读保持状态；render-time stick-to-bottom、发送后底部跟随和 viewport 跟随都会暂停，直到用户回到底部或点击向下箭头。
- 最新 turn 的命令/工具/文件/搜索操作卡从三行视觉预算改为四行：一行类型/状态元信息，加上最多三行详情。这样长命令、文件列表或工具摘要在手机上更容易读，同时仍避免操作卡无限变高。
- 完成的 turn 可以显示 `Context and token usage` 诊断卡。该卡来自 rollout `token_count` 事件，展示本轮 token、累计 token、context window 使用比例/风险和 rollout 大小；没有 scoped token 事件时不会猜测生成。诊断卡不会成为向上箭头的最终回执目标。
- Usage 诊断卡的本轮 token 不再只取同一 turn 最后一个 `token_count.last_token_usage`。服务端会按连续 `total_token_usage` 差值累计本 turn 内多次模型调用，并对重复的相同累计事件计 0；最终 context window 百分比仍取本 turn 最后一个有效事件。
- Usage 诊断卡里 `in` 的显示口径调整为未缓存输入量：当上游提供 `cachedInputTokens` 时，`in` 显示 `inputTokens - cachedInputTokens`，同时继续单独显示 `cached`。context window 百分比和风险仍按 raw input/context token 计算，因为 cached input 仍占用模型上下文窗口。
- 侧栏新增 prompt-only 的 Public PR 检查。浏览器会检查配置的 public 仓库是否有开放 PR；发现 PR 时只提示是否准备合并/发布评审任务，不会自动 merge、sync、commit 或 push。
- 上传图片缩略图显示继续保持 reference-only 模型上下文策略：模型默认只收到附件摘要和本地路径，不默认收到图片像素。浏览器仍会从 `Uploaded attachments:` 摘要渲染居中缩略图，包括用户消息、Codex/plan 引用摘要、CRLF、Markdown blockquote，以及 app-server 原始 `input_text` / `input_image` / `image_url` content part。
- 上传文件预览接口现在为 `.jpg`、`.jpeg`、`.webp`、`.gif`、`.png` 等保存的图片路径返回真实图片 MIME，例如 `image/jpeg`，避免浏览器尤其是 iOS/Safari 因 `application/octet-stream` 而不显示 `<img>` 缩略图。
- 本次同步新增 `adapters/turn-usage-summary-service.js` 和 `adapters/public-pull-request-service.js`，并更新 `server.js`、`public/app.js`、`public/styles.css`、`public/sw.js`、文档与相关测试。部署者更新后应运行测试/check，并重启服务端 listener 以加载上传 MIME 与 public PR/usage summary 路由。

### 2026-05-27 Public 发布说明（续）

本次 public 发布继续同步移动端线程详情的服务端修复。版本仍为 `0.1.11`，不改变前端 PWA shell 缓存；更新后需要重启 8787 Node listener，让服务端加载新的 thread detail 压缩和 Usage 解析逻辑。

- Usage 诊断卡会忽略 app-server 在部分 turn 结束前输出的零值/window 哨兵 `token_count`。如果同一 turn 前面已经有有效 token 用量，Mobile Web 会保留最新有效值；如果只有哨兵事件，则不生成 Usage 卡，避免显示 `0/258400` 这类误导性用量。
- 最新 turn 只有在仍处于运行状态时才保留最新一个命令/工具/文件/搜索操作卡。turn 完成后，紧凑移动端详情不再在最终回执下面保留命令框；如果有 Usage 数据，最后一个诊断框应是 Usage summary。
- 从 rollout tail 补回已完成操作卡时，服务端只在最新 turn 仍然 live 且操作能确认属于同一 turn 时补回，避免把旧 turn 的已完成命令误贴到新的 live turn。
- 本次同步更新 `server.js`、`adapters/turn-usage-summary-service.js`、`test/turn-usage-summary-service.test.js`、`test/thread-item-timestamp-enrichment.test.js` 和相关文档；无需前端刷新提示或 service worker cache bump。

### 2026-05-27 本地更新说明

本次本地更新把操作卡显示规则收紧为 live-only，并将 PWA shell 缓存升到 `codex-mobile-shell-v99`。

- 最新 turn 仍在运行时，移动端继续显示最新一个命令/工具/文件/搜索操作卡，用于判断当前正在执行或刚执行过的操作。
- turn 完成后，移动端不再在最终回执下面保留命令框；如果有 Usage 数据，最后一个诊断框应是 Usage summary。
- 这同时在服务端 thread detail 压缩和前端 `visibleItemsForTurn()` 上生效，避免 completed turn 的本地 live merge 残留操作卡继续显示。

### 2026-05-28 本地更新说明

本次本地更新修复 Codex 自己做视觉核验时生成的 `imageView` 截图卡片显示问题，并将 PWA shell 缓存升到 `codex-mobile-shell-v100`。

- `view_image` / `imageView` 截图可能来自 `%TEMP%` 下的工具生成文件；Codex `imageGeneration` 效果图可能保存为 `%USERPROFILE%\.codex\generated_images\...\*.png`。这些文件不属于用户上传，也不在当前 workspace 文件预览根内。旧前端会把它们当普通 JSON 或本地预览路径显示，导致手机端 `Image` / `imageGeneration` 卡只显示原始 JSON 或破图。
- 服务端现在会在压缩 `imageView` 或带 `savedPath` 的 `imageGeneration` 项时，把符合图片类型和大小限制的源文件复制到 Mobile Web 运行目录的 `generated-images` 缓存，再给前端一个受认证保护的 `/api/generated-images/file` URL。
- 前端 `renderImageView()` 优先使用服务端附带的 `contentUrl`，并在需要时补上认证 key；`imageGeneration` 也复用该渲染路径。只有没有缓存 URL 时才回退到旧的本地文件预览路径。
- 这个修复不会把 `%TEMP%` 加进通用文件预览根，也不会放宽 Markdown/本地文件预览的 workspace-root 校验。若源临时截图在 Mobile Web 首次看到之前已经被删除，历史卡片仍无法仅凭路径恢复。

### 2026-05-28 Public 发布说明

本次 public 发布包含 v99/v100 两组移动端可见修正：完成 turn 不再保留命令框，以及 Codex 自己生成的视觉核验截图可以在 `Image` 卡中稳定显示。版本保持 `0.1.11`，PWA shell 缓存升到 `codex-mobile-shell-v100`。

- 最新 turn 仍在运行时，移动端继续显示最新一个 `Command` / `File Change` / tool / search 操作卡；turn 完成后，紧凑详情不再把命令框留在最终回执下面。如果 rollout 中有 scoped `token_count` 数据，最后的诊断框应是 Usage summary。
- 这条规则同时在服务端 thread detail 压缩和前端 `visibleItemsForTurn()` 中执行，避免刷新或重新进入线程后把已结束 turn 的旧操作卡误当成仍在运行。
- `view_image` / `imageView` 视觉核验截图可能来自工具临时目录，而不是用户上传目录或当前 workspace；Codex `imageGeneration` 效果图也可能保存到 `.codex\generated_images`。服务端现在会把符合图片类型和大小限制的 `imageView` / `imageGeneration.savedPath` 源文件复制到运行目录的 `generated-images` 缓存，并通过受认证保护的 `/api/generated-images/file` URL 给浏览器渲染。
- 前端 `renderImageView()` 优先使用服务端返回的 `contentUrl`，并为同源 `/api/` 图片地址补认证 key；没有缓存 URL 时才回退到原来的本地文件预览路径。
- 该修复不把 `%TEMP%` 加入通用文件预览根，也不放宽 Markdown/本地文件预览的 workspace-root 校验。若源临时截图在 Mobile Web 首次读取前已被删除，历史卡片仍无法仅靠路径恢复。
- 新增 `adapters/generated-image-cache-service.js` 和 `test/generated-image-cache-service.test.js`，并把新 adapter 纳入 `npm run check`。发布前 public PR 检查无开放 PR。

### 2026-05-28 Public 发布说明（Usage 本轮统计修正）

本次 public 发布修正完成回执里 `Usage` 诊断卡的本轮 token 统计口径。版本保持 `0.1.11`，不改变 PWA shell 缓存；更新后需要重启 8787 Node listener，让服务端加载新的 rollout `token_count` 解析逻辑。

- `last turn` 行不再只取同一 turn 最后一个有效 `token_count.last_token_usage`。长 turn 如果包含多次模型调用、工具后续总结或多段推理，前面几次调用也会进入本轮统计。
- 服务端现在按连续 `total_token_usage` 的差值累计本 turn 内所有有效 scoped token 事件；重复的相同累计事件贡献 0，避免 app-server 重放相同 token 事件时重复计数。
- context window 使用比例和风险仍取本 turn 最后一个有效事件，因为它描述的是最终上下文窗口占用，不是所有模型调用输入的简单求和。
- 零值/window 哨兵过滤继续保留：如果 app-server 在 turn 结束前输出 `last_token_usage=0` 且 `total_tokens` 等于窗口大小的哨兵事件，Mobile Web 会忽略它。
- 本次同步更新 `adapters/turn-usage-summary-service.js`、`test/turn-usage-summary-service.test.js`、README、架构/上下文策略/故障排除/复杂路径文档。发布前 public PR 检查无开放 PR。

### 2026-05-29 Public 发布说明（Hermes Mobile 插件嵌入）

本次 public 发布同步 Codex Mobile Web 的 Hermes Mobile 独立嵌入插件能力，以及 v104-v108 的 iframe 内导航修正。版本保持 `0.1.11`，PWA shell 缓存升到 `codex-mobile-shell-v108`；已安装到主屏幕或被 service worker 缓存的客户端需要点击刷新提示、硬刷新或关闭重开后，才能拿到新的嵌入页面和手势行为。

- Codex Mobile 现在可以作为 Hermes Mobile 的独立 `embedded_app` 插件注册。插件接口位于 `/api/v1/hermes/plugin/...`，包含 manifest、workspace/callback/origin 注册、launch 和 session 交换；注册和 launch 仍使用 Codex Mobile 自己的 Access Key，不复用 Hermes owner auth。
- Manifest 只返回插件元数据、entry URL、launch/session/origin endpoint、owner binding、frame embedding 和 navigation contract，不返回长期 Access Key、launch token secret、本地 secret path、DB path、上传内容或私有状态 dump。
- Launch 只返回短期相对 `entry_path`，浏览器在 `/?embed=hermes` 中把一次性 `codexPluginLaunch` 换成内存态 plugin session 并清理 URL。长期 Access Key 不写入 iframe URL、`localStorage` 或插件注册状态。
- HTTPS Hermes PWA 需要 HTTPS Codex entry。部署者应设置 `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` 或 `CODEX_MOBILE_PUBLIC_BASE_URL`；Windows 启动脚本和安装脚本新增 `-HermesPluginBaseUrl`、`-PublicBaseUrl`、`-HermesPluginFrameOrigins`，可把外部 HTTPS Codex 地址和 Hermes iframe origin 持久化到隐藏启动任务。
- `POST /api/v1/hermes/plugin/origins` 和 `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS` 用于注册 Hermes PWA origin，并写入 HTML CSP `frame-ancestors`。HTTPS Hermes 请求如果只能得到 HTTP Codex entry，manifest 会返回 mixed-content 诊断，而不是尝试绕过浏览器安全策略。
- `/?embed=hermes` 隐藏独立 Web App 的重复 chrome/login splash，保持 iframe 内状态，不在 visibility/focus 变化时强制 reload，并阻止 `window.open`、`target=_blank` 和外部二级窗口 handoff。
- Codex iframe 通过 `codex-mobile.plugin.navigation` 向 Hermes 上报 route 与 `canGoBack`。Hermes 通过 `hermes.plugin.back` 请求 iframe 先处理文件预览、编辑弹窗、action sheet、subagent 面板等内部 transient 层；Hermes 不需要检查 Codex DOM 或调用 Codex 内部 route 函数。
- v108 将 Codex 的线程切换器和设置区域改为 Hermes 插件一级主页面，不再是侧边栏抽屉。该主页面上报 `canGoBack=false`，让 Hermes Mobile 可以显示自己的底部导航；线程详情和新线程输入页是二级页面，back 会回到 Codex 插件主页面，而不是首次进入 Web App 时的 Workspace 列表。
- 本次同步更新 `server.js`、`adapters/hermes-plugin-service.js`、Windows 启动脚本、`public/app.js`、`public/plugin-embed.js`、`public/styles.css`、`public/sw.js`、`public/index.html`、README、架构/模块/故障排除/复杂路径文档以及 Hermes plugin 相关测试。服务端 route/CSP/session/startup 变更需要重启 8787 Node listener；静态 PWA 行为需要客户端加载 `codex-mobile-shell-v108`。

## Current Update Notes

This section summarizes the current integration behavior for someone cloning or taking over the repository.

### Shared Desktop/Mobile Stream

- Windows Desktop live sync is implemented through `codex-app-server-mux.js` and `start-codex-desktop-shared.ps1`.
- macOS scripts are included and the implementation approach is documented, but Desktop live sync still needs verification on a real Mac/Codex Desktop build.
- When Mobile Web detects a shared mux endpoint, it treats that endpoint as the required app-server for the current process lifetime. If the shared endpoint disconnects, Mobile Web reports the shared-stream error instead of silently starting an independent app-server.
- `-RequireSharedAppServer` / `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1` enforces the same rule even if Mobile Web starts before any mux endpoint exists.
- `CODEX_MUX_KEEP_ALIVE=1` keeps the mux and real app-server alive after Codex Desktop exits, so Mobile Web can continue using the same live stream.
- Starting Desktop again through the shared launcher attaches it to the existing mux endpoint instead of creating a second app-server.

### Mux Replay And Reconnect

- The mux keeps a bounded replay buffer for recent app-server notifications:
  - `turn/*`
  - `item/*`
  - `thread/*`
  - `account/rateLimits/updated`
- On `initialize`, Mobile Web receives unresolved server requests plus buffered notifications, so reconnecting or refreshing the phone browser can catch up within the replay window.
- Pending approval/server requests are replayed to all clients because they can block the active turn.
- Historical notification replay is now enabled for both Mobile Web and Desktop by default. Use `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=0` if you need to disable Desktop replay for diagnostics.
- Replay buffer entries are stored as full notifications and are compacted only when a mobile client is actually sent the message. This keeps Desktop reconnect replay fidelity while preserving Mobile payload controls.
- TCP client backpressure is treated as a normal `drain` condition. The mux logs the delay but does not disconnect Desktop or Mobile Web just because one write returned `false`.
- Events missed before the mux replay buffer existed cannot be reconstructed from mux memory. Future offline intervals are covered within the configured buffer size and age.

### Approval Control

- Mobile Web renders app-server approval requests as cards in the current thread.
- Supported approval families include command execution, file change, and permission-profile requests.
- Each pending card exposes:
  - `允许一次`
  - `本会话允许`
  - `拒绝`
- The approval response goes back through the same shared app-server stream. This avoids creating a separate stream just to answer permissions.
- Approval cards render inside their associated turn when a `turnId` is available. After the request is answered, the large card collapses to a one-line status instead of remaining as a full card at the bottom of the conversation.

### Message Submission And Active Turns

- The browser sends a `clientSubmissionId` with each message submission.
- For modern clients that send `clientSubmissionId`, the server deduplicates only by that id. This prevents an intentional repeated short message, such as `continue`, from being incorrectly suppressed as duplicate content.
- For older clients that do not send `clientSubmissionId`, the server falls back to a content fingerprint from thread id, active turn id, cwd, model, effort, message text, and attachment metadata.
- If the same request id, or the same legacy content fingerprint, is repeated within `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS`, the server returns the original in-flight/completed result and does not call `turn/start` or `turn/steer` again.
- During an active turn, Mobile Web posts the active turn id. The server uses app-server `turn/steer` when available so Desktop and Mobile stay on the same active stream.
- After a successful active-turn `turn/steer`, the server also sends a deterministic mux-local `mux/userMessage` echo keyed by `clientSubmissionId`. This makes the user's mid-turn input visible in Mobile Web even when the app-server accepts the steering request without replaying a user-message item.
- Existing-thread submission preflights the submitted `activeTurnId` before steering. Superseded or missing stale active ids fall through to `thread/resume` + `turn/start`, while the latest durable live turn is not auto-interrupted only because it is quiet or because its last visible item is a completed operation or context-compaction marker.
- The browser active-turn UI follows only the latest durable turn. Older `inProgress` turns that have been superseded do not keep the composer in `Stop`, keep the top timer active, or receive new steering input.
- Message submission now writes compact server-side `[message-submit]` diagnostics for received, empty, completed, and failed submissions. These logs include ids and counts, not raw message text.
- The browser can post compact `[client-event]` diagnostics such as UI stalls, send stalls, send-button no-submit cases, and send failures. These events are best-effort and are used only for local operational diagnosis.
- The browser preserves `mux-user-*` user-message echo items during thread refresh merges, because these synthetic visible inputs may not exist in the durable thread snapshot returned by app-server.
- For new turns, Mobile Web reads the thread's last rollout `turn_context` plus `state_5.sqlite` metadata and forwards the inherited model, reasoning effort, approval policy, sandbox policy, reasoning summary, and configured verbosity where the app-server protocol supports it. This keeps Mobile Web turns aligned with the thread runtime settings that Desktop is using. Per-thread model/reasoning/permission/Fast choices are stored as browser-local runtime-only draft state even without typed text, so they survive reloads and remain visible after Send while app-server thread metadata catches up.
- Full-access threads are normalized for Mobile Web new turns: if the inherited sandbox is `danger-full-access`, or the permission profile grants root write access, Mobile Web sends `approvalPolicy: "never"` when the persisted approval mode is missing or still `on-request`. This matches the user-facing "full access" expectation and avoids redundant command approval cards on new turns.
- The composer permission chip displays the current thread/default permission as read-only status after model/reasoning. Mobile Web does not send a mobile-selected `permissionMode`; it follows the current thread runtime settings and the local `%USERPROFILE%\.codex\config.toml` defaults that the server resolves.
- The older mux-local `mux/userMessage` echo is still retained as a fallback for app-server builds that do not support `turn/steer`.

### Mobile UI Stability

- Conversation rendering uses a lightweight keyed DOM patcher so status polls and no-op refreshes do not replace the whole conversation.
- Live reasoning deltas update the timer activity label but do not create visible conversation rows.
- The upward floating button for the current turn targets the final receipt/summary position, using the last `agentMessage` or `plan` in that turn before falling back to the last non-user, non-live-operation item. If the user already scrolled upward during live output, that activated jump state must survive `turn/completed`; the button should also appear when the target item's start is above the viewport, even if a long summary still extends into view.
- Live/final output must not keep forcing the conversation downward while the user is reading. A recent manual scroll that moves the conversation away from bottom establishes a current-turn reading hold even if programmatic bottom-scroll was active; render-time stick-to-bottom, submitted-message follow, and viewport follow must all stop until the user returns to bottom or taps the down arrow.
- Mobile foreground recovery handles `visibilitychange`, `pageshow`, `focus`, `orientationchange`, `visualViewport` changes, and window resize.
- On iOS, returning from input-method or permission screens can leave a stale/blank composited viewport. The app maintains a JS-driven `--app-height` and runs several lightweight visual recovery passes after resume.
- When the current thread is already open, foreground recovery should preserve the current screen and refresh it silently instead of re-entering `loadThread()` for the same thread. Returning from another app should not flash `Loading thread...` merely to refresh the current thread.
- On first load, if Mobile Web already knows it should open a specific thread, startup should keep the main panel in a stable thread-opening state instead of briefly rendering the Workspace/recent-thread home screen and then replacing it with the target thread.
- In Hermes embed mode, slow startup should show one stable loading layer until the primary plugin page or explicit launch target has finished rendering, instead of exposing intermediate `Select a thread` or `Loading threads...` screens.
- In Hermes embed mode, if startup detects an invalid/expired launch or session and already asks Hermes to relaunch the iframe, the page should stay in a neutral plugin-recovering state instead of flashing the red Codex login/auth error panel first.
- Uploaded image messages render as centered thumbnails, not full-width raw images or data URLs.
- Non-image uploads are stored locally and referenced by absolute path in the message text.

### Mobile Session List And Copy Actions

- Theme preference is stored in `localStorage` as `codexMobileTheme`, with accepted values `system`, `dark`, and `light`. The early inline script applies the theme before the app bundle loads, reducing flash between dark and light modes.
- Font-size preference is stored in `localStorage` as `codexMobileFontSize`, with accepted values `small`, `default`, `large`, `xlarge`, and `xxlarge`. It lives in the same settings panel as theme selection instead of a separate sidebar-header dropdown, so display settings share one consistent mobile control surface.
- The session list can be opened through the menu button or a left-edge right-swipe gesture on overlay layouts. Opening the list is intentionally fast: existing list data is rendered immediately, and Mobile Web only performs a silent background refresh when the cached list is older than 60 seconds.
- Thread rows now support a long-press action sheet with rename, continuation, and archive actions. Rename calls `PATCH /api/threads/<threadId>/name` with a max 120-character name; archive calls `POST /api/threads/<threadId>/archive` after confirmation.
- The long-press handler avoids iOS text-selection side effects on thread cards while preserving text selection inside editable rename controls.
- Copy buttons use the browser Clipboard API on secure contexts and fall back to a hidden textarea plus `execCommand("copy")` where needed. The copied text is kept only in memory for the current render cycle and is not persisted.

### Self Update

- On server startup, Mobile Web schedules a background `git fetch` against `CODEX_MOBILE_UPDATE_REMOTE` / `CODEX_MOBILE_UPDATE_BRANCH`, defaulting to `origin/main`.
- The browser also checks update status after login and displays it in the sidebar version pill. The pill stays passive when the checkout is current or when Git metadata is unavailable.
- Clicking an available update asks for confirmation and then runs a fast-forward-only update. It refuses to run when the current branch is not the configured branch, the working tree is dirty, or the local branch is ahead/diverged.
- After a successful fast-forward, the server sends the HTTP response and exits after a short delay. The normal Windows hidden startup wrapper supervises the listener and starts it again from the updated files.
- For a Windows `-RunAsSystem` startup task, the same update flow applies: Git runs in the listener process, then the LocalSystem windowless supervisor restarts the listener. The launcher must keep the target user's `APPDATA` / `LOCALAPPDATA` / `USERPROFILE` mapping so the update does not switch to `C:\Windows\System32\config\systemprofile` for Codex binaries, runtime files, or Git safe-directory state.
- Manual starts such as `node server.js`, `npm start`, or a one-shot shell command do not include a supervisor. Those deployments apply the update, exit the old Node process, and then require the operator to manually restart the same service command.
- The update action only changes tracked repository files. Runtime state such as `%USERPROFILE%\.codex-mobile-web\access_key`, uploads, VAPID keys, and subscriptions remain outside the repository and are not overwritten.

中文说明：

- 本 public 版本把自更新能力放到侧边栏版本位置。登录后会后台检查当前仓库的 `origin/main` 是否有新提交；有可安全更新的提交时，版本 pill 会显示更新提示。
- 点击更新提示后会先弹出确认框。确认后只执行 fast-forward 更新，不会执行 reset、强制覆盖或合并冲突处理。
- 如果本地 public 部署目录有未提交改动、当前分支不是 `main`、本地提交领先远端或与远端分叉，自动更新会拒绝执行并提示原因。这样可以避免覆盖部署者自己的本地修改。
- 更新成功后，Node 服务会在返回响应后退出；Windows 隐藏启动 supervisor 会重新拉起服务。手动启动场景下，如果没有 supervisor，需要用户按原启动命令重新启动。
- 需要自动拉起的部署，应通过 Windows 启动任务、windowless supervisor 或 macOS shared launcher 运行。直接手动运行 `node server.js`、`npm start` 或一次性 shell 命令时，自更新会完成文件更新并停止旧服务，但不会凭空创建新的 Node 进程；这时需要在部署机重新执行启动命令。
- 本次 public 发布把 `package.json` 版本升到 `0.1.1`，高于当前 private 工作区的 `0.1.0`，便于用旧 public clone 测试“发现更新 -> 拉取 -> 重启 -> 版本升高”的完整链路。
- 本次 public PWA shell cache 同步升到 `codex-mobile-shell-v12`，安装到主屏幕的浏览器在 service worker 激活后会重新加载新的 HTML、CSS 和 JavaScript 资源。

## 2026-05-28 Local Hermes Mobile Plugin Mode v101

This local update adds an independent Hermes Mobile embedded-app plugin surface.
It exposes the metadata manifest, workspace registration, callback registration,
and launch-token endpoints under `/api/v1/hermes/plugin/...`. Registration and
launch require the Codex Mobile Access Key through `Authorization: Bearer` or
`X-Codex-Mobile-Key`; the Hermes callback URL may be an HTTPS domain and is
stored only in runtime state. The manifest can be pinned to an external HTTPS
base URL with `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` or
`CODEX_MOBILE_PUBLIC_BASE_URL`. The browser app shell cache advances to
`codex-mobile-shell-v101` so iframe launch URLs can use short-lived
`codexPluginLaunch` tokens without writing the long-lived Access Key to
`localStorage`.

## 2026-05-29 Local Hermes Mobile Embedded Plugin Contract v102

This local update completes the embedded iframe contract for the Hermes Mobile
plugin. The shell cache advances to `codex-mobile-shell-v102`.

- The manifest now includes `origin_registration`, `plugin_session`,
  `frame_embedding`, launch/session, and navigation contract metadata while
  still omitting raw Access Keys, token material, local secret paths, DB paths,
  uploads, and private content.
- Hermes can register a generic HTTPS iframe origin through
  `POST /api/v1/hermes/plugin/origins`; Codex serves HTML with CSP
  `frame-ancestors 'self' <registered origins>`. The manifest reports a clear
  diagnostic when an HTTPS Hermes origin would embed an HTTP Codex entry.
- `POST /api/v1/hermes/plugin/launch` returns only a short-lived `entry_path`.
  The iframe exchanges `codexPluginLaunch` through
  `/api/v1/hermes/plugin/session`, then removes the one-time token from the URL
  and keeps the plugin session in memory.
- `/?embed=hermes` hides standalone chrome, preserves iframe state across
  visibility/focus changes without forcing reload checks, posts
  `codex-mobile.plugin.navigation`, keeps normal thread/workspace routes
  `canGoBack=true` so iOS Hermes forwards right-swipe/back to Codex, and handles
  `hermes.plugin.back` by opening or closing iframe-owned navigation layers.
- Embedded mode blocks `window.open`, `target=_blank`, and external-link
  browser handoffs so Hermes Mobile does not need to inspect Codex DOM or call
  Codex route internals.

## 2026-05-29 Local Hermes Plugin Gesture-State v104

- Normal thread/workspace/new-thread routes now report `canGoBack=false` in
  `codex-mobile.plugin.navigation`, so Hermes keeps its own right-swipe/settings
  behavior instead of forwarding a back action into Codex and showing the
  initial Workspace list.
- Codex still handles `hermes.plugin.back` for iframe-owned transient layers
  such as file previews, dialogs, embedded drawers, and panels.
- The shell cache advances to `codex-mobile-shell-v104`.

## 2026-05-29 Local Hermes Plugin Sidebar Gesture v105

- Restored the standalone Mobile Web left-edge right-swipe behavior inside
  `/?embed=hermes`: swiping from a normal thread page opens Codex's overlay
  sidebar/settings surface instead of doing nothing.
- The plugin still does not clear the current thread/workspace to return to the
  initial Workspace page. `hermes.plugin.back` is only used to close iframe-owned
  transient layers such as the sidebar, settings panel, previews, dialogs, and
  subagent panels.
- The shell cache advances to `codex-mobile-shell-v105`.

## 2026-05-29 Local Hermes Plugin Back-To-Sidebar v106

- Normal thread/workspace/new-thread routes now report `canGoBack=true` in
  `codex-mobile.plugin.navigation`, so iOS Hermes Mobile forwards the right-swipe
  affordance into the iframe.
- On a normal Codex thread page, `hermes.plugin.back` opens Codex's overlay
  sidebar with the thread switcher and settings button. It does not clear the
  current thread into the first-launch Workspace page.
- If the sidebar, settings panel, preview, dialog, or subagent panel is already
  open, `hermes.plugin.back` closes that transient layer.
- iOS Hermes Mobile PWA verification confirmed this behavior: right-swipe from
  a Codex thread opens the Codex sidebar/thread switcher with the settings
  button, and does not return to the first-launch Workspace page.
- The shell cache advances to `codex-mobile-shell-v106`.

## 2026-05-29 Local Hermes Plugin Host-Back Result v107

- Codex now declares and emits `codex-mobile.plugin.back_result` for embedded
  back handling. Modal/edit surfaces still return `handled:true` after Codex
  closes them inside the iframe.
- When the Codex sidebar or settings surface is already open and Hermes sends
  `hermes.plugin.back`, Codex leaves that surface open and posts
  `handled:false` with a bounded route. Hermes should treat that as a request to
  handle the back action at the host level and return to its own navigation/tab
  surface, instead of the iframe closing back to the Codex thread page.
- The shell cache advances to `codex-mobile-shell-v107`.

## 2026-05-29 Local Hermes Plugin Primary Page v108

- In `/?embed=hermes`, the Codex thread switcher/settings surface is now the
  plugin's primary page, not a sidebar drawer. The primary page occupies the
  iframe as normal content and reports `canGoBack=false`, allowing Hermes
  Mobile's bottom tabs to remain visible.
- Codex thread detail and new-thread composer pages are secondary pages. When
  Hermes sends `hermes.plugin.back` from a thread page, Codex clears the thread
  detail and returns to the primary thread-switcher/settings page instead of
  opening or closing an overlay drawer.
- The local left-edge sidebar drawer gesture is disabled inside the Hermes
  iframe because page-level navigation is owned by the plugin primary/secondary
  route contract.
- The shell cache advances to `codex-mobile-shell-v108`.

## 2026-05-29 Local Hermes Plugin Notification Delegation v109

- Codex Mobile plugin notifications now use Hermes Mobile as the notification
  owner. The backend delegates safe, summary-only events to
  `POST /api/hermes-plugins/codex-mobile/notifications` with a server-side
  `X-Hermes-Web-Key`; the iframe does not register Web Push or receive the
  Hermes key.
- The manifest advertises the notification delegation contract and the local
  protected test path `/api/v1/hermes/plugin/notifications`, while still
  omitting Access Keys, launch tokens, Push endpoints, private file paths,
  prompts, model responses, and long logs.
- Turn-completed notifications are delegated to Hermes Action Inbox/Web Push
  when the Hermes notification delegate is configured. Standalone Mobile Web
  continues to use the existing local Web Push fallback when it is not
  configured.
- The shell cache advances to `codex-mobile-shell-v109`.

### 2026-05-30 Public 发布说明

本次 public 同步把 Hermes 插件嵌入体验、跨线程待办卡片体验和前台恢复稳定性一起推进到
`codex-mobile-shell-v130`。

- Hermes 插件嵌入态：
  - 线程长按菜单里的 `压缩续接` 不再依赖浏览器原生 `window.confirm()`，改为 iframe 内应用弹框，避免 Hermes 插件环境里“菜单能点但确认框不弹”的问题。
  - 左侧主区首次直进线程时，不再先明显闪回 Workspace / Recent 主页；会保持稳定的 `Opening thread...` 过渡态。
  - 从其他 App 切回当前线程时，不再优先走同线程 `Loading thread...` 重载，而是静默刷新当前屏。
  - Hermes 插件启动或 session/auth 失效但已请求宿主刷新时，不再先闪红色 `Codex` 错误框，而是显示中性的恢复态。
  - 当 Codex 需要 Hermes 宿主刷新插件页时，会先在 iframe 内显示显式的 `Refreshing plugin page...` 提示，并在约 10 秒后自动清除，避免长期停留成误导性横幅。
  - 合并 PR #41 后，PWA 底部输入栏进一步补上了 `safe-area-inset-bottom` 保护，减少底部安全区遮挡。
- Public PR / Restart：
  - 插件嵌入态保留版本号、`Restart` 和 `Public PR` 可见性，不再把整条版本操作区一起隐藏。
  - 接受 Public PR 提示后，草稿任务会回到 Codex Mobile Web 当前工作区的新线程草稿，而不是误投到当前打开的 Hermes 线程。
  - shared-chain 重启脚本新增 harness，固定“旧 8787 listener 退出不算成功；必须等到新的 HTTP 与 mux readiness 都恢复”这一规则。
- 跨线程待办卡片：
  - `#` 开头的跨线程请求在 draft 生成期会显示占位卡，不再短暂暴露原始 XML draft 片段。
  - draft / pending task card 默认改为中型卡片，正文折叠，需要时再展开。
  - 目标线程 `Approve` 后会等待并定位到真正注入出来的新 turn，而不是只看到卡片状态变化。
  - 原线程中的 draft 卡在 `Approve` 或 `Dismiss` 后会把 settled 状态持久化到浏览器存储，重新进入线程时不会从旧 XML 响应里“复活”。
- 测试与验证：
  - 同步更新了 `app-update`、Hermes plugin route、manual restart、mobile viewport、thread-task-card route 和 shared-chain restart script 相关测试。
  - 发布前通过 focused Node tests、`npm test`、`npm run check`、`npm run check:macos` 和 `git diff --check`。

## 2026-05-31 Local Hermes Plugin Appearance Sync v133

- Hermes plugin manifest now advertises a bounded `appearance_sync` contract:
  launch may pass `appearance.theme` (`system|dark|light`) and
  `appearance.fontSize` (`small|default|large|xlarge|xxlarge`).
- Plugin launch copies only those safe values into the short relative iframe
  entry path as `pluginTheme` / `pluginFontSize`; the browser session exchange
  returns the same sanitized `appearance` object. Long-lived Access Keys,
  session tokens, local paths, raw settings dumps, and private content are not
  included in that appearance payload.
- The embedded HTML head script applies host theme and font size before
  `styles.css` and `public/app.js` load, then `public/app.js` keeps the session
  appearance after token scrubbing. This avoids flashing the standalone/default
  theme or font size while Hermes initializes the iframe.
- The shell cache advances to `codex-mobile-shell-v133`.

## 2026-05-31 Local Cross-Thread Task Card Auto-Send v134

- Natural-language cross-thread card commands now auto-send after the model
  returns a valid bounded draft. The v134 build reserved only the exact
  `#自由协作` prefix for this flow; ordinary `#...` text remained a normal
  message. The source thread no longer asks for a second local `Approve`; only
  the target thread's pending card keeps `Approve` for injecting a real
  target-thread turn.
- The task-card service rejects likely encoding-damaged visible card text before
  persistence, so PowerShell/encoding-damaged `?? ?????` payloads cannot create
  unreadable pending cards.
- The shell cache advances to `codex-mobile-shell-v134`.

## 2026-05-31 Local Cross-Thread Autonomous Workflow v135

- `#自由协作` task-card drafts may now explicitly request
  `workflowMode:"autonomous"` for cooperating-thread workflows that should
  continue after one human approval.
- The v135 build still routed this flow only through `#自由协作`
  prefix; v194 supersedes that by making plain non-empty `# ...` the manual
  task-card command path.
- Ordinary cards still require target-side `Approve`. For autonomous workflows,
  the first target approval activates a workflow grant scoped to the workflow id
  and the same two thread ids. Later cards with that same workflow id between
  the same pair auto-inject as real target-thread turns; unrelated pairs still
  remain pending.
- The shell cache advances to `codex-mobile-shell-v135`.

### 2026-05-31 Public 发布说明（Hermes 外观同步、跨线程卡片修复与 Fast 圆点）

本次 public 同步把 private 中已验证的 v133-v139 产品改动发布到公开仓库。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v139`。部署后需要让 8787 Node listener 重新加载服务端文件；已安装到主屏幕或被 service worker 缓存的移动端客户端需要接受刷新提示、硬刷新或关闭重开，才能拿到新的静态界面。

- Hermes 插件嵌入：launch/session 支持安全的 `appearance.theme` 与 `appearance.fontSize` 同步，iframe 会在主样式和主脚本加载前应用主题/字号，减少嵌入态从默认主题闪到 Hermes 主题的视觉跳变。
- Hermes 通知标题：完成通知优先使用 app-server 线程显示名和嵌套 thread title，再回退到本地 SQLite；这避免旧续接线程把 bootstrap 提示误当作 Web Push / Hermes Inbox 标题。
- 跨线程任务卡片：`#` 自然语言卡片命令继续由当前 Codex 线程生成 bounded draft，但 source 线程不再显示二次 `Approve` 或临时 `Sending` 卡片；已创建或已 dismiss 的 draft 用稳定的 turn+draft 内容 key 持久化，重新进入线程不会因为 app-server item id 改变而复活。
- 目标线程卡片：thread detail 只渲染 target-side `pending` 卡片；source outgoing、`approved`、`deleted`、`revoked`、`replied` 和 transient `approving` 状态仍保留在运行态审计中，但不再作为可操作卡片堵在会话底部。`Approve` 在调用外部 `turn/start` 前先落盘为 `approving`，避免刷新、重连或压缩续接窗口里重新出现第二个可点的 `Approve`。
- 跨线程自主 workflow：draft 可以显式请求 `workflowMode:"autonomous"`。同一个 workflow id 和同一对 source/target 线程在首次人工批准后可继续自动注入后续卡片；复用到其他线程对时仍回到 pending，需要单独批准。
- 运行栏 Fast 圆点：模型前新增一个极小的持久化状态点，绿色表示普通模式，点击变红表示下一次新 `turn/start` 使用 Codex Fast 服务层。前端只提交隐藏 `fastMode` 字段，服务端映射为 `serviceTier: "priority"`；不会把可见 `/Fast` 文本插入用户消息，也不会改变模型、推理等级或权限设置。active-turn steering 不能改变已经开始的 turn 的速度层级。
- 发布同步还包含 workspace registry 服务、共享链重启安装脚本、多账号 CLI 文档、相关 README/docs 更新和覆盖测试。发布前 private 验证通过 `npm test` 255/255、`npm run check`、`npm run check:macos`、`git diff --check`；public 发布前应在 public 工作区重新运行同等检查。

### 2026-06-01 Public 发布说明（已知工作区本地文件预览）

本次 public 合入 PR #42，修复移动端无法预览已知 workspace 内本地文件的问题。版本仍为 `0.1.11`，不改变 PWA shell cache；更新后需要重启 8787 Node listener 以加载新的服务端文件预览根策略。

- 文件预览允许读取已知 workspace root 内的文件，也允许读取当前线程 cwd 内的文件；Markdown 预览继续按源文本列表编号渲染，避免预览内容把原始编号重新从 1 开始排。
- 安全边界没有放宽到任意磁盘目录：预览仍只解析显式允许根目录内的路径，并继续拒绝根目录外路径、敏感文件类型和不支持的二进制内容。
- 本次 public 同步没有复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

### 2026-06-01 Public 发布说明（worktree 线程可见性）

本次 public 合入 PR #43，修复 Codex worktree 中产生的线程在 Mobile Web 线程列表里不可见的问题。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v140`；更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开，才能拿到新的前端过滤逻辑。

- Mobile Web 现在把 `%USERPROFILE%\.codex\worktrees\<id>\<repo>` 形式的 cwd 映射回已知 workspace 的仓库名。线程列表、选中 workspace 后的过滤、服务端 fallback 线程补全和前端隐藏规则都会接受同名仓库 worktree。
- 服务端 `thread/list` 读取后会合并 state DB / session index fallback 线程，避免 app-server 列表遗漏 worktree 线程时 Mobile 端仍然空缺。
- `thread/turns/list` fallback 会结合 rollout item 时间戳排序 turns，避免只有随机 turn id 或缺少标准 started/completed 时间字段时把最近内容排错。
- 新增 `test/thread-visibility.test.js` 覆盖 worktree 可见性、无关 worktree 隐藏、归档线程隐藏、fallback 合并和 turn 时间排序。本次 public 同步仍不复制 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

### 2026-06-01 Public 文档同步说明

本次 public 追加同步 `docs/` 项目文档，确保公开仓库中的架构、模块、排障和复杂路径说明与 PR #42/#43 的实际行为一致。该提交只更新公开文档和 README，不包含 `.agent-context`、runtime state、本地密钥、上传内容或机器特定诊断。

- `docs/ARCHITECTURE.md` 记录 worktree cwd 可见性、state DB/session-index fallback 合并，以及本地文件预览允许根的安全边界。
- `docs/MODULES.md` 增加 thread visibility/worktree filtering 测试映射，并明确 `server.js` 负责线程可见性过滤和本地文件预览根组合。
- `docs/TROUBLESHOOTING.md` 增加 worktree 线程缺失排查步骤，并澄清文件预览不要通过加入宽泛根目录来修复。
- `docs/COMPLEX_FEATURE_PATHS.md` 增加 Thread Visibility And Worktree Filtering 实现路径，要求同一套 cwd 匹配同时作用于服务端和前端过滤。

### 2026-06-01 Public 发布说明（跨线程任务卡片 draft 自动创建修复）

本次修复 `#` 跨线程任务卡片在长源线程里可能只生成 draft、但没有真正写入任务卡 store 的问题。PWA shell cache 升到 `codex-mobile-shell-v141`；更新后需要让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开。

- 诊断结果：Hermes 源线程已返回有效 `<codex-mobile-thread-task-card-draft>`，目标是衣橱线程，但 `%USERPROFILE%\.codex-mobile-web\thread-task-cards.json` 没有新的 2026-06-01 记录，衣橱线程 pending 计数也为 0。
- 根因：前端按 draft key 回查当前线程时，遇到第一个普通 assistant/plan 消息就提前停止扫描；长线程中真正的 draft 往往在后面，导致 `/api/thread-task-cards` 创建请求没有发出。
- 修复后：回查逻辑会跳过非 draft 消息并继续扫描，找到后面的有效 draft 后再执行自动创建。新增测试防止再次把 `continue` 退回成提前 `return null`。

### 2026-06-01 Public 发布说明（线程加载、任务卡片、Token 统计和更新面板）

本次 public 发布同步 private 中已经验证的 v154-v157 改动。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v157`。部署后需要重启 8787 Node listener；已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开，才能拿到新的更新面板和前端行为。

- 长 rollout 线程详情不再因为超过 32MB 默认改用最近 8 个 turn 的 `thread/turns/list` 首屏；详情仍先走完整 `thread/read`，只有读取失败时才使用 bounded fallback。
- 跨线程任务卡片 draft 现在可以在目标 id 后半段被模型写坏、但前缀能唯一匹配可见线程时，恢复为真实目标线程 id，避免源线程停在 failed draft。
- Workspace Token 统计补齐历史 Windows 路径乱码归并。已经写入 SQLite 的 `财务`、`男装衣橱`、`系统工具` 乱码 cwd 会在查询时合并到正确 Unicode Workspace，不再在统计页显示为单独乱码项目；新增 harness 覆盖已经持久化的坏 cwd 行。
- 侧栏版本号现在打开 Updates 面板。Current checkout 继续使用原有安全 fast-forward 自更新路径；Public release 区域会检查 `pentiumxp/codex-mobile-web-public/main` 最新提交。只有当前安装本身就是 public checkout 时，才会通过同一个 fast-forward 路径应用 public 更新；private checkout 只显示 public 最新状态，避免把 public 发布树覆盖到私有开发树。

### 2026-06-03 Public PR 同步说明（归档 fallback 过滤与 Restart 风险提示 v166）

本次 private 同步 public PR #44 和 PR #45 的产品改动，并在当前 private v165 基础上把 PWA shell cache 升到 `codex-mobile-shell-v166`。服务端 session-index fallback 列表现在会再次排除已归档线程，避免 app-server 主列表遗漏线程时把已归档的 projectless session 重新显示出来；更新后需要重启 8787 Node listener 才会加载新的 `server.js`。前端手动 `Restart` 从浏览器原生确认框改为自定义确认面板，点击时会先读取最近线程列表并列出 running session 风险，提示重启可能中断正在通过 Codex Mobile 同步或运行的任务。已打开的浏览器/PWA 需要接受刷新提示、硬刷新或关闭重开后才能看到新的保护面板。

### 2026-06-04 本地更新说明（CLI 目标 `/g` 入口 v180）

本次更新在 v179 目标状态显示的基础上，增加一个不占界面的 `/g` composer 命令。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v180`；更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开。

- 在已有线程的 composer 中输入 `/g` 并发送，会打开目标填写对话框；填写 objective 和可选 token budget 后，当前构建通过 `/api/threads/:id/goal` 转发到 app-server `thread/goal/set`。
- `/g` 不再发送普通 Codex 消息，也不再依赖模型自己调用目标工具；目标创建要求运行中的 Codex app-server 支持 0.135.0 级别的 goal RPC。
- Mobile Web 仍不直接写 `goals_1.sqlite`。目标创建、状态变更和完成语义继续由 Codex app-server / CLI 运行时处理。

### 2026-06-04 本地更新说明（CLI 目标状态显示 v179）

本次更新让 Mobile Web 能显示 Codex CLI/Desktop 已支持的线程目标状态。版本仍为 `0.1.11`，PWA shell cache 升到 `codex-mobile-shell-v179`；更新后需要重启 8787 Node listener，并让已打开的浏览器/PWA 接受刷新提示、硬刷新或关闭重开，才能同时拿到服务端目标读取和前端目标卡片。

- 服务端新增 `adapters/thread-goal-service.js`，只读读取当前 `<CODEX_HOME>\goals_1.sqlite` 的 `thread_goals`，把 `budget_limited` 等 sqlite 状态规范化成前端可显示的公开状态，并给 `/api/threads` 列表和 `/api/threads/:id` 详情附加 `thread.goal`。
- 前端处理 app-server `thread/goal/updated` 和 `thread/goal/cleared` 通知；列表行显示紧凑 Goal/Paused/Budget/Done 徽标，线程详情顶部显示目标文本和预算/用时摘要。
- 0.135.0 级别的 app-server 协议提供 `thread/goal/set`、`thread/goal/get`、`thread/goal/clear`，但 Mobile Web 仍不直接写 `goals_1.sqlite`；旧 app-server 如果缺少 set RPC，会返回 unsupported-version 错误。

### Which Restart Is Needed After Changes

Use this table after pulling updates:

| Changed area | Required action |
| --- | --- |
| `public/index.html`, `public/app.js`, `public/styles.css` only | Refresh the browser tab. The Node server serves these files from disk. |
| `server.js` | Restart Mobile Web. |
| `codex-app-server-mux.js` | Fully quit Desktop and launch once with the force-restart mux option. |
| `start-codex-desktop-shared.ps1` or shim files | Fully quit Desktop, then relaunch through the updated shared launcher. |
| Windows startup scripts | Re-run `install-codex-mobile-web-startup.ps1` so the Scheduled Task points at the current launcher. |
| macOS `.sh` launcher files | Rerun `npm run check:macos`, then relaunch through the updated script. |

Windows mux replacement:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ForceRestartMux
```

Mobile Web restart on Windows:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787 -RequireSharedAppServer
```

## App-Server Bridge Design

Desktop live sync depends on making Codex Desktop and Mobile Web talk to the same `codex app-server` process.

The bridge is implemented by `codex-app-server-mux.js`:

1. Codex Desktop is launched with an app-server command override.
2. That override starts the mux process instead of starting `codex app-server` directly.
3. The mux starts the real `codex app-server` as a child process over stdio.
4. Codex Desktop stays connected to the mux over stdio.
5. The mux also opens a loopback JSONL TCP server for Mobile Web.
6. The mux writes an endpoint file under the Codex state directory:

```text
<CODEX_HOME>/app-server-mux/endpoint.json
```

7. Mobile Web detects that endpoint file and connects to the same mux-backed app-server stream.

The mux must keep stdout clean because stdout is the Desktop app-server protocol channel. Diagnostics are written to the mux log file instead.

In the default `auto` publish mode, a secondary `app-server --listen stdio://` mux will not overwrite an already reachable shared endpoint. This keeps short-lived agent/tool app-server sessions from stealing Mobile Web away from the Desktop-backed mux endpoint.

When `CODEX_MUX_KEEP_ALIVE=1`, the mux keeps the real app-server and TCP endpoint alive after the Desktop stdio client disconnects. A later Desktop launch through the same wrapper connects back to the existing mux instead of starting a second app-server.

The mux also proxies app-server requests such as command, file-change, and permission approvals. This allows Mobile Web to display approval cards and answer `允许一次`, `本会话允许`, or `拒绝` without creating a separate app-server stream.

The mux keeps a bounded notification replay buffer. Mobile Web receives buffered `turn/*`, `item/*`, `thread/*`, and rate-limit notifications after reconnecting, while Desktop notification replay is disabled by default to avoid rolling back Desktop's already-loaded durable thread view. Unresolved approval/server requests are replayed to both Desktop and Mobile Web.

## Windows Desktop Live Sync

Status: implemented and verified.

Codex Desktop normally starts its own `codex app-server` over stdio. If Mobile Web starts a separate app-server, both clients can read durable `.codex` state, but live UI streams will not fully converge.

For live sync on Windows, use the optional mux launcher:

1. Fully quit Codex Desktop.
2. Start Desktop through the shared launcher:

```powershell
cd C:\path\to\codex-mobile-web
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1
```

When Mobile Web's profile switcher is in use, launch Desktop with the matching
profile so Desktop and Mobile attach to the same mux endpoint:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ProfileId default
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ProfileId current
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ProfileId previous
```

The repository also includes `start-codex-desktop-default.cmd`,
`start-codex-desktop-current.cmd`, and `start-codex-desktop-previous.cmd`.
These wrappers pass `-ForceRestartMux` so the Desktop escape hatch starts from
the selected profile's current bridge files. Use `-CodexHome <path>` only for a
custom CLI home. Desktop's GUI ChatGPT login may still be global to the
installed app package; the reliable sharing boundary is the selected
`CODEX_HOME` plus its `<CODEX_HOME>\app-server-mux\endpoint.json`.

3. Start or reconnect Mobile Web.

The launcher sets `CODEX_CLI_PATH` only for the Desktop process it starts. It builds `codex-app-server-mux.exe` from `codex-app-server-mux-shim.cs` when needed, because Windows Codex Desktop expects `CODEX_CLI_PATH` to point to a real `.exe`.

The shared Desktop shortcut may open the Codex Desktop GUI, but every helper it
starts must stay windowless. Desktop shortcuts should target
`start-codex-desktop-shared-hidden.vbs` through `wscript.exe`, not the `.cmd`
profile wrappers. The default generated shim is `codex-app-server-mux-win.exe`
so older running `codex-app-server-mux.exe` processes do not block rebuilds. The
mux shim itself is compiled as `/target:winexe` and then launches its Node child
with `CREATE_NO_WINDOW` and hidden startup flags; Mobile Web startup/restart
helpers use hidden PowerShell/`Start-Process` paths for background mux/app-server
work. Mobile-owned app-server startup also clears Desktop-bridge-only
`CODEX_CLI_PATH` and `CODEX_MUX_*` variables before starting the real Codex CLI
child, so tool subprocesses do not loop back through a Desktop shim when Desktop
is not running.

By default, the launcher sets `CODEX_MUX_KEEP_ALIVE=1`. If Desktop is fully quit, the mux and real app-server should remain alive so Mobile Web can continue using the same stream. Starting Desktop again through the launcher attaches the new Desktop stdio session to the existing mux.

Because keep-alive deliberately preserves the mux process, normal Desktop restarts do not reload changed mux code. After updating the bridge code, fully quit Desktop and start it once with:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-desktop-shared.ps1 -ForceRestartMux
```

This stops the mux PID recorded in the endpoint file before launching Desktop, so the next Desktop session creates a fresh mux from the current files.

The mux writes its endpoint file here:

```text
<CODEX_HOME>\app-server-mux\endpoint.json
```

Mobile Web auto-detects that endpoint. If Mobile Web was already running before the mux was available, restart Mobile Web or call:

```text
POST /api/app-server/reconnect
```

For strict shared-stream operation, start Mobile Web with managed fallback disabled:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\start-codex-mobile-web.ps1 -HostAddress 0.0.0.0 -Port 8787 -RequireSharedAppServer
```

In this mode, if the shared mux endpoint is unavailable, Mobile Web reports the error instead of starting a separate app-server and creating a divergent stream.

## macOS Desktop Live Sync

Status: launcher scripts are included, but full Desktop live-sync verification still needs to pass on a real Mac/Codex Desktop build.

Standalone Mobile Web can run on macOS. The bridge core, `codex-app-server-mux.js`, is Node.js and portable. The macOS launcher uses `CODEX_CLI_PATH` to make Codex Desktop start `codex-app-server-mux-macos.sh`, which then execs the Node mux without writing anything to the app-server protocol stdout.

Current limitations:

- `start-codex-desktop-shared.ps1` is Windows-specific.
- `codex-app-server-mux-shim.cs` builds a Windows `.exe`.
- macOS shell-wrapper launch is implemented, but should be treated as unverified until the checklist below passes.
- If a future Codex Desktop build rejects a shell script as `CODEX_CLI_PATH`, add a tiny native macOS executable shim that execs the same mux command.

### macOS Bridge Start

For the easiest path, use the one-command launcher. It quits and relaunches Codex Desktop through the mux, starts Mobile Web in the background, and picks the first free non-reserved port from `8789` through `8899`. Port `8797` is reserved by default so it will not be selected automatically when another local Agent web service uses that port:

```bash
cd /path/to/codex-mobile-web
./start-codex-shared-mobile-macos.sh
```

The script prints the local URL, phone URL, access key file, and log paths. To force a specific port:

```bash
./start-codex-shared-mobile-macos.sh --port 8789
```

To adjust the reserved-port list:

```bash
CODEX_MOBILE_RESERVED_PORTS=8797,8787 ./start-codex-shared-mobile-macos.sh
./start-codex-shared-mobile-macos.sh --reserved-ports 8797,8787
```

If you intentionally want auto mode to consider every port in the range, disable the reserved list:

```bash
./start-codex-shared-mobile-macos.sh --no-reserved-ports
```

The manual steps below are useful when diagnosing the Desktop bridge.

1. Fully quit Codex Desktop.
2. Validate the launcher environment:

```bash
cd /path/to/codex-mobile-web
npm run check
npm run check:macos
./start-codex-desktop-shared-macos.sh --print-only
```

3. Start Codex Desktop through the shared launcher:

```bash
./start-codex-desktop-shared-macos.sh
```

If Codex is still running, the launcher exits instead of attaching to the wrong process. You can ask it to quit Codex first:

```bash
./start-codex-desktop-shared-macos.sh --force-quit
```

4. Start Mobile Web in another terminal:

```bash
./start-codex-mobile-web-macos.sh --host 0.0.0.0 --port 8787
```

Useful launcher overrides:

- `--app /Applications/Codex.app`
- `--desktop-exe /Applications/Codex.app/Contents/MacOS/Codex`
- `--codex "$(command -v codex)"`
- `--node "$(command -v node)"`
- `--codex-home "$HOME/.codex"`
- `--mux-wrapper "$PWD/codex-app-server-mux-macos.sh"`

The launcher sets:

- `CODEX_HOME`
- `CODEX_CLI_PATH`
- `CODEX_MUX_SCRIPT_PATH`
- `CODEX_MUX_CODEX_EXE`
- `CODEX_MUX_NODE_EXE`
- `CODEX_MUX_KEEP_ALIVE=1`

It launches `/Applications/Codex.app/Contents/MacOS/Codex` directly so the environment is inherited.

### macOS Bridge Verification Checklist

After launching Desktop with the shared launcher:

1. Confirm the mux endpoint file exists:

```bash
cat "$HOME/.codex/app-server-mux/endpoint.json"
```

Expected shape:

```json
{
  "protocol": "jsonl-tcp",
  "host": "127.0.0.1",
  "port": 12345,
  "pid": 111,
  "childPid": 222,
  "capabilities": {
    "mobileUserMessageEcho": true,
    "serverRequestProxy": true,
    "notificationReplay": true
  }
}
```

2. Confirm the mux log exists and does not show fatal startup errors:

```bash
tail -100 "$HOME/.codex/app-server-mux/mux.log"
```

3. Start Mobile Web:

```bash
cd /path/to/codex-mobile-web
export CODEX_HOME="$HOME/.codex"
export CODEX_MOBILE_HOST="0.0.0.0"
export CODEX_MOBILE_PORT="8787"
export CODEX_MOBILE_CODEX_EXE="$(command -v codex)"
export CODEX_MOBILE_NODE_EXE="$(command -v node)"
export CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER=1
npm start
```

4. Open `/api/status` through the authenticated UI and verify the transport is `external-jsonl-tcp`.

5. Start a test turn from Desktop and watch Mobile Web receive live updates.

6. Send a mid-turn message from Mobile Web and verify Desktop shows the user message and subsequent Codex output in the same active turn.

7. Quit Desktop and confirm the mux/app-server remain alive when `CODEX_MUX_KEEP_ALIVE=1`.

8. Relaunch Desktop through the wrapper and verify it reconnects to the existing mux endpoint rather than starting a second app-server.

Until this checklist passes on a real Mac, macOS Desktop live sync should be treated as unverified.

### Standalone Mux On macOS

A Mac user can still try standalone mux mode for Mobile Web only:

```bash
cd /path/to/codex-mobile-web
export CODEX_HOME="$HOME/.codex"
export CODEX_MUX_STANDALONE=1
node codex-app-server-mux.js
```

Then start Mobile Web in another terminal:

```bash
cd /path/to/codex-mobile-web
export CODEX_HOME="$HOME/.codex"
export CODEX_MOBILE_HOST="0.0.0.0"
export CODEX_MOBILE_PORT="8787"
export CODEX_MOBILE_CODEX_EXE="$(command -v codex)"
npm start
```

This can let Mobile Web connect to the mux endpoint, but it does not by itself make Codex Desktop share that mux.

## Web Push Notifications

Web Push is optional. It is intended for phone notifications when a Codex turn finishes.

This project does not provide a shared push gateway, a hosted HTTPS endpoint, or checked-in certificates. Each user runs Mobile Web on their own machine, exposes that local server through HTTPS, and lets the server generate its own local VAPID key pair.

Requirements:

- Open Mobile Web through HTTPS. iOS Safari/PWA push does not work on plain LAN HTTP.
- On iOS, add the HTTPS Mobile Web page to the Home Screen and open it from the Home Screen icon before enabling notifications.
- Allow notifications in iOS when prompted.
- Keep the Web Push runtime files local under `%USERPROFILE%\.codex-mobile-web`; do not commit them.
- No Apple Developer account is required for standards-based Web Push. Apple Push is contacted through the browser's Web Push subscription endpoint.
- No public HTTP registration step is required. The only public-facing requirement is that the phone opens Mobile Web from a valid HTTPS origin.

Current Windows/Tailscale example:

```powershell
tailscale serve --https=8443 http://127.0.0.1:8787
```

Then open:

```text
https://<tailscale-host>.ts.net:8443/
```

After login, use the `Enable notifications` button in the Mobile Web menu/top controls. After the subscription is created, the same button becomes `Send test notification`.

Notification behavior:

- Test notification title: `Codex Mobile Web`.
- Turn-completed notification title: `<thread-title>`.
- Turn-completed notification body: `This turn 已结束 · <local time>`.
- Turn-completed notifications bind `turn/started` metadata by turn id, then reuse that thread id and title on `turn/completed`. This avoids a completion notification from one shared-thread stream being labeled with another thread's title.
- Turn-completed Web Push and the normal thread list skip Sub Agent child threads recorded in `state_5.sqlite` `thread_spawn_edges` or marked with thread `agent_nickname` / `agent_role`. The parent/main thread completion can still notify, but individual Sub Agent completions do not create separate phone notifications or regular session rows.
- Clicking a notification opens Mobile Web and switches to the relevant thread when the thread id is available. The service worker sends a `codex-open-thread` message to an already-open Mobile Web window, so an installed iOS/PWA session does not have to rely on a full browser navigation to change threads.
- 中文说明：通知 payload 会带目标线程 ID。 如果 Mobile Web 已经打开，service worker 会聚焦现有窗口并把目标线程 ID 发给前端，前端收到后直接保存当前线程并调用线程详情加载接口；如果没有现有窗口，则先打开 `/`，再把目标线程 ID 通过消息传给新窗口。这样点击 Web Push 后应进入对应线程，同时减少移动端 PWA 把 `/?thread=...` 当成另一个启动窗口的机会。
- 中文说明：任务完成通知的标题直接使用完成任务所在的线程名，正文只显示完成状态和本地时间。服务端会在 `turn/started` 时记录 turn id 对应的线程 id 和标题，在 `turn/completed` 时复用这份绑定，避免一个线程的完成事件被标成另一个线程。

VAPID details:

- VAPID keys are generated automatically and stored in `%USERPROFILE%\.codex-mobile-web\web-push-vapid.json`.
- Subscriptions are stored in `%USERPROFILE%\.codex-mobile-web\web-push-subscriptions.json`.
- `CODEX_MOBILE_PUSH_SUBJECT` can override the VAPID subject.
- Do not use a `localhost` VAPID subject for Apple Push. Apple can reject it with `BadJwtToken`; the default subject is a non-localhost contact URI.
- The generated VAPID private key and browser subscription endpoints are local runtime state. They must not be committed to a public repository, pasted into issues, or copied into shared handoff files.

## Useful Environment Variables

| Variable | Purpose |
| --- | --- |
| `CODEX_HOME` | Codex state directory. Defaults to user home `.codex` in `server.js` and `codex-app-server-mux.js`. |
| `CODEX_MOBILE_HOST` | Web server bind host. Use `0.0.0.0` for phone access. |
| `CODEX_MOBILE_PORT` | Web server port, default `8787`. |
| `CODEX_MOBILE_RESERVED_PORTS` | Comma-separated ports skipped by `start-codex-shared-mobile-macos.sh` auto mode, default `8797`. Use this when other local Agent web apps reserve fixed ports. |
| `CODEX_MOBILE_CODEX_EXE` | Codex CLI executable path/name. |
| `CODEX_MOBILE_NODE_EXE` | macOS Mobile Web launcher Node executable path/name. |
| `CODEX_MOBILE_DISABLE_UPDATE_CHECK` | Disable startup/browser Git update checks when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_UPDATE_REMOTE` | Git remote used by the self-update check, default `origin`. |
| `CODEX_MOBILE_UPDATE_BRANCH` | Git branch used by the self-update check, default `main`. |
| `CODEX_MOBILE_UPDATE_CHECK_TIMEOUT_MS` | Timeout for update-check Git commands, default `15000`. |
| `CODEX_MOBILE_UPDATE_APPLY_TIMEOUT_MS` | Timeout for the fast-forward update command, default `120000`. |
| `CODEX_MOBILE_DISABLE_PUBLIC_PR_CHECK` | Disable the public-repository open-PR prompt when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_PUBLIC_PR_REPOSITORY` | GitHub `owner/repo` slug checked for open public pull requests, default `pentiumxp/codex-mobile-web-public`. |
| `CODEX_MOBILE_PUBLIC_PR_CHECK_TIMEOUT_MS` | Timeout for the unauthenticated GitHub public PR check, default `12000`. |
| `CODEX_MOBILE_PUBLIC_PR_CHECK_CACHE_MS` | In-memory cache window for public PR status checks, default `900000` (`15 minutes`). |
| `CODEX_MOBILE_KEY` | Inline web access key. |
| `CODEX_MOBILE_KEY_FILE` | Custom access-key file path. |
| `CODEX_MOBILE_DISABLE_AUTH` | Disable auth when set to `1`, `true`, `yes`, or `on`. |
| `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` | External HTTPS base URL advertised by the Hermes plugin manifest for `entry.url` and `program_api.base_url`. Prefer the Windows `-HermesPluginBaseUrl` startup parameter for scheduled deployments. |
| `CODEX_MOBILE_PUBLIC_BASE_URL` | General external base URL fallback used when `CODEX_MOBILE_HERMES_PLUGIN_BASE_URL` is not set. |
| `CODEX_MOBILE_HERMES_PLUGIN_FRAME_ORIGINS` | Semicolon/newline-separated Hermes iframe origins added to plugin CSP `frame-ancestors` at process start. Runtime `/api/v1/hermes/plugin/origins` registration can also add origins. |
| `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_BASE_URL` | Hermes Mobile base URL used by the backend notification delegate. When unset, Codex derives the Hermes origin from the registered workspace callback URL or app origin. |
| `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY` | Server-side Hermes Web/Owner access key used only for backend notification delegation. Do not expose it to the iframe or manifest. |
| `CODEX_MOBILE_HERMES_PLUGIN_NOTIFICATION_KEY_FILE` | Server-side file containing the Hermes notification delegation key. Prefer this over inline keys for deployments. |
| `CODEX_MOBILE_HERMES_WEB_KEY` | Fallback inline Hermes key for plugin backend calls when the notification-specific key is unset. |
| `CODEX_MOBILE_HERMES_WEB_KEY_FILE` | Fallback Hermes key file for plugin backend calls when the notification-specific key file is unset. |
| `CODEX_MOBILE_UPLOAD_DIR` | Upload storage directory. |
| `CODEX_MOBILE_MAX_UPLOAD_BYTES` | Max total upload bytes per message. |
| `CODEX_MOBILE_MAX_UPLOAD_FILES` | Max files per message. |
| `CODEX_MOBILE_IMAGE_CONTEXT_MODE` | Image model-context mode. Default `reference` sends images as path text only while still showing thumbnails in the UI. `latest` / `vision` sends only the latest uploaded image as `localImage`; `all` restores legacy all-image behavior. |
| `CODEX_MOBILE_SQLITE3_EXE` | Optional absolute path to `sqlite3.exe` for reading Codex `state_5.sqlite`. When unset, Mobile Web also checks common user-local Platform Tools / WinGet install paths before falling back to `sqlite3` on `PATH`. |
| `CODEX_MOBILE_THREAD_TURNS` | Number of recent turns kept in the compact mobile detail window and requested per older-history page, default `10`. Normal detail reads still prefer `thread/read`; the current live turn plus the previous ended turn, or the latest ended turn when no live turn exists, retain compact process items while older-history pages are receipt-only. |
| `CODEX_MOBILE_FULL_THREAD_TURNS` | Number of turns kept after full `thread/read` before mobile compaction, default `10`, capped at `200`. Keep this aligned with `CODEX_MOBILE_THREAD_TURNS` unless diagnosing payload size behavior. |
| `CODEX_MOBILE_ROLLOUT_CONTEXT_BYTES` | Tail bytes read from a thread rollout to recover inherited turn runtime settings, default `4194304`. |
| `CODEX_MOBILE_ROLLOUT_ENRICHMENT_CONTEXT_BYTES` | Legacy fallback tail bytes for server-side thread-detail enrichment if the incremental rollout index cannot read the file, default `33554432`. Normal enrichment uses the per-thread incremental JSONL index and does not increase the client turn payload. |
| `CODEX_MOBILE_ROLLOUT_ACTIVE_STATUS_WINDOW_MS` | Recent-activity window used when rollout-session fallback infers an `active` thread-list status from bounded rollout-tail events, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_THREAD_LIST_FALLBACK_CACHE_TTL_MS` | Optional diagnostic max age for the expensive state DB / rollout / session-index fallback baseline, default `0` meaning no time-based expiry for the running server process. Normal production behavior builds the baseline after cold start/redeploy/restart and then updates cached thread summaries incrementally from app-server list results and turn/status/title/archive/new-thread events. Silent list refreshes that run while a thread detail request is in flight use `fallback=defer`, and the server also defers ordinary list fallback when an active detail request is being served, so cold rollout scans do not contend with first paint or live detail refreshes. |
| `CODEX_MOBILE_ROLLOUT_WARNING_BYTES` | Rollout JSONL size threshold for UI warnings and the continuation action, default `209715200` (`200MB`). |
| `CODEX_MOBILE_CONTINUATION_BOOTSTRAP_CHARS` | Max characters in the rollout continuation bootstrap message, default `52000`. |
| `CODEX_MOBILE_CONTINUATION_SOURCE_HANDOFF_EXCERPT_CHARS` | Max source handoff excerpt characters included inline in a continuation bootstrap, default `12000`. |
| `CODEX_MOBILE_CONTINUATION_WORKSPACE_PROJECT_CONTEXT_CHARS` | Max project context characters included inline in a continuation bootstrap, default `18000`. |
| `CODEX_MOBILE_CONTINUATION_WORKSPACE_HANDOFF_TAIL_CHARS` | Max workspace handoff tail characters included inline in a continuation bootstrap, default `18000`. |
| `CODEX_MOBILE_CONTINUATION_ITEM_SUMMARY_CHARS` | Max characters per visible source-turn item summary in a continuation bootstrap, default `1200`. |
| `CODEX_MOBILE_CONTINUATION_TURN_SUMMARY_ITEMS` | Max non-user visible items kept per recent source turn in a continuation bootstrap, default `4`. |
| `CODEX_MOBILE_CONTINUATION_RECENT_TURNS` | Recent source turns summarized into the continuation bootstrap, default `12`, capped at `30`. |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_TIMEOUT_MS` | How long Mobile Web waits for the source thread to write its continuation handoff file before creating the new thread, default `240000`. |
| `CODEX_MOBILE_CONTINUATION_LATE_HANDOFF_TIMEOUT_MS` | Extra background wait when the first handoff wait expires but the source thread may still be writing, default `600000`. |
| `CODEX_MOBILE_CONTINUATION_REUSE_HANDOFF_MS` | How long a recent source-thread handoff file may be reused when retrying continuation, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_MIN_CHARS` | Minimum source handoff file length accepted as complete, default `400`. |
| `CODEX_MOBILE_CONTINUATION_HANDOFF_TURN_COMPLETION_TIMEOUT_MS` | Extra wait for the source handoff turn to report a completed status after the handoff file is written, default `60000`. |
| `CODEX_MOBILE_CONTINUATION_JOB_TTL_MS` | How long finished continuation jobs stay queryable for the mobile UI, default `1800000` (`30 minutes`). |
| `CODEX_MOBILE_CONTINUATION_JOB_MAX` | Maximum continuation jobs retained in memory, default `50`. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_DEPTH` | Maximum previous continuation links included in a new bootstrap, default `2`, capped at `5`. |
| `CODEX_MOBILE_CONTINUATION_LINEAGE_MAX_CHARS` | Maximum characters used for lineage instructions and handoff excerpts inside a bootstrap, default `12000`. |
| `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_COMPACT_BYTES` | Size threshold for automatically compacting workspace `.agent-context/HANDOFF.md` before rollout continuation, default `307200` (`300KB`). |
| `CODEX_MOBILE_CONTINUATION_CONTEXT_HANDOFF_PRESERVE_CHARS` | Approximate number of recent handoff characters preserved in the compact active handoff after archival, default `60000`. |
| `CODEX_MOBILE_PERSIST_EXTENDED_HISTORY` | Controls whether Mobile Web asks app-server to persist extended history on thread start/resume, default enabled. Set to `0` to disable for all Mobile Web turns. |
| `CODEX_MOBILE_PERSIST_IMAGE_EXTENDED_HISTORY` | Controls whether turns with image uploads may still persist extended history, default disabled. Leave unset so images behave as temporary visual references after the current turn. |
| `CODEX_MOBILE_MESSAGE_DEDUPE_WINDOW_MS` | Time window for treating repeated message submissions as the same request, default `90000`. Requests with `clientSubmissionId` are deduped by id; legacy requests without it fall back to content fingerprinting. |
| `CODEX_MOBILE_MESSAGE_DEDUPE_MAX` | Maximum number of recent message submissions kept in the dedupe cache, default `300`. |
| `CODEX_MOBILE_MUX_REPLAY_NOTIFICATION_LIMIT` | Maximum buffered mux notifications requested by Mobile Web on reconnect, default `200`; unresolved approval/server requests are still replayed separately. |
| `CODEX_MOBILE_PUSH_SUBJECT` | VAPID subject used for Web Push. Must be a non-localhost contact URI, for example `mailto:name@example.com` or an HTTPS URL. |
| `CODEX_MOBILE_PUSH_TTL_SECONDS` | Web Push TTL in seconds, default `3600`. |
| `CODEX_MOBILE_PUSH_VAPID_FILE` | Custom runtime path for Web Push VAPID keys. |
| `CODEX_MOBILE_PUSH_SUBSCRIPTIONS_FILE` | Custom runtime path for stored Web Push subscriptions. |
| `CODEX_MOBILE_MUX_ENDPOINT_FILE` | Custom mux endpoint file path. |
| `CODEX_MOBILE_APP_SERVER_WS` | External app-server WebSocket endpoint. |
| `CODEX_MOBILE_APP_SERVER_TCP` | External app-server JSONL TCP endpoint. |
| `CODEX_MOBILE_REQUIRE_SHARED_APP_SERVER` | When `1`, Mobile Web must connect to an external/shared app-server endpoint and must not fall back to a managed child. |
| `CODEX_CLI_PATH` | Desktop-side override used to make Codex Desktop launch the mux instead of the normal Codex CLI/app-server command. Windows path must be a real `.exe`; macOS behavior is unverified. |
| `CODEX_MUX_SCRIPT_PATH` | Path to `codex-app-server-mux.js` for shim/wrapper launchers. |
| `CODEX_MUX_CODEX_EXE` | Real Codex CLI executable used by the mux to start the real app-server. |
| `CODEX_MUX_NODE_EXE` | Optional explicit Node executable for shim/wrapper launchers. |
| `CODEX_MUX_STANDALONE` | Start mux without attaching stdin/stdout Desktop client when set to `1`, useful for Mobile Web-only mux testing. |
| `CODEX_MUX_KEEP_ALIVE` | Keep mux and real app-server alive after Desktop stdio disconnects; Desktop relaunches can attach back to the existing mux. |
| `CODEX_MUX_ENDPOINT_FILE` | Custom mux endpoint file path. |
| `CODEX_MUX_PUBLISH_ENDPOINT` | Controls whether this mux writes the shared endpoint file. Default `auto` lets primary/Desktop muxes publish but prevents secondary `--listen stdio://` muxes from overwriting a reachable endpoint. Set `1` or `0` for diagnostics. |
| `CODEX_MUX_CODEX_ARGS` | Override real Codex app-server arguments. When unset, Desktop-supplied arguments are passed through, otherwise the mux falls back to `app-server --analytics-default-enabled`. |
| `CODEX_MUX_REPLAY_BUFFER_LIMIT` | Maximum buffered app-server notifications for Mobile Web reconnect replay, default `1200`. |
| `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS` | Maximum replay-buffer age in milliseconds, default `1800000` (30 minutes). |
| `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS` | Controls Desktop historical notification replay. Default is enabled (`1`); set to `0` to disable Desktop replay during reconnect diagnostics. |

`start-codex-desktop-shared.ps1 -ForceRestartMux` is a launcher option, not an environment variable. It is intended for bridge updates where an existing keep-alive mux must be replaced.

## Troubleshooting

### Mobile Web Shows `Loading thread`

1. Confirm the web server is reachable.
2. Confirm `/api/status` reports `ready=true`.
3. If strict shared-stream mode is enabled, check that the mux endpoint file exists:

```text
%USERPROFILE%\.codex\app-server-mux\endpoint.json
```

4. If the endpoint points to an old mux after code changes, fully quit Desktop and use `-ForceRestartMux`.
5. If only one browser tab is stale after a frontend update, refresh that tab. Static files are read from disk and do not require a Node restart.

### Desktop Does Not See Mobile Web Messages

- Desktop must be launched through the shared launcher. A normal Desktop launch starts its own stdio app-server and will not share the same live stream.
- Mobile Web status should show an external/shared transport such as `external-jsonl-tcp`.
- If Desktop was offline while Mobile Web continued, future reconnect replay depends on the mux replay buffer. Events older than `CODEX_MUX_REPLAY_BUFFER_MAX_AGE_MS` or beyond `CODEX_MUX_REPLAY_BUFFER_LIMIT` may not replay from mux memory.
- If Desktop loads complete history and then visually rolls back, temporarily set `CODEX_MUX_REPLAY_DESKTOP_NOTIFICATIONS=0` and compare behavior with Desktop replay disabled.

### Approval Cards Do Not Appear

- Approval cards require the shared mux path because approvals are server requests on the app-server stream.
- Confirm the endpoint capabilities include `serverRequestProxy: true`.
- If Mobile Web is connected to a managed child app-server instead of mux, approvals for the Desktop stream will not appear in Mobile Web.

### iOS Returns To A Blank Or Black Page

- Refresh the page first to ensure the latest frontend files are loaded.
- Current public builds keep full-screen Home Screen `standalone` mode because that is the intended mobile experience. The manifest includes a stable app id and launch-handler hints, but iOS/WebKit can still create separate PWA scenes in some system-return paths.
- Entry recovery overlays are not shown. If iOS creates a separate black PWA scene, switch back to the original working scene or close the black scene from the app switcher; the page does not try to refresh the already-good original scene as a workaround.
- The app runs multiple foreground recovery passes after `visibilitychange`, `pageshow`, and `focus`, but iOS browser compositing can still be device/browser-version dependent.
- If the page is visually blank but the server is alive, switch away and back once; then check whether the issue reproduces after a full page refresh.

## Safety Notes

- Do not commit `.codex`, `.codex-mobile-web`, access keys, uploaded files, logs, or local binaries.
- Do not bind to `0.0.0.0` on an untrusted network unless auth is enabled and the network exposure is intentional.
- Do not expose this server directly to the public internet.
- Do not patch a system Codex Desktop installation. Use reversible launchers or environment variables.
- Treat uploaded files as local runtime data; non-image uploads are referenced by absolute local path.

## For Codex Agents Working In This Repo

When a user asks you to operate this repository after cloning it:

1. Read `README.md` first.
2. Check the platform with `uname -a` on macOS/Linux or `$PSVersionTable` / `Get-ComputerInfo` on Windows.
3. Check Node and Codex:

```bash
node --version
codex --version
```

4. Run:

```bash
npm run check
```

5. Start with the platform-specific command above.
6. If the user asks for Desktop live sync:
   - On Windows, use `start-codex-desktop-shared.ps1` after fully quitting Codex Desktop.
   - On macOS, use `start-codex-desktop-shared-macos.sh` and state that the Desktop bridge is not verified until the checklist passes on a real Mac.

Record durable setup facts in `.agent-context/HANDOFF.md` if this repo is being modified.
