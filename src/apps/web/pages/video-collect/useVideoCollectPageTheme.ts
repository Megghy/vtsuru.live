import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { VideoCollectTable } from '@/api/api-models'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import {
  getPageBackgroundCssVars,
  getUserPageThemeCssVars,
  resolvePageBackground,
} from '@/apps/user-page/background'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { usePublicUserCustomCss } from '@/apps/user-page/runtime/customCss'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { isDarkMode } from '@/shared/utils'

export function useVideoCollectPageTheme(table: Ref<VideoCollectTable | null | undefined>) {
  const ownerSettings = ref<UserPagesSettingsV1 | null>(null)
  let requestId = 0

  watch(
    () => table.value?.owner.id,
    async (ownerId) => {
      const currentRequest = ++requestId
      ownerSettings.value = null
      if (!ownerId) return

      try {
        const settings = await fetchUserPagesSettingsByUserId(ownerId)
        if (currentRequest === requestId) ownerSettings.value = settings
      } catch (error) {
        console.error('加载视频征集所有者主题失败', error)
      }
    },
    { immediate: true },
  )

  const appearanceTheme = computed(() => ownerSettings.value?.theme)
  const effectiveIsDark = computed(() => resolvePageThemeIsDark(appearanceTheme.value?.pageThemeMode, isDarkMode.value))
  const pageThemeVars = computed(() => getUserPageThemeCssVars(appearanceTheme.value, effectiveIsDark.value))
  const pageBackground = computed(() => resolvePageBackground(ownerSettings.value?.background))
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
  }
}
