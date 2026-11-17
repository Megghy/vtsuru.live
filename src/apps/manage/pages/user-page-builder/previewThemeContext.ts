import type { Ref } from 'vue'
import { computed, onActivated, onBeforeUnmount, onDeactivated, ref, toValue, watch } from 'vue'

import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import type { CustomHtmlTheme } from '@/apps/user-page/block/customHtmlRuntime'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import type { BlockPageProject } from '@/apps/user-page/block/schema'
import { usePageCanvasColor } from '@/apps/user-page/canvasColor'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { resolvePageThemeIsDark, resolveUserPageReadableAccent } from '@/apps/user-page/theme'
import type { UserPageConfig, UserPagesSettings } from '@/apps/user-page/types'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { isDarkMode } from '@/shared/utils'

export interface UsePreviewThemeContextOptions {
  settings: () => UserPagesSettings | undefined
  currentPage: () => UserPageConfig | undefined
  currentProject: () => BlockPageProject | null | undefined
  darkOverride?: () => boolean | undefined
  respectPageThemeMode?: boolean
}

export function usePreviewThemeContext(options: UsePreviewThemeContextOptions) {
  const mergedTheme = computed<Record<string, any>>(() => {
    const settings = options.settings()
    const page = options.currentPage()
    const project = options.currentProject()
    return {
      ...settings?.theme,
      ...page?.theme,
      ...project?.theme,
    }
  })

  useGoogleFont(
    computed(() => (typeof mergedTheme.value.fontFamily === 'string' ? mergedTheme.value.fontFamily : undefined)),
  )

  const effectiveIsDark = computed(() => {
    const baseDark = options.darkOverride?.() ?? isDarkMode.value
    if (options.respectPageThemeMode === false) return baseDark
    return resolvePageThemeIsDark(mergedTheme.value.pageThemeMode, baseDark)
  })

  const resolvedBackground = computed(() => {
    const page = options.currentPage()
    const settings = options.settings()
    const project = options.currentProject()
    return (
      resolvePageBackground(page?.background) ??
      resolvePageBackground(settings?.background) ??
      resolvePageBackground(project?.theme)
    )
  })

  const canvasColor = usePageCanvasColor(resolvedBackground, effectiveIsDark)
  const bgVars = computed(() =>
    resolvedBackground.value ? getPageBackgroundCssVars(resolvedBackground.value, effectiveIsDark.value) : {},
  )
  const uiVars = computed(() => getUserPageThemeCssVars(mergedTheme.value, effectiveIsDark.value, canvasColor.value))

  const customHtmlTheme = computed<CustomHtmlTheme>(() => {
    const tokens = buildSiteTokens(effectiveIsDark.value)
    const vars = uiVars.value
    const rawPrimary = vars['--primary'] || tokens.brand
    const backgroundColor =
      typeof mergedTheme.value.backgroundColor === 'string' ? mergedTheme.value.backgroundColor : undefined
    return {
      fg: vars['--foreground'] || tokens.foreground,
      fgMuted: vars['--muted-foreground'] || tokens.mutedForeground,
      bg: vars['--background'] || tokens.canvas,
      bgElevated: vars['--popover'] || tokens.elevated,
      border: vars['--border'] || tokens.borderColor,
      primary: rawPrimary,
      primaryReadable: resolveUserPageReadableAccent(rawPrimary, backgroundColor, effectiveIsDark.value),
      radius: vars['--radius'] || tokens.radiusSurface,
      colorScheme: effectiveIsDark.value ? 'dark' : 'light',
    }
  })

  const customCss = computed(() => {
    const raw = options.settings()?.customCss
    return typeof raw === 'string' ? raw : ''
  })

  return {
    mergedTheme,
    effectiveIsDark,
    resolvedBackground,
    canvasColor,
    bgVars,
    uiVars,
    customHtmlTheme,
    customCss,
  }
}

function buildScopedPreviewCss(scopeSelector: string, rawCss: string) {
  const result = inspectCustomCss(rawCss)
  if (!result.css || result.issues.length) return ''
  // 将 :root 重写为 :scope 以便在预览容器作用域内生效而不污染工作台外层样式
  const normalized = result.css.replace(/:root\b/g, ':scope')
  return `@scope (${scopeSelector}) {\n${normalized}\n}`
}

export function useScopedCustomCssPreview(scopeSelector: string, cssSource: Ref<string> | (() => string)) {
  const active = ref(true)
  const scopedCss = computed(() => buildScopedPreviewCss(scopeSelector, toValue(cssSource) ?? ''))
  let element: HTMLStyleElement | null = null

  function sync(value: string) {
    element?.remove()
    element = null
    if (!value || typeof document === 'undefined') return
    element = document.createElement('style')
    element.dataset.vtsuruBuilderCustomCssPreview = scopeSelector
    element.textContent = value
    document.head.appendChild(element)
  }

  watch([scopedCss, active], ([value, isActive]) => sync(isActive ? value : ''), { immediate: true })
  onActivated(() => {
    active.value = true
  })
  onDeactivated(() => {
    active.value = false
  })
  onBeforeUnmount(() => sync(''))

  return { scopedCss }
}
