import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { ResponseVideoCollectModel } from '@/api/generated/model'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import { usePageCanvasColor } from '@/apps/user-page/canvasColor'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { usePublicUserCustomCss } from '@/apps/user-page/runtime/customCss'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { getUserPageAppearanceOverrides } from '@/apps/user-page/themeConfig'
import type { UserPagesSettings } from '@/apps/user-page/types'
import { buildSiteTokens } from '@/shared/config/theme/tokens'
import { isDarkMode } from '@/shared/utils'

export function useVideoCollectPageTheme(table: Ref<ResponseVideoCollectModel | null | undefined>) {
  const ownerSettings = ref<UserPagesSettings | null>(null)
  const isThemeLoading = ref(false)
  let requestId = 0

  watch(
    () => table.value?.owner.id,
    async (ownerId) => {
      const currentRequest = ++requestId
      ownerSettings.value = null
      if (!ownerId) {
        isThemeLoading.value = false
        return
      }

      isThemeLoading.value = true
      try {
        const settings = await fetchUserPagesSettingsByUserId(ownerId)
        if (currentRequest === requestId) ownerSettings.value = settings
      } catch (error) {
        console.error('加载视频征集所有者主题失败', error)
      } finally {
        if (currentRequest === requestId) isThemeLoading.value = false
      }
    },
    { immediate: true },
  )

  const appearanceTheme = computed(() => {
    const home = ownerSettings.value?.home
    const homeOverrides = home?.mode === 'block' ? getUserPageAppearanceOverrides(home.block?.theme) : {}
    return {
      ...ownerSettings.value?.theme,
      ...homeOverrides,
    }
  })
  const effectiveIsDark = computed(() => resolvePageThemeIsDark(appearanceTheme.value?.pageThemeMode, isDarkMode.value))
  const pageBackground = computed(() => resolvePageBackground(ownerSettings.value?.background))
  const showDefaultBackdrop = computed(() => !isThemeLoading.value && !pageBackground.value)
  const canvasColor = usePageCanvasColor(pageBackground, effectiveIsDark)
  const pageThemeVars = computed(() => ({
    ...getUserPageThemeCssVars(appearanceTheme.value, effectiveIsDark.value, canvasColor.value),
    '--vtsuru-page-canvas': buildSiteTokens(effectiveIsDark.value).canvas,
  }))
  const pageBackgroundVars = computed(() =>
    pageBackground.value ? getPageBackgroundCssVars(pageBackground.value, effectiveIsDark.value) : {},
  )
  const pageBackgroundClass = computed(() => ({
    'has-background': Boolean(pageBackground.value),
    'background-blur': pageBackground.value?.blurMode === 'background',
    'background-glass': pageBackground.value?.blurMode === 'glass',
  }))

  useGoogleFont(computed(() => appearanceTheme.value?.fontFamily))
  usePublicUserCustomCss(ownerSettings)

  return {
    effectiveIsDark,
    pageBackgroundClass,
    pageBackgroundVars,
    pageThemeVars,
    showDefaultBackdrop,
  }
}
