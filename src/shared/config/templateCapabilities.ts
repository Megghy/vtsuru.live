import {
  CursorClick20Regular,
  Eye20Regular,
  Filter20Regular,
  Flash20Regular,
  LockClosed20Regular,
  MusicNote220Regular,
  Options20Regular,
} from '@vicons/fluent'
/**
 * 模板能力 (Capability) 通用注册表
 *
 * 设计目标: 作为「所有模板」的通用能力标记体系, 而非仅服务于歌单.
 * - 任意类型的模板 (歌单 / 日程表 / 未来新增) 都可以从这里挑选能力标签.
 * - 新增能力 = 往 TemplateCapabilities 里加一项; 给模板打标 = 在 templates.ts 的
 *   capabilities 数组里填能力 id. 两处都有类型约束, 拼错即报错.
 */
import type { Component } from 'vue'
import { markRaw } from 'vue'

/** 能力分类: 用于在 UI 上分组展示, 每类一个主题色与图标 */
export const CapabilityCategories = {
  display: { name: '显示', color: '#2080f0', icon: markRaw(Eye20Regular) },
  filter: { name: '筛选', color: '#18a058', icon: markRaw(Filter20Regular) },
  interaction: { name: '交互', color: '#f0a020', icon: markRaw(CursorClick20Regular) },
  request: { name: '点歌', color: '#d03050', icon: markRaw(MusicNote220Regular) },
  threshold: { name: '门槛', color: '#7c3aed', icon: markRaw(LockClosed20Regular) },
  performance: { name: '性能', color: '#909399', icon: markRaw(Flash20Regular) },
  config: { name: '配置', color: '#0891b2', icon: markRaw(Options20Regular) },
} as const satisfies Record<string, { name: string; color: string; icon: Component }>

export type CapabilityCategory = keyof typeof CapabilityCategories

export interface TemplateCapabilityMeta {
  /** 中文短名, 直接作为标签文字 */
  name: string
  /** 一句话说明, 作为 tooltip */
  description: string
  /** 所属分类 */
  category: CapabilityCategory
}

/**
 * 全部已知能力. key 即能力 id, 模板通过 id 引用.
 * satisfies 保证每项结构合法, 同时把字面量类型保留下来供 TemplateCapability 推导.
 */
