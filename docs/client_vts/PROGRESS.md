# VTS 客户端功能 - 任务计划与进度追踪

> 范围：`src/apps/client`（仅 Tauri）。
>
> 本文件用于长期追踪实施进度：任务拆分、状态变化与阻塞原因。需求规格见 `docs/client_vts/DESIGN.md`。

## 状态定义

- `TODO`：未开始
- `DOING`：进行中
- `DONE`：已完成
- `BLOCKED`：阻塞（写清原因）

## 里程碑任务清单

### M0 连接与鉴权打通

- `DONE` 接入 `vtubestudio` 的 `ApiClient`（自动连接/重连/鉴权；不自研 WebSocket）
- `DONE` 鉴权：token 请求/会话认证/APIState 轮询
- `DONE` plugin icon：`src/svgs/ic_vtuber.svg` -> 128x128 PNG base64（失败直接报错）
- `DONE` Tauri Store：持久化 `wsUrl/authToken`
- `DONE` 导入/导出（最小版）：仅 `wsUrl + authToken`

### M1 Hotkey Board（基础）

- `DONE` 拉取当前模型 hotkeys（`HotkeysInCurrentModelRequest`）
- `DONE` 网格展示 + 点击触发（`HotkeyTriggerRequest`）
- `DONE` 收藏（最小能力）

### M2 机位预设

- `DONE` 预设 CRUD（position/rotation/size + timeInSeconds）
- `DONE` 一键应用预设（`MoveModelRequest`）
- `DONE` 从当前模型读取位姿（基于 `ModelMovedEvent` 缓存）

### M3 Macro（串行、fail-fast）

- `DONE` Macro 数据结构（仅串行步骤）
- `DONE` Macro 执行器（任一步失败立刻终止并报错）
- `DONE` Macro 编辑 UI（添加/删除/测试运行；steps 先用 JSON 编辑）
- `DONE` 支持步骤类型：hotkey / preset / wait / injectParam / accessory / prank / playAudio

### M4 Item System（混合模式）

- `DONE` ItemList：列出 instances 与 item files（用于绑定与整活）
- `DONE` 配饰（方案 A）：绑定 instance 的戴/脱（通过 `ItemAnimationControlRequest.opacity` 0/1）
- `DONE` 整活（方案 B）：按 fileName load/unload（`ItemLoadRequest`/`ItemUnloadRequest`）
- `DONE` 掉落物：drop（支持 fileName 模拟下落 + 可选 hotkey 触发，命中通过 ItemEvent 反馈）

### M5 Manual Parameter Control（mode=add）

- `DONE` 参数槽（slot）系统：可编辑显示名/参数 ID/范围/步进/weight
- `DONE` 推杆注入（`InjectParameterDataRequest`，mode=add）
- `DONE` 持有（Hold）：持续注入 + 一键解除

### M6 Panic & AutoAction 联动

- `DONE` Panic：校准/重置物理（hotkey 方案：可配置 hotkeyID 并一键触发）
- `DONE` 状态监控进阶（第一版）：连接/认证/VTS 版本/模型与 hotkeys 概览/RTT
- `DONE` 状态监控进阶（补全）：FPS/faceFound/handFound + 事件订阅 + 轮询兜底
- `DONE` AutoAction 新增 `ActionType: VTS_*`（最小配置 UI + 执行落地）

### M7 Hotkey Board 增强

- `DONE` 分组/搜索/置顶、颜色标记（当前：平铺/按类型/按自定义组 + 置顶/收藏筛选 + 颜色点）
- `DONE` hotkey 自定义图标绑定（通过本地上传图片 dataURL）

### M8 多面板形态

- `DONE` 悬浮小窗模式（Tauri `WebviewWindow` + `/vts-float-window`）
- `DONE` 直播态交互优化（误触保护：Hotkey 防误触双击触发）

### M9 Profile/场景包

- `DONE` Profile 数据结构与持久化（聚合全量配置，不含 wsUrl/token）
- `DONE` 一键切换 Profile（明确提示当前 Profile）
- `DONE` Profile 导入/导出与冲突策略（fail-fast）

### M10 OBS 联动

- `DONE` OBS 场景 -> VTS 机位预设映射配置
- `DONE` 切场触发（防抖 + 循环触发保护）

### M11 导入/导出完善

- `DONE` 导入/导出覆盖全量配置（版本化 schema + 严格校验；当前：v2 全量导入/导出已可用）
- `DONE` 导入预览（展示将覆盖哪些项）

### M12 操作历史与回放

- `DONE` 记录 VTS 操作（来源：UI 点击、Macro；持久化到 Tauri Store，保留最近 200 条）
- `DONE` 失败原因归一化（errorCode：如 `VTS_API:*` / `WS`）
- `DONE` 一键重放（仅重放可安全重放步骤）

## 更新日志

- 2026-01-17：创建本文件，按 `docs/client_vts/DESIGN.md` 拆解任务清单。
- 2026-01-18：通信层切换为 `vtubestudio` `ApiClient`（移除自研 WS 客户端）。
