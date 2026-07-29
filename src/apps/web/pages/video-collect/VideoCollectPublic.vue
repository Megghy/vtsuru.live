<script setup lang="ts">
import type { VideoCollectDetail, VideoCollectTable } from '@/api/api-models'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { darkTheme, NAlert, NButton, NCard, NConfigProvider, NDivider, NFlex, NInput, NInputNumber, NResult, NText, useMessage } from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import VueTurnstile from 'vue-turnstile'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, getUserPageNaiveThemeOverrides, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { usePublicUserCustomCss } from '@/apps/user-page/runtime/customCss'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { TURNSTILE_KEY, VIDEO_COLLECT_API_URL } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

interface AddVideoModel {
  id: string
  video: string
  name: string
  uid: number
  description: string
}

const message = useMessage()
const route = useRoute()
const biliAuth = useBiliAuth()
const token = ref('')
const turnstile = ref()
const addModel = ref({} as AddVideoModel)
const isLoading = ref(false)
const table = ref<VideoCollectTable | null>(await loadTable())
const ownerSettings = ref<UserPagesSettingsV1 | null>(await loadOwnerSettings(table.value))
const isBiliAuthed = computed(() => biliAuth.isAuthed && !!biliAuth.biliAuth?.userId)
const appearanceTheme = computed(() => ownerSettings.value?.theme)
const effectiveIsDark = computed(() => resolvePageThemeIsDark(appearanceTheme.value?.pageThemeMode, isDarkMode.value))
const pageNaiveTheme = computed(() => effectiveIsDark.value ? darkTheme : null)
const pageThemeVars = computed(() => getUserPageThemeCssVars(appearanceTheme.value, effectiveIsDark.value))
const pageBackground = computed(() => resolvePageBackground(ownerSettings.value?.background))
const pageBackgroundVars = computed(() => pageBackground.value
  ? getPageBackgroundCssVars(pageBackground.value, effectiveIsDark.value)
  : {})
const pageBackgroundClass = computed(() => ({
  'has-background': !!pageBackground.value,
  'background-blur': pageBackground.value?.blurMode === 'background',
  'background-glass': pageBackground.value?.blurMode === 'glass',
}))
const pageThemeOverrides = computed(() => ({
    ...getUserPageNaiveThemeOverrides(appearanceTheme.value, pageThemeVars.value),
    Layout: { color: 'transparent' },
}))

useGoogleFont(computed(() => appearanceTheme.value?.fontFamily))
usePublicUserCustomCss(ownerSettings)

watch(
  () => biliAuth.biliAuth,
  (auth) => {
    if (!auth?.userId) return
    addModel.value.name = auth.name
    addModel.value.uid = Number(auth.userId)
  },
  { immediate: true },
)

async function loadTable() {
  try {
    const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
    if (!id) throw new Error('缺少征集表 id')
    const response = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id })
    if (response.code === 404) return null
    if (response.code !== 200) throw new Error(response.message || '获取视频征集表失败')
    return response.data.table
  } catch (error) {
    console.error('获取视频征集表失败', error)
    message.error('获取失败')
    return null
  }
}

async function loadOwnerSettings(value: VideoCollectTable | null) {
  if (!value) return null
  try {
    return await fetchUserPagesSettingsByUserId(value.owner.id)
  } catch (error) {
    console.error('加载视频征集所有者主题失败', error)
    return null
  }
}

async function add() {
  if (!addModel.value.video) {
    message.error('请输入视频')
    return
  }

  isLoading.value = true
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  addModel.value.id = String(table.value?.id ?? id ?? '')
  const headers: [string, string][] = [['Turnstile', token.value]]
  try {
    const response = await (isBiliAuthed.value
      ? biliAuth.QueryBiliAuthPostAPI(`${VIDEO_COLLECT_API_URL}add`, addModel.value, headers)
      : QueryPostAPI(`${VIDEO_COLLECT_API_URL}add`, addModel.value, headers))
    if (response.code !== 200) {
      message.error(`添加失败: ${response.message}`)
      return
    }
    message.success('已成功推荐视频')
    setTimeout(() => location.reload(), 1000)
  } catch (error) {
    console.error('推荐视频失败', error)
    message.error('添加失败')
  } finally {
    isLoading.value = false
    turnstile.value?.reset()
  }
}

