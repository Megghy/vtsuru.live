<script lang="ts" setup>
import { FunctionTypes } from '@/api/generated/model'
import { Settings2, SlidersHorizontal } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { DownloadConfig, useAccount } from '@/api/account'
import type { SongRequestInfo } from '@/api/client-types'
import { getApiLiveRequestGetActiveAndSettings } from '@/api/generated/live-request/live-request'
import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest } from '@/api/generated/model'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
import DynamicForm from '@/apps/manage/components/DynamicForm.vue'
import { useObsRealtimeSync } from '@/apps/obs/composables/useObsRealtimeSync'
import type { BiliProfile } from '@/apps/user-page/types'
import { SongListTemplateMap } from '@/shared/config/templates'
import { transformImageUrl } from '@/shared/services/imageTransform'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Spin } from '@/shared/ui/spin'
import { TooltipProvider } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { isSafeHttpUrl } from '@/shared/utils/songMedia'

import SongFloatingPlayer from './songListTemplate/components/SongFloatingPlayer.vue'
import SongQueueDrawer from './songListTemplate/components/SongQueueDrawer.vue'
import SongRequestConfirmDialog from './songListTemplate/components/SongRequestConfirmDialog.vue'
import SongScrollTopButton from './songListTemplate/components/SongScrollTopButton.vue'
import {
  Config as SharedSongListConfigSchema,
  DefaultConfig as SharedSongListDefaultConfig,
  type TraditionalConfigType,
} from './songListTemplate/traditionalSongListConfig'
import { provideSongPreviewPlayer } from './songListTemplate/utils/useSongPreviewPlayer'
import { useSongRequestFlow } from './songListTemplate/utils/useSongRequestFlow'

import './songListTemplate/songListTheme.css'

const SHARED_CONFIG_NAME = 'Template.SongList.Traditional'

const props = defineProps<{
  biliInfo: BiliProfile | undefined
  userInfo: ResponseUserInfo | undefined
  template?: string | undefined
  fakeData?: ResponseSongModel[]
}>()

const accountInfo = useAccount()
const message = useMessage()
const showSettingModal = ref(false)

const componentType = computed(() => {
  return props.template ?? props.userInfo?.extra?.templateTypes.songlist?.toLowerCase()
})

const currentData = ref<ResponseSongModel[]>([])
const dynamicConfigRef = ref()
const songsActive = ref<SongRequestInfo[]>([])
const settings = ref<SettingSongRequest>({
  allowFromWeb: false,
  allowAnonymousFromWeb: false,
  orderPrefix: '',
} as SettingSongRequest)

const isDataLoading = ref(true)
const isConfigLoading = ref(true)
const isRefreshingQueue = ref(false)
const isLoading = computed(() => isDataLoading.value || isConfigLoading.value)

const selectedTemplate = computed(() => {
  const type = componentType.value
  if (type && SongListTemplateMap[type]) return SongListTemplateMap[type]
  return SongListTemplateMap.traditional
})

const isTraditionalTemplate = computed(
  () => !componentType.value || componentType.value === 'traditional' || !SongListTemplateMap[componentType.value],
)

const activeConfigName = computed(() => selectedTemplate.value?.settingName ?? SHARED_CONFIG_NAME)

const selectedTemplateConfig = computed<ConfigItemDefinition[]>(() => {
  if (dynamicConfigRef.value?.Config) {
    return dynamicConfigRef.value.Config as ConfigItemDefinition[]
  }
  return SharedSongListConfigSchema as unknown as ConfigItemDefinition[]
})

const currentConfig = ref<Partial<TraditionalConfigType>>({})
const isOwner = computed(() => Boolean(props.userInfo?.id && props.userInfo.id === accountInfo.value.id))

const showQueueBar = computed(
  () =>
    !props.fakeData &&
    ((props.userInfo?.extra?.enableFunctions.includes(FunctionTypes.SongRequest) ?? false) ||
      songsActive.value.length > 0),
)

