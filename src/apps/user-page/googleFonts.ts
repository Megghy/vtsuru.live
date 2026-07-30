import type { Ref } from 'vue'
import { ref, shallowRef, watch } from 'vue'

const GOOGLE_FONTS_CATALOG_URL = 'https://api.fontsource.org/v1/fonts'
const GOOGLE_FONTS_CSS_URL = 'https://font.webcache.cn/google/css2'
const GOOGLE_FONT_FAMILY_PATTERN = /^[a-z0-9 .&'()+-]{1,64}$/i

export interface GoogleFontCatalogItem {
  family: string
  category: string
}

interface FontsourceCatalogItem extends GoogleFontCatalogItem {
  type: string
}

interface FontLinkEntry {
  link: HTMLLinkElement
  references: number
}

export const googleFontsCatalog = shallowRef<GoogleFontCatalogItem[]>([])
export const googleFontsCatalogLoading = ref(false)
export const googleFontsCatalogError = ref('')

const fontLinks = new Map<string, FontLinkEntry>()
let catalogRequest: Promise<void> | null = null

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
      const catalog = data
        .filter(isCatalogItem)
        .map(({ family, category }) => ({ family, category }))
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
  const family = normalizeGoogleFontFamily(value)
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