export const TemplateCapabilities = {
  // —— 显示 ——
  showName: { name: '显示歌名', description: '展示歌曲名称', category: 'display' },
  showTranslateName: { name: '显示译名', description: '展示歌曲的译名 / 别名', category: 'display' },
  showAuthor: { name: '显示歌手', description: '展示作者 / 演唱者', category: 'display' },
  showLanguage: { name: '显示语言', description: '展示歌曲语言标签', category: 'display' },
  showTags: { name: '显示标签', description: '展示歌曲自定义标签', category: 'display' },
  showDescription: { name: '显示备注', description: '展示歌曲备注 / 描述', category: 'display' },
  showCover: { name: '显示封面', description: '展示歌曲封面图', category: 'display' },
  songCount: { name: '数量统计', description: '展示当前歌曲数量', category: 'display' },
  scheduleDate: { name: '日期范围', description: '展示该周日期范围和每天日期', category: 'display' },
  todayHighlight: { name: '今日标记', description: '突出显示当前日期对应的日程', category: 'display' },
  scheduleStats: { name: '日程统计', description: '展示直播场次、活跃天数等周统计', category: 'display' },
  categorySummary: { name: '分类摘要', description: '汇总节目分类并展示图例或分类索引', category: 'display' },
  characterArtwork: { name: '角色图片', description: '支持上传立绘、角色贴纸或频道识别图', category: 'display' },
  avatarFallback: { name: '头像替代', description: '未上传角色图片时可使用主播头像', category: 'display' },

  // —— 筛选 ——
  search: { name: '搜索', description: '按关键词搜索歌曲', category: 'filter' },
  filterByTag: { name: '标签筛选', description: '按标签过滤歌曲', category: 'filter' },
  filterByAuthor: { name: '歌手筛选', description: '按歌手过滤歌曲', category: 'filter' },
  filterByLanguage: { name: '语言筛选', description: '按语言过滤歌曲', category: 'filter' },
  filterByOption: { name: '点歌条件筛选', description: '按点歌门槛 (舰长 / 粉丝牌 / SC 等) 过滤', category: 'filter' },
  sort: { name: '排序', description: '点击表头按列排序', category: 'filter' },

  // —— 交互 ——
  randomPick: { name: '随机选歌', description: '随机抽取一首歌', category: 'interaction' },
  audioPreview: { name: '音频试听', description: '内置播放器试听歌曲', category: 'interaction' },
  keyboardNav: { name: '键盘导航', description: '支持键盘快捷键翻页 / 操作', category: 'interaction' },
  selfViewGuard: { name: '本人视图保护', description: '主播查看自己歌单时隐藏点歌按钮', category: 'interaction' },
  weekSwitch: { name: '周次切换', description: '可切换并预览已有日程周次', category: 'interaction' },
  imageExport: { name: '图片导出', description: '可将当前日程导出为高清图片', category: 'interaction' },

  // —— 点歌 ——
  requestSong: { name: '网页点播', description: '在网页直接发起点歌请求', category: 'request' },
  liveRequestStatus: { name: '点歌状态', description: '展示演唱中 / 排队中状态', category: 'request' },
  platformLink: { name: '平台跳转', description: '跳转网易云 / QQ音乐 / 抖音等外部平台', category: 'request' },
  embedRequestQueue: { name: '内嵌点歌队列', description: '内嵌 OBS 点歌队列面板', category: 'request' },

  // —— 门槛 ——
  scPrice: { name: 'SC价格', description: '展示点歌所需 SC 价格', category: 'threshold' },
  guardRequirement: { name: '舰长门槛', description: '展示舰长 / 提督 / 总督点歌门槛', category: 'threshold' },
  fanMedalRequirement: { name: '粉丝牌门槛', description: '展示粉丝牌点歌门槛', category: 'threshold' },

  // —— 性能 ——
  pagination: { name: '分页', description: '分页加载, 适合中等曲库', category: 'performance' },
  virtualScroll: { name: '虚拟滚动', description: '虚拟列表渲染, 适合超大曲库', category: 'performance' },
  lazyLoad: { name: '懒加载', description: '滚动时增量加载更多', category: 'performance' },

  // —— 配置 ——
  templateConfig: { name: '自定义配置', description: '提供可视化配置项 (背景 / 链接 / 布局等)', category: 'config' },
  customHeading: { name: '自定义标题', description: '可修改模板主标题或副标题', category: 'config' },
  customColors: { name: '自定义配色', description: '可修改模板的主色、底色或强调色', category: 'config' },
  backgroundImage: { name: '背景图片', description: '支持上传自定义背景或纸张底图', category: 'config' },
  decorativeImages: { name: '自由装饰', description: '支持自由添加、缩放和摆放装饰图片', category: 'config' },
  artworkPosition: { name: '图片位置', description: '可调整角色图片在版面中的位置', category: 'config' },
  artworkEffect: { name: '图片效果', description: '可切换立绘的印刷或视觉处理效果', category: 'config' },
  appearancePreset: { name: '外观预设', description: '提供多套背景、标题栏或版式外观', category: 'config' },
} as const satisfies Record<string, TemplateCapabilityMeta>

export type TemplateCapability = keyof typeof TemplateCapabilities

/** 取单个能力的元数据 */
export function getCapabilityMeta(id: TemplateCapability): TemplateCapabilityMeta {
  return TemplateCapabilities[id]
}

/**
 * 生成能力标签的 NTag color 配置.
 * 背景用主题色低透明度 + 同色边框勾边, 保证暗色模式下标签也能与页面背景区分开.
 */
export function getCategoryTagColor(category: CapabilityCategory) {
  const c = CapabilityCategories[category].color
  return { color: `${c}26`, textColor: c, borderColor: `${c}66` }
}

/** 把能力 id 列表按分类分组, 返回 [分类, 该分类下的能力项[]] 的有序数组 (空分类省略) */
export function groupCapabilities(
  ids: readonly TemplateCapability[] = [],
): Array<{ category: CapabilityCategory; items: Array<{ id: TemplateCapability } & TemplateCapabilityMeta> }> {
  const order = Object.keys(CapabilityCategories) as CapabilityCategory[]
  return order
    .map((category) => ({
      category,
      items: ids
        .filter((id) => TemplateCapabilities[id].category === category)
        .map((id) => ({ id, ...TemplateCapabilities[id] })),
    }))
    .filter((g) => g.items.length > 0)
}
