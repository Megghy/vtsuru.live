# 用户自定义页面（/@name/...）低代码搭建 + PR 扩展方案

> 目标：让“低技术力主播”像 lit.link 一样快速搭建静态落地页；同时允许“技术主播”通过 PR 贡献整页模板/区块组件，并由社区与维护者审核后上线。

## 0. UI/UX 设计规范（统一：shadcn）

本项目的用户页/编辑器相关 UI 统一采用 `shadcn` 风格：优雅克制、紧凑高效、人体工程学优先。

- 层级：以边框/轻阴影/间距体现层级，避免“堆叠大阴影 + 大圆角 + 高饱和背景”。
- 密度：紧凑但不拥挤；表单/按钮/列表行的点击热区建议 ≥ 32px。
- 状态：hover/active/focus 必须清晰；focus ring 对键盘操作友好。
- 可读性：对比度充足，文本层级清晰（标题/说明/禁用态）。
- 实现：可继续使用 Naive UI 作为组件基础，但视觉与交互需对齐 shadcn（token/变量优先，避免散落硬编码样式）。

## 1. 背景与现状

- 当前前端路由已存在个人页入口：`/@:id`（见 `src/app/router/index.ts`），其主页对应 `user-index`（`src/app/router/user.ts` -> `@/apps/user/pages/UserIndexView.vue`）。
- 项目已存在“模板 + 配置”的雏形：`src/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue` 通过 `defineTemplateConfig()` 暴露模板配置（见 `src/data/VTsuruConfigTypes.ts`）。

本方案在此基础上新增一套“lit.link 风格的区块页（Block Page）”，并将“技术主播 PR 整页”扩展为“提交自定义页面（Page）”，支持：

- **全局页面**：所有主播可用（例如：作品集页、赞助页、FAQ 页）
- **主播专属页面**：只允许某个主播使用（例如：为某位主播专门定制的活动页）

> 约定：`index` 只表示“主页（/@name）”，但“自定义页面”不止主页，因此不再把自定义页面放在 `indexTemplate` 目录下。

## 2. 目标与非目标

### 2.1 目标（MVP）

- `/@name`（主页）支持切换到“区块页模式（Block Page）”，主播可在管理后台可视化编辑：
  - 内容：头像/简介/链接/按钮/图片/公告/富文本/嵌入视频等
  - 排版：区块顺序、分组、宽度（单列为主，允许少量布局块如双列）
  - 样式：主题（Theme）+ 受控样式项（颜色/圆角/间距/字体大小等）
- 支持“自定义子页面”能力（例如：`/@name/<slug>`），同样可选择 Block Page 或 PR 页面模板渲染。
- 允许外部嵌入（Embed），但必须在“白名单提供商 + 受控参数”的安全边界内。
- 审核策略：
  - Block Page：先发后审（post-moderation），可被下架/冻结/回滚
  - PR：先审后合并（pre-moderation），合入后全站可用（模板/区块）

### 2.2 非目标（本阶段不做或谨慎做）

- 不开放“任意 HTML/CSS/JS 注入”的自由编辑器（风险与审核成本过高）。
- 不做复杂交互式页面编程模型（例如自定义脚本、数据绑定表达式、工作流编排）。
- 不承诺 SSR/SEO 深度优化（可作为后续迭代）。

## 3. 角色与使用路径

- 普通主播：
  1) 进入管理后台 -> 主页设置 -> 打开“区块页编辑器”
  2) 选择模板/主题 -> 添加区块 -> 填内容 -> 预览 -> 发布
  3) 发布后立即生效，审核状态为 Pending

- 技术主播（PR 贡献）：
  - 贡献整页：新增一个 `IndexTemplate`（整页模板）
  - 贡献组件：新增一个 `Block`（区块组件，给区块页/模板复用）
  - 发起 PR -> 自动检查 -> 人工审核 -> 合并 -> 上线可选

- 审核员/维护者：
  - 审核 Block Page：在后台列表中查看 Pending，支持 approve/reject/takedown
  - 审核 PR：代码审查 + 预览构建产物 + 安全/性能检查

## 4. 总体架构：双轨但同一“页面系统”

把 `/@name` 与其子页面的“页面渲染”抽象为统一入口：根据页面设置选择一种 Render Mode：

1) **Block Page（低技术力）**：用受控 JSON 描述页面，渲染为 Vue 组件树
2) **Contrib Page（技术 PR / 维护者）**：一个 Vue SFC，代表整页布局（可复用 Block）

> 重点：二者最终都由前端渲染，但“编辑能力与安全边界”不同。

### 4.1 建议的目录划分（前端）

（命名仅示意，按项目现有风格微调即可）

- `src/apps/user-page/`（建议后续可更名为 `user-pages`，当前仅做概念）
  - `types.ts`：Block Page schema、RenderMode、审核状态类型
  - `block-registry.ts`：区块注册表（白名单）
  - `theme.ts`：主题与受控样式 token
  - `render/BlockPageRenderer.vue`
  - `editor/BlockPageEditorView.vue`（管理后台页面）
  - `editor/blocks/*`：每类 block 的编辑表单（props 面板）
  - `blocks/*`：每类 block 的渲染组件（viewer）
