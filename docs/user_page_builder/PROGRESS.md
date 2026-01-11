# 用户自定义页面系统（/@name/...）- 进度追踪

> 本文件用于“长期追踪实施进度”。每次推进请更新：日期、负责人、完成项与风险。

## 状态定义

- `TODO`：未开始
- `DOING`：进行中
- `DONE`：已完成
- `BLOCKED`：阻塞（写清阻塞原因）

## 当前结论（需求约束）

- 路径：只挂在 `/@name`
- 配置大小：`user-pages*` JSON 上限提升至 128KB
- 子页面数量：每个用户最多 16 个子页面（不含 home）
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
- [DONE] 资源上传（图片）、富文本（wangeditor 限制工具栏）
- [DONE] 主题选择 + 少量 token 调整（primary/background/text/radius/spacing）
- [DONE] 发布与版本：draft/published + 回滚（已接入后端接口；当前回滚为“上一版本”）
- [DOING] 子页面管理：新增/删除/slug/发布（已做基础 CRUD；已补 title/description/navVisible/navOrder；支持 slug 重命名/复制；更多字段待补）

### M3 审核（先发后审）

- [TODO] Block Page 审核（当前暂不做；Contrib 走 GitHub 审核）
- [TODO] 管理端：待审核列表 + 预览 + JSON diff + approve/reject/takedown/restore
- [TODO] 下架后的访客回退页策略（默认主页/提示页）

### M4 PR 扩展（先审后合并）

- [DONE] Contrib Page registry（从目录自动发现、支持全局/主播专属）
- [DONE] Block registry（区块组件白名单注册）
- [DONE] 贡献指南：模板/区块的目录结构、限制与审核清单
- [DONE] PR 模板：要求截图/体积/安全说明（可选）

## 风险清单（持续维护）

- [TODO] 外部嵌入安全边界（provider 白名单、URL 解析、iframe 权限）
- [TODO] 审核负担（pending 激增时的策略：抽检/自动规则/举报联动）
- [TODO] 性能与体积（新增 blocks/模板导致首屏变重）

## 更新日志

- 2026-01-04：创建方案文档与进度追踪文件（M0 DONE: 文档）。
- 2026-01-06：落地 M1 Viewer：新增 `/@name/<slug>` 渲染入口、BlockPageRenderer（10 个 blocks）与 Contrib Page 动态加载；MVP 存储暂定复用 `user-config`（`user-pages`）。
- 2026-01-10：落地后端接口 `api/user-pages/*`：支持 draft/published、上一版本回滚；管理端保存逻辑切换为“保存草稿/发布/回滚”；图片上传复用 `/api/files/upload` 并用 `*File` 字段引用（便于后端统一管理）。
- 2026-01-10：新增 `richText` block：编辑端接入 wangeditor（限制工具栏），图片上传复用 `/api/files/upload` 并用 `imagesFile` 跟踪引用；子页面支持填写 `title`（用于列表展示）。
- 2026-01-10：子页面支持 slug 重命名；编辑器图片上传显式使用 `UserFileTypes.Image`（复用既有上传与后端清理）。
- 2026-01-10：抽出 Block registry（统一区块清单/组件映射/默认值）；Contrib Page `pageId` 输入增加自动补全（从目录扫描得到）。
- 2026-01-10：补充 GitHub PR 模板（截图/安全/性能检查清单）。
- 2026-01-10：编辑器增强：自动保存草稿+离开提示、区块拖拽排序/插入复制/删除确认、草稿/发布 diff 与资源引用列表；子页面前台导航（可隐藏/排序）；Contrib Page 支持动态配置面板（导出 Config/DefaultConfig）。
