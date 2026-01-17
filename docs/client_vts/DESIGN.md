# 客户端：VTube Studio（VTS）控制功能 - 目标与规划（草案）

> 适用范围：`src/apps/client`（客户端工具页），与现有弹幕、自动操作、OBS 管理等能力并列。
>
> 本文优先汇总「关键决策」与「更多功能建议」，用于先把方向讨论清楚；随后给出可落地的架构与里程碑。

## 1. 已确认决策（优先对齐实现）

> 以下结论来自讨论结果，后续实现与 UI 以此为准。

### 1.1 运行环境与连接边界

- 仅支持 **Tauri**（桌面端）。
- WebSocket 地址：
  - 默认：`ws://127.0.0.1:8001`
  - **不支持多配置共存**（单一配置），但支持 **导入/导出** 迁移。

### 1.2 插件身份（pluginName / pluginDeveloper / pluginIcon）

- `pluginName = "vtsuru"`
- `pluginDeveloper = "Megghy"`
- `pluginIcon` 使用：`src/svgs/ic_vtuber.svg`
  - 备注：VTS token 请求期望 `base64` 编码的 **128x128 PNG/JPG**。实现上建议在前端运行时将 SVG 渲染到 canvas 后导出 PNG，再 base64 发送（失败则直接提示错误，不静默跳过）。

### 1.3 鉴权 token 的持久化策略

- token 存 **Tauri Store**（`@tauri-apps/plugin-store`），不使用 localStorage。
- 不支持多 token / 多地址并存；通过导入/导出做迁移即可。

### 1.4 「表情与动作」的来源与展示信息

- 默认优先从 VTS API 获取 hotkeys（`HotkeysInCurrentModelRequest`）。
- 图标策略：
  - 优先：使用 API 信息（若未来能拿到图标则展示图标，否则展示名称）。
  - 若 API 无法满足展示：允许为 hotkey **手动绑定自定义图标**（作为增强能力）。

### 1.5 Macro（组合动作）的执行语义

- 执行：**仅串行步骤**（不做并行编排）。
- 失败策略：任一步失败 **立即终止并报错**（fail-fast），不做 `continueOnError`。

### 1.6 参数手动控制与面捕冲突

- 注入模式：统一使用 `InjectParameterDataRequest` 的 `mode: "add"`（更温和，不强行接管）。
- 暴露参数：由实现方提供**默认精选集合**（可配置/收藏），并允许用户手动添加参数 ID。

### 1.7 道具系统的边界

- 采用**混合模式**：
  - 换装/配饰：优先方案 A（绑定“已在场景里”的 instance，便于稳定戴/脱）。
  - 互动/整活：方案 B（按文件名动态 load/unload / drop）。

### 1.8 应急按钮：API 支持度与降级策略

- 允许用 **Hotkey** 作为实现方式（例如：校准/重置物理做成 VTS 热键，再由我们触发）。
- 状态监控做到 **进阶**：
  - WebSocket 连接状态、认证状态、VTS 版本、当前模型/hotkeys 概览
  - 延迟估算：以请求/响应 RTT 计算（不依赖服务器时间）
  - 面捕/跟踪状态：优先走 VTS 可用的事件/统计 API（若不可得则明确显示“不可用”，不伪造）

### 1.9 配置策略

- 不做多配置共存（单一配置）。
- 支持 **导入/导出**：用于迁移/备份（包含 wsUrl、token、hotkey 自定义图标绑定、宏、机位预设、道具绑定、参数收藏等）。

## 2. 扩展能力清单（已纳入范围）

> 已确认：本节所有能力最终都要实现。按优先级分批交付，避免一次性堆砌导致不可用。

- **Hotkey 收藏/分组/搜索**：按“常用/情绪/动作/切模型/背景”分组；支持置顶与快速搜索；支持颜色标记。
- **多面板形态**：侧边栏完整页 + 悬浮小窗（直播时常驻，尽量不遮挡主要区域）。
- **与 AutoAction 深度联动**：新增 `ActionType: VTS_*`，让礼物/上舰/SC/关注触发 VTS hotkey、道具、机位与参数持有。
- **与 OBS 联动**：OBS 场景切换时自动触发某个 VTS 机位预设（反向联动可后置）。
- **Profile/场景包**：一键切换整套配置（hotkey 布局、宏、机位、道具可见性、参数持有状态）。
- **导入/导出**：JSON 一键备份与迁移（多电脑/重装/分享）。
- **操作历史与回放**：宏执行记录、失败原因；支持一键重放（用于排查与复现）。