onUnmounted(() => turnstile.value?.remove())
</script>

<template>
  <NConfigProvider :theme="pageNaiveTheme" :theme-overrides="pageThemeOverrides">
    <div
      class="video-collect-public page-root"
      :class="pageBackgroundClass"
      :style="[pageThemeVars, pageBackgroundVars]"
    >
      <main class="video-collect-public__content">
        <NResult
          v-if="!table"
          status="404"
          title="指定收集表不存在"
          description="检查一下你输入的链接吧"
        />
        <NCard v-else class="video-collect-public__card">
          <template #header>
            视频征集
            <NDivider vertical />
            <NButton
              text
              @click="$router.push({ name: 'user-index', params: { id: table.owner.name } })"
            >
              <NText depth="3" class="video-collect-public__owner">
                {{ table.owner.name }}
              </NText>
            </NButton>
          </template>
          <VideoCollectInfoCard :item="table" :can-click="false" from="user" />
          <NDivider />
          <NAlert v-if="table.isFinish" type="error" title="该征集表已截止" />
          <NFlex v-else vertical>
            <NInput v-model:value="addModel.video" placeholder="B站视频链接或BVID" />
            <NInput
              v-model:value="addModel.name"
              placeholder="(选填) 推荐人"
              :disabled="isBiliAuthed"
            />
            <NInputNumber
              v-model:value="addModel.uid"
              placeholder="(选填) 推荐人UId"
              :show-button="false"
              :disabled="isBiliAuthed"
            />
            <NInput v-model:value="addModel.description" placeholder="(选填) 推荐理由" />
            <NButton type="primary" :loading="isLoading || !token" @click="add">
              推荐视频
            </NButton>
            <VueTurnstile
              ref="turnstile"
              v-model="token"
              :site-key="TURNSTILE_KEY"
              :theme="effectiveIsDark ? 'dark' : 'light'"
              class="video-collect-public__turnstile"
            />
          </NFlex>
        </NCard>
      </main>
    </div>
  </NConfigProvider>
</template>

<style scoped>
.video-collect-public {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  isolation: isolate;
  color: var(--vtsuru-page-text);
  background: var(--n-body-color);
  font-family: var(--vtsuru-page-font-family);
}

.video-collect-public.has-background {
  background: transparent;
}

.video-collect-public.has-background::before,
.video-collect-public.has-background::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.video-collect-public.has-background::before {
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  z-index: -2;
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-position: center;
  background-size: var(--user-page-bg-size, cover);
}

.video-collect-public.has-background::after {
  inset: 0;
  z-index: -1;
  background: var(--user-page-bg-scrim, transparent);
}

.video-collect-public.background-blur::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}

.video-collect-public.background-glass::after {
  background:
    linear-gradient(var(--glass-surface-bg), var(--glass-surface-bg)),
    var(--user-page-bg-scrim, transparent);
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}

.video-collect-public__content {
  min-height: 100vh;
  padding: 24px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  place-items: center;
}

.video-collect-public__card {
  width: min(500px, 100%);
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.video-collect-public__owner {
  font-size: 14px;
}

.video-collect-public__turnstile {
  max-width: 100%;
  overflow: hidden;
  text-align: center;
}

.video-collect-public__turnstile :deep(iframe) {
  max-width: 100%;
}

@media (max-width: 520px) {
  .video-collect-public__content {
    padding: 14px;
  }

  .video-collect-public__card {
    width: 100%;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .video-collect-public.background-glass::after {
    background: var(--vtsuru-bg-elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
