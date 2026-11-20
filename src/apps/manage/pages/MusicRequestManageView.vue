<script setup lang="ts">
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Desktop24Regular from '@vicons/fluent/es/Desktop24Regular'
import History24Regular from '@vicons/fluent/es/History24Regular'
import MusicNote224Filled from '@vicons/fluent/es/MusicNote224Filled'
import MusicNote224Regular from '@vicons/fluent/es/MusicNote224Regular'
import Settings24Regular from '@vicons/fluent/es/Settings24Regular'
import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { AppStartData } from '@/api/generated/model'
import MusicHistoryPanel from '@/apps/manage/pages/music-request/MusicHistoryPanel.vue'
import MusicLibraryPanel from '@/apps/manage/pages/music-request/MusicLibraryPanel.vue'
import MusicRulesPanel from '@/apps/manage/pages/music-request/MusicRulesPanel.vue'
import MusicWaitingPanel from '@/apps/manage/pages/music-request/MusicWaitingPanel.vue'
import MusicRequestOBS from '@/apps/obs/pages/request/MusicRequestOBS.vue'
import LiveConsolePageShell, {
  type LiveConsoleHeaderLink,
  type LiveConsoleTabItem,
} from '@/apps/open-live/components/shared/LiveConsolePageShell.vue'
import ObsStagePreview from '@/apps/open-live/components/shared/ObsStagePreview.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { copyToClipboard, useMessage } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useMusicRequestProvider } from '@/store/useMusicRequest'

defineProps<{
  roomInfo?: AppStartData
  code?: string | undefined
  isOpenLive?: boolean
}>()

const message = useMessage()
const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const musicRequestStore = useMusicRequestProvider()

const activeMainTab = ref<'queue' | 'songlist' | 'history' | 'preview' | 'settings'>('queue')

const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/music-request',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params: { style: 'glass' },
  }),
)

const headerLinks = computed<LiveConsoleHeaderLink[]>(() => [
  {
    label: 'OBS 浏览器源地址',
    value: obsUrl.value,
    description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600 或按需调整',
  },
])

const tabs = computed<LiveConsoleTabItem[]>(() => [
  {
    value: 'queue',
    label: '待播点歌',
    icon: MusicNote224Filled,
    badge: musicRequestStore.waitingMusics.length,
  },
  { value: 'songlist', label: '闲置曲库', icon: MusicNote224Regular },
  { value: 'history', label: '点歌历史', icon: History24Regular },
  { value: 'preview', label: 'OBS 预览', icon: Desktop24Regular },
  { value: 'settings', label: '规则与屏蔽', icon: Settings24Regular },
])

function copyWaitingList() {
  const text = formatListForCopy(musicRequestStore.waitingMusics, (item) => `${item.music.name} - ${item.from?.name}`)
  if (!text) {
    message.warning('当前待播点歌清单为空')
    return
  }
  void copyToClipboard(text, '待播点歌清单已复制到剪贴板')
}

function copySongList() {
  const text = formatListForCopy(musicRequestStore.originMusics, (m) => `${m.name} - ${m.author.join('/')}`)
  if (!text) {
    message.warning('当前曲库为空')
    return
  }
  void copyToClipboard(text, '曲库清单已复制到剪贴板')
}

onMounted(() => {
  client.onEvent('danmaku', musicRequestStore.handleDanmaku)
  void musicRequestStore.loadLibrary()
})

onActivated(() => {
  void musicRequestStore.loadLibrary()
})

onUnmounted(() => {
  client.offEvent('danmaku', musicRequestStore.handleDanmaku)
})
</script>

<template>
  <LiveConsolePageShell
    v-model="activeMainTab"
    title="点歌机系统"
    subtitle="观众通过发送点歌弹幕指令自动点歌并播放音频，支持闲置曲库轮播、冷却与黑名单拦截、以及 OBS 实时状态呈现"
    :links="headerLinks"
    :tabs="tabs"
  >
    <template #header-action>
      <div class="flex items-center gap-2">
        <Button
          variant="outline"
          @click="copyWaitingList"
        >
          <Copy24Regular class="size-4 mr-1" />
          复制待播单
        </Button>
        <Button
          variant="outline"
          @click="copySongList"
        >
          <MusicNote224Regular class="size-4 mr-1" />
          复制曲库
        </Button>
      </div>
    </template>

    <template #queue>
      <MusicWaitingPanel />
    </template>

    <template #songlist>
      <MusicLibraryPanel />
    </template>

    <template #history>
      <MusicHistoryPanel />
    </template>

    <template #preview>
      <ObsStagePreview
        obs-path="obs/music-request"
        :user-id="accountInfo?.id"
        copy-success-message="点歌机 OBS 源链接已复制 (已携带当前样式参数)"
        recommended-size="推荐 OBS 来源尺寸：宽 380px ~ 420px，高 520px ~ 640px。"
      >
        <template #default="{ styleType, speedMultiplier }">
          <MusicRequestOBS
            :id="accountInfo?.id"
            :key="`${accountInfo?.id}-${styleType}-${speedMultiplier}`"
            :style="styleType"
            :speed-multiplier="speedMultiplier"
          />
        </template>
      </ObsStagePreview>
    </template>

    <template #settings>
      <MusicRulesPanel />
    </template>
  </LiveConsolePageShell>
</template>
