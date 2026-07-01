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

## 2026-06-30 私有修复说明（v610 active 线程重入绘制保护）

本次私有修复解决 active 大线程在同一线程重复打开或自动重入时，内容区先短暂清空、
随后再重新绘制的问题。API 自检显示线程详情投影稳定，但真实浏览器样本会在非空 DOM
之后短暂出现 0 turns/0 items；根因是前端把已经加载的 active detail 当成不可复用缓存，
先切到 stripped active preview 或 loading shell，导致用户正在看的回执/过程被拿掉。

v610 改为把同一当前线程的非空 loaded active detail 作为刷新期间视觉基线，并立即安排
后台 refresh。这样不会把旧内容当最终权威，也不会在请求期间清空已绘制 DOM。

涉及文件：

- `public/thread-detail-state.js` 为 active loaded detail 增加 visual-baseline 复用策略。
- `public/app.js` 在 cached-current 视觉基线后安排后台 refresh。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v610`。

本地验证：

```sh
npm test -- test/thread-detail-state.test.js test/conversation-render.test.js test/client-render-stability-guard.test.js
```

8788 v610 本地实例浏览器自检对 Home AI 主线程和当前 Codex Mobile 线程均返回
`issueCount=0`，不再报告 `browser_dom_sparse_after_nonempty`。

## 2026-06-30 私有修复说明（v609 持续阅读位置保护）

本次私有修复把 v608 的自动刷新保护从“最近滚动短窗口”收紧为
“用户已把当前会话滚离底部”的持续阅读状态。只要用户在当前线程中停留在
中间过程或历史内容位置，自动 post-completion refresh、Usage backfill、
live-poll 和 resume refresh 都会被取消或在响应返回后忽略；保护直到用户
回到底部或执行显式操作为止。

涉及文件：

- `public/conversation-scroll.js` 增加 `user-reading-away-from-bottom` 策略。
- `public/app.js` 记录当前线程的离底部阅读状态，并把它接入自动刷新、
  in-flight refresh response apply gate 和 viewport anchor preservation。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v609`。

验证范围：

```sh
npm test -- test/conversation-scroll.test.js test/turn-scroll-controls.test.js
```

## 2026-06-29 Public 发布说明（v581 completed-turn 提交和轻微颤动修复）

本次 Public 同步 `codex-mobile-shell-v581` 以及 v578-v581 这一组已经
私有生产部署并通过浏览器自检的修复。它面向的是近期移动端和 embedded
场景里最影响使用的几类状态不一致：用户消息发送后短暂消失、完成 turn
下面残留 pending 用户消息、阅读过程中被 live 更新拉动、轻微几 px 颤动、
以及 slow-path 诊断反复生成不需要 Owner 处理的维修卡。

本次发布的根因修复包括：

- v578 修正已提交用户消息在 live turn 中被旧投影覆盖的问题。服务端
  pending echo 会在目标 turn 完成后清理，浏览器自检也加入
  `browser_pending_user_message_disappeared` / submitted-message 可见性检查。
- v579 增强用户阅读保护：当用户正在上滑阅读或页面处于非底部阅读状态时，
  live 更新不再主动改写 viewport；自检覆盖最新 turn 时间戳、图片加载、
  operation/reasoning 泄露和 sparse 样本回退。
- v580 把 `thread_session_slow_path` 默认改为 observe-only。线程详情偶发
  1-3 秒或 3-10 秒慢路径仍会被本地累积为诊断参考，但默认不再自动通知
  Owner 或生成重复维修卡；真正可行动的投影/渲染错误仍保持可上报。
- v581 修复 completed turn 下提交新消息时的 stale active-turn 归属问题。
  已完成回执下方不再残留错误的用户消息 echo，`.conversation .entry-animate`
  和 `.entry-leave` 动画也被禁用，避免消息卡片插入/替换时出现轻微抖动。
- 浏览器 self-check 增加可见锚点 jitter 和 submitted-message jitter 检测，
  既能测全屏刷新，也能测几 px 的轻微颤动；后续部署后可以继续作为
  用户体验回归的自动检查入口。

私有生产读回已经确认：

- `clientBuildId=0.1.11|codex-mobile-shell-v581`
- `shellCacheName=codex-mobile-shell-v581`
- Source/prod hash parity 覆盖 `public/app.js`、`public/styles.css`、
  `public/sw.js`、`adapters/message-pending-echo-service.js` 和
  `scripts/codex-mobile-browser-runtime-self-check.js`
- 浏览器 runtime self-check：36 个样本，`issueCount=0`，
  `blockingIssueCount=0`，`maxVisualAnchorSmallJitterCount=0`，
  `maxVisualAnchorShiftPx=0`，`maxSubmittedMessageSmallJitterCount=0`，
  `maxSubmittedMessageShiftPx=0`，图片、timestamp、operation/reasoning
  泄露、console warning/error 和 browser exception 都为 0。

验证范围：

```sh
node --test test/home-ai-diagnostic-reporting.test.js test/thread-diagnostic-events.test.js
node --test test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js
node --test test/message-pending-echo-service.test.js test/conversation-render.test.js test/conversation-scroll.test.js test/turn-scroll-controls.test.js
npm test
npm run check
npm run check:macos
git diff --check
```

Public 仓库只同步公开源码、README、docs、scripts 和测试；不包含
`.agent-context`、runtime state、本地密钥、访问 key、launch token、上传内容、
完整 rollout、私有日志或任何 Home AI/Codex 私有运行时数据。

## 2026-06-29 Public 发布说明（v577 投影一致性和浏览器自检闭环）

本次 Public 同步 `codex-mobile-shell-v577` 以及同批私有生产验证过的
投影一致性、浏览器自检和周期巡检修复。它面向的不是单个 UI 细节，而是
近期用户实际遇到的高风险状态错乱：最新 turn 里用户消息或 assistant 回执
一会出现、一会消失、偶尔重复，live 回执时间显示成 turn 开始时间，以及
API 自检通过但真实浏览器 DOM 已经重复或降级。

本次发布的根因修复包括：

- 服务端 detail 响应在 active assistant 回填后会做一次根因级收束：同一
  live turn 里，如果 Codex app-server 已经给出原生 assistant/plan 消息，
  rollout synthetic progress 里相同正文的临时 assistant 消息会被移除；
  synthetic 自身重复也会被移除。这样不会靠浏览器去重掩盖问题，而是在
  投影边界只保留一个权威 assistant 进度源。
- 对于 active overlay 里没有显式 synthetic 标记的旧式 `item-N` assistant
  回执，如果同一 live turn 已经有同文本的原生 `msg_*` assistant 回执，
  服务端会在最终响应前删除旧式投影行。这个修复来自浏览器自检真实抓到的
  `browser_latest_turn_assistant_text_duplicate` H2，不是客户端兜底。
- API 自检现在理解 `mobileSyntheticActiveAssistantDeduped` 这类投影会计
  证据，不再把“已经被服务端去重解释过的 overlay/detail 数量差”误报成
  active overlay projection gap；真实的 active assistant 丢失仍然会报 H2。
- live assistant/plan item 没有 item-level timestamp 时，不再回退到 turn
  start / UUIDv7 时间。缺失时间会被 runtime self-check 报成缺口，避免用户
  看到旧的“00:40”之类假时间。
- 浏览器 self-check 增加最新 turn 内部不变量：最新 turn 的 item 数、用户
  消息数、assistant/plan 数不能在同一 turn 内回退；最新 turn 内重复
  assistant 文本会作为 H2 `browser_latest_turn_assistant_text_duplicate`
  报告。报告只包含计数和 hash，不输出消息正文。
- 周期 runner 支持更长的真实浏览器采样窗口：
  `--browser-rounds`、`--browser-sample-delays-ms` 和
  `--browser-min-settled-delay-ms`。默认采样覆盖 `100,350,1200,2800,6000ms`，
  用于抓“几秒后被旧投影覆盖”的客户端问题。

生产读回已经确认：

- `clientBuildId=0.1.11|codex-mobile-shell-v577`
- active Codex Mobile detail readback：active assistant duplicateGroups=`0`
- browser runtime self-check：75 个浏览器样本，`blockingIssueCount=0`，
  `maxLatestTurnAssistantTextDuplicates=0`，`maxImageFailures=0`，
  `maxLatestTimestampMissingItems=0`
- runtime self-check loop：`ok=true`；API 侧只剩已知非阻塞 H3
  `thread_list_updated_order_mismatch`
- LaunchAgent `com.hermesmobile.codex-mobile-runtime-self-check` 最新运行
  `ok=true`，`last exit code=0`

验证范围：

```sh
node --test test/thread-detail-self-check-service.test.js
node --test test/thread-detail-self-check-service.test.js test/thread-item-timestamp-enrichment.test.js test/browser-runtime-self-check-service.test.js test/runtime-self-check-loop.test.js test/conversation-render.test.js test/message-timestamp.test.js test/thread-detail-active-window-overlay-policy-service.test.js test/thread-detail-read-orchestration-service.test.js test/thread-detail-projection-service.test.js
node --test test/thread-item-timestamp-enrichment.test.js test/thread-detail-self-check-service.test.js test/browser-runtime-self-check-service.test.js test/conversation-render.test.js
npm test
npm run check
npm run check:macos
git diff --check
```

Public 仓库只同步公开源码、README、docs、scripts 和测试；不包含
`.agent-context`、runtime state、本地密钥、访问 key、launch token、上传内容、
完整 rollout、私有日志或任何 Home AI/Codex 私有运行时数据。

## 2026-06-29 Runtime Self-Check / Image Caption Hotfix（v576）

本次私有生产修复升级到 `codex-mobile-shell-v576`，集中处理三个用户可见问题：

- 用户上传图片、系统生成图片、Markdown/data 图片和不可用图片占位都不再显示文件名、
  本地路径或链接标题；消息流只显示图片本身或中性的失败占位。图片加载路径仍保留
  `/api/uploads/file` / `/api/generated-images/file` 的同源/proxy-safe `src`，
  不把本地绝对路径暴露成浏览器可见文本。
- 进行中的 live assistant/plan 回执如果缺少逐条 timestamp，会回退到 turn start /
  UUIDv7 时间；不会再因为 active turn 而显示空时间，也不会用线程 `updatedAt` 污染
  中间回执时间。
- 浏览器 runtime self-check 扩展为真实 DOM 契约检查：同一线程已经确认非空后，
  后续采样变稀疏、visible item 明显下降、最新 turn 时间戳缺失、最新 turn Usage
  缺失、图片加载失败都会成为 H2 metadata-only issue。此前 `contentConfirmed=false`
  的稀疏样本会被跳过，导致用户看见“消息一会消失一会出现”但自检仍 `ok:true`；
  现在只禁止它作为健康 baseline，不再禁止它作为回退证据。

新增统一 runner：

```sh
node scripts/codex-mobile-runtime-self-check-loop.js --server http://127.0.0.1:8787 --json
node scripts/codex-mobile-runtime-self-check-loop.js --server http://127.0.0.1:8787 --loop --interval-ms 600000 --json
node scripts/codex-mobile-runtime-self-check-launchagent-readback.js --json
```

第一条用于每次部署后的 one-shot 检查；第二条用于 10 分钟周期巡检并写入
`~/.codex-mobile-web/logs/runtime-self-check.jsonl`；第三条用于只读确认
LaunchAgent 是否已加载、最新周期结果是否带 `gate`、以及
`periodicHealthy` 是否为真。输出只包含 build/cache id、
短 hash、issue 计数和 bounded error code，不包含消息正文、任务卡正文、上传内容、
线程标题、cookie、token、access key、私有路径或长日志。

## 2026-06-28 Public 发布说明（v570 外部链接和 Home AI Deploy 通道）

本次 Public 同步 `codex-mobile-shell-v570` 以及同批私有生产验证过的
任务卡部署通道修复。它包含两个面向实际使用的变化：

- 回执里的外部下载链接可以在用户点击后交给默认浏览器打开。
- 常规插件部署任务卡不再投递到普通 Home AI 实现线程，而是进入专用
  `Home AI Deploy` 通道。

外部链接修复只允许用户主动点击的绝对 `http`、`https` 和 `mailto`
链接打开；`/api/...`、本地文件路径和不安全 scheme 继续留在既有的
内部预览/拒绝路径。Home AI embedded 模式下，Codex Mobile 仍会向宿主
发送 bounded `codex-mobile.plugin.external_link` 事件用于观测，但不会把
原始链接、私有路径、token、cookie 或上传内容写入诊断。

部署通道修复新增
`adapters/thread-task-card-deploy-lane-policy-service.js`。Codex Mobile 会把
Home AI app 工作区内精确命名为 `Home AI Deploy` 的未归档线程识别为 durable
部署 lane；即使该线程在 app-server 状态上处于 resting `completed`，路由层也会
把它作为可投递的 idle deployment lane 暴露。常规插件部署卡如果误指向普通
Home AI 线程，会在部署 lane 可用时重定向到 `Home AI Deploy`；如果部署 lane
缺失或不可用，则 fail closed 为 `deploy_lane_required`。Home AI host/platform
修复、deploy-contract、proxy、LaunchD、Gateway、schema 和部署 lane 自身修复
仍然保留普通 Home AI 实现线程路由。

私有生产读回已确认：

- `clientBuildId=0.1.11|codex-mobile-shell-v570`
- `shellCacheName=codex-mobile-shell-v570`
- `Home AI Deploy` lane 可见，`mobileDeployLane=true`

验证范围：

```sh
node --test test/thread-task-card-deploy-lane-policy-service.test.js test/thread-task-card-routing-service.test.js test/thread-task-card-route.test.js test/thread-task-card-service.test.js test/codex-mobile-mcp-server.test.js test/home-ai-autonomous-delivery-return-service.test.js test/workspace-source-write-guard-service.test.js
npm run check
npm run check:macos
git diff --check
```

Public 仓库只同步公开源码、README、docs、scripts 和测试；不包含
`.agent-context`、runtime state、本地密钥、访问 key、launch token、上传内容、
完整 rollout 或私有日志。

## 2026-06-28 Operation Render Key Hotfix

本次热修复处理一个客户端单窗口也会触发的投影显示回归：同一个 turn 内出现多条相同
command/tool operation 时，前端旧的 `stableOperationRenderKey()` 只使用
thread、turn 和 operation group，导致多条不同 operation 生成同一个 DOM render key。
浏览器 patch 因 `post-apply-duplicate-render-keys` 被拒绝后会回退整段重绘，用户侧表现为
用户消息短暂消失、回执忽隐忽现、重复消息、线程详情闪烁。

修复后，operation render key 额外包含 item identity 和原始 index；自检也按客户端同一套
render-key 规则扫描 thread detail，发现重复会报 `duplicate_client_render_keys`。这样
服务端/API 投影稳定但浏览器 DOM 身份冲突的情况可以在自检阶段被发现，而不是只依赖用户
看到画面错乱后上报。

这次变化会升级静态 shell/cache 到 `codex-mobile-shell-v573`。部署后需要浏览器、PWA 或
Home AI embedded WebView 加载新 shell 才能消除旧客户端已缓存的重复 key 行为。

## 2026-06-28 Frontend Runtime Health 布点（v574）

本模块把自检从服务端/thread-detail 扩展到前端用户操作层和真实 DOM 渲染层。新增
`public/frontend-runtime-health.js`，并接入 `public/app.js` 的现有线程发送和
conversation patch 路径。

首批覆盖三个用户可见失败面：

- 用户在现有线程发送消息后，客户端本地已登记该 `clientSubmissionId`，但当前线程 DOM
  在 0.35s / 1.2s / 2.8s 探测点看不到对应短 hash 标记，会记录
  `frontend_runtime_mismatch / submitted_message_dom_missing`。
- 线程详情从非空 DOM 突然退化到 0/1 个可见节点，会记录
  `frontend_runtime_mismatch / render_dom_drop`。
- 短时间内连续 full render 或 patch fallback，会记录
  `frontend_runtime_mismatch / render_churn`。

这些事件仍走 Home AI diagnostic reporter 的重复失败阈值和节流机制：单次瞬时刷新不会
直接打扰 Owner，连续同签名失败才会通过 `homeai.diagnostic.report` 进入 Home AI
Owner-gated 诊断闭环。上报内容只包含 build id、route kind、read/render mode、短 hash、
DOM/visible/count 计数和 bounded reason code；不包含消息正文、任务卡正文、上传内容、
原始线程 id、cookie、token、access key、私有路径或长日志。

这不是前端兜底去重逻辑，也不改变投影 authority。它的作用是把“用户消息发出后消失、
刷新后又出现、整页重绘抖动”这类浏览器层问题变成可复现、可归类、可由 Home AI 自动
生成修复卡的 metadata-only 证据。

## 2026-06-28 Public 发布说明（线程详情自检、Usage 工具条和 completed replay 稳定性）

本次 Public 同步的是 `codex-mobile-shell-v568` 前后的线程详情稳定性修复。它覆盖了
最近生产中已经验证过的一组根因修复：线程详情 authority 不能被 stale projection
覆盖、active-overlay 不能丢失刚完成 turn、completed replay 要保留用户可见进度但
去掉命令/推理噪声、Usage 必须随最终回执稳定附加，以及系统要能用 metadata-only
自检主动发现这些回归。

主要变化：

- 线程详情响应出口统一修正 visible active-turn 契约，避免旧的 active-looking turn
  在刷新时继续遮挡当前 turn。
- active-overlay / turns-list / projection 路径都会在缺失最新 completed turn 时补回
  rollout completion，并在响应准备阶段统一附加 Usage summary。
- 最新 completed turn 的 replay 只保留用户可见的 assistant/progress/final receipt
  和 Usage；operation/command/file/tool 行与 reasoning 行不再在重新进入线程后显示。
- Usage 行不再显示额外的 `Usage` 标题和 Usage 自身时间戳，只保留 compact Usage
  工具条；最终回执自身仍承担该 turn 的时间锚点。
- 新增 `adapters/thread-detail-self-check-service.js` 和
  `scripts/codex-mobile-thread-self-check.js`，用于 metadata-only 检查线程列表排序
  稳定性、详情刷新降级、最新 completed turn Usage、时间戳、重复 visible key、
  completed replay 行类型和 response-budget 证据。
- active-overlay partial window 如果包含 assistant/Usage 但缺失对应的用户输入或上下文，
  不再被写入 projection seed，也不会直接返回给客户端；服务端会先尝试 full/dynamic
  projection 修复，修复不了才退回 full read。

这次 Public 发布只同步公开源码、README、docs、scripts 和测试；不包含
`.agent-context`、runtime state、本地密钥、上传内容、完整 rollout、访问 key、
launch token、私有日志或机器特定诊断。已经打开的浏览器、PWA 或 Home AI embedded
WebView 需要接受刷新提示、硬刷新或关闭重开后才能加载 `codex-mobile-shell-v568`。

## 2026-06-28 Embedded Thread Flicker / Missing Current Replies Hotfix

这次热修复处理 Home AI embedded 模式下的客户端回归：用户重新进入线程后可能只看到
旧回执，看不到当前用户消息和新回执，同时页面反复闪烁。生产日志显示，客户端反复
触发 `thread_detail_render_evidence_cleared`，原因是 `primary-force:plugin-back`，
随后把 conversation 渲染成 `threadId:""` 的主页面状态。这不是单纯的渲染抖动，
而是 embedded 返回手势误触发后清空了当前线程选择。

根因有两层：

- 前端 embedded back-swipe guard 过于敏感：可以从 conversation 区域起手，
  edge `touchstart` 就阻止原生处理，并且允许 velocity-only 横向完成。普通阅读或
  滚动时靠近屏幕边缘，就可能被误判为插件返回。
- 服务端 detail response 有时同时暴露一个旧的 active-looking turn 和一个当前
  active turn，其中当前 turn 状态不完整。客户端合并这种响应时更容易把旧状态当成
  活跃状态继续保留。

修复后，`public/app.js` 不再允许 conversation 区域启动 embedded 返回手势，要求
明确的水平/垂直移动比例，移除 velocity-only 完成条件，并在用户刚发生 conversation
滚动意图后抑制 plugin-back。服务端
`services/thread-detail/thread-detail-response-budget-service.js` 在响应出口统一修正 visible
active-turn 契约：`activeTurnId` 必须指向返回窗口中的 turn，当前 active turn 必须
有 active 状态，旧的 active-looking turn 必须降级为 completed 语义。

这次是前端静态和服务端响应契约共同变化，`CLIENT_BUILD_ID` 和 PWA service worker
cache 从 `codex-mobile-shell-v559` 升级到 `codex-mobile-shell-v560`。生产读回已确认
`v560` 后同一日志窗口内没有继续出现新版客户端的 `primary-force:plugin-back` 清屏。
已经打开的 iPhone / iPad / Home AI embedded WebView 需要接受刷新提示、硬刷新或关闭
重开后才能停止旧 shell 继续运行。

## 2026-06-28 Workspace Thread List Warm First Paint

这次模块处理一个剩余的线程列表首屏峰值：默认 `/api/threads` 已经可以在 warm
fallback cache 存在时几十毫秒返回，但切到某个 Workspace 时仍会先等
app-server `thread/list` 的 workspace-filtered 500-row 窗口，Movie workspace
采样中一次请求约 465ms，其中 app-server RPC 约 240ms，route merge 约 177ms。

本模块把普通 Workspace 列表也接入 warm first-paint 策略。无 cursor、无 search、
非 archived 的 Workspace 请求会先尝试已有 warm cache；如果没有 Workspace 专属
cache，服务端可以从默认可见线程 warm cache 派生出该 Workspace 的子集并写回
Workspace cache。cache miss 时仍回到现有 app-server 权威路径，不构建新的冷
baseline，不改变 cursor/search/archived 语义。

生产诊断可以通过 `appServerDeferredReason=warm-fallback-workspace`、
`appServerDeferredInitialReason=workspace-warm-cache`、
`fallbackCacheDecision=workspace-derived-hit` 和
`fallbackWorkspaceDerivedCacheHit=true` 识别这条路径。

## 2026-06-28 Active First-Paint Item Budget

当前大 session 进入速度已经主要走 `projection-v4-partial` /
`projection-active-overlay`，`threadReadMs=0` 的场景越来越多。剩余风险不再是
full `thread/read`，而是 active turn 本身仍可能携带很多 operation/reasoning
可见 item，导致首屏响应体和 DOM patch 压力偏高。

本模块在 `services/thread-detail/thread-detail-response-budget-service.js` 增加 active
first-paint byte item budget：普通 progressive active budget 完成后，如果
实际 detail body 仍超过 active first-paint byte ceiling，服务端会继续从低价值
operation/reasoning visible item 中移除旧项，同时保护 user message、assistant
progress/receipt、Usage、image 和 diagnostic item。Phase-B readback 现在也暴露
`responseBudgetProgressiveActiveFirstPaint*` 字段，用于读回压缩前后 byte、
是否触发二阶段 item budget、移除 visible item 数量和保护原因。

这是服务端响应预算闭环，不是客户端刷新兜底；本模块不需要 bump PWA shell
cache，部署时重启 Codex Mobile plugin host 即可。

## 2026-06-28 Active Projection Partial 诊断误报修复

Home AI AI Ops 上报了 Codex Mobile embedded iPhone 端连续
`conversation_projection_mismatch / thread_detail_response_contract_mismatch`
事件，错误码为 `active-thread-window-downgrade`。本次修复确认根因在前端
诊断规划层：`public/thread-performance-metrics.js` 把 active 线程中的
`projection-v4-partial` 一律视为 window downgrade，即使服务端已经返回了
合法的 active/progressive projection partial、可见 item 和
`mobileDetailResponseBudget` 证据。

本次修复不增加客户端刷新兜底，也不吞掉真实降级。现在只有退回
`turns-list-large` / `bounded-large-thread-window` 等非 projection partial
路径时才继续报 `active-thread-window-downgrade`；合法的
`projection-v4-partial` 在同时具备 active/visible content 和 response-budget
证据时会作为正常渐进首屏处理。诊断 payload 也补充了 bounded
`response_budget_*` 计数，Home AI 后续收到类似事件时可以直接判断是否有预算
和 active-turn 证据，不需要读取私有线程正文。

这次是前端静态行为变化，`CLIENT_BUILD_ID` 和 PWA service worker cache 从
`codex-mobile-shell-v558` 升级到 `codex-mobile-shell-v559`。已经打开的
iPhone / iPad / Home AI embedded PWA 需要接受刷新提示、硬刷新或关闭重开后
才能停止旧客户端继续上报该误报。

## 2026-06-28 线程详情响应体预算和任务卡按需正文

这次模块处理“线程最终能加载出来，但进入 Home AI / Movie 等线程时明显卡很久”的
新形态。生产本地 API 采样显示，Home AI 和 Movie 的 detail 请求本身没有 HTTP
超时：服务端常见返回在数十到数百毫秒。但每次 detail 响应仍有约 340-380KB，
其中一部分来自最近窗口里的大量 operation/reasoning item，另一部分来自
`thread.threadTaskCards` 一次性附带 24 张历史任务卡的完整 `message.body`。
这些内容即使在 UI 中折叠，也会随 JSON 解析和隐藏 DOM 一起进入客户端主线程，
造成“长时间加载，最后又能正常出来”的体验。

本轮修复不做前端去重或刷新兜底，而是在服务端响应边界收敛数据形态：

- 新增 `adapters/thread-detail-response-budget-service.js`（现由
  `services/thread-detail/thread-detail-response-budget-service.js` 拥有，adapter
  保持兼容导出），在 detail response
  出口统一限制 completed turn 的 operation item、active turn 的 operation item
  和 reasoning item；删减后调用 v4 visible normalizer 重建
  `mobileVisibleItemKeys`，避免响应变小后产生投影签名错配。
- `threadTaskCardService.listForThread()` 现在返回任务卡摘要；完整
  `message.body` 保留在 `GET /api/thread-task-cards/:id`，不会随每次线程详情首屏
  下发。
- `public/app.js` 在用户展开任务卡详情时按需读取完整卡体，并优先原地替换占位，
  避免展开动作触发整屏重绘。

这次是前端静态和服务端行为共同变化，`CLIENT_BUILD_ID` 和 PWA service worker
cache 从 `codex-mobile-shell-v551` 升级到 `codex-mobile-shell-v552`。已经打开的
浏览器或 PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到按需任务卡正文逻辑。

## 2026-06-28 长回执向上箭头取消时间窗口

本次 public 发布在 active overlay 冷路径修复之外，补一个移动端阅读体验修正：
长回执完成后，右下角“回到本轮总结”的向上箭头不再有 10 分钟时间窗口。
以前锚点会在 `currentRecentCompletedReplyAnchor()` 中按完成时间过期，超过窗口后
即使用户仍在当前线程、最终回执开头仍在视口上方，也无法再通过向上箭头跳回长回执
开头。现在显示资格只由当前线程、最新 turn、锚点是否已经由完成或用户上滑激活、
以及目标回执位置是否在视口上方决定；线程切换、点击向下箭头回到底部、发送新消息
等既有清理路径保持不变。

本次是前端静态行为变化，`CLIENT_BUILD_ID` 和 PWA service worker cache 从
`codex-mobile-shell-v550` 升级到 `codex-mobile-shell-v551`。已经打开的浏览器或
PWA 需要接受刷新提示、硬刷新或关闭重开后才能拿到新控件逻辑。

## 2026-06-28 Active Overlay 冷路径 full-read 循环关闭

这次发布继续处理大 session 进入线程时的服务端详情慢路径。上一轮已经把
active overlay 详情里的 raw 工具/命令 payload 压缩掉，但生产采样仍显示：
部署或重启后，运行中的大线程详情可能先走一次 bounded overlay-window 读取，
随后连续多次退回 app-server full `thread/read`，单次约 `2.7-3.3s`。
诊断字段显示失败层在 active detail proof gate：
`activeOverlayReason=assistant-delta-unknown`，而不是线程列表 fallback、
前端 DOM patch 或普通 app-server 列表 RPC。

本轮修复没有放松 freshness 证明，也没有增加前端兜底。服务端现在把
active overlay window 作为独立 sidecar partial window 缓存，不再覆盖 live
dynamic overlay snapshot；active-thread 的 full `thread/read` fallback 也不再
反向 seed v4 projection cache，避免慢 fallback 污染后续快路径。窗口 sidecar
会保留来自 live overlay proof input 的 revision/timestamp 元数据；proof policy
也明确使用双证明域：完整 revision 证据优先，若只有一侧 revision 可见但双方
timestamp 完整，则使用 timestamp 判断 fresh/stale，只有两个证明域都不完整时才
返回 `assistant-delta-unknown` 并要求 full read。

生产读回显示当前 active Codex Mobile 大线程连续 12 次
`GET /api/threads/:id?mode=recent` 全部返回 `projection-active-overlay`，
`threadReadMs=0`，`activeOverlayReason=overlay-evidence-complete`，
`coldPathOwner=warm-path`。12 次采样平均耗时约 `181ms`，最小 `139ms`，
最大 `491ms`。这说明 repeated full-read loop 已关闭。当前极长 active turn
响应仍约数百 KB，因为其中确实包含大量可见 assistant/operation summary item；
后续如果继续优化，应进入“可见 item 渐进加载/进一步压缩”模块，而不是再改
full-read fallback。

验证边界：

- focused active-overlay tests：`52 passed`；
- full `npm test`：`1321 passed`；
- `npm run check`、`npm run check:macos`、`git diff --check` 均通过；
- 通过 Home AI central macOS plugin deploy 路径部署到生产；
- 本次是 server-only 修复，未改 `public/app.js` 或 service worker，因此
  app shell/cache 仍保持 `codex-mobile-shell-v550`。

## 2026-06-27 Active Overlay 详情响应体压缩

这次修复的是运行中大线程详情打开仍然不稳定的第二段服务端路径。部署前采样显示，
普通 warm projection 详情通常只有几十毫秒，但 `projection-active-overlay`
运行中详情可到数百毫秒，并返回数百 KB 响应体。根因不是 app-server RPC，
而是 active overlay proof gate 通过后，服务端把 live overlay turn 合并回
已经压缩过的 projection 结果时，没有再次对 overlay turn 执行 thread-detail
compaction。于是 raw `mcpToolCall.arguments` / `mcpToolCall.result` 和较长
command payload 可以进入 `/api/threads/:id` 响应。

修复方式是在 `thread-detail-read-orchestration-service` 和
`services/thread-detail/thread-detail-active-window-overlay-policy-service.js` 的交界处注入
`compactActiveOverlayTurn`：只有 proof gate 已经证明 live overlay 可用时，仍然先按
既有 `compactTurn()` 和 `MAX_LIVE_OPERATION_ITEMS` 规则压缩 overlay turn，再合并到
detail 响应。`mcpToolCall` 和 `dynamicToolCall` 现在也被归类为 operation evidence，
既进入 active-overlay 覆盖率计数，也不会以 raw arguments/result 形态越过服务端
响应边界。

本次是 server-only 性能和隐私边界修复，不改变 projection 权威源、active-overlay
proof gate、前端 DOM patch、PWA shell/cache 版本或 Home AI 诊断派卡流程。

## 2026-06-27 v550 投影一致性自动诊断闭环

v550 强化线程详情投影与浏览器 DOM 的一致性检测。单线程 full render 和
平铺 thread-tile render 完成后，客户端会统一检查当前 projection/render
signature、DOM render-key 数量、重复 render key、可见 turn 顺序以及最新 turn
是否匹配。

如果连续出现缺消息、重复消息、顺序错或 DOM 与 projection signature 不一致，
Codex Mobile 会通过 Home AI 的 `homeai.diagnostic.report` 通道上报 bounded
metadata。单次瞬时不一致只记录本地失败计数，不通知 Owner；后续健康渲染会清零
同一签名的计数。上报内容只包含 build/cache id、read/render mode、线程/turn 短
hash、数量和错误类型，不包含消息正文、任务卡正文、上传内容、路径、token、
cookie 或长日志。Home AI 仍然负责 Owner 通知和 Owner 触发修复卡，插件不会自动
派发修复任务。

本次是前端运行时行为变化，`CLIENT_BUILD_ID` 和 service worker cache 升级到
`codex-mobile-shell-v550`。

## 2026-06-27 线程列表本地 merge 耗时修复

这次修复的是进入线程时仍然偶发慢的服务端本地列表路径。部署前的精确采样显示，
底层 mux/app-server `thread/list` RPC 通常只有 `7-9ms`，但 `/api/threads?limit=25`
总耗时仍在 `397-473ms`，主要耗在 Mobile Node 里的 route merge / summary merge：
fallback cache 已经是 warm 命中，但 app-server rows 和 fallback rows 中同 id 的
重复行仍一起进入 summary merge，随后非重复行也会跑一次 display-summary merge
阶段，导致本地同步 CPU 工作放大。

修复方式不是前端去重，也不是新的 fallback cache。`/api/threads` route 现在只在
app-server 已经返回同一个 thread id 时，提前丢弃 fallback 里的重复行；fallback
里真正缺失于 app-server 的线程仍然正常参与合并。summary merge 也只在遇到真实
重复 id 时才执行 duplicate display merge，唯一 id 直接进入后续过滤/排序。已经在
`filterVisibleThreads()` 阶段读取过的 rollout size/stat 会在后续 display merge 中
复用，避免同一请求内重复 `stat`。

本次是 server-only 性能修复，不改变线程列表权威源、排序、归档/隐藏规则、fallback
cache 生命周期、thread detail projection 或 PWA shell/cache 版本。

## 2026-06-27 App Server 线程列表峰值耗时修复

本次发布修复的是服务端线程列表的峰值耗时，而不是静态前端 shell。现象是
多个相同的默认线程列表请求同时进入时，虽然底层 mux `thread/list` RPC 通常
只有个位数毫秒，但 Mobile 服务端会为每个请求重复执行 app-server 读取、
线程摘要合并和装饰逻辑，Node 事件循环被同步工作阻塞后，后续请求的
`appServerRpcMs` 会被放大到数百甚至上千毫秒。

修复方式是在 `/api/threads` 默认完整列表路径加入 in-flight coalescing：同一时刻
相同的默认列表请求只让第一个 leader 执行真实读取和合并，其余 follower 等待并
复用 leader 的结果。分页、搜索、workspace/cwd 过滤、归档列表、deferred fallback
和 warm-initial 请求不参与合并，避免改变这些路径的语义。

公开验证边界：

- 新增 `thread-list-response-coalescer-service` 及可执行测试，覆盖默认列表 key、
  follower 复用、失败释放和隐私安全 diagnostics；
- 本地 5 并发默认列表请求从部署前的队列式峰值放大，变为 1 个 leader 和 4 个
  coalesced follower 复用同一结果；
- 生产读回中 5 并发默认列表请求全部返回约 `265ms`，底层 `appServerRpcMs`
  保持约 `10ms`；
- 这次没有改 `public/app.js` 或 service worker，因此 shell/cache 仍保持
  `codex-mobile-shell-v549`。

## 2026-06-27 v549 吸收 PR #79 的 terminal running hint 修复

v549 吸收 public PR #79 中有价值的一部分：已完成线程如果通过普通
线程列表或详情返回了 terminal 状态（例如 `completed`），浏览器本地
`runningThreadIds` / `runningThreadHintedAtById` 不能再因为本地 hint 时间
较新而继续显示 running spinner。

保留的边界是 replay 保护：如果是 mux replay 的旧完成通知，仍然不能轻易
清掉可能真实运行中的线程。换句话说，普通列表/详情里的 terminal 状态优先
清理 spinner；replay 场景继续使用 freshness 判断。

PR #79 的 server 端 raw operation fallback 约束在当前主线里已经有等价实现：
只允许 live turn 从 raw rollout 新增缺失 operation，terminal turn 只补充已有
operation 字段，不重新插入 completed operation。因此 v549 没有直接 merge
PR #79 的旧 v435 patch，而是在当前 v548 架构上吸收 terminal hint 规则和回归
测试，并将 PWA shell cache 升级到 `codex-mobile-shell-v549`。

## 2026-06-27 v543 Phase A/E Stability Evidence Module

v543 将 v542 之后累积的本地切片收束为一个可部署模块。模块边界不是新增
产品功能，而是继续降低投影/渲染不同步、长回执遮挡、图片/PWA/DOM 证据不足
这些高复发风险。

包含的本地切片：

- `eff591a`：PWA shell refresh live-debug smoke，验证 embedded shell build、
  boot recovery、hard/page refresh 控件和 service-worker/cache 能力。
- `e232c4c`：media render live-debug smoke，验证 uploaded/generated image
  DOM surface 是否 visible/loaded/proxy-safe、是否泄露 raw local path。
- `5479887`：projection replay live-debug smoke，比较 `/api/threads/:id?mode=recent`
  可见 turn/item shape 与实际 DOM 的 missing/extra/duplicate/order mismatch。
- `252c2e1`：long-turn viewport fixture，验证手机单线程长回执起点定位、
  Usage 沉底可见、上下跳转按钮同槽位互斥、Composer 不遮挡。
- `b45afb3`：Phase A DOM authority invalidation helper，将
  `stable-signature-dom-empty` mismatch/client-event payload 组装从
  `updateConversationHtml()` 移入 `thread-detail-dom-patch` 纯 helper。

本次 bump：`CLIENT_BUILD_ID` 和 PWA shell cache 从
`codex-mobile-shell-v542` 升到 `codex-mobile-shell-v543`。

本地模块验证：

```bash
node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/long-turn-viewport-fixture.test.js test/projection-replay-visual-smoke.test.js test/media-render-visual-smoke.test.js test/pwa-shell-refresh-smoke.test.js test/image-order-visual-smoke.test.js test/app-update.test.js test/build-refresh-policy.test.js  # 210 passed
npm test  # 1248 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Task-card Draft State Render Context Slice

这是 task-card draft creation source context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。它继续收敛 cross-thread task-card draft 的状态更新路径：draft 的
`Dismiss` 按钮和 materialization 状态变更会携带 source thread id，并只刷新当前线程
或所属平铺 pane，不再默认刷新全局 `state.currentThreadId`。

改动边界：

- `renderThreadTaskCardDraftActions()` 在 draft action button 上写入
  `data-task-card-draft-thread-id`；
- `public/thread-detail-actions.js` 把 draft action 的 `threadId` 解析出来；
- `dismissThreadTaskCardDraft()` / `setThreadTaskCardDraftState()` 支持显式 thread
  context，并通过 `scheduleThreadTaskCardDraftStateRender()` 调度 current render 或
  pane-local render；
- `createThreadTaskCardDraft()` 的可见状态更新继续使用 source thread id，避免异步
  draft 创建阶段把错误/成功状态画到错误窗口；
- 新增可执行测试，验证 pane draft dismiss 只触发所属 pane render，current thread
  draft 才触发 `renderCurrentThread()`；
- 不改变 server task-card create API、return/ack 协议、任务卡 body 结构、
  shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --check public/thread-detail-actions.js
node --test test/thread-task-card-route.test.js test/thread-detail-actions.test.js test/conversation-render.test.js  # 138 passed
npm test  # 1269 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

生产部署/readback：

- 部署方式：Home AI central macOS plugin deploy。
- Deploy reason：`codex-mobile-v543-phase-a-e-stability-evidence`。
- Source commit：`d79a8727561f`，source dirty false。
- Backup：
  `/Users/hermes-host/HermesMobile/backups/deploy/20260627T073019Z-plugin-codex-mobile-web-codex-mobile-v543-phase-a-e-stability-evidence`。
- Selected mux refresh：skipped，`reason=no_mux_runtime_change`，因为本模块未改 mux
  runtime trigger files。
- `/api/public-config` readback：
  `clientBuildId=0.1.11|codex-mobile-shell-v543`，
  `shellCacheName=codex-mobile-shell-v543`，
  `activeProfileId=previous`。
- Thread-list fallback prewarm readback：
  `lastStatus=completed`，`lastElapsedMs=1734`，`lastResultCount=11`，
  `lastCacheDecision=miss-rebuild`。
- 关键 source/prod SHA-256 短 hash 一致：
  `public/app.js=401a20fc7254020b`，
  `public/sw.js=4d63c5a54cbe4926`，
  `public/thread-detail-dom-patch.js=21594bef8947327c`，
  `scripts/codex-mobile-long-turn-viewport-fixture.js=1bfaf69082e8a634`，
  `scripts/codex-mobile-media-render-visual-smoke.js=115f68142e3e9302`，
  `scripts/codex-mobile-projection-replay-visual-smoke.js=7be1a71169e6c1cd`，
  `scripts/codex-mobile-pwa-shell-refresh-smoke.js=1a5cb7487cab6283`。

Public push 仍然等生产和用户验证。

## 2026-06-27 Phase A Local Patch Completion Snapshot Slice

这是 v543 生产部署后的第一个新本地切片，不单独部署、不推 Public。它继续收敛
线程详情 local patch 完成阶段的状态所有权。

改动边界：

- `patchCurrentThreadDetailFromRefresh()` 不再手写 local completion snapshot object；
- refresh local patch 路径改为调用
  `threadDetailDomPatchApi.planLocalConversationDomUpdateCompletionSnapshot()`，
  由 DOM-patch helper 统一归一化 root、single-thread patch eligibility、
  conversation signature、patch-shell signature 和 scroll action；
- `completeLocalConversationDomUpdate()` 可以接受预先规划好的
  `completionSnapshot`，其他调用路径仍然保留实时 DOM/scroll fact 收集；
- 不改变 server projection、merge、DOM mutation 顺序、scroll-follow policy、
  shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-detail-dom-patch.test.js  # 161 passed
```

## 2026-06-27 Phase A Local Patch Transaction Effects Slice

这是上一个 completion snapshot 切片之后的第二个本地小切片，继续按“本地小提交、
模块验证后再部署”的节奏推进，不单独部署、不推 Public。

改动边界：

- `threadDetailDomPatchApi.planThreadDetailRefreshLocalPatchTransactionEffects()`
  现在负责规划 refresh local patch 事务的 commit effects 和 after-success effects；
- `patchCurrentThreadDetailFromRefresh()` 不再内联
  `complete-local-conversation-dom-update`、operation dock refresh、action bind
  的事务副作用数组；
- `public/app.js` 只把 helper 计划映射成真实 DOM/state 回调，仍然保留实际
  DOM 操作、dock 更新和事件绑定副作用；
- 事务顺序保持不变：turn DOM patch 成功后先完成 local conversation DOM commit，
  commit 成功后才刷新 operation dock 和重新绑定 actions；
- 不改变 server projection、merge、scroll-follow policy、shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/thread-detail-dom-patch.js && node --check public/app.js
node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/mobile-viewport.test.js  # 173 passed
```

## 2026-06-27 Phase B First-Paint Reporting Stage Slice

这是 v543 后的第三个本地小切片，开始把首屏性能/telemetry 证据从
`loadThread()` 继续收敛到可测试 helper。它不改变线程读取、merge、render、
scroll 或 task-card 逻辑，不单独部署、不推 Public。

改动边界：

- `threadDetailRenderPlanApi.planThreadDetailFirstPaintReportingStage()`
  现在统一规划 cached-current 和 API first-paint 的 performance input 与
  telemetry input；
- `loadThread()` 仍然采集真实耗时、线程状态和调用
  `threadPerformanceMetrics.threadDetailFirstPaintEventFields()`，但不再手写
  first-paint telemetry 的字段形状；
- cached-current 与 API first-paint 共用同一个 reporting stage，减少
  `elapsed/api/render/readMode/status/turns/rolloutSize/threadHash` 等字段漂移；
- 不改变大 session read mode、projection cache、thread list fallback cache、
  shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js  # 198 passed
```

扩展 focused 验证覆盖 `test/turn-scroll-controls.test.js` 与
`test/mobile-viewport.test.js` 后为 `215 passed`。完整本地验证：
`npm test` 为 `1250 passed`，`npm run check` 与 `git diff --check` 均通过。

## 2026-06-27 Phase B Full-Backfill Reporting Stage Slice

这是 v543 后的第四个本地小切片，继续把大 session 详情回填证据从
`backfillFullThreadDetail()` 收敛到可测试 helper。它不改变 full-read、
merge、render、scroll、diagnostic dispatch 或 task-card 逻辑，不单独部署、
不推 Public。

改动边界：

- `threadDetailRenderPlanApi.planThreadDetailFullBackfillReportingStage()`
  现在统一规划 full-backfill full-ready performance input 与 telemetry input；
- `backfillFullThreadDetail()` 仍然采集真实 API/render/merge/post-render 耗时，
  并继续通过 `threadPerformanceMetrics.threadDetailFullReadyEventFields()` 生成
  性能事件；
- full-backfill 的 reporting stage 与 first-paint reporting stage 采用同一类
  helper-owned 字段所有权，减少 `elapsed/api/render/merge/postRender/threadId`
  等证据字段漂移；
- 不改变大 session read mode、projection cache、thread list fallback cache、
  shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js  # 210 passed
npm test  # 1251 passed
npm run check  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Composer Action Control Planning Slice

这是 v543 后继续加速节奏下的第一个 Phase C 本地小切片，不单独部署、不推
Public。它把平铺模式共享 Composer 的按钮状态规划从 `public/app.js` 继续收敛到
`public/thread-tile-state.js`，让 selected pane / active turn / voice input /
Goal / task-card command 的按钮 affordance 进入可测试策略层。

改动边界：

- `threadTileStatePolicy.composerActionControlPlan()` 现在统一规划共享 Composer
  action button 的 label、title、disabled、aria label 和状态 class；
- `updateComposerControls()` 仍然读取真实 DOM/thread/input facts，并只应用 helper
  返回的计划；
- Stop、引导、发送中、重试、Goal、Open、Task card、Send 和 Home AI embedded
  voice long-press 语义保持不变；
- 不改变消息发送 API、task-card API、Composer DOM 结构、平铺 layout、shell/cache
  版本或生产部署状态。

验证：

```bash
node --check public/thread-tile-state.js && node --check public/app.js
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/thread-goal-service.test.js test/new-thread-ui.test.js test/plugin-voice-input.test.js  # 61 passed
npm test  # 1252 passed
npm run check  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Task-Card Pane Action Context Slice

这是 Phase C 的下一个本地小切片，不单独部署、不推 Public。它修正 task-card
前端操作仍依赖全局 `state.currentThreadId` 的架构边界，为平铺 pane 内独立任务卡
操作做准备。

改动边界：

- `renderThreadTaskCardActions()` 现在把 owning thread id 写入
  `data-task-card-thread-id`；
- `thread-detail-actions` 解析 task-card action 时返回 `threadId`；
- `mutateThreadTaskCard()` 和 `replyTaskCard()` 接收 action context thread id，
  API 请求体使用该 thread id，而不是无条件使用全局 current thread；
- 本地 task-card settle/refresh 按 thread id 更新当前详情或可见 tile pane cache；
- 不改变 task-card server protocol、return/ack 语义、任务卡正文渲染、shell/cache
  版本或生产部署状态。

验证：

```bash
node --check public/thread-detail-actions.js && node --check public/app.js
node --test test/thread-detail-actions.test.js test/thread-task-card-route.test.js test/thread-tile-layout-ui.test.js  # 17 passed
npm test  # 1252 passed
npm run check  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Approval Pane Action Context Slice

这是 Task-Card pane action context 之后的同类 Phase C 本地小切片，不单独部署、
不推 Public。它把 app-server approval / server request 前端操作从全局
`state.currentThreadId` 继续收敛到 owning thread context，避免平铺 pane 内审批
卡片刷新错误线程。

改动边界：

- approval / user-input 请求渲染时写入 `data-approval-thread-id` 或
  `data-server-request-thread-id`；
- `thread-detail-actions` 解析 approval answer、server response、server request
  decline 时返回 owning `threadId`；
- `answerServerRequest()`、`answerApproval()`、`declineServerRequest()` 接收 action
  context thread id，并在等待、成功、失败状态更新后刷新该 thread；
- SSE/replay 进入的 pending/resolved approval 更新也改为按 request thread id 刷新：
  当前详情走原 current-thread render，可见 tile pane 走 pane patch；
- conversation/root/patch/render signatures 和 turn 内 approval 渲染现在使用
  `renderContextThreadId()`，tile pane 签名不再被全局 current thread 的 approval
  状态污染；
- 不改变 app-server approval 协议、审批 payload、权限决策、shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/thread-detail-actions.js
node --check public/app.js
node --test test/thread-detail-actions.test.js test/conversation-render.test.js test/thread-tile-layout-ui.test.js  # 121 passed
npm test  # 1253 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Local File Preview Pane Context Slice

这是 approval pane action context 后的同类 Phase C 本地小切片，不单独部署、不推
Public。它修正平铺 pane 内本地文件预览和本地 imageView content URL 仍可能使用
全局 `state.currentThreadId` 的问题。

改动边界：

- `localFilePreviewContentUrl(filePath, options)` 使用 `options.threadId` 或
  `renderContextThreadId()` 生成 `/api/files/preview/content` URL；
- `imageContentUrlForPath()`、`filePreviewContentUrl()`、`renderFilePreviewContent()`
  继续传递该 thread context，用于 imageView/imageGeneration 以及文件预览弹窗内
  image/pdf 内容；
- `openLocalFilePreview(link, options)` 通过 action context、链接显式 dataset、
  最近的 `[data-thread-tile-pane]` 或当前 file-preview context 解析 owning thread，
  预览 API 请求不再直接使用全局 current thread；
- 文件预览弹窗保存 `filePreviewThreadId`，供弹窗内二级本地文件链接沿用同一 thread
  context，关闭弹窗时清空；
- `thread-detail-actions` 对 local-file-preview action 返回 `threadId`；
- 不改变文件预览 server API、auth/proxy 包装、upload image route、markdown 本地文件
  链接格式、shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/thread-detail-actions.js
node --check public/app.js
node --test test/thread-detail-actions.test.js test/conversation-render.test.js test/file-preview-ui.test.js test/thread-tile-layout-ui.test.js  # 126 passed
npm test  # 1256 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Stable Render-Key Pane Context Slice

这是 local file preview pane context 之后的同类 Phase C 本地小切片，不单独部署、
不推 Public。它修正平铺 pane 渲染时稳定 DOM key 仍可能使用全局
`state.currentThreadId` 的问题。

改动边界：

- `stableItemKey()`、`stableOperationRenderKey()`、`stableTurnKey()` 现在统一使用
  `renderContextThreadId()`；
- 平铺 pane 渲染中已设置的 `state.renderContextThreadId` 现在会真正进入 item、
  operation、turn 的 `data-render-key`；
- 这样可避免不同 pane/thread 在增量 DOM patch 时复用同一组全局 current-thread
  key，从根上降低错位、复用旧回执、缺少中间内容等渲染上下文污染风险；
- 不改变 server projection、merge、visible item 策略、DOM patch 算法、
  shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/file-preview-ui.test.js  # 121 passed
npm test  # 1257 passed
npm run check  # passed
npm run check:macos  # passed
```

## 2026-06-27 Phase C Render Context Thread Object Slice

这是 stable render-key pane context 后的相邻 Phase C 本地切片，不单独部署、不推
Public。它把平铺 pane 渲染上下文从“只有 thread id”扩展为“thread id + thread
对象”，避免 latest/live/raw-mode/visible-items 判断继续从全局 current thread 取
状态。

改动边界：

- `state.renderContextThread` 保存当前渲染调用栈的 thread 对象；
- 新增 `renderContextThread()` 和 `withRenderContextThread(thread, callback)`；
- `latestTurn()`、`latestRawTurn()`、`isLatestTurn()`、`isLiveTurn()`、
  `currentThreadHasActiveRuntimeStatus()`、context compaction pending 判断、raw
  thread visible limit 和 `visibleItemsForTurn()` 都可以读取 render context thread；
- `conversationRootSignature()`、`conversationPatchShellSignature()`、
  `conversationRenderSignature()` 和 `renderThreadTileTurn()` 在显式 thread 上下文内
  执行，tile pane 签名/渲染不再借用全局 current thread 的 latest/live 状态；
- global `activeTurnId` 只在 render context thread 是当前线程时参与 active runtime
  判断，避免当前单线程的 active 状态泄漏到其它 pane；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/thread-detail-refresh-dom-harness.test.js test/thread-detail-dom-patch.test.js  # 173 passed
npm test  # 1258 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Visible Item Signature Thread Context Slice

这是 render context thread object 后的相邻 Phase C 本地切片，不单独部署、不推
Public。它把 visible item 签名里的 context-compaction 判断也改成显式 thread
上下文，避免平铺 pane 签名仍从全局 current thread 推导 pending/complete 状态。

改动边界：

- `visibleItemSignature(item, turn, thread)` 接收可选 thread 参数；
- context compaction notice 签名时调用
  `contextCompactionNotice(item, turn, thread)`；
- `conversationRenderSignature(thread)`、`threadTileOperationSignature(threadId)`
  和 visible item patch entries 都传入当前 pane/render context thread；
- 新增可执行测试，证明同一个 context-compaction item 在没有显式 pane thread 时
  不会误用 current thread 状态，而传入 pane thread 后才生成 pending notice；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/collab-agent-render.test.js  # 125 passed
npm test  # 1259 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Thread-Tile Visible Shape Thread Context Slice

这是 visible item signature thread context 之后的相邻 Phase C 本地切片，不单独
部署、不推 Public。它修正 tile pane visible-shape/count 证据仍可能用全局
current thread 过滤 visible items 的问题。

改动边界：

- `visibleRenderableTurnIds(thread)` 调用 `visibleItemsForTurn(turn, thread)`；
- `threadTileVisibleShape(ids)` 统计每个 pane 的 visible item count 时传入对应
  pane thread；
- 新增可执行测试，证明 tile visible shape 统计 context-compaction pending item 时
  使用 pane thread，而不是全局 current thread；
- 这样 tile patch expected turn count、thread-tile render diagnostic 的
  currentVisibleItems 证据和真实 pane 渲染使用同一个线程上下文；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/collab-agent-render.test.js  # 126 passed
npm test  # 1260 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Visible Conversation Shape Thread Context Slice

这是 thread-tile visible shape thread context 之后的相邻 Phase C 本地切片，不单独
部署、不推 Public。它修正 `visibleConversationShape(thread)` 的 visible item count
仍可能用全局 current thread 过滤 visible items 的问题。

改动边界：

- `visibleConversationShape(thread)` 调用 `visibleItemsForTurn(turn, thread)`；
- 新增可执行测试，证明 context-compaction pending item 的 visibleItemCount 使用传入
  thread，而不是全局 current thread；
- 这样 render evidence、empty visible detail mismatch、patch rejected evidence、
  refresh render planning 里的 visible shape 和目标 thread 的真实渲染过滤一致；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/collab-agent-render.test.js  # 127 passed
npm test  # 1261 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Render/Patch Visible Items Thread Context Slice

这是 visible conversation shape thread context 之后的相邻 Phase C 本地切片，不单独
部署、不推 Public。它把真实 `renderTurn()` 和 local patch entry 生成路径也收束到
显式 render context thread，避免证据 helper 已经 pane-aware 但实际渲染/patch 仍
隐式读取全局 current thread。

改动边界：

- `renderTurn(turn)` 先读取 `renderContextThread()`，再调用
  `visibleItemsForTurn(turn, thread)`；
- `visibleItemPatchEntries(turn)` 同样读取一次 render context thread，并同时传给
  `visibleItemsForTurn()` 和 `visibleItemSignature()`；
- 新增可执行测试，证明 patch entries 在 context-compaction pending 场景下使用
  pane/render context thread 过滤和生成签名，而不是全局 current thread；
- 这样 visible shape evidence、tile pane rendering、local visible-item patch 三条
  路径开始共享同一线程上下文边界；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/thread-detail-dom-patch.test.js test/collab-agent-render.test.js  # 179 passed
npm test  # 1262 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Visible Item Source Index Thread Context Slice

这是 render/patch visible items thread context 之后的相邻 Phase C 本地切片，不单独
部署、不推 Public。它把 visible item source index、insert visible item 和 live text
patch 的索引计算也收束到显式 render context thread，避免实际 DOM 插入/patch 的
sourceIndex 与 pane-local visible item 过滤不一致。

改动边界：

- `sourceIndexForVisibleItem(turn, item, thread)` 接收可选 thread，并用
  `renderContextThread(thread)` 调用 `visibleItemsForTurn(turn, contextThread)`；
- `insertVisibleItemDom()` 读取当前 render context thread，并传给
  `visibleItemsForTurn()` 与 source index fallback；
- `patchVisibleItemDomNode()`、`patchVisibleItemElement()` 和
  `patchLiveTextItemDom()` 在需要 fallback source index 时传入当前 render context；
- 新增可执行测试，证明 source index helper 会把 render context thread 和显式 thread
  传给 visible item 过滤；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-tile-layout-ui.test.js test/thread-detail-dom-patch.test.js test/collab-agent-render.test.js  # 180 passed
npm test  # 1263 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Submitted Follow Visible Progress Thread Context Slice

这是 visible item source index thread context 之后的相邻 Phase C 本地切片，不单独
部署、不推 Public。它把提交消息后的 bottom-follow sustain 判断也改成使用传入 thread
的 visible item 过滤，避免滚动跟随在 pane/local render 场景下读取全局 current
thread 的可见进度。

改动边界：

- `sustainSubmittedMessageBottomFollowFromThread(thread)` 调用
  `visibleItemsForTurn(liveTurn, thread)`；
- 新增可执行测试，证明该函数在判断 visible progress 时把目标 thread 传给
  `visibleItemsForTurn()`，并只在目标 thread 有非用户 visible progress 时延长
  submitted-message follow lease；
- 不改变 scroll policy、DOM patch 算法、server projection、任务卡协议、shell/cache
  版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/turn-scroll-controls.test.js test/conversation-render.test.js test/mobile-viewport.test.js  # 138 passed
npm test  # 1264 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Visible Item HTML Thread Context Slice

这是 submitted follow visible progress thread context 之后的相邻 Phase C 本地切片，
不单独部署、不推 Public。它把单个 visible item 的 HTML 渲染链路也收束到显式
render context thread，避免 context-compaction、reasoning 隐藏、timestamp fallback
和 task-card injected item 在 pane 渲染时读取全局 current thread。

改动边界：

- `renderVisibleItemPatchHtml(turn, item, ..., thread)` 接收可选 thread，并用
  `withRenderContextThread()` 包住单项渲染；
- `renderContextCompaction()`、`renderItem()`、`renderInjectedThreadTaskCardItem()`、
  `renderItemTimestampHtml()`、`itemTimestampMs()` 和 `isLiveReasoning()` 传递显式
  thread/context；
- `renderTurn()`、`renderThreadTileTurn()`、visible-item local insert/patch、
  live text patch 都把当前 render context thread 传给单项 HTML 渲染；
- 新增可执行测试，证明 item timestamp fallback 使用显式 render context thread，
  不再固定读 `state.currentThread`；
- 不改变 server projection、merge、DOM patch 算法、任务卡协议、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/message-timestamp.test.js test/turn-scroll-controls.test.js test/thread-tile-layout-ui.test.js  # 137 passed
npm test  # 1265 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Approval Request Thread Context Slice

这是 visible-item HTML thread context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。它修正 pending approval / user-input request 在平铺 pane 中的线程归属：
如果 server request 自身没有 `params.threadId`，但它来自某个 thread detail 的
`pendingServerRequests`，前端会在状态入口补齐来源 threadId；approval card 的按钮、
表单和选项也会沿用 render pane 的 fallback threadId，而不是回退到全局
`state.currentThreadId`。

改动边界：

- `syncThreadPendingServerRequests(thread)` 在 upsert 前调用
  `serverRequestWithThreadContext(request, threadId)`，只给缺失 threadId 的 request
  补齐来源线程；
- `renderPendingApprovals(thread)` 将 pane/thread id 传给 `renderApprovalRequest()`；
- `renderApprovalActions()`、`renderUserInputActions()`、`renderUserInputOptions()` 都
  接收 fallback threadId；
- 新增可执行测试，覆盖当前线程为 `thread-current`、平铺 pane 为 `thread-tile`、
  request 缺失 `params.threadId` 时，按钮仍输出 `data-approval-thread-id="thread-tile"`；
- 不改变 approval API、MCP 授权协议、server projection、shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js  # 121 passed
npm test  # 1266 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Thread Name Pane Context Slice

这是 thread goal pane context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。它收敛线程标题在平铺 pane 中的本地状态归属：当本地重命名或 display
summary 更新调用 `updateThreadNameLocally()` 时，非当前但可见的 pane 也会同步
`state.threadTileDetails` 并触发 pane-local render，避免 pane header 继续显示旧标题。

改动边界：

- 新增 `applyThreadNameToThread(thread, title)`，集中处理本地标题写入；
- 新增 `scheduleThreadNameDetailRender(threadId)`，按 current thread 或 visible tile pane
  调度 detail render；
- `updateThreadNameLocally()` 同步更新 thread list entry、`state.currentThread` 和
  `state.threadTileDetails` 中对应 thread；
- 新增可执行测试，验证非当前 `thread-pane` 的标题更新会更新 list + pane detail cache，
  只调度 pane render，不触发 current render；
- 不改变 thread display summary server merge、rename API、thread list 排序、shell/cache
  版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/thread-title-source.test.js test/thread-tile-state.test.js  # 39 passed
npm test  # 1272 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Thread Goal Pane Context Slice

这是 server request answer context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。它收敛 thread goal 通知/状态更新在平铺 pane 里的归属：当
`thread/goal/updated` 或 `thread/goal/cleared` 指向一个可见但不是当前全局线程的
pane 时，客户端会更新该 pane 的 detail cache，并调度 pane-local render，不再只更新
线程列表或当前线程。

改动边界：

- 新增 `applyThreadGoalToThread(thread, normalizedGoal)`，集中处理 goal 写入/清除；
- 新增 `scheduleThreadGoalDetailRender(threadId)`，按 current thread 或 visible tile pane
  调度 detail render；
- `updateThreadGoalState()` 同步更新 thread list entry、`state.currentThread` 和
  `state.threadTileDetails` 中对应 thread；
- 新增可执行测试，验证非当前 `thread-pane` 的 goal update/clear 会更新 list + pane
  detail cache，只调度 pane render，不触发 current render；
- 不改变 thread goal API、server goal persistence、Composer `/g` 行为、shell/cache 版本或
  生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/thread-goal-service.test.js test/thread-tile-state.test.js test/thread-task-card-route.test.js  # 55 passed
npm test  # 1271 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Server Request Answer Context Slice

这是 approval request thread context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。上一片已经让 pending server request 卡片和按钮携带 pane thread
context；这一片继续收敛“答复提交后”的状态回写：如果 `/api/approvals/:id`
返回的 `request` 缺少 `params.threadId`，客户端会保留原 action 的 thread context，
避免后续 resolved/removal 刷新退回全局 `state.currentThreadId`。

改动边界：

- `answerServerRequest()` 成功收到 `result.request` 后，通过
  `serverRequestWithThreadContext(result.request, threadId)` 写回本地
  `pendingApprovals`；
- 新增可执行测试，模拟平铺 pane 中提交 user-input request，服务端返回不带 thread id
  的 resolved request，验证本地仍保存 `thread-tile`，且只调度 pane render；
- 不改变 approval API、MCP 授权/输入协议、server projection、shell/cache 版本或生产
  部署状态。

验证：

```bash
node --check public/app.js
node --test test/conversation-render.test.js test/thread-detail-actions.test.js  # 128 passed
npm test  # 1270 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Task-card Draft Render Context Slice

这是 approval request thread context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。它收敛 cross-thread task-card draft 的渲染匹配上下文：当某个 turn
里出现 task-card draft，前端判断“这个 draft 是否已经对应创建出 card”时，使用当前
render context thread 的 `threadTaskCards`，不再固定从全局 `state.currentThread`
读取。

改动边界：

- `renderTurnThreadTaskCardDraft(turn, previousKeys, thread)` 接收显式 thread，并把
  render context thread 传给 draft matching；
- `matchingThreadTaskCardsForDraft(draft, turn, thread)` 使用显式 thread 的
  `threadTaskCards` 和 thread id 做 source 匹配；
- 新增可执行测试，构造 current thread 与 pane thread 都有同内容 card 的场景，验证
  显式 pane thread 会匹配 pane 自己的 card；
- 不改变 task-card draft 创建 API、return/ack 协议、server materialization、
  shell/cache 版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/thread-task-card-route.test.js test/conversation-render.test.js test/thread-detail-actions.test.js  # 136 passed
npm test  # 1267 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase C Task-card Draft Creation Source Context Slice

这是 task-card draft render context 之后的相邻 Phase C 本地切片，不单独部署、
不推 Public。它继续收敛 cross-thread task-card draft 的异步创建队列：pane 渲染时
触发 draft materialization 后，timeout 执行的 `createThreadTaskCardDraft()` 会保留
当时的 source thread id，并用该线程查找 draft、组装 source payload、更新本地 card
状态和诊断 hash，不再默认使用全局 `state.currentThreadId` / `state.currentThread`。

改动边界：

- `queueThreadTaskCardDraftCreation(draftKey, thread)` 捕获 `renderContextThreadId(thread)`，
  并传给 `createThreadTaskCardDraft(key, { threadId })`；
- `findThreadTaskCardDraftByKey(draftKey, thread)` 支持显式 source thread，并返回
  `sourceThread`；
- `createThreadTaskCardDraft(draftKey, options)` 使用 explicit source thread 生成
  `sourceThreadId`、`sourceWorkspaceId`、`sourceThreadTitle` 和 idempotency key；
- 创建成功后把卡片 upsert 到 source thread，并按 source/target 更新 pending counts；
- 新增可执行测试，验证 pane source 创建请求的 API body、idempotency key、本地 upsert
  和计数更新全部使用 pane thread；
- 不改变 server task-card create API、return/ack 协议、任务卡 body 结构、shell/cache
  版本或生产部署状态。

验证：

```bash
node --check public/app.js
node --test test/thread-task-card-route.test.js test/conversation-render.test.js test/thread-detail-actions.test.js  # 137 passed
npm test  # 1268 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

## 2026-06-27 Phase A Conversation DOM Authority Invalidation Local Slice

这是 v542 后继续按“小切片本地提交、模块化再部署”节奏推进的 Phase A 切片。
目标是收敛 `updateConversationHtml()` 里最后一段和 DOM 权威失效相关的内联
诊断组装逻辑。

改动边界：

- `public/thread-detail-dom-patch.js` 新增
  `planConversationDomAuthorityInvalidation()`；
- 该 helper 负责判断 `stable-signature-dom-empty` 是否需要记录
  empty visible detail mismatch，以及组装 bounded `conversation_dom_authority_invalidated`
  client event payload；
- `public/app.js` 只保留真实 side effect：调用
  `recordEmptyVisibleDetailMismatch()` 和 `postClientEvent()`；
- 不改变 DOM patch、hydrate、scroll、performance timing 或 server projection 语义。

验证：

```bash
node --check public/thread-detail-dom-patch.js && node --check public/app.js
node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js
```

本切片没有 runtime/static 行为变化，不 bump shell/cache，不部署；它作为 Phase A
ownership cleanup 的本地提交继续累积。

## 2026-06-27 v542 Phase E Visual Harness Module

v542 把 v541 之后的两个 Phase E 本地切片收束为一个可部署模块，而不是逐个小优化部署。
模块边界是 browser/visual harness 稳定化：

- `516c7e7`：task-card split-screen 视觉 fixture，补 collapsed/expanded/keyboard-open
  证据，并用 pane-local CSS 限制 expanded task-card body 高度，防止覆盖共享 Composer。
- `c5cf72b`：image-order live-debug smoke 隐私边界，报告只输出 metadata/hash-only，
  不输出 raw thread/turn/item id、debug URL、截图路径、DOM text 或错误正文。

本次 bump：`CLIENT_BUILD_ID` 和 PWA shell cache 从
`codex-mobile-shell-v541` 升到 `codex-mobile-shell-v542`。

本地模块验证：

```bash
node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-tile-layout-ui.test.js test/image-order-visual-smoke.test.js  # 34 passed
npm test  # 1226 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

生产部署/readback：

- 部署方式：Home AI central macOS plugin deploy。
- Deploy reason：`codex-mobile-v542-phase-e-visual-harness`。
- Source commit：`a1d98d8b7f07`，source dirty false。
- Backup：
  `/Users/hermes-host/HermesMobile/backups/deploy/20260627T064328Z-plugin-codex-mobile-web-codex-mobile-v542-phase-e-visual-harness`。
- Selected mux refresh：skipped，`reason=no_mux_runtime_change`，因为本模块未改 mux
  runtime trigger files。
- `/api/public-config` readback：
  `clientBuildId=0.1.11|codex-mobile-shell-v542`，
  `shellCacheName=codex-mobile-shell-v542`，
  `activeProfileId=previous`。
- 关键 source/prod SHA-256 短 hash 一致：
  `public/app.js=16d932cd58a07f34`，
  `public/sw.js=1387b0207faae75b`，
  `public/styles.css=5955acf78ca2471e`，
  `scripts/codex-mobile-thread-tile-visual-fixture.js=373fd85d15caefa5`，
  `scripts/codex-mobile-image-order-visual-smoke.js=d5e72750514d3b42`，
  `test/thread-tile-layout-ui.test.js=ccb95c11209e6e88`，
  `test/image-order-visual-smoke.test.js=156e6275120bd423`。
- 代表性视觉 fixture：
  `scripts/codex-mobile-thread-tile-visual-fixture.js --width 1800 --height 920 --panes 3 --keyboard --typed-lines 4 --task-card expanded --json`
  passed，`taskCardInsidePane=true`，`taskCardBodyScrollBounded=true`，
  `taskCardNoComposerOverlap=true`。

Public push 仍然等生产和用户验证。

## 2026-06-27 Phase E PWA Shell Refresh Smoke Local Slice

这是 v542 生产部署后的第一个新 Phase E 本地切片，目标是补 PWA shell refresh 的
live-debug smoke 入口，但默认不执行 reload，避免普通验证打断用户页面。

新增 `scripts/codex-mobile-pwa-shell-refresh-smoke.js`：

- 通过 Home AI live-debug lane 打开 embedded Codex Mobile；
- 从 Codex Mobile `/api/public-config` 读取期望 `clientBuildId` / `shellCacheName`；
- 在 iframe 内通过 `__codexMobileVisualHarness.clientBuildId()` 对齐当前 shell build；
- 验证 boot recovery 隐藏、app shell 可见、hard refresh 和 page refresh 控件存在；
- 验证 `refreshPageForNewBuild`、`clearAllShellCaches`、`resetPageShellServiceWorker`
  可调用；
- 记录 service worker / cache API 能力是否可见。

隐私边界：报告只输出 endpoint kind、期望 build/cache id、bounded boolean、截图 path hash
和 error code；不输出 raw URL、路径、DOM text、cookie、token、launch material 或日志。

验证：

```bash
node --check scripts/codex-mobile-pwa-shell-refresh-smoke.js
node --test test/pwa-shell-refresh-smoke.test.js  # 4 passed
npm run check  # passed
git diff --check  # passed
```

本切片没有 runtime/static app 变更，不 bump shell/cache，不部署；后续会和其它 Phase E
live-debug smoke 切片一起收束为模块。

## 2026-06-27 Phase E Projection Replay Visual Smoke Local Slice

这是 v542 之后的另一个 Phase E 本地切片，目标是给“线程详情少消息、重复消息、
错序、空 DOM、render signature mismatch”这类问题补一个可回放的浏览器证据入口。
它不改变投影、merge、patch 或刷新策略，只新增 smoke：

新增 `scripts/codex-mobile-projection-replay-visual-smoke.js`：

- 通过 Home AI live-debug lane 打开 Codex Mobile；
- 在 iframe 内按当前运行形态构造 proxy-safe detail API：
  - direct app：`/api/threads/:threadId?mode=recent`；
  - Home AI embed：`/api/hermes-plugins/codex-mobile/proxy/api/threads/:threadId?mode=recent`；
- 只从 API 返回里读取 turn/item id、计数、read mode，不读取正文；
- 和真实 DOM 的 `.turn[data-turn]`、`.item[data-item]`、`data-render-key`
  结构比较；
- 输出 missing/extra turn、missing/extra item、duplicate render key、duplicate item id、
  latest mismatch、order mismatch 等计数；
- 支持 `--allow-dom-only` 用于 API 详情不可读时只做 DOM 侧异常确认。

隐私边界：报告只输出 endpoint kind、期望 build/cache id、thread/turn/item hash、
read mode、计数、mismatch counts、截图 path hash 和 error code；不输出 raw thread id、
item id、message text、task-card body、debug URL、cookie、token、私有 route 或日志。

验证：

```bash
node --check scripts/codex-mobile-projection-replay-visual-smoke.js
node --test test/projection-replay-visual-smoke.test.js
```

本切片没有 runtime/static app 变更，不 bump shell/cache，不部署；后续会和其它 Phase E
live-debug smoke 切片一起收束为模块。

## 2026-06-27 Phase E Long-Turn Viewport Fixture Local Slice

这是 v542 之后的一个本地可验证切片，目标是把“长回执遮挡后续内容、上下跳转按钮
位置反复回归、Usage 行沉底不可见、Composer 遮挡”这类手机视口问题固化成
headless Chrome 视觉不变量。它不读取真实线程，不修改运行时滚动策略，只用合成
长回执 DOM 和真实 `public/styles.css` 验证布局。

新增 `scripts/codex-mobile-long-turn-viewport-fixture.js`：

- 构造单线程手机视口，包含 `.item.agentMessage` 长最终回执和
  `.item.turnUsageSummary`；
- 验证 `#scrollToBottom` 与 `#scrollToTurnReply` 共用同一视觉槽位且互斥显示；
- 验证长回执起点可被定位到 conversation 可视顶部附近；
- 验证 Usage 在沉底状态可见，且不被 Composer 遮挡；
- 验证 Composer 位于 conversation 下方，不占用错误的独立浮层空间。

隐私边界：输出只包含 viewport、rect、scroll 计数、布尔不变量、artifact path hash
和字节数；不输出真实线程、消息、任务卡、URL、路径、cookie、token、截图内容或日志。

验证：

```bash
node --check scripts/codex-mobile-long-turn-viewport-fixture.js
node --test test/long-turn-viewport-fixture.test.js
node scripts/codex-mobile-long-turn-viewport-fixture.js --width 390 --height 844 --json
```

本切片没有 runtime/static app 变更，不 bump shell/cache，不部署；后续会和其它 Phase E
script-only smoke 切片一起收束为模块。

## 2026-06-27 Phase E Media Render Visual Smoke Local Slice

这是 v542 生产部署后的第二个新 Phase E 本地切片，目标是补 uploaded/generated image
在 Home AI embedded/PWA DOM 中的可回放视觉证据。它不修改运行时图片渲染逻辑，
只新增 metadata-only 的 live-debug smoke，方便后续诊断闭环判断图片是否真的渲染、
是否走了 proxy-safe URL、是否出现 raw local path leak 或失败占位。

新增 `scripts/codex-mobile-media-render-visual-smoke.js`：

- 通过 Home AI live-debug lane 打开 Codex Mobile；
- 可指定 `--thread-id` / `--target-turn-id`，并支持 `--require-upload`、
  `--require-generated`；
- 检查 `.input-image`、`.image-view`、`.markdown-image`、`.file-preview-media`
  这些真实 DOM surface；
- 统计 visible/loaded/failed/retrying/missing-image、upload/generated、route kind、
  image natural size、proxy-unsafe 和 local-path-leak；
- 在 Home AI proxy embed 模式下默认要求 media URL 不退回裸 `/api/...`；
- 默认只做 inspect 和截图，不改线程、不触发 reload。

隐私边界：报告只输出 endpoint kind、期望 build/cache id、thread/turn/item/source hash、
route-kind 计数、尺寸、rect、失败计数、截图 path hash 和 error code；不输出 raw image URL、
本地路径、文件名、DOM text、upload 内容、cookie、token、provider payload 或日志。

验证：

```bash
node --check scripts/codex-mobile-media-render-visual-smoke.js
node --test test/media-render-visual-smoke.test.js
```

本切片没有 runtime/static app 变更，不 bump shell/cache，不部署；后续会和其它 Phase E
live-debug smoke 切片一起收束为模块。

## 2026-06-27 Phase E Image-Order Visual Smoke Privacy Slice

这是 v541 生产部署后的第二个 Phase E 本地切片，目标不是新增运行时行为，
而是让现有 live-debug 图片顺序视觉 smoke 可以安全进入常规闭环。此前
`scripts/codex-mobile-image-order-visual-smoke.js` 会在报告中输出 raw thread/turn/item
标识、debug URL、截图绝对路径，以及截断后的 DOM label/text。那些字段对判断
图片卡片 DOM 顺序不是必要证据，也不适合进入 Home AI 诊断/审计材料。

本切片把输出边界收敛为 metadata/hash-only：

- 顶层报告只输出 `debugEndpoint`、`threadHash`、`targetTurnHash`；
- 浏览器测量结果只输出 `turnHash`、`itemHash`、`loadedTurnHashes`、`routeKind`、
  class、rect、timestamp 和计数；
- 截图结果只输出 `pathHash` 和 byte count；
- 错误只输出 bounded `errorCode`；
- 不再读取或输出 DOM `innerText` / `textContent`，也不输出 `location.href`。

验证：

```bash
node --check scripts/codex-mobile-image-order-visual-smoke.js
node --test test/image-order-visual-smoke.test.js  # 4 passed
```

本切片没有 runtime/static app 变更，本身不单独部署；它已被 v542 Phase E visual
harness module 收束。

## 2026-06-27 Phase E Task-Card Visual Fixture Local Slice

这是 v541 生产部署后的第一个 Phase E 本地切片，目标是补浏览器级视觉验证，
并修正 fixture 暴露出的一个 pane-local task-card expanded 高度边界。它扩展现有
`scripts/codex-mobile-thread-tile-visual-fixture.js`，新增
`--task-card collapsed|expanded`，在 fake split-screen pane 中渲染一张
synthetic injected cross-thread task card，并用真实 `public/styles.css` 和
headless Chrome 检查：

- 折叠态 summary 保持可见；
- 展开态正文被限制在 bounded scroll region；
- task card 保持在 pane 内；
- 不与共享 Composer 重叠；
- 不破坏 pane non-overlap、Composer 底部定位、operation duration 可见性。

实证中，`--keyboard --typed-lines 4 --task-card expanded` 首次暴露 expanded
task-card 在短视口 pane 中仍沿用单线程 `420px` 上限，底部会越出 pane 并与
Composer 重叠。修正方式是在
`public/styles.css` 为 `.thread-tile-pane .thread-task-card-message-body`
设置 pane-local `max-height: min(34vh, 300px)`，让展开内容在缩小窗口内自带滚动。

隐私边界：fixture 只使用 synthetic text 和 bounded DOM rect 指标，不读取真实线程、
任务卡正文、上传内容、私有路径、cookies、tokens、provider payload 或长日志。

验证：

```bash
node --check scripts/codex-mobile-thread-tile-visual-fixture.js
node --test test/thread-tile-layout-ui.test.js  # 4 passed
node scripts/codex-mobile-thread-tile-visual-fixture.js --width 2200 --height 1200 --panes 4 --task-card collapsed --json
node scripts/codex-mobile-thread-tile-visual-fixture.js --width 2200 --height 1200 --panes 4 --task-card expanded --json
node scripts/codex-mobile-thread-tile-visual-fixture.js --width 1800 --height 920 --panes 3 --keyboard --typed-lines 4 --task-card expanded --json
```

本切片包含 `public/styles.css` 运行时样式变化，因此不单独部署；它已被 v542 Phase E
visual harness module 收束并统一 bump shell/cache。

## 2026-06-27 v541 Phase C Pane-State Module

v541 将 5 个 Phase C 平铺/分屏 pane-state 本地切片收束为一个可部署模块，
用于加快工程节奏：小切片先本地提交，形成一个 coherent module 后再统一验证、
部署和读回。本模块不重写 split-screen，也不增加 UI fallback；它继续把
`public/app.js` 中的 pane policy 拆到 `public/thread-tile-state.js`，让 app 层
只执行 DOM/API/localStorage/timer side effects。

本模块包含：

- `c00e05c`：viewport / Composer chrome baseline planning。
- `32a3854`：detail-load queue drain scheduling planning。
- `52093d0`：detail-load settle queue-drain follow-up planning。
- `20cd05e`：pane patch-miss full-render escalation intent。
- `9eb8fd4`：display-settings load、legacy migration、local recovery planning。

本次 bump：`CLIENT_BUILD_ID` 和 PWA shell cache 从
`codex-mobile-shell-v540` 升到 `codex-mobile-shell-v541`。

验证：

```bash
node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/tablet-layout.test.js  # 66 passed
npm test  # 1222 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

生产部署/readback：

- 部署方式：Home AI central macOS plugin deploy。
- Deploy reason：`codex-mobile-v541-phase-c-pane-state`。
- Source commit：`7ba66236f480`，source dirty false。
- Backup：
  `/Users/hermes-host/HermesMobile/backups/deploy/20260627T062145Z-plugin-codex-mobile-web-codex-mobile-v541-phase-c-pane-state`。
- Selected mux refresh：skipped，`reason=no_mux_runtime_change`，因为本模块未改 mux
  runtime trigger files。
- `/api/public-config` readback：
  `clientBuildId=0.1.11|codex-mobile-shell-v541`，
  `shellCacheName=codex-mobile-shell-v541`，
  `activeProfileId=previous`。
- 关键 source/prod SHA-256 短 hash 一致：
  `public/app.js=da3e291a5e17c3c2`，
  `public/sw.js=e536a1d1245727b4`，
  `public/thread-tile-state.js=b8d9820d702adda9`，
  `test/thread-tile-state.test.js=6519fda2d37d4cc3`，
  `test/thread-tile-layout-ui.test.js=e7a21e490fd7cda3`。
- `scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1500 --panes 5 --json`
  passed：5 panes 单行、无 pane overlap、Composer 在底部、operation duration 可见。

## 2026-06-27 v540 Phase A Thread-Detail Post-Merge Planning Module

v540 将 v539 生产部署后累积的 4 个 Phase A 本地切片收束为一个前端
thread-detail ownership 模块，而不是继续逐个小优化部署。本模块仍不改变
server projection、detail API、SSE merge、DOM patch 执行、scroll 策略、
task-card 协议或大 session 后端读路径；目标是让 refresh/backfill/first-paint
的 post-merge timing 和 render-decision policy 继续从 `public/app.js`
收敛到可测试的 `public/thread-detail-render-plan.js` 边界。

本模块包含：

- `972e5e4`：新增 `planThreadDetailRefreshRenderStage()`，让
  `refreshCurrentThread()` 消费统一的 render stage，而不是分别调用 input
  normalization 和 render decision。
- `fd69585`：让 refresh/backfill 的 post-merge timing execution 按
  `planThreadDetailRefreshPostMergeEffects()` group 顺序执行。
- `bd90f73`：新增 `planThreadDetailRefreshPostMergeTimingFields()`，把 timing
  field 初始化、缺失 metadata 拒绝和重复字段拒绝放到 render-plan。
- `4da3ebc`：新增 `planThreadDetailFirstPaintPostMergeTimingEffects()`，明确
  首屏路径中 draft restore 前后的 post-merge timing split。

本次 bump：`CLIENT_BUILD_ID` 和 PWA shell cache 从
`codex-mobile-shell-v539` 升到 `codex-mobile-shell-v540`。

验证：

```bash
node --test test/mobile-viewport.test.js test/thread-goal-service.test.js test/thread-task-card-route.test.js test/thread-detail-render-plan.test.js test/conversation-render.test.js test/composer-draft.test.js  # 227 passed
npm test  # 1221 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

生产部署/readback：

- 部署方式：Home AI central macOS plugin deploy。
- Deploy reason：`codex-mobile-v540-thread-detail-post-merge-planning`。
- Source commit：`798719ad13c9`，source dirty false。
- Backup：
  `/Users/hermes-host/HermesMobile/backups/deploy/20260627T055616Z-plugin-codex-mobile-web-codex-mobile-v540-thread-detail-post-merge-planning`。
- Selected mux refresh：skipped，`reason=no_mux_runtime_change`，因为本模块未改 mux
  runtime trigger files。
- `/api/public-config` readback：
  `clientBuildId=0.1.11|codex-mobile-shell-v540`，
  `shellCacheName=codex-mobile-shell-v540`，
  `activeProfileId=previous`。
- `scripts/codex-mobile-phase-b-readback-smoke.js --server http://127.0.0.1:8787 --json`
  passed，`decision.status=ready`，`decision.reason=warm-or-bounded-paths`。
- 关键 source/prod SHA-256 短 hash 一致：
  `public/app.js=7d1c0cea84229c19`，
  `public/sw.js=df4ce5619d91c77a`，
  `public/thread-detail-render-plan.js=795e7768489d31c8`，
  `test/mobile-viewport.test.js=335f782357d8d1fd`。

## 2026-06-27 Phase A First-Paint Post-Merge Timing Sequence Local Slice

这是 v539 生产部署后的第四个 Phase A 本地小切片，尚未 bump shell/cache，尚未部署。

根因边界：

- 症状/风险：refresh/backfill 已经通过 post-merge timing plan 执行，但
  `loadThread()` 首屏成功路径仍直接手写 `merge`、`composer-render`、
  `thread-list-render` 三段 timing group。这个路径有一个特殊要求：
  draft restore 必须位于 merge 之后、composer render 之前；如果该特殊顺序继续散落在
  `public/app.js`，后续 post-merge group 调整仍容易让首屏路径和 refresh/backfill
  分叉。
- 失败层：前端 thread-detail first-paint post-merge sequencing ownership，不是
  detail API、projection cache、DOM patch 或 draft 存储。
- 不变式：首屏路径的“draft restore 前后”post-merge timing 分组应由
  `public/thread-detail-render-plan.js` 声明；app 层只执行 before/after entries，
  并保持 draft restore 插入点。

改动：

- 新增 `planThreadDetailFirstPaintPostMergeTimingEffects()`，把 post-merge timing
  entries 拆成 `beforeDraftRestore` 和 `afterDraftRestore`。
- 新增 `applyThreadDetailRefreshTimedPostMergeEntries()`，让 refresh/backfill 和
  first-paint 都消费相同的 `{ timing, field }` entry 执行形状。
- `loadThread()` 首屏成功路径不再直接调用 `"composer-render"` /
  `"thread-list-render"` timing group，而是执行 render-plan 返回的 after-draft entries。

验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/composer-draft.test.js  # 201 passed
node --check public/thread-detail-render-plan.js && node --check public/app.js
npm run check
git diff --check
```

## 2026-06-27 Phase A Post-Merge Timing Fields Local Slice

这是 v539 生产部署后的第三个 Phase A 本地小切片，尚未 bump shell/cache，尚未部署。

根因边界：

- 症状/风险：上一切片已经让 post-merge 执行按 plan group 运行，但
  `public/app.js` 仍硬编码 `mergeMs`、`composerRenderMs`、`threadListRenderMs`
  的 timing 初始化和 `timingField` 校验。后续如果 plan 增删 timing group，
  app 编排层仍会持有策略细节。
- 失败层：前端 thread-detail post-merge timing metadata ownership，不是
  server projection、read API、DOM patch 或 scroll 策略。
- 不变式：post-merge timing 字段归一、重复字段拒绝和初始 timing shape
  应由 `public/thread-detail-render-plan.js` 统一声明；app 层只执行 effect
  并写入返回的字段。

改动：

- 新增 `planThreadDetailRefreshPostMergeTimingFields()`，从 post-merge plan
  生成有序 `{ timing, field }` entries 和初始化 timings，并拒绝缺失或重复
  timing metadata。
- `applyThreadDetailRefreshTimedPostMergeEffectsPlan()` 改为消费该 helper，
  不再在 `public/app.js` 内硬编码 timing 字段集合。
- 补充 focused tests，覆盖正常字段顺序、空 group、缺失 metadata、重复字段，
  并用 source-level regression 防止 app 层重新读取 `group.timingField` 或硬编码
  timing 对象。

验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/composer-draft.test.js  # 201 passed
node --check public/thread-detail-render-plan.js && node --check public/app.js
```

## 2026-06-27 Phase A Refresh Render Stage Local Slice

这是 v539 生产部署后的下一个本地小切片，尚未 bump shell/cache，尚未部署。

根因边界：

- 症状/风险：`refreshCurrentThread()` 仍直接串联 refresh render input
  normalization 和 render decision，后续单窗口、tile pane、DOM shape 证据继续扩展时，
  容易把 full-render / metadata-only / local patch 的判断再次散落回 `public/app.js`。
- 失败层：前端 thread-detail refresh render ownership，不是 server projection、
  app-server 读取、SSE merge、DOM patch 执行或 scroll 策略。
- 不变式：app 层只采集当前事实并执行 effect；是否根据这些事实进入 metadata-only、
  patch 或 full-render 应由 `public/thread-detail-render-plan.js` 的纯策略边界统一决定。

改动：

- 新增 `planThreadDetailRefreshRenderStage()`，组合 refresh render input normalization
  和 render decision，返回 normalized input、render plan、render mode 和 reason。
- `refreshCurrentThread()` 改为消费该 stage，不再直接分别调用
  `planThreadDetailRefreshRenderInput()` 和 `planThreadDetailRefreshRender()`。
- 补充 focused tests，证明 stage 同时拥有 input normalization 和 render decision，
  并用 source-level regression 防止 app 编排重新绕过 stage。

验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js  # 196 passed
node --check public/thread-detail-render-plan.js && node --check public/app.js
```

## 2026-06-27 Phase A Post-Merge Timing Plan Local Slice

这是同一 Phase A 模块的第二个本地小切片，尚未 bump shell/cache，尚未部署。

根因边界：

- 症状/风险：`refreshCurrentThread()` 和 full-backfill 仍硬编码执行
  `merge`、`composer-render`、`thread-list-render` 三段 post-merge effect。
  如果 post-merge 顺序或 timing field 后续调整，app 编排层会再次持有策略细节。
- 失败层：前端 thread-detail post-merge execution ownership，不是 server projection、
  read API、DOM patch、scroll 或 task-card 协议。
- 不变式：post-merge effect 的顺序和 timing field 应由
  `public/thread-detail-render-plan.js` 声明；app 层只执行 plan 并收集结果。

改动：

- `planThreadDetailRefreshPostMergeEffects()` 的每个 group 增加 `timingField`。
- 新增 `applyThreadDetailRefreshTimedPostMergeEffectsPlan()`，按 plan group 顺序执行并返回
  `mergeMs`、`composerRenderMs`、`threadListRenderMs`。
- `refreshCurrentThread()` 和 `backfillFullThreadDetail()` 改为消费该执行器。
- 保留 first-paint 的旧执行顺序，因为它需要在 merge 和 composer render 之间执行
  draft restore。

验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/composer-draft.test.js  # 200 passed
npm run check  # passed
git diff --check  # passed
```

## 2026-06-27 v539 Phase B Thread-List Request/Fallback Module

v539 将 v538 后累积的 Phase B thread-list 小切片收束为一个模块，而不是逐个
小优化部署。本模块仍不改变 `/api/threads` 的 row 语义、排序、归档/隐藏规则、
fallback cache 语义或 app-server 查询参数；目标是把大 session / thread-list
路径中的重复同步读取收敛到清晰的 request/source 边界，并让生产读回能解释慢点。

本模块包含：

- `4b96222`：route-level merge 归因，新增 `routeMerge*` bounded counters。
- `2dc5caa`：summary merge service 化，新增 `summaryMerge*` stage counters/timings。
- `5e463b2`：request context 共享 archived ids、session-index entries、cached
  display summary reads。
- `1373160`：request-scoped rollout stat reader，减少 visible filter / cached
  display merge / duplicate merge 内重复 stat。
- `e6fc874`：rollout fallback summary read 到 status attach 之间复用已验证
  `fs.Stats`，但 active/completed 状态仍由 rollout tail 实时判断。

本次 bump：`CLIENT_BUILD_ID` 和 PWA shell cache 从
`codex-mobile-shell-v538` 升到 `codex-mobile-shell-v539`。

预部署验证已通过：

```bash
node --test test/thread-list-request-context-service.test.js test/thread-list-summary-merge-service.test.js test/thread-list-route-merge-service.test.js test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js  # 107 passed
npm test  # 1219 passed
npm run check  # passed
npm run check:macos  # passed
git diff --check  # passed
```

全量测试暴露了几处旧 source-string/version 断言仍固定在 v538 或旧函数签名。
本次同步更新测试断言到 v539 和 request-context archived id 注入语义；没有因此改变
运行时业务逻辑。

生产部署与读回：

- 本地提交：`424b45d` `bump shell for phase b thread list module`。
- 中心部署 reason：`codex-mobile-v539-thread-list-module`。
- 生产备份：
  `/Users/hermes-host/HermesMobile/backups/deploy/20260627T053214Z-plugin-codex-mobile-web-codex-mobile-v539-thread-list-module`。
- `/api/public-config` 返回
  `clientBuildId=0.1.11|codex-mobile-shell-v539`，
  `shellCacheName=codex-mobile-shell-v539`。
- Phase B readback smoke 返回 `status=ready`、`reason=warm-or-bounded-paths`。
  生产证据包含：
  `threadListRequestContextArchivedIdsReadCount=1`、
  `threadListRequestContextSessionIndexReadCount=1`、
  `threadListRequestContextRolloutStatReadCount=24`、
  `threadListFallbackRolloutStatusStatReadCount=0`、
  `threadListFallbackRolloutStatusStatReuseCount=0`。
- 读回样本的 thread-list cold path 分别覆盖了 `source-snapshot-hit` 和
  `warm-fallback-cache`；selected mux metrics 仍为 supported/ok。

## 2026-06-27 v538 Phase B Selected Mux Runtime / Phase A Conversation Patch Module

v538 将 v537 后累积的本地切片收束为一个模块，而不是逐个小优化部署：

- Phase B：`8330750`、`4e49fb7` 完成 selected shared mux runtime/readback
  边界。`/api/status` 暴露 sanitized endpoint kind；Phase B readback smoke
  输出 metadata-only `muxRuntime` capability；macOS shared-chain restart 只读取
  selected profile endpoint file，并只停止 endpoint 里记录且命令行匹配的
  mux/app-server PID。
- Phase A：`968e4de`、`724cfd9`、`fa9cd7c` 继续收敛
  `updateConversationHtml()`。`thread-detail-dom-patch` 现在拥有
  conversation HTML application outcome、patch-fallback client event、以及
  `conversation_render_ms` bounded performance payload/slow-render force
  decision。`public/app.js` 只执行真实 DOM/reporting side effect。
- 本次 bump：`CLIENT_BUILD_ID` 和 PWA shell cache 从
  `codex-mobile-shell-v537` 升到 `codex-mobile-shell-v538`。

部署前生产读回确认旧状态仍是 v537：

- `/api/public-config`：`clientBuildId=0.1.11|codex-mobile-shell-v537`，
  `shellCacheName=codex-mobile-shell-v537`。
- Phase B readback：thread-list 已走 warm cache / profile mux transport，但
  `muxRuntime.muxMetricsRpc=false`，`muxMetrics.supported=false`，
  `muxMetrics.reason=mux-metrics-unsupported`。这证明 selected mux 仍运行旧能力面。

v538 部署目标不是修改 app-server 查询语义，而是先闭合 runtime/version 证据链：
Home AI central deploy contract 已修复，plugin deploy 后应刷新 selected mux；读回应确认
`muxRuntime.muxMetricsRpc=true` 且 `/api/status?muxMetrics=1` 支持 bounded mux metrics。

生产部署与读回：

- 首次部署在 Home AI `codex-mobile-selected-mux-refresh` post-sync repair
  阶段暴露出 sudo/stdin 冲突，Home AI 已在中心部署脚本中修复。
- 重试部署成功，生产 `/api/public-config` 返回
  `clientBuildId=0.1.11|codex-mobile-shell-v538` 和
  `shellCacheName=codex-mobile-shell-v538`。
- 因首次失败已经完成 source sync，重试时中心脚本的 selected mux refresh
  报告 `skipped=true`、`reason=no_mux_runtime_change`、`changedFileCount=0`；
  当时 runtime readback 仍显示 `muxRuntime.muxMetricsRpc=false`。随后通过
  已有 `POST /api/restart/shared-chain` 刷新 selected mux。
- 最终 Phase B readback 成功：`muxRuntime.muxMetricsRpc=true`，
  `muxMetrics.supported=true`，`threadListMuxRpcCount=2384`，
  `threadListMuxRpcLastMs=7`，detail readback 走
  `projection-active-overlay`。
- 已向 Home AI 发出后续根因修复卡 `ttc_6bd6684e3319218f84`：部分部署在
  post-sync repair 失败后，重试不能只靠文件 diff 判断是否跳过 selected
  mux refresh；需要记录 repair completion 或做 runtime capability gate。

预部署验证命令：

```bash
node --check adapters/shared-chain-restart-service.js && node --check server.js && node --check codex-app-server-mux.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --check adapters/phase-b-readback-decision-service.js && node --check public/thread-detail-dom-patch.js && node --check public/app.js && node --test test/shared-chain-restart-service.test.js test/shared-chain-restart-script.test.js test/protocol.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-detail-dom-patch.test.js test/thread-detail-refresh-dom-harness.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/app-update.test.js test/build-refresh-policy.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

## 2026-06-27 Phase B Route Merge Attribution Local Slice

本地继续 Phase B 时，v538 生产证据显示 mux RPC 已不是当前样本瓶颈：
`threadListMuxRpcLastMs=7`，Mobile 侧 `appServerRpcMs=9`，但同一类读回里
`appServerVisibleFilterMs` 和最终 `mergeMs` 可能成为主要耗时。这个切片只做
归因和可测试边界，不改变 `/api/threads` 返回内容、排序、可见性、fallback
cache 语义或 app-server 查询参数。

改动：

- 新增 `adapters/thread-list-route-merge-service.js`，把 app-server rows 与
  fallback rows 的最终 route-level merge 包成纯 helper，返回原有合并结果和
  bounded diagnostics：app-server/fallback/input/unique/duplicate/merged/output
  counts 以及 limit drop。
- `/api/threads` 继续使用同一 `mergeThreadSummaryList` 行为，但把
  `routeMerge*` diagnostics 写入 `mobileDiagnostics.threadListTimings`。
- Phase B readback 和 decision service 新增 route merge evidence；当 warm
  list 的最终 merge 成为主要耗时时，decision 归到
  `thread-list-route-merge` / `route-merge-latency`，而不是误归到 app-server
  RPC 或泛化的 warm cache。

验证：

```bash
node --check adapters/thread-list-route-merge-service.js && node --check server.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --check adapters/phase-b-readback-decision-service.js
node --test test/thread-list-route-merge-service.test.js test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-list-app-server-fetch-policy-service.test.js test/thread-visibility.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-fallback-baseline-service.test.js test/thread-list-cold-path-diagnosis-service.test.js
```

结果：focused/route tests `108` passed。该切片尚未部署；等凑成下一组
Phase B 模块后再 bump shell/cache 并走 Home AI central macOS plugin deploy。

相关平台状态：Home AI 已在 `471b25bd` 修复 selected mux deploy retry refresh
contract。之后使用 explicit mux runtime reason 的 Codex Mobile 部署，即使
source/prod 文件 diff 为零，也会因 deploy reason 或未完成 repair state 强制刷新
selected mux。

## 2026-06-27 Phase B Summary Merge Attribution Local Slice

继续 Phase B 时，route-level merge 已经能判断最终合并是否是主耗时，但还不能解释
`mergeThreadSummaryList()` 内部到底慢在哪。这个本地切片把 summary merge 拆成
可注入依赖的 service，仍不改变 thread list 的内容、排序、归档/隐藏规则或
app-server 查询参数。

改动：

- 新增 `adapters/thread-list-summary-merge-service.js`。
- `server.js` 的 `mergeThreadSummaryList()` 现在委托该 service；普通调用仍返回
  thread array，route-level 调用使用 `mergeThreadSummaryListWithDiagnostics()`。
- route merge diagnostics 白名单透传 `summaryMerge*` 字段，包括 input/invalid、
  archived-id skip、duplicate id、archive/subagent drop、byId/hydrated/visible/output
  counts，以及 cached display、normalize、display merge、title hydration、
  final filter、sort、total 耗时和 dominant stage。
- Phase B readback/decision 记录这些字段；当 route merge 是主耗时时，reason 可带
  dominant stage，例如 `route-merge-latency:cached_display`。

验证：

```bash
node --check adapters/thread-list-summary-merge-service.js && node --check adapters/thread-list-route-merge-service.js && node --check server.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --check adapters/phase-b-readback-decision-service.js
node --test test/thread-list-summary-merge-service.test.js test/thread-list-route-merge-service.test.js test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-visibility.test.js
```

结果：focused tests `86` passed。该切片尚未部署；继续积累到下一个 Phase B
模块后再 bump shell/cache 并部署。

## 2026-06-27 Phase B Request Context Merge Optimization Local Slice

在 summary merge 归因之后，下一步不再继续只加计时字段，而是直接减少一次
`/api/threads` 请求内的重复同步读取。这个本地切片仍保持 thread list 的内容、
排序、归档/隐藏规则、fallback cache 语义和 app-server 查询参数不变。

改动：

- 新增 `adapters/thread-list-request-context-service.js`，提供一次 request 内
  懒加载共享的 archived thread id set 和 `session_index` entries，并输出
  bounded 计数字段。
- `/api/threads` route 现在把同一个 archived id set 传入 app-server visible
  filter、state-db merge、rollout/session-index fallback 和 summary merge，避免同一请求
  多次扫描 archived session 目录。
- fallback baseline 的 source snapshot read 会保留 request `archivedIds`，并把
  `mergeThreadSummaryListOptions` 传给 baseline merge，避免冷路径 source build 后又用
  默认 reader 重读 session index / archive ids。
- summary merge 支持 request-scoped cached display reader。route 内对
  `threadDisplaySummaryCache.read(id)` 做同请求 memo：重复 id 仍按原来的
  `mergeThreadDisplaySummary()` 语义参与合并，但同一 id 的 cached summary 只读一次。
- Phase B readback smoke / decision evidence 新增
  `requestContextArchivedIdsReadCount`、`requestContextSessionIndexReadCount`、
  `requestContextCachedDisplayReadCount`，用于部署后证明优化是否生效。

验证：

```bash
node --test test/thread-list-request-context-service.test.js test/thread-list-summary-merge-service.test.js test/thread-list-route-merge-service.test.js test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js
npm run check
git diff --check
```

结果：focused tests `104` passed；`npm run check` passed；`git diff --check`
passed。该切片尚未部署；继续按 v539 模块批量提交/部署节奏推进。

## 2026-06-27 Phase B Request Context Rollout Stat Local Slice

继续 v539 的 thread-list 请求路径优化。本切片只减少同一 `/api/threads`
请求内对相同 rollout path 的重复 `fs.statSync` 元数据读取，不改变线程状态、
排序、隐藏/归档规则、fallback cache 语义、app-server 查询参数，也不把 rollout
tail/status 判断改成缓存判断。

改动：

- `thread-list-request-context-service` 新增 request-scoped
  `rolloutStatsForPath()`，按 rollout path 缓存 stat 结果或 null，并输出
  `requestContextRolloutStatReadCount`。
- `annotateThreadRolloutStats()`、`mergeThreadDisplaySummary()`、
  `mergeThreadWithCachedDisplaySummary()` 和 `filterVisibleThreads()` 支持注入该
  request-scoped reader；默认调用路径保持旧行为。
- `/api/threads` route 把同一个 reader 传给 app-server visible filter、cached
  display merge 和 summary duplicate merge，避免同一请求内重复读相同 rollout
  文件 stat。
- `thread-list-summary-merge-service` 支持 request-scoped
  `mergeThreadDisplaySummary`，确保 duplicate display merge 也走同一个 reader。
- Phase B readback smoke / decision evidence 新增
  `requestContextRolloutStatReadCount`，用于部署后确认优化生效。

验证：

```bash
node --test test/thread-list-request-context-service.test.js test/thread-list-summary-merge-service.test.js test/thread-list-route-merge-service.test.js test/thread-list-fallback-baseline-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js
```

结果：focused tests `106` passed。该切片尚未部署；继续按 v539 模块批量提交/部署
节奏推进。

## 2026-06-27 Phase B Rollout Fallback Status Stat Reuse Local Slice

继续 v539 的 thread-list fallback 冷/热路径优化。本切片只消除 rollout fallback
summary read 到 final status attach 之间的重复 `fs.statSync`，不改变 rollout tail
读取、active/completed 推断、过滤、排序、cache 或 app-server 查询语义。

改动：

- `readRolloutSessionFallbackThreadFromFile()` 在读取 summary 时把已验证的
  `fs.Stats` 作为非枚举 `Symbol` metadata 挂到 thread row 上。该 metadata 不会进入
  JSON/API 响应。
- `attachRolloutFallbackStatus()` 优先复用这个 metadata；没有 metadata 的普通 thread
  仍按旧路径重新 stat。
- `inferRolloutFallbackStatus()` 仍然实时读取 rollout tail；本切片没有缓存 tail，也
  没有把状态判断改成 stat-only。
- Phase B readback smoke / decision evidence 新增
  `fallbackRolloutStatusStatReadCount` 和
  `fallbackRolloutStatusStatReuseCount`，用于部署后证明状态 attach 是否复用了 summary
  read 的 stat。

验证：

```bash
node --test test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js
```

结果：focused tests `80` passed。该切片尚未部署；继续按 v539 模块批量提交/部署
节奏推进。

## 2026-06-27 v537 Phase B RPC/Mux Evidence Module

v537 把两个本地 Phase B 切片作为一个模块部署：`6624f1b` 记录 Mobile 到
Codex app-server `thread/list` RPC 的 transport、attempt、timeout 和
request/response bytes；`e433ba0` 在 mux 内部增加 query-gated
`mux/metrics/read` 聚合指标；`ae3388d` bump `CLIENT_BUILD_ID` / PWA shell cache
到 `codex-mobile-shell-v537`。

预部署验证：

```bash
node --check codex-app-server-mux.js && node --check server.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --check adapters/phase-b-readback-decision-service.js && node --test test/protocol.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-task-card-route.test.js test/mobile-viewport.test.js test/thread-goal-service.test.js test/app-update.test.js test/build-refresh-policy.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `86` passed；`npm test` `1200` passed；`check`、`check:macos`、
`git diff --check` passed。

已通过 Home AI 中央 macOS 插件部署脚本部署，source ref `ae3388d080bc`，reason
`codex-mobile-phase-b-rpc-metrics-v537`，backup path：
`/Users/hermes-host/HermesMobile/backups/deploy/20260627T002556Z-plugin-codex-mobile-web-codex-mobile-phase-b-rpc-metrics-v537`。

生产读回：

- `/api/public-config` 返回 `clientBuildId=0.1.11|codex-mobile-shell-v537`、
  `shellCacheName=codex-mobile-shell-v537`。
- 首个一般 Phase B readback：prewarm completed；thread-list 使用
  `fallback-source-snapshot` / `source-snapshot-hit`；`appServerRequestLimit=80`；
  `appServerMs=1792`，`appServerRpcMs=1705`，`appServerVisibleFilterMs=87`，
  `appServerUnattributedMs=0`；RPC transport 为 `external-jsonl-tcp`，
  endpoint kind 为 `profile-mux-file`，attempt count `1`，未 timeout，
  request payload `185` bytes，params `128` bytes，response payload `235487`
  bytes。
- targeted 当前 Codex Mobile 线程 readback：thread-list 为
  `warm-fallback-cache` / `cache-hit`；`appServerMs=98`，`appServerRpcMs=8`，
  response payload 同为 `235487` bytes；detail 仍为
  `projection-active-overlay`，active overlay gate=`ready`，decision=`ready`。
- `/api/status?muxMetrics=1` 返回 `mux-metrics-unsupported`。只读 runtime
  检查显示 selected `previous` profile mux endpoint capability 仍缺
  `muxMetricsRpc`，同时机器上存在多个旧 mux 进程。这说明 central deploy 已让
  Mobile listener 进入 v537，但没有替换已经运行的 selected shared mux 进程。
- Source/prod short SHA-256 readback matched for `public/app.js`, `public/sw.js`,
  `server.js`, `codex-app-server-mux.js`, and
  `scripts/codex-mobile-phase-b-readback-smoke.js`。后续本地 follow-up 已更新
  `adapters/phase-b-readback-decision-service.js`，所以该文件在下一次部署前会
  与生产不同。

生产观察：v537 把大 session 线程列表慢路径进一步收窄到
`profile-mux-file/jsonl-tcp` 的 `thread/list` RPC 边界，并证明单次响应体约
235KB、没有 retry/timeout。由于 mux-side metrics 尚未在运行中的 selected mux
进程生效，下一步应优先修正 shared mux runtime/version 或部署重启契约，让
`threadListMuxRpcLastMs` 可读；在拿到 mux-side timing 前，不应直接改
app-server 查询语义或再加前端兜底。

## 2026-06-27 Phase B Readback Decision Mux Runtime Follow-up

v537 读回后补了一个本地 decision 小切片：当 `appServerRpcMs` 已经占主导且报告
明确显示 `muxMetrics.supported=false` 或 mux metrics read 失败时，Phase B
decision 先路由到 `shared-mux-runtime` / `shared-mux-metrics`，而不是继续泛化成
`app-server-thread-list-rpc`。这只改变诊断归因，不改变运行路径、请求窗口、缓存、
投影或 UI。

验证：

```bash
node --check adapters/phase-b-readback-decision-service.js && node --test test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js
```

结果：focused `29` passed。该 follow-up 尚未 bump shell/cache，尚未部署；等待下一个
Phase B 模块一起部署。

## 2026-06-27 Phase B Shared Mux Runtime Readiness Slice

本地小切片继续 v537 后的 mux runtime 边界。症状是生产目录里的
`codex-app-server-mux.js` 已经包含 `muxMetricsRpc`，但 selected `previous`
profile 的运行中 mux endpoint capability 仍缺这个字段，说明普通 central deploy
只重启了 Mobile listener，没有刷新已经运行的 selected mux 进程。

改动边界：

- `/api/status.endpoint` 增加 sanitized `kind`，例如 `profile-mux-file`。原有
  authenticated raw endpoint 字段保持不变，但 Phase B readback 只消费 kind/protocol
  和 capability 布尔值。
- `scripts/codex-mobile-phase-b-readback-smoke.js` 新增 `muxRuntime` 摘要：
  transport、endpoint kind/protocol、是否 profile mux、shared-required、
  persistent-owned-mux、mobile-owned-mux running，以及 `mobileEcho`、
  `notificationReplay`、`serverRequestProxy`、`threadGoalRpc`、`muxMetricsRpc`。
  不输出 endpoint path、host、port、pid、线程标题、消息正文或日志。
- Phase B decision evidence 保留同一组 bounded runtime 字段，让后续读回能自动判断
  “listener 新、mux 旧”的状态。
- macOS `POST /api/restart/shared-chain` 生成的 shell command 现在会先读取 selected
  `CODEX_HOME/app-server-mux/endpoint.json` 的 `pid` / `childPid`，仅当对应命令行匹配
  `codex-app-server-mux` 或 `codex app-server` 时才 kill，并删除该 selected endpoint
  文件。它不扫描或清理其它 profile mux。

验证：

```bash
node --check adapters/shared-chain-restart-service.js && node --check server.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --check adapters/phase-b-readback-decision-service.js && node --test test/shared-chain-restart-service.test.js test/shared-chain-restart-script.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/protocol.test.js
```

结果：focused `62` passed。该 slice 尚未 bump shell/cache，尚未部署；下一步需要把它和
Home AI central deploy contract 修复一起作为模块闭环，否则 central deploy 仍不会自动刷新
selected mux。

## 2026-06-27 Phase B Mux RPC Metrics Slice

本地小切片继续上一片 app-server RPC transport diagnostics。上一片能在 Mobile server
侧看到 `thread/list` 的 transport、attempt、request/response bytes；这一片补 mux 自身的
method-level 聚合指标，方便下一次生产读回区分“Mobile 到 mux 的等待”和“mux 转发到
真实 Codex app-server 的等待”。

改动边界：

- `codex-app-server-mux.js` 记录每个 forwarded JSON-RPC method 的 bounded 聚合指标：
  count、errorCount、total/avg/last/max ms、last request bytes、last response bytes。
- 新增 mux 自有只读 RPC：`mux/metrics/read`。它只返回方法名和数值，不返回 params、
  result、thread id、标题、消息正文、任务卡正文、endpoint path 或日志。
- mux endpoint capability 新增 `muxMetricsRpc: true`。
- `/api/status?muxMetrics=1` 才会主动读取 mux metrics；普通 status 和 `/api/threads`
  热路径不额外读 mux。
- Phase B readback smoke 在读取 `/api/threads` 后读一次 query-gated status，并把
  `thread/list` mux metrics 放入 report / decision evidence。

验证：

```bash
node --check codex-app-server-mux.js && node --check server.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --check adapters/phase-b-readback-decision-service.js && node --test test/protocol.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-task-card-route.test.js
```

结果：focused `54` passed。未 bump `CLIENT_BUILD_ID` / PWA shell cache，未部署；继续作为
Phase B 本地切片，等待下一次模块批量部署/readback。

## 2026-06-27 Phase B App-Server RPC Transport Diagnostics Slice

本地小切片继续 v536 后的 Phase B。v536 生产读回已经证明普通线程列表慢样本主要
落在 `appServerRpcMs`，不是 fallback/prewarm、本地 visible filter、workspace
filter 或未归因 Mobile server 时间。本切片不改变列表数据、排序、请求窗口、fallback
策略或 UI，只把 `codex.request("thread/list")` 的 RPC 边界补成 metadata-only 证据：

- `CodexAppServerClient` 在 RPC promise 上记录 bounded attempt count、timeout、
  retry/timeout 状态、request payload bytes、request params bytes、response payload
  bytes。
- endpoint 只公开分类：`profile-mux-file`、`env-ws`、`env-tcp`、`managed-child` 或
  `external-*`，不公开 endpoint 文件路径、host 私有路径、线程标题、消息正文或任务卡正文。
- `/api/threads` 只给 app-server `thread/list` 调用传入 diagnostics 对象；其它 RPC
  行为不变。
- Phase B readback 和 decision evidence 现在携带 transport/endpoint/payload 字节字段，
  后续模块部署读回可以判断慢点是否与响应体规模、retry/timeout、传输类型相关。

验证：

```bash
node --check server.js && node --check adapters/thread-list-app-server-fetch-policy-service.js && node --check adapters/phase-b-readback-decision-service.js && node --check scripts/codex-mobile-phase-b-readback-smoke.js && node --test test/thread-list-app-server-fetch-policy-service.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-visibility.test.js test/protocol.test.js
```

结果：focused `101` passed。未 bump `CLIENT_BUILD_ID` / PWA shell cache，未部署；继续按
“小切片本地提交，模块批量部署”的节奏等待下一次 Phase B 模块。

## 2026-06-27 v536 Phase B App-Server List Attribution Module

v536 把 v535 后的 3 个本地 Phase B app-server list 归因切片收束成一个模块：

- `ac43b73`：把 `/api/threads` 的 app-server list 粗粒度 `appServerMs` 拆成
  RPC、visible filter、workspace filter、post-process 和 raw/visible/filtered
  row counts。
- `da7a4e2`：让 Phase B readback decision 消费这些字段，把高延迟样本路由到
  RPC/filter/post-process 或 H3 inconclusive owner。
- `8ff2d5b`：补 `appServerMeasuredMs` / `appServerUnattributedMs`，避免把未测量
  余量误归因到 RPC 或 filter。
- 当前模块 bump：升级 `CLIENT_BUILD_ID` 和 PWA shell cache 到
  `codex-mobile-shell-v536`。

预部署验证：

```bash
node --test test/thread-list-app-server-fetch-policy-service.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-visibility.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js test/app-update.test.js test/build-refresh-policy.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `124` passed；`npm test` `1199` passed；`check`、`check:macos`、
`git diff --check` passed。

已通过 Home AI 中央 macOS 插件部署脚本部署，source ref `f9d262d0e1ae`，reason
`codex-mobile-phase-b-app-server-attribution-v536`，backup path：
`/Users/hermes-host/HermesMobile/backups/deploy/20260626T235211Z-plugin-codex-mobile-web-codex-mobile-phase-b-app-server-attribution-v536`。

生产读回：

- `/api/public-config` 返回 `clientBuildId=0.1.11|codex-mobile-shell-v536`、
  `shellCacheName=codex-mobile-shell-v536`。
- 一般 Phase B readback：
  `threadListFallbackPrewarm.completed=true`；
  thread-list 为 `fallback-source-snapshot` / `source-snapshot-hit`；
  `appServerRequestLimit=80`；
  `appServerMs=1939`，`appServerRpcMs=1853`，
  `appServerVisibleFilterMs=86`，`appServerMeasuredMs=1939`，
  `appServerUnattributedMs=0`；
  decision=`needs_repair`，owner=`app-server-thread-list-rpc`。
- 当前 Codex Mobile 线程 targeted readback：
  thread-list 为 `warm-fallback-cache` / `cache-hit`；
  `appServerMs=92`，`appServerRpcMs=8`，
  `appServerVisibleFilterMs=84`，`appServerMeasuredMs=92`，
  `appServerUnattributedMs=0`；
  detail=`projection-active-overlay`，active overlay gate=`ready`；
  decision=`ready`。
- Source/prod short SHA-256 readback matched for `public/app.js`,
  `public/sw.js`, `server.js`,
  `adapters/thread-list-app-server-fetch-policy-service.js`,
  `adapters/phase-b-readback-decision-service.js`, and
  `scripts/codex-mobile-phase-b-readback-smoke.js`.

生产观察：这次模块把剩余慢点从泛化 `appServerMs` 收窄到 RPC 路径。下一步不应继续改
fallback/prewarm，也不应先优化本地 filter；应检查 Codex app-server/mux 的
`thread/list` RPC 延迟来源。

## 2026-06-27 Phase B App-Server List Residual Attribution Slice

本地小切片继续 app-server list latency attribution。上一片 decision 已经能用
`appServerRpcMs`、filter 和 post-process 字段选择 owner，但还缺少一个关键证据：
`appServerMs` 减去已测 RPC/filter 后还剩多少未归因时间。

本切片不改变线程列表行为，只补 metadata-only 字段：

- `appServerMeasuredMs`：`appServerRpcMs + appServerVisibleFilterMs +
  appServerWorkspaceFilterMs`。
- `appServerUnattributedMs`：`appServerMs - appServerMeasuredMs` 的 bounded 余量。

如果高延迟样本里 `appServerUnattributedMs` 主导，Phase B decision 会路由到
owner=`thread-list-app-server-attribution`，nextAction=
`split-thread-list-app-server-residual-timing`。这避免把未测量余量误归因为 RPC 或
filter，也给下一片是否继续拆 server 内部计时提供证据。

验证：

```bash
node --test test/thread-list-app-server-fetch-policy-service.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `84` passed；`npm test` `1199` passed；`check`、`check:macos`、
`git diff --check` passed。

## 2026-06-27 Phase B App-Server List Latency Decision Slice

本地小切片继续上一片 app-server latency attribution。上一片已经把
`appServerMs` 拆成 RPC、visible filter、workspace filter、post-process 和数量计数，
但 Phase B readback decision 还只是记录 evidence，没有真正把 2 秒级列表慢点路由到
下一步 owner。

本切片不改变运行路径，只让 `phase-b-readback-decision-service` 消费这些字段：

- `appServerMs < 1000`：不改变 decision，避免把正常波动升级为 H2。
- `appServerRpcMs` 主导：owner=`app-server-thread-list-rpc`，nextAction=
  `investigate-app-server-thread-list-rpc`。
- `appServerVisibleFilterMs` 主导：owner=`thread-list-visible-filter`，nextAction=
  `optimize-thread-list-visible-filter`。
- `appServerWorkspaceFilterMs` 主导：owner=`thread-list-workspace-filter`。
- `appServerPostProcessMs` 主导：owner=`mobile-thread-list-postprocess`。
- split 不明确但总耗时高：H3 observe，要求继续采样而不是直接改代码。

这样下一次模块部署读回时，Phase B decision 会直接给出 root-cause owner，而不是只显示
`phase-b-readback ready` 或泛化的 `app-server-thread-list`。该切片仍不 bump
`CLIENT_BUILD_ID` / PWA shell cache，不单独部署。

验证：

```bash
node --test test/phase-b-readback-decision-service.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `19` passed；`npm test` `1198` passed；`check`、`check:macos`、
`git diff --check` passed。

## 2026-06-27 Phase B App-Server List Latency Attribution Slice

本地小切片继续 v535 之后的 Phase B。v535 读回确认 fallback/prewarm 已经不是
前台首屏瓶颈：列表可走 `fallback-source-snapshot` 或 `warm-fallback-cache`，
app-server 请求窗口也已收窄到 `80`。但同一读回仍显示 `appServerMs` 约
`1789-2077ms`。此前这个字段把 app-server RPC、可见性过滤、workspace 过滤和计数
全部混在一起，无法判断下一步应该修 mux/RPC、app-server `thread/list`，还是
Mobile server 后处理。

本切片不改变线程列表行为，只把 `/api/threads` 的 app-server list 路径拆成
metadata-only 诊断字段：

- `appServerRpcMs`
- `appServerVisibleFilterMs`
- `appServerWorkspaceFilterMs`
- `appServerPostProcessMs`
- `appServerMeasuredMs`
- `appServerUnattributedMs`
- `appServerRawCount`
- `appServerVisibleCount`
- `appServerFilteredCount`

这些字段由 `thread-list-app-server-fetch-policy-service` 统一 bounding 和计数，
并进入 Phase B readback summary / decision evidence。后续生产部署读回就可以直接
判断 2 秒级 `appServerMs` 是 RPC 侧耗时，还是本地过滤/后处理耗时。该切片不 bump
`CLIENT_BUILD_ID` / PWA shell cache，不部署；等下一组 Phase B 归因/修复合成模块后
统一发布。

验证：

```bash
node --test test/thread-list-app-server-fetch-policy-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `80` passed；`npm test` `1195` passed；`check` 和
`check:macos`、`git diff --check` passed。

## 2026-06-27 v535 Phase B Thread-List Refresh Module

v535 把 v534 之后的两个本地 Phase B 小切片收束成一个模块部署：

- `aaeb3b2`：warm fallback initial shell。默认列表在已有 warm cache 时可先返回
  `mobileDeferredAppServer=true` 的首屏 shell，不同步等待 app-server list。
- `e037a74`：app-server fetch-window policy。普通 authoritative refresh 的
  app-server list 请求窗口从 route 内联规则抽成
  `thread-list-app-server-fetch-policy-service`，默认/search 列表不再无条件取 500
  条，而是 bounded overfetch。
- `bf72619`：升级 `CLIENT_BUILD_ID` 和 PWA shell cache 到
  `codex-mobile-shell-v535`。

发布前验证：

```bash
node --test test/thread-list-app-server-fetch-policy-service.test.js test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-performance-metrics.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js test/app-update.test.js test/build-refresh-policy.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `148` passed；`npm test` `1193` passed；`check`、
`check:macos`、`git diff --check` passed。通过 Home AI 中央 macOS 插件部署脚本
发布，source ref `bf726194c000`，reason
`codex-mobile-phase-b-list-refresh-v535`，backup path：
`/Users/hermes-host/HermesMobile/backups/deploy/20260626T232446Z-plugin-codex-mobile-web-codex-mobile-phase-b-list-refresh-v535`。

生产 readback：

- `/api/public-config` 返回
  `clientBuildId=0.1.11|codex-mobile-shell-v535`、
  `shellCacheName=codex-mobile-shell-v535`。
- `threadListFallbackPrewarm.completed=true`，
  `lastCacheDecision=miss-rebuild`，`lastResultCount=11`，
  `lastElapsedMs=1458`。
- 通用 Phase B readback 通过，decision 为 `ready`。
  首个 thread-list 读回没有前台 rollout/source 扫描，走
  `fallback-source-snapshot`，`fallbackSourceSnapshotHit=true`，
  `appServerRequestLimit=80`，`appServerRequestReason=default-bounded-overfetch`。
- 定向当前 Codex Mobile 线程 readback 通过，thread-list 为
  `warm-fallback-cache` / `cache-hit`，detail 为
  `projection-active-overlay`，active overlay gate 为 `ready`。
- Source/prod SHA-256 短哈希匹配：
  `public/app.js` `a48a09db519d0ba7`，
  `public/sw.js` `6cc191676ffe9cd1`，
  `server.js` `3eb2f3f140df4224`，
  `adapters/thread-list-app-server-fetch-policy-service.js` `6abf190bcbb91862`，
  `scripts/codex-mobile-phase-b-readback-smoke.js` `953925f618efe2a9`。

生产观察：即使 app-server list 请求窗口已从旧的 500 收窄到 80，readback 仍看到
`appServerMs` 约 `1789-2077ms`。这说明下一轮 Phase B 不应再优先盯 fallback
baseline，而应直接分析 app-server `thread/list` 本身、mux/RPC 延迟、state-db-only
读取或后续 merge/decorate 的真实耗时。

## 2026-06-27 Phase B App-Server Fetch Window Policy Slice

本地小切片继续收敛 v534 之后的 thread-list 冷/热路径。前一切片已经把
`initial=warm-fallback` 接到首屏 shell，使 warm fallback cache 可以先返回，
再由客户端调度普通 authoritative refresh。这个普通刷新还有一个独立问题：
`/api/threads` route 仍把 app-server `thread/list` 请求窗口写死成
`Math.max(limit, 500)`，默认列表即使只需要 40 或 80 条，也会先等待 500 条
app-server list 结果。

本切片新增 `adapters/thread-list-app-server-fetch-policy-service.js`，把
app-server list 请求窗口从 `server.js` 抽成可测试策略：

- cursor 翻页：精确按当前页 `limit` 请求，不额外 overfetch。
- workspace filter：保留旧的 500 条窗口，因为 cwd 是 app-server 返回后在
  Mobile server 侧过滤，不能在这里收窄语义。
- archived：保留旧的 500 条窗口，避免影响低频但语义敏感的归档列表。
- search/default：改为 bounded overfetch，默认 `max(limit * 2, 80)`，上限 500。

server route 会把策略结果写入 `mobileDiagnostics.threadListTimings`：

- `appServerRequestedLimit`
- `appServerRequestLimit`
- `appServerRequestReason`
- `appServerOverfetchFactor`

Phase B readback smoke 和 decision evidence 也会保留这些 bounded 字段。这样下一次
模块部署读回如果仍出现“fallback 已经 warm，但 authoritative refresh 仍慢”，可以
直接判断慢点是否还在 app-server 请求窗口，而不需要靠日志或私有会话内容推断。

验证：

```bash
node --test test/thread-list-app-server-fetch-policy-service.test.js test/thread-visibility.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `78` passed；`npm test` `1193` passed；`check`、`check:macos`、
`git diff --check` passed。该切片未 bump `CLIENT_BUILD_ID` / PWA shell cache，
未部署；继续作为 Phase B 本地提交，等待后续 cold-path/app-server 优化凑成模块后
统一部署/readback。

## 2026-06-27 Phase B Warm Fallback Initial Shell Slice

本地小切片继续 v534 之后的 Phase B。v534 已经证明 thread-list fallback
prewarm 可以在部署/冷启动后完成一次后台 baseline/source snapshot 构建，普通
readback 的首个列表样本也能命中 `warm-fallback-cache`。但生产读回同时暴露了
另一个边界：`/api/threads` route 仍会先等待 `codex.request("thread/list")`，
再读取已经预热好的 fallback cache；因此即使命中 warm cache，首屏响应仍可能被
不可预测的 app-server list 延迟牵住。

本切片新增 `readCachedFallback()`，明确区分“只读已有 warm cache”和
`readFallback()` 的“miss 时允许构建 baseline/source snapshot”。server 端只有在
默认列表、非 archived、无 cursor、无 workspace filter、无 search，且请求显式
带 `initial=warm-fallback` 时，才尝试 warm fallback initial shell。命中时直接返回
已有预热列表并标记：

- `mobileDeferredAppServer=true`
- `mobileInitialSource=warm-fallback-cache`
- `threadListTimings.appServerDeferred=true`
- `threadListTimings.appServerDeferredReason=warm-fallback-initial`

如果 warm cache 不存在，该路径不会触发冷重建，仍退回原 app-server list 路径。
客户端只在现有 `deferFallback` 首屏路径带上 `initial=warm-fallback`；收到
`mobileDeferredAppServer` 后复用既有延迟刷新机制，再拉一次普通 authoritative
thread-list 融合结果。这个切片不改变 app-server authority、fallback
merge/filter/limit 语义、任务卡协议、Home AI 诊断调度或 PWA shell，只把已经预热
好的 bounded fallback list 作为首屏 initial shell，并把后续权威刷新显式化。

验证：

```bash
node --test test/thread-list-fallback-cache-service.test.js test/thread-list-cold-path-diagnosis-service.test.js test/thread-performance-metrics.test.js test/thread-visibility.test.js test/mobile-viewport.test.js
npm run check
npm test
git diff --check
```

结果：focused `90` passed；`npm test` `1188` passed；`check` 和
`git diff --check` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续按当前节奏作为 Phase B 本地提交，等待下一组 cold-path/app-server
优化合成模块后统一部署/readback。

## 2026-06-27 v534 Phase B Thread-List Fallback Prewarm Module

本地小切片开始处理 v533 readback 暴露的下一阶段问题：生产重启或部署后，首次
thread-list 读取仍会在用户前台路径里完成一次 `fallback-baseline` /
`miss-rebuild:rollout`，随后同 key warm check 立即变为 `warm-fallback-cache`。
这说明当前系统已经满足“进程内一次重建后复用”的方向，但首次重建仍可能落在
用户首屏。

本次修复新增 `adapters/thread-list-fallback-prewarm-service.js`，把默认线程列表
fallback cache / source snapshot 的启动预热变成独立可测试策略。server listener
启动后会按 `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_DELAY_MS` 延迟调度一次默认
列表预热，默认 limit 与客户端默认列表 limit 对齐为 `40`。这不会改变
app-server authority、fallback merge/filter/limit 语义、线程列表排序、前端刷新、
任务卡协议或诊断上报；它只把已有的一次性 source baseline 构建尽量移到后台，
并保留 bounded metadata-only 结果日志。后续本地切片又把同一份 bounded
预热状态接入 `/api/public-config` 和 Phase B readback：只暴露
`enabled/scheduled/running/completed`、deferral count、last status/error code、
cache decision、cache/source-snapshot hit、结果数量和耗时等字段，不暴露线程
id、标题、消息、任务卡正文、rollout 路径或日志。这样部署读回时如果首次列表
仍然冷，可以明确区分预热失败、预热尚未完成、预热已完成但 cache key/source
snapshot 没对齐，而不是继续泛化为 `fallback-baseline`。
最新本地切片又让 `scripts/codex-mobile-phase-b-readback-smoke.js` 在读取
`/api/threads` 前先等待预热状态短暂 settle：默认最多等待 `4000ms`，每
`250ms` 复查一次 `/api/public-config`，直到 prewarm `completed` / `failed`
或超时。输出会保留 `publicConfigInitial`、settled `publicConfig` 和
`threadListPrewarmSettle`，因此模块部署后可以判断首个列表读是否真的发生在
预热完成之后；可以用 `--no-wait-prewarm` 关闭等待，或用
`--prewarm-settle-ms` / `--prewarm-poll-ms` 调整验证窗口。

新增开关：

- `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM=0` 可禁用启动预热。
- `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_DELAY_MS` 默认 `1500`。
- `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_RETRY_MS` 默认 `2500`。
- `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS` 默认 `5`。
- `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_LIMIT` 默认 `40`。
- Phase B readback 脚本侧：
  - `CODEX_MOBILE_PHASE_B_PREWARM_SETTLE_MS` 默认 `4000`。
  - `CODEX_MOBILE_PHASE_B_PREWARM_POLL_MS` 默认 `250`。
  - CLI 可用 `--no-wait-prewarm`、`--prewarm-settle-ms`、`--prewarm-poll-ms`。

本批次从 3 个本地切片收束为 `codex-mobile-shell-v534` 模块并已部署：

- `90d4d72`：启动后预热 thread-list fallback cache/source snapshot。
- `48e4940`：在 `/api/public-config` 和 Phase B readback 中暴露 bounded
  prewarm lifecycle。
- `fad39b5`：readback 在首个 `/api/threads` 前等待 prewarm settle。
- `07b78c1`：升级 `CLIENT_BUILD_ID` 和 PWA shell cache 到 v534。

部署前验证：

```bash
node --test test/thread-list-fallback-prewarm-service.test.js test/phase-b-readback-smoke.test.js test/phase-b-readback-decision-service.test.js test/thread-visibility.test.js test/app-update.test.js test/build-refresh-policy.test.js test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js
npm run check
npm run check:macos
npm test
git diff --check
```

结果：focused `120` passed；`npm test` `1187` passed；`check`、
`check:macos`、`git diff --check` passed。生产通过 Home AI 中央 macOS
插件部署脚本发布，source ref `07b78c1372b1`，backup path：
`/Users/hermes-host/HermesMobile/backups/deploy/20260626T225522Z-plugin-codex-mobile-web-codex-mobile-phase-b-prewarm-v534`。

生产 readback 确认 `/api/public-config` 返回
`clientBuildId=0.1.11|codex-mobile-shell-v534`、
`shellCacheName=codex-mobile-shell-v534`，`threadListFallbackPrewarm.completed=true`。
prewarm 本身完成了一次 bounded baseline/source snapshot build：
`lastCacheDecision=miss-rebuild`、`lastResultCount=11`、`lastSourceSnapshotRawCount=27`、
`lastElapsedMs=1639`。随后普通 Phase B readback 的首个 thread-list 已命中
`warm-fallback-cache` / `cache-hit`，没有再走前台 fallback rebuild。定向当前
Codex Mobile 线程的 readback 也不再扫描 rollout source，而是复用
`fallback-source-snapshot`；detail 路径继续走 `projection-active-overlay`，
active overlay gate 为 `ready`，整体 decision 为 `ready`。

## 2026-06-27 v533 Phase A Render/Patch Module Readback

v533 是 Phase A 后续本地小切片的模块级部署闭环，覆盖 v532 之后继续完成的
`refreshCurrentThread()` patch surface / execution / evidence resolution
编排收敛。该版本只升级静态壳和部署已验证的 Phase A ownership cleanup，不改
server projection 语义、任务卡协议、Home AI 诊断调度、平铺视图布局或 public
发布流程。

本批次部署前验证：

```bash
node --test test/mobile-viewport.test.js test/thread-task-card-route.test.js test/thread-goal-service.test.js test/thread-detail-render-plan.test.js test/conversation-render.test.js test/thread-tile-layout-ui.test.js
npm test
npm run check
npm run check:macos
git diff --check
```

结果：focused `225` passed；`npm test` `1175` passed；`check`、
`check:macos`、`git diff --check` passed。部署提交为 `58e5c8e`，
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v533`。

生产通过 Home AI 中央 macOS 插件部署脚本发布，readback 确认
`clientBuildId=0.1.11|codex-mobile-shell-v533`、
`shellCacheName=codex-mobile-shell-v533`。普通 readback 首轮仍观察到一次
`fallback-baseline` rebuild，warm check 命中 `warm-fallback-cache`；当前
Codex Mobile 线程定向 readback 返回 `decision.status=ready`，detail 走
`projection-active-overlay`，active overlay gate 为 `ready`。

## 2026-06-26 v532 Phase A Render/Patch Ownership Module

v532 是 Phase A 前端 thread-detail render/patch ownership 的模块级发布，
把此前连续本地小切片合并成一次可部署批次，而不是每个小改动单独部署。
本批次主要收敛 `refreshCurrentThread()`、conversation DOM patch、local patch
completion、scroll/bottom-follow 和 single-thread shell update 的所有权边界。

本批次的根因边界：

- `public/app.js` 继续向“编排真实 DOM/network/timer side effect”的方向收缩；
  refresh/patch/scroll 的策略判断尽量进入纯 helper。
- `public/thread-detail-render-plan.js` 负责 refresh request/response、patch
  surface、attempt、telemetry、completion、post-merge 等计划。
- `public/thread-detail-dom-patch.js` 负责 DOM patch 事务、completion snapshot、
  completion effects 和 conversation HTML update effects。
- `public/conversation-scroll.js` 负责 bottom-follow lease、retry schedule、
  reading hold、auto-scroll hold、local-patch/full-render scroll planning。

这不是前端状态机的完整终局；Phase C 的 pane-state 和 Phase E 的浏览器视觉
回归仍需继续推进。本次发布只处理 Phase A 模块边界，不改变 server projection
语义、任务卡协议、诊断调度策略或平铺视图布局。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v532`。
已通过 Home AI 中央 macOS 插件部署脚本部署到生产，生产读回
`/api/public-config` 确认 `clientBuildId=0.1.11|codex-mobile-shell-v532`、
`shellCacheName=codex-mobile-shell-v532`。Phase-B readback smoke 返回
`status=ready`，detail 走 `projection-active-overlay` warm path，active overlay
gate 为 `ready`；抽样文件 source/prod SHA-256 短 hash 一致。

## 2026-06-27 Phase A Patch Evidence Resolution Slice

本地小切片继续收敛 `refreshCurrentThread()` 的 patch-attempt result evidence
编排。此前 visible-shape evidence 的请求和 completion stage 已在
`public/thread-detail-render-plan.js` 中，但 `public/app.js` 仍直接检查
`patchRejectedVisibleShapeEvidence.collected`，并决定是否调用 completion stage。
这让 patch rejection evidence 的完成条件仍散在 app 主状态机里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchAttemptResultEvidenceResolutionStage()`。
- `refreshCurrentThread()` 只执行真实 visible-shape evidence effect，然后把
  evidence result 交给 resolution stage；不再直接分支判断 `collected`。
- `test/thread-detail-render-plan.test.js` 覆盖 collected / not collected 两条路径。
- `test/conversation-render.test.js`、`test/mobile-viewport.test.js` 和
  `test/thread-tile-layout-ui.test.js` 验证 app.js 不再直接调用 completion stage
  或保留旧 `let patchAttemptResultStage` 镜像。
- 不改变 visible-shape 采集、patch rejection diagnostic payload、DOM patch、
  full render、server projection、任务卡协议、诊断上报或 shell/cache。

闭环验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-tile-layout-ui.test.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
```

结果：focused `210` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Patch Surface Execution Stage Slice

本地小切片继续收敛 `refreshCurrentThread()` 的 patch surface / execution
编排。此前 DOM probe 的前置规划、probe effect、surface result 和 patch
execution 都已经由 `public/thread-detail-render-plan.js` 分别拥有，但
`public/app.js` 仍然手写把 probe 结果再串到 result stage、execution stage 和
attempt effects。这个组合逻辑如果继续留在 app 主状态机会让 tile pane、single
thread 和 metadata-only 刷新路径在后续修改时重新漂移。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchSurfaceExecutionStage()`，把 DOM probe 的
  bounded 结果、最终 patch surface、patch execution 和 attempt effects 组合为
  一个纯 planning stage。
- `refreshCurrentThread()` 只执行真实 DOM probe effect，然后把 probe 结果交给
  该组合 stage；它不再直接调用 surface result stage 和 patch execution stage。
- `test/thread-detail-render-plan.test.js` 覆盖 tile-pane probe 结果会阻止
  single-thread local patch、metadata-only 刷新仍走 metadata-update fallback。
- `test/conversation-render.test.js`、`test/mobile-viewport.test.js` 和
  `test/thread-tile-layout-ui.test.js` 验证 app.js wiring 不再散落 result/execution
  组合。
- 不改变 DOM probe、tile-pane patch、single-thread local patch、full render、
  metadata update、server projection、任务卡协议、诊断上报或 shell/cache。

闭环验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-tile-layout-ui.test.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
```

结果：focused `210` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Post-Merge Timing Executor Slice

本地小切片继续收敛 thread-detail refresh / first-paint / full-backfill 的
post-merge 执行形状。此前 `planThreadDetailRefreshPostMergeEffects()` 已经在
`public/thread-detail-render-plan.js` 中拥有 merge、composer-render、
thread-list-render 三组 effect 顺序，但 `public/app.js` 仍在多个路径重复手写
`nowPerfMs()`、执行 group、`roundedDurationMs()` 的计时模式。重复计时形状会让
refresh、first-paint、full-backfill 和 cached-current 之间继续存在漂移风险。

本次修复：

- `public/app.js` 新增
  `applyThreadDetailRefreshTimedPostMergeEffectsGroup()`，统一执行一个
  post-merge group 并返回该 group 的 bounded duration。
- `refreshCurrentThread()` 与 `backfillFullThreadDetail()` 的 merge /
  composer-render / thread-list-render 计时改为走 timed executor。
- `loadThread()` 的 composer-render、thread-list-render 和 cached-current
  thread-list-render 也改为走 timed executor。
- `loadThread()` first-paint 的 merge 计时保持原语义：merge group 执行后仍包含
  first-paint pre-render effect 的耗时，因此没有强行改成 timed executor。
- `test/conversation-render.test.js` 和 `test/mobile-viewport.test.js` 覆盖新的
  executor 以及各调用路径。
- 不改变 post-merge effect 顺序、thread merge、composer render、thread-list
  render、first-paint pre-render 插入点、server projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --check public/app.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/composer-draft.test.js
node --test test/composer-draft.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js test/thread-detail-render-plan.test.js
```

结果：focused `213` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Refresh Patch Outcome Mirror Cleanup Slice

本地小切片继续收敛 `refreshCurrentThread()` 的状态所有权。此前 patch attempt、
patch attempt result 和 render outcome 已经由 `public/thread-detail-render-plan.js`
规划，但 `public/app.js` 仍保留 `locallyPatchedDetail` /
`tilePanePatchedDetail` 旧镜像变量，并在 patch attempt、patch result、render
outcome 三个阶段重复赋值。当前最终 reporting 已经读取 `patchAttemptResult` 和
`renderOutcome`，这些镜像变量只增加状态漂移风险。

本次修复：

- `public/app.js` 删除 `refreshCurrentThread()` 里的
  `locallyPatchedDetail` / `tilePanePatchedDetail` 局部镜像状态。
- `public/app.js` 将 `renderOutcome` 改为直接来自
  `outcomeExecutionStage.renderOutcome` 的 `const`，不再先建空变量再赋值。
- `test/conversation-render.test.js` 和 `test/mobile-viewport.test.js` 改为验证
  `refreshCurrentThread()` 不再维护这些旧镜像变量。
- 不改变 patch attempt、result planning、render outcome、metadata/full-render
  execution、diagnostic payload、server projection、scroll、任务卡协议或 shell/cache。

闭环验证：

```bash
node --check public/app.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js
node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js test/thread-detail-render-plan.test.js
```

结果：focused `209` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Patch Rejected Visible-Shape Evidence Slice

本地小切片继续收敛 `refreshCurrentThread()` 的 patch rejection evidence
ownership。此前 result stage 已经能判断 local patch rejection 是否需要
previous/current visible-shape evidence，但 `public/app.js` 仍直接在主 refresh
编排里判断 `needsPatchRejectedVisibleShapes`，并直接把
`visibleConversationShape(previousThread)` / `visibleConversationShape(state.currentThread)`
传回 result stage。这让 evidence 采集条件和完成后的 result-stage 重算继续散落在
app 主状态机里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchAttemptResultEvidenceStage()`，统一产出初始
  `patchAttemptResultStage` 和 visible-shape evidence effect plan。
- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchAttemptResultEvidenceCompletionStage()`，在 app
  执行真实 evidence 采集后，重新产出带 bounded visible-shape counts 的 result /
  diagnostic stage。
- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffects()`，只在 local
  patch rejected 且需要 evidence 时声明
  `collect-patch-rejected-visible-shapes` effect。
- `public/app.js` 保留真实 `visibleConversationShape()` 执行，但通过
  `applyThreadDetailRefreshPatchRejectedVisibleShapeEvidenceEffectsPlan()` 执行
  明确 effect；`refreshCurrentThread()` 不再直接判断
  `needsPatchRejectedVisibleShapes` 或直接传入 shape 采集调用。
- `test/thread-detail-render-plan.test.js` 覆盖 evidence stage 和 completion stage；
  `test/conversation-render.test.js`、`test/mobile-viewport.test.js`、
  `test/thread-tile-layout-ui.test.js` 验证 app wiring 不再直接采集 rejected
  visible shapes。
- 不改变 DOM patch、render outcome、diagnostic payload 字段、server projection、
  scroll、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-tile-layout-ui.test.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
```

结果：focused `209` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Patch Surface Probe Stage Slice

本地小切片继续收敛 `refreshCurrentThread()` 的 patch surface ownership。此前
`planThreadDetailRefreshPatchSurface()` 和
`planThreadDetailRefreshPatchSurfaceProbeEffects()` 已经分别负责 surface 分类和
DOM probe effect，但 `public/app.js` 仍直接串联“探测前 surface plan -> probe
effects -> 真实 DOM probe -> 探测结果 surface plan”。这让 tile pane / single
thread surface 的两阶段判定继续留在主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchSurfaceProbeStage()`，统一产出探测前 surface plan
  和 DOM probe effects。
- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchSurfaceResultStage()`，用真实 DOM probe 返回的
  `tilePatchPlan.surface` 产出最终 patch surface plan。
- `public/app.js` 仍执行真实 `threadDetailDomPatchSurface()` 探测，但不再直接调用
  底层 surface/probe helper，也去掉了未使用的 `patchExecutionPlan` 中间变量。
- `test/thread-detail-render-plan.test.js` 覆盖 probe/result stage 输出形状；
  `test/mobile-viewport.test.js` 和 `test/thread-tile-layout-ui.test.js` 验证
  `refreshCurrentThread()` 只调用 stage helper；`test/conversation-render.test.js`
  验证 patch execution stage 消费最终 surface stage。
- 不改变 tile-pane 探测、single-thread patch、metadata-only 行为、DOM patch、
  full render、server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-tile-layout-ui.test.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
```

结果：focused `208` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Refresh Reporting Stage Slice

本地小切片继续收敛 `refreshCurrentThread()` 的 refresh 完成后 reporting /
completion 编排。此前 performance input、telemetry effects 和 completion effects
已经分别由 `public/thread-detail-render-plan.js` 的纯 helper 负责，但
`public/app.js` 仍直接串联 performance input、`threadPerformanceMetrics`、
telemetry effects、diagnostic success、Usage backfill 和 live poll completion。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshReportingStage()`，统一产出 refresh performance input、
  telemetry config 和 completion config。
- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshReportingEffectsStage()`，在
  `threadPerformanceMetrics.threadDetailRefreshEventFields()` 生成 bounded
  performance event 之后，统一产出 telemetry effects 和 completion effects。
- `public/app.js` 的 `refreshCurrentThread()` 保留跨模块 performance event 计算和
  真实 side effects 执行，不再直接调用底层 performance-input / telemetry /
  completion helper。
- `test/thread-detail-render-plan.test.js` 覆盖两个 reporting stage 的输出形状；
  `test/conversation-render.test.js` 和 `test/mobile-viewport.test.js` 验证
  `refreshCurrentThread()` 只调用 stage helper。
- 不改变 refresh timing 字段、`thread_refresh_ms` 上报、Home AI response
  diagnostics、diagnostic success clear、Usage backfill、live poll、server
  projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-tile-layout-ui.test.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
```

结果：focused `206` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A Refresh Outcome Execution Stage Slice

本地小切片继续收敛 `refreshCurrentThread()` 的 outcome/execution/consistency
所有权。此前 render outcome、execution action/effects 和 projection consistency
effect 已经分别由 `public/thread-detail-render-plan.js` 的纯 helper 负责，但
`public/app.js` 仍把这些 helper 串在一起，直接维护
`finalizeThreadDetailRenderPlan()` -> `planThreadDetailRefreshOutcomeExecution()` ->
`planThreadDetailRefreshExecutionEffects()` ->
`planThreadDetailRefreshConsistencyCheckEffects()` 的固定组合关系。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshOutcomeExecutionStage()`，统一从 `renderPlan` +
  `patchAttemptResult` 组合出 `renderOutcome`、`executionPlan`、
  `executionEffectsPlan` 和 `consistencyCheckEffectsPlan`。
- `public/app.js` 的 `refreshCurrentThread()` 只调用 stage helper，然后执行真实
  metadata/full-render/consistency side effects；不再手动串联这些 outcome helper。
- `test/thread-detail-render-plan.test.js` 覆盖 stage helper 的 patch/full-render
  输出形状。
- `test/conversation-render.test.js` 和 `test/mobile-viewport.test.js` 验证
  `refreshCurrentThread()` 不再直接调用底层 outcome/execution/consistency helper。
- 不改变 refresh API、DOM patch、full render、metadata update、consistency check、
  server projection、任务卡协议、诊断协议、shell/cache 或部署状态。

闭环验证：

```bash
node --check public/thread-detail-render-plan.js && node --check public/app.js && node --check test/thread-detail-render-plan.test.js && node --check test/conversation-render.test.js && node --check test/mobile-viewport.test.js && node --check test/thread-tile-layout-ui.test.js
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
```

结果：focused `204` passed。该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-27 Phase A/B Detail Post-Merge, Post-Render, And Telemetry Plan Reuse Slice

本地小切片继续收敛 thread detail 状态所有权。v506 已经让普通
`refreshCurrentThread()` 的 post-merge 三段副作用复用
`planThreadDetailRefreshPostMergeEffects()`，但 cached-current 快速复用、首屏成功
路径 `loadThread()` 和 full backfill 路径 `backfillFullThreadDetail()` 仍在
`public/app.js` 中手写
`mergeThreadIntoThreadList()`、`renderComposerSettings()`、
`syncActiveTurnFromThread()` 和 `renderThreads()` 的顺序。这样普通 refresh 和
cached-current/首屏/full-backfill 会继续保留多套 post-merge 编排，增加后续
“刷新后重复/少消息/状态不同步”的回归面。

本次修复：

- `loadThread()` 首屏 API 成功后保留原有 detail-loaded 标记、render evidence、
  pending server request sync、`mergeThreadPreservingVisibleItems()`、localStorage、
  draft restore、follow-to-bottom 和 EventSource 连接顺序。
- `loadThread()` cached-current 快速复用路径保留原有 follow-to-bottom、
  conversation render、auto-backfill、tile-pane Composer 条件刷新、menu close、
  projection consistency 和 first-paint telemetry；thread-list merge 与
  thread-list render 改为复用同一 post-merge plan。
- `loadThread()` cached-current 快速复用路径的 telemetry/reporting 固定副作用现在通过
  `planThreadDetailCachedCurrentTelemetryEffects()` 声明顺序，包括
  `thread_detail_first_paint` performance event、`thread_switch_cached` client
  event 和 load-success Home AI diagnostic clear；保持旧语义，不额外加入 API
  first-paint 才有的 response diagnostics。
- `loadThread()` 首屏 API 成功后的 post-render 固定副作用现在通过
  `planThreadDetailFirstPaintPostRenderEffects()` 声明顺序，包括 plugin
  navigation、connection restore、live poll、Composer controls、conditional menu
  close、conditional full detail backfill 和 Usage backfill；`public/app.js`
  仍按运行时状态执行真实 side effects。
- `loadThread()` 首屏 API 成功后的 telemetry/reporting 固定副作用现在通过
  `planThreadDetailFirstPaintTelemetryEffects()` 声明顺序，包括
  `thread_detail_first_paint` performance event、thread-detail response
  diagnostics、`thread_switch_complete` client event 和 load-success Home AI
  diagnostic clear；`public/app.js` 仍只执行真实上报 side effects。
- `backfillFullThreadDetail()` 保留原有 detail-loaded 标记、render evidence、
  pending server request sync 和 `mergeThreadPreservingVisibleItems()` 顺序。
- 合并后的 thread-list merge、Composer/active-turn sync、thread-list render 改为
  复用 `threadDetailRenderPlanApi.planThreadDetailRefreshPostMergeEffects()`。
- `mergeMs`、`composerRenderMs`、`threadListRenderMs` 的 timing 边界保持原语义。
- focused tests 验证 refresh、cached-current、first-paint 和 full-backfill 都走同一套
  post-merge plan，first-paint post-render/telemetry 与 cached-current telemetry
  各走独立 plan，并且 cached-current/首屏/full-backfill 不再内联旧的
  post-merge/post-render/telemetry 顺序。
- 不改变 thread detail API、full-backfill 读策略、server projection、DOM patch、
  scroll、Home AI 诊断协议、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-render-plan.test.js test/thread-detail-refresh-dom-harness.test.js
node --check public/thread-detail-render-plan.js && node --check public/app.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A/B
本地/private commit 累积。

## 2026-06-27 Phase A Full-Backfill Post-Render And Telemetry Planning Slice

本地小切片继续收敛 `backfillFullThreadDetail()` 的 side-effect ownership。此前
full-backfill 已经复用 post-merge plan，但它在 conversation render 之后仍直接内联
Usage backfill、live poll、Composer controls，以及
`thread_detail_full_ready` performance event 和 response diagnostics 上报。这让
first-paint 与 full-backfill 的后置副作用边界不一致。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFullBackfillPostRenderEffects()`，声明 full-backfill render
  后固定顺序：Usage backfill、live poll、Composer controls。
- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFullBackfillTelemetryEffects()`，声明
  `thread_detail_full_ready` performance event 和
  `thread-detail-full-backfill` response diagnostics。
- `public/app.js` 的 `backfillFullThreadDetail()` 保留原有 API、merge、render、
  timing 和 `threadPerformanceMetrics.threadDetailFullReadyEventFields()` 语义，
  只把后置 side-effect 顺序交给 plan 和通用 post-render executor。
- focused tests 覆盖 full-backfill post-render/telemetry plan，并防止
  `backfillFullThreadDetail()` 重新内联 `scheduleUsageBackfillRefresh()` /
  `scheduleLivePollIfNeeded()` / `updateComposerControls()` 或直接调用
  `postPerformanceEvent("thread_detail_full_ready")`。
- 不改变 full-backfill read strategy、server projection、DOM patch、scroll、
  Home AI diagnostic intake、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-performance-metrics.test.js test/turn-scroll-controls.test.js
node --check public/thread-detail-render-plan.js && node --check public/app.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A History Auto-Backfill Effects Planning Slice

本地小切片继续收敛 history auto-backfill 的 side-effect ownership。此前
`maybeAutoBackfillThreadHistory()` 已经通过纯 helper 判断 workflow-dominated /
recent-window 是否需要向上补历史，但它仍在 `public/app.js` 中直接记录
auto-backfill key、组装 `thread_history_auto_backfill` client event payload，并调度
`loadOlderThreadTurns()`。这让“何时补历史”和“补历史后固定副作用顺序”分散在两处。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailHistoryAutoBackfillEffects()`，声明 auto-backfill 后的固定
  effect 顺序：记录 signature key、发送 bounded client event、调度 older-turns
  load。
- `public/app.js` 新增 executor，只负责执行真实 state/timer/network side effect；
  事件名、payload 字段和调度 source 不再由 `maybeAutoBackfillThreadHistory()`
  内联拥有。
- `test/thread-detail-render-plan.test.js` 覆盖 event payload、effect 顺序、
  source 截断和非加载路径。
- `test/mobile-viewport.test.js` 覆盖 app wiring，防止 `app.js` 重新内联事件名或
  固定调度调用。
- focused tests 已验证 `thread-detail-render-plan`、mobile viewport、
  conversation render 和 scroll controls 相关路径。

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A Cached-Current Post-Render Planning Slice

本地小切片继续收敛 `loadThread()` 的 cached-current 快速复用路径。此前
cached-current 已经复用 post-merge plan 和 telemetry plan，但在
`renderCurrentThread({ stickToBottom: true })` 之后仍内联 auto-backfill、
tile pane Composer restore、菜单关闭、projection consistency、empty-cache healthy
clear 和 side-chat silent load。这让 cached-current 与 first-paint/full-backfill
的 post-render ownership 边界不一致。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailCachedCurrentPostRenderEffects()`，声明 cached-current render
  后固定 effect 顺序。
- `public/app.js` 复用 `applyThreadDetailPostRenderEffectsPlan()` 执行这些 effect；
  app 仍负责真实 state、timer、DOM、network side effect。
- `test/thread-detail-render-plan.test.js` 覆盖 effect 顺序、source 截断、
  tile-pane restore 条件和 side-chat 已存在时的跳过行为。
- `test/mobile-viewport.test.js` 与 `test/conversation-render.test.js` 覆盖 app
  wiring，防止 `loadThread()` 重新内联 cached-current post-render 副作用。

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A First-Paint After-Render Planning Slice

本地小切片继续收敛 `loadThread()` 的 API first-paint 路径。此前
first-paint 在 `renderCurrentThread({ stickToBottom: true })` 之后仍直接调用
`maybeAutoBackfillThreadHistory(state.currentThread, { seq, source: "first-paint" })`。
cached-current 的同类 auto-backfill 已经进入 post-render effect plan，因此
first-paint 留下这条内联调用会继续让线程打开后的历史补齐边界不一致。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFirstPaintAfterRenderEffects()`，声明 first-paint render 之后、
  post-render timing 开始之前的 history auto-backfill effect。
- `public/app.js` 通过 `applyThreadDetailPostRenderEffectsPlan()` 执行该 effect；
  `postRenderStartedAt` 仍在 after-render effect 之后开始，保持原性能计时口径。
- `test/thread-detail-render-plan.test.js` 覆盖 effect 顺序、source 截断和非法
  seq 归零。
- `test/mobile-viewport.test.js` 覆盖 app wiring，防止 `loadThread()` 重新内联
  first-paint auto-backfill 调用。

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A First-Paint Post-Timing Planning Slice

本地小切片继续收敛 `loadThread()` 的 API first-paint 路径。此前
`postRenderMs` 计算完成后，`loadThread()` 仍直接调用
`checkConversationProjectionConsistency("first-paint", { renderMode: "first-paint" })`。
这条调用虽然必须保留在 `postRenderMs` 之后，但不应继续由 `loadThread()` 直接拥有
固定 effect 选择。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFirstPaintPostTimingEffects()`，声明 first-paint post-render
  timing 结束后的 projection consistency effect。
- `public/app.js` 通过 `applyThreadDetailPostRenderEffectsPlan()` 执行该 effect；
  `postRenderMs` 仍先计算，再执行 consistency 检查，保持原性能计时口径。
- `test/thread-detail-render-plan.test.js` 覆盖 effect 形状。
- `test/mobile-viewport.test.js` 覆盖 app wiring，防止 `loadThread()` 重新内联
  first-paint projection consistency 调用。

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A Loading-Shell Post-State Planning Slice

本地小切片继续收敛 `loadThread()` 的线程打开 loading shell 路径。此前
`planThreadOpenLoadingShell()` 已经负责从线程列表 summary 构造安全的 loading
shell，但 shell 写入 `state.currentThread` 之后，`loadThread()` 仍直接内联
follow-to-bottom、草稿恢复、Composer settings、active-turn sync、thread list
render、conversation render、plugin navigation、side-chat silent load、连接状态、
activity 和 watchdog 启动。这让“线程打开时先显示 loading shell”这条固定可见顺序
仍散落在 `public/app.js` 中。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailLoadingShellPostStateEffects()`，声明 loading shell 写入当前线程
  后的固定 effect 顺序。
- `public/app.js` 复用 `applyThreadDetailPostRenderEffectsPlan()` 执行这些 effect；
  app 仍只拥有真实 DOM/state/timer/network side effects。
- `test/thread-detail-render-plan.test.js` 覆盖 effect 顺序和 source 截断。
- `test/mobile-viewport.test.js` 与 `test/conversation-render.test.js` 覆盖 app wiring，
  防止 `loadThread()` 重新内联 loading-shell 后置副作用。
- 不改变 thread detail API、server projection、cached-current 策略、DOM patch、
  Home AI diagnostic intake、任务卡协议、shell/cache 或部署状态。

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A First-Paint Pre-Render Planning Slice

本地小切片继续收敛 `loadThread()` 的 API first-paint 成功路径。此前 detail API
返回并 merge 到 `state.currentThread` 后，`loadThread()` 仍直接内联当前线程 id
持久化、新线程 draft target 清空、follow-to-bottom、EventSource reconnect，以及
单独计时的 draft restore。这样 first-paint 前的本地状态准备和后续
post-render/telemetry plan 仍不在同一个可测试边界内。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFirstPaintPreRenderEffects()`，声明 first-paint render 前的固定
  本地状态准备 effect：persist current thread id、clear draft target、follow
  thread open，并在 app 提供 `hasEvents` 时声明 reconnect。
- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFirstPaintDraftRestoreEffects()`，把 draft restore 保持为单独
  timing target，`draftRestoreMs` 仍只覆盖草稿恢复本身。
- `public/app.js` 复用 shared effect executor 执行这些 effect；真实
  localStorage、draft store、EventSource、DOM/timer side effects 仍留在 app。
- focused tests 覆盖 plan 形状、app wiring、composer draft runtime restore，以及
  防止 `loadThread()` 重新内联旧的 localStorage/draft/follow/connect 串联。
- 不改变 thread detail API、server projection、cached-current 策略、DOM patch、
  Home AI diagnostic intake、任务卡协议、shell/cache 或部署状态。

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-26 Phase C Pane Count State Planning Slice

本地小切片开始推进 Phase C 的 pane-state 架构化。此前平铺模式的自动窗口数、
显式窗口数、生效窗口数、最小关闭数和最大新增数仍由 `public/app.js` 直接组合：
app 同时读取 layout capacity、候选线程、运行线程、当前线程和用户保存的 pane
count。这会让宽屏/平板/手动加窗/overflow split 的规则继续散落在 UI 编排层。

本次修复：

- `public/thread-tile-state.js` 新增 `paneCountStatePlan()`，统一把 layout
  capacity、default candidate ids、max candidate ids、running/current thread ids
  和 explicit pane count 归一化成 `autoPaneCount`、`effectivePaneCount`、
  `minPaneCount`、`maxPaneCount`。
- `public/app.js` 新增 `threadTilePaneCountState()`，只负责收集真实线程列表、
  current thread、running status 和 layout facts，然后读取 helper plan；
  `autoThreadTilePaneCount()`、`effectiveThreadTilePaneCount()`、
  `threadTileMinimumPaneCount()`、`threadTileMaximumPaneCount()` 不再内联策略。
- focused tests 覆盖自动模式根据 current/running thread 扩大窗口数、显式
  pane count 可以超过推荐 capacity 但受候选线程和用户上限约束、空候选回到
  单窗口，以及 app wiring 不再要求旧的内联判断。
- 不改变 DOM、网络、timer、server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js test/thread-tile-actions.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积。

## 2026-06-26 Phase C Composer Target Planning Slice

本地小切片继续推进 Phase C 的 pane-state ownership。此前平铺模式下共享
Composer 到底发送给哪个线程、什么时候显示 `发送到：线程名` placeholder、以及
单窗口/新线程如何回到默认 placeholder，都由 `public/app.js` 直接组合
`newThreadDraft`、tile mode、当前 DOM 是否真在平铺、active pane ids、selected
pane 和 current thread。这会让“误发到错误窗口”的关键规则继续散落在 UI 编排层。

本次修复：

- `public/thread-tile-state.js` 新增 `composerTargetPlan()`，统一规划共享
  Composer 的 target thread、tile context、新线程模式和 selected/current fallback。
- `public/thread-tile-state.js` 新增 `composerTargetPlaceholderPlan()`，统一规划
  新线程 placeholder、平铺目标提示和默认 `Message Codex` 文案。
- `public/app.js` 仍负责读取真实 DOM 是否处于 `.thread-tile-mode`、查找目标线程
  标题和执行真实 Composer 控件更新；但 target/placeholder 策略不再内联。
- focused tests 覆盖新线程、平铺 selected pane、非平铺 current thread fallback、
  非平铺 surface、目标线程存在/缺失 placeholder，以及 app wiring。
- 不改变 DOM 结构、发送协议、草稿存储、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/composer-draft.test.js test/conversation-render.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积，后续与 pane-local draft/runtime 或 command-detail ownership
一起批量部署。

## 2026-06-26 Phase C Composer Runtime Restore Planning Slice

本地小切片继续推进 Phase C 的 pane-state ownership。上一片已经把共享 Composer
发送目标和 placeholder 规划迁到 `public/thread-tile-state.js`；本片继续处理
目标切换后的运行时选择恢复。此前 `applyDraftRuntimeSelection()` 在
`public/app.js` 中直接判断新线程/旧线程、草稿存在与否、Fast、Model、Reasoning
和 Permission 的默认/恢复/重置规则。这正是平铺模式里“点击哪个 pane，运行
设置就跟哪个线程走”的状态边界，不应该继续留在 UI 编排层。

本次修复：

- `public/thread-tile-state.js` 新增 `composerDraftRuntimeSelectionPlan()`，
  统一规划新线程草稿默认值、旧线程草稿恢复、无草稿保持或重置 runtime、Fast
  状态、model/effort/permission 选项校验。
- `public/app.js` 的 `applyDraftRuntimeSelection()` 改为只收集当前选项、默认值和
  已归一化 permission，然后执行 helper 输出的 state 写入。
- focused tests 覆盖新线程草稿、无效值回退默认、新线程缺省 permission、旧线程
  草稿恢复、无草稿保持 runtime、切换 pane 时无草稿重置 runtime，以及 app wiring。
- 不改变 draft 存储格式、附件恢复、发送协议、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/composer-draft.test.js test/conversation-render.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积，后续与 pane-local command detail、split sizing 或视觉验证一起批量部署。

## 2026-06-27 Phase C Operation Minimum Refresh Planning Slice

本地小切片继续推进 Phase C 的 pane-local operation ownership。此前平铺窗口里的
operation bubble 为了保证 500ms 最短可见时间，会在到期后由
`scheduleThreadTileOperationMinimumRefresh()` 直接遍历 active pane 并决定是否
fallback 到整页 render。这个判断属于 pane-local operation 状态机，不应该继续
由 `public/app.js` 内联；否则短命令气泡、展开详情和 pane patch 的刷新边界容易
再次和全局 render 纠缠。

本次修复：

- `public/thread-tile-state.js` 新增 `operationMinimumRefreshPlan()`，统一规划
  disabled、无 active pane、patch active panes 和 patch miss 后是否允许 full render。
- `public/app.js` 的 operation 最短可见刷新定时器改为读取 helper plan；app 仍只负责
  真实 timer、pane patch 和必要的 full-render side effect。
- focused tests 覆盖 disabled/no-active/active panes 的纯策略，以及 app wiring 不再
  直接决定 active pane patch 列表。
- 不改变 DOM 结构、operation HTML、bubble dwell 时长、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js test/live-operation-dock-state.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积，后续与 command detail、split sizing 或浏览器视觉验证一起批量部署。

## 2026-06-27 Phase C Pane Display Layout Planning Slice

本地小切片继续推进 Phase C 的 pane-state ownership。此前平铺模式的
`threadTileDisplayLayout()` 仍在 `public/app.js` 内联决定 visible panes、
layout capacity、实际列数、行数和 `columnGroups`。这些规则直接影响“5 个窗口
在 4 列容量下是否整体换行，还是只让一个目标列上下分屏”的体验，属于平铺窗口
状态策略，不应继续留在 DOM 渲染编排层。

本次修复：

- `public/thread-tile-state.js` 新增 `layoutCapacity()` 和
  `paneDisplayLayoutPlan()`，统一规划 layout capacity、visible panes、
  capacity columns、实际 columns、rows 和 column groups。
- `public/app.js` 的 `threadTileLayoutCapacity()` 和 `threadTileDisplayLayout()`
  改为只收集当前 layout、candidate ids、effective pane count 和 split pairs，
  然后读取 helper 输出的 display layout。
- focused tests 覆盖 5 个 pane 在 4 列容量下生成 4 个 column group，最后一列
  变成上下分屏；也覆盖显式 split pair 保持在指定列，不移动无关 pane。
- 不改变 CSS、DOM 结构、server-saved display settings、detail load 并发、
  server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout.test.js test/thread-tile-layout-ui.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积，后续与 split sizing、pane visual smoke 或任务卡 runtime hardening
一起批量部署。

## 2026-06-27 Phase C Detail Load Concurrency Planning Slice

本地小切片继续推进 Phase C 的 pane-state ownership。此前平铺模式可以显示超过
4 个 pane，但 `public/app.js` 仍硬编码 `THREAD_TILE_DETAIL_LOAD_MAX_CONCURRENT`
来限制同时进行的 pane detail reads。这个上限是多窗口正式架构和大 session
冷路径之间的保护边界：宽屏可以显示更多窗口，但不应该让每个窗口同时触发大
session detail read。

本次修复：

- `public/thread-tile-state.js` 新增 `DEFAULT_DETAIL_LOAD_MAX_CONCURRENT` 和
  `detailLoadConcurrencyPlan()`，统一规划 active pane 数量、用户 pane 上限、
  配置上限和最终 `maxConcurrentLoads`。
- `public/app.js` 的 `ensureThreadTileDetails()` 改为读取 helper 输出的
  `maxConcurrentLoads`，不再内联 `Math.min(4, THREAD_TILE_USER_MAX_PANES)`。
- focused tests 覆盖 6 个 active pane 仍只并发 4 个 detail read、2 个 active
  pane 只开 2 个、用户上限收窄时跟随上限、非法配置回到默认 4，以及 app wiring。
- 不改变当前实际并发 cap、detail API、projection/read mode、DOM、CSS、
  server-saved display settings、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；后续如果要真正
调整并发数，需要结合 Phase B/Phase E 的生产读回和浏览器/视觉 evidence，而不是
在 app 层硬调参数。

## 2026-06-27 Phase C Pane Render Signature Planning Slice

本地小切片继续推进 Phase C，并把平铺模式的 render signature schema 从
`public/app.js` 迁到 `public/thread-tile-state.js`。此前
`threadTileRenderSignature()` 在 app 层直接拼出 tile board 的 JSON 签名，
包括 columns/rows、visible/capacity panes、desired pane count、columnGroups、
splitPairs、selected pane、loading/error/operation 状态和每个 pane 的
conversation signature。这个签名决定 tile board 是否复用、patch 还是整板重绘，
是投影/渲染一致性的关键证据，不应继续由 DOM 编排层内联维护。

本次修复：

- `public/thread-tile-state.js` 新增 `paneRenderSignaturePlan()`，统一规划
  tile board render signature object 和 JSON 字符串。
- helper 会按当前 pane ids 过滤 stale loading/error/operation signature，
  避免已经不在可见 pane 的状态污染当前 board 签名。
- `public/app.js` 的 `threadTileRenderSignature()` 现在只收集真实 app facts：
  desired pane count、split pairs、selected pane、loading ids、errors、
  operation signatures、thread conversation signatures，然后交给 helper。
- focused tests 覆盖签名 schema、stale pane 状态过滤、显式 `desiredPaneCount=0`
  不被 fallback 覆盖，以及 app wiring。
- 不改变 DOM、CSS、thread detail read、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积。

## 2026-06-27 Phase C Pane Render Frame Planning Slice

本地小切片继续推进 Phase C，把平铺窗口局部 render frame 的调度策略从
`public/app.js` 迁到 `public/thread-tile-state.js`。此前
`scheduleRenderThreadTilePane()` 直接在 app 层判断缺失 id、tile mode、pane
可见性、是否已有待执行 frame，以及 patch 失败后是否触发整板 render。这条路径
正好处在“局部 pane patch”和“整板 full render”的交界处，错误时容易造成重复排帧、
整屏闪动或 patch 失败后不可解释地刷新整板。

本次修复：

- `public/thread-tile-state.js` 新增 `paneRenderFramePlan()`，统一规划
  missing-id、disabled、pane-not-visible、already-scheduled 和
  schedule-pane-render 分支。
- `public/app.js` 的 `scheduleRenderThreadTilePane()` 现在只执行
  requestAnimationFrame / setTimeout、实际 pane patch，以及 helper 明确允许时的
  full-render-on-patch-miss side effect。
- focused tests 覆盖不重复排帧、不可见 pane 不排帧、已排帧返回成功但不重复安排、
  以及 patch miss 是否允许整板 render。
- 不改变 DOM 结构、CSS、thread detail read、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积。

## 2026-06-27 Phase C Pane Patch Preflight Planning Slice

本地小切片继续推进 Phase C，把平铺窗口局部 DOM patch 的 preflight 判断从
`public/app.js` 迁到 `public/thread-tile-state.js`。此前 `patchThreadTilePane()`
直接在 app 层串联判断：缺失 pane id、tile mode 关闭、pane 不可见、conversation
不是 tile surface、tile board 缺失、layout disabled、候选 ids 不包含当前 pane、
目标 pane DOM 缺失。任一分支失败都会让上层更容易退到整板 render，所以这条路径
是解释平铺跳动、局部刷新失败和整板重绘的关键证据边界。

本次修复：

- `public/thread-tile-state.js` 新增 `panePatchPreflightPlan()`，统一规划
  missing-id、disabled、pane-not-visible、missing-conversation、not-tile-surface、
  missing-board、layout-disabled、pane-not-candidate、missing-pane 和 ready 分支。
- helper 支持分阶段 preflight：app 层仍按原顺序短路，先确认基础状态，再查 DOM、
  layout、candidate ids 和 pane element，避免引入额外 layout/DOM 副作用。
- `public/app.js` 的 `patchThreadTilePane()` 现在只收集真实 DOM/layout facts 并执行
  patch、hydrate、scroll restore、signature writeback 和 action binding。
- focused tests 覆盖 preflight 分支和 app wiring。
- 不改变 DOM 结构、CSS、thread detail read、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积。

## 2026-06-27 Phase C Pane Patch Completion Planning Slice

本地小切片继续推进 Phase C，把平铺窗口局部 DOM patch 成功后的 completion side
effect 顺序从 `public/app.js` 迁到 `public/thread-tile-state.js`。上一片已经把
`patchThreadTilePane()` 的 preflight failure reason 变成可测试策略；本片继续处理
source pane 缺失、patch 后 pane 缺失、hydrate、scroll restore、bottom button
更新、render signature 写回、patch shell signature 清理和 action 绑定这些后置步骤。

本次修复：

- `public/thread-tile-state.js` 新增 `panePatchCompletionPlan()`，统一规划
  missing-id、missing-source-pane、source-pane-ready、missing-patched-pane 和
  complete-pane-patch 分支。
- helper 明确输出 hydrate、restoreScroll、updateBottomButton、writeRenderSignature、
  clearPatchShellSignature、bindActions 和 bottom-button 更新模式。
- `public/app.js` 的 `patchThreadTilePane()` 现在只按 helper 的计划执行真实 DOM
  side effects；`patchNode`、hydrate、scroll restore 和 action binding 仍然留在 app 层。
- focused tests 覆盖 completion 分支和 app wiring。
- 不改变 DOM 结构、CSS、thread detail read、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/conversation-render.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积。

## 2026-06-27 Phase A Thread Open Loading Shell Ownership Slice

本地小切片回到 Phase A/B 的投影/渲染状态所有权问题，针对近期反复出现的
“打开线程只看到空白/一条卡片/中间断档”风险。根因边界不是让客户端隐藏空白，
而是保证线程列表 summary 永远不能冒充 thread detail conversation。

此前 `loadThread()` 在 `public/app.js` 里直接用列表 summary 拼出当前线程的
loading shell。虽然已有 `threadListSummaryFromDetailThread()` 会剥掉部分 detail-only
字段，但这个关键状态所有权仍散落在 app 编排层，后续很容易再次把 stale `turns`、
`threadTaskCards`、`runtimeSettings` 或诊断字段带回当前 detail shell。

本次修复：

- `public/thread-detail-state.js` 新增 `planThreadOpenLoadingShell()`，统一生成打开线程时的
  loading shell。
- helper 只接受 id 匹配的 summary，并且只保留 summary-safe 字段；输出固定的
  `turns: []`、`mobileLoading: true`、`mobileLoadError: ""`。
- id 不匹配或没有 summary 时 fail-closed 到 bounded fallback shell，不复用错误 summary。
- `public/app.js` 的 `loadThread()` 改为调用该 helper，不再内联拼接 summary/loading detail。
- `test/thread-detail-state.test.js` 增加 helper 行为测试，证明 stale `turns`、
  `threadTaskCards`、`runtimeSettings`、`mobileDiagnostics`、`mobileDetailLoaded`、
  `mobileReadMode` 不会进入 loading shell。
- `test/conversation-render.test.js` 更新 app wiring，防止未来把内联 summary 拼接逻辑加回来。
- 不改变 API、server projection、DOM 结构、CSS、task-card 协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-detail-state.test.js test/conversation-render.test.js test/thread-detail-render-plan.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；它是 Phase A 的
本地/private commit 候选，后续应继续拆 current-thread render/patch authority 和
projection mismatch 诊断。

## 2026-06-27 Phase A Projection Consistency Effects Planning Slice

本地小切片继续推进 Phase A 的投影/渲染诊断所有权收敛。此前
`conversationProjectionDiagnosticSnapshot()` 已经把 tile/single/transition
snapshot 规划迁到 `public/thread-diagnostic-events.js`，但
`checkConversationProjectionConsistency()` 仍在 `public/app.js` 里直接判断
render signature mismatch、duplicate render keys 和 turn-order mismatch，并直接
拼接失败/成功诊断事件。这让 app 编排层继续拥有“诊断结果判定”。

本次修复：

- `public/thread-diagnostic-events.js` 新增
  `conversationProjectionConsistencyEffects()`，统一把 projection snapshot 和
  turn-order snapshot 规划成 bounded diagnostic failure/success effects。
- `public/app.js` 保留真实状态读取和 `recordHomeAiDiagnosticFailure()` /
  `recordHomeAiDiagnosticSuccess()` side effect，但不再内联 mismatch/duplicate/order
  判定分支。
- `test/thread-diagnostic-events.test.js` 覆盖纯 helper 的失败、成功、无 snapshot
  和隐私边界。
- `test/conversation-render.test.js` 防止 app 重新调用低层 mismatch helper 或直接
  构造诊断 payload。
- `test/mobile-viewport.test.js` 同步 turn-order 诊断 wiring 断言，避免旧的内联
  `hasTurnOrderMismatch()` 期望把边界拉回 app 层。
- 不改变诊断阈值、Home AI 上报协议、DOM 渲染、server projection、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js
node --check public/thread-diagnostic-events.js && node --check public/app.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积，后续再与更大的 render/projection ownership 模块一起
统一验证和部署。

## 2026-06-27 Phase A/B Thread Detail Response Diagnostic Effects Slice

本地小切片继续推进 Phase A/B 的诊断 outcome ownership。此前
`recordThreadDetailResponseDiagnostics()` 已经使用
`threadPerformanceMetrics.planThreadDetailSlowPathDiagnostic()` 和
`planThreadDetailResponseContractDiagnostic()` 产出事实计划，但 `public/app.js` 仍直接
判断 `slowPlan.shouldReport` / `contractPlan.shouldReport`，并直接选择 failure 或
success payload。这让详情慢路径、active window downgrade、empty projection shell
等大 session 关键诊断的结果判定继续留在 app 编排层。

本次修复：

- `public/thread-diagnostic-events.js` 新增
  `threadDetailResponseDiagnosticEffects()`，统一把 slow-path plan 和
  response-contract plan 转成 bounded diagnostic failure/success effects。
- `public/app.js` 的 `recordThreadDetailResponseDiagnostics()` 继续收集真实
  performance event、thread hash、duration bucket 和 contract 输入，但只执行 helper
  输出的 Home AI diagnostic side effects。
- `test/thread-diagnostic-events.test.js` 覆盖 slow failure、contract success、
  全健康路径、无计划路径和隐私边界。
- `test/conversation-render.test.js`、`test/mobile-viewport.test.js` 防止 app 重新
  内联 `shouldReport` 分支或直接调用 response diagnostic payload builder。
- 不改变慢路径阈值、response contract 判定、Home AI 上报协议、DOM 渲染、
  server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-performance-metrics.test.js
node --check public/thread-diagnostic-events.js && node --check public/app.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A/B
本地/private commit 累积。

## 2026-06-27 Phase A Thread Detail Switch Client Event Planning Slice

本地小切片继续收敛 `loadThread()` 的事件 ownership。此前首屏 telemetry、
cached-current telemetry 和 load-failure diagnostic payload 已经从 `public/app.js`
拆出，但 `thread_switch_start`、`thread_switch_cancelled`、`thread_switch_error`
client event payload 仍由 `loadThread()` 直接拼接。这让线程切换开始、取消、
错误和首屏成功的事件字段归属不一致。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailSwitchStartClientEvent()`、
  `planThreadDetailSwitchCancelledClientEvent()` 和
  `planThreadDetailSwitchErrorClientEvent()`。
- `planThreadDetailSwitchStartClientEvent()` 保留旧语义：
  `listAgeMs` 缺失时仍为 `null`，已有数值则按 bounded duration 归一。
- `public/app.js` 新增 `applyThreadDetailSwitchClientEventPlan()`，只执行真实
  `postClientEvent()` side effect。
- `loadThread()` 的 start、API abort/stale cancel、API error、API response stale
  cancel 都改为通过 plan 生成 bounded client event payload。
- `test/thread-detail-render-plan.test.js` 覆盖 start/cancel/error event payload
  归一。
- `test/conversation-render.test.js`、`test/mobile-viewport.test.js` 防止
  `loadThread()` 重新内联 `thread_switch_start` / `thread_switch_cancelled` /
  `thread_switch_error`。
- 不改变 thread switch stall/watchdog、错误 UI、abort/cancel 判断、throw
  语义、Home AI diagnostic payload、projection/merge/render、任务卡协议、
  shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-diagnostic-events.test.js
node --check public/thread-detail-render-plan.js && node --check public/app.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A
本地/private commit 累积。

## 2026-06-27 Phase A Thread Detail Load Failure Diagnostic Payload Slice

本地小切片继续收敛 thread session diagnostic ownership。此前
`threadDetailRefreshFailedDiagnosticEvent()` 已经统一生成
`thread_detail_refresh_failed` payload，但 `loadThread()` 的 API 失败路径仍在
`public/app.js` 里直接拼 `thread_detail_load_failed` 的 category、context、counts
和 breadcrumbs。这让首屏线程加载失败诊断的 payload contract 继续散在 app 编排层。

本次修复：

- `public/thread-diagnostic-events.js` 新增
  `threadDetailLoadFailedDiagnosticEvent()`，统一生成 bounded
  `thread_detail_load_failed` failure payload。
- `public/app.js` 的 `loadThread()` catch 分支保留真实错误处理、UI 状态更新、
  `thread_switch_error` client event 和 throw 语义，但不再内联 Home AI diagnostic
  payload。
- `test/thread-diagnostic-events.test.js` 覆盖 load failure payload 和隐私边界。
- `test/conversation-render.test.js`、`test/mobile-viewport.test.js` 防止 app 重新
  内联 `thread_detail_load_failed` payload。
- 不改变 thread detail API、错误 UI、取消路径、重试路径、Home AI 上报协议、
  projection/merge/render、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-diagnostic-events.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-detail-render-plan.test.js
node --check public/thread-diagnostic-events.js && node --check public/app.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase A/B
本地/private commit 累积。

## 2026-06-27 Phase B Thread-List Baseline Work Attribution Slice

本地小切片继续推进 Phase B 的线程列表冷路径证据化。此前
`thread-list-cold-path-diagnosis-service` 已经能把 cold list 归因到
`state-db`、`rollout`、`session-index`、fallback cache policy、source snapshot
或 app-server，但当 source reader 不是明显主因时，readback 仍只会落到泛化的
`miss-rebuild:baseline`。这会让下一步无法区分慢在最终 cwd/search 过滤、重复
thread merge、还是 list limit 截断。

本次修复：

- `adapters/thread-list-cold-path-diagnosis-service.js` 的 baseline reason 在没有
  dominant source 时，会继续使用已有 bounded counters 归因为
  `final-filter-empty`、`final-filter`、`merge-dedupe` 或 `limit-drop`。
- 该变化只影响 `coldPathReason` 诊断/读回标签，不改变 thread-list 数据、排序、
  cache key、fallback source collection、merge/filter/limit 语义或 UI。
- `test/thread-list-cold-path-diagnosis-service.test.js` 覆盖 final filter、merge
  dedupe、limit drop，以及 dominant source 仍优先的行为。

闭环验证：

```bash
node --test test/thread-list-cold-path-diagnosis-service.test.js test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-visibility.test.js
node --check adapters/thread-list-cold-path-diagnosis-service.js
```

该切片尚未部署；它是 Phase B 诊断归因增强，等待下一次 Phase B 模块批量验证和部署。

## 2026-06-27 Phase B Readback Baseline Reason Routing Slice

本地小切片继续把上一段 cold-path 诊断接到 Phase B readback decision。上一片已经能
在 `coldPathReason` 中暴露 `final-filter-empty`、`final-filter`、`merge-dedupe`
和 `limit-drop`，但 readback decision 仍会把这些情况归到泛化的
`thread-list-fallback-baseline` / `optimize-thread-list-fallback-baseline`。这会让
部署读回之后无法直接判断下一步该修 filter、merge 还是 limit window。

本次修复：

- `adapters/phase-b-readback-decision-service.js` 新增 baseline reason routing：
  - `final-filter-empty` / `final-filter` -> `thread-list-final-filter`，
    `optimize-thread-list-final-filter`；
  - `merge-dedupe` -> `thread-list-fallback-merge`，
    `optimize-thread-list-fallback-merge`；
  - `limit-drop` -> `thread-list-limit-window`，
    `review-thread-list-limit-window`。
- warm-check 语义保持不变：如果 cold rebuild 后同 key warm check 已经命中，仍然只
  标记为 H3 observe，不把一次性冷启动成本误判成必须修复。
- deferred fallback follow-up 如果最终暴露的是 baseline 细分 reason，也会落到同一套
  具体 owner，而不是被 `thread-list-deferred-fallback` 泛化吞掉。
- 该变化只影响 Phase B readback 的 root-cause owner / nextAction，不改变
  thread-list fallback 数据、排序、filter、merge、limit、cache、server projection、
  前端渲染或 Home AI 诊断协议。

闭环验证：

```bash
node --test test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-list-cold-path-diagnosis-service.test.js
node --check adapters/phase-b-readback-decision-service.js
```

该切片尚未部署；继续作为 Phase B 模块批量验证前的本地/private commit。

## 2026-06-27 Phase B Readback Evidence Counter Slice

本地小切片继续收紧 Phase B readback evidence。上一片已经把
`final-filter`、`merge-dedupe`、`limit-drop` 路由到具体 owner / nextAction；这一片
让 `decision.evidence` 同步携带对应 bounded counters，避免后续读回只能看到原因标签，
但缺少证明该原因的计数。

本次修复：

- `adapters/phase-b-readback-decision-service.js` 新增统一 `boundedCount()`，把
  decision evidence 中的计数字段限制为 `0..100000`。
- `decision.evidence` 现在包含：
  - `threadListFinalFilterInputCount` / `threadListFinalFilterOutputCount`；
  - `threadListMergeInputCount` / `threadListMergeOutputCount` /
    `threadListMergeDuplicateCount`；
  - `threadListLimitDropCount`；
  - 对应的 `threadListAfterDeferred*` follow-up 计数。
- 该变化只增加 metadata-safe 数值 evidence，不改变 readback 请求、fallback list
  行为、server projection、UI、Home AI 上报协议或部署状态。

闭环验证：

```bash
node --test test/phase-b-readback-decision-service.test.js test/phase-b-readback-smoke.test.js test/thread-list-cold-path-diagnosis-service.test.js
node --check adapters/phase-b-readback-decision-service.js
```

该切片尚未部署；继续作为 Phase B 模块批量验证前的本地/private commit。

## 2026-06-27 Phase E Thread Tile Visual Fixture Slice

本地小切片开始补 Phase E 的浏览器/视觉回归入口，先覆盖最近反复出问题的平铺
多 pane 布局。此前平铺相关测试主要验证纯 helper 和 app wiring；它们能证明
5 个 pane 应该如何分组，但不能证明真实 CSS/DOM 下是否出现整板换行、pane
遮挡、底部按钮固定占行、operation bubble 时间被截断，或者 Composer 和 pane
互相覆盖。

本次修复：

- 新增 `scripts/codex-mobile-thread-tile-visual-fixture.js`，用现有
  `public/thread-tile-layout.js` 和 `public/thread-tile-state.js` 生成 bounded
  fixture，再加载真实 `public/styles.css` 通过 headless Chrome 截图和 DOM rect
  检查平铺布局。
- fixture 覆盖两类关键场景：3000px 宽屏 5 pane 应保持一行 5 列；overlay/
  tablet-landscape 容量受限时，5 pane 应只让一个目标列上下分屏，其他列保持满高。
- 检查项包括 pane/board/composer 边界、pane 不互相重叠、非 split 列满高、
  hidden bottom button 不占固定行、pane-local operation bubble 不越界、命令
  duration 文本不被截断。
- `test/thread-tile-layout-ui.test.js` 增加脚本模型/HTML/隐私边界覆盖，`npm run check`
  也检查新脚本语法。
- 不改变运行时 DOM、CSS、server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-layout-ui.test.js test/thread-tile-state.test.js test/thread-tile-layout.test.js
node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1500 --panes 5 --json
node scripts/codex-mobile-thread-tile-visual-fixture.js --width 3000 --height 1500 --panes 5 --menu-overlay --json
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；它是 Phase E
验证能力的本地/private commit，后续应继续补真实 embedded/PWA live-debug
场景，而不是用 fixture 替代生产读回。

## 2026-06-27 Phase E Thread Tile Composer Keyboard Fixture Slice

本地小切片继续补 Phase E 的平铺视觉证据，针对用户反馈过的 Composer 输入时
偶发整体下沉、全屏重绘、pane 区域跳动问题。此前已有 CSS 断言证明
`html.embed-hermes.thread-tile-open.keyboard-open .app` 应保持 `transform: none`，
但没有真实浏览器 fixture 去量化键盘/输入态下 board、pane、composer 的实际 rect。

本次修复：

- `scripts/codex-mobile-thread-tile-visual-fixture.js` 新增 `--keyboard` 和
  `--typed-lines <count>`，用 fake typed composer content 模拟输入框扩高。
- fixture 现在记录并验证 `.app` computed transform、message input rect、
  composer/input containment、typed input 稳定性，以及原有 pane/board/composer
  不重叠约束。
- `test/thread-tile-layout-ui.test.js` 增加参数解析、composer 高度计算、fake typed
  content、keyboard HTML 和隐私边界覆盖。
- 真实 Chrome fixture 已覆盖 `1800x920`、3 pane、keyboard-open、4 行输入内容，
  证明 `appTransform=none`、输入框留在 composer 内、composer 只压缩 conversation
  高度而不遮挡 pane。
- 不改变运行时 DOM、CSS、server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-layout-ui.test.js test/thread-tile-state.test.js test/thread-tile-layout.test.js
node scripts/codex-mobile-thread-tile-visual-fixture.js --width 1800 --height 920 --panes 3 --keyboard --typed-lines 4 --json
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；它继续作为 Phase E
验证能力的本地/private commit，后续应补长 turn streaming、任务卡展开折叠、
图片渲染和真实 Home AI embedded/PWA live-debug 覆盖。

## 2026-06-26 Phase C Pane Scroll Runtime Planning Slice

本地小切片继续推进 Phase C 的 pane-runtime ownership。此前每个平铺窗口的
滚动距离、near-bottom 判断、是否记住阅读位置、底部跳转按钮是否显示、patch 后
恢复距离还是沉底，都由 `public/app.js` 直接写阈值和条件。这些规则决定每个 pane
是否像一个独立的缩小单线程窗口，不应该继续散落在 DOM 编排层。

本次修复：

- `public/thread-tile-state.js` 新增 pane-local scroll plans：
  `paneScrollMetrics()`、`paneScrollHoldPlan()`、`paneBottomButtonPlan()`、
  `paneScrollRestorePlan()`。
- `public/app.js` 仍负责真实 DOM 读取、`scrollTop` 写入、按钮 class/ARIA 切换和
  `threadTilePaneScrollHoldById` Map 写入；但 near-bottom、hold、show/hide、
  restore-distance 的策略判断不再内联。
- focused tests 覆盖 48px near-bottom、96px scrollable button 阈值、hold clear/
  remember、stick-to-bottom 覆盖、恢复距离 top 计算，以及 app wiring 调用 helper。
- 不改变 DOM 结构、CSS、网络、server projection、任务卡协议、shell/cache 或部署状态。

闭环验证：

```bash
node --test test/thread-tile-state.test.js test/thread-tile-layout-ui.test.js test/thread-tile-actions.test.js test/thread-tile-layout.test.js test/turn-scroll-controls.test.js
```

该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为 Phase C
本地模块累积。

## 2026-06-26 Phase A Local Patch Completion Snapshot Slice

本地小切片继续推进 Phase A 的 thread-detail render/patch ownership 收敛。
此前 local DOM patch 完成路径已经把 commit effects 拆到
`public/thread-detail-dom-patch.js`，但 `completeLocalConversationDomUpdate()`
仍在 `public/app.js` 里直接归一化 tile-pane 完成、single-thread patch 可用性、
conversation signature、patch-shell signature 和 scroll action。这些是 completion
snapshot 规则，不应该由主 app 编排函数长期持有。

本次修复：

- `public/thread-detail-dom-patch.js` 新增
  `planLocalConversationDomUpdateCompletionSnapshot()`，统一归一化 tile-pane
  terminal 状态、single-thread completion 事实、签名字符串和 scroll action。
- `planLocalConversationDomUpdateCompletion()` 现在先消费 snapshot，再产出
  complete/blocked/tile-pane-complete/single-thread-complete 计划。
- `public/app.js` 的 `completeLocalConversationDomUpdate()` 改为只采集真实 DOM、
  scroll 和签名事实，然后交给 helper 归一化；app 仍只执行真实 hydrate、signature
  writeback、scroll scheduling side effect。
- focused tests 覆盖 tile-pane snapshot 不带入 single-thread 签名/scroll 状态、
  single-thread snapshot 归一化，以及 app wiring 使用 snapshot helper。
- 不改变服务端 projection、local patch eligibility、DOM mutation 顺序、scroll 行为、
  任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-dom-patch.test.js test/turn-scroll-controls.test.js test/conversation-scroll.test.js test/conversation-render.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

focused 组通过 172 个测试；全量 `npm test` 通过 1124 个测试。

尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Bottom-Follow Schedule Planning Slice

本地小切片继续推进 Phase A 的 scroll ownership 收敛。此前
`scheduleBottomFollowScroll()` 在 `public/app.js` 里直接硬编码
`[0, 80, 240, 600, 1200]` 的 bottom-follow 重试节奏，同时执行真实 timer
side effect。这个延迟策略属于 bottom-follow 行为约束，应该和其他 scroll
policy 一样由 `public/conversation-scroll.js` 统一声明。

本次修复：

- `public/conversation-scroll.js` 新增
  `planBottomFollowScrollSchedule()` 和
  `DEFAULT_BOTTOM_FOLLOW_DELAYS_MS`，统一产出 `clearExistingTimers`、
  `delaysMs` 和 bounded reason。
- `public/app.js` 的 `scheduleBottomFollowScroll()` 改为读取 schedule plan；
  app 仍只负责真实 `clearBottomFollowTimers()`、`setTimeout()`、timer 列表维护和
  `scheduleConversationToBottom()` side effect。
- focused tests 覆盖默认延迟序列、返回数组不可污染下一次 plan，以及 app wiring
  不再内联延迟表。
- 不改变 DOM、按钮位置、scroll 动作、projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `138` passed；full `npm test` `1122` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Bottom-Follow Lease Planning Slice

本地小切片继续推进 Phase A 的 scroll ownership 收敛。此前
`shouldFollowSubmittedMessageToBottom()` 和 `shouldFollowViewportChangeToBottom()`
各自在 `public/app.js` 里判断用户是否正在读当前 turn、是否应该清理
submitted-message / viewport follow lease、以及是否继续沉底。这是同一类
bottom-follow lease 评估，却分散在两个 app 函数里。

本次修复：

- `public/conversation-scroll.js` 新增
  `planBottomFollowLeaseEvaluation()`，根据 `userReadingCurrentTurn`、
  `leaseActive`、`hasLease` 统一产出 `shouldFollow`、`clearLease` 和 bounded
  reason。
- `public/app.js` 的 submitted-message follow 和 viewport follow 改为先采集
  当前 reading-hold 与 lease-active 事实，再调用同一个 helper，并只执行真实
  clear side effect。
- 保留原短路顺序：用户正在读当前 turn 时直接规划清理 lease，不再评估
  threadId/expiry；只有不在 reading hold 时才读取 lease 是否仍有效。
- focused tests 覆盖 reading-hold 清理、active lease 继续沉底、inactive lease
  清理、无 lease noop，并验证 app wiring 不再内联旧清理策略。
- 不改变 DOM、按钮位置、scroll 动作、projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `137` passed；full `npm test` `1121` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Auto-Scroll Hold Planning Slice

本地小切片继续推进 Phase A 的 scroll ownership 收敛。此前
`updateConversationAutoScrollHoldFromScroll()` 在 `public/app.js` 里直接决定
用户滚动后是否清理 auto-scroll hold、是否因为最近手动滚动且存在当前 turn
候选而记住 hold。这是“用户正在读当前输出”策略的相邻状态机；如果继续留在
app 主文件里，bottom-follow、当前回执跳转和长回执阅读 hold 容易继续分叉。

本次修复：

- `public/conversation-scroll.js` 新增
  `planConversationAutoScrollHoldFromScroll()`，根据 near-bottom、
  recent scroll intent、current-turn candidate 产出 `clear-hold`、
  `remember-hold` 或 `none`。
- `public/app.js` 的 `updateConversationAutoScrollHoldFromScroll()` 改为只采集
  当前 DOM/状态事实并执行真实 `clearConversationAutoScrollHold()` /
  `rememberConversationAutoScrollHold()` side effect。
- 保留原短路顺序：near-bottom 为真时直接规划 clear；不在底部时才检查最近
  滚动意图；只有最近滚动意图存在时才读取 current-turn candidate。
- focused tests 覆盖清理 hold、无最近滚动意图 noop、当前 turn 候选 remember、
  无当前 turn 候选 noop，并验证 app wiring 不再内联策略。
- 不改变 DOM、按钮位置、scroll 动作、projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `136` passed；full `npm test` `1120` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A User Reading Current Turn Planning Slice

本地小切片继续推进 Phase A 的 scroll ownership 收敛。此前
`isUserReadingCurrentTurn()` 直接在 `public/app.js` 里组合 near-bottom、
auto-scroll hold、最近手动滚动意图和当前 turn 候选判定。这个结果会影响
submitted-message follow、viewport follow、full-render stick-to-bottom 和
local patch scroll completion；如果判定继续散落在 app 主文件里，移动端长回执
容易复发“用户正在读当前输出却被拉到底部”或“应该沉底却被 hold 住”的问题。

本次修复：

- `public/conversation-scroll.js` 新增
  `planUserReadingCurrentTurn()`，用纯策略返回
  `userReadingCurrentTurn` 和 bounded reason。
- `public/app.js` 的 `isUserReadingCurrentTurn()` 改为只采集当前 DOM/状态事实：
  near-bottom、auto-scroll hold、recent scroll intent、current-turn candidate；
  最终判定交给 scroll helper。
- 保留原短路顺序：near-bottom 为真时不读取 hold/current-turn；hold 为真时不再
  读取 recent/current-turn，避免 helper 抽取引入额外滚动副作用。
- focused tests 覆盖 near-bottom、auto-scroll hold、无最近滚动意图、当前 turn
  候选和无候选分支，并验证 app wiring 调用 helper。
- 不改变 DOM、按钮位置、scroll 动作、projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/conversation-scroll.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/conversation-render.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `135` passed；full `npm test` `1119` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Conversation Jump Button Planning Slice

本地小切片继续推进 Phase A 的 scroll ownership 收敛。此前单线程对话区的
向下跳转按钮和当前回执跳转按钮互斥显示规则直接写在 `public/app.js` 的
`updateScrollToBottomButton()` 里，和 DOM 查询、class/tabIndex 更新混在一起。
这类逻辑曾多次因为移动端按钮位置和互斥状态出问题，应该由纯 scroll policy
helper 决定。

本次修复：

- `public/conversation-scroll.js` 新增
  `planConversationJumpButtons()`，根据线程可用性、加载状态、是否可滚动、
  是否在底部、回执目标是否存在且在视口上方，产出 `showBottom` /
  `showReply`。
- `public/app.js` 的 `updateScrollToBottomButton()` 改为调用该 helper；
  app 仍只负责真实 DOM 查询和按钮 class/aria/tabIndex 更新。
- focused tests 覆盖底部按钮和回执跳转按钮互斥、加载态隐藏、无回执目标隐藏，
  以及 app wiring 不再内联长条件串。
- 不改变按钮 DOM、位置、样式、scroll 行为、projection、任务卡协议或
  shell/cache。

闭环验证：

```bash
node --test test/conversation-scroll.test.js test/mobile-viewport.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `134` passed；full `npm test` `1118` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Refresh Completion Effects Executor Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
`planThreadDetailRefreshCompletionEffects()` 已经声明 refresh 成功后的
bounded diagnostic success、usage backfill refresh、live poll 调度 effects，
但 `public/app.js` 仍在 `refreshCurrentThread()` 里直接遍历
`completionPlan.effects`。这样 completion side-effect 执行顺序仍暴露在主刷新
编排体里。

本次修复：

- `public/app.js` 新增
  `applyThreadDetailRefreshCompletionEffectsPlan()`，统一执行 completion
  effect list。
- `refreshCurrentThread()` 不再直接遍历 `completionPlan.effects`，只调用
  completion effects executor。
- 不改变 completion effect 内容、Home AI diagnostic success、usage backfill、
  live poll、projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `176` passed；full `npm test` `1117` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Patch Surface Probe Effects Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
`planThreadDetailRefreshPatchSurface()` 已经负责判断是否需要探测
tile-pane DOM patch surface，但 `public/app.js` 仍直接用三元表达式调用
`threadDetailDomPatchSurface()`。这让 patch surface DOM probe 的 effect
intent 继续留在主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchSurfaceProbeEffects()`，把是否需要 DOM surface
  probe 转成有序 effects。
- `public/app.js` 新增
  `applyThreadDetailRefreshPatchSurfaceProbeEffect()` /
  `applyThreadDetailRefreshPatchSurfaceProbeEffectsPlan()`，只执行真实 DOM
  surface probe。
- `refreshCurrentThread()` 不再直接根据
  `patchSurfaceProbePlan.shouldProbeTilePatchSurface` 调用 DOM probe。
- 不改变 tile/single surface 判定、local/tile patch eligibility、DOM patch
  executor、server projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js test/thread-tile-layout-ui.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `179` passed；full `npm test` `1117` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Refresh Failure Diagnostic Effects Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
`threadDiagnosticEventsApi.threadDetailRefreshFailedDiagnosticEvent()` 已经负责
构造 bounded `thread_detail_refresh_failed` payload，但 refresh API 失败时
`public/app.js` 仍直接触发 Home AI diagnostic failure。这样失败路径的
effect intent 仍留在主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshFailureDiagnosticEffects()`，把 refresh API failure
  诊断输入转成有序 effects。
- `public/app.js` 新增
  `applyThreadDetailRefreshFailureDiagnosticEffect()` /
  `applyThreadDetailRefreshFailureDiagnosticEffectsPlan()`，只执行真实
  Home AI diagnostic failure side effect。
- `refreshCurrentThread()` 的 abort/throw 语义保持不变；非 abort 错误仍然上报
  后继续抛出。
- 不改变 failure diagnostic payload、Home AI diagnostic schema、server
  projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `175` passed；full `npm test` `1116` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Patch Rejection Diagnostic Effects Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
`planThreadDetailRefreshPatchRejectedDiagnostic()` 已经负责 local patch
rejection 的 bounded 字段选择，但 `public/app.js` 仍直接判断
`patchRejectedDiagnosticPlan.shouldReport` 并触发 Home AI diagnostic failure。
这让“是否上报 patch rejection 诊断”的 effect 选择继续留在主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchRejectedDiagnosticEffects()`，把 patch rejection
  diagnostic plan 转成有序 effects。
- `public/app.js` 新增
  `applyThreadDetailRefreshPatchRejectedDiagnosticEffect()` /
  `applyThreadDetailRefreshPatchRejectedDiagnosticEffectsPlan()`，只执行真实
  Home AI diagnostic failure side effect。
- `refreshCurrentThread()` 不再直接分支判断
  `patchRejectedDiagnosticPlan.shouldReport`。
- 不改变 local patch rejection 判定、diagnostic payload、Home AI diagnostic
  schema、server projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `174` passed；full `npm test` `1115` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Refresh Telemetry Effects Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
`thread-performance-metrics` 已经负责生成 bounded `thread_refresh_ms`
payload，但 `public/app.js` 仍直接决定 telemetry 副作用顺序：先调用
`postPerformanceEvent()`，再调用 `recordThreadDetailResponseDiagnostics()`。
这让 refresh 后的性能事件和 Home AI detail-response 诊断上报顺序继续留在
主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshTelemetryEffects()`，把 refresh telemetry 转成有序
  effects。
- `public/app.js` 新增
  `applyThreadDetailRefreshTelemetryEffect()` /
  `applyThreadDetailRefreshTelemetryEffectsPlan()`，只执行真实性能事件和
  detail-response 诊断上报。
- `refreshCurrentThread()` 不再直接调用 refresh telemetry 副作用。
- 不改变 `thread_refresh_ms` payload、diagnostic payload、节流 key、上报顺序、
  server projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `173` passed；full `npm test` `1114` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Consistency Check Effects Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
`planThreadDetailRefreshOutcomeExecution()` 已经产出 `consistencyCheck`，
但 `public/app.js` 仍直接判断 `shouldCheck` 并调用
`checkConversationProjectionConsistency()`。这让 refresh outcome 后的
projection consistency 检查执行顺序继续留在主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshConsistencyCheckEffects()`，把 consistency check
  结果转成有序 effects。
- `public/app.js` 新增
  `applyThreadDetailRefreshConsistencyCheckEffect()` /
  `applyThreadDetailRefreshConsistencyCheckEffectsPlan()`，只执行真实
  projection consistency 检查。
- `refreshCurrentThread()` 不再直接分支调用
  `checkConversationProjectionConsistency()`。
- 不改变 consistency check 判定、render mode/phase、patch/full-render 决策、
  诊断 payload、server projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `172` passed；full `npm test` `1113` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Patch Rejection Diagnostic Input Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
local patch 被拒绝时，`public/app.js` 仍直接选择 `readMode`、`renderMode`、
`renderPlanReason`、`patchRejectReason` 和前后 visible item count，再交给
`threadDiagnosticEventsApi.detailPatchRejectedDiagnosticEvent()`。这让 patch
失败后的诊断字段选择继续留在主 app 文件里，不利于判断“为什么 local patch
退回 full render”。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchRejectedDiagnostic()`，只在 local patch rejection
  时输出 bounded diagnostic input。
- `public/app.js` 改为执行该计划；真实 Home AI 诊断上报仍由 app.js 触发。
- 旧的 `patchRejectReason` 临时变量和直接字段组装从 `refreshCurrentThread()`
  移除。
- 不改变 local patch eligibility、rejection 判定、full-render fallback、
  Home AI diagnostic payload schema、server projection、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/thread-diagnostic-events.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `186` passed；full `npm test` `1112` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Refresh Response Effects Slice

本地小切片继续推进 Phase A 的 `refreshCurrentThread()` 所有权收敛。此前
refresh 请求、patch 尝试、执行结果、completion effects 已经逐步计划化，
但 API 响应回来之后仍由 `public/app.js` 直接判断是否仍是当前 thread/seq，
并内联执行 `markThreadDetailLoaded()`、detail render evidence 记录和
`mergeThreadPreservingVisibleItems()`。这部分是后续 patch/full-render 判断的
输入源，继续散在 app 主文件里会让旧响应覆盖、merge 顺序和可见项签名问题难以
单独测试。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshResponseEffects()`，统一判断 refresh 响应是否仍匹配
  当前 thread/seq，并输出有序 effects。
- `public/app.js` 新增
  `applyThreadDetailRefreshResponseEffect()` /
  `applyThreadDetailRefreshResponseEffectsPlan()`，只执行真实 loaded 标记、
  bounded render evidence 记录和 current-thread merge。
- `refreshCurrentThread()` 不再内联 stale response guard 或 response merge
  前置动作。
- 不改变 API 路径、merge 策略、local patch eligibility、full-render 判定、
  诊断字段、任务卡协议、server projection 或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `169` passed；full `npm test` `1110` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Summary Recovery Effects Slice

本地小切片继续推进 Phase A 的 thread detail state ownership。此前
`public/thread-detail-state.js` 已经通过 `planSummaryOnlyCurrentThreadRecovery()`
决定 summary-only current thread 是否应该恢复成 loading shell，并给出净化后的
`nextThread`、bounded client event 和是否需要立即 refresh。但
`renderCurrentThread()` 仍直接执行 `state.currentThread` 写入、client event 上报和
`summary-detail-recovery` refresh 调度。

本次修复：

- `public/thread-detail-state.js` 新增
  `planSummaryOnlyCurrentThreadRecoveryEffects()`，把 recovery plan 转成有序
  effects：写入 current thread、发送 bounded client event、按需调度 refresh。
- `public/app.js` 新增
  `applySummaryOnlyCurrentThreadRecoveryEffect()` /
  `applySummaryOnlyCurrentThreadRecoveryEffectsPlan()`，只执行真实 state/event/timer
  副作用。
- `renderCurrentThread()` 不再内联 summary recovery 的 state/event/refresh 分支。
- 不改变 summary-only 判定、loading-shell 内容、诊断字段、refresh reason、
  conversation render、server projection、local patch eligibility、任务卡协议或
  shell/cache。

闭环验证：

```bash
node --test test/thread-detail-state.test.js test/conversation-render.test.js test/mobile-viewport.test.js
npm run check
npm test
npm run check:macos
git diff --check
```

结果：focused `139` passed；full `npm test` `1109` passed；
`npm run check`、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，
尚未部署；继续作为 Phase A 模块的一部分累积。

## 2026-06-26 Phase A Single-Thread Shell Post-Update Effects Slice

本地小切片继续推进 Phase A，把 `renderCurrentThread()` 的 full-render
后置动作顺序计划化。上一切片已经把 single-thread shell 的
`updateConversationHtml()` 输入转成 helper 输出；本次处理 DOM 更新之后的
retry binding、empty-detail diagnostic、action binding、receipt-start scroll、
plugin route hint focus、tick timer 和 plugin navigation publish。

此前这些动作都直接写在 `renderCurrentThread()` 中。虽然行为正确，但顺序和
适用条件不能作为纯策略测试覆盖：early shell 有 retry/tick/navigation，正常
full render 有 empty-detail 检查、绑定事件、可选滚动、route hint focus、
tick/navigation。后续排查“full render 后又闪/错焦点/没绑定按钮”时，这仍是
主 app 文件里的隐式流程。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planSingleThreadShellPostUpdateEffects()`，输出有序 effects。
- `public/app.js` 新增
  `applySingleThreadShellPostUpdateEffect()` /
  `applySingleThreadShellPostUpdateEffectsPlan()`，只执行真实 DOM、事件绑定、
  scroll、timer 和 navigation 副作用。
- early shell 和 normal full-render shell 都改成执行计划好的 post-update
  effects。
- 不改变 shell HTML、retry 行为、empty-detail diagnostic 条件、scroll
  policy、route hint focus、server projection、local patch eligibility、任务卡
  协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js
```

结果：`174` passed。提交前完整验证：`npm run check`、`npm test`
（`1109` passed）、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为
Phase A 模块的一部分累积。

## 2026-06-26 Phase A Single-Thread Shell Update Input Slice

本地小切片继续推进 Phase A，让 `renderCurrentThread()` 更接近“只编排、
只执行 DOM 副作用”。上一切片已经把 `updateConversationHtml()` 的后置副作用
计划化；本次处理它的上游：single-thread early shell 和 full shell 调用
`updateConversationHtml()` 时的输入拼装。

此前 loading / load-error early shell 和正常 full-render shell 都已由
`public/thread-detail-render-plan.js` 生成 HTML，但 `public/app.js` 仍直接拼
`conversationSignature`、`patchShellSignature`、`stickToBottom`、
`expectedVisibleTurnCount` 和 `source` 后调用 `updateConversationHtml()`。
这让 shell 选择已经服务化，但 shell update 输入边界仍散在主 app 文件里。

本次修复：

- `public/thread-detail-render-plan.js` 新增
  `planSingleThreadShellConversationUpdate()`，把 shell plan 和签名/scroll/count
  输入转成稳定的 `{ html, conversationSignature, options }`。
- `renderCurrentThread()` 的 early shell 和 full-render shell 都执行这个 update
  input plan，再调用 `updateConversationHtml()`。
- 不改变 shell HTML、retry binding、live operation dock 清理、full-render scroll
  policy、conversation DOM update、empty detail diagnostic、server projection、
  local patch eligibility、任务卡协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-render-plan.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js
```

结果：`172` passed。提交前完整验证：`npm run check`、`npm test`
（`1107` passed）、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；继续作为
Phase A 模块的一部分累积。

## 2026-06-26 Phase A Conversation HTML Update Effects Slice

本地小切片继续推进 Phase A 的 render/patch ownership 收敛，当前不部署。
上一切片已经把 local DOM patch completion 的后置副作用计划化；本次处理
`updateConversationHtml()` 里的另一条主路径：full render / hydrate-existing
conversation HTML 更新。

此前 `public/thread-detail-dom-patch.js` 的 `planConversationHtmlUpdate()` 已经
能决定 stable signature、patch-html、set-inner-html、DOM-empty invalidation、
hydrate options 和 scroll action，但 `public/app.js` 仍在
`updateConversationHtml()` 里直接分支执行 patch-shell signature 写回、root
hydration、rendered conversation signature 写回、scroll-to-bottom /
bottom-button 调度。这样 full-render 和 hydrate-existing 的后置副作用仍不能
单独测试，也容易和 local patch completion 的副作用边界分叉。

本次修复：

- `public/thread-detail-dom-patch.js` 新增
  `planConversationHtmlUpdateEffects()`，把 conversation HTML update plan 转成
  有序 effects。
  - `hydrate-existing` 路径保持旧顺序：先写回 patch-shell signature，再 hydrate，
    再执行 scroll/bottom-button 调度。
  - changed render 路径保持旧顺序：先 hydrate，再写回 rendered conversation
    signature / patch-shell signature，再执行 scroll/bottom-button 调度。
- `public/app.js` 把 DOM effect executor 泛化为
  `applyThreadDetailDomUpdateEffect()` /
  `applyThreadDetailDomUpdateEffectsPlan()`，`updateConversationHtml()` 和
  `completeLocalConversationDomUpdate()` 都只执行 helper 计划好的 effects。
- 不改变真实 `patch-html` / `innerHTML` / fallback render、stable-DOM-empty
  诊断、performance event、server projection、local patch eligibility、
  scroll-follow policy、task-card 协议或 shell/cache。

闭环验证：

```bash
node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js test/mermaid-render.test.js test/github-link-preview-ui.test.js
```

结果：`180` passed。提交前完整验证：`npm run check`、`npm test`
（`1106` passed）、`npm run check:macos`、`git diff --check` 均通过。
该切片尚未 bump `CLIENT_BUILD_ID` / PWA shell cache，尚未部署；会和同类
Phase A 小切片一起组成模块后再统一部署验证。

## 2026-06-26 Phase A Local Patch Completion Effects Slice

本地小切片继续推进 Phase A 的前端 thread detail render/patch ownership
收敛，当前不部署。此前 `completeLocalConversationDomUpdate()` 已经把
tile/single completion 判断交给 `public/thread-detail-dom-patch.js`，但
完成后的 hydrate、render signature 写回、patch-shell signature 写回、
scroll-to-bottom / bottom-button 调度仍在 `public/app.js` 里直接分支执行。
这让 local patch 成功后的 commit 副作用仍分散在主 app 文件里，后续排查
“patch 成功但滚动/签名/按钮状态不一致”时缺少可测试边界。

本次修复：

- `public/thread-detail-dom-patch.js` 新增
  `planLocalConversationDomUpdateCompletionEffects()`。它只把 completion
  plan 转成有序 effects：hydrate root、写回 rendered conversation
  signature、写回 patch-shell signature、调度到底部或更新底部按钮。
- `public/app.js` 新增
  `applyLocalConversationDomUpdateCompletionEffect()` 和
  `applyLocalConversationDomUpdateCompletionEffectsPlan()`，只执行真实 DOM /
  state / scroll side effects，不再重新判断 completion plan 的分支。
- `completeLocalConversationDomUpdate()` 仍负责读取实时条件、调用 completion
  planner，并在 planner 返回 complete 后执行 effects。行为保持不变：
  不隐藏重复消息、不强制刷新、不跳过刷新、不修改 server projection、task-card
  协议、诊断上报或 shell/cache。
- focused tests 覆盖 single-thread completion effect 顺序、tile-pane terminal
  no-op、blocked completion no-op、bottom-button 更新，以及 `app.js` 不再内联
  local completion scroll/signature 分支。

闭环验证：

```bash
node --test test/thread-detail-dom-patch.test.js test/conversation-render.test.js test/turn-scroll-controls.test.js test/mobile-viewport.test.js
```

结果：`165` passed。该切片只改变前端源码和测试，尚未 bump
`CLIENT_BUILD_ID` / PWA shell cache，尚未部署；按当前节奏会先累积为一个
Phase A 模块后再部署验证。

## 2026-06-26 Active Window Overlay Orchestration Seam

Phase B 的活跃大线程读取风险已经从 proof gate 推进到真实 provider
接线，但仍保持 fail-closed：

- `thread-detail-projection-service.js` 新增 memory-only、clone-only 的
  `activeOverlaySnapshot()`。它只读取进程内由 app-server/mux notification 更新的 live
  projection entry，不读磁盘、不返回完整 thread、不把 notification shell 提升为普通 detail
  projection。
- 新增 `services/thread-detail/thread-detail-active-overlay-provider-service.js`，把 snapshot 转成
  `services/thread-detail/thread-detail-active-window-overlay-policy-service.js` 所需的 bounded evidence：active turn、
  operation/upload/assistant/receipt counts、coverage、v4 revision 和 timestamp。
- `server.js` 在 `thread-detail-read-orchestration-service.js` 中注入该 provider。active/running
  线程只有在 projection window、live overlay snapshot、active turn id、coverage 和 assistant
  freshness 全部可证明时才走 `projection-active-overlay`；缺任何一项仍回到 full `thread/read`。
- `thread-detail-projection-result-service.js` 保持普通 projection 命中必须包含本地 active turn
  的旧规则；只有 active overlay window assembly 可以临时接受“不含 active turn 的 partial
  projection window”，因为随后会合入 provider 的 live active turn 并经过 proof gate。
- `test/thread-detail-active-overlay-integration.test.js` 使用真实 v4 projection service、projection
  input/result service、active overlay provider 和 read orchestration 组合验证：普通 projection
  lookup 仍拒绝 partial，active-overlay lookup 可取得 partial window，最终返回
  `projection-active-overlay`，且不调用 full `thread/read` 或 `turns-list`。
- 新增 `server-routes/thread-detail-route-service.js`，把 `/api/threads/:id` 的 `mode=recent` 解析、
  bounded `threadLog`、JSON response 和 `complete=false` 语义从 `server.js` 抽到可测试边界。
  这不改变读取策略，只减少 route glue 对后续 active-overlay/server smoke 的阻力。
- `server-routes/api-dispatch-route-service.js` 现在拥有主 `/api/*` dispatcher；`server.js`
  直接导入 canonical route 模块，旧 `adapters/api-dispatch-route-service.js` 仅保留兼容
  re-export。这个切片不改变路由顺序，只把 HTTP route composition 移到 `server-routes/`。
- `test/thread-detail-active-overlay-integration.test.js` 现在额外覆盖 route-level smoke：
  `/api/threads/:id?mode=recent` 通过 route service 调用真实 read orchestration 时，能返回
  `projection-active-overlay`，并证明没有调用 full `thread/read` 或 `turns-list`。
- Phase B 已部署生产并完成 readback。线程列表第二次进入已命中
  `warm-fallback-cache`，但 active 线程详情仍暴露
  `activeOverlayReason=missing-active-turn-id`。后续本地切片修正这个服务端
  状态所有权断点：live notification projection 在 `turn/started` 和 active item
  通知中保留 `thread.activeTurnId`，`turn/completed` 清理它；当 summary 只有
  `status=active` 时，active overlay provider 可以从 server-owned live projection
  推断当前 active turn，再继续走原有 proof gate。缺 snapshot、assistant freshness
  不足或 completed turn 仍然 fail-closed 到 full `thread/read`。
- 第二个本地切片处理 production readback 同时暴露的
  `projectionMissReason=dynamic-summary-stale`。普通 projection 命中仍然会因为
  summary 更新较新而 miss；只有 active overlay 路径在同时传入
  `allowPartial=true` 和 `activeOverlay=true`、且 summary 仍是 active/running 时，
  才能把这个动态 entry 当作 bounded projection window。最终是否返回仍由
  active overlay proof gate 决定，不把 stale window 暴露成普通 detail cache。
- 第三个本地切片增强 Phase B readback gate。`codex-mobile-phase-b-readback-smoke.js`
  现在把 active overlay 结果归类为 bounded `activeOverlayGate` /
  `activeOverlayGateReason` / `activeOverlayNextAction`，并带出 operation/upload/
  assistant/receipt count。下一次批量部署后，如果仍没有进入
  `projection-active-overlay`，readback 可以直接指出下一层是 active turn、stale
  window、snapshot、assistant freshness、receipt coverage 还是 source authority。
- 第四个本地切片处理 readback gate 暴露的 `missing-projection-window`。当普通
  projection lookup 没有可用窗口、但 server-owned active overlay provider 已经给出
  live active turn 和 bounded coverage evidence 时，read orchestration 可以先读取一个
  `turns-list-active-overlay-window` 作为 partial projection window skeleton，再重新经过
  active overlay proof gate。只有 proof gate 通过时才返回 `projection-active-overlay`；
  这个 partial window 不持久化、不成为普通 projection cache，也不会放宽普通
  projection 的 staleness / active-turn 规则。
- 第五个本地切片处理后续 readback 暴露的 active 普通 projection hit 早退问题。
  如果 summary 仍是 active/running，即使普通 `projection-v4-dynamic` 已经命中，
  read orchestration 也不能直接返回该 projection；它只能把这个 projection 当作
  active overlay window，再通过 server-owned live overlay provider 和 proof gate
  合入当前 active turn。缺 provider 或 coverage 仍然 fail-closed。

这个 follow-up 的前四个切片已随 `c1497eb` 部署到 Mac 生产并完成 Phase B readback。
生产 `/api/threads/:id?mode=recent` 返回 `readMode=projection-active-overlay`、
`activeOverlayGate=ready`、`activeOverlayReason=overlay-evidence-complete`，
detail 冷路径归类为 `warm-projection-active-overlay`。本次没有修改静态 shell，
所以 `clientBuildId` / `shellCacheName` 仍为 `codex-mobile-shell-v531`。
第五个切片已随 `756f4ba` 部署到 Mac 生产并完成读回。读回显示 active detail
继续为 `projection-active-overlay` / `activeOverlayGate=ready`；部署后首个
thread-list 完整读是 `miss-rebuild:rollout`，但同 key warm check 立即变为
`warm-fallback-cache` / `cache-hit`，因此当前结论是 cold start / deploy 后一次性
fallback rebuild 可观察，普通重复刷新没有复发为反复冷建。
Phase B 模块部署后的最新 readback 又暴露了一个更冷的启动边界：服务重启后，如果
summary 的 active 状态只来自 rollout fallback tail，而内存 live projection entry 已经不存在，
detail 仍可能因为 `missing-active-turn-id` 回到 full `thread/read`。后续 server-only
修复把 rollout tail 中 `task_started.turn_id` 记录到 active status，并在 fallback summary
上提升为顶层 `activeTurnId`；这样 active-read policy 在冷启动/重启后也能拿到具体 active
turn id，再进入原有 active overlay proof gate。terminal 事件仍然优先，completed turn 不会被
误标成 active。`f6818d7` 部署后的 Phase B readback 已确认 detail 重新进入
`readMode=projection-active-overlay`、`activeOverlayGate=ready`，thread-list 同 key
warm check 仍为 `warm-fallback-cache`。
这不是 UI 去重、不是强制刷新，也不是新的 fallback cache；后续如果仍有大
session 慢路径，应优先看 Phase B readback 的 active overlay gate、thread-list
coldPathOwner/coldPathReason 和 warm-check 结果，再决定下一层归因。

## 2026-06-26 Thread List Fallback Baseline Service

本地小切片继续推进 Phase B 的线程列表冷路径收敛。此前
`adapters/thread-list-fallback-cache-service.js` 同时负责 cache key、
TTL/hit/miss、增量 status patch，以及 cold miss 时从 state DB、rollout
session、session index 三路读取并合并 fallback baseline。这样排查“线程列表为什么慢”时，
cache policy 和 baseline 构建边界混在一起。

本次修复：

- 新增 `adapters/thread-list-fallback-baseline-service.js`，只负责 fallback
  baseline 的三路 source collection、per-source timing/count、merge、limit。
- `adapters/thread-list-fallback-cache-service.js` 继续只负责命中、失效、
  remember、incremental update，cold miss/expired 时调用 baseline service
  构建 baseline。
- `/api/threads` 的 `mobileDiagnostics.threadListTimings` 增加
  `fallbackStateDbCount`、`fallbackRolloutCount`、`fallbackSessionIndexCount`、
  `fallbackBaselineSourceCount`、`fallbackBaselineResultCount`，方便区分慢在
  source 读取还是合并结果规模。
- 新增 `adapters/thread-list-cold-path-diagnosis-service.js`，把已有
  fallback/app-server timings 归因为 bounded `coldPathOwner` /
  `coldPathReason`，例如 `warm-fallback-cache`、`deferred-fallback`、
  `fallback-baseline`、`fallback-cache-policy` 或 `app-server-thread-list`。
- 新增 `scripts/codex-mobile-phase-b-readback-smoke.js`，作为 Phase B 批量部署后的
  生产读回工具。它只请求 `/api/public-config`、`/api/threads` 和
  `/api/threads/:id?mode=recent`，验证 `coldPathOwner`、thread-detail timings
  和可选的 `projection-active-overlay`，输出仅包含 build id、hash、read mode、
  owner/reason、计数和耗时。如果首个 thread-list 读因为 active detail 被
  `fallbackDeferred`，它会在 detail readback 后再读一次完整列表；如果这次完整读触发
  cold fallback baseline，还会立刻做一次同 key warm check。普通首个完整列表读如果是
  cold fallback baseline、且没有命中 source snapshot，也会做同 key warm check。这样可以
  证明是否只在 cold start / deploy 后重建一次。
- 新增 `adapters/phase-b-readback-decision-service.js`，把 readback 输出归类成
  `decision`：例如 active overlay proof gate、projection cache lifecycle、
  projection input、thread-list fallback baseline、cache freshness 或 app-server
  fallback。这样 Phase B 批量部署后可以按 bounded 字段直接决定下一步 root-cause
  修复方向，而不是人工解释私有日志或肉眼观察。
- `adapters/thread-list-fallback-baseline-service.js` 现在有进程内 memory-only
  source snapshot。最终列表 cache 仍按 `cwd/search/limit` 区分；当最终列表 key
  miss 或 TTL 过期时，可以复用同一可见性下已经读取过的 state DB / rollout /
  session-index source set，再重新套用原有 filter/merge/limit。诊断字段会暴露
  `fallbackSourceSnapshotHit`、snapshot age/build/raw count，用来证明是否避免了
  重扫 source。
- server-only follow-up 降低首次 source snapshot 构建里的 rollout I/O。线程列表
  fallback 读取 rollout 摘要时先只读 head/stat 来获得 id、cwd、标题、mtime 和
  agent metadata，经过可见性/cwd/search 过滤并截断最终候选后，才对保留下来的
  rows 读取 tail 推断 `active` / `completed` / stale-active 状态。单线程
  `readRolloutSessionFallbackThread()` 和默认 helper 仍保持旧语义，直接返回带状态的
  summary；列表冷路径只是把 tail/status 推迟到最终候选，避免对被过滤掉的 rollout
  文件做状态扫描。
- server-only follow-up 继续收紧同一冷路径里的重复同步 I/O。归档线程 id 集合在一次
  fallback filter/merge pass 中复用，不再让每个 row 的 `threadHasArchiveSignal()`
  反复扫描 archived session 目录；`inferRolloutFallbackStatus()` 已经读取过的
  rollout tail 会传给 stale context-only active evidence，不再为了同一个最终候选
  二次读取 tail。归档过滤和 stale-active 转 idle 的语义保持不变。
- server-only attribution follow-up 只增加 bounded 数字计数，不改变列表行为。
  rollout fallback 读源现在记录目录读取、JSONL stat/collect/sort、候选扫描、
  head read/bytes、最终候选 status tail read/bytes；session index fallback 记录
  `session_index.jsonl` read/line/entry 数。baseline service 给每个 source reader
  独立 diagnostics 容器，只把白名单数字计数合并进 timings；cache service 和
  `/api/threads` 再把这些字段暴露为 `fallbackRollout*` /
  `fallbackSessionIndex*`。路径、prompt、线程标题、搜索词和日志不会进入这些
  diagnostics。下一次 Phase B 生产 readback 可以直接区分慢点是 rollout discovery、
  head 解析、final status tail、session index 体量，还是后续 merge/filter。
- server-only source-context follow-up 复用同一次 fallback baseline 里的
  `session_index.jsonl` 读取。baseline service 为一次 cold source read 创建临时
  `sourceContext`，传给 state DB、rollout 和 session-index 三路 source reader；
  rollout fallback 先读取较大的 session index map 后，session-index fallback 可以在
  同一 pass 里复用这个 map，并通过 `fallbackSessionIndexReuseCount` 证明复用发生。
  这个 context 不进入 source snapshot、不跨请求持久化、不改变 title hydration 或单线程
  helper 的普通 `readSessionIndexEntries()` 行为。
- server-only rollout discovery follow-up 调整 `collectRecentRolloutFiles()` 的遍历顺序：
  对目录项按“目录优先、名称倒序”访问，让 `.codex/sessions/YYYY/MM/DD/rollout-...`
  这种日期分层结构先进入新的年份/月/日目录。最终返回仍按 `mtimeMs` 排序并按
  `maxFiles` 截断；当 discovery cap 生效时，不再容易被旧目录先填满候选集合。
- server-only merge/filter attribution follow-up 把 fallback baseline 最终过滤与合并
  去重的工作量也纳入 Phase B 读回证据。baseline timings 现在记录
  `fallbackBaselineFinalFilter*`、`fallbackBaselineMerge*` 和
  `fallbackBaselineLimitDropCount`，用来区分慢点是否来自 source I/O、最终
  cwd/search 过滤、重复 id 合并，还是 limit 截断。字段都是 bounded 数字计数，不包含
  搜索词、线程标题、cwd、rollout 路径或消息正文。

这不是新的 fallback 行为，也不是 prewarm/persist。route aggregation、defer
fallback、app-server result merge 都没有改变；source 层只调整 rollout list
候选的读取顺序、减少同一 pass 里的重复归档扫描、重复 tail 读取和重复 session-index
读取，并补充冷路径归因计数。baseline 层只补充 final filter / merge 工作量计数，不改变
过滤、排序、去重或截断规则。readback 仍只把 deferred 之后的完整读和 warm check
证据化。该切片暂不单独部署，按新的节奏等待 Phase B 模块批量验证后再统一部署。

## 2026-06-26 v531 Thread Detail Cold-Path Diagnosis

v531 推进 Phase B 的大 session 冷路径证据化。此前
`mobileDiagnostics.threadDetailTimings.phase` 已经能区分 warm projection、bounded
turns-list、full `thread/read` 和 fallback，但还不能直接说明慢路径归属哪个架构层。排查时
仍要人工组合 `projectionState`、`projectionMissReason`、`largeReadReason`、
`activeFullReadReason` 等字段。

本次修复：

- 新增 `adapters/thread-detail-cold-path-diagnosis-service.js`，把已有 bounded 字段归因为
  `coldPathOwner` / `coldPathReason`，覆盖 projection cache、projection input、summary、
  active read policy、app-server thread/read、turns/list fallback 和 summary fallback。
- `adapters/thread-detail-performance-service.js` 在 `threadDetailTimings` 中附带
  `coldPathOwner` / `coldPathReason`；这只增强诊断，不改变 detail read 策略。
- `public/thread-performance-metrics.js` 和 `public/thread-diagnostic-events.js` 把这两个字段透传到
  slow-path diagnostic，方便 Home AI case 直接看到归因层。

隐私边界不变：只输出 bounded owner/reason、计数和耗时，不输出消息正文、任务卡正文、
上传内容、私有路径、cookies、tokens 或长日志。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v531`。

## 2026-06-26 v530 Thread Tile DOM Authority Count

v530 把 v527 的 stable-signature DOM authority 规则补到平铺 board。此前单线程
`renderCurrentThread()` 已经会把 expected visible turn 数和真实 DOM turn 数交给
`planConversationHtmlUpdate()`；但平铺 turn 的 DOM 使用
`article.thread-tile-turn[data-thread-tile-turn]`，不是单线程的 `article.turn[data-turn]`。
因此平铺整板渲染在签名稳定时仍可能误走 `hydrate-existing`，即使真实 tile DOM 已经丢失。

本次修复：

- `public/app.js` 新增 `threadTileVisibleTurnCount()` 和 `threadTileDomTurnCount()`，
  分别计算当前平铺窗口应该渲染的 tile turn 数和真实 mounted tile turn 数。
- `renderThreadTileLayout()` 调用同一个 `updateConversationHtml()` authority path，并传入
  `expectedVisibleTurnCount`、`renderedDomTurnCount` 和 `source: "thread-tile-render"`。
- 这不是隐藏空白或强制刷新兜底；它修正的是“平铺 board 的 render signature 也必须接受
  真实 DOM 形态校验”这个根因边界。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v530`。

## 2026-06-26 v529 Stable Signature Empty-DOM Visual Harness

v529 不改变运行时渲染策略，补上 v527/v528 事故链的浏览器级回放入口。此前已经在
`public/thread-detail-dom-patch.js` 中修正了“render signature 稳定但真实 DOM 已空”
的根因，但 Home AI live-debug visual smoke 只能回放“cached-current detail 为空”的
场景，还不能直接验证真实非空 detail 被空 DOM 遮住后能否恢复。

本次修复：

- Hermes embedded `window.__codexMobileVisualHarness` 新增
  `simulateStableSignatureEmptyDom(threadId)`。它先通过真实 `loadThread()` 载入非空
  detail，再保留当前 render signature、清空 conversation DOM，最后调用真实
  `renderCurrentThread()`，验证 lower-level DOM authority guard 会重新绘制非空 turns。
- `scripts/codex-mobile-empty-detail-cache-smoke.js` 新增
  `--scenario stable-signature-empty-dom`，默认仍是旧的 `empty-cache` 场景，便于生产
  live-debug 选择不同故障类。
- harness 和 smoke 输出仍只包含 build id、thread hash、turn/item/DOM 计数、加载状态和
  read mode，不输出消息正文、任务卡正文、上传内容、私有路径、cookies、tokens 或长日志。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v529`。

## 2026-06-26 v528 Missing DOM Turn Diagnostic Coverage

v528 补上 v527 之后的诊断闭环缺口：如果当前线程状态已经有可见 turn，但真实 DOM 里
`article.turn[data-turn]` 数量为 0，之前的 turn-order 诊断会因为 `domIds.length === 0`
直接返回 `null`，导致“页面一个 turn 都看不见”这种状态不一定进入 Home AI 的
`conversation_projection_mismatch` 诊断链路。

本次修复：

- `public/thread-diagnostic-events.js` 新增 `turnOrderDiagnosticSnapshot()`，把 expected turn
  ids 与 DOM turn ids 的对比从 `public/app.js` 移到可测试 helper。
- expected 非空而 DOM 为空现在会形成明确的 `turn_order_mismatch`，并记录 bounded
  `missing_dom_turn_count`、`order_mismatch_count` 和 `latest_mismatch_count`。
- `public/app.js` 只收集当前线程 expected ids、DOM ids 和安全 hash，然后委托 helper
  生成诊断 snapshot；不记录消息正文、任务卡正文、上传内容、私有路径、cookies、tokens
  或长日志。

这仍然只走 Home AI Owner-gated diagnostic report，不自动派修复卡，也不改变页面渲染或
刷新行为。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v528`。

## 2026-06-26 v527 Conversation DOM Authority Guard

v527 继续修复 Music 线程显示 `No visible turns.` 的同一条根因链。生产读回和本地
认证 detail API 仍证明 Music 详情本身是非空的：`10` 个 turn、`39` 个 visible item key、
`79` 个 omitted turns。v526 已经修正了 `refreshCurrentThread()` 的刷新计划，但用户仍能
看到单线程页面停在空壳，说明还有更底层入口：`updateConversationHtml()` 会把
`renderedConversationSignature === signature` 直接交给 `hydrate-existing`，即使真实 DOM
已经没有任何 `article.turn[data-turn]`。

本次修复：

- `public/thread-detail-dom-patch.js` 的 `planConversationHtmlUpdate()` 新增
  `expectedVisibleTurnCount` 和 `renderedDomTurnCount` 输入；当签名稳定、下一状态有 visible
  turn、但当前 DOM turn 数为 0 时，返回 `stable-signature-dom-empty` 并执行真实 HTML 更新。
- `public/app.js` 在单线程 full render 时传入 expected visible turn 数，并在 lower-level
  DOM authority 被判定失效时记录 `stable_signature_dom_empty` 诊断和
  `conversation_dom_authority_invalidated` client event。
- 这不是“空白后再刷一次”的兜底，而是修正 DOM 更新层的核心不变量：投影签名只有在真实
  DOM 形态也匹配时才可以跳过重绘。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v527`。

## 2026-06-26 v526 Empty DOM / Stable Signature Authority Fix

v526 修复 Music 线程在服务端 detail 正常返回 `10` 个 turn 的情况下，手机端仍稳定显示
`No visible turns.` 的事故。生产读回确认 `/api/threads/:id?mode=recent` 和
`/api/threads?search=Music` 都是正常的：detail 非空，list row 也没有泄漏 `turns` 等
detail-only 字段。因此失败层收敛到前端刷新计划：`renderedConversationSignature` 仍记着
旧的非空 detail 签名，但真实 DOM 已经被其它路径替换成空状态；后续服务端再返回同一个
非空签名时，刷新计划误判为 `signature-stable`，只做 metadata update，导致空 DOM 没有被
重画。

本次修复：

- `public/thread-detail-render-plan.js` 的 `planThreadDetailRefreshRender()` 新增
  `rendered-dom-empty` 分支：在单线程 surface 可用、下一状态有 visible turn、当前 DOM
  的 `article.turn[data-turn]` 为 0 时，签名不能作为稳定证据，必须强制 full render。
- `public/app.js` 在 refresh 合并服务端 detail 后，把当前 DOM turn 数、下一状态 visible
  turn 数、单线程 surface 可用性传入刷新计划。
- 这不是前端兜底刷新；它修正的是“签名状态不能脱离 DOM authority 单独决定是否跳过
  render”的根因边界。
- 同一发布继续包含 v525 的 recent detail render evidence 策略抽取。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v526`。

## 2026-06-26 v525 Recent Detail Evidence Policy Extraction

v525 继续 Phase 2 的前端状态所有权收敛，把 `public/app.js` 里最近一次成功
thread-detail render evidence 的构造、freshness、同线程匹配和非空判定抽到
`public/thread-detail-state.js`。这条 evidence 同时支撑 primary shell selection
conflict、empty visible detail mismatch 和后续 Home AI bounded diagnostic，因此它
必须是可测试的状态策略，而不是散落在 app shell 编排代码里。

本次切片新增/调整：

- `public/thread-detail-state.js` 新增
  `buildThreadDetailRenderEvidence()`、`recentThreadDetailRenderEvidence()`、
  `sameThreadDetailRenderEvidence()` 和
  `hasNonemptyThreadDetailRenderEvidence()`。
- `public/app.js` 保留 shape 计算、hash 计算、诊断上报和 refresh 调度；证据是否有效、
  是否过期、是否属于当前线程、是否足以证明非空，都由 helper 决定。
- `test/thread-detail-state.test.js` 覆盖证据构造、过期、跨线程拒绝、零 visible
  证据拒绝和隐私边界。
- `test/conversation-render.test.js` 确认 `app.js` 已消费 helper，不再内联 freshness
  / matching 判定。

这条切片最终随 v526 shell 一并发布。

## 2026-06-26 v524 Empty Detail Recovery Policy Extraction

v524 延续 v523 的 Music 空详情根因链路，但这次不改变投影、列表、DOM 或诊断
语义；它把 `public/app.js` 里“空详情但有历史证据”的判断抽到
`public/thread-detail-state.js`，让状态所有权规则继续从主 app 编排层移到可测试
helper。

本次切片新增/调整：

- `public/thread-detail-state.js` 新增
  `emptyDetailHistoryEvidenceForThread()` 和
  `planEmptyDetailHistoryRecovery()`。
- helper 统一判断哪些 bounded 字段能证明一个线程不应稳定显示为空：
  rollout size、omitted turn count、visible item key count、active turn、
  thread task-card count、pending task-card count。
- helper 返回 `shouldRecover`、`recoveryKey`、`diagnosticReason` 和 bounded
  `event`，`public/app.js` 只负责冷却计时、记录诊断、调度真实 detail refresh。
- 冷却、loading/load-error fail-closed、弱证据拒绝和隐私边界都有
  `test/thread-detail-state.test.js` 覆盖。
- `test/conversation-render.test.js` 确认 `app.js` 消费 helper plan，不再内联
  `threadHasNonemptyHistoryEvidence()` 策略。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v524`。

## 2026-06-26 v523 Thread List Summary Authority Boundary

v523 修复 Music 线程再次进入后显示 `No visible turns.` 的同一类事故，但失败层已经
从 v520/v521 的 cached-current 复用，进一步收窄到服务端线程列表摘要和前端详情权威
的边界。生产读回显示 Music 详情 API 本身仍返回 `10` 个 turn、`39` 个 visible item、
`projection-v4-dynamic` 和 `79` 个 omitted turns；问题是列表接口可能把 fallback/list
row 里的 `turns: []`、`mobileDetailLoaded`、`mobileReadMode`、`mobileVisibleItemKeys`
等 detail-only 字段带给客户端，后续某些路径会把这个空列表摘要当成详情态渲染。

本次切片新增/调整：

- 新增 `adapters/thread-list-summary-service.js`，集中定义线程列表摘要必须剥离的
  detail-only 字段。线程列表只能携带标题、状态、时间、cwd、pending task-card count
  等摘要信息，不能携带 `turns` 或任何 detail/projection 权威字段。
- `server.js` 的 list merge、status normalization 和 task-card count decoration 都调用
  该服务，确保 app-server list row、fallback row 和合并结果不会把空 detail authority
  泄漏到 `/api/threads`。
- `public/app.js` 增加 `empty_render_with_history_evidence` 检测：如果页面实际渲染
  `No visible turns.`，但当前线程仍有 rollout size、omitted turn count、
  visible item key、active turn 或 pending task-card 等历史证据，会记录 bounded
  diagnostic 并触发一次真实详情刷新。
- 这个前端动作不是合成内容或静默去重；它只在“空详情和已有历史证据矛盾”时把状态
  重新交还给 detail API，同时把证据送入 Home AI Owner-gated diagnostic channel。
- `test/thread-visibility.test.js` 覆盖 list summary stripping 和 list/fallback merge 不再
  泄漏空 detail 字段；`test/conversation-render.test.js` 覆盖空详情历史证据恢复触发。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v523`。

## 2026-06-27 Local Phase A First-Paint Performance Input Planning Slice

这个本地小切片继续 Phase A 的 `loadThread()` ownership 收敛，不改变线程详情
读取策略、不改变事件字段语义、不 bump PWA shell/cache，也不单独部署。它只把
first-paint performance input 的字段选择从 `public/app.js` 移到可测试 plan helper。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFirstPaintPerformanceInput()`，集中规范 cached-current 与 API
  first-paint 的 timing input。
- cached-current 路径只保留之前已有的 `elapsedMs`、`apiElapsedMs`、`renderElapsedMs`、
  `threadListRenderMs`、`conversationRenderMs`，不会误加入 API first-paint 专属的
  `mergeMs`、`draftRestoreMs`、`composerRenderMs` 或 `postRenderMs`。
- API first-paint 路径仍保留 merge/draft/composer/thread-list/conversation/post-render
  timing 字段；`threadPerformanceMetrics` 继续拥有最终 event payload 正规化。
- `public/app.js` 只负责采集真实计时、调用 plan helper、执行 telemetry effects。
- `test/thread-detail-render-plan.test.js` 覆盖 cached/API 两种 input shape；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 确认
  `loadThread()` 不再手写 first-paint performance input。

修复边界：

- 症状/风险：`loadThread()` 已经把大量 first-paint side effects 移到计划器，但
  performance input 仍在 app 层手写，容易让 cached-current 与 API first-paint
  字段边界再次漂移。
- 失败层：前端 first-paint telemetry input ownership，不是服务端 projection、
  app-server detail read、DOM patch、任务卡协议或 Home AI diagnostic intake。
- 闭环验证：focused tests 证明 cached-current 不携带 API 专属 timing 字段；完整
  检查通过后再随 Phase A 模块批量部署。

## 2026-06-27 Local Phase A Thread Load Error Effects Slice

这个本地小切片继续 Phase A 的 `loadThread()` 编排收敛，不改变 API 失败判定、
错误诊断、Home AI diagnostic report 或 shell/cache。它只把 detail API 失败后的
固定 UI 状态更新顺序移到 `public/thread-detail-render-plan.js`。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailLoadErrorEffects()`，声明 load-error 状态写入、active turn
  同步、线程列表渲染、当前线程渲染和 Composer 控件刷新顺序。
- `public/app.js` 的 `loadThread()` catch 分支改为执行该 plan；app 层仍负责真实
  `state.currentThread` 写入、DOM 渲染和 Composer 控件更新。
- `thread_switch_error` client event 和 `thread_detail_load_failed` Home AI 诊断
  仍沿用原有路径，未改变 payload 语义。
- `test/thread-detail-render-plan.test.js` 覆盖 load-error effect 顺序；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 确认
  `loadThread()` 不再内联旧的 error-state/render/update 串联。

修复边界：

- 症状/风险：普通 detail API 失败时，`loadThread()` 仍直接拥有 load-error UI
  状态和渲染顺序，和 loading shell、first-paint、cached-current 已计划化的路径不一致。
- 失败层：前端 load-error render/state effect ownership，不是网络 API、server
  projection、任务卡协议或 Home AI diagnostic intake。
- 闭环验证：focused tests 覆盖 plan 顺序和 app wiring；完整检查通过后再随 Phase A
  模块批量部署。

## 2026-06-27 Local Phase A First-Paint Response Effects Slice

这个本地小切片继续 Phase A 的 `loadThread()` 成功路径收敛，不改变 detail API
读取策略、不改变 `mergeThreadPreservingVisibleItems()`、不改变 projection 语义，也不
bump PWA shell/cache。它只把 API first-paint 响应到达后的固定 state/evidence/merge
顺序移到可测试 plan helper。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFirstPaintResponseEffects()`，声明 detail-loaded 标记、render
  evidence 记录、pending server requests 同步和 current-thread merge 顺序。
- `public/app.js` 的 `loadThread()` 成功路径改为执行这个 response effects plan；
  app 层仍负责真实状态写入、pending request 同步和 merge 执行。
- 复用现有 `applyThreadDetailRefreshResponseEffectsPlan()`，并给 response executor
  增加 `sync-pending-server-requests` effect。
- `test/thread-detail-render-plan.test.js` 覆盖 first-paint response effect shape；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 确认
  `loadThread()` 不再内联这串状态写入。

修复边界：

- 症状/风险：成功 first-paint response 的 detail-loaded/evidence/pending/merge 顺序仍
  留在 `loadThread()`，和 refresh response 已有 plan 边界不一致。
- 失败层：前端 first-paint response state/evidence effect ownership，不是 merge
  算法、DOM patch、server projection、任务卡协议或 Home AI diagnostic intake。
- 闭环验证：focused tests 证明 plan 顺序与 app wiring；完整检查通过后再随 Phase A
  模块批量部署。

## 2026-06-27 Local Phase A Full-Backfill Response Effects Slice

这个本地小切片继续 Phase A 的 successful detail API response ownership 收敛。
`backfillFullThreadDetail()` 此前已经把 post-merge、post-render 和 telemetry
顺序交给 plan helper，但 API 返回后的 detail-loaded/evidence/pending/merge 顺序
仍直接写在 `public/app.js` 里。这样 full-backfill 与 first-paint/refresh response
仍有一套独立状态写入路径。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFullBackfillResponseEffects()`，声明 detail-loaded 标记、render
  evidence 记录、pending server requests 同步和 current-thread merge 顺序。
- `public/app.js` 的 `backfillFullThreadDetail()` 成功路径改为执行这个 response
  effects plan；app 层仍负责真实状态写入、pending request 同步和
  `mergeThreadPreservingVisibleItems()` 执行。
- 复用现有 `applyThreadDetailRefreshResponseEffectsPlan()`，不增加新的 fallback、
  不改变 full-backfill read strategy、scroll、DOM patch、server projection、
  Home AI diagnostic intake、任务卡协议或 shell/cache。
- `test/thread-detail-render-plan.test.js` 覆盖 full-backfill response effect shape；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 确认
  `backfillFullThreadDetail()` 不再内联这串状态写入。

修复边界：

- 症状/风险：full-backfill successful response 的 detail-loaded/evidence/pending/merge
  顺序仍留在 `backfillFullThreadDetail()`，和 refresh/first-paint response 已有 plan
  边界不一致。
- 失败层：前端 full-backfill response state/evidence effect ownership，不是 full
  read/backfill 策略、merge 算法、DOM patch、server projection、任务卡协议或
  Home AI diagnostic intake。
- 闭环验证：focused tests 证明 plan 顺序与 app wiring；完整检查通过后再随 Phase A
  模块批量部署。

## 2026-06-27 Local Phase A Full-Backfill Performance Input Slice

这个本地小切片继续 Phase A 的 full-backfill telemetry ownership 收敛。此前
`threadDetailFullReadyEventFields()` 已经负责生成 bounded
`thread_detail_full_ready` payload，post-render 和 telemetry side-effect 顺序也已经由
`thread-detail-render-plan` 声明，但 `backfillFullThreadDetail()` 仍在
`public/app.js` 中手写 full-ready input 的 timing 字段选择。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailFullBackfillPerformanceInput()`，只接收 app 层测得的
  API/render/merge/composer/thread-list/conversation/post-render timings，并返回
  `threadDetailFullReadyEventFields()` 的 bounded input。
- `public/app.js` 的 `backfillFullThreadDetail()` 改为调用该 plan helper，再把
  planned input 交给 `threadPerformanceMetrics.threadDetailFullReadyEventFields()`。
- `test/thread-detail-render-plan.test.js` 覆盖 full-backfill input shape；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 确认
  `backfillFullThreadDetail()` 不再内联 full-ready input 字段选择。
- 不改变 full-backfill read strategy、最终 performance payload 构造、
  response diagnostics、DOM patch、scroll、Home AI diagnostic intake、任务卡协议或
  shell/cache。

修复边界：

- 症状/风险：refresh 和 first-paint 的 performance input 字段选择已经计划化，但
  full-backfill 仍手写在 `app.js`，未来容易造成 cold/warm path 证据字段漂移。
- 失败层：前端 full-backfill performance input ownership，不是 telemetry sink、
  server projection、full-read 策略或最终 bounded payload 构造。
- 闭环验证：focused tests 证明 input shape 和 app wiring；完整检查通过后再随
  Phase A 模块批量部署。

## 2026-06-27 Local Phase A Refresh Render Input Slice

这个本地小切片开始收敛 `refreshCurrentThread()` 的 render/patch 编排输入口径。
此前 `planThreadDetailRefreshRender()` 已经负责 metadata-only、local patch 和
full render 的选择，但 `public/app.js` 仍直接决定哪些 signature、DOM turn count、
single-thread surface 状态和 visible shape 进入这个计划。这样未来修改 app 编排时
仍可能让 render-plan 输入字段漂移。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshRenderInput()`，负责从 app 层采集到的事实中选择并规范化
  refresh render plan 输入字段。
- `public/app.js` 的 `refreshCurrentThread()` 主路径改为先生成
  `refreshRenderInput`，再调用 `planThreadDetailRefreshRender(refreshRenderInput)`。
- helper 支持从 `nextVisibleShape.visibleTurnCount` 取 visible count，也保留
  显式 `nextVisibleTurnCount` 的兼容入口，现有 harness 和直接调用不受影响。
- `test/thread-detail-render-plan.test.js` 覆盖 input shape 和显式 count 优先级；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 确认
  `refreshCurrentThread()` 不再直接手写 render-plan 输入字段。
- 不改变 refresh API、merge、render/patch 判定结果、DOM patch、scroll、Home AI
  diagnostic intake、任务卡协议或 shell/cache。

修复边界：

- 症状/风险：render/patch 决策 helper 已存在，但 refresh render input 字段选择仍在
  `app.js`，容易造成 full-render/local-patch 判定事实口径漂移。
- 失败层：前端 refresh render input ownership，不是 DOM patch executor、merge
  算法、server projection 或最终 render outcome。
- 闭环验证：focused tests 证明 input helper 和 app wiring；完整检查通过后再随
  Phase A 模块批量部署。

## 2026-06-27 Local Phase A Refresh Patch Execution Stage Slice

这个本地小切片继续收敛 `refreshCurrentThread()` 的 patch 编排。此前
`planThreadDetailRefreshPatchExecution()` 已经能判断是否尝试 tile-pane patch、
是否允许 single-thread local patch，以及 metadata-only tile miss 是否只更新
metadata；`planThreadDetailRefreshPatchAttemptEffects()` 也已经拥有真实 patch
attempt 的 effect 顺序。但 `public/app.js` 仍直接把 `renderPlan.canPatch`、
`patchSurfacePlan.tileSurfaceRefresh` 和 `tryTilePanePatch` / `tryLocalPatch`
串起来，导致 patch execution 到 attempt effects 的组合仍留在 app 编排层。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchExecutionStage()`，负责从 `renderPlan` 和
  `patchSurfacePlan` 生成 `patchExecutionPlan` 与 `patchAttemptEffectsPlan`。
- `public/app.js` 的 `refreshCurrentThread()` 改为调用这个 stage helper；
  app 层仍只负责真实 DOM surface probe、真实 tile/single patch attempt、metadata
  write/full render 和 telemetry side effects。
- `test/thread-detail-render-plan.test.js` 覆盖 stage helper 的 patchable 与 tile
  surface 场景；`test/mobile-viewport.test.js` 和
  `test/conversation-render.test.js` 确认 `refreshCurrentThread()` 不再直接手写
  `canPatch`、`tileSurfaceRefresh`、`tryTilePanePatch`、`tryLocalPatch` 的组合。
- 不改变 refresh API、DOM patch executor、render outcome、scroll、Home AI
  diagnostic intake、任务卡协议或 shell/cache。

修复边界：

- 症状/风险：patch execution 与 attempt effects 已经分别计划化，但中间组合仍在
  `app.js`，未来修改 tile/single patch 条件时容易让 effect 顺序和执行条件漂移。
- 失败层：前端 refresh patch execution stage composition ownership，不是 DOM patch
  executor、server projection、merge 算法或最终 render outcome。
- 闭环验证：focused tests 证明 stage helper 和 app wiring；完整检查通过后再随
  Phase A 模块批量部署。

## 2026-06-27 Local Phase A Refresh Patch Result Diagnostic Stage Slice

这个本地小切片继续收敛 `refreshCurrentThread()` 的 patch attempt 结果和
diagnostic 组合边界。此前 patch attempt 的聚合、result 规划和 local rejection
diagnostic 规划分别已经在 `public/thread-detail-render-plan.js` 中，但
`public/app.js` 仍直接把 `patchAttempt` 拆成 result input、判断是否需要
`visibleConversationShape()`、再拼 diagnostic effects。

本次切片新增/调整：

- `public/thread-detail-render-plan.js` 新增
  `planThreadDetailRefreshPatchAttemptResultStage()`，负责从 `patchAttempt` 生成
  `patchAttemptResult`、判断是否需要 local-rejection visible-shape evidence，并在
  evidence 可用后生成 diagnostic plan/effects。
- `public/app.js` 的 `refreshCurrentThread()` 改为调用 result-stage helper；只有
  helper 明确要求时才采集 previous/current visible shape，避免给普通 refresh 热路径
  增加额外 shape 遍历。
- `test/thread-detail-render-plan.test.js` 覆盖 result-stage 的 shape request 和
  diagnostic effects；`test/mobile-viewport.test.js` 与
  `test/conversation-render.test.js` 确认 `refreshCurrentThread()` 不再直接调用
  patch result / rejected diagnostic subhelpers。
- 不改变 patch attempt executor、render outcome、DOM patch、scroll、Home AI
  diagnostic intake、任务卡协议或 shell/cache。

修复边界：

- 症状/风险：patch attempt result 与 local rejection diagnostic 都已经计划化，但
  中间组合仍在 `app.js`，未来容易让 rejection 证据字段、shape 采集条件和 effect
  顺序漂移。
- 失败层：前端 refresh patch result/diagnostic stage composition ownership，不是
  DOM patch executor、server projection、merge 算法或最终 render outcome。
- 闭环验证：focused tests 证明 result-stage helper 和 app wiring；完整检查通过后再随
  Phase A 模块批量部署。

## 2026-06-26 Local Phase B Server Timing Classifier

这个本地切片继续 Phase B 的大 session / thread-detail cold path 收敛，但只处理
服务端诊断证据口径，不改变线程详情读取策略、不改变 projection cache、不改变前端
渲染，也不 bump PWA shell/cache。生产当前仍以最近一次部署版本为准，后续如果把这个
诊断口径与更多 runtime 优化合并成完整模块，再统一部署验证。

本次切片新增/调整：

- `adapters/thread-detail-performance-service.js` 的 `classifyThreadDetailPhase()`
  不再只依赖 `readMode` 字符串。它会优先使用已有 bounded 字段：
  `readDecision`、`projectionState`、`projectionSource` 和
  `projectionSeedStatus`。
- 当 `readMode` 为空或过于泛化时，服务端仍能把一次 thread detail 读分类为
  `warm-projection-cache`、`warm-projection-dynamic`、
  `warm-projection-partial`、`bounded-large-thread-window`、
  `cold-turns-list-initial-seeded-partial`、`cold-thread-read-raw`、
  `cold-thread-read`、`fallback-turns-list` 或 `fallback-summary`。
- `thread-detail-active-read-policy-service` 现在集中判断 active/running summary
  为什么要求 full `thread/read`，并把这个原因写入 diagnostics：
  `activeFullReadRequired` 和 `activeFullReadReason`。这只解释为什么 recent partial
  projection / large bounded turns-list 被跳过，不改变现有 correctness 规则。
- `test/thread-detail-performance-service.test.js` 增加 read-decision-only
  分类覆盖、active full-read reason 覆盖，以及 seeded initial window 诊断不泄露
  turn id、消息正文等私有内容的隐私边界测试。
- `test/thread-detail-read-orchestration-service.test.js` 覆盖 active turn id 和
  active status 两种 full-read bypass reason。
- `test/thread-detail-active-read-policy-service.test.js` 覆盖 idle/recent 允许
  partial projection、active turn/status 禁止 partial、以及 active 状态压制 large
  bounded turns-list 的策略边界。
- `services/thread-detail/thread-detail-active-window-overlay-policy-service.js` 新增 active-window overlay
  资格判定：只有 active turn id、projection window、权威 overlay source、匹配 active
  turn、operation/upload/assistant/receipt 覆盖证据都完整时，才会返回
  `use-projection-overlay`；任何未知、stale 或不匹配都保持 `require-full-read`。
- `test/thread-detail-active-window-overlay-policy-service.test.js` 覆盖完整证据通过、
  缺 active id、缺 projection window、非权威 source、active turn mismatch、未知 item、
  stale assistant delta 和 receipt coverage unknown 的失败闭合。
- `docs/ARCHITECTURE_OPTIMIZATION_PLAN.md` 和 `docs/MODULES.md` 记录这个
  Phase B 证据分类边界。

修复边界：

- 症状/风险：大 session 首屏慢或线程详情缺失时，客户端 first-paint 事件已经有
  `performancePhase`，但服务端 `mobileDiagnostics.threadDetailTimings.phase`
  仍可能因为 `readMode` 稀疏而落到 `unknown`，导致无法判断慢点是在 warm projection、
  bounded turns-list、cold thread/read 还是 summary fallback。
- 失败层：服务端 thread detail timing diagnostics phase ownership。
- 不变量：phase 只能由已有的 bounded enum/status/metadata 推导，不读取或复制消息正文、
  任务卡正文、上传内容、私有路径、URL、cookies、tokens、provider payload 或长日志。
- active full-read reason 是解释性诊断，不是允许跳过 full read 的兜底；下一步如果要优化
  active 大线程首屏，必须另行证明 active turn overlay/operation 中间项不会丢失。
- active-window overlay 计划器目前不接入 runtime；它只定义未来接入前必须满足的证据门槛，
  防止用 partial projection 直接绕过 full read 后重新引入少消息、少命令或重复回执。
- 闭环验证：focused tests 覆盖 sparse readMode 分类和隐私边界；完整检查通过后再把它作为
  Phase B 后续大 session 采样和 runtime 优化的证据基础。

## 2026-06-26 v522 Empty Detail Browser Smoke Harness

v522 给 v520/v521 的 Music 空详情事故补上浏览器/DOM 级回归入口。它不改变线程
detail 权威规则，也不合成内容；它把旧事故的前置条件变成可回放动作，方便用 Home AI
live debug / PWA 视觉核验验证真实页面不会再把空 cached detail 当成最终显示。

本次切片新增/调整：

- Hermes embedded 模式下的 `window.__codexMobileVisualHarness` 新增
  `simulateEmptyCachedDetailOpen(threadId)`。该方法只接受 thread id，先构造
  `turns: [] + mobileDetailLoaded:true` 的当前线程空缓存，再调用真实
  `loadThread(threadId, { source: "visual-harness-empty-cache" })`。
- 新增 `scripts/codex-mobile-empty-detail-cache-smoke.js`，复用 Home AI live debug
  server：进入 Codex iframe，调用上述 harness，检查 DOM 中 `.turn[data-turn]` 已恢复
  且没有停在 `No visible turns.`。
- harness 和 smoke 的返回只包含 `clientBuildId`、`thread_hash`、turn/item 计数、
  loaded/loading/error 标记、read mode 和 DOM 计数；不返回线程标题、消息正文、
  任务卡正文、上传内容、文件路径、URL、cookies、tokens 或长日志。
- `test/mobile-viewport.test.js` 覆盖 harness 暴露、空缓存构造、真实 `loadThread()`
  调用、smoke 脚本入口和隐私边界。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v522`。

## 2026-06-26 v521 Thread Open Cache-Reuse Policy And Diagnostics

v521 在 v520 的 Music 空详情根因修复上继续收敛架构边界：同线程打开时是否允许复用
当前 detail cache，不再由 `public/app.js` 直接拼条件判断，而是由
`public/thread-detail-state.js` 的 `planThreadOpenCacheReuse()` 给出可测试计划。

本次切片新增/调整：

- `public/thread-detail-state.js` 新增 `planThreadOpenCacheReuse()`，返回
  `shouldUseCachedCurrent`、`shouldReportEmptyCachedDetail` 和 bounded `reason`。
- `public/app.js` 的 `loadThread()` 改为消费该计划：非空可复用 detail 走
  `cached-current`；空 `mobileDetailLoaded` detail 被明确阻断并继续走 detail API。
- `public/thread-diagnostic-events.js` 新增
  `empty_cached_detail_reuse_blocked` payload builder。若空 cached detail 试图成为同线程
  打开权威，客户端记录 H2 bounded diagnostic，经 Home AI Owner-gated diagnostic report
  通道进入闭环；正常 cached-current 复用记录 success clear。
- `test/thread-detail-state.test.js`、`test/thread-diagnostic-events.test.js` 和
  `test/conversation-render.test.js` 覆盖策略计划、隐私安全 payload、以及 `loadThread()`
  不再内联缓存权威判断。

修复边界：

- 失败层：frontend thread-open detail cache authority policy。
- 不变量：缓存复用是状态所有权决策，必须由纯策略模块给出 reason；阻断异常空缓存只做
  诊断和继续读取服务端权威 detail，不隐藏、不强制刷新、不合成 turns。
- 诊断只包含 thread hash、read/source kind、turn/item 计数、detail-loaded/reusable 标记；
  不包含线程标题、消息正文、任务卡正文、上传内容、私有路径、URL、cookies、tokens 或长日志。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v521`。

## 2026-06-26 v520 Empty Cached Detail Revalidation

v520 修复 Music 线程在移动端进入后稳定显示 `No visible turns.` 的根因。现场证据显示
服务端 `Music 06-23` detail/projection 仍返回 `10` 个 turns，但客户端已持有一个
`turns: [] + mobileDetailLoaded:true` 的当前线程状态；再次打开同一线程时，
`loadThread()` 走 `cached-current` 短路，直接复用这个空 detail，导致不再请求服务端
权威投影。

本次切片新增/调整：

- `public/thread-detail-state.js` 新增 `threadHasReusableLoadedDetailState()`：只有已加载且
  自身包含非空 turns 的 detail 才能作为打开线程时的可复用缓存。
- `public/app.js` 的 `loadThread()` cached-current 短路改用这个策略；空 `mobileDetailLoaded`
  detail 不能跳过 API，必须重新读取 `/api/threads/:id`。
- 从 thread-list summary 初始化 `state.currentThread` 时先剥离 detail-only 字段，避免列表行
  把 `mobileDetailLoaded`、`mobileReadMode`、`threadTaskCards` 等 detail 权威字段带回当前
  详情状态。
- `test/thread-detail-state.test.js` 和 `test/conversation-render.test.js` 覆盖空 loaded detail
  不可复用、非空 detail 可复用、以及 `loadThread()` 必须消费可复用缓存策略。

修复边界：

- 失败层：frontend thread-detail loaded-state/cache reuse policy。
- 不变量：`mobileDetailLoaded` 只说明某个 detail API 路径曾完成，不能单独证明当前空
  `turns: []` 仍可作为打开线程的权威缓存；打开同一线程的缓存短路必须要求本地 detail
  本身有可显示 turns。
- 这不是刷新兜底。客户端不是发现空态后再补救刷新，而是在缓存复用决策点阻止错误空
  detail 成为权威。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v520`。

## 2026-06-26 v519 Empty Detail Mismatch Diagnostics

v519 在 v518 的 detail ownership 修复之后，继续补齐自动发现能力：如果客户端刚从
detail API 或成功 detail render 得到同一线程的非空 bounded 证据，随后单线程界面又实际
渲染出 `No visible turns.`，客户端会记录 `empty_visible_detail_mismatch` 诊断。

本次切片新增/调整：

- `public/thread-diagnostic-events.js` 新增
  `empty_visible_detail_mismatch` failure/success payload builder。
- `public/app.js` 在 `loadThread()`、`refreshCurrentThread()` 和
  `backfillFullThreadDetail()` 的 detail API 成功路径记录同一线程的 bounded detail 证据。
- `renderCurrentThread()` 在单线程 full render 产生 `No visible turns.` 后，检查最近 detail
  证据；如果同一线程刚有非空 visible turn/item 证据，则通过 Home AI diagnostic reporter
  记录 H2 mismatch。
- 正常非空 detail render 会发送 success clear 输入，避免旧失败签名持续积累。
- `test/thread-diagnostic-events.test.js`、`test/home-ai-diagnostic-reporting.test.js` 和
  `test/conversation-render.test.js` 覆盖 payload、隐私边界、detail API 证据记录和空态
  render 触发点。

修复边界：

- 症状/风险：用户看到 `No visible turns.`，但同一客户端刚读取过该线程的非空 detail
  证据；这类情况必须由客户端自动发现并进入 Home AI Owner-gated 诊断闭环。
- 失败层：frontend render/detail evidence consistency diagnostics。
- 不变量：诊断只能使用 thread hash、read/render mode、source kind、turn/item/dom 计数和
  age bucket 类元数据；不得包含消息正文、任务卡正文、上传内容、私有路径、URL、cookies、
  tokens 或长日志；插件不自动发修复卡。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v519`。

## 2026-06-26 v518 Detail Ownership And Primary Shell Diagnostics

v518 延续 v517 的根因修复，把同一类事故纳入 Home AI 诊断闭环，并修正一个新的
Music 空线程根因。v517 已经阻止 Hermes embedded/mobile 恢复路径在有线程打开意图时
渲染 Primary 空壳；v518 额外记录最近一次成功 thread detail 渲染证据，并在重复出现
“Primary shell 抢占线程 detail”或“成功 detail 后短时间内又渲染 `threadId=""` 空壳”时，
通过现有 `homeai.diagnostic.report` 通道上报 bounded metadata。

本次切片新增/调整：

- `public/thread-detail-state.js` 收紧 loaded-detail 判定：空 `turns: []` 只有在真实
  detail API 成功后带有 `mobileDetailLoaded` 客户端内部标记时，才允许作为已加载空线程；
  `runtimeSettings`、`threadTaskCards`、`mobileReadMode` 等元数据不能再让列表摘要壳绕过
  summary-only recovery。
- `public/app.js` 在 `loadThread()`、`refreshCurrentThread()` 和
  `backfillFullThreadDetail()` 的 detail API 成功路径设置 `mobileDetailLoaded`，并继续把该
  标记从 thread-list summary 中剥离，防止列表刷新把空壳写回当前 detail。
- `public/thread-diagnostic-events.js` 新增
  `primary_shell_selection_conflict` 事件和 success clear 输入。
- `public/app.js` 记录最近成功 thread detail 渲染证据：thread hash、read mode、
  visible turn/item count、item count、source kind 和时间窗口。
- `showHermesPluginPrimaryPage()` 的非强制抢占被抑制时，记录
  `primary_shell_suppressed_thread_open` 诊断失败；强制的用户/路由 Primary 操作会清除
  最近 detail 证据，避免误报。
- `updateConversationHtml()` 在 embedded Primary 空壳实际渲染后检查最近 detail 证据，
  若仍在 30 秒窗口内则记录 `primary_shell_render_after_detail`。
- `test/thread-diagnostic-events.test.js`、`test/home-ai-diagnostic-reporting.test.js` 和
  `test/conversation-render.test.js` 覆盖 payload、隐私边界和 app 触发点。

修复边界：

- 症状/风险：服务端 detail 已成功返回并渲染过，但前端后续仍可能被恢复路径切到
  Primary 空壳；或者当前线程对象被列表摘要/任务卡元数据污染成 `turns: []`，用户看到
  `No visible turns.`。
- 失败层：frontend selection/render/detail-loaded ownership。
- 不变量：只有 detail API 成功返回才拥有“已加载空线程”的语义；同类冲突必须被客户端
  自动发现并通过 Home AI Owner-gated diagnostic channel
  形成可追踪 case；插件只上报 bounded evidence，不自动发修复卡。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v518`。

## 2026-06-26 v517 Embedded Thread Selection Ownership

v517 修复 Music/Home AI 嵌入场景里“服务端 detail 有 turns，但移动端进入后只看到
空壳或一个旧回执”的状态所有权问题。生产证据显示 Music
`/api/threads/019ef42b-2cb8-7332-ab17-033ec5b48947?mode=recent` 仍返回
`10` 个可见 turns，失败层不是 session 数据缺失，而是前端在 workspace/thread-list
恢复过程中把当前线程意图误判为空，渲染了 Hermes 插件 Primary shell。

本次切片新增/调整：

- 新增 `hasThreadDetailSelectionIntent()` / `shouldRenderPrimaryConversationShell()`：
  只要存在 `currentThreadId`、thread detail load controller、startup open intent 或
  当前 detail state，就禁止列表/Workspace 加载路径重画 Primary 空壳。
- `restoreThreadSelection()` 在已有线程打开意图时直接退出；Hermes embed 只有在确实
  没有线程意图时才回到 Primary。
- `showHermesPluginPrimaryPage()` 增加非强制调用保护，并记录
  `plugin_primary_suppressed_thread_open` bounded 事件，防止线程打开过程中被恢复路径
  清空选择。
- 将 v4 projection merge policy 从 `public/app.js` 拆到
  `public/thread-detail-v4-merge-state.js`，并接入 HTML、Service Worker、server
  build-id 文件清单。
- 新增 `test/thread-detail-v4-merge-state.test.js`，并更新 mobile/route/conversation
  tests，覆盖 Primary 空壳防回退和 v4 projection merge 不变量。

修复边界：

- 症状/风险：生产 detail 已有可见 turns，前端却渲染 `threadId=""` 的空 conversation
  shell，用户看到历史 turn 消失或被旧回执遮挡。
- 失败层：Hermes embedded/mobile resume 与 thread-list restore 的 current-thread
  selection ownership。
- 不变量：有明确线程打开意图时，任何列表、Workspace 或嵌入恢复路径都不能清空当前
  thread selection，也不能渲染 Primary shell。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v517`。

## 2026-06-26 v516 V4 Projection Empty-Merge Authority

v516 修正 v515 后继续复核发现的真实路径缺口：Music 生产 detail read mode 是
`projection-v4-dynamic`，而 v515 的空 incoming guard 只覆盖了通用
`thread-detail-merge-state` path。v4 projection 在 `public/app.js` 中仍有专门
merge path，因此同一个“不允许空 incoming detail 擦掉已有可见 detail”的不变量
必须在 v4 path 中显式覆盖。

本次切片新增/调整：

- `mergeV4ProjectionThread()` 在处理 `incomingThread.turns` 时计算 existing 与
  incoming 的 visible weight。
- 当 incoming 是空 `turns: []`、existing 已有可见 turns 且 incoming 可见权重为
  0 时，保留 existing turns，并继续接收 incoming 的 bounded metadata，例如
  `mobileReadMode` 和 projection revision。
- `test/conversation-render.test.js` 增加 v4 projection 空 incoming 回归测试，
  覆盖 Music 这类真实 `projection-v4-dynamic` detail merge 路径。

修复边界：

- 症状/风险：真实生产路径使用 v4 projection merge 时，通用 merge guard 可能无法
  阻止空 incoming projection window 擦掉已有可见 detail。
- 失败层：前端 v4 projection merge authority。
- 不变量：所有 detail merge path，包括 v4 projection path，都必须遵守同一条
  visible detail 强度规则。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v516`。

## 2026-06-26 v515 Detail Merge Authority And Early Shell Plan

v515 继续修复 Music `Music 06-23` 详情页空白问题。现场证据显示：
`/api/threads/019ef42b-2cb8-7332-ab17-033ec5b48947?mode=recent` 返回
`10` 个 turn 且每个 turn 都有可见 item，但移动端截图进入了
`No visible turns.` 空状态。失败层不是 Music session 没内容，而是前端
thread-detail state 合并和渲染编排边界。

本次切片新增/调整：

- `public/thread-detail-merge-state.js` 增加 merge invariant：空 `turns: []`
  的 incoming detail 不能擦掉已有更强的可见 detail state。
- `test/thread-detail-merge-state.test.js` 覆盖“已有可见 turns + incoming 空 detail”
  的回归场景，防止线程刷新或投影窗口偶发空结果把页面稳定改成空白。
- `public/thread-detail-render-plan.js` 新增 `planSingleThreadEarlyShellExecution()`，
  将 loading / load-error 的 terminal shell 执行计划移出 `public/app.js`。
- `public/app.js` 只执行 helper 计划：清空 operation dock、更新 conversation HTML、
  绑定 retry、刷新 tick/nav，不再内联判断 loading/error shell。

修复边界：

- 症状/风险：线程列表 summary 或一次空 incoming detail 会覆盖已经存在的可见
  conversation detail，导致服务端实际有 turns 但前端显示 `No visible turns.`。
- 失败层：前端 thread detail merge authority / single-thread render orchestration。
- 不变量：空 incoming detail 不能证明“真实空线程”，也不能比已有可见 turns 更权威；
  loading/error shell 的分支选择属于 render-plan policy。
- 闭环验证：Music detail 生产读回返回 `10` 个 turn；focused tests 覆盖 merge
  invariant 与 early shell plan。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v515`。

## 2026-06-26 v514 Summary-Only Current Thread Recovery Plan

v514 继续 Phase A 前端状态所有权收敛。v513 已经把 thread-list summary 与
loaded detail 的边界移到 `public/thread-detail-state.js`；本轮继续把
`renderCurrentThread()` 中“summary-only current thread 恢复成 loading shell 并触发
detail refresh”的策略也移入同一个 helper。

本次切片新增：

- `planSummaryOnlyCurrentThreadRecovery()` 判断当前线程是否只是列表摘要壳。
- helper 生成净化后的 loading-shell thread state，而不是由 `public/app.js` 内联拼装。
- helper 生成 bounded `thread_summary_detail_recovery` 事件字段和是否需要立即
  `summary-detail-recovery` 刷新的意图。
- `public/app.js` 只执行计划：写入 state、发送 bounded client event、调度刷新。

修复边界：

- 症状/风险：同一条 summary-only recovery 规则如果拆散在检测、状态拼装、事件上报和
  刷新调度多个位置，后续修改容易再次让列表摘要进入详情渲染。
- 失败层：前端 thread detail state ownership / render orchestration boundary。
- 不变量：summary-only recovery 是状态所有权策略，不是 UI 空白兜底；它只能把摘要壳
  转成 loading shell 并要求真实详情刷新。
- 闭环验证：`test/thread-detail-state.test.js` 覆盖恢复计划；
  `test/conversation-render.test.js` 覆盖 app 只执行 helper 计划。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v514`。

## 2026-06-26 v513 Thread Summary/Detail State Boundary

v513 是 Phase A 前端状态所有权收敛的继续推进，直接吸收 v511/v512 Music
线程空白事故的根因：线程列表摘要行可能带着 `turns: []` 进入详情渲染路径，
并被误判成已经加载过的 thread detail。

本次切片新增/调整：

- `public/thread-detail-state.js` 现在拥有 thread-list summary 与 loaded detail
  的边界规则。
- 列表摘要进入或合并回 thread list 前，会删除 `turns`、`runtimeSettings`、
  `threadTaskCards`、`mobileReadMode`、`mobileDiagnostics`、projection cursor 等
  detail-only 字段。
- 空 `turns: []` 不再自动代表“已加载空详情”；必须有 read/projection/runtime/task-card
  等详情证据，才算 loaded detail。
- `public/app.js` 只负责真实 state mutation、网络刷新和 render 调度，不再内联维护这组
  ownership policy。

修复边界：

- 症状/风险：列表摘要字段污染会导致详情页稳定显示 `No visible turns.`，即使
  `/api/threads/:id?mode=recent` 实际返回了完整 recent window。
- 失败层：前端 thread-list/detail state ownership。
- 不变量：列表摘要只能提供标题、状态、工作区和计数类元数据，不能拥有或证明
  conversation detail state。
- 闭环验证：`test/thread-detail-state.test.js` 增加行为测试；
  `test/conversation-render.test.js` 验证 `app.js` 只委托 helper。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v513`。

## 2026-06-26 v507 Phase A Refresh/Patch Module Deploy

v507 把 v506 之后累积的 Phase A `refreshCurrentThread()` 编排优化作为一个
完整模块部署，而不是继续按小切片部署。这个模块的目标是把线程详情刷新、
tile/single surface 判定、local patch 尝试、DOM patch 事务、completion
snapshot、性能字段和诊断字段的所有权从 `public/app.js` 主状态机中收敛到
纯 helper 和可测试执行边界里。

本次模块边界包含：

- `public/thread-detail-render-plan.js`：请求规划、patch surface/attempt、
  outcome execution、performance input、completion effects、post-merge effects。
- `public/thread-detail-patch-plan.js`：local patch preflight、可见项/turn
  patch plan、reorder/removal 等拒绝原因。
- `public/thread-detail-dom-patch.js`：可见项 patch、turn patch、keyed DOM
  reconciliation、local patch transaction、commit/post-commit 分层。
- `test/thread-detail-refresh-dom-harness.test.js`：用真实 helper 和轻量 fake DOM
  验证 tile patch 成功终止、single-thread local patch 先 commit 再更新 dock、
  local patch 拒绝后进入 full render。

修复边界：

- 症状/风险：客户端和服务端投影显示长期存在少消息、重复消息、全量刷新和
  局部 patch 顺序不稳定等风险，`refreshCurrentThread()` 过多内联策略会让
  类似问题反复回归。
- 失败层：前端 thread detail refresh/patch ownership。
- 不变量：本模块不改变 server projection 语义、Home AI 诊断上报策略、
  task-card 协议、图片投影规则或平铺视觉布局。
- 闭环验证：Phase A focused tests、完整 `npm test`、`npm run check`、
  `npm run check:macos`、`git diff --check` 全部通过。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v507`。
部署后生产 `/api/public-config` 读回为
`clientBuildId=0.1.11|codex-mobile-shell-v507`、
`shellCacheName=codex-mobile-shell-v507`。

## 2026-06-26 v506 Thread Refresh Post-Merge Effects Plan

v506 继续 Phase A 的 `refreshCurrentThread()` 编排收敛。v505 已经把
tile/single patch surface 判定移到 `public/thread-detail-render-plan.js`；
本次继续把 refresh 合并后的固定副作用顺序移到同一个 planning helper。

本次切片新增：

- `planThreadDetailRefreshPostMergeEffects()` 固定声明三组 refresh 合并后
  副作用：thread-list merge、composer/active-turn 同步、thread-list render。
- `refreshCurrentThread()` 只执行 effect 名称对应的真实副作用，不再内联决定
  `mergeThreadIntoThreadList()`、`renderComposerSettings()`、
  `syncActiveTurnFromThread()`、`renderThreads()` 的顺序。
- `mergeMs`、`composerRenderMs`、`threadListRenderMs` 的计时边界保持原语义：
  `mergeMs` 仍覆盖 state merge 到列表合并完成，后两项仍分别覆盖 composer/active-turn
  和线程列表渲染。

修复边界：

- 症状/风险：v505 后 refresh 请求、surface、patch、outcome 和 completion effects
  均已 helper-owned，但 post-merge 的固定副作用顺序仍散落在 app 主状态机内。
- 失败层：前端 thread detail refresh post-merge side-effect ownership。
- 不变量：本次不改变 server projection、DOM patch、full-render fallback、滚动策略、
  诊断 transport、任务卡协议、平铺布局或视觉表现。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 post-merge group 顺序；
  `test/mobile-viewport.test.js` 和 `test/conversation-render.test.js` 验证
  `refreshCurrentThread()` 委托给 helper 且不再内联旧顺序。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v506`。

## 2026-06-26 v505 Thread Refresh Patch Surface Plan

v505 继续 Phase A 的 `refreshCurrentThread()` surface selection 收敛。v504
已经把 refresh 请求规划移到 `public/thread-detail-render-plan.js`；本次继续把
tile/single patch surface 判定从 app 主状态机移到同一个 planning helper。

本次切片新增：

- `planThreadDetailRefreshPatchSurface()` 统一判断是否需要 probe tile pane
  surface，以及当前 refresh 是否属于 tile surface。
- `refreshCurrentThread()` 只读取当前 UI 状态、执行真实 DOM surface probe，然后把
  `tileSurfaceRefresh` 从 helper plan 传入 patch execution plan。
- `state.threadTileMode`、`isThreadTileConversationSurface()`、`tilePatchPlan.surface`
  的组合判断不再内联在 app 状态机里。

修复边界：

- 症状/风险：v504 后 request、render、patch execution、patch result、
  outcome execution 都已 helper-owned，但 tile/single surface selection 仍在
  `refreshCurrentThread()` 内联，继续扩大主状态机的分支面。
- 失败层：前端 thread detail refresh patch surface ownership。
- 不变量：本次不改变 DOM probe、tile pane patch、single-thread patch、full-render
  fallback、server projection、诊断 transport、任务卡协议或视觉布局。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 tile mode、
  tile pane surface、single-thread surface 和 metadata-only 情况；
  `test/mobile-viewport.test.js` 验证 app 委托给 helper，且不再内联
  `tilePatchPlan.surface === "thread-tile-pane"`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v505`。

## 2026-06-26 v504 Thread Refresh Request Plan

v504 继续 Phase A 的 `refreshCurrentThread()` 编排收敛。v503 已经把
refresh 失败诊断 payload 从 catch 分支移出；本次继续把 refresh 请求模式、
query、timeout 和旧 controller abort 决策移到
`public/thread-detail-render-plan.js`。

本次切片新增：

- `planThreadDetailRefreshRequest()` 统一生成 refresh 请求计划。
- app 主状态机只执行计划：缺少当前线程则返回，有旧 refresh controller 则按计划
  abort，API 请求使用计划里的 `requestedMode`、`query` 和 `timeoutMs`。
- recent/full 模式选择、`mode=recent` query、source 截断、threadLoadSeq 快照和
  active refresh abort 意图都有 focused tests。

修复边界：

- 症状/风险：v503 后 `refreshCurrentThread()` 仍直接承载请求模式选择和 abort
  条件，和后续 render/patch/diagnostic planning 边界不一致。
- 失败层：前端 thread detail refresh request/abort planning ownership。
- 不变量：本次不改变请求 URL 语义、timeout 值、AbortController 实际执行、错误处理、
  server projection、DOM patch、任务卡协议、诊断 transport 或视觉布局。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 request plan；
  `test/mobile-viewport.test.js` 验证 app 委托给 helper 且不再内联 requestedMode
  三元判断。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v504`。

## 2026-06-26 v503 Thread Refresh Failure Diagnostic Event

v503 继续 Phase A 的前端 thread detail ownership 收敛。v502 已经把
refresh 成功后的 completion effects 从 `refreshCurrentThread()` 尾部移出；
本次继续把 refresh 失败时的 Home AI diagnostic payload 移到
`public/thread-diagnostic-events.js`。

本次切片新增：

- `threadDetailRefreshFailedDiagnosticEvent()` 统一生成
  `thread_detail_refresh_failed` 失败 payload。
- `refreshCurrentThread()` catch 分支只负责读取真实错误、duration bucket、
  status code 和 thread hash，然后调用 helper。
- 诊断 payload 的 category、diagnostic type、severity、context、counts 和
  breadcrumbs 不再内联在 app 状态机里。

修复边界：

- 症状/风险：v502 已经把成功收尾副作用计划化，但失败诊断 payload 仍在
  `refreshCurrentThread()` catch 分支硬编码，和其它 projection/render 诊断
  payload ownership 不一致。
- 失败层：前端 thread detail refresh failure diagnostic ownership。
- 不变量：本次不改变 refresh 请求、abort 逻辑、错误重新抛出、诊断类别、
  上报 transport、server projection、DOM patch、task-card 协议或视觉布局。
- 闭环验证：`test/thread-diagnostic-events.test.js` 覆盖失败 payload 和隐私边界；
  `test/mobile-viewport.test.js` / `test/conversation-render.test.js` 验证 app
  catch 分支委托给 helper，且不再内联 `thread_detail_refresh_failed` payload。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v503`。

## 2026-06-26 v502 Thread Refresh Completion Effects Plan

v502 继续 Phase A 的前端 render/patch ownership 收敛。v501 已经把
`thread_refresh_ms` 的 performance input 组装交给
`public/thread-detail-render-plan.js`；本次继续缩小 `refreshCurrentThread()`
对刷新完成后收尾副作用的内联硬编码。

本次切片新增：

- `planThreadDetailRefreshCompletionEffects()` 统一规划 refresh 成功后的
  completion effects。
- helper 产出三个既有动作：清除 `thread_detail_refresh_failed` 诊断、
  安排 usage backfill refresh、安排 live poll。
- `refreshCurrentThread()` 不再自己硬编码成功诊断 payload 和两个 scheduler
  调用，只负责执行 helper 产出的 effect。
- app 层新增 `applyThreadDetailRefreshCompletionEffect()`，只执行真实副作用，
  不决定哪些完成动作应该发生。

修复边界：

- 症状/风险：v499-v501 已经把 patch telemetry、consistency check 和
  performance input 外移，但 refresh 完成后的诊断/轮询/usage backfill
  收尾仍直接散落在 app 状态机尾部。
- 失败层：前端 thread detail refresh completion side-effect ownership。
- 不变量：本次不改变真实 DOM patch、render、server projection、诊断类别、
  轮询时机、usage backfill 行为、task-card 协议或视觉布局。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 completion effects；
  `test/mobile-viewport.test.js` / `test/conversation-render.test.js` 验证 app
  通过 `completionPlan.effects` 执行，而不是在 `refreshCurrentThread()` 结尾
  直接硬编码成功诊断 payload。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v502`。

## 2026-06-26 v501 Thread Refresh Performance Input Plan

v501 继续 Phase A 的前端 render/patch ownership 收敛。v500 已经把
projection-consistency check 的执行计划交给
`public/thread-detail-render-plan.js`；本次继续缩小 `refreshCurrentThread()`
对 `thread_refresh_ms` performance input 的内联组装。

本次切片新增：

- `planThreadDetailRefreshPerformanceInput()` 统一组合 refresh performance
  输入字段。
- helper 从 `renderPlan`、`renderOutcome` 和 `patchAttemptResult` 中提取
  `detailRenderMode`、`refreshRenderAction`、`detailPatchMs`、
  `patchRejectReason`、patch success flags 和 skip 状态。
- `refreshCurrentThread()` 不再自己维护 `detailRenderMode`、
  `refreshRenderAction` 或 `detailPatchMs` 这类 performance-input 策略变量；
  它只测量真实耗时并把结果交给 helper。
- `thread-performance-metrics.js` 仍负责最终事件字段的 bounded 输出。

修复边界：

- 症状/风险：v499/v500 已经把 patch telemetry 和 consistency check 外移，
  但 app 层仍手工拼接 performance input，容易让 render outcome、patch
  result 和 `thread_refresh_ms` 诊断字段再次漂移。
- 失败层：前端 thread detail refresh performance-input ownership。
- 不变量：本次不改变真实 DOM patch、render、server projection、
  performance event 名称、diagnostic 传输、task-card 协议或视觉布局。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖
  `planThreadDetailRefreshPerformanceInput()`；`test/mobile-viewport.test.js` /
  `test/conversation-render.test.js` 验证 app 层通过
  `refreshPerformanceInput` 调用 `threadDetailRefreshEventFields()`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v501`。

## 2026-06-26 v500 Thread Refresh Consistency Check Plan

v500 继续 Phase A 的前端 render/patch ownership 收敛。v499 已经把
patch telemetry 字段归一交给 `public/thread-detail-render-plan.js`；本次继续
缩小 `refreshCurrentThread()` 对 projection-consistency check 的内联判断。

本次切片新增：

- `planThreadDetailRefreshConsistencyCheck()` 统一规划是否需要执行
  projection consistency check。
- `planThreadDetailRefreshOutcomeExecution()` 现在输出 `consistencyCheck`
  对象，包含 `shouldCheck`、`phase`、`renderMode` 和 reason。
- `refreshCurrentThread()` 不再自己从 `executionPlan.projectionConsistencyPhase`
  拼接 `checkConversationProjectionConsistency()` 参数，只消费 helper 输出。
- `full-render` 的 consistency phase 仍由 helper 显式规划为
  `refresh-full-render`。

修复边界：

- 症状/风险：v498/v499 已经把 refresh execution 和 patch telemetry 外移，
  但 app 层仍直接判断 `projectionConsistencyPhase` 并拼接 `renderMode`，
  让 consistency check 的执行条件继续散落在 app 状态机里。
- 失败层：前端 thread detail refresh consistency-check ownership。
- 不变量：本次不改变实际 DOM patch、render、projection、diagnostic payload
  或 task-card 协议；只是把一致性检查的执行计划交给纯 helper。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖
  `consistencyCheck` 和 missing-phase skip；`test/mobile-viewport.test.js` /
  `test/conversation-render.test.js` 验证 app 层消费
  `executionPlan.consistencyCheck`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v500`。

## 2026-06-26 v499 Thread Refresh Patch Telemetry Plan

v499 继续 Phase A 的前端 render/patch ownership 收敛。v498 已经让
refresh outcome execution 使用显式 `executionAction`；本次继续缩小
`refreshCurrentThread()` 对 patch attempt telemetry 的内联记账。

本次切片新增：

- `planThreadDetailRefreshPatchAttemptResult()` 现在同时归一
  `detailPatchMs`、`patchTimingSource` 和 `patchRejectReason`。
- tile-pane patch 成功时记录 tile patch 耗时；local patch 成功或 rejected
  时记录 local patch 耗时。
- local patch rejected 的 reason 由 helper 归一并限制长度，app 层只负责
  补 visible shape count 并调用既有 bounded diagnostic 事件。
- metadata-only tile miss 保持 quiet，不产生 patch rejection reason，也不把
  tile miss 尝试耗时写入 `detailPatchMs`。

修复边界：

- 症状/风险：v497/v498 已经把 patch attempt result 和 outcome execution
  外移，但 `refreshCurrentThread()` 仍直接决定哪个 patch duration 进入
  performance payload，以及 rejected reason 如何归一。这个记账路径会影响
  `thread_refresh_ms` 和 Home AI projection mismatch 诊断，属于高复发状态机边界。
- 失败层：前端 thread detail refresh patch telemetry ownership。
- 不变量：本次不改变真实 DOM patch 调用、server projection、task-card 协议、
  诊断传输或视觉布局；只是把 patch telemetry 字段归一交给纯 helper。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 tile/local timing、
  local rejected reason 和 metadata tile miss；`test/mobile-viewport.test.js` /
  `test/conversation-render.test.js` 验证 app 层消费 helper 输出的
  `detailPatchMs` 与 `patchRejectReason`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v499`。

## 2026-06-26 v498 Thread Refresh Outcome Execution Action Plan

v498 继续 Phase A 的前端 render/patch ownership 收敛。v497 已经把
tile/local patch attempt 的结果解释交给
`public/thread-detail-render-plan.js`；本次继续缩小 `refreshCurrentThread()`
在 outcome 之后的执行分支。

本次切片新增：

- `planThreadDetailRefreshOutcomeExecution()` 现在输出显式
  `executionAction`。
- `metadata-effects` 表示执行 helper 规划出的 metadata effect 序列。
- `full-render` 表示执行完整 `renderCurrentThread()`。
- `none` 表示 tile-pane patch 等终态结果不需要额外 DOM 写入。
- `refreshCurrentThread()` 不再通过 `metadataEffects.length` 或
  `runFullRender` 隐式决定执行路径；未知 action 会 fail-fast。

修复边界：

- 症状/风险：outcome execution 已经输出 metadata effect 序列，但 app 层仍用
  “metadataEffects 是否为空”作为执行分支，这会让 metadata-only、local patch、
  full render、tile terminal 的关系再次变成隐式状态机。
- 失败层：前端 thread detail refresh outcome execution ownership。
- 不变量：本次不改变真实 DOM 写入函数、server projection、task-card 协议、
  诊断传输或视觉布局；只是把执行动作选择交给纯 helper。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖
  `executionAction` / `timingTarget`；`test/mobile-viewport.test.js` /
  `test/conversation-render.test.js` 验证 app 层按显式 action 执行。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v498`。

## 2026-06-26 v497 Thread Refresh Patch Attempt Result Plan

v497 继续 Phase A 的前端 render/patch ownership 收敛。v496 已经把
refresh outcome 后的 metadata 副作用组合推进到
`public/thread-detail-render-plan.js`；本次继续缩小 `refreshCurrentThread()`
里对 tile-pane patch、single-thread local patch 和 rejected patch diagnostic
的解释逻辑。

本次切片新增：

- `planThreadDetailRefreshPatchAttemptResult()` 统一解释 tile/local patch
  尝试结果。
- tile pane patch 成功被归一为终态，且优先于 local patch 结果。
- local patch 被尝试但失败时，由 helper 明确输出
  `reportLocalPatchRejected`，app 层只负责采集 visible shape 并发送既有
  bounded diagnostic。
- metadata-only 的 tile miss 不会被误判为 local patch rejection。

修复边界：

- 症状/风险：`refreshCurrentThread()` 仍然在真实 DOM 调用旁边直接解释
  tile 命中、local 命中、local rejected、metadata-only tile miss 等结果，
  这些分支会影响 full-render fallback、projection-consistency phase 和
  Home AI projection-mismatch 诊断，属于高复发状态机边界。
- 失败层：前端 thread detail refresh patch attempt result ownership。
- 不变量：本次不改变真实 DOM patch 调用、server projection、task-card 协议、
  诊断传输或视觉布局；只是把 patch attempt 的结果形状和 rejected 诊断触发
  条件交给纯 helper。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 tile 终态、
  local rejected 和 metadata tile miss；`test/mobile-viewport.test.js` /
  `test/conversation-render.test.js` 验证 app 层消费
  `planThreadDetailRefreshPatchAttemptResult()`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v497`。

## 2026-06-26 v496 Thread Refresh Metadata Effect Plan

v496 回到 Phase A 的前端 render/patch ownership 收敛。v495 已经让
大 session recent detail 的 server 侧 miss reason 和 partial cache 路径更清楚；
本次切片不改 server projection，而是继续缩小 `refreshCurrentThread()` 中的
前端状态机判断面。

本次切片把 refresh outcome 之后的 metadata 副作用组合推进到
`public/thread-detail-render-plan.js`：

- `planThreadDetailRefreshOutcomeExecution()` 现在输出 `metadataEffects`。
- `local-patch` 只执行 header、tick timer、plugin navigation state 更新。
- `metadata-only` 执行 header、live operation dock、tick timer、scroll button
  update。
- `full-render` 仍只触发完整 `renderCurrentThread()`，不混入 metadata-only
  副作用。

修复边界：

- 症状/风险：`refreshCurrentThread()` 已经把 render/patch/outcome/performance
  多个策略外移，但 metadata-only 和 local-patch 的副作用组合仍在 app 函数内
  直接分支，容易在后续修复闪动、少消息、重复消息时重新散落状态所有权。
- 失败层：前端 thread detail refresh outcome execution ownership。
- 不变量：本次只移动副作用组合决策，不改变 DOM 写入函数、projection 读取、
  task-card 协议、诊断上报传输或视觉布局；不引入隐藏重复、强制刷新或跳过
  刷新的兜底。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 metadata effect
  序列；`test/mobile-viewport.test.js` 验证 `refreshCurrentThread()` 消费
  `metadataEffects` 而不是重新内联 mode 分支。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v496`。

## 2026-06-26 v495 Projection Miss Reason Diagnostics

v495 继续推进 Phase B 的大 session / thread-detail cold path 收敛。v494 已经让
`mode=recent` 在首次 `turns-list-initial` 后 seed memory-only partial
projection，并让后续 recent 打开复用 `projection-v4-partial`。本次切片解决
剩余证据缺口：此前 `projectionState=miss` 只能说明“没有命中”，不能说明是
没有 entry、partial 未被允许、签名不可用，还是旧 full cache 已经失效。

本次切片新增：

- `thread-detail-projection-service` 新增 `lookup()`，返回 `{ cached,
  missReason }`，用 bounded reason code 区分 `entry-missing`、
  `partial-not-allowed`、`signature-unavailable`、`static-signature-mismatch`、
  `dynamic-summary-stale`、`dynamic-resting-signature-mismatch` 和
  `dynamic-age-signature-mismatch` 等路径。
- v4 projection wrapper 透传 lookup，并保持 v4 visible projection 输出。
- `thread-detail-read-orchestration-service` 把 lookup miss reason 写入
  `mobileDiagnostics.threadDetailTimings.projectionMissReason`。
- recent partial seed 遇到不可复用的 full cache 时，如果 miss reason 是
  `dynamic-summary-stale` 或签名 mismatch，会删除对应磁盘 full cache 条目，
  避免服务重启后重复读回同一个失效 full projection。可复用 full cache 仍不会
  被 partial 覆盖。

修复边界：

- 症状/风险：生产证据能看到 projection miss，但不能解释 miss 原因；summary
  已更新或签名失效的 full disk cache 可能在重启后继续参与判断，反复干扰
  recent partial warm path。
- 失败层：服务端 projection cache lookup/invalid-full-cache 生命周期所有权。
- 不变量：miss reason 只能是 bounded enum/status，不包含消息正文、任务卡正文、
  上传内容、私有路径、cookie/token、provider payload 或长日志；partial cache
  仍然 memory-only 且只在 explicit `allowPartial` 下返回。
- 闭环验证：`test/thread-detail-projection-service.test.js` 覆盖 lookup miss
  reason、partial-not-allowed、stale full disk cleanup；v4/service/orchestration/
  performance tests 覆盖 wrapper 透传和 diagnostics 输出。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v495`。

## 2026-06-26 v494 Partial Recent Projection Cache

v494 继续推进 Phase B 的大 session / thread-detail cold path 收敛。生产
v493 证据显示：线程列表冷启动后会建立 baseline，后续列表刷新已经走 warm
cache；但多个大 session 的 `mode=recent` 线程详情仍反复落到
`turns-list-initial`，且 `projectionState=miss`。这说明慢点不再主要是列表
baseline 重建，而是 recent 详情窗口没有可复用的 warm projection。

本次切片新增 memory-only partial recent projection：

- `mode=recent` 首次通过 `turns-list-initial` 返回后，只 seed 一个
  `partial: true` / `partialKind: recent-window` 的内存窗口。
- 后续 `mode=recent` 可通过 `allowPartial` 命中 `projection-v4-partial`，
  避免重复调用 app-server 的 `thread/turns/list`。
- 默认 `get()` 不返回 partial cache，完整详情、full projection 和持久化
  projection 仍必须使用完整缓存。
- partial cache 不写入磁盘，且不能覆盖可复用的 full cache；如果旧 full cache
  已经签名失效，则不应阻断 recent partial warm path。
- v4 projection wrapper 透传 `seed/get` 的 partial 选项，避免生产默认 v4
  路径把 recent window 误写成完整 `projection-v4-cache`。

修复边界：

- 症状/风险：大 session recent 详情重复进入仍可能每次走 bounded
  turns-list 初始窗口，首屏体验不稳定。
- 失败层：服务端 thread-detail recent-window warm path 所有权。
- 不变量：partial projection 只代表 recent 可见窗口，不得污染完整线程投影；
  只记录 bounded projection metadata，不记录消息正文、任务卡正文、上传内容、
  私有路径、cookie/token、provider payload 或长日志。
- 闭环验证：`test/thread-detail-projection-service.test.js` 覆盖 partial
  only-on-allow、memory-only、不能覆盖可复用 full cache、可替换失效 full cache；
  `test/thread-detail-projection-v4-service.test.js`
  覆盖 v4 wrapper 的 partial 透传；`test/thread-detail-read-orchestration-service.test.js`
  覆盖 recent miss 后 partial seed，以及 recent partial hit 不触发 app-server
  turns-list/full read。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v494`。

## 2026-06-26 v493 Thread Detail Cold-Path Diagnostics

v493 开始推进 Phase B 的大 session / thread-detail cold path 收敛。本次不改
读取策略，不引入前端兜底，只把服务端线程详情读取链路的关键决策结构化到
`mobileDiagnostics.threadDetailTimings`，方便后续直接判断慢点发生在
projection cache、bounded turns-list、projection seed、full thread/read 还是
summary fallback。

本次切片新增的 bounded 字段包括：

- `readDecision`：本次线程详情使用的读取决策，例如 `projection-hit`、
  `bounded-large-turns-list`、`full-thread-read`、`fallback-turns-list`。
- `projectionState` / `projectionInputAvailable`：区分 projection 输入不可用、
  输入可用但 miss、以及 projection hit。
- `projectionSource` / `projectionVersion` / `projectionAgeMs`：在 projection hit
  时暴露 cache/dynamic、版本和缓存年龄。
- `projectionSeedStatus` / `projectionSeedSource`：区分是否从
  `turns-list-large` 或 `thread-read` 成功 seed projection。

修复边界：

- 症状/风险：此前已有 `phase`、`largeRead*` 和耗时字段，但仍难以从一次
  first-paint 事件判断 projection 是“不可用”还是“miss”，以及 bounded
  turns-list 或 full thread/read 是否成功 seed 了后续 warm cache。
- 失败层：服务端 thread-detail cold-path 诊断字段所有权。
- 不变量：只记录枚举、计数、耗时和 bounded cache 元数据；不记录消息正文、
  任务卡正文、上传内容、私有路径、cookie/token、provider payload 或长日志。
- 闭环验证：`test/thread-detail-performance-service.test.js` 覆盖字段边界和隐私；
  `test/thread-detail-read-orchestration-service.test.js` 覆盖 projection hit/miss、
  large turns-list、summary-sourced large read、full thread/read 和 fallback 分支。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v493`。

## 2026-06-26 v492 Projection Snapshot Planning

v492 继续推进 Phase A 的前端 render/patch ownership 收敛，这次把
`conversationProjectionDiagnosticSnapshot()` 的 tile/single snapshot 规划从
`public/app.js` 推进到 `public/thread-diagnostic-events.js`。

本次切片新增 `conversationProjectionDiagnosticSnapshot()` 纯 helper。它通过
injected callbacks 接收 tile layout、tile ids、tile signature、single-thread
signature 和 visible shape，统一决定 tile-board、single-thread 和 transition
mismatch 三类 projection diagnostic snapshot。`public/app.js` 只负责从真实
DOM/state 读取当前 surface、rendered signature 和 dom shape，再把依赖注入给
helper。

修复边界：

- 症状/风险：v491 已经把 diagnostic payload 拆出，但 snapshot 仍在 `app.js`
  里同时判断 tile/single surface、计算 visible counts、拼 context。后续平铺
  pane、single-thread render 或 transition surface 变化时，snapshot 规则仍可能
  和 payload/report 规则漂移。
- 失败层：前端 conversation projection diagnostic snapshot ownership。
- 不变量：projection snapshot 只产出 bounded signature、context 和 counts；
  不读取消息正文、任务卡正文、上传内容、私有路径、cookie/token 或长日志。
- 闭环验证：`test/thread-diagnostic-events.test.js` 覆盖 tile、single 和
  mismatched transition snapshot；`test/conversation-render.test.js` 验证
  `app.js` wrapper 已委托 helper 并只保留依赖注入。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v492`。

## 2026-06-26 v491 Projection Consistency Diagnostic Event Planning

v491 继续推进 Phase A 的前端 render/patch ownership 收敛，这次把
`checkConversationProjectionConsistency()` 中剩余的 projection mismatch
诊断事件结构也收进 `public/thread-diagnostic-events.js`。

本次切片新增 `renderSignatureMismatchDiagnosticEvent()`、
`renderSignatureMismatchDiagnosticSuccess()`、
`duplicateRenderKeysDiagnosticEvent()` 和
`duplicateRenderKeysDiagnosticSuccess()`，统一生成
`conversation_projection_mismatch/render_signature_mismatch` 与
`conversation_projection_mismatch/duplicate_render_keys` 的 failure/success
输入。`public/app.js` 保留 DOM snapshot、signature 对比触发点、失败计数和
Home AI transport，不再内联这两类诊断事件的 category、diagnostic type、
counts 和 breadcrumbs。

修复边界：

- 症状/风险：v490 已经收敛 patch reject，但 signature mismatch 和 duplicate
  render-key 的 payload 仍在 `app.js` 中手工拼装。后续修改 tile/single
  render consistency 或 snapshot 形状时，诊断事件字段容易再次漂移。
- 失败层：前端 conversation projection consistency diagnostic event ownership。
- 不变量：projection consistency 诊断只记录 bounded context、reason/status
  code、DOM/visible/duplicate/pane 计数；不记录消息正文、任务卡正文、上传内容、
  私有路径、cookie/token 或长日志。
- 闭环验证：`test/thread-diagnostic-events.test.js` 覆盖 signature mismatch、
  duplicate render-key 和 success input；`test/conversation-render.test.js`
  验证 `checkConversationProjectionConsistency()` 已委托 helper，而不再内联
  这两类 payload。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v491`。

## 2026-06-26 v490 Patch-Reject Diagnostic Event Planning

v490 继续推进 Phase A 的前端 render/patch ownership 收敛，这次聚焦
`refreshCurrentThread()` 里 local DOM patch 被拒绝时的 Home AI 诊断事件。

本次切片新增 `public/thread-diagnostic-events.js`，由
`detailPatchRejectedDiagnosticEvent()` 统一生成
`conversation_projection_mismatch/detail_patch_rejected` 的 bounded payload。
`public/app.js` 仍然负责真实刷新、merge、DOM patch、失败计数和 Home AI
transport，但不再内联 category、diagnostic type、counts、context 和
breadcrumbs。`public/home-ai-diagnostic-reporting.js` 同步补齐安全白名单，
确保 `render_plan_reason`、`patch_reject_reason` 和 `previous_count` 这些
bounded reason/count 字段不会在 sanitizer 中被误剥离。

修复边界：

- 症状/风险：此前 patch reject 诊断结构散在 `refreshCurrentThread()`，并且
  sanitizer 没有允许 patch/render reason code。生产上即使记录了
  `detail_patch_rejected`，Home AI 也可能拿不到解释本次拒绝原因的关键字段。
- 失败层：前端 projection/render mismatch 诊断事件字段所有权，以及
  Home AI diagnostic report sanitizer 白名单。
- 不变量：projection mismatch 诊断只能包含 bounded reason code、hash、计数
  和状态字段；不能包含消息正文、任务卡正文、上传内容、私有路径、cookie/token
  或长日志。
- 闭环验证：`test/thread-diagnostic-events.test.js` 覆盖 patch reject payload
  和隐私边界；`test/home-ai-diagnostic-reporting.test.js` 验证 sanitizer 保留
  bounded reason code 并继续剥离不安全字段。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v490`。

## 2026-06-26 v489 First-Paint Performance Event Planning

v489 继续推进 Phase A 的前端 render/patch ownership 收敛，这次把线程详情
首屏和 full-backfill 性能事件的字段口径也收进性能 helper。

本次切片在 `public/thread-performance-metrics.js` 增加
`threadDetailFirstPaintEventFields` 和 `threadDetailFullReadyEventFields`。
两个 helper 统一生成 `thread_detail_first_paint` 和
`thread_detail_full_ready` 的 bounded payload，包括 server timings、
performance phase、client timings、detail shape、read mode、turn 计数、
rollout size、cached/full-ready 状态以及必要的 status / omitted-turn 字段。
`public/app.js` 仍然负责真实线程读取、merge、DOM 渲染和
`postPerformanceEvent()`。

修复边界：

- 症状/风险：v488 已经收敛 `thread_refresh_ms`，但首屏和 full-backfill
  payload 仍在 `loadThread()` / `backfillFullThreadDetail()` 里手工拼装。
  大 session 首屏慢、projection cache 命中、bounded turns-list 首屏和 full
  backfill 补齐需要同一套可测试证据口径，否则冷/热路径分析容易漂移。
- 失败层：前端 thread-detail first-paint/full-ready performance event ownership。
- 不变量：首屏和 full-backfill 性能事件必须由纯 helper 统一生成；事件只包含
  bounded timings、counts、status、reason code，不包含消息正文、任务卡正文、
  上传内容、私有路径、cookie/token 或长日志。
- 闭环验证：`test/thread-performance-metrics.test.js` 覆盖 cached first-paint、
  uncached first-paint、full-ready payload 和隐私边界；`test/mobile-viewport.test.js`
  与 `test/conversation-render.test.js` 验证 `loadThread()` /
  `backfillFullThreadDetail()` 调用 helper。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v489`。

## 2026-06-26 v488 Refresh Performance Event Planning

v488 继续推进 Phase A 的前端 render/patch ownership 收敛，这次聚焦
`thread_refresh_ms` 性能事件的字段口径。

本次切片把 `refreshCurrentThread()` 末尾手工拼装 refresh 性能事件 payload
的逻辑推进到 `public/thread-performance-metrics.js` 的
`threadDetailRefreshEventFields`。新的 helper 统一生成 server timings、
performance phase、client timings、detail shape、read mode、状态、turn
计数、rollout size、render plan reason、refresh render action、patch reject
reason、metadata/full/local/tile patch 标记等字段。`public/app.js` 仍然负责
真实 API 调用、merge、DOM 更新和 `postPerformanceEvent()`。

修复边界：

- 症状/风险：`refreshCurrentThread()` 虽然已经把 render/patch/outcome 决策
  拆进 helper，但 `thread_refresh_ms` 的诊断字段仍在 app.js 手工拼装。后续
  改 metadata-only、local patch、tile-pane patch 或 full render 分支时，容易
  出现生产诊断口径漂移，削弱大 session 和 projection mismatch 的闭环证据。
- 失败层：前端 thread-detail refresh performance event ownership。
- 不变量：refresh 性能事件字段必须由纯 helper 统一生成；事件只包含 bounded
  timings/counts/status/reason code，不包含消息正文、任务卡正文、上传内容、
  私有路径、cookie/token 或长日志。
- 闭环验证：`test/thread-performance-metrics.test.js` 覆盖 refresh event
  payload 构造和隐私边界；`test/conversation-render.test.js` 与
  `test/mobile-viewport.test.js` 验证 `refreshCurrentThread()` 调用
  `threadDetailRefreshEventFields()` 并将结果直接交给 `thread_refresh_ms`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v488`。

## 2026-06-26 v487 Refresh Outcome Execution Planning

v487 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 `refreshCurrentThread()` 中 `renderOutcome` 之后的执行动作推进到
`public/thread-detail-render-plan.js` 的
`planThreadDetailRefreshOutcomeExecution`。新的 helper 负责把
`local-patch-metadata-update`、`metadata-update`、`full-render` 和
`tile-pane-patch` 这些结果转换成明确的执行计划：metadata update 模式、
是否执行 full render、以及 projection consistency phase。`public/app.js`
仍然负责真实 DOM/header/dock 写入、`renderCurrentThread()` 调用和诊断上报。

修复边界：

- 症状/风险：`refreshCurrentThread()` 在拿到 render outcome 后仍内联判断
  `refreshRenderAction`，同时安排 metadata update、full render 和 projection
  consistency。这个尾部动作如果继续散落，后续很容易出现 full render
  consistency 漏查、metadata-only 错走 full render、或 local patch 后重复执行
  不一致的更新动作。
- 失败层：前端 thread-detail refresh outcome execution policy。
- 不变量：render outcome 的后续动作必须由纯 helper 计划；full render 的
  consistency phase 必须和 metadata/local patch 一样走统一出口。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 local patch metadata、
  metadata-only、full render、tile-pane terminal 四条 outcome execution 分支；
  `test/conversation-render.test.js` 和 `test/mobile-viewport.test.js` 验证
  `refreshCurrentThread` 调用 helper，并按 `executionPlan` 执行动作。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v487`。

## 2026-06-26 v486 Refresh Patch Execution Planning

v486 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 `refreshCurrentThread()` 中“刷新后先尝试 tile-pane patch、
什么情况下允许 single-thread local patch、metadata-only 刷新失败时是否只做
metadata update”的分支，推进到 `public/thread-detail-render-plan.js` 的
`planThreadDetailRefreshPatchExecution`。`public/app.js` 仍然负责真实 DOM
patch、metadata 写入、full render 调用和性能/诊断上报。

修复边界：

- 症状/风险：`refreshCurrentThread()` 同时承担 server 结果 merge、render
  signature 判断、tile surface 判断、local patch 尝试、metadata-only 更新和
  full render fallback。tile surface 上错误地尝试 single-thread patch，或
  metadata-only 刷新误入 full render，都会增加闪动、少消息和错 surface 更新风险。
- 失败层：前端 thread-detail refresh render execution policy。
- 不变量：刷新执行顺序必须由纯 helper 计划；tile surface 只能走 tile pane patch
  或 full render，不允许落到 single-thread local patch；signature-stable
  metadata-only 刷新不应触发 full render。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 local-patch eligible、
  tile-surface block、patch-not-allowed full render、metadata-only 四条分支；
  `test/conversation-render.test.js` 验证 `refreshCurrentThread` 调用 helper，
  且不再内联 `renderPlan.canPatch && !tileSurfaceRefresh`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v486`。

## 2026-06-26 v485 Visible Item Insert Anchoring

v485 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 `insertVisibleItemDom()` 中新增 visible item 的锚点选择和
`insertBefore` 执行推进到 `public/thread-detail-dom-patch.js` 的
`insertVisibleItemElement`。新的 helper 负责从当前 visible entries 中向前查找
最近已渲染 item，并决定插入到该节点之后、首节点之前或空容器 append。
`public/app.js` 仍然负责选择 single/tile surface、渲染 item HTML、创建 DOM
节点和执行 local patch completion。

修复边界：

- 症状/风险：新增 visible item 时，`app.js` 内联从 `visibleIndex` 向前查找
  anchor。旧逻辑无法区分“找到了 previous 节点但它已经是最后一个节点”和
  “完全没找到 previous 节点”，前者会因为 `nextSibling === null` 被回退到
  `firstChild`，存在把新 item 插到开头的错序风险。
- 失败层：前端 visible item local insert DOM anchoring。
- 不变量：新增 item 应插到最近已渲染 previous item 后面；如果 previous 是最后
  一个节点，应 append，而不是回退到 firstChild。
- 闭环验证：`test/thread-detail-dom-patch.test.js` 覆盖 append-after-previous、
  after-previous-before-next、before-first 和 bounded failure reasons；
  `test/mobile-viewport.test.js` / `test/conversation-render.test.js` 验证
  `insertVisibleItemDom` 调用 helper 且不再保留旧反向 anchor 循环。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v485`。

## 2026-06-26 v484 Local DOM Patch Completion Planning

v484 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 `completeLocalConversationDomUpdate()` 的完成动作决策推进到
`public/thread-detail-dom-patch.js` 的
`planLocalConversationDomUpdateCompletion`。新的 helper 负责把 tile-pane
已完成、single-thread 不可 patch、single-thread patch 完成后的 hydrate、
conversation signature / patch-shell signature 更新，以及 scroll action
整理成可测试计划。`public/app.js` 仍然负责真实 tile pane patch、真实
hydration、状态赋值和滚动执行。

修复边界：

- 症状/风险：局部 DOM patch 后的完成流程仍在 `app.js` 里混合 tile/single
  surface 判断、signature 写入、hydrate 和 scroll 触发，是局部刷新后闪动、
  signature 错配、tile/single 状态串线的复发点。
- 失败层：前端 single-thread/tile-pane local patch completion ownership。
- 不变量：local patch completion 的动作计划应由纯 helper 输出；`app.js`
  只执行计划，不重新内联完成分支。
- 闭环验证：`test/thread-detail-dom-patch.test.js` 覆盖 tile-pane terminal、
  single-thread blocked、single-thread completion 三条路径；
  `test/conversation-render.test.js`、`test/turn-scroll-controls.test.js` 和
  `test/mobile-viewport.test.js` 验证 app 调用 completion plan 并按 plan
  执行 hydrate、signature 和 scroll。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v484`。

## 2026-06-26 v483 Conversation HTML Update Planning

v483 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 `updateConversationHtml()` 里的 conversation HTML 更新决策推进到
`public/thread-detail-dom-patch.js` 的 `planConversationHtmlUpdate`。新的 helper
负责判断当前 signature 是否稳定、稳定时是否只做 hydration、变更时应该
patch HTML 还是直接设置 `innerHTML`、下一步 conversation signature /
patch-shell signature 应如何更新，以及本轮应触发沉底还是只更新跳转按钮。
`public/app.js` 仍然负责真实 DOM 写入、fallback 写入、hydration 回调、
scroll 回调和 performance event 上报。

修复边界：

- 症状/风险：`updateConversationHtml()` 同时持有 signature 稳定判断、DOM
  patch/innerHTML 分支、patch-shell signature 状态更新和 scroll scheduling
  分支，是 full-render 闪动、重复 hydration、错误 signature 状态的复发点。
- 失败层：前端 conversation full-render DOM update ownership。
- 不变量：conversation HTML 更新的 action、signature 更新、hydrate 选项和
  scroll action 应由可测试 helper 计划；`app.js` 只执行计划，不重新内联判断。
- 闭环验证：`test/thread-detail-dom-patch.test.js` 覆盖 stable signature、
  patch-shell 更新、changed signature patch-html、empty target innerHTML；
  `test/turn-scroll-controls.test.js` 和 `test/mobile-viewport.test.js` 验证
  `updateConversationHtml` 调用 helper 并消费 `updatePlan`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v483`。

## 2026-06-26 v482 Full-Render Scroll Planning

v482 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把单线程 full-render 的 bottom-follow/沉底决策从
`public/app.js` 推进到 `public/conversation-scroll.js` 的
`planFullRenderScroll`。新的 helper 接收 near-bottom、用户是否正在读当前
turn、auto-scroll hold、submitted-message follow、viewport follow 和显式
`stickToBottom`/receipt-start 请求，输出结构化的 `stickToBottom` 决策和
reason。`public/app.js` 仍然负责采集 DOM/运行态观测值、执行真实滚动和
DOM 写入，但不再内联 full-render 沉底公式。

修复边界：

- 症状/风险：`renderCurrentThread()` 仍直接拥有 full-render 是否沉底的
  组合判断，和全量渲染、live SSE、submitted echo、viewport resize、用户
  手动阅读状态耦合，属于正文闪动/错误沉底复发的高风险点。
- 失败层：前端 single-thread full-render scroll ownership。
- 不变量：full-render 滚动决策必须由可测试 helper 给出；`app.js` 只能
  提供观测输入并执行结果，不能在渲染编排函数里重新组合隐藏公式。
- 闭环验证：`test/conversation-scroll.test.js` 覆盖显式不沉底、submitted
  follow、viewport follow、auto-scroll hold、显式沉底、near-bottom 和默认
  不跟随；`test/turn-scroll-controls.test.js` 验证 `renderCurrentThread`
  委托 `planFullRenderScroll` 并消费 `fullRenderScrollPlan.stickToBottom`。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v482`。

## 2026-06-26 v481 Single-Thread Full-Render Shell Planning

v481 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把单线程详情页 full-render shell 的 planning 从
`public/app.js` 推进到 `public/thread-detail-render-plan.js` 的
`planSingleThreadFullRenderShell`。新的 helper 负责 loading、load-error、
detail、empty-detail/read-warning 空态的 shell plan，以及目标 HTML 片段
顺序、retry intent、是否清空 live operation dock 等结构化结果。
`public/app.js` 仍然负责真实 DOM 写入、retry 事件绑定、header/tile 切换、
scroll/bottom-follow、hydration 和后续 action binding。

修复边界：

- 症状/风险：`renderCurrentThread()` 仍直接拼接 loading/error/empty/detail
  full-render HTML，导致 full-render shell、任务卡/approval 片段顺序和空态
  文案继续与 DOM 副作用耦合。
- 失败层：前端 single-thread full-render shell ownership。
- 不变量：full-render shell 的 mode、HTML 片段顺序、empty/read-warning
  选择和 retry intent 应由可测试 helper 计划；`app.js` 只执行真实 DOM
  副作用和事件绑定。
- 闭环验证：`test/thread-detail-render-plan.test.js` 覆盖 loading、load-error、
  primary-content ordering、plugin notice before empty state、read-warning empty
  state；`test/conversation-render.test.js` 验证 `renderCurrentThread` 委托
  helper 且不再内联 load-error / empty shell 文案；任务卡相关 source test
  验证 task-card 片段仍传入 shell plan。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v481`。

## 2026-06-26 v480 Operation Card Template Ownership

v480 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 live operation / command detail card 的最终 HTML 模板从
`public/app.js` 推进到 `public/live-operation-dock-state.js` 的
`operationCardHtml`。`public/app.js` 现在只负责从 operation item 提取
title/detail/duration/render key，并把 `escapeHtml` 注入给 helper；helper
负责 section/meta/detail/duration 的模板结构、empty detail 占位、
completed class 和 bounded duration data attribute 过滤。

修复边界：

- 症状/风险：v478 只抽出了 operation card content plan，但最终
  `operation-meta-line` / `operation-detail-line` / duration HTML 仍在
  `app.js` 中手拼，状态计划和 DOM 模板仍容易重新耦合。
- 失败层：前端 live operation / command detail template ownership。
- 不变量：operation card 模板结构应由可测试 helper 统一生成；`app.js`
  只做 item 映射、duration 数据计算和 escape 函数注入。
- 闭环验证：`test/live-operation-dock-state.test.js` 覆盖完整 card HTML、
  injected escaping、empty-detail 占位和 duration attribute allowlist；
  `test/collab-agent-render.test.js` 验证 `renderOperationCard` 不再持有
  operation card 模板字符串；`test/conversation-render.test.js` 保持
  command/output 与 live operation 回归。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v480`。

## 2026-06-26 v479 Keyed DOM Patch Ownership

v479 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 keyed DOM child reconciliation 从 `public/app.js` 推进到
`public/thread-detail-dom-patch.js`。新的 helper 边界覆盖：
`renderKeyForNode`、`canPatchNode`、attribute sync、text/comment patch、
keyed child reuse/reorder、incompatible node replacement，以及 `patchHtml`
的 HTML-to-template patch 调用。`public/app.js` 只保留薄调用层，继续负责
业务编排、fallback 到 `innerHTML`、hydration、scroll 和性能事件。

修复边界：

- 症状/风险：`app.js` 仍直接拥有 keyed child patch 算法，局部更新和全量
  render 的底层复用规则难以单测，容易让重复节点、错序、闪动问题复发。
- 失败层：前端 thread-detail DOM patch application ownership。
- 不变量：DOM reconciliation 算法应集中在可测试 helper；`app.js` 只负责
  选择 patch 时机和注入真实 DOM 副作用。
- 闭环验证：`test/thread-detail-dom-patch.test.js` 覆盖 keyed reorder、
  unkeyed reuse、stale removal、incompatible replacement 和 `patchHtml`
  bounded failure；`test/collab-agent-render.test.js` 验证 `app.js` 不再持有
  `patchChildNodes` / `canPatchNode` / `syncAttributes` 实现。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v479`。

## 2026-06-26 v478 Operation Card Content Plan Ownership

v478 继续推进 Phase A 的前端 render/patch ownership 收敛。

本次切片把 live operation / command detail card 的内容计划移入
`public/live-operation-dock-state.js` 的 `operationCardContentPlan`。该 helper
现在负责 operation card 的结构化内容边界：item id、type、title、detail、
empty-detail 标记、status 可见性、duration 可见性和 class token 列表。
`public/app.js` 仍然负责 HTML escape、最终模板字符串和真实 DOM patch。

修复边界：

- 症状/风险：命令详情卡的 status、completed class、empty detail、duration
  可见性和 HTML 拼接都在 `app.js` 中，导致运行状态显示规则和 DOM 模板继续耦合。
- 失败层：前端 live operation / command detail content ownership。
- 不变量：状态/内容选择应由可测试 helper 计划；`app.js` 只做 HTML 输出和
  副作用。
- 闭环验证：`test/live-operation-dock-state.test.js` 覆盖
  `operationCardContentPlan` 的 running/completed/empty-detail 计划；
  `test/collab-agent-render.test.js` 验证 `renderOperationCard` 委托 helper；
  `test/conversation-render.test.js` 保持 command/output 与 live operation 回归。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v478`。

## 2026-06-26 v477 Live Text DOM Patch Ownership

v477 继续推进 Phase A 的前端 thread detail render/patch ownership 收敛。

本次切片把 live text item 的 DOM patch 查找、HTML 解析、patch 回调顺序和
bounded failure reason 移入 `public/thread-detail-dom-patch.js` 的
`applyLiveTextItemDomPatch`。`public/app.js` 仍然负责 tile/single surface
判断、真实 DOM patch 回调和 scroll completion，但不再直接拥有 live text
的 render-key selector 与 HTML-to-node patch sequencing。

修复边界：

- 症状/风险：流式 `agentMessage` / `plan` 文本增量到达时，`app.js` 同时
  负责 selector、render、patch 和 scroll completion，导致局部 patch、
  全量 render、tile pane patch 的职责边界继续耦合。
- 失败层：前端 thread detail DOM patch ownership。
- 不变量：`app.js` 应只编排 surface 判断和副作用注入；可测试 patch
  sequencing 应位于 helper。
- 闭环验证：`test/thread-detail-dom-patch.test.js` 覆盖 live text patch
  成功路径和 bounded failure reasons；`test/turn-scroll-controls.test.js`
  验证 app 委托 helper 后仍执行 scroll completion；`test/conversation-render.test.js`
  覆盖流式文本、图片、tile/single-thread projection consistency 回归。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v477`。

## 2026-06-26 Home AI Autonomous Delivery Return Events

本次 Phase D 切片把 Codex Mobile terminal return-card 接入 Home AI
Autonomous Delivery Loop 的 bounded event intake。

当以下路径生成 terminal return card 时：

- `codex_mobile.return_to_source`
- `scripts/return-thread-task-card.js`
- `POST /api/thread-task-cards/:id/reply` 且 `returnToSource:true`
- autonomous workflow completion auto-return

Codex Mobile 会向 Home AI 后端可信回调发送一次 bounded metadata event：

- 原始 `taskCardId`
- terminal `returnCardId`
- `completed|blocked|redirected|rejected|partially_completed`
- bounded title / summary
- source thread id、target thread id、workflow id
- `terminal:true`
- `ackPolicy:"none"`

该事件只用于 Home AI delivery slice 状态更新。它不会创建新的修复卡，
不会要求 acknowledgement，也不会参与 return-card 注入。Home AI 返回 404
表示未知原始 task-card id 时，Codex Mobile 只在 return-card audit 中记录
`unknown_task_card`，不阻断 terminal return-card 的正常交付。

隐私边界：事件不包含 raw task-card body、conversation text、prompt、
completion、upload/screenshot 内容、provider payload、cookie、launch token、
access key、数据库行或长日志。认证复用 Home AI / Hermes 后端可信回调的
`X-Hermes-Web-Key` 路径，不在仓库或日志中写入 raw key。

## 2026-06-26 v476 Thread List Fallback Cache Decision Diagnostics

v476 转入 Phase B 的一个小切片：把线程列表 fallback cache 的冷/热路径证据补完整。
此前 `/api/threads` 的 `mobileDiagnostics.threadListTimings` 已有 `fallbackCacheHit`、
`fallbackStateDbMs`、`fallbackRolloutMs`、`fallbackSessionIndexMs`、`cacheAgeMs` 等字段，
但缺少结构化的“为什么这次命中/为什么重建”结论。用户看到线程列表有时快有时慢时，
只能看到 fallback 耗时，不能稳定区分服务冷启动首建、TTL 过期、cache miss、还是正常 warm hit。

本次不改变任何缓存策略，只增加 bounded evidence：

- `fallbackCacheDecision`：`hit`、`miss-rebuild` 或 `expired-rebuild`。
- `fallbackCacheBuildReason`：重建前的原始原因，例如 `miss` 或 `expired`。
- `fallbackCacheKeyHash`：只暴露短 hash，不暴露 cwd、workspace roots 或 projectless thread ids。
- `fallbackCacheAgeMs` / `fallbackCacheBaselineAgeMs` / `fallbackCacheUpdatedAgeMs`：
  区分 baseline 年龄和增量更新后的年龄。
- `fallbackCacheBuildCount` / `fallbackCacheBuildNumber` /
  `fallbackCacheIncrementalUpdates` / `fallbackCacheEntryCount`：判断普通刷新是否在反复重建，
  还是进程内 baseline 经过增量同步继续复用。

`public/thread-performance-metrics.js` 也会把 thread-list phase 细分为
`warm-fallback-cache`、`cold-fallback-miss-build`、`cold-fallback-expired-rebuild`、
`deferred-fallback` 和 `app-server-only`。这让 Phase B 后续排查大 session 首屏和线程列表慢
可以先读结构化 evidence，再决定是否调整 cache/rollout scan/read path。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v476`。

## 2026-06-26 v475 Thread Tile Operation Dock Render Policy

v475 继续 Phase C，在 v474 把 operation mode toggle 迁出 app 层之后，继续把平铺窗口
operation dock 的渲染分支决策迁到 `public/thread-tile-state.js`。此前
`renderThreadTileOperationDock` 仍然直接判断当前 pane 是否有 live command/file/tool/search
operation、是否只剩 `liveTurnStatus`、是否需要复用最小滞留期内的 remembered bubble、以及
是否清理已过期 remembered bubble。

本次新增 `operationDockPlan`：

- `render-live-operation`：当前 pane 有真实 operation item 时，由 app 层继续渲染现有
  `mobile-operation-stack`，并记住 bubble HTML。
- `render-remembered-operation`：当前 live turn 还存在但真实 operation 已短暂结束时，复用
  remembered bubble，并由 app 层安排最小滞留刷新。
- `clear-remembered-operation`：remembered bubble 已过期时，显式要求 app 层清理 pane-local
  remembered 状态。
- `none`：缺少 pane id、没有 live turn、或没有可复用 remembered bubble 时不渲染。

这个切片不改变 pane 内 operation bubble/sheet 的 HTML 结构和视觉，不改变时间显示、命令摘要、
server projection、thread detail 读取、任务卡或 Home AI 诊断上报。`public/app.js` 仍负责真实
HTML 渲染、timer、Map 删除和 DOM patch；策略层只输出 bounded render action。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v475`。
`test/thread-tile-state.test.js` 覆盖 operation dock planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过 `operationDockPlan`。

## 2026-06-26 v474 Thread Tile Operation Mode Toggle Policy

v474 继续 Phase C，把平铺窗口里 operation/command 详情面板的展开收起决策从
`public/app.js` 迁到 `public/thread-tile-state.js`。此前 pane-local operation bubble 的
dwell、expiry、mode 和 signature 规则已经是纯策略，但点击 operation bubble 后，
`bindThreadTileActions` 仍然直接写 `state.threadTileOperationModesById`、选中 pane、
再局部 patch pane。这让命令详情面板的状态切换还留在 UI 事件处理层。

本次新增 `operationModeTogglePlan`：

- 策略层负责判断 tile mode 是否启用、目标 pane id 是否有效，以及 compact/expanded 的
  下一状态。
- 策略层输出选中 pane、局部 patch、preserve-scroll、patch miss 后 full render 的 effect
  意图。
- `public/app.js` 只执行真实 Map 写入、active pane 选择和 DOM patch。

这个切片不改变视觉、不改变 operation bubble 内容、不改变 server projection、thread detail
读取、任务卡、Home AI 诊断上报或 pane layout。它只是继续收窄平铺模式的状态所有权边界。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v474`。
`test/thread-tile-state.test.js` 覆盖 operation mode toggle planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过
`operationModeTogglePlan` / `applyThreadTileOperationModeTogglePlan`。

## 2026-06-26 v473 Thread Tile Detail Load Concurrency Policy

v473 继续 Phase C，在 v472 的 detail-load queue plan 基础上启用真正的有界并发。
平铺窗口数量仍由用户设置和布局策略决定，不因为这个改动被限制；限制的是同一时刻
并发读取线程详情的 `loadThreadTileDetail` 数量，避免 5/6 个 pane 同时打开大 session 时
一起打满 app-server 或触发前端整板重绘压力。

本次运行时策略：

- `THREAD_TILE_DETAIL_LOAD_MAX_CONCURRENT` 设为 `min(4, user pane ceiling)`，最多并发 4 个
  pane detail read。
- 新增 `detailLoadQueueDrainPlan`，由 `public/thread-tile-state.js` 决定是否需要安排下一批
  队列续跑。
- 新增 120ms 的 pane detail-load drain timer。首批 load 启动后如果还有 `deferredIds`，
  会短延迟重查队列；任一 load finally 后也会触发队列续跑，保证被推迟的 pane 不必等普通
  2.4s refresh timer。
- `abortThreadTileLoads` 会同时清理普通 refresh timer 和 detail-load drain timer，避免退出
  平铺后继续续跑旧队列。

这个切片是架构收敛，不是 UI 兜底：不会隐藏重复消息，不会跳过刷新，也不会改变 server
projection、thread detail API、任务卡或 Home AI 诊断上报。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v473`。
`test/thread-tile-state.test.js` 覆盖 drain scheduling；`test/thread-tile-layout-ui.test.js`
约束 app 层必须通过 queue/drain 策略和 executor。

## 2026-06-26 v472 Thread Tile Detail Load Queue Policy

v472 继续 Phase C，把平铺窗口 detail load 的队列选择和 stale controller 清理从
`public/app.js` 抽到 `public/thread-tile-state.js` 的纯策略。此前 v471 已经把单个
detail load 的 start/success/error/finally 生命周期做成 effect plan，但
`ensureThreadTileDetails` 仍直接遍历 controller、abort 不再 active 的 pane，并对所有
active pane 逐个 fan-out 调用 `loadThreadTileDetail`。

本次新增 `detailLoadQueuePlan`：

- 输出不再 active 的 `abortIds`，由 app 层只负责真实 `AbortController.abort()` 和
  Map/Set 清理。
- 输出可启动的 `loadIds`，避免 UI 编排层自己决定 active pane fan-out。
- 输出因 `maxConcurrentLoads` 被推迟的 `deferredIds`，先把未来并发上限和大 session
  读队列控制变成可测试策略。

运行时当前把 `THREAD_TILE_DETAIL_LOAD_MAX_CONCURRENT` 设为用户 pane 上限，保持现有
可见行为，不突然降低多窗口刷新速度；策略测试已经覆盖低并发上限下的 defer 形态。
这个切片不改变 server projection、thread detail API、任务卡、诊断上报、pane layout 或
视觉设计。`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v472`。
`test/thread-tile-state.test.js` 覆盖 queue planning；`test/thread-tile-layout-ui.test.js`
约束 app 层必须通过 `detailLoadQueuePlan` / `applyThreadTileDetailLoadQueuePlan`。

## 2026-06-26 v471 Thread Tile Detail Load Lifecycle Policy

v471 继续 Phase C，把平铺窗口 detail load 的生命周期副作用迁到
`public/thread-tile-state.js` 的纯 effect plan。此前 `detailLoadPlan` 已经负责判断
是否要加载、是否后台刷新、是否 mark loading 和 clear error；但 `loadThreadTileDetail`
仍然直接写入 controller、loading ids、detail cache、loadedAt、error map，并在 finally
里决定是否 patch pane。

本次新增四个纯策略：

- `detailLoadStartEffectsPlan`：描述 controller 注册、loading 标记、清理错误和起始 pane
  patch。
- `detailLoadSuccessEffectsPlan`：描述 detail cache 写入、loadedAt 更新、清理错误和 thread
  list merge。
- `detailLoadErrorEffectsPlan`：只让前台非 abort 错误进入 pane error map；后台刷新错误仍然
  不打扰用户。
- `detailLoadFinallyEffectsPlan`：描述 controller/loading 清理，以及可见 pane 的最终 patch。

`public/app.js` 继续拥有真实 `AbortController`、`api()` 网络请求、DOM patch 和 state Map/Set
写入；策略层只输出 bounded lifecycle effect。这个切片不改变 thread detail API、
projection、任务卡、诊断上报、pane layout 或视觉设计。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v471`。
`test/thread-tile-state.test.js` 覆盖 detail-load lifecycle planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过 lifecycle effect executor。

## 2026-06-26 v470 Thread Tile Selected Pane Effect Policy

v470 继续 Phase C，把平铺窗口 active pane 切换后的副作用执行迁到
`public/thread-tile-state.js` 输出的 effect plan。v465 已经把
`setThreadTileSelectedThread` 的目标 pane 校验、unchanged 判断、previous/next patch
范围迁成 `selectPanePlan`；本次补齐后半段，让入口函数不再直接手写保存草稿、
写 selected pane、恢复草稿、刷新 Composer 和 patch pane 的执行顺序。

本次新增的纯策略是 `selectedPaneEffectsPlan`：

- `select-pane` 输出 `selected-pane-effects`，包含 selected pane、需要 patch 的 pane ids、
  draft save/restore、Composer refresh、pane patch preserve-scroll，以及 patch miss 时
  schedule full render 的意图。
- `render: false` 仍保留旧行为：保存/恢复当前 target 草稿并刷新 Composer，但不 patch pane。
- `public/app.js` 继续拥有真实 DOM patch、draft store 和 Composer 控件执行。

这个切片不改变 pane layout、线程详情读取、server projection、任务卡或诊断上报。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v470`。
`test/thread-tile-state.test.js` 覆盖 selected pane effect planning；
`test/thread-tile-layout-ui.test.js` 和 `test/composer-draft.test.js` 约束 app 层必须通过
`selectedPaneEffectsPlan` / `applyThreadTileSelectedPaneEffects`。

## 2026-06-26 v469 Thread Tile Pane Count/Close Effect Policy

v469 继续 Phase C，把平铺窗口数量调整和关闭窗口后的副作用执行也并入
`paneSlotMutationEffectsPlan` / `applyThreadTilePaneSlotEffects` 这条统一通道。
v463 已经把 pane count / close 的纯决策迁到 `public/thread-tile-state.js`，
v468 又把 replace / move / split / replace-last 的副作用计划迁出 `app.js`。
这个切片补齐剩余分叉：`setThreadTilePaneCount` 和 `closeThreadTilePane` 不再直接手写
pane count、pinned ids、selected fallback、settings save、draft restore、Composer refresh
和 full render 顺序。

本次保持旧行为不变：

- 调整 pane count 仍然清空切换菜单、保存 display settings，并在需要时以
  stick-to-bottom 方式重渲染；`render: false` 仍然不会触发 render。
- 关闭 pane 仍然保存/恢复草稿、更新 pinned ids 和 pane count、清理被关闭 pane 的 scroll hold、
  选中 fallback 到可见 pane、刷新 Composer，并以 stick-to-bottom 方式重渲染。
- `replace-last` 仍保持线程列表主动进入线程的轻量语义，不新增草稿、Composer 或 render 副作用。

这个切片不改变 pane layout、视觉设计、server projection、任务卡或诊断上报。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v469`。
`test/thread-tile-state.test.js` 覆盖 count/close effect planning；
`test/thread-tile-layout-ui.test.js` 约束 `setThreadTilePaneCount` 和 `closeThreadTilePane`
必须通过统一 effect plan/executor。

## 2026-06-26 v468 Thread Tile Pane Slot Effect Policy

v468 继续 Phase C，把平铺窗口 slot 变更后的副作用意图迁到
`public/thread-tile-state.js`。这次处理的是窗口线程替换、拖动换位、上下分屏、
线程列表打开替换最后窗口之后，`public/app.js` 里重复出现的保存草稿、写入
pinned/split/selected、清理 scroll hold、保存 settings、恢复草稿、加载 detail、
patch pane 或 full render 的执行顺序。

本次新增的纯策略是 `paneSlotMutationEffectsPlan`：

- `replace` / `select` 输出保存草稿、刷新 active ids、恢复 Composer、加载目标 detail，
  并区分 patch pane 与 schedule full render。
- `move` / `split` 输出保存草稿、写入 split pairs、恢复 Composer，并要求当前 tile board
  以 stick-to-bottom 方式重新渲染。
- `replace-last` 保持线程列表主动进入线程时的旧语义：只更新 slot、active ids、selected
  和 settings，不额外触发草稿/Composer/渲染副作用。
- `public/app.js` 继续拥有实际 DOM、网络、draft、Composer 和 render 执行；策略层只输出
  bounded effect plan。

这个切片不改变 pane layout、thread detail API、server projection、任务卡或诊断上报。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v468`。
`test/thread-tile-state.test.js` 覆盖 pane slot mutation effects planning；
`test/thread-tile-layout-ui.test.js` 和 `test/composer-draft.test.js` 约束 app 层必须通过
`paneSlotMutationEffectsPlan` 和 `applyThreadTilePaneSlotEffects`。

## 2026-06-26 v467 Thread Tile Switch Menu State Policy

v467 继续 Phase C，把平铺窗口标题菜单的状态策略迁到
`public/thread-tile-state.js`。这次处理的是 `threadTileVisibleThreadOptions` 和
`renderThreadTileSwitchMenu` 中的候选线程排序去重、菜单开闭、关闭窗口/新增窗口按钮
可用性，以及窗口计数显示。

本次新增的纯策略是 `switchMenuOptionsPlan` 和 `switchMenuPlan`：

- 线程切换候选项按当前窗口、active panes、running visible threads、visible threads
  的顺序去重。
- 菜单是否打开、是否缺少目标 pane、是否有可渲染选项由纯策略输出 bounded reason。
- 关闭窗口按钮只在当前 pane 仍是 active pane 且 pane 数量高于最小值时可用。
- 新增窗口按钮只在当前 pane 数量低于最大值时可用。

`public/app.js` 仍负责把线程对象渲染成标题、路径、时间和状态图标；菜单状态判断不再
直接读写在 app 层。这个切片不改变 pane layout、thread detail API、server projection、
任务卡或诊断上报。`CLIENT_BUILD_ID` 和 PWA shell cache 升级到
`codex-mobile-shell-v467`。`test/thread-tile-state.test.js` 覆盖 switch menu planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过 `switchMenuOptionsPlan` 和
`switchMenuPlan`。

## 2026-06-26 v466 Thread Tile Candidate Pane Id Policy

v466 继续 Phase C，把平铺窗口候选线程 ID 的选择策略迁到
`public/thread-tile-state.js`。这次处理的是 `threadTileCandidateIds` 中的
固定 pane 过滤、默认候选回退、layout selector 委托，以及无 selector 时把当前线程
补入候选窗口的规则。

本次新增的纯策略是 `candidatePaneIdsPlan`：

- 固定 pane 只接受当前可见线程，避免过期/隐藏线程重新占用 slot。
- 没有可用固定 pane 时直接回到默认候选线程列表。
- 有 `threadTileLayoutPolicy.selectPinnedThreadTileIds` 时保持 selector 作为布局策略入口。
- 无 selector 时按固定 pane + 默认候选去重，并保持当前线程仍能进入候选窗口。

`public/app.js` 仍负责收集当前可见线程、默认候选、当前线程和布局 selector；策略层只返回
候选 ID 计划。这个切片不改变 pane layout、thread detail API、server projection、
任务卡或诊断上报。`CLIENT_BUILD_ID` 和 PWA shell cache 升级到
`codex-mobile-shell-v466`。`test/thread-tile-state.test.js` 覆盖 candidate pane id
planning；`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过
`candidatePaneIdsPlan`。

## 2026-06-26 v465 Thread Tile Selected Pane Action Policy

v465 继续 Phase C，把用户显式选中某个平铺窗口的执行计划迁到
`public/thread-tile-state.js`。这次处理的是 `setThreadTileSelectedThread` 中的
目标 pane 校验、unchanged 判断、previous/next patch 范围和 selected pane 写入计划。

本次新增的纯策略是 `selectPanePlan`：

- 统一 tile mode disabled、缺少 thread id、目标 pane 不在 active ids、目标已选中的
  skip reason。
- 输出 selected pane、previous pane 和需要 patch 的 pane ids。
- 保持 `public/app.js` 只负责保存/恢复草稿、更新 Composer controls、执行 pane patch
  或 full render fallback。

这个切片不改变 pane layout、thread detail API、server projection、任务卡或诊断上报。
`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v465`。
`test/thread-tile-state.test.js` 覆盖 selected pane action planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过 `selectPanePlan`。

## 2026-06-26 v464 Thread Tile Active Pane Sync Policy

v464 继续 Phase C，把平铺窗口的 active pane 同步决策合并到
`public/thread-tile-state.js`。这次处理的是 `ensureThreadTileDetails` 进入
平铺渲染前，如何同步 active pane ids、pinned slots、split pairs 和 selected pane。

本次新增的纯策略是 `activePaneSyncPlan`：

- 统一 active pane ids 的去重和截断。
- 复用 pinned slot 同步规则，并输出是否需要持久化 `thread-display` settings。
- 统一 selected pane fallback：当前选中 pane 不可见时优先回到当前线程，否则回到
  第一个 active pane；没有 active pane 时清空 selected pane。
- 把 pinned slot、split-pair prune、selected pane 三个联动决策合成一个可测试计划。

`public/app.js` 仍负责副作用：写入 state、保存 display settings、终止不可见 pane 的
detail controller、触发 pane detail load 和 tile refresh。这个切片不改变 pane layout、
server projection、任务卡、诊断上报或视觉设计。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v464`。
`test/thread-tile-state.test.js` 覆盖 active pane sync planning；
`test/thread-tile-layout-ui.test.js` 约束 `ensureThreadTileDetails` 必须通过
`syncThreadTileActivePaneState` 调用 policy，而不是重新拆成分散的 app 层判断。

## 2026-06-26 v463 Thread Tile Pane Count And Close Policy

v463 继续 Phase C，把平铺窗口的 pane count、close pane 和 selected pane fallback
决策从 `public/app.js` 迁到 `public/thread-tile-state.js`。这次处理的是窗口数量
边界、关闭窗口后的 pinned slot 填充、关闭后选中窗口的 fallback，以及切换数量时
是否需要真正触发 render。

本次新增的纯策略包括：

- `paneCountChangePlan`：统一判断 tile mode/layout 是否可用、请求数量如何按
  min/max/user max 截断、以及当前数量未变化时是否跳过。
- `closePanePlan`：统一判断目标 pane 是否可关闭、最小 pane 数限制、关闭后的
  visible count、pinned thread ids 和 scroll reset ids。
- `paneSelectionPlan`：统一 selected pane 仍可见、缺失、空选择时的 fallback 规则。

`public/app.js` 仍负责副作用：保存当前草稿、写入 state、清理 scroll hold、
恢复 Composer target、更新 controls、render 和持久化显示设置。这个切片不改变
server projection、任务卡、诊断上报、图片投影或 thread detail merge。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v463`。
`test/thread-tile-state.test.js` 覆盖 count/close/selection planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须通过这些 policy helpers，
避免 pane count/close 状态判断重新散回 `app.js`。

## 2026-06-26 v462 Thread Tile Pane Slot Mutation Policy

v462 继续 Phase C，把平铺窗口的 pane slot mutation 规则从 `public/app.js`
迁到 `public/thread-tile-state.js`。这次处理的是窗口线程切换、拖动换位、
上下分屏、从线程列表主动打开线程时替换最后一个窗口，以及拖放区域判定。

本次新增的纯策略包括：

- `replacePaneThreadPlan`：规划某个 pane 切换到另一个线程时的 slot 替换、
  duplicate swap、选中 pane、滚动状态清理和 patch/full render 选择。
- `movePaneRelativePlan`：规划拖动 pane 到目标 pane 左/右时的固定 slot 顺序
  和相关 split-pair 清理。
- `splitPaneWithTargetPlan`：规划拖动 pane 到目标 pane 上/下时的上下分屏关系。
- `replaceLastPaneForThreadListOpenPlan`：规划在平铺模式下从线程列表打开新线程时，
  用新线程替换最后一个 pane，而不是让后台 recent 排序移动窗口。
- `dropPaneIntent`：把拖放命中区域归类为左/右换位或上/下分屏。

`public/app.js` 仍负责副作用：保存草稿、恢复 Composer target、设置 Map/Set、
触发 detail load、patch pane、full render 和持久化显示设置。这个切片不改变
server projection、任务卡、图片投影或平铺视觉结构。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v462`。
`test/thread-tile-state.test.js` 覆盖 slot mutation planning；
`test/thread-tile-layout-ui.test.js` 约束 app 层必须调用这些 policy helpers，
且不再保留旧的 split-pair mutation wrapper。

## 2026-06-26 v461 Thread Tile Detail Refresh Policy

v461 继续 Phase C，把平铺窗口的 pane-local detail refresh 决策从
`public/app.js` 迁到 `public/thread-tile-state.js`。这次仍然不是完整分屏重构，
而是收敛“哪些 pane 要刷新、什么时候安排下一次刷新、单个 pane 是否应该发起
detail load”的纯状态判断。

本次新增的纯策略包括：

- `refreshSchedulePlan`：决定 tile refresh timer 是否应安排、跳过或清理。
- `refreshTargetIds`：从 active pane ids 中选出真正需要后台刷新的 pane，排除当前
  主线程和不可见 pane。
- `detailLoadPlan`：统一判断 missing id、当前线程已加载、已有 controller、已有
  loading、cached ready、最小刷新间隔、background refresh 和 loading refresh。
- `uniqueIds` / `refreshDelayMs`：把去重和最小 delay 规则从 app 层移出。

`public/app.js` 仍负责真实副作用：AbortController、API 请求、loading/error Map、
render scheduling、thread list merge 和 DOM patch。这个切片没有改变 thread detail
API、投影缓存或前端刷新策略，只是把 refresh ownership 的判断变成可测试计划。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v461`。
`test/thread-tile-state.test.js` 覆盖 refresh scheduling、refresh target selection 和
detail load planning；`test/thread-tile-layout-ui.test.js` 约束 app 层必须调用这些
policy helpers。

## 2026-06-26 v460 Thread Tile Operation State Policy

v460 接续 v459，继续 Phase C。v459 已经把 pane count、pinned ids、split pairs、
selected pane 和 `thread-display` settings 这些基础 pane-state 规则迁到
`public/thread-tile-state.js`；本次把平铺窗口里的 operation bubble 状态判定也收进
同一个 helper。

本次新增的纯策略包括：

- `operationBubbleRecord`：只在 HTML 确实包含 `mobile-operation-bubble` 时记录
  pane-local operation bubble，并计算最小可见截止时间。
- `operationBubbleSnapshot`：判断已记住的 bubble 是否仍可见、剩余多久、是否过期。
- `normalizeOperationMode` / `toggleOperationMode`：统一平铺窗口内 compact/expanded
  状态切换。
- `operationSignature`：为 thread tile render signature 提供稳定的 operation 状态
  描述，减少 pane-local operation 状态散落在 `public/app.js`。

`public/app.js` 仍负责 Map 写入、定时器、DOM patch 和 pane 重新渲染；helper 只拥有
状态规则。这个切片不新增 fallback，不隐藏重复消息，也不改变服务端投影。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v460`。
`test/thread-tile-state.test.js` 新增 operation bubble dwell、expiry、mode toggle 和
signature 覆盖；`test/thread-tile-layout-ui.test.js` 约束 tile UI 必须通过
`threadTileStatePolicy` 使用这些规则。

## 2026-06-26 v459 Thread Tile State Policy

v459 开始推进系统级优化目标里的 Phase C：把平铺/分屏模式从 `public/app.js`
里的临时 UI 分支，继续拆成可测试的 pane-state 架构边界。本轮不是完整分屏重构，
而是先把最容易引发窗口换位、设置保存不一致、active pane 错绑的纯状态规则迁出。

本次新增 `public/thread-tile-state.js`：

- 统一 pane count 归一化和用户最大 pane 上限。
- 统一 pinned thread id 去重、截断和稳定顺序。
- 统一 split pair 的移除、插入、layout-policy 归一化。
- 统一 active/selected pane fallback 规则，避免 composer 和工具栏绑定到错误窗口。
- 统一 `thread-display` settings 的 payload 构造和 server settings 应用。
- 统一 active thread ids 同步回 pinned slots 的规则，保留用户手动固定的窗口顺序。

`public/app.js` 现在只保留兼容 wrapper 和真实副作用：localStorage mirror、render、
server settings 保存、pane detail 加载、DOM 更新仍在 app 层执行。也就是说，这次
没有通过前端隐藏重复或强制刷新来掩盖问题，只是把状态所有权向纯 helper 收敛。

`CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v459`。
`test/thread-tile-state.test.js` 覆盖 pane count、pinned ids、split pairs、selected pane、
display settings payload/apply 和 active-id sync；既有 app-shell tests 约束
`thread-tile-state.js` 必须进入 `index.html`、service worker、client asset list 和
server public-config asset identity。

## 2026-06-26 v458 Thread Tile Action Recognition

v458 接续 v457，继续 Phase A。v457 已经把单线程 conversation/thread detail
点击动作识别推进到 `public/thread-detail-actions.js`，但平铺模式的事件识别仍在
`public/app.js` 中直接按 selector 处理：pane 选中、线程标题菜单、窗口切换、
新增/关闭窗口、底部跳转、operation bubble 展开，以及拖拽换位/上下分屏。

本次新增 `public/thread-tile-actions.js`，把 thread tile 交互识别推进到可测试
helper：

- `resolveThreadTilePointerAction` 和 `resolveThreadTileFocusAction` 识别 pane 选中和
  控制区 stop 规则。
- `resolveThreadTileClickAction` 识别标题菜单、切换线程、增减窗口、关闭窗口、
  跳到底部和 operation toggle。
- `resolveThreadTileScrollAction`、`resolveThreadTileDragStartAction`、
  `resolveThreadTileDragOverAction`、`resolveThreadTileDragLeaveAction` 和
  `resolveThreadTileDropAction` 识别平铺窗口滚动和拖拽/drop 目标。
- `public/app.js` 仍负责调用真实业务函数，不改变 pane 切换、拖拽分屏、operation
  bubble 或 scroll 语义。
- 新 helper 加入 `index.html`、PWA shell cache、client shell asset list、server
  public-config asset list 和 `npm run check`。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v458`。

`test/thread-tile-actions.test.js` 覆盖 thread tile action plan、root containment、
disabled 控制和 drag/drop 分类；既有 tile UI wiring tests 约束
`bindThreadTileActions` 必须通过 `CodexThreadTileActions`。

## 2026-06-26 v457 Thread Detail Action Recognition

v457 接续 v456，继续 Phase A。v456 已经把 thread detail surface hydration
编排推进到 `public/thread-detail-dom-patch.js`，但 conversation click listener
仍在 `public/app.js` 中直接按 selector 顺序识别图片、复制、文件预览、Mermaid、
GitHub 预览、审批、任务卡和 server-response 动作。

本次新增 `public/thread-detail-actions.js`，把 thread detail 点击动作识别推进到
可测试 helper：

- `previewableImageFromTarget` 统一识别可预览图片，并继续排除 GitHub card 内图片。
- `resolveRichContentClickAction` 识别复制、local file preview、Mermaid action 和
  GitHub preview toggle。
- `resolveThreadDetailClickAction` 在 rich content 基础上识别 approval answer、
  task-card reply/mutate/draft dismiss、server response 和 request decline。
- `public/app.js` 仍负责调用真实业务函数，不改变任务卡、审批、图片预览或文件预览语义。
- 新 helper 加入 `index.html`、PWA shell cache、client shell asset list、server
  public-config asset list 和 `npm run check`。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v457`。

`test/thread-detail-actions.test.js` 覆盖 action plan、selector priority、root containment
和任务卡/server-response 分类；既有 UI wiring tests 约束 conversation click path 必须通过
`CodexThreadDetailActions`。

## 2026-06-26 v456 Thread Detail Hydration Orchestration

v456 接续 v455，继续 Phase A。v455 已经把 turn article creation 推进到
`public/thread-detail-dom-patch.js`，但 thread detail patch 后的 hydration 调度仍
散落在 `public/app.js`：full conversation render、tile pane patch、local patch
completion 分别直接调用 GitHub link hydrate、Mermaid hydrate 和 image scan。

本次把 thread detail surface hydration 调度推进到 `public/thread-detail-dom-patch.js`：

- 新增 `hydrateRenderedSurface`。
- `public/app.js` 新增薄包装 `hydrateThreadDetailSurface`，只注入现有
  `hydrateGitHubLinkCards`、`hydrateMermaidDiagrams`、`scheduleFailedAppImageScan`。
- full conversation render、thread tile pane patch、local patch completion 统一通过
  `hydrateThreadDetailSurface`。
- same-signature render 维持旧行为，只触发 image scan，不额外触发 GitHub/Mermaid hydrate。
- helper 不吞 callback 异常，不新增隐藏 fallback、不跳过 refresh、不改变图片或 Markdown
  渲染规则。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v456`。

`test/thread-detail-dom-patch.test.js` 覆盖 hydration 调用顺序、image scan delay
参数、missing root 和 callback error propagation；`test/mobile-viewport.test.js`
约束 thread detail patch 路径必须委托 helper。

## 2026-06-26 v455 Turn Article Creation

v455 接续 v454，继续 Phase A。v454 已经把 `turnArticleNode` 的
`[data-render-key=...]` lookup selector 推进到 `public/thread-detail-dom-patch.js`，
但 `insertTurnArticleDom` 和 refresh patch 的 `renderTurnElement` 回调仍在
`public/app.js` 中直接执行 `renderTurn(...) -> firstElementFromHtml(...)`。

本次把 rendered turn HTML 转成 DOM article 的 creation 步骤也推进到
`public/thread-detail-dom-patch.js`：

- 新增 `createElementFromHtml` 和 `createTurnArticleElement`。
- `public/app.js` 继续拥有 `renderTurn` 和具体 document 注入，但不再自己创建
  turn article element。
- `firstElementFromHtml` 保留为兼容包装，但内部委托 helper。
- 行为保持不变：空 HTML、缺 document、template 创建异常、render 异常仍返回
  `null`，不新增隐藏 fallback、不强制刷新、不合成缺失消息。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v455`。

`test/thread-detail-dom-patch.test.js` 覆盖 HTML creation、turn renderer 注入和
render/document failure；`test/mobile-viewport.test.js` 约束 app 层必须委托 helper。

## 2026-06-26 v454 Turn Article Lookup

v454 接续 v453，继续 Phase A。v453 已经把新 turn article 的插入锚点规则
推进到 `public/thread-detail-dom-patch.js`，但 `turnArticleNode` 仍在
`public/app.js` 中直接拼接 `[data-render-key=...]` selector 并查询 DOM。

本次把 turn article lookup 规则也推进到 `public/thread-detail-dom-patch.js`：

- 新增 `findElementByRenderKey` 和 `findTurnArticleElement`。
- `public/app.js` 只负责计算 `stableTurnKey` 并注入 selector 转义函数，不再直接
  查询 turn article selector。
- lookup 失败仍返回 `null`，不新增隐藏 fallback、不跳过 refresh、不做重复过滤。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v454`。

`test/thread-detail-dom-patch.test.js` 覆盖正常 lookup、缺 root/key 和 selector
异常；`test/mobile-viewport.test.js` 约束 `turnArticleNode` 必须委托 helper。

## 2026-06-26 v453 Turn Article Anchoring

v453 接续 v452，继续 Phase A。v452 已经把 turn-level `item-patch`、
`insert-turn`、`replace-turn` 执行循环推进到 `public/thread-detail-dom-patch.js`，
但 `insertTurnArticleElementDom` 仍在 `public/app.js` 中自己决定新 turn article
应该插到哪里：先找前一个已渲染 turn 的 `nextSibling`，找不到再插到第一个
`.turn` 之前，否则 append。

本次把这块 anchoring 规则也推进到 `public/thread-detail-dom-patch.js`：

- 新增 `resolveTurnInsertAnchor` 和 `insertTurnArticleElement`。
- `public/app.js` 只注入 conversation、source element、visible turns、
  turn element lookup 和 first-turn lookup，不再拥有 anchor selection loop。
- 行为保持不变：优先插到最近一个已渲染前序 turn 后面；没有前序节点时插到
  第一个 turn 之前；空 conversation 时 append。
- `CLIENT_BUILD_ID` 和 PWA shell cache 升级到 `codex-mobile-shell-v453`。

`test/thread-detail-dom-patch.test.js` 覆盖 after-previous、before-first、append
以及 missing conversation/source/turn/find callback 的 bounded failure reason。

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
- `adapters/thread-list-fallback-baseline-service.js`：线程列表 fallback
  baseline 的三路 source collection、source timing/count、merge 和 limit
  边界。
- `adapters/thread-list-fallback-cache-service.js`：线程列表 fallback cache
  的进程内 cache key、TTL 诊断开关、hit/miss/expired 记忆和增量
  status/title/archive update。
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
- 中文说明：server-only 修正 `跨工作区委派` 写保护没有覆盖直接工具调用的问题。开启后，普通插件线程默认使用 `danger-full-access` / `dangerFullAccess` 加 `approvalPolicy:on-request` 的兼容运行时，继续通过 Mobile Web source-write guard 自动允许当前工作区读写和当前 `.git` 审批、拒绝其他已知源码根的写入。这个默认是 `codex_mobile_workspace_read_compat_20260630` mitigation，因为当前 app-server `workspace-write` 会把工作区根生成为 write-only，导致可进入 cwd 但不能读源码；`CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD=1` 可显式切回硬 sandbox，managed profile 只保留为 `CODEX_MOBILE_WORKSPACE_DELEGATION_MANAGED_PROFILE=1` 诊断兼容模式。本次不改变 PWA shell cache。
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
`thread/resume`, and `turn/start` requests with `danger-full-access` /
`dangerFullAccess` plus `approvalPolicy:"on-request"`. This is registered as
`codex_mobile_workspace_read_compat_20260630` because current app-server
`workspace-write` turns can collapse the workspace root to write-only and block
existing source reads. App-server approval requests are auto-answered by
`adapters/workspace-source-write-guard-service.js`: reads, MCP calls, network,
current-workspace writes, current `.git` writes, and narrow Home AI provided
tool commands are allowed; direct `apply_patch`, file changes, `git add/commit`,
write-like commands, or write-like file-system grants into another known source
root are denied so the source model can delegate through a task card. The guard
uses thread/turn ownership to identify the source workspace before considering a
command cwd, so setting a command cwd to Home AI does not bypass plugin
workspace boundaries. Operators can opt back into the hard sandbox path with
`CODEX_MOBILE_WORKSPACE_DELEGATION_ENFORCE_SANDBOX_GUARD=1`; managed permission
profiles are diagnostic-only behind
`CODEX_MOBILE_WORKSPACE_DELEGATION_MANAGED_PROFILE=1`.

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

- 中文说明：v607 public 同步 private/production 已验证的部署线程池、跨线程任务卡片回执和运行时稳定性修复。routine plugin deployment task card 现在会按 `cardKind=plugin_deployment`、`pluginId` 和 live deploy lane 元数据稳定路由到专用部署线程；`Movie Deploy Lane`、`Codex Mobile Deploy Lane` 等配置 lane 在执行部署卡时会使用 unattended runtime 设置，避免 routine deploy/readback/self-check 被命令审批卡住。跨线程 return card 支持显式 `replyTo` 目标和 terminal receipt 自动注入，不再把多跳部署回执留在源线程 `Pending` / `Approve workflow`。同时同步 browser runtime self-check、thread detail response budget、client-event stall、public-config cache、thread-list/detail readback、Continuation/Continuous task card rendering 等稳定性修复。本次 public 发布只包含公开源码、README、docs 和测试；没有复制 `.agent-context`、runtime state、本地密钥、上传内容、VAPID/subscription 数据或机器特定诊断。

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
- Automatic receipt/detail refreshes, post-completion backfills, and live polls are also suppressed while the user is reading away from the bottom of the current thread; an explicit user action is required to resume those refreshes.
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
| `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM` | Startup default-list fallback prewarm toggle, default enabled. Set to `0` / `false` / `off` to disable. |
| `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_DELAY_MS` | Delay before the one-shot startup fallback prewarm, default `1500`. |
| `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_RETRY_MS` | Retry delay when startup prewarm is deferred because a thread detail request is currently in flight, default `2500`. |
| `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_MAX_DEFERRALS` | Maximum startup prewarm deferrals while thread detail first paint is active, default `5`. |
| `CODEX_MOBILE_THREAD_LIST_FALLBACK_PREWARM_LIMIT` | Thread-list limit used by the startup fallback prewarm, default `40` to match the client list page size. |
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

## 2026-06-27 Phase A Conversation DOM Update Outcome Slice

This local/private slice continues the thread-detail render/patch ownership
work without changing user-facing render strategy or bumping the shell cache.
The symptom boundary is conversation flicker / missing DOM turns where the
client can silently fall back from incremental HTML patching to full
`innerHTML` replacement. The failing layer is the conversation DOM update
application outcome in `updateConversationHtml`, not server projection,
thread-list fallback, task-card protocol, or Home AI diagnostic intake.

`public/thread-detail-dom-patch.js` now owns a bounded
`planConversationHtmlUpdateApplication` outcome. It classifies hydrate-only,
`patch-html`, direct `set-inner-html`, and `patch-html-failed` replacement
paths. The same helper also owns
`planConversationHtmlPatchFallbackClientEvent`, which decides whether a failed
patch should emit a bounded client event and which fields are allowed.
`public/app.js` uses those outcomes when applying conversation HTML; if a patch
attempt fails, the full replacement is now observable through bounded
client/performance metadata instead of being only a console warning. The
payload records action labels, visible-turn counts, update reason, and a
bounded reject reason only. It must not include message text, task-card bodies,
upload contents, paths, cookies, tokens, prompts, provider payloads, or long
logs.

The same helper now also owns `planConversationHtmlPerformanceEvent`, which
builds the bounded `conversation_render_ms` performance payload and slow-render
`force` decision. App code still records the actual duration and posts the
event, but it no longer selects telemetry fields directly.

Focused validation for the local slice:

```bash
node --check public/thread-detail-dom-patch.js && \
node --check public/app.js && \
node --test test/thread-detail-dom-patch.test.js \
  test/thread-detail-refresh-dom-harness.test.js \
  test/thread-detail-render-plan.test.js \
  test/conversation-render.test.js
```

Result: focused tests passed. This slice is not deployed by itself; keep batching
Phase A frontend ownership work before the next production deployment.

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
