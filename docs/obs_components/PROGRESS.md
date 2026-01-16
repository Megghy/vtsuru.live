# OBS 展示组件 - 清单与进度追踪

> 目标：仅讨论/规划“OBS 浏览器源内展示”的内容组件（纯展示），不涉及流程、稳定性、自愈、复用体系等实现策略。
>
> 本文件用于长期追踪：现有组件盘点 + 可新增组件清单 + 状态变化记录。

## 状态定义

- `TODO`：未开始
- `DOING`：进行中
- `DONE`：已完成
- `BLOCKED`：阻塞（写清原因）

## 现有实现（项目内已存在）

> 入口路由：`src/app/router/obs.ts`（`/obs/*`）与 `src/app/router/obs_store.ts`（`/obs-store/*`）。

### `/obs/*`

- `DONE` `/obs/danmuji`：弹幕姬（兼容 blivechat 风格）
  - 入口：`src/apps/obs/pages/DanmujiOBS.vue`
- `DONE` `/obs/web-fetcher`：弹幕收集器状态点（用于客户端 iframe/RPC）
  - 入口：`src/apps/obs/pages/WebFetcherOBS.vue`
- `DONE` `/obs/queue`：弹幕排队展示（列表滚动）
  - 入口：`src/apps/obs/pages/QueueOBS.vue`
  - 常用参数：`id`、`speed`
- `DONE` `/obs/live-lottery`：直播抽奖展示（参与者/结果）
  - 入口：`src/apps/obs/pages/LiveLotteryOBS.vue`
  - 常用参数：`code`
- `DONE` `/obs/live-request`：弹幕点播展示（多种样式）
  - 入口：`src/apps/obs/pages/request/LiveRequestOBS.vue`
  - 组件：`src/apps/obs/components/request/ClassicRequestOBS.vue`、`FreshRequestOBS.vue`、`MinimalRequestOBS.vue`
  - 常用参数：`id`、`style=classic|fresh|minimal`
- `DONE` `/obs/live-request-today`：今日已唱（点播历史滚动列表）
  - 入口：`src/apps/obs/pages/request/LiveRequestProcessedOBS.vue`
  - 常用参数：`id`
- `DONE` `/obs/music-request`：弹幕点歌展示（播放列表/等待列表）
  - 入口：`src/apps/obs/pages/request/MusicRequestOBS.vue`
  - 常用参数：`id`
- `DONE` `/obs/question-display`：棉花糖/提问箱展示卡片（可同步滚动）
  - 入口：`src/apps/obs/pages/QuestionDisplayOBS.vue`
  - 常用参数：`token`
- `DONE` `/obs/danmaku-vote`：弹幕投票展示（结果/倒计时/主题）
  - 入口：`src/apps/obs/pages/DanmakuVoteOBS.vue`
  - 常用参数：`hash` 或 `user`（内部解析）、`roomId`、`code`、`theme`

### `/obs-store/*`

- `DONE` `/obs-store/gamepad-manage`：游戏手柄映射管理页
  - 入口：`src/apps/obs-store/components/gamepads/GamepadViewer.vue`
- `DONE` `/obs-store/gamepad`：游戏手柄显示（纯展示）
  - 入口：`src/apps/obs-store/components/gamepads/GamepadDisplay.vue`
  - 常用参数：`overlay=true|false`

> OBS 组件库入口（用于展示/挑选组件）：`src/apps/obs-store/pages/OBSComponentStoreView.vue`
>
> 当前映射表：`src/apps/obs-store/data/obsConstants.ts`（含 `Example`、`Controller`）

## 建议新增（纯展示组件）

> 原则：尽量“0 配置可用”，需要配置时优先走 query 参数/简单 JSON；尽量只负责展示，不承担管理/写入。

### A. 时间与进度（通用）

- `TODO` `ClockOBS`：时钟（本地时间/日期/星期，可选 12/24h）
  - 形态：角标、小组件
  - 数据：本地时间即可
- `TODO` `CountdownOBS`：倒计时/计时器（目标时间戳或持续时间）
  - 形态：大字、条形进度
  - 数据：query `target` / `duration`
- `TODO` `GoalProgressOBS`：目标进度条（多目标、多段里程碑）
  - 形态：条形/环形/小卡片
  - 数据：query `current/target` 或后端只读接口

### B. 信息条/看板（通用）

- `TODO` `LowerThirdOBS`：下三分之一信息条（标题/副标题/头像/标签）
  - 用途：开场自我介绍、当前环节、联动嘉宾介绍
  - 数据：query 或后端配置只读
- `TODO` `ScheduleOBS`：今日流程卡（最多 N 条，当前高亮）
  - 用途：观众知道“接下来干嘛”
  - 数据：query 或后端配置只读
- `TODO` `NowPlayingOBS`：正在播放（曲名/歌手/封面/进度）
  - 数据：可先做纯展示（query），后续再接入客户端/播放器（不在本阶段要求）

### C. 排行榜/榜单（B 站/主播常用展示）

- `TODO` `TopSupportersOBS`：本场支持榜（SC/礼物/上舰 TopN）
  - 数据：需要后端提供只读聚合（或已有接口复用）
- `TODO` `RecentEventsOBS`：最近事件列表（上舰/礼物/SC/关注等）
  - 数据：需要事件流/聚合，只负责展示

### D. 弹幕衍生展示（B 站/虚拟主播更常用）

- `TODO` `KeywordHeatOBS`：关键词热度（热词/词云/TopK）
  - 数据：可从弹幕流做只读统计（展示端本地统计即可）
- `TODO` `DanmakuHighlightOBS`：精选弹幕（高亮若干条、带头像/徽章）
  - 数据：弹幕流（只负责展示与筛选）

### E. 通用模板屏（应急/过场）

- `TODO` `BRBScreenOBS`：BRB/准备中/回来了/下播感谢屏（可带小信息区）
  - 数据：纯静态/少量文字

## 里程碑（规划用）

### M0 盘点与规范

- [DONE] 盘点现有 `/obs/*` 与 `/obs-store/*` 入口与文件位置（见上方“现有实现”）
- [TODO] 为新增组件确定命名/路由规范（例如：`/obs/<component-id>` + query 参数约定）

### M1 纯展示基础包（建议优先）

- [TODO] `ClockOBS`
- [TODO] `CountdownOBS`
- [TODO] `LowerThirdOBS`

## 更新日志

- 2026-01-16：创建本文件；完成现有 OBS 组件盘点；补充“纯展示组件”候选清单（Clock/Countdown/LowerThird/榜单/热词/BRB 等）。