- `src/apps/user/pages/indexTemplate/`（仅保留“主页模板”的历史/内置模板）
  - `DefaultIndexTemplate.vue`
- `src/apps/user/contrib/pages/`（新增：PR 贡献的“页面”）
  - `src/apps/user/contrib/pages/<pageId>.vue`：全局页面（所有主播可用）
  - `src/apps/user/contrib/pages/<streamerId>/<pageId>.vue`：主播专属页面（仅该主播可用，`streamerId` 为数字）

> 备注：Vite 下“按路径动态 import”建议用 `import.meta.glob()` 生成清单映射，避免不可分析的动态路径。

### 4.2 Contrib Page 的最小元信息（建议）

为保证“可发现、可审核、可路由、可授权”，建议每个 Contrib Page 暴露一份元信息（可用具名导出或 `defineExpose`）：

- `PageMeta`
  - `id`: string（pageId）
  - `title`: string
  - `slug`: string（用于 `/@name/<slug>` 路由；全局页面可固定 slug，主播专属页面可同样）
  - `scope`: `'global' | 'streamer'`
  - `streamerId?`: number（仅 scope=streamer 时）

> “整页 PR”不再绑定为“主页模板”，而是一种通用页面单元。

## 5. 数据模型（推荐）

### 5.1 用户页面设置（用户维度）

建议在用户 settings 中新增/扩展一段配置（与现有 `settings.index` 对齐），并把“主页 + 子页面”统一成 pages：

```ts
type UserPageRenderMode = 'contrib' | 'block'

interface UserPagesSettings {
  // 主页（/@name）
  home: {
    mode: UserPageRenderMode
    contribPageId?: string
    contribPageConfig?: unknown
    blockPage?: BlockPageProject
  }
  // 子页面（/@name/<slug>）
  pages: Array<{
    slug: string
    title: string
    mode: UserPageRenderMode
    contribPageId?: string
    contribPageConfig?: unknown
    blockPage?: BlockPageProject
    review?: ReviewMeta
  }>
}
```

### 5.2 Block Page Schema（受控 JSON）

核心原则：**schema versioned + block 白名单 + props 强类型化（或 JSON schema 校验）**。

```ts
interface BlockPageProject {
  version: 1
  theme: {
    themeId: string
    tokens?: Record<string, string | number>
  }
  blocks: BlockNode[]
}

type BlockNode =
  | ProfileBlock
  | LinksBlock
  | ButtonGroupBlock
  | RichTextBlock
  | ImageBlock
  | GalleryBlock
  | EmbedBlock
  | DividerBlock
  | SectionBlock
  | FooterBlock

interface BlockBase {
  id: string
  type: string
  hidden?: boolean
}
```

### 5.3 嵌入（Embed）策略（允许外部嵌入但必须白名单）

**不允许用户直接输入 `<iframe>` HTML**。改为：

```ts
type EmbedProvider = 'bilibili' | 'youtube' | 'twitch' | 'spotify' | 'twitter' | 'custom'

interface EmbedBlock extends BlockBase {
  type: 'embed'
  provider: EmbedProvider
  url: string
  // 可选：解析后的结构化字段（后端/前端解析都可）
  payload?: Record<string, string>
}
```

白名单实现要点：

- 只允许 `https:` 链接
- 每个 provider 做严格的 URL 解析与提取（例如只提取 BV 号 / videoId）
- 渲染时只拼装“固定的 iframe src 模板”，不直接使用用户输入作为 iframe src
- 限制 iframe 权限：`sandbox` + `allow` 精确化（按 provider 配置）

## 6. 渲染与安全边界

### 6.1 `/@name` 与子页面渲染流程（建议）

1) `UserIndexView` / 子页面 View 拉取：
  - 用户基础信息（已有）
  - 页面配置（home 或 pages[slug]）
2) 根据 `mode` 分发：
  - `block` -> `BlockPageRenderer`（渲染 blocks）
- `contrib` -> 从 `src/apps/user/contrib/pages/**` 清单中匹配对应页面并渲染
3) 审核状态展示：
  - 访客视角：仅看到已发布版本
  - 主播本人视角：可看到“已发布 + 待审核提示 + 草稿入口”

### 6.2 关键安全原则（必须）

- Block Page：不接收任意 HTML（富文本也必须走受控编辑器 + sanitization）
- 外部 embed：只允许白名单 provider，并固定 iframe 模板
- 所有外链默认加 `rel="noopener noreferrer"`，避免 opener 劫持
- 发布时后端校验（fail-fast）：
  - schema 版本正确
  - blocks 类型属于白名单
  - props 满足约束（长度/格式/域名白名单）
  - embed url 解析成功，否则拒绝发布

> 即使 PR 已审，用户生成内容仍必须校验；不要只依赖前端。

