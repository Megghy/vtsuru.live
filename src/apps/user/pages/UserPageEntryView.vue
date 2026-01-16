<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAlert, NButton, NResult, NSpin, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, resolvePageBackground } from '@/apps/user-page/background'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/apps/user-page/types'
import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import BlockPageRenderer from '@/apps/user-page/block/BlockPageRenderer.vue'
import ContribPageRenderer from '@/apps/user-page/contrib/ContribPageRenderer.vue'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

const route = useRoute()
const userId = computed(() => props.userInfo?.id)
const pageSlug = computed(() => {
  const v = route.params.pageSlug
  return typeof v === 'string' && v.length ? v : undefined
})

const isLoading = ref(false)
const error = ref<string | null>(null)
const settings = ref<UserPagesSettingsV1 | null>(null)

async function loadSettings(id: number) {
  isLoading.value = true
  error.value = null
  settings.value = null
  try {
    settings.value = await fetchUserPagesSettingsByUserId(id)
  } catch (e) {
    error.value = (e as Error).message || String(e)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => userId.value,
  async (id) => {
    if (!id) return
    await loadSettings(id)
  },
  { immediate: true },
)

const pageConfig = computed<UserPageConfig | null>(() => {
  if (!settings.value) return null
  if (!pageSlug.value) return settings.value.home ?? null
  return settings.value.pages?.[pageSlug.value] ?? null
})

const renderMode = computed(() => {
  if (!pageSlug.value) return pageConfig.value?.mode ?? 'legacy'
  return pageConfig.value?.mode ?? null
})

const blockValidation = computed(() => {
  if (renderMode.value !== 'block') return null
  return validateBlockPageProject(pageConfig.value?.block)
})

const contentMaxWidth = computed(() => {
  if (renderMode.value !== 'block') return '820px'
  const v = blockValidation.value
  if (!v || !v.ok) return '820px'
  const raw = (v.project.theme as any)?.pageMaxWidth
  if (typeof raw !== 'string') return '820px'
  const s = raw.trim()
  return s.length ? s : '820px'
})

const titleContainerStyle = computed(() => ({
  maxWidth: contentMaxWidth.value,
  margin: '0 auto 12px',
  padding: '0 12px',
}))

const pageBgOverride = computed(() => resolvePageBackground(pageConfig.value?.background))
const globalBg = computed(() => resolvePageBackground(settings.value?.background))
const blockThemeBg = computed(() => {
  if (renderMode.value !== 'block') return null
  const v = blockValidation.value
  if (!v || !v.ok) return null
  return resolvePageBackground(mergedBlockProject.value?.theme ?? v.project.theme)
})

const mergedBlockProject = computed(() => {
  if (renderMode.value !== 'block') return null
  const v = blockValidation.value
  if (!v || !v.ok) return null
  const globalTheme = (settings.value as any)?.theme ?? {}
  const pageTheme = (pageConfig.value as any)?.theme ?? {}
  const projectTheme = (v.project.theme as any) ?? {}
  return { ...v.project, theme: { ...globalTheme, ...pageTheme, ...projectTheme } }
})

const effectiveIsDark = computed(() => {
  const mode = (mergedBlockProject.value?.theme as any)?.pageThemeMode
  return mode === 'light' ? false : true
})

const contentBg = computed(() => {
  if (pageBgOverride.value) return pageBgOverride.value.coverSidebar ? null : pageBgOverride.value
  if (globalBg.value) return globalBg.value.coverSidebar ? null : globalBg.value
  if (blockThemeBg.value) return blockThemeBg.value.coverSidebar ? null : blockThemeBg.value
  return null
})

const contentBgVars = computed(() => {
  const bg = contentBg.value
  if (!bg) return {}
  return getPageBackgroundCssVars(bg, effectiveIsDark.value)
})

const contentBgClass = computed(() => ({
  'bg-host': !!contentBg.value,
  'bg-blur': contentBg.value?.blurMode === 'background',
  glass: contentBg.value?.blurMode === 'glass',
}))
</script>

<template>
  <NSpin :show="isLoading">
    <div class="root">
      <div :class="contentBgClass" :style="contentBgVars">
        <div v-if="contentBg?.blurMode === 'glass'" class="glass-surface">
          <NAlert
            v-if="error"
            type="error"
            style="margin-bottom: 12px"
            :show-icon="true"
          >
            {{ error }}
          </NAlert>

          <div
            v-if="pageSlug && pageConfig && (pageConfig.title || pageConfig.description)"
            :style="titleContainerStyle"
          >
            <NText v-if="pageConfig.title" style="font-size: 18px; font-weight: 600; display:block">
              {{ pageConfig.title }}
            </NText>
            <NText v-if="pageConfig.description" depth="3" style="display:block; margin-top: 4px">
              {{ pageConfig.description }}
            </NText>
          </div>

          <DefaultIndexTemplate v-if="renderMode === 'legacy'" :user-info="userInfo" :bili-info="biliInfo" />

          <template v-else-if="renderMode === 'block'">
            <NResult
              v-if="blockValidation && !blockValidation.ok"
              status="error"
              title="页面配置错误"
              :description="blockValidation.errors.join('；')"
            />
            <BlockPageRenderer
              v-else-if="blockValidation && blockValidation.ok"
              :project="mergedBlockProject || blockValidation.project"
              :user-info="userInfo"
              :bili-info="biliInfo"
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
        </div>

        <template v-else>
          <NAlert
            v-if="error"
            type="error"
            style="margin-bottom: 12px"
            :show-icon="true"
          >
            {{ error }}
          </NAlert>

          <div
            v-if="pageSlug && pageConfig && (pageConfig.title || pageConfig.description)"
            :style="titleContainerStyle"
          >
            <NText v-if="pageConfig.title" style="font-size: 18px; font-weight: 600; display:block">
              {{ pageConfig.title }}
            </NText>
            <NText v-if="pageConfig.description" depth="3" style="display:block; margin-top: 4px">
              {{ pageConfig.description }}
            </NText>
          </div>

          <DefaultIndexTemplate v-if="renderMode === 'legacy'" :user-info="userInfo" :bili-info="biliInfo" />

          <template v-else-if="renderMode === 'block'">
            <NResult
              v-if="blockValidation && !blockValidation.ok"
              status="error"
              title="页面配置错误"
              :description="blockValidation.errors.join('；')"
            />

            <BlockPageRenderer
              v-else-if="blockValidation && blockValidation.ok"
              :project="mergedBlockProject || blockValidation.project"
              :user-info="userInfo"
              :bili-info="biliInfo"
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
        </template>
      </div>
    </div>
  </NSpin>
</template>

<style scoped>
.root {
  min-height: 100vh;
}
.bg-host {
  position: relative;
  overflow: hidden;
}
.bg-host::before {
  content: "";
  position: absolute;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: none;
  pointer-events: none;
  z-index: 0;
}
.bg-host::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
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
  background: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}
</style>
