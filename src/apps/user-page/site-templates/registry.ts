import { defineAsyncComponent, markRaw } from 'vue'

import type { UserPageThemeConfig } from '@/apps/user-page/themeConfig'
import type { TemplateCapability } from '@/shared/config/templateCapabilities'

export const SITE_TEMPLATE_IDS = [
  'default',
  'broadcast-hud',
  'editorial-zine',
  'liquid-prism',
  'acid-desktop',
  'raw-brutalist',
  'kinetic-stage',
] as const
export type SiteTemplateId = (typeof SITE_TEMPLATE_IDS)[number]
export type SiteShellMode = 'classic-sidebar' | 'top-bar' | 'floating-dock' | 'os-desktop'

export interface SiteTemplateDefinition {
  id: SiteTemplateId
  name: string
  englishName: string
  tagline: string
  shellMode: SiteShellMode
  shellLabel: string
  themeDefaults: Partial<UserPageThemeConfig>
  /** 模板装饰排版所需的附加 Google Font（不影响用户自定义主字体） */
  accentFonts?: readonly string[]
  /** 后台选择器缩略色板：[画布底色, 表面卡片, 强调主色] */
  previewSwatches: readonly [string, string, string]
  capabilities: readonly TemplateCapability[]
  homeComponent: any
}

const COMMON_INDEX_CAPABILITIES = [
  'backgroundImage',
  'characterArtwork',
  'showName',
  'showCover',
  'songCount',
] as const satisfies readonly TemplateCapability[]

export const SITE_TEMPLATES: readonly SiteTemplateDefinition[] = [
  {
    id: 'default',
    name: '直播档案',
    englishName: 'CHANNEL ARCHIVE',
    tagline: '经典侧栏导航与编辑档案布局，稳重清晰，适配全部内容模块。',
    shellMode: 'classic-sidebar',
    shellLabel: '经典侧栏',
    themeDefaults: {},
    previewSwatches: ['#f4f4f5', '#ffffff', '#0ea5e9'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue')),
    ),
  },
  {
    id: 'broadcast-hud',
    name: '信号控制台',
    englishName: 'BROADCAST HUD',
    tagline: '顶部机能状态栏、精密坐标网格与非对称战术监视台布局。',
    shellMode: 'top-bar',
    shellLabel: '顶栏机能导航',
    themeDefaults: {
      pageThemeMode: 'dark',
      primaryColor: '#22d3ee',
      radius: 4,
      borderStrength: 'normal',
      shadowLevel: 'none',
      surfaceOpacity: 88,
    },
    accentFonts: ['JetBrains Mono', 'Space Grotesk'],
    previewSwatches: ['#090d14', '#111827', '#22d3ee'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/BroadcastHudIndexTemplate.vue')),
    ),
  },
  {
    id: 'editorial-zine',
    name: '特设画报',
    englishName: 'EDITORIAL ZINE',
    tagline: '杂志刊头导航、微噪点纸感画布与日系竖排动能跨页排版。',
    shellMode: 'top-bar',
    shellLabel: '杂志刊头顶栏',
    themeDefaults: {
      pageThemeMode: 'light',
      primaryColor: '#be123c',
      radius: 2,
      borderStrength: 'normal',
      shadowLevel: 'none',
      surfaceOpacity: 92,
    },
    accentFonts: ['Noto Serif SC', 'Syne'],
    previewSwatches: ['#f6f3ec', '#fffdf9', '#e11d48'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/EditorialZineIndexTemplate.vue')),
    ),
  },
  {
    id: 'liquid-prism',
    name: '液态棱镜',
    englishName: 'LIQUID PRISM',
    tagline: '悬浮液态玻璃导航 Dock、光学折射高光边与 3D 全息典藏卡。',
    shellMode: 'floating-dock',
    shellLabel: '悬浮玻璃导航',
    themeDefaults: {
      pageThemeMode: 'dark',
      primaryColor: '#c084fc',
      radius: 20,
      borderStrength: 'subtle',
      shadowLevel: 'floating',
      surfaceOpacity: 88,
    },
    accentFonts: ['Plus Jakarta Sans', 'Space Grotesk'],
    previewSwatches: ['#0b1020', '#1e1b3a', '#a855f7'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/LiquidPrismIndexTemplate.vue')),
    ),
  },
  {
    id: 'acid-desktop',
    name: '酸性桌面 2000',
    englishName: 'ACID OS 2000',
    tagline: 'Y2K 复古系统顶栏与底栏任务条、点阵画布与可交互多窗口桌面。',
    shellMode: 'os-desktop',
    shellLabel: 'OS 桌面栏',
    themeDefaults: {
      pageThemeMode: 'dark',
      primaryColor: '#a3e635',
      radius: 2,
      borderStrength: 'strong',
      shadowLevel: 'none',
      surfaceOpacity: 90,
    },
    accentFonts: ['JetBrains Mono', 'Silkscreen'],
    previewSwatches: ['#0a0d0a', '#161b16', '#a3e635'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/AcidDesktopIndexTemplate.vue')),
    ),
  },
  {
    id: 'raw-brutalist',
    name: '粗野海报',
    englishName: 'RAW BRUTALIST',
    tagline: '粗实线分格顶栏、硬切偏移投影与展演海报式机械按压排版。',
    shellMode: 'top-bar',
    shellLabel: '粗框分格顶栏',
    themeDefaults: {
      pageThemeMode: 'light',
      primaryColor: '#c2410c',
      radius: 0,
      borderStrength: 'strong',
      shadowLevel: 'none',
      surfaceOpacity: 94,
    },
    accentFonts: ['Space Grotesk', 'JetBrains Mono'],
    previewSwatches: ['#f2efe9', '#ffffff', '#c2410c'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/RawBrutalistIndexTemplate.vue')),
    ),
  },
  {
    id: 'kinetic-stage',
    name: '宽银幕舞台',
    englishName: 'KINETIC STAGE',
    tagline: '极简透明顶栏与底部悬浮导航、胶片暗角聚光与宽银幕滚动舞台。',
    shellMode: 'floating-dock',
    shellLabel: '宽银幕悬浮栏',
    themeDefaults: {
      pageThemeMode: 'dark',
      primaryColor: '#f59e0b',
      radius: 12,
      borderStrength: 'subtle',
      shadowLevel: 'floating',
      surfaceOpacity: 90,
    },
    accentFonts: ['Syne', 'Plus Jakarta Sans'],
    previewSwatches: ['#09090b', '#171412', '#f59e0b'],
    capabilities: COMMON_INDEX_CAPABILITIES,
    homeComponent: markRaw(
      defineAsyncComponent(async () => import('@/apps/user/pages/indexTemplate/KineticStageIndexTemplate.vue')),
    ),
  },
] as const

