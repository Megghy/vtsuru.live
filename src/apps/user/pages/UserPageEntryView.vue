<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { UserInfo } from '@/api/api-models'
import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import { validateRenderableBlockPageProject } from '@/apps/user-page/block/schema'
import { usePageCanvasColor } from '@/apps/user-page/canvasColor'
import ContribPageRenderer from '@/apps/user-page/contrib/ContribPageRenderer.vue'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { usePublicUserPageRuntime } from '@/apps/user-page/runtime/context'
import { reportPublicPageError } from '@/apps/user-page/runtime/observability'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import type { BiliProfile, BiliProfileStatus, UserPageConfig } from '@/apps/user-page/types'
import { IndexTemplateMap } from '@/shared/config/templates'
import { Button } from '@/shared/ui/button'
import { isDarkMode } from '@/shared/utils'

const props = defineProps<{
  biliInfo: BiliProfile | undefined
  biliStatus?: BiliProfileStatus
  userInfo: UserInfo | undefined
}>()

const route = useRoute()
const { settings } = usePublicUserPageRuntime()
const pageSlug = computed(() => {
  const value = route.params.pageSlug
  return typeof value === 'string' && value.length ? value : undefined
})

const pageConfig = computed<UserPageConfig | null>(() => {
  if (!settings.value) return null
  return pageSlug.value ? (settings.value.pages?.[pageSlug.value] ?? null) : (settings.value.home ?? null)
})

const renderMode = computed(() => {
  if (!pageSlug.value) return pageConfig.value?.mode ?? 'legacy'
  return pageConfig.value?.mode ?? null
})

const blockValidation = computed(() => {
  if (renderMode.value !== 'block') return null
  return validateRenderableBlockPageProject(pageConfig.value?.block)
})

watch(blockValidation, (validation) => {
  if (validation?.ok === false) {
    reportPublicPageError(new Error(validation.issues.map((issue) => issue.message).join('; ')), 'render')
  }
})

const mergedBlockProject = computed(() => {
  if (renderMode.value !== 'block') return null
  const validation = blockValidation.value
  if (!validation?.ok) return null
  return {
    ...validation.project,
    theme: {
      ...settings.value?.theme,
      ...pageConfig.value?.theme,
      ...validation.project.theme,
    },
  }
})

const effectiveIsDark = computed(() => {
  const modes = [
    mergedBlockProject.value?.theme?.pageThemeMode,
    pageConfig.value?.theme?.pageThemeMode,
    settings.value?.theme?.pageThemeMode,
  ]
  const mode = modes.find((value) => value === 'light' || value === 'dark')
  return resolvePageThemeIsDark(mode, isDarkMode.value)
})

const contentTheme = computed(
  () =>
    mergedBlockProject.value?.theme ?? {
      ...settings.value?.theme,
      ...pageConfig.value?.theme,
    },
)

useGoogleFont(computed(() => contentTheme.value.fontFamily))

const pageBackground = computed(() => resolvePageBackground(pageConfig.value?.background))
const globalBackground = computed(() => resolvePageBackground(settings.value?.background))
const blockBackground = computed(() => resolvePageBackground(mergedBlockProject.value?.theme))
const visualBackground = computed(() => pageBackground.value ?? globalBackground.value ?? blockBackground.value)
const contentBackground = computed(() => (visualBackground.value?.coverSidebar ? null : visualBackground.value))
const canvasColor = usePageCanvasColor(visualBackground, effectiveIsDark)
const contentThemeVars = computed(() =>
  getUserPageThemeCssVars(contentTheme.value, effectiveIsDark.value, canvasColor.value),
)
const contentBackgroundVars = computed(() => {
  return contentBackground.value ? getPageBackgroundCssVars(contentBackground.value, effectiveIsDark.value) : {}
})
const contentBackgroundClass = computed(() => ({
  'bg-host': !!contentBackground.value,
  'bg-blur': contentBackground.value?.blurMode === 'background',
}))
const indexTemplateComponent = computed(
  () =>
    IndexTemplateMap[props.userInfo?.extra?.templateTypes?.index || 'default']?.component ??
    IndexTemplateMap.default.component,
)
const contentClass = computed(() => ({
  'glass-surface': contentBackground.value?.blurMode === 'glass',
}))
</script>

<template>
  <div
    class="root"
    :style="contentThemeVars"
  >
    <div
      :class="contentBackgroundClass"
      :style="contentBackgroundVars"
    >
      <main
        class="content"
        :class="contentClass"
      >
        <component
          :is="indexTemplateComponent"
          v-if="renderMode === 'legacy'"
          :user-info="userInfo"
          :bili-info="biliInfo"
        />

        <template v-else-if="renderMode === 'block'">
          <div
            v-if="blockValidation && !blockValidation.ok"
            class="flex flex-col items-center justify-center p-12 text-center"
          >
            <div class="text-destructive font-semibold text-lg mb-2">页面配置错误</div>
            <div class="text-sm text-muted-foreground">该页面的发布配置无效，请联系页面所有者处理</div>
          </div>
          <BlockPageRenderer
            v-else-if="blockValidation?.ok && mergedBlockProject"
            :project="mergedBlockProject"
            :user-info="userInfo"
            :bili-info="biliInfo"
            :bili-status="biliStatus"
            :is-dark="effectiveIsDark"
            :canvas-color="canvasColor"
          />
        </template>

        <ContribPageRenderer
          v-else-if="renderMode === 'contrib' && pageConfig?.contrib"
          :page="pageConfig.contrib"
          :user-info="userInfo"
          :bili-info="biliInfo"
        />

        <div
          v-else-if="pageSlug"
          class="flex flex-col items-center justify-center p-12 text-center"
        >
          <div class="text-3xl font-bold mb-2">404</div>
          <div class="text-lg font-medium mb-1">页面不存在</div>
          <div class="text-sm text-muted-foreground mb-4">该主播未配置此页面</div>
          <Button @click="$router.push({ name: 'user-index', params: { id: route.params.id } })">
            返回主页
          </Button>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.root {
  min-height: 100vh;
  font-family: var(--vtsuru-page-font-family);
}

.content {
  min-height: 100vh;
}

.bg-host {
  position: relative;
  overflow: hidden;
}

.bg-host::before {
  content: '';
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-position: center;
  background-size: var(--user-page-bg-size, cover);
  background-attachment: fixed;
}

.bg-host::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background: var(--user-page-bg-scrim, transparent);
}

.bg-host.bg-blur::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}

.bg-host > * {
  position: relative;
  z-index: 1;
}

.glass-surface {
  padding: 12px 0;
  background: var(--glass-surface-bg, color-mix(in srgb, var(--popover) 70%, transparent));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}

@media (prefers-reduced-transparency: reduce) {
  .glass-surface {
    background: var(--popover);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
