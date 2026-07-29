<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import type { BiliProfileStatus, UserPageConfig } from '@/apps/user-page/types'
import { NButton, NResult, NText } from 'naive-ui'
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import { validateRenderableBlockPageProject } from '@/apps/user-page/block/schema'
import ContribPageRenderer from '@/apps/user-page/contrib/ContribPageRenderer.vue'
import { usePublicUserPageRuntime } from '@/apps/user-page/runtime/context'
import { reportPublicPageError } from '@/apps/user-page/runtime/observability'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { isDarkMode } from '@/shared/utils'

defineProps<{
  biliInfo: any | undefined
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
  return pageSlug.value ? settings.value.pages?.[pageSlug.value] ?? null : settings.value.home ?? null
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
    reportPublicPageError(new Error(validation.issues.map(issue => issue.message).join('; ')), 'render')
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

const contentMaxWidth = computed(() => {
  const value = mergedBlockProject.value?.theme?.pageMaxWidth
  return typeof value === 'string' && value.trim() ? value.trim() : '820px'
})

const effectiveIsDark = computed(() => {
  const modes = [
    mergedBlockProject.value?.theme?.pageThemeMode,
    pageConfig.value?.theme?.pageThemeMode,
    settings.value?.theme?.pageThemeMode,
  ]
  const mode = modes.find(value => value === 'light' || value === 'dark')
  return resolvePageThemeIsDark(mode, isDarkMode.value)
})

const contentThemeVars = computed(() => {
  const theme = mergedBlockProject.value?.theme ?? {
    ...settings.value?.theme,
    ...pageConfig.value?.theme,
  }
  return getUserPageThemeCssVars(theme, effectiveIsDark.value)
})

const pageBackground = computed(() => resolvePageBackground(pageConfig.value?.background))
const globalBackground = computed(() => resolvePageBackground(settings.value?.background))
const blockBackground = computed(() => resolvePageBackground(mergedBlockProject.value?.theme))
const contentBackground = computed(() => {
  const background = pageBackground.value ?? globalBackground.value ?? blockBackground.value
  return background?.coverSidebar ? null : background
})
const contentBackgroundVars = computed(() => {
  return contentBackground.value
    ? getPageBackgroundCssVars(contentBackground.value, effectiveIsDark.value)
    : {}
})
const contentBackgroundClass = computed(() => ({
  'bg-host': !!contentBackground.value,
  'bg-blur': contentBackground.value?.blurMode === 'background',
}))
const contentClass = computed(() => ({
  'glass-surface': contentBackground.value?.blurMode === 'glass',
}))
</script>

<template>
  <div class="root" :style="contentThemeVars">
    <div :class="contentBackgroundClass" :style="contentBackgroundVars">
      <main class="content" :class="contentClass">
        <header
          v-if="pageSlug && pageConfig && (pageConfig.title || pageConfig.description)"
          class="page-heading"
          :style="{ maxWidth: contentMaxWidth }"
        >
          <NText v-if="pageConfig.title" tag="h1" class="page-heading__title">
            {{ pageConfig.title }}
          </NText>
          <NText v-if="pageConfig.description" depth="3" class="page-heading__summary">
            {{ pageConfig.description }}
          </NText>
        </header>

        <DefaultIndexTemplate
          v-if="renderMode === 'legacy'"
          :user-info="userInfo"
          :bili-info="biliInfo"
        />

        <template v-else-if="renderMode === 'block'">
          <NResult
            v-if="blockValidation && !blockValidation.ok"
            status="error"
            title="页面配置错误"
            description="该页面的发布配置无效，请联系页面所有者处理"
          />
          <BlockPageRenderer
            v-else-if="blockValidation?.ok && mergedBlockProject"
            :project="mergedBlockProject"
            :user-info="userInfo"
            :bili-info="biliInfo"
            :bili-status="biliStatus"
            :is-dark="effectiveIsDark"
          />
        </template>

        <ContribPageRenderer
          v-else-if="renderMode === 'contrib' && pageConfig?.contrib"
          :page="pageConfig.contrib"
          :user-info="userInfo"
          :bili-info="biliInfo"
        />

        <NResult
          v-else-if="pageSlug"
          status="404"
          title="页面不存在"
          description="该主播未配置此页面"
        >
          <template #footer>
            <NButton
              type="primary"
              @click="$router.push({ name: 'user-index', params: { id: route.params.id } })"
            >
              返回主页
            </NButton>
          </template>
        </NResult>
      </main>
    </div>
  </div>
</template>

<style scoped>
.root {
  min-height: 100vh;
}

.content {
  min-height: 100vh;
}

.page-heading {
  margin: 0 auto 12px;
  padding: 0 12px;
}

.page-heading__title,
.page-heading__summary {
  display: block;
}

.page-heading__title {
  margin: 0;
  color: var(--vtsuru-fg);
  font-size: 18px;
  font-weight: 600;
}

.page-heading__summary {
  margin-top: 4px;
  color: var(--vtsuru-fg);
}

.bg-host {
  position: relative;
  overflow: hidden;
}

.bg-host::before {
  content: "";
  position: absolute;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  z-index: 0;
  pointer-events: none;
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-position: center;
  background-size: var(--user-page-bg-size, cover);
}

.bg-host::after {
  content: "";
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
  background: var(--glass-surface-bg, color-mix(in srgb, var(--vtsuru-bg-elevated) 70%, transparent));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}

@media (prefers-reduced-transparency: reduce) {
  .glass-surface {
    background: var(--vtsuru-bg-elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
