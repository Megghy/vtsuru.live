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

- `TODO` 建立 VTS WebSocket 客户端封装（requestID/超时/断线处理）
- `TODO` 鉴权：token 请求/会话认证/APIState 轮询
- `TODO` plugin icon：`src/svgs/ic_vtuber.svg` -> 128x128 PNG base64（失败直接报错）
- `TODO` Tauri Store：持久化 `wsUrl/authToken`
- `TODO` 导入/导出（最小版）：仅 `wsUrl + authToken`

### M1 Hotkey Board（基础）

- `TODO` 拉取当前模型 hotkeys（`HotkeysInCurrentModelRequest`）
- `TODO` 网格展示 + 点击触发（`HotkeyTriggerRequest`）
- `TODO` 收藏（最小能力）

### M2 机位预设

- `TODO` 预设 CRUD（position/rotation/size + timeInSeconds）
- `TODO` 一键应用预设（`MoveModelRequest`）

### M3 Macro（串行、fail-fast）

- `TODO` Macro 数据结构（仅串行步骤）
- `TODO` Macro 执行器（任一步失败立刻终止并报错）
- `TODO` Macro 编辑 UI（添加/排序/删除/测试运行）
- `TODO` 支持步骤类型：trigger hotkey / move model / toggle item / play audio（音频可先占位）

### M4 Item System（混合模式）

- `TODO` ItemList：列出 instances 与 item files（用于绑定与整活）
- `TODO` 配饰（方案 A）：绑定 instance 的戴/脱（显隐语义需落地）
- `TODO` 整活（方案 B）：按 fileName load/unload
- `TODO` 掉落物：drop（load 到屏幕上方 + 物理/移动策略）

### M5 Manual Parameter Control（mode=add）

- `TODO` 参数槽（slot）系统：可编辑显示名/参数 ID/范围/步进/weight
- `TODO` 推杆注入（`InjectParameterDataRequest`，mode=add）
- `TODO` 持有（Hold）：持续注入 + 一键解除

### M6 Panic & AutoAction 联动

- `TODO` Panic：校准/重置物理（优先 hotkey 方案）
- `TODO` 状态监控进阶：连接/认证/VTS 版本/模型与 hotkeys 概览/RTT
- `TODO` AutoAction 新增 `ActionType: VTS_*`（最小配置 UI + 执行落地）

### M7 Hotkey Board 增强

- `TODO` 分组/搜索/置顶、颜色标记
- `TODO` hotkey 自定义图标绑定（API 不可用时）

### M8 多面板形态

- `TODO` 悬浮小窗模式（与完整页共用 store/组件）
- `TODO` 直播态交互优化（热区/密度/误触保护）

### M9 Profile/场景包

- `TODO` Profile 数据结构与持久化（聚合全量配置）
- `TODO` 一键切换 Profile（明确提示当前 Profile）
- `TODO` Profile 导入/导出与冲突策略（fail-fast）

### M10 OBS 联动

- `TODO` OBS 场景 -> VTS 机位预设映射配置
- `TODO` 切场触发（防抖 + 循环触发保护）

### M11 导入/导出完善

- `TODO` 导入/导出覆盖全量配置（版本化 schema + 严格校验）
- `TODO` 导入预览（展示将覆盖哪些项）

### M12 操作历史与回放

- `TODO` 记录 VTS 操作（来源：UI 点击、Macro、AutoAction）
- `TODO` 失败原因归一化（便于筛选与统计）
- `TODO` 一键重放（仅重放可安全重放步骤）

## 更新日志

- 2026-01-17：创建本文件，按 `docs/client_vts/DESIGN.md` 拆解任务清单。

