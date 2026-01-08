# 用户自定义页面系统（/@name/...）- 进度追踪

> 本文件用于“长期追踪实施进度”。每次推进请更新：日期、负责人、完成项与风险。

## 状态定义

- `TODO`：未开始
- `DOING`：进行中
- `DONE`：已完成
- `BLOCKED`：阻塞（写清阻塞原因）

## 当前结论（需求约束）

- 路径：只挂在 `/@name`
- 允许外部嵌入：必须白名单 provider + 受控渲染
- 审核：
  - Block Page（lit 风格）：先发后审
  - PR（模板/组件）：先审后合并
- PR 类型：
  - `Contrib Page`：整页页面（全局/主播专属）
  - `Block`：区块组件
  - `IndexTemplate`：仅主页（历史/内置用途）
- 文件放置：
  - 全局页面：`src/apps/user/contrib/pages/<pageId>.vue`
  - 主播专属页面：`src/apps/user/contrib/pages/<streamerId>/<pageId>.vue`

## 里程碑

### M0 规格落地

- [DONE] 输出整体方案文档（`src/document/user_page_builder/DESIGN.md`）
- [DONE] 决定后端存储位置：MVP 先复用 `user-config`（配置名：`user-pages`）
- [TODO] 确认最小 block 清单与主题 token（以及哪些字段可由主播编辑）
- [DOING] 确认 embed provider 白名单（已先落地 bilibili / youtube）
- [DONE] 确认子页面路由形态：`/@name/<slug>`

### M1 Viewer（渲染）

- [DONE] `UserIndexView` 支持按 mode 渲染（contrib / block / legacy）
- [DONE] 子页面路由与渲染入口（`/@name/<slug>`）
- [DONE] BlockPageRenderer（受控 JSON -> Vue 组件树）
- [DONE] 10 个基础 blocks（profile/heading/text/links/buttons/image/embed/divider/spacer/footer）
- [DONE] 外链统一处理（noopener/noreferrer）与 embed iframe sandbox 策略（仅对白名单 provider）
- [DONE] Contrib Page 加载清单（`import.meta.glob('/src/apps/user/contrib/pages/**/*.vue')`）

### M2 Editor（编辑器）

- [DONE] 管理后台入口：主页设置 -> 区块页编辑器（/manage/user-page-builder）
- [DONE] 区块增删/排序/隐藏/预览（Block 预览使用同渲染器）
- [TODO] 资源上传（图片）、富文本（wangeditor 限制工具栏）
- [DONE] 主题选择 + 少量 token 调整（primary/background/text/radius/spacing）
- [TODO] 发布与版本：draft/published + 回滚（当前保存即发布，待后端支持版本/审核后完善）
- [DOING] 子页面管理：新增/删除/slug/发布（已做基础 CRUD；标题/更多字段待补）

### M3 审核（先发后审）

- [TODO] 后端：reviewStatus + reason + reviewedAt + reviewerId
- [TODO] 管理端：待审核列表 + 预览 + JSON diff + approve/reject/takedown/restore
- [TODO] 下架后的访客回退页策略（默认主页/提示页）

### M4 PR 扩展（先审后合并）

- [TODO] Contrib Page registry（从目录自动发现、支持全局/主播专属）
- [TODO] Block registry（区块组件白名单注册）
- [TODO] 贡献指南：模板/区块的目录结构、限制与审核清单
- [TODO] PR 模板：要求截图/体积/安全说明（可选）

## 风险清单（持续维护）

- [TODO] 外部嵌入安全边界（provider 白名单、URL 解析、iframe 权限）
- [TODO] 审核负担（pending 激增时的策略：抽检/自动规则/举报联动）
- [TODO] 性能与体积（新增 blocks/模板导致首屏变重）

## 更新日志

- 2026-01-04：创建方案文档与进度追踪文件（M0 DONE: 文档）。
- 2026-01-06：落地 M1 Viewer：新增 `/@name/<slug>` 渲染入口、BlockPageRenderer（10 个 blocks）与 Contrib Page 动态加载；MVP 存储暂定复用 `user-config`（`user-pages`）。
