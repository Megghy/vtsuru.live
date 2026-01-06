# 用户自定义页面（/@name/...）相关 PR 贡献指南

本指南覆盖“用户自定义页面系统”的三类贡献：

- `Contrib Page`：整页页面（技术主播贡献“整个页面”的推荐方式）
- `IndexTemplate`：主页模板（历史/内置用途，仅用于 `/@name` 主页，谨慎使用）
- `Block`：区块组件（给 lit.link 风格 Block Page/模板复用）

> 目标：让审核可控、线上安全、移动端好看，并且避免引入不可维护的复杂度。

## 1. 提交前：你需要知道的边界

- `/@name` 是公开页面：任何代码合入后都可能被大量访问。
- 外部嵌入允许，但必须走白名单 provider，并由渲染端拼装固定 `iframe src`（禁止直接输出用户输入的 `<iframe>`）。
- 不接受“任意 HTML/CSS/JS 注入式编辑器”相关改动（除非方案另行批准）。
- “用户生成内容”必须 fail-fast 校验；不要吞错返回默认值/空对象。

## 2. PR 类型 A：Contrib Page（整页页面）

### 2.1 定义

`Contrib Page` 是一个 Vue SFC，用于渲染 `/@name/<slug>` 的整页布局（也可用于 `/@name` 主页）。它可以：

- 使用现有的 Naive UI 组件
- 读取 `userInfo/biliInfo` 等公开数据
- 读取并应用自己的 `pageConfig`

### 2.2 文件放置建议

按页面作用域分两类：

- 全局页面（所有主播可用）：`src/apps/user/contrib/pages/<pageId>.vue`
- 主播专属页面（仅该主播可用）：`src/apps/user/contrib/pages/<streamerId>/<pageId>.vue`（`streamerId` 为数字）

`pageId` 建议用短横线命名（kebab-case），例如 `minimal-links`、`glass-card`。

### 2.3 必须导出项（建议）

页面必须在 `<script lang="ts">` 中导出（或等价方式暴露）：

- `export const PageMeta = { id, title, slug, scope, streamerId? }`
- （可选）`export type ConfigType = ...`
- （可选）`export const DefaultConfig = ...`
- （可选）`export const Config = defineTemplateConfig([...])`

并在 `<script setup>` 中：

- 若存在可配置项：`defineExpose({ Config, DefaultConfig })`

### 2.4 审核清单（Contrib Page）

- 安全
  - 不注入外部脚本
  - 不读取/上传任何隐私信息（cookie/localStorage/设备信息等）
  - 外链统一 `rel="noopener noreferrer"`（或使用安全的打开方式）
  - embed 走白名单 provider（禁止 raw iframe/html）
- 体验
  - 移动端优先：窄屏不崩、不横向溢出
  - 视觉风格与站点一致（Naive UI + 现有主题）
- 性能
  - 不引入重量级新依赖；确需引入必须在 PR 描述说明原因与体积影响
  - 避免首屏大量图片/视频同时加载（可用懒加载）

### 2.5 PR 描述建议（Contrib Page）

- 一句话说明模板定位（适合谁、风格是什么）
- 截图：移动端 + 桌面端
- 配置项说明（Config 字段）
- 是否包含 embed（以及支持哪些 provider）

## 3. PR 类型 B：Block（区块组件）

### 3.1 定义

`Block` 是 “Block Page 的一个区块类型”，包含：

- viewer 渲染组件（对外展示）
- editor 面板（主播编辑 props）
- schema/校验（fail-fast）
- 注册信息（名称、分类、默认值等）

### 3.2 设计原则

- props 必须可序列化（JSON-friendly），不要塞函数/类实例
- 校验失败直接报错或拒绝发布，不要默默降级
- 样式受主题 token 控制：尽量使用变量/统一间距，而不是写死像素

### 3.3 审核清单（Block）

- schema 与 editor 面板一致（不会出现“面板能填但渲染不支持”）
- 允许外链/嵌入时：
  - url 必须 `https:`
  - provider 白名单 + 解析提取 + 固定 iframe 模板
- viewer 不做网络请求（除非明确批准并可控）

## 4. 通用要求

- 代码风格遵循仓库现有写法（Vue 3 + TS + Naive UI）。
- 能通过 `bun run lint`（如本仓库 CI/本地流程使用该命令）。
- 不要把无关重构混进 PR；一个 PR 解决一件事。

## 5. 如果你要提交“主播专属页面”（只给某个主播用）

推荐做法：提交 `Contrib Page` 到 `src/apps/user/contrib/pages/<streamerId>/<pageId>.vue`，并在 `PageMeta` 中标记 `scope: 'streamer'` 与 `streamerId`。

不推荐把整套“个人定制页面代码”做成可任意加载的脚本/插件系统（安全与审核成本过高）；如确需支持，请先在 Issue/讨论中对齐 “iframe 隔离 + CSP + API 权限” 的方案后再提 PR。

## 6. PR 类型 C：IndexTemplate（主页模板，仅 /@name）

如果你明确要改的是“主页模板体系”（`src/apps/user/pages/indexTemplate/*`），请说明原因（例如：要替换默认主页视觉/结构），并避免把“子页面”放进该目录。