## 3. 功能目标（按优先级）

### 3.1 表情与动作管理（Visual Hotkey Board）

- 读取当前模型已配置的 Hotkeys（网格展示）。
- 点击触发：`HotkeyTriggerRequest`（支持按 `hotkeyID`）。
- UI：名称为主；支持颜色标记与标签；支持收藏/分组（至少收藏）。

### 3.2 机位与场景快速切换（Camera/Model Transformer）

- 保存/调用位置预设：`positionX/positionY/rotation/size`。
- 平滑过渡：`MoveModelRequest.data.timeInSeconds`。
- 提供三个默认示例：杂谈/游戏/特写（可编辑）。

### 3.3 道具与挂件系统（Item System）

- 快速切换道具显隐（按 instance 或文件名）。
- 掉落物：在屏幕上方 load item，再由物理掉落（或通过 move 模拟轨迹）。
- 为后续弹幕/礼物联动留出 API：`drop(itemFileName, options)`。

### 3.4 参数手动控制（Manual Parameter Control）

- 参数推杆：对选定参数注入值（`InjectParameterDataRequest`）。
- 参数锁定（更准确叫“持有/Hold”）：以明确语义实现“持续注入（mode=add）”，并提供一键解除。
- 预置常用参数面板（可编辑/可增删）：
  - 默认提供若干“参数槽”（slot），每个 slot 由用户填写 **参数 ID**，并可设置显示名、范围与步进。
  - 推荐默认 slot（初始即创建）：`Blush`、`Pale`、`Body_Y`、`EyeOpen`、`MouthOpen`（参数 ID 需用户按模型实际填写）。

### 3.5 应急与调试（Panic & Debug）

- 一键校准/重置物理（若无 API 则走 hotkey 方案）。
- 连接状态监控：连接/认证状态、VTS 版本、延迟估算、当前模型与 hotkey 数量。

## 4. 项目内现状与集成点（基于当前代码）

- 客户端入口路由：`src/app/router/client.ts`
- 客户端布局：`src/apps/layouts/ClientLayout.vue`（侧边栏菜单）
- 状态管理：Pinia（例如：`src/apps/client/store/useOBSStore.ts`、`src/apps/client/store/useSettings.ts`）
- 自动操作系统：`src/apps/client/store/useAutoAction.ts` + `src/apps/client/store/autoAction/*`
  - 当前 `ActionType` 仅有：发送弹幕/私信/执行命令（执行命令目前未实现）。
  - VTS 能力建议作为新的 `ActionType` 扩展，而不是“塞进 execute_command”。

## 5. 总体技术方案（建议）

### 5.1 目录与模块拆分（建议落点）

> 以“薄 API 层 + 单一 store + 多 UI 组件”的方式落地，避免把 WebSocket 细节散落到页面里。

- `src/apps/client/api/vts/`
  - `client.ts`：WebSocket 连接、requestID 管理、收发消息、超时/断线处理（fail-fast）。
  - `messages.ts`：请求/响应类型定义（最小可用即可，逐步补全）。
  - `helpers.ts`：常用封装（listHotkeys、triggerHotkey、moveModel、injectParams、listItems、loadItem、unloadItem）。
- `src/apps/client/store/useVtsStore.ts`
  - state：连接状态、认证状态、token、当前模型信息、hotkeys、items、统计信息、错误信息。
  - actions：connect/auth/reconnect、refreshHotkeys、triggerHotkey、applyPreset、runMacro、toggleItem、dropItem、startParamHold/stopParamHold。
- `src/apps/client/pages/ClientVTS.vue`
  - UI 容器页（与 ClientSettings/ClientAutoAction 并列）。
