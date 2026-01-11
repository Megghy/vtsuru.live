# 用户自定义页面系统 - 待办事项（按完成顺序）

> 说明：本清单来源于 `docs/user_page_builder/DESIGN.md` 的里程碑与近期补充建议。
> 目标：按“安全防线优先、体验其次”的顺序逐项落地，避免一次性大重构。

## P0 后端安全与一致性（必须）

- [x] `api/user-pages/publish` 后端 fail-fast 校验：schema/version、block 白名单、props 约束、embed provider 校验、richText 长度/图片数等
- [x] `richText` 后端净化（HtmlSanitizer 规则集），作为最终防线（前端净化保留）
- [x] `contrib` mode 后端校验：`scope/pageId/streamerId` 组合合法

## P1 编辑器体验（M2）

- [x] 区块拖拽排序（替代 ↑↓）
- [x] 区块操作：插入到上方或下方（复制）/ 删除二次确认
- [x] 页面操作：复制子页面 / slug 重命名（已完成）/ 删除（已完成）

## P1 草稿管理

- [x] 自动保存草稿（debounce）：变更后自动 `save-draft`，展示“未保存/保存中/上次保存时间”
- [x] 离开页面提示未保存（beforeunload + router leave）
- [x] 草稿/已发布：操作支持“从已发布覆盖草稿 / 从草稿覆盖已发布（发布）”

## P2 发布前检查与可视化

- [x] 发布前检查：JSON 体积估算（对齐后端 128KB 上限）、必填项汇总、外链/Embed 风险提示
- [x] 草稿 vs 已发布 diff（至少行级 diff）

## P2 资源管理（统一清理/可维护）

- [x] 编辑器“已引用资源列表”（从 `*File` 字段递归提取），展示 id/path/引用位置
- [x] “重新整理引用”：按当前配置去重/过滤（例如 richText 的 `imagesFile` 仅保留 html 中实际出现的图片）

## P3 子页面能力扩展

- [x] 子页面字段补齐：`navVisible`/`navOrder`/`description`（title 已完成）
- [x] 前台子页面导航（home 与子页均可展示，按 order 排序，可隐藏）

## P3 Contrib（PR 扩展）

- [x] Contrib Page 在管理端 `pageId` 自动补全（已完成）
- [x] Contrib Page 可配置：若页面导出 `Config/DefaultConfig`，管理端动态加载并展示配置面板（写入到 `contrib.config`）
