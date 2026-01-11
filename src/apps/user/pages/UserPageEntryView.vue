<script setup lang="ts">
import type { UserInfo } from '@/api/api-models'
import { NAlert, NButton, NResult, NSpin, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'
import { fetchUserPagesSettingsByUserId } from '@/features/user-page/api'
import type { UserPageConfig, UserPagesSettingsV1 } from '@/features/user-page/types'
import { validateBlockPageProject } from '@/features/user-page/block/schema'
import BlockPageRenderer from '@/features/user-page/block/BlockPageRenderer.vue'
import ContribPageRenderer from '@/features/user-page/contrib/ContribPageRenderer.vue'

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

function getUploadedFilePath(v: unknown): string {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ''
  const path = (v as any).path
  return typeof path === 'string' ? path : ''
}

const pageBg = computed(() => {
  if (renderMode.value !== 'block') return null
  const v = blockValidation.value
  if (!v || !v.ok) return null
  const theme = v.project.theme as any
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) return null

  const type = (theme.pageBackgroundType === 'color' || theme.pageBackgroundType === 'image') ? theme.pageBackgroundType : 'none'
  const coverSidebar = theme.pageBackgroundCoverSidebar !== false
  const blurMode = (theme.pageBackgroundBlurMode === 'background' || theme.pageBackgroundBlurMode === 'glass') ? theme.pageBackgroundBlurMode : 'none'
  const fit = (theme.pageBackgroundImageFit === 'contain' || theme.pageBackgroundImageFit === 'fill' || theme.pageBackgroundImageFit === 'none')
    ? theme.pageBackgroundImageFit
    : 'cover'
  const blur = Number(theme.pageBackgroundBlur)
  const blurPx = Number.isFinite(blur) ? Math.min(40, Math.max(0, Math.round(blur))) : 14
  const color = typeof theme.pageBackgroundColor === 'string' ? theme.pageBackgroundColor : 'transparent'
  const imagePath = getUploadedFilePath(theme.pageBackgroundImageFile)

  const enabled = type !== 'none' && (type !== 'image' || !!imagePath)
  return {
    enabled,
    type,
    color,
    imagePath,
    coverSidebar,
    blurMode,
    fit,
    blurPx,
  }
})

const pageBgVars = computed(() => {
  const bg = pageBg.value
  if (!bg || !bg.enabled) return {}
  const img = bg.type === 'image' ? bg.imagePath.trim() : ''
  const safeUrl = img ? img.replaceAll('"', '\\"') : ''
  return {
    '--user-page-bg-color': bg.type === 'color' ? bg.color : 'transparent',
    '--user-page-bg-image': safeUrl ? `url("${safeUrl}")` : 'none',
    '--user-page-bg-size': bg.fit === 'fill' ? '100% 100%' : (bg.fit === 'none' ? 'auto' : bg.fit),
    '--user-page-bg-blur': `${bg.blurPx}px`,
  } as Record<string, string>
})
</script>

<template>
  <NSpin :show="isLoading">
    <div
      class="root"
      :style="pageBgVars"
    >
      <div v-if="pageBg?.enabled && pageBg?.coverSidebar && pageBg?.blurMode === 'glass'" class="glass-surface">
        <template v-if="error">
          <NAlert type="error" style="margin-bottom: 12px" :show-icon="true">
            {{ error }}
          </NAlert>
        </template>

        <div
          v-if="pageSlug && pageConfig && (pageConfig.title || pageConfig.description)"
          style="max-width: 820px; margin: 0 auto 12px; padding: 0 12px"
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
            :project="blockValidation.project"
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
          style="max-width: 820px; margin: 0 auto 12px; padding: 0 12px"
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

          <div
            v-else-if="blockValidation && blockValidation.ok"
            :class="{
              'bg-host': !!pageBg?.enabled && !pageBg?.coverSidebar,
              'bg-blur': pageBg?.blurMode === 'background',
              glass: pageBg?.blurMode === 'glass',
            }"
            :style="pageBgVars"
          >
            <div v-if="pageBg?.enabled && !pageBg?.coverSidebar && pageBg?.blurMode === 'glass'" class="glass-surface">
              <BlockPageRenderer
                :project="blockValidation.project"
                :user-info="userInfo"
                :bili-info="biliInfo"
              />
            </div>
            <BlockPageRenderer
              v-else
              :project="blockValidation.project"
              :user-info="userInfo"
              :bili-info="biliInfo"
            />
          </div>
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
  inset: -24px;
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: none;
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
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}
@supports (background: color-mix(in srgb, white 50%, transparent)) {
  .glass-surface {
    background: color-mix(in srgb, var(--n-color) 55%, transparent);
  }
}
</style>