- `src/apps/client/components/vts/*`
  - `VtsConnectionCard.vue`、`VtsHotkeyBoard.vue`、`VtsMacroPanel.vue`、`VtsPresetPanel.vue`、`VtsItemPanel.vue`、`VtsParameterPanel.vue`、`VtsPanicPanel.vue`。

### 5.2 持久化（建议）

- token：Tauri Store（建议 key：`vts.authToken`）
- 地址/端口：Tauri Store（建议 key：`vts.wsUrl`，默认 `ws://127.0.0.1:8001`）
- 预设/宏/收藏/自定义图标绑定：Tauri Store（单配置），并提供导入/导出 JSON

### 5.3 导入/导出（建议）

> 目标：让“单配置”也具备迁移能力，不引入多配置复杂度。

- 导出：从 Tauri Store 聚合为单个 JSON（用户保存到本地文件）。
- 导入：校验 schema 版本与关键字段后写入 Tauri Store（失败直接报错，不做模糊修复）。
- 建议格式（示意）：
  - `version`: number
  - `wsUrl`: string
  - `authToken`: string
  - `hotkeyCustomizations`: 以 `hotkeyID` 为 key 的显示名/颜色/图标绑定
  - `presets`: 机位预设列表
  - `macros`: 宏列表（串行步骤）
  - `items`: 配饰（instance 绑定）与整活（fileName 绑定）的映射
  - `parameters`: 参数槽与收藏（含范围/步进/weight）

### 5.4 错误处理（fail-fast）

- 连接/认证失败：明确暴露错误（UI notification + store error state），不静默吞掉。
- 用户点击触发失败：提示原因（未连接/未认证/目标不存在/超时）。
- 自动触发失败（AutoAction 场景）：记录失败原因，并提供“快速定位”入口（例如：跳转到 VTS 页或展示状态条）。

## 6. 关键 API（以 VTS Public API 为准）

> 本节只列 MVP 用到的最小集合，避免一次性写全协议。

### 6.1 鉴权

- 首次申请 token：`AuthenticationTokenRequest`（触发 VTS 弹窗确认）
- 会话鉴权：`AuthenticationRequest`（使用已保存 token）
- 状态查询：`APIStateRequest` / `APIStateResponse`

### 6.2 Hotkeys

- 列表：`HotkeysInCurrentModelRequest` -> `availableHotkeys[]`
- 触发：`HotkeyTriggerRequest`（按 `hotkeyID`；可选 `itemInstanceID`）

### 6.3 机位/模型变换

- `MoveModelRequest`：`positionX/positionY/rotation/size` + `timeInSeconds`

### 6.4 参数注入（推杆/持有）

- `InjectParameterDataRequest`
  - `mode: "set" | "add"`
  - `parameterValues: [{ id, value, weight? }]`
  - `faceFound` 可根据需要填（MVP 可不依赖该字段）

### 6.5 道具

- 列表：`ItemListRequest`（可包含 availableSpots / instances / availableFiles）
- 加载：`LoadItemIntoScene`（按 fileName，支持 position/size/rotation/fadeTime/unloadWhenPluginDisconnects）
- 移动：`ItemMoveRequest`（可一次移动多 item）
- 卸载：`ItemUnloadRequest`

## 7. UI/UX 规划（对齐项目 shadcn 风格）

- 在 `ClientLayout` 侧边栏新增入口：`VTS 控制`
- 页面布局建议（上到下）：
  1) 连接卡片（地址、连接/断开、认证状态、刷新 hotkeys/items）
  2) Hotkey Board（网格 + 收藏 + 分组）
  3) 机位预设（按钮组 + 保存当前）
  4) 宏面板（宏列表 + 编辑器）
  5) 道具面板（搜索 + toggle + drop）
  6) 参数面板（收藏参数推杆 + 持有开关 + 一键清空持有）
  7) Panic（大按钮，放最醒目区域）

## 8. 里程碑（建议按阶段交付）

### M0：连接与鉴权打通（1-2 天）