// 非传统模板下复用主播配置的背景图与快捷外链
const sharedBgStyle = computed(() => {
  if (isTraditionalTemplate.value) return undefined
  const path = currentConfig.value?.backgroundFile?.[0]?.path
  if (!path) return undefined
  const url = transformImageUrl(path, '1920w_90q')
  return url ? { '--song-list-bg-image': `url("${url}")` } : undefined
})

const sharedCustomLinks = computed(() => {
  if (isTraditionalTemplate.value) return []
  return (currentConfig.value?.links ?? [])
    .map((link) => ({ ...link, url: isSafeHttpUrl(link.url) }))
    .filter((link): link is { name: string; url: string } => Boolean(link.url && link.name))
})

const previewPlayer = provideSongPreviewPlayer()

async function getSongRequestInfo() {
  if (!props.userInfo?.id) return { songs: [], setting: settings.value }

  try {
    const data = await getApiLiveRequestGetActiveAndSettings({
      id: props.userInfo.id,
    })

    if (data.code === 200) {
      return data.data
    } else {
      message.warning(`获取点歌设置失败: ${data.message}`)
    }
  } catch (err) {
    console.error('获取点歌设置出错:', err)
    message.error(`获取点歌设置出错: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { songs: [], setting: settings.value }
}

async function refreshActiveQueue() {
  if (props.fakeData) return
  isRefreshingQueue.value = true
  try {
    const info = await getSongRequestInfo()
    if (info) {
      songsActive.value = info.songs || []
      if (info.setting) {
        settings.value = info.setting
      }
    }
  } finally {
    isRefreshingQueue.value = false
  }
}

const requestFlow = useSongRequestFlow({
  userInfo: () => props.userInfo,
  settings: () => settings.value,
  songsActive: () => songsActive.value,
  onActiveUpdated: refreshActiveQueue,
})

// 接入 SignalR 实时同步当前点歌队列变更，免刷新看到正在演唱与排队位次跳动
const { on: onLiveRequestRealtime } = useObsRealtimeSync({
  topic: () => (props.userInfo?.id && !props.fakeData ? `obs:display:live-request:${props.userInfo.id}` : ''),
  active: () => Boolean(!props.fakeData && props.userInfo?.id && showQueueBar.value),
  onSync: () => {
    void refreshActiveQueue()
  },
})
onLiveRequestRealtime('Changed', () => {
  void refreshActiveQueue()
})

const isOfflineBlocked = computed(
  () => Boolean(settings.value.enableOnStreaming) && props.userInfo?.streamerInfo?.isStreaming !== true,
)

async function getSongs() {
  if (!props.userInfo?.id) {
    isDataLoading.value = false
    return
  }

  isDataLoading.value = true

  try {
    const data = await getApiSongListGet({
      id: String(props.userInfo.id),
    })

    if (data.code === 200) {
      currentData.value = data.data || []
    } else {
      message.error(`加载歌单失败: ${data.message}`)
    }
  } catch (err) {
    console.error('加载歌单出错:', err)
    message.error(`加载歌单失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isDataLoading.value = false
  }
}

async function getConfig() {
  if (props.fakeData || !props.userInfo?.id) {
    isConfigLoading.value = false
    return
  }

  isConfigLoading.value = true

  try {
    const data = await DownloadConfig(activeConfigName.value, props.userInfo.id)

    if (data.msg) {
      currentConfig.value = dynamicConfigRef.value?.DefaultConfig ?? { ...SharedSongListDefaultConfig }
    } else {
      currentConfig.value = (data.data as Partial<TraditionalConfigType>) || {}
    }
  } catch (err) {
    console.error('加载配置出错:', err)
    currentConfig.value = dynamicConfigRef.value?.DefaultConfig ?? { ...SharedSongListDefaultConfig }
  } finally {
    isConfigLoading.value = false
  }
}

watch(
  () => [props.userInfo?.id, requestFlow.biliAuth.isAuthed] as const,
  ([newId], [oldId]) => {
    if (props.fakeData) return
    void getSongs()
    void refreshActiveQueue()
    void requestFlow.refreshUserPoints()
    if (newId !== oldId) {
      previewPlayer.closePlayer()
      void getConfig()
    }
  },
)

onMounted(async () => {
  if (!props.fakeData) {
    try {
      await Promise.all([getSongs(), refreshActiveQueue(), getConfig(), requestFlow.refreshUserPoints()])
    } catch (err) {
      console.error('初始化失败:', err)
      message.error(`初始化失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      isDataLoading.value = false
      isConfigLoading.value = false
    }
  } else {
    currentData.value = props.fakeData || []
    isDataLoading.value = false
    isConfigLoading.value = false
  }
})
</script>

<template>
  <TooltipProvider>
    <div
      class="song-list-surface relative"
      :class="{ 'has-background': Boolean(sharedBgStyle) }"
      :style="sharedBgStyle"
    >
      <!-- 顶部实用状态区：主播快捷管理 + 积分状态 + 全模板通用实时点歌队列条 -->
      <div
        v-if="isOwner || requestFlow.hasPointFeatures.value || showQueueBar || sharedCustomLinks.length > 0"
        class="max-w-[var(--vtsuru-page-max-width,1180px)] mx-auto px-[clamp(12px,2vw,24px)] pt-3 space-y-2"
      >
        <div
          v-if="isOwner"
          data-site-surface="bar"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/85 px-3 py-2 text-xs"
        >
          <span class="text-muted-foreground">当前正在浏览你的公开歌单展示页</span>
          <div class="flex flex-wrap items-center gap-2">
            <RouterLink
              v-slot="{ navigate }"
              to="/manage/song-list"
              custom
            >
              <Button
                variant="outline"
                size="xs"
                class="gap-1"
                @click="navigate"
              >
                <SlidersHorizontal class="size-3.5" />
                管理歌单
              </Button>
            </RouterLink>
            <Button
              variant="secondary"
              size="xs"
              class="gap-1"
              @click="showSettingModal = true"
            >
              <Settings2 class="size-3.5" />
              自定义外观
            </Button>
          </div>
        </div>

        <!-- 积分点歌与插队状态栏 -->
        <div
          v-if="requestFlow.hasPointFeatures.value"
          data-site-surface="bar"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 bg-card/85 px-3 py-2 text-xs"
        >
          <div class="flex flex-wrap items-center gap-2">
            <Badge
              v-if="requestFlow.basePointCost.value > 0"
              variant="secondary"
            >
              网页点歌 {{ requestFlow.basePointCost.value }} 积分
            </Badge>
            <Badge
              v-if="settings.allowPointPriority"
              variant="outline"
            >
              积分插队 {{ requestFlow.priorityPointCost.value }} 积分
            </Badge>
            <span
              v-if="requestFlow.biliAuth.isAuthed"
              class="text-muted-foreground"
            >
              我的积分:
              <strong class="text-foreground font-mono tabular-nums">{{ requestFlow.userPoints.value ?? '...' }}</strong>
            </span>
            <RouterLink
              v-else
              :to="{ name: 'bili-auth', query: { redirect: $route.fullPath } }"
              class="text-primary underline underline-offset-2"
            >
              绑定 B 站账号以查询并使用积分
            </RouterLink>
          </div>

          <div
            v-if="settings.allowPointPriority && requestFlow.myWaitingSongs.value.length > 0"
            class="flex flex-wrap items-center gap-1.5"
          >
            <span class="text-muted-foreground">我的排队:</span>
            <Button
              v-for="item in requestFlow.myWaitingSongs.value"
              :key="item.id"
              size="xs"
              variant="outline"
              :loading="requestFlow.prioritizingId.value === item.id"
              @click="requestFlow.priorityExistingSong(item)"
            >
              《{{ item.songName }}》插队 ({{ requestFlow.priorityPointCost.value }} 积分)
            </Button>
          </div>
        </div>

        <!-- 全模板通用的当前点歌队列状态条 & 右侧抽屉 -->
        <SongQueueDrawer
          v-if="showQueueBar"
          :songs-active="songsActive"
          :allow-point-priority="Boolean(settings.allowPointPriority)"
          :priority-point-cost="requestFlow.priorityPointCost.value"
          :queue-max-size="settings.queueMaxSize ?? 0"
          :is-offline-blocked="isOfflineBlocked"
          :current-user-uid="requestFlow.biliAuth.biliAuth?.userId"
          :prioritizing-id="requestFlow.prioritizingId.value"
          :cancelling-id="requestFlow.cancellingId.value"
          :refreshing="isRefreshingQueue"
          @refresh="refreshActiveQueue"
          @priority="requestFlow.priorityExistingSong"
          @cancel="requestFlow.cancelExistingSong"
        />

        <!-- 非传统模板下若主播配置了歌单外链，提供精简链接条 -->
        <div
          v-if="sharedCustomLinks.length > 0"
          class="flex flex-wrap items-center gap-1.5 text-xs"
        >
          <a
            v-for="link in sharedCustomLinks"
            :key="`${link.name}-${link.url}`"
            :href="link.url"
            target="_blank"
            rel="noopener noreferrer"
            class="px-2.5 py-1 rounded-full border border-border/70 bg-card/80 hover:bg-muted text-foreground transition"
          >
            {{ link.name }}
          </a>
        </div>
      </div>

      <!-- 模板主体 -->
      <Spin :show="isLoading">
        <component
          :is="selectedTemplate?.component"
          ref="dynamicConfigRef"
          :config="currentConfig"
          :user-info="userInfo"
          :bili-info="biliInfo"
          :data="currentData"
          :live-request-settings="settings"
          :live-request-active="songsActive"
          v-bind="$attrs"
          @request-song="requestFlow.requestSong"
        />
      </Spin>

      <!-- 全模板共享吸底迷你试听播放器 -->
      <SongFloatingPlayer
        v-model:is-lrc-loading="previewPlayer.isLrcLoading.value"
        :song="previewPlayer.previewSong.value"
        :minimized="previewPlayer.isMinimized.value"
        @close="previewPlayer.closePlayer"
        @toggle-minimize="previewPlayer.toggleMinimized"
      />

      <!-- 大曲库悬浮返回顶部 -->
      <SongScrollTopButton />

      <!-- 模板配置弹窗（全模板共享） -->
      <Dialog v-model:open="showSettingModal">
        <DialogContent class="max-w-[90vw] sm:max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>歌单页面自定义设置</DialogTitle>
          </DialogHeader>
          <DynamicForm
            :key="activeConfigName"
            :name="activeConfigName"
            :config-data="currentConfig"
            :config="selectedTemplateConfig"
          />
        </DialogContent>
      </Dialog>

      <!-- 统一点歌确认弹窗 -->
      <SongRequestConfirmDialog
        v-model:use-priority="requestFlow.usePriorityOnRequest.value"
        :song="requestFlow.pendingSong.value"
        :settings="settings"
        :base-point-cost="requestFlow.basePointCost.value"
        :priority-point-cost="requestFlow.priorityPointCost.value"
        :total-point-cost="requestFlow.totalPendingPointCost.value"
        :user-points="requestFlow.userPoints.value"
        :is-bili-authed="requestFlow.biliAuth.isAuthed"
        :is-submitting="requestFlow.isSubmittingRequest.value"
        @close="requestFlow.cancelPending"
        @confirm="requestFlow.submitWebSongRequest"
      />
    </div>
  </TooltipProvider>
</template>