## 7. 编辑器体验（lit.link 风格）

### 7.1 页面结构（建议）

- 左侧：区块库（按类别：基础、媒体、链接、布局）
- 中间：实时预览（移动端优先；可切换手机/桌面宽度）
- 右侧：属性面板（当前选中 block 的字段编辑）
- 顶部：`保存草稿` / `预览` / `发布` / `回滚版本`

### 7.2 基础能力清单（MVP）

- 新增/删除区块
- 上移/下移/拖拽排序（优先拖拽；若不引入库，先做上下移动）
- 区块隐藏开关（不删除但不展示）
- 图片上传/裁切（项目已有 `vue-img-cutter`、上传返回 `UploadFileResponse` 相关类型）
- 富文本（项目已有 `@wangeditor/editor-for-vue`，需限制功能集）
- 主题选择（预置若干 Theme；同时提供少量 token 调整：主色、背景、圆角、间距密度）

## 8. 审核系统设计

### 8.1 Block Page：先发后审（post-moderation）

建议后端持久化两个版本：

- `draft`：主播编辑保存
- `published`：对外展示版本（发布即写入）

并单独记录审核状态：

```ts
type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'takedown'

interface ReviewMeta {
  status: ReviewStatus
  reviewedAt?: string
  reviewerId?: string
  reason?: string
}
```

行为约束（建议）：

- `pending` 仍允许对外展示（因为是先发后审）
- `takedown`：对外展示回退到“默认主页/空白提示”，主播本人仍可看到草稿并重新发布
- `rejected`：不自动下架已发布（否则等价于 takedown）；建议用于“本次提交不通过”并提示改正

### 8.2 管理端审核面板（最低配）

- 列表：未审核（pending）/ 已通过 / 已下架
- 详情：预览（渲染效果）+ 配置 diff（JSON 对比）+ 风险提示（是否包含 embed）
- 操作：approve / reject（带原因）/ takedown / restore

## 9. PR 贡献模型（先审后合并）

### 9.1 贡献“整页模板”（IndexTemplate）

定义：一个 Vue SFC，负责渲染整页布局（可复用现有组件与 Block）。

建议规范：

- 放置位置：
- `src/apps/user/pages/indexTemplate/contrib/<TemplateId>.vue`
- 必须导出：
  - `Config`：用 `defineTemplateConfig()` 声明可配置字段
  - `DefaultConfig`
  - `ConfigType`（与现有 DefaultIndexTemplate 模式一致）
- 必须可在移动端良好展示（单列为主）
- 禁止：
  - 私自打点、采集隐私信息
  - 任意外链脚本注入
  - 引入大量新依赖（确需引入必须在 PR 描述说明理由与体积影响）

审核重点：

- 安全：无敏感接口调用、无危险 DOM 注入、外链/iframe 受控
- 性能：首屏体积、渲染复杂度、资源加载策略
- 可维护性：命名清晰、逻辑简洁、UI/UX 对齐 shadcn 风格（紧凑、层级清晰、状态明显）

### 9.2 贡献“区块组件”（Block）

定义：可在 Block Page 里使用的一块组件（带 props schema + 编辑器面板 + viewer 渲染）。

建议最小交付物：

- `blocks/<type>/view.vue`：展示组件
- `blocks/<type>/schema.ts`：props 类型与校验（或 JSON schema）
- `blocks/<type>/editor.vue`：编辑面板组件（表单/交互需对齐 shadcn 风格）
- `block-registry.ts` 注册项（名称、分类、默认值、图标）

审核重点：

- props 校验完备（fail-fast），不接受“吞错默认值”
- 与主题 token 兼容
- 对 embed/外链做严格白名单

## 10. 实施里程碑（建议）

### M0：规格落地（1-2 天）

- 确认 schema、审核状态、最小 block 清单、主题 token
- 确认后端接口（如已有 index API，决定是复用还是新建）

### M1：Viewer（2-4 天）

- BlockPageRenderer + 10 个基础 blocks（Profile/Links/Button/RichText/Image/Embed/Divider/Section/Footer 等）
- `/@name` 支持按 mode 渲染

### M2：Editor（3-7 天）

- 管理后台的 Block Page Editor（添加/排序/编辑/预览/发布）
- 资产上传、富文本限制、主题选择

### M3：审核（2-5 天）

- 后端审核状态字段 + 管理端审核面板
- takedown/restore + 预览与 diff

### M4：PR 扩展（持续）

- IndexTemplate registry + 文档 + PR 模板
- Block 贡献指南与示例（可选）

## 11. 风险与对策

- 外部嵌入风险：
  - 对策：provider 白名单 + URL 解析 + iframe sandbox/allow 精细化
- 审核成本上升：
  - 对策：Block Page 先发后审 + 自动规则提示（含 embed 的页面标红）
- 技术主播提交“整页”质量参差：
  - 对策：贡献规范、预览截图要求、依赖与体积门槛、必要时拒绝合并
