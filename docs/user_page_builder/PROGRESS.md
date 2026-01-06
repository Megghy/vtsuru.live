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
- [TODO] 决定后端存储位置：复用现有 index API 还是新增 user-page API
- [TODO] 确认最小 block 清单与主题 token（以及哪些字段可由主播编辑）
- [TODO] 确认 embed provider 白名单（bilibili/youtube/twitch/spotify/twitter 等）
- [TODO] 确认子页面路由形态：`/@name/<slug>`（推荐）或其他

### M1 Viewer（渲染）

- [TODO] `UserIndexView` 支持按 mode 渲染（contrib / block）
- [TODO] 子页面路由与渲染入口（`/@name/<slug>`）
- [TODO] BlockPageRenderer（受控 JSON -> Vue 组件树）
- [TODO] 10 个基础 blocks（Profile/Links/Button/RichText/Image/Embed/Divider/Section/Footer…）
- [TODO] 外链统一处理（noopener/noreferrer）与 embed iframe sandbox 策略
- [TODO] Contrib Page 加载清单（`import.meta.glob('src/apps/user/contrib/pages/**')`）

### M2 Editor（编辑器）

- [TODO] 管理后台入口：主页设置 -> 区块页编辑器
- [TODO] 区块增删/排序/隐藏/预览
- [TODO] 资源上传（图片）、富文本（wangeditor 限制工具栏）
- [TODO] 主题选择 + 少量 token 调整
- [TODO] 发布与版本：draft/published + 回滚
- [TODO] 子页面管理：新增/删除/slug/标题/发布（与主页同模型）

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