export const SITE_TEMPLATE_MAP: Record<SiteTemplateId, SiteTemplateDefinition> = Object.fromEntries(
  SITE_TEMPLATES.map((tpl) => [tpl.id, tpl]),
) as Record<SiteTemplateId, SiteTemplateDefinition>

export function isValidSiteTemplateId(value: unknown): value is SiteTemplateId {
  return typeof value === 'string' && (SITE_TEMPLATE_IDS as readonly string[]).includes(value)
}

export function resolveSiteTemplateId(settingsSiteTemplate?: unknown): SiteTemplateId {
  if (isValidSiteTemplateId(settingsSiteTemplate)) return settingsSiteTemplate
  return 'default'
}

export function getSiteTemplate(id?: unknown): SiteTemplateDefinition {
  return SITE_TEMPLATE_MAP[resolveSiteTemplateId(id)]
}

/**
 * 合并整站模板默认主题与用户显式配置（后者永远优先）。
 * 跳过 undefined 与空字符串，避免覆盖底层默认值。
 */
export function mergeThemeWithSiteTemplate(
  templateId: SiteTemplateId,
  ...layers: Array<Record<string, unknown> | null | undefined>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...getSiteTemplate(templateId).themeDefaults }
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue
    for (const [key, value] of Object.entries(layer)) {
      if (value === undefined || value === null) continue
      if (typeof value === 'string' && value.trim() === '') continue
      if (key === 'pageThemeMode' && value === 'auto') {
        // 用户显式选择跟随站点时不强行保留模板默认明暗锁，但也允许 undefined 走模板默认
        continue
      }
      merged[key] = value
    }
  }
  return merged
}