- `useVtsStore`：connect/auth/APIState 轮询、错误可视化
- 基础设置：wsUrl、token 保存/清除（均使用 Tauri Store）
- plugin 身份固定：`pluginName=vtsuru`、`pluginDeveloper=Megghy`、icon=`src/svgs/ic_vtuber.svg`（运行时转 128x128 PNG base64）
- 导入/导出（最小版）：至少可导出/导入 `wsUrl + authToken`
- 成功标准：能稳定连上 VTS，能记住 token 并自动鉴权

### M1：Hotkey Board（1-3 天）

- hotkeys 列表 + 网格按钮触发
- 收藏/分组（至少收藏）
- 成功标准：替代“记 F1/F2”，主播可盲点触发常用表情/动作

### M2：机位预设（1-2 天）

- 保存/加载 preset（平滑过渡）
- 成功标准：杂谈/游戏/特写可一键切换且过渡自然

### M3：宏（2-4 天）

- 宏步骤：触发 hotkey / move model / toggle item / 播放音效（音效可先做占位）
- 宏编辑器：串行执行 + 失败即停（默认）
- 成功标准：谢礼模式等“一键连招”可复用可分享

### M4：道具系统（2-5 天）

- item 列表、toggle、drop
- 成功标准：墨镜/猫耳可一键戴脱；掉落物能稳定触发

### M5：参数推杆与持有（2-5 天）

- 收藏参数推杆 + 持有 + 一键解除
- 成功标准：面红/发青等能手动维持，并能快速恢复正常

### M6：应急与联动（2-6 天，按需）

- 校准/重置物理（若无直接 API：走热键方案）
- AutoAction 新增 `ActionType: VTS_*` 并落地最小配置 UI
- 成功标准：直播事故时“救命按钮”可用；弹幕/礼物触发 VTS 反馈形成闭环

### M7：Hotkey Board 增强（1-3 天）

- hotkey 分组/搜索/置顶、颜色标记
- hotkey 自定义图标绑定（当 API 无法提供图标信息时）
- 成功标准：热键规模变大也能“秒找秒点”，并可做视觉化分类

### M8：多面板形态（2-5 天）

- 悬浮小窗模式（与完整页共用 store 与组件，尽量只差布局与交互）
- 常用操作的“直播态优化”（小窗更紧凑、热区更大、误触更少）
- 成功标准：直播中无需切页面，常驻小窗即可完成绝大多数 VTS 操作

### M9：Profile/场景包（2-6 天）

- Profile 结构：聚合 hotkey 布局、宏、机位、道具绑定、参数槽/持有偏好
- Profile 切换：一键切换 + 明确提示当前 Profile
- 成功标准：不同直播内容（杂谈/游戏/联动）切换成本趋近于 0

### M10：OBS 联动（2-6 天）

- OBS 场景 -> VTS 机位预设触发（最小链路）
- 防抖与循环触发保护（避免频繁切换造成体验抖动）
- 成功标准：切 OBS 场景时 VTS 机位自动到位且稳定

### M11：导入/导出完善（1-3 天）

- 导入/导出覆盖全部配置项（不仅是 wsUrl/token）
- schema 版本化 + 严格校验（fail-fast）
- 成功标准：可稳定迁移/备份/分享配置且不会导入半残数据

### M12：操作历史与回放（2-5 天）

- 记录：用户点击与 AutoAction 触发的 VTS 操作（含耗时、成功/失败原因）
- 回放：选择一次历史记录一键重放（默认仅重放“可安全重放”的步骤）
- 成功标准：定位问题有据可查，复现问题不再靠口述

## 9. 风险与对策（聚焦 MVP）

- **Tauri WebView 差异**：避免依赖不稳定的浏览器特性；所有能力以 Tauri 可用为验收标准。
- **参数注入与面捕冲突**：默认只提供“收藏参数”并强调“持有/Hold”语义；一键解除必须显著。
- **道具可控性**：优先支持“绑定 instance”，动态 load 作为补充；避免把场景管理复杂度推给主播。
- **错误不可见导致误操作**：状态条常驻 + 最近错误可展开查看，严格 fail-fast。

## 更新日志

- 2026-01-17：创建本文档并确认关键决策（仅 Tauri、plugin 身份、Tauri Store 持久化、宏串行 fail-fast、参数 mode=add、道具混合模式、允许用 hotkey 实现应急、状态监控进阶）。
