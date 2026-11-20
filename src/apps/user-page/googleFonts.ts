import { useLocalStorage } from '@vueuse/core'
import type { Ref } from 'vue'
import { ref, shallowRef, watch } from 'vue'

const GOOGLE_FONTS_CATALOG_URL = 'https://api.fontsource.org/v1/fonts'
const GOOGLE_FONTS_CSS_URL = 'https://font.webcache.cn/google/css2'
const GOOGLE_FONT_FAMILY_PATTERN = /^[a-z0-9 .&'()+-]{1,64}$/i
const MAX_RECENT_FONTS = 10
const NON_GOOGLE_FONT_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'Microsoft YaHei',
  'Source Han Sans SC',
  'Source Han Serif SC',
  'PingFang SC',
  'STKaiti',
  'KaiTi',
  'SimSun',
  'SimHei',
])

export const FONT_CATEGORY_LABELS: Record<string, string> = {
  'sans-serif': '无衬线',
  serif: '衬线',
  display: '展示',
  handwriting: '手写',
  monospace: '等宽',
}

export interface GoogleFontCatalogItem {
  family: string
  category: string
  subsets: string[]
  weights: number[]
  variable: boolean
}

interface FontsourceCatalogItem {
  family: string
  category: string
  type: string
  subsets?: unknown
  weights?: unknown
  variable?: unknown
}

interface FontLinkEntry {
  link: HTMLLinkElement
  references: number
}

export const googleFontsCatalog = shallowRef<GoogleFontCatalogItem[]>([])
export const googleFontsCatalogLoading = ref(false)
export const googleFontsCatalogError = ref('')
export const recentFontFamilies = useLocalStorage<string[]>('vtsuru:recent-fonts', [])

const fontLinks = new Map<string, FontLinkEntry>()
let catalogRequest: Promise<void> | null = null

export function isChineseGoogleFont(font: Pick<GoogleFontCatalogItem, 'subsets'>): boolean {
  return font.subsets.some((s) => s.startsWith('chinese'))
}

export function isJapaneseGoogleFont(font: Pick<GoogleFontCatalogItem, 'subsets'>): boolean {
  return font.subsets.includes('japanese')
}

export function getGoogleFontScriptBadge(font: Pick<GoogleFontCatalogItem, 'subsets'>): '中文' | '日文' | null {
  if (isChineseGoogleFont(font)) return '中文'
  if (isJapaneseGoogleFont(font)) return '日文'
  return null
}

export type FontScriptFilter = 'all' | 'zh' | 'ja' | 'system' | 'recent'

export interface FontPickerOption {
  label: string
  value: string
}

export interface FontBrowserEntry {
  value: string
  label: string
  source: 'google' | 'system'
  category?: string
  subsets?: string[]
  weights?: number[]
  variable?: boolean
}

export function buildFontBrowserEntries(
  extraOptions: readonly FontPickerOption[],
  catalog: readonly GoogleFontCatalogItem[],
  currentValue?: string | null,
): FontBrowserEntry[] {
  const seen = new Set<string>()
  const entries: FontBrowserEntry[] = []

  const catalogByFamily = new Map(catalog.map((f) => [f.family, f]))

  for (const option of extraOptions) {
    if (!option.value || seen.has(option.value)) continue
    seen.add(option.value)
    const googleMatch = catalogByFamily.get(option.value)
    entries.push({
      value: option.value,
      label: option.label,
      source: googleMatch ? 'google' : 'system',
      category: googleMatch?.category,
      subsets: googleMatch?.subsets,
      weights: googleMatch?.weights,
      variable: googleMatch?.variable,
    })
  }

  for (const font of catalog) {
    if (seen.has(font.family)) continue
    seen.add(font.family)
    entries.push({
      value: font.family,
      label: font.family,
      source: 'google',
      category: font.category,
      subsets: font.subsets,
      weights: font.weights,
      variable: font.variable,
    })
  }

  const selected = currentValue?.trim()
  if (selected && !seen.has(selected)) {
    entries.unshift({
      value: selected,
      label: selected,
      source: resolveLoadableGoogleFont(selected) ? 'google' : 'system',
    })
  }

  return entries
}

export function filterFontBrowserEntries(
  entries: readonly FontBrowserEntry[],
  options: {
    query?: string
    script?: FontScriptFilter
    category?: string | null
    recent?: readonly string[]
  },
): FontBrowserEntry[] {
  const query = options.query?.trim().toLocaleLowerCase() ?? ''
  const script = options.script ?? 'all'
  const category = options.category ?? null
  const recentList = options.recent ?? []

  if (script === 'recent') {
    const byValue = new Map(entries.map((e) => [e.value, e]))
    return recentList
      .map((v) => byValue.get(v))
      .filter((entry): entry is FontBrowserEntry => {
        if (!entry) return false
        if (category && entry.category !== category) return false
        if (query && !entry.label.toLocaleLowerCase().includes(query) && !entry.value.toLocaleLowerCase().includes(query)) {
          return false
        }
        return true
      })
  }

  return entries.filter((entry) => {
    if (script === 'system' && entry.source !== 'system') return false
    if (script === 'zh' && !(entry.source === 'google' && entry.subsets && isChineseGoogleFont({ subsets: entry.subsets }))) {
      return false
    }
    if (script === 'ja' && !(entry.source === 'google' && entry.subsets && isJapaneseGoogleFont({ subsets: entry.subsets }))) {
      return false
    }
    if (category && entry.category !== category) return false
    if (query && !entry.label.toLocaleLowerCase().includes(query) && !entry.value.toLocaleLowerCase().includes(query)) {
      return false
    }
    return true
  })
}

export function recordRecentFont(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return
  recentFontFamilies.value = [trimmed, ...recentFontFamilies.value.filter((f) => f !== trimmed)].slice(0, MAX_RECENT_FONTS)
}

export function normalizeGoogleFontFamily(value: unknown) {
  if (typeof value !== 'string') return ''
  const family = value.trim()
  return GOOGLE_FONT_FAMILY_PATTERN.test(family) ? family : ''
}

export function isValidGoogleFontFamily(value: unknown) {
  if (typeof value !== 'string') return false
  const family = normalizeGoogleFontFamily(value)
  return family.length > 0 && family === value.trim()
}

export function getGoogleFontFamilyCss(value: unknown) {
  const family = normalizeGoogleFontFamily(value)
  const fallback = 'Inter, "Noto Sans SC", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  return family ? `${JSON.stringify(family)}, ${fallback}` : fallback
}

/** 仅返回需要向 Google Fonts 请求样式表的字体名；本地系统字体与 CSS font stack 返回 undefined */
export function resolveLoadableGoogleFont(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes(',') || NON_GOOGLE_FONT_FAMILIES.has(trimmed)) return undefined
  return normalizeGoogleFontFamily(trimmed) || undefined
}

/** 生成可直接用于 CSS fontFamily / Canvas 的字体字符串（兼容本地字体 stack 与 Google 字体名） */
export function resolveFontFamilyCss(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (trimmed.includes(',') || NON_GOOGLE_FONT_FAMILIES.has(trimmed)) return trimmed
  return getGoogleFontFamilyCss(trimmed)
}

function isCatalogItem(value: unknown): value is FontsourceCatalogItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const item = value as Record<string, unknown>
  return (
    item.type === 'google' &&
    typeof item.family === 'string' &&
    typeof item.category === 'string' &&
    isValidGoogleFontFamily(item.family)
  )
}

export async function loadGoogleFontsCatalog() {
  if (googleFontsCatalog.value.length) return
  if (catalogRequest) return catalogRequest

  catalogRequest = (async () => {
    googleFontsCatalogLoading.value = true
    googleFontsCatalogError.value = ''
    try {
      const response = await fetch(GOOGLE_FONTS_CATALOG_URL)
      if (!response.ok) throw new Error(`Google Fonts catalog returned ${response.status}`)
      const data: unknown = await response.json()
      if (!Array.isArray(data)) throw new Error('Google Fonts catalog is not an array')
      const catalog: GoogleFontCatalogItem[] = data
        .filter(isCatalogItem)
        .map((item) => ({
          family: item.family,
          category: item.category,
          subsets: Array.isArray(item.subsets) ? item.subsets.filter((s): s is string => typeof s === 'string') : [],
          weights: Array.isArray(item.weights) ? item.weights.filter((w): w is number => typeof w === 'number') : [400],
          variable: Boolean(item.variable),
        }))
        .toSorted((a, b) => a.family.localeCompare(b.family))
      if (!catalog.length) throw new Error('Google Fonts catalog is empty')
      googleFontsCatalog.value = catalog
    } catch (error) {
      googleFontsCatalogError.value = 'Google Fonts 字体目录加载失败'
      catalogRequest = null
      throw error
    } finally {
      googleFontsCatalogLoading.value = false
    }
  })()

  return catalogRequest
}

function acquireGoogleFont(value: unknown) {
  const family = resolveLoadableGoogleFont(value)
  if (!family || typeof document === 'undefined') return () => {}

  const existing = fontLinks.get(family)
  if (existing) {
    existing.references++
    return () => releaseGoogleFont(family)
  }

  const url = new URL(GOOGLE_FONTS_CSS_URL)
  url.searchParams.set('family', family)
  url.searchParams.set('display', 'swap')
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url.toString()
  link.dataset.vtsuruGoogleFont = family
  link.addEventListener(
    'error',
    () => {
      if (fontLinks.get(family)?.link === link) fontLinks.delete(family)
      link.remove()
      console.error(`Google Font 加载失败: ${family}`)
    },
    { once: true },
  )
  document.head.appendChild(link)
  fontLinks.set(family, { link, references: 1 })
  return () => releaseGoogleFont(family)
}

function releaseGoogleFont(family: string) {
  const entry = fontLinks.get(family)
  if (!entry) return
  entry.references--
  if (entry.references > 0) return
  entry.link.remove()
  fontLinks.delete(family)
}

export function useGoogleFont(fontFamily: Readonly<Ref<string | undefined>>) {
  watch(
    fontFamily,
    (value, _previous, onCleanup) => {
      const release = acquireGoogleFont(value)
      onCleanup(release)
    },
    { immediate: true },
  )
}

export function useGoogleFonts(fontFamilies: Readonly<Ref<readonly (string | undefined)[]>>) {
  watch(
    fontFamilies,
    (values, _previous, onCleanup) => {
      const unique = new Set<string>()
      for (const value of values) {
        const family = resolveLoadableGoogleFont(value)
        if (family) unique.add(family)
      }
      const releases = [...unique].map((family) => acquireGoogleFont(family))
      onCleanup(() => {
        for (const release of releases) release()
      })
    },
    { immediate: true },
  )
}
